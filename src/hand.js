import { dealRound, defaultRandom, isTile, isOkey, makeTiles, okeyOf } from './tiles.js';
import { winningArrangement } from './groups.js';
import { assertPlayable, withDefaults } from './settings.js';
import { scoreRound } from './scoring.js';
import { TEAM_SEATS, partnerOf, teamOf } from './teams.js';

const SAVE_VERSION = 1;
const seatOk = (s) => Number.isInteger(s) && s >= 0 && s <= 3;
const copy = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

// One round of Okey (4 players). Phases: 'draw' (the seat on turn takes a tile), 'discard' (it throws one,
// or goes out), 'done'. The starting seat, (dealer + 1) % 4, holds 15 tiles and begins with a discard.
// Seats play in increasing order; a seat may take the top tile of the previous seat's discards.
export class OkeyHand {
  // `deal` ({ hands, deck, indicator }) fixes the tiles, for tests and for loading a save.
  constructor({ dealer = 0, rng = defaultRandom, settings, deal } = {}) {
    if (!seatOk(dealer)) throw new Error('Dealer must be a seat 0..3');
    this.settings = withDefaults(settings);
    assertPlayable(this.settings);
    this.dealer = dealer;
    this.starter = (dealer + 1) % 4;
    const d = deal || dealRound(rng, this.starter);
    this.hands = d.hands.map((h) => h.slice());
    this.deck = d.deck.slice();
    this.indicator = d.indicator;
    this.okey = okeyOf(d.indicator);
    this.discards = [[], [], [], []]; // public: every seat's thrown tiles, the last one on top
    this.phase = 'discard';
    this.turn = this.starter;
    this.log = []; // public: [{ seq, seat, type: 'draw' | 'discard' | 'finish', value, tile? }]
    this.result = null;
    this.seq = 0; // number of actions taken so far
    this.lastAction = null;
    if (!deal) return;
    checkTiles([...this.hands.flat(), ...this.deck, this.indicator]);
    if (this.hands.some((h, s) => h.length !== (s === this.starter ? 15 : 14)) || this.deck.length !== 48) throw new Error('Wrong number of tiles');
  }

  get over() {
    return this.phase === 'done';
  }

  // Eşli okey: seats 0+2 against 1+3.
  get esli() {
    return this.settings.variant === 'esli';
  }

  // Points of this round per seat (null until it is over).
  get scores() {
    return this.result ? this.result.deltas.slice() : null;
  }

  // The seat whose discard `seat` may take.
  previous(seat = this.turn) {
    return (seat + 3) % 4;
  }

  // Plain object (JSON safe) holding the whole round, for saving a game and loading it later.
  toJSON() {
    return {
      version: SAVE_VERSION, settings: { ...this.settings }, dealer: this.dealer, hands: this.hands.map((h) => h.slice()),
      deck: this.deck.slice(), indicator: this.indicator, discards: this.discards.map((d) => d.slice()), phase: this.phase,
      turn: this.turn, log: copy(this.log), result: copy(this.result), seq: this.seq, lastAction: copy(this.lastAction),
    };
  }

  static fromJSON(data) {
    const bad = () => new Error('Save is inconsistent');
    if (!data || data.version !== SAVE_VERSION) throw new Error('Unknown save format');
    if (!seatOk(data.dealer) || !seatOk(data.turn) || !['draw', 'discard', 'done'].includes(data.phase)) throw bad();
    if (![data.hands, data.discards].every((x) => Array.isArray(x) && x.length === 4 && x.every(Array.isArray))) throw bad();
    if (!Array.isArray(data.deck) || !Array.isArray(data.log) || !Number.isInteger(data.seq) || data.seq < 0) throw bad();
    const settings = withDefaults(data.settings);
    const starter = (data.dealer + 1) % 4;
    const finishTile = data.result && data.result.reason === 'finish' ? [data.result.tile] : [];
    checkTiles([...data.hands.flat(), ...data.deck, ...data.discards.flat(), data.indicator, ...finishTile]);
    const count = data.hands.flat().length + data.deck.length + data.discards.flat().length + 1 + finishTile.length;
    if (count !== 106) throw bad();
    if (data.hands.some((h, s) => h.length !== (data.phase === 'discard' && s === data.turn ? 15 : 14))) throw bad();
    if ((data.phase === 'done') !== !!data.result) throw bad();
    if (data.seq === 0 && (data.phase !== 'discard' || data.turn !== starter)) throw bad();
    if (data.log.length !== data.seq) throw bad();
    const h = new OkeyHand({ dealer: data.dealer, settings });
    Object.assign(h, {
      hands: data.hands.map((x) => x.slice()), deck: data.deck.slice(), indicator: data.indicator, okey: okeyOf(data.indicator),
      discards: data.discards.map((d) => d.slice()), phase: data.phase, turn: data.turn, log: copy(data.log),
      result: copy(data.result), seq: data.seq, lastAction: copy(data.lastAction) ?? null,
    });
    return h;
  }

  // What `seat` is allowed to see: its own tiles, how many the others hold, and everything public.
  view(seat) {
    const mine = this.turn === seat && !this.over;
    return {
      settings: { ...this.settings }, dealer: this.dealer, starter: this.starter, seat, phase: this.phase, turn: this.turn,
      indicator: this.indicator, okey: { ...this.okey }, hand: this.hands[seat].slice(), handSizes: this.hands.map((h) => h.length),
      deckSize: this.deck.length, discards: this.discards.map((d) => d.slice()), log: copy(this.log), seq: this.seq,
      lastAction: copy(this.lastAction), result: copy(this.result),
      drawOptions: mine && this.phase === 'draw' ? this.drawOptions(seat) : [],
      legal: mine && this.phase === 'discard' ? this.hands[seat].slice() : [],
      finishOptions: mine && this.phase === 'discard' ? this.finishOptions(seat) : [],
      scores: this.scores,
      team: this.esli ? teamOf(seat) : null, partner: this.esli ? partnerOf(seat) : null, teams: this.esli ? TEAM_SEATS.map((t) => t.slice()) : null,
    };
  }

  // The action `seat` may take now: 'draw', 'discard' (a discard may also be a 'finish'), or null.
  expects(seat = this.turn) {
    if (this.over || seat !== this.turn) return null;
    return this.phase;
  }

  // Where the seat on turn may draw from: 'deck' and/or 'discard' (the previous seat's last tile).
  drawOptions(seat = this.turn) {
    if (this.over || this.phase !== 'draw' || seat !== this.turn) return [];
    const out = [];
    if (this.deck.length) out.push('deck');
    if (this.discards[this.previous(seat)].length) out.push('discard');
    return out;
  }

  // Every way `seat` could go out now: [{ tile, mode: 'per' | 'cift', okeyFinish, pair, fromHand, points }]
  // where `tile` is the one thrown last and `points` what each loser loses.
  finishOptions(seat = this.turn) {
    if (this.over || this.phase !== 'discard' || seat !== this.turn) return [];
    const hand = this.hands[seat];
    const out = [];
    for (const tile of hand) {
      const rest = hand.filter((t) => t !== tile);
      for (const mode of ['per', 'cift']) {
        if (!winningArrangement(rest, this.okey, this.settings, [mode])) continue;
        const info = { okeyFinish: isOkey(tile, this.okey), pair: mode === 'cift', fromHand: this.seq === 0 };
        out.push({ tile, mode, ...info, points: scoreRound({ reason: 'finish', winner: seat, ...info }, this.settings).penalty });
      }
    }
    return out;
  }

  #done(seat, type, value, tile) {
    this.seq++;
    const entry = { seq: this.seq, seat, type, value };
    if (tile !== undefined) entry.tile = tile;
    this.lastAction = entry;
    this.log.push({ ...entry });
  }

  #check(seat, phase) {
    if (this.over) throw new Error('The round is over');
    if (seat !== this.turn) throw new Error('Not your turn');
    if (this.phase !== phase) throw new Error(`Not the ${phase} phase`);
  }

  // Takes a tile from the 'deck' or from the previous seat's 'discard'. Returns { tile }.
  draw(seat, source) {
    this.#check(seat, 'draw');
    if (!this.drawOptions(seat).includes(source)) throw new Error(`Cannot draw from ${source}`);
    const tile = source === 'deck' ? this.deck.pop() : this.discards[this.previous(seat)].pop();
    this.hands[seat].push(tile);
    this.phase = 'discard';
    this.#done(seat, 'draw', source, source === 'discard' ? tile : undefined);
    return { tile };
  }

  discard(seat, tile) {
    this.#check(seat, 'discard');
    const at = this.hands[seat].indexOf(tile);
    if (at < 0) throw new Error('You do not hold that tile');
    this.hands[seat].splice(at, 1);
    this.discards[seat].push(tile);
    this.#done(seat, 'discard', tile, tile);
    this.turn = (seat + 1) % 4;
    this.phase = 'draw';
    if (this.deck.length === 0) {
      // nobody can draw from the pile any more: the round is a draw
      this.phase = 'done';
      this.result = { reason: 'deckOut', winner: -1, hands: this.hands.map((h) => h.slice()), ...scoreRound(null, this.settings) };
    }
  }

  // Goes out by throwing `tile` face down as the last tile; the other 14 must form runs and sets ('per')
  // or seven pairs ('cift'). Without `mode` the better paying one is used. Returns the result.
  finish(seat, tile, mode) {
    this.#check(seat, 'discard');
    const options = this.finishOptions(seat).filter((o) => o.tile === tile && (mode === undefined || o.mode === mode));
    if (!options.length) throw new Error('Cannot go out like that');
    const best = options.reduce((a, b) => (b.points > a.points ? b : a));
    const rest = this.hands[seat].filter((t) => t !== tile);
    const arrangement = winningArrangement(rest, this.okey, this.settings, [best.mode]);
    const { okeyFinish, pair, fromHand } = best;
    this.#done(seat, 'finish', tile, tile);
    this.hands[seat] = rest;
    this.phase = 'done';
    const base = { reason: 'finish', winner: seat, tile, mode: best.mode, okeyFinish, pair, fromHand };
    this.result = {
      ...base, ...(arrangement.groups ? { groups: arrangement.groups } : { pairs: arrangement.pairs }),
      hands: this.hands.map((h) => h.slice()), ...scoreRound(base, this.settings),
    };
    return this.result;
  }

  // One entry point for actions coming from a player, a network message or a computer:
  //   { type: 'draw', value: 'deck' | 'discard' }, { type: 'discard', value: 'Y5a' },
  //   { type: 'finish', value: 'Y5a', mode?: 'per' | 'cift' }  (the tile thrown last)
  // With `seq`, the action is taken only if nothing happened since the sender saw the round (a late or
  // repeated message is refused). Never throws: returns { ok: true, seq, ... } or { ok: false, error }.
  // Errors: 'badAction', 'stale', 'gameOver', 'notYourTurn', 'wrongPhase', 'illegal'.
  act(seat, action) {
    if (!seatOk(seat) || !action || typeof action !== 'object') return { ok: false, error: 'badAction' };
    const { type, value } = action;
    if (!['draw', 'discard', 'finish'].includes(type)) return { ok: false, error: 'badAction' };
    if (type === 'draw' ? value !== 'deck' && value !== 'discard' : !isTile(value)) return { ok: false, error: 'badAction' };
    if (action.mode !== undefined && action.mode !== 'per' && action.mode !== 'cift') return { ok: false, error: 'badAction' };
    if (action.seq !== undefined && action.seq !== this.seq) return { ok: false, error: 'stale' };
    if (this.over) return { ok: false, error: 'gameOver' };
    if (seat !== this.turn) return { ok: false, error: 'notYourTurn' };
    if ((type === 'draw') !== (this.phase === 'draw')) return { ok: false, error: 'wrongPhase' };
    try {
      let extra = {};
      if (type === 'draw') extra = this.draw(seat, value);
      else if (type === 'discard') this.discard(seat, value);
      else extra = { result: this.finish(seat, value, action.mode) };
      return { ok: true, seq: this.seq, ...extra };
    } catch {
      return { ok: false, error: 'illegal' };
    }
  }
}

function checkTiles(tiles) {
  const all = new Set(makeTiles());
  const seen = new Set();
  for (const t of tiles) {
    if (!isTile(t) || !all.has(t)) throw new Error(`Not a tile: ${t}`);
    if (seen.has(t)) throw new Error(`Tile appears twice: ${t}`);
    seen.add(t);
  }
}
