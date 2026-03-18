/**
 * Per-channel concurrency guard.
 * Tracks channels with an in-flight Gemini request to prevent
 * multiple simultaneous requests per channel.
 */

const activeRequests = new Set<string>()

export function isChannelBusy(channelId: string): boolean {
  return activeRequests.has(channelId)
}

export function markBusy(channelId: string): void {
  activeRequests.add(channelId)
}

export function markFree(channelId: string): void {
  activeRequests.delete(channelId)
}
