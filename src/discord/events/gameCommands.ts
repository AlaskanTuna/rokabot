/**
 * Slash command handlers for game features (gacha draw, collection, stats, hangman, shiritori).
 * Each handler formats results as Discord embeds with in-character Roka flavor.
 */

import type { ChatInputCommandInteraction, Client, TextBasedChannel } from 'discord.js'
import { EmbedBuilder } from 'discord.js'
import { logger } from '../../utils/logger.js'
import { drawItem, getCollection, getCollectionStats } from '../../games/gacha.js'
import { RARITY_COLORS, RARITY_EMOJI, getTotalItemCount, type GachaRarity } from '../../games/data/gachaItems.js'
import {
  startGame as startHangman,
  guessLetter,
  guessWord,
  getGame,
  getHangmanArt,
  setTimeoutCallback
} from '../../games/hangman.js'
import {
  startGame as startShiritori,
  joinGame as joinShiritori,
  submitWord as submitShiritoriWord,
  endGame as endShiritori,
  getScores as getShiritoriScores,
  getGame as getShiritoriGame
} from '../../games/shiritori.js'
import { getDb } from '../../storage/database.js'

const ALREADY_DRAWN_MESSAGES = [
  'Mou~ you already drew today! Come back tomorrow for another try~ \u266A',
  'You already used your draw for today~ Be patient! Good things come to those who wait~ \u266A',
  "Fufu~ one per day is the rule! I'll have something nice waiting for you tomorrow~"
]

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function handleDraw(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const result = drawItem(userId)

  if (result.alreadyDrawnToday) {
    return { content: randomFrom(ALREADY_DRAWN_MESSAGES) }
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

  return { embeds: [embed] }
}

function handleCollection(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const collection = getCollection(userId)

  if (collection.length === 0) {
    return { content: "You haven't collected anything yet~ Try `/gacha draw` for your first fortune! \u266A" }
  }

  const rarityOrder: GachaRarity[] = ['legendary', 'rare', 'uncommon', 'common']
  const sections: string[] = []

  for (const rarity of rarityOrder) {
    const items = collection.filter((item) => item.rarity === rarity)
    if (items.length === 0) continue

    const emoji = RARITY_EMOJI[rarity]
    const header = `**${rarity.charAt(0).toUpperCase() + rarity.slice(1)}**`
    const itemList = items.map((item) => `${emoji} ${item.name}`).join('\n')
    sections.push(`${header}\n${itemList}`)
  }

  const stats = getCollectionStats(userId)
  const totalItems = getTotalItemCount()

  const embed = new EmbedBuilder()
    .setTitle("\uD83C\uDF81 Roka's Fortune Collection")
    .setDescription(sections.join('\n\n'))
    .setColor(0xffb3d9)
    .setFooter({ text: `${stats.total}/${totalItems} collected (${((stats.total / totalItems) * 100).toFixed(1)}%)` })

  return { embeds: [embed] }
}

function handleStats(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const stats = getCollectionStats(userId)
  const totalItems = getTotalItemCount()

  const legendaryTotal = 4
  const rareTotal = 6
  const uncommonTotal = 11
  const commonTotal = 22

  const lines = [
    `**Total:** ${stats.completion}`,
    '',
    `${RARITY_EMOJI.legendary} **Legendary:** ${stats.legendary}/${legendaryTotal}`,
    `${RARITY_EMOJI.rare} **Rare:** ${stats.rare}/${rareTotal}`,
    `${RARITY_EMOJI.uncommon} **Uncommon:** ${stats.uncommon}/${uncommonTotal}`,
    `${RARITY_EMOJI.common} **Common:** ${stats.common}/${commonTotal}`
  ]

  const pct = totalItems > 0 ? (stats.total / totalItems) * 100 : 0
  let commentary: string
  if (pct === 100) {
    commentary = "You've collected everything?! Sugoi~! You're a true completionist! \u2661"
  } else if (pct >= 75) {
    commentary = "Wow, you're so close to completing the collection~! Keep going! \u266A"
  } else if (pct >= 50) {
    commentary = 'More than halfway there~ You have great luck! \u2606'
  } else if (pct >= 25) {
    commentary = "A nice collection so far~ There's still plenty to discover!"
  } else if (stats.total > 0) {
    commentary = 'Just getting started~ Come back every day for a new draw! \u266A'
  } else {
    commentary = "You haven't drawn anything yet~ Try `/gacha draw` to start your collection!"
  }

  lines.push('', `*${commentary}*`)

  const embed = new EmbedBuilder()
    .setTitle('\uD83D\uDCCA Collection Progress')
    .setDescription(lines.join('\n'))
    .setColor(0xffb3d9)

  return { embeds: [embed] }
}

// ── Hangman helpers ──

function buildHangmanDisplay(display: string, art: string, lives: number): string {
  const hearts = '\u2764\uFE0F'.repeat(lives) + '\uD83D\uDDA4'.repeat(6 - lives)
  return `\`${display}\`\n\n\`\`\`\n${art}\n\`\`\`\nLives: ${hearts}`
}

function saveHangmanScore(playerId: string, score: number): void {
  try {
    getDb()
      .prepare('INSERT INTO game_scores (user_id, game, score, played_at) VALUES (?, ?, ?, ?)')
      .run(playerId, 'hangman', score, Date.now())
  } catch (error) {
    logger.error({ error, playerId, score }, 'Failed to save hangman score')
  }
}

function handleHangmanStart(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const playerId = interaction.user.id
  const result = startHangman(channelId, playerId)

  if (!result.success) {
    return { content: result.message }
  }

  const game = getGame(channelId)!
  const art = getHangmanArt(game.remainingLives)
  const body = buildHangmanDisplay(result.display!, art, game.remainingLives)

  return { content: `${result.message}\n\nHint: ${result.hint}\n\n${body}` }
}

function handleHangmanGuess(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const input = interaction.options.getString('letter_or_word', true).toLowerCase().trim()
  const playerId = interaction.user.id

  // Single letter guess
  if (input.length === 1 && /^[a-z]$/.test(input)) {
    const result = guessLetter(channelId, input)

    if (!result.success) {
      if (result.display) {
        const art = getHangmanArt(result.remainingLives)
        return { content: `${result.message}\n\n${buildHangmanDisplay(result.display, art, result.remainingLives)}` }
      }
      return { content: result.message }
    }

    if (result.gameOver) {
      const art = getHangmanArt(result.remainingLives)
      const score = result.won ? result.remainingLives : 0
      saveHangmanScore(playerId, score)
      return { content: `${result.message}\n\n\`${result.display}\`\n\n\`\`\`\n${art}\n\`\`\`` }
    }

    const art = getHangmanArt(result.remainingLives)
    return { content: `${result.message}\n\n${buildHangmanDisplay(result.display, art, result.remainingLives)}` }
  }

  // Full word guess
  const result = guessWord(channelId, input)

  if (!result.success) {
    return { content: result.message }
  }

  if (result.gameOver) {
    const art = getHangmanArt(result.remainingLives)
    const score = result.won ? result.remainingLives : 0
    saveHangmanScore(playerId, score)
    return { content: `${result.message}\n\n\`${result.display}\`\n\n\`\`\`\n${art}\n\`\`\`` }
  }

  const art = getHangmanArt(result.remainingLives)
  return { content: `${result.message}\n\n${buildHangmanDisplay(result.display, art, result.remainingLives)}` }
}

// ── Shiritori helpers ──

function saveShiritoriScore(userId: string, score: number): void {
  try {
    getDb()
      .prepare('INSERT INTO game_scores (user_id, game, score, played_at) VALUES (?, ?, ?, ?)')
      .run(userId, 'shiritori', score, Date.now())
  } catch (error) {
    logger.error({ error, userId, score }, 'Failed to save shiritori score')
  }
}

function handleShiritoriStart(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName

  const result = startShiritori(channelId, displayName)

  if (!result.success) {
    return { content: result.message }
  }

  return {
    content: `Alright~ let's play shiritori! \u266A ${result.message}`
  }
}

function handleShiritoriJoin(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName

  const result = joinShiritori(channelId, displayName)

  if (!result.success) {
    return { content: result.message }
  }

  return { content: `Welcome to the game, **${displayName}**~! ${result.message}` }
}

function handleShiritoriPlay(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName
  const word = interaction.options.getString('word', true)

  const result = submitShiritoriWord(channelId, displayName, word)

  if (!result.success) {
    return { content: result.message }
  }

  return { content: `Nice one~ ${result.message}` }
}

function handleShiritoriEnd(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const game = getShiritoriGame(channelId)

  if (!game) {
    return { content: 'There is no active game in this channel!' }
  }

  // Save scores for all players before ending
  const playerUserIds = new Map<string, string>()
  // We can only map the ending user; for others, we use displayName as userId fallback
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName
  playerUserIds.set(displayName, interaction.user.id)

  const result = endShiritori(channelId)

  // Save scores to SQLite
  for (const [name, score] of result.scores) {
    const userId = playerUserIds.get(name) ?? name
    saveShiritoriScore(userId, score)
  }

  return { content: `Game over! Here are the final scores~\n\n${result.message}` }
}

function handleShiritoriScores(interaction: ChatInputCommandInteraction) {
  const result = getShiritoriScores(interaction.channelId)
  return { content: result.message }
}

const GAME_COMMAND_NAMES = new Set(['gacha', 'hangman', 'shiritori'])

/** Create a dispatcher that routes game slash commands to their respective handlers. */
export function createGameCommandHandler(client?: Client) {
  // Wire up the hangman timeout callback so we can notify the channel
  if (client) {
    setTimeoutCallback((channelId: string, word: string) => {
      const channel = client.channels.cache.get(channelId)
      if (channel && 'send' in channel) {
        ;(channel as Extract<TextBasedChannel, { send: unknown }>)
          .send(`Time's up~ The word was **${word}**. You took too long! \u{1F4A4}`)
          .catch((err: unknown) => logger.error({ error: err, channelId }, 'Failed to send hangman timeout message'))
      }
    })
  }

  // Wire up the shiritori timeout callback
  if (client) {
    // Import game module and set timeout callback
    import('../../games/shiritori.js').then((shiritori) => {
      const game = shiritori
      // We need to set a callback on each game. Instead, we use the onTimeout property.
      // The timeout is handled internally, but we need to notify the channel.
      // We'll set up a polling-free approach by patching the startGame to set onTimeout.
      const origStartGame = game.startGame
      game.startGame = (channelId: string, starterName: string) => {
        const result = origStartGame(channelId, starterName)
        if (result.success) {
          const g = game.getGame(channelId)
          if (g) {
            g.onTimeout = (chId: string, playerName: string) => {
              const channel = client.channels.cache.get(chId)
              if (channel && 'send' in channel) {
                const sendable = channel as Extract<typeof channel, { send: unknown }>
                const remaining = g.currentPlayerOrder
                if (!g.active && remaining.length === 1) {
                  const winner = remaining[0]
                  sendable
                    .send(
                      `**${playerName}** took too long... they're out! \u{1F4A4}\n\n**${winner}** wins the game! Congratulations~ \u266A`
                    )
                    .catch((err: unknown) =>
                      logger.error({ error: err, channelId: chId }, 'Failed to send shiritori timeout message')
                    )
                } else {
                  const nextPlayer = remaining[g.currentTurnIndex]
                  sendable
                    .send(`**${playerName}** took too long... they're out! \u{1F4A4} Your turn, **${nextPlayer}**!`)
                    .catch((err: unknown) =>
                      logger.error({ error: err, channelId: chId }, 'Failed to send shiritori timeout message')
                    )
                }
              }
            }
          }
        }
        return result
      }
    })
  }

  return async function handleGameCommand(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const commandName = interaction.commandName

    if (!GAME_COMMAND_NAMES.has(commandName)) return false

    logger.info({ channelId: interaction.channelId, command: commandName }, 'Game command received')

    try {
      if (commandName === 'gacha') {
        const subcommand = interaction.options.getSubcommand()

        switch (subcommand) {
          case 'draw': {
            const payload = handleDraw(interaction)
            await interaction.reply(payload)
            break
          }
          case 'collection': {
            const payload = handleCollection(interaction)
            await interaction.reply(payload)
            break
          }
          case 'stats': {
            const payload = handleStats(interaction)
            await interaction.reply(payload)
            break
          }
        }
      } else if (commandName === 'hangman') {
        const subcommand = interaction.options.getSubcommand()

        switch (subcommand) {
          case 'start': {
            const payload = handleHangmanStart(interaction)
            await interaction.reply(payload)
            break
          }
          case 'guess': {
            const payload = handleHangmanGuess(interaction)
            await interaction.reply(payload)
            break
          }
        }
      } else if (commandName === 'shiritori') {
        const subcommand = interaction.options.getSubcommand()

        switch (subcommand) {
          case 'start': {
            const payload = handleShiritoriStart(interaction)
            await interaction.reply(payload)
            break
          }
          case 'join': {
            const payload = handleShiritoriJoin(interaction)
            await interaction.reply(payload)
            break
          }
          case 'play': {
            const payload = handleShiritoriPlay(interaction)
            await interaction.reply(payload)
            break
          }
          case 'end': {
            const payload = handleShiritoriEnd(interaction)
            await interaction.reply(payload)
            break
          }
          case 'scores': {
            const payload = handleShiritoriScores(interaction)
            await interaction.reply(payload)
            break
          }
        }
      }

      return true
    } catch (error) {
      const errDetail =
        error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
      logger.error({ error: errDetail, channelId: interaction.channelId, command: commandName }, 'Game command error')

      const errorText = 'Nn... something went wrong. Maybe try again later?'

      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: errorText })
        } else if (!interaction.replied) {
          await interaction.reply({ content: errorText })
        }
      } catch (replyError) {
        logger.error({ error: replyError, channelId: interaction.channelId }, 'Failed to send game error reply')
      }

      return true
    }
  }
}
