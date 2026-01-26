# 开发原则 - Development Principles

本项目遵循以下核心开发原则，以确保代码质量、可维护性和可扩展性。

## 核心原则

### 1. SOLID 原则

#### S - Single Responsibility Principle (单一职责原则)
**定义**：一个类或模块应该只有一个引起它变化的原因。

**在本项目中的应用**：
```typescript
// ❌ 错误示例：一个类承担多个职责
class Game {
  startGame() { /* ... */ }
  renderUI() { /* ... */ }
  saveToDatabase() { /* ... */ }
  sendNetworkData() { /* ... */ }
}

// ✅ 正确示例：职责分离
class GameEngine {
  startGame() { /* ... */ }
  updateGameState() { /* ... */ }
}

class GameRenderer {
  render(gameState) { /* ... */ }
}

class GameStorage {
  saveConfig(config) { /* ... */ }
}

class NetworkManager {
  sendData(data) { /* ... */ }
}
```

**实践要点**：
- 每个游戏模块只负责该游戏的规则逻辑
- UI渲染与游戏逻辑分离
- 网络通信与游戏状态管理分离
- 配置管理独立成模块

---

#### O - Open/Closed Principle (开闭原则)
**定义**：软件实体应该对扩展开放，对修改关闭。

**在本项目中的应用**：
```typescript
// ✅ 使用抽象基类，便于扩展新游戏
abstract class BoardGame {
  abstract initGame(playerCount: number): GameState;
  abstract validateMove(move: Move, state: GameState): boolean;
  abstract executeMove(move: Move, state: GameState): GameState;
  abstract checkWinCondition(state: GameState): Player | null;
}

// 添加新游戏时，不需要修改基类，只需继承
class UNOGame extends BoardGame {
  initGame(playerCount: number): GameState {
    // UNO特定的初始化逻辑
  }

  validateMove(move: Move, state: GameState): boolean {
    // UNO特定的规则验证
  }

  // 实现其他抽象方法...
}

class WerewolfGame extends BoardGame {
  // 狼人杀游戏的实现
}
```

**实践要点**：
- 使用插件化架构，新增游戏无需修改核心代码
- 定义清晰的接口和抽象类
- 通过配置文件扩展功能，而非硬编码

---

#### L - Liskov Substitution Principle (里氏替换原则)
**定义**：子类对象应该能够替换父类对象，而不影响程序的正确性。

**在本项目中的应用**：
```typescript
// ✅ 子类完全符合父类契约
interface NetworkConnection {
  connect(ip: string, port: number): Promise<boolean>;
  send(data: any): void;
  disconnect(): void;
}

class TCPConnection implements NetworkConnection {
  async connect(ip: string, port: number): Promise<boolean> {
    // TCP连接实现
    return true;
  }

  send(data: any): void {
    // 发送数据
  }

  disconnect(): void {
    // 断开连接
  }
}

// 可以无缝替换
class MockConnection implements NetworkConnection {
  async connect(ip: string, port: number): Promise<boolean> {
    console.log(`Mock: Connected to ${ip}:${port}`);
    return true;
  }

  send(data: any): void {
    console.log('Mock: Data sent', data);
  }

  disconnect(): void {
    console.log('Mock: Disconnected');
  }
}

// 使用时可以互换
function startMultiplayer(connection: NetworkConnection) {
  connection.connect('192.168.1.100', 7777);
  // 无论是TCPConnection还是MockConnection都能正常工作
}
```

**实践要点**：
- 子类不应该违反父类的契约
- 不要在子类中抛出父类没有声明的异常
- 保持方法签名的一致性

---

#### I - Interface Segregation Principle (接口隔离原则)
**定义**：客户端不应该被迫依赖它不使用的接口。

**在本项目中的应用**：
```typescript
// ❌ 错误示例：臃肿的接口
interface GameFeatures {
  startGame(): void;
  saveGame(): void;
  loadGame(): void;
  enableAI(): void;
  shareToSocialMedia(): void;
}

// ✅ 正确示例：接口隔离
interface GameCore {
  startGame(): void;
  endGame(): void;
}

interface GamePersistence {
  saveGame(): void;
  loadGame(): void;
}

interface AISupport {
  enableAI(): void;
  setAIDifficulty(level: number): void;
}

// 简单游戏只需要实现核心功能
class SimpleGame implements GameCore {
  startGame() { /* ... */ }
  endGame() { /* ... */ }
}

// 复杂游戏可以实现更多接口
class AdvancedGame implements GameCore, AISupport {
  startGame() { /* ... */ }
  endGame() { /* ... */ }
  enableAI() { /* ... */ }
  setAIDifficulty(level: number) { /* ... */ }
}
```

**实践要点**：
- 接口应该小而专注
- 不要创建"万能"接口
- 根据客户端需求定义接口

---

#### D - Dependency Inversion Principle (依赖倒置原则)
**定义**：高层模块不应该依赖低层模块，两者都应该依赖抽象。

**在本项目中的应用**：
```typescript
// ❌ 错误示例：直接依赖具体实现
class GameController {
  private tcpConnection = new TCPConnection();

  connect(ip: string) {
    this.tcpConnection.connect(ip, 7777);
  }
}

// ✅ 正确示例：依赖抽象
interface IConnection {
  connect(ip: string, port: number): Promise<boolean>;
}

class GameController {
  constructor(private connection: IConnection) {}

  connect(ip: string) {
    this.connection.connect(ip, 7777);
  }
}

// 使用时注入依赖
const connection = new TCPConnection();
const controller = new GameController(connection);
```

**实践要点**：
- 使用依赖注入
- 面向接口编程，而非面向实现
- 通过构造函数或工厂模式注入依赖

---

### 2. DRY 原则 (Don't Repeat Yourself)

**定义**：避免代码重复，每一个知识点在系统中都应该有唯一、明确的表示。

**在本项目中的应用**：

```typescript
// ❌ 错误示例：重复的验证逻辑
class UNOGame {
  playCard(card: Card) {
    if (!card) throw new Error('Card is required');
    if (!card.color) throw new Error('Card color is required');
    if (!card.value) throw new Error('Card value is required');
    // 游戏逻辑...
  }
}

class WerewolfGame {
  vote(player: Player) {
    if (!player) throw new Error('Player is required');
    if (!player.id) throw new Error('Player id is required');
    if (!player.name) throw new Error('Player name is required');
    // 游戏逻辑...
  }
}

// ✅ 正确示例：提取公共验证逻辑
class Validator {
  static validateRequired(obj: any, fields: string[], entityName: string) {
    if (!obj) throw new Error(`${entityName} is required`);

    for (const field of fields) {
      if (!obj[field]) {
        throw new Error(`${entityName}.${field} is required`);
      }
    }
  }
}

class UNOGame {
  playCard(card: Card) {
    Validator.validateRequired(card, ['color', 'value'], 'Card');
    // 游戏逻辑...
  }
}

class WerewolfGame {
  vote(player: Player) {
    Validator.validateRequired(player, ['id', 'name'], 'Player');
    // 游戏逻辑...
  }
}
```

**实践要点**：
- 提取公共逻辑到工具类或基类
- 使用配置文件管理重复的数据
- 创建可复用的组件和函数
- 避免复制粘贴代码

**具体实践**：
```typescript
// 公共规则引擎
class RuleEngine {
  static validateMove(rules: Rule[], move: Move, state: GameState): boolean {
    return rules.every(rule => rule.check(move, state));
  }
}

// 公共UI组件
class PlayerListComponent {
  render(players: Player[]) {
    // 可在所有游戏中复用的玩家列表UI
  }
}

// 公共配置管理
class ConfigManager {
  static loadGameConfig(gameName: string): GameConfig {
    // 统一的配置加载逻辑
  }
}
```

---

### 3. KISS 原则 (Keep It Simple, Stupid)

**定义**：保持代码简单明了，避免不必要的复杂性。

**在本项目中的应用**：

```typescript
// ❌ 错误示例：过度设计
class CardFactory {
  private static instance: CardFactory;
  private cardRegistry: Map<string, CardBuilder>;
  private cardCache: WeakMap<CardConfig, Card>;

  private constructor() {
    this.cardRegistry = new Map();
    this.cardCache = new WeakMap();
  }

  static getInstance(): CardFactory {
    if (!CardFactory.instance) {
      CardFactory.instance = new CardFactory();
    }
    return CardFactory.instance;
  }

  registerBuilder(type: string, builder: CardBuilder) {
    this.cardRegistry.set(type, builder);
  }

  createCard(config: CardConfig): Card {
    // 复杂的缓存和构建逻辑...
  }
}

// ✅ 正确示例：简单直接
class Card {
  constructor(
    public color: string,
    public value: number
  ) {}
}

function createCard(color: string, value: number): Card {
  return new Card(color, value);
}

// 或者简单的工厂函数
const CardFactory = {
  createNumberCard: (color: string, value: number) => new Card(color, value),
  createActionCard: (color: string, action: string) => new Card(color, -1)
};
```

**实践要点**：

1. **优先使用简单的解决方案**
   ```typescript
   // ❌ 复杂
   const result = array.reduce((acc, item) => {
     return acc.concat(item.value > 10 ? [item] : []);
   }, []);

   // ✅ 简单
   const result = array.filter(item => item.value > 10);
   ```

2. **避免过早优化**
   ```typescript
   // ❌ 过早优化：为可能永远不会有的百万级数据做准备
   class OptimizedGameState {
     private stateCache: LRUCache<string, any>;
     private stateIndex: BTree<string, StateNode>;
     // ...复杂的优化代码
   }

   // ✅ 先实现功能，必要时再优化
   class GameState {
     players: Player[];
     currentPlayer: number;
     deck: Card[];
   }
   ```

3. **清晰的命名优于注释**
   ```typescript
   // ❌ 需要注释才能理解
   function calc(p: number, d: number): number {
     // 计算带折扣的价格
     return p - (p * d / 100);
   }

   // ✅ 名称自解释
   function calculateDiscountedPrice(
     originalPrice: number,
     discountPercentage: number
   ): number {
     return originalPrice - (originalPrice * discountPercentage / 100);
   }
   ```

4. **函数应该短小精悍**
   ```typescript
   // ✅ 一个函数只做一件事
   function dealCards(deck: Card[], players: Player[], cardsPerPlayer: number) {
     for (const player of players) {
       player.hand = deck.splice(0, cardsPerPlayer);
     }
   }

   function shuffleDeck(deck: Card[]) {
     for (let i = deck.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [deck[i], deck[j]] = [deck[j], deck[i]];
     }
   }
   ```

---

## 项目特定实践指南

### 游戏模块开发
```typescript
// 每个游戏应该遵循统一的接口
interface BoardGame {
  name: string;
  minPlayers: number;
  maxPlayers: number;

  initialize(config: GameConfig): GameState;
  processMove(move: Move, state: GameState): GameState;
  checkGameEnd(state: GameState): boolean;
}

// 游戏配置应该外部化
// games/uno/config.json
{
  "name": "UNO",
  "minPlayers": 2,
  "maxPlayers": 10,
  "cardsPerPlayer": 7,
  "rules": {
    "stackDrawTwo": true,
    "jumpIn": false
  }
}
```

### 网络通信
```typescript
// 简单的消息协议
interface NetworkMessage {
  type: 'MOVE' | 'STATE_UPDATE' | 'PLAYER_JOIN' | 'PLAYER_LEAVE';
  data: any;
  timestamp: number;
}

// 主机权威：所有逻辑在主机执行
class HostManager {
  processClientMove(clientId: string, move: Move) {
    // 验证移动
    if (!this.validateMove(move)) {
      this.sendError(clientId, 'Invalid move');
      return;
    }

    // 执行移动
    this.gameState = this.game.processMove(move, this.gameState);

    // 广播新状态
    this.broadcastState();
  }
}
```

### 配置管理
```typescript
// 简单的配置加载
interface ClientConfig {
  graphics: {
    resolution: string;
    fullscreen: boolean;
  };
  audio: {
    master: number;
    sfx: number;
    music: number;
  };
  game: {
    language: string;
    defaultNickname: string;
  };
}

class ConfigManager {
  private static CONFIG_PATH = 'config.json';

  static load(): ClientConfig {
    // 简单的文件读取
    const data = fs.readFileSync(this.CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  }

  static save(config: ClientConfig): void {
    fs.writeFileSync(this.CONFIG_PATH, JSON.stringify(config, null, 2));
  }
}
```

---

## 代码审查检查清单

在提交代码前，请确保：

### SOLID 检查
- [ ] 每个类/模块是否只有一个职责？
- [ ] 新功能是通过扩展实现，还是修改了现有代码？
- [ ] 子类是否能完全替换父类？
- [ ] 接口是否足够小且专注？
- [ ] 是否依赖抽象而非具体实现？

### DRY 检查
- [ ] 是否有重复的代码逻辑？
- [ ] 是否可以提取公共函数/组件？
- [ ] 相似的代码是否可以合并？

### KISS 检查
- [ ] 代码是否容易理解？
- [ ] 是否有不必要的复杂性？
- [ ] 函数是否足够简短（建议 < 50 行）？
- [ ] 是否过度设计？
- [ ] 变量和函数命名是否清晰？

---

## 反模式警告

### ❌ 避免的模式

1. **God Object（上帝对象）**
   - 一个类做了太多事情
   - 解决：拆分职责

2. **Copy-Paste Programming（复制粘贴编程）**
   - 复制代码而不是复用
   - 解决：提取公共逻辑

3. **Premature Optimization（过早优化）**
   - 在没有性能问题时就优化
   - 解决：先让代码工作，再优化

4. **Magic Numbers（魔法数字）**
   - 硬编码的数字和字符串
   - 解决：使用常量

5. **Shotgun Surgery（霰弹式修改）**
   - 一个改动需要修改多处
   - 解决：改善代码结构

---

## 总结

遵循这些原则的好处：
- ✅ **可维护性**：代码易于理解和修改
- ✅ **可扩展性**：容易添加新功能
- ✅ **可测试性**：便于编写单元测试
- ✅ **团队协作**：降低沟通成本
- ✅ **Bug减少**：清晰的结构减少错误

记住：**原则是指导而非教条**。在实际开发中，根据具体情况灵活应用，寻求简单性和可维护性的平衡。
