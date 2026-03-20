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
  playful: { color: 0xffb3d9, imageUrl: 'https://placehold.co/80x80/FFB3D9/white?text=%E2%99%AA' },
  sincere: { color: 0xa8d8ff, imageUrl: 'https://placehold.co/80x80/A8D8FF/white?text=%E2%98%86' },
  domestic: { color: 0xffd4b5, imageUrl: 'https://placehold.co/80x80/FFD4B5/white?text=%E2%98%95' },
  flustered: { color: 0xffb3b3, imageUrl: 'https://placehold.co/80x80/FFB3B3/white?text=%2F%2F' },
  curious: { color: 0xb2ebf2, imageUrl: 'https://placehold.co/80x80/B2EBF2/white?text=%3F' },
  annoyed: { color: 0xf8b4b8, imageUrl: 'https://placehold.co/80x80/F8B4B8/white?text=%E2%80%BC' },
  tender: { color: 0xe1bee7, imageUrl: 'https://placehold.co/80x80/E1BEE7/white?text=%E2%99%A5' },
  confident: { color: 0xc8e6c9, imageUrl: 'https://placehold.co/80x80/C8E6C9/white?text=%E2%9C%93' }
}

export function getToneStyle(tone: ToneKey): ToneStyle {
  return TONE_STYLES[tone]
}
