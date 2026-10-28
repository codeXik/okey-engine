import { COLORS, meaning } from './tiles.js';

// 101 okey: laying groups down. A group is a run or a set of tiles with its points.
//   run  : same colour, consecutive positions 1..13, plus position 14 = the 1 after the 13 (12-13-1) when aceHigh is on;
//          3 to 13 tiles; tiles are listed from the low end to the high end.
//   set  : same number, different colours, 3 or 4 tiles.
// Wild okeys stand for what is missing; a false joker is the okey tile itself.

const idx = (c, n) => c * 13 + (n - 1);

// Points of a tile standing at run position `pos` (1..14) or in a set / the hand as number `n`.
export const posPoints = (pos, s) => (pos === 14 ? s.aceHighValue : pos === 1 ? s.aceValue : pos);
export const numberPoints = (n, s) => (n === 1 ? s.aceValue : n);

// Checks the tiles `ids` (a run listed from the low end up, or a set in any order) as one group. `hint` ('run' or
// 'set') settles a group that could be either (one real tile and wilds). Returns
// { type, tiles: [{ id, color, number, pos?, joker }], value } or null.
export function checkGroup(ids, okey, settings, hint) {
  if (!Array.isArray(ids) || ids.length < 3 || ids.length > 13 || new Set(ids).size !== ids.length) return null;
  const items = ids.map((id) => ({ id, m: meaning(id, okey) }));
  const reals = items.filter((it) => it.m);
  if (!reals.length) return null;
  if (hint !== 'run' && ids.length <= 4 && reals.every((it) => it.m.number === reals[0].m.number) && new Set(reals.map((it) => it.m.color)).size === reals.length && !(hint === undefined && reals.length === 1)) {
    const number = reals[0].m.number;
    const free = COLORS.filter((c) => !reals.some((it) => it.m.color === c));
    const tiles = items.map((it) => (it.m ? { id: it.id, color: it.m.color, number, joker: false } : { id: it.id, color: free.shift(), number, joker: true }));
    return { type: 'set', tiles, value: numberPoints(number, settings) * ids.length };
  }
  if (hint === 'set') return null;
  if (!reals.every((it) => it.m.color === reals[0].m.color)) return null;
  const top = settings.aceHigh !== false ? 14 : 13;
  const k = items.findIndex((it) => it.m);
  const starts = items[k].m.number === 1 ? [1, 14] : [items[k].m.number];
  for (const first of starts) {
    const start = first - k;
    if (start < 1 || start + ids.length - 1 > top) continue;
    let ok = true;
    const tiles = items.map((it, i) => {
      const pos = start + i;
      const number = pos === 14 ? 1 : pos;
      if (it.m && it.m.number !== number) ok = false;
      return { id: it.id, color: reals[0].m.color, number, pos, joker: !it.m };
    });
    if (ok) return { type: 'run', tiles, value: tiles.reduce((a, t) => a + posPoints(t.pos, settings), 0) };
  }
  return null;
}

// Two identical tiles (colour and number); a wild okey pairs with anything.
export function checkPair(a, b, okey) {
  if (a === b) return null;
  const ma = meaning(a, okey);
  const mb = meaning(b, okey);
  if (ma && mb && (ma.color !== mb.color || ma.number !== mb.number)) return null;
  const m = ma || mb;
  return { type: 'pair', tiles: [a, b].map((id, i) => ({ id, color: m ? m.color : null, number: m ? m.number : null, joker: !(i ? mb : ma) })), value: 0 };
}

// The best way to lay down groups from a hand: the disjoint runs and sets of the highest total points.
// `must` (a tile id) limits the search to layouts that use a tile like it (the tile just taken from the discards).
// Returns { total, groups: [{ type, tiles: [ids], value }], leftover: [ids] } or null when `must` cannot be used.
export function bestGroups(tiles, okey, settings, must) {
  const cnt = new Array(52).fill(0);
  const pools = new Map();
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
  let mustIdx = null;
  if (must !== undefined) {
    const m = meaning(must, okey);
    mustIdx = m ? idx(COLORS.indexOf(m.color), m.number) : -1;
  }
  const aceHigh = settings.aceHigh !== false;
  const memo = new Map();
  let wild = wilds.length;

  // best(flag) -> { v, plan } | null; flag = the required tile is already used
  function best(flag) {
    let i = 0;
    while (i < 52 && cnt[i] === 0) i++;
    if (i === 52) return flag || mustIdx === null ? { v: 0, plan: [] } : null;
    const key = `${wild}|${flag ? 1 : 0}|${cnt.join('')}`;
    if (memo.has(key)) return memo.get(key);
    const c = Math.floor(i / 13);
    const n = (i % 13) + 1;
    let top = null;
    const offer = (v, plan, group) => {
      if (top === null || v > top.v) top = { v, plan: [group, ...plan] };
    };
    // leave the tile in the hand
    cnt[i]--;
    const skip = best(flag);
    cnt[i]++;
    if (skip) top = { v: skip.v, plan: skip.plan };

    // sets
    const others = [0, 1, 2, 3].filter((d) => d !== c && cnt[idx(d, n)] > 0);
    for (let mask = 0; mask < 1 << others.length; mask++) {
      const picked = others.filter((_, b) => mask & (1 << b));
      const size = 1 + picked.length;
      for (let w = Math.max(0, 3 - size); w <= Math.min(wild, 4 - size); w++) {
        cnt[i]--;
        for (const d of picked) cnt[idx(d, n)]--;
        wild -= w;
        const usesMust = mustIdx !== null && (i === mustIdx || picked.some((d) => idx(d, n) === mustIdx) || (mustIdx === -1 && w > 0));
        const rest = best(flag || usesMust);
        cnt[i]++;
        for (const d of picked) cnt[idx(d, n)]++;
        wild += w;
        if (rest) offer(rest.v + numberPoints(n, settings) * (size + w), rest.plan, { type: 'set', items: [{ c, n }, ...picked.map((d) => ({ c: d, n })), ...Array.from({ length: w }, () => ({ wild: true }))] });
      }
    }

    // runs
    const anchors = n === 1 && aceHigh ? [1, 14] : [n];
    for (const ap of anchors) {
      for (let p = 1; p <= ap; p++) {
        for (let q = ap; q <= (aceHigh ? 14 : 13); q++) {
          const len = q - p + 1;
          if (len < 3 || len > 13) continue;
          const taken = [];
          const items = [];
          let w = 0;
          let usesMust = false;
          let value = 0;
          for (let pos = p; pos <= q; pos++) {
            const num = pos === 14 ? 1 : pos;
            const here = idx(c, num);
            value += posPoints(pos, settings);
            if (pos === ap) {
              items.push({ c, n, pos });
              taken.push(i);
              if (i === mustIdx) usesMust = true;
            } else if (cnt[here] - taken.filter((x) => x === here).length > 0) {
              items.push({ c, n: num, pos });
              taken.push(here);
              if (here === mustIdx) usesMust = true;
            } else {
              items.push({ wild: true, pos });
              w++;
              if (mustIdx === -1) usesMust = true;
            }
          }
          if (w > wild) continue;
          for (const x of taken) cnt[x]--;
          wild -= w;
          const rest = best(flag || usesMust);
          for (const x of taken) cnt[x]++;
          wild += w;
          if (rest) offer(rest.v + value, rest.plan, { type: 'run', items });
        }
      }
    }
    memo.set(key, top);
    return top;
  }

  const found = best(false);
  if (!found) return null;
  // turn the plan into tile ids
  const take = new Map([...pools].map(([k, v]) => [k, v.slice()]));
  const spare = wilds.slice();
  const used = new Set();
  const groups = found.plan.map((g) => {
    const list = g.items.map((it) => {
      const id = it.wild ? spare.pop() : take.get(idx(it.c, it.n)).pop();
      used.add(id);
      return { id, it };
    });
    if (g.type === 'run') list.sort((a, b) => a.it.pos - b.it.pos);
    const ids = list.map((x) => x.id);
    const checked = checkGroup(ids, okey, settings, g.type);
    return { type: g.type, tiles: ids, value: checked ? checked.value : 0 };
  });
  return { total: found.v, groups, leftover: tiles.filter((t) => !used.has(t)) };
}

// Pairs for opening with pairs: as many disjoint pairs of identical tiles as the hand holds (wild okeys join any tile).
// With `must`, only layouts that use a tile like it. Returns [[a, b], ...].
export function bestPairs(tiles, okey, must) {
  const pools = new Map();
  const wilds = [];
  for (const t of tiles) {
    const m = meaning(t, okey);
    if (!m) wilds.push(t);
    else {
      const k = `${m.color}${m.number}`;
      if (!pools.has(k)) pools.set(k, []);
      pools.get(k).push(t);
    }
  }
  const pairs = [];
  const singles = [];
  for (const ids of pools.values()) {
    const list = ids.slice();
    while (list.length >= 2) pairs.push([list.pop(), list.pop()]);
    if (list.length) singles.push(list[0]);
  }
  const spare = wilds.slice();
  // singles that could be the tile just taken come first
  if (must !== undefined) singles.sort((a, b) => (a === must ? -1 : b === must ? 1 : 0));
  for (const s of singles) if (spare.length) pairs.push([s, spare.pop()]);
  while (spare.length >= 2) pairs.push([spare.pop(), spare.pop()]);
  if (must !== undefined) {
    const mm = meaning(must, okey);
    const usable = pairs.some((p) => p.some((t) => t === must || (mm ? (meaning(t, okey) || {}).color === mm.color && (meaning(t, okey) || {}).number === mm.number : !meaning(t, okey))));
    if (!usable) return [];
  }
  return pairs;
}
