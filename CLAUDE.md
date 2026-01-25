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
│   ├── index.html         # HTML entry
│   └── package.json       # Vite + dependencies
├── backend/               # Backend source (empty, to implement)
│   └── server/            # index.js, connection-manager.js, room-manager.js, message-router.js
├── docs/
│   ├── PROTOCOL.md        # WebSocket message spec (required reading)
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

- ES6 modules (`import`/`export`)
- Classes: PascalCase, functions/variables: camelCase
- JSDoc comments on all public functions
- CSS Variables for all styling (see `theme/variables.css`)
- Max 500 lines per file

## Key Documentation References

| Document | Purpose |
|----------|---------|
| `docs/PROTOCOL.md` | WebSocket message specification |
| `docs/prd/frontend/README.md` | Frontend implementation guide with templates |
| `docs/prd/frontend/TASKS.md` | Frontend task checklist (T-F001 to T-F112) |
| `docs/prd/backend/README.md` | Backend implementation guide with templates |
| `docs/prd/backend/TASKS.md` | Backend task checklist (T-B001 to T-B113) |

## Implementation Notes

1. **Start with backend** - Implement message routing first (Phase 1 tasks)
2. **Backend does NOT validate game moves** - Just forwards GAME_ACTION to all room players
3. **Frontend owns game state** - All rules, validation, and state calculation happens client-side
4. **Storage**: localStorage for config, sessionStorage for game session
5. **Heartbeat**: Client sends PING every 30s, server responds with PONG
