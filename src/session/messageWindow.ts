import { config } from '../config.js'
import type { WindowMessage } from './types.js'

export function pushMessage(messages: WindowMessage[], message: WindowMessage): WindowMessage[] {
  messages.push(message)
  while (messages.length > config.session.windowSize) {
    messages.shift()
  }
  return messages
}

export function clearMessages(messages: WindowMessage[]): void {
  messages.length = 0
}
