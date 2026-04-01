/**
 * Background memory extraction — passively extracts user facts from conversations.
 * Every 10 messages in a channel, snapshots the conversation window and fires a
 * background Gemini call to extract personal facts for all users in the window.
 * Non-blocking: runs as a detached promise, never interrupts the live conversation.
 */

import { GoogleGenAI } from '@google/genai'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { saveFact, getFacts } from '../storage/userMemory.js'
import { loadHistory } from '../storage/sessionStore.js'

const EXTRACTION_INTERVAL = 10
const MIN_RPM_HEADROOM = 3

// Per-channel message counters and user ID mappings
const messageCounters = new Map<string, number>()
const channelUserMappings = new Map<string, Map<string, string>>() // channelId → (displayName → userId)

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
 * Called after each successful message exchange. Increments the per-channel counter
 * and triggers background extraction at every Nth message.
 */
export function maybeExtractMemory(channelId: string, userId: string, displayName: string, userMessage: string): void {
  // Track displayName → userId mapping for this channel
  if (!channelUserMappings.has(channelId)) {
    channelUserMappings.set(channelId, new Map())
  }
  channelUserMappings.get(channelId)!.set(displayName, userId)

  const count = (messageCounters.get(channelId) ?? 0) + 1
  messageCounters.set(channelId, count)

  if (count < EXTRACTION_INTERVAL) return

  // Reset counter
  messageCounters.set(channelId, 0)

  // Self-rate-limit: don't extract too frequently
  const now = Date.now()
  if (now - lastExtractionTime < MIN_EXTRACTION_GAP_MS) {
    logger.debug({ channelId }, 'Memory extraction skipped (too recent)')
    return
  }
  lastExtractionTime = now

  // Fire and forget — never block the response
  void runExtraction(channelId).catch((error) => {
    logger.warn({ channelId, error }, 'Background memory extraction failed')
  })
}

/** Run the actual extraction: load history, call Gemini, save facts. */
async function runExtraction(channelId: string): Promise<void> {
  const history = loadHistory(channelId, EXTRACTION_INTERVAL)
  if (history.length < 3) return // Not enough context

  // Format messages for extraction — use displayName since that's what session_history stores
  const conversationText = history
    .filter((m) => m.role === 'user')
    .map((m) => `[${m.displayName}]: ${m.content}`)
    .join('\n')

  if (!conversationText.trim()) return

  const prompt = EXTRACTION_PROMPT + conversationText

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

    // Resolve displayName → Discord userId using the channel mapping
    const userMap = channelUserMappings.get(channelId) ?? new Map()

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
      logger.info({ channelId, extracted: facts.length, saved: savedCount }, 'Background memory extraction complete')
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

/** Reset counters — for testing. */
export function resetCounters(): void {
  messageCounters.clear()
  lastExtractionTime = 0
}

/** Exposed for testing. */
export { parseFacts as _parseFacts, EXTRACTION_INTERVAL }
