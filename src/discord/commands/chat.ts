/** /chat slash command — the primary way users talk with Roka. */

import { SlashCommandBuilder } from 'discord.js'

export const chatCommand = new SlashCommandBuilder()
  .setName('chat')
  .setDescription('Talk with Roka')
  .addStringOption((option) => option.setName('message').setDescription('What do you want to say?').setRequired(true))
  .addAttachmentOption((option) =>
    option.setName('image').setDescription('Share an image with Roka').setRequired(false)
  )
