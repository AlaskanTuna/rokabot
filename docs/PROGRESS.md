# PROGRESS (AGENT ONLY)

> Refer to `docs/plan.md` when recording completed tasks.

---

<!-- Record latest from here onwards. -->

## [02/04/26] - Overheard channel context injection

- Decoupled extraction from buffer lifecycle — passive buffer is now a persistent FIFO ring that never gets cleared. Extraction uses internal per-channel message counter instead of buffer length.
- Injected `## Recent Channel Activity` section into system prompt in `roka.ts` — Roka can now see up to 20 recent messages from monitored channels, not just direct interactions.
- Simplified `messageCreate.ts` — removed `EXTRACTION_INTERVAL` import, counting is now internal to `maybeExtractFromBuffer`.
- Added 4 smoke tests for buffer persistence, FIFO eviction, overheard format, and empty buffer handling.

## [02/04/26] - Memory extraction improvements

- Fixed buffer ordering: moved `markActive()` before passive buffer check so first @mention is captured.
- Added bot responses to passive buffer for richer extraction context and faster fill rate.
- Fixed case-insensitive name resolution (LLM returning "hiro" vs display name "Hiro").
- Added bot self-fact filter — skips saving facts about Roka herself during extraction.
- Improved extraction prompt sensitivity while filtering ephemeral noise (temporary states like "going to sleep").
- Lowered extraction interval from 20 to 10 messages. Bumped temperature to 0.3 and maxOutputTokens to 400.

## [01/04/26] - Passive message monitoring and alive memory window

- Created `src/agent/passiveBuffer.ts` — 20-message in-memory ring buffer per monitored channel. Stores all non-bot guild messages with displayName→userId mapping. No SQLite writes.
- Created `src/agent/channelMonitor.ts` — tracks active channels with 24h TTL from last @mention. Auto-expires via hourly cleanup.
- Rewrote `src/agent/memoryExtractor.ts` — extraction now reads from passive buffer instead of session_history. Fires every 20 messages (up from 10). Old counter-based system removed.
- Wired passive buffer into `messageCreate.ts` — all non-bot guild messages in monitored channels flow into the buffer; @mention triggers `markActive()`.
- Removed `maybeExtractMemory` call from `roka.ts` — passive buffer is now the sole extraction trigger.

## [01/04/26] - Memory data retention (refresh-on-access + 90-day TTL)

- Added `refreshFactTimestamps()` to `userMemory.ts` — touches `updated_at` when facts are injected into the system prompt, keeping active facts alive.
- Added `pruneOldFacts()` to `userMemory.ts` — deletes facts older than 90 days without access.
- Wired into `roka.ts` `generateResponse()` — facts are refreshed on every @mention interaction.
- Added startup prune + daily interval in `index.ts`. Added hourly channel monitor cleanup.
- 31/31 memory extraction smoke tests pass (including passive buffer, channel monitor, refresh, and prune tests).

## [01/04/26] - Daily hatch streak counter

- Added `streak` column to `gacha_daily` SQLite table.
- `markDailyHatch()` now tracks consecutive daily hatches — continues if last hatch was yesterday, resets to 1 otherwise.
- Added `getStreak()` to retrieve current streak (valid if last hatch was today or yesterday).
- Hatch result shows 🔥 streak for 2+ consecutive days. Stats page shows streak alongside collection overview.
- 325/325 vitest tests pass.

## [01/04/26] - Gacha rework: Buddy Pet System

- Replaced entire gacha fortune system with a VN/anime companion spirit system.
- Created `src/games/buddy.ts` — Mulberry32 PRNG-based deterministic buddy generation from userId, SQLite persistence, leaderboard queries.
- Created `src/games/data/buddySpecies.ts` — 18 species across 5 rarity tiers, cosmetics (eyes/hats), stat definitions (CHARM/WIT/DERE/DRAMA/LUCK).
- Added `buddy` table to SQLite schema in `database.ts`.
- Reworked `/gacha` slash command: 6 subcommands (hatch, view, pet, stats, guide, leaderboard) replacing old draw/collection/stats.
- Rewrote gacha handlers in `gameCommands.ts` with Components V2 containers + SectionBuilder thumbnails.
- Updated `gachaMention.ts` to show buddy view instead of fortune draw.
- Deleted `src/games/gacha.ts` and `src/games/data/gachaItems.ts`.
- Rewrote `gacha.test.ts` with 22 buddy system tests (PRNG determinism, generation, stats bounds, shiny probability, SQLite round-trip, leaderboard).
- Updated `scripts/test-features.ts` integration tests.
- All 314 tests pass. Build, lint, and format all clean.

## [01/04/26] - Slash command reworks (/remind, /anime, /schedule)

- Reworked `/remind` into 4 subcommands: `in` (timer-based), `at` (clock-time with hour/minute), `list` (view active reminders), `cancel` (by ID with ownership verification).
- Added DM fallback to reminder scheduler — if the bot can't reach the original channel, it DMs the user instead.
- Reworked `/anime` into 2 subcommands: `search` (by name) and `browse` (by filters). Added pagination with Previous/Next buttons (5 results per page, 60s collector timeout). Removed `limit` argument.
- Reworked `/schedule` into 2 subcommands: `search` (specific anime) and `browse` (scope + sort_by). Added pagination. Removed `day` and `limit` arguments.
- Added `getReminderById()` to reminder store for cancel ownership verification.
- All 314 tests pass.

## [01/04/26] - Smarter error recovery

- Replaced immediate session destruction on first fallback with consecutive error tracking per channel.
- Session is now only destroyed after 2+ consecutive fallback responses.
- Error counter resets on successful (non-fallback) responses.
- Counter cleaned up on session destroy.

## [01/04/26] - SQLite session history pruning

- Added `pruneOldHistory()` to session store — deletes history older than 7 days.
- Runs on bot startup and hourly via `setInterval`.
- 3 new unit tests added for pruning behavior.

## [01/04/26] - Reply context for additional message types

- Fixed reply context extraction for bot's own Components V2 container messages — removed `!isReplyToBot` guard that blocked context extraction for replies to the bot.
- Added Discord poll extraction (question + answer options).
- Added forwarded message content extraction.
- Added sticker name extraction.
- Voice messages explicitly out of scope.

## [01/04/26] - Startup cleanup and dead code removal

- Fixed `Unhandled rejection` at startup — DB now initialized before reminder scheduler starts.
- Fixed `DeprecationWarning` — replaced `client.once('ready')` with `client.once('clientReady')`.
- Removed dead `getRandomEmptyMention()` and `EMPTY_MENTION_MESSAGES` from responses.ts.

## [01/04/26] - Auto-inject user ID into recall/remember tools

- Removed `user_id` parameter from both `recall_user` and `remember_user` tool schemas.
- Both tools now auto-inject `_userId` from ADK session state (same pattern as `set_reminder`).

## [01/04/26] - Expand cityToTimezone mapping

- Added 50+ city-to-timezone mappings covering Southeast Asia, Japan, East Asia, Americas, and global cities.
- Added no-space variants for multi-word city names (e.g., 'kualalumpur', 'newyork').
- Added Japanese neighborhood names (Akihabara, Shibuya, Shinjuku → Asia/Tokyo).

## [01/04/26] - Sharp image pre-processing pipeline

- Added `sharp` dependency for image pre-processing before Gemini vision input.
- Created `src/utils/imageProcessor.ts` with `processImageForGemini()` — resizes large images to max 1024px, upscales small images to min 512px with lanczos3, applies sharpening, normalizes to sRGB, strips EXIF metadata, and outputs as JPEG at 80% quality (mozjpeg).
- Integrated into `src/agent/roka.ts` `downloadImage()` — raw image buffers now pipe through sharp before base64 encoding.
- Dockerfile unchanged — sharp v0.33+ bundles prebuilt binaries for Alpine ARM64, no extra system deps needed.
- Build, lint, and format all pass. 314/317 tests pass (3 pre-existing failures in emojiReactor unrelated to this change).

## [28/03/26] - Shiritori mini-game

- Created `src/games/shiritori.ts` — game state manager with `startGame()`, `joinGame()`, `submitWord()`, `endGame()`, `getScores()`, `destroyAllGames()`, and auto-timeout (120s).
- Created `src/games/data/wordlist.json` — curated dictionary of 5762 common English words (2-15 letters) for word validation.
- Added `/shiritori` slash command with 5 subcommands (start, join, play, end, scores) to `src/discord/commands/games.ts`.
- Added shiritori handler to `src/discord/events/gameCommands.ts` with Roka-flavored in-character responses and timeout notification via Discord channel messages.
- Scores persist to `game_scores` table in SQLite on game end.
- Added `destroyAllShiritoriGames()` to shutdown handler in `src/index.ts`.
- Created 30 unit tests in `src/games/__tests__/shiritori.test.ts` covering game start, join, word validation (wrong letter, not in dictionary, duplicate, wrong turn, too short, non-alphabetic), turn advancement, scoring, full game flow, and dictionary loading.
- All 317 tests pass. Build, lint, and format checks all clean.

## [28/03/26] - Gacha/Fortune draw system

- Created `src/games/data/gachaItems.ts` with 43 curated items across 4 rarity tiers: common (22), uncommon (11), rare (6), legendary (4). All items feature Roka's in-character commentary — fortunes, cooking tips, seasonal memories, personal confessions, and collectible moments.
- Created `src/games/gacha.ts` — gacha system with `drawItem()`, `getCollection()`, `getCollectionStats()`, `resetDailyDraw()`, `rollRarity()`. Weighted random draw (60/25/12/3%), daily limit enforcement via `gacha_daily` table, collection persistence via `gacha_collection` table.
- Added `gacha_collection` and `gacha_daily` tables to `src/storage/database.ts`.
- Created `/gacha` slash command (draw, collection, stats subcommands) in `src/discord/commands/games.ts`.
- Created `src/discord/events/gameCommands.ts` handler with Discord embed formatting: rarity-colored borders, rarity emoji, new/duplicate indicators, collection progress footer.
- Created `src/discord/events/gachaMention.ts` for @mention keyword triggers ("gacha", "draw", "fortune", "omikuji").
- Wired mention handler into `src/discord/events/messageCreate.ts` as pre-LLM check.
- Registered `/gacha` command in `src/discord/events/ready.ts`.
- Routed game commands through `src/discord/events/interactionCreate.ts`.
- Created 28 unit tests in `src/games/__tests__/gacha.test.ts` covering item catalog validation, rarity distribution, draw logic, daily limits, collection tracking, stats calculation, and reset.
- All 287 tests pass, build clean, format check clean.

## [28/03/26] - Hangman mini-game

- Created `src/games/data/hangmanWords.ts` with ~120 curated anime/VN/Japanese-culture word entries across 5 categories (food, anime terms, Japanese culture, visual novel terms, general Japanese words).
- Created `src/games/hangman.ts` — game state manager with `startGame()`, `guessLetter()`, `guessWord()`, `getDisplayWord()`, `getHangmanArt()`, `destroyAllGames()`, 6-life system, 120-second idle timeout, one game per channel.
- Added `/hangman` slash command (start, guess subcommands) to `src/discord/commands/games.ts`.
- Added hangman handler logic to `src/discord/events/gameCommands.ts` with Roka-flavored commentary and score persistence to SQLite `game_scores` table.
- Wired client through `interactionCreate.ts` for hangman timeout channel notifications.
- Created `src/games/__tests__/hangman.test.ts` with 32 tests covering game start, letter/word guessing, win/loss conditions, display formatting, hangman art, timeout, and lifecycle.
- All 287 tests pass, build clean, lint 0 errors, format check clean.

## [28/03/26] - Reminders system

- Created `src/storage/reminderStore.ts` with `createReminder`, `getDueReminders`, `markDelivered`, `getActiveReminders`, `deleteReminder`, and `countActiveReminders` wrapping the existing `reminders` SQLite table. 5-active-reminder cap per user.
- Created `src/agent/tools/setReminder.ts` — ADK `FunctionTool` (`set_reminder`) allowing Roka to set timed reminders for users (1 min to 7 days).
- Registered the tool in `src/agent/tools/index.ts` and added it to the `rokaTools` array.
- Created `src/discord/reminderScheduler.ts` — 60-second interval scheduler that queries SQLite for due reminders and delivers them as in-character Discord messages.
- Integrated scheduler lifecycle into `src/index.ts`: starts on Discord ready, stops on shutdown.
- Updated `core.ts` prompt to mention Roka can set reminders.
- Created 23 unit tests in `src/storage/__tests__/reminderStore.test.ts` covering CRUD, due-query, delivery marking, 5-reminder cap, and edge cases.
- All 227 tests pass; build, lint, and format all clean.

---

## [28/03/26] - Per-user relationship memory

- Created `src/storage/userMemory.ts` with `saveFact`, `getFacts`, `deleteFact`, `getAllFactsForPrompt`, and `countFacts` wrapping the existing `user_memory` SQLite table. 10-fact cap per user with oldest-eviction.
- Created `src/agent/tools/rememberUser.ts` — ADK `FunctionTool` (`remember_user`) allowing Roka to store facts about users.
- Created `src/agent/tools/recallUser.ts` — ADK `FunctionTool` (`recall_user`) allowing Roka to explicitly recall stored user facts.
- Registered both tools in `src/agent/tools/index.ts` and added them to the `rokaTools` array.
- Injected per-user facts into the system prompt in `roka.ts` `generateResponse()`: after assembling the prompt, user facts from SQLite are appended as a `## What You Remember About {displayName}` section.
- Updated `core.ts` prompt to mention Roka can remember personal details about users.
- Created 18 unit tests in `src/storage/__tests__/userMemory.test.ts` covering CRUD, upsert, ordering, 10-fact cap eviction, and edge cases.
- All 204 tests pass; build, lint, and format all clean.

---

## [28/03/26] - SQLite foundation and session persistence

- Integrated write-behind persistence into `roka.ts`: after each successful exchange, both user and assistant messages are saved to SQLite via `saveMessage()`. Wrapped in try/catch so SQLite failures never block the response.
- Integrated cold-start rehydration into `ensureSession()`: when a new ADK session is created, prior history is loaded from SQLite and replayed as ADK events using `createEvent` + `appendEvent`.
- Added `closeDb()` call to graceful shutdown in `src/index.ts`.
- Added `data/` to `.gitignore` and `.dockerignore`.
- Added `./data:/app/data` volume mount to `docker-compose.yml` for persistence across container rebuilds.
- Updated `Dockerfile` to install build tools (`python3`, `make`, `g++`) for `better-sqlite3` native compilation on Alpine.
- Created 12 unit tests in `src/storage/__tests__/sessionStore.test.ts` covering save, load, clear, FIFO ordering, channel isolation, and edge cases.
- All 186 tests pass; build, lint, and format all clean.

---

## [28/03/26] - Emoji reactions (passive)

- Created `src/discord/emojiReactor.ts` with rule-based keyword matching for 7 reaction categories (food, anime, compliments, greetings, sadness, goodnight, excitement).
- Probability gate (18%) and per-channel cooldown (60s) prevent excessive reactions.
- Wired into `messageCreate.ts` to process all guild messages from non-bot users before mention/reply logic.
- Added 34 unit tests covering all rules, probability gate, cooldown, priority, case insensitivity, and reset.
- All 147 tests pass; build clean.

---

## [25/03/26] - Codebase Comment & Docstring Cleanup

- Added JSDoc docstrings to all exported functions and key internal helpers across `src/` and `scripts/`.
- Added module-level doc comments to major files (config, roka agent, tools, session manager, etc.).
- Removed redundant section-header comments that restated the obvious.
- Kept comments focused on WHY, not WHAT; no docstrings added to trivial/obvious functions or test files.
- All 113 tests pass; Prettier reports no formatting changes needed.

---

## [25/03/26] - README.md Update

- Rewrote README.md to reflect current system state: ADK-based architecture, all 7 tools, updated config table with new fields (maxOutputTokens, timezone), all npm scripts (dev:quiet, test:smoke).
- Added new collapsible sub-diagrams: Tool Calling Flow, Prompt Assembly, Session Management.
- Added Features section with comprehensive feature list.
- Removed Hardware/Software requirements tables (moved essentials to Prerequisites). Consolidated Installation/Run into Getting Started section.
- Updated all diagrams to reflect ADK Runner-based architecture.

---

## [25/03/26] - Tool Defaults, Response Length & DX Fixes

- `getWeather` now defaults to configured timezone location when no city is specified.
- Fixed `npm run dev:quiet` — was intercepting `console.log` but ADK uses `console.info`; also fixed arg matching for event filtering.
- Response length now controlled via prompt instruction (80-100 words, 100 hard limit) instead of `maxOutputTokens` which caused mid-sentence cutoff. Raised `maxOutputTokens` to 500 as safety net.
- 113 unit tests pass; TypeScript compiles cleanly.

---

## [25/03/26] - ADK Bug Fixes & DX Improvements

- Fixed session corruption bug: ErrorRecoveryPlugin fallback responses were creating invalid function call sequences in ADK session history, causing 400 INVALID_ARGUMENT on subsequent requests. Session is now destroyed on fallback to prevent corruption.
- Fixed typing indicator: `sendTyping()` was called once but Discord's indicator expires after ~10s. Added repeating interval (7s) that stays active until response is sent.
- Added timezone/location context to Tavily web search queries (from `config.yml` timezone setting).
- Added tool fallback chain logging at INFO level when ADK runner chains multiple tools in a single request.
- Added `npm run dev:quiet` script (`ADK_QUIET=1`) to suppress verbose `[ADK INFO]: event:` JSON dumps while keeping other ADK logs visible.
- Updated Gemini timeout to 25s (from 15s) for 3.1-flash-lite-preview model variance.
- 113 unit tests pass; TypeScript compiles cleanly.

---

## [23/03/26] - Phase 4.6: Full ADK Migration

- Replaced raw `@google/genai` calls in `roka.ts` with ADK `LlmAgent` + `Runner`.
- Converted all 6 FunctionTools to ADK `FunctionTool` with Zod schemas.
- Added `GOOGLE_SEARCH` tool directly to the agent (Gemini 3.x supports coexistence with FunctionTools).
- Replaced manual conversation history tracking with ADK `InMemorySessionService` via a custom `WindowedSessionService` that caps event history per retrieval.
- Idle TTL timers now managed in `roka.ts` alongside ADK sessions, replacing `sessionManager.ts` usage in discord handlers.
- Implemented `beforeModelCallback` for dynamic system prompt injection (tone + context layers).
- Implemented `afterModelCallback` for `[Roka]:` prefix stripping and empty-response fallback.
- Removed manual function-calling loop and `executeToolCall` dispatcher; ADK runner handles tool orchestration automatically.
- Discord handlers (`messageCreate.ts`, `interactionCreate.ts`) simplified — no more manual `addMessage`/`getHistory` calls.
- Shutdown (`index.ts`) now calls async `destroyAllSessions()` from `roka.ts`.
- Added `zod` dependency.
- Net reduction of ~120 lines across the codebase.
- 113 unit tests pass; live Discord smoke test pending.

---
