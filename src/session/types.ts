export interface WindowMessage {
  role: 'user' | 'assistant'
  displayName: string
  content: string
  timestamp: number
}

export interface ChannelSession {
  channelId: string
  messages: WindowMessage[]
  idleTimer: ReturnType<typeof setTimeout> | null
  lastActivity: number
}
