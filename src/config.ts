import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'

// ---------------------------------------------------------------------------
// 1. Load secrets from environment
// ---------------------------------------------------------------------------

function requiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// ---------------------------------------------------------------------------
// 2. Load tunables from config.yml
// ---------------------------------------------------------------------------

interface YamlConfig {
  gemini?: { model?: string; timeout?: number; maxRetries?: number }
  rateLimit?: { rpm?: number; rpd?: number }
  session?: { ttl?: number; windowSize?: number }
  discord?: { maxMessageLength?: number }
  timezone?: string
  logging?: { level?: string }
}

function loadYamlConfig(): YamlConfig {
  const configPath = resolve(import.meta.dirname ?? '.', '..', 'config.yml')
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch {
    throw new Error(`Cannot read config.yml at ${configPath}. Ensure the file exists in the project root.`)
  }

  const parsed = load(raw)
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error('config.yml is empty or malformed — expected a YAML mapping.')
  }
  return parsed as YamlConfig
}

const yaml = loadYamlConfig()

// ---------------------------------------------------------------------------
// 3. Env-var overrides (backward compat)
// ---------------------------------------------------------------------------

function envInt(key: string): number | undefined {
  const raw = process.env[key]
  if (!raw) return undefined
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${raw}`)
  }
  return parsed
}

function envString(key: string): string | undefined {
  return process.env[key] || undefined
}

// ---------------------------------------------------------------------------
// 4. Merged config object
// ---------------------------------------------------------------------------

export const config = {
  discord: {
    token: requiredEnv('DISCORD_TOKEN'),
    clientId: requiredEnv('DISCORD_CLIENT_ID'),
    maxMessageLength: envInt('DISCORD_MAX_MESSAGE_LENGTH') ?? yaml.discord?.maxMessageLength ?? 2000
  },
  gemini: {
    apiKey: requiredEnv('GEMINI_API_KEY'),
    model: envString('GEMINI_MODEL') ?? yaml.gemini?.model ?? 'gemini-2.0-flash-lite',
    timeout: envInt('GEMINI_TIMEOUT') ?? yaml.gemini?.timeout ?? 15_000,
    maxRetries: envInt('GEMINI_MAX_RETRIES') ?? yaml.gemini?.maxRetries ?? 1
  },
  logging: {
    level: envString('LOG_LEVEL') ?? yaml.logging?.level ?? 'info'
  },
  rateLimit: {
    rpm: envInt('RATE_LIMIT_RPM') ?? yaml.rateLimit?.rpm ?? 15,
    rpd: envInt('RATE_LIMIT_RPD') ?? yaml.rateLimit?.rpd ?? 500
  },
  session: {
    ttlMs: envInt('SESSION_TTL_MS') ?? yaml.session?.ttl ?? 300_000,
    windowSize: envInt('SESSION_WINDOW_SIZE') ?? yaml.session?.windowSize ?? 10
  },
  timezone: (envString('TZ') ?? yaml.timezone) as string | undefined
} as const
