import type { ToneKey } from '../agent/prompts/tones.js'

interface ToneStyle {
  color: number
  imageUrl: string
}

/**
 * Tone styles with associated colors and image URLs for Discord embeds.
 *
 * To modify the imageUrl:
 * - For HTTP URLs: replace the string with any public URL (e.g., 'https://example.com/image.jpg')
 * - For local files: ensure the path is relative from the bot's root and accessible (e.g., './assets/app-icon.jpg')
 * - For Discord embeds: imageUrl must be an HTTP(S) URL or attachment URL; file:// URLs are not supported
 */
const TONE_STYLES: Record<ToneKey, ToneStyle> = {
  playful: { color: 0xf48fb1, imageUrl: './assets/app-icon.jpg' },
  sincere: { color: 0x90caf9, imageUrl: './assets/app-icon.jpg' },
  domestic: { color: 0xffcc80, imageUrl: './assets/app-icon.jpg' },
  flustered: { color: 0xef9a9a, imageUrl: './assets/app-icon.jpg' }
}

export function getToneStyle(tone: ToneKey): ToneStyle {
  return TONE_STYLES[tone]
}
