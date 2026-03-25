// Suppress verbose ADK event dumps when ADK_QUIET is set (must run before any imports)
if (process.env.ADK_QUIET) {
  const originalInfo = console.info
  console.info = (...args: unknown[]) => {
    const joined = args.map(String).join(' ')
    if (joined.includes('[ADK INFO]') && joined.includes('event:')) return
    originalInfo(...args)
  }
}

import { config } from './config.js'
import { logger } from './utils/logger.js'
import { createClient } from './discord/client.js'
import { destroyAllSessions } from './agent/roka.js'

const client = createClient()

/** Tear down ADK sessions and disconnect Discord before exiting. */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received')

  await destroyAllSessions()
  client.destroy()

  logger.info('Roka is going to sleep. Oyasumi~')

  // Force-exit safety net if graceful shutdown stalls
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
