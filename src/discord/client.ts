import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { RateLimiter } from '../utils/rateLimiter.js'
import { handleReady } from './events/ready.js'
import { createInteractionHandler } from './events/interactionCreate.js'
import { createMessageHandler } from './events/messageCreate.js'

export function createClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
  })

  const rateLimiter = new RateLimiter({
    rpm: config.rateLimit.rpm,
    rpd: config.rateLimit.rpd
  })

  client.once('ready', () => handleReady(client))
  client.on('interactionCreate', createInteractionHandler(rateLimiter))
  client.on('messageCreate', createMessageHandler(client, rateLimiter))

  client.on('error', (error) => {
    logger.error({ error }, 'Discord client error')
  })

  client.on('warn', (warning) => {
    logger.warn({ warning }, 'Discord client warning')
  })

  return client
}
