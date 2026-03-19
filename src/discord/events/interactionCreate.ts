import type { ChatInputCommandInteraction, Interaction } from 'discord.js'
import { DiscordAPIError } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomBusy, getRandomDecline, getRandomError, splitResponse } from '../responses.js'
import { buildRokaMessage } from '../messageBuilder.js'
import { addMessage, getHistory, getOrCreateSession } from '../../session/sessionManager.js'
import { generateResponse, type ImageAttachment } from '../../agent/roka.js'
import { isChannelBusy, markBusy, markFree } from '../concurrency.js'

export function createInteractionHandler(rateLimiter: RateLimiter) {
  return async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName !== 'chat') return

    const message = interaction.options.getString('message', true)
    const attachment = interaction.options.getAttachment('image')
    const channelId = interaction.channelId
    const member = interaction.member
    const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName

    // Extract image attachment if provided and it has a valid image content type
    const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
    const imageAttachments: ImageAttachment[] = []
    if (attachment?.contentType && ALLOWED_IMAGE_TYPES.has(attachment.contentType)) {
      imageAttachments.push({ url: attachment.url, contentType: attachment.contentType })
    }

    logger.info({ channelId, command: 'chat' }, 'Slash command received')
    logger.debug({ channelId, message, hasImage: !!attachment }, 'Slash command details')

    if (!rateLimiter.tryConsume()) {
      logger.debug(
        { channelId, remainingRpm: rateLimiter.remainingRpm, remainingRpd: rateLimiter.remainingRpd },
        'Rate limit hit — declining'
      )

      await interaction.reply({ content: getRandomDecline() })
      return
    }

    if (isChannelBusy(channelId)) {
      logger.debug({ channelId }, 'Channel busy — sending busy message')
      await interaction.reply({ content: getRandomBusy() })
      return
    }

    await interaction.deferReply()

    markBusy(channelId)
    try {
      getOrCreateSession(channelId)

      addMessage(channelId, {
        role: 'user',
        displayName,
        content: message,
        timestamp: Date.now()
      })

      const history = getHistory(channelId)
      const participants = [...new Set(history.map((m) => m.displayName))]

      logger.debug({ channelId, historySize: history.length, participants }, 'Calling Gemini')

      const { text: responseText, tone } = await generateResponse({
        userMessage: message,
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

      logger.debug({ channelId, tone, responseLength: responseText.length }, 'Gemini response received')

      const chunks = splitResponse(responseText)
      logger.debug({ channelId, chunkCount: chunks.length }, 'Response split into chunks')
      await interaction.editReply(buildRokaMessage(chunks[0], tone))

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] })
      }
    } catch (error) {
      if (error instanceof DiscordAPIError) {
        const code = error.code
        if (code === 50013 || code === 10008) {
          logger.warn({ error, channelId, code }, 'Discord API error (ignored)')
          return
        }
      }
      const errDetail = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      logger.error({ error: errDetail, channelId }, 'Error handling /chat command')
      try {
        await interaction.editReply({ content: getRandomError() })
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
