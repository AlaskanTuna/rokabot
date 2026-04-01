import type { Client, Message } from 'discord.js'
import { DiscordAPIError } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomBusy, getRandomDecline, getRandomError, splitResponse } from '../responses.js'
import { buildRokaMessage } from '../messageBuilder.js'
import { generateResponse, type ImageAttachment } from '../../agent/roka.js'
import { isChannelBusy, markBusy, markFree } from '../concurrency.js'
import { shouldReact } from '../emojiReactor.js'
import { handleGachaMention } from './gachaMention.js'
import { markActive, isMonitored } from '../../agent/channelMonitor.js'
import { addMessage as addToPassiveBuffer } from '../../agent/passiveBuffer.js'
import { maybeExtractFromBuffer } from '../../agent/memoryExtractor.js'

// Discord Components V2 type discriminants
const TEXT_DISPLAY = 10
const SECTION = 9
const CONTAINER = 17

interface RawComponent {
  type: number
  content?: string
  components?: RawComponent[]
  label?: string
}

/**
 * Recursively extract text content from Discord message components.
 * Handles Components V2 (Container, Section, TextDisplay) and standard ActionRow buttons.
 */
function extractComponentTexts(components: Message['components']): string[] {
  const texts: string[] = []

  function walk(items: RawComponent[]) {
    for (const item of items) {
      if (item.type === TEXT_DISPLAY && typeof item.content === 'string') {
        texts.push(item.content)
      }
      if (item.type === CONTAINER || item.type === SECTION) {
        if (item.components) walk(item.components)
      }
      // Standard ActionRow button labels
      if (item.label) {
        texts.push(item.label)
      }
      // Recurse into any nested components
      if (item.components && item.type !== CONTAINER && item.type !== SECTION) {
        walk(item.components)
      }
    }
  }

  // Convert to raw JSON to avoid type conflicts between V1 and V2 component types
  const raw = components.map((c) => c.toJSON()) as unknown as RawComponent[]
  walk(raw)

  return texts
}

/** Create a handler for mention/reply message triggers that invokes the Roka agent. */
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

    // Passive emoji reactions (all guild messages, not just mentions)
    if (message.guild) {
      const emoji = shouldReact(message.content, message.channelId)
      if (emoji) {
        message.react(emoji).catch(() => {}) // fire-and-forget, don't block
      }
    }

    // Passive message monitoring — buffer messages in actively monitored channels
    if (message.guild && !message.author.bot && isMonitored(message.channelId)) {
      const msgContent = message.content.replace(/<@!?\d+>/g, '').trim()
      if (msgContent) {
        const count = addToPassiveBuffer(
          message.channelId,
          message.author.id,
          message.member?.displayName ?? message.author.displayName,
          msgContent
        )
        if (count >= 20) {
          maybeExtractFromBuffer(message.channelId)
        }
      }
    }

    if (!isMentioned && !isReplyToBot) return

    const channelId = message.channelId
    markActive(channelId)
    const displayName = message.member?.displayName ?? message.author.displayName

    let content = message.content.replace(/<@!?\d+>/g, '').trim()

    const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
    const MAX_IMAGE_ATTACHMENTS = 3
    const imageAttachments: ImageAttachment[] = message.attachments
      .filter((a) => a.contentType !== null && ALLOWED_IMAGE_TYPES.has(a.contentType))
      .map((a) => ({ url: a.url, contentType: a.contentType! }))
      .slice(0, MAX_IMAGE_ATTACHMENTS)

    // Include referenced message content as context so Roka can see what the user is replying to
    if (referencedMessage) {
      const refAuthor = referencedMessage.member?.displayName ?? referencedMessage.author.displayName
      const refContent = referencedMessage.content?.trim()

      const refParts: string[] = []
      if (refContent) refParts.push(refContent)

      // Pull text from embeds (link previews, social cards, bot embeds, etc.)
      for (const embed of referencedMessage.embeds) {
        const embedParts: string[] = []
        if (embed.author?.name) embedParts.push(`Author: ${embed.author.name}`)
        if (embed.title) embedParts.push(`Title: ${embed.title}`)
        if (embed.description) embedParts.push(embed.description)
        for (const field of embed.fields) {
          embedParts.push(`${field.name}: ${field.value}`)
        }
        if (embed.footer?.text) embedParts.push(`Footer: ${embed.footer.text}`)
        if (embedParts.length > 0) {
          refParts.push(`[Embed: ${embedParts.join(' | ')}]`)
        }
      }

      // Extract poll question and options
      if (referencedMessage.poll) {
        const poll = referencedMessage.poll
        const pollParts: string[] = []
        if (poll.question.text) pollParts.push(`Poll: ${poll.question.text}`)
        if (poll.answers.size > 0) {
          for (const answer of poll.answers.values()) {
            if (answer.text) pollParts.push(`- ${answer.text}`)
          }
        }
        if (pollParts.length > 0) {
          refParts.push(`[${pollParts.join(' | ')}]`)
        }
      }

      // Extract forwarded message content (plain text, components, embeds, attachments)
      if (referencedMessage.messageSnapshots.size > 0) {
        for (const snapshot of referencedMessage.messageSnapshots.values()) {
          const fwdParts: string[] = []

          // Plain text content
          const fwdContent = snapshot.content?.trim()
          if (fwdContent) fwdParts.push(fwdContent)

          // Components V2 text (forwarded container messages)
          if (snapshot.components && snapshot.components.length > 0) {
            const compTexts = extractComponentTexts(snapshot.components)
            if (compTexts.length > 0) fwdParts.push(compTexts.join(' | '))
          }

          // Embeds in forwarded message
          if (snapshot.embeds && snapshot.embeds.length > 0) {
            for (const embed of snapshot.embeds) {
              const eParts: string[] = []
              if (embed.title) eParts.push(embed.title)
              if (embed.description) eParts.push(embed.description)
              if (eParts.length > 0) fwdParts.push(eParts.join(': '))
            }
          }

          // Forwarded image attachments
          if (snapshot.attachments && snapshot.attachments.size > 0) {
            const fwdImages = snapshot.attachments
              .filter((a) => a.contentType !== null && ALLOWED_IMAGE_TYPES.has(a.contentType))
              .map((a) => ({ url: a.url, contentType: a.contentType! }))
              .slice(0, MAX_IMAGE_ATTACHMENTS - imageAttachments.length)
            imageAttachments.push(...fwdImages)
            if (fwdImages.length > 0) fwdParts.push('(forwarded image(s))')
          }

          if (fwdParts.length > 0) {
            refParts.push(`[Forwarded: ${fwdParts.join(' | ')}]`)
          }
        }
      }

      // Pull text from Components V2 containers (other bots using container messages)
      if (referencedMessage.components.length > 0) {
        const componentTexts = extractComponentTexts(referencedMessage.components)
        if (componentTexts.length > 0) {
          refParts.push(`[Container: ${componentTexts.join(' | ')}]`)
        }
      }

      // Extract sticker names
      if (referencedMessage.stickers.size > 0) {
        const stickerNames = referencedMessage.stickers.map((s) => s.name).join(', ')
        refParts.push(`(sticker: ${stickerNames})`)
      }

      if (referencedMessage.attachments.size > 0) refParts.push('(attached image(s))')

      if (refParts.length > 0) {
        const refContext = `[Replying to ${refAuthor}: ${refParts.join('\n')}]`
        content = content ? `${refContext}\n${content}` : refContext
      }

      // Forward images from the referenced message so Roka can see them
      const refImages: ImageAttachment[] = referencedMessage.attachments
        .filter((a) => a.contentType !== null && ALLOWED_IMAGE_TYPES.has(a.contentType))
        .map((a) => ({ url: a.url, contentType: a.contentType! }))
        .slice(0, MAX_IMAGE_ATTACHMENTS - imageAttachments.length)

      imageAttachments.push(...refImages)

      // Also grab images from embed thumbnails (link preview images, social cards, etc.)
      if (imageAttachments.length < MAX_IMAGE_ATTACHMENTS) {
        for (const embed of referencedMessage.embeds) {
          if (imageAttachments.length >= MAX_IMAGE_ATTACHMENTS) break
          const embedImageUrl = embed.image?.url ?? embed.thumbnail?.url
          if (embedImageUrl) {
            imageAttachments.push({ url: embedImageUrl, contentType: 'image/png' })
          }
        }
      }
    }

    // Check for gacha keywords before calling LLM
    const gachaKeywords = /^(gacha|draw|fortune|omikuji)$/i
    if (gachaKeywords.test(content.trim())) {
      const handled = await handleGachaMention(message)
      if (handled) return
    }

    if (!content && imageAttachments.length === 0) {
      content = '(pinged you without saying anything)'
    }

    logger.info({ channelId, trigger: isMentioned ? 'mention' : 'reply' }, 'Message trigger detected')
    logger.debug({ channelId, content, imageCount: imageAttachments.length }, 'Message content extracted')

    if (!rateLimiter.tryConsume()) {
      logger.debug(
        { channelId, remainingRpm: rateLimiter.remainingRpm, remainingRpd: rateLimiter.remainingRpd },
        'Rate limit hit — declining'
      )

      const declineMsg = await message.reply(getRandomDecline())
      setTimeout(() => declineMsg.delete().catch(() => {}), 5000)
      return
    }

    if (isChannelBusy(channelId)) {
      logger.debug({ channelId }, 'Channel busy — sending busy message')
      const busyMsg = await message.reply(getRandomBusy())
      setTimeout(() => busyMsg.delete().catch(() => {}), 5000)
      return
    }

    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping()
    }
    const typingInterval =
      'sendTyping' in message.channel
        ? setInterval(() => {
            ;(message.channel as { sendTyping: () => Promise<void> }).sendTyping().catch(() => {})
          }, 7000)
        : null

    markBusy(channelId)
    try {
      const { text: responseText, tone } = await generateResponse({
        channelId,
        userMessage: content || '(shared an image)',
        displayName,
        userId: message.author.id,
        imageAttachments: imageAttachments.length > 0 ? imageAttachments : undefined
      })

      logger.debug({ channelId, tone, responseLength: responseText.length }, 'ADK response received')

      const chunks = splitResponse(responseText)
      logger.debug({ channelId, chunkCount: chunks.length }, 'Response split into chunks')
      await message.reply(buildRokaMessage(chunks[0], tone))

      for (let i = 1; i < chunks.length; i++) {
        if ('send' in message.channel) {
          await message.channel.send(buildRokaMessage(chunks[i], tone))
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
      const errDetail =
        error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      logger.error({ error: errDetail, channelId }, 'Error handling message')
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
      if (typingInterval) clearInterval(typingInterval)
      markFree(channelId)
    }
  }
}
