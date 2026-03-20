import type { ChatInputCommandInteraction } from 'discord.js'
import { ContainerBuilder, SectionBuilder, TextDisplayBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomDecline } from '../responses.js'

// --- Colors ---
const PLAYFUL_COLOR = 0xffb3d9
const CURIOUS_COLOR = 0xb2ebf2

// --- Flavor text pools ---
const FLAVOR = {
  roll_dice: [
    'Fufu~ let me see what fate has in store~',
    'Alright, rolling! \u266a',
    'Here goes nothing~!',
    'Let the dice decide your destiny~'
  ],
  flip_coin: [
    'Heads or tails~ here we go!',
    'Let me flip this for you~',
    'Fufu~ I wonder which side it lands on~',
    'Watch carefully~!'
  ],
  time: ['Let me check for you~', 'Hmm, what time is it over there~?', 'One moment~ let me look at the clock!'],
  anime: ['Ooh, let me look that up! \u266a', 'Anime search time~ fufu~', 'Let me see what I can find~!'],
  schedule: ["Let's see what's airing~", 'Checking the schedule for you! \u266a', "Time to see what's on today~"],
  weather: [
    'Hmm, let me check the weather for you~',
    'I wonder what the weather is like there~',
    "Let's see~ checking the forecast!"
  ]
}

const ERROR_MESSAGES = [
  'Nn... something went wrong. Maybe try again later?',
  "Ah, that didn't work... sorry about that~",
  'Mou, I ran into a little trouble. Give me another chance?'
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildToolMessage(text: string, color: number) {
  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text)))

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}

// --- Tool: Roll Dice ---
function handleRollDice(interaction: ChatInputCommandInteraction) {
  const sides = interaction.options.getInteger('sides') ?? 6
  const count = interaction.options.getInteger('count') ?? 1

  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }
  const total = rolls.reduce((a, b) => a + b, 0)

  const flavor = randomFrom(FLAVOR.roll_dice)
  const diceLabel = count > 1 ? `${count}d${sides}` : `d${sides}`
  const rollDisplay = count > 1 ? `[${rolls.join(', ')}] = **${total}**` : `**${rolls[0]}**`

  const text = `${flavor}\n\n\uD83C\uDFB2 **${diceLabel}**: ${rollDisplay}`
  return buildToolMessage(text, PLAYFUL_COLOR)
}

// --- Tool: Flip Coin ---
function handleFlipCoin() {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails'
  const flavor = randomFrom(FLAVOR.flip_coin)
  const text = `${flavor}\n\n\uD83E\uDE99 **${result}!**`
  return buildToolMessage(text, PLAYFUL_COLOR)
}

// --- Tool: Time ---
const CITY_TIMEZONE_MAP: Record<string, string> = {
  tokyo: 'Asia/Tokyo',
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  chicago: 'America/Chicago',
  denver: 'America/Denver',
  toronto: 'America/Toronto',
  vancouver: 'America/Vancouver',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  seoul: 'Asia/Seoul',
  beijing: 'Asia/Shanghai',
  shanghai: 'Asia/Shanghai',
  singapore: 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  mumbai: 'Asia/Kolkata',
  dubai: 'Asia/Dubai',
  moscow: 'Europe/Moscow',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta',
  cairo: 'Africa/Cairo',
  'sao paulo': 'America/Sao_Paulo',
  manila: 'Asia/Manila',
  taipei: 'Asia/Taipei',
  osaka: 'Asia/Tokyo',
  kyoto: 'Asia/Tokyo',
  amsterdam: 'Europe/Amsterdam',
  rome: 'Europe/Rome',
  madrid: 'Europe/Madrid',
  lisbon: 'Europe/Lisbon',
  vienna: 'Europe/Vienna',
  stockholm: 'Europe/Stockholm',
  helsinki: 'Europe/Helsinki',
  warsaw: 'Europe/Warsaw',
  prague: 'Europe/Prague',
  auckland: 'Pacific/Auckland',
  honolulu: 'Pacific/Honolulu'
}

function handleTime(interaction: ChatInputCommandInteraction) {
  const location = interaction.options.getString('location', true)
  const format = interaction.options.getString('format') ?? '12h'

  const lowerLocation = location.toLowerCase().trim()
  const timezone = CITY_TIMEZONE_MAP[lowerLocation] ?? location

  try {
    const now = new Date()
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: format === '12h'
    }
    const formatted = new Intl.DateTimeFormat('en-US', options).format(now)

    const displayName = location.charAt(0).toUpperCase() + location.slice(1)
    const flavor = randomFrom(FLAVOR.time)
    const text = `${flavor}\n\n\uD83D\uDD50 **${displayName}** (${timezone})\n${formatted}`
    return buildToolMessage(text, CURIOUS_COLOR)
  } catch {
    const text = `Hmm, I don't recognize that timezone... Try a city name like "Tokyo" or a timezone like "America/New_York"~`
    return buildToolMessage(text, CURIOUS_COLOR)
  }
}

// --- Tool: Anime (Jikan API) ---
interface JikanAnime {
  mal_id: number
  title: string
  score: number | null
  status: string
  episodes: number | null
  synopsis: string | null
  url: string
}

async function handleAnime(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true)
  const flavor = randomFrom(FLAVOR.anime)

  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5&sfw=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Jikan API returned ${res.status}`)

  const json = (await res.json()) as { data: JikanAnime[] }
  const results = json.data

  if (!results || results.length === 0) {
    const text = `${flavor}\n\nHmm, I couldn't find anything for "${query}"... Maybe try a different title?`
    return buildToolMessage(text, CURIOUS_COLOR)
  }

  const lines = results.map((anime) => {
    const score = anime.score ? `\u2B50 ${anime.score}` : 'No score yet'
    const eps = anime.episodes ? `${anime.episodes} eps` : '? eps'
    let synopsis = anime.synopsis ?? 'No synopsis available.'
    if (synopsis.length > 200) synopsis = synopsis.slice(0, 197) + '...'
    return `**${anime.title}**\n${score} \u2022 ${anime.status} \u2022 ${eps}\n${synopsis}\n[\u2197 MAL](${anime.url})`
  })

  const text = `${flavor}\n\n${lines.join('\n\n')}`
  return buildToolMessage(text, CURIOUS_COLOR)
}

// --- Tool: Schedule (Jikan API) ---
interface JikanScheduleAnime {
  mal_id: number
  title: string
  score: number | null
  episodes: number | null
  url: string
}

async function handleSchedule(interaction: ChatInputCommandInteraction) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const inputDay = interaction.options.getString('day')
  const day = inputDay ?? dayNames[new Date().getDay()]

  const flavor = randomFrom(FLAVOR.schedule)

  const url = `https://api.jikan.moe/v4/schedules?filter=${day}&limit=15&sfw=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Jikan API returned ${res.status}`)

  const json = (await res.json()) as { data: JikanScheduleAnime[] }
  const results = json.data

  if (!results || results.length === 0) {
    const text = `${flavor}\n\nHmm, nothing scheduled for ${day}~ Maybe it's a quiet day?`
    return buildToolMessage(text, CURIOUS_COLOR)
  }

  const displayDay = day.charAt(0).toUpperCase() + day.slice(1)
  const lines = results.map((anime) => {
    const score = anime.score ? `\u2B50 ${anime.score}` : ''
    return `\u2022 **${anime.title}** ${score}`
  })

  const text = `${flavor}\n\n\uD83D\uDCC5 **${displayDay}'s Anime Schedule**\n\n${lines.join('\n')}`
  return buildToolMessage(text, CURIOUS_COLOR)
}

// --- Tool: Weather (wttr.in API) ---
interface WttrResponse {
  current_condition: Array<{
    temp_C: string
    FeelsLikeC: string
    humidity: string
    windspeedKmph: string
    weatherDesc: Array<{ value: string }>
  }>
  nearest_area: Array<{
    areaName: Array<{ value: string }>
    country: Array<{ value: string }>
  }>
}

async function handleWeather(interaction: ChatInputCommandInteraction) {
  const city = interaction.options.getString('city', true)
  const flavor = randomFrom(FLAVOR.weather)

  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Weather API returned ${res.status}`)

  const json = (await res.json()) as WttrResponse
  const current = json.current_condition?.[0]
  const area = json.nearest_area?.[0]

  if (!current || !area) throw new Error('Invalid weather response')

  const areaName = area.areaName[0]?.value ?? city
  const country = area.country[0]?.value ?? ''
  const desc = current.weatherDesc[0]?.value ?? 'Unknown'
  const locationLabel = country ? `${areaName}, ${country}` : areaName

  const weatherEmoji = getWeatherEmoji(desc)

  const text = [
    flavor,
    '',
    `${weatherEmoji} **${locationLabel}**`,
    `${desc}`,
    `\uD83C\uDF21\uFE0F ${current.temp_C}\u00B0C (feels like ${current.FeelsLikeC}\u00B0C)`,
    `\uD83D\uDCA7 ${current.humidity}% humidity`,
    `\uD83D\uDCA8 ${current.windspeedKmph} km/h`
  ].join('\n')

  return buildToolMessage(text, CURIOUS_COLOR)
}

function getWeatherEmoji(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes('sunny') || d.includes('clear')) return '\u2600\uFE0F'
  if (d.includes('partly cloudy')) return '\u26C5'
  if (d.includes('cloud') || d.includes('overcast')) return '\u2601\uFE0F'
  if (d.includes('rain') || d.includes('drizzle')) return '\uD83C\uDF27\uFE0F'
  if (d.includes('thunder') || d.includes('storm')) return '\u26C8\uFE0F'
  if (d.includes('snow') || d.includes('blizzard')) return '\uD83C\uDF28\uFE0F'
  if (d.includes('fog') || d.includes('mist')) return '\uD83C\uDF2B\uFE0F'
  return '\uD83C\uDF24\uFE0F'
}

// --- Handler ---
const TOOL_COMMAND_NAMES = new Set(['roll_dice', 'flip_coin', 'time', 'anime', 'schedule', 'weather'])

export function createToolCommandHandler(rateLimiter: RateLimiter) {
  return async function handleToolCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const commandName = interaction.commandName

    if (!TOOL_COMMAND_NAMES.has(commandName)) return

    logger.info({ channelId: interaction.channelId, command: commandName }, 'Tool command received')

    if (!rateLimiter.tryConsume()) {
      logger.debug({ channelId: interaction.channelId }, 'Rate limit hit for tool command')
      await interaction.reply({ content: getRandomDecline() })
      return
    }

    try {
      switch (commandName) {
        case 'roll_dice': {
          const payload = handleRollDice(interaction)
          await interaction.reply(payload)
          break
        }
        case 'flip_coin': {
          const payload = handleFlipCoin()
          await interaction.reply(payload)
          break
        }
        case 'time': {
          const payload = handleTime(interaction)
          await interaction.reply(payload)
          break
        }
        case 'anime': {
          await interaction.deferReply()
          const payload = await handleAnime(interaction)
          await interaction.editReply(payload)
          break
        }
        case 'schedule': {
          await interaction.deferReply()
          const payload = await handleSchedule(interaction)
          await interaction.editReply(payload)
          break
        }
        case 'weather': {
          await interaction.deferReply()
          const payload = await handleWeather(interaction)
          await interaction.editReply(payload)
          break
        }
      }
    } catch (error) {
      const errDetail =
        error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      logger.error({ error: errDetail, channelId: interaction.channelId, command: commandName }, 'Tool command error')

      const errorText = randomFrom(ERROR_MESSAGES)
      const errorPayload = buildToolMessage(errorText, PLAYFUL_COLOR)

      try {
        if (interaction.deferred) {
          await interaction.editReply(errorPayload)
        } else {
          await interaction.reply(errorPayload)
        }
      } catch (replyError) {
        logger.error({ error: replyError, channelId: interaction.channelId }, 'Failed to send tool error reply')
      }
    }
  }
}
