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
 * @param userId - Discord user ID (optional, for user messages)
 */
export function saveMessage(
  channelId: string,
  role: 'user' | 'assistant',
  displayName: string,
  content: string,
  userId?: string
): void {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO session_history (channel_id, role, display_name, content, timestamp, user_id) VALUES (?, ?, ?, ?, ?, ?)'
  )
  stmt.run(channelId, role, displayName, content, Date.now(), userId ?? null)

  // Backfill user_id on old rows so cold-start mapping works
  if (userId && role === 'user') {
    db.prepare(
      'UPDATE session_history SET user_id = ? WHERE channel_id = ? AND display_name = ? AND user_id IS NULL'
    ).run(userId, channelId, displayName)
  }
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

/** Get display_name → user_id mappings from recent session history for a channel */
export function getUserIdMap(channelId: string, limit: number): Map<string, string> {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT DISTINCT display_name, user_id FROM session_history
       WHERE channel_id = ? AND user_id IS NOT NULL AND role = 'user'
       ORDER BY timestamp DESC LIMIT ?`
    )
    .all(channelId, limit) as Array<{ display_name: string; user_id: string }>

  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.display_name, row.user_id)
  }
  return map
}
