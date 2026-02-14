# 项目进度报告

> 最后更新: 2026-02-14

---

## 总体进度

| 模块 | 进度 | 状态 |
|------|------|------|
| **前端** | 87% | 🔶 部分完成 |
| **后端 (本地)** | 88% | 🔶 基本完成 (重连改进待实现) |
| **后端 (云端)** | 95% | ✅ 基本完成 (含断线重连) |
| **API 服务 (Render)** | 100% | ✅ 完成 |
| **整体** | 89% | 🔶 开发中 |

---

## 前端进度详情

### Phase 1: 核心框架 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F001 | 项目目录结构 | ✅ |
| T-F002 | 入口页面 index.html | ✅ |
| T-F003 | CSS 设计系统 variables.css | ✅ |
| T-F004 | 默认主题 default.css | ✅ |
| T-F010 | 游戏引擎基类 engine.js | ✅ |
| T-F011 | 规则引擎 rules.js | ✅ |
| T-F012 | 游戏注册表 registry.js | ✅ |
| T-F020 | WebSocket 客户端 network.js | ✅ |
| T-F021 | 心跳机制 | ✅ |
| T-F022 | 错误处理 | ✅ |
| T-F030 | 存储工具 storage.js | ✅ |
| T-F031 | 验证工具 validators.js | ✅ |
| T-F032 | 事件发射器 event-emitter.js | ✅ |

### Phase 2: UI 组件 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F040 | 游戏大厅 game-lobby.js | ✅ |
| T-F041 | 等待大厅 waiting-room.js | ✅ |
| T-F042 | 游戏棋盘容器 game-board.js | ✅ |
| T-F043 | 设置面板 settings-panel.js | ✅ |
| T-F044 | 结算界面 game-result.js | ✅ |
| T-F050 | 模态框组件 modal.js | ✅ |
| T-F051 | 通知组件 notification.js | ✅ |
| T-F052 | 加载指示器 loading.js | ✅ |
| T-F053 | 玩家头像组件 player-avatar.js | ✅ |
| T-F054 | 游戏设置弹窗 game-settings-modal.js | ✅ |

### Phase 3: 游戏实现 🔶 部分完成

#### UNO 游戏 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F060 | UNO 配置 config.json | ✅ |
| T-F061 | UNO 游戏类 index.js | ✅ |
| T-F062 | UNO 规则 rules.js | ✅ |
| T-F063 | UNO UI ui.js | ✅ |
| T-F064 | UNO 单元测试 (126 tests) | ✅ |
| T-F065 | UNO 游戏设置 | ✅ |
| T-F-DOC-002 | UNO AI 规则文档 | ✅ |
| T-F-DOC-003 | UNO 用户规则书 | ✅ |

#### 狼人杀游戏 🔶 开发中 (P0 核心完成 + 顺序夜间阶段，综合测试未完成)

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F-DOC-004 | 狼人杀 AI 规则文档 | ✅ |
| T-F-DOC-005 | 狼人杀用户规则书 | ✅ |
| T-F-DOC-006 | 狼人杀开发计划 | ✅ |
| T-F070 | 狼人杀配置 | ✅ |
| T-F071 | 狼人杀游戏类 index.js | ✅ |
| T-F072 | 狼人杀规则 rules.js | ✅ |
| T-F073 | 狼人杀 UI ui.js | ✅ |
| T-F074 | P0 角色单元测试 (82 tests) | ✅ |
| T-F076 | P0 基础角色 (6 角色) | ✅ |
| T-F075 | 集成测试 (手动/端到端) | ⬜ |
| T-F077 | P1 进阶角色 (7 角色) | ⬜ |

> **注意**: P0 核心框架、角色及顺序夜间阶段已实现并通过 82 项单元测试，但综合测试（手动端到端、多人联机流程）尚未完成。

### Phase 4: 联机功能 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F080 | 创建房间功能 | ✅ |
| T-F081 | 加入房间功能 | ✅ |
| T-F082 | 玩家列表同步 | ✅ |
| T-F090 | 游戏状态同步 | ✅ |
| T-F091 | 操作发送 | ✅ |
| T-F092 | 聊天功能 | ✅ |

### Phase 5: 优化与测试 🔶 进行中

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F100 | 渲染性能优化 | ✅ |
| T-F101 | 网络性能优化 | ⬜ |
| T-F102 | 资源加载优化 | ⬜ |
| T-F110 | 核心模块单元测试 (160 tests) | ✅ |
| T-F111 | 工具函数测试 (109 tests) | ✅ |
| T-F112 | 集成测试 | ⬜ |
| T-F123 | 移动端响应式布局适配 | ⬜ |
| T-F124 | 游戏数据查询面板 (API 集成) | ✅ |
| T-F125 | 联机断线重连（客户端） | ✅（本地 + 云端） |
| T-F126 | AI 规则问答面板 (Chat API 集成) | ✅ |

### Phase 6: 可选功能 ⬜ 未开始

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-F120 | Electron 桌面应用打包 | ⬜ |
| T-F121 | 自动更新功能 | ⬜ |
| T-F122 | 系统托盘支持 | ⬜ |

---

## 后端进度详情

### Phase 1: 核心框架 ✅ 完成

| 任务 ID | 描述 | 文件 | 状态 |
|---------|------|------|------|
| T-B001 | 项目目录结构 | backend/server/ | ✅ |
| T-B002 | package.json | package.json | ✅ |
| T-B003 | 配置文件 | config.js | ✅ |
| T-B010 | 日志工具 | utils/logger.js | ✅ |
| T-B011 | 验证工具 | utils/validator.js | ✅ |
| T-B020 | 连接管理器 | connection-manager.js | ✅ |
| T-B021 | 连接管理器测试 | tests/connection-manager.test.js | ✅ |
| T-B030 | 房间管理器 | room-manager.js | ✅ |
| T-B031 | 房间管理器测试 | tests/room-manager.test.js | ✅ |
| T-B040 | 消息路由器 | message-router.js | ✅ |
| T-B041 | 消息路由器测试 | tests/message-router.test.js | ✅ |
| T-B050 | 服务器入口 | index.js | ✅ |
| T-B051 | 服务器集成测试 | tests/server.integration.test.js | ✅ |

### Phase 2: 消息处理 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-B060 | JOIN 消息处理 | ✅ |
| T-B061 | JOIN 消息测试 | ✅ |
| T-B062 | LEAVE 消息处理 | ✅ |
| T-B063 | LEAVE 消息测试 | ✅ |
| T-B064 | START_GAME 消息处理 | ✅ |
| T-B065 | START_GAME 消息测试 | ✅ |
| T-B066 | GAME_ACTION 消息处理 | ✅ |
| T-B067 | GAME_ACTION 消息测试 | ✅ |
| T-B068 | CHAT_MESSAGE 消息处理 | ✅ |
| T-B069 | CHAT_MESSAGE 消息测试 | ✅ |
| T-B070 | PING/PONG 心跳 | ✅ |
| T-B071 | 心跳超时检测 | ✅ |

### Phase 3: 断开处理 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-B080 | 断开连接处理 | ✅ |
| T-B081 | 断开处理测试 | ✅ |
| T-B082 | 房主断开处理 | ✅ |

### Phase 4: 错误处理 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-B090 | 消息格式验证 | ✅ |
| T-B091 | 错误响应 | ✅ |
| T-B092 | 全局异常捕获 | ✅ |
| T-B093 | 优雅关闭 | ✅ |

### Phase 5: 广播优化 ⬜ 未开始

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-B100 | 广播器 | ⬜ |
| T-B101 | 排除发送者广播 | ⬜ |
| T-B102 | 消息队列 | ⬜ |

### Phase 6: 监控与日志 ⬜ 未开始

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-B110 | 统计信息收集 | ⬜ |
| T-B111 | 健康检查端点 | ⬜ |
| T-B112 | 结构化日志 | ⬜ |
| T-B113 | 日志文件输出 | ⬜ |

### Phase 7: 断线重连支持 🔶 部分完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-B114 | 断线重连会话恢复 | ✅ |
| T-B115 | 断线重连测试 | ✅ |
| T-B116 | 房主断线重连（T-C044 前置） | ✅ |
| T-B117 | 广播 PLAYER_DISCONNECTED 通知（T-C044 前置） | ✅ |
| T-B118 | 按需快照替代逐 action 全量传输 | ⬜ |
| T-B119 | 定期清理过期重连会话 | ✅ |
| T-B120 | 使用 crypto.randomUUID 生成 sessionId | ⬜ |

---

## 云端后端进度详情

> **设计方案**: Supabase Realtime 替代 WebSocket 服务器 + Supabase Auth 用户系统
> **详细计划**: `docs/prd/cloud/PLAN.md` | **任务清单**: `docs/prd/cloud/TASKS.md`

### Phase C1: 基础设施 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-C001 | cloud/ 目录结构和 README | ✅ |
| T-C002 | 数据库迁移 (profiles 表) | ✅ |
| T-C003 | 前端添加 @supabase/supabase-js | ✅ |
| T-C004 | 环境变量配置 (.env.example) | ✅ |
| T-C005 | Supabase 客户端初始化模块 | ✅ |

### Phase C2: 用户认证 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-C010 | AuthService 认证服务 | ✅ |
| T-C011 | 登录/注册页面 UI | ✅ |
| T-C012 | main.js 认证流程集成 | ✅ |
| T-C013 | AuthService 单元测试 | ⬜ |

### Phase C3: CloudNetworkClient ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-C020 | CloudNetworkClient 基础结构 | ✅ |
| T-C021 | Channel 管理 (subscribe/unsubscribe) | ✅ |
| T-C022 | Presence 房间管理 | ✅ |
| T-C023 | Broadcast 消息收发 | ✅ |
| T-C024 | Host 判定和权限逻辑 | ✅ |
| T-C025 | 完整消息类型实现 | ✅ |
| T-C026 | CloudNetworkClient 单元测试 | ⬜ |

### Phase C4: 前端集成 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-C030 | 大厅模式切换 UI | ✅ |
| T-C031 | 创建/加入房间对话框适配 | ✅ |
| T-C032 | main.js CloudNetworkClient 集成 | ✅ |
| T-C033 | 大厅用户信息展示 | ✅ |
| T-C034 | 集成测试 | ✅ |

### Phase C5: 文档更新 🔶 进行中

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-C040 | 更新 CLAUDE.md | ✅ |
| T-C041 | 更新 PROGRESS.md | ✅ |
| T-C042 | 创建 cloud/TASKS.md | ✅ |
| T-C043 | 更新 PROTOCOL.md | ✅ |

### Phase C6: 断线重连支持 ✅ 完成

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-C044 | CloudNetworkClient 断线重连与会话恢复（依赖 T-B116, T-B117） | ✅ |

---

## API 服务进度详情 (Render)

> **目的**: 提供 REST API 供外部调用 (游戏/卡牌数据查询，AI/MCP 接口预留)
> **部署**: Render Web Service
> **代码**: `api/` 目录

### Phase A: API 服务实现 ✅ 完成（核心）

| 任务 ID | 描述 | 状态 |
|---------|------|------|
| T-A001~T-A009 | 框架骨架（项目结构、配置、日志、错误处理、健康检查、入口） | ✅ |
| T-A010~T-A013 | Supabase 集成（客户端、JWT 认证、限流、请求校验） | ✅ |
| T-A020~T-A024 | 数据端点（迁移、游戏/卡牌服务与路由） | ✅ |
| T-A030~T-A031 | 部署配置（Render 配置与部署验证） | ✅ |
| T-A040~T-A046 | 单元测试（21 tests） | ✅ |
| T-AC001~T-AC006 | AI 规则问答 Step 1（29 tests） | ✅ |
| T-A050~T-A058 | 卡牌数据填充 | ⬜ |
| T-A060~T-A066 | AI/MCP 接口 | ⬜ |
| T-AC009~T-AC013 | AI 规则问答 Step 2 (RAG-lite) | ⬜ |

### API 端点

| 端点 | 认证 | 描述 |
|------|------|------|
| `GET /api/v1/health` | - | 健康检查 |
| `GET /api/v1/games` | - | 游戏列表 |
| `GET /api/v1/games/:id` | - | 游戏详情 |
| `GET /api/v1/games/:id/categories` | - | 卡牌类别 |
| `GET /api/v1/games/:id/cards` | - | 卡牌列表 |
| `GET /api/v1/games/:id/cards/:cardId` | - | 卡牌详情 |
| `POST /api/v1/games` | JWT | 创建游戏 |
| `PUT /api/v1/games/:id` | JWT | 更新游戏 |
| `POST /api/v1/games/:id/cards` | JWT | 创建卡牌 |
| `PUT /api/v1/games/:id/cards/:cardId` | JWT | 更新卡牌 |
| `POST /api/v1/chat` | - | AI 规则问答 (发送消息) |
| `GET /api/v1/chat/:sessionId` | - | 获取对话历史 |
| `DELETE /api/v1/chat/:sessionId` | - | 删除对话会话 |

### 待办

- T-A050~T-A058：卡牌数据填充 (按游戏分别实现)
- T-A060~T-A066：AI/MCP 接口实现
- T-AC009~T-AC013：AI 规则问答 Step 2 — 规则知识库增强 (RAG-lite)

---

## 测试覆盖率

### 前端测试统计 (521 tests passing)

| 测试套件 | 测试数 | 状态 |
|----------|--------|------|
| registry.test.js | 22 | ✅ |
| rules.test.js | 36 | ✅ |
| engine.test.js | 47 | ✅ |
| network.test.js | 60 | ✅ |
| storage.test.js | 39 | ✅ |
| validators.test.js | 75 | ✅ |
| uno/index.test.js | 79 | ✅ |
| uno/ui.test.js | 2 | ✅ |
| uno/rules.test.js | 49 | ✅ |
| waiting-room.test.js | 4 | ✅ |
| werewolf/index.test.js | 101 | ✅ |
| werewolf/ui.test.js | 3 | ✅ |
| player-avatar.test.js | 4 | ✅ |
| **总计** | **521** | ✅ |

### 后端测试统计 (150 tests passing)

| 测试套件 | 测试数 | 状态 |
|----------|--------|------|
| connection-manager.test.js | 31 | ✅ |
| room-manager.test.js | 56 | ✅ |
| message-router.test.js | 42 | ✅ |
| server.integration.test.js | 21 | ✅ |
| **总计** | **150** | ✅ |

### 代码覆盖率

| 文件 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|-----|
| connection-manager.js | 100% | 90% | 100% | 100% |
| room-manager.js | 96% | 93% | 100% | 96% |
| message-router.js | 87% | 76% | 94% | 87% |
| **总计** | **89%** | **79%** | **94%** | **88%** |

### 测试文件

- `tests/connection-manager.test.js` - 连接管理器单元测试 (31 tests)
- `tests/room-manager.test.js` - 房间管理器单元测试 (56 tests)
- `tests/message-router.test.js` - 消息路由器单元测试 (42 tests)
- `tests/server.integration.test.js` - 服务器集成测试 (21 tests)
- `test-client.js` - 单客户端手动测试
- `test-two-players.js` - 双玩家手动测试

---

## 下一步工作建议

### 高优先级

1. **云端后端单元测试** - AuthService + CloudNetworkClient 单元测试 (T-C013, T-C026)
2. **狼人杀手动测试** - UI 渲染及完整游戏流程端到端验证 (T-F075)
3. **集成测试** - 端到端测试 (T-F112)

### 中优先级

5. **按需快照替代逐 action 全量传输** - 减少带宽消耗和隐藏信息泄露 (T-B118)
6. **狼人杀 P1 角色** - 守卫、丘比特、警长等 7 角色 (T-F077)
7. **移动端适配** - 响应式布局，手机可用 (T-F123)
8. **后端广播优化** - 广播器实现 (T-B100-T-B102)
9. **监控与日志** - 统计信息和健康检查 (T-B110-T-B113)

### 低优先级

12. **定期清理过期重连会话** - 心跳循环中自动清理 (T-B119)
13. **使用 crypto.randomUUID 生成 sessionId** - 增强会话安全性 (T-B120)
14. **狼人杀 P2-P3 角色** - 高级及扩展角色 (T-F078, T-F079)
15. **网络性能优化** - 消息压缩、批量发送 (T-F101)
16. **主动退出后短时可恢复对局** - 退出后保留短窗口恢复能力（与真正退房语义区分）

### 可选功能 (Optional)

12. **桌面应用打包** - Electron 打包为独立可执行文件 (T-F120-T-F122)
   - 用户无需安装编程环境即可运行
   - 支持 Windows/macOS/Linux
   - 推荐方案：Electron (~150MB)，轻量方案：Tauri (~15MB)

---

## 最近完成的任务

### 2026-02-14

- ✅ T-C044 CloudNetworkClient 断线重连与会话恢复 (Host-Relayed 方案)
  - 修改 `frontend/src/cloud/cloud-network.js` — 新增断线宽限期 (60s)、重连协议 (RECONNECT_REQUEST/ACCEPTED/REJECTED/GAME_SNAPSHOT/PLAYER_DISCONNECTED/PLAYER_RECONNECTED)、acting host 验证、targetPlayerId 广播过滤、Channel 状态监听 (CLOSED/TIMED_OUT)
  - 新增方法: `requestReconnect()`, `getReconnectDelay()`, `setGameActive()`, `returnToRoom()`, `_isActingHost()`, `_handleReconnectRequest()`
  - 修改 `frontend/src/app/app-reconnect-methods.js` — 移除所有 `instanceof NetworkClient` 本地模式硬限制，支持 CloudNetworkClient 重连、重试、上下文保存/恢复
  - 修改 `frontend/src/app/app-online-room-methods.js` — 新增 `PLAYER_DISCONNECTED` handler (断线提示)、`RECONNECT_REQUEST` handler (acting host 发送 GAME_SNAPSHOT)、修复 `PLAYER_RECONNECTED` 云端兼容
  - 修改 `frontend/src/main.js` — 注入 `CloudNetworkClient`/`getSupabaseClient` 到重连模块依赖、`_startGame` 中调用 `setGameActive(true)`、游戏结束/离开时调用 `setGameActive(false)`
  - 前端构建验证通过: `npm run build`

### 2026-02-13

- ✅ T-B117 广播 PLAYER_DISCONNECTED 通知
  - 修改 `backend/server/message-router.js` — handleDisconnect 中创建 reconnectSession 后立即广播 PLAYER_DISCONNECTED (playerId, nickname, reconnectWindowMs)
  - 更新 `docs/PROTOCOL.md` — 新增 5.6 PLAYER_DISCONNECTED 消息类型定义
  - 新增 3 项单元测试 (`message-router.test.js`): 非房主断线广播、房主断线广播、游戏未开始不广播
  - 新增 1 项集成测试 (`server.integration.test.js`): 端到端断线通知验证
  - 后端测试通过: `150` (原 146 + 新增 4)

### 2026-02-12

- ✅ T-F126 前端 AI 规则问答面板
  - 新增 `frontend/src/components/chat-panel.js` — 聊天面板组件 (模态对话框、消息气泡、建议问题、会话管理)
  - 修改 `frontend/src/utils/api-client.js` — 新增 del/sendChatMessage/getChatHistory/deleteChatSession
  - 修改 `frontend/src/layout/game-lobby.js` — 大厅添加「💬 规则问答」按钮
  - 修改 `frontend/src/layout/game-board.js` — 游戏内顶栏添加「💬」规则问答按钮

- ✅ AI 规则问答 Step 1 完成 (T-AC001~T-AC008)
  - 新增 `api/services/chat-service.js` — 对话服务 (会话管理、OpenAI API 调用、历史维护、Token 统计)
  - 新增 `api/routes/v1/chat.js` — 对话路由 (POST/GET/DELETE, 独立限流, 消息校验)
  - 修改 `api/config.js` — 新增 openai/chat 配置区块
  - 修改 `api/routes/v1/index.js` — 注册 chat 路由
  - 修改 `api/.env.example` — 新增 OPENAI_API_KEY 等环境变量
  - 安装 `openai` npm 依赖
  - 新增 `api/tests/services/chat-service.test.js` — 14 个单元测试
  - 新增 `api/tests/routes/v1/chat.test.js` — 12 个集成测试
  - API 全部 50 个测试通过 (原有 24 + 新增 26)
  - PRD 文档: `docs/prd/api/AI_CHAT_PRD.md` v1.1.0

- ✅ 前端入口文件模块化拆分（`docs/dev_rules/CODE_STYLE_GUIDE.md` 合规）
  - 将 `frontend/src/main.js` 中联机房间逻辑拆分到 `frontend/src/app/app-online-room-methods.js`
  - 将重连流程逻辑拆分到 `frontend/src/app/app-reconnect-methods.js`
  - `main.js` 从 `1755` 行降至 `826` 行，满足“单文件不超过 1000 行”要求
  - 前端验证通过：`npm run build`、`npm test`（`519` tests passing）

- ✅ 联机开局设置一致性与 UNO 叠加交互修复
  - 修复本地后端 `GAME_STARTED` 设置字段一致性，确保非房主端开局后规则栏与房主一致
  - 前端 `GAME_STARTED` 增加多来源设置兜底（`gameSettings` / `gameConfig.gameSettings` / `initialState.options`）
  - 修复 UNO 在 `drawPending > 0` 场景下前端误禁用叠加牌的问题，恢复 +2/+4 可点击叠加
  - 新增回归测试 `frontend/src/games/uno/ui.test.js`，前端测试更新为 `521` 全通过

### 2026-02-11

- ✅ 局后“回到房间”与二次开局门控
  - 局后主按钮改为“回到房间”，玩家需显式返回等待房间
  - 新增 `RETURN_TO_ROOM` / `RETURN_TO_ROOM_STATUS` 协议与联动逻辑
  - 仅在所有玩家返回后允许房主再次开局
  - 等待房间玩家列表可见“已返回/未返回”状态
  - 协议文档升级到 `v1.2.0`（`docs/PROTOCOL.md`）
  - 已补充前后端回归测试并通过（后端总计 `125`）

- ✅ 本地联机断线重连打通（前后端）
  - 后端新增会话窗口与恢复流程：`RECONNECT_REQUEST` / `RECONNECT_ACCEPTED` / `RECONNECT_REJECTED` / `GAME_SNAPSHOT` / `PLAYER_RECONNECTED`
  - 前端新增自动重连与重试引导：断线自动重试、失败后可点击继续恢复
  - 协议文档已更新到 `v1.1.0`（`docs/PROTOCOL.md`）

- ✅ 补充重连回归用例
  - 新增“会话过期拒绝重连”集成测试：`RECONNECT_SESSION_EXPIRED`
  - 后端测试通过：`119`（`server.integration.test.js` 现为 `16` 项）

### 2026-02-08

- ✅ 狼人杀代码模块化拆分 (Code Modularization)
  - 拆分 `ui.js` (1982 行) → 4 个文件:
    - `ui.js` (546 行) — 主 WerewolfUI 类
    - `ui-helpers.js` (209 行) — 常量和工具函数
    - `ui-panels-night.js` (639 行) — 夜间阶段面板
    - `ui-panels-day.js` (629 行) — 白天阶段面板
    - `ui-panels.js` (124 行) — 面板统一导出
  - 拆分 `index.js` (1147 行) → 2 个文件:
    - `index.js` (729 行) — 主 WerewolfGame 类
    - `game-phases.js` (424 行) — 阶段转换逻辑
  - 所有文件行数 < 1000 行，符合 dev_rules 规范
  - 使用 re-export 模式保持向后兼容

- ✅ 狼人杀阶段计时器 (Phase Timer)
  - **新建** `components/phase-timer.js` — 倒计时组件 (mm:ss 格式、颜色渐变 green→yellow→red、到期 Toast 提醒、不影响游戏流程)
  - **修改** `layout/game-board.js` — 集成 PhaseTimer 至游戏头部，startTimer/stopTimer/pauseTimer/resumeTimer 方法
  - **修改** `games/werewolf/ui.js` — 各阶段启动对应计时 (nightActionTime/discussionTime/voteTime)
  - **修改** `games/uno/config.json` — 新增可选 actionTime 设置

- ✅ 狼人杀遗言流程修复
  - 死亡玩家可点击"结束遗言"按钮继续游戏
  - 修改 `games/werewolf/index.js` — DAY_ANNOUNCE 阶段允许死亡玩家提交 PHASE_ADVANCE
  - 修改 `games/werewolf/ui.js` — 死亡玩家显示"结束遗言"按钮

- ✅ 玩家发言状态徽章
  - 讨论阶段当前发言者显示"发言中"徽章
  - 遗言阶段死亡玩家显示"遗言中"徽章
  - 修改 `layout/game-board.js` — 添加 speaking 徽章逻辑
  - 修改 `components/player-avatar.js` — speaking 徽章绿色样式

- ✅ 发言顺序与方向指示器一致
  - 修改 `games/werewolf/index.js` — 发言队列由逆时针改为顺时针 `(startIdx + i)` 匹配方向箭头

- ✅ 平票二次发言实现
  - 投票平票后，平票候选人按原发言顺序依次发言
  - 新增 `_startTieSpeech` 方法处理平票发言阶段
  - UI 显示"平票发言"标题

- ✅ 顺序投票机制
  - 白天投票改为顺序投票 (与发言顺序一致)
  - 新增 `voterQueue`、`currentVoter`、`baseSpeakerOrder` 状态字段
  - 修改 `games/werewolf/rules.js` — validateDayVote 增加 currentVoter 校验
  - 修改 `games/werewolf/ui.js` — 投票面板显示当前投票者和队列
  - 当前投票者显示"投票中"徽章

- ✅ 狼人拟投票系统 (Tentative Vote)
  - 夜间狼人可先发送"拟投票"表示意向，再"确认击杀"提交最终决定
  - 新增 `NIGHT_WOLF_TENTATIVE` 行动类型
  - 新增 `wolfTentativeVotes` 状态字段
  - 队友可见拟投票/已确认状态
  - 修改 `games/werewolf/rules.js` — 新增拟投票验证
  - 修改 `games/werewolf/ui.js` — 狼人面板显示拟投票按钮和队友状态

- ✅ 历史记录匿名化
  - 夜间行动显示角色名 (匿名)，除非身份已知
  - 白天行动显示玩家名，已知身份追加角色
  - 自己永远显示为"我"
  - 已知身份来源：狼人队友、预言家查验、游戏结束揭示
  - 修改 `components/game-sidebar.js` — 新增 `_getWerewolfHistoryName`、`_getRoleName`、`_getRoleFromActionType` 方法

- ✅ API 新增单人模式游戏列表端点
  - 新增 `GET /api/v1/games/single-player`，返回支持单人模式的游戏
  - 判定规则：`metadata.gameType=singleplayer` 或 `metadata.supportsAI=true`
  - 修改 `api/routes/v1/games.js`、`api/services/game-service.js`
  - 补充测试 `api/tests/routes/v1/games.test.js`、`api/tests/services/game-service.test.js`

- ✅ 狼人杀修复：女巫双药行动阶段与狼人弃票
  - 女巫在同一夜晚可先后执行救/毒，且仅在手动结束当前夜间步骤后才进入结算
  - 狼人支持明确弃票与拟弃票（`targetId: null`），并在队友视图中同步状态
  - 修改 `frontend/src/games/werewolf/rules.js`、`frontend/src/games/werewolf/game-phases.js`、`frontend/src/games/werewolf/ui-panels-night.js`
  - 补充测试 `frontend/src/games/werewolf/index.test.js`

- ✅ 狼人杀修复：猎人夜死白天开枪结算链
  - 夜间死亡的猎人可在白天公告阶段优先开枪，之后再进入遗言流程
  - 被猎人射杀的玩家立即死亡且无遗言
  - 若猎人夜死且可触发开枪，则强制公开猎人身份；否则按“死亡公开角色”配置处理
  - 修改 `frontend/src/games/werewolf/index.js`、`frontend/src/games/werewolf/game-phases.js`
  - 补充测试 `frontend/src/games/werewolf/index.test.js`

- ✅ 狼人杀修复：亡者聊天解锁时机
  - 亡者聊天改为“按玩家逐个解锁”：该玩家在遗言或猎人开枪待结算期间不可发言
  - 仅当该玩家完成自身死亡结算后，才开放亡者聊天
  - 修改 `frontend/src/games/werewolf/index.js`、`frontend/src/games/werewolf/ui.js`
  - 补充测试 `frontend/src/games/werewolf/index.test.js`、`frontend/src/games/werewolf/ui.test.js`

- ✅ 狼人杀修复：猎人选中目标高亮 + 领袖选项标注
  - 猎人开枪阶段点选目标后，玩家环立即高亮选中目标
  - 房间设置保留“领袖机制”选项，文案改为 `启用领袖机制(未实装)`
  - 修改 `frontend/src/games/werewolf/ui.js`、`frontend/src/games/werewolf/config.json`、`frontend/src/games/werewolf/ui.test.js`

- ✅ Codex 技能：新增 API 端点开发模板
  - 新增技能 `.codex/skills/add-api-endpoint/`
  - 包含流程说明、OpenAI 代理配置、项目 API 约定与后端边界参考

### 2026-02-07

- ✅ 环形玩家布局重构 (Player Ring Layout)
  - **新建** `components/player-ring.js` — 环形玩家布局组件 (圆形定位算法、方向指示器、选择模式、跳过徽章)
  - **新建** `components/game-sidebar.js` — 侧边栏组件 (从 game-board.js 拆分，历史/聊天/设置标签页)
  - **重构** `layout/game-board.js` — 移除左侧玩家列表，集成 PlayerRing，PC 端左右布局 (玩家环形左侧 + 游戏内容右侧)
  - **增强** `components/player-avatar.js` — 添加 selectable/disabled/selected/isDead 状态，灵活徽章系统
  - **适配** `games/uno/ui.js` — 适配新布局，移除冗余方向指示器
  - **适配** `games/werewolf/ui.js` — 使用环形选择替代玩家网格
  - **样式** `theme/default.css` — 添加环形布局、玩家状态、徽章 CSS

- ✅ UNO 游戏修复
  - 修复 +4 无法响应 +2 的 bug (启用 stackDrawCards 默认值)
  - 修复玩家位置随方向变化的问题 (位置固定，仅指示器变化)
  - 修复方向箭头与玩家顺序相反的问题 (调整角度计算公式)
  - 修复跳过徽章不显示的问题 (showSkipBadge 调用顺序)
  - 移除方向指示器动画 (改为静态箭头)
  - 玩家自己固定在最下方位置

- ✅ UI 优化
  - Toast 提示位置上移 (避免遮盖操作按钮)
  - 玩家座位区域放大 (容器 360-480px，半径 140-200)
  - 文件拆分：game-board.js 从 1072 行拆分为 595 行 + game-sidebar.js 584 行

- ✅ 任务更新
  - T-F123 移动端适配任务添加游戏区域布局调整目标

- ✅ T-F124 游戏数据查询面板
  - 新建 `frontend/src/utils/api-client.js` — API 客户端工具 (fetchGames, get, post, ApiError, isApiConfigured)
  - 新建 `frontend/src/components/query-panel.js` — 查询面板组件 (模态框、游戏卡片网格、加载/错误状态、重试)
  - 修改 `frontend/src/layout/game-lobby.js` — 添加查询按钮 (🔍) 和事件绑定
  - 修改 `frontend/src/layout/waiting-room.js` — 添加查询按钮和事件绑定
  - 修改 `frontend/src/layout/game-board.js` — 添加查询按钮和事件绑定
  - 更新 `frontend/.env.example` — 添加 `VITE_API_URL` 环境变量

### 2026-02-06

- ✅ Render API 服务实现
  - **目录结构**: `api/` 完整 Express.js REST API
  - **核心文件**: `index.js`, `app.js`, `config.js`, 中间件 (CORS, auth, rate-limit, error-handler)
  - **服务层**: `supabase.js` (admin 客户端), `game-service.js`, `card-service.js`
  - **路由**: `/api/v1/health`, `/api/v1/games`, `/api/v1/games/:id/cards` 等
  - **数据库**: `cloud/migrations/002_create_card_data.sql` (games, card_categories, cards 表)
  - **部署**: `render.yaml` Render Blueprint 配置
  - **测试**: 21 个单元测试全部通过
  - **预留**: `stubs/ai-service.js` AI/MCP 接口占位

### 2026-02-05

- ✅ 云端后端实现 (Phase C1~C4 完成，手动测试通过)
  - **Phase C1 基础设施**: `cloud/` 目录、数据库迁移 SQL、`@supabase/supabase-js` 依赖、`.env` 环境变量、`supabase-client.js` 客户端单例
  - **Phase C2 用户认证**: `AuthService` 认证服务 (注册/登录/登出/profile)、`AuthPage` 登录注册 UI
  - **Phase C3 CloudNetworkClient**: Supabase Realtime Channel + Presence，完整消息类型映射 (GAME_ACTION→GAME_STATE_UPDATE, START_GAME→GAME_STARTED 等)，Host 判定 (最早 joinedAt)
  - **Phase C4 前端集成**: 大厅模式切换 (局域网/云端)、创建/加入房间对话框云端适配、`main.js` 双模式集成、用户信息展示与登出
  - 手动测试: 两个浏览器通过 Supabase 云端完成 UNO 对局

- ✅ 修复 AI 玩家操作同步 bug
  - `main.js` GAME_STATE_UPDATE handler 中 `!isAI` 条件导致非主机玩家跳过 AI 操作
  - 移除 `!isAI` 检查，确保所有客户端正确执行 AI 操作广播

- ✅ 云端后端开发计划完成
  - 新建 `docs/prd/cloud/PLAN.md` — 完整设计方案 (架构、数据库、接口、实现阶段)
  - 新建 `docs/prd/cloud/TASKS.md` — 任务清单 (T-C001~T-C043, 5 个阶段)
  - 更新 `CLAUDE.md` — 架构图增加云端模块、目录结构更新、文档引用
  - 更新 `PROGRESS.md` — 增加云端后端进度章节

- 方案概要:
  - Supabase Realtime (Channels + Presence) 替代自建 WebSocket 服务器
  - Supabase Auth 提供邮箱注册/登录
  - `CloudNetworkClient` 与现有 `NetworkClient` 接口一致
  - 现有本地后端和游戏逻辑完全不受影响

### 2026-01-31

- ✅ 预言家查验结果即时显示 & 玩家名标注身份
  - 修改 `games/werewolf/index.js` — 预言家提交查验后立即生成 `seer_result`（不再等到夜间结算）；新增 `seerChecks` 持久字段跨轮次记录查验结果；`getVisibleState()` 仅对预言家暴露 `seerChecks`
  - 修改 `games/werewolf/rules.js` — 移除 `resolveNightActions` 中的重复 `seer_result` 生成
  - 修改 `games/werewolf/ui.js` — 夜间面板新增 `_renderSeerResult()` 即时展示查验结果；`_displayName()` 根据 `seerChecks` 为被查验玩家名追加（狼人）/（好人）标注
  - 修改 `layout/game-board.js` — 左侧玩家列表同样根据 `seerChecks` 追加身份标注

- ✅ 修复玩家名过长被截断为省略号
  - 修改 `components/player-avatar.js` — 移除 `max-width: 80px`、`overflow: hidden`、`text-overflow: ellipsis` 限制，改用 `word-break: break-word` 允许换行

- ✅ 狼人杀顺序夜间阶段 (Sequential Night Phases)
  - 修改 `games/werewolf/index.js` — 新增 `nightSteps`/`currentNightStep` 状态字段，`_buildNightSteps()`、`_getNightStepLabel()`、`_advanceNightStep()` 方法；按优先级分步执行夜间行动（预言家→医生→狼人→女巫）；女巫阶段开始时注入狼人击杀目标；`getVisibleState()` 暴露 `nightSteps`、`currentNightStep`、`wolfVotes`
  - 修改 `games/werewolf/rules.js` — 导出 `resolveWolfConsensus`；`validateNightAction` 增加 `pendingNightRoles` 步骤校验；`resolveNightActions` 移除 `witch_night_info`（改由引擎在步骤推进时注入）
  - 修改 `games/werewolf/ui.js` — 新增 `_renderNightProgress()` 步骤进度条、`_renderWolfVotes()` 队友投票展示；夜间面板根据当前步骤显示行动/等待状态；修复"确认行动"按钮点击无响应 bug（`_createButton` 在 `disabled=true` 时未注册点击事件）
  - 修改 `layout/game-board.js` — 历史侧栏增加狼人杀行动类型渲染（夜间行动、投票、发言等）
  - 修改 `games/werewolf/index.test.js` — 所有夜间测试按优先级顺序提交行动；新增 8 项顺序夜间步骤测试（步骤构建、推进、越步拒绝、狼人投票可见性、女巫信息时机等）；测试总数 74→82

- ✅ 狼人杀角色配置面板 (RoleSetupPanel)
  - 新建 `components/role-setup-panel.js` — 可复用角色人数编辑/展示组件 (分层角色组、+/- 按钮、验证、团队颜色、紧凑只读模式)
  - 修改 `components/game-settings-modal.js` — 当游戏有 `defaultRoleCounts` 时嵌入可编辑角色配置面板，确认输出包含 roleCounts
  - 修改 `main.js` — 创建房间对话框中将玩家人数下拉替换为角色配置总人数静态显示
  - 修改 `layout/waiting-room.js` — 新增「角色配置」卡片 (房主可编辑/非房主只读)，动态更新 maxPlayers、开始按钮、标题
  - 修改 `layout/game-board.js` — 设置侧栏中展示只读紧凑角色配置面板
  - UNO 不受影响 (无 defaultRoleCounts)

- ✅ 新增任务 T-F123 移动端响应式布局适配 (中优先级)

### 2026-01-30

- ✅ T-F071~T-F073 狼人杀核心框架
  - `games/werewolf/index.js` — WerewolfGame 类 (阶段状态机、夜间行动收集/结算、白天讨论/投票、死亡触发、信息隐藏)
  - `games/werewolf/rules.js` — 结构化夜间结算 (保护优先级、医生阻挡狼人击杀、女巫毒药绕过保护)、狼人共识、预言家查验、getWolfTarget 辅助函数
  - `games/werewolf/ui.js` — WerewolfUI (夜间行动面板、白天公告/讨论/投票、猎人开枪、结算揭示、亡者聊天、可复用玩家选择网格)
  - `main.js` — 注册狼人杀游戏并挂载 WerewolfUI

- ✅ T-F076 P0 基础角色实现 (6 角色)
  - 村民、狼人、预言家、医生、猎人、女巫
  - 夜间行动验证、结算、保护优先级、猎人死亡触发

- ✅ T-F074 P0 角色单元测试 (74 tests)
  - 初始化、夜间行动验证、女巫验证、白天投票验证
  - 夜间结算 (击杀/保护/预言家/女巫救人/毒杀)
  - 白天流程 (公告→讨论→投票)、猎人开枪、亡者聊天
  - 胜利条件、信息隐藏 (getVisibleState)
  - 完整游戏流程集成测试 (好人胜利 + 狼人胜利)

- ⚠️ 狼人杀尚未进行手动端到端测试 (UI 渲染、多人联机流程待验证)

- ✅ T-F070 狼人杀配置 `games/werewolf/config.json`
  - 游戏元数据 (6-20人, multiplayer, 无AI支持)
  - 所有角色配置 (P0-P3, 45+ 角色)
  - 夜间行动优先级 (12 级)
  - 默认角色配置表 (按玩家人数)
  - 完整 settingsSchema (游戏规则配置)

### 2026-01-28

- ✅ 修复后端服务器 Windows 启动问题
  - `backend/server/index.js` 主模块检测路径格式错误
  - 使用 `fileURLToPath` 替代手动路径拼接，实现跨平台兼容

- ✅ 狼人杀规则文档完善
  - `docs/games/werewolf/RULES.md` 完整规则 (30+ 角色、12 级夜间优先级、保护规则详解)
  - `docs/games/werewolf/PLAN.md` 更新状态为"文档完成，待开发"
  - `frontend/public/rules/werewolf.html` 新增进阶角色、领袖机制、投票规则、保护规则说明

### 2026-01-27

- ✅ T-F111 工具函数单元测试 (109 tests)
  - `storage.test.js` - 存储工具测试 (34 tests)
  - `validators.test.js` - 验证工具测试 (75 tests)
  - 包含 localStorage/sessionStorage 模拟、FileReader 模拟

- ✅ 狼人杀开发准备
  - `docs/games/werewolf/RULES.md` - AI 规则文档 (27+ 角色, 完整规则)
  - `docs/games/werewolf/PLAN.md` - 开发计划
  - `frontend/public/rules/werewolf.html` - 用户规则书 (完整内容)
  - 更新 CLAUDE.md 集成 `docs/games/TEMPLATE.md` 引用
  - 整合 werewolf_ref/ 参考资料并删除

- ✅ T-F110 前端核心模块单元测试 (160 tests)
  - `registry.test.js` - 游戏注册表测试 (22 tests)
  - `rules.test.js` - 规则引擎测试 (36 tests)
  - `engine.test.js` - 游戏引擎基类测试 (47 tests)
  - `network.test.js` - WebSocket 客户端测试 (55 tests)
  - 包含 WebSocket 模拟、定时器模拟、事件测试

- ✅ T-F100 渲染性能优化
  - 新增 `render-scheduler.js` 工具 (scheduleRender, debounce, throttle)
  - UNO UI 重构：CSS 类替代内联样式、事件委托、requestAnimationFrame 批量更新
  - 游戏大厅搜索防抖 (150ms)
  - 新增 UNO 卡牌 CSS 类系统 (~80 行 CSS)

### 2026-01-26 (第三批)

- ✅ 修复 UNO 叠加 bug：+4 现在可以响应 +2
- ✅ 更新 getPlayableCards 支持叠加模式显示可用牌
- ✅ 新增 7 个叠加相关单元测试 (总计 126 tests)
- ✅ 更新规则文档 (RULES.md, config.json)
- ✅ 添加桌面应用打包任务到可选功能 (T-F120-T-F122)

### 2026-01-26 (第二批)

- ✅ T-B071 心跳超时检测 (90秒无活动断开)
- ✅ T-B051 服务器集成测试 (14 tests)
- ✅ 新增 updateActivity 和 getTimedOutConnections 方法
- ✅ 修复 index.js 避免导入时自动启动服务器

### 2026-01-26 (第一批)

- ✅ T-B021 连接管理器单元测试 (22 tests)
- ✅ T-B031 房间管理器单元测试 (26 tests)
- ✅ T-B041 消息路由器单元测试 (45 tests)
- ✅ T-B061-T-B069 消息处理测试 (包含在 T-B041)
- ✅ T-B081 断开处理测试 (包含在 T-B041)
- ✅ T-B082 房主断开处理 (已实现)
- ✅ T-B092 全局异常捕获 (已实现)
- ✅ T-B093 优雅关闭 (已实现)

---

## 图例

- ✅ 完成
- 🔶 进行中/部分完成
- ⬜ 未开始
