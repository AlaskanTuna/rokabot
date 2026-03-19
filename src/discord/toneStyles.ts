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
 * - For Discord embeds: imageUrl must be an HTTP(S) URL or attachment URL; file:// URLs are not supported
 */
const TONE_STYLES: Record<ToneKey, ToneStyle> = {
  playful: { color: 0xf48fb1, imageUrl: 'https://placehold.co/80x80/F48FB1/white?text=%E2%99%AA' },
  sincere: { color: 0x90caf9, imageUrl: 'https://placehold.co/80x80/90CAF9/white?text=%E2%98%86' },
  domestic: { color: 0xffcc80, imageUrl: 'https://placehold.co/80x80/FFCC80/white?text=%E2%98%95' },
  flustered: { color: 0xffaf8c, imageUrl: 'https://placehold.co/80x80/FFAF8C/white?text=%2F%2F' }
}

export function getToneStyle(tone: ToneKey): ToneStyle {
  return TONE_STYLES[tone]
}
