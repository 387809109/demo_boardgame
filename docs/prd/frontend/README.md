# 前端开发 PRD - AI Coding 专用

> 本文档专为 AI 编程助手优化，提供结构化的开发需求和代码规范。

## 项目概述

**项目名称**: 桌游集成客户端（前端）
**技术栈**: HTML5 + CSS3 + JavaScript (ES6+)
**运行环境**: 现代浏览器 (Chrome 91+, Edge 91+, Safari 16.4+)
**开发工具**: Vite 5.x (可选)

---

## 核心职责

前端负责以下模块：

| 目录 | 职责 | 优先级 |
|------|------|--------|
| `game/` | 核心游戏引擎、规则引擎、网络客户端 | P0 |
| `games/` | 各个桌游实现 (UNO, 狼人杀等) | P0 |
| `layout/` | UI 布局组件 (大厅、游戏板、设置面板) | P1 |
| `theme/` | CSS 主题和设计系统 | P1 |
| `utils/` | 工具函数 (存储、验证) | P2 |

---

## 目录结构

```
board-game-client/
├── index.html              # 主入口
├── game/                   # 核心引擎
│   ├── engine.js          # 游戏主循环和状态管理
│   ├── rules.js           # 通用规则验证框架
│   ├── network.js         # WebSocket 客户端
│   └── registry.js        # 游戏注册表
├── games/                  # 桌游模块
│   ├── uno/               # UNO 游戏
│   │   ├── index.js       # 游戏类
│   │   ├── config.json    # 配置
│   │   ├── rules.js       # UNO 规则
│   │   └── ui.js          # UI 组件
│   └── werewolf/          # 狼人杀 (待开发)
├── layout/                 # UI 组件
│   ├── game-lobby.js      # 游戏大厅
│   ├── game-board.js      # 游戏棋盘
│   └── settings-panel.js  # 设置面板
├── theme/                  # 主题
│   ├── variables.css      # CSS 变量
│   ├── default.css        # 默认主题
│   └── dark.css           # 暗色主题
└── utils/                  # 工具
    ├── storage.js         # localStorage 封装
    └── validators.js      # 验证工具
```

---

## 类型定义

### 核心类型

```javascript
/**
 * @typedef {Object} Message - WebSocket 消息
 * @property {string} type - 消息类型
 * @property {number} timestamp - Unix 时间戳 (毫秒)
 * @property {string} playerId - 玩家 ID
 * @property {Object} [data] - 消息数据
 */

/**
 * @typedef {Object} GameState - 游戏状态
 * @property {string} currentPlayer - 当前玩家 ID
 * @property {number} turnNumber - 回合数
 * @property {Array<Player>} players - 玩家列表
 * @property {Object} gameSpecificData - 游戏特定数据
 */

/**
 * @typedef {Object} Player - 玩家
 * @property {string} id - 玩家 ID
 * @property {string} nickname - 昵称
 * @property {boolean} isHost - 是否为房主
 */

/**
 * @typedef {Object} GameConfig - 游戏配置
 * @property {string} gameType - 游戏类型
 * @property {number} maxPlayers - 最大玩家数
 * @property {Array<Player>} players - 玩家列表
 * @property {Object} [options] - 游戏选项
 */

/**
 * @typedef {Object} Move - 玩家操作
 * @property {string} actionType - 操作类型
 * @property {Object} actionData - 操作数据
 */
```

### 消息类型

```javascript
/**
 * 客户端发送的消息类型
 * @typedef {'JOIN'|'LEAVE'|'START_GAME'|'GAME_ACTION'|'CHAT_MESSAGE'|'PING'} ClientMessageType
 */

/**
 * 服务器发送的消息类型
 * @typedef {'PLAYER_JOINED'|'PLAYER_LEFT'|'GAME_STARTED'|'GAME_STATE_UPDATE'|'GAME_ENDED'|'CHAT_MESSAGE_BROADCAST'|'PONG'|'ERROR'} ServerMessageType
 */
```

---

## 核心模块实现规范

### 1. 游戏引擎 (game/engine.js)

```javascript
/**
 * 游戏引擎基类
 */
class GameEngine {
  constructor(mode = 'offline') {
    this.mode = mode; // 'offline' | 'online'
    this.state = null;
    this.rules = null;
  }

  /**
   * 初始化游戏
   * @param {GameConfig} config
   * @returns {GameState}
   */
  initialize(config) {
    throw new Error('Must implement initialize()');
  }

  /**
   * 处理玩家操作
   * @param {Move} move
   * @param {GameState} state
   * @returns {GameState}
   */
  processMove(move, state) {
    throw new Error('Must implement processMove()');
  }

  /**
   * 检查游戏是否结束
   * @param {GameState} state
   * @returns {boolean}
   */
  checkGameEnd(state) {
    throw new Error('Must implement checkGameEnd()');
  }
}
```

### 2. 网络客户端 (game/network.js)

```javascript
/**
 * WebSocket 网络客户端
 */
class NetworkClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.playerId = this.generatePlayerId();
    this.messageHandlers = new Map();
    this.connected = false;
  }

  async connect() { /* ... */ }
  send(type, data = {}) { /* ... */ }
  on(messageType, handler) { /* ... */ }
  disconnect() { /* ... */ }
}
```

**消息格式**:
```javascript
// 发送
{
  type: 'GAME_ACTION',
  timestamp: Date.now(),
  playerId: 'player-xxx',
  data: {
    actionType: 'PLAY_CARD',
    actionData: { cardId: 'red-7' }
  }
}

// 接收
{
  type: 'GAME_STATE_UPDATE',
  timestamp: 1705901100100,
  playerId: 'server',
  data: {
    currentPlayer: 'player-2',
    lastAction: { /* ... */ },
    gameState: { /* ... */ }
  }
}
```

---

## UI 开发规范

### 设计系统 (必须使用 CSS Variables)

```css
/* 正确做法 */
.button-primary {
  background: var(--gradient-primary);
  padding: var(--spacing-3) var(--spacing-5);
  border-radius: var(--radius-base);
  color: var(--text-inverse);
}

/* 错误做法 - 禁止硬编码 */
.button-primary {
  background: #667eea;
  padding: 12px 20px;
}
```

### CSS Variables 速查

| 类别 | 变量 | 示例值 |
|------|------|--------|
| 主色调 | `--primary-500` | #667eea |
| 成功色 | `--success-500` | #43e97b |
| 间距 | `--spacing-4` | 16px |
| 圆角 | `--radius-base` | 8px |
| 字号 | `--text-base` | 16px |

---

## 游戏模块开发模板

### 新游戏目录结构

```
games/[game-name]/
├── index.js       # 游戏类 (继承 BoardGame)
├── config.json    # 游戏配置
├── rules.js       # 游戏规则
└── ui.js          # UI 组件
```

### config.json 模板

```json
{
  "id": "game-id",
  "name": "游戏名称",
  "description": "游戏描述",
  "minPlayers": 2,
  "maxPlayers": 4,
  "difficulty": "easy",
  "estimatedTime": 30,
  "tags": ["card", "strategy"]
}
```

### 游戏类模板

```javascript
import BoardGame from '../../game/engine.js';

export default class [GameName]Game extends BoardGame {
  initialize(config) {
    return {
      players: config.players,
      currentPlayer: 0,
      turnNumber: 0,
      // 游戏特定状态...
    };
  }

  processMove(move, state) {
    const validation = this.validateMove(move, state);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = { ...state };
    // 应用操作逻辑...
    return newState;
  }

  checkGameEnd(state) {
    // 判断游戏是否结束
    return false;
  }

  validateMove(move, state) {
    // 验证操作是否合法
    return { valid: true };
  }
}
```

---

## WebSocket 协议 (客户端部分)

### 连接流程

```
1. 建立 WebSocket 连接: ws://[host-ip]:7777
2. 发送 JOIN 消息加入房间
3. 监听 GAME_STATE_UPDATE 更新 UI
4. 发送 GAME_ACTION 执行操作
5. 每 30 秒发送 PING 心跳
```

### 客户端发送的消息

| 类型 | 说明 | data 字段 |
|------|------|-----------|
| `JOIN` | 加入房间 | `{ roomId, nickname, gameType }` |
| `LEAVE` | 离开房间 | `{}` |
| `START_GAME` | 开始游戏 | `{ gameType, gameConfig }` |
| `GAME_ACTION` | 游戏操作 | `{ actionType, actionData }` |
| `CHAT_MESSAGE` | 发送聊天 | `{ message, isPublic }` |
| `PING` | 心跳 | `{}` |

### 客户端监听的消息

| 类型 | 说明 | 处理方式 |
|------|------|----------|
| `PLAYER_JOINED` | 玩家加入 | 更新玩家列表 |
| `PLAYER_LEFT` | 玩家离开 | 更新玩家列表 |
| `GAME_STARTED` | 游戏开始 | 初始化游戏 UI |
| `GAME_STATE_UPDATE` | 状态更新 | 更新游戏状态和 UI |
| `GAME_ENDED` | 游戏结束 | 显示结算界面 |
| `ERROR` | 错误 | 显示错误提示 |
| `PONG` | 心跳响应 | 更新延迟显示 |

---

## 本地存储

### 存储结构

```javascript
// localStorage - 持久化配置
{
  "graphics": {
    "resolution": "1920x1080",
    "fullscreen": true,
    "quality": "high"
  },
  "audio": {
    "master": 80,
    "sfx": 70,
    "music": 50
  },
  "game": {
    "language": "zh-CN",
    "defaultNickname": "玩家1"
  }
}

// sessionStorage - 会话数据 (每个标签页独立)
{
  "playerId": "player-xxx",
  "currentRoom": "room-xxx",
  "gameState": { /* ... */ }
}
```

### 存储工具

```javascript
// utils/storage.js
export function saveConfig(config) {
  localStorage.setItem('boardgame_config', JSON.stringify(config));
}

export function loadConfig() {
  const data = localStorage.getItem('boardgame_config');
  return data ? JSON.parse(data) : getDefaultConfig();
}

export function saveSessionData(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}
```

---

## 错误处理

### 错误类

```javascript
export class GameError extends Error {
  constructor(message, code = 'GAME_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class InvalidMoveError extends GameError {
  constructor(message) {
    super(message, 'INVALID_MOVE');
  }
}

export class NetworkError extends GameError {
  constructor(message) {
    super(message, 'NETWORK_ERROR');
  }
}
```

### 网络错误代码

| 错误代码 | 说明 | 处理方式 |
|---------|------|----------|
| `INVALID_MESSAGE_FORMAT` | 消息格式错误 | 记录日志 |
| `INVALID_ACTION` | 非法操作 | 显示提示 |
| `NOT_YOUR_TURN` | 不是你的回合 | 显示提示 |
| `ROOM_FULL` | 房间已满 | 返回大厅 |
| `SERVER_ERROR` | 服务器错误 | 断开重连 |

---

## 性能要求

| 指标 | 要求 |
|------|------|
| 首次加载 | < 3 秒 |
| 操作响应 | < 100ms |
| 动画帧率 | 60 FPS |
| 内存占用 | < 150MB/标签页 |
| 局域网延迟 | < 50ms |

---

## 测试要求

### 覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| 游戏逻辑 (`game/`) | 80%+ |
| 工具函数 (`utils/`) | 90%+ |
| UI 组件 (`layout/`) | 60%+ |

### 测试命令

```bash
npm test              # 运行所有测试
npm test -- --watch   # 监听模式
npm run test:coverage # 覆盖率报告
```

---

## 开发原则

1. **单机优先**: 先实现单机模式，确保逻辑正确后再添加网络支持
2. **状态不可变**: 使用 `{ ...state }` 创建新状态对象
3. **纯函数**: 游戏逻辑函数应为纯函数（无副作用）
4. **配置驱动**: 尽量使用 `config.json` 配置游戏参数
5. **使用设计系统**: 所有样式必须使用 CSS Variables

---

## 参考文档

- [WebSocket 通信协议](../../PROTOCOL.md)
- [前端开发指南](../../FRONTEND_GUIDE.md)
- [AI Coding 指南](../../AI_CODING_GUIDE.md)
- [协作开发流程](../../COLLABORATION.md)
