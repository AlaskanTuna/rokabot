/**
 * Buddy pet system — deterministic companion generation from userId.
 * Each user gets exactly one buddy, determined by a Mulberry32 PRNG seeded from their userId hash.
 * Buddies are persistent via SQLite.
 */

import { getDb } from '../storage/database.js'
import {
  SPECIES,
  RARITY_WEIGHTS,
  RARITY_STAT_RANGE,
  EYE_STYLES,
  HAT_STYLES,
  STAT_NAMES,
  type BuddyRarity,
  type SpeciesInfo
} from './data/buddySpecies.js'

// ── PRNG ──

/** Mulberry32 — a fast, seedable 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash a string to a 32-bit integer seed. */
export function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return hash
}

// ── Data model ──

export interface BuddyData {
  userId: string
  species: string
  rarity: BuddyRarity
  shiny: boolean
  eyes: string
  hat: string
  name: string | null
  personality: string | null
  stats: Record<string, number>
  hatchedAt: number
}

// ── Name / personality generation ──

const NAME_PREFIXES = [
  'Luna',
  'Hoshi',
  'Yume',
  'Sora',
  'Hana',
  'Kaze',
  'Mizu',
  'Kumo',
  'Tsuki',
  'Niji',
  'Aki',
  'Fuyu',
  'Natsu',
  'Haru'
]
const NAME_SUFFIXES = ['maru', 'chan', 'ko', 'chi', 'mi', 'ta', 'ri', 'ne', 'ka', 'ra', 'no', 'zu']

function generateName(rng: () => number): string {
  const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)]
  const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)]
  return `${prefix}${suffix}`
}

/** Personality archetypes keyed by dominant stat. */
const PERSONALITY_TEMPLATES: Record<string, string[]> = {
  charm: [
    'Wins everyone over with a single glance and knows it~',
    'Could charm the stars right out of the sky~',
    'Has an irresistible aura that makes everyone smile~'
  ],
  wit: [
    'Always has a clever comeback ready before you finish talking~',
    'Sees through every trick and loves to explain why~',
    'The kind of companion who finishes your sentences (correctly)~'
  ],
  dere: [
    'Gets flustered easily but shows affection through small gifts~',
    'Secretly writes poetry about their favorite person~',
    'Pretends not to care but always remembers your birthday~'
  ],
  drama: [
    'Turns every moment into a dramatic scene worthy of a finale~',
    'Lives life like the protagonist of a VN with maximum intensity~',
    'Has a flair for the theatrical that makes everything exciting~'
  ],
  luck: [
    'Stumbles into good fortune like it is a daily routine~',
    'Has the kind of plot armor that would make any protagonist jealous~',
    "Everything just works out somehow, much to everyone else's disbelief~"
  ]
}

function generatePersonality(stats: Record<string, number>, speciesInfo: SpeciesInfo, rng: () => number): string {
  // Find the dominant stat
  let maxStat = ''
  let maxVal = -1
  for (const { key } of STAT_NAMES) {
    if (stats[key] > maxVal) {
      maxVal = stats[key]
      maxStat = key
    }
  }

  const templates = PERSONALITY_TEMPLATES[maxStat] ?? PERSONALITY_TEMPLATES.charm
  const template = templates[Math.floor(rng() * templates.length)]
  return `A ${speciesInfo.rarity} ${speciesInfo.name} who ${template.charAt(0).toLowerCase()}${template.slice(1)}`
}

// ── Deterministic buddy generation ──

/** Pick a rarity tier using the PRNG based on weighted distribution. */
function rollRarity(rng: () => number): BuddyRarity {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  const roll = rng() * totalWeight
  let cumulative = 0
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS) as [BuddyRarity, number][]) {
    cumulative += weight
    if (roll < cumulative) return rarity
  }
  return 'common'
}

/** Generate a fully deterministic buddy from a userId. */
export function generateBuddy(userId: string): BuddyData {
  const rng = mulberry32(hashString(userId))

  const rarity = rollRarity(rng)

  // Filter species by rarity, pick one
  const speciesPool = SPECIES.filter((s) => s.rarity === rarity)
  const speciesInfo = speciesPool[Math.floor(rng() * speciesPool.length)]

  // 1% shiny
  const shiny = rng() < 0.01

  // Cosmetics
  const eyes = EYE_STYLES[Math.floor(rng() * EYE_STYLES.length)]
  const hat = HAT_STYLES[Math.floor(rng() * HAT_STYLES.length)]

  // Stats — floor to max based on rarity
  const range = RARITY_STAT_RANGE[rarity]
  const stats: Record<string, number> = {}
  for (const { key } of STAT_NAMES) {
    stats[key] = range.floor + Math.floor(rng() * (range.max - range.floor + 1))
  }

  // Generate name and personality
  const name = generateName(rng)
  const personality = generatePersonality(stats, speciesInfo, rng)

  return {
    userId,
    species: speciesInfo.id,
    rarity,
    shiny,
    eyes,
    hat,
    name,
    personality,
    stats,
    hatchedAt: Date.now()
  }
}

// ── SQLite persistence ──

interface BuddyRow {
  user_id: string
  species: string
  rarity: string
  shiny: number
  eyes: string
  hat: string
  name: string | null
  personality: string | null
  stats_json: string
  hatched_at: number
}

/** Save a buddy to SQLite. */
export function saveBuddy(buddy: BuddyData): void {
  const db = getDb()
  db.prepare(
    `INSERT OR REPLACE INTO buddy (user_id, species, rarity, shiny, eyes, hat, name, personality, stats_json, hatched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    buddy.userId,
    buddy.species,
    buddy.rarity,
    buddy.shiny ? 1 : 0,
    buddy.eyes,
    buddy.hat,
    buddy.name,
    buddy.personality,
    JSON.stringify(buddy.stats),
    buddy.hatchedAt
  )
}

/** Load a buddy from SQLite, or null if not found. */
export function getBuddy(userId: string): BuddyData | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM buddy WHERE user_id = ?').get(userId) as BuddyRow | undefined
  if (!row) return null
  return {
    userId: row.user_id,
    species: row.species,
    rarity: row.rarity as BuddyRarity,
    shiny: row.shiny === 1,
    eyes: row.eyes,
    hat: row.hat,
    name: row.name,
    personality: row.personality,
    stats: JSON.parse(row.stats_json),
    hatchedAt: row.hatched_at
  }
}

/** Update a buddy's name and personality. */
export function updateBuddyName(userId: string, name: string, personality: string): void {
  const db = getDb()
  db.prepare('UPDATE buddy SET name = ?, personality = ? WHERE user_id = ?').run(name, personality, userId)
}

/** Get the top buddies by total stat sum, for leaderboard. */
export function getTopBuddies(limit: number = 10): BuddyData[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM buddy ORDER BY hatched_at ASC').all() as BuddyRow[]

  const buddies: BuddyData[] = rows.map((row) => ({
    userId: row.user_id,
    species: row.species,
    rarity: row.rarity as BuddyRarity,
    shiny: row.shiny === 1,
    eyes: row.eyes,
    hat: row.hat,
    name: row.name,
    personality: row.personality,
    stats: JSON.parse(row.stats_json),
    hatchedAt: row.hatched_at
  }))

  // Sort by total stat sum descending
  buddies.sort((a, b) => {
    const sumA = Object.values(a.stats).reduce((s, v) => s + v, 0)
    const sumB = Object.values(b.stats).reduce((s, v) => s + v, 0)
    return sumB - sumA
  })

  return buddies.slice(0, limit)
}

/** Look up SpeciesInfo by species id. */
export function getSpeciesInfo(speciesId: string): SpeciesInfo | undefined {
  return SPECIES.find((s) => s.id === speciesId)
}
