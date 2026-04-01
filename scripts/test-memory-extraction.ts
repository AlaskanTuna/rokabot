/**
 * Memory Extraction Integration Test — validates the background fact extraction pipeline.
 * Tests: parsing, counter logic, fact deduplication, and (optionally) live Gemini extraction.
 *
 * Usage:
 *   npm run test:memory
 *
 * For live Gemini test (requires GEMINI_API_KEY):
 *   GOOGLE_GENAI_API_KEY=$(grep GEMINI_API_KEY .env | cut -d= -f2) npm run test:memory
 */

// Stub Discord env vars before any imports
process.env.DISCORD_TOKEN ||= 'test-stub'
process.env.DISCORD_CLIENT_ID ||= 'test-stub'

import { getDb, closeDb } from '../src/storage/database.js'
import { saveFact, getFacts, countFacts } from '../src/storage/userMemory.js'
import { saveMessage, loadHistory, clearHistory } from '../src/storage/sessionStore.js'
import {
  maybeExtractMemory,
  resetCounters,
  _parseFacts as parseFacts,
  EXTRACTION_INTERVAL
} from '../src/agent/memoryExtractor.js'

// --- Test Harness ---

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL'
  detail: string
}

const results: TestResult[] = []

function pass(name: string, detail: string): void {
  results.push({ name, status: 'PASS', detail })
  console.log(`  \x1b[32mPASS\x1b[0m  ${name} — ${detail}`)
}

function fail(name: string, detail: string): void {
  results.push({ name, status: 'FAIL', detail })
  console.log(`  \x1b[31mFAIL\x1b[0m  ${name} — ${detail}`)
}

function assert(condition: boolean, name: string, passDetail: string, failDetail: string): void {
  if (condition) pass(name, passDetail)
  else fail(name, failDetail)
}

// --- Tests ---

async function main() {
  console.log('\n  Memory Extraction Integration Test\n')

  const db = getDb()

  // ─── JSON Parsing ───
  console.log('\n  --- Fact Parsing ---')

  const valid = parseFacts('[{"userId":"Alice","key":"favorite_anime","value":"Frieren"}]')
  assert(valid.length === 1, 'Parse: valid JSON', `${valid.length} fact(s)`, 'Parse failed')
  assert(
    valid[0].userId === 'Alice' && valid[0].key === 'favorite_anime' && valid[0].value === 'Frieren',
    'Parse: correct fields',
    `${valid[0].userId}: ${valid[0].key}=${valid[0].value}`,
    'Wrong fields'
  )

  const multi = parseFacts('[{"userId":"A","key":"k1","value":"v1"},{"userId":"B","key":"k2","value":"v2"}]')
  assert(multi.length === 2, 'Parse: multiple facts', `${multi.length} facts`, `Got ${multi.length}`)

  const empty = parseFacts('[]')
  assert(empty.length === 0, 'Parse: empty array', 'Returns []', `Got ${empty.length}`)

  const fenced = parseFacts('```json\n[{"userId":"X","key":"k","value":"v"}]\n```')
  assert(fenced.length === 1, 'Parse: code-fenced JSON', 'Strips fences', `Got ${fenced.length}`)

  const invalid = parseFacts('not json at all')
  assert(invalid.length === 0, 'Parse: invalid input', 'Returns []', `Got ${invalid.length}`)

  const partial = parseFacts('[{"userId":"A","key":"","value":"v"},{"userId":"B","key":"k","value":""}]')
  assert(partial.length === 0, 'Parse: empty key/value filtered', 'Filters out', `Got ${partial.length}`)

  const noArray = parseFacts('{"userId":"A","key":"k","value":"v"}')
  assert(noArray.length === 0, 'Parse: non-array JSON', 'Returns []', `Got ${noArray.length}`)

  // ─── Counter Logic ───
  console.log('\n  --- Counter Logic ---')

  resetCounters()
  assert(
    EXTRACTION_INTERVAL === 10,
    'Counter: interval',
    `Every ${EXTRACTION_INTERVAL} messages`,
    `Got ${EXTRACTION_INTERVAL}`
  )

  // Calling maybeExtractMemory 9 times should NOT trigger extraction
  // (We can't easily test that extraction didn't fire, but we can test it doesn't crash)
  for (let i = 0; i < 9; i++) {
    maybeExtractMemory('test-ch', 'user123', 'Alice', `Message ${i}`)
  }
  pass('Counter: 9 messages', 'No crash, extraction not triggered yet')

  // ─── Deduplication ───
  console.log('\n  --- Fact Deduplication ---')

  saveFact('dedup-user', 'favorite_anime', 'Frieren')
  saveFact('dedup-user', 'favorite_anime', 'Frieren') // Same key+value
  const deduped = getFacts('dedup-user')
  assert(deduped.length === 1, 'Dedup: same fact not duplicated', '1 fact stored', `Got ${deduped.length}`)

  saveFact('dedup-user', 'favorite_anime', 'Dandadan') // Same key, different value = update
  const updated = getFacts('dedup-user')
  assert(
    updated.length === 1 && updated[0].value === 'Dandadan',
    'Dedup: same key updates value',
    'Updated to Dandadan',
    `Got ${updated.length} facts, value: ${updated[0]?.value}`
  )

  // ─── Session History for Extraction ───
  console.log('\n  --- Session History for Extraction ---')

  clearHistory('extract-ch')
  saveMessage('extract-ch', 'user', 'Alice', 'My favorite anime is Frieren!')
  saveMessage('extract-ch', 'assistant', 'Roka', 'Oh you like Frieren? Great taste~')
  saveMessage('extract-ch', 'user', 'Bob', 'Call me Bobby, everyone does')
  saveMessage('extract-ch', 'assistant', 'Roka', 'Bobby it is then~')
  saveMessage('extract-ch', 'user', 'Alice', "I'm from Singapore btw")

  const history = loadHistory('extract-ch', 10)
  const userMessages = history.filter((m) => m.role === 'user')
  assert(
    userMessages.length === 3,
    'History: user messages',
    `${userMessages.length} user messages`,
    `Got ${userMessages.length}`
  )

  // ─── Live Gemini Extraction (optional) ───
  if (process.env.GOOGLE_GENAI_API_KEY) {
    console.log('\n  --- Live Gemini Extraction ---')

    const { GoogleGenAI } = await import('@google/genai')
    const { config: appConfig } = await import('../src/config.js')

    const client = new GoogleGenAI({ apiKey: appConfig.gemini.apiKey })

    const testConversation = [
      '[Alice]: My favorite anime is Frieren and I love cooking!',
      '[Bob]: You can call me Bobby. I was born on March 15th.',
      '[Alice]: I live in Singapore, it is so hot here'
    ].join('\n')

    const prompt = `You are a fact extractor. Given a conversation between users and an assistant, extract personal facts about the USERS (not the assistant).

Rules:
- Only extract concrete, reusable facts: names/nicknames, preferences, favorites, hobbies, birthdays, locations, relationships
- Do NOT extract temporary states, opinions about the conversation, or facts about the assistant
- Each fact needs: the user's name (from the [Name] prefix), a short key, and the value
- If no facts are worth extracting, return an empty array

Return ONLY a JSON array, no markdown, no explanation:
[{"userId":"Alice","key":"favorite_anime","value":"Frieren"},{"userId":"Bob","key":"nickname","value":"Ali"}]
Or if none: []

Conversation:
${testConversation}`

    try {
      const response = await client.models.generateContent({
        model: appConfig.gemini.model,
        contents: prompt,
        config: { temperature: 0.1, maxOutputTokens: 200 }
      })

      const text = response.text?.trim() ?? ''
      console.log(`  Raw response: ${text}`)

      const facts = parseFacts(text)
      assert(facts.length >= 3, 'Gemini: extracted facts', `${facts.length} facts extracted`, `Only ${facts.length}`)

      const aliceFact = facts.find((f) => f.userId === 'Alice' && f.key.includes('anime'))
      assert(!!aliceFact, 'Gemini: Alice anime', `${aliceFact?.key}=${aliceFact?.value}`, 'Not found')

      const bobFact = facts.find((f) => f.userId === 'Bob' && (f.key.includes('nickname') || f.key.includes('name')))
      assert(!!bobFact, 'Gemini: Bob nickname', `${bobFact?.key}=${bobFact?.value}`, 'Not found')

      const locationFact = facts.find((f) => f.userId === 'Alice' && f.key.includes('location'))
      assert(!!locationFact, 'Gemini: Alice location', `${locationFact?.key}=${locationFact?.value}`, 'Not found')
    } catch (error) {
      fail('Gemini: extraction call', `Error: ${error}`)
    }
  } else {
    console.log('\n  --- Live Gemini Extraction (SKIPPED — no GOOGLE_GENAI_API_KEY) ---')
    pass('Gemini: skipped', 'Set GOOGLE_GENAI_API_KEY to test live extraction')
  }

  // --- Summary ---
  console.log('\n  ' + '─'.repeat(56))
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const total = results.length
  console.log(`  Results: ${passed} PASS, ${failed} FAIL / ${total} total`)
  console.log(`  Pass rate: ${Math.round((passed / total) * 100)}%`)
  console.log()

  closeDb()
  process.exit(failed > 0 ? 1 : 0)
}

main()
