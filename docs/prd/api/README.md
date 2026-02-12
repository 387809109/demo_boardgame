# API 服务 - Render REST API

## 概述

独立的 REST API 服务，部署在 Render，连接 Supabase 数据库。提供游戏/卡牌数据查询功能，并预留 AI/MCP 接口。

## 技术栈

| 项目 | 选择 | 说明 |
|------|------|------|
| 框架 | Express.js | 与现有 backend 技术栈一致 |
| 数据库 | Supabase PostgreSQL | 复用现有云端基础设施 |
| 认证 | Supabase JWT | 复用前端已有 Auth 体系 |
| 部署 | Render Web Service | 免费版足够使用 |
| 测试 | Jest + supertest | 与现有测试框架一致 |

## 目录结构

```
api/
├── package.json
├── .env.example
├── jest.config.js
├── index.js                 # 服务器入口 (listen + graceful shutdown)
├── app.js                   # Express app (与 index.js 分离，方便测试)
├── config.js                # 集中配置 (env vars)
├── middleware/
│   ├── auth.js              # Supabase JWT 验证
│   ├── cors.js              # CORS 配置
│   ├── error-handler.js     # 统一错误处理
│   └── rate-limiter.js      # 限流
├── routes/
│   ├── index.js             # 路由聚合
│   └── v1/
│       ├── index.js         # v1 路由聚合
│       ├── health.js        # GET /api/v1/health
│       ├── games.js         # 游戏元数据路由
│       ├── cards.js         # 卡牌数据路由
│       └── chat.js          # AI 规则问答路由
├── services/
│   ├── supabase.js          # 服务端 Supabase 客户端
│   ├── card-service.js      # 卡牌查询逻辑
│   ├── game-service.js      # 游戏元数据逻辑
│   └── chat-service.js      # AI 对话服务 (OpenAI)
├── utils/
│   ├── logger.js            # 日志工具
│   ├── validator.js         # 请求校验
│   └── errors.js            # 自定义错误类
├── stubs/
│   └── ai-service.js        # AI/MCP 接口占位
└── tests/                   # 单元测试
```

## API 端点

### 公开端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/games` | 游戏列表 (?category=&search=) |
| GET | `/api/v1/games/:gameId` | 游戏详情 |
| GET | `/api/v1/games/:gameId/categories` | 卡牌类别列表 |
| GET | `/api/v1/games/:gameId/cards` | 卡牌列表 (?category=&search=&limit=&offset=) |
| GET | `/api/v1/games/:gameId/cards/:cardId` | 卡牌详情 |
| POST | `/api/v1/chat` | AI 规则问答 (发送消息/创建会话) |
| GET | `/api/v1/chat/:sessionId` | 获取对话历史 |
| DELETE | `/api/v1/chat/:sessionId` | 删除对话会话 |

### 需认证端点 (Supabase JWT)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/games` | 创建游戏 |
| PUT | `/api/v1/games/:gameId` | 更新游戏 |
| POST | `/api/v1/games/:gameId/categories` | 创建类别 |
| POST | `/api/v1/games/:gameId/cards` | 创建卡牌 |
| PUT | `/api/v1/games/:gameId/cards/:cardId` | 更新卡牌 |

### 预留端点 (AI/MCP)

| 方法 | 路径 | 描述 | 状态 |
|------|------|------|------|
| POST | `/api/v1/ai/analyze` | AI 游戏状态分析 | 待实现 |
| POST | `/api/v1/ai/suggest` | AI 走法建议 | 待实现 |
| POST | `/api/v1/mcp/tools/:toolName` | MCP 工具调用 | 待实现 |

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `PORT` | 服务端口 (Render 自动分配) | 否 |
| `NODE_ENV` | 运行环境 | 否 |
| `SUPABASE_URL` | Supabase 项目 URL | 是 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 密钥 | 是 |
| `SUPABASE_ANON_KEY` | Supabase anon 密钥 | 是 |
| `ALLOWED_ORIGINS` | 允许的 CORS 域名 (逗号分隔) | 是 |
| `OPENAI_API_KEY` | OpenAI API 密钥 (AI 对话功能) | 是* |
| `OPENAI_MODEL` | 使用的模型 (默认 gpt-4o-mini) | 否 |
| `OPENAI_MAX_TOKENS` | 单次回复最大 token (默认 1000) | 否 |
| `OPENAI_TEMPERATURE` | 生成温度 (默认 0.3) | 否 |
| `CHAT_SESSION_TTL_MS` | 会话超时 ms (默认 1800000) | 否 |
| `CHAT_MAX_HISTORY` | 最大对话轮数 (默认 20) | 否 |
| `CHAT_RATE_LIMIT` | 每分钟最大消息数 (默认 20) | 否 |

> *AI 对话功能需配置 `OPENAI_API_KEY`，未配置时该端点返回 503

## 数据库表

详见 `cloud/migrations/002_create_card_data.sql`

- `games` - 游戏元数据
- `card_categories` - 卡牌类别
- `cards` - 卡牌数据

## 部署

1. 推送代码到 GitHub
2. Render Dashboard → New → Web Service
3. 设置 Root Directory: `api`
4. 设置环境变量
5. 部署完成后访问 `/api/v1/health` 验证

详见 `render.yaml` 配置。
