# AI 规则问答对话 - PRD

> 版本: v1.1.0 | 最后更新: 2026-02-12

---

## 1. 概述

### 1.1 目标

在现有 API 服务中新增 **AI 规则问答** 功能，让用户可以通过对话形式向 AI 询问桌游规则问题。通过 OpenAI API 实现多轮对话。

### 1.2 分阶段范围

**Step 1（本次实现）— AI 对话核心：**
- 单轮 & 多轮对话（带上下文）
- 对话历史管理（创建、查询、清除）
- 基础限流与 Token 用量控制
- 通用桌游规则助手（基于模型自身知识）

**Step 2（后续）— 规则知识库增强：**
- 基于已有规则文档的检索增强生成 (RAG-lite)
- `rules-loader.js` 加载 `docs/games/*/RULES.md` 和 `frontend/public/rules/*.html`
- 支持按游戏筛选问答范围（gameId 参数生效）
- `GET /api/v1/chat/games` 端点返回实际规则加载状态

**不在计划内：**
- 卡牌数据查询端点 (T-A050~T-A058)
- 游戏状态分析 / 走法建议 (T-A060~T-A062)
- MCP 工具接口 (T-A063~T-A066)
- 前端 UI（仅提供 API，前端后续对接）

### 1.3 技术选型

| 项目 | 选择 | 说明 |
|------|------|------|
| LLM Provider | OpenAI API | gpt-4o-mini 为默认模型，兼顾质量与成本 |
| SDK | `openai` (npm) | OpenAI 官方 Node.js SDK |
| 对话存储 | 内存 (Map) | MVP 阶段无持久化，服务重启后清空 |
| 认证 | 可选 (Supabase JWT) | 已登录用户绑定 userId，匿名用户使用临时 sessionId |

---

## 2. 架构设计

### 2.1 模块关系 (Step 1)

```
Client (前端/curl/Postman)
    │
    ▼  POST /api/v1/chat
┌──────────────────────────────────────────────────┐
│  routes/v1/chat.js                                │
│  - 请求校验                                       │
│  - 调用 service                                   │
│  - 格式化响应                                      │
└──────────┬───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│  services/chat-service.js                         │
│  - 会话管理 (创建/获取/清除)                        │
│  - 构建 system prompt                             │
│  - 维护对话历史                                     │
│  - 调用 OpenAI API                                 │
│  - Token 用量统计                                  │
└──────────┬───────────────────────────────────────┘
           │
           ▼
      ┌─────────┐
      │ OpenAI  │
      │  API    │
      └─────────┘
```

> **Step 2 扩展**：在 chat-service 与 OpenAI 之间插入 `rules-loader.js`，将规则文档注入 system prompt。

### 2.2 新增文件 (Step 1)

```
api/
├── services/
│   └── chat-service.js       # 对话服务（核心逻辑）
├── routes/v1/
│   └── chat.js               # 对话路由
└── tests/
    ├── services/
    │   └── chat-service.test.js
    └── routes/v1/
        └── chat.test.js
```

### 2.3 修改文件

| 文件 | 修改内容 |
|------|----------|
| `api/config.js` | 新增 `openai` 配置区块 |
| `api/app.js` | 挂载 `/api/v1/chat` 路由 |
| `api/routes/v1/index.js` | 注册 chat 路由 |
| `api/.env.example` | 新增 `OPENAI_API_KEY` 等环境变量 |

---

## 3. API 端点设计

### 3.1 发送消息 / 创建对话

```
POST /api/v1/chat
```

**请求体：**

```json
{
  "message": "UNO 中 +4 牌可以叠加吗？",
  "sessionId": "sess_abc123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 用户消息，1~1000 字符 |
| `sessionId` | string | 否 | 会话 ID；不传则创建新会话 |

> **Step 2 新增字段**：`gameId` (限定问答范围)、`options.language` (回复语言)

**响应 (200)：**

```json
{
  "data": {
    "sessionId": "sess_abc123",
    "reply": "在标准 UNO 规则中，+4 万能牌默认不能叠加。但很多玩家采用的「叠加」house rule...",
    "usage": {
      "promptTokens": 120,
      "completionTokens": 150,
      "totalTokens": 270
    }
  }
}
```

**错误响应：**

| 状态码 | code | 场景 |
|--------|------|------|
| 400 | `INVALID_MESSAGE` | message 为空或超过长度限制 |
| 404 | `SESSION_NOT_FOUND` | sessionId 不存在或已过期 |
| 429 | `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| 502 | `AI_SERVICE_ERROR` | OpenAI API 调用失败 |
| 503 | `AI_NOT_CONFIGURED` | 未配置 OpenAI API Key |

### 3.2 获取对话历史

```
GET /api/v1/chat/:sessionId
```

**响应 (200)：**

```json
{
  "data": {
    "sessionId": "sess_abc123",
    "messages": [
      { "role": "user", "content": "UNO 中 +4 牌可以叠加吗？", "timestamp": 1707700000000 },
      { "role": "assistant", "content": "在标准 UNO 规则中...", "timestamp": 1707700001500 }
    ],
    "createdAt": 1707700000000,
    "messageCount": 2
  }
}
```

### 3.3 删除对话

```
DELETE /api/v1/chat/:sessionId
```

**响应 (200)：**

```json
{
  "data": { "deleted": true }
}
```

> **Step 2 新增端点**：`GET /api/v1/chat/games` — 返回已加载规则的游戏列表

---

## 4. 核心模块设计

### 4.1 chat-service.js — 对话服务

**职责：** 管理对话会话、构建提示词、调用 OpenAI API。

```javascript
/**
 * @typedef {Object} ChatSession
 * @property {string} sessionId - 会话唯一 ID
 * @property {Array<{role: string, content: string, timestamp: number}>} messages - 对话历史
 * @property {number} createdAt - 创建时间戳
 * @property {number} lastActiveAt - 最后活跃时间戳
 * @property {number} totalTokens - 累计 token 用量
 */

// 公开方法
sendMessage(message, sessionId?)  // 发送消息并获取回复
getSession(sessionId)             // 获取会话信息
deleteSession(sessionId)          // 删除会话
```

**System Prompt 设计 (Step 1)：**

```
你是一个桌游规则助手，专门回答用户关于桌游规则的问题。

## 你的能力
- 解答游戏规则疑问（UNO、狼人杀等常见桌游）
- 解释特殊情况的处理方式
- 比较不同规则变体的区别
- 用通俗语言解释复杂规则

## 你的约束
- 只回答与桌游规则相关的问题，拒绝无关话题
- 如果不确定某条规则，如实告知而非编造
- 使用中文回答
```

> **Step 2 扩展**：system prompt 末尾追加 `## 规则知识库\n{rules_context}`，注入项目内规则文档。

**对话历史管理：**
- 使用 `Map<sessionId, ChatSession>` 存储
- 会话超时: 30 分钟无活动自动清除（定时器扫描）
- 最大历史轮数: 20 轮（超出后滚动裁剪最早消息，保留 system prompt）
- 单会话最大 token: 50,000（超出后提示用户新建会话）

**OpenAI 调用参数：**

| 参数 | 值 | 说明 |
|------|------|------|
| `model` | 可配置，默认 `gpt-4o-mini` | 性价比模型 |
| `temperature` | `0.3` | 规则问答偏向确定性 |
| `max_tokens` | `1000` | 单次回复上限 |
| `messages` | `[system, ...history, user]` | 完整对话上下文 |

### 4.2 chat.js — 路由层

**职责：** 请求校验、调用 service、格式化响应。

```javascript
// 路由定义 (Step 1)
router.post('/',            chatRateLimiter, handleSendMessage)
router.get('/:sessionId',   handleGetSession)
router.delete('/:sessionId', handleDeleteSession)
```

**限流策略（独立于全局限流）：**

| 端点 | 限制 | 窗口 |
|------|------|------|
| `POST /chat` | 20 次 | 1 分钟 |
| `GET /chat/*` | 60 次 | 1 分钟 |

---

## 5. 配置与环境变量

### 5.1 新增环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENAI_API_KEY` | 是 | - | OpenAI API 密钥 |
| `OPENAI_MODEL` | 否 | `gpt-4o-mini` | 使用的模型 |
| `OPENAI_MAX_TOKENS` | 否 | `1000` | 单次回复最大 token |
| `OPENAI_TEMPERATURE` | 否 | `0.3` | 生成温度 |
| `CHAT_SESSION_TTL_MS` | 否 | `1800000` | 会话超时时间 (30 分钟) |
| `CHAT_MAX_HISTORY` | 否 | `20` | 最大对话轮数 |
| `CHAT_RATE_LIMIT` | 否 | `20` | 每分钟最大消息数 |

### 5.2 config.js 新增区块

```javascript
openai: {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.3,
},
chat: {
  sessionTtlMs: parseInt(process.env.CHAT_SESSION_TTL_MS) || 30 * 60 * 1000,
  maxHistory: parseInt(process.env.CHAT_MAX_HISTORY) || 20,
  rateLimit: parseInt(process.env.CHAT_RATE_LIMIT) || 20,
}
```

---

## 6. 错误处理

### 6.1 错误码定义

| 错误码 | HTTP | 触发条件 |
|--------|------|----------|
| `AI_NOT_CONFIGURED` | 503 | `OPENAI_API_KEY` 未配置 |
| `AI_SERVICE_ERROR` | 502 | OpenAI API 返回错误或超时 |
| `INVALID_MESSAGE` | 400 | message 为空、类型不对、超长 |
| `SESSION_NOT_FOUND` | 404 | 会话不存在或已过期 |
| `SESSION_TOKEN_LIMIT` | 400 | 会话累计 token 超限 |
| `RATE_LIMIT_EXCEEDED` | 429 | 超过对话限流 |

> **Step 2 新增**：`UNKNOWN_GAME` (400) — gameId 不在已知游戏列表中

### 6.2 OpenAI 错误映射

| OpenAI 错误 | 映射到 | 处理 |
|-------------|--------|------|
| 401 Invalid API key | `AI_NOT_CONFIGURED` (503) | 日志告警，提示管理员检查 Key |
| 429 Rate limit | `AI_SERVICE_ERROR` (502) | 返回友好提示，建议稍后重试 |
| 500/503 Server error | `AI_SERVICE_ERROR` (502) | 日志记录，返回重试提示 |
| Timeout (30s) | `AI_SERVICE_ERROR` (502) | 超时中断，返回重试提示 |

---

## 7. 安全考量

### 7.1 API Key 保护
- `OPENAI_API_KEY` 仅存于服务器环境变量，**绝不**暴露给客户端
- 日志中屏蔽 API Key（仅打印前 8 位 + `***`）

### 7.2 输入安全
- 消息长度限制: 1~1000 字符
- 过滤 HTML 标签和脚本注入
- System prompt 注入防护: 用户消息仅放入 user role

### 7.3 成本控制
- 默认使用 `gpt-4o-mini` (低成本模型)
- 单次回复 max_tokens 上限 1000
- 单会话 token 上限 50,000
- 独立限流: 20 次/分钟
- 会话自动过期清除

### 7.4 认证策略
- **当前阶段**: 对话端点不强制认证，使用独立限流控制
- 已登录用户（请求头携带 Bearer token）可绑定 userId，便于后续统计
- **后续可选**: 如需要，可切换为必须认证

---

## 8. 任务清单

### Step 1: AI 对话核心

#### Phase AC1: 基础设施 (2 tasks)

| ID | 描述 | 依赖 | 预估文件 |
|----|------|------|----------|
| T-AC001 | `config.js` 新增 openai/chat 配置区块 + `.env.example` 更新 | - | config.js, .env.example |
| T-AC002 | 安装 `openai` npm 依赖 | - | package.json |

#### Phase AC2: 核心服务 (2 tasks)

| ID | 描述 | 依赖 | 预估文件 |
|----|------|------|----------|
| T-AC003 | 创建 `services/chat-service.js` 对话服务 | T-AC001~002 | services/chat-service.js |
| T-AC004 | 创建 `routes/v1/chat.js` 对话路由 + 注册到 app | T-AC003 | routes/v1/chat.js, routes/v1/index.js, app.js |

#### Phase AC3: 测试 (2 tasks)

| ID | 描述 | 依赖 | 预估文件 |
|----|------|------|----------|
| T-AC005 | chat-service 单元测试 (mock OpenAI) | T-AC003 | tests/services/chat-service.test.js |
| T-AC006 | chat 路由集成测试 | T-AC004 | tests/routes/v1/chat.test.js |

#### Phase AC4: 文档更新 (2 tasks)

| ID | 描述 | 依赖 | 预估文件 |
|----|------|------|----------|
| T-AC007 | 更新 `docs/prd/api/TASKS.md` 和 `PROGRESS.md` | T-AC004 | TASKS.md, PROGRESS.md |
| T-AC008 | 更新 `docs/prd/api/README.md` 端点文档 | T-AC004 | README.md |

#### Step 1 依赖关系

```
T-AC001 ─┬→ T-AC003 → T-AC004 → T-AC006
T-AC002 ─┘     │                    │
            T-AC005            T-AC007, T-AC008
```

---

### Step 2: 规则知识库增强（后续实现）

| ID | 描述 | 依赖 | 预估文件 |
|----|------|------|----------|
| T-AC009 | 创建 `services/rules-loader.js` 规则文档加载模块 | - | services/rules-loader.js |
| T-AC010 | chat-service 集成 rules-loader，system prompt 注入规则上下文 | T-AC009 | services/chat-service.js |
| T-AC011 | 新增 `GET /api/v1/chat/games` 端点 + POST 支持 gameId 参数 | T-AC010 | routes/v1/chat.js |
| T-AC012 | rules-loader 单元测试 | T-AC009 | tests/services/rules-loader.test.js |
| T-AC013 | 规则注入集成测试 | T-AC011 | tests/routes/v1/chat.test.js |

---

## 9. 后续扩展方向

| 方向 | 阶段 | 说明 |
|------|------|------|
| 规则知识库增强 | **Step 2** | rules-loader 加载项目规则文档注入 system prompt (RAG-lite) |
| 前端对话 UI | Step 3 | 嵌入游戏大厅或棋盘的规则问答聊天窗口 |
| 对话持久化 | 远期 | 将会话存储到 Supabase PostgreSQL，支持跨设备查看历史 |
| 流式响应 | 远期 | SSE (Server-Sent Events) 实时流式输出 AI 回复 |
| 向量检索 | 远期 | 规则文档量增大后引入 embedding + 向量搜索 |
| 多 Provider | 远期 | 支持切换 Claude / Gemini 等 LLM |
| 走法建议 | 远期 | 结合游戏状态给出策略建议 (T-A060~T-A062) |
| MCP 工具 | 远期 | 标准化工具接口 (T-A063~T-A066) |
