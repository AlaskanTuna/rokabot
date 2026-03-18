/**
 * Interactive CLI chat with Roka.
 * Uses the full prompt pipeline: tone detection -> prompt assembly -> Gemini API.
 *
 * Usage:
 *   npx tsx scripts/test-chat.ts [displayName]
 *
 * Requires GEMINI_API_KEY in .env (DISCORD_TOKEN and DISCORD_CLIENT_ID
 * are stubbed automatically since they are not needed for CLI testing).
 */

import * as readline from 'node:readline'

// Stub Discord env vars BEFORE dotenv loads, so config.ts never throws
process.env.DISCORD_TOKEN ||= 'cli-test-stub'
process.env.DISCORD_CLIENT_ID ||= 'cli-test-stub'

// Now load .env (won't overwrite the stubs since they're already set)
await import('dotenv/config')

// Check early so we get a friendly message instead of a config.ts stack trace
if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not set. Add it to your .env file.')
  process.exit(1)
}

// Dynamic imports so env stubs above take effect before config.ts runs
const { generateResponse } = await import('../src/agent/roka.js')
const { detectTone } = await import('../src/agent/toneDetector.js')
const { config } = await import('../src/config.js')
const { logger } = await import('../src/utils/logger.js')

type WindowMessage = import('../src/session/types.js').WindowMessage

const MAX_HISTORY = config.session.windowSize
const displayName = process.argv[2] ?? 'Tester'

const history: WindowMessage[] = []

function addToHistory(role: 'user' | 'assistant', name: string, content: string): void {
  history.push({ role, displayName: name, content, timestamp: Date.now() })
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY)
  }
}

async function handleInput(line: string, rl: readline.Interface): Promise<void> {
  const trimmed = line.trim()
  if (!trimmed) {
    rl.prompt()
    return
  }

  if (trimmed === 'quit' || trimmed === 'exit') {
    console.log('\nBye bye~ See you next time!')
    rl.close()
    return
  }

  addToHistory('user', displayName, trimmed)

  const tone = detectTone(history)
  console.log(`  [tone: ${tone}]`)

  try {
    const response = await generateResponse({
      userMessage: trimmed,
      displayName,
      channelHistory: history.slice(0, -1),
      participants: [displayName]
    })

    console.log(`Roka: ${response}\n`)
    addToHistory('assistant', 'Roka', response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`  [error: ${msg}]\n`)
  }

  rl.prompt()
}

function main(): void {
  console.log('='.repeat(60))
  console.log('  Roka Test Chat')
  console.log('  Talking to Maniwa Roka via the full prompt pipeline.')
  console.log(`  Display name: ${displayName}`)
  console.log(`  History window: ${MAX_HISTORY} messages`)
  console.log(`  Log level: ${config.logging.level} (set LOG_LEVEL in .env to change)`)
  console.log('  Type "quit" or "exit" to end. Ctrl+C also works.')
  console.log('='.repeat(60))
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: '
  })

  rl.prompt()

  rl.on('line', (line) => {
    handleInput(line, rl)
  })

  rl.on('close', () => {
    console.log()
    process.exit(0)
  })
}

main()
