# 云端后端开发任务清单 - AI Coding 专用

> 本文档为 AI 编程助手提供结构化的任务清单，按优先级和依赖关系排列。
> 详细设计方案见: `docs/prd/cloud/PLAN.md`

---

## 当前进度概览

| Phase | 进度 | 说明 |
|-------|------|------|
| Phase C1: 基础设施 | ✅ 完成 | Supabase 配置、依赖、客户端初始化 |
| Phase C2: 用户认证 | ✅ 完成 | 注册/登录、会话管理、UI（含单元测试） |
| Phase C3: CloudNetworkClient | ✅ 完成 | Realtime 网络客户端（含单元测试） |
| Phase C4: 前端集成 | ✅ 完成 | 大厅改造、模式切换、手动测试通过 |
| Phase C5: 文档更新 | ✅ 完成 | CLAUDE.md / PROGRESS.md / TASKS.md / PROTOCOL.md 已更新 |
| Phase C6: 断线重连支持 | ✅ 完成 | Host-Relayed 方案已落地（T-C044） |

---

## Phase C1: 基础设施 (P0)

### C1.1 云端项目配置

- [x] **T-C001** 创建 `cloud/` 目录结构和 README
  ```
  cloud/
  ├── README.md                    # Supabase 项目配置指南
  └── migrations/
      └── 001_create_profiles.sql  # 数据库迁移
  ```
  - README 内容: Supabase 项目创建步骤、环境变量获取方法、数据库迁移执行方法

- [x] **T-C002** 创建数据库迁移 `cloud/migrations/001_create_profiles.sql`
  ```sql
  -- profiles 表 (扩展 auth.users)
  CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nickname TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- RLS 策略
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
  CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

  -- 注册自动创建 profile 触发器
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

---

### C1.2 前端依赖和配置

- [x] **T-C003** 前端添加 Supabase 依赖
  ```bash
  cd frontend && npm install @supabase/supabase-js
  ```

- [x] **T-C004** 创建环境变量配置
  - 创建 `frontend/.env.example`:
    ```
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key
    ```
  - 确认 Vite 可通过 `import.meta.env.VITE_SUPABASE_URL` 访问

- [x] **T-C005** 创建 `frontend/src/cloud/supabase-client.js`
  ```javascript
  import { createClient } from '@supabase/supabase-js';

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  /** @type {import('@supabase/supabase-js').SupabaseClient|null} */
  let supabase = null;

  /**
   * 获取 Supabase 客户端单例
   * @returns {import('@supabase/supabase-js').SupabaseClient}
   */
  export function getSupabaseClient() {
    if (!supabase) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
      }
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabase;
  }

  /**
   * 检查 Supabase 是否已配置
   * @returns {boolean}
   */
  export function isCloudAvailable() {
    return !!(supabaseUrl && supabaseAnonKey);
  }
  ```
  - 依赖: T-C003, T-C004

---

## Phase C2: 用户认证 (P0)

### C2.1 认证服务

- [x] **T-C010** 创建 `frontend/src/cloud/auth.js`
  ```javascript
  /**
   * AuthService — Supabase 认证服务
   */
  export class AuthService {
    constructor(supabaseClient)

    // 注册 (邮箱 + 密码 + 昵称)
    async register(email, password, nickname)
    // 返回: { user, error }

    // 登录
    async login(email, password)
    // 返回: { user, error }

    // 登出
    async logout()

    // 获取当前会话
    async getSession()
    // 返回: { session, error }

    // 获取当前用户（含 profile）
    async getUser()
    // 返回: { user, profile, error }

    // 更新用户资料
    async updateProfile({ nickname, avatarUrl })
    // 返回: { profile, error }

    // 监听认证状态变化
    onAuthStateChange(callback)
    // callback: (event, session) => void
    // 返回: unsubscribe function

    // 当前是否已登录
    isLoggedIn()
    // 返回: boolean

    // 获取缓存的用户信息
    getCurrentUser()
    // 返回: { id, email, nickname } | null
  }
  ```
  - 依赖: T-C005
  - `register()` 在 Supabase signUp 时通过 `data.nickname` 传递昵称
  - `getUser()` 联合查询 `auth.users` + `profiles` 表
  - 在构造函数中设置 `onAuthStateChange` 自动更新缓存

---

### C2.2 认证 UI

- [x] **T-C011** 创建 `frontend/src/layout/auth-page.js`
  ```javascript
  /**
   * AuthPage — 登录/注册页面
   */
  export class AuthPage {
    constructor(options)
    // options: { onLoginSuccess, onBack }

    mount(container)
    unmount()
    getElement()
  }
  ```
  - 两个 Tab: 登录 / 注册
  - 登录表单: 邮箱、密码、登录按钮
  - 注册表单: 邮箱、密码、确认密码、昵称、注册按钮
  - 表单验证: 邮箱格式、密码长度 (≥6)、密码一致性、昵称非空
  - 错误提示: 使用现有 `showToast()` / `showNotification()`
  - 样式: 使用现有 CSS variables，居中卡片布局
  - 底部"返回"按钮回到大厅

- [x] **T-C012** main.js 集成认证流程
  - 新增 `showAuthPage()` 方法
  - 云端模式下检查登录状态，未登录则跳转 AuthPage
  - 登录成功后用 Supabase user.id 作为 playerId
  - 登出后返回大厅（本地模式）
  - 依赖: T-C010, T-C011

---

### C2.3 认证测试

- [x] **T-C013** AuthService 单元测试 (27 tests)
  - 测试 register (成功/失败)
  - 测试 login (成功/失败)
  - 测试 logout
  - 测试 getUser (含 profile)
  - 测试 updateProfile
  - 测试 isLoggedIn 状态
  - 测试 onAuthStateChange
  - Mock Supabase client
  - 目标覆盖率: 80%+
  - 依赖: T-C010

---

## Phase C3: CloudNetworkClient (P0)

### C3.1 核心实现

- [x] **T-C020** 创建 `frontend/src/cloud/cloud-network.js` 基础结构
  ```javascript
  import { EventEmitter } from '../utils/event-emitter.js';

  /**
   * CloudNetworkClient — Supabase Realtime 网络客户端
   * 接口与 NetworkClient 保持一致
   */
  export class CloudNetworkClient extends EventEmitter {
    constructor(supabaseClient)

    // 属性
    playerId    // string — 来自 Supabase Auth
    connected   // boolean
    latency     // number (固定 0)

    // 连接管理
    async connect()
    disconnect()
    isConnected()
    getLatency()
  }
  ```
  - 继承 EventEmitter (与 NetworkClient 一致)
  - 依赖: T-C005

- [x] **T-C021** 实现 Channel 管理
  - `joinRoom(roomId, nickname, gameType)`:
    1. 创建 `supabase.channel('room:' + roomId, { config: { broadcast: { self: true } } })`
    2. 注册 broadcast 和 presence 监听器
    3. 调用 `channel.subscribe()`
    4. subscribe 成功后调用 `channel.track()` 加入 presence
  - `leaveRoom()`:
    1. `channel.untrack()`
    2. `channel.unsubscribe()`
    3. 清理引用
  - 依赖: T-C020

- [x] **T-C022** 实现 Presence 房间管理
  - 监听 `presence` 事件 (`sync`, `join`, `leave`)
  - `_getPlayerList()` — 从 `channel.presenceState()` 构建玩家列表
  - `_determineHost()` — 最早加入的玩家为 Host
  - Presence join → 构造 `PLAYER_JOINED` 格式消息分发给上层
  - Presence leave → 构造 `PLAYER_LEFT` 格式消息分发给上层
  - Host 离开时构造 `ROOM_DESTROYED` 消息
  - 依赖: T-C021

- [x] **T-C023** 实现 Broadcast 消息收发
  - `send(type, data)`:
    ```javascript
    channel.send({
      type: 'broadcast',
      event: type,
      payload: { type, timestamp: Date.now(), playerId: this.playerId, data }
    });
    ```
  - 接收广播:
    ```javascript
    channel.on('broadcast', { event: '*' }, ({ event, payload }) => {
      this._handleMessage(payload);
    });
    ```
  - `_handleMessage(message)` — 与 NetworkClient._handleMessage 类似:
    - 调用 `messageHandlers` 中注册的处理器
    - 触发 `message` 和 `message:${type}` 事件
  - `onMessage(messageType, handler)` — 注册处理器，返回取消订阅函数
  - 依赖: T-C021

- [x] **T-C024** 实现 Host 判定和权限逻辑
  - Host = Presence 列表中 `joinedAt` 最小的玩家
  - 在 Presence track 时包含 `{ playerId, nickname, joinedAt, isHost }`
  - 当 Presence sync 时重新计算 Host
  - 收到 START_GAME / AI_PLAYER_UPDATE 时检查发送者是否为 Host
  - 依赖: T-C022

- [x] **T-C025** 实现完整消息类型
  - `startGame(gameType, gameConfig)` — send('START_GAME', {...})
  - `sendGameAction(actionType, actionData)` — send('GAME_ACTION', {...})
  - `sendChat(message, isPublic)` — 本地立即触发 CHAT_MESSAGE_BROADCAST + broadcast
  - `send('AI_PLAYER_UPDATE', {...})` — 仅 Host
  - `send('GAME_SETTINGS_UPDATE', {...})` — 仅 Host
  - 确保与 main.js 中 `_setupNetworkHandlers` 期望的消息格式完全一致
  - 依赖: T-C023, T-C024

---

### C3.2 测试

- [x] **T-C026** CloudNetworkClient 单元测试 ✅
  - Mock Supabase client (channel, presence, broadcast)
  - ✅ 测试 connect / disconnect
  - ✅ 测试 joinRoom → presence track
  - ✅ 测试 leaveRoom → untrack + unsubscribe
  - ✅ 测试 Presence sync → PLAYER_JOINED/LEFT 消息生成
  - ✅ 测试 Host 判定逻辑 (含 _isActingHostExcluding)
  - ✅ 测试 send → channel.send 调用
  - ✅ 测试 onMessage → 正确分发
  - ✅ 测试 sendGameAction / startGame / sendChat
  - ✅ 测试 requestReconnect / grace timer / RECONNECT_REQUEST handling
  - 测试文件: `frontend/src/cloud/cloud-network.test.js` (54 tests)
  - 依赖: T-C025

---

## Phase C4: 前端集成 (P1)

### C4.1 大厅改造

- [x] **T-C030** game-lobby.js 增加模式切换
  - 在大厅 header 下方增加 "本地" / "云端" 切换按钮
  - 切换为云端时:
    - 检查 `isCloudAvailable()` — 未配置则提示
    - 检查 `authService.isLoggedIn()` — 未登录则跳转 AuthPage
    - 已登录则显示用户昵称 + 登出按钮
  - 游戏卡片上 "创建房间" 按钮根据模式走不同流程
  - 新增回调: `options.onSwitchMode(mode)` — 通知 main.js
  - 依赖: T-C025, T-C012

- [x] **T-C031** 创建/加入房间对话框适配云端模式
  - 云端模式的创建房间对话框:
    - 不需要服务器地址输入（固定为 Supabase）
    - 房间 ID 输入
    - 昵称从登录信息自动填充
    - 其他设置不变
  - 云端模式的加入房间对话框:
    - 不需要服务器地址输入
    - 房间 ID 输入
    - 昵称自动填充
  - 依赖: T-C030

- [x] **T-C032** main.js 集成 CloudNetworkClient
  - 新增 `this.mode = 'local'` 状态 ('local' | 'cloud')
  - 新增 `this.authService` 实例
  - `_connectAndCreateRoom` / `_connectAndJoinRoom`:
    - `mode === 'cloud'` 时使用 `CloudNetworkClient` 而非 `NetworkClient`
    - `CloudNetworkClient` 使用 Supabase Auth 的 user.id 作为 playerId
  - `_setupNetworkHandlers` 不需要修改（CloudNetworkClient 对外接口一致）
  - 依赖: T-C025, T-C030

- [x] **T-C033** 大厅用户信息展示
  - 云端模式下在大厅 header 区域显示:
    - 用户昵称
    - 登出按钮
  - 点击昵称可编辑（调用 `authService.updateProfile`）
  - 依赖: T-C012

---

### C4.2 集成测试

- [x] **T-C034** 集成测试
  - 手动测试: 两个浏览器 tab 通过云端完成一局 UNO
  - 验证: 创建房间 → 加入房间 → 等待大厅 → 开始游戏 → 游戏操作同步 → 游戏结束
  - 验证: 本地模式功能不受影响
  - 验证: 断开连接处理（关闭 tab → 对方收到 PLAYER_LEFT）
  - 依赖: T-C032

---

## Phase C5: 文档更新 (P1)

- [x] **T-C040** 更新 CLAUDE.md
  - 架构图增加云端模块
  - 项目结构增加 `cloud/` 和 `frontend/src/cloud/` 目录
  - Key Technical Details 增加 Supabase 说明
  - Key Documentation References 增加云端文档引用

- [x] **T-C041** 更新 PROGRESS.md
  - 总体进度增加云端模块行
  - 增加 "云端后端进度详情" 章节
  - 更新 "下一步工作建议"

- [x] **T-C042** 创建 `docs/prd/cloud/TASKS.md` (本文件)
  - ✅ 已创建

- [x] **T-C043** 更新 `docs/PROTOCOL.md`
  - 增加 "云端模式" 章节
  - 说明 Supabase Realtime Broadcast 与 WebSocket 消息的对应关系
  - 说明 Presence 替代服务端房间管理的机制

---

## Phase C6: 断线重连支持 (P1)

> **前置条件**: T-B116（房主断线重连）和 T-B117（PLAYER_DISCONNECTED 广播）必须先完成。
> 云端重连设计复用本地模式的协议和前端逻辑，但将服务端验证职责转移到房主客户端（Host-Relayed 方案）。
> 详见本地重连改进任务: `docs/prd/backend/TASKS.md` Phase 7.2

- [x] **T-C044** CloudNetworkClient 断线重连与会话恢复 ✅
  - **方案**: Host-Relayed Reconnection — 房主客户端充当重连验证方，无需新增数据库或 API
  - CloudNetworkClient 改造:
    - 新增 `_disconnectedPlayers` Map 和 `_gameActive` 标志
    - 监听 Realtime Channel 状态（`CLOSED` / `CHANNEL_ERROR` / `TIMED_OUT`）
    - 修改 Presence `leave` 处理: 游戏进行中分发 `PLAYER_DISCONNECTED` 而非立即 `PLAYER_LEFT`，启动宽限计时
    - 修改 Presence `join` 处理: 若 playerId 在 `_disconnectedPlayers` 中，视为重连候选
    - 新增 `requestReconnect(roomId, sessionId)`: 重新加入 Channel + track Presence + 广播 `RECONNECT_REQUEST`
    - 新增广播监听: `RECONNECT_REQUEST`, `RECONNECT_ACCEPTED`, `RECONNECT_REJECTED`, `GAME_SNAPSHOT`, `PLAYER_DISCONNECTED`
  - 前端 reconnect 方法适配:
    - 移除 `app-reconnect-methods.js` 中的 `mode === 'local'` / `instanceof NetworkClient` 限制
    - `_saveReconnectContext` 适配云端字段（无 serverUrl，使用 userId）
    - `_runReconnectAttempt` 云端分支: 调用 `cloudNetwork.requestReconnect()` 而非 WS connect + requestReconnect
  - 房主端处理（main.js）:
    - 收到 `RECONNECT_REQUEST` 广播时: 校验 playerId 是否在 disconnectedPlayers 中
    - 校验通过: 广播 `RECONNECT_ACCEPTED` + `GAME_SNAPSHOT`（使用 `getVisibleState(playerId)` 生成）
    - 校验失败: 广播 `RECONNECT_REJECTED`
    - 快照广播含 `targetPlayerId` 字段，其他客户端忽略非自己的快照
  - 实现自动重订阅（指数退避 + 最大重试次数）
  - UI 暴露连接状态事件（重连中、重连成功、重连失败）
  - 验收:
    - 非房主玩家网络闪断后可恢复到原对局
    - 房主断线后其他玩家看到等待提示（依赖 T-B116/T-B117 协议一致）
    - 长时间离线/房间已销毁时给出明确失败提示
    - 不影响现有本地模式和云端正常联机流程
  - **依赖**: T-B116, T-B117, T-C025, T-C032, T-C034

---

## 任务依赖图

```
T-C001 ─────────────────────────────┐
T-C002 ─────────────────────────────┤
T-C003 → T-C004 → T-C005 ──────────┤
                      │             │
                      ├── T-C010 ───┤
                      │     │       │
                      │   T-C011    │
                      │     │       │
                      │   T-C012 ───┤
                      │     │       │
                      │   T-C013    │
                      │             │
                      ├── T-C020 ───┤
                      │     │       │
                      │   T-C021    │
                      │     │       │
                      │   T-C022    │
                      │   T-C023    │
                      │     │       │
                      │   T-C024    │
                      │     │       │
                      │   T-C025 ───┤
                      │     │       │
                      │   T-C026    │
                      │             │
                      └─ T-C030 ────┤
                           │        │
                         T-C031     │
                         T-C032 ────┤
                         T-C033     │
                           │        │
                          T-C034 ──┐
                                   ├── T-C044
                    T-B116, T-B117 ┘      │
                          T-C040 ─────────┘
                          T-C041
                          T-C043
```

---

## 验收标准

### 代码质量

- [ ] 所有函数都有 JSDoc 注释
- [ ] 遵循命名规范 (PascalCase 类, camelCase 函数, kebab-case 文件)
- [ ] 单文件不超过 500 行
- [ ] ES6 模块 (import/export)
- [ ] CSS 使用现有 variables.css 变量

### 功能验收

- [ ] 邮箱注册成功
- [ ] 邮箱登录成功
- [ ] 大厅本地/云端模式切换正常
- [ ] 云端创建房间成功
- [ ] 云端加入房间成功
- [ ] 云端游戏流程正常 (UNO 完整对局)
- [ ] 本地模式不受任何影响
- [ ] 断开连接正确处理

### 测试覆盖

- [ ] AuthService 覆盖率 > 80%
- [ ] CloudNetworkClient 覆盖率 > 80%
- [ ] 所有测试通过

---

## AI 编程提示

### 创建 CloudNetworkClient

```
请基于 docs/prd/cloud/PLAN.md 中的接口设计，
创建 CloudNetworkClient，要求：
1. 继承 EventEmitter
2. 与 NetworkClient 接口一致
3. 使用 Supabase Realtime Channel + Presence
4. Presence 事件转换为 PLAYER_JOINED/LEFT 协议消息
5. Host 判定逻辑
6. 单元测试 (mock Supabase client)
```

### 创建认证页面

```
请基于项目现有 UI 组件模式 (参考 layout/game-lobby.js)，
创建登录/注册页面 auth-page.js，要求：
1. 使用 CSS Variables
2. Tab 切换登录/注册
3. 表单验证
4. 调用 AuthService
5. 错误提示使用 showToast/showNotification
```

### 集成到 main.js

```
请修改 main.js 集成云端功能，要求：
1. 新增 mode 状态 ('local' | 'cloud')
2. 云端模式使用 CloudNetworkClient 替代 NetworkClient
3. 云端模式需要先登录
4. playerId 使用 Supabase Auth user.id
5. _setupNetworkHandlers 不需要修改
6. 不影响现有本地模式功能
```
