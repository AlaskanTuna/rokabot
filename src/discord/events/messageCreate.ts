import type { Client, Message } from 'discord.js'
import { DiscordAPIError } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomBusy, getRandomDecline, getRandomEmptyMention, getRandomError, splitResponse } from '../responses.js'
import { buildRokaMessage } from '../messageBuilder.js'
import { addMessage, getHistory, getOrCreateSession } from '../../session/sessionManager.js'
import { generateResponse, type ImageAttachment } from '../../agent/roka.js'
import { isChannelBusy, markBusy, markFree } from '../concurrency.js'

export function createMessageHandler(client: Client, rateLimiter: RateLimiter) {
  return async function handleMessageCreate(message: Message): Promise<void> {
    if (message.author.bot) return
    if (!client.user) return

    const isMentioned = message.mentions.has(client.user.id)

    // Fetch the referenced message if this is a reply
    const referencedMessage = message.reference?.messageId
      ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null)
      : null

    const isReplyToBot = referencedMessage?.author?.id === client.user.id

    if (!isMentioned && !isReplyToBot) return

    const channelId = message.channelId
    const displayName = message.member?.displayName ?? message.author.displayName

    let content = message.content.replace(/<@!?\d+>/g, '').trim()

    // Extract image attachments (max 3, image types only)
    const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
    const MAX_IMAGE_ATTACHMENTS = 3
    const imageAttachments: ImageAttachment[] = message.attachments
      .filter((a) => a.contentType !== null && ALLOWED_IMAGE_TYPES.has(a.contentType))
      .map((a) => ({ url: a.url, contentType: a.contentType! }))
      .slice(0, MAX_IMAGE_ATTACHMENTS)

    // If replying to another message (not the bot), include referenced content as context
    if (referencedMessage && !isReplyToBot) {
      const refAuthor = referencedMessage.member?.displayName ?? referencedMessage.author.displayName
      const refContent = referencedMessage.content?.trim()

      // Build context prefix from the referenced message
      const refParts: string[] = []
      if (refContent) refParts.push(refContent)
      if (referencedMessage.attachments.size > 0) refParts.push('(attached image(s))')

      if (refParts.length > 0) {
        const refContext = `[Replying to ${refAuthor}: ${refParts.join(' ')}]`
        content = content ? `${refContext}\n${content}` : refContext
      }

      // Also grab images from the referenced message
      const refImages: ImageAttachment[] = referencedMessage.attachments
        .filter((a) => a.contentType !== null && ALLOWED_IMAGE_TYPES.has(a.contentType))
        .map((a) => ({ url: a.url, contentType: a.contentType! }))
        .slice(0, MAX_IMAGE_ATTACHMENTS - imageAttachments.length)

      imageAttachments.push(...refImages)
    }

    if (!content && imageAttachments.length === 0) {
      logger.info({ channelId, trigger: isMentioned ? 'mention' : 'reply' }, 'Empty mention detected')
      await message.reply(getRandomEmptyMention())
      return
    }

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

      const { text: responseText, tone } = await generateResponse({
        userMessage: content || '(shared an image)',
        displayName,
        channelHistory: history.slice(0, -1),
        participants,
        imageAttachments: imageAttachments.length > 0 ? imageAttachments : undefined
      })

      addMessage(channelId, {
        role: 'assistant',
        displayName: 'Roka',
        content: responseText,
        timestamp: Date.now()
      })

      const chunks = splitResponse(responseText)
      await message.reply(buildRokaMessage(chunks[0], tone))

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
