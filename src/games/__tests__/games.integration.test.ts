/**
 * Integration tests for game modules — testing full game flows and edge cases
 * not covered by the individual unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../../config.js', () => ({
  config: {
    logging: { level: 'silent' },
    rateLimit: { rpm: 15, rpd: 500 },
    session: { ttlMs: 300_000, windowSize: 10 },
    timezone: 'UTC'
  }
}))

// ── Hangman ──────────────────────────────────────────────────────────────────

import {
  startGame as startHangman,
  guessLetter,
  guessWord,
  getGame as getHangmanGame,
  isGameActive as isHangmanActive,
  destroyAllGames as destroyAllHangmanGames,
  getDisplayWord,
  getHangmanArt,
  setTimeoutCallback
} from '../hangman.js'

describe('hangman: full game flows', () => {
  beforeEach(() => {
    destroyAllHangmanGames()
  })

  afterEach(() => {
    destroyAllHangmanGames()
  })

  it('wins by guessing all letters one by one', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    // Force a known word for deterministic testing
    game.word = 'cat'

    const r1 = guessLetter('ch-1', 'c')
    expect(r1.correct).toBe(true)
    expect(r1.gameOver).toBe(false)

    const r2 = guessLetter('ch-1', 'a')
    expect(r2.correct).toBe(true)
    expect(r2.gameOver).toBe(false)

    const r3 = guessLetter('ch-1', 't')
    expect(r3.correct).toBe(true)
    expect(r3.gameOver).toBe(true)
    expect(r3.won).toBe(true)
    expect(r3.remainingLives).toBe(6)
    expect(r3.message).toContain('cat')
  })

  it('loses by making 6 wrong guesses', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'xyz'

    const wrongLetters = ['a', 'b', 'c', 'd', 'e', 'f']
    let lastResult
    for (const letter of wrongLetters) {
      lastResult = guessLetter('ch-1', letter)
    }

    expect(lastResult!.gameOver).toBe(true)
    expect(lastResult!.won).toBe(false)
    expect(lastResult!.remainingLives).toBe(0)
    expect(lastResult!.message).toContain('xyz')
    expect(isHangmanActive('ch-1')).toBe(false)
  })

  it('wins by guessing the full word', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'ramen'

    const result = guessWord('ch-1', 'ramen')
    expect(result.won).toBe(true)
    expect(result.gameOver).toBe(true)
    expect(result.remainingLives).toBe(6)
    expect(isHangmanActive('ch-1')).toBe(false)
  })

  it('wrong full word guess costs a life', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'ramen'

    const result = guessWord('ch-1', 'sushi')
    expect(result.won).toBe(false)
    expect(result.gameOver).toBe(false)
    expect(result.remainingLives).toBe(5)
  })

  it('rejects duplicate letter guesses', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'test'

    guessLetter('ch-1', 't')
    const duplicate = guessLetter('ch-1', 't')
    expect(duplicate.success).toBe(false)
    expect(duplicate.message).toContain('already tried')
  })

  it('prevents starting two games in the same channel', () => {
    startHangman('ch-1', 'Alice')
    const second = startHangman('ch-1', 'Bob')
    expect(second.success).toBe(false)
    expect(second.message).toContain('already a game')
  })

  it('allows games in different channels', () => {
    const r1 = startHangman('ch-1', 'Alice')
    const r2 = startHangman('ch-2', 'Bob')
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
  })

  it('rejects guesses when no game active', () => {
    const letterResult = guessLetter('ch-999', 'a')
    expect(letterResult.success).toBe(false)

    const wordResult = guessWord('ch-999', 'hello')
    expect(wordResult.success).toBe(false)
  })

  it('handles case-insensitive letter guesses', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'abc'

    const result = guessLetter('ch-1', 'A')
    expect(result.correct).toBe(true)
  })

  it('handles case-insensitive word guesses', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'sushi'

    const result = guessWord('ch-1', 'SUSHI')
    expect(result.won).toBe(true)
  })
})

describe('hangman: display and art', () => {
  beforeEach(() => destroyAllHangmanGames())
  afterEach(() => destroyAllHangmanGames())

  it('shows underscores for unguessed letters', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'hello'
    game.guessedLetters.clear()

    expect(getDisplayWord(game)).toBe('_ _ _ _ _')
  })

  it('reveals guessed letters in display', () => {
    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    game.word = 'hello'
    game.guessedLetters = new Set(['h', 'l'])

    expect(getDisplayWord(game)).toBe('h _ l l _')
  })

  it('returns different art for each life count', () => {
    const arts = new Set<string>()
    for (let i = 0; i <= 6; i++) {
      arts.add(getHangmanArt(i))
    }
    expect(arts.size).toBe(7) // All unique
  })

  it('shows skull emoji at 0 lives', () => {
    const art = getHangmanArt(0)
    expect(art).toContain('\u{1F480}') // 💀
  })

  it('shows smile emoji at 6 lives', () => {
    const art = getHangmanArt(6)
    expect(art).toContain('\u{1F60A}') // 😊
  })
})

describe('hangman: timeout callback', () => {
  beforeEach(() => destroyAllHangmanGames())
  afterEach(() => {
    destroyAllHangmanGames()
    vi.useRealTimers()
  })

  it('invokes timeout callback when game times out', () => {
    vi.useFakeTimers()
    const timeoutSpy = vi.fn()
    setTimeoutCallback(timeoutSpy)

    startHangman('ch-1', 'Alice')
    const game = getHangmanGame('ch-1')!
    const word = game.word

    // Fast-forward past the 120s timeout
    vi.advanceTimersByTime(121_000)

    expect(timeoutSpy).toHaveBeenCalledWith('ch-1', word)
    expect(isHangmanActive('ch-1')).toBe(false)
  })
})

// ── Shiritori ────────────────────────────────────────────────────────────────

import {
  startGame as startShiritori,
  joinGame,
  submitWord,
  endGame,
  getGame as getShiritoriGame,
  isGameActive as isShiritoriActive,
  destroyAllGames as destroyAllShiritoriGames,
  setDictionary
} from '../shiritori.js'

const MINI_DICT = new Set([
  'apple',
  'elephant',
  'table',
  'eagle',
  'energy',
  'yellow',
  'ear',
  'red',
  'dog',
  'green',
  'net',
  'tea',
  'ace',
  'eat'
])

describe('shiritori: multi-player flow', () => {
  beforeEach(() => {
    setDictionary(MINI_DICT)
    destroyAllShiritoriGames()
  })

  afterEach(() => {
    destroyAllShiritoriGames()
  })

  it('three players take turns in order', () => {
    startShiritori('ch-1', 'Alice')
    joinGame('ch-1', 'Bob')
    joinGame('ch-1', 'Charlie')

    const game = getShiritoriGame('ch-1')!
    expect(game.currentPlayerOrder).toEqual(['Alice', 'Bob', 'Charlie'])

    // Force a known starter for determinism
    game.currentWord = 'apple'
    game.usedWords.clear()
    game.usedWords.add('apple')

    // Alice plays (needs 'e' word)
    const r1 = submitWord('ch-1', 'Alice', 'eagle')
    expect(r1.success).toBe(true)
    expect(game.currentPlayerOrder[game.currentTurnIndex]).toBe('Bob')

    // Bob plays (needs 'e' word)
    const r2 = submitWord('ch-1', 'Bob', 'elephant')
    expect(r2.success).toBe(true)
    expect(game.currentPlayerOrder[game.currentTurnIndex]).toBe('Charlie')

    // Charlie plays (needs 't' word)
    const r3 = submitWord('ch-1', 'Charlie', 'tea')
    expect(r3.success).toBe(true)
    expect(game.currentPlayerOrder[game.currentTurnIndex]).toBe('Alice')

    // Verify scores
    expect(game.players.get('Alice')).toBe(1)
    expect(game.players.get('Bob')).toBe(1)
    expect(game.players.get('Charlie')).toBe(1)
  })

  it('wrong player cannot submit on another player\'s turn', () => {
    startShiritori('ch-1', 'Alice')
    joinGame('ch-1', 'Bob')

    const game = getShiritoriGame('ch-1')!
    game.currentWord = 'apple'
    game.usedWords.clear()
    game.usedWords.add('apple')

    // Bob tries to play on Alice's turn
    const result = submitWord('ch-1', 'Bob', 'eagle')
    expect(result.success).toBe(false)
    expect(result.message).toContain('not your turn')
  })

  it('end game shows correct final scores', () => {
    startShiritori('ch-1', 'Alice')
    joinGame('ch-1', 'Bob')

    const game = getShiritoriGame('ch-1')!
    game.currentWord = 'apple'
    game.usedWords.clear()
    game.usedWords.add('apple')

    submitWord('ch-1', 'Alice', 'elephant')
    submitWord('ch-1', 'Bob', 'table')

    const result = endGame('ch-1')
    expect(result.scores.get('Alice')).toBe(1)
    expect(result.scores.get('Bob')).toBe(1)
    expect(isShiritoriActive('ch-1')).toBe(false)
  })
})
