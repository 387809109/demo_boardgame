# 后端开发 PRD - AI Coding 专用

> 本文档专为 AI 编程助手优化，提供结构化的开发需求和代码规范。

## 项目概述

**项目名称**: 桌游集成客户端（后端）
**技术栈**: Node.js + ws (WebSocket)
**运行环境**: Node.js 20.19.0+ 或 22.12.0+
**默认端口**: 7777

---

## 核心职责

后端 **仅负责消息转发和房间管理**，**不处理游戏逻辑**。

| 职责 | 说明 |
|------|------|
| 连接管理 | WebSocket 连接建立、断开、心跳检测 |
| 房间管理 | 创建房间、加入房间、离开房间 |
| 消息路由 | 根据消息类型分发到处理器 |
| 消息广播 | 将消息转发给房间内所有玩家 |
| 错误处理 | 返回错误消息给客户端 |

**不负责**:
- 游戏逻辑 (由前端处理)
- 规则验证 (由前端处理)
- 游戏状态计算 (由前端处理)

---

## 目录结构

```
server/
├── index.js              # 服务器入口
├── connection-manager.js # 连接管理
├── room-manager.js       # 房间管理
├── message-router.js     # 消息路由
├── broadcaster.js        # 消息广播
├── config.js             # 配置文件
├── utils/                # 工具函数
│   ├── logger.js         # 日志
│   └── validator.js      # 验证
├── tests/                # 测试文件
│   ├── connection.test.js
│   ├── room.test.js
│   └── message.test.js
└── package.json
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
 * @typedef {Object} Connection - 连接信息
 * @property {WebSocket} ws - WebSocket 实例
 * @property {string|null} playerId - 关联的玩家 ID
 * @property {number} connectedAt - 连接时间
 */

/**
 * @typedef {Object} Room - 房间信息
 * @property {string} id - 房间 ID
 * @property {string} gameType - 游戏类型
 * @property {string} host - 房主玩家 ID
 * @property {Array<Player>} players - 玩家列表
 * @property {number} createdAt - 创建时间
 * @property {boolean} gameStarted - 游戏是否已开始
 */

/**
 * @typedef {Object} Player - 玩家信息
 * @property {string} id - 玩家 ID
 * @property {string} nickname - 昵称
 * @property {boolean} isHost - 是否为房主
 * @property {number} joinedAt - 加入时间
 */
```

---

## 核心模块实现规范

### 1. 服务器入口 (index.js)

```javascript
const WebSocket = require('ws');
const { ConnectionManager } = require('./connection-manager');
const { RoomManager } = require('./room-manager');
const { MessageRouter } = require('./message-router');
const { logger } = require('./utils/logger');

class GameServer {
  constructor(port = 7777) {
    this.port = port;
    this.wss = new WebSocket.Server({ port });
    this.connectionManager = new ConnectionManager();
    this.roomManager = new RoomManager();
    this.messageRouter = new MessageRouter(this.roomManager, this.connectionManager);

    this.setupServer();
  }

  setupServer() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info(`WebSocket server listening on port ${this.port}`);
  }

  handleConnection(ws, req) {
    const connectionId = this.connectionManager.addConnection(ws);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.messageRouter.route(connectionId, message);
      } catch (error) {
        this.sendError(ws, 'unknown', 'INVALID_MESSAGE_FORMAT', 'Invalid JSON');
      }
    });

    ws.on('close', () => this.handleDisconnect(connectionId));
  }

  handleDisconnect(connectionId) {
    // 处理断开连接逻辑
  }

  sendError(ws, playerId, code, message) {
    // 发送错误消息
  }
}
```

### 2. 连接管理器 (connection-manager.js)

```javascript
class ConnectionManager {
  constructor() {
    this.connections = new Map(); // connectionId -> Connection
    this.playerConnections = new Map(); // playerId -> connectionId
    this.connectionCounter = 0;
  }

  /**
   * 添加新连接
   * @param {WebSocket} ws
   * @returns {string} connectionId
   */
  addConnection(ws) {
    const connectionId = `conn-${++this.connectionCounter}`;
    this.connections.set(connectionId, {
      ws,
      playerId: null,
      connectedAt: Date.now()
    });
    return connectionId;
  }

  /**
   * 绑定玩家到连接
   * @param {string} connectionId
   * @param {string} playerId
   */
  bindPlayer(connectionId, playerId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.playerId = playerId;
      this.playerConnections.set(playerId, connectionId);
    }
  }

  /**
   * 获取玩家的 WebSocket
   * @param {string} playerId
   * @returns {WebSocket|null}
   */
  getConnection(playerId) {
    const connectionId = this.playerConnections.get(playerId);
    if (connectionId) {
      const connection = this.connections.get(connectionId);
      return connection ? connection.ws : null;
    }
    return null;
  }

  /**
   * 移除连接
   * @param {string} connectionId
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.playerId) {
      this.playerConnections.delete(connection.playerId);
    }
    this.connections.delete(connectionId);
  }
}
```

### 3. 房间管理器 (room-manager.js)

```javascript
class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  /**
   * 创建房间
   * @param {string} roomId
   * @param {string} hostPlayerId
   * @param {string} gameType
   * @returns {Room}
   */
  createRoom(roomId, hostPlayerId, gameType) {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }

    const room = {
      id: roomId,
      gameType,
      host: hostPlayerId,
      players: [],
      createdAt: Date.now(),
      gameStarted: false
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * 加入房间
   * @param {string} roomId
   * @param {string} playerId
   * @param {string} nickname
   * @returns {Room}
   */
  joinRoom(roomId, playerId, nickname) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    room.players.push({
      id: playerId,
      nickname,
      isHost: playerId === room.host,
      joinedAt: Date.now()
    });

    return room;
  }

  /**
   * 移除玩家
   * @param {string} roomId
   * @param {string} playerId
   */
  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  /**
   * 查找玩家所在房间
   * @param {string} playerId
   * @returns {string|null} roomId
   */
  findPlayerRoom(playerId) {
    for (const [roomId, room] of this.rooms) {
      if (room.players.some(p => p.id === playerId)) {
        return roomId;
      }
    }
    return null;
  }

  /**
   * 获取房间玩家列表
   * @param {string} roomId
   * @returns {Array<Player>}
   */
  getPlayers(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.players : [];
  }
}
```

### 4. 消息路由器 (message-router.js)

```javascript
class MessageRouter {
  constructor(roomManager, connectionManager) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;
  }

  /**
   * 路由消息到处理器
   * @param {string} connectionId
   * @param {Message} message
   */
  route(connectionId, message) {
    const { type, playerId, data } = message;

    // 绑定玩家 ID
    if (playerId && !this.connectionManager.getPlayerId(connectionId)) {
      this.connectionManager.bindPlayer(connectionId, playerId);
    }

    switch (type) {
      case 'JOIN':
        this.handleJoin(connectionId, playerId, data);
        break;
      case 'LEAVE':
        this.handleLeave(connectionId, playerId, data);
        break;
      case 'START_GAME':
        this.handleStartGame(connectionId, playerId, data);
        break;
      case 'GAME_ACTION':
        this.handleGameAction(connectionId, playerId, data);
        break;
      case 'CHAT_MESSAGE':
        this.handleChatMessage(connectionId, playerId, data);
        break;
      case 'PING':
        this.handlePing(connectionId, playerId);
        break;
      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  handleJoin(connectionId, playerId, data) {
    const { roomId, nickname, gameType } = data;

    // 创建或加入房间
    if (!this.roomManager.rooms.has(roomId)) {
      this.roomManager.createRoom(roomId, playerId, gameType);
    }

    const room = this.roomManager.joinRoom(roomId, playerId, nickname);

    // 广播玩家加入
    this.broadcast(roomId, {
      type: 'PLAYER_JOINED',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        nickname,
        playerCount: room.players.length,
        players: room.players
      }
    });
  }

  handleGameAction(connectionId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connectionId, playerId, 'GAME_NOT_FOUND', 'Not in room');
      return;
    }

    // 仅转发，不处理逻辑
    this.broadcast(roomId, {
      type: 'GAME_STATE_UPDATE',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        lastAction: { playerId, ...data }
      }
    });
  }

  handlePing(connectionId, playerId) {
    const ws = this.connectionManager.connections.get(connectionId).ws;
    ws.send(JSON.stringify({
      type: 'PONG',
      timestamp: Date.now(),
      playerId,
      data: { latency: 0 }
    }));
  }

  broadcast(roomId, message) {
    const players = this.roomManager.getPlayers(roomId);
    players.forEach(player => {
      const ws = this.connectionManager.getConnection(player.id);
      if (ws && ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(message));
      }
    });
  }

  sendError(connectionId, playerId, code, message) {
    const ws = this.connectionManager.connections.get(connectionId)?.ws;
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        timestamp: Date.now(),
        playerId,
        data: { code, message, severity: 'error' }
      }));
    }
  }
}
```

---

## WebSocket 协议 (服务器部分)

### 消息格式

```javascript
// 通用消息结构
{
  "type": "MESSAGE_TYPE",      // 必需: 消息类型
  "timestamp": 1705900800000,  // 必需: Unix 时间戳 (毫秒)
  "playerId": "player-xxx",    // 必需: 玩家 ID
  "data": {}                   // 可选: 消息数据
}
```

### 服务器处理的消息

| 类型 | 说明 | 处理方式 |
|------|------|----------|
| `JOIN` | 加入房间 | 创建/加入房间，广播 PLAYER_JOINED |
| `LEAVE` | 离开房间 | 移除玩家，广播 PLAYER_LEFT |
| `START_GAME` | 开始游戏 | 验证房主，广播 GAME_STARTED |
| `GAME_ACTION` | 游戏操作 | **仅转发**，广播 GAME_STATE_UPDATE |
| `CHAT_MESSAGE` | 聊天消息 | 广播 CHAT_MESSAGE_BROADCAST |
| `PING` | 心跳 | 回复 PONG |

### 服务器发送的消息

| 类型 | 说明 | data 字段 |
|------|------|-----------|
| `PLAYER_JOINED` | 玩家加入 | `{ nickname, playerCount, players }` |
| `PLAYER_LEFT` | 玩家离开 | `{ reason, playerCount, players }` |
| `GAME_STARTED` | 游戏开始 | `{ gameType, initialState }` |
| `GAME_STATE_UPDATE` | 状态更新 | `{ lastAction, gameState }` |
| `GAME_ENDED` | 游戏结束 | `{ winner, rankings, gameStats }` |
| `CHAT_MESSAGE_BROADCAST` | 聊天广播 | `{ nickname, message }` |
| `PONG` | 心跳响应 | `{ latency }` |
| `ERROR` | 错误 | `{ code, message, severity }` |

### 错误代码

| 错误代码 | 说明 | 严重程度 |
|---------|------|---------|
| `INVALID_MESSAGE_FORMAT` | 消息格式错误 | error |
| `INVALID_ACTION` | 非法操作 | warning |
| `NOT_YOUR_TURN` | 不是你的回合 | warning |
| `ROOM_FULL` | 房间已满 | error |
| `ROOM_NOT_FOUND` | 房间不存在 | error |
| `PERMISSION_DENIED` | 权限不足 | error |
| `SERVER_ERROR` | 服务器错误 | fatal |

---

## 日志规范

### 日志级别

| 级别 | 用途 |
|------|------|
| `debug` | 调试信息 |
| `info` | 常规信息 (连接、断开、加入房间) |
| `warn` | 警告 (未知消息类型) |
| `error` | 错误 (消息解析失败、异常) |

### 日志格式

```javascript
// utils/logger.js
const logger = {
  info: (msg, data) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, data || ''),
  debug: (msg, data) => console.debug(`[DEBUG] ${new Date().toISOString()} ${msg}`, data || '')
};
```

### 日志示例

```
[INFO] 2026-01-22T10:00:00.000Z Client connected: 192.168.1.100
[INFO] 2026-01-22T10:00:01.000Z Player player-123 joined room room-abc
[WARN] 2026-01-22T10:00:02.000Z Unknown message type: UNKNOWN
[ERROR] 2026-01-22T10:00:03.000Z Message parse error: Unexpected token
```

---

## 配置

### config.js

```javascript
module.exports = {
  // 服务器配置
  port: process.env.PORT || 7777,
  env: process.env.NODE_ENV || 'development',

  // 连接配置
  maxConnections: 1000,
  heartbeatInterval: 30000, // 30 秒
  heartbeatTimeout: 90000,  // 90 秒无心跳断开

  // 房间配置
  maxPlayersPerRoom: 8,
  maxRooms: 100,

  // 日志配置
  logLevel: process.env.LOG_LEVEL || 'info'
};
```

---

## 测试规范

### 测试框架

- Jest 29.x

### 测试命令

```bash
npm test              # 运行所有测试
npm test -- --watch   # 监听模式
npm run test:coverage # 覆盖率报告
```

### 测试模板

```javascript
// tests/room-manager.test.js
const { RoomManager } = require('../room-manager');

describe('RoomManager', () => {
  let roomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  test('创建房间', () => {
    const room = roomManager.createRoom('room-1', 'player-1', 'uno');
    expect(room.id).toBe('room-1');
    expect(room.host).toBe('player-1');
  });

  test('加入房间', () => {
    roomManager.createRoom('room-1', 'player-1', 'uno');
    const room = roomManager.joinRoom('room-1', 'player-2', '玩家2');
    expect(room.players).toHaveLength(1);
  });

  test('加入不存在的房间应抛出错误', () => {
    expect(() => {
      roomManager.joinRoom('non-existent', 'player-1', '玩家1');
    }).toThrow('Room non-existent not found');
  });
});
```

---

## 部署

### PM2 部署

```bash
# 安装
npm install -g pm2

# 启动
pm2 start server/index.js --name board-game-server

# 查看状态
pm2 status

# 查看日志
pm2 logs board-game-server

# 重启
pm2 restart board-game-server
```

### Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --only=production

COPY server/ ./

EXPOSE 7777

CMD ["node", "index.js"]
```

```bash
docker build -t board-game-server .
docker run -d -p 7777:7777 --name board-game-server board-game-server
```

---

## 性能要求

| 指标 | 要求 |
|------|------|
| 最大连接数 | 1000 |
| 消息处理延迟 | < 10ms |
| 广播延迟 | < 50ms |
| 内存占用 | < 100MB (基础) |

---

## 开发原则

1. **仅转发原则**: 后端不处理游戏逻辑，只转发消息
2. **无状态**: 每条消息包含完整上下文
3. **容错性**: 捕获所有异常，避免服务器崩溃
4. **详细日志**: 记录所有关键操作
5. **优雅关闭**: 处理 SIGTERM 信号

---

## 参考文档

- [WebSocket 通信协议](../../PROTOCOL.md)
- [后端开发指南](../../BACKEND_GUIDE.md)
- [AI Coding 指南](../../AI_CODING_GUIDE.md)
- [协作开发流程](../../COLLABORATION.md)
