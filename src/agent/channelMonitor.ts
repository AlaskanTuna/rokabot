/** Tracks channels monitored for passive memory extraction with 24h TTL */

import { config } from '../config.js'
import { logger } from '../utils/logger.js'

const MONITOR_TTL_MS = config.memory.channelMonitorTtlMs

const monitoredChannels = new Map<string, number>() // channelId → expiry timestamp

export function markActive(channelId: string): void {
  const isNew = !monitoredChannels.has(channelId)
  monitoredChannels.set(channelId, Date.now() + MONITOR_TTL_MS)
  if (isNew) {
    logger.info({ channelId, totalMonitored: monitoredChannels.size }, 'Channel now monitored for passive memory')
  }
}

export function isMonitored(channelId: string): boolean {
  const expiry = monitoredChannels.get(channelId)
  if (!expiry) return false
  if (Date.now() > expiry) {
    monitoredChannels.delete(channelId)
    return false
  }
  return true
}

export function cleanupExpired(): void {
  const now = Date.now()
  let cleaned = 0
  for (const [channelId, expiry] of monitoredChannels) {
    if (now > expiry) {
      monitoredChannels.delete(channelId)
      cleaned++
    }
  }
  if (cleaned > 0) {
    logger.debug({ cleaned }, 'Cleaned up expired monitored channels')
  }
}

export function getMonitoredCount(): number {
  return monitoredChannels.size
}

/** Reset for testing */
export function resetMonitor(): void {
  monitoredChannels.clear()
}
