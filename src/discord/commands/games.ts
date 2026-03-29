/** Slash command definitions for game features (gacha, hangman, etc.). */

import { SlashCommandBuilder } from 'discord.js'

export const gachaCommand = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription("Try Roka's daily fortune draw!")
  .addSubcommand((sub) => sub.setName('draw').setDescription('Draw a fortune (1 per day)'))
  .addSubcommand((sub) => sub.setName('collection').setDescription('View your collection'))
  .addSubcommand((sub) => sub.setName('stats').setDescription('View collection stats'))
  .addSubcommand((sub) => sub.setName('guide').setDescription('Learn how Gacha works'))

export const hangmanCommand = new SlashCommandBuilder()
  .setName('hangman')
  .setDescription('Play Hangman with Roka!')
  .addSubcommand((sub) => sub.setName('start').setDescription('Start a new game'))
  .addSubcommand((sub) =>
    sub
      .setName('guess')
      .setDescription('Guess a letter or the full word')
      .addStringOption((opt) =>
        opt.setName('letter_or_word').setDescription('A single letter or the full word').setRequired(true)
      )
  )
  .addSubcommand((sub) => sub.setName('guide').setDescription('Learn how to play Hangman'))
  .addSubcommand((sub) => sub.setName('leaderboard').setDescription('View the Hangman hall of fame'))

export const shiritoriCommand = new SlashCommandBuilder()
  .setName('shiritori')
  .setDescription('Play Shiritori (word chain) with Roka!')
  .addSubcommand((sub) => sub.setName('start').setDescription('Start a new game'))
  .addSubcommand((sub) => sub.setName('join').setDescription('Join the current game'))
  .addSubcommand((sub) =>
    sub
      .setName('play')
      .setDescription('Submit a word')
      .addStringOption((opt) => opt.setName('word').setDescription('Your word').setRequired(true))
  )
  .addSubcommand((sub) => sub.setName('end').setDescription('End the current game'))
  .addSubcommand((sub) => sub.setName('scores').setDescription('View current scores'))
  .addSubcommand((sub) => sub.setName('guide').setDescription('Learn how to play Shiritori'))
  .addSubcommand((sub) => sub.setName('leaderboard').setDescription('View the Shiritori hall of fame'))

export const gameCommands = [gachaCommand, hangmanCommand, shiritoriCommand]
