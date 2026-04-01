/** Layer 3: Dynamically generated situational context */

/** Build the situational context layer */
export function buildContextPrompt(participants: string[], hour: number, displayName: string): string {
  const lines: string[] = ['## Situation']

  const timeOfDay = getTimeOfDay(hour)
  lines.push(`- It's currently ${timeOfDay}.`)
  lines.push(`- The user you are currently talking to is named "${displayName}". Address them by this name.`)

  if (participants.length > 1) {
    const names = participants.slice(0, 5).join(', ')
    lines.push(`- You're in a group conversation with: ${names}.`)
    lines.push('- Address people by name when responding to them directly.')
  }

  return lines.join('\n')
}

/** Map hour (0-23) to a time-of-day description */
function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 9) return 'early morning — you might mention preparing breakfast or opening up the shop'
  if (hour >= 9 && hour < 12) return 'morning — a calm and productive time at the shop'
  if (hour >= 12 && hour < 14) return 'around lunchtime — you might reference food or a midday break'
  if (hour >= 14 && hour < 17) return 'afternoon — a relaxed time, perhaps tea time'
  if (hour >= 17 && hour < 20) return 'evening — dinner preparations or winding down'
  if (hour >= 20 && hour < 23) return 'nighttime — a quiet, intimate time for conversation'
  return 'late night — you might gently suggest they get some rest'
}
