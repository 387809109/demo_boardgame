# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**桌游集成客户端** - A web-based board game platform supporting single-player and LAN multiplayer modes. Built with vanilla JavaScript (frontend) and Node.js WebSocket server (backend).

**Current Status**: Frontend implemented (v0.1.0) with UNO game, single-player AI, and online multiplayer support. Backend pending.

## Architecture

**Critical Design Principle**: The backend is a **message relay only** - all game logic lives in the frontend.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ GameEngine│  │ RuleEngine│  │NetworkClient│  │   UI    │    │
│  │(game logic)│  │(validation)│  │(WebSocket) │  │(render) │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↕ WebSocket (JSON)
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Port 7777)                        │
│  ┌────────────────┐  ┌────────────┐  ┌───────────────┐     │
│  │ConnectionManager│  │ RoomManager │  │ MessageRouter │     │
│  │ (ws sessions)   │  │ (rooms/players)│ │ (forward only)│     │
│  └────────────────┘  └────────────┘  └───────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
demo_boardgame/
├── frontend/              # Frontend source (Vite + vanilla JS)
│   ├── src/
│   │   ├── game/          # Core: engine.js, rules.js, network.js, registry.js
│   │   ├── games/         # Game modules: uno/
│   │   ├── layout/        # UI: game-lobby.js, game-board.js, settings-panel.js
│   │   ├── components/    # Common UI: modal.js, notification.js, loading.js
│   │   ├── theme/         # CSS: variables.css, default.css
│   │   ├── utils/         # Helpers: storage.js, validators.js, event-emitter.js
│   │   └── main.js        # Application entry point
│   ├── public/
│   │   └── rules/         # User-facing rule books (HTML)
│   │       └── uno.html   # UNO rules for players
│   ├── index.html         # HTML entry
│   └── package.json       # Vite + dependencies
├── backend/               # Backend source (empty, to implement)
│   └── server/            # index.js, connection-manager.js, room-manager.js, message-router.js
├── docs/
│   ├── PROTOCOL.md        # WebSocket message spec (required reading)
│   ├── dev_rules/         # Development standards (MUST READ)
│   │   ├── README.md              # Overview and quick start
│   │   ├── DEVELOPMENT_PRINCIPLES.md  # SOLID, DRY, KISS principles
│   │   └── CODE_STYLE_GUIDE.md    # Naming, formatting, comments
│   ├── games/             # Game rule documentation (AI-facing)
│   │   └── uno/RULES.md   # UNO technical rules
│   └── prd/
│       ├── PRD.md         # Product requirements
│       ├── frontend/      # Frontend PRD + task list
│       └── backend/       # Backend PRD + task list
└── landing_page/          # Marketing page (TBD)
```

## Development Commands

```bash
# Frontend (with Vite)
cd frontend
npm install
npm run dev              # Start dev server at localhost:5173
npm run build            # Production build to dist/

# Backend (not yet implemented)
cd backend/server
npm install
node index.js            # Start WebSocket server on port 7777
```

## Key Technical Details

### WebSocket Protocol (Port 7777)

Message format:
```javascript
{
  "type": "MESSAGE_TYPE",      // Required
  "timestamp": 1705900800000,  // Required (Unix ms)
  "playerId": "player-xxx",    // Required
  "data": {}                   // Optional payload
}
```

Client → Server: `JOIN`, `LEAVE`, `START_GAME`, `GAME_ACTION`, `CHAT_MESSAGE`, `PING`
Server → Client: `PLAYER_JOINED`, `PLAYER_LEFT`, `GAME_STARTED`, `GAME_STATE_UPDATE`, `GAME_ENDED`, `ERROR`, `PONG`

### Game Module Structure

Each game in `games/[name]/` contains:
- `index.js` - Game class extending BoardGame (initialize, processMove, checkGameEnd)
- `config.json` - Metadata (id, name, minPlayers, maxPlayers)
- `rules.js` - Game-specific validation
- `ui.js` - Rendering components

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

Technical specification for AI Coding assistants, including:
- Card/piece definitions with exact data structures
- All game rules as algorithms/pseudocode
- State machine definitions
- Action types and validation logic
- Scoring formulas
- Error codes

Example: `docs/games/uno/RULES.md`

### 2. User-Facing Rule Book (`frontend/public/rules/[game-name].html`)

Player-friendly documentation, including:
- Game objective and overview
- Visual card/piece explanations
- Step-by-step gameplay instructions
- Special rules and tips
- Scoring explanation

Example: `frontend/public/rules/uno.html`

**Note:** If game rules are publicly available (e.g., UNO, Chess), create documentation independently. For custom or obscure games, request detailed rules from the user before proceeding.

---

## Key Documentation References

| Document | Purpose |
|----------|---------|
| `docs/dev_rules/README.md` | **开发规范总览** (必读) |
| `docs/dev_rules/DEVELOPMENT_PRINCIPLES.md` | SOLID/DRY/KISS 原则详解 |
| `docs/dev_rules/CODE_STYLE_GUIDE.md` | 代码风格、命名、格式规范 |
| `docs/PROTOCOL.md` | WebSocket message specification |
| `docs/prd/frontend/README.md` | Frontend implementation guide with templates |
| `docs/prd/frontend/TASKS.md` | Frontend task checklist (T-F001 to T-F112) |
| `docs/prd/backend/README.md` | Backend implementation guide with templates |
| `docs/prd/backend/TASKS.md` | Backend task checklist (T-B001 to T-B113) |
| `docs/games/[game]/RULES.md` | Game-specific AI rule documentation |
| `frontend/public/rules/[game].html` | User-facing rule books |

## Implementation Notes

1. **Follow dev_rules** - All code must comply with `docs/dev_rules/` standards
2. **Start with backend** - Implement message routing first (Phase 1 tasks)
3. **Backend does NOT validate game moves** - Just forwards GAME_ACTION to all room players
4. **Frontend owns game state** - All rules, validation, and state calculation happens client-side
5. **Storage**: localStorage for config, sessionStorage for game session
6. **Heartbeat**: Client sends PING every 30s, server responds with PONG
7. **Code Review Checklist** - Use checklist in `docs/dev_rules/README.md` before committing
