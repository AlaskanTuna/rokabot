/**
 * Periodic scheduler that checks for due reminders and delivers them
 * as in-character Discord messages in the original channel.
 */

import type { Client } from 'discord.js'
import { getDueReminders, markDelivered } from '../storage/reminderStore.js'
import { logger } from '../utils/logger.js'

let intervalId: ReturnType<typeof setInterval> | null = null

export function startReminderScheduler(client: Client): void {
  intervalId = setInterval(async () => {
    const dueReminders = getDueReminders()
    for (const reminder of dueReminders) {
      try {
        const channel = await client.channels.fetch(reminder.channelId)
        if (channel && 'send' in channel) {
          await (channel as { send: (msg: string) => Promise<unknown> }).send(
            `Hey **${reminder.userId}**~ you asked me to remind you: "${reminder.reminder}" \u266a`
          )
          markDelivered(reminder.id)
          logger.info({ reminderId: reminder.id, userId: reminder.userId }, 'Reminder delivered')
        } else {
          // Channel not accessible, still mark as delivered to prevent infinite retries
          markDelivered(reminder.id)
          logger.warn({ reminderId: reminder.id, channelId: reminder.channelId }, 'Reminder channel not accessible')
        }
      } catch (error) {
        logger.error({ reminderId: reminder.id, error }, 'Failed to deliver reminder')
        // Don't mark as delivered — will retry next cycle
      }
    }
  }, 60_000)

  logger.info('Reminder scheduler started (60s interval)')
}

export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    logger.info('Reminder scheduler stopped')
  }
}
