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
  .addStringOption((opt) => opt.setName('query').setDescription('Anime title to search for').setRequired(true))

export const scheduleCommand = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription("Check today's anime airing schedule!")
  .addStringOption((opt) =>
    opt
      .setName('day')
      .setDescription('Day of the week (default: today)')
      .setRequired(false)
      .addChoices(
        { name: 'Monday', value: 'monday' },
        { name: 'Tuesday', value: 'tuesday' },
        { name: 'Wednesday', value: 'wednesday' },
        { name: 'Thursday', value: 'thursday' },
        { name: 'Friday', value: 'friday' },
        { name: 'Saturday', value: 'saturday' },
        { name: 'Sunday', value: 'sunday' }
      )
  )

export const weatherCommand = new SlashCommandBuilder()
  .setName('weather')
  .setDescription('Check the weather!')
  .addStringOption((opt) => opt.setName('city').setDescription('City name (e.g. Tokyo, London)').setRequired(true))

export const toolCommands = [
  rollDiceCommand,
  flipCoinCommand,
  timeCommand,
  animeCommand,
  scheduleCommand,
  weatherCommand
]
