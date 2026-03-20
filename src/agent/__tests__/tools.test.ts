// Mock jikanThrottle to be a no-op so tests don't hang on fake timers
vi.mock('../tools/jikanThrottle.js', () => ({
  jikanThrottle: vi.fn().mockResolvedValue(undefined)
}))

import { rollDice } from '../tools/rollDice.js'
import { flipCoin } from '../tools/flipCoin.js'
import { getCurrentTime } from '../tools/getCurrentTime.js'
import { searchAnime } from '../tools/searchAnime.js'
import { getAnimeSchedule } from '../tools/getAnimeSchedule.js'
import { getWeather } from '../tools/getWeather.js'
import { executeToolCall } from '../tools/index.js'

// ── fetch mock setup ──────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch
let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  globalThis.fetch = mockFetch
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── rollDice ──────────────────────────────────────────────────────────────────

describe('rollDice', () => {
  it('defaults to 1d6 and returns valid result', () => {
    const result = rollDice({})
    expect(result.rolls).toHaveLength(1)
    expect(result.total).toBe(result.rolls[0])
    expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
    expect(result.rolls[0]).toBeLessThanOrEqual(6)
  })

  it('handles custom params (3d20)', () => {
    const result = rollDice({ count: 3, sides: 20 })
    expect(result.rolls).toHaveLength(3)
    const sum = result.rolls.reduce((a, b) => a + b, 0)
    expect(result.total).toBe(sum)
    for (const roll of result.rolls) {
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })

  it('clamps count to 1-10 and sides to 2-100', () => {
    const low = rollDice({ count: -5, sides: 0 })
    expect(low.rolls).toHaveLength(1)
    expect(low.rolls[0]).toBeGreaterThanOrEqual(1)
    expect(low.rolls[0]).toBeLessThanOrEqual(2)

    const high = rollDice({ count: 99, sides: 999 })
    expect(high.rolls).toHaveLength(10)
    for (const roll of high.rolls) {
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(100)
    }
  })

  it('description format matches "NdM: [rolls] = total"', () => {
    const result = rollDice({ count: 2, sides: 8 })
    const pattern = /^2d8: \[\d+, \d+\] = \d+$/
    expect(result.description).toMatch(pattern)
  })
})

// ── flipCoin ──────────────────────────────────────────────────────────────────

describe('flipCoin', () => {
  it('returns either heads or tails', () => {
    const result = flipCoin()
    expect(['heads', 'tails']).toContain(result.result)
  })

  it('produces both heads and tails over multiple calls', () => {
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      results.add(flipCoin().result)
    }
    expect(results.has('heads')).toBe(true)
    expect(results.has('tails')).toBe(true)
  })
})

// ── getCurrentTime ────────────────────────────────────────────────────────────

describe('getCurrentTime', () => {
  it('returns correct timezone name for explicit IANA timezone', () => {
    const result = getCurrentTime({ location: 'Asia/Tokyo' })
    expect(result.timezone).toBe('Asia/Tokyo')
    expect(result.time).toBeDefined()
    expect(result.date).toBeDefined()
    expect(result.day).toBeDefined()
  })

  it('returns a result with time/date/day fields when no params given', () => {
    const result = getCurrentTime({})
    expect(result.time).toBeTruthy()
    expect(result.date).toBeTruthy()
    expect(result.day).toBeTruthy()
    expect(result.timezone).toBeTruthy()
  })

  it('includes AM or PM when using 12h format', () => {
    const result = getCurrentTime({ format: '12h', location: 'America/New_York' })
    expect(result.time).toMatch(/AM|PM/)
  })

  it('does not include AM/PM when using 24h format', () => {
    const result = getCurrentTime({ format: '24h', location: 'America/New_York' })
    expect(result.time).not.toMatch(/AM|PM/)
  })
})

// ── searchAnime ───────────────────────────────────────────────────────────────

describe('searchAnime', () => {
  it('parses a successful Jikan response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            title: 'Naruto',
            title_japanese: 'ナルト',
            type: 'TV',
            episodes: 220,
            status: 'Finished Airing',
            score: 8.0,
            synopsis: 'A ninja story...',
            url: 'https://myanimelist.net/anime/20'
          }
        ]
      })
    })

    const result = await searchAnime({ query: 'Naruto' })
    expect(result.query).toBe('Naruto')
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toEqual({
      title: 'Naruto',
      titleJapanese: 'ナルト',
      type: 'TV',
      episodes: 220,
      status: 'Finished Airing',
      score: 8.0,
      synopsis: 'A ninja story...',
      url: 'https://myanimelist.net/anime/20'
    })
  })

  it('returns empty results for empty data array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    })

    const result = await searchAnime({ query: 'xyznonexistent' })
    expect(result.results).toHaveLength(0)
    expect(result.query).toBe('xyznonexistent')
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await searchAnime({ query: 'Naruto' })
    expect(result.results).toHaveLength(0)
    expect(result.query).toBe('Naruto')
  })
})

// ── getAnimeSchedule ──────────────────────────────────────────────────────────

describe('getAnimeSchedule', () => {
  it('returns schedule entries for a given day', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            title: 'One Piece',
            type: 'TV',
            episodes: null,
            score: 8.7,
            url: 'https://myanimelist.net/anime/21'
          }
        ]
      })
    })

    const result = await getAnimeSchedule({ day: 'sunday' })
    expect(result.day).toBe('sunday')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].title).toBe('One Piece')
  })

  it('defaults to today when no day param is provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    })

    const result = await getAnimeSchedule({})

    // 2026-03-20T12:00:00Z is a Friday
    expect(result.day).toBe('friday')
  })
})

// ── getWeather ────────────────────────────────────────────────────────────────

describe('getWeather', () => {
  it('returns weather data for a successful lookup', async () => {
    // geocoding call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'Tokyo', latitude: 35.68, longitude: 139.69, country: 'Japan', country_code: 'JP' }]
      })
    })
    // forecast call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 22.5,
          apparent_temperature: 20.1,
          relative_humidity_2m: 65,
          weather_code: 2,
          wind_speed_10m: 12.3,
          is_day: 1
        }
      })
    })

    const result = await getWeather({ city: 'Tokyo' })
    expect(result.city).toBe('Tokyo')
    expect(result.country).toBe('Japan')
    expect(result.temperature).toBe(22.5)
    expect(result.feelsLike).toBe(20.1)
    expect(result.humidity).toBe(65)
    expect(result.condition).toBe('Partly cloudy')
    expect(result.windSpeed).toBe(12.3)
    expect(result.isDay).toBe(true)
  })

  it('handles city not found from geocoding', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] })
    })

    const result = await getWeather({ city: 'Nonexistentville' })
    expect(result.city).toBe('Nonexistentville')
    expect(result.condition).toBe('City not found')
    expect(result.temperature).toBe(0)
  })

  it('handles weather API fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await getWeather({ city: 'Tokyo' })
    expect(result.city).toBe('Tokyo')
    expect(result.condition).toBe('Request failed')
    expect(result.temperature).toBe(0)
  })
})

// ── executeToolCall ───────────────────────────────────────────────────────────

describe('executeToolCall', () => {
  it('routes roll_dice correctly', async () => {
    const result = (await executeToolCall('roll_dice', { count: 1, sides: 6 })) as { rolls: number[]; total: number }
    expect(result.rolls).toHaveLength(1)
    expect(result.total).toBeGreaterThanOrEqual(1)
  })

  it('routes flip_coin correctly', async () => {
    const result = (await executeToolCall('flip_coin', {})) as { result: string }
    expect(['heads', 'tails']).toContain(result.result)
  })

  it('routes get_current_time correctly', async () => {
    const result = (await executeToolCall('get_current_time', { location: 'Asia/Tokyo' })) as { timezone: string }
    expect(result.timezone).toBe('Asia/Tokyo')
  })

  it('routes search_anime correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    })
    const result = (await executeToolCall('search_anime', { query: 'test' })) as { results: unknown[] }
    expect(result.results).toHaveLength(0)
  })

  it('routes get_anime_schedule correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    })
    const result = (await executeToolCall('get_anime_schedule', { day: 'monday' })) as { day: string }
    expect(result.day).toBe('monday')
  })

  it('routes get_weather correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'London', latitude: 51.5, longitude: -0.12, country: 'UK' }]
      })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 15,
          apparent_temperature: 13,
          relative_humidity_2m: 80,
          weather_code: 3,
          wind_speed_10m: 20,
          is_day: 1
        }
      })
    })
    const result = (await executeToolCall('get_weather', { city: 'London' })) as { city: string }
    expect(result.city).toBe('London')
  })

  it('returns error object for unknown tool name', async () => {
    const result = await executeToolCall('unknown_tool', {})
    expect(result).toEqual({ error: 'Unknown tool: unknown_tool' })
  })
})
