/**
 * Slash command handlers for game features (gacha draw, collection, stats, hangman, shiritori).
 * Each handler formats results as Discord embeds/containers with in-character Roka flavor.
 */

import type { ChatInputCommandInteraction, Client, TextBasedChannel } from 'discord.js'
import { EmbedBuilder, MessageFlags } from 'discord.js'
import { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder } from '@discordjs/builders'
import { logger } from '../../utils/logger.js'
import { drawItem, getCollection, getCollectionStats } from '../../games/gacha.js'
import { RARITY_COLORS, RARITY_EMOJI, getTotalItemCount, type GachaRarity } from '../../games/data/gachaItems.js'
import {
  startGame as startHangman,
  guessLetter,
  guessWord,
  getGame,
  getHangmanArt,
  getTimeoutAt as getHangmanTimeoutAt,
  setTimeoutCallback
} from '../../games/hangman.js'
import {
  startGame as startShiritori,
  joinGame as joinShiritori,
  submitWord as submitShiritoriWord,
  endGame as endShiritori,
  getScores as getShiritoriScores,
  getGame as getShiritoriGame,
  getTimeoutAt as getShiritoriTimeoutAt
} from '../../games/shiritori.js'
import { getDb } from '../../storage/database.js'

// ── Components V2 game container builder ──

interface GameContainerOptions {
  accentColor: number
  title: string
  body: string
  footer?: string
}

function buildGameContainer(options: GameContainerOptions) {
  const container = new ContainerBuilder()
    .setAccentColor(options.accentColor)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${options.title}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(options.body))

  if (options.footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${options.footer}`))
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}

// ── Hangman accent colors ──

const HANGMAN_COLORS = {
  start: 0x6c8aff,
  correct: 0x34c759,
  wrong: 0xff453a,
  duplicate: 0xff9f0a,
  win: 0xffd700,
  lose: 0x8b0000,
  info: 0xb0c4de
}

// ── Shiritori accent colors ──

const SHIRITORI_COLORS = {
  start: 0x6c8aff,
  join: 0x6c8aff,
  valid: 0x34c759,
  invalid: 0xff453a,
  end: 0xffd700,
  scores: 0xb0c4de,
  info: 0xff9f0a
}

// ── Gacha handlers (unchanged — keep embeds) ──

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

// ── Guide handlers ──

function handleHangmanGuide() {
  return buildGameContainer({
    accentColor: 0xb0c4de,
    title: '\uD83C\uDFAF How to Play Hangman',
    body: [
      'Roka picks a secret word from her collection of anime, food, and Japanese culture terms. Your job is to guess it!',
      '',
      '**Commands:**',
      '\u2022 `/hangman start` \u2014 Start a new game',
      '\u2022 `/hangman guess <letter>` \u2014 Guess a single letter',
      '\u2022 `/hangman guess <word>` \u2014 Guess the full word (risky!)',
      '',
      '**Rules:**',
      '\u2022 You have **6 lives** \u2014 each wrong letter costs one',
      '\u2022 Guessing the full word wrong also costs a life',
      '\u2022 You have **2 minutes** per guess before time runs out',
      '\u2022 The hint tells you the category~',
      '',
      '**Scoring:**',
      '\u2022 Win = remaining lives as points (max 6)',
      '\u2022 Lose = 0 points'
    ].join('\n')
  })
}

function handleShiritoriGuide() {
  return buildGameContainer({
    accentColor: 0xb0c4de,
    title: '\uD83D\uDD17 How to Play Shiritori',
    body: [
      'Shiritori is a Japanese word chain game! Each word must start with the **last letter** of the previous word.',
      '',
      '**Commands:**',
      '\u2022 `/shiritori start` \u2014 Start a new game',
      '\u2022 `/shiritori join` \u2014 Join before the first move',
      '\u2022 `/shiritori play <word>` \u2014 Submit your word',
      '\u2022 `/shiritori scores` \u2014 View current scores',
      '\u2022 `/shiritori end` \u2014 End the game early',
      '',
      '**Rules:**',
      '\u2022 Words must be **real English words** (2+ letters)',
      '\u2022 No repeating words already used',
      '\u2022 Only the current player can submit (turns rotate)',
      "\u2022 Take too long (2 min)? You're out!",
      '\u2022 Need at least **2 players** to start',
      '',
      '**Scoring:**',
      '\u2022 +1 point per valid word',
      '\u2022 Last player standing wins!'
    ].join('\n')
  })
}

function handleGachaGuide() {
  return buildGameContainer({
    accentColor: 0xb0c4de,
    title: '\uD83C\uDFB0 How Gacha Works',
    body: [
      "Draw a daily fortune from Roka's collection! Each draw gives you a random item with in-character commentary.",
      '',
      '**Commands:**',
      "\u2022 `/gacha draw` \u2014 Draw today's fortune (1 per day)",
      '\u2022 `/gacha collection` \u2014 View your collected items',
      '\u2022 `/gacha stats` \u2014 See completion progress',
      '',
      '**Rarity Tiers:**',
      '\u2022 \u26AA **Common** (60%) \u2014 Daily fortunes, cooking tips',
      '\u2022 \uD83D\uDFE2 **Uncommon** (25%) \u2014 Seasonal messages, trivia',
      '\u2022 \uD83D\uDD35 **Rare** (12%) \u2014 Secret recipes, personal stories',
      '\u2022 \uD83C\uDF1F **Legendary** (3%) \u2014 Unique collectible moments',
      '',
      'You can also trigger a draw by mentioning Roka with "gacha", "draw", "fortune", or "omikuji"~'
    ].join('\n')
  })
}

// ── Leaderboard handler ──

function handleLeaderboard(game: 'hangman' | 'shiritori', interaction: ChatInputCommandInteraction) {
  const db = getDb()

  const rows = db
    .prepare(
      `
    SELECT user_id, SUM(score) as total_score, COUNT(*) as games_played
    FROM game_scores
    WHERE game = ?
    GROUP BY user_id
    ORDER BY total_score DESC
    LIMIT 10
  `
    )
    .all(game) as Array<{ user_id: string; total_score: number; games_played: number }>

  if (rows.length === 0) {
    return buildGameContainer({
      accentColor: 0xb0c4de,
      title: `${game === 'hangman' ? '\uD83C\uDFC6 Hangman' : '\uD83C\uDFC6 Shiritori'} Leaderboard`,
      body: 'No scores recorded yet~ Be the first to play!'
    })
  }

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']
  const lines = rows.map((row, i) => {
    const prefix = i < 3 ? medals[i] : `**${i + 1}.**`
    return `${prefix} <@${row.user_id}> \u2014 **${row.total_score}** pts (${row.games_played} games)`
  })

  const userId = interaction.user.id
  const userInTop = rows.some((r) => r.user_id === userId)
  let footer: string | undefined
  if (!userInTop) {
    const userRow = db
      .prepare(
        `
      SELECT SUM(score) as total_score, COUNT(*) as games_played
      FROM game_scores
      WHERE game = ? AND user_id = ?
    `
      )
      .get(game, userId) as { total_score: number | null; games_played: number } | undefined

    if (userRow?.total_score !== null && userRow?.total_score !== undefined) {
      footer = `Your score: ${userRow.total_score} pts (${userRow.games_played} games)`
    }
  }

  return buildGameContainer({
    accentColor: 0xffd700,
    title: `${game === 'hangman' ? '\uD83C\uDFC6 Hangman' : '\uD83C\uDFC6 Shiritori'} Leaderboard`,
    body: lines.join('\n'),
    footer
  })
}

// ── Hangman helpers ──

function buildHangmanBody(display: string, art: string, lives: number, timeoutAt?: number): string {
  const hearts = '\u2764\uFE0F'.repeat(lives) + '\uD83D\uDDA4'.repeat(6 - lives)
  const lines = [`\`${display}\``, '', `\`\`\`\n${art}\n\`\`\``, '', hearts]

  if (timeoutAt && timeoutAt > 0) {
    lines.push('', `\u23F1\uFE0F <t:${timeoutAt}:R>`)
  }

  return lines.join('\n')
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
    return buildGameContainer({
      accentColor: HANGMAN_COLORS.info,
      title: 'Hangman',
      body: result.message
    })
  }

  const game = getGame(channelId)!
  const art = getHangmanArt(game.remainingLives)
  const timeoutAt = getHangmanTimeoutAt(channelId)
  const body = [
    `**Hint:** ${result.hint}`,
    '',
    buildHangmanBody(result.display!, art, game.remainingLives, timeoutAt)
  ].join('\n')

  return buildGameContainer({
    accentColor: HANGMAN_COLORS.start,
    title: 'Hangman',
    body: `Let's play hangman~ \u266A\n\n${body}`
  })
}

function handleHangmanGuess(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const input = interaction.options.getString('letter_or_word', true).toLowerCase().trim()
  const playerId = interaction.user.id

  // Single letter guess
  if (input.length === 1 && /^[a-z]$/.test(input)) {
    const result = guessLetter(channelId, input)

    if (!result.success) {
      // Duplicate letter or no active game
      if (result.display) {
        const art = getHangmanArt(result.remainingLives)
        const timeoutAt = getHangmanTimeoutAt(channelId)
        const body = buildHangmanBody(result.display, art, result.remainingLives, timeoutAt)
        return buildGameContainer({
          accentColor: HANGMAN_COLORS.duplicate,
          title: 'Hangman',
          body: `${result.message}\n\n${body}`
        })
      }
      return buildGameContainer({
        accentColor: HANGMAN_COLORS.info,
        title: 'Hangman',
        body: result.message
      })
    }

    if (result.gameOver) {
      const art = getHangmanArt(result.remainingLives)
      const display = `\`${result.display}\`\n\n\`\`\`\n${art}\n\`\`\``

      if (result.won) {
        const score = result.remainingLives
        saveHangmanScore(playerId, score)
        return buildGameContainer({
          accentColor: HANGMAN_COLORS.win,
          title: 'Hangman',
          body: `${result.message}\n\n${display}`,
          footer: `Score: ${score} point${score !== 1 ? 's' : ''}`
        })
      } else {
        saveHangmanScore(playerId, 0)
        return buildGameContainer({
          accentColor: HANGMAN_COLORS.lose,
          title: 'Hangman',
          body: `${result.message}\n\n${display}`,
          footer: `The word was: ${result.word}`
        })
      }
    }

    const art = getHangmanArt(result.remainingLives)
    const timeoutAt = getHangmanTimeoutAt(channelId)
    const body = buildHangmanBody(result.display, art, result.remainingLives, timeoutAt)
    const color = result.correct ? HANGMAN_COLORS.correct : HANGMAN_COLORS.wrong
    return buildGameContainer({
      accentColor: color,
      title: 'Hangman',
      body: `${result.message}\n\n${body}`
    })
  }

  // Full word guess
  const result = guessWord(channelId, input)

  if (!result.success) {
    return buildGameContainer({
      accentColor: HANGMAN_COLORS.info,
      title: 'Hangman',
      body: result.message
    })
  }

  if (result.gameOver) {
    const art = getHangmanArt(result.remainingLives)
    const display = `\`${result.display}\`\n\n\`\`\`\n${art}\n\`\`\``

    if (result.won) {
      const score = result.remainingLives
      saveHangmanScore(playerId, score)
      return buildGameContainer({
        accentColor: HANGMAN_COLORS.win,
        title: 'Hangman',
        body: `${result.message}\n\n${display}`,
        footer: `Score: ${score} point${score !== 1 ? 's' : ''}`
      })
    } else {
      saveHangmanScore(playerId, 0)
      return buildGameContainer({
        accentColor: HANGMAN_COLORS.lose,
        title: 'Hangman',
        body: `${result.message}\n\n${display}`,
        footer: `The word was: ${result.display}`
      })
    }
  }

  const art = getHangmanArt(result.remainingLives)
  const timeoutAt = getHangmanTimeoutAt(channelId)
  const body = buildHangmanBody(result.display, art, result.remainingLives, timeoutAt)
  return buildGameContainer({
    accentColor: HANGMAN_COLORS.wrong,
    title: 'Hangman',
    body: `${result.message}\n\n${body}`
  })
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
    return buildGameContainer({
      accentColor: SHIRITORI_COLORS.info,
      title: 'Shiritori',
      body: result.message
    })
  }

  return buildGameContainer({
    accentColor: SHIRITORI_COLORS.start,
    title: 'Shiritori',
    body: `Alright~ let's play shiritori! \u266A\n\n${result.message}`,
    footer: 'Use /shiritori join to join'
  })
}

function handleShiritoriJoin(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName

  const result = joinShiritori(channelId, displayName)

  if (!result.success) {
    return buildGameContainer({
      accentColor: SHIRITORI_COLORS.info,
      title: 'Shiritori',
      body: result.message
    })
  }

  const game = getShiritoriGame(channelId)
  const playerCount = game ? game.currentPlayerOrder.length : 0

  return buildGameContainer({
    accentColor: SHIRITORI_COLORS.join,
    title: 'Shiritori',
    body: `Welcome to the game, **${displayName}**~! ${result.message}\n\n${playerCount} player${playerCount !== 1 ? 's' : ''} in the game`
  })
}

function handleShiritoriPlay(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName
  const word = interaction.options.getString('word', true)

  const result = submitShiritoriWord(channelId, displayName, word)

  if (!result.success) {
    return buildGameContainer({
      accentColor: SHIRITORI_COLORS.invalid,
      title: 'Shiritori',
      body: result.message
    })
  }

  const timeoutAt = getShiritoriTimeoutAt(channelId)
  const timerLine = timeoutAt > 0 ? `\n\n\u23F1\uFE0F <t:${timeoutAt}:R>` : ''

  return buildGameContainer({
    accentColor: SHIRITORI_COLORS.valid,
    title: 'Shiritori',
    body: `Nice one~ ${result.message}${timerLine}`
  })
}

function handleShiritoriEnd(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const game = getShiritoriGame(channelId)

  if (!game) {
    return buildGameContainer({
      accentColor: SHIRITORI_COLORS.info,
      title: 'Shiritori',
      body: 'There is no active game in this channel!'
    })
  }

  // Save scores for all players before ending
  const playerUserIds = new Map<string, string>()
  const member = interaction.member
  const displayName = member && 'displayName' in member ? member.displayName : interaction.user.displayName
  playerUserIds.set(displayName, interaction.user.id)

  const result = endShiritori(channelId)

  // Save scores to SQLite
  for (const [name, score] of result.scores) {
    const userId = playerUserIds.get(name) ?? name
    saveShiritoriScore(userId, score)
  }

  return buildGameContainer({
    accentColor: SHIRITORI_COLORS.end,
    title: 'Shiritori',
    body: `Game over! Here are the final scores~\n\n${result.message}`
  })
}

function handleShiritoriScores(interaction: ChatInputCommandInteraction) {
  const channelId = interaction.channelId
  const result = getShiritoriScores(channelId)

  if (!result.success) {
    return buildGameContainer({
      accentColor: SHIRITORI_COLORS.info,
      title: 'Shiritori',
      body: result.message
    })
  }

  return buildGameContainer({
    accentColor: SHIRITORI_COLORS.scores,
    title: 'Shiritori',
    body: result.message
  })
}

const GAME_COMMAND_NAMES = new Set(['gacha', 'hangman', 'shiritori'])

/** Build a Components V2 container for timeout notifications sent to the channel. */
function buildTimeoutContainer(accentColor: number, title: string, body: string) {
  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${title}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as typeof MessageFlags.IsComponentsV2
  }
}

/** Create a dispatcher that routes game slash commands to their respective handlers. */
export function createGameCommandHandler(client?: Client) {
  // Wire up the hangman timeout callback so we can notify the channel
  if (client) {
    setTimeoutCallback((channelId: string, word: string) => {
      const channel = client.channels.cache.get(channelId)
      if (channel && 'send' in channel) {
        const payload = buildTimeoutContainer(
          HANGMAN_COLORS.lose,
          'Hangman',
          `Time's up~ The word was **${word}**. You took too long! \u{1F4A4}`
        )
        ;(channel as Extract<TextBasedChannel, { send: unknown }>)
          .send(payload)
          .catch((err: unknown) => logger.error({ error: err, channelId }, 'Failed to send hangman timeout message'))
      }
    })
  }

  // Wire up the shiritori timeout callback
  if (client) {
    import('../../games/shiritori.js').then((shiritori) => {
      const game = shiritori
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
                  const payload = buildTimeoutContainer(
                    SHIRITORI_COLORS.info,
                    'Shiritori',
                    `**${playerName}** took too long... they're out! \u{1F4A4}\n\n**${winner}** wins the game! Congratulations~ \u266A`
                  )
                  sendable
                    .send(payload)
                    .catch((err: unknown) =>
                      logger.error({ error: err, channelId: chId }, 'Failed to send shiritori timeout message')
                    )
                } else {
                  const nextPlayer = remaining[g.currentTurnIndex]
                  const payload = buildTimeoutContainer(
                    SHIRITORI_COLORS.info,
                    'Shiritori',
                    `**${playerName}** took too long... they're out! \u{1F4A4} Your turn, **${nextPlayer}**!`
                  )
                  sendable
                    .send(payload)
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
          case 'guide': {
            const payload = handleGachaGuide()
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
          case 'guide': {
            const payload = handleHangmanGuide()
            await interaction.reply(payload)
            break
          }
          case 'leaderboard': {
            const payload = handleLeaderboard('hangman', interaction)
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
          case 'guide': {
            const payload = handleShiritoriGuide()
            await interaction.reply(payload)
            break
          }
          case 'leaderboard': {
            const payload = handleLeaderboard('shiritori', interaction)
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
