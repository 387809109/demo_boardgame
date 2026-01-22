# 前端开发任务清单 - AI Coding 专用

> 本文档为 AI 编程助手提供结构化的任务清单，按优先级和依赖关系排列。

---

## Phase 1: 核心框架 (P0)

### 1.1 项目初始化

- [ ] **T-F001** 创建项目目录结构
  ```
  board-game-client/
  ├── index.html
  ├── game/
  ├── games/
  ├── layout/
  ├── theme/
  └── utils/
  ```

- [ ] **T-F002** 创建入口页面 `index.html`
  - 基础 HTML5 结构
  - 引入 CSS 和 JS
  - 设置 viewport 和 charset

- [ ] **T-F003** 创建 CSS 设计系统 `theme/variables.css`
  - 颜色变量 (primary, success, warning, error)
  - 间距变量 (spacing-1 到 spacing-8)
  - 圆角变量 (radius-sm, radius-base, radius-lg)
  - 字号变量 (text-xs 到 text-2xl)
  - 阴影变量

- [ ] **T-F004** 创建默认主题 `theme/default.css`
  - 基于 variables.css
  - 全局样式重置
  - 基础组件样式

---

### 1.2 核心游戏引擎

- [ ] **T-F010** 创建游戏引擎基类 `game/engine.js`
  ```javascript
  class GameEngine {
    constructor(mode = 'offline')
    initialize(config) // 初始化游戏
    processMove(move, state) // 处理操作
    checkGameEnd(state) // 检查结束
    getNextPlayer(state) // 获取下一个玩家
  }
  ```
  - 依赖: 无
  - 输入: GameConfig
  - 输出: GameState

- [ ] **T-F011** 创建规则引擎 `game/rules.js`
  ```javascript
  class RuleValidator {
    validateMove(move, state, rules) // 验证操作
    applyRule(rule, state) // 应用规则
  }
  ```
  - 依赖: T-F010
  - 输入: Move, GameState, Rule[]
  - 输出: { valid: boolean, error?: string }

- [ ] **T-F012** 创建游戏注册表 `game/registry.js`
  ```javascript
  const gameRegistry = new Map();
  function registerGame(id, GameClass)
  function createGame(gameType, config)
  function getGameList()
  ```
  - 依赖: T-F010

---

### 1.3 网络客户端

- [ ] **T-F020** 创建 WebSocket 客户端 `game/network.js`
  ```javascript
  class NetworkClient {
    constructor(serverUrl)
    async connect() // 建立连接
    send(type, data) // 发送消息
    on(messageType, handler) // 注册处理器
    disconnect() // 断开连接
  }
  ```
  - 依赖: 无
  - 协议: 参考 PROTOCOL.md

- [ ] **T-F021** 实现心跳机制
  - 每 30 秒发送 PING
  - 接收 PONG 更新延迟
  - 超时断开连接

- [ ] **T-F022** 实现错误处理
  - 解析 ERROR 消息
  - 根据 severity 级别处理
  - fatal 级别断开连接

---

### 1.4 工具函数

- [ ] **T-F030** 创建存储工具 `utils/storage.js`
  ```javascript
  function saveConfig(config)
  function loadConfig()
  function getDefaultConfig()
  function saveSessionData(key, value)
  function loadSessionData(key)
  function exportConfig() // 导出为 JSON 文件
  function importConfig(file) // 从文件导入
  ```

- [ ] **T-F031** 创建验证工具 `utils/validators.js`
  ```javascript
  function validateMessage(message) // 验证消息格式
  function validatePlayerId(id)
  function validateNickname(name)
  function validateRoomId(id)
  ```

- [ ] **T-F032** 创建事件发射器 `utils/event-emitter.js`
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

- [ ] **T-F040** 创建游戏大厅 `layout/game-lobby.js`
  - 显示游戏列表
  - 游戏筛选和搜索
  - 创建/加入游戏按钮
  - 依赖: T-F012

- [ ] **T-F041** 创建等待大厅 `layout/waiting-room.js`
  - 显示玩家列表
  - 显示房间信息
  - 开始游戏按钮 (仅房主)
  - 简单聊天功能
  - 依赖: T-F020

- [ ] **T-F042** 创建游戏棋盘容器 `layout/game-board.js`
  - 通用游戏容器
  - 玩家信息面板
  - 操作区域
  - 历史记录面板
  - 依赖: T-F010

- [ ] **T-F043** 创建设置面板 `layout/settings-panel.js`
  - 图形设置 (分辨率、全屏)
  - 音频设置 (音量滑块)
  - 语言设置
  - 昵称设置
  - 依赖: T-F030

- [ ] **T-F044** 创建结算界面 `layout/game-result.js`
  - 显示排名
  - 详细得分
  - 游戏统计
  - 返回大厅按钮

---

### 2.2 通用组件

- [ ] **T-F050** 创建模态框组件
  ```javascript
  class Modal {
    show(content, options)
    hide()
    confirm(title, message) // Promise<boolean>
  }
  ```

- [ ] **T-F051** 创建通知组件
  ```javascript
  function showNotification(message, type) // type: 'info' | 'success' | 'warning' | 'error'
  function showToast(message, duration)
  ```

- [ ] **T-F052** 创建加载指示器
  ```javascript
  function showLoading(message)
  function hideLoading()
  ```

- [ ] **T-F053** 创建玩家头像组件
  ```javascript
  class PlayerAvatar {
    render(player)
    setOnline(isOnline)
    setCurrentTurn(isCurrent)
  }
  ```

---

## Phase 3: 游戏实现 (P0)

### 3.1 UNO 游戏

- [ ] **T-F060** 创建 UNO 配置 `games/uno/config.json`
  ```json
  {
    "id": "uno",
    "name": "UNO",
    "minPlayers": 2,
    "maxPlayers": 8,
    "difficulty": "easy",
    "estimatedTime": 30
  }
  ```

- [ ] **T-F061** 创建 UNO 游戏类 `games/uno/index.js`
  ```javascript
  class UnoGame extends BoardGame {
    initialize(config) // 初始化牌堆、发牌
    processMove(move, state) // 处理出牌、摸牌
    checkGameEnd(state) // 有人手牌为0
    validateMove(move, state) // 验证出牌规则
  }
  ```
  - 操作类型: PLAY_CARD, DRAW_CARD, SKIP_TURN, CALL_UNO

- [ ] **T-F062** 创建 UNO 规则 `games/uno/rules.js`
  ```javascript
  const unoRules = {
    canPlayCard(card, topCard) // 颜色或数字匹配
    applyCardEffect(card, state) // +2, +4, 反转, 跳过
    checkUnoCall(playerHand) // 检查是否需要喊 UNO
  }
  ```

- [ ] **T-F063** 创建 UNO UI `games/uno/ui.js`
  ```javascript
  class UnoUI {
    render(state) // 渲染游戏界面
    renderHand(cards) // 渲染手牌
    renderDiscardPile(card) // 渲染弃牌堆
    renderColorPicker() // 选择颜色 (万能牌)
  }
  ```

- [ ] **T-F064** UNO 单元测试
  - 测试出牌规则
  - 测试特殊牌效果
  - 测试胜利判定
  - 覆盖率: 80%+

---

### 3.2 狼人杀游戏 (Phase 2)

- [ ] **T-F070** 创建狼人杀配置 `games/werewolf/config.json`

- [ ] **T-F071** 创建狼人杀游戏类 `games/werewolf/index.js`
  - 角色分配
  - 夜晚/白天阶段
  - 投票机制

- [ ] **T-F072** 创建狼人杀规则 `games/werewolf/rules.js`
  - 角色技能
  - 胜利条件

- [ ] **T-F073** 创建狼人杀 UI `games/werewolf/ui.js`

---

## Phase 4: 联机功能 (P1)

### 4.1 房间管理

- [ ] **T-F080** 实现创建房间功能
  - 生成房间 ID
  - 显示本机 IP
  - 设置游戏参数

- [ ] **T-F081** 实现加入房间功能
  - 输入 IP 地址
  - 输入昵称
  - 连接状态反馈

- [ ] **T-F082** 实现玩家列表同步
  - 监听 PLAYER_JOINED
  - 监听 PLAYER_LEFT
  - 更新 UI

---

### 4.2 游戏同步

- [ ] **T-F090** 实现游戏状态同步
  - 监听 GAME_STATE_UPDATE
  - 更新本地状态
  - 更新 UI

- [ ] **T-F091** 实现操作发送
  - 发送 GAME_ACTION
  - 等待确认
  - 乐观更新

- [ ] **T-F092** 实现聊天功能
  - 发送 CHAT_MESSAGE
  - 显示聊天记录

---

## Phase 5: 优化与测试 (P2)

### 5.1 性能优化

- [ ] **T-F100** 优化渲染性能
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

- [ ] **T-F110** 编写核心模块单元测试
  - game/engine.js
  - game/rules.js
  - game/network.js

- [ ] **T-F111** 编写工具函数测试
  - utils/storage.js
  - utils/validators.js

- [ ] **T-F112** 编写集成测试
  - 游戏流程测试
  - 网络通信测试

---

## 任务依赖图

```
T-F001 → T-F002 → T-F003 → T-F004
              ↓
         T-F010 → T-F011 → T-F012
              ↓         ↓
         T-F020 ← ← ← ← ←
              ↓
T-F030 → T-F040 → T-F041 → T-F042
              ↓
         T-F060 → T-F061 → T-F062 → T-F063
              ↓
         T-F080 → T-F081 → T-F090 → T-F091
```

---

## 验收标准

### 代码质量

- [ ] 所有函数都有 JSDoc 注释
- [ ] 遵循命名规范
- [ ] 单文件不超过 500 行
- [ ] 无 ESLint 错误

### 功能验收

- [ ] 单机模式可独立运行
- [ ] 联机模式正常通信
- [ ] 游戏规则正确执行
- [ ] UI 响应流畅

### 测试覆盖

- [ ] 游戏逻辑覆盖率 > 80%
- [ ] 工具函数覆盖率 > 90%
- [ ] 所有测试通过

---

## AI 编程提示

### 创建新游戏

```
请基于 docs/prd/frontend/README.md 中的游戏类模板，
创建一个新的 [游戏名称] 游戏，包括：
1. config.json 配置文件
2. index.js 游戏类 (继承 BoardGame)
3. rules.js 游戏规则
4. ui.js UI 组件
5. 单元测试
```

### 实现 UI 组件

```
请基于 docs/AI_CODING_GUIDE.md 中的 UI 组件模板，
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
