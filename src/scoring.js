import { partnerOf, teamOf } from './teams.js';

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
