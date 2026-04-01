import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('../../config.js', () => ({
  config: {
    logging: { level: 'silent' },
    memory: {
      bufferSize: 20,
      extractionInterval: 20,
      extractionGapMs: 10_000,
      maxFactsPerUser: 10,
      factRetentionDays: 90,
      channelMonitorTtlMs: 86_400_000
    }
  }
}))

// Use an in-memory SQLite database for tests
let testDb: Database.Database

vi.mock('../database.js', () => ({
  getDb: () => testDb
}))

import { saveFact, getFacts, deleteFact, getAllFactsForPrompt, countFacts } from '../userMemory.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_memory (
      user_id TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, fact_key)
    );
  `)
  return db
}

describe('userMemory', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  describe('saveFact', () => {
    it('inserts a new fact', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')

      const rows = testDb.prepare('SELECT * FROM user_memory WHERE user_id = ?').all('Alice') as Array<{
        user_id: string
        fact_key: string
        fact_value: string
        updated_at: number
      }>
      expect(rows).toHaveLength(1)
      expect(rows[0].fact_key).toBe('favorite_anime')
      expect(rows[0].fact_value).toBe('Frieren')
      expect(rows[0].updated_at).toBeGreaterThan(0)
    })

    it('upserts an existing fact (same key updates value)', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')
      saveFact('Alice', 'favorite_anime', 'Steins;Gate')

      const rows = testDb.prepare('SELECT * FROM user_memory WHERE user_id = ?').all('Alice') as Array<{
        fact_key: string
        fact_value: string
      }>
      expect(rows).toHaveLength(1)
      expect(rows[0].fact_value).toBe('Steins;Gate')
    })

    it('stores multiple facts for the same user', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')
      saveFact('Alice', 'nickname', 'Ali')
      saveFact('Alice', 'hobby', 'cooking')

      expect(countFacts('Alice')).toBe(3)
    })

    it('keeps facts from different users separate', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')
      saveFact('Bob', 'favorite_anime', 'One Piece')

      expect(countFacts('Alice')).toBe(1)
      expect(countFacts('Bob')).toBe(1)
    })
  })

  describe('getFacts', () => {
    it('returns empty array for unknown user', () => {
      const facts = getFacts('nobody')
      expect(facts).toEqual([])
    })

    it('returns all facts for a user', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')
      saveFact('Alice', 'nickname', 'Ali')

      const facts = getFacts('Alice')
      expect(facts).toHaveLength(2)
      expect(facts.map((f) => f.key)).toContain('favorite_anime')
      expect(facts.map((f) => f.key)).toContain('nickname')
    })

    it('returns facts ordered by most recently updated first', () => {
      // Insert with explicit timestamps to control ordering
      testDb
        .prepare('INSERT INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)')
        .run('Alice', 'oldest', 'val1', 1000)
      testDb
        .prepare('INSERT INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)')
        .run('Alice', 'newest', 'val2', 3000)
      testDb
        .prepare('INSERT INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)')
        .run('Alice', 'middle', 'val3', 2000)

      const facts = getFacts('Alice')
      expect(facts[0].key).toBe('newest')
      expect(facts[1].key).toBe('middle')
      expect(facts[2].key).toBe('oldest')
    })
  })

  describe('deleteFact', () => {
    it('removes a specific fact', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')
      saveFact('Alice', 'nickname', 'Ali')

      deleteFact('Alice', 'favorite_anime')

      const facts = getFacts('Alice')
      expect(facts).toHaveLength(1)
      expect(facts[0].key).toBe('nickname')
    })

    it('does nothing when deleting a non-existent fact', () => {
      expect(() => deleteFact('Alice', 'nonexistent')).not.toThrow()
    })

    it('does not affect other users', () => {
      saveFact('Alice', 'hobby', 'cooking')
      saveFact('Bob', 'hobby', 'gaming')

      deleteFact('Alice', 'hobby')

      expect(getFacts('Alice')).toHaveLength(0)
      expect(getFacts('Bob')).toHaveLength(1)
    })
  })

  describe('getAllFactsForPrompt', () => {
    it('returns empty string for unknown user', () => {
      expect(getAllFactsForPrompt('nobody')).toBe('')
    })

    it('returns formatted string of facts', () => {
      saveFact('Alice', 'favorite_anime', 'Frieren')
      saveFact('Alice', 'nickname', 'Ali')

      const result = getAllFactsForPrompt('Alice')
      expect(result).toContain('favorite_anime: Frieren')
      expect(result).toContain('nickname: Ali')
      expect(result).toContain(', ')
    })

    it('returns single fact without comma separator', () => {
      saveFact('Alice', 'hobby', 'cooking')

      const result = getAllFactsForPrompt('Alice')
      expect(result).toBe('hobby: cooking')
      expect(result).not.toContain(', ')
    })
  })

  describe('countFacts', () => {
    it('returns 0 for unknown user', () => {
      expect(countFacts('nobody')).toBe(0)
    })

    it('returns correct count', () => {
      saveFact('Alice', 'a', '1')
      saveFact('Alice', 'b', '2')
      saveFact('Alice', 'c', '3')

      expect(countFacts('Alice')).toBe(3)
    })
  })

  describe('10-fact cap', () => {
    it('evicts the oldest fact when saving the 11th', () => {
      // Insert 10 facts with explicit timestamps
      for (let i = 1; i <= 10; i++) {
        testDb
          .prepare('INSERT INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)')
          .run('Alice', `fact_${i}`, `value_${i}`, i * 1000)
      }

      expect(countFacts('Alice')).toBe(10)

      // Save an 11th fact — should evict fact_1 (oldest by updated_at)
      saveFact('Alice', 'fact_11', 'value_11')

      expect(countFacts('Alice')).toBe(10)

      // fact_1 should be gone
      const facts = getFacts('Alice')
      const keys = facts.map((f) => f.key)
      expect(keys).not.toContain('fact_1')
      expect(keys).toContain('fact_11')
      expect(keys).toContain('fact_2')
    })

    it('does not evict when updating an existing fact at the cap', () => {
      for (let i = 1; i <= 10; i++) {
        testDb
          .prepare('INSERT INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)')
          .run('Alice', `fact_${i}`, `value_${i}`, i * 1000)
      }

      // Update an existing fact — should not evict anything
      saveFact('Alice', 'fact_5', 'updated_value')

      expect(countFacts('Alice')).toBe(10)

      const facts = getFacts('Alice')
      const keys = facts.map((f) => f.key)
      expect(keys).toContain('fact_1')
      expect(keys).toContain('fact_5')

      const fact5 = facts.find((f) => f.key === 'fact_5')
      expect(fact5?.value).toBe('updated_value')
    })

    it('evicts correctly across multiple insertions beyond the cap', () => {
      for (let i = 1; i <= 10; i++) {
        testDb
          .prepare('INSERT INTO user_memory (user_id, fact_key, fact_value, updated_at) VALUES (?, ?, ?, ?)')
          .run('Alice', `fact_${i}`, `value_${i}`, i * 1000)
      }

      // Save 2 more facts — should evict fact_1 and fact_2
      saveFact('Alice', 'fact_11', 'value_11')
      saveFact('Alice', 'fact_12', 'value_12')

      expect(countFacts('Alice')).toBe(10)

      const facts = getFacts('Alice')
      const keys = facts.map((f) => f.key)
      expect(keys).not.toContain('fact_1')
      expect(keys).not.toContain('fact_2')
      expect(keys).toContain('fact_11')
      expect(keys).toContain('fact_12')
    })
  })
})
