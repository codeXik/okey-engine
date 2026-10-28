import { COLORS, meaning, isFake } from './tiles.js';

// Finding a winning arrangement of 14 tiles. Two ways to go out:
//   'per'  - every tile sits in a run (same colour, consecutive numbers, 3+) or a set (same number, different colours, 3 or 4)
//   'cift' - seven pairs of identical tiles
// Wild okeys fit anywhere; false jokers are ordinary tiles with the okey's colour and number.

const idx = (c, n) => c * 13 + (n - 1);

function tally(tiles, okey) {
  const cnt = new Array(52).fill(0);
  const pools = new Map(); // idx -> tile ids
  const wilds = [];
  for (const t of tiles) {
    const m = meaning(t, okey);
    if (!m) {
      wilds.push(t);
      continue;
    }
    const i = idx(COLORS.indexOf(m.color), m.number);
    cnt[i]++;
    if (!pools.has(i)) pools.set(i, []);
    pools.get(i).push(t);
  }
  return { cnt, pools, wilds };
}

// Groups as plain items: { c, n } real tile, { wild: true }.
function search(cnt, wild, aceHigh) {
  const failed = new Set();
  const key = () => `${wild}|${cnt.join('')}`;
  const total = () => wild + cnt.reduce((a, b) => a + b, 0);

  function dfs() {
    let i = 0;
    while (i < 52 && cnt[i] === 0) i++;
    if (i === 52) return wild === 0 ? [] : null;
    if (total() < 3) return null;
    const k = key();
    if (failed.has(k)) return null;
    const c = Math.floor(i / 13);
    const n = (i % 13) + 1;

    // sets
    const others = [0, 1, 2, 3].filter((d) => d !== c && cnt[idx(d, n)] > 0);
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const picked = others.filter((_, b) => mask & (1 << b));
      const size = 1 + picked.length;
      for (let w = Math.max(0, 3 - size); w <= Math.min(wild, 4 - size); w++) {
        cnt[i]--;
        for (const d of picked) cnt[idx(d, n)]--;
        wild -= w;
        const rest = dfs();
        cnt[i]++;
        for (const d of picked) cnt[idx(d, n)]++;
        wild += w;
        if (rest) {
          const items = [{ c, n }, ...picked.map((d) => ({ c: d, n })), ...Array.from({ length: w }, () => ({ wild: true }))];
          return [{ type: 'set', items }, ...rest];
        }
      }
    }

    // runs: the anchor is the lowest remaining tile of its colour; position 14 is the 1 after the 13
    const anchors = n === 1 && aceHigh ? [1, 14] : [n];
    for (const ap of anchors) {
      for (let p = 1; p <= ap; p++) {
        for (let q = ap; q <= (aceHigh ? 14 : 13); q++) {
          const len = q - p + 1;
          if (len < 3 || len > 13) continue;
          // fill the positions: real tiles first, wilds where there is none
          const taken = [];
          const items = [];
          let w = 0;
          for (let pos = p; pos <= q; pos++) {
            const num = pos === 14 ? 1 : pos;
            if (pos === ap) {
              items.push({ c, n, pos });
              taken.push(i);
            } else if (cnt[idx(c, num)] - taken.filter((x) => x === idx(c, num)).length > 0) {
              items.push({ c, n: num, pos });
              taken.push(idx(c, num));
            } else {
              items.push({ wild: true, pos });
              w++;
            }
          }
          if (w > wild) continue;
          for (const x of taken) cnt[x]--;
          wild -= w;
          const rest = dfs();
          for (const x of taken) cnt[x]++;
          wild += w;
          if (rest) return [{ type: 'run', items }, ...rest];
        }
      }
    }
    failed.add(k);
    return null;
  }
  return dfs();
}

function materialize(plan, pools, wilds) {
  const take = new Map([...pools].map(([k, v]) => [k, v.slice()]));
  const spare = wilds.slice();
  return plan.map((g) => ({
    type: g.type,
    tiles: g.items.map((it) => {
      if (it.wild) return { id: spare.pop(), joker: true };
      const id = take.get(idx(it.c, it.n)).pop();
      return { id, color: COLORS[it.c], number: it.n, joker: false };
    }),
  }));
}

// Runs and sets for exactly these tiles, or null. Wild okeys also get the colour and number they stand for.
export function solveGroups(tiles, okey, settings = {}) {
  const { cnt, pools, wilds } = tally(tiles, okey);
  const plan = search(cnt, wilds.length, settings.aceHigh !== false);
  if (!plan) return null;
  const groups = materialize(plan, pools, wilds);
  // tell each wild tile what it stands for
  groups.forEach((g, gi) => {
    const items = plan[gi].items;
    if (g.type === 'set') {
      const num = items.find((it) => !it.wild).n;
      const used = new Set(items.filter((it) => !it.wild).map((it) => it.c));
      const free = [0, 1, 2, 3].filter((d) => !used.has(d));
      g.tiles.forEach((t) => {
        if (t.joker) {
          t.number = num;
          t.color = COLORS[free.shift()];
        }
      });
    } else {
      const c = items.find((it) => !it.wild).c;
      g.tiles.forEach((t, k) => {
        if (t.joker) {
          t.color = COLORS[c];
          t.number = items[k].pos === 14 ? 1 : items[k].pos;
        }
      });
    }
  });
  return groups;
}

// Seven pairs, or null. A wild okey completes any single tile; two wilds pair with each other.
export function solvePairs(tiles, okey) {
  if (tiles.length !== 14) return null;
  const { pools, wilds } = tally(tiles, okey);
  const pairs = [];
  const singles = [];
  for (let i = 0; i < 52; i++) {
    const ids = (pools.get(i) || []).slice();
    while (ids.length >= 2) pairs.push([ids.pop(), ids.pop()]);
    if (ids.length) singles.push(ids[0]);
  }
  const spare = wilds.slice();
  if (spare.length < singles.length) return null;
  for (const s of singles) pairs.push([s, spare.pop()]);
  while (spare.length >= 2) pairs.push([spare.pop(), spare.pop()]);
  return pairs.length === 7 && spare.length === 0 ? pairs : null;
}

// How good is this 14-tile hand at pairs: the number of pairs it can make (used by the computer).
export function countPairs(tiles, okey) {
  const { pools, wilds } = tally(tiles, okey);
  let pairs = 0;
  let singles = 0;
  for (const ids of pools.values()) {
    pairs += Math.floor(ids.length / 2);
    singles += ids.length % 2;
  }
  return pairs + Math.min(singles, wilds.length) + Math.floor(Math.max(0, wilds.length - singles) / 2);
}

// Can these 14 tiles go out? { mode, groups | pairs } or null. `modes` limits what is tried, in order.
export function winningArrangement(tiles, okey, settings = {}, modes = ['per', 'cift']) {
  if (tiles.length !== 14) return null;
  for (const mode of modes) {
    if (mode === 'per') {
      const groups = solveGroups(tiles, okey, settings);
      if (groups) return { mode, groups };
    } else if (mode === 'cift' && settings.allowPairs !== false) {
      const pairs = solvePairs(tiles, okey);
      if (pairs) return { mode, pairs };
    }
  }
  return null;
}

export { isFake };
