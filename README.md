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

Rokabot responds to `/chat` slash commands, @mentions, and replies with in-character dialogue. It maintains per-channel conversational memory using a 10-message sliding window with a 5-minute idle TTL. A 4-layer prompt system drives personality, speech patterns, dynamic tone selection, and channel awareness — all running within a ~1000-1600 token system prompt budget.

All state is in-memory with no persistence. Bot restart = clean slate.

## Requirements

### Hardware

| Component | Minimum                                        | Recommended           |
| --------- | ---------------------------------------------- | --------------------- |
| Board     | Any ARM64/x86_64 host                          | Raspberry Pi 5 (8 GB) |
| RAM       | 256 MB free                                    | 512 MB free           |
| Storage   | ~200 MB (image + deps)                         | 1 GB                  |
| Network   | Stable internet (Discord Gateway + Gemini API) | Wired Ethernet        |

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

## Installation

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/rokabot.git
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

## Configuration

Secrets live in `.env`, tunables live in `config.yml`.

| YAML Path                  | Env Override                 | Default                 | Description                       |
| -------------------------- | ---------------------------- | ----------------------- | --------------------------------- |
| `gemini.model`             | `GEMINI_MODEL`               | `gemini-2.0-flash-lite` | Gemini model name                 |
| `gemini.timeout`           | `GEMINI_TIMEOUT`             | `15000`                 | Request timeout (ms)              |
| `gemini.maxRetries`        | `GEMINI_MAX_RETRIES`         | `1`                     | Max retries for transient errors  |
| `rateLimit.rpm`            | `RATE_LIMIT_RPM`             | `15`                    | Requests per minute               |
| `rateLimit.rpd`            | `RATE_LIMIT_RPD`             | `500`                   | Requests per day                  |
| `session.ttl`              | `SESSION_TTL_MS`             | `300000`                | Idle session TTL (ms)             |
| `session.windowSize`       | `SESSION_WINDOW_SIZE`        | `10`                    | FIFO message window size          |
| `discord.maxMessageLength` | `DISCORD_MAX_MESSAGE_LENGTH` | `2000`                  | Discord message char limit        |
| `logging.level`            | `LOG_LEVEL`                  | `info`                  | Log level (debug/info/warn/error) |

## Architecture

```mermaid
flowchart TB
    subgraph Discord["Discord Server"]
        User([User])
    end

    subgraph Gateway["Discord Gateway Layer"]
        direction TB
        Triggers["Triggers<br/><code>/chat</code> &bull; @mention &bull; reply"]
        RateLimit["Rate Limiter<br/>Token Bucket RPM + Daily RPD"]
        Concurrency["Concurrency Guard<br/>1 active request per channel"]
        Triggers --> RateLimit --> Concurrency
    end

    subgraph Session["Session Manager"]
        direction TB
        SessionMap["channelId &rarr; ChannelSession Map"]
        FIFO["10-Message FIFO Window"]
        TTL["5-min Idle TTL"]
        SessionMap --- FIFO
        SessionMap --- TTL
    end

    subgraph Agent["Roka Agent"]
        direction TB

        subgraph PromptSystem["4-Layer Prompt System"]
            direction LR
            L0["Layer 0<br/><b>Core Identity</b><br/>Personality &amp; boundaries"]
            L1["Layer 1<br/><b>Speech Patterns</b><br/>Verbal style &amp; formatting"]
            L2["Layer 2<br/><b>Tone Variant</b><br/>1 of 4 selected"]
            L3["Layer 3<br/><b>Channel Context</b><br/>Participants &amp; time"]
            L0 ~~~ L1 ~~~ L2 ~~~ L3
        end

        ToneDetect["Tone Detector<br/>Rule-based keyword matching<br/>(zero LLM cost)"]
        Assembler["Prompt Assembler<br/>~1000-1600 tokens budget"]
        ToneDetect --> Assembler
        PromptSystem --> Assembler
    end

    subgraph Gemini["Gemini API"]
        Model["Gemini Flash Lite<br/>15 RPM &bull; 250K TPM &bull; 500 RPD"]
    end

    User -->|message| Gateway
    Concurrency --> Session
    Session -->|history + participants| Agent
    Assembler -->|system prompt + history| Gemini
    Gemini -->|response| Agent
    Agent -->|reply| Gateway
    Gateway -->|message| User

    style Discord fill:#5865F2,color:#fff
    style Gateway fill:#2d3748,color:#fff
    style Session fill:#2d3748,color:#fff
    style Agent fill:#2d3748,color:#fff
    style Gemini fill:#f59e0b,color:#000
    style PromptSystem fill:#374151,color:#fff
    style L0 fill:#4a5568,color:#fff
    style L1 fill:#4a5568,color:#fff
    style L2 fill:#4a5568,color:#fff
    style L3 fill:#4a5568,color:#fff
```

### Tone Detection

The tone detector scans the last 3 messages for keyword matches (zero LLM cost):

```mermaid
flowchart LR
    Input["Last 3 messages"] --> Check

    Check{"Keyword scan<br/>(threshold: 2 matches)"}
    Check -->|"love, crush, kiss,<br/>cute, 💕, ❤️, 😍"| Flustered["<b>flustered</b><br/>Stammering, denial,<br/>hidden feelings leak"]
    Check -->|"sad, lonely, tired,<br/>stress, sorry, 😢, 💔"| Sincere["<b>sincere</b><br/>Warm, genuine,<br/>emotionally present"]
    Check -->|"food, cook, tea,<br/>breakfast, home, 🍵"| Domestic["<b>domestic</b><br/>Nurturing, cozy,<br/>sweets-shop manager"]
    Check -->|"no match"| Playful["<b>playful</b><br/>Teasing, friendly<br/>mockery (default)"]

    style Flustered fill:#e53e3e,color:#fff
    style Sincere fill:#3182ce,color:#fff
    style Domestic fill:#38a169,color:#fff
    style Playful fill:#d69e2e,color:#000
```

### Request Lifecycle

```mermaid
sequenceDiagram
    actor User
    participant Discord as Discord Gateway
    participant RL as Rate Limiter
    participant CG as Concurrency Guard
    participant SM as Session Manager
    participant TD as Tone Detector
    participant PA as Prompt Assembler
    participant Gemini as Gemini API

    User->>Discord: /chat, @mention, or reply
    Discord->>RL: tryConsume()

    alt Rate limit hit
        RL-->>Discord: false
        Discord-->>User: Decline message (in-character)
    else Allowed
        RL-->>Discord: true
        Discord->>CG: isChannelBusy()
        alt Channel busy
            CG-->>Discord: true
            Discord-->>User: "Still thinking..." (in-character)
        else Channel free
            CG-->>Discord: false
            CG->>CG: markBusy(channelId)
            Discord->>SM: getOrCreateSession()
            SM-->>Discord: ChannelSession
            Discord->>SM: addMessage(userMsg)
            SM-->>Discord: history + participants

            Discord->>TD: detectTone(history)
            TD-->>Discord: ToneKey

            Discord->>PA: assembleSystemPrompt()
            PA-->>Discord: system prompt

            Discord->>Gemini: generate(prompt, history)

            alt Transient error (429/500/503)
                Gemini-->>Discord: error
                Discord->>Gemini: retry (1 attempt)
            end

            Gemini-->>Discord: response text
            Discord->>SM: addMessage(botReply)
            Discord-->>User: Reply (split if > 2000 chars)
            CG->>CG: markFree(channelId)
        end
    end
```

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
│   │   │   ├── core.ts               # Layer 0: Core identity & personality
│   │   │   ├── speech.ts             # Layer 1: Speech patterns & formatting rules
│   │   │   ├── tones.ts              # Layer 2: Tone variants (playful/sincere/domestic/flustered)
│   │   │   └── context.ts            # Layer 3: Dynamic channel context (time, participants)
│   │   └── __tests__/                 # Tone detector & prompt assembler tests
│   ├── discord/
│   │   ├── client.ts                  # discord.js client setup (intents, partials, events)
│   │   ├── concurrency.ts            # Per-channel concurrency guard
│   │   ├── responses.ts              # In-character message pools (decline, busy, error, empty)
│   │   ├── commands/
│   │   │   └── chat.ts               # /chat slash command definition
│   │   ├── events/
│   │   │   ├── ready.ts              # Bot login, command registration, presence
│   │   │   ├── interactionCreate.ts  # /chat slash command handler
│   │   │   └── messageCreate.ts      # @mention and reply handler
│   │   └── __tests__/                 # Response utilities tests
│   ├── session/
│   │   ├── types.ts                   # WindowMessage & ChannelSession interfaces
│   │   ├── messageWindow.ts          # FIFO message buffer (push/evict)
│   │   ├── sessionManager.ts         # Per-channel session lifecycle + idle TTL
│   │   └── __tests__/                 # Session tests
│   └── utils/
│       ├── logger.ts                  # pino structured logger
│       ├── rateLimiter.ts            # Token bucket (RPM) + daily counter (RPD)
│       └── __tests__/                 # Rate limiter tests
├── scripts/
│   └── test-chat.ts                   # CLI test script for rapid prompt iteration
├── assets/
│   ├── roka-character-bible.md        # Comprehensive character reference
│   └── app-icon.jpg                   # Bot avatar
├── docs/                              # Project documentation
│   ├── PRD.md                         # Product requirements
│   ├── TRD.md                         # Technical requirements
│   ├── ROADMAP.md                     # Development phase timeline
│   ├── PLAN.md                        # Task breakdown & progress
│   ├── PROGRESS.md                    # Dated implementation log
│   ├── TEST.md                        # Test execution results
│   └── ROLES.md                       # Multi-agent workflow roles
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

## Testing

70 unit tests across 7 test suites covering config validation, rate limiting, session management, tone detection, prompt assembly, and response utilities.

```bash
npm test
```

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

## License

All rights reserved.
