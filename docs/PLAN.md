# PLAN (AGENT ONLY)

> Refer to `docs/TRD.md` for architecture, data models, API contracts, and code-level details.
> Refer to `docs/PRD.md` for product requirements and acceptance criteria.
> Refer to `docs/ROADMAP.md` for the phase timeline overview.

---

## Phase 0: Scaffolding

### 1. Feature: Project setup and tooling

**Purpose/Issue:** Initialize repo structure, configs, dependencies, and Docker setup.

**Implementation:**

- [x] Create `tsconfig.json` (ES2022, Node16 modules, strict)
- [x] Create `vitest.config.ts` (node env, v8 coverage)
- [x] Update `package.json` with all dependencies and scripts
- [x] Update `.eslintrc.cjs` with prettier integration
- [x] Update `.env.example` with all required/optional vars
- [x] Create `Dockerfile` (multi-stage Alpine build)
- [x] Create `docker-compose.yml` (mem-capped, log rotation)
- [x] Create `.dockerignore`
- [x] Scaffold all `src/` directories and stub files
- [x] Verify `tsc --noEmit` passes cleanly

---

## Phase 1: Core Infrastructure

### 2. Feature: Config module

**Purpose/Issue:** Load and validate all environment variables at startup with fail-fast behavior.

**Implementation:**

- [x] Implement `required()`, `optional()`, `optionalInt()` helpers
- [x] Export typed `config` object with all env var groups
- [x] Write unit tests for missing/invalid env var cases

### 3. Feature: Logger utility

**Purpose/Issue:** Structured JSON logging with pino, pretty-printing in dev.

**Implementation:**

- [x] Implement logger with conditional pino-pretty transport
- [x] Verify log level respects `LOG_LEVEL` env var

### 4. Feature: Rate limiter

**Purpose/Issue:** Token bucket for RPM + daily counter for RPD, checked before any Gemini call.

**Implementation:**

- [x] Implement `RateLimiter` class with token bucket refill
- [x] Implement daily counter with midnight reset
- [x] Expose `tryConsume()`, `remainingRpm`, `remainingRpd`
- [x] Write unit tests for RPM exhaustion, refill, and daily reset

### 5. Feature: Session types and message window

**Purpose/Issue:** Define data models and FIFO message buffer for per-channel memory.

**Implementation:**

- [x] Define `WindowMessage` and `ChannelSession` interfaces
- [x] Implement `pushMessage()` with max-size enforcement
- [x] Implement `clearMessages()`
- [x] Write unit tests for FIFO eviction and edge cases

### 6. Feature: Session manager

**Purpose/Issue:** Per-channel session lifecycle with idle TTL using setTimeout.

**Implementation:**

- [x] Implement `getOrCreateSession()` with lazy initialization
- [x] Implement `addMessage()`, `getHistory()`, `destroySession()`
- [x] Implement `destroyAllSessions()` for graceful shutdown
- [x] Implement idle timer reset on each interaction
- [x] Write unit tests for session creation, TTL expiry, and cleanup

---

## Phase 2: Agent & Prompts

### 7. Feature: 4-layer prompt system

**Purpose/Issue:** Modular prompt layers that combine into a system prompt per request.

**Implementation:**

- [x] Write Layer 0: Core identity prompt
- [x] Write Layer 1: Speech patterns prompt
- [x] Write Layer 2: Tone variant prompts (playful, sincere, domestic, flustered)
- [x] Write Layer 3: Channel awareness builder (participants, time-of-day)
- [x] Review and tune prompts against character bible

### 8. Feature: Tone detector

**Purpose/Issue:** Rule-based keyword matching to select Layer 2 variant. Zero LLM cost.

**Implementation:**

- [x] Define keyword pattern sets for each tone
- [x] Implement `detectTone()` scanning last 3 messages
- [x] Default to 'playful' when no pattern matches
- [x] Write unit tests for each tone trigger and default fallback

### 9. Feature: Prompt assembler

**Purpose/Issue:** Combine all 4 layers into a single system prompt string.

**Implementation:**

- [x] Implement `assembleSystemPrompt()` accepting `AssemblerInput`
- [x] Write unit tests verifying all layers are present in output

### 10. Feature: Roka agent (Gemini integration)

**Purpose/Issue:** ADK agent wrapping Gemini API calls with layered prompts and history.

**Implementation:**

- [x] Implement `generateResponse()` with @google/genai SDK
- [x] Format channel history as `[displayName]: content` pairs
- [x] Implement empty response fallback pool
- [x] Add retry logic for transient Gemini errors (429, 500/503)
- [x] Write integration test with mocked Gemini responses

---

## Phase 3: Discord Integration

### 11. Feature: Discord client setup

**Purpose/Issue:** Initialize discord.js client with required intents and event wiring.

**Implementation:**

- [x] Configure intents (Guilds, GuildMessages, MessageContent)
- [x] Configure partials (Channel, Message)
- [x] Wire ready, interactionCreate, messageCreate events
- [x] Wire error and warn logging handlers

### 12. Feature: /chat slash command

**Purpose/Issue:** Primary conversational entry point via slash command.

**Implementation:**

- [x] Define command with `SlashCommandBuilder`
- [x] Register command globally on bot ready
- [x] Handle with `deferReply()` + `editReply()` for latency

### 13. Feature: Response utilities

**Purpose/Issue:** In-character decline/error pools and Discord message splitting.

**Implementation:**

- [x] Implement decline message pool for rate limit hits
- [x] Implement error message pool for API failures
- [x] Implement `splitResponse()` for 2000-char Discord limit
- [x] Write unit tests for message splitting edge cases

### 14. Feature: Mention/reply handler

**Purpose/Issue:** Trigger Roka when mentioned or when user replies to her message.

**Implementation:**

- [x] Detect bot mention and reply-to-bot conditions
- [x] Strip mention tags from message content
- [x] Show typing indicator while processing
- [x] Integrate with rate limiter, session manager, and agent

### 15. Feature: Entry point and graceful shutdown

**Purpose/Issue:** Bot startup, signal handling, and clean teardown.

**Implementation:**

- [x] Implement SIGTERM/SIGINT handlers
- [x] Destroy all sessions and Discord client on shutdown
- [x] Add 5-second forced exit timeout
- [x] Handle unhandledRejection and uncaughtException

---

## Phase 4: Production Hardening

### 16. Refinement: Concurrency guard

**Purpose/Issue:** Prevent multiple simultaneous Gemini requests per channel.

**Implementation:**

- [x] Add `activeRequest` Set tracking in-flight channels
- [x] Return in-character "I'm still thinking~" if channel is busy
- [x] Clear channel from set on response or error

### 17. Refinement: Error handling polish

**Purpose/Issue:** Robust handling for Gemini and Discord error scenarios.

**Implementation:**

- [x] Handle Gemini 429 with Retry-After header
- [x] Handle Gemini 500/503 with single retry after 2s
- [x] Handle Gemini timeout (>15s) with request cancellation
- [x] Handle Discord missing permissions silently
- [x] Handle deleted messages (Unknown Message) silently

### 18. Refinement: Build verification

**Purpose/Issue:** Ensure full pipeline passes before deployment.

**Implementation:**

- [x] Run `npm run build` (tsc compile)
- [x] Run `npm run lint` (zero errors)
- [x] Run `npm run format:check` (zero diffs)
- [x] Run `npm test` (all tests pass)

---

## Phase 4.5: Gemini Function Calling (Tools)

### 19. Feature: Tool definitions module

**Purpose/Issue:** Define 5 FunctionTools as Gemini-native function declarations for Roka to call during conversations.

**Implementation:**

- [x] Create `src/agent/tools/` directory
- [x] Implement `rollDice` tool — accepts `count` (1-10) and `sides` (2-100), returns roll results and total
- [x] Implement `flipCoin` tool — no params, returns heads/tails
- [x] Implement `getCurrentTime` tool — no params, returns formatted time/day/date in configured timezone
- [x] Implement `searchAnime` tool — accepts `query` string, calls Jikan `/anime?q=...&limit=5`, returns title/score/status/synopsis
- [x] Implement `getAnimeSchedule` tool — accepts optional `day` param, calls Jikan `/schedules?filter={day}&limit=10`, returns airing titles
- [x] Implement `getWeather` tool — accepts `city` string, geocodes via Open-Meteo geocoding API, then fetches current weather (temp, feels-like, conditions, humidity, wind). Two-step: geocode → forecast
- [x] Create `src/agent/tools/index.ts` barrel export with `getToolDeclarations()` and `executeToolCall()` functions
- [x] Add Jikan rate limiting (simple cooldown: 1 request per 350ms)
- [x] Add WMO weather code → human-readable condition mapping
- [x] Write unit tests for all 6 tools

### 20. Feature: Discord slash commands for tools

**Purpose/Issue:** Register dedicated slash commands for each tool so users can invoke them explicitly with typed arguments (lazy-preset style). Slash commands execute tools directly (no Gemini "should I call a tool?" decision), then format results with in-character flavor text + embeds.

**Implementation:**

- [x] `/roll_dice` — options: `sides` (optional, default 6), `count` (optional, default 1)
- [x] `/flip_coin` — no options
- [x] `/time` — options: `location` (required), `format` (optional choice: 12h/24h)
- [x] `/anime` — options: `query` (required string)
- [x] `/schedule` — options: `day` (optional choice: monday-sunday, default today)
- [x] `/weather` — options: `city` (required string)
- [x] Register all 6 new commands alongside existing `/chat` on bot ready
- [x] Create `src/discord/events/toolCommands.ts` handler dispatching to tool executors
- [x] Format results as Discord embeds with Roka-themed colors and in-character flavor text
- [x] Integrate with rate limiter (tool commands consume RPD but not session state)

### 21. Feature: Function calling loop in roka.ts (mention-based)

**Purpose/Issue:** For @mention and reply interactions, extend `generateResponse()` to pass tool declarations to Gemini so it can contextually decide to invoke tools during conversation.

**Implementation:**

- [x] Import tool declarations and executor from `src/agent/tools/`
- [x] Add `tools` property to the `generateContent()` config with function declarations
- [x] After receiving a response, check if it contains `functionCall` parts
- [x] If function call detected: execute the tool, send result back as `functionResponse`, loop until model returns text
- [x] Cap tool call loop at 3 iterations to prevent runaway chains
- [x] Add tool usage logging (tool name, args, result summary)
- [x] Write unit tests for the function calling loop (mocked Gemini responses)

### 22. Feature: Prompt updates for tool awareness

**Purpose/Issue:** Update Layer 0/1 prompts so Roka knows she has tools and uses them naturally in character (mention-based contextual invocation).

**Implementation:**

- [x] Add tool awareness section to `core.ts` — Roka knows she can roll dice, check time, look up anime, check weather
- [x] Add guidance to `speech.ts` — tool results should be woven into natural responses, not regurgitated raw
- [x] Verify system prompt stays within ~1600-1800 token budget (slight increase acceptable)
- [x] Update prompt assembler tests if prompt structure changes

### 23. Refinement: Build verification and testing

**Purpose/Issue:** Ensure all new code passes the full pipeline.

**Implementation:**

- [x] Run `npm run build` (tsc compile)
- [x] Run `npm run lint` (zero errors)
- [x] Run `npm run format:check` (zero diffs)
- [x] Run `npm test` (all tests pass — 117/117)
- [x] Live Discord smoke test with tool-triggering messages (both slash commands and mentions)

---

## Phase 4.6: Full ADK Migration (branch: `root_agent`)

### 24. Feature: ADK LlmAgent migration

**Purpose/Issue:** Replace raw `@google/genai` calls with `@google/adk` LlmAgent + InMemoryRunner for cleaner agent architecture. Experimental branch — not merged to main until validated.

**Implementation:**

- [x] Create `root_agent` branch from main (after Phase 4.5 is merged)
- [x] Rewrite `src/agent/roka.ts` using `LlmAgent` with `instruction` field for system prompt
- [x] Convert all 6 FunctionTools from Gemini-native declarations to ADK `FunctionTool` with Zod schemas
- [x] Replace manual retry/timeout logic with ADK runner's built-in error handling
- [x] Replace manual history management with ADK `InMemorySessionService`
- [x] Implement `beforeModelCallback` for dynamic tone injection into system prompt
- [x] Implement `afterModelCallback` for response post-processing (strip prefix, fallback)
- [x] Add `GOOGLE_SEARCH` directly to agent tools (Gemini 3.x supports coexistence)
- [x] Add `zod` dependency
- [x] Verify image attachment support through ADK's content pipeline
- [x] Verify memory footprint stays within 512MB Docker cap
- [x] Run full test suite and live Discord smoke test
- [x] Document migration differences in `docs/PROGRESS.md`

---

## Phase 5: Docker & Deployment

### 25. Feature: Docker deployment on RPi 5

**Purpose/Issue:** Ship the bot to Raspberry Pi 5 via Docker Compose.

**Implementation:**

- [x] Verify Dockerfile builds on ARM64
- [x] Verify `docker compose up` starts and connects to Discord
- [x] Configure Docker autostart on boot
- [x] Verify memory footprint stays within 512MB Docker cap (~46 MB measured)
- [x] Set up DHCP server (dnsmasq) on Pi eth0 for easy SSH access
- [x] Run end-to-end smoke test (slash command + mention/reply + tool calls)

---

## Phase 6: CI/CD Pipeline

### 26. Feature: GitHub Actions auto-deploy to RPi 5

**Purpose/Issue:** Automate deployment so pushing to `main` triggers a build and restart on the Pi without manual SSH.

**Implementation:**

- [x] Set up SSH key pair for GitHub Actions → Pi access
- [x] Create `.github/workflows/deploy.yml` workflow
- [x] Workflow triggers on push to `main`
- [x] Steps: SSH into Pi → `git pull` → `docker compose up -d --build`
- [x] Add Pi host, SSH key, and user as GitHub repository secrets
- [x] Add health check step (verify container is running after deploy)
- [x] Test end-to-end: push to main → bot auto-restarts on Pi

---

## Phase 7: Bot Feature Enhancements

### 27. Feature: SQLite foundation and session persistence

**Purpose/Issue:** Add persistent storage so conversation history survives bot restarts. Retain the in-memory ADK session as the hot path; SQLite is write-behind storage and cold-start rehydration.

**Implementation:**

- [x] Add `better-sqlite3` dependency (synchronous, zero-config, ARM64 compatible)
- [x] Create `src/storage/database.ts` — initialize SQLite DB at `data/rokabot.db`, create tables on startup
- [x] Create `session_history` table: `channel_id TEXT, role TEXT, display_name TEXT, content TEXT, timestamp INTEGER`
- [x] Create `user_memory` table: `user_id TEXT, fact_key TEXT, fact_value TEXT, updated_at INTEGER, PRIMARY KEY(user_id, fact_key)`
- [x] Create `reminders` table: `id INTEGER PRIMARY KEY, user_id TEXT, channel_id TEXT, reminder TEXT, due_at INTEGER, created_at INTEGER, delivered INTEGER DEFAULT 0`
- [x] Create `game_scores` table: `user_id TEXT, game TEXT, score INTEGER, played_at INTEGER`
- [x] Create `src/storage/sessionStore.ts` — `saveMessage()`, `loadHistory(channelId, limit)`, `clearHistory(channelId)`
- [x] Integrate write-behind into `roka.ts`: after each exchange, persist the user+assistant message pair to SQLite
- [x] Integrate cold-start rehydration: when `ensureSession()` creates a new ADK session, check SQLite for prior history and replay up to `windowSize` events
- [x] Add `data/` to `.gitignore` and `.dockerignore`; ensure Docker volume mount for persistence
- [x] Update `docker-compose.yml` to mount `./data:/app/data` for SQLite persistence across container rebuilds
- [x] Write unit tests for sessionStore (save, load, clear, FIFO ordering)

### 28. Feature: Per-user relationship memory

**Purpose/Issue:** Allow Roka to remember facts about individual users across sessions — nicknames, favorite anime, hobbies, etc. Implemented as an ADK tool so Roka decides what to remember.

**Implementation:**

- [x] Create `src/storage/userMemory.ts` — `saveFact(userId, key, value)`, `getFacts(userId)`, `deleteFact(userId, key)`, `getAllFactsForPrompt(userId): string`
- [x] Create `src/agent/tools/rememberUser.ts` — ADK `FunctionTool` with Zod schema: `user_id: string, fact_key: string, fact_value: string`
- [x] Create `src/agent/tools/recallUser.ts` — ADK `FunctionTool`: `user_id: string` → returns all stored facts for that user
- [x] Register both tools in `src/agent/tools/index.ts`
- [x] Inject per-user facts into system prompt: in `roka.ts generateResponse()`, fetch facts for the speaking user from SQLite and append to Layer 3 context as `"You remember these things about {displayName}: ..."`
- [x] Cap per-user facts at 10 entries (oldest replaced) to keep token budget bounded (~50-100 tokens)
- [x] Update `core.ts` prompt to mention Roka can remember things about people
- [x] Write unit tests for userMemory store and the remember/recall tools

### 29. Feature: Expanded tone system (8 → 12)

**Purpose/Issue:** Add 4 new tones to cover emotional gaps: nostalgic, mischievous, sleepy, competitive.

**Implementation:**

- [x] Add `'nostalgic' | 'mischievous' | 'sleepy' | 'competitive'` to `ToneKey` union in `tones.ts`
- [x] Write tone prompts for each new tone in `TONE_PROMPTS`
- [x] Add keyword patterns to `toneDetector.ts`:
  - `nostalgic`: remember, memories, "back then", seasons, past, childhood, nostalgia, "used to" (minMatches: 2)
  - `mischievous`: dare, prank, secret, bet, sneak, scheme, "I bet", trick, surprise (minMatches: 2)
  - `sleepy`: time-based trigger (hour 22-4) AND/OR keywords: sleepy, tired, yawn, bed, can't sleep, night, exhausted (minMatches: 1 for time-based, 2 for keyword)
  - `competitive`: game, win, lose, score, match, versus, challenge, beat, "let's play", compete, tournament (minMatches: 2)
- [x] Add expression mappings for new tones in `expressions.ts` (reuse existing expression URLs where appropriate)
- [x] Add tone styles (color + imageUrl) for new tones in `toneStyles.ts`
- [x] Insert new tones at correct priority positions in `toneDetector.ts` pattern array
- [x] Update prompt assembler tests and tone detector tests
- [x] Verify system prompt token budget stays within ~1600-1800 tokens

### 30. Feature: Emoji reactions (passive)

**Purpose/Issue:** Roka reacts to messages with contextually appropriate emoji even when not directly addressed. Rule-based, low frequency, zero LLM cost.

**Implementation:**

- [x] Create `src/discord/emojiReactor.ts` — rule-based reactor with keyword → emoji mapping
- [x] Define reaction rules:
  - Food keywords (cook, recipe, hungry, eat, delicious) → 🍳 or 🍵
  - Anime keywords (anime, manga, otaku, waifu) → ✨
  - Compliments to Roka (cute, pretty, beautiful, best girl) → 💕
  - Greetings (good morning, ohayo, hello) → 👋
  - Sadness (sad, lonely, crying) → 🫂
  - Sleep (goodnight, oyasumi) → 🌙
- [x] Add probability gate: only react ~15-20% of the time a rule matches (avoid being annoying)
- [x] Add cooldown: max 1 reaction per channel per 60 seconds
- [x] Wire into `messageCreate` handler: check ALL messages in guilds (not just mentions), apply rules
- [x] Do NOT react to bot messages or messages in DMs
- [x] Write unit tests for reaction rules and probability/cooldown logic

### 31. Feature: Shiritori mini-game

**Purpose/Issue:** Japanese word chain game. Each word must start with the last letter of the previous word. Needs code for dictionary validation, turn tracking, duplicate checking, and scoring.

**Implementation:**

- [x] Create `src/games/shiritori.ts` — game state manager
- [x] Define game state: `channelId, players: Set<string>, usedWords: Set<string>, currentWord: string, currentPlayer: string | null, scores: Map<string, number>, active: boolean`
- [x] Embed a curated English word list (~5000-10000 common words) as a JSON file at `src/games/data/wordlist.json` for validation
- [x] Implement game lifecycle: `startGame()`, `submitWord()`, `endGame()`
- [x] Validation rules: word must start with last letter of previous word, must be in dictionary, must not be previously used, must be 2+ letters
- [x] Scoring: +1 per valid word, player eliminated on invalid submission, last player standing wins
- [x] Create `/shiritori` slash command with subcommands: `start`, `play <word>`, `end`, `scores`
- [x] Register command in `src/discord/commands/games.ts`
- [x] Create handler in `src/discord/events/gameCommands.ts`
- [x] Format game messages with Roka-flavored commentary (in-character reactions to plays)
- [x] Persist final scores to `game_scores` table in SQLite
- [x] Auto-timeout: end game if no move in 120 seconds
- [x] Write unit tests for word validation, turn logic, and scoring

### 32. Feature: Gacha/Fortune draw

**Purpose/Issue:** Daily fortune or collectible draw. Roka gives a random item from a weighted pool. Users can check their collection. Persistent in SQLite.

**Implementation:**

- [x] Create `src/games/gacha.ts` — gacha system
- [x] Create `gacha_collection` table in SQLite: `user_id TEXT, item_id TEXT, obtained_at INTEGER, PRIMARY KEY(user_id, item_id)`
- [x] Define item pools with rarity tiers:
  - Common (60%): anime quotes, Roka's daily fortunes, cooking tips
  - Uncommon (25%): seasonal messages, character trivia
  - Rare (12%): special Roka lines, secret recipes
  - Legendary (3%): unique collectible phrases
- [x] Create item catalog as JSON/TS data file at `src/games/data/gachaItems.ts`
- [x] Implement daily limit: 1 free draw per user per day (tracked in SQLite)
- [x] Create `/gacha` slash command with subcommands: `draw`, `collection`, `stats`
- [x] Also allow @mention trigger: "gacha", "draw", "fortune" keywords
- [x] Format results as Discord embeds with rarity-colored borders and Roka commentary
- [x] Register command and wire handler
- [x] Write unit tests for draw logic, rarity distribution, and daily limit

### 33. Feature: Hangman mini-game

**Purpose/Issue:** Classic word guessing game with anime/VN/Japanese-culture themed word bank. Needs code for game state, letter tracking, and ASCII art display.

**Implementation:**

- [x] Create `src/games/hangman.ts` — game state manager
- [x] Define game state: `channelId, word: string, hint: string, guessedLetters: Set<string>, remainingLives: number (6), active: boolean, playerId: string`
- [x] Create curated word bank at `src/games/data/hangmanWords.ts`: ~100-200 anime/VN/Japanese-culture terms with category hints (e.g., `{ word: "taiyaki", hint: "It's food-related~" }`)
- [x] Implement game logic: `startGame()`, `guessLetter()`, `guessWord()`, `getDisplayWord()` (shows `t _ _ y _ k i` format)
- [x] ASCII/emoji gallows display that updates with each wrong guess
- [x] Create `/hangman` slash command with subcommands: `start`, `guess <letter_or_word>`
- [x] Register command and wire handler
- [x] Roka commentary on guesses: right ("Nice~!"), wrong ("Mou~ that's not it!"), win ("You got it!"), lose ("The word was...!")
- [x] Persist win/loss to `game_scores` table
- [x] One active game per channel at a time
- [x] Auto-timeout: end game if no guess in 120 seconds
- [x] Write unit tests for game logic, win/loss conditions, and display formatting

### 34. Feature: Reminders

**Purpose/Issue:** Users can ask Roka to remind them of something at a future time. Stored in SQLite, delivered via a periodic check.

**Implementation:**

- [x] Create `src/storage/reminderStore.ts` — `createReminder()`, `getDueReminders()`, `markDelivered()`
- [x] Create `src/agent/tools/setReminder.ts` — ADK `FunctionTool`: `user_id: string, channel_id: string, reminder: string, delay_minutes: number`
- [x] Register tool in `src/agent/tools/index.ts`
- [x] Create `src/discord/reminderScheduler.ts` — `setInterval` every 60 seconds, queries SQLite for due reminders, sends Discord message in the original channel
- [x] Format reminder delivery as in-character message: "Hey {user}~ you asked me to remind you: {reminder}"
- [x] Start scheduler in `index.ts` on bot ready; clear on shutdown
- [x] Cap reminders per user at 5 active reminders
- [x] Update `core.ts` prompt to mention Roka can set reminders
- [x] Write unit tests for reminderStore and the setReminder tool

### 35. Refinement: Build verification and testing

**Purpose/Issue:** Ensure all Phase 7 code passes the full pipeline.

**Implementation:**

- [x] Run `npm run build` (tsc compile)
- [x] Run `npm run lint` (zero errors)
- [x] Run `npm run format:check` (zero diffs)
- [x] Run `npm test` (all tests pass)
- [x] Live Discord smoke test with all new features

### 36. Feature: Reply context for additional message types

**Purpose/Issue:** Replying to certain message types (bot's own Components V2 containers, Discord polls, forwarded messages, sticker-only messages) while @mentioning Roka doesn't pass context. She responds as if the user said nothing.

**Implementation:**

- [x] Fix Components V2 container extraction — bot's own container messages (TextDisplay, Section) need recursive text extraction in `messageCreate.ts`
- [x] Add Discord poll extraction — read poll question and options as context text
- [x] Add forwarded message extraction — read the forwarded content
- [x] Add sticker-only messages — pass sticker name/description as context
- [x] Voice messages are out of scope — do NOT handle
- [x] Test with each message type to verify context flows to the LLM

### 37. Feature: `sharp` image pre-processing

**Purpose/Issue:** Images sent to Gemini are raw full-resolution attachments (up to 4 MB). Pre-processing with `sharp` reduces tokens/latency and enables future composite image generation.

**Implementation:**

- [x] Add `sharp` dependency (`npm install sharp`)
- [x] Create `src/utils/imageProcessor.ts` — resize, compress, and normalize images before sending to Gemini
- [x] Target: max 1024px on longest side, JPEG quality 80, strip metadata
- [x] For low-res images: upscale to minimum 512px on shortest side with lanczos3 sharpening to improve Gemini's visual recognition
- [x] Normalize to sRGB color space for consistent processing
- [x] Integrate into `roka.ts` `downloadImage()` — pipe through sharp before base64 encoding
- [x] Update Dockerfile if needed for sharp native dependencies on Alpine ARM64

### 38. Feature: Gacha rework — Buddy Pet System

**Purpose/Issue:** Current gacha (daily fortune draw) lacks engagement. Rework `/gacha` entirely into a pet companion system. Drop all fortune/collectible features, replace with deterministic pet generation.

**Theme:** VN/Anime — pets are modeled as chibi anime companion spirits (e.g., a tiny fox spirit, a mochi blob, a sakura fairy). Stats reflect VN/anime tropes rather than coding.

**Species (18, VN/anime themed):**

- kitsune (fox spirit), tanuki (raccoon dog), nekomata (ghost cat), usagi (moon rabbit), inugami (dog spirit), bakeneko (cat yokai), kodama (tree spirit), kappa (water imp), tengu (crow spirit), oni (demon child), mochi (rice cake blob), sakura (cherry blossom fairy), yuki (snow spirit), tsukimi (moon watcher), kaiju (tiny monster), chibi (mini human), tatsu (baby dragon), obake (shapeshifter ghost)

**Stats (5, VN/anime themed):**

- CHARM — social charisma, flirt power
- WIT — cleverness, comedic timing
- DERE — affection level, warmth
- DRAMA — tendency for dramatic moments
- LUCK — plot armor, gacha fortune

**Rarity tiers:** common (60%), uncommon (25%), rare (10%), epic (4%), legendary (1%)

**Cosmetics:** 6 eye styles (·, ♦, ★, ◉, @, °), 8 hats (crown, ribbon, cat ears, fox ears, halo, wizard hat, flower crown, none)

**1% shiny variant** — sparkle effect on display

**Implementation:**

- [x] Create SQLite `buddy` table: `user_id TEXT PRIMARY KEY, species TEXT, rarity TEXT, shiny INTEGER, eyes TEXT, hat TEXT, name TEXT, personality TEXT, stats_json TEXT, hatched_at INTEGER`
- [x] Implement Mulberry32 PRNG seeded from userId hash for deterministic generation
- [x] Soul generation: deterministic name (prefix+suffix PRNG) + personality (archetype-based from dominant stat) — Gemini integration deferred
- [x] Rework `/gacha` command: replace `draw`/`collection`/`stats` subcommands with `hatch`, `view`, `pet`, `stats`, `guide`, `leaderboard`
- [x] `/gacha hatch` — generate pet if none exists, show result with species reveal
- [x] `/gacha view` — display pet in Components V2 container with placeholder sprite image (top-right thumbnail via SectionBuilder), name, species, rarity, stats
- [x] `/gacha pet` — random in-character interaction response from species archetype
- [x] `/gacha stats` — detailed stats view with bar visualization
- [x] `/gacha guide` — updated guide explaining the pet system
- [x] Placeholder sprite images: use colored placehold.co URLs per species
- [x] Remove old gacha fortune items: deleted `gachaItems.ts` and `gacha.ts`
- [x] Old gacha tables left in place (will be cleaned up on SQLite wipe)
- [x] Update gacha mention handler (gachaMention.ts) to trigger pet view instead of fortune draw
- [x] `/gacha leaderboard` — top companions ranked by total stat sum

### 39. Feature: Background memory extraction

**Purpose/Issue:** The `remember_user` ADK tool relies on the LLM choosing to call it during conversation, which it frequently ignores (especially during emotional/complex roleplay). Per-user memory stays empty. Need a passive, non-blocking mechanism to extract user facts from conversations.

**Approach:** Every 10 messages in a channel, snapshot the conversation window and fire a background Gemini call with a dedicated extraction prompt. Extract facts for ALL users in the window, save to SQLite via existing `saveFact()`. The extraction runs detached from the live conversation — no blocking, no session contamination.

**Implementation:**

- [x] Create `src/agent/memoryExtractor.ts` — standalone module:
  - `maybeExtractMemory(channelId: string)` — called after each message, increments per-channel counter, triggers extraction at every 10th message
  - Uses a separate `GoogleGenAI` client call (not the ADK runner/session) to avoid contaminating conversation history
  - Extraction prompt: focused, no personality, returns JSON array of `{userId, key, value}` facts
  - Parses response, calls `saveFact()` for each extracted fact (skips if fact already exists with same value)
  - Fire-and-forget: runs as detached `void` promise, errors logged but never thrown
- [x] Hook into `roka.ts` `generateResponse()` — after a successful response, call `maybeExtractMemory(channelId)` (non-blocking)
- [x] The extraction prompt should receive messages formatted as `[userId|displayName]: content` so facts are keyed by Discord user ID
- [x] Per-channel message counter resets after extraction fires
- [x] Respect rate limits: skip extraction if `rateLimiter.remainingRpm < 3` (preserve headroom for user messages)
- [x] Keep `remember_user` and `recall_user` tools as-is — they still serve explicit @mention requests
- [x] Write integration test in `scripts/test-memory-extraction.ts`
- [x] Unit tests for extraction prompt parsing and counter logic

### 40. Feature: Passive message monitoring and alive memory window

**Purpose/Issue:** Background memory extraction only sees messages from @mention conversations (stored in `session_history`). Facts shared in regular chat without @mentioning Roka are never captured. Need a passive monitoring system that reads all messages in active channels.

**Approach:**

- **Active channel tracking:** Channels where Roka has been @mentioned in the last 24h are "monitored." New @mentions add channels; channels expire after 24h of no interaction.
- **Passive in-memory buffer:** A 20-message ring buffer per monitored channel. All non-bot messages in monitored channels flow into this buffer (not stored in SQLite, not going through ADK).
- **Extraction trigger:** Every 20th message in the passive buffer fires the background Gemini extraction (replaces the old 10-message trigger from session_history).
- **Multi-server:** channelId is globally unique — works across servers with no server-level logic.

**Implementation:**

- [x] Create `src/agent/passiveBuffer.ts` — in-memory passive message ring buffer:
  - `Map<channelId, { messages: BufferedMessage[], userMap: Map<displayName, userId> }>`
  - `BufferedMessage = { displayName: string, userId: string, content: string, timestamp: number }`
  - `addMessage(channelId, userId, displayName, content)` — push to ring buffer (cap at 20)
  - `getMessages(channelId): BufferedMessage[]` — return current buffer
  - `clearBuffer(channelId)` — clear after extraction
  - `getUserMap(channelId): Map<string, string>` — displayName → userId mapping
- [x] Create `src/agent/channelMonitor.ts` — active channel tracking:
  - `Set<channelId>` of monitored channels with expiry timestamps
  - `markActive(channelId)` — add/refresh channel (24h TTL)
  - `isMonitored(channelId): boolean` — check if channel is actively monitored
  - `cleanupExpired()` — remove channels past 24h TTL (run periodically)
- [x] Update `src/discord/events/messageCreate.ts`:
  - On @mention/reply trigger: call `markActive(channelId)` to add channel to monitored set
  - On ALL non-bot guild messages: if `isMonitored(channelId)`, call `addMessage()` to passive buffer
- [x] Update `src/agent/memoryExtractor.ts`:
  - Change extraction source from `loadHistory()` (session_history SQLite) to `getMessages()` (passive buffer)
  - Change trigger from per-channel counter in extractor to checking `passiveBuffer` message count
  - Use `getUserMap()` from passive buffer for displayName → userId resolution
  - Clear passive buffer after extraction
  - Ramp extraction interval from 10 to 20 messages

### 41. Feature: Memory data retention (refresh-on-access + 90-day TTL)

**Purpose/Issue:** User facts can become stale over time. Need a retention strategy that keeps active facts fresh while expiring dormant ones.

**Implementation:**

- [x] Refresh-on-access: In `roka.ts` `generateResponse()`, after calling `getAllFactsForPrompt(userId)`, touch `updated_at` on all returned facts so frequently-accessed facts stay fresh
- [x] Add `refreshFactTimestamps(userId)` to `userMemory.ts` — updates `updated_at = Date.now()` for all facts of a user
- [x] 90-day TTL cleanup: Add `pruneOldFacts(maxAgeDays: number)` to `userMemory.ts` — deletes facts where `updated_at` is older than threshold
- [x] Run `pruneOldFacts(90)` on bot startup and daily via `setInterval` (same pattern as session history pruning)
- [x] Wire into `src/index.ts` alongside existing pruning jobs

### 42. Feature: Overheard channel context injection

**Purpose/Issue:** Roka's session history only contains direct @mention/reply interactions. She is blind to regular channel conversation — asking "what happened in this chat" yields nothing unless it was directed at her. The passive buffer already captures all messages in monitored channels but only feeds the memory extractor, not the conversational context.

**Approach:** Inject the passive buffer's contents as an "overheard context" section in the system prompt before each response. The buffer becomes a persistent FIFO ring (never cleared on extraction) so it always reflects the last 20 channel messages. Extraction uses an internal message counter instead of buffer length.

**Implementation:**

- [x] Decouple extraction from buffer lifecycle — replace `clearBuffer()` in `maybeExtractFromBuffer` with internal per-channel message counter
- [x] Buffer is never cleared during normal operation — true FIFO ring capped at `bufferSize` (20)
- [x] Inject `## Recent Channel Activity` section into system prompt in `roka.ts` from `getMessages(channelId)`
- [x] Simplify `messageCreate.ts` — remove `EXTRACTION_INTERVAL` import, always call `maybeExtractFromBuffer` (counting is internal)
- [x] Write smoke tests for buffer persistence, FIFO eviction, and overheard format

---

## Phase 8: Bug Fixes & Maintenance

### 39. Refinement: Startup and dead code cleanup

**Purpose/Issue:** Fix the `Unhandled rejection` at every boot, the `DeprecationWarning` for the ready event, and remove dead code left from the empty mention refactor.

**Implementation:**

- [x] Fix `Unhandled rejection` at startup — reminder scheduler queries SQLite before DB initializes. Move scheduler start after first DB access or add a startup delay
- [x] Fix `DeprecationWarning` — replace `client.once('ready')` with `client.once('clientReady')` in `index.ts` and `client.ts`
- [x] Remove dead code — delete `getRandomEmptyMention()` and `EMPTY_MENTION_MESSAGES` from `responses.ts` (unused after empty mention refactor)

### 40. Refinement: SQLite session history pruning

**Purpose/Issue:** The `session_history` table grows unbounded. Over months of operation this will bloat the database and slow down rehydration queries.

**Implementation:**

- [x] Add a periodic cleanup job that runs once per hour (or on bot startup)
- [x] Delete session history older than 7 days
- [x] Alternatively: cap at N most recent messages per channel (e.g., 50)
- [x] Log how many rows were pruned

### 41. Refinement: Smarter error recovery

**Purpose/Issue:** The `ErrorRecoveryPlugin` destroys the entire ADK session on any Gemini error. This is aggressive — a single transient 500 error nukes all conversation context.

**Implementation:**

- [x] Only destroy session on repeated failures (e.g., 2+ consecutive errors in same session)
- [x] For single transient errors, return fallback but preserve session history
- [x] Track error count per session to decide when to nuke vs preserve

### 42. Feature: Auto-inject user ID into recall_user tool

**Purpose/Issue:** The `recall_user` tool still requires the LLM to provide the user ID. Like `set_reminder`, it should auto-inject from session state.

**Implementation:**

- [x] Remove `user_id` parameter from `recall_user` tool schema
- [x] Auto-inject `_userId` from `toolContext.state` in the execute function
- [x] Update `remember_user` similarly if not already done

### 43. Rework: /remind slash command

**Purpose/Issue:** Current `/remind` arguments are confusing — `message`, optional `minutes`, optional `at` string. Users don't understand the UX on first use. Rework into clear subcommands with mandatory structure.

**Implementation:**

- [x] Rework `/remind` into subcommands: `in`, `at`, `list`, `cancel`
- [x] `/remind in task:<string> minutes:<integer, min 1>` — timer-based reminders
- [x] `/remind at task:<string> hour:<integer, 0-23> minute:<integer, 0-59, optional, default 0>` — clock-based reminders using configured timezone
- [x] `/remind list` — show user's active reminders with Discord timestamps
- [x] `/remind cancel id:<integer>` — cancel a specific reminder
- [x] Both `in` and `at` must confirm the reminder time in the response — show formatted time in configured timezone
- [x] Handle uninvited server edge case: if bot can't send to the original channel at delivery time, DM the user as fallback
- [x] Update reminder delivery in `reminderScheduler.ts` to attempt DM when channel send fails

### 44. Rework: /anime slash command

**Purpose/Issue:** Current `/anime` command has too many flat options and unused `limit` argument. Needs subcommands for cleaner UX with argument chaining.

**Implementation:**

- [x] Rework into subcommands: `/anime search query:<string>` and `/anime browse [sort_by] [type] [status]`
- [x] Remove `limit` argument (not being utilized)
- [x] Add pagination with Previous/Next buttons (ButtonBuilder + interaction collector, 60s timeout)
- [x] Default 5 results per page
- [x] Buttons expire gracefully after timeout

### 45. Rework: /schedule slash command

**Purpose/Issue:** Same UX issues as `/anime`. Unused `day` and `limit` arguments.

**Implementation:**

- [x] Rework into subcommands: `/schedule search anime:<string>` and `/schedule browse [scope] [sort_by]`
- [x] Remove `day` and `limit` arguments
- [x] Add pagination with Previous/Next buttons (same pattern as `/anime`)
- [x] Default 5 results per page

### 46. Feature: Expand `cityToTimezone` mapping

**Purpose/Issue:** The `getCurrentTime` tool's city-to-timezone mapping is limited. Users requesting time for unlisted cities get fallback behavior.

**Implementation:**

- [x] Add 50+ additional city mappings covering major cities across all continents
- [x] Include Southeast Asian cities (common for this bot's user base): Kuala Lumpur, Bangkok, Jakarta, Manila, Ho Chi Minh City, Hanoi, etc.
- [x] Include popular anime/VN-referenced cities: Akihabara (→ Asia/Tokyo), Osaka, Kyoto, Hokkaido, etc.

### 47. Feature: Control panel bot stats

**Purpose/Issue:** The `~/control-panel` Flask app could show live bot stats since all data is in SQLite.

**Implementation:**

- [x] Add `/api/bot/stats` endpoint to the control panel
- [x] Show: active sessions, total user memories, pending reminders, game scores, gacha collection stats
- [x] Add a "Bot Stats" card to the Services page in the frontend

### 48. Refinement: Gacha daily streak counter

**Purpose/Issue:** No incentive for consecutive daily draws. A streak counter encourages daily engagement.

**Implementation:**

- [x] Add `streak` and `last_draw_date` tracking to gacha system (or buddy system if gacha is replaced)
- [x] Show current streak in draw result and stats
- [x] Optional: bonus rarity boost at streak milestones (e.g., 7-day streak = guaranteed uncommon+)
