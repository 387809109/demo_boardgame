---
name: add-api-endpoint
description: Add or update REST API endpoints in this repository's Express API (`api/`) so they match existing route/service/error/test patterns. In this project, "backend endpoint" means `api/` only. Use when a request mentions endpoint, route, API path, handler, CRUD API, request validation, auth-gated API, or adding tests for API behavior.
---

# Add API Endpoint

## Workflow

1. Treat backend endpoint work as `api/` only.
- In this repository, when the user says "backend endpoint", implement in `api/`.
- Do not implement HTTP endpoint requests in `backend/server/`.

2. Define the endpoint contract before editing code.
- Decide method, path, auth requirement, query/body params, and response shape.
- Follow existing response envelopes:
- Success: `{ data: ... }` or `{ data: ..., meta: ... }`.
- Error: centralized by `api/middleware/error-handler.js`.

3. Implement service-layer logic first.
- Add or extend a function in `api/services/*.js`.
- Use `getSupabaseAdmin()` for data access.
- Throw `NotFoundError` for missing resources where appropriate.
- Do not send HTTP responses from services.

4. Implement route handler and validation.
- Add route in `api/routes/v1/*.js` using `Router()`.
- Wrap handlers with `try/catch` and `next(err)`.
- Use `validatePagination`, `validateRequired`, or specific validators from `api/utils/validator.js`.
- Apply `requireAuth` to mutating/protected endpoints.

5. Wire route aggregators if a new route file is introduced.
- Update `api/routes/v1/index.js` and possibly `api/routes/index.js`.
- Preserve `/api/v1/...` versioning conventions.

6. Add or update tests in the same change.
- Route tests: `api/tests/routes/v1/*.test.js` with `supertest`.
- Service tests: `api/tests/services/*.test.js` with mocked Supabase chain.
- Mirror existing mocking style (`jest.unstable_mockModule`, chainable builders).
- Cover happy path and at least one failure path.

7. Validate before finishing.
- Run focused tests first:
```bash
cd api
npm test -- tests/routes/v1/<target>.test.js
npm test -- tests/services/<target>.test.js
```
- If feasible, run full API tests:
```bash
cd api
npm test
```
- Report what passed and what remains failing (if any pre-existing failures exist).

## Conventions

- Keep route handlers thin; push query logic into services.
- Keep error shaping centralized in `error-handler.js`.
- Keep response keys stable (`data`, `meta`, `error`) to avoid frontend regressions.
- Follow ESM imports/exports and existing naming style.
- Do not introduce game-rule logic into backend; backend remains transport/data service oriented.

## References

- Use `references/api-conventions.md` for route/service/test templates aligned to this repository.
