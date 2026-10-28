import { OkeyHand } from './hand.js';
import { isOkey, isTile, makeTiles, meaning, okeyOf } from './tiles.js';
import { bestGroups, bestPairs, checkGroup, checkPair, numberPoints, posPoints } from './meld.js';
import { scoreRound101 } from './scoring.js';
import { withDefaults } from './settings.js';

const SAVE_VERSION = 1;
const copy = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sameIdentity = (a, b, okey) => {
  const x = meaning(a, okey);
  const y = meaning(b, okey);
  return x && y ? x.color === y.color && x.number === y.number : !x && !y;
};

// One round of 101 okey (4 players, each for themselves). The deal is 22 tiles for the starter and 21 for the others,
// a pile of 20. A turn: draw from the pile or take the previous seat's thrown tile, then (phase 'discard') any of
//   open     lay down groups worth `openMin` points together (or `pairOpenMin` pairs); once opened more groups may follow
//   process  add a tile to a group on the table (an end of a run, the 4th of a set), or put the tile a joker stands for
//            in its place and take the joker
//   discard  throw a tile, which ends the turn
// A player who empties the hand (the last tile thrown, or everything laid down) ends the round. Only a player who
// opened with groups may process; a player who opened with pairs may only lay more pairs.
export class Okey101Hand extends OkeyHand {
  constructor(opts = {}) {
    super({ ...opts, settings: { ...opts.settings, variant: '101' } });
    this.opened = [null, null, null, null]; // per seat: null | 'groups' | 'pairs' (public)
    this.table = []; // laid groups: { id, owner, type: 'run' | 'set' | 'pair', tiles: [{ id, color, number, pos?, joker }], value } (public)
    this.nextGroup = 1;
    this.taken = null; // the tile just taken from the discards by a seat that has not opened (it must open this turn)
  }

  toJSON() {
    return { ...super.toJSON(), opened: this.opened.slice(), table: copy(this.table), nextGroup: this.nextGroup, taken: this.taken };
  }

  static fromJSON(data) {
    const bad = () => new Error('Save is inconsistent');
    if (!data || data.version !== SAVE_VERSION || !data.settings || data.settings.variant !== '101') throw new Error('Unknown save format');
    const seatOk = (s) => Number.isInteger(s) && s >= 0 && s <= 3;
    if (!seatOk(data.dealer) || !seatOk(data.turn) || !['draw', 'discard', 'done'].includes(data.phase)) throw bad();
    if (![data.hands, data.discards].every((x) => Array.isArray(x) && x.length === 4 && x.every(Array.isArray))) throw bad();
    if (!Array.isArray(data.deck) || !Array.isArray(data.log) || !Array.isArray(data.table) || !Array.isArray(data.opened) || data.opened.length !== 4) throw bad();
    if (!Number.isInteger(data.seq) || data.seq < 0 || data.log.length !== data.seq) throw bad();
    if (!data.opened.every((o) => o === null || o === 'groups' || o === 'pairs')) throw bad();
    const settings = withDefaults(data.settings);
    const okey = okeyOf(data.indicator);
    const tableTiles = data.table.flatMap((g) => (g && Array.isArray(g.tiles) ? g.tiles.map((t) => t.id) : [null]));
    const all = [...data.hands.flat(), ...data.deck, ...data.discards.flat(), data.indicator, ...tableTiles]; // the last tile thrown is among the discards
    const known = new Set(makeTiles());
    const seen = new Set();
    for (const t of all) {
      if (!isTile(t) || !known.has(t) || seen.has(t)) throw bad();
      seen.add(t);
    }
    if (all.length !== 106) throw bad();
    if ((data.phase === 'done') !== !!data.result) throw bad();
    // every laid group must be a valid group, owned by a seat that opened the right way
    for (const g of data.table) {
      if (!seatOk(g.owner) || !data.opened[g.owner]) throw bad();
      const ids = g.tiles.map((t) => t.id);
      const ok = g.type === 'pair' ? ids.length === 2 && checkPair(ids[0], ids[1], okey) : checkGroup(ids, okey, settings, g.type) && checkGroup(ids, okey, settings, g.type).type === g.type;
      if (!ok || (g.type === 'pair') !== (data.opened[g.owner] === 'pairs')) throw bad();
    }
    const h = new Okey101Hand({ dealer: data.dealer, settings: data.settings });
    Object.assign(h, {
      hands: data.hands.map((x) => x.slice()), deck: data.deck.slice(), indicator: data.indicator, okey,
      discards: data.discards.map((d) => d.slice()), phase: data.phase, turn: data.turn, log: copy(data.log),
      result: copy(data.result), seq: data.seq, lastAction: copy(data.lastAction) ?? null,
      opened: data.opened.slice(), table: copy(data.table), nextGroup: data.nextGroup ?? data.table.length + 1, taken: data.taken ?? null,
    });
    return h;
  }

  // ---- what a player may do ------------------------------------------------------------------------

  // The best opening for the hand of `seat`: { canOpen, mode, total, groups: [{ type, tiles, value }], pairs, leftover }.
  // `groups` are the disjoint runs and sets of the highest points (feed them to `open` as they are); `canOpen` is true
  // when they reach `openMin` or the hand holds `pairOpenMin` pairs. For a seat that has already opened, `groups` is
  // everything that can still be laid down. Pass `must` to require a tile like it (the tile just taken).
  openInfo(seat = this.turn, must) {
    return bestOpening(this.hands[seat], this.okey, this.settings, this.opened[seat], must);
  }

  // The tile a seat could take from the discards is always allowed for a seat that has opened (or when taking does not
  // force an opening); otherwise only if the hand can open with it.
  _mayTake(seat) {
    const top = this.discards[this.previous(seat)].at(-1);
    if (top === undefined) return false;
    if (this.opened[seat] || !this.settings.mustOpenWithTaken) return true;
    return bestOpening(this.hands[seat].concat(top), this.okey, this.settings, null, top).canOpen;
  }

  drawOptions(seat = this.turn) {
    const options = super.drawOptions(seat);
    return options.includes('discard') && !this._mayTake(seat) ? options.filter((o) => o !== 'discard') : options;
  }

  finishOptions() {
    return []; // a round ends when somebody empties the hand
  }

  finish() {
    throw new Error('101 okey has no separate finish: throw the last tile');
  }

  draw(seat, source) {
    const r = super.draw(seat, source);
    this.taken = source === 'discard' && !this.opened[seat] && this.settings.mustOpenWithTaken ? r.tile : null;
    return r;
  }

  // Every way `seat` could process a tile now: [{ tile, group, position?: 'start' | 'end', replace?: jokerTileId }].
  processOptions(seat = this.turn) {
    if (this.over || seat !== this.turn || this.phase !== 'discard' || this.opened[seat] !== 'groups') return [];
    const out = [];
    for (const tile of this.hands[seat]) {
      for (const g of this.table) {
        if (g.type === 'pair') continue;
        const tries = g.type === 'run' ? [{ position: 'start' }, { position: 'end' }] : [{}];
        for (const j of g.tiles.filter((t) => t.joker)) tries.push({ replace: j.id });
        for (const t of tries) if (this._processPlan(seat, { tile, group: g.id, ...t })) out.push({ tile, group: g.id, ...t });
      }
    }
    return out;
  }

  view(seat) {
    const mine = this.turn === seat && !this.over && this.phase === 'discard';
    return {
      ...super.view(seat), opened: this.opened.slice(), table: copy(this.table), taken: seat === this.turn ? this.taken : null,
      openInfo: mine ? this.openInfo(seat, this.taken ?? undefined) : null, processOptions: mine ? this.processOptions(seat) : [],
    };
  }

  // ---- actions ---------------------------------------------------------------------------------------

  _end(seat, tile) {
    const okeyFinish = tile !== null && isOkey(tile, this.okey);
    const pair = this.opened[seat] === 'pairs';
    const base = { reason: 'finish', winner: seat, tile, okeyFinish, pair, fromHand: false };
    this.phase = 'done';
    this.result = { ...base, hands: this.hands.map((h) => h.slice()), ...scoreRound101(base, this.hands, this.opened, this.okey, this.settings) };
  }

  // Lays down groups (`groups`: arrays of tile ids, runs from the low end up, or { type, tiles }) or pairs (`pairs`:
  // [[a, b], ...]). The first opening needs the points or the pairs; later ones any valid groups.
  open(seat, { groups, pairs } = {}) {
    this._check(seat, 'discard');
    const hand = this.hands[seat];
    const used = new Set();
    const mine = (id) => hand.includes(id) && !used.has(id) && used.add(id);
    const laid = [];
    if (pairs && pairs.length) {
      if (groups && groups.length) throw new Error('Groups or pairs, not both');
      if (this.opened[seat] === 'groups') throw new Error('Opened with groups: no pairs');
      if (!this.opened[seat] && (this.settings.pairOpenMin === 0 || pairs.length < this.settings.pairOpenMin)) throw new Error('Not enough pairs');
      for (const p of pairs) {
        if (!Array.isArray(p) || p.length !== 2 || !mine(p[0]) || !mine(p[1])) throw new Error('Bad pair');
        const g = checkPair(p[0], p[1], this.okey);
        if (!g) throw new Error('Not a pair');
        laid.push(g);
      }
    } else {
      if (!groups || !groups.length) throw new Error('Nothing to lay down');
      if (this.opened[seat] === 'pairs') throw new Error('Opened with pairs: only pairs');
      for (const entry of groups) {
        const ids = Array.isArray(entry) ? entry : entry && entry.tiles;
        const hint = Array.isArray(entry) ? undefined : entry.type;
        if (!Array.isArray(ids) || !ids.every(mine)) throw new Error('Bad group');
        const g = checkGroup(ids, this.okey, this.settings, hint);
        if (!g) throw new Error('Not a group');
        laid.push(g);
      }
      if (!this.opened[seat] && laid.reduce((a, g) => a + g.value, 0) < this.settings.openMin) throw new Error('Not enough points to open');
    }
    if (this.taken && !this.opened[seat] && !laid.some((g) => g.tiles.some((t) => sameIdentity(t.id, this.taken, this.okey)))) {
      throw new Error('The tile just taken must be part of the opening');
    }
    const mode = pairs && pairs.length ? 'pairs' : 'groups';
    this.opened[seat] = mode;
    this.taken = null;
    for (const id of used) hand.splice(hand.indexOf(id), 1);
    const ids = [];
    for (const g of laid) {
      ids.push(this.nextGroup);
      this.table.push({ id: this.nextGroup++, owner: seat, type: g.type, tiles: g.tiles, value: g.value });
    }
    this._done(seat, 'open', laid.map((g) => g.tiles.map((t) => t.id)));
    if (!hand.length) this._end(seat, null);
    return { groups: ids };
  }

  // The new state of a group if `move` were played, or null: { tiles, value, returned? }.
  _processPlan(seat, { tile, group, position, replace }) {
    if (this.opened[seat] !== 'groups' || !this.hands[seat].includes(tile)) return null;
    const g = this.table.find((x) => x.id === group);
    if (!g || g.type === 'pair') return null;
    const s = this.settings;
    const m = meaning(tile, this.okey);
    const top = s.aceHigh !== false ? 14 : 13;
    const value = (tiles) => (g.type === 'run' ? tiles.reduce((a, t) => a + posPoints(t.pos, s), 0) : numberPoints(g.tiles[0].number, s) * tiles.length);
    if (replace !== undefined) {
      const at = g.tiles.findIndex((t) => t.id === replace && t.joker);
      if (at < 0 || !m) return null;
      const j = g.tiles[at];
      if (g.type === 'run' ? m.color !== j.color || m.number !== j.number : m.number !== j.number || g.tiles.some((t, i) => i !== at && !t.joker && t.color === m.color)) return null;
      const tiles = g.tiles.map((t, i) => (i === at ? { id: tile, color: m.color, number: m.number, ...(t.pos ? { pos: t.pos } : {}), joker: false } : { ...t }));
      return { tiles: relabel(g.type, tiles), value: value(tiles), returned: replace };
    }
    if (g.tiles.length >= (g.type === 'run' ? 13 : 4)) return null;
    if (g.type === 'run') {
      if (position !== 'start' && position !== 'end') return null;
      const pos = position === 'start' ? g.tiles[0].pos - 1 : g.tiles.at(-1).pos + 1;
      const number = pos === 14 ? 1 : pos;
      if (pos < 1 || pos > top || (m && (m.color !== g.tiles[0].color || m.number !== number))) return null;
      const t = { id: tile, color: g.tiles[0].color, number, pos, joker: !m };
      const tiles = position === 'start' ? [t, ...g.tiles.map((x) => ({ ...x }))] : [...g.tiles.map((x) => ({ ...x })), t];
      return { tiles, value: value(tiles) };
    }
    if (m && (m.number !== g.tiles[0].number || g.tiles.some((t) => !t.joker && t.color === m.color))) return null;
    const tiles = relabel('set', [...g.tiles.map((x) => ({ ...x })), { id: tile, color: m ? m.color : null, number: g.tiles[0].number, joker: !m }]);
    return { tiles, value: value(tiles) };
  }

  // Adds `tile` to group `group` on the table ('start' or 'end' of a run), or with `replace` (the id of a joker in that
  // group) puts the tile the joker stands for in its place and takes the joker into the hand.
  process(seat, move) {
    this._check(seat, 'discard');
    if (this.opened[seat] !== 'groups') throw new Error('Only a player who opened with groups may process');
    const plan = this._processPlan(seat, move);
    if (!plan) throw new Error('Cannot process like that');
    const g = this.table.find((x) => x.id === move.group);
    const hand = this.hands[seat];
    hand.splice(hand.indexOf(move.tile), 1);
    if (plan.returned) hand.push(plan.returned);
    g.tiles = plan.tiles;
    g.value = plan.value;
    this._done(seat, 'process', { tile: move.tile, group: move.group, ...(move.position ? { position: move.position } : {}), ...(move.replace ? { replace: move.replace } : {}) });
    if (!hand.length) this._end(seat, null);
    return { returned: plan.returned ?? null };
  }

  discard(seat, tile) {
    this._check(seat, 'discard');
    if (this.taken && !this.opened[seat]) throw new Error('Open first: you took the thrown tile');
    const hand = this.hands[seat];
    if (hand.length === 1 && hand[0] === tile && this.opened[seat]) {
      hand.pop();
      this.discards[seat].push(tile);
      this._done(seat, 'discard', tile, tile);
      this._end(seat, tile);
      return;
    }
    this.taken = null;
    super.discard(seat, tile);
    if (this.over && this.result.reason === 'deckOut') {
      this.result = { reason: 'deckOut', winner: -1, hands: this.hands.map((h) => h.slice()), ...scoreRound101({ reason: 'deckOut' }, this.hands, this.opened, this.okey, this.settings) };
    }
  }

  // { type: 'draw', value: 'deck' | 'discard' }, { type: 'discard', value: tileId },
  // { type: 'open', groups: [[ids...], ...] } or { type: 'open', pairs: [[a, b], ...] },
  // { type: 'process', tile, group, position: 'start' | 'end' } or { type: 'process', tile, group, replace: jokerTileId }.
  // Same results and errors as OkeyHand.act.
  act(seat, action) {
    if (!Number.isInteger(seat) || seat < 0 || seat > 3 || !action || typeof action !== 'object') return { ok: false, error: 'badAction' };
    const { type } = action;
    const validShape =
      (type === 'draw' && (action.value === 'deck' || action.value === 'discard')) ||
      (type === 'discard' && isTile(action.value)) ||
      (type === 'open' && (Array.isArray(action.groups) || Array.isArray(action.pairs))) ||
      (type === 'process' && isTile(action.tile) && Number.isInteger(action.group) && (action.replace === undefined || isTile(action.replace)) &&
        (action.position === undefined || action.position === 'start' || action.position === 'end'));
    if (!validShape) return { ok: false, error: 'badAction' };
    if (action.seq !== undefined && action.seq !== this.seq) return { ok: false, error: 'stale' };
    if (this.over) return { ok: false, error: 'gameOver' };
    if (seat !== this.turn) return { ok: false, error: 'notYourTurn' };
    if ((type === 'draw') !== (this.phase === 'draw')) return { ok: false, error: 'wrongPhase' };
    try {
      let extra = {};
      if (type === 'draw') extra = this.draw(seat, action.value);
      else if (type === 'discard') this.discard(seat, action.value);
      else if (type === 'open') extra = this.open(seat, { groups: action.groups, pairs: action.pairs });
      else extra = this.process(seat, action);
      return { ok: true, seq: this.seq, ...extra };
    } catch {
      return { ok: false, error: 'illegal' };
    }
  }
}

// Keeps joker colours in a set consistent after a change: jokers take the colours that are missing.
function relabel(type, tiles) {
  if (type !== 'set') return tiles;
  const used = new Set(tiles.filter((t) => !t.joker).map((t) => t.color));
  const free = ['Y', 'B', 'K', 'R'].filter((c) => !used.has(c));
  return tiles.map((t) => (t.joker ? { ...t, color: free.shift() } : t));
}

// What the hand could lay down: { canOpen, mode: 'groups' | 'pairs' | null, total, groups, pairs, leftover }.
export function bestOpening(hand, okey, settings, openedAs = null, must) {
  const found = openedAs === 'pairs' ? null : bestGroups(hand, okey, settings, must);
  const pairs = settings.pairOpenMin > 0 && openedAs !== 'groups' ? bestPairs(hand, okey, must) : [];
  const byGroups = !!found && (openedAs === 'groups' ? found.groups.length > 0 : found.total >= settings.openMin);
  const byPairs = pairs.length > 0 && (openedAs === 'pairs' || pairs.length >= settings.pairOpenMin);
  const mode = byGroups ? 'groups' : byPairs ? 'pairs' : null;
  const laidIds = new Set(mode === 'pairs' ? pairs.flat() : found ? found.groups.flatMap((g) => g.tiles) : []);
  return {
    canOpen: mode !== null, mode, total: found ? found.total : 0, groups: found ? found.groups : [], pairs,
    leftover: hand.filter((t) => !laidIds.has(t)),
  };
}

// A round of the right kind for the settings (101 okey or the classic and eşli ones).
export function newHand(opts = {}) {
  return opts.settings && opts.settings.variant === '101' ? new Okey101Hand(opts) : new OkeyHand(opts);
}

// Loads a saved round of any kind.
export function loadHand(data) {
  return data && data.settings && data.settings.variant === '101' ? Okey101Hand.fromJSON(data) : OkeyHand.fromJSON(data);
}
