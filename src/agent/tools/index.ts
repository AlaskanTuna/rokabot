import { FunctionTool } from '@google/adk'
import { z } from 'zod'
import { rollDice } from './rollDice.js'
import { flipCoin } from './flipCoin.js'
import { getCurrentTime } from './getCurrentTime.js'
import { searchAnime } from './searchAnime.js'
import { getAnimeSchedule } from './getAnimeSchedule.js'
import { getWeather } from './getWeather.js'

export { rollDice, flipCoin, getCurrentTime, searchAnime, getAnimeSchedule, getWeather }
export type { RollDiceParams } from './rollDice.js'
export type { GetCurrentTimeParams } from './getCurrentTime.js'
export type { SearchAnimeParams } from './searchAnime.js'
export type { GetAnimeScheduleParams } from './getAnimeSchedule.js'
export type { GetWeatherParams } from './getWeather.js'

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
