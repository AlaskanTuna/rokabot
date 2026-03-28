/**
 * Gacha/Fortune draw system — daily collectible draw with weighted rarity tiers.
 * Persistent in SQLite: collection tracking + daily draw limits.
 */

import { getDb } from '../storage/database.js'
import { config } from '../config.js'
import {
  GACHA_ITEMS,
  RARITY_WEIGHTS,
  getItemsByRarity,
  getTotalItemCount,
  type GachaItem,
  type GachaRarity
} from './data/gachaItems.js'

export interface DrawResult {
  item: GachaItem
  isNew: boolean
  alreadyDrawnToday: boolean
}

export interface CollectionStats {
  total: number
  common: number
  uncommon: number
  rare: number
  legendary: number
  completion: string
}

/** Get today's date string in the configured timezone (YYYY-MM-DD). */
function getTodayDate(): string {
  const tz = config.timezone ?? undefined
  const now = new Date()
  try {
    const formatted = now.toLocaleDateString('en-CA', { timeZone: tz })
    return formatted
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** Select a rarity tier based on weighted random roll. */
export function rollRarity(): GachaRarity {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  const roll = Math.random() * totalWeight
  let cumulative = 0

  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [GachaRarity, number][]) {
    cumulative += weight
    if (roll < cumulative) return rarity
  }

  return 'common'
}

/** Pick a random item from a given rarity tier. */
function pickItemFromTier(rarity: GachaRarity): GachaItem {
  const pool = getItemsByRarity(rarity)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** Check if a user has already drawn today. */
function hasDrawnToday(userId: string): boolean {
  const db = getDb()
  const today = getTodayDate()
  const row = db.prepare('SELECT last_draw_date FROM gacha_daily WHERE user_id = ?').get(userId) as
    | { last_draw_date: string }
    | undefined
  return row?.last_draw_date === today
}

/** Mark that a user has drawn today. */
function markDailyDraw(userId: string): void {
  const db = getDb()
  const today = getTodayDate()
  db.prepare('INSERT OR REPLACE INTO gacha_daily (user_id, last_draw_date) VALUES (?, ?)').run(userId, today)
}

/** Check if a user already owns an item. */
function ownsItem(userId: string, itemId: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM gacha_collection WHERE user_id = ? AND item_id = ?').get(userId, itemId)
  return row !== undefined
}

/** Save a new item to the user's collection. */
function saveItem(userId: string, itemId: string): void {
  const db = getDb()
  db.prepare('INSERT OR IGNORE INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)').run(
    userId,
    itemId,
    Date.now()
  )
}

/**
 * Perform a gacha draw for a user.
 * Returns the drawn item, whether it's new, and whether the user already drew today.
 */
export function drawItem(userId: string): DrawResult {
  if (hasDrawnToday(userId)) {
    // Still roll an item to show, but mark as already drawn
    const rarity = rollRarity()
    const item = pickItemFromTier(rarity)
    return { item, isNew: false, alreadyDrawnToday: true }
  }

  const rarity = rollRarity()
  const item = pickItemFromTier(rarity)
  const isNew = !ownsItem(userId, item.id)

  markDailyDraw(userId)
  if (isNew) {
    saveItem(userId, item.id)
  }

  return { item, isNew, alreadyDrawnToday: false }
}

/** Get all items a user has collected, sorted by rarity (legendary first). */
export function getCollection(userId: string): GachaItem[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT item_id FROM gacha_collection WHERE user_id = ? ORDER BY obtained_at ASC')
    .all(userId) as Array<{ item_id: string }>

  const itemMap = new Map(GACHA_ITEMS.map((item) => [item.id, item]))
  const rarityOrder: Record<GachaRarity, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 }

  return rows
    .map((row) => itemMap.get(row.item_id))
    .filter((item): item is GachaItem => item !== undefined)
    .sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity])
}

/** Get collection statistics for a user. */
export function getCollectionStats(userId: string): CollectionStats {
  const collection = getCollection(userId)
  const total = collection.length
  const totalItems = getTotalItemCount()

  const counts: Record<GachaRarity, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 }
  for (const item of collection) {
    counts[item.rarity]++
  }

  const pct = totalItems > 0 ? ((total / totalItems) * 100).toFixed(1) : '0.0'

  return {
    total,
    common: counts.common,
    uncommon: counts.uncommon,
    rare: counts.rare,
    legendary: counts.legendary,
    completion: `${total}/${totalItems} (${pct}%)`
  }
}

/** Reset a user's daily draw (for testing). */
export function resetDailyDraw(userId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM gacha_daily WHERE user_id = ?').run(userId)
}
