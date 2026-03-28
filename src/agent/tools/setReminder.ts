/**
 * ADK FunctionTool: set_reminder
 * Allows Roka to set a reminder for a user, delivered after a specified delay.
 */

import { createReminder } from '../../storage/reminderStore.js'

export interface SetReminderParams {
  user_id: string
  channel_id: string
  reminder: string
  delay_minutes: number
}

export interface SetReminderResult {
  success: boolean
  message: string
  reminderId?: number
}

/** Validate and create a reminder for a user. */
export function setReminder(params: SetReminderParams): SetReminderResult {
  const { user_id, channel_id, reminder, delay_minutes } = params

  if (delay_minutes < 1 || delay_minutes > 10080) {
    return {
      success: false,
      message: 'Delay must be between 1 minute and 7 days (10080 minutes).'
    }
  }

  const dueAt = Date.now() + delay_minutes * 60 * 1000
  const result = createReminder(user_id, channel_id, reminder, dueAt)

  if (!result.success) {
    return {
      success: false,
      message: result.message
    }
  }

  return {
    success: true,
    message: result.message,
    reminderId: result.id
  }
}
