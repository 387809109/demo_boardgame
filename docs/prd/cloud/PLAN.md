# 云端后端开发计划 - Supabase Realtime + 用户系统

> 最后更新: 2026-02-05

---

## 概述

### 目标

在现有项目中新增一个基于 Supabase 的云端后端，作为现有本地 WebSocket 后端的**替代方案**（两者并存）：

1. **云端游戏服务器** — 使用 Supabase Realtime (Channels + Presence) 替代自建 WebSocket 服务器，支持公网访问
2. **用户系统** — 使用 Supabase Auth 实现注册/登录，Supabase PostgreSQL 存储用户资料
3. **可扩展** — 预留游戏统计、好友系统等未来功能的扩展空间

### 设计原则

- **现有代码零侵入** — 本地后端 (`backend/server/`) 和游戏逻辑 (UNO/狼人杀) 完全不动
- **接口兼容** — `CloudNetworkClient` 对外暴露与 `NetworkClient` 相同的事件接口
- **前端逻辑不变** — "后端仅中继消息，游戏逻辑在前端" 的核心原则不变

---

## 架构设计

### 技术选型对照

| 功能 | 本地模式 (现有) | 云端模式 (新增) |
|------|----------------|----------------|
| 消息中继 | Node.js + `ws` (port 7777) | Supabase Realtime Broadcast |
| 房间管理 | `RoomManager` (服务器端) | Supabase Realtime Presence (客户端) |
| 玩家列表 | 服务器维护 | Presence 自动同步 |
| 心跳 | PING/PONG (30s) | Supabase 内置 |
| 用户系统 | 无 | Supabase Auth |
| 数据持久化 | 无 | Supabase PostgreSQL |

### 消息映射

| 当前 WebSocket 协议 | Supabase Realtime 等效 |
|---------------------|----------------------|
| `ws.connect(url)` | `supabase.channel(roomId).subscribe()` |
| `ws.send(JSON.stringify(msg))` | `channel.send({ type: 'broadcast', event, payload })` |
| `ws.onmessage` | `channel.on('broadcast', { event }, callback)` |
| 服务器 PLAYER_JOINED 广播 | Presence `sync` / `join` 事件 |
| 服务器 PLAYER_LEFT 广播 | Presence `leave` 事件 |
| 服务器 GAME_STATE_UPDATE 广播 | Broadcast event (self=false, 默认行为) |
| PING/PONG 心跳 | Supabase 自动管理连接 |

### 关键设计决策

**1. 房间管理由客户端负责**

Supabase Realtime Channel 没有服务端房间逻辑。`CloudNetworkClient` 内部处理：
- 通过 Presence 追踪房间内玩家列表
- 第一个加入 Channel 的玩家成为 Host（存入 Presence metadata）
- 玩家人数上限由 Host 客户端验证
- Presence `sync` 事件触发时，构造与 `PLAYER_JOINED`/`PLAYER_LEFT` 格式一致的数据推送给上层

**2. 消息自发自收策略**

| 消息类型 | 当前行为 | 云端策略 |
|---------|---------|---------|
| PLAYER_JOINED/LEFT | 服务器广播给所有人 | Presence 自动同步（包含自己） |
| GAME_STATE_UPDATE | 广播给除发送者外所有人 | Broadcast self=false（默认） |
| CHAT_MESSAGE | 广播给所有人（含发送者） | 本地立即显示 + Broadcast self=false |
| START_GAME | 广播给所有人 | Broadcast self=true（发送者也需要收到） |

**3. Host 权限**

由于没有服务端验证，Host 权限完全由客户端约定：
- Presence metadata 中标记 `isHost: true`
- 仅 Host 客户端发出 START_GAME、AI_PLAYER_UPDATE 等消息
- 其他客户端收到后检查发送者是否为 Host（可选验证）

---

## 新增目录结构

```
demo_boardgame/
├── cloud/                              # 云端配置（新增）
│   ├── README.md                       # Supabase 项目配置指南
│   └── migrations/                     # 数据库迁移
│       └── 001_create_profiles.sql     # 用户资料表
│
├── frontend/
│   ├── src/
│   │   ├── cloud/                      # 云端模块（新增）
│   │   │   ├── supabase-client.js      # Supabase 客户端初始化
│   │   │   ├── cloud-network.js        # CloudNetworkClient
│   │   │   └── auth.js                 # 认证服务
│   │   ├── layout/
│   │   │   └── auth-page.js            # 登录/注册页面（新增）
│   │   ├── game/
│   │   │   └── network.js              # 不修改
│   │   └── main.js                     # 修改：增加云端/本地模式切换
│   ├── .env.example                    # 环境变量模板（新增）
│   └── package.json                    # 新增 @supabase/supabase-js
│
├── backend/server/                     # 不修改
└── docs/
    └── prd/
        └── cloud/                      # 云端文档（新增）
            ├── PLAN.md                 # 本文件
            └── TASKS.md               # 任务清单
```

---

## 数据库设计

### profiles 表

```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 所有人可读
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

-- 仅本人可改
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 未来扩展（本期不实现，仅预留）

```sql
-- 游戏统计表
-- CREATE TABLE public.game_stats (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID REFERENCES public.profiles(id),
--   game_type TEXT NOT NULL,
--   result TEXT, -- 'win' | 'lose' | 'draw'
--   score INTEGER DEFAULT 0,
--   played_at TIMESTAMPTZ DEFAULT now()
-- );

-- 好友关系表
-- CREATE TABLE public.friendships (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID REFERENCES public.profiles(id),
--   friend_id UUID REFERENCES public.profiles(id),
--   status TEXT DEFAULT 'pending', -- 'pending' | 'accepted'
--   created_at TIMESTAMPTZ DEFAULT now()
-- );
```

---

## 实现阶段

### Phase C1: 基础设施 (P0)

**目标**: Supabase 项目配置、前端依赖、客户端初始化

| 任务 ID | 描述 | 依赖 |
|---------|------|------|
| T-C001 | 创建 `cloud/` 目录结构和 README | — |
| T-C002 | 创建数据库迁移文件 `001_create_profiles.sql` | — |
| T-C003 | 前端添加 `@supabase/supabase-js` 依赖 | — |
| T-C004 | 创建 `.env.example` 和 Vite 环境变量配置 | T-C003 |
| T-C005 | 创建 `cloud/supabase-client.js` — Supabase 客户端初始化 | T-C003, T-C004 |

### Phase C2: 用户认证 (P0)

**目标**: 邮箱注册/登录、会话管理、认证 UI

| 任务 ID | 描述 | 依赖 |
|---------|------|------|
| T-C010 | 创建 `cloud/auth.js` — AuthService 类 | T-C005 |
| T-C011 | 创建 `layout/auth-page.js` — 登录/注册页面 UI | T-C010 |
| T-C012 | main.js 集成认证流程（云端模式需登录） | T-C010, T-C011 |
| T-C013 | AuthService 单元测试 | T-C010 |

### Phase C3: CloudNetworkClient (P0)

**目标**: 实现 Supabase Realtime 网络客户端，接口兼容 NetworkClient

| 任务 ID | 描述 | 依赖 |
|---------|------|------|
| T-C020 | 创建 `cloud/cloud-network.js` — CloudNetworkClient 基础结构 | T-C005 |
| T-C021 | 实现 Channel 管理（subscribe/unsubscribe） | T-C020 |
| T-C022 | 实现 Presence 房间管理（join/leave/player list sync） | T-C021 |
| T-C023 | 实现 Broadcast 消息收发（send/onMessage） | T-C021 |
| T-C024 | 实现 Host 判定和权限逻辑 | T-C022 |
| T-C025 | 实现 GAME_ACTION/START_GAME/CHAT 等完整消息类型 | T-C023, T-C024 |
| T-C026 | CloudNetworkClient 单元测试 | T-C025 |

### Phase C4: 前端集成 (P1)

**目标**: 大厅 UI 改造，云端/本地模式切换

| 任务 ID | 描述 | 依赖 |
|---------|------|------|
| T-C030 | game-lobby.js 增加云端/本地模式切换 UI | T-C025, T-C012 |
| T-C031 | 创建/加入房间对话框适配云端模式 | T-C030 |
| T-C032 | main.js 集成 CloudNetworkClient（云端模式下替代 NetworkClient） | T-C025, T-C030 |
| T-C033 | 大厅增加用户信息显示（昵称、登录/登出按钮） | T-C012 |
| T-C034 | 集成测试（完整云端游戏流程） | T-C032 |

### Phase C5: 文档更新 (P1)

**目标**: 更新项目文档反映云端功能

| 任务 ID | 描述 | 依赖 |
|---------|------|------|
| T-C040 | 更新 CLAUDE.md — 架构图、目录结构、云端模块说明 | T-C032 |
| T-C041 | 更新 PROGRESS.md — 增加云端模块进度 | T-C032 |
| T-C042 | 创建 `docs/prd/cloud/TASKS.md` — 详细任务清单 | — |
| T-C043 | 更新 `docs/PROTOCOL.md` — 增加云端协议说明 | T-C025 |

---

## CloudNetworkClient 接口设计

```javascript
/**
 * CloudNetworkClient — Supabase Realtime 网络客户端
 * 对外接口与 NetworkClient 保持一致
 */
class CloudNetworkClient extends EventEmitter {
  constructor(supabaseClient)

  // === 连接管理 ===
  async connect()                     // 获取 Auth 用户、标记已连接
  disconnect()                        // 退出 channel、清理状态
  isConnected()                       // 返回 boolean

  // === 房间操作 ===
  joinRoom(roomId, nickname, gameType) // subscribe channel + track presence
  leaveRoom()                         // untrack + unsubscribe

  // === 消息发送 ===
  send(type, data)                    // channel.send broadcast
  startGame(gameType, gameConfig)     // send('START_GAME', ...)
  sendGameAction(actionType, data)    // send('GAME_ACTION', ...)
  sendChat(message, isPublic)         // send('CHAT_MESSAGE', ...)

  // === 消息接收 ===
  onMessage(messageType, handler)     // 注册消息处理器，返回 unsubscribe fn

  // === 状态 ===
  playerId                            // 来自 Supabase Auth user.id
  connected                           // boolean
  latency                             // 0（Supabase 不提供延迟数据）
  getLatency()                        // 返回 0
}

// 事件: 'connected', 'disconnected', 'error', 'message',
//       'message:PLAYER_JOINED', 'message:GAME_STATE_UPDATE', ...
```

### Presence → 协议消息转换

CloudNetworkClient 内部将 Supabase Presence 事件转换为现有协议格式：

```javascript
// Presence join → 构造 PLAYER_JOINED
channel.on('presence', { event: 'join' }, ({ newPresences }) => {
  const players = this._getPlayerList(); // 从 presenceState() 获取
  const joined = newPresences[0];
  this._dispatchMessage('PLAYER_JOINED', {
    nickname: joined.nickname,
    playerCount: players.length,
    players
  });
});

// Presence leave → 构造 PLAYER_LEFT
channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
  const players = this._getPlayerList();
  this._dispatchMessage('PLAYER_LEFT', {
    reason: 'disconnected',
    playerCount: players.length,
    players
  });
});
```

---

## AuthService 接口设计

```javascript
/**
 * AuthService — Supabase 认证服务
 */
class AuthService {
  constructor(supabaseClient)

  // === 认证操作 ===
  async register(email, password, nickname)  // signUp + 设置 nickname
  async login(email, password)               // signInWithPassword
  async logout()                             // signOut
  async getSession()                         // 获取当前会话
  async getUser()                            // 获取当前用户 + profile

  // === 资料管理 ===
  async updateProfile({ nickname, avatarUrl }) // 更新 profiles 表

  // === 会话监听 ===
  onAuthStateChange(callback)                // 监听登录/登出状态变化

  // === 状态 ===
  isLoggedIn()                               // boolean
  getCurrentUser()                           // 缓存的用户信息
}
```

---

## 前端用户流程

```
应用启动
  │
  ├─ 显示大厅（默认本地模式）
  │    ├─ [单机游戏] → 直接开始（无变化）
  │    ├─ [创建房间 / 加入房间] → 本地 WebSocket 流程（无变化）
  │    │
  │    └─ [切换到云端模式]
  │         │
  │         ├─ 未登录 → 显示登录/注册页面
  │         │    ├─ [注册] → 输入邮箱/密码/昵称 → 注册成功 → 返回大厅(云端)
  │         │    └─ [登录] → 输入邮箱/密码 → 登录成功 → 返回大厅(云端)
  │         │
  │         └─ 已登录 → 大厅显示用户信息 + 云端按钮
  │              ├─ [创建房间] → 输入房间ID → CloudNetworkClient 加入 → 等待大厅
  │              └─ [加入房间] → 输入房间ID → CloudNetworkClient 加入 → 等待大厅
  │
  └─ 等待大厅 → 开始游戏 → 游戏流程（完全复用现有逻辑）
```

---

## 风险与注意事项

1. **Supabase Realtime 连接数限制** — 免费版有 200 并发连接限制，需在文档中说明
2. **无服务端验证** — 云端模式下没有服务器验证消息发送者权限，依赖客户端约定（与当前本地后端"仅转发"设计一致）
3. **Presence 延迟** — Presence 同步有约 100-500ms 延迟，可能导致玩家列表短暂不一致
4. **Supabase 停机** — 依赖第三方服务，需考虑连接失败的降级提示
5. **环境变量安全** — Supabase anon key 是公开的（设计如此），但需配合 RLS 策略保护数据

---

## 验收标准

### 功能验收

- [ ] 用户可通过邮箱注册新账号
- [ ] 用户可通过邮箱密码登录
- [ ] 大厅可切换本地/云端模式
- [ ] 云端模式下可创建房间并等待其他玩家加入
- [ ] 云端模式下可加入已有房间
- [ ] 云端模式下完整游戏流程正常（以 UNO 为例）
- [ ] 本地模式功能完全不受影响

### 代码质量

- [ ] CloudNetworkClient 与 NetworkClient 接口一致
- [ ] 所有新增模块有 JSDoc 注释
- [ ] 遵循现有代码规范 (ES6 modules, camelCase, etc.)
- [ ] 新增文件不超过 500 行

### 测试

- [ ] AuthService 单元测试覆盖率 > 80%
- [ ] CloudNetworkClient 单元测试覆盖率 > 80%
- [ ] 手动集成测试通过（两个浏览器完成一局 UNO）
