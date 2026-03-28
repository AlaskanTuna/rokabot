/**
 * Handle gacha draws triggered via @mention keywords.
 * Reuses the same draw logic as the /gacha slash command.
 */

import type { Message } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { drawItem, getCollectionStats } from '../../games/gacha.js'
import { RARITY_COLORS, RARITY_EMOJI, getTotalItemCount } from '../../games/data/gachaItems.js'

const ALREADY_DRAWN_MESSAGES = [
  'Mou~ you already drew today! Come back tomorrow for another try~ \u266A',
  'You already used your draw for today~ Be patient! Good things come to those who wait~ \u266A',
  "Fufu~ one per day is the rule! I'll have something nice waiting for you tomorrow~"
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Handle a gacha draw triggered by mention keywords. Returns true if handled. */
export async function handleGachaMention(message: Message): Promise<boolean> {
  const userId = message.author.id

  try {
    const result = drawItem(userId)

    if (result.alreadyDrawnToday) {
      await message.reply({ content: randomFrom(ALREADY_DRAWN_MESSAGES) })
      return true
    }

    const emoji = RARITY_EMOJI[result.item.rarity]
    const color = RARITY_COLORS[result.item.rarity]
    const stats = getCollectionStats(userId)
    const totalItems = getTotalItemCount()

    const description = result.isNew
      ? result.item.description
      : `${result.item.description}\n\n*You already have this one~ Better luck tomorrow!*`

    const footerLabel = result.isNew ? 'New! \u2728' : 'Duplicate'

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${result.item.name}`)
      .setDescription(description)
      .setColor(color)
      .setFooter({
        text: `${result.item.rarity.toUpperCase()} \u2022 ${footerLabel} \u2022 ${stats.total}/${totalItems} collected`
      })

    await message.reply({ embeds: [embed] })
    return true
  } catch (error) {
    const errDetail = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    logger.error({ error: errDetail, channelId: message.channelId }, 'Error handling gacha mention')
    return false
  }
}
