import { DiscordAPIError } from 'discord.js'

const IGNORABLE_CODES = new Set([50013, 10008])

/** Check if a Discord API error is ignorable (missing permissions or deleted message) */
export function isIgnorableDiscordError(error: unknown): boolean {
  return error instanceof DiscordAPIError && IGNORABLE_CODES.has(error.code as number)
}
