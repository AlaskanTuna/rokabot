import { config } from '../../config.js'

export interface GetCurrentTimeParams {
  location?: string
  format?: '12h' | '24h'
}

export interface GetCurrentTimeResult {
  time: string
  date: string
  day: string
  timezone: string
}

const cityToTimezone: Record<string, string> = {
  tokyo: 'Asia/Tokyo',
  london: 'Europe/London',
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  chicago: 'America/Chicago',
  denver: 'America/Denver',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  moscow: 'Europe/Moscow',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  beijing: 'Asia/Shanghai',
  shanghai: 'Asia/Shanghai',
  seoul: 'Asia/Seoul',
  singapore: 'Asia/Singapore',
  dubai: 'Asia/Dubai',
  mumbai: 'Asia/Kolkata',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta',
  'hong kong': 'Asia/Hong_Kong',
  taipei: 'Asia/Taipei',
  toronto: 'America/Toronto',
  'sao paulo': 'America/Sao_Paulo',
  cairo: 'Africa/Cairo'
}

function resolveTimezone(location?: string): string {
  if (!location) {
    return config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  if (location.includes('/')) {
    return location
  }

  const key = location.toLowerCase().trim()
  return cityToTimezone[key] ?? config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function getCurrentTime(params: GetCurrentTimeParams): GetCurrentTimeResult {
  const timezone = resolveTimezone(params.location)
  const use12h = params.format === '12h'
  const now = new Date()

  const time = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: use12h,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const date = now.toLocaleDateString('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const day = now.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long'
  })

  return { time, date, day, timezone }
}
