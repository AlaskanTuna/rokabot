import { FunctionTool } from '@google/adk'
import { Type } from '@google/genai'
import type { FunctionDeclaration } from '@google/genai'
import { z } from 'zod'
import { rollDice, type RollDiceParams } from './rollDice.js'
import { flipCoin } from './flipCoin.js'
import { getCurrentTime, type GetCurrentTimeParams } from './getCurrentTime.js'
import { searchAnime, type SearchAnimeParams } from './searchAnime.js'
import { getAnimeSchedule, type GetAnimeScheduleParams } from './getAnimeSchedule.js'
import { getWeather, type GetWeatherParams } from './getWeather.js'

export { rollDice, flipCoin, getCurrentTime, searchAnime, getAnimeSchedule, getWeather }
export type { RollDiceParams, GetCurrentTimeParams, SearchAnimeParams, GetAnimeScheduleParams, GetWeatherParams }

// ADK FunctionTool definitions with Zod schemas.

export const rollDiceTool = new FunctionTool({
  name: 'roll_dice',
  description: 'Roll dice. Use when someone wants to roll dice or play a dice game.',
  parameters: z.object({
    count: z.number().int().describe('Number of dice to roll (1-10)').optional(),
    sides: z.number().int().describe('Number of sides per die (2-100)').optional()
  }),
  execute: async (input) => rollDice(input)
})

export const flipCoinTool = new FunctionTool({
  name: 'flip_coin',
  description: 'Flip a coin. Use when someone wants to flip a coin or make a random heads/tails choice.',
  execute: async () => flipCoin()
})

export const getCurrentTimeTool = new FunctionTool({
  name: 'get_current_time',
  description:
    'Get the current time, date, and day of the week for a location. IMPORTANT: Always report the exact time returned by this tool — never estimate or guess the time yourself.',
  parameters: z.object({
    location: z
      .string()
      .describe('IANA timezone (e.g. Asia/Tokyo) or city name (e.g. London). Defaults to configured timezone.')
      .optional(),
    format: z.enum(['12h', '24h']).describe('Time format: 12h or 24h. Defaults to 24h.').optional()
  }),
  execute: async (input) => getCurrentTime(input)
})

export const searchAnimeTool = new FunctionTool({
  name: 'search_anime',
  description:
    'Search for anime by title or keyword. Use when someone asks about a specific anime, wants recommendations, or wants to look up anime information.',
  parameters: z.object({
    query: z.string().describe('Anime title or search keyword'),
    limit: z.number().int().describe('Number of results to return (1-25). Defaults to 5.').optional(),
    sort_by: z
      .enum(['score', 'popularity', 'members', 'title', 'start_date'])
      .describe('Sort results by. Defaults to relevance.')
      .optional(),
    type: z.enum(['tv', 'movie', 'ova', 'special', 'ona', 'music']).describe('Filter by anime type.').optional(),
    status: z.enum(['airing', 'complete', 'upcoming']).describe('Filter by airing status.').optional()
  }),
  execute: async (input) => await searchAnime(input)
})

export const getAnimeScheduleTool = new FunctionTool({
  name: 'get_anime_schedule',
  description:
    'Get the anime airing schedule. Can check a specific day, the full week, or current season. Can also look up broadcast times for a specific anime by name.',
  parameters: z.object({
    scope: z
      .enum(['day', 'week', 'season'])
      .describe('Time range: day (single day), week (full week), or season (current season). Defaults to day.')
      .optional(),
    day: z
      .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
      .describe('Day of the week (only used when scope is day). Defaults to today.')
      .optional(),
    sort_by: z
      .enum(['score', 'popularity', 'members', 'title'])
      .describe('Sort results by. Defaults to score.')
      .optional(),
    limit: z.number().int().describe('Number of results to return (1-25). Defaults to 5.').optional(),
    anime: z
      .string()
      .describe(
        'Search for a specific anime by name to get its broadcast schedule. When provided, overrides scope/sort/limit.'
      )
      .optional()
  }),
  execute: async (input) => await getAnimeSchedule({ scope: input.scope ?? 'day', ...input })
})

export const getWeatherTool = new FunctionTool({
  name: 'get_weather',
  description:
    'Get the current weather for a city. Use when someone asks about the weather, temperature, or conditions in a location.',
  parameters: z.object({
    city: z.string().describe('City name to get weather for')
  }),
  execute: async (input) => await getWeather(input)
})

// All ADK FunctionTool instances for use with LlmAgent.
export const rokaTools = [
  rollDiceTool,
  flipCoinTool,
  getCurrentTimeTool,
  searchAnimeTool,
  getAnimeScheduleTool,
  getWeatherTool
]

// Legacy exports for roka.ts pre-ADK migration, will be removed.

export function getToolDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: 'roll_dice',
      description: 'Roll dice. Use when someone wants to roll dice or play a dice game.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          count: { type: Type.INTEGER, description: 'Number of dice to roll (1-10)' },
          sides: { type: Type.INTEGER, description: 'Number of sides per die (2-100)' }
        }
      }
    },
    {
      name: 'flip_coin',
      description: 'Flip a coin. Use when someone wants to flip a coin or make a random heads/tails choice.'
    },
    {
      name: 'get_current_time',
      description:
        'Get the current time, date, and day of the week for a location. IMPORTANT: Always report the exact time returned by this tool — never estimate or guess the time yourself.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          location: {
            type: Type.STRING,
            description: 'IANA timezone (e.g. Asia/Tokyo) or city name (e.g. London). Defaults to configured timezone.'
          },
          format: {
            type: Type.STRING,
            description: 'Time format: 12h or 24h. Defaults to 24h.',
            enum: ['12h', '24h']
          }
        }
      }
    },
    {
      name: 'search_anime',
      description:
        'Search for anime by title or keyword. Use when someone asks about a specific anime, wants recommendations, or wants to look up anime information.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Anime title or search keyword' },
          limit: { type: Type.INTEGER, description: 'Number of results to return (1-25). Defaults to 5.' },
          sort_by: {
            type: Type.STRING,
            description: 'Sort results by. Defaults to relevance.',
            enum: ['score', 'popularity', 'members', 'title', 'start_date']
          },
          type: {
            type: Type.STRING,
            description: 'Filter by anime type.',
            enum: ['tv', 'movie', 'ova', 'special', 'ona', 'music']
          },
          status: {
            type: Type.STRING,
            description: 'Filter by airing status.',
            enum: ['airing', 'complete', 'upcoming']
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_anime_schedule',
      description:
        'Get the anime airing schedule. Can check a specific day, the full week, or current season. Can also look up broadcast times for a specific anime by name.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          scope: {
            type: Type.STRING,
            description: 'Time range: day (single day), week (full week), or season (current season). Defaults to day.',
            enum: ['day', 'week', 'season']
          },
          day: {
            type: Type.STRING,
            description: 'Day of the week (only used when scope is day). Defaults to today.',
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
          },
          sort_by: {
            type: Type.STRING,
            description: 'Sort results by. Defaults to score.',
            enum: ['score', 'popularity', 'members', 'title']
          },
          limit: {
            type: Type.INTEGER,
            description: 'Number of results to return (1-25). Defaults to 5.'
          },
          anime: {
            type: Type.STRING,
            description:
              'Search for a specific anime by name to get its broadcast schedule. When provided, overrides scope/sort/limit.'
          }
        }
      }
    },
    {
      name: 'get_weather',
      description:
        'Get the current weather for a city. Use when someone asks about the weather, temperature, or conditions in a location.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          city: { type: Type.STRING, description: 'City name to get weather for' }
        },
        required: ['city']
      }
    }
  ]
}

export async function executeToolCall(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (name) {
    case 'roll_dice':
      return rollDice(args as RollDiceParams) as unknown as Record<string, unknown>
    case 'flip_coin':
      return flipCoin() as unknown as Record<string, unknown>
    case 'get_current_time':
      return getCurrentTime(args as GetCurrentTimeParams) as unknown as Record<string, unknown>
    case 'search_anime':
      return (await searchAnime(args as unknown as SearchAnimeParams)) as unknown as Record<string, unknown>
    case 'get_anime_schedule':
      return (await getAnimeSchedule(args as unknown as GetAnimeScheduleParams)) as unknown as Record<string, unknown>
    case 'get_weather':
      return (await getWeather(args as unknown as GetWeatherParams)) as unknown as Record<string, unknown>
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
