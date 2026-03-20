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
  const inputDay = interaction.options.getString('day')
  const flavor = randomFrom(FLAVOR.schedule)

  const result = await getAnimeSchedule({ day: inputDay ?? undefined })

  if (result.entries.length === 0) {
    const text = `${flavor}\n\nHmm, nothing scheduled for ${result.day}~ Maybe it's a quiet day?`
    return buildToolMessage(text, CURIOUS_COLOR)
  }

  const displayDay = result.day.charAt(0).toUpperCase() + result.day.slice(1)
  const lines = result.entries.map((anime) => {
    const score = anime.score ? `\u2B50 ${anime.score}` : ''
    return `\u2022 **${anime.title}** ${score}`
  })

  const text = `${flavor}\n\n\uD83D\uDCC5 **${displayDay}'s Anime Schedule**\n\n${lines.join('\n')}`
  return buildToolMessage(text, CURIOUS_COLOR)
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
