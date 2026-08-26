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

// Appended to a normal reply when someone attaches something she cannot open. Silence reads as
// hallucination or evasion — she answers the question and says plainly that the file was not one of them.
const UNSUPPORTED_ATTACHMENT_MESSAGES = [
  "Ah — I couldn't open that file, sorry~ Could you tell me what's in it?",
  "Mou~ that kind of file is beyond me. Describe it for me and I'll help!",
  "Nn... I can't peek inside that one. Images I can see, but not that~",
  "Sorry, that attachment isn't something I can look at — but I'm listening!"
]

// A file too big to take whole is sent as its opening minutes instead. Saying so is the difference between
// a partial answer and a confident wrong one — she genuinely did not hear the end.
const PARTIAL_ATTACHMENT_MESSAGES = [
  'That one was rather long, so I only got through the beginning of it~',
  'Mm, too big to take all at once — I only saw the first part, so ask me again if the rest matters!',
  "Nn... that's a big one. I stopped partway through, so I might have missed the ending~",
  'I could only manage the opening of that — it was much too long for me to take in one go!'
]

/** Attachments refused on measured cost: intact and readable, just too expensive to spend one turn on. */
const OVERSIZED_ATTACHMENT_MESSAGES = [
  "That's far too much for me to take in all at once~ Send me a smaller piece and I'll look properly.",
  'Mou, that would take me all afternoon to get through! Something shorter, please?',
  "Ara, you've given me enough to read for a week. Trim it down a little for me?",
  "That's a bit much for one sitting, ne? Give me a shorter one and I'll go through it properly."
]

export function getRandomOversizedAttachment(): string {
  return OVERSIZED_ATTACHMENT_MESSAGES[Math.floor(Math.random() * OVERSIZED_ATTACHMENT_MESSAGES.length)]
}

export function getRandomPartialAttachment(): string {
  return PARTIAL_ATTACHMENT_MESSAGES[Math.floor(Math.random() * PARTIAL_ATTACHMENT_MESSAGES.length)]
}

export function getRandomUnsupportedAttachment(): string {
  return UNSUPPORTED_ATTACHMENT_MESSAGES[Math.floor(Math.random() * UNSUPPORTED_ATTACHMENT_MESSAGES.length)]
}

export function getRandomDecline(): string {
  return DECLINE_MESSAGES[Math.floor(Math.random() * DECLINE_MESSAGES.length)]
}

export function getRandomBusy(): string {
  return BUSY_MESSAGES[Math.floor(Math.random() * BUSY_MESSAGES.length)]
}

export function getRandomError(): string {
  return ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]
}

/**
 * Show every backtick she types instead of letting Discord read it as syntax.
 *
 * Her kaomoji carry a literal backtick — `(´・ω・`)` leads the speech layer's list — and Discord pairs any
 * two backticks in a message into an inline code span. One alone is harmless and renders as typed; a second
 * anywhere later swallows everything between, monospacing the text and exposing the bold markers inside it
 * as raw asterisks. Reported by a user whose opening kaomoji paired with a backticked domain three
 * paragraphs down.
 *
 * The speech layer already tries to pre-escape it, and that is the part which does not work: over the Pi's
 * retained window the model reproduced the escape 3 times against 12 bare backticks. An escape the model has
 * to remember is a hope; this is the mechanism.
 *
 * Escaping all of them rather than only the unpaired ones is deliberate. Which backtick was decorative and
 * which was syntax is not recoverable from the text, and her replies are not a surface that formats code —
 * the core layer already rules out code blocks. So the contract is simply: a backtick she writes is a
 * backtick the reader sees. The cost is that an incidental `domain` shows its backticks rather than
 * monospacing, which is a formatting she was never asked to use.
 *
 * `\\?` rather than a bare match so the ~20% of replies that DO arrive pre-escaped are normalised rather
 * than double-escaped — `\\\\` would render a literal backslash and leave the backtick free to open a span
 * again. That also makes this idempotent.
 *
 * Scoped to conversational replies by where it is called: /stats builds its own containers and keeps the
 * inline code it uses on purpose.
 */
export function escapeBackticks(text: string): string {
  return text.replace(/\\?`/g, '\\`')
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
      // A hard cut lands on an arbitrary UTF-16 code unit, and Roka's replies are full of emoji, which are
      // surrogate pairs. Cutting between the halves emits two lone surrogates that Discord renders as
      // replacement characters, so step back off the pair. Never past index 1, which would stall the loop.
      const trailing = remaining.charCodeAt(splitIndex - 1)
      if (splitIndex > 1 && trailing >= 0xd800 && trailing <= 0xdbff) splitIndex -= 1
    }

    chunks.push(remaining.slice(0, splitIndex))
    remaining = remaining.slice(splitIndex).trimStart()
  }

  return chunks
}
