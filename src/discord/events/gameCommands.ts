/**
 * Slash command handlers for game features (gacha draw, collection, stats, hangman, shiritori).
 * Each handler formats results as Discord embeds/containers with in-character Roka flavor.
 */

import type { ChatInputCommandInteraction, Client, TextBasedChannel } from 'discord.js'
import { MessageFlags } from 'discord.js'
import {
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder
} from '@discordjs/builders'
import { logger } from '../../utils/logger.js'
import { generateBuddy, saveBuddy, getBuddy, getTopBuddies, getSpeciesInfo, type BuddyData } from '../../games/buddy.js'
import {
  SPECIES,
  RARITY_COLORS,
  RARITY_EMOJI,
  RARITY_PLACEHOLDER_COLORS,
  STAT_NAMES,
  RARITY_STAT_RANGE,
  type BuddyRarity
} from '../../games/data/buddySpecies.js'
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

// ── Buddy pet helpers ──

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Build a stat bar: e.g. "CHARM/魅力  ████░░░░░░  4/10" */
function statBar(value: number, max: number = 10): string {
  const filled = '\u2588'.repeat(value)
  const empty = '\u2591'.repeat(max - value)
  return `${filled}${empty}`
}

/** Build a placehold.co thumbnail URL for a species + rarity. */
function buddyThumbnailUrl(species: string, rarity: BuddyRarity): string {
  const info = getSpeciesInfo(species)
  const color = RARITY_PLACEHOLDER_COLORS[rarity]
  const emoji = info?.emoji ?? '\u2753'
  return `https://placehold.co/80x80/${color}/white?text=${encodeURIComponent(emoji)}`
}

/** Build a Components V2 container with a buddy thumbnail in the top-right section. */
function buildBuddyContainer(options: {
  accentColor: number
  title: string
  body: string
  thumbnailUrl?: string
  footer?: string
}) {
  const container = new ContainerBuilder().setAccentColor(options.accentColor)

  if (options.thumbnailUrl) {
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${options.title}\n\n${options.body}`))
      .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: options.thumbnailUrl } }))
    container.addSectionComponents(section)
  } else {
    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${options.title}`))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(options.body))
  }

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

/** Format a buddy summary for display. */
function formatBuddySummary(buddy: BuddyData): string {
  const info = getSpeciesInfo(buddy.species)
  const rarityEmoji = RARITY_EMOJI[buddy.rarity]
  const shinyTag = buddy.shiny ? ' \u2728 **SHINY**' : ''
  const hatDisplay = buddy.hat !== 'none' ? ` | Hat: ${buddy.hat}` : ''

  const lines = [
    `${info?.emoji ?? ''} **${buddy.name ?? 'Unknown'}** ${rarityEmoji} ${buddy.rarity.toUpperCase()}${shinyTag}`,
    `*${info?.name ?? buddy.species}*${hatDisplay} | Eyes: ${buddy.eyes}`,
    ''
  ]

  if (buddy.personality) {
    lines.push(`> ${buddy.personality}`, '')
  }

  for (const { key, display } of STAT_NAMES) {
    const val = buddy.stats[key] ?? 0
    lines.push(`${display}  ${statBar(val)}  **${val}**/10`)
  }

  return lines.join('\n')
}

// ── Buddy command handlers ──

function handleHatch(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const existing = getBuddy(userId)

  if (existing) {
    const info = getSpeciesInfo(existing.species)
    return buildBuddyContainer({
      accentColor: RARITY_COLORS[existing.rarity],
      title: 'Already Hatched!',
      body: `You already have **${existing.name}** the ${info?.name ?? existing.species}~ Use \`/gacha view\` to see them!`,
      thumbnailUrl: buddyThumbnailUrl(existing.species, existing.rarity)
    })
  }

  const buddy = generateBuddy(userId)
  saveBuddy(buddy)

  const info = getSpeciesInfo(buddy.species)
  const rarityEmoji = RARITY_EMOJI[buddy.rarity]
  const shinyTag = buddy.shiny ? '\n\u2728 **SHINY VARIANT!** \u2728' : ''

  const body = [
    `A companion spirit has chosen you~!${shinyTag}`,
    '',
    `${info?.emoji ?? ''} **${buddy.name}** ${rarityEmoji} ${buddy.rarity.toUpperCase()}`,
    `*${info?.description ?? ''}*`,
    ''
  ]

  for (const { key, display } of STAT_NAMES) {
    const val = buddy.stats[key] ?? 0
    body.push(`${display}  ${statBar(val)}  **${val}**/10`)
  }

  body.push('', `Use \`/gacha view\` to see your companion anytime~`)

  return buildBuddyContainer({
    accentColor: RARITY_COLORS[buddy.rarity],
    title: 'Companion Hatched!',
    body: body.join('\n'),
    thumbnailUrl: buddyThumbnailUrl(buddy.species, buddy.rarity)
  })
}

function handleBuddyView(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const buddy = getBuddy(userId)

  if (!buddy) {
    return buildGameContainer({
      accentColor: 0xb0c4de,
      title: 'No Companion',
      body: "You don't have a companion spirit yet~ Use `/gacha hatch` to get one!"
    })
  }

  return buildBuddyContainer({
    accentColor: RARITY_COLORS[buddy.rarity],
    title: `${buddy.name ?? 'Your Companion'}`,
    body: formatBuddySummary(buddy),
    thumbnailUrl: buddyThumbnailUrl(buddy.species, buddy.rarity),
    footer: `Hatched on ${new Date(buddy.hatchedAt).toLocaleDateString('en-GB')}`
  })
}

/** Pet interaction responses grouped by species personality archetypes. */
const PET_RESPONSES: Record<string, string[]> = {
  cute: [
    '*nuzzles against your hand happily~* Ehehe, that tickles!',
    '*purrs softly* ...More pats please~',
    '*wiggles excitedly* You always know just where to scratch!',
    "*rolls over and shows their belly* ...D-Don't get the wrong idea!"
  ],
  cool: [
    "*glances at you* ...Fine, I suppose I'll allow this.",
    "*sits perfectly still* ...I'm not enjoying this. (tail wagging)",
    '*yawns dramatically* How boring... (leans into your hand)',
    '*looks away* ...You may continue.'
  ],
  chaotic: [
    '*bounces off the walls* YAAAA! Again again again!',
    "*shapeshifts into a teacup* ...Ha! Didn't expect that, did you?",
    '*sets something on fire* Oops! ...Worth it though!',
    '*cackles wildly* That was FUN! Do it again!'
  ],
  gentle: [
    '*sways peacefully* Thank you... that feels nice~',
    '*glows softly* Your warmth is really comforting...',
    '*hums a quiet melody* Mmm~ this is nice...',
    '*rustles their leaves/petals contentedly* So peaceful~'
  ]
}

/** Map species to personality archetype for pet responses. */
const SPECIES_ARCHETYPE: Record<string, string> = {
  mochi: 'cute',
  chibi: 'cute',
  usagi: 'cute',
  sakura: 'gentle',
  tsukimi: 'gentle',
  kodama: 'gentle',
  yuki: 'gentle',
  tanuki: 'chaotic',
  bakeneko: 'cool',
  inugami: 'cute',
  kitsune: 'cool',
  kappa: 'chaotic',
  tengu: 'cool',
  nekomata: 'cool',
  tatsu: 'chaotic',
  oni: 'chaotic',
  kaiju: 'chaotic',
  obake: 'chaotic'
}

function handlePet(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const buddy = getBuddy(userId)

  if (!buddy) {
    return buildGameContainer({
      accentColor: 0xb0c4de,
      title: 'No Companion',
      body: "You don't have a companion spirit yet~ Use `/gacha hatch` to get one!"
    })
  }

  const archetype = SPECIES_ARCHETYPE[buddy.species] ?? 'cute'
  const responses = PET_RESPONSES[archetype] ?? PET_RESPONSES.cute
  const response = randomFrom(responses)
  const info = getSpeciesInfo(buddy.species)

  return buildBuddyContainer({
    accentColor: RARITY_COLORS[buddy.rarity],
    title: `${info?.emoji ?? ''} ${buddy.name}`,
    body: response,
    thumbnailUrl: buddyThumbnailUrl(buddy.species, buddy.rarity)
  })
}

function handleBuddyStats(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  const buddy = getBuddy(userId)

  if (!buddy) {
    return buildGameContainer({
      accentColor: 0xb0c4de,
      title: 'No Companion',
      body: "You don't have a companion spirit yet~ Use `/gacha hatch` to get one!"
    })
  }

  const info = getSpeciesInfo(buddy.species)
  const rarityEmoji = RARITY_EMOJI[buddy.rarity]
  const range = RARITY_STAT_RANGE[buddy.rarity]
  const totalStats = Object.values(buddy.stats).reduce((s, v) => s + v, 0)

  const lines = [
    `${info?.emoji ?? ''} **${buddy.name}** ${rarityEmoji} ${buddy.rarity.toUpperCase()}`,
    '',
    '**Detailed Stats:**',
    ''
  ]

  const statDescriptions: Record<string, string> = {
    charm: 'Social charisma, flirt power',
    wit: 'Cleverness, comedic timing',
    dere: 'Affection level, warmth',
    drama: 'Tendency for dramatic moments',
    luck: 'Plot armor, gacha fortune'
  }

  for (const { key, display } of STAT_NAMES) {
    const val = buddy.stats[key] ?? 0
    lines.push(`**${display}**  ${statBar(val)}  **${val}**/10`)
    lines.push(`-# ${statDescriptions[key] ?? ''}`)
  }

  lines.push('', `**Total:** ${totalStats}/50`)
  lines.push(`**Stat range:** ${range.floor}\u2013${range.max} (${buddy.rarity})`)

  return buildBuddyContainer({
    accentColor: RARITY_COLORS[buddy.rarity],
    title: 'Companion Stats',
    body: lines.join('\n'),
    thumbnailUrl: buddyThumbnailUrl(buddy.species, buddy.rarity)
  })
}

function handleBuddyGuide() {
  const speciesByRarity: Record<BuddyRarity, string[]> = {
    common: [],
    uncommon: [],
    rare: [],
    epic: [],
    legendary: []
  }
  for (const s of SPECIES) {
    speciesByRarity[s.rarity].push(`${s.emoji} ${s.name}`)
  }

  return buildGameContainer({
    accentColor: 0xb0c4de,
    title: 'Companion Spirit Guide',
    body: [
      'Every user gets a unique companion spirit, determined by your soul (user ID). Your companion is yours forever~',
      '',
      '**Commands:**',
      '\u2022 `/gacha hatch` \u2014 Hatch your companion for the first time',
      '\u2022 `/gacha view` \u2014 View your companion',
      '\u2022 `/gacha pet` \u2014 Interact with your companion',
      '\u2022 `/gacha stats` \u2014 Detailed stat breakdown',
      '\u2022 `/gacha leaderboard` \u2014 Top companions by total stats',
      '',
      '**Rarity Tiers:**',
      `\u2022 ${RARITY_EMOJI.common} **Common** (60%) \u2014 ${speciesByRarity.common.join(', ')}`,
      `\u2022 ${RARITY_EMOJI.uncommon} **Uncommon** (25%) \u2014 ${speciesByRarity.uncommon.join(', ')}`,
      `\u2022 ${RARITY_EMOJI.rare} **Rare** (10%) \u2014 ${speciesByRarity.rare.join(', ')}`,
      `\u2022 ${RARITY_EMOJI.epic} **Epic** (4%) \u2014 ${speciesByRarity.epic.join(', ')}`,
      `\u2022 ${RARITY_EMOJI.legendary} **Legendary** (1%) \u2014 ${speciesByRarity.legendary.join(', ')}`,
      '',
      '**Stats (5):** CHARM/\u9B45\u529B, WIT/\u6A5F\u77E5, DERE/\u30C7\u30EC, DRAMA/\u4FEE\u7F85\u5834, LUCK/\u904B\u547D',
      '',
      'There is also a **1% chance** of a shiny variant~ Good luck!'
    ].join('\n')
  })
}

function handleBuddyLeaderboard(interaction: ChatInputCommandInteraction) {
  const topBuddies = getTopBuddies(10)

  if (topBuddies.length === 0) {
    return buildGameContainer({
      accentColor: 0xb0c4de,
      title: 'Companion Leaderboard',
      body: 'No companions hatched yet~ Be the first to use `/gacha hatch`!'
    })
  }

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']
  const lines = topBuddies.map((buddy, i) => {
    const prefix = i < 3 ? medals[i] : `**${i + 1}.**`
    const info = getSpeciesInfo(buddy.species)
    const totalStats = Object.values(buddy.stats).reduce((s, v) => s + v, 0)
    const rarityEmoji = RARITY_EMOJI[buddy.rarity]
    const shiny = buddy.shiny ? ' \u2728' : ''
    return `${prefix} <@${buddy.userId}> \u2014 **${buddy.name}** ${info?.emoji ?? ''} ${rarityEmoji}${shiny} (${totalStats} pts)`
  })

  const userId = interaction.user.id
  const userInTop = topBuddies.some((b) => b.userId === userId)
  let footer: string | undefined
  if (!userInTop) {
    const userBuddy = getBuddy(userId)
    if (userBuddy) {
      const userTotal = Object.values(userBuddy.stats).reduce((s, v) => s + v, 0)
      footer = `Your companion: ${userBuddy.name} (${userTotal} pts)`
    }
  }

  return buildGameContainer({
    accentColor: 0xffd700,
    title: 'Companion Leaderboard',
    body: lines.join('\n'),
    footer
  })
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

// handleGachaGuide removed — replaced by handleBuddyGuide above

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
          case 'hatch': {
            const payload = handleHatch(interaction)
            await interaction.reply(payload)
            break
          }
          case 'view': {
            const payload = handleBuddyView(interaction)
            await interaction.reply(payload)
            break
          }
          case 'pet': {
            const payload = handlePet(interaction)
            await interaction.reply(payload)
            break
          }
          case 'stats': {
            const payload = handleBuddyStats(interaction)
            await interaction.reply(payload)
            break
          }
          case 'guide': {
            const payload = handleBuddyGuide()
            await interaction.reply(payload)
            break
          }
          case 'leaderboard': {
            const payload = handleBuddyLeaderboard(interaction)
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
