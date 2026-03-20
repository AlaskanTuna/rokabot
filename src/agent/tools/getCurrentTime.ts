import { config } from '../../config.js'

export interface GetCurrentTimeParams {
  location?: string
  format?: '12h' | '24h'
}

export interface GetCurrentTimeResult {
  location: string
  time: string
  date: string
  day: string
  timezone: string
}

const cityToTimezone: Record<string, string> = {
  // Asia
  tokyo: 'Asia/Tokyo',
  osaka: 'Asia/Tokyo',
  kyoto: 'Asia/Tokyo',
  seoul: 'Asia/Seoul',
  beijing: 'Asia/Shanghai',
  shanghai: 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  taipei: 'Asia/Taipei',
  singapore: 'Asia/Singapore',
  malaysia: 'Asia/Kuala_Lumpur',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta',
  manila: 'Asia/Manila',
  mumbai: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  dubai: 'Asia/Dubai',

  // Europe
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  madrid: 'Europe/Madrid',
  rome: 'Europe/Rome',
  amsterdam: 'Europe/Amsterdam',
  brussels: 'Europe/Brussels',
  vienna: 'Europe/Vienna',
  zurich: 'Europe/Zurich',
  stockholm: 'Europe/Stockholm',
  oslo: 'Europe/Oslo',
  copenhagen: 'Europe/Copenhagen',
  helsinki: 'Europe/Helsinki',
  warsaw: 'Europe/Warsaw',
  prague: 'Europe/Prague',
  budapest: 'Europe/Budapest',
  bucharest: 'Europe/Bucharest',
  athens: 'Europe/Athens',
  istanbul: 'Europe/Istanbul',
  lisbon: 'Europe/Lisbon',
  dublin: 'Europe/Dublin',
  moscow: 'Europe/Moscow',

  // Americas
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  chicago: 'America/Chicago',
  denver: 'America/Denver',
  toronto: 'America/Toronto',
  vancouver: 'America/Vancouver',
  'mexico city': 'America/Mexico_City',
  'sao paulo': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',

  // Oceania & Africa
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  auckland: 'Pacific/Auckland',
  cairo: 'Africa/Cairo',
  johannesburg: 'Africa/Johannesburg',
  nairobi: 'Africa/Nairobi'
}

function resolveTimezone(location?: string): { timezone: string; resolved: boolean } {
  if (!location) {
    return { timezone: config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, resolved: true }
  }

  // Direct IANA timezone (contains '/')
  if (location.includes('/')) {
    return { timezone: location, resolved: true }
  }

  const key = location.toLowerCase().trim()
  const mapped = cityToTimezone[key]
  if (mapped) {
    return { timezone: mapped, resolved: true }
  }

  // Unknown city — try using it as-is (Intl will throw if invalid)
  return { timezone: location, resolved: false }
}

export function getCurrentTime(params: GetCurrentTimeParams): GetCurrentTimeResult {
  const { timezone, resolved } = resolveTimezone(params.location)
  const use12h = params.format === '12h'
  const now = new Date()

  try {
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

    const location = params.location ?? 'local'

    return { location, time, date, day, timezone }
  } catch {
    // Invalid timezone string — fall back to config timezone
    if (!resolved) {
      return getCurrentTime({ ...params, location: undefined })
    }
    throw new Error(`Invalid timezone: ${timezone}`)
  }
}
