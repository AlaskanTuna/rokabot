/**
 * Periodic scheduler that checks for due reminders and delivers them
 * as in-character Discord messages in the original channel.
 * Falls back to DM if the channel is not accessible.
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
            `Hey <@${reminder.userId}>~ you asked me to remind you: "${reminder.reminder}" \u266a`
          )
          markDelivered(reminder.id)
          logger.info({ reminderId: reminder.id, userId: reminder.userId }, 'Reminder delivered')
        } else {
          // Channel not accessible — try DM fallback
          try {
            const user = await client.users.fetch(reminder.userId)
            await user.send(
              `Hey~ you asked me to remind you: "${reminder.reminder}" \u266a\n\n-# (Sent as DM because I couldn't reach the original channel)`
            )
            markDelivered(reminder.id)
            logger.info(
              { reminderId: reminder.id, userId: reminder.userId },
              'Reminder delivered via DM (channel fallback)'
            )
          } catch (dmError) {
            markDelivered(reminder.id)
            logger.warn({ reminderId: reminder.id }, 'Reminder channel and DM both inaccessible, marking delivered')
          }
        }
      } catch (error) {
        // Channel fetch/send failed (e.g., 403 Missing Access in uninvited servers)
        // Try DM fallback before giving up
        logger.warn({ reminderId: reminder.id, error }, 'Channel delivery failed, attempting DM fallback')
        try {
          const user = await client.users.fetch(reminder.userId)
          await user.send(
            `Hey~ you asked me to remind you: "${reminder.reminder}" \u266a\n\n-# (Sent as DM because I couldn't reach the original channel)`
          )
          markDelivered(reminder.id)
          logger.info(
            { reminderId: reminder.id, userId: reminder.userId },
            'Reminder delivered via DM (channel fallback)'
          )
        } catch (dmError) {
          markDelivered(reminder.id)
          logger.warn({ reminderId: reminder.id }, 'Both channel and DM delivery failed, marking delivered')
        }
      }
    }
  }, 5_000)

  logger.info('Reminder scheduler started (5s interval)')
}

export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    logger.info('Reminder scheduler stopped')
  }
}
