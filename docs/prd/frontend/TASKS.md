# 前端开发任务清单 - AI Coding 专用

> 本文档为 AI 编程助手提供结构化的任务清单，按优先级和依赖关系排列。

---

## 当前进度概览

| Phase | 进度 | 说明 |
|-------|------|------|
| Phase 1: 核心框架 | ✅ 完成 | 项目结构、引擎、网络、工具函数 |
| Phase 2: UI 组件 | ✅ 完成 | 布局组件、通用组件 |
| Phase 3: 游戏实现 | 🔶 部分完成 | UNO 已完成，狼人杀 P0 已完成 (未经手动测试) |
| Phase 4: 联机功能 | ✅ 完成 | 房间管理、游戏同步 |
| Phase 5: 优化与测试 | 🔶 部分完成 | 性能优化、测试 |

### 狼人杀开发进度

| 任务 ID | 描述 | 优先级 | 状态 |
|---------|------|--------|------|
| T-F070~073 | 核心框架 (config/index/rules/ui) | P0 | ✅ 完成 (4/4) |
| T-F076 | P0 基础角色 (6 角色) | P0 | ✅ 完成 |
| T-F074 | P0 角色单元测试 (74 tests) | P0 | ✅ 完成 |
| T-F075 | 集成测试 (手动端到端) | P1 | ⬜ 待开发 |
| T-F077 | P1 进阶角色 (7 角色) | P1 | ⬜ 待开发 |
| T-F078 | P2 高级角色 (11 角色) | P2 | ⬜ 待开发 |
| T-F079 | P3 扩展角色 (21 角色) | P3 | ⬜ 待开发 |

> 详细计划见: `docs/games/werewolf/PLAN.md`

---

## Phase 1: 核心框架 (P0)

### 1.1 项目初始化

- [x] **T-F001** 创建项目目录结构
  ```
  frontend/
  ├── index.html
  ├── src/
  │   ├── game/
  │   ├── games/
  │   ├── layout/
  │   ├── components/
  │   ├── theme/
  │   └── utils/
  └── public/
      └── rules/
  ```

- [x] **T-F002** 创建入口页面 `index.html`
  - 基础 HTML5 结构
  - 引入 CSS 和 JS (通过 Vite)
  - 设置 viewport 和 charset

- [x] **T-F003** 创建 CSS 设计系统 `theme/variables.css`
  - 颜色变量 (primary, success, warning, error)
  - 间距变量 (spacing-1 到 spacing-12)
  - 圆角变量 (radius-sm, radius-base, radius-lg, radius-full)
  - 字号变量 (text-xs 到 text-4xl)
  - 阴影变量、渐变变量

- [x] **T-F004** 创建默认主题 `theme/default.css`
  - 基于 variables.css
  - 全局样式重置
  - 基础组件样式 (btn, card, input 等)
  - 动画 keyframes

---

### 1.2 核心游戏引擎

- [x] **T-F010** 创建游戏引擎基类 `game/engine.js`
  ```javascript
  class GameEngine extends EventEmitter {
    constructor(mode = 'offline')
    initialize(config) // 初始化游戏
    processMove(move, state) // 处理操作
    checkGameEnd(state) // 检查结束
    getNextPlayer(state) // 获取下一个玩家
    executeMove(move) // 执行操作并触发事件
    enrichMoveForHistory(move, state) // 丰富历史记录数据
  }
  ```

- [x] **T-F011** 创建规则引擎 `game/rules.js`
  - 通用规则验证框架
  - 规则组合和链式验证

- [x] **T-F012** 创建游戏注册表 `game/registry.js`
  ```javascript
  function registerGame(id, GameClass, config)
  function createGame(gameType, mode)
  function getGameList()
  function hasGame(id)
  ```

---

### 1.3 网络客户端

- [x] **T-F020** 创建 WebSocket 客户端 `game/network.js`
  ```javascript
  class NetworkClient {
    constructor(serverUrl)
    async connect() // 建立连接
    send(type, data) // 发送消息
    onMessage(type, handler) // 注册处理器
    disconnect() // 断开连接
    joinRoom(roomId, nickname, gameType)
    leaveRoom()
    startGame(gameType, options)
    sendGameAction(actionType, actionData)
    sendChat(message)
  }
  ```

- [x] **T-F021** 实现心跳机制
  - 每 30 秒发送 PING
  - 接收 PONG 更新延迟
  - 超时断开连接

- [x] **T-F022** 实现错误处理
  - 解析 ERROR 消息
  - 根据 severity 级别处理
  - fatal 级别断开连接

---

### 1.4 工具函数

- [x] **T-F030** 创建存储工具 `utils/storage.js`
  ```javascript
  function saveConfig(config)
  function loadConfig()
  function getDefaultConfig()
  function saveSessionData(key, value)
  function loadSessionData(key)
  ```

- [x] **T-F031** 创建验证工具 `utils/validators.js`
  ```javascript
  function validateMessage(message)
  function validatePlayerId(id)
  function validateNickname(name)
  function validateRoomId(id)
  ```

- [x] **T-F032** 创建事件发射器 `utils/event-emitter.js`
  ```javascript
  class EventEmitter {
    on(event, handler)
    once(event, handler)
    off(event, handler)
    emit(event, ...args)
    clear()
  }
  ```

---

## Phase 2: UI 组件 (P1)

### 2.1 布局组件

- [x] **T-F040** 创建游戏大厅 `layout/game-lobby.js`
  - 显示游戏列表 (卡片式)
  - 游戏筛选和搜索
  - 创建/加入游戏按钮
  - 规则查看按钮

- [x] **T-F041** 创建等待大厅 `layout/waiting-room.js`
  - 显示玩家列表
  - 显示房间信息
  - 开始游戏按钮 (仅房主)
  - 简单聊天功能

- [x] **T-F042** 创建游戏棋盘容器 `layout/game-board.js`
  - 通用游戏容器
  - 玩家信息侧边栏
  - 操作区域
  - 历史记录面板 (带详细卡牌信息)
  - 规则查看按钮

- [x] **T-F043** 创建设置面板 `layout/settings-panel.js`
  - 图形设置 (分辨率、全屏、画质)
  - 音频设置 (音量滑块)
  - 语言设置
  - 昵称设置

- [x] **T-F044** 创建结算界面 `layout/game-result.js`
  - 显示排名
  - 详细得分
  - 再来一局按钮
  - 返回大厅按钮

---

### 2.2 通用组件

- [x] **T-F050** 创建模态框组件 `components/modal.js`
  ```javascript
  class Modal {
    show(content, options)
    hide()
    confirm(title, message) // Promise<boolean>
  }
  function getModal() // 获取单例
  ```

- [x] **T-F051** 创建通知组件 `components/notification.js`
  ```javascript
  function showNotification(message, type)
  function showToast(message, duration)
  ```

- [x] **T-F052** 创建加载指示器 `components/loading.js`
  ```javascript
  function showLoading(message)
  function hideLoading()
  ```

- [x] **T-F053** 创建玩家头像组件 `components/player-avatar.js`
  ```javascript
  class PlayerAvatar {
    render()
    setOnline(isOnline)
    setCurrentTurn(isCurrent)
  }
  ```

- [x] **T-F054** 创建游戏设置弹窗 `components/game-settings-modal.js` ⭐ 新增
  ```javascript
  class GameSettingsModal {
    constructor(options) // gameConfig, mode, onConfirm, onCancel
    mount(container)
    destroy()
    getSettings()
  }
  ```
  - 根据 `settingsSchema` 自动生成配置界面
  - 支持 boolean (开关)、number (滑块)、select (下拉) 类型
  - 单机模式支持配置 AI 玩家数量

---

## Phase 3: 游戏实现 (P0)

### 3.1 UNO 游戏

- [x] **T-F060** 创建 UNO 配置 `games/uno/config.json`
  ```json
  {
    "id": "uno",
    "name": "UNO",
    "minPlayers": 2,
    "maxPlayers": 8,
    "difficulty": "easy",
    "estimatedTime": 30,
    "settingsSchema": { ... }
  }
  ```
  - 包含可配置选项 schema

- [x] **T-F061** 创建 UNO 游戏类 `games/uno/index.js`
  ```javascript
  class UnoGame extends GameEngine {
    initialize(config) // 初始化牌堆、发牌
    processMove(move, state) // 处理出牌、摸牌
    checkGameEnd(state) // 有人手牌为0
    validateMove(move, state) // 验证出牌规则
    enrichMoveForHistory(move, state) // 存储卡牌详情
    getVisibleState(playerId) // 获取玩家可见状态
  }
  ```
  - 操作类型: PLAY_CARD, DRAW_CARD, SKIP_TURN, CALL_UNO, CHALLENGE_UNO
  - 支持自定义游戏选项

- [x] **T-F062** 创建 UNO 规则 `games/uno/rules.js`
  ```javascript
  canPlayCard(card, topCard, currentColor)
  applyCardEffect(card, state, chosenColor)
  shouldCallUno(hand)
  forgotUno(hand, calledUno)
  getUnoPenalty(customPenalty)
  calculateHandScore(hand)
  generateDeck()
  shuffleDeck(array)
  getCardDisplayText(card)
  getColorName(color)
  ```
  - 支持叠加 +2/+4 规则

- [x] **T-F063** 创建 UNO UI `games/uno/ui.js`
  ```javascript
  class UnoUI {
    render(state, playerId, onAction)
    renderActions(state, playerId, onAction)
    updateState(state)
  }
  ```
  - 手牌扇形展示
  - 颜色选择器 (万能牌)
  - UNO 喊叫按钮

- [x] **T-F065** 创建 UNO 游戏设置 ⭐ 新增
  - 初始手牌数 (3-15)
  - 允许叠加 +2/+4
  - 强制出牌
  - 忘喊 UNO 罚牌数 (1-4)
  - 摸到能出为止
  - 7 换牌 / 0 轮转 (预留)

- [x] **T-F064** UNO 单元测试
  - 测试出牌规则
  - 测试特殊牌效果
  - 测试胜利判定
  - 覆盖率: 80%+ (116 tests passing)

---

### 3.2 狼人杀游戏 (开发中)

> **文档状态**: ✅ 已完成 (RULES.md + werewolf.html)
> **详细开发计划**: 见 `docs/games/werewolf/PLAN.md`

#### 核心框架 (P0)

- [x] **T-F070** 创建狼人杀配置 `games/werewolf/config.json` ✅
  - 游戏元数据、gameType: "multiplayer"、supportsAI: false
  - 所有角色配置 (P0-P3)、settingsSchema、夜间行动优先级

- [x] **T-F071** 创建狼人杀游戏类 `games/werewolf/index.js` ✅
  - WerewolfGame extends GameEngine
  - 阶段管理 (夜晚/白天/投票)
  - getVisibleState() 信息隐藏

- [x] **T-F072** 创建狼人杀规则基础框架 `games/werewolf/rules.js` ✅
  - 结构化夜间结算 (保护优先级)
  - 通用行动/投票验证逻辑

- [x] **T-F073** 创建狼人杀 UI `games/werewolf/ui.js` ✅
  - WerewolfUI 类
  - 夜晚/白天/投票界面

#### 角色实现 (按优先级分批)

- [x] **T-F076** 实现 P0 基础角色 (6 角色) ✅
  - 村民 `villager`、狼人 `werewolf`、预言家 `seer`
  - 医生 `doctor`、猎人 `hunter`、女巫 `witch`
  - 验收: 基础游戏流程完整、胜利条件正确

- [ ] **T-F077** 实现 P1 进阶角色 (7 角色)
  - 守卫 `bodyguard`、丘比特 `cupid`、警长 `sheriff`
  - 私刑者 `vigilante`、白痴 `idiot`、魔笛手 `piper`、队长 `captain`
  - 验收: 恋人机制、中立阵营胜利条件

- [ ] **T-F078** 实现 P2 高级角色 (11 角色)
  - 守护天使、狱卒、小偷、侦探、炸弹人、小女孩
  - 追踪者、守望者、先知、共济会、酒保
  - 验收: 复杂交互正确

- [ ] **T-F079** 实现 P3 扩展角色 (21 角色)
  - 磨坊主、教父、狼王、连环杀手、司机、邪教领袖等
  - 狼人阵营扩展角色 (狼人首领/巫师/先知/守卫)
  - 验收: 所有角色可用

#### 测试

- [x] **T-F074** P0 角色单元测试 (74 tests) ✅
- [ ] **T-F075** 集成测试 - 手动端到端游戏流程 (依赖 T-F073)

---

## Phase 4: 联机功能 (P1)

### 4.1 房间管理

- [x] **T-F080** 实现创建房间功能
  - 输入服务器地址
  - 生成房间 ID
  - 设置游戏参数

- [x] **T-F081** 实现加入房间功能
  - 输入服务器地址
  - 输入房间 ID
  - 输入昵称
  - 连接状态反馈

- [x] **T-F082** 实现玩家列表同步
  - 监听 PLAYER_JOINED
  - 监听 PLAYER_LEFT
  - 更新 UI

---

### 4.2 游戏同步

- [x] **T-F090** 实现游戏状态同步
  - 监听 GAME_STATE_UPDATE
  - 更新本地状态
  - 更新 UI

- [x] **T-F091** 实现操作发送
  - 发送 GAME_ACTION
  - 等待确认
  - 本地更新

- [x] **T-F092** 实现聊天功能
  - 发送 CHAT_MESSAGE
  - 显示聊天记录

---

## Phase 5: 优化与测试 (P2)

### 5.1 性能优化

- [x] **T-F100** 优化渲染性能
  - 使用 requestAnimationFrame
  - 减少 DOM 操作
  - 虚拟列表 (如需)

- [ ] **T-F101** 优化网络性能
  - 消息压缩
  - 防抖/节流

- [ ] **T-F102** 优化资源加载
  - 懒加载游戏模块
  - 资源预加载

---

### 5.2 测试

- [x] **T-F110** 编写核心模块单元测试 (160 tests)
  - game/engine.js (47 tests)
  - game/rules.js (36 tests)
  - game/network.js (55 tests)
  - game/registry.js (22 tests)

- [x] **T-F111** 编写工具函数测试 (109 tests) ✅
  - utils/storage.js (34 tests)
  - utils/validators.js (75 tests)

- [ ] **T-F112** 编写集成测试
  - 游戏流程测试
  - 网络通信测试

---

## 文档要求

### 游戏开发前置文档

> **重要**: 开发任何新游戏前必须完成以下文档

- [x] **T-F-DOC-001** 创建 AI 规则文档模板 `docs/games/TEMPLATE.md`
- [x] **T-F-DOC-002** 创建 UNO AI 规则文档 `docs/games/uno/RULES.md`
- [x] **T-F-DOC-003** 创建 UNO 用户规则书 `frontend/public/rules/uno.html`

---

## 任务依赖图

```
T-F001 → T-F002 → T-F003 → T-F004
              ↓
         T-F010 → T-F011 → T-F012
              ↓         ↓
         T-F020 ← ← ← ← ←
              ↓
T-F030 → T-F040 → T-F041 → T-F042 → T-F054
              ↓
    T-F-DOC → T-F060 → T-F061 → T-F062 → T-F063 → T-F065
              ↓
         T-F080 → T-F081 → T-F090 → T-F091
```

---

## 验收标准

### 代码质量

- [x] 所有函数都有 JSDoc 注释
- [x] 遵循命名规范
- [x] 单文件不超过 500 行
- [ ] 无 ESLint 错误

### 功能验收

- [x] 单机模式可独立运行
- [x] 联机模式正常通信 (需后端支持)
- [x] 游戏规则正确执行
- [x] UI 响应流畅
- [x] 游戏设置功能正常

### 测试覆盖

- [ ] 游戏逻辑覆盖率 > 80%
- [ ] 工具函数覆盖率 > 90%
- [ ] 所有测试通过

---

## AI 编程提示

### 创建新游戏

```
请基于 docs/prd/frontend/README.md 中的游戏开发前置要求，
创建一个新的 [游戏名称] 游戏：

1. 先创建 docs/games/[game-name]/RULES.md AI 规则文档
2. 创建 frontend/public/rules/[game-name].html 用户规则书
3. 然后创建游戏代码：
   - config.json 配置文件 (包含 settingsSchema)
   - index.js 游戏类 (继承 GameEngine)
   - rules.js 游戏规则
   - ui.js UI 组件
```

### 添加游戏设置选项

```
请为 [游戏名称] 添加新的游戏设置选项：
1. 在 config.json 的 settingsSchema 中添加选项定义
2. 在 index.js 中读取并使用该选项
3. 更新 docs/games/[game-name]/RULES.md 文档
```

### 实现 UI 组件

```
请基于 docs/prd/frontend/README.md 中的 UI 组件模板，
创建 [组件名称] 组件，要求：
1. 使用 CSS Variables
2. 支持事件绑定
3. 添加 JSDoc 注释
```

### 实现网络功能

```
请基于 docs/PROTOCOL.md 中的消息格式，
实现 [功能名称] 的网络通信，包括：
1. 发送消息的方法
2. 监听服务器响应
3. 错误处理
```

---

## Phase 6: 可选功能 (Optional)

> 以下功能为可选扩展，不影响核心游戏体验。

### 6.1 桌面应用打包

- [ ] **T-F120** Electron 桌面应用打包
  - 将前端 + 后端打包为独立可执行文件
  - 用户无需安装编程环境即可运行
  - 支持 Windows (.exe)、macOS (.app)、Linux (.AppImage)

  **技术方案：**
  | 方案 | 打包大小 | 说明 |
  |------|---------|------|
  | Electron (推荐) | ~150MB+ | 成熟稳定，可同时打包前后端 |
  | Tauri | ~10-20MB | 轻量，需 Rust 环境 |
  | Neutralino | ~5-10MB | 极轻量，功能有限 |

  **实现步骤：**
  1. 初始化 Electron 项目结构
  2. 主进程启动后端 WebSocket 服务器
  3. 创建浏览器窗口加载前端页面
  4. 使用 electron-builder 打包

  **目录结构：**
  ```
  electron-app/
  ├── main.js          # Electron 主进程
  ├── preload.js       # 预加载脚本
  ├── package.json     # Electron 依赖
  ├── frontend/        # Vite 构建产物
  └── backend/         # 后端服务器代码
  ```

- [ ] **T-F121** 自动更新功能
  - 集成 electron-updater
  - 支持自动检查和下载更新

- [ ] **T-F122** 系统托盘支持
  - 最小化到系统托盘
  - 托盘菜单快捷操作
