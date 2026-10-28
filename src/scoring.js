import { partnerOf, teamOf } from './teams.js';
import { meaning } from './tiles.js';
import { numberPoints } from './meld.js';

// Points of one finished round. `result` is OkeyHand.result: { reason, winner, okeyFinish, pair, fromHand }.
// Losers lose lossNormal, multiplied for an okey finish, seven pairs and going out from the first hand.
// In eşli okey (variant 'esli') the finisher's partner loses nothing either: the two opponents pay.
// A round that ends because the draw pile ran out scores nothing.
export function scoreRound(result, settings) {
  const deltas = [0, 0, 0, 0];
  if (!result || result.reason !== 'finish') return { penalty: 0, multiplier: 1, deltas };
  let multiplier = 1;
  if (result.okeyFinish) multiplier *= settings.okeyFinishMultiplier;
  if (result.pair) multiplier *= settings.pairMultiplier;
  if (result.fromHand) multiplier *= settings.handMultiplier;
  const penalty = settings.lossNormal * multiplier;
  const esli = settings.variant === 'esli';
  for (let s = 0; s < 4; s++) if (esli ? teamOf(s) !== teamOf(result.winner) : s !== result.winner) deltas[s] = -penalty;
  if (settings.winnerTakes) {
    if (esli) deltas[result.winner] = deltas[partnerOf(result.winner)] = penalty;
    else deltas[result.winner] = penalty * 3;
  }
  return { penalty, multiplier, deltas };
}

// 101 okey: penalty points of one finished round, lower is better. Everybody but the finisher takes the penalty of
// the tiles left in the hand: notOpenedPenalty when the player never opened, otherwise the points of the tiles
// (okeyHandPenalty for an okey). Going out with an okey as the last tile and going out after opening with pairs
// multiply the penalties of the others. A round that ends because the pile ran out is scored the same way for all four
// players, without multipliers (settings.deckOutScores), or scores nothing.
// `result`: { reason, winner, okeyFinish, pair }; `hands`: the tiles left; `opened`: per seat null | 'groups' | 'pairs'.
export function scoreRound101(result, hands, opened, okey, settings) {
  const left = (s) => {
    if (!opened[s]) return settings.notOpenedPenalty;
    return hands[s].reduce((sum, t) => {
      const m = meaning(t, okey);
      return sum + (m ? numberPoints(m.number, settings) : settings.okeyHandPenalty);
    }, 0);
  };
  const deltas = [0, 0, 0, 0];
  if (result.reason === 'finish') {
    let multiplier = 1;
    if (result.okeyFinish) multiplier *= settings.okeyFinishMultiplier;
    if (result.pair) multiplier *= settings.pairMultiplier;
    for (let s = 0; s < 4; s++) if (s !== result.winner) deltas[s] = left(s) * multiplier;
    return { penalty: Math.max(...deltas), multiplier, deltas };
  }
  if (settings.deckOutScores) for (let s = 0; s < 4; s++) deltas[s] = left(s);
  return { penalty: 0, multiplier: 1, deltas };
}
