import 'dotenv/config'

function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${raw}`)
  }
  return parsed
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID')
  },
  gemini: {
    apiKey: required('GEMINI_API_KEY'),
    model: 'gemini-3.1-flash-lite-preview'
  },
  logging: {
    level: optional('LOG_LEVEL', 'info')
  },
  rateLimit: {
    rpm: optionalInt('RATE_LIMIT_RPM', 15),
    rpd: optionalInt('RATE_LIMIT_RPD', 500)
  },
  session: {
    ttlMs: optionalInt('SESSION_TTL_MS', 300_000),
    windowSize: optionalInt('SESSION_WINDOW_SIZE', 10)
  }
} as const
