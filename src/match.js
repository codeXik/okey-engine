import { OkeyHand } from './hand.js';
import { defaultRandom } from './tiles.js';
import { withDefaults, assertPlayable } from './settings.js';

const SAVE_VERSION = 1;

// A whole game: every player starts with settings.startScore points and rounds are played until somebody falls
// to settings.endScore (or settings.maxRounds rounds are done). The highest score wins; a tie at the top means one
// more round. The dealer moves one seat per round.
export class OkeyMatch {
  constructor({ settings, rng = defaultRandom, dealer = 0 } = {}) {
    if (!Number.isInteger(dealer) || dealer < 0 || dealer > 3) throw new Error('Dealer must be a seat 0..3');
    this.settings = withDefaults(settings);
    assertPlayable(this.settings);
    this.rng = rng;
    this.dealer = dealer;
    this.scores = [0, 1, 2, 3].map(() => this.settings.startScore);
    this.rounds = []; // [{ dealer, winner, reason, mode, okeyFinish, pair, fromHand, deltas }]
    this.winner = -1;
    this.hand = null;
    this.counted = false; // the current round's scores are already added
  }

  get over() {
    return this.winner >= 0;
  }

  // Seats from first to last place: [{ seat, score, place }]; equal scores share a place.
  get standings() {
    const order = [0, 1, 2, 3].sort((a, b) => this.scores[b] - this.scores[a] || a - b);
    return order.map((seat) => ({ seat, score: this.scores[seat], place: 1 + this.scores.filter((s) => s > this.scores[seat]).length }));
  }

  startRound() {
    if (this.over) throw new Error('The match is over');
    if (this.hand && !this.counted) throw new Error('The round is not finished');
    this.hand = new OkeyHand({ dealer: this.dealer, rng: this.rng, settings: this.settings });
    this.counted = false;
    return this.hand;
  }

  // Call when the current round is done: adds the scores and decides whether the match is over.
  finishRound() {
    const h = this.hand;
    if (!h || h.phase !== 'done') throw new Error('The round is not finished');
    if (this.counted) throw new Error('Round already counted');
    this.counted = true;
    const r = h.result;
    h.scores.forEach((x, i) => (this.scores[i] += x));
    this.rounds.push({
      dealer: this.dealer, winner: r.winner, reason: r.reason, mode: r.mode ?? null, okeyFinish: !!r.okeyFinish, pair: !!r.pair,
      fromHand: !!r.fromHand, deltas: h.scores.slice(),
    });
    this.dealer = (this.dealer + 1) % 4;
    const top = Math.max(...this.scores);
    const ended = Math.min(...this.scores) <= this.settings.endScore || (this.settings.maxRounds > 0 && this.rounds.length >= this.settings.maxRounds);
    if (ended && this.scores.filter((s) => s === top).length === 1) this.winner = this.scores.indexOf(top);
    return { over: this.over, winner: this.winner, scores: this.scores.slice() };
  }

  // What `seat` is allowed to see of the whole match (the current round through OkeyHand.view).
  view(seat) {
    const { version, hand, ...pub } = this.toJSON();
    return { ...pub, seat, over: this.over, standings: this.standings, round: this.rounds.length + (this.counted ? 0 : 1), hand: this.hand && this.hand.view(seat) };
  }

  // Plain object (JSON safe) with the whole match, the round in progress included.
  toJSON() {
    return {
      version: SAVE_VERSION, settings: { ...this.settings }, dealer: this.dealer, scores: this.scores.slice(),
      rounds: this.rounds.map((r) => ({ ...r, deltas: r.deltas.slice() })), winner: this.winner, counted: this.counted,
      hand: this.hand && this.hand.toJSON(),
    };
  }

  static fromJSON(data, { rng = defaultRandom } = {}) {
    if (!data || data.version !== SAVE_VERSION) throw new Error('Unknown save format');
    const m = new OkeyMatch({ settings: data.settings, rng, dealer: data.dealer });
    const ok = Array.isArray(data.scores) && data.scores.length === 4 && data.scores.every(Number.isInteger) && Array.isArray(data.rounds) &&
      Number.isInteger(data.winner) && data.winner >= -1 && data.winner <= 3 && typeof data.counted === 'boolean';
    if (!ok) throw new Error('Save is inconsistent');
    const copy = JSON.parse(JSON.stringify({ scores: data.scores, rounds: data.rounds }));
    Object.assign(m, { scores: copy.scores, rounds: copy.rounds, winner: data.winner, counted: data.counted });
    m.hand = data.hand ? OkeyHand.fromJSON(data.hand) : null;
    if (m.counted && !(m.hand && m.hand.over)) throw new Error('Save is inconsistent');
    return m;
  }
}
