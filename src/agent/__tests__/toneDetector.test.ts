import { describe, it, expect, vi } from 'vitest'

vi.mock('../../config.js', () => ({
  config: {
    logging: { level: 'silent' },
    rateLimit: { rpm: 15, rpd: 500 },
    session: { ttlMs: 300_000, windowSize: 10 }
  }
}))

import { detectTone } from '../toneDetector.js'
import type { WindowMessage } from '../../session/types.js'

function makeMessage(content: string): WindowMessage {
  return {
    role: 'user',
    displayName: 'TestUser',
    content,
    timestamp: Date.now()
  }
}

describe('detectTone', () => {
  describe('flustered detection', () => {
    it('detects flustered tone from romantic keywords', () => {
      const messages = [makeMessage('I think I have a crush on you, you are so cute')]
      expect(detectTone(messages)).toBe('flustered')
    })

    it('detects flustered tone from emoji patterns', () => {
      const messages = [makeMessage('you are so beautiful ❤')]
      expect(detectTone(messages)).toBe('flustered')
    })
  })

  describe('sincere detection', () => {
    it('detects sincere tone from emotional keywords', () => {
      const messages = [makeMessage('I feel so sad and lonely today')]
      expect(detectTone(messages)).toBe('sincere')
    })

    it('detects sincere tone from gratitude keywords', () => {
      const messages = [makeMessage('thank you, I am grateful')]
      expect(detectTone(messages)).toBe('sincere')
    })

    it('detects sincere tone from sad emoji', () => {
      const messages = [makeMessage('I feel hurt 😢')]
      expect(detectTone(messages)).toBe('sincere')
    })
  })

  describe('domestic detection', () => {
    it('detects domestic tone from food keywords', () => {
      const messages = [makeMessage('what should I cook for dinner tonight?')]
      expect(detectTone(messages)).toBe('domestic')
    })

    it('detects domestic tone from daily life keywords', () => {
      const messages = [makeMessage('the weather is so cold this morning')]
      expect(detectTone(messages)).toBe('domestic')
    })

    it('detects domestic tone from cozy emoji', () => {
      const messages = [makeMessage('time for some tea 🍵 at home')]
      expect(detectTone(messages)).toBe('domestic')
    })
  })

  describe('default fallback', () => {
    it('returns playful when no patterns match', () => {
      const messages = [makeMessage('hey what do you think about video games?')]
      expect(detectTone(messages)).toBe('playful')
    })

    it('returns playful for empty messages array', () => {
      expect(detectTone([])).toBe('playful')
    })

    it('returns playful when only one keyword matches (needs 2)', () => {
      const messages = [makeMessage('I feel sad')]
      expect(detectTone(messages)).toBe('playful')
    })
  })

  describe('scans only last 3 messages', () => {
    it('ignores older messages beyond the last 3', () => {
      const messages = [
        makeMessage('I feel so sad and lonely'), // msg 1 (should be ignored)
        makeMessage('just talking about random stuff'), // msg 2
        makeMessage('playing some games'), // msg 3
        makeMessage('this is fun right') // msg 4
      ]
      // Only messages 2-4 are scanned; msg 1 with sad+lonely is outside the window
      expect(detectTone(messages)).toBe('playful')
    })

    it('detects tone from the last 3 messages', () => {
      const messages = [
        makeMessage('random stuff'),
        makeMessage('I have a crush'),
        makeMessage('you are so cute'),
        makeMessage('will you go on a date with me')
      ]
      // Last 3: crush, cute, date -> flustered
      expect(detectTone(messages)).toBe('flustered')
    })
  })
})
