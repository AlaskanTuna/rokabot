import { logger } from './logger.js'

export interface RateLimiterConfig {
  rpm: number
  rpd: number
}

export class RateLimiter {
  private tokens: number
  private readonly maxTokens: number
  private readonly refillIntervalMs: number
  private lastRefill: number

  private dailyCount: number
  private readonly maxDaily: number
  private dailyResetDate: string

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.rpm
    this.tokens = config.rpm
    this.refillIntervalMs = (60 * 1000) / config.rpm
    this.lastRefill = Date.now()

    this.maxDaily = config.rpd
    this.dailyCount = 0
    this.dailyResetDate = this.todayString()
  }

  tryConsume(): boolean {
    this.checkDailyReset()
    this.refillTokens()

    if (this.dailyCount >= this.maxDaily) {
      logger.warn({ dailyCount: this.dailyCount, maxDaily: this.maxDaily }, 'Daily rate limit reached')
      return false
    }

    if (this.tokens < 1) {
      logger.warn({ tokens: this.tokens }, 'RPM rate limit reached')
      return false
    }

    this.tokens -= 1
    this.dailyCount += 1
    return true
  }

  get remainingRpm(): number {
    this.refillTokens()
    return Math.floor(this.tokens)
  }

  get remainingRpd(): number {
    this.checkDailyReset()
    return this.maxDaily - this.dailyCount
  }

  private refillTokens(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const refill = elapsed / this.refillIntervalMs

    if (refill >= 1) {
      this.tokens = Math.min(this.maxTokens, this.tokens + refill)
      this.lastRefill = now
    }
  }

  private checkDailyReset(): void {
    const today = this.todayString()
    if (today !== this.dailyResetDate) {
      this.dailyCount = 0
      this.dailyResetDate = today
      logger.info('Daily rate limit counter reset')
    }
  }

  private todayString(): string {
    return new Date().toISOString().slice(0, 10)
  }
}
