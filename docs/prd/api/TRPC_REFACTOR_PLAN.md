# tRPC Refactor Migration Plan (API-First)

> **Status**: Draft  
> **Date**: 2026-03-01  
> **Owner**: Platform/API Team (initial draft by Codex)

## Goal

Create a single source-of-truth migration plan to introduce tRPC for the API
integration layer so frontend and backend contracts become tighter, typed, and
easier to evolve.

## Non-goals

- No runtime refactor is executed in this checkpoint.
- No multiplayer transport rewrite in this plan scope:
  - local WebSocket relay (`backend/server`)
  - Supabase Realtime cloud path (`frontend/src/cloud/cloud-network.js`)
- No game logic ownership change (frontend remains game-state authority).

## Current Architecture Baseline

### API REST Surface (`api/`)

- REST endpoints are served from Express routes under `/api/v1/*`.
- Main endpoint groups:
  - `health`
  - `games`
  - `cards`
  - `chat`
- Business logic lives in service modules (`api/services/*`) and is consumed by
  route handlers (`api/routes/v1/*`).

### Multiplayer Transport Separation

- Multiplayer transport is intentionally separate from API query/chat surface:
  - Local mode: `backend/server` WebSocket relay
  - Cloud mode: Supabase Realtime + Presence
- Current tRPC migration target is API/query-control plane only, not gameplay
  transport.

## Scope Decision

- **API-first tRPC migration only**.
- Gameplay transport remains unchanged in initial rollout.
- REST and tRPC run in parallel during migration for compatibility and safe
  rollback.

## Phase Plan

### Phase 0: Baseline Contract Capture

- Freeze current REST behavior with contract tests/snapshots for key endpoints.
- Record response envelope conventions (`{ data }`, `{ data, meta }`, `{ error }`).
- Define parity gates before introducing any endpoint replacement.

### Phase 1: tRPC Server Introduction

- Add tRPC server wiring in `api/` (router, context, procedure layers).
- Reuse existing service modules as domain layer.
- Introduce shared auth and validation strategy across REST and tRPC entrypoints.

### Phase 2: REST Compatibility Dual-Run

- Keep existing `/api/v1/*` endpoints active.
- REST handlers call shared business logic/procedure layer to avoid drift.
- Add deprecation signaling for REST consumers.

### Phase 3: Frontend Client Migration

- Migrate frontend API integration (`frontend/src/utils/api-client.js`) to call
  tRPC client layer.
- Keep component behavior unchanged (`query-panel`, `chat-panel`) while transport
  behind client abstraction transitions.

### Phase 4: Legacy Cleanup Gates

- Remove compatibility code only after:
  - parity verified
  - soak period complete
  - no active REST consumers
- Keep cleanup as a dedicated, auditable phase.

## REST-to-tRPC Mapping (Endpoint/Procedure Parity)

| REST Endpoint | tRPC Procedure (planned) | Notes |
|---|---|---|
| `GET /api/v1/health` | `health.status` | Health/readiness |
| `GET /api/v1/games` | `games.list` | Includes filters/pagination |
| `GET /api/v1/games/single-player` | `games.listSinglePlayer` | Existing API capability |
| `GET /api/v1/games/:gameId` | `games.getById` | Single game metadata |
| `GET /api/v1/games/:gameId/categories` | `games.listCategories` | Category list by game |
| `GET /api/v1/games/:gameId/cards` | `cards.listByGame` | Includes filters/pagination |
| `GET /api/v1/games/:gameId/cards/:cardId` | `cards.getById` | Single card |
| `POST /api/v1/games` | `games.create` | Protected |
| `PUT /api/v1/games/:gameId` | `games.update` | Protected |
| `POST /api/v1/games/:gameId/categories` | `games.createCategory` | Protected |
| `POST /api/v1/games/:gameId/cards` | `cards.create` | Protected |
| `PUT /api/v1/games/:gameId/cards/:cardId` | `cards.update` | Protected |
| `POST /api/v1/chat` | `chat.send` | Session create/continue |
| `GET /api/v1/chat/games` | `chat.games` | Loaded-rule game list |
| `GET /api/v1/chat/:sessionId` | `chat.session` | Session history |
| `DELETE /api/v1/chat/:sessionId` | `chat.deleteSession` | Session delete |

## Legacy Cleanup Register

| Legacy Item | Remove/Refactor When | Gate |
|---|---|---|
| REST-specific route glue duplication | Phase 4 | tRPC parity + compatibility tests green |
| Frontend fetch-only API transport internals | Phase 4 | frontend switched to tRPC client wrappers |
| Backward-compat payload fallbacks (where safe) | Phase 4+ | transport parity and regression checks |
| Stale docs claiming REST-only design | Phase 1-4 | docs index updated and plan adopted |

## Risks

- Contract drift between REST and tRPC during dual-run.
- Auth/context behavior mismatch across entrypoints.
- Error envelope regressions impacting existing UI flows.
- Overreach into gameplay transport scope causing risk to multiplayer stability.

## Rollback Strategy

- Keep REST `/api/v1/*` as active fallback during migration.
- Enable phased frontend cutover through client abstraction.
- If tRPC path regresses, route traffic back to REST without gameplay changes.

## Acceptance Criteria

- Documentation checkpoint merged before implementation.
- All target docs index this plan correctly.
- Plan clearly states API-first scope and transport non-goals.
- Implementation phase may start only after this checkpoint is reviewed.

## Guardrail

This documentation checkpoint **precedes implementation**.  
No runtime API or gameplay code changes should begin until this plan is accepted.

## References

- [API README](./README.md)
- [API TASKS](./TASKS.md)
- [AI_CHAT_PRD](./AI_CHAT_PRD.md)
- [AI_RAG_PLAN](./AI_RAG_PLAN.md)
- [Protocol](../../PROTOCOL.md)
- [Cloud PLAN](../cloud/PLAN.md)
- [Frontend README](../frontend/README.md)
- [Backend README](../backend/README.md)
- [CLAUDE](../../../CLAUDE.md)
- [PROGRESS](../../../PROGRESS.md)
