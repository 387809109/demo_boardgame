# Backend Surface Rule For This Skill

For this skill, backend endpoint work is scoped to `api/` only.

## In scope

- `api/routes/v1/*.js`
- `api/services/*.js`
- `api/tests/routes/v1/*.test.js`
- `api/tests/services/*.test.js`

## Out of scope

- `backend/server/` changes are not part of this skill.
- WebSocket message relay changes should be handled by a different skill/workflow.
