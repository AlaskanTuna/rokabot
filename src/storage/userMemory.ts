/**
 * Per-user relationship memory — persistent fact storage for the Roka agent.
 * Wraps SQLite operations on the `user_memory` table.
 * Capped at 10 facts per user; oldest (by updated_at) is evicted when full.
 */

import { getDb } from './database.js'
import { logger } from '../utils/logger.js'

const MAX_FACTS_PER_USER = 10

/**
 * Upsert a fact about a user. If the key already exists, its value and timestamp are updated.
 * If the user already has 10 facts and this is a new key, the oldest fact (by updated_at) is deleted first.
 */
export function saveFact(userId: string, key: string, value: string): void {
  const db = getDb()

  // Check if this key already exists for the user (update vs insert)
  const existing = db.prepare('SELECT 1 FROM user_memory WHERE user_id = ? AND fact_key = ?').get(userId, key) as
    | { 1: number }
    | undefined

  if (!existing) {
    // New fact — check if we need to evict the oldest
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM user_memory WHERE user_id = ?').get(userId) as {
      cnt: number
    }

    if (count.cnt >= MAX_FACTS_PER_USER) {
      db.prepare(
        'DELETE FROM user_memory WHERE user_id = ? AND fact_key = (SELECT fact_key FROM user_memory WHERE user_id = ? ORDER BY updated_at ASC LIMIT 1)'
      ).run(userId, userId)
    }
  }

  db.prepare('INSERT OR REPLACE INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)').run(
    userId,
    key,
    value,
    Date.now()
  )
}

/**
 * Get all stored facts for a user, ordered by most recently updated.
 */
export function getFacts(userId: string): Array<{ key: string; value: string }> {
  const db = getDb()
  const rows = db
    .prepare('SELECT fact_key, fact_value FROM user_memory WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId) as Array<{ fact_key: string; fact_value: string }>

  return rows.map((row) => ({ key: row.fact_key, value: row.fact_value }))
}

/**
 * Delete a specific fact for a user.
 */
export function deleteFact(userId: string, key: string): void {
  const db = getDb()
  db.prepare('DELETE FROM user_memory WHERE user_id = ? AND fact_key = ?').run(userId, key)
}

/**
 * Format all facts for a user as a human-readable string for injection into the system prompt.
 * Returns empty string if no facts exist.
 * Example: "their favorite anime is Frieren, they prefer to be called Ali, they like cooking"
 */
export function getAllFactsForPrompt(userId: string): string {
  const facts = getFacts(userId)
  if (facts.length === 0) return ''
  return facts.map((f) => `${f.key}: ${f.value}`).join(', ')
}

/**
 * Count the number of stored facts for a user.
 */
export function countFacts(userId: string): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM user_memory WHERE user_id = ?').get(userId) as { cnt: number }
  return row.cnt
}

/**
 * Touch updated_at for all facts of a user (refresh-on-access).
 * Keeps frequently-accessed facts from expiring under the TTL pruning.
 */
export function refreshFactTimestamps(userId: string): void {
  const db = getDb()
  db.prepare('UPDATE user_memory SET updated_at = ? WHERE user_id = ?').run(Date.now(), userId)
}

/**
 * Delete facts older than the specified number of days.
 * Returns the number of pruned rows.
 */
export function pruneOldFacts(maxAgeDays: number = 90): number {
  const db = getDb()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  const result = db.prepare('DELETE FROM user_memory WHERE updated_at < ?').run(cutoff)
  if (result.changes > 0) {
    logger.info({ pruned: result.changes, maxAgeDays }, 'Pruned stale user memory facts')
  }
  return result.changes
}
