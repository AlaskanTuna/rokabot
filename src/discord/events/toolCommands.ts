import type { ChatInputCommandInteraction } from 'discord.js'
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders'
import { MessageFlags } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomDecline } from '../responses.js'
import { getCurrentTime } from '../../agent/tools/getCurrentTime.js'
import { getWeather } from '../../agent/tools/getWeather.js'
import { searchAnime } from '../../agent/tools/searchAnime.js'
import { getAnimeSchedule } from '../../agent/tools/getAnimeSchedule.js'

// COLOR CONSTANTS
const PLAYFUL_COLOR = 0xffb3d9
const CURIOUS_COLOR = 0xb2ebf2

// FLAVOR CONSTANTS
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

// ERROR CONSTANTS
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
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}

// Tool: Roll Dice
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

// Tool: Flip Coin
function handleFlipCoin() {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails'
  const flavor = randomFrom(FLAVOR.flip_coin)
  const text = `${flavor}\n\n\uD83E\uDE99 **${result}!**`
  return buildToolMessage(text, PLAYFUL_COLOR)
}

// Tool: Time
function handleTime(interaction: ChatInputCommandInteraction) {
  const location = interaction.options.getString('location', true)
  const format = (interaction.options.getString('format') ?? '24h') as '12h' | '24h'

  const result = getCurrentTime({ location, format })
  const displayName = location.charAt(0).toUpperCase() + location.slice(1)
  const flavor = randomFrom(FLAVOR.time)
  const text = `${flavor}\n\n\uD83D\uDD50 **${displayName}** (${result.timezone})\n${result.time}, ${result.day}, ${result.date}`
  return buildToolMessage(text, CURIOUS_COLOR)
}

// Tool: Anime (via searchAnime tool)
async function handleAnime(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true)
  const flavor = randomFrom(FLAVOR.anime)

  const result = await searchAnime({ query })

  if (result.results.length === 0) {
    const text = `${flavor}\n\nHmm, I couldn't find anything for "${query}"... Maybe try a different title?`
    return buildToolMessage(text, CURIOUS_COLOR)
  }

  const lines = result.results.map((anime) => {
    const score = anime.score ? `\u2B50 ${anime.score}` : 'No score yet'
    const eps = anime.episodes ? `${anime.episodes} eps` : '? eps'
    let synopsis = anime.synopsis ?? 'No synopsis available.'
    if (synopsis.length > 300) synopsis = synopsis.slice(0, 297) + '...'
    return `**${anime.title}**\n${score} \u2022 ${anime.status} \u2022 ${eps}\n${synopsis}\n[\u2197 MAL](${anime.url})`
  })

  const text = `${flavor}\n\n${lines.join('\n\n')}`
  return buildToolMessage(text, CURIOUS_COLOR)
}

// Tool: Schedule (via getAnimeSchedule tool)
async function handleSchedule(interaction: ChatInputCommandInteraction) {
  const scope = (interaction.options.getString('scope') ?? 'day') as 'day' | 'week' | 'season'
  const day = interaction.options.getString('day') ?? undefined
  const sortBy = (interaction.options.getString('sort_by') ?? undefined) as
    | 'score'
    | 'popularity'
    | 'members'
    | 'title'
    | undefined
  const limit = interaction.options.getInteger('limit') ?? undefined
  const anime = interaction.options.getString('anime') ?? undefined
  const flavor = randomFrom(FLAVOR.schedule)

  const result = await getAnimeSchedule({ scope, day, sort_by: sortBy, limit, anime })

  if (result.entries.length === 0) {
    const text = `${flavor}\n\nHmm, nothing found for that~ Maybe try something else?`
    return buildToolMessage(text, CURIOUS_COLOR)
  }

  // Specific anime lookup
  if (anime) {
    const entry = result.entries[0]
    const eps = entry.episodes ? `${entry.episodes} eps` : '? eps'
    const score = entry.score ? `\u2B50 ${entry.score}` : 'No score yet'
    const broadcastLine =
      entry.broadcastDay && entry.broadcastTime
        ? `\uD83D\uDCC5 ${capitalize(entry.broadcastDay)}s at ${entry.broadcastTime} JST`
        : '\uD83D\uDCC5 Broadcast TBA'
    const tzLine = entry.broadcastTimezones ? `  \uD83D\uDD50 ${formatTimezoneList(entry.broadcastTimezones)}` : ''
    const seasonLine = entry.season && entry.year ? `\uD83C\uDF38 ${capitalize(entry.season)} ${entry.year}` : ''

    const lines = [
      `${flavor}`,
      '',
      `\uD83D\uDD0D **${entry.title}**`,
      `\uD83D\uDCFA ${entry.type} \u2022 ${eps} \u2022 ${score} \u2022 ${entry.status}`,
      broadcastLine,
      ...(tzLine ? [tzLine] : []),
      ...(seasonLine ? [seasonLine] : []),
      `[\u2197 MAL](${entry.url})`
    ]

    return buildToolMessage(lines.join('\n'), CURIOUS_COLOR)
  }

  // List results (day/week/season)
  const sortLabel = sortBy ? `sorted by ${sortBy}` : 'sorted by score'
  const header = `\uD83D\uDCC5 **${result.label}** (${sortLabel})`

  const lines = result.entries.map((entry, i) => {
    const score = entry.score ? `\u2B50 ${entry.score}` : ''
    const broadcastPart =
      entry.broadcastDay && entry.broadcastTime
        ? `${capitalize(entry.broadcastDay)}s at ${entry.broadcastTime} JST`
        : 'Broadcast TBA'
    const tzShort = entry.broadcastTimezones ? ` (${formatTimezoneShort(entry.broadcastTimezones)})` : ''
    return `${i + 1}. **${entry.title}** ${score}\n   ${broadcastPart}${tzShort}`
  })

  const footer = `\nShowing ${result.entries.length} of ${result.total} results`
  const text = `${flavor}\n\n${header}\n\n${lines.join('\n')}\n${footer}`
  return buildToolMessage(text, CURIOUS_COLOR)
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatTimezoneList(tz: Record<string, string>): string {
  return Object.entries(tz)
    .map(([zone, time]) => `${time} ${zone}`)
    .join(' | ')
}

function formatTimezoneShort(tz: Record<string, string>): string {
  const preferred = ['EST', 'GMT']
  const parts: string[] = []
  for (const key of preferred) {
    if (tz[key]) parts.push(`${tz[key]} ${key}`)
  }
  if (parts.length === 0) {
    const entries = Object.entries(tz).slice(0, 2)
    return entries.map(([zone, time]) => `${time} ${zone}`).join(' | ')
  }
  return parts.join(' | ')
}

// Tool: Weather (Open-Meteo API via getWeather tool)
async function handleWeather(interaction: ChatInputCommandInteraction) {
  const city = interaction.options.getString('city', true)
  const flavor = randomFrom(FLAVOR.weather)

  const result = await getWeather({ city })
  const locationLabel = result.country ? `${result.city}, ${result.country}` : result.city
  const dayNight = result.isDay ? '\u2600\uFE0F' : '\uD83C\uDF19'

  const text = [
    flavor,
    '',
    `${dayNight} **${locationLabel}**`,
    `${result.condition}`,
    `\uD83C\uDF21\uFE0F ${result.temperature}\u00B0C (feels like ${result.feelsLike}\u00B0C)`,
    `\uD83D\uDCA7 ${result.humidity}% humidity`,
    `\uD83D\uDCA8 ${result.windSpeed} km/h`
  ].join('\n')

  return buildToolMessage(text, CURIOUS_COLOR)
}

// Handler
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
