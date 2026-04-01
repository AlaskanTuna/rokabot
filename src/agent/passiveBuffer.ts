/** Passive message ring buffer for monitored channels */

import { config } from '../config.js'

export interface BufferedMessage {
  displayName: string
  userId: string
  content: string
  timestamp: number
}

interface ChannelBuffer {
  messages: BufferedMessage[]
  userMap: Map<string, string> // displayName → userId
}

const BUFFER_SIZE = config.memory.bufferSize
const buffers = new Map<string, ChannelBuffer>()

export function addMessage(channelId: string, userId: string, displayName: string, content: string): number {
  if (!buffers.has(channelId)) {
    buffers.set(channelId, { messages: [], userMap: new Map() })
  }
  const buf = buffers.get(channelId)!
  buf.userMap.set(displayName, userId)
  buf.messages.push({ displayName, userId, content, timestamp: Date.now() })
  if (buf.messages.length > BUFFER_SIZE) {
    const removed = buf.messages.shift()
    if (removed && !buf.messages.some((m) => m.displayName === removed.displayName)) {
      buf.userMap.delete(removed.displayName)
    }
  }
  return buf.messages.length
}

export function getMessages(channelId: string): BufferedMessage[] {
  return buffers.get(channelId)?.messages ?? []
}

export function getUserMap(channelId: string): Map<string, string> {
  return buffers.get(channelId)?.userMap ?? new Map()
}

export function clearBuffer(channelId: string): void {
  const buf = buffers.get(channelId)
  if (buf) {
    buf.messages = []
  }
}

export function getMessageCount(channelId: string): number {
  return buffers.get(channelId)?.messages.length ?? 0
}

/** Reset all buffers for testing */
export function resetAllBuffers(): void {
  buffers.clear()
}
