/**
 * Roka agent — orchestrates the ADK pipeline for in-character response generation.
 * Manages per-channel ADK sessions, idle timers, tone detection, and image handling.
 */

import { LlmAgent, Runner, InMemorySessionService, isFinalResponse, BasePlugin, createEvent } from '@google/adk'
import type { LlmResponse, Event } from '@google/adk'
import type { GetSessionRequest, Session } from '@google/adk'
import type { Content, Part } from '@google/genai'
import { logger } from '../utils/logger.js'
import { assembleSystemPrompt } from './promptAssembler.js'
import { detectTone } from './toneDetector.js'
import type { ToneKey } from './prompts/tones.js'
import type { WindowMessage } from '../session/types.js'
import { config } from '../config.js'
import { rokaTools } from './tools/index.js'
import { saveMessage, loadHistory } from '../storage/sessionStore.js'
import { getAllFactsForPrompt } from '../storage/userMemory.js'

export interface ImageAttachment {
  url: string
  contentType: string
}

interface GenerateOptions {
  channelId: string
  userMessage: string
  displayName: string
  userId: string
  imageAttachments?: ImageAttachment[]
}

export interface GenerateResult {
  text: string
  tone: ToneKey
}

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024
const APP_NAME = 'rokabot'

// Reset per request to track tool fallback chains within a single invocation
let toolCallsThisRequest: string[] = []

/** Caps event history returned by getSession to keep context within budget. */
class WindowedSessionService extends InMemorySessionService {
  constructor(private maxEvents: number) {
    super()
  }

  override async getSession(request: GetSessionRequest): Promise<Session | undefined> {
    return super.getSession({
      ...request,
      config: { ...request?.config, numRecentEvents: this.maxEvents }
    })
  }
}

const sessionService = new WindowedSessionService(config.session.windowSize * 2)

const rokaAgent = new LlmAgent({
  name: 'roka',
  model: config.gemini.model,
  instruction: '',
  tools: [...rokaTools],
  disallowTransferToParent: true,
  disallowTransferToPeers: true,
  generateContentConfig: {
    temperature: 0.9,
    topP: 0.95,
    maxOutputTokens: config.gemini.maxOutputTokens,
    httpOptions: { timeout: config.gemini.timeout }
  },
  // Inject the assembled system prompt from session state before each LLM call
  beforeModelCallback: async ({ context, request }) => {
    const prompt = context.state.get<string>('_systemPrompt')
    if (prompt) {
      request.config = request.config ?? ({} as NonNullable<typeof request.config>)
      request.config!.systemInstruction = prompt
    }
    return undefined
  },
  // Strip "[Roka]:" prefixes the model sometimes generates, and inject fallback on empty
  afterModelCallback: async ({ response }) => {
    if (!response.content?.parts) return undefined

    for (const part of response.content.parts) {
      if (part.text && !part.thought) {
        part.text = part.text.replace(/^\[?Roka\]?:\s*/i, '').trim()
      }
    }

    const hasText = response.content.parts.some((p) => p.text?.trim() && !p.thought)
    const hasFunctionCall = response.content.parts.some((p) => 'functionCall' in p && p.functionCall)
    if (!hasText && !hasFunctionCall) {
      response.content.parts = [{ text: getRandomFallback() }]
    }

    return undefined
  },
  beforeToolCallback: async ({ tool, args }) => {
    logger.info({ tool: tool.name, args }, 'Tool call requested')
    toolCallsThisRequest.push(tool.name)
    return undefined
  }
})

/** Intercepts Gemini API errors and returns an in-character fallback instead of crashing. */
class ErrorRecoveryPlugin extends BasePlugin {
  async onModelErrorCallback({
    error
  }: {
    callbackContext: unknown
    llmRequest: unknown
    error: Error
  }): Promise<LlmResponse | undefined> {
    logger.error({ errorMessage: error.message }, 'Gemini API error intercepted')
    return { content: { role: 'model', parts: [{ text: getRandomFallback() }] } }
  }
}

const runner = new Runner({
  appName: APP_NAME,
  agent: rokaAgent,
  sessionService,
  plugins: [new ErrorRecoveryPlugin('error-recovery')]
})

// Per-channel idle timers — destroys the ADK session after TTL inactivity

const idleTimers = new Map<string, ReturnType<typeof setTimeout>>()

function resetIdleTimer(channelId: string): void {
  const existing = idleTimers.get(channelId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    logger.info({ channelId }, 'Session idle timeout')
    void destroySession(channelId)
  }, config.session.ttlMs)

  idleTimers.set(channelId, timer)
}

/** Retrieve or create an ADK session for the given channel. */
async function ensureSession(channelId: string) {
  let session = await sessionService.getSession({
    appName: APP_NAME,
    userId: channelId,
    sessionId: channelId
  })

  if (!session) {
    session = await sessionService.createSession({
      appName: APP_NAME,
      userId: channelId,
      sessionId: channelId,
      state: { participants: [] }
    })
    logger.info({ channelId }, 'ADK session created')

    // Cold-start rehydration: replay persisted history into the fresh ADK session
    try {
      const prior = loadHistory(channelId, config.session.windowSize)
      if (prior.length > 0) {
        for (const msg of prior) {
          const role = msg.role === 'user' ? 'user' : 'model'
          const content: Content = {
            role,
            parts: [
              {
                text: msg.role === 'user' ? `[${msg.displayName}]: ${msg.content}` : msg.content
              }
            ]
          }
          const event = createEvent({
            author: msg.role === 'user' ? 'user' : 'roka',
            invocationId: `rehydrate-${channelId}`,
            content
          })
          await sessionService.appendEvent({ session, event })
        }
        // Re-fetch session to pick up the newly added events
        session = (await sessionService.getSession({
          appName: APP_NAME,
          userId: channelId,
          sessionId: channelId
        }))!
        logger.info({ channelId, rehydratedMessages: prior.length }, 'Session rehydrated from SQLite')
      }
    } catch (error) {
      logger.warn({ channelId, error }, 'Failed to rehydrate session from SQLite')
    }
  }

  return session
}

/** Clear the idle timer and delete the ADK session for a channel. */
export async function destroySession(channelId: string): Promise<void> {
  const timer = idleTimers.get(channelId)
  if (timer) {
    clearTimeout(timer)
    idleTimers.delete(channelId)
  }

  try {
    await sessionService.deleteSession({
      appName: APP_NAME,
      userId: channelId,
      sessionId: channelId
    })
    logger.info({ channelId }, 'ADK session destroyed')
  } catch {
    // Session may not exist
  }
}

/** Destroy every active ADK session — called during graceful shutdown. */
export async function destroyAllSessions(): Promise<void> {
  const channels = [...idleTimers.keys()]
  for (const channelId of channels) {
    await destroySession(channelId)
  }
  logger.info('All ADK sessions destroyed')
}

/** Download an image and return its base64-encoded data, or null if it fails/exceeds 4 MB. */
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

/** Get the current hour (0-23) in the configured timezone, or system time as fallback. */
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

const KNOWN_FALLBACKS = new Set([
  'Hmm? Sorry, I spaced out for a moment there~',
  'Ah, what was that? I got distracted by something.',
  'Ahaha, my mind wandered. Say that again?',
  "I wasn't paying attention... don't tell anyone, okay?"
])

function getRandomFallback(): string {
  const fallbacks = [...KNOWN_FALLBACKS]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}

/** Convert ADK session events to WindowMessages for tone detection. */
function eventsToWindowMessages(events: Event[]): WindowMessage[] {
  return events
    .filter((e) => e.content?.parts?.some((p: Part) => p.text && !p.thought))
    .map((e) => ({
      role: (e.author === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      displayName: '',
      content: (e.content?.parts ?? [])
        .filter((p: Part) => p.text && !p.thought)
        .map((p: Part) => p.text)
        .join(' '),
      timestamp: e.timestamp ?? 0
    }))
}

/**
 * Generate an in-character response using the ADK agent pipeline.
 * @param options - Channel ID, user message, display name, and optional image attachments
 * @returns Response text and detected tone
 */
export async function generateResponse(options: GenerateOptions): Promise<GenerateResult> {
  const { channelId, userMessage, displayName, userId, imageAttachments } = options

  toolCallsThisRequest = []

  const session = await ensureSession(channelId)
  resetIdleTimer(channelId)

  // Track participants across the session
  const storedParticipants = (session.state?.participants as string[]) ?? []
  const participants = [...new Set([...storedParticipants, displayName])]

  // Detect tone from recent session history
  const fakeMessages = eventsToWindowMessages(session.events ?? [])
  const hour = getLocalHour()
  const tone = detectTone(fakeMessages, hour)

  let systemPrompt = assembleSystemPrompt({ tone, participants, hour, displayName })

  // Inject per-user relationship memory into the system prompt
  try {
    const userFacts = getAllFactsForPrompt(userId)
    if (userFacts) {
      systemPrompt += `\n\n## What You Remember About ${displayName}\n- ${userFacts}`
    }
  } catch (error) {
    logger.warn({ userId, error }, 'Failed to load user memory for prompt injection')
  }

  systemPrompt +=
    `\n\n- The current user's Discord ID is "${userId}".` +
    ' Use this ID (not their name) when calling remember_user or recall_user tools.'

  logger.debug({ tone, participantCount: participants.length, hour }, 'Prompt assembled')

  // Build user message content with optional images
  const imageParts: Part[] = []
  if (imageAttachments?.length) {
    const downloads = await Promise.all(imageAttachments.map((img) => downloadImage(img.url)))
    for (const result of downloads) {
      if (result) {
        imageParts.push({ inlineData: { data: result.data, mimeType: result.mimeType } })
      }
    }
    if (imageParts.length > 0) {
      logger.debug({ imageCount: imageParts.length }, 'Attached images to request')
    }
  }

  const newMessage: Content = {
    role: 'user',
    parts: [...imageParts, { text: `[${displayName}]: ${userMessage}` }]
  }

  logger.debug(
    { model: config.gemini.model, sessionEvents: session.events?.length ?? 0, hasImages: imageParts.length > 0 },
    'Sending ADK request'
  )

  try {
    let responseText = ''
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), config.gemini.timeout)

    try {
      for await (const event of runner.runAsync({
        userId: channelId,
        sessionId: channelId,
        newMessage,
        stateDelta: { _systemPrompt: systemPrompt, participants, _userId: userId, _channelId: channelId },
        runConfig: { maxLlmCalls: 4 }
      })) {
        if (abortController.signal.aborted) break
        if (isFinalResponse(event) && event.content?.parts) {
          responseText = event.content.parts
            .filter((p: Part) => p.text && !p.thought)
            .map((p: Part) => p.text)
            .join('')
            .trim()
        }
      }
    } finally {
      clearTimeout(timeoutId)
    }

    if (abortController.signal.aborted && !responseText) {
      logger.warn({ channelId }, 'Client-side timeout triggered for ADK runner')
      responseText = getRandomFallback()
    }

    if (!responseText) {
      responseText = getRandomFallback()
    }

    // Destroy session if a fallback response was returned to prevent corrupted history
    // (e.g. ErrorRecoveryPlugin injecting model text after a functionCall turn)
    if (KNOWN_FALLBACKS.has(responseText)) {
      logger.warn({ channelId }, 'Fallback response detected, destroying session to prevent history corruption')
      await destroySession(channelId)
    }

    // Log tool fallback chains when multiple tools were called in a single request
    if (toolCallsThisRequest.length > 1) {
      logger.info({ tools: toolCallsThisRequest }, 'Tool fallback chain detected')
    }

    // Write-behind: persist the exchange to SQLite (non-blocking — failures don't break the response)
    if (!KNOWN_FALLBACKS.has(responseText)) {
      try {
        saveMessage(channelId, 'user', displayName, userMessage)
        saveMessage(channelId, 'assistant', 'Roka', responseText)
      } catch (error) {
        logger.warn({ channelId, error }, 'Failed to persist messages to SQLite')
      }
    }

    logger.debug({ responseLength: responseText.length }, 'ADK response extracted')
    return { text: responseText, tone }
  } catch (error) {
    const errDetail = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    logger.error({ error: errDetail, channelId }, 'ADK request failed')

    // If session is corrupted or too large, destroy it so the next request starts fresh.
    if (error instanceof SyntaxError) {
      logger.warn({ channelId }, 'Session likely corrupted, destroying for recovery')
      await destroySession(channelId)
    }

    throw error
  }
}
