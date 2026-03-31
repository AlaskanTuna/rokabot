/**
 * Session history persistence — write-behind storage and cold-start rehydration.
 * Wraps SQLite operations on the `session_history` table.
 */

import { getDb } from './database.js'
import { logger } from '../utils/logger.js'
import type { WindowMessage } from '../session/types.js'

/**
 * Persist a single message to the session history table.
 * @param channelId - Discord channel ID
 * @param role - Message author role ('user' or 'assistant')
 * @param displayName - Display name of the message author
 * @param content - Message text content
 */
export function saveMessage(channelId: string, role: 'user' | 'assistant', displayName: string, content: string): void {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO session_history (channel_id, role, display_name, content, timestamp) VALUES (?, ?, ?, ?, ?)'
  )
  stmt.run(channelId, role, displayName, content, Date.now())
}

/**
 * Load the most recent messages for a channel, ordered oldest-first.
 * @param channelId - Discord channel ID
 * @param limit - Maximum number of messages to return
 * @returns Array of WindowMessage ordered by timestamp ascending
 */
export function loadHistory(channelId: string, limit: number): WindowMessage[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT role, display_name, content, timestamp
    FROM session_history
    WHERE channel_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `)
  const rows = stmt.all(channelId, limit) as Array<{
    role: 'user' | 'assistant'
    display_name: string
    content: string
    timestamp: number
  }>

  return rows.reverse().map((row) => ({
    role: row.role,
    displayName: row.display_name,
    content: row.content,
    timestamp: row.timestamp
  }))
}

/**
 * Delete all stored history for a channel.
 * @param channelId - Discord channel ID
 */
export function clearHistory(channelId: string): void {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM session_history WHERE channel_id = ?')
  stmt.run(channelId)
}

/**
 * Delete session history older than the specified number of days.
 * Returns the number of rows deleted.
 */
export function pruneOldHistory(maxAgeDays: number = 7): number {
  const db = getDb()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  const result = db.prepare('DELETE FROM session_history WHERE timestamp < ?').run(cutoff)
  if (result.changes > 0) {
    logger.info({ pruned: result.changes, maxAgeDays }, 'Pruned old session history')
  }
  return result.changes
}
