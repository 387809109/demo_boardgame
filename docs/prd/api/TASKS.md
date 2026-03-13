# API 服务开发任务清单 - AI Coding 专用

> 本文档为 AI 编程助手提供结构化的任务清单，按优先级和依赖关系排列。
> 详细设计方案见: `docs/prd/api/README.md`

---

## 当前进度概览

| Phase | 进度 | 说明 |
|-------|------|------|
| Phase A1: 框架骨架 | ✅ 完成 | Express 配置、中间件、健康检查 |
| Phase A2: Supabase 集成 | ✅ 完成 | 客户端、JWT 认证、限流 |
| Phase A3: 数据端点 | ✅ 完成 | 游戏/卡牌 CRUD 路由和服务 |
| Phase A4: 部署配置 | ✅ 完成 | render.yaml、环境变量 |
| Phase A5: 测试 | ✅ 完成 | 21 个单元测试通过 |
| Phase A6: 卡牌数据 | ⬜ 待开发 | 各游戏卡牌数据填充 |
| Phase A7: AI/MCP 接口 | ⬜ 待开发 | AI 分析、走法建议、MCP 工具 |
| Phase AC1~AC3: AI 对话 Step 1 | ✅ 完成 | AI 规则问答核心 (50 个测试通过) |
| Phase AC4: AI 对话 Step 2 | ✅ 完成 | 规则知识库增强 (RAG-lite)，49 个新测试通过，手动端到端测试已完成 |
| Phase AN: Analytics MVP | 🔶 进行中 | Vercel 前端埋点已落地；AN2 与 T-AN010 调整为未来可选（需付费能力） |

---

## Phase A1: 框架骨架 ✅ 完成

- [x] **T-A001** 创建项目结构和 package.json
- [x] **T-A002** 创建配置模块 `config.js`
- [x] **T-A003** 创建日志工具 `utils/logger.js`
- [x] **T-A004** 创建错误类 `utils/errors.js`
- [x] **T-A005** 创建 CORS 中间件 `middleware/cors.js`
- [x] **T-A006** 创建错误处理中间件 `middleware/error-handler.js`
- [x] **T-A007** 创建健康检查路由 `routes/v1/health.js`
- [x] **T-A008** 创建 Express 应用 `app.js` 和入口 `index.js`
- [x] **T-A009** 创建 `.env.example`

---

## Phase A2: Supabase 集成 ✅ 完成

- [x] **T-A010** 创建 Supabase 客户端 `services/supabase.js`
- [x] **T-A011** 创建 JWT 认证中间件 `middleware/auth.js`
- [x] **T-A012** 创建限流中间件 `middleware/rate-limiter.js`
- [x] **T-A013** 创建请求校验工具 `utils/validator.js`

---

## Phase A3: 数据端点 ✅ 完成

- [x] **T-A020** 创建数据库迁移 `cloud/migrations/002_create_card_data.sql`
  - games 表 (游戏元数据)
  - card_categories 表 (卡牌类别)
  - cards 表 (卡牌数据)
  - RLS 策略、索引、触发器
  - 种子数据 (UNO, Werewolf)

- [x] **T-A021** 创建游戏服务 `services/game-service.js`
  - listGames (分页、过滤、搜索)
  - getGame
  - createGame
  - updateGame

- [x] **T-A022** 创建卡牌服务 `services/card-service.js`
  - listCategories
  - createCategory
  - listCards (分页、过滤、搜索)
  - getCard
  - createCard
  - updateCard

- [x] **T-A023** 创建游戏路由 `routes/v1/games.js`
- [x] **T-A024** 创建卡牌路由 `routes/v1/cards.js`

---

## Phase A4: 部署配置 ✅ 完成

- [x] **T-A030** 创建 Render 部署配置 `render.yaml`
- [x] **T-A031** 部署到 Render 并验证

---

## Phase A5: 测试 ✅ 完成

- [x] **T-A040** 创建 Jest 配置 `jest.config.js`
- [x] **T-A041** 健康检查测试 `tests/routes/v1/health.test.js`
- [x] **T-A042** 认证中间件测试 `tests/middleware/auth.test.js`
- [x] **T-A043** 游戏路由测试 `tests/routes/v1/games.test.js`
- [x] **T-A044** 卡牌路由测试 `tests/routes/v1/cards.test.js`
- [x] **T-A045** 游戏服务测试 `tests/services/game-service.test.js`
- [x] **T-A046** 卡牌服务测试 `tests/services/card-service.test.js`

---

## Phase A6: 卡牌数据填充 ⬜ 待开发

### UNO 卡牌数据

- [ ] **T-A050** UNO 卡牌类别数据
  - `number` - 数字牌 (0-9)
  - `action` - 功能牌 (Skip, Reverse, Draw Two)
  - `wild` - 万能牌 (Wild, Wild Draw Four)

- [ ] **T-A051** UNO 数字牌数据 (76 张)
  - 每种颜色 (红/黄/绿/蓝) 各 19 张
  - 0 各 1 张，1-9 各 2 张
  - attributes: `{ color, value }`

- [ ] **T-A052** UNO 功能牌数据 (24 张)
  - Skip/Reverse/Draw Two 每种颜色各 2 张
  - effects: `{ skip: true }`, `{ reverse: true }`, `{ draw: 2 }`

- [ ] **T-A053** UNO 万能牌数据 (8 张)
  - Wild 4 张，Wild Draw Four 4 张
  - effects: `{ wild: true }`, `{ wild: true, draw: 4 }`

### Werewolf 角色数据

- [ ] **T-A054** Werewolf 角色类别数据
  - `villager_team` - 好人阵营
  - `werewolf_team` - 狼人阵营
  - `neutral` - 中立阵营

- [ ] **T-A055** Werewolf P0 角色数据 (6 角色)
  - 村民、狼人、预言家、医生、猎人、女巫
  - effects: 各角色技能描述

- [ ] **T-A056** Werewolf P1 角色数据 (8 角色)
  - 守卫、白痴、小丑、长老、丘比特、猎魔人、狼王、狼美人

### 数据填充脚本

- [ ] **T-A057** 创建数据填充迁移 `cloud/migrations/003_seed_card_data.sql`
- [ ] **T-A058** 创建管理端点或脚本批量导入卡牌数据

---

## Phase A7: AI/MCP 接口 ⬜ 待开发

### AI 分析接口

- [ ] **T-A060** 创建 AI 服务 `services/ai-service.js`
  - analyzeGameState(gameId, state) - 分析游戏局面
  - suggestMove(gameId, state, playerId) - 建议最佳走法
  - evaluateMove(gameId, state, move) - 评估走法质量

- [ ] **T-A061** 创建 AI 路由 `routes/v1/ai.js`
  ```
  POST /api/v1/ai/analyze
  POST /api/v1/ai/suggest
  POST /api/v1/ai/evaluate
  ```

- [ ] **T-A062** 集成 LLM API (Claude/OpenAI)
  - 环境变量: `AI_PROVIDER`, `AI_API_KEY`
  - 提示词模板管理
  - 响应解析和验证

### MCP 工具接口 (Stdio Server)

> 实现方案已从 REST 端点改为 **stdio 独立进程 MCP server**（`mcp/` 目录），
> 可被 Claude Desktop / Claude Code / Cursor 等 MCP 客户端直接调用。

- [x] **T-A063** 创建 MCP server 入口 `mcp/index.js` + 适配 `mcp/lib/rules-loader.js`
  - 使用 `@modelcontextprotocol/sdk` + `StdioServerTransport`
  - 从 `api/services/rules-loader.js` 适配（去 logger 依赖）

- [x] **T-A064** ~~创建 MCP 路由~~ → 已改为 stdio 传输，无需 HTTP 路由
  - 配置方式: `claude mcp add boardgame -- node mcp/index.js`

- [x] **T-A065** 定义 MCP 工具集 (Phase 1)
  - `get_game_rules` - 获取游戏规则（list_games / get_rules / search_rules）
  - `query_pokemon` - PokeAPI 外部 API 访问测试工具
  - 待开发: `get_card_info`, `analyze_game_state`, `suggest_move`

- [x] **T-A066** MCP server 启动 + 工具调用手动测试通过

### MCP Remote 模式

- [x] **T-A067** 实现 MCP Remote 传输层（Streamable HTTP）
  - `mcp/server-http.js` — 独立 Express HTTP 服务（端口 3100）
  - 使用 `StreamableHTTPServerTransport`，支持有状态 session 管理
  - 复用 stdio 版本的全部工具定义
  - 启动: `cd mcp && npm run start:http`
  - 连接: `claude mcp add boardgame-remote --transport http http://localhost:3100/mcp`

- [ ] **T-A068** Remote MCP 认证与安全
  - 复用 Supabase JWT 认证
  - 线上部署所需

---

## Phase AC: AI 规则问答对话

> 详细 PRD 见: `docs/prd/api/AI_CHAT_PRD.md`

### Step 1: AI 对话核心 ✅ 完成

- [x] **T-AC001** `config.js` 新增 openai/chat 配置区块 + `.env.example` 更新
- [x] **T-AC002** 安装 `openai` npm 依赖
- [x] **T-AC003** 创建 `services/chat-service.js` 对话服务
- [x] **T-AC004** 创建 `routes/v1/chat.js` 对话路由 + 注册到 app
- [x] **T-AC005** chat-service 单元测试 `tests/services/chat-service.test.js`
- [x] **T-AC006** chat 路由集成测试 `tests/routes/v1/chat.test.js`
- [x] **T-AC007** 更新 TASKS.md 和 PROGRESS.md
- [x] **T-AC008** 更新 README.md 端点文档

### Step 2: 规则知识库增强 ✅ 完成（含手动端到端测试）

> 设计方案: `docs/prd/api/AI_RAG_PLAN.md`

- [x] **T-AC009** 创建 `services/rules-loader.js` 规则文档加载模块
  - Markdown 按 `##` 分块，大节按 `###` 二次切分，代码围栏保护
  - 中文 n-gram (2-3 字) + 英文标识符关键词提取
  - 评分检索: heading(×3) + keyword(×2) + content(×1) + 角色加分(+5)
  - Token 预算 3500，贪心选块
- [x] **T-AC010** chat-service 集成 rules-loader，system prompt 注入规则上下文
  - `sendMessage(msg, sessionId, gameId)` 新增 gameId 参数
  - Session 持久化 gameId，支持中途切换
- [x] **T-AC011** 新增 `GET /api/v1/chat/games` 端点 + POST 支持 gameId 参数
  - gameId 验证: 可选 string, ≤50 字符
  - `/games` 在 `/:sessionId` 之前注册避免参数冲突
- [x] **T-AC012** rules-loader 单元测试 (37 tests)
- [x] **T-AC013** 规则注入集成测试 (8 tests) + 路由测试扩展 (4 tests)
- [x] **T-AC014** 手动端到端测试（启动 API + 前端，验证规则注入效果） ✅
  - 验收通过：`gameId` 注入生效、会话内上下文延续、中途切换 `gameId` 生效、历史读取正常

---

## Phase AN: Analytics MVP（Vercel + Render）🔶 进行中

> 设计方案: `docs/prd/api/ANALYTICS_MVP_PLAN.md`

### AN1: 前端埋点基础（Vercel Analytics）

- [x] **T-AN001** 安装 `@vercel/analytics` 并创建统一埋点封装 `frontend/src/utils/analytics.js`
- [x] **T-AN002** 增加埋点开关与用户同意机制
  - `frontend/.env.example` 增加 `VITE_ANALYTICS_ENABLED`
  - `frontend/src/utils/storage.js` 增加 `config.analytics.enabled`
  - `frontend/src/layout/settings-panel.js` 增加隐私设置开关
- [x] **T-AN003** 接入应用生命周期事件
  - `app_opened`, `lobby_viewed`, `mode_selected`, `game_selected`, `game_started`, `game_ended`
- [x] **T-AN004** 接入联机/网络可靠性事件
  - `room_create_attempted/succeeded`, `room_join_attempted/succeeded`
  - `network_disconnected`, `reconnect_attempted/succeeded/failed`
- [x] **T-AN005** 接入功能使用事件
  - `chat_panel_opened`, `chat_message_sent`, `query_panel_opened`

### AN2: 平台指标基线（Render + Supabase）⬜ 未来可选（需付费能力）

- [ ] **T-AN006** 配置 Render API 基线指标面板（请求数、P95 延迟、错误率）`[未来可选]`
  - 说明：当前不升级付费实例，暂缓执行；参考草案 `docs/prd/api/RENDER_MONITORING_BASELINE.md`
- [ ] **T-AN007** 配置 Render 告警阈值（错误率、延迟、服务不可用）`[未来可选]`
- [ ] **T-AN008** 建立 Supabase Realtime/Auth 健康检查清单与巡检流程 `[未来可选]`

### AN3: 验证与发布门禁

- [x] **T-AN009** 前端埋点回归验证（`npm --prefix frontend run build` + `npm --prefix frontend run test`）
- [ ] **T-AN010** 在 Vercel 生产环境验证自定义事件可见性与字段合规 `[未来可选]`
  - 说明：当前不升级付费能力，暂缓生产侧验证
  - 已完成仓库侧准备：事件字段白名单护栏 `frontend/src/utils/analytics-events.js`
  - 已完成测试：`frontend/src/utils/analytics-events.test.js`
  - 验收手册：`docs/prd/api/AN010_PROD_VALIDATION_RUNBOOK.md`
- [ ] **T-AN011** 建立每周 Analytics Review 模板（5 个 MVP 问题对照）

---

## 优先级说明

| 优先级 | 说明 |
|--------|------|
| P0 | 核心功能，已完成 |
| P1 | 卡牌数据填充 + Analytics MVP 落地，提升可用性与可观测性 |
| P2 | AI/MCP 接口，扩展功能 |

---

## 依赖关系

```
Phase A1~A5 (已完成)
    ↓
Phase A6: 卡牌数据
    ↓
Phase A7: AI/MCP (可并行开发)

Phase AN: Analytics MVP (可与 A6/A7 并行)
```
