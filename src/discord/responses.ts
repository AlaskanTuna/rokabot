import { config } from '../config.js'

/** In-character response pools for rate limiting and error handling */

const DECLINE_MESSAGES = [
  'ちょっと待ってね~ Give me a moment.',
  "Mou~ I'm a bit busy right now. Hold on, okay?",
  'Ara ara~ so impatient. Just a little bit longer~',
  "Fufu~ everyone's talking at once. Let me catch my breath.",
  "Ah, sorry — I'm in the middle of something. I'll be right back!"
]

const BUSY_MESSAGES = [
  "I'm still thinking~ just a moment, okay?",
  "Mou~ hold on, I haven't finished my thought yet!",
  "Ah, wait wait — I'm still working on my answer~",
  'Fufu~ so eager. Let me finish what I was saying first!',
  "One thing at a time~ I'm almost done, I promise!"
]

const ERROR_MESSAGES = [
  'Nn... something feels off. Let me try again in a bit, okay?',
  "Ah, that's strange... my thoughts got all jumbled up. Give me a moment.",
  'Mou, I lost my train of thought... sorry about that.'
]

export function getRandomDecline(): string {
  return DECLINE_MESSAGES[Math.floor(Math.random() * DECLINE_MESSAGES.length)]
}

export function getRandomBusy(): string {
  return BUSY_MESSAGES[Math.floor(Math.random() * BUSY_MESSAGES.length)]
}

export function getRandomError(): string {
  return ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]
}

/** Split long responses to fit within Discord's message character limit */
export function splitResponse(text: string, maxLength = config.discord.maxMessageLength): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength)
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength)
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength
    }

    chunks.push(remaining.slice(0, splitIndex))
    remaining = remaining.slice(splitIndex).trimStart()
  }

  return chunks
}
