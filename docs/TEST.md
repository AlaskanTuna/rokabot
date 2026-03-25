# TEST (AGENT ONLY)

---

## [25/03/26] - Phase 4.6 ADK Migration Smoke Test (Final)

**Model:** gemini-3.1-flash-lite-preview | **Timeout:** 25s | **Tools:** 7 | **Script:** `npm run test:smoke`

### Build Verification

| Check                  | Result                                        |
| ---------------------- | --------------------------------------------- |
| `npm run build` (tsc)  | Pass — zero errors                            |
| `npm run lint`         | Pass — 3 pre-existing warnings only, zero new |
| `npm run format:check` | Pass — all files formatted                    |
| `npm test` (vitest)    | Pass — 113/113 tests                          |

### ADK Integration Tests

| ID  | Test                                 | Tools Expected               | Result           | Observation                                                                                         |
| --- | ------------------------------------ | ---------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| T01 | Basic greeting (no tools)            | None                         | **PASS** (2.7s)  | Response OK, 84 words, no tools called                                                              |
| T02 | Tool: roll_dice                      | roll_dice                    | **PASS** (3.4s)  | roll_dice called, response OK, 86 words                                                             |
| T03 | Tool: get_anime_schedule             | get_anime_schedule           | **PASS** (4.1s)  | get_anime_schedule called, response OK, 92 words                                                    |
| T04 | Tool: get_weather (default location) | get_weather                  | **WARN** (4.6s)  | get_weather called with timezone default, response OK (90w) but didn't explicitly name the location |
| T05 | Tool: search_web                     | search_web                   | **PASS** (8.0s)  | search_web called, response OK, 96 words                                                            |
| T06 | Tool: get_current_time (default tz)  | get_current_time             | **PASS** (13.4s) | get_current_time called, response OK, 85 words                                                      |
| T07 | Tool: search_anime                   | search_anime                 | **WARN** (3.6s)  | Model answered from knowledge without calling tool — acceptable for well-known anime                |
| T08 | Response length (80-100 words)       | N/A                          | **PASS** (1.9s)  | 93 words (target: 80-100)                                                                           |
| T09 | Response not cut off                 | N/A                          | **PASS** (2.5s)  | Ends with valid punctuation, no mid-sentence truncation                                             |
| T10 | Tool fallback chain                  | search_anime or schedule→web | **PASS** (4.3s)  | search_anime called, response OK, 89 words                                                          |

### Summary

| Metric                | Value             |
| --------------------- | ----------------- |
| **PASS**              | 8                 |
| **WARN**              | 2                 |
| **FAIL**              | 0                 |
| **Success rate**      | 100% (0 failures) |
| **Avg response time** | 4.8s              |

**WARN notes:**

- T04: Weather tool correctly called with default city, but model wove the data into the response without explicitly naming the city. Functionally correct.
- T07: Model has strong knowledge of popular anime (Frieren) and chose to answer directly. Tool is available and works — verified in T03 and T10.

### Previous Smoke Tests (Manual)

| ID  | Test                                               | Result | Observation                                                                  |
| --- | -------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| M01 | /chat slash command                                | Pass   | Bot defers reply, responds in-character, no `[Roka]:` prefix                 |
| M02 | @Mention trigger                                   | Pass   | Typing indicator shown, in-character reply                                   |
| M03 | Reply-to-bot trigger                               | Pass   | Context-aware follow-up responses                                            |
| M04 | Conversational memory (multi-turn)                 | Pass   | Remembers context across 3-4 message exchange                                |
| M05 | Tool calling via mention                           | Pass   | Tools called via ADK automatic loop, in-character response                   |
| M06 | Tool slash commands (/weather, /roll_dice, /anime) | Pass   | In-character flavor text with formatted embeds                               |
| M07 | Image attachment                                   | Pass   | Bot acknowledges and comments on images                                      |
| M08 | Tone detection                                     | Pass   | Response style and embed color shift with detected tone                      |
| M09 | Rate limiting                                      | Pass   | In-character decline message when rate-limited                               |
| M10 | Concurrency guard                                  | Pass   | "I'm still thinking~" response for concurrent requests                       |
| M11 | Session idle timeout (5 min)                       | Pass   | Session destroyed after idle, fresh context on next message                  |
| M12 | Error handling                                     | Pass   | In-character fallback on API errors, session destroyed to prevent corruption |
| M13 | Graceful shutdown (SIGINT)                         | Pass   | "All ADK sessions destroyed" then "Oyasumi~"                                 |
| M14 | Typing indicator persistence                       | Pass   | Stays active during long responses (7s interval)                             |
| M15 | dev:quiet mode                                     | Pass   | ADK event dumps suppressed, other ADK logs visible                           |

---
