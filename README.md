<p align="center">
  <img src="assets/app-icon.jpg" alt="Rokabot" width="128" height="128" style="border-radius: 50%;" />
</p>

<h1 align="center">Rokabot</h1>

<p align="center">
  A server-wide Discord character chatbot embodying <strong>Maniwa Roka</strong> from <em>Senren*Banka</em>,<br/>
  powered by Gemini Flash Lite via Google ADK TypeScript.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D24.13.0-brightgreen" alt="Node.js" />
  <img src="https://img.shields.io/badge/typescript-ES2022-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2" alt="discord.js" />
  <img src="https://img.shields.io/badge/gemini-flash--lite-orange" alt="Gemini" />
  <img src="https://img.shields.io/badge/platform-RPi%205%20ARM64-c51a4a" alt="Raspberry Pi 5" />
</p>

---

Rokabot responds to `/chat` slash commands, @mentions, and replies with in-character dialogue. It can also perceive images attached to messages via Gemini's multimodal input. It maintains per-channel conversational memory using a 10-message sliding window with a 5-minute idle TTL. A 4-layer prompt system drives personality, speech patterns, dynamic tone selection, and channel awareness — all running within a ~1000-1600 token system prompt budget.

All state is in-memory with no persistence. Bot restart = clean slate.

## Requirements

### Hardware

| Component | Minimum                                        | Recommended                     |
| --------- | ---------------------------------------------- | ------------------------------- |
| Board     | Any ARM64/x86_64 host                          | Raspberry Pi 5 (8 GB) or better |
| RAM       | 256 MB free                                    | 512 MB free                     |
| Storage   | ~200 MB (image + deps)                         | 1 GB                            |
| Network   | Stable internet (Discord Gateway + Gemini API) | Wired Ethernet                  |

### Software

| Dependency              | Version                                      |
| ----------------------- | -------------------------------------------- |
| Node.js                 | >= 24.13.0                                   |
| npm                     | >= 10                                        |
| Docker + Docker Compose | Latest stable (for containerized deployment) |
| Git                     | Any recent version                           |

### API Keys

| Service                       | Where to get it                                                         |
| ----------------------------- | ----------------------------------------------------------------------- |
| Discord Bot Token + Client ID | [Discord Developer Portal](https://discord.com/developers/applications) |
| Gemini API Key                | [Google AI Studio](https://aistudio.google.com/apikey)                  |

The Discord application requires the **Message Content** privileged intent enabled.

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/AlaskanTuna/rokabot.git
cd rokabot
npm ci
```

### 2. Configure secrets

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Configure tunables (optional)

Edit `config.yml` to adjust rate limits, session behavior, model, or logging level. Environment variables can override any YAML value for backward compatibility.

### 4. Run

**Development (hot reload):**

```bash
npm run dev
```

**Production (compiled):**

```bash
npm run build
npm start
```

**Docker:**

```bash
docker compose up -d
```

---

## Configuration

Secrets live in `.env`, tunables live in `config.yml`.

| YAML Path                  | Env Override                 | Default                         | Description                       |
| -------------------------- | ---------------------------- | ------------------------------- | --------------------------------- |
| `gemini.model`             | `GEMINI_MODEL`               | `gemini-3.1-flash-lite-preview` | Gemini model name                 |
| `gemini.timeout`           | `GEMINI_TIMEOUT`             | `15000`                         | Request timeout (ms)              |
| `gemini.maxRetries`        | `GEMINI_MAX_RETRIES`         | `1`                             | Max retries for transient errors  |
| `rateLimit.rpm`            | `RATE_LIMIT_RPM`             | `15`                            | Requests per minute               |
| `rateLimit.rpd`            | `RATE_LIMIT_RPD`             | `500`                           | Requests per day                  |
| `session.ttl`              | `SESSION_TTL_MS`             | `300000`                        | Idle session TTL (ms)             |
| `session.windowSize`       | `SESSION_WINDOW_SIZE`        | `10`                            | FIFO message window size          |
| `discord.maxMessageLength` | `DISCORD_MAX_MESSAGE_LENGTH` | `2000`                          | Discord message char limit        |
| `logging.level`            | `LOG_LEVEL`                  | `info`                          | Log level (debug/info/warn/error) |

---

## High-Level Architecture

```mermaid
graph TB
    User((User))

    subgraph DGL["Discord Gateway Layer"]
        direction TB
        Triggers["/chat · @mention · reply"]
        RL["Rate Limiter\n(Token Bucket RPM + Daily RPD)"]
        CG["Concurrency Guard\n(1 active req per channel)"]
        Triggers --> RL --> CG
    end

    subgraph SM["Session Manager (In-Memory)"]
        direction TB
        Map["channelId → ChannelSession"]
        FIFO["10-Message FIFO Window"]
        TTL["5-min Idle TTL"]
        Map --- FIFO
        Map --- TTL
    end

    subgraph RA["Roka Agent"]
        direction TB
        TD["Tone Detector\n(Rule-based keyword scan)"]
        PA["Prompt Assembler"]
        subgraph PL["4-Layer Prompt System (~1000-1600 tokens)"]
            L0["L0: Core Identity"]
            L1["L1: Speech Patterns"]
            L2["L2: Tone Variant"]
            L3["L3: Context\n(Time of Day · Participants)"]
        end
        TD --> PA
        PA --> PL
    end

    subgraph RP["Response Pipeline"]
        direction TB
        MB["Message Builder\n(Discord Components V2)"]
        TS["Tone Styles + Expressions"]
        SR["Response Splitter\n(≤2000 chars)"]
        MB --> TS --> SR
    end

    Gemini["Gemini 3.1 Flash Lite\n(15 RPM · 500 RPD)"]

    User -->|message| DGL
    DGL --> SM
    SM --> RA
    RA -->|system prompt + history + images| Gemini
    Gemini -->|response text| RP
    RP -->|styled reply| User
```

### End-to-End Pipeline

How user (client) prompts go through the system (backend) and transform plain messages into rich, character-personalized replies:

```mermaid
flowchart TD
    Start([User sends /chat, @mention, or reply])
    Start --> Extract["Extract message, images,\nchannelId, displayName"]
    Extract --> RateCheck{Rate limit\navailable?}
    RateCheck -->|No| Decline([Send decline response])
    RateCheck -->|Yes| BusyCheck{Channel\nbusy?}
    BusyCheck -->|Yes| Busy([Send busy response])
    BusyCheck -->|No| EmptyCheck{Has content\nor images?}
    EmptyCheck -->|No| Empty([Send empty-mention response])
    EmptyCheck -->|Yes| Defer["Defer reply / send typing\nMark channel busy"]

    Defer --> Session["Get or create session\nReset 5-min idle timer"]
    Session --> AddMsg["Add user message to\n10-message FIFO window"]
    AddMsg --> History["Get channel history\nExtract unique participant names"]
    History --> Tone["Detect tone via keyword scan\non last 3 messages"]

    Tone --> Assemble["Assemble 4-layer system prompt\nCore + Speech + Tone + Context"]
    Assemble --> Images["Download & base64-encode images\n(max 3 images, ≤4 MB each)"]
    Images --> Build["Build Gemini request\n(system prompt + history + user message + images)\ntemp 0.9 · topP 0.95 · maxTokens 250"]
    Build --> Call["Call Gemini API\nRetry on 429/500/503"]
    Call --> Process["Strip [Roka] prefix\nFallback if empty"]

    Process --> Store["Add assistant message\nto session window"]
    Store --> Format["Build Components V2 message\nApply tone color + expression image"]
    Format --> Split["Split response if\n> 2000 chars"]
    Split --> Send(["Send styled reply\nto Discord"])
    Send --> Free["Mark channel free"]
```

### Tone Detection

The tone detector scans the last 3 messages for keyword matches (zero LLM cost):

```mermaid
flowchart TD
    Input(["Last 3 messages\nfrom session window"]) --> Join["Concatenate all\nmessage content"]
    Join --> F{"🫣 flustered?\n≥2 of 19 patterns\n(love, crush, kiss, date, ❤️ ...)"}
    F -->|Match| RF([flustered])
    F -->|No| T{"🥹 tender?\n≥2 of 15 patterns\n(miss, worried, thank you, stay safe ...)"}
    T -->|Match| RT([tender])
    T -->|No| A{"😤 annoyed?\n≥2 of 15 patterns\n(refuse, whatever, boring, skipped lunch ...)"}
    A -->|Match| RA([annoyed])
    A -->|No| S{"😢 sincere?\n≥2 of 15 patterns\n(sad, lonely, stressed, sorry, 😭 ...)"}
    S -->|Match| RS([sincere])
    S -->|No| D{"🏠 domestic?\n≥2 of 19 patterns\n(food, cook, tea, sleep, weather, 🍵 ...)"}
    D -->|Match| RD([domestic])
    D -->|No| C{"🤔 curious?\n≥2 of 12 patterns\n(what, how, why, explain, wonder ...)"}
    C -->|Match| RC([curious])
    C -->|No| CO{"😌 confident?\n≥2 of 13 patterns\n(leave it to me, trust me, help me ...)"}
    CO -->|Match| RCO([confident])
    CO -->|No| P(["😊 playful\n(default fallback)"])
```

---

## Project Structure

```
rokabot/
├── src/
│   ├── index.ts                       # Entry point, signal handling, graceful shutdown
│   ├── config.ts                      # Config loader (.env secrets + config.yml tunables)
│   ├── agent/
│   │   ├── roka.ts                    # Gemini API integration, retry logic, response processing
│   │   ├── toneDetector.ts            # Rule-based tone detection (keyword matching)
│   │   ├── promptAssembler.ts         # 4-layer prompt combiner
│   │   ├── prompts/
│   │   │   ├── core.ts                # Layer 0: Core identity & personality
│   │   │   ├── speech.ts              # Layer 1: Speech patterns & formatting rules
│   │   │   ├── tones.ts               # Layer 2: Tone variants (playful/sincere/domestic/flustered)
│   │   │   └── context.ts             # Layer 3: Dynamic channel context (time, participants)
│   │   └── __tests__/                 # Tone detector & prompt assembler tests
│   ├── discord/
│   │   ├── client.ts                  # discord.js client setup (intents, partials, events)
│   │   ├── concurrency.ts             # Per-channel concurrency guard
│   │   ├── responses.ts               # In-character message pools (decline, busy, error, empty)
│   │   ├── commands/
│   │   │   └── chat.ts                # /chat slash command definition
│   │   ├── events/
│   │   │   ├── ready.ts               # Bot login, command registration, presence
│   │   │   ├── interactionCreate.ts   # /chat slash command handler
│   │   │   └── messageCreate.ts       # @mention and reply handler
│   │   └── __tests__/                 # Response utilities tests
│   ├── session/
│   │   ├── types.ts                   # WindowMessage & ChannelSession interfaces
│   │   ├── messageWindow.ts           # FIFO message buffer (push/evict)
│   │   ├── sessionManager.ts          # Per-channel session lifecycle + idle TTL
│   │   └── __tests__/                 # Session tests
│   └── utils/
│       ├── logger.ts                  # pino structured logger
│       ├── rateLimiter.ts             # Token bucket (RPM) + daily counter (RPD)
│       └── __tests__/                 # Rate limiter tests
├── scripts/
│   └── test-chat.ts                   # CLI test script for rapid prompt iteration
├── assets/
│   ├── roka-character-bible.md        # Comprehensive character reference
│   └── app-icon.jpg                   # Bot avatar
├── config.yml                         # Tunable configuration (non-secret)
├── .env.example                       # Environment variable template
├── Dockerfile                         # Multi-stage build (build + slim runtime)
├── docker-compose.yml                 # Single service, 512 MB mem cap, log rotation
├── tsconfig.json                      # TypeScript compiler config
├── .eslintrc.cjs                      # ESLint config
├── .prettierrc                        # Prettier config
├── vitest.config.ts                   # Vitest test runner config
└── package.json                       # Dependencies & scripts
```

---

## Commands

```bash
# Development
npm run dev            # Start with tsx watch (hot reload)
npm run test:chat      # CLI chat test (no Discord needed)

# Build & Run
npm run build          # Compile TypeScript to dist/
npm start              # Run compiled JS (production)

# Quality
npm run lint           # ESLint
npm run format         # Prettier (write)
npm run format:check   # Prettier (check only)
npm test               # Run all tests
npm run test:watch     # Tests in watch mode

# Docker
docker compose build   # Build image
docker compose up -d   # Run containerized
docker compose logs -f # Tail logs
```

---

## Docker Deployment

The Dockerfile uses a multi-stage build: stage 1 compiles TypeScript with all dev dependencies, stage 2 copies only the compiled output and production dependencies into a slim `node:24-alpine` image.

```bash
docker compose up -d
```

| Setting          | Value             |
| ---------------- | ----------------- |
| Base image       | `node:24-alpine`  |
| Memory limit     | 512 MB            |
| Expected runtime | ~80-150 MB        |
| Restart policy   | `unless-stopped`  |
| Log rotation     | 10 MB x 3 files   |
| Process user     | `node` (non-root) |

The image builds natively on ARM64 (Raspberry Pi 5) with no cross-compilation needed.

---

## License

MIT. 2026.

---
