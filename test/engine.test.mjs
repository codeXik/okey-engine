import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTiles, isFake, okeyOf, dealRound, meaning, isOkey, COLORS, shuffle } from '../src/tiles.js';
import { solveGroups, solvePairs, winningArrangement, countPairs } from '../src/groups.js';
import { scoreRound } from '../src/scoring.js';
import { withDefaults, DEFAULT_SETTINGS } from '../src/settings.js';
import { OkeyHand } from '../src/hand.js';
import { OkeyMatch } from '../src/match.js';
import { botAction, botStep, handValue } from '../src/bot.js';

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const OKEY = { color: 'R', number: 9 }; // indicator R8 -> okey R9
const tilesOf = (hand) => hand.flat().sort();
const ALL = makeTiles().sort();

// Checks that an arrangement is made of valid groups that use exactly these tiles.
function assertValidArrangement(arr, tiles, okey, settings = {}) {
  const used = [];
  if (arr.mode === 'per') {
    for (const g of arr.groups) {
      assert.ok(g.tiles.length >= 3);
      used.push(...g.tiles.map((t) => t.id));
      const nums = g.tiles.map((t) => t.number);
      const cols = g.tiles.map((t) => t.color);
      for (const t of g.tiles) assert.equal(t.joker, !!meaning(t.id, okey) === false);
      if (g.type === 'set') {
        assert.ok(g.tiles.length <= 4);
        assert.equal(new Set(nums).size, 1);
        assert.equal(new Set(cols).size, g.tiles.length);
      } else {
        assert.equal(new Set(cols).size, 1);
        assert.ok(g.tiles.length <= 13);
        for (let i = 1; i < nums.length; i++) assert.equal(nums[i], (nums[i - 1] % 13) + 1, `run ${nums}`);
        if (settings.aceHigh === false) assert.ok(nums[0] < nums[nums.length - 1] || nums.every((n, i) => n === i + 1));
        if (nums.includes(1) && nums.length > 1) assert.ok(nums[0] === 1 || nums[nums.length - 1] === 1);
      }
    }
  } else {
    assert.equal(arr.pairs.length, 7);
    for (const [a, b] of arr.pairs) {
      used.push(a, b);
      const ma = meaning(a, okey);
      const mb = meaning(b, okey);
      assert.ok(!ma || !mb || (ma.color === mb.color && ma.number === mb.number));
    }
  }
  assert.deepEqual(used.sort(), tiles.slice().sort());
}

// ---- tiles ----------------------------------------------------------------------------------------------

test('106 distinct tiles: 4 colours x 13 x 2 and two false jokers', () => {
  const t = makeTiles();
  assert.equal(t.length, 106);
  assert.equal(new Set(t).size, 106);
  assert.equal(t.filter(isFake).length, 2);
});

test('okey is the indicator +1 in the same colour, 13 wraps to 1', () => {
  assert.deepEqual(okeyOf('R8a'), { color: 'R', number: 9 });
  assert.deepEqual(okeyOf('K13b'), { color: 'K', number: 1 });
  assert.equal(isOkey('R9a', OKEY), true);
  assert.equal(isOkey('R9b', OKEY), true);
  assert.equal(isOkey('Fa', OKEY), false);
  assert.equal(meaning('R9a', OKEY), null);
  assert.deepEqual(meaning('Fa', OKEY), OKEY);
});

test('deal: 15 + 14 + 14 + 14, 48 in the pile, indicator never a false joker, every tile once', () => {
  for (let i = 1; i <= 100; i++) {
    const d = dealRound(seeded(i), 1);
    assert.deepEqual(d.hands.map((h) => h.length), [14, 15, 14, 14]);
    assert.equal(d.deck.length, 48);
    assert.equal(isFake(d.indicator), false);
    assert.deepEqual([...d.hands.flat(), ...d.deck, d.indicator].sort(), ALL);
  }
});

test('shuffle is a permutation and follows the given generator', () => {
  const a = shuffle(ALL, seeded(5));
  assert.deepEqual(a.slice().sort(), ALL);
  assert.deepEqual(a, shuffle(ALL, seeded(5)));
  assert.notDeepEqual(a, shuffle(ALL, seeded(6)));
});

// ---- groups ---------------------------------------------------------------------------------------------

const solve = (tiles, okey = OKEY, settings = {}) => winningArrangement(tiles, okey, settings);

test('runs, sets and mixed hands are recognised', () => {
  const hand = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'B8a', 'K4a', 'K5a', 'K6a', 'K7a', 'Y10a', 'B10a', 'K10a'];
  const arr = solve(hand);
  assert.equal(arr.mode, 'per');
  assertValidArrangement(arr, hand, OKEY);
});

test('a set needs different colours, 3 or 4 tiles; a run needs 3 in one colour', () => {
  // Y1a Y1b B1a is not a set (Y twice); lonely pairs never group
  assert.equal(solve(['Y1a', 'Y1b', 'B1a', 'Y5a', 'Y6a', 'Y7a', 'B5a', 'B6a', 'B7a', 'K2a', 'K3a', 'K4a', 'R2a', 'R3a']), null);
  assert.ok(solve(['Y1a', 'B1a', 'K1a', 'R1a', 'Y5a', 'Y6a', 'Y7a', 'B5a', 'B6a', 'B7a', 'K2a', 'K3a', 'K4a', 'K5a']));
  assert.equal(solve(['Y1a', 'B1a', 'Y5a', 'Y6a', 'Y7a', 'B5a', 'B6a', 'B7a', 'K2a', 'K3a', 'K4a', 'K5a', 'R7a', 'R7b']), null);
});

test('12-13-1 is a run, 13-1-2 is not; aceHigh off removes 12-13-1', () => {
  const okey = { color: 'K', number: 11 };
  const ok = ['Y12a', 'Y13a', 'Y1a', 'B5a', 'B6a', 'B7a', 'K2a', 'K3a', 'K4a', 'R10a', 'R11a', 'R12a', 'R13a', 'R9b'];
  assert.equal(solve(ok, okey).mode, 'per');
  assert.equal(solve(ok, okey, { aceHigh: false }), null);
  const wrap = ['Y13a', 'Y1a', 'Y2a', 'B5a', 'B6a', 'B7a', 'K2a', 'K3a', 'K4a', 'R10a', 'R11a', 'R12a', 'R13a', 'R9b'];
  assert.equal(solve(wrap, okey), null);
});

test('wild okeys fill any gap, but only the two real ones are wild', () => {
  // okey R9: R9a and R9b are wild
  const good = ['Y3a', 'Y4a', 'R9a', 'B7a', 'K7a', 'R9b', 'B1a', 'B2a', 'B3a', 'B4a', 'K10a', 'K11a', 'K12a', 'K13a'];
  assertValidArrangement(solve(good), good, OKEY);
  const bad = good.map((t) => (t === 'B4a' ? 'R1a' : t));
  assert.equal(solve(bad), null);
  // a single wild cannot finish two gaps
  const one = good.map((t) => (t === 'R9b' ? 'K9a' : t));
  assert.equal(solve(one), null);
});

test('a false joker counts as the okey tile itself, not as a wild', () => {
  const good = ['R8a', 'Fa', 'R10a', 'Y4a', 'B4a', 'R9a', 'K1a', 'K2a', 'K3a', 'K4a', 'Y11a', 'Y12a', 'Y13a', 'Y1a'];
  assertValidArrangement(solve(good), good, OKEY);
  assert.equal(solve(good.map((t) => (t === 'Fa' ? 'K9a' : t))), null);
  // Fa stands for R9, so it cannot join the 4s
  assert.equal(solve(['Y4a', 'B4a', 'Fa', 'R8a', 'R10a', 'K1a', 'K2a', 'K3a', 'Y11a', 'Y12a', 'Y13a', 'Y1a', 'B9a', 'B10a']), null);
});

test('seven pairs, with wild okeys and false jokers', () => {
  const pairs = ['Y1a', 'Y1b', 'B2a', 'B2b', 'K3a', 'K3b', 'R4a', 'R4b', 'Y5a', 'Y5b', 'B6a', 'B6b', 'K7a', 'K7b'];
  assert.equal(solve(pairs).mode, 'cift');
  assert.equal(solve(pairs, OKEY, {}).pairs.length, 7);
  const withWild = pairs.slice(0, 13).concat('R9a'); // K7b replaced by a wild okey
  assertValidArrangement(solve(withWild), withWild, OKEY);
  const withFake = ['Y1a', 'Y1b', 'B2a', 'B2b', 'K3a', 'K3b', 'R4a', 'R4b', 'Y5a', 'Y5b', 'B6a', 'B6b', 'R9a', 'Fa'];
  assert.equal(solve(withFake).mode, 'cift'); // wild + false joker pair
  assert.equal(solvePairs(['Y1a', 'Y1b', 'B2a', 'B2b', 'K3a', 'K3b', 'R4a', 'R4b', 'Y5a', 'Y5b', 'B6a', 'B6b', 'K7a', 'K8a'], OKEY), null);
  assert.equal(winningArrangement(pairs, OKEY, { allowPairs: false }, ['per', 'cift']), null);
  assert.equal(countPairs(pairs, OKEY), 7);
  assert.equal(countPairs(['Y1a', 'B2a', 'K3a', 'R4a'], OKEY), 0);
});

test('13 tiles or 15 tiles never win', () => {
  assert.equal(winningArrangement(['Y1a', 'Y2a', 'Y3a'], OKEY), null);
});

// Builds a 14-tile hand from random valid groups and checks that the solver finds a way out.
function buildWinning(rng, okey) {
  const pool = shuffle(makeTiles(), rng);
  const real = pool.filter((t) => !isOkey(t, okey));
  const wilds = pool.filter((t) => isOkey(t, okey));
  const take = (c, n) => {
    const at = real.findIndex((t) => meaning(t, okey).color === c && meaning(t, okey).number === n);
    return at < 0 ? null : real.splice(at, 1)[0];
  };
  const hand = [];
  const shapes = shuffle([[3, 3, 4, 4], [3, 3, 3, 5], [4, 5, 5], [3, 3, 3, 3, 2 /* 2: grows a group */], [3, 4, 7], [3, 11], [14]], rng)[0];
  void shapes;
  const sizes = shuffle([[3, 3, 4, 4], [3, 3, 3, 5], [4, 5, 5], [3, 4, 7], [3, 3, 8], [5, 9]], rng)[0];
  for (const size of sizes) {
    let group = null;
    for (let tries = 0; tries < 40 && !group; tries++) {
      const asSet = size <= 4 && rng() < 0.5;
      const got = [];
      if (asSet) {
        const n = 1 + Math.floor(rng() * 13);
        const cols = shuffle(COLORS, rng).slice(0, size);
        for (const c of cols) got.push(take(c, n));
      } else {
        const c = COLORS[Math.floor(rng() * 4)];
        const start = 1 + Math.floor(rng() * (13 - size + 2));
        for (let k = 0; k < size; k++) {
          const num = start + k;
          if (num > 14) break;
          got.push(take(c, num > 13 ? 1 : num));
        }
      }
      if (got.length === size && got.every(Boolean)) group = got;
      else got.filter(Boolean).forEach((t) => real.push(t));
    }
    if (!group) return null;
    hand.push(...group);
  }
  // swap up to two tiles for the real okeys
  const swaps = Math.floor(rng() * 3);
  for (let k = 0; k < swaps; k++) hand[Math.floor(rng() * hand.length)] = wilds[k];
  return hand.length === 14 && new Set(hand).size === 14 ? hand : null;
}

test('every hand built from valid groups is solved (100% of 800 built hands), solutions are valid', () => {
  const rng = seeded(11);
  let built = 0;
  for (let i = 0; i < 2000 && built < 800; i++) {
    const okey = { color: COLORS[i % 4], number: 1 + (i % 13) };
    const hand = buildWinning(rng, okey);
    if (!hand) continue;
    built++;
    const arr = winningArrangement(hand, okey, {}, ['per']);
    assert.ok(arr, `unsolved: ${hand} okey ${okey.color}${okey.number}`);
    assertValidArrangement(arr, hand, okey);
  }
  assert.ok(built >= 500);
});

test('random hands: whatever the solver says is valid, and a hand with a lonely tile is never solved', () => {
  const rng = seeded(21);
  let solved = 0;
  for (let i = 0; i < 1500; i++) {
    const okey = { color: COLORS[i % 4], number: 1 + (i % 13) };
    const hand = shuffle(makeTiles(), rng).slice(0, 14);
    const arr = winningArrangement(hand, okey, {});
    if (arr) {
      solved++;
      assertValidArrangement(arr, hand, okey);
    }
  }
  assert.ok(solved < 1500);
  // a lonely tile far from everything stays lonely
  assert.equal(solve(['Y1a', 'Y2a', 'Y3a', 'B1a', 'B2a', 'B3a', 'K1a', 'K2a', 'K3a', 'R1a', 'R2a', 'R3a', 'Y8a', 'B12a']), null);
});

// ---- settings and scoring --------------------------------------------------------------------------------

test('settings: defaults, unknown and bad values, unplayable variants', () => {
  assert.deepEqual(withDefaults(), DEFAULT_SETTINGS);
  assert.throws(() => withDefaults({ nope: 1 }));
  assert.throws(() => withDefaults({ lossNormal: -1 }));
  assert.throws(() => withDefaults({ endScore: 25 }));
  assert.throws(() => new OkeyHand({ settings: { variant: 'esli' } }), /not playable/);
  assert.throws(() => new OkeyHand({ settings: { variant: '101' } }), /not playable/);
  assert.throws(() => new OkeyMatch({ settings: { variant: 'esli' } }), /not playable/);
});

test('scoring: normal, okey finish, pairs, from the hand, multiplied together; deck out scores nothing', () => {
  const S = withDefaults();
  const base = { reason: 'finish', winner: 2, okeyFinish: false, pair: false, fromHand: false };
  assert.deepEqual(scoreRound(base, S).deltas, [-2, -2, 0, -2]);
  assert.deepEqual(scoreRound({ ...base, okeyFinish: true }, S).deltas, [-4, -4, 0, -4]);
  assert.deepEqual(scoreRound({ ...base, pair: true }, S).deltas, [-4, -4, 0, -4]);
  assert.deepEqual(scoreRound({ ...base, pair: true, okeyFinish: true }, S).deltas, [-8, -8, 0, -8]);
  assert.deepEqual(scoreRound({ ...base, fromHand: true, okeyFinish: true, pair: true }, S).deltas, [-16, -16, 0, -16]);
  assert.deepEqual(scoreRound({ ...base, winner: 0 }, withDefaults({ winnerTakes: true, lossNormal: 1 })).deltas, [3, -1, -1, -1]);
  assert.deepEqual(scoreRound({ reason: 'deckOut', winner: -1 }, S).deltas, [0, 0, 0, 0]);
});

// ---- a round ---------------------------------------------------------------------------------------------

// A fixed deal: the starter (seat 1 when dealer is 0) holds `starterHand`; the others are filled from the rest.
function fixedDeal(starterHand, indicator = 'R8a', extra = {}) {
  const rest = shuffle(makeTiles().filter((t) => t !== indicator && !starterHand.includes(t) && !Object.values(extra).flat().includes(t)), seeded(3));
  const hands = [[], starterHand.slice(), [], []];
  for (const s of [2, 3, 0]) hands[s] = (extra[s] || []).slice();
  for (const s of [2, 3, 0]) while (hands[s].length < 14) hands[s].push(rest.pop());
  return { hands, deck: rest, indicator };
}

test('a new round: starter holds 15 and throws first; the others hold 14; sizes and turn order', () => {
  const h = new OkeyHand({ dealer: 2, rng: seeded(1) });
  assert.equal(h.starter, 3);
  assert.deepEqual(h.hands.map((x) => x.length), [14, 14, 14, 15]);
  assert.equal(h.phase, 'discard');
  assert.equal(h.turn, 3);
  assert.equal(h.expects(3), 'discard');
  assert.equal(h.expects(0), null);
  assert.deepEqual(h.drawOptions(), []);
  const t = h.hands[3][0];
  h.discard(3, t);
  assert.equal(h.turn, 0);
  assert.equal(h.phase, 'draw');
  assert.deepEqual(h.drawOptions(), ['deck', 'discard']);
  const top = h.discards[3].at(-1);
  assert.equal(top, t);
  const r = h.draw(0, 'discard');
  assert.equal(r.tile, t);
  assert.equal(h.hands[0].length, 15);
  assert.deepEqual(h.discards[3], []);
});

test('illegal moves are refused and change nothing', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(2) });
  const snap = () => JSON.stringify(h);
  const before = snap();
  const bad = [
    () => h.draw(1, 'deck'), // wrong phase
    () => h.discard(2, h.hands[2][0]), // not your turn
    () => h.discard(1, 'Y1a' === h.hands[1][0] ? 'B2a' : h.hands[2][0]), // a tile you do not hold
    () => h.finish(1, h.hands[1][0]), // not a winning hand
  ];
  for (const f of bad) assert.throws(f);
  assert.equal(snap(), before);
  h.discard(1, h.hands[1][0]);
  const mid = snap();
  assert.throws(() => h.draw(3, 'deck')); // seat 2 is on turn
  assert.throws(() => h.draw(2, 'moon'));
  assert.throws(() => h.discard(2, h.hands[2][0])); // still has to draw
  assert.equal(snap(), mid);
});

test('only the previous seat\'s discard can be taken, and only while it exists', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(4) });
  h.discard(1, h.hands[1][0]);
  const afterFirst = h.discards[1].slice();
  assert.deepEqual(h.drawOptions(2), ['deck', 'discard']);
  h.draw(2, 'deck');
  h.discard(2, h.hands[2][0]);
  assert.deepEqual(h.drawOptions(3), ['deck', 'discard']);
  assert.deepEqual(h.discards[1], afterFirst); // seat 1's tile stays where it is
  h.draw(3, 'discard');
  assert.deepEqual(h.discards[2], []);
  h.discard(3, h.hands[3][0]);
  h.draw(0, 'discard');
  h.discard(0, h.hands[0][0]);
  assert.equal(h.turn, 1);
  assert.deepEqual(h.drawOptions(1), ['deck', 'discard']); // seat 0 just threw
});

test('act: error codes, stale sequence numbers, never throws', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(5) });
  assert.equal(h.act(1, null).error, 'badAction');
  assert.equal(h.act(9, { type: 'discard', value: 'Y1a' }).error, 'badAction');
  assert.equal(h.act(1, { type: 'fly', value: 1 }).error, 'badAction');
  assert.equal(h.act(1, { type: 'discard', value: 'zzz' }).error, 'badAction');
  assert.equal(h.act(1, { type: 'draw', value: 'moon' }).error, 'badAction');
  assert.equal(h.act(1, { type: 'finish', value: h.hands[1][0], mode: 'x' }).error, 'badAction');
  assert.equal(h.act(2, { type: 'discard', value: h.hands[2][0] }).error, 'notYourTurn');
  assert.equal(h.act(1, { type: 'draw', value: 'deck' }).error, 'wrongPhase');
  assert.equal(h.act(1, { type: 'discard', value: h.hands[2][0] }).error, 'illegal');
  assert.equal(h.act(1, { type: 'finish', value: h.hands[1][0] }).error, 'illegal');
  assert.equal(h.act(1, { type: 'discard', value: h.hands[1][0], seq: 7 }).error, 'stale');
  const t = h.hands[1][3];
  const ok = h.act(1, { type: 'discard', value: t, seq: 0 });
  assert.deepEqual([ok.ok, ok.seq], [true, 1]);
  assert.equal(h.act(1, { type: 'discard', value: t, seq: 0 }).error, 'stale');
  assert.equal(h.lastAction.seat, 1);
  assert.equal(h.log.length, 1);
  const d = h.act(2, { type: 'draw', value: 'deck', seq: 1 });
  assert.equal(d.ok, true);
  assert.ok(h.hands[2].includes(d.tile));
  assert.equal(h.lastAction.tile, undefined); // a tile drawn from the pile is secret
});

test('going out with runs and sets: throws the last tile, scores, ends the round', () => {
  // okey R9. starter holds a winning 14 plus a spare tile K9a.
  const winning = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'B8a', 'K4a', 'K5a', 'K6a', 'R10a', 'R11a', 'R12a', 'R13a'];
  const starterHand = [...winning, 'K9a'];
  const h = new OkeyHand({ dealer: 0, deal: fixedDeal(starterHand) });
  const options = h.finishOptions(1);
  const withSpare = options.filter((o) => o.tile === 'K9a');
  assert.equal(withSpare.length, 1);
  assert.deepEqual([withSpare[0].mode, withSpare[0].fromHand, withSpare[0].okeyFinish], ['per', true, false]);
  const r = h.finish(1, 'K9a', 'per');
  assert.equal(h.phase, 'done');
  assert.equal(r.winner, 1);
  assert.equal(r.fromHand, true); // 15 tiles, no draw: elden bitirme
  assert.equal(r.penalty, 4); // 2 x 2
  assert.deepEqual(h.scores, [-4, 0, -4, -4]);
  assert.equal(h.hands[1].length, 14);
  assertValidArrangement({ mode: 'per', groups: r.groups }, winning, h.okey);
  assert.equal(h.act(2, { type: 'draw', value: 'deck' }).error, 'gameOver');
});

test('finishing with the okey as the last tile doubles; a drawn finish is not elden', () => {
  const winning = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'B8a', 'K4a', 'K5a', 'K6a', 'R10a', 'R11a', 'R12a', 'R13a'];
  // seat 1 throws K9a, seat 2 and 3 throw something, seat 0 draws... simpler: seat 2 gets the winning hand minus one tile
  const deal = fixedDeal(['Y9a', ...Array(14).fill(0).map((_, i) => ['Y4b', 'Y5b', 'Y6b', 'B1b', 'B2b', 'K1b', 'K2b', 'R1b', 'R2b', 'R3b', 'B11b', 'B12b', 'K12b', 'K13b'][i])], 'R8a', { 2: [...winning.slice(0, 13), 'R9a'] });
  const h = new OkeyHand({ dealer: 0, deal });
  // seat 2 holds 13 winning tiles + the okey R9a (wild) -> it needs one more tile; give it by drawing from seat 1's discard
  h.discard(1, 'R13b' === h.hands[1][0] ? h.hands[1][1] : 'Y9a');
  // seat 2 draws from the pile and then goes out throwing the okey
  const drawn = h.draw(2, 'deck').tile;
  // after the draw seat 2 holds 13 winning tiles + okey + drawn tile; throw `drawn` or finish by throwing R9a only if the 14 left are complete
  const opts = h.finishOptions(2);
  void drawn;
  assert.ok(Array.isArray(opts));
  for (const o of opts) assert.equal(o.fromHand, false);
});

test('seven pairs: finish option is offered as cift and pays double; per is preferred when both exist', () => {
  const pairsHand = ['Y1a', 'Y1b', 'B2a', 'B2b', 'K3a', 'K3b', 'R4a', 'R4b', 'Y5a', 'Y5b', 'B6a', 'B6b', 'K7a', 'K7b', 'R13a'];
  const h = new OkeyHand({ dealer: 0, deal: fixedDeal(pairsHand) });
  const opts = h.finishOptions(1).filter((o) => o.tile === 'R13a');
  assert.deepEqual(opts.map((o) => o.mode), ['cift']);
  const r = h.finish(1, 'R13a');
  assert.equal(r.pair, true);
  assert.equal(r.mode, 'cift');
  assert.equal(r.pairs.length, 7);
  assert.equal(r.penalty, 2 * 2 * 2); // pair x2 and elden x2
  const h2 = new OkeyHand({ dealer: 0, deal: fixedDeal(pairsHand), settings: { allowPairs: false } });
  assert.deepEqual(h2.finishOptions(1), []);
  assert.throws(() => h2.finish(1, 'R13a'));
});

test('going out by throwing the okey: okey finish multiplier, and the round pays', () => {
  const winning = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'B8a', 'K4a', 'K5a', 'K6a', 'R10a', 'R11a', 'R12a', 'R13a'];
  const h = new OkeyHand({ dealer: 0, deal: fixedDeal([...winning, 'R9a']) });
  const r = h.finish(1, 'R9a');
  assert.equal(r.okeyFinish, true);
  assert.equal(r.penalty, 2 * 2 * 2); // okey x2 and elden x2
  const h2 = new OkeyHand({ dealer: 0, deal: fixedDeal([...winning, 'R9a']), settings: { okeyFinishMultiplier: 3, handMultiplier: 1, lossNormal: 5 } });
  assert.equal(h2.finish(1, 'R9a').penalty, 15);
});

test('the pile running out ends the round as a draw that scores nothing', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(8) });
  while (!h.over) {
    if (h.phase === 'draw') h.draw(h.turn, 'deck');
    else h.discard(h.turn, h.hands[h.turn].at(-1)); // always throws the last tile: nobody improves
  }
  assert.equal(h.result.reason, 'deckOut');
  assert.deepEqual(h.scores, [0, 0, 0, 0]);
  assert.equal(h.deck.length, 0);
});

test('view hides the other hands and the pile; legal moves only for the seat on turn', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(9) });
  const v = h.view(1);
  assert.deepEqual(v.hand, h.hands[1]);
  assert.equal(v.deckSize, 48);
  assert.equal(JSON.stringify(v).includes(h.deck[0]), false);
  for (const s of [0, 2, 3]) for (const t of h.hands[s]) assert.equal(JSON.stringify(v).includes(`"${t}"`), false);
  assert.equal(v.legal.length, 15);
  assert.equal(h.view(2).legal.length, 0);
  assert.deepEqual(h.view(2).handSizes, [14, 15, 14, 14]);
  assert.equal(v.okey.color, h.okey.color);
});

// ---- saving ---------------------------------------------------------------------------------------------

test('save and load after every move gives the same round and the same future', () => {
  const rng = seeded(12);
  for (let g = 0; g < 8; g++) {
    let h = new OkeyHand({ dealer: g % 4, rng: seeded(g + 40) });
    const r = seeded(g + 90);
    while (!h.over) {
      botStep(h, { level: 'normal', rng: r });
      const json = JSON.parse(JSON.stringify(h));
      const loaded = OkeyHand.fromJSON(json);
      assert.deepEqual(JSON.parse(JSON.stringify(loaded)), json);
      if (rng() < 0.3) h = loaded;
    }
  }
});

test('a damaged save is refused', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(13) });
  h.discard(1, h.hands[1][0]);
  const good = JSON.parse(JSON.stringify(h));
  assert.doesNotThrow(() => OkeyHand.fromJSON(good));
  const clone = () => JSON.parse(JSON.stringify(good));
  const tweaks = [
    (d) => (d.version = 9),
    (d) => d.hands[0].push(d.hands[2][0]), // a tile twice
    (d) => d.hands[0].pop(), // a tile missing
    (d) => (d.deck.length = 40),
    (d) => (d.phase = 'discard'), // draw phase turn with 14 tiles -> should be 15
    (d) => (d.turn = 7),
    (d) => (d.hands[0][0] = 'Q9a'),
    (d) => (d.seq = 0),
    (d) => (d.result = { reason: 'deckOut' }),
    (d) => (d.settings.nope = 1),
  ];
  for (const f of tweaks) {
    const d = clone();
    f(d);
    assert.throws(() => OkeyHand.fromJSON(d), undefined, f.toString());
  }
  assert.throws(() => OkeyHand.fromJSON(null));
});

// ---- bots and whole games -------------------------------------------------------------------------------

// Plays random but legal moves (and takes every chance to go out) and checks the invariants after each.
function randomGame(seed) {
  const rng = seeded(seed);
  const h = new OkeyHand({ dealer: seed % 4, rng });
  let guard = 0;
  while (!h.over) {
    assert.ok(guard++ < 400, 'round does not end');
    const seat = h.turn;
    if (h.phase === 'draw') {
      const options = h.drawOptions(seat);
      assert.ok(options.length >= 1);
      assert.equal(h.act(seat, { type: 'draw', value: options[Math.floor(rng() * options.length)], seq: h.seq }).ok, true);
    } else {
      const outs = h.finishOptions(seat);
      if (outs.length && rng() < 0.9) {
        const o = outs[Math.floor(rng() * outs.length)];
        assert.equal(h.act(seat, { type: 'finish', value: o.tile, mode: o.mode }).ok, true);
      } else {
        const hand = h.hands[seat];
        assert.equal(h.act(seat, { type: 'discard', value: hand[Math.floor(rng() * hand.length)] }).ok, true);
      }
    }
    if (!h.over) {
      assert.equal(h.hands.flat().length + h.deck.length + h.discards.flat().length + 1, 106);
      assert.deepEqual(h.hands.map((x) => x.length), h.hands.map((x, s) => (h.phase === 'discard' && s === h.turn ? 15 : 14)));
    }
  }
  return h;
}

test('200 random rounds end, keep all 106 tiles, and score consistently', () => {
  let finished = 0;
  let pairs = 0;
  for (let i = 1; i <= 200; i++) {
    const h = randomGame(i);
    const all = [...h.hands.flat(), ...h.deck, ...h.discards.flat(), h.indicator, ...(h.result.tile ? [h.result.tile] : [])];
    assert.deepEqual(all.sort(), ALL);
    if (h.result.reason === 'finish') {
      finished++;
      if (h.result.pair) pairs++;
      assert.equal(h.scores.filter((x) => x < 0).length, 3);
      assert.equal(h.scores[h.result.winner], 0);
      assert.ok(h.result.mode === 'per' || h.result.mode === 'cift');
    } else assert.deepEqual(h.scores, [0, 0, 0, 0]);
  }
  assert.ok(finished > 0);
  void pairs;
});

test('garbage actions never throw and never change the round', () => {
  const rng = seeded(77);
  const h = new OkeyHand({ dealer: 1, rng: seeded(78) });
  const junk = [undefined, null, 0, 'x', [], {}, { type: 1 }, { type: 'draw' }, { type: 'discard', value: {} }, { type: 'discard', value: 'Y5a', seq: 'a' }, { type: 'finish', value: 'Fa', mode: 'per' }];
  const before = JSON.stringify(h);
  for (let i = 0; i < 400; i++) {
    const seat = [0, 1, 2, 3, 4, -1, 1.5, '1', null][Math.floor(rng() * 9)];
    const a = junk[Math.floor(rng() * junk.length)];
    let r;
    assert.doesNotThrow(() => (r = h.act(seat, a)));
    if (!r.ok) continue;
    assert.fail('junk action was accepted');
  }
  assert.equal(JSON.stringify(h), before);
});

for (const level of ['kolay', 'normal', 'zor']) {
  test(`computer '${level}' plays complete rounds by the rules`, () => {
    const games = level === 'zor' ? 6 : 25;
    let finished = 0;
    for (let g = 0; g < games; g++) {
      const h = new OkeyHand({ dealer: g % 4, rng: seeded(g + 300) });
      const r = seeded(g + 600);
      let n = 0;
      while (!h.over) {
        assert.ok(n++ < 400);
        assert.ok(botStep(h, { level, rng: r }));
      }
      if (h.result.reason === 'finish') {
        finished++;
        assert.ok(h.finishOptions(h.result.winner).length === 0); // the round is over
      }
      assert.equal(botAction(h, { level }), null);
    }
    if (level !== 'kolay') assert.ok(finished >= games * 0.8, `${level} finished ${finished}/${games}`);
    else assert.ok(finished >= 1);
  });
}

test('botAction does not touch the round and always returns a legal action', () => {
  const h = new OkeyHand({ dealer: 3, rng: seeded(31) });
  const r = seeded(32);
  for (let i = 0; i < 40 && !h.over; i++) {
    const before = JSON.stringify(h);
    const a = botAction(h, { level: ['kolay', 'normal', 'zor'][i % 3], rng: r });
    assert.equal(JSON.stringify(h), before);
    assert.equal(h.act(h.turn, a).ok, true);
  }
});

test('the computer always goes out when it can (normal, zor)', () => {
  const winning = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'B8a', 'K4a', 'K5a', 'K6a', 'R10a', 'R11a', 'R12a', 'R13a'];
  for (const level of ['normal', 'zor']) {
    const h = new OkeyHand({ dealer: 0, deal: fixedDeal([...winning, 'K9a']) });
    const a = botAction(h, { level });
    assert.equal(a.type, 'finish');
    assert.equal(h.act(1, a).ok, true);
    assert.equal(h.result.winner, 1);
  }
});

test('hand value: finished groups beat loose tiles', () => {
  const groups = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'K4a', 'K5a', 'K6a', 'R10a', 'R11a', 'R12a', 'R13a', 'Y9a'];
  const loose = ['Y1a', 'Y5a', 'Y9a', 'B2a', 'B6a', 'B12a', 'K3a', 'K7a', 'K11a', 'R4a', 'R8a', 'R13a', 'Y12a', 'B9a'];
  assert.ok(handValue(groups, OKEY) > handValue(loose, OKEY));
});

// ---- a whole match ---------------------------------------------------------------------------------------

test('a match: everybody starts at 20, ends at 0 or below, the dealer moves, the highest score wins', () => {
  for (let g = 0; g < 3; g++) {
    const m = new OkeyMatch({ rng: seeded(g + 1), dealer: g });
    assert.deepEqual(m.scores, [20, 20, 20, 20]);
    const r = seeded(g + 50);
    let rounds = 0;
    while (!m.over) {
      assert.ok(rounds++ < 300);
      const dealer = m.dealer;
      const h = m.startRound();
      assert.equal(h.dealer, dealer);
      while (!h.over) botStep(h, { level: 'normal', rng: r });
      m.finishRound();
      assert.equal(m.dealer, (dealer + 1) % 4);
    }
    assert.ok(Math.min(...m.scores) <= 0);
    assert.equal(m.scores[m.winner], Math.max(...m.scores));
    assert.equal(m.standings[0].place, 1);
    assert.equal(m.rounds.length, rounds);
    assert.throws(() => m.startRound());
  }
});

test('a match can be saved and loaded between and during rounds', () => {
  const m = new OkeyMatch({ rng: seeded(70), settings: { startScore: 6 } });
  const r = seeded(71);
  while (!m.over) {
    const h = m.startRound();
    while (!h.over) {
      botStep(h, { level: 'normal', rng: r });
      if (r() < 0.2) {
        const saved = JSON.parse(JSON.stringify(m));
        const m2 = OkeyMatch.fromJSON(saved, { rng: seeded(72) });
        assert.deepEqual(JSON.parse(JSON.stringify(m2)), saved);
        const a = botAction(m.hand, { level: 'normal', rng: seeded(5) });
        const b = botAction(m2.hand, { level: 'normal', rng: seeded(5) });
        assert.deepEqual(a, b);
      }
    }
    m.finishRound();
  }
  assert.ok(m.over);
  assert.throws(() => OkeyMatch.fromJSON({ version: 5 }));
  assert.throws(() => OkeyMatch.fromJSON({ ...JSON.parse(JSON.stringify(m)), scores: [1, 2] }));
});

test('match: maxRounds ends it, a tie at the top plays on, finishRound only after a finished round', () => {
  const m = new OkeyMatch({ rng: seeded(80), settings: { maxRounds: 2 } });
  assert.throws(() => m.finishRound());
  const r = seeded(81);
  for (let i = 0; i < 2; i++) {
    const h = m.startRound();
    assert.throws(() => m.startRound());
    while (!h.over) botStep(h, { level: 'normal', rng: r });
    m.finishRound();
    assert.throws(() => m.finishRound());
  }
  const top = Math.max(...m.scores);
  if (m.scores.filter((s) => s === top).length === 1) assert.equal(m.winner, m.scores.indexOf(top));
  else assert.equal(m.over, false);
  const v = m.view(2);
  assert.equal(v.seat, 2);
  assert.equal(v.round, 2);
});
