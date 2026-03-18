import pino from 'pino'
import { config } from '../config.js'

export const logger = pino({
  level: config.logging.level,
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  })
})
