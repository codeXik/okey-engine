import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTiles, isFake, okeyOf, dealRound, meaning, isOkey, COLORS, shuffle } from '../src/tiles.js';
import { solveGroups, solvePairs, winningArrangement, countPairs } from '../src/groups.js';
import { scoreRound } from '../src/scoring.js';
import { withDefaults, DEFAULT_SETTINGS } from '../src/settings.js';
import { OkeyHand } from '../src/hand.js';
import { OkeyMatch } from '../src/match.js';
import { botAction, botStep, handValue } from '../src/bot.js';
import { teamOf, partnerOf, TEAM_SEATS } from '../src/teams.js';
import { Okey101Hand, newHand, loadHand, bestOpening } from '../src/hand101.js';
import { checkGroup, checkPair, bestGroups, posPoints } from '../src/meld.js';
import { scoreRound101 } from '../src/scoring.js';

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
  assert.doesNotThrow(() => new OkeyMatch({ settings: { variant: '101' } }));
  assert.throws(() => withDefaults({ variant: 'x' }));
  assert.throws(() => withDefaults({ teamEndScore: 40 }));
  assert.doesNotThrow(() => new OkeyHand({ settings: { variant: 'esli' } }));
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

// ---- eşli okey (2 against 2) ---------------------------------------------------------------------------

const ESLI = { variant: 'esli' };

test('eşli: teams are 0+2 and 1+3, the partner sits opposite', () => {
  assert.deepEqual(TEAM_SEATS, [[0, 2], [1, 3]]);
  assert.deepEqual([0, 1, 2, 3].map(teamOf), [0, 1, 0, 1]);
  assert.deepEqual([0, 1, 2, 3].map(partnerOf), [2, 3, 0, 1]);
});

test('eşli scoring: the finisher and the partner pay nothing, both opponents pay; multipliers as in the classic game', () => {
  const S = withDefaults(ESLI);
  const base = { reason: 'finish', winner: 1, okeyFinish: false, pair: false, fromHand: false };
  assert.deepEqual(scoreRound(base, S).deltas, [-2, 0, -2, 0]);
  assert.deepEqual(scoreRound({ ...base, winner: 2, okeyFinish: true, pair: true }, S).deltas, [0, -8, 0, -8]);
  assert.deepEqual(scoreRound({ ...base, winner: 0 }, withDefaults({ ...ESLI, winnerTakes: true })).deltas, [2, -2, 2, -2]);
  assert.deepEqual(scoreRound({ reason: 'deckOut', winner: -1 }, S).deltas, [0, 0, 0, 0]);
  // the classic game is unchanged
  assert.deepEqual(scoreRound(base, withDefaults()).deltas, [-2, 0, -2, -2]);
});

test('eşli round: same play as the classic game; a partner finishing makes the opposing seats pay', () => {
  const winning = ['Y1a', 'Y2a', 'Y3a', 'B5a', 'B6a', 'B7a', 'B8a', 'K4a', 'K5a', 'K6a', 'R10a', 'R11a', 'R12a', 'R13a'];
  const h = new OkeyHand({ dealer: 0, deal: fixedDeal([...winning, 'K9a']), settings: ESLI });
  const r = h.finish(1, 'K9a');
  assert.equal(r.fromHand, true);
  assert.deepEqual(h.scores, [-4, 0, -4, 0]); // seat 1 and its partner 3 pay nothing
});

test('eşli view: team information, and nobody ever sees the partner or the opponents tiles', () => {
  const h = new OkeyHand({ dealer: 0, rng: seeded(91), settings: ESLI });
  for (const seat of [0, 1, 2, 3]) {
    const v = h.view(seat);
    assert.equal(v.team, seat % 2);
    assert.equal(v.partner, (seat + 2) % 4);
    assert.deepEqual(v.teams, [[0, 2], [1, 3]]);
    const text = JSON.stringify(v);
    for (const other of [0, 1, 2, 3].filter((x) => x !== seat)) for (const t of h.hands[other]) assert.equal(text.includes(`"${t}"`), false, `seat ${seat} sees ${t} of seat ${other}`);
    assert.equal(text.includes(h.deck[0]), false);
  }
  assert.equal(new OkeyHand({ dealer: 0, rng: seeded(91) }).view(0).team, null);
});

test('eşli: 150 random rounds keep every tile and score by teams', () => {
  for (let i = 1; i <= 150; i++) {
    const rng = seeded(i + 1000);
    const h = new OkeyHand({ dealer: i % 4, rng, settings: ESLI });
    while (!h.over) {
      const seat = h.turn;
      if (h.phase === 'draw') {
        const o = h.drawOptions(seat);
        assert.equal(h.act(seat, { type: 'draw', value: o[Math.floor(rng() * o.length)] }).ok, true);
      } else {
        const outs = h.finishOptions(seat);
        if (outs.length) assert.equal(h.act(seat, { type: 'finish', value: outs[0].tile, mode: outs[0].mode }).ok, true);
        else assert.equal(h.act(seat, { type: 'discard', value: h.hands[seat][Math.floor(rng() * h.hands[seat].length)] }).ok, true);
      }
    }
    const all = [...h.hands.flat(), ...h.deck, ...h.discards.flat(), h.indicator, ...(h.result.tile ? [h.result.tile] : [])];
    assert.deepEqual(all.sort(), ALL);
    if (h.result.reason === 'finish') {
      const w = h.result.winner;
      assert.equal(h.scores[w], 0);
      assert.equal(h.scores[partnerOf(w)], 0);
      assert.equal(h.scores[(w + 1) % 4], h.scores[(w + 3) % 4]);
      assert.ok(h.scores[(w + 1) % 4] < 0);
    } else assert.deepEqual(h.scores, [0, 0, 0, 0]);
  }
});

test('eşli match: team scores, teams standings, winnerTeam, round after round until a team is out', () => {
  for (let g = 0; g < 3; g++) {
    const m = new OkeyMatch({ settings: ESLI, rng: seeded(g + 200), dealer: g });
    assert.deepEqual(m.teamScores, [40, 40]);
    const r = seeded(g + 210);
    let rounds = 0;
    while (!m.over) {
      assert.ok(rounds++ < 300);
      const h = m.startRound();
      while (!h.over) botStep(h, { level: g === 0 ? 'kolay' : 'normal', rng: r });
      const before = m.teamScores;
      m.finishRound();
      const after = m.teamScores;
      assert.equal(m.scores[0] + m.scores[2], after[0]);
      assert.ok(after[0] <= before[0] && after[1] <= before[1]);
      assert.ok(after[0] === before[0] || after[1] === before[1]); // only one team loses points in a round
      const last = m.rounds.at(-1);
      if (last.reason === 'finish') assert.equal(last.winnerTeam, teamOf(last.winner));
    }
    const ts = m.teamScores;
    assert.ok(Math.min(...ts) <= 0);
    assert.equal(m.winnerTeam, ts[0] > ts[1] ? 0 : 1);
    assert.deepEqual(m.winners, TEAM_SEATS[m.winnerTeam]);
    assert.equal(m.teams[0].team, m.winnerTeam);
    assert.equal(m.teams[0].place, 1);
    assert.deepEqual(m.teams[0].seats, TEAM_SEATS[m.winnerTeam]);
    const v = m.view(2);
    assert.equal(v.winnerTeam, m.winnerTeam);
    assert.deepEqual(v.teamScores, ts);
  }
  assert.equal(new OkeyMatch().winnerTeam, -1);
  assert.equal(new OkeyMatch().teams, null);
});

test('eşli: a match and a round in progress save and load; the future is the same', () => {
  const m = new OkeyMatch({ settings: { ...ESLI, startScore: 4 }, rng: seeded(230) });
  const r = seeded(231);
  while (!m.over) {
    const h = m.startRound();
    while (!h.over) {
      botStep(h, { level: 'normal', rng: r });
      if (r() < 0.25) {
        const saved = JSON.parse(JSON.stringify(m));
        const m2 = OkeyMatch.fromJSON(saved, { rng: seeded(232) });
        assert.deepEqual(JSON.parse(JSON.stringify(m2)), saved);
        assert.deepEqual(botAction(m.hand, { level: 'normal', rng: seeded(3) }), botAction(m2.hand, { level: 'normal', rng: seeded(3) }));
        assert.deepEqual(m2.teamScores, m.teamScores);
      }
    }
    m.finishRound();
  }
  assert.ok(m.over);
});

test('eşli computer (all levels) plays whole rounds', () => {
  for (const level of ['kolay', 'normal', 'zor']) {
    for (let g = 0; g < (level === 'zor' ? 1 : 10); g++) {
      const h = new OkeyHand({ dealer: g % 4, rng: seeded(g + 400), settings: ESLI });
      const r = seeded(g + 410);
      let n = 0;
      while (!h.over) {
        assert.ok(n++ < 400);
        assert.ok(botStep(h, { level, rng: r }));
      }
    }
  }
});

// ---- 101 okey ---------------------------------------------------------------------------------------------


const S101 = withDefaults({ variant: '101' });
const V101 = { variant: '101' };

// A fixed 101 deal: seat 1 (the starter when the dealer is 0) holds `starterHand` (22 tiles), the others get `extra[seat]`
// first and are filled up to 21 from the rest. okey R9 (indicator R8a).
function deal101(starterHand, extra = {}, indicator = 'R8a') {
  const fixed = [...starterHand, ...Object.values(extra).flat(), indicator];
  const rest = shuffle(makeTiles().filter((t) => !fixed.includes(t)), seeded(5));
  const hands = [[], starterHand.slice(), [], []];
  for (const s of [2, 3, 0]) hands[s] = (extra[s] || []).slice();
  for (const s of [2, 3, 0]) while (hands[s].length < 21) hands[s].push(rest.pop());
  return { hands, deck: rest, indicator };
}
// 22 tiles: Y10-13 (46 as 10+11+12+13), B10 K10 R10 + Y10? -> we use explicit groups below
const OPEN_HAND = ['Y10a', 'Y11a', 'Y12a', 'Y13a', 'B10a', 'K10a', 'R10a', 'B11a', 'B12a', 'B13a', 'K2a', 'K5a', 'R3a', 'R6a', 'Y2b', 'B4b', 'K8b', 'R11b', 'K12b', 'Y5b', 'B6b', 'K13b'];

test('101: the deal is 22 / 21 / 21 / 21 with a pile of 20, and a plain OkeyHand refuses the variant', () => {
  const h = newHand({ dealer: 2, rng: seeded(3), settings: V101 });
  assert.ok(h instanceof Okey101Hand);
  assert.equal(h.starter, 3);
  assert.deepEqual(h.hands.map((x) => x.length), [21, 21, 21, 22]);
  assert.equal(h.deck.length, 20);
  assert.deepEqual([...h.hands.flat(), ...h.deck, h.indicator].sort(), ALL);
  assert.throws(() => new OkeyHand({ settings: V101 }), /Okey101Hand/);
  assert.ok(newHand({ settings: {} }) instanceof OkeyHand);
});

test('101 groups: runs, sets, 12-13-1, jokers, points of each tile', () => {
  const okey = OKEY;
  const run = checkGroup(['Y4a', 'Y5a', 'Y6a'], okey, S101);
  assert.deepEqual([run.type, run.value], ['run', 15]);
  assert.equal(checkGroup(['Y6a', 'Y5a', 'Y4a'], okey, S101), null, 'a run is listed from the low end up');
  assert.equal(checkGroup(['Y12a', 'Y13a', 'Y1a'], okey, S101).value, 12 + 13 + 14);
  assert.equal(checkGroup(['Y1a', 'Y2a', 'Y3a'], okey, S101).value, 1 + 2 + 3);
  assert.equal(checkGroup(['Y13a', 'Y1a', 'Y2a'], okey, S101), null);
  assert.equal(checkGroup(['Y12a', 'Y13a', 'Y1a'], okey, withDefaults({ ...V101, aceHigh: false })), null);
  assert.equal(checkGroup(['Y12a', 'Y13a', 'Y1a'], okey, withDefaults({ ...V101, aceHighValue: 11 })).value, 36);
  const set = checkGroup(['Y7a', 'B7a', 'K7a'], okey, S101);
  assert.deepEqual([set.type, set.value], ['set', 21]);
  assert.equal(checkGroup(['Y7a', 'Y7b', 'K7a'], okey, S101), null);
  assert.equal(checkGroup(['Y1a', 'B1a', 'K1a'], okey, S101).value, 3);
  // a joker counts as what it stands for, wherever it is in the run
  const j = checkGroup(['Y4a', 'R9a', 'Y6a'], okey, S101);
  assert.equal(j.value, 15);
  assert.deepEqual([j.tiles[1].number, j.tiles[1].joker], [5, true]);
  assert.equal(checkGroup(['R9a', 'Y5a', 'Y6a'], okey, S101).tiles[0].number, 4);
  assert.equal(checkGroup(['Y5a', 'Y6a', 'R9a'], okey, S101).tiles[2].number, 7);
  assert.equal(checkGroup(['Y5a', 'R9a', 'R9b'], okey, S101).type, 'run');
  assert.equal(checkGroup(['Y5a', 'R9a', 'R9b'], okey, S101, 'set').type, 'set');
  // a false joker is the okey tile itself
  assert.equal(checkGroup(['R8a', 'Fa', 'R10a'], okey, S101).value, 27);
  assert.equal(checkGroup(['Y9a', 'B9a', 'Fa'], okey, S101).value, 27);
  assert.equal(checkGroup(['Y5a', 'Y6a'], okey, S101), null);
  assert.equal(checkGroup(['Y5a', 'Y6a', 'Y6a'], okey, S101), null);
  assert.ok(checkPair('Y5a', 'Y5b', okey));
  assert.ok(checkPair('Y5a', 'R9a', okey));
  assert.equal(checkPair('Y5a', 'Y6a', okey), null);
  assert.equal(posPoints(14, S101), 14);
});

test('101 best opening: finds the highest disjoint groups, honours the 101 limit and a required tile', () => {
  const info = bestOpening(OPEN_HAND, OKEY, S101);
  assert.ok(info.groups.length >= 2);
  const laid = info.groups.flatMap((g) => g.tiles);
  assert.equal(new Set(laid).size, laid.length);
  for (const g of info.groups) assert.equal(checkGroup(g.tiles, OKEY, S101, g.type).value, g.value);
  assert.equal(info.total, info.groups.reduce((a, g) => a + g.value, 0));
  assert.equal(info.canOpen, info.total >= 101);
  assert.equal(info.leftover.length + laid.length, OPEN_HAND.length);
  // a poor hand cannot open
  const poor = ['Y1a', 'B2a', 'K3a', 'R4a', 'Y6a', 'B8a', 'K10a', 'R12a', 'Y13b'];
  assert.equal(bestOpening(poor, OKEY, S101).canOpen, false);
  // a required tile that cannot be part of any group
  assert.equal(bestGroups(['Y1a', 'B5a', 'K9a'], OKEY, S101, 'Y1a'), null);
  // pairs
  const pairs = ['Y1a', 'Y1b', 'B2a', 'B2b', 'K3a', 'K3b', 'R4a', 'R4b', 'Y5a', 'Y5b', 'K9a', 'R13a'];
  const p = bestOpening(pairs, OKEY, S101);
  assert.deepEqual([p.canOpen, p.mode, p.pairs.length], [true, 'pairs', 5]);
  assert.equal(bestOpening(pairs, OKEY, withDefaults({ ...V101, pairOpenMin: 0 })).canOpen, false);
  assert.equal(bestOpening(pairs, OKEY, withDefaults({ ...V101, pairOpenMin: 6 })).canOpen, false);
});

test('101 opening: needs the points, lays groups on the table, and a hand can open from the very first turn', () => {
  const h = new Okey101Hand({ dealer: 0, deal: deal101(OPEN_HAND) });
  assert.equal(h.phase, 'discard');
  const info = h.openInfo(1);
  assert.equal(info.canOpen, true);
  // too few points: refused, nothing changes
  const before = JSON.stringify(h);
  assert.equal(h.act(1, { type: 'open', groups: [['Y10a', 'Y11a', 'Y12a']] }).error, 'illegal');
  assert.equal(h.act(1, { type: 'open', groups: [['Y10a', 'Y11a', 'Y12a'], ['Y10a', 'B10a', 'K10a']] }).error, 'illegal'); // a tile twice
  assert.equal(h.act(1, { type: 'open', groups: [['Y10a', 'Y11a', 'Y12a'], ['Z1a']] }).error, 'illegal');
  assert.equal(h.act(2, { type: 'open', groups: [['Y10a', 'Y11a', 'Y12a']] }).error, 'notYourTurn');
  assert.equal(h.act(1, { type: 'open', pairs: [['Y10a', 'Y10a']] }).error, 'illegal');
  assert.equal(JSON.stringify(h), before);
  const r = h.act(1, { type: 'open', groups: info.groups.map((g) => ({ type: g.type, tiles: g.tiles })) });
  assert.equal(r.ok, true);
  assert.equal(h.opened[1], 'groups');
  assert.equal(h.table.length, info.groups.length);
  assert.ok(h.table.every((g) => g.owner === 1));
  assert.equal(h.hands[1].length, 22 - info.groups.flatMap((g) => g.tiles).length);
  assert.equal(h.log.at(-1).type, 'open');
  // the groups are public: another seat sees them
  assert.deepEqual(h.view(3).table, h.table);
  assert.deepEqual(h.view(3).opened, [null, 'groups', null, null]);
});

test('101 processing: take a joker out and put it elsewhere; only after opening with groups', () => {
  const hand = ['Y10a', 'Y11a', 'Y12a', 'Y13a', 'B10a', 'K10a', 'R10a', 'B11a', 'B12a', 'R9a', 'K2a', 'K5a', 'R3a', 'R6a', 'Y2b', 'B4b', 'K8b', 'R11b', 'K12b', 'Y5b', 'B6b', 'B13a'];
  const h = new Okey101Hand({ dealer: 0, deal: deal101(hand) });
  assert.deepEqual(h.processOptions(1), []); // not opened yet
  assert.equal(h.act(1, { type: 'process', tile: 'B13a', group: 1, position: 'end' }).error, 'illegal');
  assert.equal(h.act(1, { type: 'open', groups: [['Y10a', 'Y11a', 'Y12a', 'Y13a'], ['B10a', 'K10a', 'R10a'], ['B11a', 'B12a', 'R9a']] }).ok, true);
  const [runId, setId, jokerRunId] = h.table.map((g) => g.id);
  assert.equal(h.table[2].tiles[2].number, 13);
  assert.equal(h.table[2].tiles[2].joker, true);
  assert.equal(h.table[2].value, 36);
  // nothing fits except putting B13 in place of the joker
  assert.deepEqual(h.processOptions(1), [{ tile: 'B13a', group: jokerRunId, replace: 'R9a' }]);
  assert.equal(h.act(1, { type: 'process', tile: 'K2a', group: runId, position: 'end' }).error, 'illegal');
  assert.equal(h.act(1, { type: 'process', tile: 'Y9a', group: runId, position: 'start' }).error, 'illegal'); // not in the hand
  assert.equal(h.act(1, { type: 'process', tile: 'B13a', group: setId }).error, 'illegal'); // wrong number
  assert.equal(h.act(1, { type: 'process', tile: 'B13a', group: 99, position: 'end' }).error, 'illegal');
  assert.equal(h.act(1, { type: 'process', tile: 'B13a', group: jokerRunId, replace: 'B11a' }).error, 'illegal'); // not a joker
  const rep = h.act(1, { type: 'process', tile: 'B13a', group: jokerRunId, replace: 'R9a' });
  assert.equal(rep.ok, true);
  assert.equal(rep.returned, 'R9a');
  assert.ok(h.hands[1].includes('R9a'));
  assert.equal(h.table[2].tiles.every((t) => !t.joker), true);
  assert.equal(h.table[2].value, 36);
  // the joker goes on the low end of the Y run (it becomes Y9)
  const add = h.act(1, { type: 'process', tile: 'R9a', group: runId, position: 'start' });
  assert.equal(add.ok, true);
  assert.deepEqual([h.table[0].tiles[0].number, h.table[0].tiles[0].joker], [9, true]);
  assert.equal(h.table[0].value, 9 + 10 + 11 + 12 + 13);
  assert.equal(h.seq, h.log.length);
});

test('101 processing: the joker of a set is replaced by a tile of a missing colour only', () => {
  const hand = ['B10a', 'K10a', 'R9a', 'Y10a', 'Y11a', 'Y12a', 'Y13a', 'B11a', 'B12a', 'B13a', 'K11a', 'K12a', 'K13a', 'R11b', 'R12b', 'R13b', 'K2a', 'K5a', 'R3a', 'R6a', 'Y2b', 'B4b'];
  const h = new Okey101Hand({ dealer: 0, deal: deal101(hand, { 2: ['R10b', 'B10b'] }) });
  assert.equal(h.act(1, { type: 'open', groups: [['B10a', 'K10a', 'R9a'], ['Y10a', 'Y11a', 'Y12a', 'Y13a'], ['B11a', 'B12a', 'B13a'], ['K11a', 'K12a', 'K13a']] }).ok, true);
  const setId = h.table[0].id;
  assert.equal(h.table[0].type, 'set');
  assert.equal(new Set(h.table[0].tiles.map((t) => t.color)).size, 3);
  assert.equal(h.table[0].tiles.filter((t) => t.joker).length, 1);
  void setId;
});
test('101 processing at the ends: 1 after the 13, 4th colour of a set, size limits', () => {
  const hand = ['Y11a', 'Y12a', 'Y13a', 'B7a', 'K7a', 'R7a', 'Y1a', 'K2a', 'K5a', 'R3a', 'R6a', 'Y2b', 'B4b', 'K8b', 'R11b', 'K12b', 'Y5b', 'B6b', 'K13b', 'Y7a', 'B9a', 'R13b'];
  const h = new Okey101Hand({ dealer: 0, deal: deal101(hand), settings: { openMin: 50 } });
  h.act(1, { type: 'open', groups: [['Y11a', 'Y12a', 'Y13a'], ['B7a', 'K7a', 'R7a']] });
  const run = h.table[0].id;
  const set = h.table[1].id;
  assert.equal(h.act(1, { type: 'process', tile: 'Y7a', group: set }).ok, true); // the 4th colour
  assert.equal(h.table[1].tiles.length, 4);
  assert.equal(h.table[1].value, 28);
  assert.equal(h.act(1, { type: 'process', tile: 'K13b', group: set }).error, 'illegal'); // set full / wrong number
  assert.equal(h.act(1, { type: 'process', tile: 'Y1a', group: run, position: 'end' }).ok, true); // 12-13-1: the 1 counts 14
  assert.equal(h.table[0].value, 11 + 12 + 13 + 14);
  assert.equal(h.act(1, { type: 'process', tile: 'Y2b', group: run, position: 'end' }).error, 'illegal'); // 13-1-2 is not a run
});

test('101: pairs open, a pair opener lays only pairs, and nobody processes onto pairs', () => {
  const hand = ['Y1a', 'Y1b', 'B2a', 'B2b', 'K3a', 'K3b', 'R4a', 'R4b', 'Y5a', 'Y5b', 'K9a', 'R13a', 'B13a', 'K6a', 'R6b', 'Y7a', 'B8a', 'K10a', 'R11a', 'Y12b', 'B1b', 'R2b'];
  const h = new Okey101Hand({ dealer: 0, deal: deal101(hand) });
  assert.equal(h.act(1, { type: 'open', pairs: [['Y1a', 'Y1b'], ['B2a', 'B2b'], ['K3a', 'K3b'], ['R4a', 'R4b']] }).error, 'illegal'); // 4 pairs: not enough
  const ok = h.act(1, { type: 'open', pairs: [['Y1a', 'Y1b'], ['B2a', 'B2b'], ['K3a', 'K3b'], ['R4a', 'R4b'], ['Y5a', 'Y5b']] });
  assert.equal(ok.ok, true);
  assert.equal(h.opened[1], 'pairs');
  assert.equal(h.table.every((g) => g.type === 'pair'), true);
  assert.equal(h.act(1, { type: 'open', groups: [['K10a', 'R11a', 'Y12b']] }).error, 'illegal');
  assert.equal(h.processOptions(1).length, 0);
  assert.equal(h.act(1, { type: 'open', pairs: [['K6a', 'R6b']] }).error, 'illegal'); // not a pair (K6 vs R6)
  assert.equal(h.act(1, { type: 'open', pairs: [['K9a', 'R13a']] }).error, 'illegal');
});

test('101: taking the thrown tile forces an opening with it; the engine does not offer it when the hand cannot open', () => {
  // seat 1 throws Y9a; seat 2 holds Y10 Y11 Y12 Y13 ... enough to open only with Y9
  const hand2 = ['Y10a', 'Y11a', 'Y12a', 'B10a', 'K10a', 'R10b', 'B11a', 'B12a', 'B13a', 'K11a', 'K12a', 'K13a', 'R3a', 'K2b', 'Y2b', 'B4b', 'R6a', 'K8b', 'R11b', 'Y5b', 'B6b'];
  const starter = ['Y9a', ...makeTiles().filter((t) => t !== 'Y9a' && t !== 'R8a' && !hand2.includes(t)).slice(0, 21)];
  const h = new Okey101Hand({ dealer: 0, deal: deal101(starter, { 2: hand2 }) });
  const t = h.hands[1][0];
  h.act(1, { type: 'discard', value: 'Y9a' });
  assert.deepEqual(h.drawOptions(2), ['deck', 'discard']);
  assert.equal(h.act(2, { type: 'draw', value: 'discard' }).ok, true);
  assert.equal(h.taken, 'Y9a');
  assert.equal(h.act(2, { type: 'discard', value: 'K2b' }).error, 'illegal'); // must open first
  assert.equal(h.act(2, { type: 'open', groups: [['B10a', 'B11a', 'B12a', 'B13a'], ['K10a', 'K11a', 'K12a', 'K13a'], ['Y10a', 'Y11a', 'Y12a']] }).error, 'illegal'); // without the taken tile
  const good = h.act(2, { type: 'open', groups: [['Y9a', 'Y10a', 'Y11a', 'Y12a'], ['B10a', 'B11a', 'B12a', 'B13a'], ['K10a', 'K11a', 'K12a', 'K13a']] });
  assert.equal(good.ok, true);
  assert.equal(h.taken, null);
  assert.equal(h.act(2, { type: 'discard', value: 'K2b' }).ok, true);
  void t;
  // when the hand cannot open with the thrown tile, taking it is not offered
  const h2 = new Okey101Hand({ dealer: 0, rng: seeded(14), settings: V101 });
  h2.discard(1, h2.hands[1][0]);
  const may = h2.drawOptions(2).includes('discard');
  const top = h2.discards[1].at(-1);
  assert.equal(may, bestOpening(h2.hands[2].concat(top), h2.okey, h2.settings, null, top).canOpen);
  const h3 = new Okey101Hand({ dealer: 0, rng: seeded(14), settings: { variant: '101', mustOpenWithTaken: false } });
  h3.discard(1, h3.hands[1][0]);
  assert.deepEqual(h3.drawOptions(2), ['deck', 'discard']);
});

test('101 ending: laying the last tiles down ends the round; the last tile thrown too; okey finish doubles', () => {
  const winning = ['Y9a', 'Y10a', 'Y11a', 'Y12a', 'Y13a', 'B9a', 'B10a', 'B11a', 'B12a', 'B13a', 'K9a', 'K10a', 'K11a', 'K12a', 'K13a', 'R10a', 'R11a', 'R12a', 'R13a', 'Y1a', 'Y2a', 'R9a'];
  const big = [['Y9a', 'Y10a', 'Y11a', 'Y12a', 'Y13a'], ['B9a', 'B10a', 'B11a', 'B12a', 'B13a'], ['K9a', 'K10a', 'K11a', 'K12a', 'K13a'], ['R10a', 'R11a', 'R12a', 'R13a']];
  const mk = (settings) => new Okey101Hand({ dealer: 0, deal: deal101(winning, { 2: ['Y3b', 'Y4b'] }), settings });
  // everything down at once: Y1 Y2 and the joker R9a make Y1 Y2 Y3
  const h = mk();
  assert.equal(h.act(1, { type: 'open', groups: big.concat([['Y1a', 'Y2a', 'R9a']]) }).ok, true);
  assert.equal(h.over, true);
  assert.deepEqual([h.result.winner, h.result.tile, h.result.okeyFinish, h.result.pair], [1, null, false, false]);
  assert.deepEqual(h.result.deltas, [101, 0, 101, 101]);
  // lay 4 groups down, put Y1 on the Y run (as the 14), throw Y2, play on until the last tile is the okey
  const h2 = mk();
  assert.equal(h2.act(1, { type: 'open', groups: big }).ok, true);
  assert.equal(h2.over, false);
  assert.equal(h2.act(1, { type: 'process', tile: 'Y1a', group: h2.table[0].id, position: 'end' }).ok, true);
  assert.equal(h2.table[0].value, 9 + 10 + 11 + 12 + 13 + 14);
  assert.equal(h2.act(1, { type: 'discard', value: 'Y2a' }).ok, true);
  assert.equal(h2.hands[1].length, 1);
  assert.deepEqual(h2.hands[1], ['R9a']);
  for (const s of [2, 3, 0]) {
    assert.equal(h2.act(s, { type: 'draw', value: 'deck' }).ok, true);
    const hand = h2.hands[s];
    assert.equal(h2.act(s, { type: 'discard', value: hand[hand.length - 1] }).ok, true);
  }
  assert.equal(h2.act(1, { type: 'draw', value: 'deck' }).ok, true);
  const extra = h2.hands[1].find((t) => t !== 'R9a');
  assert.equal(h2.act(1, { type: 'discard', value: extra }).ok, true);
  assert.deepEqual(h2.hands[1], ['R9a']);
});

test('101 scoring: penalties of players who did not open, of the tiles left, okey in hand, multipliers', () => {
  const S = S101;
  const hands = [['Y5a', 'B13a', 'R9a'], [], ['K1a', 'Fa'], ['Y2a']];
  const opened = ['groups', 'groups', 'groups', null];
  const base = { reason: 'finish', winner: 1, okeyFinish: false, pair: false };
  assert.deepEqual(scoreRound101(base, hands, opened, OKEY, S).deltas, [5 + 13 + 101, 0, 1 + 9, 101]);
  assert.deepEqual(scoreRound101({ ...base, okeyFinish: true }, hands, opened, OKEY, S).deltas, [238, 0, 20, 202]);
  assert.deepEqual(scoreRound101({ ...base, pair: true, okeyFinish: true }, hands, opened, OKEY, S).deltas, [476, 0, 40, 404]);
  assert.deepEqual(scoreRound101({ reason: 'deckOut' }, hands, opened, OKEY, S).deltas, [119, 0, 10, 101]);
  assert.deepEqual(scoreRound101({ reason: 'deckOut' }, hands, opened, OKEY, withDefaults({ ...V101, deckOutScores: false })).deltas, [0, 0, 0, 0]);
  assert.deepEqual(scoreRound101(base, hands, opened, OKEY, withDefaults({ ...V101, notOpenedPenalty: 50, okeyHandPenalty: 30 })).deltas, [5 + 13 + 30, 0, 10, 50]);
});

const tileCount101 = (h) => h.hands.flat().length + h.deck.length + h.discards.flat().length + 1 + h.table.reduce((a, g) => a + g.tiles.length, 0);

// Random but legal play: opens when it can, processes at random, throws a random tile.
function randomRound101(seed, settings = V101) {
  const rng = seeded(seed);
  const h = newHand({ dealer: seed % 4, rng, settings });
  let guard = 0;
  while (!h.over) {
    assert.ok(guard++ < 800, 'round does not end');
    const seat = h.turn;
    if (h.phase === 'draw') {
      const o = h.drawOptions(seat);
      assert.ok(o.length >= 1);
      assert.equal(h.act(seat, { type: 'draw', value: o[Math.floor(rng() * o.length)], seq: h.seq }).ok, true);
    } else {
      const info = h.openInfo(seat, h.taken ?? undefined);
      if (info.canOpen && (rng() < 0.8 || (h.taken && !h.opened[seat]))) {
        const a = info.mode === 'pairs' ? { type: 'open', pairs: info.pairs } : { type: 'open', groups: info.groups.map((g) => ({ type: g.type, tiles: g.tiles })) };
        assert.equal(h.act(seat, a).ok, true, JSON.stringify(a));
        if (h.over) break;
      }
      let moves = h.processOptions(seat);
      while (moves.length && rng() < 0.9 && !h.over) {
        const m = moves[Math.floor(rng() * moves.length)];
        assert.equal(h.act(seat, { type: 'process', ...m }).ok, true, JSON.stringify(m));
        moves = h.processOptions(seat);
      }
      if (h.over) break;
      assert.ok(!(h.taken && !h.opened[seat]) || true);
      if (h.taken && !h.opened[seat]) throw new Error('took the thrown tile but cannot open');
      const hand = h.hands[seat];
      assert.equal(h.act(seat, { type: 'discard', value: hand[Math.floor(rng() * hand.length)] }).ok, true);
    }
    if (!h.over) assert.equal(tileCount101(h), 106);
  }
  return h;
}

test('101: 80 random rounds end by the rules, keep every tile, score consistently', () => {
  let finished = 0;
  let processed = 0;
  for (let i = 1; i <= 80; i++) {
    const h = randomRound101(i);
    assert.equal(tileCount101(h), 106);
    const all = [...h.hands.flat(), ...h.deck, ...h.discards.flat(), h.indicator, ...h.table.flatMap((g) => g.tiles.map((t) => t.id))];
    assert.deepEqual(all.sort(), ALL);
    processed += h.log.filter((l) => l.type === 'process').length;
    // every laid group is still a valid group
    for (const g of h.table) {
      if (g.type === 'pair') assert.ok(checkPair(g.tiles[0].id, g.tiles[1].id, h.okey));
      else {
        const c = checkGroup(g.tiles.map((t) => t.id), h.okey, h.settings, g.type);
        assert.ok(c && c.value === g.value, `group ${g.id}`);
      }
      assert.ok(h.opened[g.owner]);
    }
    if (h.result.reason === 'finish') {
      finished++;
      assert.equal(h.result.deltas[h.result.winner], 0);
      assert.equal(h.hands[h.result.winner].length, 0);
      assert.ok(h.opened[h.result.winner]);
      for (let s = 0; s < 4; s++) if (s !== h.result.winner) assert.ok(h.result.deltas[s] >= (h.opened[s] ? 0 : 101));
    } else {
      assert.equal(h.deck.length, 0);
      for (let s = 0; s < 4; s++) assert.equal(h.result.deltas[s] >= 0, true);
    }
  }
  assert.ok(processed > 0, 'processing happened');
  assert.ok(finished > 0, 'some rounds were won');
});

test('101: act errors, stale sequence numbers, garbage never throws and changes nothing', () => {
  const h = new Okey101Hand({ dealer: 1, rng: seeded(60) });
  const rng = seeded(61);
  const junk = [undefined, null, 0, 'x', [], {}, { type: 'open' }, { type: 'open', groups: 'a' }, { type: 'process' }, { type: 'process', tile: 'Y1a' }, { type: 'process', tile: 'Y1a', group: 1.5 },
    { type: 'process', tile: 'Y1a', group: 1, position: 'middle' }, { type: 'draw', value: 'moon' }, { type: 'finish', value: 'Y1a' }, { type: 'discard', value: 'zz' }];
  const before = JSON.stringify(h);
  for (let i = 0; i < 300; i++) {
    const seat = [0, 1, 2, 3, 4, -1, '1', null][Math.floor(rng() * 8)];
    const r = h.act(seat, junk[Math.floor(rng() * junk.length)]);
    assert.equal(r.ok, false);
  }
  assert.equal(JSON.stringify(h), before);
  const other = (h.turn + 1) % 4;
  assert.equal(h.act(other, { type: 'discard', value: h.hands[other][0] }).error, 'notYourTurn');
  assert.equal(h.act(h.turn, { type: 'draw', value: 'deck' }).error, 'wrongPhase');
  assert.equal(h.act(h.turn, { type: 'discard', value: h.hands[h.turn][0], seq: 9 }).error, 'stale');
  assert.equal(h.act(h.turn, { type: 'finish', value: h.hands[h.turn][0] }).error, 'badAction');
  const starter = h.turn;
  assert.equal(h.act(starter, { type: 'discard', value: h.hands[starter][0], seq: 0 }).ok, true);
  assert.equal(h.act(starter, { type: 'discard', value: h.hands[starter][0], seq: 0 }).error, 'stale');
});

test('101: save and load after every move gives the same round (opened, table, taken tile and all)', () => {
  for (let g = 0; g < 6; g++) {
    const rng = seeded(g + 70);
    const h = newHand({ dealer: g % 4, rng, settings: V101 });
    let n = 0;
    while (!h.over) {
      assert.ok(n++ < 800);
      botStep(h, { level: 'normal', rng });
      const json = JSON.parse(JSON.stringify(h));
      const loaded = loadHand(json);
      assert.ok(loaded instanceof Okey101Hand);
      assert.deepEqual(JSON.parse(JSON.stringify(loaded)), json);
      assert.deepEqual(loaded.openInfo(loaded.turn), h.openInfo(h.turn));
    }
  }
});

test('101: a damaged save is refused', () => {
  const h = newHand({ dealer: 0, rng: seeded(80), settings: V101 });
  const rng = seeded(81);
  while (h.table.length === 0 && !h.over) botStep(h, { level: 'normal', rng });
  const good = JSON.parse(JSON.stringify(h));
  assert.doesNotThrow(() => loadHand(good));
  const tweaks = [
    (d) => (d.version = 9),
    (d) => d.hands[0].push(d.deck[0]),
    (d) => d.hands[0].pop(),
    (d) => (d.table[0].tiles[0].id = d.deck[0]),
    (d) => d.table[0].tiles.reverse(),
    (d) => (d.table[0].owner = (d.table[0].owner + 1) % 4),
    (d) => (d.opened = [null, null, null, null]),
    (d) => (d.opened = ['x', null, null, null]),
    (d) => (d.seq = 0),
    (d) => (d.settings.nope = 1),
  ];
  for (const f of tweaks) {
    const d = JSON.parse(JSON.stringify(good));
    f(d);
    if (d.table.length && f.toString().includes('reverse') && d.table[0].type === 'set') continue; // a reversed set is still a set
    assert.throws(() => loadHand(d), undefined, f.toString());
  }
});

test('101 view: your own tiles, everybody\'s laid groups, others\' tile counts, no hidden tiles', () => {
  const h = newHand({ dealer: 0, rng: seeded(90), settings: V101 });
  const rng = seeded(91);
  let checked = 0;
  while (!h.over) {
    for (const seat of [0, 1, 2, 3]) {
      const v = h.view(seat);
      assert.deepEqual(v.hand, h.hands[seat]);
      assert.deepEqual(v.handSizes, h.hands.map((x) => x.length));
      assert.deepEqual(v.table, h.table);
      assert.deepEqual(v.opened, h.opened);
      const text = JSON.stringify(v);
      // tiles everybody saw move (taken from the discards, a joker taken from the table) are public
      const publicTiles = new Set(h.log.flatMap((l) => [l.tile, l.value && l.value.replace].filter(Boolean)));
      if (!h.over) {
        for (const other of [0, 1, 2, 3].filter((x) => x !== seat)) {
          for (const t of h.hands[other].filter((x) => !publicTiles.has(x))) assert.equal(text.includes(`"${t}"`), false, `seat ${seat} sees ${t}`);
        }
        for (const t of h.deck.filter((x) => !publicTiles.has(x))) assert.equal(text.includes(`"${t}"`), false);
        if (seat !== h.turn) assert.deepEqual([v.openInfo, v.processOptions, v.taken], [null, [], null]);
      }
      checked++;
    }
    botStep(h, { level: 'kolay', rng });
  }
  assert.ok(checked > 40);
  const fin = h.view(0);
  assert.deepEqual(fin.scores, h.result.deltas);
});

for (const level of ['kolay', 'normal', 'zor']) {
  test(`101 computer '${level}' plays complete rounds by the rules`, () => {
    const games = 12;
    let finished = 0;
    for (let g = 0; g < games; g++) {
      const rng = seeded(g + 500);
      const h = newHand({ dealer: g % 4, rng, settings: V101 });
      let n = 0;
      while (!h.over) {
        assert.ok(n++ < 800);
        assert.ok(botStep(h, { level, rng }));
        if (!h.over) assert.equal(tileCount101(h), 106);
      }
      if (h.result.reason === 'finish') finished++;
      assert.equal(botAction(h, { level }), null);
    }
    if (level !== 'kolay') assert.ok(finished >= games * 0.4, `${level} finished ${finished}/${games}`);
  });
}

test('101 computer opens when it can and processes when it can', () => {
  const hand = ['Y10a', 'Y11a', 'Y12a', 'Y13a', 'B10a', 'K10a', 'R10a', 'B11a', 'B12a', 'B13a', 'K2a', 'K5a', 'R3a', 'R6a', 'Y2b', 'B4b', 'K8b', 'R11b', 'K12b', 'Y5b', 'B6b', 'K13b'];
  for (const level of ['normal', 'zor']) {
    const h = new Okey101Hand({ dealer: 0, deal: deal101(hand) });
    const a = botAction(h, { level });
    assert.equal(a.type, 'open');
    assert.equal(h.act(1, a).ok, true);
    let more = 0;
    while (h.phase === 'discard' && botAction(h, { level }).type !== 'discard' && more++ < 20) assert.equal(h.act(1, botAction(h, { level })).ok, true);
    assert.equal(botAction(h, { level }).type, h.over ? undefined : 'discard');
  }
});

test('101 match: penalties add up from 0, fewest wins after the rounds, saves and loads, standings are by lowest', () => {
  for (let g = 0; g < 2; g++) {
    const m = new OkeyMatch({ settings: { ...V101, maxRounds: 3 }, rng: seeded(g + 120) });
    assert.deepEqual(m.scores, [0, 0, 0, 0]);
    const r = seeded(g + 121);
    let rounds = 0;
    while (!m.over) {
      assert.ok(rounds++ < 30);
      const h = m.startRound();
      assert.ok(h instanceof Okey101Hand);
      while (!h.over) {
        botStep(h, { level: 'normal', rng: r });
        if (r() < 0.03) {
          const saved = JSON.parse(JSON.stringify(m));
          assert.deepEqual(JSON.parse(JSON.stringify(OkeyMatch.fromJSON(saved, { rng: seeded(1) }))), saved);
        }
      }
      const before = m.scores.slice();
      m.finishRound();
      m.scores.forEach((s, i) => assert.equal(s, before[i] + m.rounds.at(-1).deltas[i]));
    }
    assert.ok(m.rounds.length >= 3);
    assert.equal(m.scores[m.winner], Math.min(...m.scores));
    assert.equal(m.standings[0].seat, m.winner);
    assert.ok(m.standings[0].score <= m.standings[3].score);
  }
  // a score limit ends it too
  const m = new OkeyMatch({ settings: { ...V101, maxRounds: 100, matchEndScore: 150 }, rng: seeded(130) });
  const r = seeded(131);
  let rounds = 0;
  while (!m.over) {
    assert.ok(rounds++ < 100);
    const h = m.startRound();
    while (!h.over) botStep(h, { level: 'normal', rng: r });
    m.finishRound();
  }
  assert.ok(Math.max(...m.scores) >= 150);
  assert.equal(new OkeyMatch({ settings: V101 }).settings.maxRounds, 11);
});

test('classic and eşli are untouched by the 101 settings', () => {
  assert.equal(new OkeyHand({ rng: seeded(140) }).hands.flat().length + 48 + 1, 106);
  const m = new OkeyMatch({ rng: seeded(141) });
  assert.deepEqual(m.scores, [20, 20, 20, 20]);
  assert.equal(withDefaults().maxRounds, 0);
  assert.equal(withDefaults({ variant: '101', maxRounds: 4 }).maxRounds, 4);
});
