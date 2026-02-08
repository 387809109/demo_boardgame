# API Conventions

These conventions are derived from the current `api/` codebase and should be followed for new endpoints.

## Route shape

- Route files live under `api/routes/v1/`.
- Handlers use `async (req, res, next) => { try { ... } catch (err) { next(err); } }`.
- Successful responses use:
- `{ data }` for single/list payloads.
- `{ data, meta }` for paginated list endpoints.
- Auth-required mutations use `requireAuth`.

Example pattern:

```js
router.get('/', async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(req.query, config.pagination.defaultLimit, config.pagination.maxLimit);
    const result = await someService.list({ limit, offset });
    res.json({ data: result.data, meta: { total: result.total, limit, offset } });
  } catch (err) {
    next(err);
  }
});
```

## Validation and errors

- Use `api/utils/validator.js` helpers:
- `validatePagination(query, defaultLimit, maxLimit)`
- `validateRequired(body, fields)`
- `validateString(...)`, `validateInteger(...)` when needed
- Throw domain errors from services (for example `NotFoundError`).
- Let `api/middleware/error-handler.js` format error responses.

## Service shape

- Service files live in `api/services/`.
- Use `getSupabaseAdmin()` from `api/services/supabase.js`.
- Keep DB query logic in services, not routes.
- Return plain objects/arrays from services.
- Throw `NotFoundError` on missing single-resource fetches/updates.

## Router wiring

- New v1 routes must be mounted in `api/routes/v1/index.js`.
- Root API router mounts v1 at `api/routes/index.js`.
- Final path form is `/api/v1/...`.

## Testing pattern

- Route tests:
- Location: `api/tests/routes/v1/*.test.js`
- Tools: `supertest`, `jest.unstable_mockModule(...)`, dynamic import of `app.js` after mocks
- Assert status codes and response envelope shape
- Service tests:
- Location: `api/tests/services/*.test.js`
- Mock chainable Supabase query builder methods (`select`, `eq`, `order`, `range`, `single`, etc.)
- Assert success and failure paths

## Suggested implementation checklist

1. Add/update service function in `api/services/*.js`.
2. Add/update route handler in `api/routes/v1/*.js`.
3. Mount new route in `api/routes/v1/index.js` if needed.
4. Add route tests in `api/tests/routes/v1/*.test.js`.
5. Add service tests in `api/tests/services/*.test.js`.
6. Run focused tests and then full `api` tests.
