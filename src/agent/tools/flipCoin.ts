export interface FlipCoinResult {
  result: 'heads' | 'tails'
}

export function flipCoin(): FlipCoinResult {
  return { result: Math.random() < 0.5 ? 'heads' : 'tails' }
}
