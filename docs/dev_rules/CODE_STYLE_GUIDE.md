# 代码风格指南 - Code Style Guide

本文档定义了项目的代码风格规范，确保代码库的一致性和可读性。

## 目录
1. [命名规范](#命名规范)
2. [文件组织](#文件组织)
3. [文件大小限制](#文件大小限制)
4. [代码格式](#代码格式)
5. [注释规范](#注释规范)
6. [错误处理](#错误处理)
7. [TypeScript特定规范](#typescript特定规范)

---

## 命名规范

### 通用规则
- 使用英文命名（除非是业务特定的中文术语）
- 名称应该清晰表达意图
- 避免缩写（除非是众所周知的，如 `id`, `url`, `ip`）

### 类名 (PascalCase)
```typescript
// ✅ 正确
class GameEngine { }
class NetworkManager { }
class CardDeck { }

// ❌ 错误
class gameEngine { }
class network_manager { }
class cardDeck { }
```

### 接口名 (PascalCase)
```typescript
// ✅ 正确 - 使用 I 前缀（可选，根据团队偏好）
interface IGameState { }
interface GameState { }

// ✅ 正确 - 描述性名称
interface NetworkConnection { }
interface PlayerData { }

// ❌ 错误
interface gameState { }
interface iGameState { }
```

### 函数/方法名 (camelCase)
```typescript
// ✅ 正确 - 动词开头
function startGame() { }
function calculateScore() { }
function isValidMove() { }
function hasWinner() { }

// ❌ 错误
function StartGame() { }
function score() { }  // 不清楚是获取还是计算
function valid_move() { }
```

### 变量名 (camelCase)
```typescript
// ✅ 正确
let playerCount = 0;
let currentCard: Card;
let isGameActive = true;

// ❌ 错误
let PlayerCount = 0;
let current_card: Card;
let is_game_active = true;
```

### 常量名 (UPPER_SNAKE_CASE)
```typescript
// ✅ 正确
const MAX_PLAYERS = 8;
const DEFAULT_PORT = 7777;
const GAME_VERSION = '1.0.0';

// 对于配置对象，使用 camelCase
const gameConfig = {
  maxPlayers: 8,
  defaultPort: 7777
} as const;

// ❌ 错误
const max_players = 8;
const MaxPlayers = 8;
```

### 枚举 (PascalCase)
```typescript
// ✅ 正确
enum GameState {
  Waiting = 'WAITING',
  Playing = 'PLAYING',
  Finished = 'FINISHED'
}

enum CardColor {
  Red = 'RED',
  Blue = 'BLUE',
  Green = 'GREEN',
  Yellow = 'YELLOW'
}

// ❌ 错误
enum gameState { }
enum CARD_COLOR { }
```

### 文件名
```
// ✅ 正确 - kebab-case
game-engine.ts
network-manager.ts
card-deck.ts
player-controller.ts

// ✅ 正确 - PascalCase（对于单一导出的类）
GameEngine.ts
NetworkManager.ts

// ❌ 错误
gameEngine.ts
game_engine.ts
GameEngine.JS.ts
```

---

## 文件组织

### 项目结构
```
src/
├── core/              # 核心引擎
│   ├── game-engine.ts
│   ├── rule-engine.ts
│   └── state-manager.ts
├── games/             # 游戏模块
│   ├── uno/
│   │   ├── UNOGame.ts
│   │   ├── uno-rules.ts
│   │   └── config.json
│   └── werewolf/
│       ├── WerewolfGame.ts
│       └── werewolf-rules.ts
├── network/           # 网络通信
│   ├── host-manager.ts
│   ├── client-manager.ts
│   └── protocol.ts
├── ui/                # 用户界面
│   ├── components/
│   ├── screens/
│   └── styles/
├── utils/             # 工具函数
│   ├── validator.ts
│   ├── logger.ts
│   └── config-manager.ts
└── types/             # 类型定义
    ├── game.types.ts
    ├── network.types.ts
    └── index.ts
```

### 文件内部组织
```typescript
// 1. 导入 - 按类型分组
// 外部依赖
import { EventEmitter } from 'events';
import * as fs from 'fs';

// 内部模块
import { GameState } from '@/types/game.types';
import { RuleEngine } from '@/core/rule-engine';
import { Validator } from '@/utils/validator';

// 类型导入
import type { Player, Move } from '@/types';

// 2. 常量定义
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

// 3. 类型定义（如果只在本文件使用）
interface InternalConfig {
  // ...
}

// 4. 主要类/函数
export class GameEngine {
  // ...
}

// 5. 辅助函数（如果需要导出）
export function helperFunction() {
  // ...
}

// 6. 私有辅助函数
function privateHelper() {
  // ...
}
```

---

## 文件大小限制

### 单文件行数限制

**规则**：单个代码文件不应超过 **1000 行**。

当文件达到或超过 1000 行时，必须进行重构和拆分。

### 为什么要限制文件大小？

1. **可读性**：过大的文件难以阅读和理解
2. **可维护性**：大文件更容易产生合并冲突
3. **职责分离**：大文件通常意味着违反了单一职责原则
4. **性能**：IDE 处理大文件时性能会下降
5. **测试困难**：大文件的代码通常更难测试

### 如何拆分大文件

#### 示例 1：拆分大类

```typescript
// ❌ 错误 - 单个文件超过 1000 行
// game-engine.ts (1200 lines)
export class GameEngine {
  // 初始化相关方法 (200 lines)
  initialize() { /* ... */ }
  loadConfig() { /* ... */ }
  setupPlayers() { /* ... */ }

  // 游戏流程方法 (300 lines)
  startGame() { /* ... */ }
  processRound() { /* ... */ }
  endGame() { /* ... */ }

  // 规则验证方法 (400 lines)
  validateMove() { /* ... */ }
  checkWinCondition() { /* ... */ }
  calculateScore() { /* ... */ }

  // 状态管理方法 (300 lines)
  saveState() { /* ... */ }
  loadState() { /* ... */ }
  resetState() { /* ... */ }
}

// ✅ 正确 - 拆分成多个文件
// game-engine.ts (150 lines) - 主要协调逻辑
export class GameEngine {
  private initializer: GameInitializer;
  private flowManager: GameFlowManager;
  private validator: GameValidator;
  private stateManager: GameStateManager;

  constructor() {
    this.initializer = new GameInitializer();
    this.flowManager = new GameFlowManager();
    this.validator = new GameValidator();
    this.stateManager = new GameStateManager();
  }

  async start() {
    await this.initializer.initialize();
    this.flowManager.startGame();
  }
}

// game-initializer.ts (200 lines) - 初始化逻辑
export class GameInitializer {
  initialize() { /* ... */ }
  loadConfig() { /* ... */ }
  setupPlayers() { /* ... */ }
}

// game-flow-manager.ts (300 lines) - 游戏流程
export class GameFlowManager {
  startGame() { /* ... */ }
  processRound() { /* ... */ }
  endGame() { /* ... */ }
}

// game-validator.ts (400 lines) - 规则验证
export class GameValidator {
  validateMove() { /* ... */ }
  checkWinCondition() { /* ... */ }
  calculateScore() { /* ... */ }
}

// game-state-manager.ts (300 lines) - 状态管理
export class GameStateManager {
  saveState() { /* ... */ }
  loadState() { /* ... */ }
  resetState() { /* ... */ }
}
```

#### 示例 2：提取工具函数

```typescript
// ❌ 错误 - 混合业务逻辑和工具函数
// uno-game.ts (1100 lines)
export class UNOGame {
  // 核心游戏逻辑 (500 lines)
  playCard() { /* ... */ }
  drawCard() { /* ... */ }

  // 工具函数 (600 lines)
  shuffleArray(array: any[]) { /* ... */ }
  randomInt(min: number, max: number) { /* ... */ }
  deepClone(obj: any) { /* ... */ }
  validateCardColor(color: string) { /* ... */ }
  // ... 更多工具函数
}

// ✅ 正确 - 提取工具函数到独立文件
// uno-game.ts (500 lines) - 核心游戏逻辑
import { shuffleArray, randomInt, deepClone } from '@/utils/array-utils';
import { validateCardColor } from '@/utils/card-validators';

export class UNOGame {
  playCard() {
    const shuffled = shuffleArray(this.deck);
    // ...
  }

  drawCard() { /* ... */ }
}

// utils/array-utils.ts (200 lines)
export function shuffleArray<T>(array: T[]): T[] { /* ... */ }
export function randomInt(min: number, max: number): number { /* ... */ }
export function deepClone<T>(obj: T): T { /* ... */ }

// utils/card-validators.ts (400 lines)
export function validateCardColor(color: string): boolean { /* ... */ }
// ... 其他验证函数
```

#### 示例 3：拆分成模块

```typescript
// ❌ 错误 - 单个文件包含太多功能
// network-manager.ts (1500 lines)
export class NetworkManager {
  // TCP 连接 (400 lines)
  connectTCP() { /* ... */ }
  sendTCP() { /* ... */ }

  // 协议处理 (500 lines)
  encodeMessage() { /* ... */ }
  decodeMessage() { /* ... */ }

  // 错误处理 (300 lines)
  handleConnectionError() { /* ... */ }
  handleTimeoutError() { /* ... */ }

  // 重连逻辑 (300 lines)
  retry() { /* ... */ }
  backoff() { /* ... */ }
}

// ✅ 正确 - 拆分成功能模块
// network/
// ├── index.ts (100 lines) - 主入口
// ├── tcp-connection.ts (400 lines) - TCP 连接
// ├── protocol.ts (500 lines) - 协议处理
// ├── error-handler.ts (300 lines) - 错误处理
// └── retry-manager.ts (300 lines) - 重连逻辑

// network/index.ts
export class NetworkManager {
  private connection: TCPConnection;
  private protocol: ProtocolHandler;
  private errorHandler: ErrorHandler;
  private retryManager: RetryManager;

  constructor() {
    this.connection = new TCPConnection();
    this.protocol = new ProtocolHandler();
    this.errorHandler = new ErrorHandler();
    this.retryManager = new RetryManager();
  }
}

// network/tcp-connection.ts
export class TCPConnection {
  connect() { /* ... */ }
  send() { /* ... */ }
}

// network/protocol.ts
export class ProtocolHandler {
  encode() { /* ... */ }
  decode() { /* ... */ }
}
```

### 拆分策略

#### 1. 按职责拆分（推荐）
- 每个文件负责一个明确的职责
- 符合单一职责原则

#### 2. 按功能模块拆分
- 将相关功能组织到子目录
- 使用 index.ts 作为模块入口

#### 3. 提取公共代码
- 工具函数提取到 utils/
- 类型定义提取到 types/
- 常量提取到 constants/

### 重构检查清单

当文件接近 1000 行时，检查是否可以：

- [ ] 提取独立的类
- [ ] 提取工具函数
- [ ] 提取类型定义
- [ ] 提取常量
- [ ] 将大方法拆分成小方法
- [ ] 创建子模块
- [ ] 使用组合代替继承

### 例外情况

在极少数情况下，某些文件可能需要超过 1000 行：

1. **自动生成的代码**（如 API 类型定义）
2. **配置文件**（如大型配置对象）
3. **测试文件**（包含大量测试用例）

即使是例外情况，也应：
- 在文件顶部添加注释说明原因
- 定期审查是否可以优化
- 确保代码结构清晰

```typescript
/**
 * Auto-generated API types
 *
 * WARNING: This file exceeds 1000 lines
 * Reason: Generated from OpenAPI specification
 *
 * DO NOT EDIT MANUALLY - Changes will be overwritten
 */
```

---

## 代码格式

### 缩进和空格
```typescript
// ✅ 正确 - 2空格缩进
class GameEngine {
  private state: GameState;

  constructor() {
    this.state = {
      players: [],
      currentPlayer: 0
    };
  }

  startGame() {
    if (this.state.players.length < 2) {
      throw new Error('Not enough players');
    }
  }
}

// ❌ 错误 - 不一致的缩进
class GameEngine {
    private state: GameState;

      constructor() {
      this.state = {
          players: [],
        currentPlayer: 0
      };
    }
}
```

### 行长度
```typescript
// ✅ 正确 - 限制在 100 字符以内
const message =
  'This is a long message that needs to be split ' +
  'across multiple lines for better readability';

// ✅ 正确 - 长参数列表换行
function createGame(
  name: string,
  minPlayers: number,
  maxPlayers: number,
  config: GameConfig
): Game {
  // ...
}

// ❌ 错误 - 单行过长
const message = 'This is a very long message that goes beyond the recommended line length and makes the code harder to read';
```

### 空行使用
```typescript
// ✅ 正确
class GameEngine {
  private state: GameState;
  private rules: RuleEngine;

  constructor() {
    this.state = this.initializeState();
    this.rules = new RuleEngine();
  }

  startGame(): void {
    this.validatePlayers();
    this.dealCards();
    this.notifyPlayers();
  }

  private validatePlayers(): void {
    // ...
  }

  private dealCards(): void {
    // ...
  }
}

// ❌ 错误 - 缺少空行分隔
class GameEngine {
  private state: GameState;
  constructor() {
    this.state = this.initializeState();
  }
  startGame(): void {
    this.validatePlayers();
  }
  private validatePlayers(): void {
    // ...
  }
}
```

### 括号和空格
```typescript
// ✅ 正确
if (condition) {
  doSomething();
}

for (let i = 0; i < array.length; i++) {
  process(array[i]);
}

const result = calculate(a, b, c);

// ❌ 错误
if(condition){
  doSomething();
}

for(let i=0;i<array.length;i++){
  process(array[i]);
}

const result=calculate(a,b,c);
```

---

## 注释规范

### 文件头注释
```typescript
/**
 * Game Engine - Core game logic and state management
 *
 * @module core/game-engine
 * @description Manages the overall game flow, state transitions,
 *              and coordinates between different game components.
 */
```

### 类注释
```typescript
/**
 * Manages network connections for multiplayer games
 *
 * This class handles both host and client connections,
 * implementing the TCP protocol for reliable data transfer.
 *
 * @example
 * ```typescript
 * const manager = new NetworkManager();
 * await manager.connect('192.168.1.100', 7777);
 * manager.send({ type: 'MOVE', data: move });
 * ```
 */
export class NetworkManager {
  // ...
}
```

### 方法注释
```typescript
/**
 * Validates if a move is legal according to game rules
 *
 * @param move - The move to validate
 * @param state - Current game state
 * @returns True if the move is valid, false otherwise
 *
 * @throws {ValidationError} If the move data is malformed
 *
 * @example
 * ```typescript
 * const isValid = game.validateMove(
 *   { player: 0, card: myCard },
 *   currentState
 * );
 * ```
 */
validateMove(move: Move, state: GameState): boolean {
  // ...
}
```

### 行内注释
```typescript
// ✅ 正确 - 解释"为什么"，而非"是什么"
// Use setTimeout instead of setInterval to prevent overlapping executions
setTimeout(() => this.update(), 100);

// Shuffle algorithm: Fisher-Yates shuffle for uniform distribution
for (let i = array.length - 1; i > 0; i--) {
  // ...
}

// ❌ 错误 - 只是重复代码内容
// Loop through array
for (let i = 0; i < array.length; i++) {
  // Increment i
  i++;
}
```

### TODO 注释
```typescript
// TODO(username): Add input validation
// TODO: Implement AI opponent logic (Phase 3)
// FIXME: Memory leak in long-running games
// HACK: Temporary workaround for network timing issue
// NOTE: This approach is slower but more reliable
```

---

## 错误处理

### 自定义错误类
```typescript
// ✅ 正确 - 定义特定的错误类型
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}

export class ValidationError extends GameError {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public code: string,
    public retry: boolean = true
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
```

### 错误处理模式
```typescript
// ✅ 正确 - 清晰的错误处理
function processMove(move: Move, state: GameState): GameState {
  // 验证输入
  if (!move || !state) {
    throw new ValidationError('Move and state are required', 'move');
  }

  // 验证业务规则
  if (!this.isValidMove(move, state)) {
    throw new GameError(`Invalid move: ${move.type}`);
  }

  try {
    // 执行操作
    return this.executeMove(move, state);
  } catch (error) {
    // 记录错误并重新抛出
    console.error('Failed to execute move:', error);
    throw new GameError('Move execution failed');
  }
}

// ✅ 正确 - 异步错误处理
async function connectToHost(ip: string): Promise<void> {
  try {
    await this.connection.connect(ip, DEFAULT_PORT);
    this.emit('connected');
  } catch (error) {
    if (error instanceof NetworkError && error.retry) {
      // 可重试的错误
      console.warn('Connection failed, retrying...');
      await this.retryConnection(ip);
    } else {
      // 不可恢复的错误
      this.emit('error', error);
      throw error;
    }
  }
}

// ❌ 错误 - 吞掉错误
function processMove(move: Move): void {
  try {
    this.execute(move);
  } catch (error) {
    // 什么都不做
  }
}

// ❌ 错误 - 捕获所有错误
function processMove(move: Move): void {
  try {
    this.execute(move);
  } catch (error) {
    console.log('Error occurred');  // 丢失了错误信息
  }
}
```

---

## TypeScript特定规范

### 类型注解
```typescript
// ✅ 正确 - 显式类型注解（公共API）
export function calculateScore(
  players: Player[],
  bonusMultiplier: number = 1
): number {
  // ...
}

// ✅ 正确 - 类型推断（内部变量）
const score = calculateScore(players);  // TypeScript 会推断类型
const total = score * 2;

// ✅ 正确 - 复杂类型使用类型别名
type GameConfig = {
  maxPlayers: number;
  timeLimit: number;
  rules: RuleSet;
};

// ❌ 错误 - 滥用 any
function process(data: any): any {
  return data;
}

// ✅ 正确 - 使用泛型或具体类型
function process<T>(data: T): T {
  return data;
}
```

### 接口 vs 类型别名
```typescript
// ✅ 正确 - 使用 interface 定义对象形状
interface Player {
  id: string;
  name: string;
  score: number;
}

// ✅ 正确 - 接口可以被扩展
interface ExtendedPlayer extends Player {
  avatar: string;
  level: number;
}

// ✅ 正确 - 使用 type 定义联合类型、交叉类型
type GameStatus = 'waiting' | 'playing' | 'finished';
type Nullable<T> = T | null;
type Combined = PlayerData & GameStats;

// ✅ 正确 - 使用 type 定义函数类型
type MoveValidator = (move: Move, state: GameState) => boolean;
```

### 可选属性和默认值
```typescript
// ✅ 正确
interface GameConfig {
  name: string;
  maxPlayers?: number;  // 可选属性
  timeLimit?: number;
}

class Game {
  constructor(
    private config: GameConfig,
    private debug: boolean = false  // 默认值
  ) {
    // 使用默认值
    const maxPlayers = config.maxPlayers ?? 8;
    const timeLimit = config.timeLimit ?? 3600;
  }
}

// ❌ 错误 - 不处理 undefined
function startGame(config: GameConfig) {
  const max = config.maxPlayers;  // 可能是 undefined
  for (let i = 0; i < max; i++) {  // 运行时错误
    // ...
  }
}
```

### 严格模式
```typescript
// tsconfig.json 应该启用严格模式
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}

// ✅ 正确 - 处理 null/undefined
function findPlayer(id: string): Player | null {
  return this.players.find(p => p.id === id) ?? null;
}

const player = findPlayer('123');
if (player) {
  console.log(player.name);  // 类型守卫
}

// ❌ 错误 - 未处理可能的 null
const player = findPlayer('123');
console.log(player.name);  // 编译错误：player 可能为 null
```

---

## 代码审查检查清单

提交代码前，请检查：

### 命名
- [ ] 类名使用 PascalCase
- [ ] 函数/变量使用 camelCase
- [ ] 常量使用 UPPER_SNAKE_CASE
- [ ] 名称清晰表达意图

### 格式
- [ ] 使用 2 空格缩进
- [ ] 行长度不超过 100 字符
- [ ] 适当使用空行分隔
- [ ] 括号和空格使用一致
- [ ] 单文件行数不超过 1000 行

### 注释
- [ ] 公共 API 有完整注释
- [ ] 复杂逻辑有解释注释
- [ ] 注释解释"为什么"而非"是什么"
- [ ] 没有注释掉的代码

### TypeScript
- [ ] 公共 API 有类型注解
- [ ] 避免使用 any
- [ ] 处理 null/undefined
- [ ] 使用严格模式

### 错误处理
- [ ] 不吞掉错误
- [ ] 使用自定义错误类型
- [ ] 错误信息清晰
- [ ] 适当的错误传播

---

## 工具配置

### ESLint 配置示例
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "indent": ["error", 2],
    "max-len": ["warn", { "code": 100 }],
    "max-lines": ["error", { "max": 1000, "skipBlankLines": true, "skipComments": true }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

### Prettier 配置示例
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

---

遵循这些规范将使代码库保持一致性，提高可读性和可维护性。
