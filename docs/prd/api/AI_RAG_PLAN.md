# RAG-Lite: Rule Document Enhanced AI Chat

## Context

The AI chat service (Step 1) works but answers purely from LLM training data — it has no access to this project's actual game rules. For complex games like Werewolf (993-line RULES.md + 15 role docs + mechanism docs), answers can be inaccurate or miss project-specific rule variants. Step 2 injects relevant rule document chunks into the system prompt so the AI answers based on our actual rules. Werewolf is the initial test case.

## Approach: Keyword/Structured Retrieval

- Parse markdown rule docs into chunks (split on `## ` headings)
- Tag each chunk with metadata (gameId, type, roleId, keywords)
- On each user query: extract keywords → score chunks → inject top matches into system prompt
- No embedding dependencies — simple, fast, debuggable

---

## Implementation Steps

### Step 1: `rules-loader.js` (T-AC009)

**New file**: `api/services/rules-loader.js`

Core functions:
- **`loadAllRules()`** — Scan `docs/games/*/RULES.md`, parse each game's docs into chunks, store in `Map<gameId, GameRuleIndex>`
  - For each game dir: load `RULES.md`, `roles/*.md`, `mechanisms/*.md`
  - Path: resolve from `api/services/` → `../../docs/games/`
- **`parseMarkdownToChunks(text, metadata)`** — Split on `## ` headings, sub-split large sections on `### ` if >800 token estimate. Track code fence state to avoid splitting inside code blocks
- **`extractKeywords(text)`** — Extract Chinese game terms + English identifiers, remove stop words. Include a small dictionary of known terms from game configs (role names, phase names)
- **`retrieveChunks(query, gameId, tokenBudget=3500)`** — Score all chunks for the game:
  - Heading match: weight 3
  - Keyword match: weight 2
  - Content substring match: weight 1
  - Role-type bonus: +5 if query mentions a role and chunk is that role's doc
  - Greedy selection by score until budget exhausted
- **`getLoadedGames()`** — Return `[{ gameId, gameName, chunkCount, totalTokens }]`
- **`_resetIndex()`** — For testing

Token estimate heuristic: `Math.ceil(text.length / 2)` (good for mixed Chinese/English)

### Step 2: Unit tests for rules-loader (T-AC012)

**New file**: `api/tests/services/rules-loader.test.js`

Test cases (~15-20 tests):
- `parseMarkdownToChunks`: heading splitting, large section sub-splitting, code fence protection, token estimation
- `extractKeywords`: Chinese terms, English identifiers, stop word removal
- `retrieveChunks`: empty gameId → [], heading match outranks content match, role bonus, token budget respected
- `loadAllRules`: loads UNO + werewolf, `getLoadedGames()` returns correct list
- Edge cases: empty docs, no roles dir, missing RULES.md

### Step 3: Integrate into chat-service (T-AC010)

**Modify**: `api/services/chat-service.js`

Changes:
- `sendMessage(message, sessionId, gameId)` — add 3rd param
- Store `gameId` on session object (persist across messages, allow override)
- Call `retrieveChunks(message, gameId)` if gameId provided
- `buildMessages(session, userMessage, chunks=[])` — if chunks present, append rule context section to system prompt:
  ```
  ## 以下是相关的游戏规则参考资料

  ### [sectionTitle] (来源: [type])
  [content]
  ---
  ...

  请基于以上资料回答用户的问题。如果资料中没有涵盖的内容，请如实说明。
  ```

### Step 4: Route changes (T-AC011)

**Modify**: `api/routes/v1/chat.js`

- POST `/`: Extract `gameId` from `req.body`, validate (optional string, max 50 chars), pass to `chatService.sendMessage(trimmed, sessionId, gameId)`
- **New** GET `/games`: Return loaded games list. **Must register before `/:sessionId`** to avoid Express param conflict

**Modify**: `api/index.js`

- Import and call `loadAllRules()` before `app.listen()`

### Step 5: Integration tests (T-AC013)

**New file**: `api/tests/services/chat-integration.test.js`

Test cases (~8-10 tests):
- Werewolf role query → system prompt contains seer rules
- Cross-role query → multiple role chunks injected
- UNO query → UNO rules in context
- No gameId → default system prompt (no rules)
- Token budget not exceeded with broad werewolf query
- Session persists gameId across messages

**Modify existing tests**:
- `api/tests/services/chat-service.test.js` — sendMessage with/without gameId backward compatibility
- `api/tests/routes/v1/chat.test.js` — POST with gameId, GET /chat/games, invalid gameId validation

### Step 6: Frontend API client update

**Modify**: `frontend/src/utils/api-client.js`

- `sendChatMessage(message, sessionId, gameId)` — add gameId to POST body
- **New** `fetchChatGames()` — GET `/api/v1/chat/games`

### Step 7: Frontend chat panel update

**Modify**: `frontend/src/components/chat-panel.js`

- Add game selector `<select>` in header (fetched from `/chat/games`, cached)
- Default option: "通用 (无特定游戏)"
- `setGameContext(gameId)` method — called by app for auto-detection
- Send `this._selectedGameId` with every message
- Dynamic suggestion buttons per game:
  - werewolf: 预言家技能, 女巫毒药, 警长投票权重
  - uno: 出牌规则, 万能牌, +4叠加
  - default: mix of both

### Step 8: Frontend auto-detect wiring

**Modify**: `frontend/src/main.js`

- When entering game lobby/starting game: `chatPanel.setGameContext(gameId)`
- When leaving game: `chatPanel.setGameContext(null)`

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| New | `api/services/rules-loader.js` | Core chunking + retrieval |
| New | `api/tests/services/rules-loader.test.js` | Unit tests |
| New | `api/tests/services/chat-integration.test.js` | Integration tests |
| Modify | `api/services/chat-service.js` | Accept gameId, inject rule context |
| Modify | `api/routes/v1/chat.js` | gameId param + GET /games |
| Modify | `api/index.js` | loadAllRules() at startup |
| Modify | `frontend/src/utils/api-client.js` | gameId + fetchChatGames |
| Modify | `frontend/src/components/chat-panel.js` | Game selector + auto-detect |
| Modify | `frontend/src/main.js` | Wire setGameContext |

## Verification

1. `cd api && npm test` — all existing + new tests pass
2. Start API server locally, verify startup log shows "Loaded N games, M chunks"
3. `curl POST /api/v1/chat` with `gameId: "werewolf"` and message "预言家怎么查验" — verify response references actual project rules
4. `curl GET /api/v1/chat/games` — returns werewolf + uno
5. `cd frontend && npm run build` — no build errors
6. Manual: open chat panel in game lobby → verify game auto-selected, suggestions updated
