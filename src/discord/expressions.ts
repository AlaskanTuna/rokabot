import type { ToneKey } from '../agent/prompts/tones.js'

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
 * Paste your URLs here after uploading.
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
 * Get a random expression URL for the given tone.
 * Returns empty string if no URL is configured for the picked expression.
 */
export function getExpressionUrl(tone: ToneKey): string {
  const pool = TONE_EXPRESSIONS[tone]
  if (!pool || pool.length === 0) return ''

  const picked = pool[Math.floor(Math.random() * pool.length)]
  return EXPRESSION_URLS[picked] ?? ''
}
