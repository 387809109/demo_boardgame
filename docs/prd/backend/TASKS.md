# 后端开发任务清单 - AI Coding 专用

> 本文档为 AI 编程助手提供结构化的任务清单，按优先级和依赖关系排列。

---

## Phase 1: 核心框架 (P0)

### 1.1 项目初始化

- [ ] **T-B001** 创建项目目录结构
  ```
  server/
  ├── index.js
  ├── connection-manager.js
  ├── room-manager.js
  ├── message-router.js
  ├── broadcaster.js
  ├── config.js
  ├── utils/
  │   ├── logger.js
  │   └── validator.js
  ├── tests/
  └── package.json
  ```

- [ ] **T-B002** 初始化 package.json
  ```json
  {
    "name": "board-game-server",
    "version": "1.0.0",
    "main": "index.js",
    "scripts": {
      "start": "node index.js",
      "dev": "nodemon index.js",
      "test": "jest",
      "test:coverage": "jest --coverage"
    },
    "dependencies": {
      "ws": "^8.0.0"
    },
    "devDependencies": {
      "jest": "^29.0.0",
      "nodemon": "^3.0.0"
    }
  }
  ```

- [ ] **T-B003** 创建配置文件 `config.js`
  ```javascript
  module.exports = {
    port: process.env.PORT || 7777,
    env: process.env.NODE_ENV || 'development',
    maxConnections: 1000,
    heartbeatInterval: 30000,
    heartbeatTimeout: 90000,
    maxPlayersPerRoom: 8,
    maxRooms: 100,
    logLevel: process.env.LOG_LEVEL || 'info'
  };
  ```

---

### 1.2 工具模块

- [ ] **T-B010** 创建日志工具 `utils/logger.js`
  ```javascript
  const logger = {
    info(message, data) { /* ... */ }
    warn(message, data) { /* ... */ }
    error(message, data) { /* ... */ }
    debug(message, data) { /* ... */ }
  };
  module.exports = { logger };
  ```
  - 格式: `[LEVEL] ISO时间 消息 数据`
  - 支持配置日志级别

- [ ] **T-B011** 创建验证工具 `utils/validator.js`
  ```javascript
  function validateMessage(message) {
    // 验证必需字段: type, timestamp, playerId
    // 返回: { valid: boolean, error?: string }
  }

  function validatePlayerId(id) { /* ... */ }
  function validateRoomId(id) { /* ... */ }
  function validateNickname(name) { /* ... */ }

  module.exports = { validateMessage, validatePlayerId, validateRoomId, validateNickname };
  ```

---

### 1.3 连接管理

- [ ] **T-B020** 创建连接管理器 `connection-manager.js`
  ```javascript
  class ConnectionManager {
    constructor()
    addConnection(ws) // 返回 connectionId
    removeConnection(connectionId)
    bindPlayer(connectionId, playerId)
    getConnection(playerId) // 返回 ws
    getPlayerId(connectionId)
    getActiveConnections() // 返回连接数
  }
  ```
  - 依赖: T-B010
  - 数据结构:
    - `connections: Map<connectionId, Connection>`
    - `playerConnections: Map<playerId, connectionId>`

- [ ] **T-B021** 连接管理器单元测试
  - 测试添加连接
  - 测试绑定玩家
  - 测试移除连接
  - 测试获取连接

---

### 1.4 房间管理

- [ ] **T-B030** 创建房间管理器 `room-manager.js`
  ```javascript
  class RoomManager {
    constructor()
    createRoom(roomId, hostPlayerId, gameType) // 返回 Room
    joinRoom(roomId, playerId, nickname) // 返回 Room
    removePlayer(roomId, playerId)
    findPlayerRoom(playerId) // 返回 roomId | null
    getPlayers(roomId) // 返回 Player[]
    getPlayerCount(roomId)
    isHost(roomId, playerId)
    deleteRoom(roomId)
    getRoomCount()
  }
  ```
  - 依赖: T-B010
  - 数据结构: `rooms: Map<roomId, Room>`

- [ ] **T-B031** 房间管理器单元测试
  - 测试创建房间
  - 测试加入房间
  - 测试移除玩家
  - 测试查找玩家房间
  - 测试房间自动删除 (空房间)

---

### 1.5 消息路由

- [ ] **T-B040** 创建消息路由器 `message-router.js`
  ```javascript
  class MessageRouter {
    constructor(roomManager, connectionManager)
    route(connectionId, message)
    handleJoin(connectionId, playerId, data)
    handleLeave(connectionId, playerId, data)
    handleStartGame(connectionId, playerId, data)
    handleGameAction(connectionId, playerId, data)
    handleChatMessage(connectionId, playerId, data)
    handlePing(connectionId, playerId)
    broadcast(roomId, message, excludePlayerId?)
    sendError(connectionId, playerId, code, message, severity?)
  }
  ```
  - 依赖: T-B020, T-B030, T-B010

- [ ] **T-B041** 消息路由器单元测试
  - 测试 JOIN 消息处理
  - 测试 LEAVE 消息处理
  - 测试 GAME_ACTION 转发
  - 测试 PING/PONG 心跳
  - 测试错误处理

---

### 1.6 服务器入口

- [ ] **T-B050** 创建服务器入口 `index.js`
  ```javascript
  class GameServer {
    constructor(port)
    setupServer()
    handleConnection(ws, req)
    handleDisconnect(connectionId)
    broadcast(roomId, message)
    sendError(ws, playerId, code, message)
  }
  ```
  - 依赖: T-B020, T-B030, T-B040
  - 功能:
    - WebSocket 服务器初始化
    - 连接处理
    - 断开处理
    - 优雅关闭 (SIGTERM)

- [ ] **T-B051** 服务器集成测试
  - 测试连接建立
  - 测试消息收发
  - 测试断开处理

---

## Phase 2: 消息处理 (P0)

### 2.1 JOIN 消息

- [ ] **T-B060** 实现 JOIN 消息处理
  ```javascript
  handleJoin(connectionId, playerId, data) {
    const { roomId, nickname, gameType } = data;
    // 1. 创建或加入房间
    // 2. 绑定玩家到连接
    // 3. 广播 PLAYER_JOINED
  }
  ```
  - 输入: `{ roomId, nickname, gameType }`
  - 输出: 广播 `PLAYER_JOINED`
  - 错误: `ROOM_FULL`, `INVALID_ROOM_ID`

- [ ] **T-B061** JOIN 消息测试
  - 测试创建新房间
  - 测试加入已有房间
  - 测试房间满员拒绝

---

### 2.2 LEAVE 消息

- [ ] **T-B062** 实现 LEAVE 消息处理
  ```javascript
  handleLeave(connectionId, playerId, data) {
    // 1. 从房间移除玩家
    // 2. 广播 PLAYER_LEFT (reason: 'voluntary')
    // 3. 如果房间空了，删除房间
  }
  ```
  - 输出: 广播 `PLAYER_LEFT`

- [ ] **T-B063** LEAVE 消息测试
  - 测试正常离开
  - 测试房间自动删除

---

### 2.3 START_GAME 消息

- [ ] **T-B064** 实现 START_GAME 消息处理
  ```javascript
  handleStartGame(connectionId, playerId, data) {
    const { gameType, gameConfig } = data;
    // 1. 验证是否为房主
    // 2. 验证玩家数量
    // 3. 广播 GAME_STARTED
  }
  ```
  - 输入: `{ gameType, gameConfig }`
  - 输出: 广播 `GAME_STARTED`
  - 错误: `PERMISSION_DENIED`, `INVALID_PLAYER_COUNT`

- [ ] **T-B065** START_GAME 消息测试
  - 测试房主开始游戏
  - 测试非房主被拒绝

---

### 2.4 GAME_ACTION 消息

- [ ] **T-B066** 实现 GAME_ACTION 消息处理
  ```javascript
  handleGameAction(connectionId, playerId, data) {
    // 1. 查找玩家所在房间
    // 2. 仅转发，不做逻辑处理
    // 3. 广播 GAME_STATE_UPDATE
  }
  ```
  - 输入: `{ actionType, actionData }`
  - 输出: 广播 `GAME_STATE_UPDATE` (包含 `lastAction`)
  - 注意: **不验证操作合法性** (由前端处理)

- [ ] **T-B067** GAME_ACTION 消息测试
  - 测试正常转发
  - 测试玩家不在房间

---

### 2.5 CHAT_MESSAGE 消息

- [ ] **T-B068** 实现 CHAT_MESSAGE 消息处理
  ```javascript
  handleChatMessage(connectionId, playerId, data) {
    const { message, isPublic } = data;
    // 1. 验证消息长度
    // 2. 获取玩家昵称
    // 3. 广播 CHAT_MESSAGE_BROADCAST
  }
  ```
  - 输入: `{ message, isPublic }`
  - 输出: 广播 `CHAT_MESSAGE_BROADCAST`

- [ ] **T-B069** CHAT_MESSAGE 消息测试
  - 测试正常聊天
  - 测试消息过长

---

### 2.6 PING/PONG 心跳

- [ ] **T-B070** 实现心跳机制
  ```javascript
  handlePing(connectionId, playerId) {
    // 回复 PONG
    ws.send(JSON.stringify({
      type: 'PONG',
      timestamp: Date.now(),
      playerId,
      data: { latency: 0 }
    }));
  }
  ```
  - 客户端每 30 秒发送 PING
  - 服务器立即回复 PONG

- [ ] **T-B071** 实现心跳超时检测 (可选)
  - 90 秒无心跳断开连接

---

## Phase 3: 断开处理 (P1)

### 3.1 断开连接处理

- [ ] **T-B080** 实现断开连接处理
  ```javascript
  handleDisconnect(connectionId) {
    // 1. 获取玩家 ID
    // 2. 查找玩家所在房间
    // 3. 从房间移除玩家
    // 4. 广播 PLAYER_LEFT (reason: 'disconnected')
    // 5. 删除连接
  }
  ```
  - 输出: 广播 `PLAYER_LEFT`

- [ ] **T-B081** 断开处理测试
  - 测试正常断开
  - 测试房主断开

---

### 3.2 房主断开处理

- [ ] **T-B082** 实现房主断开处理
  ```javascript
  // 当房主断开时，游戏结束
  // 广播 GAME_ENDED (reason: 'host_disconnected')
  ```
  - 或: 转移房主给下一个玩家 (可选)

---

## Phase 4: 错误处理 (P1)

### 4.1 消息验证

- [ ] **T-B090** 实现消息格式验证
  ```javascript
  function validateMessage(message) {
    if (!message.type) return { valid: false, error: 'Missing type' };
    if (!message.timestamp) return { valid: false, error: 'Missing timestamp' };
    if (!message.playerId) return { valid: false, error: 'Missing playerId' };
    return { valid: true };
  }
  ```

- [ ] **T-B091** 实现错误响应
  ```javascript
  function sendError(ws, playerId, code, message, severity = 'error') {
    ws.send(JSON.stringify({
      type: 'ERROR',
      timestamp: Date.now(),
      playerId,
      data: { code, message, severity }
    }));
  }
  ```

---

### 4.2 异常处理

- [ ] **T-B092** 实现全局异常捕获
  ```javascript
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
  ```

- [ ] **T-B093** 实现优雅关闭
  ```javascript
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received: closing server');
    wss.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
  ```

---

## Phase 5: 广播优化 (P2)

### 5.1 广播器

- [ ] **T-B100** 创建广播器 `broadcaster.js`
  ```javascript
  class Broadcaster {
    constructor(connectionManager)
    broadcastToRoom(roomId, message, excludePlayerId?)
    broadcastToPlayer(playerId, message)
    broadcastToAll(message)
  }
  ```

- [ ] **T-B101** 实现排除发送者广播
  - 避免操作者收到自己的操作

---

### 5.2 消息队列 (可选)

- [ ] **T-B102** 实现消息队列
  - 防止消息堆积
  - 批量发送优化

---

## Phase 6: 监控与日志 (P2)

### 6.1 统计信息

- [ ] **T-B110** 实现统计信息收集
  ```javascript
  class Statistics {
    getActiveConnections()
    getActiveRooms()
    getMessageCount()
    getUptime()
  }
  ```

- [ ] **T-B111** 实现健康检查端点 (可选)
  ```javascript
  // HTTP 端点: GET /health
  // 返回: { status: 'ok', connections: 10, rooms: 2 }
  ```

---

### 6.2 日志增强

- [ ] **T-B112** 实现结构化日志
  ```javascript
  logger.info('Player joined', {
    playerId: 'xxx',
    roomId: 'yyy',
    timestamp: Date.now()
  });
  ```

- [ ] **T-B113** 实现日志文件输出 (可选)
  - 使用 winston 或 pino

---

## Phase 7: 断线重连支持 (P1)

### 7.1 会话恢复协议

- [x] **T-B114** 实现断线重连会话恢复 ✅（本地 WebSocket 模式）
  - 新增消息类型: `RECONNECT_REQUEST`, `RECONNECT_ACCEPTED`, `RECONNECT_REJECTED`, `GAME_SNAPSHOT`
  - `RoomManager` 支持已开局房间的“玩家回填”而非直接拒绝 `gameStarted` 房间加入
  - 为房间维护短期会话窗口（TTL），在窗口内允许同 `playerId/sessionId` 重连
  - `MessageRouter` 增加重连校验流程:
    - 校验 roomId/playerId/sessionId
    - 成功后广播 `PLAYER_RECONNECTED`
    - 失败返回明确原因（会话过期、房间不存在、身份冲突）
  - 验收:
    - 非房主断线后可在 TTL 内恢复连接与玩家身份
    - 超时/无效重连请求会被拒绝并返回错误码
    - 不破坏现有 `JOIN/LEAVE/PLAYER_LEFT` 流程

- [x] **T-B115** 断线重连测试 ✅（单元 + 集成）
  - 覆盖 `ConnectionManager` / `RoomManager` / `MessageRouter` 单元测试
  - 覆盖服务器集成测试（断线、重连、超时、房间销毁）
  - 验证重连后广播与玩家列表一致性

### 7.2 重连机制改进

- [x] **T-B116** 支持房主断线重连 ✅（高优先级，T-C044 前置）
  - 当前问题: 房主断线时房间立即销毁，所有玩家丢失对局
  - 修改 `message-router.js` `handleDisconnect`: 移除 `!disconnectedPlayer.isHost` 限制，房主断线同样创建 reconnectSession
  - 房主断线期间冻结房间（不接受新的 GAME_ACTION），其他玩家 UI 显示"房主断线，等待重连..."
  - 房主重连后恢复正常转发
  - 超时后才销毁房间（与非房主 TTL 一致或更长）
  - 验收:
    - 房主短暂断线后可在 TTL 内恢复连接与房主身份
    - 超时后房间正常销毁
    - 不破坏现有非房主重连流程

- [x] **T-B117** 广播 PLAYER_DISCONNECTED 通知 ✅（高优先级，T-C044 前置）
  - 当前问题: 玩家断线进入重连窗口期间，其他玩家没有任何断线提示，需等到重连或超时才有反馈
  - 修改 `message-router.js` `handleDisconnect`: 创建 reconnectSession 后立即广播 `PLAYER_DISCONNECTED` 消息
  - 消息格式: `{ type: 'PLAYER_DISCONNECTED', data: { playerId, nickname, reconnectWindowMs } }`
  - 前端收到后在 UI 显示"玩家 X 断线中，等待重连..."
  - 重连成功后 `PLAYER_RECONNECTED` 广播清除断线状态
  - 更新 `docs/PROTOCOL.md` 增加 `PLAYER_DISCONNECTED` 消息类型
  - 依赖: T-B114
  - 验收:
    - 玩家断线后其他玩家立即看到断线提示
    - 重连成功后提示消失
    - 超时后正常触发 PLAYER_LEFT

- [ ] **T-B118** 按需快照替代逐 action 全量传输 ⬜（中优先级）
  - 当前问题: 每次 GAME_ACTION 都携带 `gameState: this.currentGame.getState()`，即完整内部状态（含所有玩家手牌、隐藏信息），既浪费带宽又泄露隐藏信息
  - 方案: GAME_ACTION 不再附带 gameState；仅在收到 RECONNECT_REQUEST 时由服务器向房主请求快照（新增 `SNAPSHOT_REQUEST` → 房主回复 `SNAPSHOT_RESPONSE`）
  - 服务器收到 `SNAPSHOT_RESPONSE` 后转发为 `GAME_SNAPSHOT` 给重连玩家
  - 房主使用 `getVisibleState(playerId)` 生成针对重连玩家的可见状态
  - 修改: `message-router.js`, `room-manager.js` (移除 gameSnapshot 存储), 前端 `main.js`, `network.js`
  - 依赖: T-B114
  - 验收:
    - GAME_ACTION 消息体减小（不含 gameState）
    - 重连快照仅含重连玩家应可见的信息
    - 不影响现有游戏同步流程

- [x] **T-B119** 定期清理过期重连会话 ✅（低优先级，T-B116 中一并实现）
  - 当前问题: `_pruneExpiredReconnectSessions` 仅在 create/reconnect 时懒执行，若无后续断线/重连事件则过期会话和 ghost 玩家驻留内存
  - 方案: 在现有心跳检查循环 (`heartbeatCheckInterval: 15s`) 中增加对所有房间的过期会话清理
  - 修改: `index.js` 心跳检查逻辑, `room-manager.js` 新增 `pruneAllExpiredSessions()` 方法
  - 依赖: T-B114
  - 验收:
    - 过期会话在 15~30s 内自动清理
    - ghost 玩家从 players 列表移除并广播 PLAYER_LEFT

- [ ] **T-B120** 使用 crypto.randomUUID 生成 sessionId ⬜（低优先级）
  - 当前问题: 前端使用 `Math.random().toString(36)` 生成 sessionId，不具备密码学安全性
  - 方案: 前端 `_generateSessionId()` 改用 `crypto.randomUUID()`（所有现代浏览器支持）
  - 修改: `frontend/src/main.js` `_generateSessionId` 方法
  - 验收: sessionId 格式为标准 UUID v4

---

## 任务依赖图

```
T-B001 → T-B002 → T-B003
              ↓
T-B010 → T-B011
    ↓
T-B020 → T-B021
    ↓
T-B030 → T-B031
    ↓
T-B040 → T-B041
    ↓
T-B050 → T-B051
    ↓
T-B060 → T-B062 → T-B064 → T-B066 → T-B068 → T-B070
    ↓
T-B080 → T-B082 → T-B114 → T-B115 → T-B116 → T-B117
    ↓                                    ↓
                                       T-B118
                                       T-B119
                                       T-B120
T-B090 → T-B092 → T-B093
    ↓
T-B100 → T-B110
```

---

## 验收标准

### 代码质量

- [ ] 所有函数都有 JSDoc 注释
- [ ] 遵循命名规范
- [ ] 单文件不超过 300 行
- [ ] 无 ESLint 错误
- [ ] 所有异常都被捕获

### 功能验收

- [ ] 服务器正常启动
- [ ] 客户端可以连接
- [ ] 消息正常收发
- [ ] 断开正确处理
- [ ] 房间管理正常

### 测试覆盖

- [ ] 连接管理器覆盖率 > 90%
- [ ] 房间管理器覆盖率 > 90%
- [ ] 消息路由器覆盖率 > 80%
- [ ] 所有测试通过

### 性能验收

- [ ] 支持 1000 并发连接
- [ ] 消息处理延迟 < 10ms
- [ ] 内存占用 < 100MB

---

## AI 编程提示

### 创建管理器模块

```
请基于 docs/prd/backend/README.md 中的模板，
创建 [模块名称] 管理器，包括：
1. 类定义和所有方法
2. JSDoc 类型注释
3. 错误处理
4. 日志记录
5. 单元测试
```

### 实现消息处理

```
请基于 docs/PROTOCOL.md 中的协议规范，
实现 [消息类型] 的处理逻辑，要求：
1. 验证消息格式
2. 执行业务逻辑
3. 广播响应消息
4. 处理错误情况
5. 添加日志
```

### 编写测试

```
请基于 docs/prd/backend/README.md 中的测试模板，
为 [模块名称] 编写单元测试，覆盖：
1. 正常流程
2. 边界情况
3. 错误情况
目标覆盖率: 90%+
```

---

## 快速测试命令

```bash
# 启动服务器
npm run dev

# 使用 wscat 测试
npm install -g wscat
wscat -c ws://localhost:7777

# 发送测试消息
> {"type":"PING","timestamp":1705900800000,"playerId":"test","data":{}}

# 期望收到 PONG
< {"type":"PONG","timestamp":...,"playerId":"test","data":{"latency":0}}
```

---

## 注意事项

1. **仅转发原则**: GAME_ACTION 消息只转发，不做任何验证
2. **无状态设计**: 每条消息包含完整上下文
3. **容错性**: 任何异常都不能导致服务器崩溃
4. **日志详尽**: 所有关键操作都要记录日志
5. **测试优先**: 每个模块都要有对应的测试
