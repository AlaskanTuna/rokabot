# PROGRESS (AGENT ONLY)

> Refer to `docs/plan.md` when recording completed tasks.

---

<!-- Record latest from here onwards. -->

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
