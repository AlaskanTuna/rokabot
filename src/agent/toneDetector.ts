import type { ToneKey } from './prompts/tones.js'
import type { WindowMessage } from '../session/types.js'

/**
 * Rule-based tone detection. Scans recent messages for keyword patterns
 * to select the appropriate Layer 2 prompt variant.
 * Zero LLM cost — purely pattern matching.
 *
 * Detection priority (most specific first):
 * 1. flustered — romantic keywords
 * 2. tender — soft vulnerability
 * 3. annoyed — defiance/recklessness
 * 4. sincere — heavy emotional
 * 5. domestic — food/daily life
 * 6. curious — questions/learning
 * 7. confident — help/advice/trust
 * 8. playful — default fallback
 */

interface ToneRule {
  tone: ToneKey
  patterns: RegExp[]
  minMatches: number
}

const TONE_PATTERNS: ToneRule[] = [
  {
    tone: 'flustered',
    minMatches: 2,
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
    tone: 'tender',
    minMatches: 2,
    patterns: [
      /\bmiss\b/i,
      /\bworried\b/i,
      /\bscared\b/i,
      /\balone\b/i,
      /\bthank you\b/i,
      /\bgrateful\b/i,
      /\bmean.* a lot\b/i,
      /\bimportant to me\b/i,
      /\bgoodnight\b/i,
      /\bsweet dreams\b/i,
      /\btake care\b/i,
      /\bstay safe\b/i,
      /\balways\b/i,
      /\bpromise\b/i,
      /\btogether\b/i
    ]
  },
  {
    tone: 'annoyed',
    minMatches: 2,
    patterns: [
      /\bno\b/i,
      /\bwon't\b/i,
      /\brefuse\b/i,
      /\bdon't want to\b/i,
      /\bskipped? (?:lunch|dinner|breakfast|meal)/i,
      /\bdidn't eat\b/i,
      /\bstayed up\b/i,
      /\ball.?nighter\b/i,
      /\bold\b/i,
      /\bobaa?san\b/i,
      /\bgranny\b/i,
      /\bboring\b/i,
      /\bwhatever\b/i,
      /\bfine\b/i,
      /\bdon't care\b/i
    ]
  },
  {
    tone: 'sincere',
    minMatches: 2,
    patterns: [
      /\bsad\b/i,
      /\blonely\b/i,
      /\btired\b/i,
      /\bstress/i,
      /\banxious/i,
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
    minMatches: 2,
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
  },
  {
    tone: 'curious',
    minMatches: 2,
    patterns: [
      /\bwhat\b/i,
      /\bhow\b/i,
      /\bwhy\b/i,
      /\bexplain\b/i,
      /\btell me about\b/i,
      /\binteresting\b/i,
      /\bwonder\b/i,
      /\bcurious\b/i,
      /\blearn\b/i,
      /\bthink about\b/i,
      /\bwhat if\b/i,
      /\btheory\b/i
    ]
  },
  {
    tone: 'confident',
    minMatches: 2,
    patterns: [
      /\bleave it to me\b/i,
      /\bdon't worry\b/i,
      /\bi've got this\b/i,
      /\btrust me\b/i,
      /\badvice\b/i,
      /\bhelp me with\b/i,
      /\bwhat should I\b/i,
      /\brecommend\b/i,
      /\bhow do I\b/i,
      /\bteach me\b/i,
      /\bshow me\b/i,
      /\bneed your help\b/i,
      /\bcan you help\b/i
    ]
  }
]

export function detectTone(messages: WindowMessage[]): ToneKey {
  const recentMessages = messages.slice(-3)
  const text = recentMessages.map((m) => m.content).join(' ')

  for (const { tone, patterns, minMatches } of TONE_PATTERNS) {
    const matchCount = patterns.filter((p) => p.test(text)).length
    if (matchCount >= minMatches) return tone
  }

  return 'playful'
}
