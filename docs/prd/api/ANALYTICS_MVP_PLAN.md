# Analytics MVP Plan (Vercel Built-In)

> **Status**: In Progress
> **Date**: 2026-03-01
> **Owner**: Product + Frontend + API
> **Guardrail**: Documentation checkpoint precedes implementation.

## Background

- Current project status: functional MVP delivered, but no product analytics.
- Current architecture:
  - Frontend: Vite + vanilla JS (`frontend/`)
  - Local multiplayer: WebSocket relay (`backend/server`)
  - Cloud multiplayer: Supabase Realtime (`cloud/`, `frontend/src/cloud`)
  - API: Express on Render (`api/`)
- Constraint: keep rollout lightweight and avoid custom data-pipeline work.

## Implementation Checkpoint (2026-03-01)

Completed in repository:
- Frontend analytics wrapper created: `frontend/src/utils/analytics.js`
- Vercel Analytics dependency integrated: `@vercel/analytics`
- Consent toggle added in app settings (default off)
- Event instrumentation added for lifecycle, room funnel, reconnect reliability, and feature usage
- Frontend verification passed (`build` + full test run)

Pending outside repository code:
- Enable Web Analytics in Vercel Dashboard for frontend project
- Set production env `VITE_ANALYTICS_ENABLED=true` and redeploy
- Validate production custom events visibility in Vercel Analytics
- Configure Render/Supabase platform monitoring baseline and alert thresholds

## MVP Analytics Scope

Answer only these core questions:

1. Activation: do users reach first game start?
2. Multiplayer funnel: do room create/join attempts succeed?
3. Engagement: do started games finish?
4. Reliability: how often do reconnect flows fail?
5. Feature usage: are API query panel and AI chat panel used?

## Out of Scope (MVP)

- No full session replay.
- No heatmaps/autocapture-heavy tooling.
- No custom BI or warehouse pipeline.
- No per-move gameplay telemetry.
- No PII collection (nickname, email, chat content, full game payload).

## Recommended Stack Fit

### Product Analytics (Recommended)

Use **Vercel Web Analytics** (`@vercel/analytics`) with:
- Auto pageview tracking
- Lean custom events via `track(...)`

Why this fits:
- Minimal code for vanilla JS.
- No analytics backend service to run.
- Works with current architecture where only frontend needs instrumentation.

### Deployment Prerequisite

- Frontend must be deployed on Vercel for built-in analytics collection.
- `api/` can remain on Render and cloud realtime can remain on Supabase.

### Infra Metrics (Reuse Existing Platform)

- Render: request count, latency, errors for `api/`.
- Supabase: Realtime/auth usage and platform health.

## Event Design (Lean Schema)

Keep custom events to 10-15:

1. `app_opened`
2. `lobby_viewed`
3. `mode_selected` (`local` or `cloud`)
4. `game_selected` (`game_id`)
5. `room_create_attempted`
6. `room_create_succeeded`
7. `room_join_attempted`
8. `room_join_succeeded`
9. `game_started` (`game_id`, `mode`, `player_count`)
10. `game_ended` (`game_id`, `mode`, `duration_sec`, `ended_reason`)
11. `network_disconnected` (`mode`, `reason`)
12. `reconnect_attempted`
13. `reconnect_succeeded`
14. `reconnect_failed`
15. `chat_panel_opened`, `chat_message_sent`, `query_panel_opened`

## Allowed vs Forbidden Properties

Allowed:
- `game_id`, `mode`, `player_count`, `duration_sec`, `result_type`, `error_code`

Forbidden:
- Chat message content
- Nickname or email
- Raw room IDs
- Full game state, card hands, hidden role data

## Minimal Implementation Plan

### Phase 0: Privacy and Consent

- Update privacy wording for telemetry.
- Add user-facing analytics toggle in settings (recommended default: off until opt-in).

### Phase 1: Analytics Wrapper

Create one wrapper module:
- `frontend/src/utils/analytics.js`

Wrapper API:
- `initAnalytics()`
- `trackEvent(name, props)`
- `setAnalyticsConsent(enabled)`

Implementation notes:
- `initAnalytics()` calls `inject()` from `@vercel/analytics` only when consent is on.
- `trackEvent(...)` calls `track(...)` only when consent is on.
- No direct `@vercel/analytics` usage outside wrapper.

Frontend logging:
- Wrapper logs debug events for consent changes, init lifecycle, skipped tracking, and failures.
- Optional flag `VITE_ANALYTICS_DEBUG=true` enables logs outside dev mode.
- Logging is for troubleshooting only and does not include user content or PII.

### Phase 2: Add MVP Events at Existing Boundaries

Instrument only existing control points:

- `frontend/src/main.js`
  - `app_opened`, `lobby_viewed`, `game_selected`, `game_started`, `game_ended`
- `frontend/src/app/app-online-room-methods.js`
  - room create/join attempt and success
- `frontend/src/app/app-reconnect-methods.js`
  - reconnect attempt/success/failure
- `frontend/src/components/chat-panel.js`
  - panel open + message sent (without message text)
- `frontend/src/components/query-panel.js`
  - panel open

### Phase 3: Project Setup and Deployment

- Vercel Dashboard: enable Web Analytics for the frontend project.
- Add package: `@vercel/analytics`.
- Optional frontend flags:
  - `VITE_ANALYTICS_ENABLED=true`
- Update:
  - `frontend/.env.example`
  - deployment docs if needed

### Phase 4: Dashboard Review Loop

In Vercel Analytics, validate:

1. Activation funnel: `app_opened -> game_started`
2. Multiplayer funnel: room attempt -> success
3. Completion: `game_started -> game_ended`
4. Reliability: disconnect/reconnect success rate

Review cadence:
- Weekly during MVP stabilization.

## Success Criteria

- One wrapper module controls analytics.
- <= 15 stable custom events in first release.
- No forbidden properties shipped.
- Team can answer the 5 MVP questions from dashboards.

## Rollback and Safety

- Disable analytics by turning off consent or `VITE_ANALYTICS_ENABLED`.
- Wrapper no-op behavior must not affect gameplay paths.

## Effort Estimate (Practical)

- Planning + schema: 0.5 day
- Wrapper + Vercel setup: 0.5 day
- Event instrumentation: 1 day
- Dashboard validation: 0.5 day
- Total: ~2.5 days (single engineer)

## References

- [API README](./README.md)
- [TRPC_REFACTOR_PLAN](./TRPC_REFACTOR_PLAN.md)
- [AI_CHAT_PRD](./AI_CHAT_PRD.md)
- [AI_RAG_PLAN](./AI_RAG_PLAN.md)
- [Cloud README](../../../cloud/README.md)
- [PROGRESS](../../../PROGRESS.md)
- [CLAUDE](../../../CLAUDE.md)
- [Vercel Analytics Quickstart](https://vercel.com/docs/analytics/quickstart)
- [@vercel/analytics package](https://www.npmjs.com/package/@vercel/analytics)
