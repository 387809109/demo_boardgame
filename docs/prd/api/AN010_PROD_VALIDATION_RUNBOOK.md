# T-AN010 Production Validation Runbook

> Task: T-AN010  
> Status: In Progress (repo-side preparation complete)  
> Date: 2026-03-11  
> Scope: Validate Vercel production analytics event visibility and field compliance.

## 1. Goal

Validate in Vercel production that:

1. Custom events are visible.
2. Event properties match the approved schema.
3. No forbidden fields (PII/game secrets) are emitted.

## 2. Prerequisites

1. Frontend deployed on Vercel (Production).
2. Vercel Web Analytics enabled for the frontend project.
3. Production env var set:
   - `VITE_ANALYTICS_ENABLED=true`
4. In-app analytics consent toggle enabled for the test account/session.

## 3. Repo-side Compliance Guardrails

Already implemented before production verification:

1. Event/property schema:
   - `frontend/src/utils/analytics-events.js`
2. Runtime sanitization in wrapper:
   - `frontend/src/utils/analytics.js`
3. Schema tests:
   - `frontend/src/utils/analytics-events.test.js`

These guardrails ensure unknown events and non-whitelisted fields are dropped before sending.

## 4. Production Verification Steps

### Step A: Trigger events in Production

Run one full user flow in Vercel Production:

1. Open app and enter lobby.
2. Switch local/cloud mode once.
3. Select a game and start one match.
4. End the match.
5. Open query panel and chat panel, send one chat message.
6. (If possible) trigger reconnect path in online mode.

### Step B: Verify visibility in Vercel Analytics

In Vercel Dashboard -> Analytics:

1. Filter by production environment.
2. Confirm these events are visible (at minimum):
   - `app_opened`
   - `lobby_viewed`
   - `mode_selected`
   - `game_selected`
   - `game_started`
   - `game_ended`
   - `chat_panel_opened`
   - `chat_message_sent`
   - `query_panel_opened`

### Step C: Verify field compliance

Sample event payloads and confirm property keys stay within schema:

1. No forbidden keys:
   - `message`, `content`, `nickname`, `email`, `room_id`, `player_id`, `state`, `cards`, `hand`, `role`
2. Expected key examples:
   - `game_id`, `mode`, `player_count`, `duration_sec`, `ended_reason`, `result_type`, `error_code`
3. Check value types are primitive only:
   - string / number / boolean / null / undefined

## 5. Evidence Template

Record two screenshots and one summary:

1. Vercel Analytics event list with target events visible.
2. Event detail panel showing compliant properties.
3. Short summary:
   - verified events:
   - verified properties:
   - forbidden fields observed: yes/no
   - conclusion: pass/fail

## 6. Exit Criteria (Done)

T-AN010 can be marked done only when all are true:

1. Production events visible in Vercel.
2. Property keys match schema.
3. No forbidden fields observed.
4. Evidence captured in task notes.

