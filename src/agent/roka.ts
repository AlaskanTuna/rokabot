import { logger } from '../utils/logger.js'
import { assembleSystemPrompt, type AssemblerInput } from './promptAssembler.js'
import { detectTone } from './toneDetector.js'
import type { ToneKey } from './prompts/tones.js'
import type { WindowMessage } from '../session/types.js'
import { config } from '../config.js'

/**
 * Roka Agent — wraps Gemini API calls with the layered prompt system.
 * Uses @google/genai directly for now; will migrate to @google/adk
 * when the TypeScript ADK stabilizes with proper session support.
 */

export interface ImageAttachment {
  url: string
  contentType: string
}

interface GenerateOptions {
  userMessage: string
  displayName: string
  channelHistory: WindowMessage[]
  participants: string[]
  imageAttachments?: ImageAttachment[]
}

export interface GenerateResult {
  text: string
  tone: ToneKey
}

/** Maximum image size in bytes (4 MB). Images larger than this are skipped. */
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024

/**
 * Download an image from a URL and return it as a base64-encoded string.
 * Returns null if the image exceeds the size limit or the download fails.
 */
async function downloadImage(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      logger.warn({ url, status: response.status }, 'Failed to download image')
      return null
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      logger.warn({ url, size: contentLength }, 'Image exceeds 4 MB size limit, skipping')
      return null
    }

    const buffer = await response.arrayBuffer()

    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      logger.warn({ url, size: buffer.byteLength }, 'Image exceeds 4 MB size limit, skipping')
      return null
    }

    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = response.headers.get('content-type') || 'image/png'
    return { data: base64, mimeType }
  } catch (error) {
    logger.warn({ url, error }, 'Error downloading image')
    return null
  }
}

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
 * Get the current hour in the configured timezone (from config.yml).
 * Falls back to the system's local time if no timezone is set or if the timezone is invalid.
 */
function getLocalHour(): number {
  const tz = config.timezone
  if (!tz) return new Date().getHours()
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    logger.warn({ timezone: tz }, 'Invalid timezone in config, falling back to system time')
    return new Date().getHours()
  }
}

/**
 * Call the Gemini API with a configurable timeout and retry for transient errors.
 * Timeouts are NOT retried (they indicate the model is stuck).
 */
async function callWithRetry(generateFn: (signal: AbortSignal) => Promise<string>): Promise<string> {
  const maxAttempts = config.gemini.maxRetries + 1
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.gemini.timeout)

    try {
      const result = await generateFn(controller.signal)
      return result
    } catch (error) {
      // Check if this was a timeout (AbortController fired)
      if (controller.signal.aborted) {
        logger.error({ timeoutMs: config.gemini.timeout }, 'Gemini API call timed out')
        throw new Error('Gemini request timed out')
      }

      const status = getErrorStatus(error)

      // On non-final attempt, retry if the status is retryable
      if (attempt < maxAttempts - 1 && status !== null && isRetryableStatus(status)) {
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

export async function generateResponse(options: GenerateOptions): Promise<GenerateResult> {
  const { userMessage, displayName, channelHistory, participants, imageAttachments } = options

  const tone = detectTone(channelHistory)
  const hour = getLocalHour()

  const assemblerInput: AssemblerInput = { tone, participants, hour, displayName }
  const systemPrompt = assembleSystemPrompt(assemblerInput)

  logger.debug({ tone, participantCount: participants.length, hour }, 'Prompt assembled')

  try {
    // Dynamic import to allow graceful fallback
    const { GoogleGenAI } = await import('@google/genai')

    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })

    // Build image inline data parts for the current message (not replayed from history)
    const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = []
    if (imageAttachments?.length) {
      const downloads = await Promise.all(imageAttachments.map((img) => downloadImage(img.url)))
      for (const result of downloads) {
        if (result) {
          imageParts.push({ inlineData: { data: result.data, mimeType: result.mimeType } })
        }
      }
      if (imageParts.length > 0) {
        logger.debug({ imageCount: imageParts.length }, 'Attached images to Gemini request')
      }
    }

    const currentUserParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      ...imageParts,
      { text: `[${displayName}]: ${userMessage}` }
    ]

    const contents = [
      ...channelHistory.map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: `[${m.displayName}]: ${m.content}` }]
      })),
      {
        role: 'user' as const,
        parts: currentUserParts
      }
    ]

    logger.debug(
      { model: config.gemini.model, historyLength: contents.length - 1, hasImages: imageParts.length > 0 },
      'Sending Gemini request'
    )

    const text = await callWithRetry(async (signal: AbortSignal) => {
      const response = await ai.models.generateContent({
        model: config.gemini.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: config.gemini.maxOutputTokens,
          temperature: 0.9,
          topP: 0.95,
          httpOptions: { timeout: config.gemini.timeout },
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

      logger.debug({ responseLength: responseText.length }, 'Gemini raw response extracted')
      return responseText
    })

    return { text: stripRokaPrefix(text), tone }
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
