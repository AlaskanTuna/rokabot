/**
 * Layer 3: Channel Awareness
 * Dynamically generated per request. Provides situational context.
 * Budget: ~50-100 tokens
 */

export function buildContextPrompt(participants: string[], hour: number): string {
  const lines: string[] = ['## Situation']

  const timeOfDay = getTimeOfDay(hour)
  lines.push(`- It's currently ${timeOfDay}.`)

  if (participants.length === 1) {
    lines.push(`- You're talking with ${participants[0]}.`)
  } else if (participants.length > 1) {
    const names = participants.slice(0, 5).join(', ')
    lines.push(`- You're in a group conversation with: ${names}.`)
    lines.push('- Address people by name when responding to them directly.')
  }

  return lines.join('\n')
}

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 9) return 'early morning — you might mention preparing breakfast or morning shrine duties'
  if (hour >= 9 && hour < 12) return 'morning — a calm and productive time at the inn'
  if (hour >= 12 && hour < 14) return 'around lunchtime — you might reference food or a midday break'
  if (hour >= 14 && hour < 17) return 'afternoon — a relaxed time, perhaps tea time'
  if (hour >= 17 && hour < 20) return 'evening — dinner preparations or winding down'
  if (hour >= 20 && hour < 23) return 'nighttime — a quiet, intimate time for conversation'
  return 'late night — you might gently suggest they get some rest'
}
