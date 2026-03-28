import { logger } from '../utils/logger.js'

interface ReactionRule {
  patterns: RegExp[]
  emoji: string[]
  minMatches: number
}

const REACTION_RULES: ReactionRule[] = [
  // Compliments (highest priority — Roka appreciates being noticed)
  {
    patterns: [/\bcute\b/i, /\bpretty\b/i, /\bbeautiful\b/i, /\bbest girl\b/i, /\badorable\b/i, /\blovely\b/i],
    emoji: ['💕'],
    minMatches: 1
  },
  // Greetings
  {
    patterns: [/\bgood morning\b/i, /\bohayo\b/i, /\bhello\b/i, /\bhi everyone\b/i, /\bkonnichiwa\b/i, /\btadaima\b/i],
    emoji: ['👋'],
    minMatches: 1
  },
  // Goodnight
  {
    patterns: [/\bgoodnight\b/i, /\boyasumi\b/i, /\bgoing to sleep\b/i, /\bnighty night\b/i, /\bgood night\b/i],
    emoji: ['🌙'],
    minMatches: 1
  },
  // Sadness
  {
    patterns: [/\bsad\b/i, /\blonely\b/i, /\bcrying\b/i, /\bfeel bad\b/i, /\bdepressed\b/i, /\bhurting\b/i],
    emoji: ['🫂'],
    minMatches: 1
  },
  // Food/cooking
  {
    patterns: [
      /\bcook\b/i,
      /\brecipe\b/i,
      /\bhungry\b/i,
      /\beat\b/i,
      /\bdelicious\b/i,
      /\bfood\b/i,
      /\bdinner\b/i,
      /\blunch\b/i,
      /\bbreakfast\b/i,
      /\byummy\b/i,
      /\boishii\b/i
    ],
    emoji: ['🍳', '🍵', '🍙'],
    minMatches: 1
  },
  // Anime/manga
  {
    patterns: [/\banime\b/i, /\bmanga\b/i, /\botaku\b/i, /\bwaifu\b/i, /\bsensei\b/i, /\bsenpai\b/i, /\bkawaii\b/i],
    emoji: ['✨', '🌸'],
    minMatches: 1
  },
  // Excitement/celebration
  {
    patterns: [
      /\blet'?s go\b/i,
      /\bwoohoo\b/i,
      /\bamazing\b/i,
      /\bawesome\b/i,
      /\bincredible\b/i,
      /\byay\b/i,
      /\bcongrats\b/i
    ],
    emoji: ['🎉', '✨'],
    minMatches: 1
  }
]

const PROBABILITY = 0.18
const COOLDOWN_MS = 60_000

const cooldowns = new Map<string, number>()

/**
 * Find the first reaction rule that matches the given content.
 * Returns the matched rule or null if none match.
 */
function findMatchingRule(content: string): ReactionRule | null {
  for (const rule of REACTION_RULES) {
    let matchCount = 0
    for (const pattern of rule.patterns) {
      if (pattern.test(content)) {
        matchCount++
        if (matchCount >= rule.minMatches) break
      }
    }
    if (matchCount >= rule.minMatches) {
      return rule
    }
  }
  return null
}

/**
 * Check if a message should receive a passive emoji reaction from Roka.
 * Returns the emoji to react with, or null if no reaction.
 */
export function shouldReact(content: string, channelId: string): string | null {
  // Check cooldown
  const lastReaction = cooldowns.get(channelId)
  if (lastReaction !== undefined && Date.now() - lastReaction < COOLDOWN_MS) {
    return null
  }

  // Find matching rule
  const rule = findMatchingRule(content)
  if (!rule) return null

  // Probability gate
  if (Math.random() >= PROBABILITY) return null

  // Update cooldown
  cooldowns.set(channelId, Date.now())

  // Pick random emoji from pool
  const emoji = rule.emoji[Math.floor(Math.random() * rule.emoji.length)]

  logger.debug({ channelId, emoji, patternCount: rule.patterns.length }, 'Passive emoji reaction triggered')

  return emoji
}

/** Reset all cooldowns. Exported for testing purposes. */
export function resetCooldowns(): void {
  cooldowns.clear()
}
