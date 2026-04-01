/** Per-channel concurrency guard preventing simultaneous requests */

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
