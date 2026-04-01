/** Weather lookups via Open-Meteo geocoding and forecast APIs */

import { config } from '../../config.js'
import { logger } from '../../utils/logger.js'

export interface GetWeatherParams {
  city?: string
}

export interface GetWeatherResult {
  city: string
  country: string
  temperature: number
  feelsLike: number
  humidity: number
  condition: string
  windSpeed: number
  isDay: boolean
}

interface GeocodingResult {
  results?: Array<{
    name?: string
    country?: string
    latitude?: number
    longitude?: number
  }>
}

interface OpenMeteoWeather {
  current?: {
    temperature_2m?: number
    relative_humidity_2m?: number
    apparent_temperature?: number
    weather_code?: number
    wind_speed_10m?: number
    is_day?: number
  }
}

const wmoWeatherCodes: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
}

function weatherCodeToCondition(code: number): string {
  return wmoWeatherCodes[code] ?? 'Unknown'
}

/** Geocode a city name and fetch current weather from Open-Meteo */
export async function getWeather(params: GetWeatherParams): Promise<GetWeatherResult> {
  let city = params.city?.trim() ?? ''
  if (!city) {
    city = config.timezone?.split('/').pop()?.replace(/_/g, ' ') ?? ''
  }
  if (!city) {
    return {
      city: '',
      country: '',
      temperature: 0,
      feelsLike: 0,
      humidity: 0,
      condition: 'No city provided',
      windSpeed: 0,
      isDay: true
    }
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
    const geoResponse = await fetch(geoUrl)

    if (!geoResponse.ok) {
      logger.warn({ status: geoResponse.status }, 'Geocoding API error')
      return emptyResult(city, 'Geocoding failed')
    }

    const geoBody = (await geoResponse.json()) as GeocodingResult
    const location = geoBody.results?.[0]

    if (!location?.latitude || !location?.longitude) {
      return emptyResult(city, 'City not found')
    }

    const lat = location.latitude
    const lon = location.longitude
    const resolvedCity = location.name ?? city
    const country = location.country ?? ''

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day' +
      '&timezone=auto'
    const weatherResponse = await fetch(weatherUrl)

    if (!weatherResponse.ok) {
      logger.warn({ status: weatherResponse.status }, 'Weather API error')
      return emptyResult(resolvedCity, 'Weather fetch failed')
    }

    const weatherBody = (await weatherResponse.json()) as OpenMeteoWeather
    const current = weatherBody.current

    if (!current) {
      return emptyResult(resolvedCity, 'No weather data')
    }

    return {
      city: resolvedCity,
      country,
      temperature: current.temperature_2m ?? 0,
      feelsLike: current.apparent_temperature ?? 0,
      humidity: current.relative_humidity_2m ?? 0,
      condition: weatherCodeToCondition(current.weather_code ?? -1),
      windSpeed: current.wind_speed_10m ?? 0,
      isDay: (current.is_day ?? 1) === 1
    }
  } catch (error) {
    logger.error({ error, city }, 'Failed to fetch weather')
    return emptyResult(city, 'Request failed')
  }
}

function emptyResult(city: string, condition: string): GetWeatherResult {
  return {
    city,
    country: '',
    temperature: 0,
    feelsLike: 0,
    humidity: 0,
    condition,
    windSpeed: 0,
    isDay: true
  }
}
