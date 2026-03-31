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

import { mulberry32, hashString, generateBuddy, saveBuddy, getBuddy, getTopBuddies } from '../buddy.js'
import { SPECIES, STAT_NAMES, RARITY_STAT_RANGE, type BuddyRarity } from '../data/buddySpecies.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE IF NOT EXISTS buddy (
      user_id TEXT PRIMARY KEY,
      species TEXT NOT NULL,
      rarity TEXT NOT NULL,
      shiny INTEGER NOT NULL DEFAULT 0,
      eyes TEXT NOT NULL,
      hat TEXT NOT NULL,
      name TEXT,
      personality TEXT,
      stats_json TEXT NOT NULL,
      hatched_at INTEGER NOT NULL
    );
  `)
  return db
}

describe('buddy pet system', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  afterEach(() => {
    testDb.close()
  })

  describe('mulberry32 PRNG', () => {
    it('produces deterministic output for the same seed', () => {
      const rng1 = mulberry32(12345)
      const rng2 = mulberry32(12345)

      const seq1 = Array.from({ length: 10 }, () => rng1())
      const seq2 = Array.from({ length: 10 }, () => rng2())

      expect(seq1).toEqual(seq2)
    })

    it('produces values between 0 and 1', () => {
      const rng = mulberry32(42)
      for (let i = 0; i < 1000; i++) {
        const val = rng()
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(1)
      }
    })

    it('produces different sequences for different seeds', () => {
      const rng1 = mulberry32(111)
      const rng2 = mulberry32(222)

      const seq1 = Array.from({ length: 5 }, () => rng1())
      const seq2 = Array.from({ length: 5 }, () => rng2())

      expect(seq1).not.toEqual(seq2)
    })
  })

  describe('hashString', () => {
    it('returns a consistent hash for the same input', () => {
      expect(hashString('test-user-123')).toBe(hashString('test-user-123'))
    })

    it('returns different hashes for different inputs', () => {
      expect(hashString('user-a')).not.toBe(hashString('user-b'))
    })
  })

  describe('generateBuddy', () => {
    it('returns a valid buddy for a given userId', () => {
      const buddy = generateBuddy('user-123')

      expect(buddy.userId).toBe('user-123')
      expect(buddy.species).toBeTruthy()
      expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(buddy.rarity)
      expect(typeof buddy.shiny).toBe('boolean')
      expect(buddy.eyes).toBeTruthy()
      expect(buddy.hat).toBeTruthy()
      expect(buddy.name).toBeTruthy()
      expect(buddy.personality).toBeTruthy()
      expect(Object.keys(buddy.stats)).toHaveLength(5)
      expect(buddy.hatchedAt).toBeGreaterThan(0)
    })

    it('generates the same buddy for the same userId', () => {
      const buddy1 = generateBuddy('deterministic-user')
      const buddy2 = generateBuddy('deterministic-user')

      expect(buddy1.species).toBe(buddy2.species)
      expect(buddy1.rarity).toBe(buddy2.rarity)
      expect(buddy1.shiny).toBe(buddy2.shiny)
      expect(buddy1.eyes).toBe(buddy2.eyes)
      expect(buddy1.hat).toBe(buddy2.hat)
      expect(buddy1.name).toBe(buddy2.name)
      expect(buddy1.stats).toEqual(buddy2.stats)
    })

    it('generates different buddies for different userIds', () => {
      const buddy1 = generateBuddy('user-aaa')
      const buddy2 = generateBuddy('user-zzz')

      // At least one attribute should differ (statistically near-certain)
      const same =
        buddy1.species === buddy2.species &&
        buddy1.rarity === buddy2.rarity &&
        buddy1.eyes === buddy2.eyes &&
        buddy1.hat === buddy2.hat &&
        buddy1.name === buddy2.name
      expect(same).toBe(false)
    })

    it('assigns a species that matches the rolled rarity', () => {
      // Test with many users to cover different rarities
      for (let i = 0; i < 50; i++) {
        const buddy = generateBuddy(`rarity-check-${i}`)
        const speciesInfo = SPECIES.find((s) => s.id === buddy.species)
        expect(speciesInfo).toBeDefined()
        expect(speciesInfo!.rarity).toBe(buddy.rarity)
      }
    })

    it('generates stats within rarity floor/ceiling bounds', () => {
      for (let i = 0; i < 50; i++) {
        const buddy = generateBuddy(`stat-check-${i}`)
        const range = RARITY_STAT_RANGE[buddy.rarity]
        for (const { key } of STAT_NAMES) {
          const val = buddy.stats[key]
          expect(val).toBeGreaterThanOrEqual(range.floor)
          expect(val).toBeLessThanOrEqual(range.max)
        }
      }
    })

    it('produces all 5 stats', () => {
      const buddy = generateBuddy('stat-keys')
      const expectedKeys = ['charm', 'wit', 'dere', 'drama', 'luck']
      for (const key of expectedKeys) {
        expect(buddy.stats[key]).toBeDefined()
        expect(typeof buddy.stats[key]).toBe('number')
      }
    })
  })

  describe('shiny probability', () => {
    it('approximately 1% of buddies are shiny (statistical)', () => {
      let shinyCount = 0
      const total = 10000
      for (let i = 0; i < total; i++) {
        const buddy = generateBuddy(`shiny-test-${i}`)
        if (buddy.shiny) shinyCount++
      }
      // Expect between 0.2% and 3% (generous bounds for randomness)
      const rate = shinyCount / total
      expect(rate).toBeGreaterThan(0.002)
      expect(rate).toBeLessThan(0.03)
    })
  })

  describe('saveBuddy / getBuddy', () => {
    it('round-trips a buddy correctly', () => {
      const buddy = generateBuddy('roundtrip-user')
      saveBuddy(buddy)

      const loaded = getBuddy('roundtrip-user')
      expect(loaded).not.toBeNull()
      expect(loaded!.userId).toBe(buddy.userId)
      expect(loaded!.species).toBe(buddy.species)
      expect(loaded!.rarity).toBe(buddy.rarity)
      expect(loaded!.shiny).toBe(buddy.shiny)
      expect(loaded!.eyes).toBe(buddy.eyes)
      expect(loaded!.hat).toBe(buddy.hat)
      expect(loaded!.name).toBe(buddy.name)
      expect(loaded!.personality).toBe(buddy.personality)
      expect(loaded!.stats).toEqual(buddy.stats)
      expect(loaded!.hatchedAt).toBe(buddy.hatchedAt)
    })

    it('returns null for non-existent user', () => {
      const loaded = getBuddy('nonexistent')
      expect(loaded).toBeNull()
    })

    it('overwrites on re-save', () => {
      const buddy = generateBuddy('overwrite-user')
      saveBuddy(buddy)

      const modified = { ...buddy, name: 'NewName' }
      saveBuddy(modified)

      const loaded = getBuddy('overwrite-user')
      expect(loaded!.name).toBe('NewName')
    })
  })

  describe('getTopBuddies', () => {
    it('returns empty array when no buddies exist', () => {
      const top = getTopBuddies(10)
      expect(top).toEqual([])
    })

    it('returns buddies sorted by total stats descending', () => {
      // Create buddies with known stats
      const buddy1 = generateBuddy('leader-1')
      buddy1.stats = { charm: 10, wit: 10, dere: 10, drama: 10, luck: 10 }
      saveBuddy(buddy1)

      const buddy2 = generateBuddy('leader-2')
      buddy2.stats = { charm: 1, wit: 1, dere: 1, drama: 1, luck: 1 }
      saveBuddy(buddy2)

      const top = getTopBuddies(10)
      expect(top).toHaveLength(2)
      expect(top[0].userId).toBe('leader-1')
      expect(top[1].userId).toBe('leader-2')
    })

    it('respects the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        const buddy = generateBuddy(`limit-test-${i}`)
        saveBuddy(buddy)
      }
      const top = getTopBuddies(3)
      expect(top).toHaveLength(3)
    })
  })

  describe('species catalog', () => {
    it('has exactly 18 species', () => {
      expect(SPECIES).toHaveLength(18)
    })

    it('all species have unique ids', () => {
      const ids = SPECIES.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('has the expected distribution across rarity tiers', () => {
      const counts: Record<BuddyRarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
      for (const s of SPECIES) counts[s.rarity]++

      expect(counts.common).toBe(7)
      expect(counts.uncommon).toBe(4)
      expect(counts.rare).toBe(3)
      expect(counts.epic).toBe(2)
      expect(counts.legendary).toBe(2)
    })

    it('all species have required fields', () => {
      for (const s of SPECIES) {
        expect(s.id).toBeTruthy()
        expect(s.name).toBeTruthy()
        expect(s.emoji).toBeTruthy()
        expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(s.rarity)
        expect(s.description).toBeTruthy()
      }
    })
  })
})
