# WebSocket 通信协议规范

**版本**: v1.2.0
**最后更新**: 2026-02-11

本文档定义了前端（浏览器客户端）与后端（WebSocket服务器）之间的通信协议。前后端开发者必须严格遵循此协议以确保系统正常工作。

---

## 目录

1. [协议概述](#协议概述)
2. [连接管理](#连接管理)
3. [消息格式](#消息格式)
4. [消息类型](#消息类型)
5. [错误处理](#错误处理)
6. [示例代码](#示例代码)

---

## 协议概述

### 基本信息

- **传输协议**: WebSocket (RFC 6455)
- **默认端口**: 7777
- **消息格式**: JSON
- **字符编码**: UTF-8
- **连接方式**: `ws://[host-ip]:7777`

### 设计原则

1. **极简**: 仅传输必要信息
2. **无状态**: 每条消息包含完整上下文
3. **单向权威**: 服务器负责状态广播，客户端仅发送操作
4. **容错性**: 默认策略下连接断开时游戏终止；启用扩展协议后支持短时重连

---

## 连接管理

### 连接流程

```
客户端                           服务器
   |                                |
   |--- WebSocket Handshake ------->|
   |<--- 101 Switching Protocols ---|
   |                                |
   |--- JOIN message --------------->|
   |<--- PLAYER_JOINED (broadcast) -|
   |                                |
   |--- GAME_ACTION ---------------->|
   |<--- GAME_STATE_UPDATE ---------|
   |                                |
   |--- DISCONNECT ----------------->|
   |<--- Connection Closed ----------|
```

### 连接建立

**客户端**:
```javascript
const ws = new WebSocket('ws://192.168.1.100:7777');

ws.onopen = () => {
  console.log('Connected to server');
  // 发送加入消息
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from server');
};
```

**服务器**:
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 7777 });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`Client connected: ${clientIp}`);

  ws.on('message', handleMessage);
  ws.on('close', handleDisconnect);
});
```

### 断线重连流程（扩展，需显式启用）

> 说明: 本节为扩展协议。未启用时，仍按“断线即结束/返回大厅”处理。

```
客户端A（断线玩家）                服务器/房主                     其他玩家
       |                              |                              |
       |--- WebSocket 重连 ----------->|                              |
       |<-- 101 -----------------------|                              |
       |--- RECONNECT_REQUEST -------->|                              |
       |<-- RECONNECT_ACCEPTED --------|                              |
       |<-- GAME_SNAPSHOT -------------|                              |
       |                              |--- PLAYER_RECONNECTED ------->|
       |====== 本地状态恢复并继续对局 ======|                              |
```

**关键约束**:
- 服务器应维护可重连会话窗口（建议 30-120 秒，按房间配置）。
- 客户端应持久化 `roomId`、`playerId`、`sessionId`（建议 `sessionStorage`）。
- 超过会话窗口或身份校验失败时，返回 `RECONNECT_REJECTED`，客户端回大厅。

### 云端模式连接说明（Supabase Realtime）

云端模式不使用自建 WebSocket 服务器，使用 Supabase Realtime Channel + Presence，并在客户端转换为同一套协议消息。

| WebSocket 协议语义 | 云端等效实现 |
|-------------------|-------------|
| `connect()` | `channel.subscribe()` |
| `send(message)` | `channel.send({ type: 'broadcast', event, payload })` |
| `PLAYER_JOINED` | Presence `join/sync` 事件转换 |
| `PLAYER_LEFT` | Presence `leave` 事件转换 |
| `PING/PONG` | 由 Supabase 连接层自动维护（业务侧可不显式发送） |

**兼容要求**:
- 上层（`main.js` / 游戏逻辑）仅依赖协议消息，不依赖底层传输差异。
- 云端模式同样可实现 `RECONNECT_REQUEST` / `GAME_SNAPSHOT` 扩展流程。

---

## 消息格式

### 通用消息结构

所有消息必须遵循以下 JSON 格式：

```json
{
  "type": "MESSAGE_TYPE",
  "timestamp": 1705900800000,
  "playerId": "player-uuid-123",
  "data": {
    // 消息特定数据
  }
}
```

**字段说明**:

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | ✅ | 消息类型（见下方消息类型列表） |
| `timestamp` | number | ✅ | Unix 时间戳（毫秒），用于消息排序 |
| `playerId` | string | ✅ | 玩家唯一标识符 |
| `data` | object | ❌ | 消息载荷，根据消息类型不同而不同 |

### 消息大小限制

- 单条消息最大: **64 KB**
- 超过限制的消息将被拒绝

---

## 消息类型

### 1. 房间管理

#### 1.1 JOIN - 加入房间

**方向**: 客户端 → 服务器

**说明**: 玩家加入游戏房间

**消息格式**:
```json
{
  "type": "JOIN",
  "timestamp": 1705900800000,
  "playerId": "player-uuid-123",
  "data": {
    "nickname": "玩家1",
    "roomId": "room-abc-123",
    "gameType": "uno"
  }
}
```

**响应**: 服务器广播 `PLAYER_JOINED`

---

#### 1.2 PLAYER_JOINED - 玩家已加入

**方向**: 服务器 → 所有客户端（广播）

**说明**: 通知所有玩家有新玩家加入

**消息格式**:
```json
{
  "type": "PLAYER_JOINED",
  "timestamp": 1705900800100,
  "playerId": "player-uuid-123",
  "data": {
    "nickname": "玩家1",
    "playerCount": 3,
    "players": [
      { "id": "player-1", "nickname": "玩家1", "isHost": true },
      { "id": "player-2", "nickname": "玩家2", "isHost": false },
      { "id": "player-3", "nickname": "玩家3", "isHost": false }
    ]
  }
}
```

---

#### 1.3 LEAVE - 离开房间

**方向**: 客户端 → 服务器

**说明**: 玩家主动离开房间

**消息格式**:
```json
{
  "type": "LEAVE",
  "timestamp": 1705900900000,
  "playerId": "player-uuid-123",
  "data": {}
}
```

**响应**: 服务器广播 `PLAYER_LEFT`

---

#### 1.4 PLAYER_LEFT - 玩家已离开

**方向**: 服务器 → 所有客户端（广播）

**说明**: 通知所有玩家有玩家离开

**消息格式**:
```json
{
  "type": "PLAYER_LEFT",
  "timestamp": 1705900900100,
  "playerId": "player-uuid-123",
  "data": {
    "reason": "voluntary", // "voluntary" | "disconnected" | "kicked"
    "playerCount": 2,
    "players": [
      { "id": "player-1", "nickname": "玩家1", "isHost": true },
      { "id": "player-2", "nickname": "玩家2", "isHost": false }
    ]
  }
}
```

---

### 2. 游戏控制

#### 2.1 START_GAME - 开始游戏

**方向**: 客户端（房主） → 服务器

**说明**: 房主发起游戏开始

**消息格式**:
```json
{
  "type": "START_GAME",
  "timestamp": 1705901000000,
  "playerId": "player-uuid-host",
  "data": {
    "gameType": "uno",
    "gameConfig": {
      "maxPlayers": 4,
      "difficulty": "normal"
    }
  }
}
```

**响应**: 服务器广播 `GAME_STARTED`

---

#### 2.2 GAME_STARTED - 游戏已开始

**方向**: 服务器 → 所有客户端（广播）

**说明**: 游戏开始，包含初始状态

**消息格式**:
```json
{
  "type": "GAME_STARTED",
  "timestamp": 1705901000100,
  "playerId": "server",
  "data": {
    "gameType": "uno",
    "gameSettings": {
      "initialCards": 13,
      "stackDrawCards": true,
      "forcePlay": true
    },
    "initialState": {
      "currentPlayer": "player-1",
      "turnOrder": ["player-1", "player-2", "player-3"],
      "gameSpecificData": {
        // 游戏特定的初始状态
      }
    }
  }
}
```

**字段说明**:
- `data.gameSettings`: 本局生效的房间设置快照（建议客户端优先使用该字段恢复规则显示与本地初始化）
- `data.initialState`: 对局初始状态快照（某些游戏会在 `initialState.options` 中携带等价设置）

---

#### 2.3 RETURN_TO_ROOM - 返回房间（局后）

**方向**: 客户端 → 服务器

**说明**: 玩家在结算页点击“回到房间”后上报已返回。仅对已结束的一局生效。

**消息格式**:
```json
{
  "type": "RETURN_TO_ROOM",
  "timestamp": 1705901050000,
  "playerId": "player-uuid-123",
  "data": {}
}
```

**响应**: 服务器广播 `RETURN_TO_ROOM_STATUS`

---

#### 2.4 RETURN_TO_ROOM_STATUS - 返回房间状态广播

**方向**: 服务器 → 所有客户端（广播）

**说明**: 同步“已返回/未返回”状态；当 `allReturned=true` 时，房主可再次开始游戏。

**消息格式**:
```json
{
  "type": "RETURN_TO_ROOM_STATUS",
  "timestamp": 1705901050100,
  "playerId": "server",
  "data": {
    "players": [
      { "id": "player-1", "nickname": "玩家1", "isHost": true, "returned": true },
      { "id": "player-2", "nickname": "玩家2", "isHost": false, "returned": false }
    ],
    "allReturned": false,
    "returnedCount": 1,
    "totalPlayers": 2
  }
}
```

---

#### 2.5 GAME_ACTION - 游戏操作

**方向**: 客户端 → 服务器

**说明**: 玩家执行游戏操作（出牌、选择等）

**消息格式**:
```json
{
  "type": "GAME_ACTION",
  "timestamp": 1705901100000,
  "playerId": "player-uuid-123",
  "data": {
    "actionType": "PLAY_CARD", // 游戏特定的操作类型
    "actionData": {
      "cardId": "red-7",
      "targetPlayer": null
    }
  }
}
```

**游戏特定操作类型示例** (UNO):
- `PLAY_CARD`: 出牌
- `DRAW_CARD`: 摸牌
- `SKIP_TURN`: 跳过回合
- `CALL_UNO`: 喊UNO

**响应**: 服务器广播 `GAME_STATE_UPDATE`

---

#### 2.6 GAME_STATE_UPDATE - 游戏状态更新

**方向**: 服务器 → 所有客户端（广播）

**说明**: 游戏状态发生变化

**消息格式**:
```json
{
  "type": "GAME_STATE_UPDATE",
  "timestamp": 1705901100100,
  "playerId": "server",
  "data": {
    "currentPlayer": "player-2",
    "lastAction": {
      "playerId": "player-1",
      "actionType": "PLAY_CARD",
      "actionData": { "cardId": "red-7" }
    },
    "gameState": {
      // 完整的游戏状态，由前端规则引擎处理
      "turnNumber": 5,
      "direction": "clockwise",
      "gameSpecificData": {}
    }
  }
}
```

---

#### 2.7 GAME_ENDED - 游戏结束

**方向**: 服务器 → 所有客户端（广播）

**说明**: 游戏结束，包含结算信息

**消息格式**:
```json
{
  "type": "GAME_ENDED",
  "timestamp": 1705902000000,
  "playerId": "server",
  "data": {
    "winner": "player-1",
    "rankings": [
      { "playerId": "player-1", "score": 500, "rank": 1 },
      { "playerId": "player-2", "score": 300, "rank": 2 },
      { "playerId": "player-3", "score": 100, "rank": 3 }
    ],
    "gameStats": {
      "duration": 1200000, // 毫秒
      "totalTurns": 45
    }
  }
}
```

---

### 3. 聊天消息

#### 3.1 CHAT_MESSAGE - 发送聊天

**方向**: 客户端 → 服务器

**消息格式**:
```json
{
  "type": "CHAT_MESSAGE",
  "timestamp": 1705901500000,
  "playerId": "player-uuid-123",
  "data": {
    "message": "大家好！",
    "isPublic": true
  }
}
```

**响应**: 服务器广播 `CHAT_MESSAGE_BROADCAST`

---

#### 3.2 CHAT_MESSAGE_BROADCAST - 聊天广播

**方向**: 服务器 → 所有客户端（广播）

**消息格式**:
```json
{
  "type": "CHAT_MESSAGE_BROADCAST",
  "timestamp": 1705901500100,
  "playerId": "player-uuid-123",
  "data": {
    "nickname": "玩家1",
    "message": "大家好！",
    "isPublic": true
  }
}
```

---

### 4. 心跳与健康检查

#### 4.1 PING - 心跳请求

**方向**: 客户端 → 服务器 或 服务器 → 客户端

**消息格式**:
```json
{
  "type": "PING",
  "timestamp": 1705901600000,
  "playerId": "player-uuid-123",
  "data": {}
}
```

**响应**: `PONG`

---

#### 4.2 PONG - 心跳响应

**方向**: 服务器 → 客户端 或 客户端 → 服务器

**消息格式**:
```json
{
  "type": "PONG",
  "timestamp": 1705901600010,
  "playerId": "player-uuid-123",
  "data": {
    "latency": 10 // 毫秒
  }
}
```

**建议**: 每 30 秒发送一次心跳

---

### 5. 断线重连（扩展）

#### 5.1 RECONNECT_REQUEST - 申请恢复会话

**方向**: 客户端 → 服务器（或房主权威端）

**说明**: 断线后重新连接，申请恢复原对局会话。

**消息格式**:
```json
{
  "type": "RECONNECT_REQUEST",
  "timestamp": 1705902600000,
  "playerId": "player-uuid-123",
  "data": {
    "roomId": "room-abc-123",
    "sessionId": "sess-xyz-001",
    "lastAckActionId": "act-105"
  }
}
```

---

#### 5.2 RECONNECT_ACCEPTED - 会话恢复已接受

**方向**: 服务器（或房主权威端）→ 重连客户端

**说明**: 重连校验通过，后续应下发 `GAME_SNAPSHOT`。

**消息格式**:
```json
{
  "type": "RECONNECT_ACCEPTED",
  "timestamp": 1705902600050,
  "playerId": "server",
  "data": {
    "roomId": "room-abc-123",
    "resumeFromActionId": "act-106",
    "snapshotRequired": true
  }
}
```

---

#### 5.3 RECONNECT_REJECTED - 会话恢复被拒绝

**方向**: 服务器（或房主权威端）→ 重连客户端

**说明**: 重连失败，客户端应结束当前对局并返回大厅。

**消息格式**:
```json
{
  "type": "RECONNECT_REJECTED",
  "timestamp": 1705902600050,
  "playerId": "server",
  "data": {
    "reasonCode": "RECONNECT_SESSION_EXPIRED",
    "message": "重连窗口已过期"
  }
}
```

---

#### 5.4 GAME_SNAPSHOT - 对局快照同步

**方向**: 服务器（或房主权威端）→ 重连客户端

**说明**: 发送恢复所需的最小完整状态。客户端收到后覆盖本地状态并刷新 UI。

**消息格式**:
```json
{
  "type": "GAME_SNAPSHOT",
  "timestamp": 1705902600100,
  "playerId": "server",
  "data": {
    "roomId": "room-abc-123",
    "gameType": "uno",
    "players": [
      { "id": "player-1", "nickname": "玩家1", "isHost": true },
      { "id": "player-2", "nickname": "玩家2", "isHost": false }
    ],
    "gameState": {
      "turnNumber": 12,
      "currentPlayer": "player-2",
      "gameSpecificData": {}
    },
    "lastActionId": "act-106"
  }
}
```

---

#### 5.5 PLAYER_RECONNECTED - 玩家已重连（广播）

**方向**: 服务器（或房主权威端）→ 房间内所有客户端（广播）

**说明**: 通知其他玩家某玩家已恢复在线状态。

**消息格式**:
```json
{
  "type": "PLAYER_RECONNECTED",
  "timestamp": 1705902600120,
  "playerId": "player-uuid-123",
  "data": {
    "playerCount": 4,
    "players": [
      { "id": "player-1", "nickname": "玩家1", "isHost": true },
      { "id": "player-2", "nickname": "玩家2", "isHost": false }
    ]
  }
}
```

---

#### 5.6 PLAYER_DISCONNECTED - 玩家断线通知（广播）

**方向**: 服务器 → 房间内其他客户端（广播）

**说明**: 当游戏进行中某玩家断线并进入重连窗口时，立即通知房间内其他玩家。前端收到后应在 UI 显示"玩家 X 断线中，等待重连..."。当该玩家重连成功时，服务器会广播 `PLAYER_RECONNECTED` 消除断线状态；若重连窗口超时，服务器会广播 `PLAYER_LEFT`（reason: `"reconnect_timeout"`）。

**消息格式**:
```json
{
  "type": "PLAYER_DISCONNECTED",
  "timestamp": 1705902600050,
  "playerId": "server",
  "data": {
    "playerId": "player-uuid-123",
    "nickname": "玩家1",
    "reconnectWindowMs": 60000
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `data.playerId` | string | 断线玩家的 ID |
| `data.nickname` | string | 断线玩家的昵称 |
| `data.reconnectWindowMs` | number | 重连窗口时长（毫秒），超时后玩家将被移除 |

---

## 错误处理

### 错误消息格式

**方向**: 服务器 → 客户端

```json
{
  "type": "ERROR",
  "timestamp": 1705901700000,
  "playerId": "player-uuid-123",
  "data": {
    "code": "INVALID_ACTION",
    "message": "不是你的回合",
    "originalMessageType": "GAME_ACTION",
    "severity": "warning" // "info" | "warning" | "error" | "fatal"
  }
}
```

### 错误代码列表

| 错误代码 | 说明 | 严重程度 |
|---------|------|---------|
| `INVALID_MESSAGE_FORMAT` | 消息格式错误 | error |
| `INVALID_ACTION` | 非法操作 | warning |
| `NOT_YOUR_TURN` | 不是玩家回合 | warning |
| `ROOM_FULL` | 房间已满 | error |
| `GAME_NOT_FOUND` | 游戏不存在 | error |
| `PERMISSION_DENIED` | 权限不足（非房主操作） | error |
| `HOST_DISCONNECTED` | 房主断线中，操作被冻结 | warning |
| `RECONNECT_NOT_SUPPORTED` | 当前房间未启用断线重连扩展 | warning |
| `RECONNECT_SESSION_EXPIRED` | 重连会话已过期 | warning |
| `RECONNECT_IDENTITY_MISMATCH` | 会话身份校验失败 | error |
| `SERVER_ERROR` | 服务器内部错误 | fatal |

### 错误处理流程

**客户端**:
```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'ERROR') {
    const { code, message: errorMsg, severity } = message.data;

    switch (severity) {
      case 'warning':
        console.warn(`[${code}] ${errorMsg}`);
        showNotification(errorMsg, 'warning');
        break;
      case 'error':
      case 'fatal':
        console.error(`[${code}] ${errorMsg}`);
        showErrorDialog(errorMsg);
        if (severity === 'fatal') {
          ws.close();
        }
        break;
    }
  }
};
```

**服务器**:
```javascript
function sendError(ws, playerId, code, message, severity = 'error') {
  const errorMessage = {
    type: 'ERROR',
    timestamp: Date.now(),
    playerId,
    data: { code, message, severity }
  };

  ws.send(JSON.stringify(errorMessage));
}
```

---

## 示例代码

### 完整的客户端示例

```javascript
// game/network.js
class GameNetworkClient {
  constructor(serverUrl) {
    this.ws = null;
    this.serverUrl = serverUrl;
    this.playerId = this.generatePlayerId();
    this.messageHandlers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('Connected to game server');
        this.startHeartbeat();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = () => {
        console.log('Disconnected from server');
        this.stopHeartbeat();
      };
    });
  }

  send(type, data = {}) {
    const message = {
      type,
      timestamp: Date.now(),
      playerId: this.playerId,
      data
    };

    this.ws.send(JSON.stringify(message));
  }

  // 注册消息处理器
  on(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  handleMessage(message) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data, message);
    }
  }

  // 心跳机制
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send('PING');
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  generatePlayerId() {
    return `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 使用示例
const client = new GameNetworkClient('ws://192.168.1.100:7777');

await client.connect();

// 注册消息处理器
client.on('PLAYER_JOINED', (data) => {
  console.log('玩家加入:', data);
  updatePlayerList(data.players);
});

client.on('GAME_STATE_UPDATE', (data) => {
  console.log('游戏状态更新:', data);
  updateGameUI(data.gameState);
});

// 加入房间
client.send('JOIN', {
  nickname: '玩家1',
  roomId: 'room-123',
  gameType: 'uno'
});

// 执行游戏操作
client.send('GAME_ACTION', {
  actionType: 'PLAY_CARD',
  actionData: { cardId: 'red-7' }
});
```

### 完整的服务器示例

```javascript
// server/index.js
const WebSocket = require('ws');

class GameServer {
  constructor(port = 7777) {
    this.wss = new WebSocket.Server({ port });
    this.rooms = new Map();
    this.clients = new Map(); // playerId -> ws

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log(`WebSocket server listening on port ${port}`);
  }

  handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    console.log(`Client connected: ${clientIp}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'unknown', 'INVALID_MESSAGE_FORMAT',
                       'Invalid JSON format', 'error');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  handleMessage(ws, message) {
    const { type, playerId, data } = message;

    // 保存客户端连接
    if (!this.clients.has(playerId)) {
      this.clients.set(playerId, ws);
    }

    switch (type) {
      case 'JOIN':
        this.handleJoin(ws, playerId, data);
        break;
      case 'LEAVE':
        this.handleLeave(ws, playerId, data);
        break;
      case 'START_GAME':
        this.handleStartGame(ws, playerId, data);
        break;
      case 'GAME_ACTION':
        this.handleGameAction(ws, playerId, data);
        break;
      case 'CHAT_MESSAGE':
        this.handleChatMessage(ws, playerId, data);
        break;
      case 'PING':
        this.handlePing(ws, playerId);
        break;
      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  handleJoin(ws, playerId, data) {
    const { roomId, nickname, gameType } = data;

    // 创建或获取房间
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        gameType,
        players: [],
        host: playerId,
        gameStarted: false
      });
    }

    const room = this.rooms.get(roomId);

    // 添加玩家到房间
    room.players.push({ id: playerId, nickname, isHost: playerId === room.host });

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

  handleGameAction(ws, playerId, data) {
    // 这里仅转发，游戏逻辑在前端
    // 服务器可选择性验证操作合法性

    const roomId = this.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(ws, playerId, 'GAME_NOT_FOUND',
                     '未找到游戏房间', 'error');
      return;
    }

    // 广播游戏操作（前端会处理状态更新）
    this.broadcast(roomId, {
      type: 'GAME_STATE_UPDATE',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        lastAction: {
          playerId,
          ...data
        }
        // 前端会根据 lastAction 更新本地状态
      }
    }, playerId); // 排除发送者
  }

  handlePing(ws, playerId) {
    const pong = {
      type: 'PONG',
      timestamp: Date.now(),
      playerId,
      data: { latency: 0 }
    };
    ws.send(JSON.stringify(pong));
  }

  broadcast(roomId, message, excludePlayerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players.forEach(player => {
      if (player.id === excludePlayerId) return;

      const ws = this.clients.get(player.id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  sendError(ws, playerId, code, message, severity = 'error') {
    const errorMessage = {
      type: 'ERROR',
      timestamp: Date.now(),
      playerId,
      data: { code, message, severity }
    };

    ws.send(JSON.stringify(errorMessage));
  }

  findPlayerRoom(playerId) {
    for (const [roomId, room] of this.rooms) {
      if (room.players.some(p => p.id === playerId)) {
        return roomId;
      }
    }
    return null;
  }

  handleDisconnect(ws) {
    // 查找断开连接的玩家
    let disconnectedPlayerId = null;
    for (const [playerId, clientWs] of this.clients) {
      if (clientWs === ws) {
        disconnectedPlayerId = playerId;
        break;
      }
    }

    if (disconnectedPlayerId) {
      const roomId = this.findPlayerRoom(disconnectedPlayerId);
      if (roomId) {
        const room = this.rooms.get(roomId);
        room.players = room.players.filter(p => p.id !== disconnectedPlayerId);

        this.broadcast(roomId, {
          type: 'PLAYER_LEFT',
          timestamp: Date.now(),
          playerId: 'server',
          data: {
            reason: 'disconnected',
            playerCount: room.players.length,
            players: room.players
          }
        });

        // 如果房间空了，删除房间
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        }
      }

      this.clients.delete(disconnectedPlayerId);
    }
  }
}

// 启动服务器
new GameServer(7777);
```

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1.2.0 | 2026-02-11 | 新增局后回房流程：`RETURN_TO_ROOM` / `RETURN_TO_ROOM_STATUS` |
| v1.1.0 | 2026-02-11 | 新增断线重连扩展协议；新增云端模式映射说明 |
| v1.0.0 | 2026-01-22 | 初始版本 |

---

## 联系方式

协议相关问题请联系：
- **项目仓库**: https://github.com/your-org/board-game-client
- **Issue 追踪**: https://github.com/your-org/board-game-client/issues

---

**注意**: 本协议遵循语义化版本控制。主版本号变更表示不兼容的协议变更，次版本号变更表示向后兼容的新增功能。
