/** Shared timezone utilities — single source of truth for all date/time helpers */

import { config } from '../config.js'
import { logger } from './logger.js'

/** Get the current hour (0-23) in the configured timezone */
export function getLocalHour(): number {
  const tz = config.timezone
  if (!tz) return new Date().getHours()
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    logger.warn({ timezone: tz }, 'Invalid timezone in config, falling back to system time')
    return new Date().getHours()
  }
}

/** Get today's date string (YYYY-MM-DD) in the configured timezone */
export function getTodayDate(): string {
  const tz = config.timezone ?? undefined
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz })
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Get yesterday's date string (YYYY-MM-DD) in the configured timezone */
export function getYesterdayDate(): string {
  const tz = config.timezone ?? undefined
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    return yesterday.toLocaleDateString('en-CA', { timeZone: tz })
  } catch {
    return yesterday.toISOString().slice(0, 10)
  }
}

/** Get the UTC offset label (e.g., "GMT+8") for the configured timezone */
export function getTimezoneLabel(): string {
  const tz = config.timezone
  if (!tz) return 'UTC'
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    const parts = formatter.formatToParts(new Date())
    const tzPart = parts.find((p) => p.type === 'timeZoneName')
    return tzPart?.value ?? tz
  } catch {
    return tz
  }
}

/** Format a timestamp as a readable time string in the configured timezone */
export function formatTime(timestamp: number): string {
  const tz = config.timezone ?? undefined
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    })
    return formatter.format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleTimeString()
  }
}
