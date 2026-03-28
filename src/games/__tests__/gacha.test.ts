import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('../../config.js', () => ({
  config: {
    logging: { level: 'silent' },
    timezone: 'UTC'
  }
}))

let testDb: Database.Database

vi.mock('../../storage/database.js', () => ({
  getDb: () => testDb
}))

import { drawItem, getCollection, getCollectionStats, resetDailyDraw, rollRarity } from '../gacha.js'
import { GACHA_ITEMS, getItemsByRarity, getTotalItemCount } from '../data/gachaItems.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE IF NOT EXISTS gacha_collection (
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      obtained_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS gacha_daily (
      user_id TEXT NOT NULL,
      last_draw_date TEXT NOT NULL,
      PRIMARY KEY (user_id)
    );
  `)
  return db
}

describe('gacha', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  describe('item catalog', () => {
    it('has the expected number of items', () => {
      expect(GACHA_ITEMS.length).toBeGreaterThanOrEqual(40)
    })

    it('all items have required fields', () => {
      for (const item of GACHA_ITEMS) {
        expect(item.id).toBeTruthy()
        expect(item.name).toBeTruthy()
        expect(item.rarity).toMatch(/^(common|uncommon|rare|legendary)$/)
        expect(item.description).toBeTruthy()
      }
    })

    it('all item ids are unique', () => {
      const ids = GACHA_ITEMS.map((item) => item.id)
      const unique = new Set(ids)
      expect(unique.size).toBe(ids.length)
    })

    it('has items in each rarity tier', () => {
      expect(getItemsByRarity('common').length).toBeGreaterThan(0)
      expect(getItemsByRarity('uncommon').length).toBeGreaterThan(0)
      expect(getItemsByRarity('rare').length).toBeGreaterThan(0)
      expect(getItemsByRarity('legendary').length).toBeGreaterThan(0)
    })

    it('has the expected distribution across rarity tiers', () => {
      expect(getItemsByRarity('common').length).toBeGreaterThanOrEqual(20)
      expect(getItemsByRarity('uncommon').length).toBeGreaterThanOrEqual(10)
      expect(getItemsByRarity('rare').length).toBeGreaterThanOrEqual(5)
      expect(getItemsByRarity('legendary').length).toBeGreaterThanOrEqual(3)
    })

    it('getTotalItemCount returns the correct count', () => {
      expect(getTotalItemCount()).toBe(GACHA_ITEMS.length)
    })
  })

  describe('rollRarity', () => {
    it('returns a valid rarity', () => {
      for (let i = 0; i < 100; i++) {
        const rarity = rollRarity()
        expect(['common', 'uncommon', 'rare', 'legendary']).toContain(rarity)
      }
    })

    it('returns common when Math.random returns 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(rollRarity()).toBe('common')
      vi.restoreAllMocks()
    })

    it('returns common for low random values', () => {
      // common weight is 60 out of 100 total, so 0.3 * 100 = 30 < 60
      vi.spyOn(Math, 'random').mockReturnValue(0.3)
      expect(rollRarity()).toBe('common')
      vi.restoreAllMocks()
    })

    it('returns uncommon for mid-range random values', () => {
      // common=60, uncommon=25, so 0.65 * 100 = 65 which is >= 60 and < 85
      vi.spyOn(Math, 'random').mockReturnValue(0.65)
      expect(rollRarity()).toBe('uncommon')
      vi.restoreAllMocks()
    })

    it('returns rare for higher random values', () => {
      // common=60, uncommon=25, rare=12, so 0.88 * 100 = 88 which is >= 85 and < 97
      vi.spyOn(Math, 'random').mockReturnValue(0.88)
      expect(rollRarity()).toBe('rare')
      vi.restoreAllMocks()
    })

    it('returns legendary for the highest random values', () => {
      // common=60, uncommon=25, rare=12, legendary=3, so 0.99 * 100 = 99 which is >= 97
      vi.spyOn(Math, 'random').mockReturnValue(0.99)
      expect(rollRarity()).toBe('legendary')
      vi.restoreAllMocks()
    })
  })

  describe('drawItem', () => {
    it('returns a valid draw result', () => {
      const result = drawItem('user-1')
      expect(result.item).toBeDefined()
      expect(result.item.id).toBeTruthy()
      expect(result.item.name).toBeTruthy()
      expect(typeof result.isNew).toBe('boolean')
      expect(result.alreadyDrawnToday).toBe(false)
    })

    it('marks first draw as new', () => {
      const result = drawItem('user-1')
      expect(result.isNew).toBe(true)
      expect(result.alreadyDrawnToday).toBe(false)
    })

    it('saves new item to collection', () => {
      const result = drawItem('user-1')
      const rows = testDb.prepare('SELECT * FROM gacha_collection WHERE user_id = ?').all('user-1')
      expect(rows).toHaveLength(1)
      expect((rows[0] as { item_id: string }).item_id).toBe(result.item.id)
    })

    it('enforces daily draw limit', () => {
      drawItem('user-1')
      const second = drawItem('user-1')
      expect(second.alreadyDrawnToday).toBe(true)
    })

    it('does not save item to collection on duplicate draw day', () => {
      drawItem('user-1')
      const firstCollectionSize = testDb
        .prepare('SELECT COUNT(*) as count FROM gacha_collection WHERE user_id = ?')
        .get('user-1') as { count: number }

      // Second draw same day — should not add to collection
      drawItem('user-1')
      const secondCollectionSize = testDb
        .prepare('SELECT COUNT(*) as count FROM gacha_collection WHERE user_id = ?')
        .get('user-1') as { count: number }

      expect(secondCollectionSize.count).toBe(firstCollectionSize.count)
    })

    it('tracks daily draw per user independently', () => {
      drawItem('user-1')
      const result = drawItem('user-2')
      expect(result.alreadyDrawnToday).toBe(false)
    })

    it('returns isNew=false for duplicate item', () => {
      // Force the same item by mocking Math.random
      vi.spyOn(Math, 'random').mockReturnValue(0)
      drawItem('user-1')
      vi.restoreAllMocks()

      // Reset daily draw so we can draw again
      resetDailyDraw('user-1')

      // Force same item again
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const result = drawItem('user-1')
      vi.restoreAllMocks()

      expect(result.isNew).toBe(false)
      expect(result.alreadyDrawnToday).toBe(false)
    })
  })

  describe('getCollection', () => {
    it('returns empty array for user with no collection', () => {
      const collection = getCollection('nonexistent')
      expect(collection).toEqual([])
    })

    it('returns collected items', () => {
      drawItem('user-1')
      const collection = getCollection('user-1')
      expect(collection.length).toBeGreaterThan(0)
    })

    it('sorts items by rarity (legendary first)', () => {
      // Manually insert items of different rarities
      const now = Date.now()
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'fortune_lucky', now)
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'legend_first_meeting', now + 1)
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'recipe_secret_dango', now + 2)

      const collection = getCollection('user-1')
      expect(collection[0].rarity).toBe('legendary')
      expect(collection[1].rarity).toBe('rare')
      expect(collection[2].rarity).toBe('common')
    })

    it('only returns items for the requested user', () => {
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'fortune_lucky', Date.now())
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-2', 'legend_first_meeting', Date.now())

      const collection = getCollection('user-1')
      expect(collection).toHaveLength(1)
      expect(collection[0].id).toBe('fortune_lucky')
    })
  })

  describe('getCollectionStats', () => {
    it('returns zero stats for empty collection', () => {
      const stats = getCollectionStats('nonexistent')
      expect(stats.total).toBe(0)
      expect(stats.common).toBe(0)
      expect(stats.uncommon).toBe(0)
      expect(stats.rare).toBe(0)
      expect(stats.legendary).toBe(0)
      expect(stats.completion).toContain('0/')
    })

    it('counts items by rarity', () => {
      const now = Date.now()
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'fortune_lucky', now)
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'fortune_cloudy', now + 1)
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'trivia_hoori', now + 2)
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'legend_first_meeting', now + 3)

      const stats = getCollectionStats('user-1')
      expect(stats.total).toBe(4)
      expect(stats.common).toBe(2)
      expect(stats.uncommon).toBe(1)
      expect(stats.legendary).toBe(1)
    })

    it('calculates completion percentage', () => {
      const totalItems = getTotalItemCount()
      testDb
        .prepare('INSERT INTO gacha_collection (user_id, item_id, obtained_at) VALUES (?, ?, ?)')
        .run('user-1', 'fortune_lucky', Date.now())

      const stats = getCollectionStats('user-1')
      const expectedPct = ((1 / totalItems) * 100).toFixed(1)
      expect(stats.completion).toBe(`1/${totalItems} (${expectedPct}%)`)
    })
  })

  describe('resetDailyDraw', () => {
    it('allows user to draw again after reset', () => {
      drawItem('user-1')
      const blocked = drawItem('user-1')
      expect(blocked.alreadyDrawnToday).toBe(true)

      resetDailyDraw('user-1')
      const afterReset = drawItem('user-1')
      expect(afterReset.alreadyDrawnToday).toBe(false)
    })

    it('does not affect other users', () => {
      drawItem('user-1')
      drawItem('user-2')

      resetDailyDraw('user-1')

      const user2 = drawItem('user-2')
      expect(user2.alreadyDrawnToday).toBe(true)
    })
  })
})
