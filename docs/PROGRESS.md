# PROGRESS (AGENT ONLY)

> Refer to `docs/plan.md` when recording completed tasks.

---

<!-- Record latest from here onwards. -->

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
