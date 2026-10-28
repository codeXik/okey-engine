// Every rule that differs between tables is a setting; these are the agreed defaults (docs/KURALLAR.md).
export const DEFAULT_SETTINGS = {
  variant: 'klasik', // 'klasik' (4 players, each for themselves), 'esli' (2 against 2: seats 0+2 against 1+3) or '101' (101 okey, 4 players)
  aceHigh: true, // a 1 may follow the 13 in a run (12-13-1)
  allowPairs: true, // a hand of seven pairs (çift gitme) may go out
  startScore: 20, // every player starts a match with this many points
  lossNormal: 2, // points each loser loses when somebody goes out
  okeyFinishMultiplier: 2, // the last tile thrown is the okey (okey atarak bitirme)
  pairMultiplier: 2, // went out with seven pairs
  handMultiplier: 2, // went out with the very first 15 tiles, without drawing (elden bitirme)
  winnerTakes: false, // the winner also gains what the losers lose
  endScore: 0, // a match ends when somebody falls to this score or below
  teamEndScore: 0, // eşli: a match ends when a team's total (its two players' scores added) falls to this or below
  maxRounds: 0, // a match ends after this many rounds (0 = no limit; 101 okey plays 11 rounds unless told otherwise)
  // 101 okey only:
  openMin: 101, // the runs and sets laid down to open must add up to at least this many points
  pairOpenMin: 5, // opening with pairs needs at least this many pairs (0 = pairs cannot open)
  mustOpenWithTaken: true, // a player who has not opened and takes the thrown tile must open that turn, using that tile
  notOpenedPenalty: 101, // penalty of a player who has not opened when the round ends
  okeyHandPenalty: 101, // penalty of an okey left in the hand of a player who has opened
  aceValue: 1, // points of a 1 in a low run, a set or the hand
  aceHighValue: 14, // points of the 1 that ends a run (12-13-1)
  deckOutScores: true, // when the pile runs out every player takes the usual penalty for the tiles left in the hand
  matchEndScore: 0, // 101: a match ends when somebody's penalty total reaches this (0 = off)
};

export const VARIANTS = {
  klasik: { seats: 4, teams: false, playable: true },
  esli: { seats: 4, teams: true, playable: true }, // seats 0+2 against 1+3
  101: { seats: 4, teams: false, playable: true }, // 101 okey: 22/21 tiles, opening with 101 points, processing onto open groups
};

const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const CHECKS = {
  variant: (x) => Object.hasOwn(VARIANTS, x),
  aceHigh: (x) => typeof x === 'boolean',
  allowPairs: (x) => typeof x === 'boolean',
  startScore: (x) => isInt(x, 1, 100000),
  lossNormal: (x) => isInt(x, 0, 100000),
  okeyFinishMultiplier: (x) => isInt(x, 1, 1000),
  pairMultiplier: (x) => isInt(x, 1, 1000),
  handMultiplier: (x) => isInt(x, 1, 1000),
  winnerTakes: (x) => typeof x === 'boolean', // eşli: both players of the finishing team gain the penalty
  endScore: (x) => isInt(x, -100000, 100000),
  teamEndScore: (x) => isInt(x, -200000, 200000),
  maxRounds: (x) => isInt(x, 0, 100000),
  openMin: (x) => isInt(x, 1, 100000),
  pairOpenMin: (x) => isInt(x, 0, 11),
  mustOpenWithTaken: (x) => typeof x === 'boolean',
  notOpenedPenalty: (x) => isInt(x, 0, 100000),
  okeyHandPenalty: (x) => isInt(x, 0, 100000),
  aceValue: (x) => isInt(x, 0, 100),
  aceHighValue: (x) => isInt(x, 0, 100),
  deckOutScores: (x) => typeof x === 'boolean',
  matchEndScore: (x) => isInt(x, 0, 1000000),
};

// Fills in the defaults and throws on an unknown setting or a value out of range.
export function withDefaults(settings = {}) {
  const out = { ...DEFAULT_SETTINGS, ...settings };
  if (out.variant === '101' && settings.maxRounds === undefined) out.maxRounds = 11;
  for (const [key, value] of Object.entries(out)) {
    if (!CHECKS[key]) throw new Error(`Unknown setting: ${key}`);
    if (!CHECKS[key](value)) throw new Error(`Bad value for setting ${key}: ${value}`);
  }
  if (out.variant !== '101' && out.endScore >= out.startScore) throw new Error('endScore must be below startScore');
  if (out.teamEndScore >= 2 * out.startScore) throw new Error('teamEndScore must be below twice startScore');
  return out;
}

// Throws when the variant is a planned one (kept as one place so versions 2 and 3 only have to flip a flag).
export function assertPlayable(settings) {
  if (!VARIANTS[settings.variant].playable) throw new Error(`Variant not playable yet: ${settings.variant}`);
}
