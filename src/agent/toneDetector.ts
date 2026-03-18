import type { ToneKey } from './prompts/tones.js'
import type { WindowMessage } from '../session/types.js'

/**
 * Rule-based tone detection. Scans recent messages for keyword patterns
 * to select the appropriate Layer 2 prompt variant.
 * Zero LLM cost — purely pattern matching.
 */

const TONE_PATTERNS: { tone: ToneKey; patterns: RegExp[] }[] = [
  {
    tone: 'flustered',
    patterns: [
      /\blove\b/i,
      /\bcrush\b/i,
      /\bdate\b/i,
      /\bkiss\b/i,
      /\bcute\b/i,
      /\bhandsome\b/i,
      /\bpretty\b/i,
      /\bbeautiful\b/i,
      /\bheart\b/i,
      /\bblush\b/i,
      /\bflirt/i,
      /\bromantic/i,
      /\bmarry/i,
      /\bgirlfriend\b/i,
      /\bboyfriend\b/i,
      /\bconfess/i,
      /\bwife\b/i,
      /\bhusband\b/i,
      /❤|💕|💗|😘|😍|🥰/
    ]
  },
  {
    tone: 'sincere',
    patterns: [
      /\bsad\b/i,
      /\blonely\b/i,
      /\btired\b/i,
      /\bstress/i,
      /\banxious/i,
      /\bworried/i,
      /\bscared/i,
      /\bthank/i,
      /\bgrateful/i,
      /\bmiss you/i,
      /\bsorry\b/i,
      /\bhurt\b/i,
      /\bcrying\b/i,
      /\bdepressed/i,
      /\bfail/i,
      /\bfrustrat/i,
      /\boverwel/i,
      /\bafraid/i,
      /\bexhaust/i,
      /😢|😭|🥺|💔/
    ]
  },
  {
    tone: 'domestic',
    patterns: [
      /\bfood\b/i,
      /\bcook/i,
      /\brecipe/i,
      /\btea\b/i,
      /\bbreakfast\b/i,
      /\blunch\b/i,
      /\bdinner\b/i,
      /\bsleep/i,
      /\bmorning\b/i,
      /\bweather\b/i,
      /\brain\b/i,
      /\bcold\b/i,
      /\bwarm\b/i,
      /\bhungry/i,
      /\bhome\b/i,
      /\bsnack/i,
      /\bcoffee\b/i,
      /\bclean/i,
      /🍵|🍳|🏠|☔|🌸/
    ]
  }
]

export function detectTone(messages: WindowMessage[]): ToneKey {
  const recentMessages = messages.slice(-3)
  const text = recentMessages.map((m) => m.content).join(' ')

  for (const { tone, patterns } of TONE_PATTERNS) {
    const matchCount = patterns.filter((p) => p.test(text)).length
    if (matchCount >= 2) return tone
  }

  return 'playful'
}
