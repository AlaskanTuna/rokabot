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

export async function generateResponse(options: GenerateOptions): Promise<string> {
  const { userMessage, displayName, channelHistory, participants } = options

  const tone = detectTone(channelHistory)
  const hour = new Date().getHours()

  const assemblerInput: AssemblerInput = { tone, participants, hour }
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

    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 512,
        temperature: 0.9,
        topP: 0.95
      }
    })

    const text = response.text?.trim()

    if (!text) {
      logger.warn('Empty response from Gemini')
      return getRandomFallback()
    }

    return text
  } catch (error) {
    logger.error({ error }, 'Gemini API call failed')
    throw error
  }
}

function getRandomFallback(): string {
  const fallbacks = [
    'Hmm? Sorry, I spaced out for a moment there~',
    'Ah, what was that? I got distracted by something.',
    'Fufu~ my mind wandered. Say that again?',
    "Mou, I wasn't paying attention... don't tell anyone, okay?"
  ]
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}
