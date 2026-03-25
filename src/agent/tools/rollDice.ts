export interface RollDiceParams {
  count?: number
  sides?: number
}

export interface RollDiceResult {
  rolls: number[]
  total: number
  description: string
}

/** Roll 1-10 dice with 2-100 sides each, clamping inputs to safe bounds. */
export function rollDice(params: RollDiceParams): RollDiceResult {
  const count = Math.max(1, Math.min(10, Math.floor(params.count ?? 1)))
  const sides = Math.max(2, Math.min(100, Math.floor(params.sides ?? 6)))

  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const total = rolls.reduce((sum, r) => sum + r, 0)
  const description = `${count}d${sides}: [${rolls.join(', ')}] = ${total}`

  return { rolls, total, description }
}
