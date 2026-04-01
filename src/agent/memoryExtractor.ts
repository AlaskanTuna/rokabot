/**
 * Background memory extraction — passively extracts user facts from conversations.
 * When the passive buffer reaches 20 messages in a monitored channel, snapshots the
 * buffer and fires a background Gemini call to extract personal facts for all users.
 * Non-blocking: runs as a detached promise, never interrupts the live conversation.
 */

import { GoogleGenAI } from '@google/genai'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { saveFact, getFacts } from '../storage/userMemory.js'
import { getMessages, clearBuffer, type BufferedMessage } from './passiveBuffer.js'

const EXTRACTION_INTERVAL = 20
const MIN_RPM_HEADROOM = 3

// Simple self-rate-limit: track last extraction time
let lastExtractionTime = 0
const MIN_EXTRACTION_GAP_MS = 10_000 // At least 10s between extractions

// Lazy-init Gemini client
let genaiClient: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!genaiClient) {
    genaiClient = new GoogleGenAI({ apiKey: config.gemini.apiKey })
  }
  return genaiClient
}

const EXTRACTION_PROMPT = `You are a fact extractor. Given a conversation between users and an assistant, extract personal facts about the USERS (not the assistant).

Rules:
- Only extract concrete, reusable facts: names/nicknames, preferences, favorites, hobbies, birthdays, locations, relationships
- Do NOT extract temporary states ("I'm hungry right now"), opinions about the conversation, or facts about the assistant
- Do NOT extract facts that are questions or uncertain ("I might like...")
- Each fact needs: the user's name (from the [Name] prefix), a short key, and the value
- If no facts are worth extracting, return an empty array

Return ONLY a JSON array, no markdown, no explanation:
[{"userId":"Alice","key":"favorite_anime","value":"Frieren"},{"userId":"Bob","key":"nickname","value":"Ali"}]
Or if none: []

Conversation:
`

interface ExtractedFact {
  userId: string
  key: string
  value: string
}

/**
 * Called when the passive buffer reaches capacity.
 * Checks rate limits and fires background extraction from the passive buffer.
 */
export function maybeExtractFromBuffer(channelId: string): void {
  const messages = getMessages(channelId)
  if (messages.length < 10) return // Not enough context

  // Self-rate-limit
  const now = Date.now()
  if (now - lastExtractionTime < MIN_EXTRACTION_GAP_MS) return
  lastExtractionTime = now

  // Clear buffer immediately so new messages start a fresh batch
  clearBuffer(channelId)

  // Fire and forget
  void runBufferExtraction(channelId, messages).catch((error) => {
    logger.warn({ channelId, error }, 'Passive buffer memory extraction failed')
  })
}

/** Run extraction from the passive buffer messages. */
async function runBufferExtraction(channelId: string, messages: BufferedMessage[]): Promise<void> {
  // Format only user messages for extraction
  const conversationText = messages.map((m) => `[${m.displayName}]: ${m.content}`).join('\n')

  if (!conversationText.trim()) return

  const prompt = EXTRACTION_PROMPT + conversationText

  // Build userMap from the messages directly
  const userMap = new Map<string, string>()
  for (const m of messages) {
    userMap.set(m.displayName, m.userId)
  }

  try {
    const client = getClient()
    const response = await client.models.generateContent({
      model: config.gemini.model,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 200,
        httpOptions: { timeout: 15_000 }
      }
    })

    const text = response.text?.trim()
    if (!text) return

    const facts = parseFacts(text)
    if (facts.length === 0) return

    let savedCount = 0
    for (const fact of facts) {
      // The extraction prompt uses displayName — resolve to Discord user ID
      const resolvedUserId = userMap.get(fact.userId) ?? fact.userId
      const existingFacts = getFacts(resolvedUserId)
      const alreadyExists = existingFacts.some((f) => f.key === fact.key && f.value === fact.value)
      if (!alreadyExists) {
        saveFact(resolvedUserId, fact.key, fact.value)
        savedCount++
      }
    }

    if (savedCount > 0) {
      logger.info(
        { channelId, extracted: facts.length, saved: savedCount },
        'Passive buffer memory extraction complete'
      )
    }
  } catch (error) {
    logger.warn({ channelId, error }, 'Memory extraction Gemini call failed')
  }
}

/** Parse the JSON array from the LLM response, handling common formatting issues. */
function parseFacts(text: string): ExtractedFact[] {
  try {
    // Strip markdown code fences if present
    let cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '')
    cleaned = cleaned.trim()

    if (cleaned === '[]' || !cleaned.startsWith('[')) return []

    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (f: unknown): f is ExtractedFact =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as ExtractedFact).userId === 'string' &&
        typeof (f as ExtractedFact).key === 'string' &&
        typeof (f as ExtractedFact).value === 'string' &&
        (f as ExtractedFact).key.length > 0 &&
        (f as ExtractedFact).value.length > 0
    )
  } catch {
    logger.debug({ text }, 'Failed to parse memory extraction response')
    return []
  }
}

/** Reset state — for testing. */
export function resetCounters(): void {
  lastExtractionTime = 0
}

/** Exposed for testing. */
export { parseFacts as _parseFacts, EXTRACTION_INTERVAL }
