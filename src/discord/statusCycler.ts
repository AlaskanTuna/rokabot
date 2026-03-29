import { ActivityType, type Client } from 'discord.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

/** Get the current hour (0-23) in the configured timezone. */
function getLocalHour(): number {
  const tz = config.timezone
  if (!tz) return new Date().getHours()
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    return new Date().getHours()
  }
}

/** Status messages mapped to time-of-day ranges. */
const STATUS_SCHEDULE: Array<{ hours: [number, number]; statuses: string[] }> = [
  {
    hours: [5, 9],
    statuses: [
      'Opening up the shop~ \u2600\uFE0F',
      'Preparing the morning sweets~ \uD83C\uDF61',
      'Brewing tea before customers arrive~ \uD83C\uDF75'
    ]
  },
  {
    hours: [9, 12],
    statuses: [
      'Managing the sweets shop~ \uD83C\uDF61',
      'Serving customers with a smile~ \u266A',
      'Arranging wagashi on the display~ \uD83C\uDF38'
    ]
  },
  {
    hours: [12, 14],
    statuses: [
      'Taking a lunch break~ \uD83C\uDF59',
      "Taste-testing today's specials~ \uD83C\uDF73",
      'Eating onigiri behind the counter~ \uD83C\uDF59'
    ]
  },
  {
    hours: [14, 17],
    statuses: [
      'Quiet afternoon at the shop~ \uD83C\uDF75',
      'Restocking shelves between customers~ \u266A',
      'Enjoying afternoon tea time~ \u2615'
    ]
  },
  {
    hours: [17, 20],
    statuses: [
      'Closing up shop for the day~ \uD83C\uDF05',
      "Counting today's sales~ \u266A",
      'Preparing dinner~ \uD83C\uDF73'
    ]
  },
  {
    hours: [20, 23],
    statuses: [
      'Relaxing after a long day~ \uD83C\uDF19',
      'Watching anime before bed~ \u2728',
      'Reading by the lamp light~ \uD83D\uDCD6'
    ]
  },
  {
    hours: [23, 5],
    statuses: [
      'Should be sleeping... \uD83D\uDCA4',
      "Couldn't sleep... \uD83C\uDF19",
      'Late night snack time~ \uD83C\uDF61'
    ]
  }
]

/** Pick a random status for the current time of day. */
function getStatusForHour(hour: number): string {
  for (const entry of STATUS_SCHEDULE) {
    const [start, end] = entry.hours
    if (start < end) {
      if (hour >= start && hour < end) {
        return entry.statuses[Math.floor(Math.random() * entry.statuses.length)]
      }
    } else {
      // Wraps around midnight (e.g., 23-5)
      if (hour >= start || hour < end) {
        return entry.statuses[Math.floor(Math.random() * entry.statuses.length)]
      }
    }
  }
  return 'Managing the sweets shop~ \uD83C\uDF61'
}

let intervalId: ReturnType<typeof setInterval> | null = null

/** Start cycling the bot's status every 15 minutes based on time of day. */
export function startStatusCycler(client: Client): void {
  function updateStatus() {
    if (!client.user) return
    const hour = getLocalHour()
    const status = getStatusForHour(hour)
    client.user.setPresence({
      activities: [{ name: 'custom', type: ActivityType.Custom, state: status }],
      status: 'online'
    })
    logger.debug({ hour, status }, 'Bot status updated')
  }

  updateStatus()

  intervalId = setInterval(updateStatus, 15 * 60 * 1000)

  logger.info('Status cycler started (15min interval)')
}

/** Stop the status cycler. */
export function stopStatusCycler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    logger.info('Status cycler stopped')
  }
}
