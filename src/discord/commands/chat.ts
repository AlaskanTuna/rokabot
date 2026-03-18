import { SlashCommandBuilder } from 'discord.js'

export const chatCommand = new SlashCommandBuilder()
  .setName('chat')
  .setDescription('Talk with Roka')
  .addStringOption((option) => option.setName('message').setDescription('What do you want to say?').setRequired(true))
