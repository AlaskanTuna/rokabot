import { config } from '../../config.js'
import { logger } from '../../utils/logger.js'
import { jikanThrottle } from './jikanThrottle.js'

export interface GetAnimeScheduleParams {
  day?: string
}

export interface ScheduleEntry {
  title: string
  type: string
  episodes: number | null
  score: number | null
  url: string
}

export interface GetAnimeScheduleResult {
  day: string
  entries: ScheduleEntry[]
}

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

interface JikanScheduleEntry {
  title?: string
  type?: string
  episodes?: number | null
  score?: number | null
  url?: string
}

interface JikanScheduleResponse {
  data?: JikanScheduleEntry[]
}

function getTodayName(): string {
  const tz = config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const dayName = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })
  return dayName.toLowerCase()
}

export async function getAnimeSchedule(params: GetAnimeScheduleParams): Promise<GetAnimeScheduleResult> {
  const day = (params.day?.toLowerCase().trim() || getTodayName()) as string

  if (!VALID_DAYS.includes(day as (typeof VALID_DAYS)[number])) {
    return { day, entries: [] }
  }

  try {
    await jikanThrottle()

    const url = `https://api.jikan.moe/v4/schedules?filter=${encodeURIComponent(day)}&limit=15&sfw=true`
    const response = await fetch(url)

    if (!response.ok) {
      logger.warn({ status: response.status, url }, 'Jikan schedule API error')
      return { day, entries: [] }
    }

    const body = (await response.json()) as JikanScheduleResponse
    const data = body.data ?? []

    const entries: ScheduleEntry[] = data.map((entry) => ({
      title: entry.title ?? 'Unknown',
      type: entry.type ?? 'Unknown',
      episodes: entry.episodes ?? null,
      score: entry.score ?? null,
      url: entry.url ?? ''
    }))

    return { day, entries }
  } catch (error) {
    logger.error({ error, day }, 'Failed to fetch anime schedule')
    return { day, entries: [] }
  }
}
