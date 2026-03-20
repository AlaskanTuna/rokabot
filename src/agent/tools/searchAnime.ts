import { logger } from '../../utils/logger.js'
import { jikanThrottle } from './jikanThrottle.js'

export interface SearchAnimeParams {
  query: string
}

export interface AnimeResult {
  title: string
  titleJapanese: string | null
  type: string
  episodes: number | null
  status: string
  score: number | null
  synopsis: string | null
  url: string
}

export interface SearchAnimeResult {
  results: AnimeResult[]
  query: string
}

interface JikanAnimeEntry {
  title?: string
  title_japanese?: string | null
  type?: string
  episodes?: number | null
  status?: string
  score?: number | null
  synopsis?: string | null
  url?: string
}

interface JikanResponse {
  data?: JikanAnimeEntry[]
}

export async function searchAnime(params: SearchAnimeParams): Promise<SearchAnimeResult> {
  const query = params.query.trim()
  if (!query) {
    return { results: [], query }
  }

  try {
    await jikanThrottle()

    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5&sfw=true`
    const response = await fetch(url)

    if (!response.ok) {
      logger.warn({ status: response.status, url }, 'Jikan API error')
      return { results: [], query }
    }

    const body = (await response.json()) as JikanResponse
    const data = body.data ?? []

    const results: AnimeResult[] = data.map((entry) => ({
      title: entry.title ?? 'Unknown',
      titleJapanese: entry.title_japanese ?? null,
      type: entry.type ?? 'Unknown',
      episodes: entry.episodes ?? null,
      status: entry.status ?? 'Unknown',
      score: entry.score ?? null,
      synopsis: entry.synopsis ?? null,
      url: entry.url ?? ''
    }))

    return { results, query }
  } catch (error) {
    logger.error({ error, query }, 'Failed to search anime')
    return { results: [], query }
  }
}
