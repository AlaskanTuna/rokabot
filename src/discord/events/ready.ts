import { ActivityType, Client, REST, Routes } from 'discord.js'
import { config } from '../../config.js'
import { logger } from '../../utils/logger.js'
import { chatCommand } from '../commands/chat.js'
import { toolCommands } from '../commands/tools.js'
import { gameCommands } from '../commands/games.js'

/** Set presence, register slash commands, and log startup on Discord ready. */
export async function handleReady(client: Client): Promise<void> {
  logger.info({ user: client.user?.tag }, 'Roka is online!')

  client.user?.setPresence({
    activities: [{ name: 'custom', type: ActivityType.Custom, state: 'Managing the sweets shop~ 🍡' }],
    status: 'online'
  })

  const rest = new REST({ version: '10' }).setToken(config.discord.token)

  try {
    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: [chatCommand.toJSON(), ...toolCommands.map((c) => c.toJSON()), ...gameCommands.map((c) => c.toJSON())]
    })
    logger.info('Slash commands registered')
  } catch (error) {
    logger.error({ error }, 'Failed to register slash commands')
  }
}
