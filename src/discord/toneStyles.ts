import type { ToneKey } from '../agent/prompts/tones.js'

interface ToneStyle {
  color: number
  imageUrl: string
}

const TONE_STYLES: Record<ToneKey, ToneStyle> = {
  playful: { color: 0xf48fb1, imageUrl: 'https://placehold.co/80x80/F48FB1/white?text=Playful' },
  sincere: { color: 0x90caf9, imageUrl: 'https://placehold.co/80x80/90CAF9/white?text=Sincere' },
  domestic: { color: 0xffcc80, imageUrl: 'https://placehold.co/80x80/FFCC80/white?text=Domestic' },
  flustered: { color: 0xef9a9a, imageUrl: 'https://placehold.co/80x80/EF9A9A/white?text=Flustered' }
}

export function getToneStyle(tone: ToneKey): ToneStyle {
  return TONE_STYLES[tone]
}
