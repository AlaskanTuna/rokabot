/** Store a fact about a user for future reference */

import { saveFact, countFacts } from '../../storage/userMemory.js'

export interface RememberUserParams {
  user_id: string
  fact_key: string
  fact_value: string
}

export interface RememberUserResult {
  success: boolean
  message: string
  totalFacts: number
}

/** Save a fact about a user, evicting the oldest when capped */
export function rememberUser(params: RememberUserParams): RememberUserResult {
  const { user_id, fact_key, fact_value } = params
  saveFact(user_id, fact_key, fact_value)
  const total = countFacts(user_id)
  return {
    success: true,
    message: `Remembered ${fact_key} for ${user_id}.`,
    totalFacts: total
  }
}
