import type { Client, Message } from 'discord.js'
import { DiscordAPIError } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomBusy, getRandomDecline, getRandomError, splitResponse } from '../responses.js'
import { addMessage, getHistory, getOrCreateSession } from '../../session/sessionManager.js'
import { generateResponse } from '../../agent/roka.js'
import { isChannelBusy, markBusy, markFree } from '../concurrency.js'

export function createMessageHandler(client: Client, rateLimiter: RateLimiter) {
  return async function handleMessageCreate(message: Message): Promise<void> {
    if (message.author.bot) return
    if (!client.user) return

    const isMentioned = message.mentions.has(client.user.id)
    const isReplyToBot =
      message.reference?.messageId &&
      (await message.channel.messages.fetch(message.reference.messageId).catch(() => null))?.author?.id ===
        client.user.id

    if (!isMentioned && !isReplyToBot) return

    const channelId = message.channelId
    const displayName = message.member?.displayName ?? message.author.displayName

    const content = message.content.replace(/<@!?\d+>/g, '').trim()

    if (!content) return

    logger.info({ channelId, trigger: isMentioned ? 'mention' : 'reply' }, 'Message trigger detected')

    if (!rateLimiter.tryConsume()) {
      await message.reply(getRandomDecline())
      return
    }

    if (isChannelBusy(channelId)) {
      await message.reply(getRandomBusy())
      return
    }

    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping()
    }

    markBusy(channelId)
    try {
      getOrCreateSession(channelId)

      addMessage(channelId, {
        role: 'user',
        displayName,
        content,
        timestamp: Date.now()
      })

      const history = getHistory(channelId)
      const participants = [...new Set(history.map((m) => m.displayName))]

      const response = await generateResponse({
        userMessage: content,
        displayName,
        channelHistory: history.slice(0, -1),
        participants
      })

      addMessage(channelId, {
        role: 'assistant',
        displayName: 'Roka',
        content: response,
        timestamp: Date.now()
      })

      const chunks = splitResponse(response)
      await message.reply(chunks[0])

      for (let i = 1; i < chunks.length; i++) {
        if ('send' in message.channel) {
          await message.channel.send(chunks[i])
        }
      }
    } catch (error) {
      if (error instanceof DiscordAPIError) {
        const code = error.code
        if (code === 50013 || code === 10008) {
          logger.warn({ error, channelId, code }, 'Discord API error (ignored)')
          return
        }
      }
      logger.error({ error, channelId }, 'Error handling message')
      try {
        await message.reply(getRandomError())
      } catch (replyError) {
        if (replyError instanceof DiscordAPIError && (replyError.code === 50013 || replyError.code === 10008)) {
          logger.warn({ error: replyError, channelId }, 'Could not send error reply (ignored)')
        } else {
          logger.error({ error: replyError, channelId }, 'Failed to send error reply')
        }
      }
    } finally {
      markFree(channelId)
    }
  }
}
