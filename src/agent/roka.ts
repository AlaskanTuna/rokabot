import { logger } from '../utils/logger.js'
import { assembleSystemPrompt, type AssemblerInput } from './promptAssembler.js'
import { detectTone } from './toneDetector.js'
import type { WindowMessage } from '../session/types.js'
import { config } from '../config.js'

/**
 * Roka Agent — wraps Gemini API calls with the layered prompt system.
 * Uses @google/genai directly for now; will migrate to @google/adk
 * when the TypeScript ADK stabilizes with proper session support.
 */

interface GenerateOptions {
  userMessage: string
  displayName: string
  channelHistory: WindowMessage[]
  participants: string[]
}

/** Timeout for a single Gemini API call (ms). */
const GEMINI_TIMEOUT_MS = 15_000

/** Delay before retrying a 429 rate-limited request (ms). */
const RETRY_DELAY_429_MS = 4_000

/** Delay before retrying a 500/503 server error (ms). */
const RETRY_DELAY_SERVER_MS = 2_000

/**
 * Extract an HTTP status code from an unknown error thrown by @google/genai.
 * The SDK may expose it as .status, .httpStatusCode, or embed it in the message.
 */
function getErrorStatus(error: unknown): number | null {
  if (error == null || typeof error !== 'object') return null

  const err = error as Record<string, unknown>

  if (typeof err.status === 'number') return err.status
  if (typeof err.httpStatusCode === 'number') return err.httpStatusCode

  // Some SDK versions embed the status in the error message, e.g. "[429 Too Many Requests]"
  if (typeof err.message === 'string') {
    const match = err.message.match(/\b([45]\d{2})\b/)
    if (match) return parseInt(match[1], 10)
  }

  return null
}

/**
 * Extract a Retry-After delay (in ms) from an error, if present.
 * The SDK may expose response headers or embed the value in the error.
 */
function getRetryAfterMs(error: unknown): number | null {
  if (error == null || typeof error !== 'object') return null

  const err = error as Record<string, unknown>

  // Check for a retryAfter property (some SDK versions)
  if (typeof err.retryAfter === 'number') return err.retryAfter * 1000
  if (typeof err.retryAfter === 'string') {
    const seconds = parseFloat(err.retryAfter)
    if (!isNaN(seconds)) return seconds * 1000
  }

  // Check nested headers
  const headers = (err.headers ?? (err.response as Record<string, unknown> | undefined)?.headers) as
    | Record<string, string>
    | undefined
  if (headers) {
    const retryAfter = headers['retry-after'] ?? headers['Retry-After']
    if (retryAfter) {
      const seconds = parseFloat(retryAfter)
      if (!isNaN(seconds)) return seconds * 1000
    }
  }

  return null
}

/** Returns true for status codes that warrant a single retry. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503
}

/** Determine the retry delay for a given error. */
function getRetryDelayMs(error: unknown, status: number): number {
  if (status === 429) {
    const retryAfter = getRetryAfterMs(error)
    return retryAfter ?? RETRY_DELAY_429_MS
  }
  return RETRY_DELAY_SERVER_MS
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call the Gemini API with a 15-second timeout and at most 1 retry for transient errors.
 * Timeouts are NOT retried (they indicate the model is stuck).
 */
async function callWithRetry(generateFn: (signal: AbortSignal) => Promise<string>): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)

    try {
      const result = await generateFn(controller.signal)
      return result
    } catch (error) {
      // Check if this was a timeout (AbortController fired)
      if (controller.signal.aborted) {
        logger.error('Gemini API call timed out after 15s')
        throw new Error('Gemini request timed out')
      }

      const status = getErrorStatus(error)

      // On first attempt, retry if the status is retryable
      if (attempt === 0 && status !== null && isRetryableStatus(status)) {
        const delayMs = getRetryDelayMs(error, status)
        logger.warn({ status, delayMs, attempt: attempt + 1 }, 'Retrying Gemini API call after transient error')
        await sleep(delayMs)
        continue
      }

      // Second attempt or non-retryable error — propagate
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error('Gemini retry loop exited unexpectedly')
}

export async function generateResponse(options: GenerateOptions): Promise<string> {
  const { userMessage, displayName, channelHistory, participants } = options

  const tone = detectTone(channelHistory)
  const hour = new Date().getHours()

  const assemblerInput: AssemblerInput = { tone, participants, hour, displayName }
  const systemPrompt = assembleSystemPrompt(assemblerInput)

  logger.debug({ tone, participantCount: participants.length, hour }, 'Prompt assembled')

  try {
    // Dynamic import to allow graceful fallback
    const { GoogleGenAI } = await import('@google/genai')

    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })

    const contents = [
      ...channelHistory.map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: `[${m.displayName}]: ${m.content}` }]
      })),
      {
        role: 'user' as const,
        parts: [{ text: `[${displayName}]: ${userMessage}` }]
      }
    ]

    const text = await callWithRetry(async (signal: AbortSignal) => {
      const response = await ai.models.generateContent({
        model: config.gemini.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 512,
          temperature: 0.9,
          topP: 0.95,
          httpOptions: { timeout: GEMINI_TIMEOUT_MS },
          abortSignal: signal
        }
      })

      // Extract the first non-thought text part manually to avoid the SDK's
      // console.warn about non-text parts (e.g. thoughtSignature). Using only
      // the first text part prevents duplication when Gemini returns the same
      // content across multiple parts.
      const parts = response.candidates?.[0]?.content?.parts ?? []
      const firstTextPart = parts.find((p): p is { text: string } => typeof p.text === 'string' && !p.thought)
      const responseText = firstTextPart?.text?.trim() ?? ''

      if (!responseText) {
        logger.warn('Empty response from Gemini')
        return getRandomFallback()
      }

      return responseText
    })

    return stripRokaPrefix(text)
  } catch (error) {
    logger.error({ error }, 'Gemini API call failed')
    throw error
  }
}

/**
 * Strip any leading "[Roka]:" or "Roka:" prefix that the model may
 * produce by mimicking the history format.
 */
function stripRokaPrefix(text: string): string {
  return text.replace(/^\[?Roka\]?:\s*/i, '').trim()
}

function getRandomFallback(): string {
  const fallbacks = [
    'Hmm? Sorry, I spaced out for a moment there~',
    'Ah, what was that? I got distracted by something.',
    'Ahaha, my mind wandered. Say that again?',
    "I wasn't paying attention... don't tell anyone, okay?"
  ]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}
