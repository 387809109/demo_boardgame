# Cloud Backend Setup — Supabase

本项目的云端后端使用 Supabase 提供以下服务：

- **Supabase Auth** — 用户注册/登录 (邮箱 + 密码)
- **Supabase Realtime** — 游戏房间消息中继 (Channels + Presence + Broadcast)
- **Supabase PostgreSQL** — 用户资料存储

## 配置步骤

### 1. 创建 Supabase 项目

前往 [supabase.com](https://supabase.com) 创建一个项目（免费版即可）。

### 2. 获取 API 配置

在 Supabase 控制台 → **Settings** → **API** 中找到：

- **Project URL**: `https://your-project-id.supabase.co`
- **anon public key**: `eyJhbGci...` (以此开头的长字符串)

### 3. 配置前端环境变量

复制 `frontend/.env.example` 为 `frontend/.env` 并填入：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. 执行数据库迁移

在 Supabase 控制台 → **SQL Editor** 中，粘贴并执行：

```
cloud/migrations/001_create_profiles.sql
```

这会创建 `profiles` 表、RLS 策略和自动创建 profile 的触发器。

### 5. 启用 Realtime

在 Supabase 控制台 → **Database** → **Replication** 中：

确保 Realtime 功能已启用（默认已启用）。

## 免费版限制

| 资源 | 免费版上限 |
|------|-----------|
| 并发 Realtime 连接 | 200 |
| 数据库大小 | 500 MB |
| 月活用户 (Auth) | 50,000 |
| API 请求 | 无限 |

对于开发和小规模使用完全足够。

## 数据库迁移

按顺序执行以下迁移：

1. `migrations/001_create_profiles.sql` — 用户资料表
2. `migrations/002_create_card_data.sql` — 游戏/卡牌数据表

## API 服务 (Render)

项目包含一个 REST API 服务 (`api/`)，部署在 Render：

- **功能**: 游戏元数据查询、卡牌数据查询（AI/MCP 接口预留）
- **部署配置**: 仓库根目录 `render.yaml`
- **环境变量**: 需在 Render Dashboard 中设置
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `ALLOWED_ORIGINS`

详见 `api/.env.example`。

## 文件说明

```
cloud/
├── README.md                       # 本文件
└── migrations/
    ├── 001_create_profiles.sql     # 用户资料表迁移
    └── 002_create_card_data.sql    # 游戏/卡牌数据表迁移
```
