/** Slash command definitions for direct tool invocations (dice, coin, time, anime, weather, search). */

import { SlashCommandBuilder } from 'discord.js'

export const rollDiceCommand = new SlashCommandBuilder()
  .setName('roll_dice')
  .setDescription('Roll some dice!')
  .addIntegerOption((opt) =>
    opt
      .setName('sides')
      .setDescription('Number of sides (default: 6)')
      .setRequired(false)
      .setMinValue(2)
      .setMaxValue(100)
  )
  .addIntegerOption((opt) =>
    opt.setName('count').setDescription('Number of dice (default: 1)').setRequired(false).setMinValue(1).setMaxValue(10)
  )

export const flipCoinCommand = new SlashCommandBuilder().setName('flip_coin').setDescription('Flip a coin!')

export const timeCommand = new SlashCommandBuilder()
  .setName('time')
  .setDescription('Ask Roka what time it is somewhere!')
  .addStringOption((opt) =>
    opt.setName('location').setDescription('City or timezone (e.g. Tokyo, America/New_York)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('format')
      .setDescription('Time format')
      .setRequired(false)
      .addChoices({ name: '12-hour', value: '12h' }, { name: '24-hour', value: '24h' })
  )

export const animeCommand = new SlashCommandBuilder()
  .setName('anime')
  .setDescription('Search for anime!')
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('Search anime by name')
      .addStringOption((opt) => opt.setName('query').setDescription('Anime title to search for').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('browse')
      .setDescription('Browse anime by filters')
      .addStringOption((opt) =>
        opt
          .setName('sort_by')
          .setDescription('Sort results by')
          .setRequired(false)
          .addChoices(
            { name: 'Score', value: 'score' },
            { name: 'Popularity', value: 'popularity' },
            { name: 'Members', value: 'members' },
            { name: 'Title', value: 'title' },
            { name: 'Start Date', value: 'start_date' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Filter by type')
          .setRequired(false)
          .addChoices(
            { name: 'TV', value: 'tv' },
            { name: 'Movie', value: 'movie' },
            { name: 'OVA', value: 'ova' },
            { name: 'ONA', value: 'ona' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('Filter by status')
          .setRequired(false)
          .addChoices(
            { name: 'Currently Airing', value: 'airing' },
            { name: 'Finished', value: 'complete' },
            { name: 'Upcoming', value: 'upcoming' }
          )
      )
  )

export const scheduleCommand = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Check the anime airing schedule!')
  .addSubcommand((sub) =>
    sub
      .setName('search')
      .setDescription('Look up a specific anime schedule')
      .addStringOption((opt) => opt.setName('anime').setDescription('Anime name to look up').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('browse')
      .setDescription('Browse airing schedule')
      .addStringOption((opt) =>
        opt
          .setName('scope')
          .setDescription('Time range (default: Today)')
          .setRequired(false)
          .addChoices(
            { name: 'Today', value: 'day' },
            { name: 'This Week', value: 'week' },
            { name: 'This Season', value: 'season' }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName('sort_by')
          .setDescription('Sort results by (default: score)')
          .setRequired(false)
          .addChoices(
            { name: 'Score', value: 'score' },
            { name: 'Popularity', value: 'popularity' },
            { name: 'Members', value: 'members' },
            { name: 'Title', value: 'title' }
          )
      )
  )

export const weatherCommand = new SlashCommandBuilder()
  .setName('weather')
  .setDescription('Check the weather!')
  .addStringOption((opt) => opt.setName('city').setDescription('City name (e.g. Tokyo, London)').setRequired(true))

export const searchCommand = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search the web for current info!')
  .addStringOption((opt) => opt.setName('query').setDescription('What to search for').setRequired(true))

export const remindCommand = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Ask Roka to remind you about something!')
  .addSubcommand((sub) =>
    sub
      .setName('in')
      .setDescription('Set a timer-based reminder')
      .addStringOption((opt) => opt.setName('task').setDescription('What to remind you about').setRequired(true))
      .addIntegerOption((opt) =>
        opt.setName('minutes').setDescription('Minutes from now').setRequired(true).setMinValue(1).setMaxValue(10080)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('at')
      .setDescription('Set a reminder for a specific time')
      .addStringOption((opt) => opt.setName('task').setDescription('What to remind you about').setRequired(true))
      .addIntegerOption((opt) =>
        opt.setName('hour').setDescription('Hour (0-23)').setRequired(true).setMinValue(0).setMaxValue(23)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('minute')
          .setDescription('Minute (0-59, default: 0)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(59)
      )
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('View your active reminders'))
  .addSubcommand((sub) =>
    sub
      .setName('cancel')
      .setDescription('Cancel a reminder')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Reminder ID (from /remind list)').setRequired(true))
  )

export const toolCommands = [
  rollDiceCommand,
  flipCoinCommand,
  timeCommand,
  animeCommand,
  scheduleCommand,
  weatherCommand,
  searchCommand,
  remindCommand
]
