/**
 * Slash command handlers for direct tool invocations (bypass the LLM).
 * Each handler calls the underlying tool function and formats the result
 * into a Components V2 container message with in-character flavor text.
 */

import type { ChatInputCommandInteraction } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders'
import { ButtonStyle, ComponentType, MessageFlags } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { RateLimiter } from '../../utils/rateLimiter.js'
import { getRandomDecline } from '../responses.js'
import { getCurrentTime } from '../../agent/tools/getCurrentTime.js'
import { getWeather } from '../../agent/tools/getWeather.js'
import { searchAnime, type SearchAnimeParams } from '../../agent/tools/searchAnime.js'
import { getAnimeSchedule } from '../../agent/tools/getAnimeSchedule.js'
import { searchWeb } from '../../agent/tools/searchWeb.js'
import { createReminder, getActiveReminders, getReminderById, deleteReminder } from '../../storage/reminderStore.js'
import { config } from '../../config.js'

const PLAYFUL_COLOR = 0xffb3d9
const CURIOUS_COLOR = 0xb2ebf2

// In-character flavor lines prepended to each tool response
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
  ],
  search: ['Let me look that up for you~', 'Hmm, good question! Let me check~', "One moment~ I'll search for that!"],
  remind: ["I'll remember for you~", 'Leave it to me! \u266a', "I'll make sure you don't forget~"]
}

const ERROR_MESSAGES = [
  'Nn... something went wrong. Maybe try again later?',
  "Ah, that didn't work... sorry about that~",
  'Mou, I ran into a little trouble. Give me another chance?'
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Wrap text in a colored Components V2 container for consistent tool output styling. */
function buildToolMessage(text: string, color: number) {
  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}

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

function handleFlipCoin() {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails'
  const flavor = randomFrom(FLAVOR.flip_coin)
  const text = `${flavor}\n\n\uD83E\uDE99 **${result}!**`
  return buildToolMessage(text, PLAYFUL_COLOR)
}

function handleTime(interaction: ChatInputCommandInteraction) {
  const location = interaction.options.getString('location', true)
  const format = (interaction.options.getString('format') ?? '24h') as '12h' | '24h'

  const result = getCurrentTime({ location, format })
  const displayName = location.charAt(0).toUpperCase() + location.slice(1)
  const flavor = randomFrom(FLAVOR.time)
  const text = `${flavor}\n\n\uD83D\uDD50 **${displayName}** (${result.timezone})\n${result.time}, ${result.day}, ${result.date}`
  return buildToolMessage(text, CURIOUS_COLOR)
}

// ──────────────────────────────────────────────
// Anime handler (with subcommands + pagination)
// ──────────────────────────────────────────────

async function handleAnime(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand()
  const flavor = randomFrom(FLAVOR.anime)

  let query: string | undefined
  let sortBy: SearchAnimeParams['sort_by']
  let type: SearchAnimeParams['type']
  let status: SearchAnimeParams['status']

  if (subcommand === 'search') {
    query = interaction.options.getString('query', true)
  } else {
    // browse
    sortBy = (interaction.options.getString('sort_by') ?? undefined) as SearchAnimeParams['sort_by']
    type = (interaction.options.getString('type') ?? undefined) as SearchAnimeParams['type']
    status = (interaction.options.getString('status') ?? undefined) as SearchAnimeParams['status']
  }

  const result = await searchAnime({ query, limit: 25, sort_by: sortBy, type, status })

  if (result.results.length === 0) {
    const label = query ? `"${query}"` : 'those filters'
    const text = `${flavor}\n\nHmm, I couldn't find anything for ${label}... Maybe try something different?`
    return buildToolMessage(text, CURIOUS_COLOR)
  }

  const pageSize = 5
  const totalPages = Math.ceil(result.results.length / pageSize)

  function buildAnimePage(page: number) {
    const start = page * pageSize
    const end = Math.min(start + pageSize, result.results.length)
    const pageEntries = result.results.slice(start, end)

    const lines = pageEntries.map((anime, i) => {
      const score = anime.score ? `\u2B50 ${anime.score}` : 'No score yet'
      const eps = anime.episodes ? `${anime.episodes} eps` : '? eps'
      let synopsis = anime.synopsis ?? 'No synopsis available.'
      if (synopsis.length > 200) synopsis = synopsis.slice(0, 197) + '...'
      return `${start + i + 1}. **${anime.title}**\n${score} \u2022 ${anime.status} \u2022 ${eps}\n${synopsis}\n[\u2197 MAL](${anime.url})`
    })

    const pageInfo = totalPages > 1 ? ` \u2022 Page ${page + 1}/${totalPages}` : ''
    const footer = `\nShowing ${start + 1}-${end} of ${result.total} results${pageInfo}`
    return `${flavor}\n\n${lines.join('\n\n')}\n${footer}`
  }

  if (totalPages <= 1) {
    return buildToolMessage(buildAnimePage(0), CURIOUS_COLOR)
  }

  // Multi-page — attach pagination buttons with a 60s collector
  let currentPage = 0
  const interactionId = interaction.id

  const buildPageContainer = (page: number, buttonsEnabled: boolean) => {
    const container = new ContainerBuilder()
      .setAccentColor(CURIOUS_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildAnimePage(page)))
    if (buttonsEnabled) {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`anime_prev_${interactionId}`)
            .setLabel('\u25C0 Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId(`anime_next_${interactionId}`)
            .setLabel('Next \u25B6')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1)
        )
      )
    }
    return container
  }

  const reply = await interaction.editReply({
    components: [buildPageContainer(currentPage, true)],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  })

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000
  })

  collector.on('collect', async (btnInteraction) => {
    if (btnInteraction.user.id !== interaction.user.id) {
      await btnInteraction.reply({ content: "Those buttons aren't for you~", flags: MessageFlags.Ephemeral })
      return
    }

    if (btnInteraction.customId.startsWith('anime_next') && currentPage < totalPages - 1) currentPage++
    else if (btnInteraction.customId.startsWith('anime_prev') && currentPage > 0) currentPage--

    await btnInteraction.update({
      components: [buildPageContainer(currentPage, true)],
      flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
    })
  })

  collector.on('end', async () => {
    await interaction
      .editReply({
        components: [buildPageContainer(currentPage, false)],
        flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
      })
      .catch(() => {})
  })

  return undefined as unknown as ReturnType<typeof buildToolMessage>
}

// ──────────────────────────────────────────────
// Schedule handler (with subcommands + pagination)
// ──────────────────────────────────────────────

async function handleSchedule(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand()
  const flavor = randomFrom(FLAVOR.schedule)

  let anime: string | undefined
  let scope: 'day' | 'week' | 'season' = 'day'
  let sortBy: 'score' | 'popularity' | 'members' | 'title' | undefined

  if (subcommand === 'search') {
    anime = interaction.options.getString('anime', true)
  } else {
    // browse
    scope = (interaction.options.getString('scope') ?? 'day') as 'day' | 'week' | 'season'
    sortBy = (interaction.options.getString('sort_by') ?? undefined) as typeof sortBy
  }

  const result = await getAnimeSchedule({ scope, sort_by: sortBy, limit: 25, anime })

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
        ? `\uD83D\uDCC5 ${capitalize(entry.broadcastDay)} at ${entry.broadcastTime} JST`
        : '\uD83D\uDCC5 Broadcast TBA'
    const tzLine = entry.broadcastTimezones ? `\uD83D\uDD50 ${formatTimezoneList(entry.broadcastTimezones)}` : ''
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

  const sortLabel = sortBy ? `sorted by ${sortBy}` : 'sorted by score'
  const header = `\uD83D\uDCC5 **${result.label}** (${sortLabel})`
  const pageSize = 5
  const totalPages = Math.ceil(result.entries.length / pageSize)
  const interactionId = interaction.id

  function buildPage(page: number) {
    const start = page * pageSize
    const end = Math.min(start + pageSize, result.entries.length)
    const pageEntries = result.entries.slice(start, end)

    const lines = pageEntries.map((entry, i) => {
      const score = entry.score ? `\u2B50 ${entry.score}` : ''
      const broadcastPart =
        entry.broadcastDay && entry.broadcastTime
          ? `${capitalize(entry.broadcastDay)} at ${entry.broadcastTime} JST`
          : 'Broadcast TBA'
      const tzShort = entry.broadcastTimezones ? ` (${formatTimezoneShort(entry.broadcastTimezones)})` : ''
      return `${start + i + 1}. **${entry.title}** ${score}\n   ${broadcastPart}${tzShort}`
    })

    const pageInfo = totalPages > 1 ? ` \u2022 Page ${page + 1}/${totalPages}` : ''
    const footer = `\nShowing ${start + 1}-${end} of ${result.total} results${pageInfo}`
    return `${flavor}\n\n${header}\n\n${lines.join('\n')}\n${footer}`
  }

  if (totalPages <= 1) {
    return buildToolMessage(buildPage(0), CURIOUS_COLOR)
  }

  let currentPage = 0

  const buildPageContainer = (page: number, buttonsEnabled: boolean) => {
    const container = new ContainerBuilder()
      .setAccentColor(CURIOUS_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildPage(page)))
    if (buttonsEnabled) {
      container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`sched_prev_${interactionId}`)
            .setLabel('\u25C0 Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId(`sched_next_${interactionId}`)
            .setLabel('Next \u25B6')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1)
        )
      )
    }
    return container
  }

  const reply = await interaction.editReply({
    components: [buildPageContainer(currentPage, true)],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  })

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000
  })

  collector.on('collect', async (btnInteraction) => {
    if (btnInteraction.user.id !== interaction.user.id) {
      await btnInteraction.reply({ content: "Those buttons aren't for you~", flags: MessageFlags.Ephemeral })
      return
    }

    if (btnInteraction.customId.startsWith('sched_next') && currentPage < totalPages - 1) {
      currentPage++
    } else if (btnInteraction.customId.startsWith('sched_prev') && currentPage > 0) {
      currentPage--
    }

    await btnInteraction.update({
      components: [buildPageContainer(currentPage, true)],
      flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
    })
  })

  collector.on('end', async () => {
    await interaction
      .editReply({
        components: [buildPageContainer(currentPage, false)],
        flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
      })
      .catch(() => {})
  })

  return undefined as unknown as ReturnType<typeof buildToolMessage>
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

// ──────────────────────────────────────────────
// Remind handler (with subcommands)
// ──────────────────────────────────────────────

function handleRemind(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand()
  const userId = interaction.user.id
  const channelId = interaction.channelId

  switch (subcommand) {
    case 'in':
      return handleRemindIn(interaction, userId, channelId)
    case 'at':
      return handleRemindAt(interaction, userId, channelId)
    case 'list':
      return handleRemindList(userId)
    case 'cancel':
      return handleRemindCancel(interaction, userId)
    default:
      return buildToolMessage("Hmm, I don't know that subcommand~", PLAYFUL_COLOR)
  }
}

function handleRemindIn(interaction: ChatInputCommandInteraction, userId: string, channelId: string) {
  const task = interaction.options.getString('task', true)
  const minutes = interaction.options.getInteger('minutes', true)

  const dueAt = Date.now() + minutes * 60 * 1000
  const result = createReminder(userId, channelId, task, dueAt)

  if (!result.success) {
    return buildToolMessage(`Mou~ ${result.message}`, PLAYFUL_COLOR)
  }

  const flavor = randomFrom(FLAVOR.remind)
  const dueTimestamp = Math.floor(dueAt / 1000)
  const text = `${flavor}\n\n\u23F0 **Reminder set!** I'll remind you <t:${dueTimestamp}:R> (<t:${dueTimestamp}:t>)`
  return buildToolMessage(text, PLAYFUL_COLOR)
}

function handleRemindAt(interaction: ChatInputCommandInteraction, userId: string, channelId: string) {
  const task = interaction.options.getString('task', true)
  const hour = interaction.options.getInteger('hour', true)
  const minute = interaction.options.getInteger('minute') ?? 0

  const tz = config.timezone ?? undefined

  // Get current time in configured timezone
  const now = new Date()
  let currentHours: number, currentMins: number
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      timeZone: tz
    })
    const parts = formatter.format(now).split(':')
    currentHours = parseInt(parts[0], 10)
    currentMins = parseInt(parts[1], 10)
  } catch {
    currentHours = now.getHours()
    currentMins = now.getMinutes()
  }

  const targetMinutes = hour * 60 + minute
  const currentMinutes = currentHours * 60 + currentMins
  let diff = targetMinutes - currentMinutes

  if (diff <= 0) diff += 24 * 60 // next day

  const dueAt = Date.now() + diff * 60 * 1000
  const result = createReminder(userId, channelId, task, dueAt)

  if (!result.success) {
    return buildToolMessage(`Mou~ ${result.message}`, PLAYFUL_COLOR)
  }

  const flavor = randomFrom(FLAVOR.remind)
  const dueTimestamp = Math.floor(dueAt / 1000)
  const text = `${flavor}\n\n\u23F0 **Reminder set for <t:${dueTimestamp}:t>!** I'll remind you <t:${dueTimestamp}:R>`
  return buildToolMessage(text, PLAYFUL_COLOR)
}

function handleRemindList(userId: string) {
  const reminders = getActiveReminders(userId)

  if (reminders.length === 0) {
    return buildToolMessage('No active reminders~', PLAYFUL_COLOR)
  }

  const lines = reminders.map((r) => {
    const ts = Math.floor(r.dueAt / 1000)
    return `**#${r.id}** \u2014 "${r.reminder}"\nDue <t:${ts}:R> (<t:${ts}:t>)`
  })

  const container = new ContainerBuilder()
    .setAccentColor(PLAYFUL_COLOR)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\u23F0 **Your Reminders**\n\n${lines.join('\n\n')}`))

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}

function handleRemindCancel(interaction: ChatInputCommandInteraction, userId: string) {
  const id = interaction.options.getInteger('id', true)

  const reminder = getReminderById(id)

  if (!reminder) {
    return buildToolMessage("Hmm, I couldn't find that reminder~ Maybe it already went off?", PLAYFUL_COLOR)
  }

  if (reminder.userId !== userId) {
    return buildToolMessage(
      "That reminder doesn't belong to you~ You can only cancel your own reminders!",
      PLAYFUL_COLOR
    )
  }

  deleteReminder(id)
  return buildToolMessage(`Got it~ Cancelled reminder **#${id}**: "${reminder.reminder}"`, PLAYFUL_COLOR)
}

const TOOL_COMMAND_NAMES = new Set([
  'roll_dice',
  'flip_coin',
  'time',
  'anime',
  'schedule',
  'weather',
  'search',
  'remind'
])

/** Create a dispatcher that routes tool slash commands to their respective handlers. */
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
          if (payload) await interaction.editReply(payload)
          // If payload is undefined, handleAnime already edited the reply (paginated)
          break
        }
        case 'schedule': {
          await interaction.deferReply()
          const payload = await handleSchedule(interaction)
          if (payload) await interaction.editReply(payload)
          // If payload is undefined, handleSchedule already edited the reply (paginated)
          break
        }
        case 'weather': {
          await interaction.deferReply()
          const payload = await handleWeather(interaction)
          await interaction.editReply(payload)
          break
        }
        case 'search': {
          await interaction.deferReply()
          const query = interaction.options.getString('query', true)
          const flavor = randomFrom(FLAVOR.search)
          const result = await searchWeb({ query })
          const lines = [flavor, '', `🔍 **${query}**`]
          if (result.answer && result.answer !== 'No summary available.') {
            lines.push('', result.answer)
          }
          if (result.results.length > 0) {
            lines.push('')
            for (const r of result.results.slice(0, 3)) {
              lines.push(`[\u2197 ${r.title}](${r.url})`)
            }
          } else if (!result.answer || result.answer === 'No summary available.') {
            lines.push('', "Hmm, I couldn't find anything for that~ Maybe try a different query?")
          }
          await interaction.editReply(buildToolMessage(lines.join('\n'), CURIOUS_COLOR))
          break
        }
        case 'remind': {
          const payload = handleRemind(interaction)
          await interaction.reply(payload)
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
