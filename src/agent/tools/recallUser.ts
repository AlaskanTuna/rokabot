/** Recall all stored facts about a user */

import { getFacts } from '../../storage/userMemory.js'

export interface RecallUserParams {
  user_id: string
  guild_id: string
}

export interface RecallUserResult {
  facts: string
  factCount: number
}

export function recallUser(params: RecallUserParams): RecallUserResult {
  const { user_id, guild_id } = params
  const facts = getFacts(guild_id, user_id)

  if (facts.length === 0) {
    return {
      facts: "I don't have any notes about this person yet.",
      factCount: 0
    }
  }

  const formatted = facts.map((f) => `${f.key}: ${f.value}`).join(', ')
  return {
    facts: formatted,
    factCount: facts.length
  }
}
