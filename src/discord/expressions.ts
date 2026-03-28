import type { ToneKey } from '../agent/prompts/tones.js'
import { logger } from '../utils/logger.js'

/**
 * Tone-to-expression mapping.
 * Each tone maps to an array of expression names (without the roka_a_ prefix).
 * A random expression is selected from the pool for each message.
 */
const TONE_EXPRESSIONS: Record<ToneKey, string[]> = {
  playful: ['smile', 'cheerful', 'delighted'],
  sincere: ['sad', 'downcast', 'somber', 'sorrowful', 'pained', 'melancholy'],
  domestic: ['gentle_smile', 'content', 'serene', 'relieved'],
  flustered: ['flustered', 'nervous', 'awkward', 'uncertain'],
  curious: ['thinking', 'surprised', 'blank_stare', 'uncertain'],
  annoyed: ['exasperated', 'dissatisfied', 'dissatisfied_2', 'dissatisfied_3', 'frustrated', 'resigned'],
  tender: ['worried', 'troubled', 'anxious', 'gentle_smile', 'melancholy'],
  confident: ['composed', 'base', 'explaining', 'attentive'],
  nostalgic: ['gentle_smile', 'melancholy', 'content', 'serene'],
  mischievous: ['delighted', 'cheerful', 'smile'],
  sleepy: ['relieved', 'content', 'gentle_smile'],
  competitive: ['cheerful', 'delighted', 'explaining', 'attentive']
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

/**
 * Get the expression URL for a given tone.
 * Randomly selects from the tone's expression pool.
 */
export function getExpressionUrl(tone: ToneKey): string {
  const pool = TONE_EXPRESSIONS[tone]
  if (!pool || pool.length === 0) {
    logger.debug({ expression: 'base', tone, method: 'fallback' }, 'Expression selected')
    return EXPRESSION_URLS['base'] ?? ''
  }

  const picked = pool[Math.floor(Math.random() * pool.length)]
  logger.debug({ expression: picked, tone, method: 'tone-pool' }, 'Expression selected')
  return EXPRESSION_URLS[picked] ?? ''
}
