import { COLORS, meaning } from './tiles.js';
import { countPairs } from './groups.js';

// The computer player. It looks at a hand the way a person does: which tiles already sit in runs and sets,
// which are one tile short of one, and which are lonely. Levels:
//   'kolay'  - looks at its own hand only, plays a little carelessly, sometimes misses that it can go out
//   'normal' - keeps the best arrangement, takes a thrown tile when it helps, goes for seven pairs when it holds many
//   'zor'    - also counts the tiles it has seen to know how likely a missing tile is, and does not throw
//              tiles the next player has shown interest in

const idx = (c, n) => c * 13 + (n - 1);
const FULL = 10; // value of a tile that sits in a finished run or set
const WILD = 8; // value of a wild okey that is not part of a group yet

// The best value of a set of tiles: every tile in a finished group counts FULL, a tile in a pair that one more tile
// would finish counts a little (more when that tile is likely to come), a loose tile almost nothing.
function makeEvaluator(aceHigh, outsOf, weight = 0.8) {
  const memo = new Map();
  const outs = (c, n) => (n < 1 || n > 13 ? 0 : outsOf(c, n));

  function best(cnt, wild) {
    let i = 0;
    while (i < 52 && cnt[i] === 0) i++;
    if (i === 52) return wild * WILD;
    const key = `${wild}|${cnt.join('')}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const c = Math.floor(i / 13);
    const n = (i % 13) + 1;
    cnt[i]--;
    let top = best(cnt, wild) + 0.05 * (7 - Math.abs(n - 7)); // the tile is left alone

    // sets and pairs of the same number
    const others = [0, 1, 2, 3].filter((d) => d !== c && cnt[idx(d, n)] > 0);
    for (let mask = 1; mask < 1 << others.length; mask++) {
      const picked = others.filter((_, b) => mask & (1 << b));
      for (const d of picked) cnt[idx(d, n)]--;
      const size = 1 + picked.length;
      const missing = [0, 1, 2, 3].filter((e) => e !== c && !picked.includes(e));
      if (size >= 3) top = Math.max(top, FULL * size + best(cnt, wild));
      else {
        top = Math.max(top, 4 + missing.reduce((a, e) => a + outs(e, n), 0) * weight + best(cnt, wild)); // a pair waiting for a third colour
        if (wild > 0) top = Math.max(top, FULL * 3 + best(cnt, wild - 1));
      }
      for (const d of picked) cnt[idx(d, n)]++;
    }

    // runs going up from this tile (the 1 after the 13 is position 14; a run has at most 13 tiles)
    const used = [];
    let w = wild;
    for (let pos = n, len = 0; pos <= Math.min(aceHigh ? 14 : 13, n + 12); pos++) {
      const here = idx(c, pos === 14 ? 1 : pos);
      if (pos === n) len++;
      else if (cnt[here] > 0) {
        cnt[here]--;
        used.push(here);
        len++;
      } else if (w > 0) {
        w--;
        len++;
      } else break;
      if (len >= 3) top = Math.max(top, FULL * len + best(cnt, w));
    }
    for (const x of used) cnt[x]++;
    if (aceHigh && n === 1) {
      // 1 as the top of a run: positions 12, 13, 14 and downwards
      for (let low = 12; low >= 2; low--) {
        const positions = [];
        for (let p = low; p <= 13; p++) positions.push(p);
        positions.push(14);
        const used = [];
        let w = wild;
        let ok = true;
        for (const p of positions.slice(0, -1)) {
          const here = idx(c, p);
          if (cnt[here] > 0) {
            cnt[here]--;
            used.push(here);
          } else if (w > 0) w--;
          else {
            ok = false;
            break;
          }
        }
        if (ok && positions.length >= 3) top = Math.max(top, FULL * positions.length + best(cnt, w));
        for (const x of used) cnt[x]++;
        if (!ok) break;
      }
    }

    // pairs in a colour: next to each other (n, n+1) or with a gap (n, n+2)
    if (n < 13 && cnt[idx(c, n + 1)] > 0) {
      cnt[idx(c, n + 1)]--;
      top = Math.max(top, 4 + (outs(c, n - 1) + outs(c, n + 2)) * weight + best(cnt, wild));
      cnt[idx(c, n + 1)]++;
    }
    if (n < 12 && cnt[idx(c, n + 2)] > 0) {
      cnt[idx(c, n + 2)]--;
      top = Math.max(top, 3 + outs(c, n + 1) * weight + best(cnt, wild));
      cnt[idx(c, n + 2)]++;
    }
    cnt[i]++;
    memo.set(key, top);
    return top;
  }

  return (tiles, okey) => {
    const cnt = new Array(52).fill(0);
    let wild = 0;
    for (const t of tiles) {
      const m = meaning(t, okey);
      if (!m) wild++;
      else cnt[idx(COLORS.indexOf(m.color), m.number)]++;
    }
    return best(cnt, wild);
  };
}

const constantOuts = () => 1.5;

// How good a hand is for building runs and sets (higher is closer to going out). `unseen` is optional:
// (colorIndex, number) => how many copies of that tile may still turn up.
export function handValue(tiles, okey, { aceHigh = true, unseen } = {}) {
  return makeEvaluator(aceHigh, unseen ? (c, n) => unseen(c, n) : constantOuts)(tiles, okey);
}

// Copies of each tile the seat cannot see yet: 2 minus what is in its hand, in the discards or turned up.
function unseenTable(h, seat) {
  const left = new Array(52).fill(2);
  const see = (t) => {
    const m = meaning(t, h.okey);
    if (m) left[idx(COLORS.indexOf(m.color), m.number)]--;
  };
  h.hands[seat].forEach(see);
  h.discards.flat().forEach(see);
  see(h.indicator);
  return (c, n) => Math.max(0, left[idx(c, n)]);
}

function danger(h, seat, tile) {
  // the next seat takes this tile if it fits what it picked up from discards before
  const next = (seat + 1) % 4;
  const m = meaning(tile, h.okey);
  if (!m) return 0;
  let risk = 0;
  for (const l of h.log) {
    if (l.seat !== next || l.type !== 'draw' || l.value !== 'discard') continue;
    const k = meaning(l.tile, h.okey);
    if (!k) continue;
    if (k.number === m.number && k.color !== m.color) risk += 1;
    if (k.color === m.color && Math.abs(k.number - m.number) <= 2 && k.number !== m.number) risk += 1;
  }
  return risk;
}

const without = (hand, tile) => {
  const at = hand.indexOf(tile);
  return hand.slice(0, at).concat(hand.slice(at + 1));
};

function evaluatorFor(h, seat, level) {
  const aceHigh = h.settings.aceHigh;
  return level === 'zor' ? makeEvaluator(aceHigh, unseenTable(h, seat)) : makeEvaluator(aceHigh, constantOuts);
}

const pairsWanted = (h, hand14) => h.settings.allowPairs && countPairs(hand14, h.okey) >= 5;

// Which tile to throw from a hand of 15 (when it cannot go out).
export function botDiscard(h, seat = h.turn, { level = 'normal', rng = Math.random } = {}) {
  const hand = h.hands[seat];
  const tiles = [...new Set(hand)];
  if (level === 'kolay' && rng() < 0.2) return tiles[Math.floor(rng() * tiles.length)];
  const value = evaluatorFor(h, seat, level);
  const aimPairs = level !== 'kolay' && pairsWanted(h, hand.slice(0, 14)) && tiles.some((t) => countPairs(without(hand, t), h.okey) >= 6);
  const ranked = tiles.map((t) => {
    const rest = without(hand, t);
    let score = aimPairs ? countPairs(rest, h.okey) * 10 + value(rest, h.okey) * 0.01 : value(rest, h.okey);
    if (level === 'zor' && !aimPairs) score -= danger(h, seat, t) * 1.2;
    if (level === 'kolay') score += (rng() - 0.5) * 12;
    return { t, score };
  }).sort((a, b) => b.score - a.score);
  // 'normal' now and then throws its second choice
  if (level === 'normal' && ranked.length > 1 && rng() < 0.12) return ranked[1].t;
  return ranked[0].t;
}

// Where to draw from: 'deck' or 'discard'.
export function botDraw(h, seat = h.turn, { level = 'normal', rng = Math.random } = {}) {
  const options = h.drawOptions(seat);
  if (options.length === 1) return options[0];
  const hand = h.hands[seat];
  const top = h.discards[h.previous(seat)].at(-1);
  if (level === 'kolay') return rng() < 0.15 ? 'discard' : 'deck';
  const value = evaluatorFor(h, seat, level);
  const mixed = hand.concat(top);
  if (pairsWanted(h, hand)) {
    const now = countPairs(hand, h.okey);
    const after = Math.max(...mixed.map((t) => countPairs(without(mixed, t), h.okey)));
    return after > now ? 'discard' : 'deck';
  }
  const now = value(hand, h.okey);
  const after = Math.max(...[...new Set(mixed)].map((t) => value(without(mixed, t), h.okey)));
  return after - now >= (level === 'zor' ? 1.8 : 1.5) ? 'discard' : 'deck';
}

// The action the seat on turn would take, without taking it: { type, value, seq, mode? } for OkeyHand.act,
// or null when the round is over. Lets a Web Worker or a server think and apply the move elsewhere.
export function botAction(h, { level = 'normal', rng = Math.random } = {}) {
  const seat = h.turn;
  const type = h.expects(seat);
  if (type === 'draw') return { type, value: botDraw(h, seat, { level, rng }), seq: h.seq };
  if (type !== 'discard') return null;
  const options = h.finishOptions(seat);
  if (options.length && !(level === 'kolay' && rng() < 0.15)) {
    const best = options.reduce((a, b) => (b.points > a.points ? b : a));
    return { type: 'finish', value: best.tile, mode: best.mode, seq: h.seq };
  }
  return { type: 'discard', value: botDiscard(h, seat, { level, rng }), seq: h.seq };
}

// Plays one move for the seat on turn. Returns false when the round is over.
export function botStep(h, { level = 'normal', rng = Math.random } = {}) {
  const action = botAction(h, { level, rng });
  if (!action) return false;
  const r = h.act(h.turn, action);
  if (!r.ok) throw new Error(`Computer move refused: ${r.error}`);
  return true;
}
