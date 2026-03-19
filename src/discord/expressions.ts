import type { ToneKey } from '../agent/prompts/tones.js'
import { logger } from '../utils/logger.js'

/**
 * Tone-to-expression mapping.
 * Each tone maps to an array of expression names (without the roka_a_ prefix).
 */
const TONE_EXPRESSIONS: Record<ToneKey, string[]> = {
  playful: ['smile', 'cheerful', 'delighted', 'gentle_smile', 'content', 'explaining'],
  sincere: ['serene', 'melancholy', 'sad', 'downcast', 'composed', 'attentive', 'relieved'],
  domestic: ['gentle_smile', 'content', 'smile', 'composed', 'cheerful'],
  flustered: ['flustered', 'surprised', 'nervous', 'anxious', 'awkward', 'uncertain']
}

/**
 * Static expression URL map.
 * Each key is an expression name, value is a public URL (e.g. catbox).
 */
const EXPRESSION_URLS: Record<string, string> = {
  anxious: 'https://files.catbox.moe/29f0py.png',
  attentive: 'https://files.catbox.moe/v52lqw.png',
  awkward: 'https://files.catbox.moe/4ylow1.png',
  base: 'https://files.catbox.moe/uc9lpk.png',
  blank_stare: 'https://files.catbox.moe/x9qtaf.png',
  cheerful: 'https://files.catbox.moe/p4blh6.png',
  composed: 'https://files.catbox.moe/d7b78i.png',
  content: 'https://files.catbox.moe/ygntxi.png',
  delighted: 'https://files.catbox.moe/h1ar06.png',
  dissatisfied: 'https://files.catbox.moe/2f5hae.png',
  dissatisfied_2: 'https://files.catbox.moe/laqb3c.png',
  dissatisfied_3: 'https://files.catbox.moe/vjoyqm.png',
  downcast: 'https://files.catbox.moe/0q6a17.png',
  exasperated: 'https://files.catbox.moe/7kd0ij.png',
  explaining: 'https://files.catbox.moe/3uivde.png',
  flustered: 'https://files.catbox.moe/2j8x1k.png',
  frustrated: 'https://files.catbox.moe/b5sd9k.png',
  gentle_smile: 'https://files.catbox.moe/d8zutz.png',
  melancholy: 'https://files.catbox.moe/r2xky1.png',
  nervous: 'https://files.catbox.moe/9e6yso.png',
  pained: 'https://files.catbox.moe/74jn99.png',
  relieved: 'https://files.catbox.moe/1kw9l1.png',
  resigned: 'https://files.catbox.moe/0hbzmh.png',
  sad: 'https://files.catbox.moe/8qvqaj.png',
  serene: 'https://files.catbox.moe/8hej69.png',
  smile: 'https://files.catbox.moe/0cemuf.png',
  somber: 'https://files.catbox.moe/u8g8d1.png',
  sorrowful: 'https://files.catbox.moe/0vkii0.png',
  surprised: 'https://files.catbox.moe/qpsb2y.png',
  thinking: 'https://files.catbox.moe/kyohyl.png',
  troubled: 'https://files.catbox.moe/782ebx.png',
  uncertain: 'https://files.catbox.moe/a1o062.png',
  worried: 'https://files.catbox.moe/q2gnq6.png'
}

interface ExpressionRule {
  expression: string
  patterns: RegExp[]
  minMatches: number
}

/**
 * Keyword-to-expression rules, checked in priority order.
 * First rule whose match count >= minMatches wins.
 */
const EXPRESSION_RULES: ExpressionRule[] = [
  // Flustered/Embarrassed
  {
    expression: 'flustered',
    patterns: [/wh-/i, /\bstammer/i, /⁄ ⁄/, /\bblushing\b/i, /my face/i, /my heart/i],
    minMatches: 1
  },
  {
    expression: 'nervous',
    patterns: [/\bu-um\b/i, /\be-eh\b/i, /\bn-no\b/i, /that's not/i, /it's not like/i],
    minMatches: 1
  },
  {
    expression: 'awkward',
    patterns: [/\banyway\b/i, /\bforget I said\b/i, /\bpretend you didn't\b/i, /\bchanging the subject\b/i],
    minMatches: 1
  },
  {
    expression: 'surprised',
    patterns: [/!\?/, /\breally!?\b/i, /\boh!/i, /\beh!?\b/i, /\bwait\b/i, /\bsince when\b/i],
    minMatches: 1
  },

  // Emotional/Caring
  {
    expression: 'worried',
    patterns: [
      /\bworried\b/i,
      /\bare you okay\b/i,
      /\bbe careful\b/i,
      /\bdon't push yourself\b/i,
      /\byou look tired\b/i
    ],
    minMatches: 1
  },
  {
    expression: 'sad',
    patterns: [/\bsad\b/i, /\bmiss you\b/i, /\blonely\b/i, /\bcry\b/i, /╥﹏╥/],
    minMatches: 1
  },
  {
    expression: 'melancholy',
    patterns: [/\bremember when\b/i, /\bused to\b/i, /\bthose days\b/i, /\bnostalgi/i],
    minMatches: 1
  },
  {
    expression: 'gentle_smile',
    patterns: [/\bproud\b/i, /\bwell done\b/i, /\bgood job\b/i, /\bI believe in you\b/i, /\bdo your best\b/i],
    minMatches: 1
  },
  {
    expression: 'serene',
    patterns: [/\bpeaceful\b/i, /\brelaxing\b/i, /\bquiet\b/i, /\bcalm\b/i, /\bnice evening\b/i],
    minMatches: 1
  },
  {
    expression: 'relieved',
    patterns: [/\brelieved\b/i, /\bglad\b/i, /\bthank goodness\b/i, /\bgood to hear\b/i],
    minMatches: 1
  },

  // Exasperation/Annoyance
  {
    expression: 'exasperated',
    patterns: [/\bmou~?\b/i, /\bhonestly\b/i, /\byou never\b/i, /\bhow many times\b/i, /\btold you\b/i],
    minMatches: 1
  },
  {
    expression: 'dissatisfied',
    patterns: [/\bnot fair\b/i, /\bhmph\b/i, /\bunbelievable\b/i, /💢/],
    minMatches: 1
  },
  {
    expression: 'frustrated',
    patterns: [/\bfrustrat/i, /\bwhy won't\b/i, /\bgive up\b/i, /\bimpossible\b/i],
    minMatches: 1
  },

  // Playful/Happy
  {
    expression: 'cheerful',
    patterns: [/♪/, /\byay\b/i, /\bexciting\b/i, /\bcan't wait\b/i, /≧▽≦/],
    minMatches: 1
  },
  {
    expression: 'delighted',
    patterns: [/\breally\?.*\bhappy\b/i, /\bso glad\b/i, /\bwonderful\b/i, /\bamazing\b/i],
    minMatches: 1
  },
  {
    expression: 'smile',
    patterns: [/\bfufu\b/i, /\byou know~/i, /\bne~/i, /\btease\b/i, /\bdesho\b/i],
    minMatches: 1
  },

  // Thinking/Explaining
  {
    expression: 'thinking',
    patterns: [/\bhmm\b/i, /\blet me think\b/i, /\bwell\.\.\./i, /\bif I recall\b/i, /\bprobably\b/i],
    minMatches: 1
  },
  {
    expression: 'explaining',
    patterns: [/\bbasically\b/i, /\bin other words\b/i, /\bthe thing is\b/i, /\byou see\b/i, /\bso what happens\b/i],
    minMatches: 1
  },
  {
    expression: 'composed',
    patterns: [/\bof course\b/i, /\bnaturally\b/i, /\bobviously\b/i, /\bleave it to me\b/i],
    minMatches: 1
  },
  {
    expression: 'attentive',
    patterns: [/\btell me more\b/i, /\bgo on\b/i, /\bI'm listening\b/i, /\bwhat happened\b/i],
    minMatches: 1
  },

  // Domestic/Food
  {
    expression: 'content',
    patterns: [/\bcook/i, /\bmade you\b/i, /\beat\b/i, /\bfood\b/i, /\brecipe\b/i, /\bdelicious\b/i, /\bmeal\b/i],
    minMatches: 1
  },

  // Rare/Specific
  {
    expression: 'pained',
    patterns: [/\bhurts\b/i, /\bpain\b/i, /\bouch\b/i],
    minMatches: 1
  },
  {
    expression: 'troubled',
    patterns: [/\btrouble\b/i, /\bdifficult\b/i, /\bwhat should I\b/i],
    minMatches: 1
  },
  {
    expression: 'downcast',
    patterns: [/\bsorry\b/i, /\bmy fault\b/i, /\bforgive me\b/i],
    minMatches: 1
  },
  {
    expression: 'resigned',
    patterns: [/\bcan't be helped\b/i, /\bshouganai\b/i, /\boh well\b/i, /\bI suppose\b/i],
    minMatches: 1
  },
  {
    expression: 'somber',
    patterns: [/\bserious\b/i, /\blisten carefully\b/i, /\bimportant\b/i],
    minMatches: 1
  }
]

/**
 * Scan response text for keyword patterns to pick the best-fit expression.
 * Falls back to random pick from the tone pool if no keywords match.
 */
export function detectExpression(responseText: string, tone: ToneKey): string {
  for (const rule of EXPRESSION_RULES) {
    const matchCount = rule.patterns.filter((p) => p.test(responseText)).length
    if (matchCount >= rule.minMatches) {
      // Verify this expression has a URL configured
      if (EXPRESSION_URLS[rule.expression]) {
        logger.debug({ expression: rule.expression, tone, method: 'keyword' }, 'Expression selected')
        return rule.expression
      }
    }
  }

  // Fallback: random pick from tone pool
  const pool = TONE_EXPRESSIONS[tone]
  if (!pool || pool.length === 0) {
    logger.debug({ expression: 'base', tone, method: 'fallback' }, 'Expression selected')
    return 'base'
  }

  const picked = pool[Math.floor(Math.random() * pool.length)]
  logger.debug({ expression: picked, tone, method: 'fallback' }, 'Expression selected')
  return picked
}

/**
 * Get the expression URL based on response text analysis and tone fallback.
 * Scans response for keyword patterns first, falls back to random tone pool pick.
 */
export function getExpressionUrl(responseText: string, tone: ToneKey): string {
  const expression = detectExpression(responseText, tone)
  return EXPRESSION_URLS[expression] ?? ''
}
