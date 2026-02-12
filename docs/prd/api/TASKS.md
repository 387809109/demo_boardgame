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
| Phase AC4: AI 对话 Step 2 | ⬜ 待开发 | 规则知识库增强 (RAG-lite) |

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

- [ ] **T-A056** Werewolf P1 角色数据 (7 角色)
  - 守卫、白痴、长老、丘比特、猎魔人、狼王、狼美人

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

### MCP 工具接口

- [ ] **T-A063** 创建 MCP 服务 `services/mcp-service.js`
  - listTools() - 列出可用工具
  - executeTool(toolName, params) - 执行工具
  - validateParams(toolName, params) - 参数校验

- [ ] **T-A064** 创建 MCP 路由 `routes/v1/mcp.js`
  ```
  GET  /api/v1/mcp/tools
  POST /api/v1/mcp/tools/:toolName
  ```

- [ ] **T-A065** 定义 MCP 工具集
  - `get_game_rules` - 获取游戏规则
  - `get_card_info` - 获取卡牌信息
  - `analyze_game_state` - 分析游戏状态
  - `suggest_move` - 建议走法

- [ ] **T-A066** MCP 工具测试

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

### Step 2: 规则知识库增强 ⬜ 待开发

- [ ] **T-AC009** 创建 `services/rules-loader.js` 规则文档加载模块
- [ ] **T-AC010** chat-service 集成 rules-loader，system prompt 注入规则上下文
- [ ] **T-AC011** 新增 `GET /api/v1/chat/games` 端点 + POST 支持 gameId 参数
- [ ] **T-AC012** rules-loader 单元测试
- [ ] **T-AC013** 规则注入集成测试

---

## 优先级说明

| 优先级 | 说明 |
|--------|------|
| P0 | 核心功能，已完成 |
| P1 | 卡牌数据填充，提升 API 实用性 |
| P2 | AI/MCP 接口，扩展功能 |

---

## 依赖关系

```
Phase A1~A5 (已完成)
    ↓
Phase A6: 卡牌数据
    ↓
Phase A7: AI/MCP (可并行开发)
```
