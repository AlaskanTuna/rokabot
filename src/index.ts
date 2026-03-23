import { config } from './config.js'
import { logger } from './utils/logger.js'
import { createClient } from './discord/client.js'
import { destroyAllSessions } from './agent/roka.js'

const client = createClient()

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received')

  await destroyAllSessions()
  client.destroy()

  logger.info('Roka is going to sleep. Oyasumi~')

  const timeout = setTimeout(() => {
    logger.warn('Graceful shutdown timed out, forcing exit')
    process.exit(1)
  }, 5000)
  timeout.unref()

  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection')
})

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception')
  process.exit(1)
})

client.login(config.discord.token).catch((error) => {
  logger.fatal({ error }, 'Failed to login to Discord')
  process.exit(1)
})
