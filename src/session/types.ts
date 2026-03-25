/** Single message in the per-channel FIFO window. */
export interface WindowMessage {
  role: 'user' | 'assistant'
  displayName: string
  content: string
  timestamp: number
}

/** Per-channel session state with message history and idle timeout. */
export interface ChannelSession {
  channelId: string
  messages: WindowMessage[]
  idleTimer: ReturnType<typeof setTimeout> | null
  lastActivity: number
}
