# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**桌游集成客户端** - A web-based board game platform supporting single-player and LAN multiplayer modes. Built with vanilla JavaScript (frontend) and Node.js WebSocket server (backend).

**Current Status**: Frontend implemented with UNO complete and Werewolf P0/P1 complete (P2/P3 pending), single-player AI, and online multiplayer support. Mobile responsive adaptation (T-F123) is complete and accepted. Local backend is complete (with minor reconnect improvements pending). Cloud backend (Supabase) is complete (including reconnect support). REST API service (Render) is deployed, with card-data seeding and AI analysis endpoints pending. MCP Server (stdio + HTTP transports) is implemented.

## Architecture

**Critical Design Principle**: The backend is a **message relay only** - all game logic lives in the frontend.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  ┌────────┐  │
│  │GameEngine │  │RuleEngine │  │  Network Clients     │  │   UI   │  │
│  │(game logic)│  │(validation)│  │ ┌──────────────────┐│  │(render)│  │
│  └──────────┘  └──────────┘  │ │ NetworkClient (WS) ││  └────────┘  │
│                               │ │ CloudNetworkClient ││              │
│                               │ │ (Supabase Realtime)││              │
│                               │ └──────────────────┘│              │
│                               └──────────────────────┘              │
└────────────────────┬───────────────────────┬────────────────────────┘
                     │                       │
           ↕ WebSocket (JSON)      ↕ Supabase Realtime
                     │                       │
┌────────────────────┴──────┐  ┌─────────────┴─────────────────────┐
│  Local Backend (Port 7777) │  │  Cloud Backend (Supabase)         │
│  ┌─────────────────┐      │  │  ┌──────────┐  ┌───────────────┐  │
│  │ConnectionManager │      │  │  │  Auth     │  │   Realtime    │  │
│  │RoomManager       │      │  │  │(users/JWT)│  │(channels/     │  │
│  │MessageRouter     │      │  │  └──────────┘  │ presence/      │  │
│  │(forward only)    │      │  │  ┌──────────┐  │ broadcast)     │  │
│  └─────────────────┘      │  │  │PostgreSQL │  └───────────────┘  │
└───────────────────────────┘  │  │(profiles) │                     │
                               │  └──────────┘                     │
                               └───────────────────────────────────┘
```

## Project Structure

```
demo_boardgame/
├── frontend/              # Frontend source (Vite + vanilla JS)
│   ├── src/
│   │   ├── app/           # App method modules: reconnect, online-room, etc.
│   │   ├── cloud/         # Cloud modules: supabase-client.js, cloud-network.js, auth.js
│   │   ├── game/          # Core: engine.js, rules.js, network.js, registry.js
│   │   ├── games/         # Game modules: uno/, werewolf/
│   │   ├── layout/        # UI: game-lobby.js, game-board.js, auth-page.js, ...
│   │   ├── components/    # Common UI: modal.js, notification.js, loading.js
│   │   ├── theme/         # CSS: variables.css, default.css
│   │   ├── utils/         # Helpers: storage.js, validators.js, event-emitter.js
│   │   └── main.js        # Application entry + orchestration
│   ├── public/
│   │   └── rules/         # User-facing rule books (HTML)
│   │       └── uno.html   # UNO rules for players
│   ├── .env.example       # Environment variables template (Supabase keys)
│   ├── index.html         # HTML entry
│   └── package.json       # Vite + dependencies
├── backend/               # Local backend (Node.js WebSocket server)
│   └── server/            # index.js, connection-manager.js, room-manager.js, message-router.js
├── api/                   # REST API service (Render deployment)
│   ├── routes/            # Express routes (v1/health, games, cards)
│   ├── services/          # Business logic (supabase, game-service, card-service)
│   ├── middleware/        # auth, cors, rate-limiter, error-handler
│   └── stubs/             # AI/MCP interface placeholders
├── cloud/                 # Cloud backend config (Supabase)
│   ├── README.md          # Supabase project setup guide
│   └── migrations/        # Database migration SQL files (001_profiles, 002_card_data)
├── render.yaml            # Render deployment configuration
├── docs/
│   ├── PROTOCOL.md        # WebSocket message spec (required reading)
│   ├── dev_rules/         # Development standards (MUST READ)
│   │   ├── README.md              # Overview and quick start
│   │   ├── DEVELOPMENT_PRINCIPLES.md  # SOLID, DRY, KISS principles
│   │   └── CODE_STYLE_GUIDE.md    # Naming, formatting, comments
│   ├── games/             # Game rule documentation (AI-facing)
│   │   ├── TEMPLATE.md    # Template for new game rules
│   │   ├── uno/RULES.md   # UNO technical rules
│   │   └── werewolf/      # Werewolf (P0/P1 complete, P2/P3 in development)
│   │       ├── RULES.md   # Technical rules (template)
│   │       └── PLAN.md    # Development plan
│   └── prd/
│       ├── PRD.md         # Product requirements
│       ├── frontend/      # Frontend PRD + task list
│       ├── backend/       # Backend PRD + task list
│       └── cloud/         # Cloud backend PRD + task list
└── landing_page/          # Marketing page (TBD)
```

## Development Commands

```bash
# Frontend (with Vite)
cd frontend
npm install
npm run dev              # Start dev server at localhost:5173
npm run build            # Production build to dist/

# Backend (local WebSocket server, implemented)
cd backend/server
npm install
node index.js            # Start WebSocket server on port 7777
```

## Key Technical Details

### Network Protocol

**Two backend options** (coexist, user selects mode in lobby):

| | Local Mode | Cloud Mode |
|--|-----------|------------|
| Transport | WebSocket (`ws://host:7777`) | Supabase Realtime (Channels) |
| Backend | `backend/server/` (Node.js) | Supabase (managed) |
| Auth | None | Supabase Auth (email/password) |
| Room Mgmt | Server-side RoomManager | Client-side Presence |

**Message format** (same for both modes):
```javascript
{
  "type": "MESSAGE_TYPE",      // Required
  "timestamp": 1705900800000,  // Required (Unix ms)
  "playerId": "player-xxx",    // Required
  "data": {}                   // Optional payload
}
```

Message types: `JOIN`, `LEAVE`, `START_GAME`, `GAME_ACTION`, `CHAT_MESSAGE`, `PING`
Server responses: `PLAYER_JOINED`, `PLAYER_LEFT`, `GAME_STARTED`, `GAME_STATE_UPDATE`, `GAME_ENDED`, `ERROR`, `PONG`

### Cloud Backend (Supabase)

- **Supabase Realtime Channels** replace WebSocket server for message relay
- **Supabase Presence** replaces server-side room/player management
- **Supabase Auth** provides email/password registration and JWT authentication
- **Supabase PostgreSQL** stores user profiles (extensible for stats, friends)
- `CloudNetworkClient` implements same interface as `NetworkClient`
- Frontend game logic is completely unaware of which backend is in use
- Config: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables

### Game Module Structure

Each game in `games/[name]/` contains:
- `index.js` - Game class extending BoardGame (initialize, processMove, checkGameEnd)
- `config.json` - Metadata (id, name, minPlayers, maxPlayers, **supportsAI**, **gameType**)
- `rules.js` - Game-specific validation
- `ui.js` - Rendering components

### Game Mode Availability Rules

Game modes (single-player vs multiplayer) are determined by `gameType` and `supportsAI` in config.json:

| gameType | supportsAI | Single Player | Multiplayer | Example |
|----------|------------|---------------|-------------|---------|
| `"singleplayer"` | N/A | ✅ | ❌ | Solitaire, Puzzle |
| `"multiplayer"` | `false` | ❌ | ✅ | Werewolf |
| `"multiplayer"` | `true` | ✅ (vs AI) | ✅ | UNO, Chess |

**Config fields:**
- `gameType`: `"singleplayer"` or `"multiplayer"` (default: `"multiplayer"`)
- `supportsAI`: `true` or `false` - whether AI opponents are implemented

**Implementation rule**: The game lobby must enforce these rules - hide or disable unavailable modes based on game config.

**AI Support**: Games can optionally support AI players. Set `"supportsAI": true` in config.json to enable AI features. AI logic is an **optional, non-priority** development item - focus on core game rules and multiplayer first.

### Code Style

> **详细规范参见**: `docs/dev_rules/CODE_STYLE_GUIDE.md`

- ES6 modules (`import`/`export`)
- Classes: PascalCase, functions/variables: camelCase, constants: UPPER_SNAKE_CASE
- JSDoc comments on all public functions
- CSS Variables for all styling (see `theme/variables.css`)
- Max 1000 lines per file (prefer < 500)
- 2-space indentation, max 100 chars per line

### Development Principles

> **详细规范参见**: `docs/dev_rules/DEVELOPMENT_PRINCIPLES.md`

**SOLID 原则**:
- **S**ingle Responsibility: 每个类/模块只有一个职责
- **O**pen/Closed: 对扩展开放，对修改关闭
- **L**iskov Substitution: 子类可替换父类
- **I**nterface Segregation: 接口小而专注
- **D**ependency Inversion: 依赖抽象而非具体实现

**DRY 原则**: 避免重复代码，提取公共逻辑

**KISS 原则**: 保持简单，避免过度设计

## Game Documentation Requirements

**Before developing any new game, create the following documentation:**

### 1. AI-Facing Rule Documentation (`docs/games/[game-name]/RULES.md`)

Technical specification for AI Coding assistants. **Use the template:** `docs/games/TEMPLATE.md`

Required sections:
- Game overview and metadata
- Game elements with exact data structures
- Game rules as algorithms/pseudocode
- Action types and validation logic
- Game state structure
- Scoring formulas
- Error codes
- Configuration options

Example: `docs/games/uno/RULES.md`

### 2. User-Facing Rule Book (`frontend/public/rules/[game-name].html`)

Player-friendly documentation, including:
- Game objective and overview
- Visual card/piece explanations
- Step-by-step gameplay instructions
- Special rules and tips
- Scoring explanation

Example: `frontend/public/rules/uno.html`

### 3. Development Plan (Optional: `docs/games/[game-name]/PLAN.md`)

For complex games, create a development plan including:
- Implementation phases and tasks
- Technical challenges and solutions
- File structure
- Risk assessment

Example: `docs/games/werewolf/PLAN.md`

**Note:** If game rules are publicly available (e.g., UNO, Chess), create documentation independently. For custom or obscure games, request detailed rules from the user before proceeding.

---

## Key Documentation References

| Document | Purpose |
|----------|---------|
| `PROGRESS.md` | **项目进度报告** (当前状态、测试覆盖率、下一步计划) |
| `docs/dev_rules/README.md` | **开发规范总览** (必读) |
| `docs/dev_rules/DEVELOPMENT_PRINCIPLES.md` | SOLID/DRY/KISS 原则详解 |
| `docs/dev_rules/CODE_STYLE_GUIDE.md` | 代码风格、命名、格式规范 |
| `docs/dev_rules/ROLE_DEVELOPMENT_AGENT.md` | **狼人杀角色开发 Agent** (完整工作流程) |
| `docs/dev_rules/ROLE_AGENT_PROMPT.md` | 角色开发 Agent 提示词模板 |
| `docs/dev_rules/ROLE_INPUT_TEMPLATE.md` | 角色描述输入模板 |
| `docs/PROTOCOL.md` | WebSocket message specification |
| `docs/prd/frontend/README.md` | Frontend implementation guide with templates |
| `docs/prd/frontend/TASKS.md` | Frontend task checklist (T-F001 to T-F127) |
| `docs/prd/backend/README.md` | Backend implementation guide with templates |
| `docs/prd/backend/TASKS.md` | Backend task checklist (T-B001 to T-B120) |
| `docs/prd/cloud/PLAN.md` | **Cloud backend design & architecture** |
| `docs/prd/cloud/TASKS.md` | Cloud backend task checklist (T-C001 to T-C044) |
| `docs/prd/api/README.md` | **API service design (Render)** |
| `docs/prd/api/TRPC_REFACTOR_PLAN.md` | tRPC migration architecture, rollout, and legacy cleanup baseline |
| `docs/prd/api/ANALYTICS_MVP_PLAN.md` | MVP analytics scope, event schema, rollout, and privacy guardrails |
| `docs/prd/api/TASKS.md` | API task checklist (T-A001 to T-A066) |
| `docs/games/TEMPLATE.md` | **Template for new game rule docs** |
| `docs/games/[game]/RULES.md` | Game-specific AI rule documentation |
| `docs/games/[game]/PLAN.md` | Game development plan (optional) |
| `frontend/public/rules/[game].html` | User-facing rule books |

## Implementation Notes

1. **Follow dev_rules** - All code must comply with `docs/dev_rules/` standards
2. **Start with backend** - Implement message routing first (Phase 1 tasks)
3. **Backend does NOT validate game moves** - Just forwards GAME_ACTION to all room players
4. **Frontend owns game state** - All rules, validation, and state calculation happens client-side
5. **Storage**: localStorage for config, sessionStorage for game session
6. **Heartbeat**: Client sends PING every 30s, server responds with PONG
7. **Code Review Checklist** - Use checklist in `docs/dev_rules/README.md` before committing
