/**
 * Integration tests for the new agent tools (remember_user, recall_user, set_reminder).
 * These test the tool functions end-to-end through the storage layer with an in-memory SQLite DB.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('../../config.js', () => ({
  config: {
    logging: { level: 'silent' },
    rateLimit: { rpm: 15, rpd: 500 },
    session: { ttlMs: 300_000, windowSize: 10 },
    timezone: 'UTC'
  }
}))

let testDb: Database.Database

vi.mock('../../storage/database.js', () => ({
  getDb: () => testDb
}))

import { rememberUser } from '../tools/rememberUser.js'
import { recallUser } from '../tools/recallUser.js'
import { setReminder } from '../tools/setReminder.js'
import { countActiveReminders, getDueReminders, markDelivered } from '../../storage/reminderStore.js'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE user_memory (
      user_id TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, fact_key)
    );
    CREATE TABLE reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      reminder TEXT NOT NULL,
      due_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      delivered INTEGER DEFAULT 0
    );
    CREATE INDEX idx_reminders_due ON reminders (delivered, due_at);
  `)
  return db
}

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb.close()
})

describe('remember_user + recall_user integration', () => {
  it('stores a fact and recalls it', () => {
    const storeResult = rememberUser({
      user_id: 'Alice',
      fact_key: 'favorite_anime',
      fact_value: 'Frieren'
    })
    expect(storeResult.success).toBe(true)
    expect(storeResult.totalFacts).toBe(1)

    const recallResult = recallUser({ user_id: 'Alice' })
    expect(recallResult.factCount).toBe(1)
    expect(recallResult.facts).toContain('favorite_anime')
    expect(recallResult.facts).toContain('Frieren')
  })

  it('returns empty state when no facts exist', () => {
    const result = recallUser({ user_id: 'Nobody' })
    expect(result.factCount).toBe(0)
    expect(result.facts).toContain("don't have any notes")
  })

  it('stores multiple facts for the same user', () => {
    rememberUser({ user_id: 'Bob', fact_key: 'nickname', fact_value: 'Bobby' })
    rememberUser({ user_id: 'Bob', fact_key: 'birthday', fact_value: 'March 15' })
    rememberUser({ user_id: 'Bob', fact_key: 'hobby', fact_value: 'cooking' })

    const result = recallUser({ user_id: 'Bob' })
    expect(result.factCount).toBe(3)
    expect(result.facts).toContain('nickname')
    expect(result.facts).toContain('birthday')
    expect(result.facts).toContain('hobby')
  })

  it('upserts existing fact key with new value', () => {
    rememberUser({ user_id: 'Alice', fact_key: 'favorite_anime', fact_value: 'Frieren' })
    rememberUser({ user_id: 'Alice', fact_key: 'favorite_anime', fact_value: 'Bocchi the Rock' })

    const result = recallUser({ user_id: 'Alice' })
    expect(result.factCount).toBe(1)
    expect(result.facts).toContain('Bocchi the Rock')
    expect(result.facts).not.toContain('Frieren')
  })

  it('isolates facts between users', () => {
    rememberUser({ user_id: 'Alice', fact_key: 'color', fact_value: 'blue' })
    rememberUser({ user_id: 'Bob', fact_key: 'color', fact_value: 'red' })

    const aliceResult = recallUser({ user_id: 'Alice' })
    expect(aliceResult.facts).toContain('blue')
    expect(aliceResult.facts).not.toContain('red')

    const bobResult = recallUser({ user_id: 'Bob' })
    expect(bobResult.facts).toContain('red')
    expect(bobResult.facts).not.toContain('blue')
  })

  it('evicts oldest fact when capacity (10) is exceeded', () => {
    // Fill up to 10 facts
    for (let i = 1; i <= 10; i++) {
      rememberUser({ user_id: 'Alice', fact_key: `fact_${i}`, fact_value: `value_${i}` })
    }

    const beforeResult = recallUser({ user_id: 'Alice' })
    expect(beforeResult.factCount).toBe(10)

    // Add an 11th fact — should evict fact_1 (oldest)
    rememberUser({ user_id: 'Alice', fact_key: 'fact_11', fact_value: 'value_11' })

    const afterResult = recallUser({ user_id: 'Alice' })
    expect(afterResult.factCount).toBe(10)
    expect(afterResult.facts).toContain('fact_11')
    expect(afterResult.facts).not.toContain('fact_1: value_1')
  })
})

describe('set_reminder integration', () => {
  it('creates a reminder successfully', () => {
    const result = setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'buy milk',
      delay_minutes: 30
    })
    expect(result.success).toBe(true)
    expect(result.reminderId).toBeGreaterThan(0)
    expect(countActiveReminders('Alice')).toBe(1)
  })

  it('rejects delay below 1 minute', () => {
    const result = setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'now!',
      delay_minutes: 0
    })
    expect(result.success).toBe(false)
    expect(result.message).toContain('1 minute')
  })

  it('rejects delay above 7 days', () => {
    const result = setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'far future',
      delay_minutes: 10081
    })
    expect(result.success).toBe(false)
    expect(result.message).toContain('7 days')
  })

  it('enforces 5-reminder cap per user', () => {
    for (let i = 1; i <= 5; i++) {
      const result = setReminder({
        user_id: 'Alice',
        channel_id: 'ch-1',
        reminder: `reminder ${i}`,
        delay_minutes: 60
      })
      expect(result.success).toBe(true)
    }

    const sixth = setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'one too many',
      delay_minutes: 60
    })
    expect(sixth.success).toBe(false)
    expect(sixth.message).toContain('5 active reminders')
  })

  it('allows new reminder after previous one is delivered', () => {
    // Fill to capacity
    const ids: number[] = []
    for (let i = 1; i <= 5; i++) {
      const result = setReminder({
        user_id: 'Alice',
        channel_id: 'ch-1',
        reminder: `reminder ${i}`,
        delay_minutes: 60
      })
      ids.push(result.reminderId!)
    }

    // Deliver one
    markDelivered(ids[0])

    // Now should be able to set another
    const result = setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'replacement reminder',
      delay_minutes: 60
    })
    expect(result.success).toBe(true)
  })

  it('reminder becomes due after delay passes', () => {
    // Set reminder with 1 minute delay — due_at = now + 60_000
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'check oven',
      delay_minutes: 1
    })

    // Not due yet
    let due = getDueReminders()
    expect(due.length).toBe(0)

    // Advance time past due
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    due = getDueReminders()
    expect(due.length).toBe(1)
    expect(due[0].reminder).toBe('check oven')
    expect(due[0].userId).toBe('Alice')
    expect(due[0].channelId).toBe('ch-1')

    vi.restoreAllMocks()
  })

  it('different users have independent reminder caps', () => {
    for (let i = 1; i <= 5; i++) {
      setReminder({ user_id: 'Alice', channel_id: 'ch-1', reminder: `a${i}`, delay_minutes: 60 })
    }

    // Alice is full, but Bob should still work
    const bobResult = setReminder({
      user_id: 'Bob',
      channel_id: 'ch-1',
      reminder: 'bob reminder',
      delay_minutes: 60
    })
    expect(bobResult.success).toBe(true)
  })
})

describe('cross-feature: remember + reminder for same user', () => {
  it('both systems work independently for the same user', () => {
    // Store a fact
    rememberUser({ user_id: 'Alice', fact_key: 'timezone', fact_value: 'JST' })

    // Set a reminder
    const reminderResult = setReminder({
      user_id: 'Alice',
      channel_id: 'ch-1',
      reminder: 'check meeting notes',
      delay_minutes: 5
    })

    // Verify both
    const facts = recallUser({ user_id: 'Alice' })
    expect(facts.factCount).toBe(1)
    expect(facts.facts).toContain('timezone')

    expect(reminderResult.success).toBe(true)
    expect(countActiveReminders('Alice')).toBe(1)
  })
})
