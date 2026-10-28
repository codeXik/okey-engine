// Every rule that differs between tables is a setting; these are the agreed defaults (docs/KURALLAR.md).
export const DEFAULT_SETTINGS = {
  variant: 'klasik', // 'klasik' (4 players, each for themselves) or 'esli' (2 against 2: seats 0+2 against 1+3); '101' is planned, not playable yet
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
  maxRounds: 0, // a match ends after this many rounds (0 = no limit)
};

export const VARIANTS = {
  klasik: { seats: 4, teams: false, playable: true },
  esli: { seats: 4, teams: true, playable: true }, // seats 0+2 against 1+3
  101: { seats: 4, teams: false, playable: false }, // version 3: 101 okey
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
};

// Fills in the defaults and throws on an unknown setting or a value out of range.
export function withDefaults(settings = {}) {
  const out = { ...DEFAULT_SETTINGS, ...settings };
  for (const [key, value] of Object.entries(out)) {
    if (!CHECKS[key]) throw new Error(`Unknown setting: ${key}`);
    if (!CHECKS[key](value)) throw new Error(`Bad value for setting ${key}: ${value}`);
  }
  if (out.endScore >= out.startScore) throw new Error('endScore must be below startScore');
  if (out.teamEndScore >= 2 * out.startScore) throw new Error('teamEndScore must be below twice startScore');
  return out;
}

// Throws when the variant is a planned one (kept as one place so versions 2 and 3 only have to flip a flag).
export function assertPlayable(settings) {
  if (!VARIANTS[settings.variant].playable) throw new Error(`Variant not playable yet: ${settings.variant}`);
}
