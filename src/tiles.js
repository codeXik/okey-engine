// Tiles are strings: colour letter + number + copy, e.g. 'Y5a' = first yellow 5, 'K13b' = second black 13.
// The two false jokers (sahte okey) are 'Fa' and 'Fb'.
export const COLORS = ['Y', 'B', 'K', 'R']; // yellow (sarı), blue (mavi), black (siyah), red (kırmızı)
export const COLOR_NAMES_TR = { Y: 'Sarı', B: 'Mavi', K: 'Siyah', R: 'Kırmızı' };

export const isTile = (t) => typeof t === 'string' && /^(?:[YBKR](?:[1-9]|1[0-3])[ab]|F[ab])$/.test(t);
export const isFake = (t) => t[0] === 'F';
export const colorOf = (t) => (isFake(t) ? null : t[0]);
export const numberOf = (t) => (isFake(t) ? null : Number(t.slice(1, -1)));

// 106 tiles: 4 colours x 13 numbers x 2 copies, plus 2 false jokers.
export function makeTiles() {
  const tiles = [];
  for (const c of COLORS) for (let n = 1; n <= 13; n++) for (const k of ['a', 'b']) tiles.push(c + n + k);
  tiles.push('Fa', 'Fb');
  return tiles;
}

// Unpredictable random number in [0, 1) from the platform's cryptographic generator (browsers, Node.js 19+).
// Use it wherever a deal must not be guessable, e.g. on a game server.
export function secureRandom() {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('No cryptographic random generator here');
  const [hi, lo] = c.getRandomValues(new Uint32Array(2));
  return ((hi >>> 5) * 67108864 + (lo >>> 6)) / 9007199254740992; // 53 random bits
}

// The default for dealing: secure when the platform has it.
export const defaultRandom = () => (globalThis.crypto?.getRandomValues ? secureRandom() : Math.random());

export function shuffle(list, rng = defaultRandom) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The okey is the tile one number above the indicator (gösterge) in the same colour; 13 is followed by 1.
export const okeyOf = (indicator) => ({ color: colorOf(indicator), number: (numberOf(indicator) % 13) + 1 });

// The real jokers are the two physical tiles that carry the okey's colour and number.
export const isOkey = (t, okey) => !isFake(t) && colorOf(t) === okey.color && numberOf(t) === okey.number;

// What a tile stands for in a hand: null for a wild okey, otherwise { color, number }.
// A false joker stands for the okey tile itself.
export function meaning(t, okey) {
  if (isFake(t)) return { color: okey.color, number: okey.number };
  if (isOkey(t, okey)) return null;
  return { color: colorOf(t), number: numberOf(t) };
}

// Deals one round: the indicator is turned up (a false joker is never the indicator), the starting seat gets 15
// tiles, the others 14, and what is left (48 tiles) is the draw pile.
export function dealRound(rng = defaultRandom, starter = 1) {
  const pile = shuffle(makeTiles(), rng);
  const at = pile.findIndex((t) => !isFake(t));
  const indicator = pile.splice(at, 1)[0];
  const hands = [0, 1, 2, 3].map(() => []);
  for (let i = 0; i < 4; i++) {
    const seat = (starter + i) % 4;
    hands[seat] = pile.splice(0, i === 0 ? 15 : 14);
  }
  return { hands, deck: pile, indicator };
}
