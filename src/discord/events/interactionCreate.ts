import type { ChatInputCommandInteraction, Interaction } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomDecline, getRandomError, splitResponse } from '../responses.js'
import { addMessage, getHistory, getOrCreateSession } from '../../session/sessionManager.js'
import { generateResponse } from '../../agent/roka.js'

export function createInteractionHandler(rateLimiter: RateLimiter) {
  return async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return
    if (interaction.commandName !== 'chat') return

    const message = interaction.options.getString('message', true)
    const channelId = interaction.channelId
    const member = interaction.member
    const displayName =
      member && 'displayName' in member ? member.displayName : interaction.user.displayName

    logger.info({ channelId, command: 'chat' }, 'Slash command received')

    if (!rateLimiter.tryConsume()) {
      await interaction.reply({ content: getRandomDecline() })
      return
    }

    await interaction.deferReply()

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

      const response = await generateResponse({
        userMessage: message,
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
      await interaction.editReply({ content: chunks[0] })

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] })
      }
    } catch (error) {
      logger.error({ error, channelId }, 'Error handling /chat command')
      await interaction.editReply({ content: getRandomError() })
    }
  }
}
