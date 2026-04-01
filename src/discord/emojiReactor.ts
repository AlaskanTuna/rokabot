import { config } from '../config.js'
import { logger } from '../utils/logger.js'

interface ReactionRule {
  patterns: RegExp[]
  emoji: string[]
  minMatches: number
}

const REACTION_RULES: ReactionRule[] = [
  // Compliments (highest priority — Roka appreciates being noticed)
  {
    patterns: [
      /\bcute\b/i,
      /\bpretty\b/i,
      /\bbeautiful\b/i,
      /\bbest girl\b/i,
      /\badorable\b/i,
      /\blovely\b/i,
      /\bgorgeous\b/i,
      /\bperfect\b/i,
      /\bflawless\b/i,
      /\bamazing\b/i,
      /\bwonderful\b/i,
      /\bkawaii\b/i
    ],
    emoji: ['💕', '💖', '💗'],
    minMatches: 1
  },
  // Greetings
  {
    patterns: [
      /\bgood morning\b/i,
      /\bohayo\b/i,
      /\bhi\b/i,
      /\bhello\b/i,
      /\bhi everyone\b/i,
      /\bkonnichiwa\b/i,
      /\btadaima\b/i,
      /\bgm\b/i
    ],
    emoji: ['👋'],
    minMatches: 1
  },
  // Goodnight
  {
    patterns: [
      /\bgoodnight\b/i,
      /\boyasumi\b/i,
      /\bgoing to sleep\b/i,
      /\bnighty night\b/i,
      /\bgood night\b/i,
      /\bgn\b/i
    ],
    emoji: ['🌙'],
    minMatches: 1
  },
  // Sadness
  {
    patterns: [
      /\b:broken_heart:\b/i,
      /\bsad\b/i,
      /\blonely\b/i,
      /\bcrying\b/i,
      /\bfeel bad\b/i,
      /\bdepressed\b/i,
      /\bhurting\b/i,
      /\btears\b/i,
      /\bsorrow\b/i,
      /\bunhappy\b/i
    ],
    emoji: ['🫂', '😢', '💔'],
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
    patterns: [
      /\banime\b/i,
      /\bmanga\b/i,
      /\botaku\b/i,
      /\bwaifu\b/i,
      /\bsensei\b/i,
      /\bsenpai\b/i,
      /\bkawaii\b/i,
      /\bciallo\b/i,
      /\bvn\b/i
    ],
    emoji: ['✨', '🌸', '💓'],
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
      /\bcongrats\b/i,
      /\bgg\b/i,
      /\bez\b/i
    ],
    emoji: ['🎉', '✨', '💯'],
    minMatches: 1
  },
  // Angry
  {
    patterns: [
      /\bangry\b/i,
      /\bfurious\b/i,
      /\bmad\b/i,
      /\bupset\b/i,
      /\bbruh\b/i,
      /\bpissed\b/i,
      /\bwtf\b/i,
      /\bsmh\b/i
    ],
    emoji: ['😠', '💢'],
    minMatches: 1
  }
]

const PROBABILITY = config.emoji.probability
const COOLDOWN_MS = config.emoji.cooldownMs

const cooldowns = new Map<string, number>()

/** Find the first reaction rule matching the given content */
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

/** Check if a message should receive a passive emoji reaction */
export function shouldReact(content: string, channelId: string): string | null {
  const lastReaction = cooldowns.get(channelId)
  if (lastReaction !== undefined && Date.now() - lastReaction < COOLDOWN_MS) {
    return null
  }

  const rule = findMatchingRule(content)
  if (!rule) return null

  if (Math.random() >= PROBABILITY) return null

  cooldowns.set(channelId, Date.now())

  const emoji = rule.emoji[Math.floor(Math.random() * rule.emoji.length)]

  logger.debug({ channelId, emoji, patternCount: rule.patterns.length }, 'Passive emoji reaction triggered')

  return emoji
}

/** Reset all cooldowns for testing */
export function resetCooldowns(): void {
  cooldowns.clear()
}
