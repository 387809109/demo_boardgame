# 项目开发规范 - Development Rules

本目录包含桌游集成客户端项目的所有开发规范和最佳实践。

## 📚 文档列表

### 1. [DEVELOPMENT_PRINCIPLES.md](./DEVELOPMENT_PRINCIPLES.md)
**核心开发原则**

详细说明项目遵循的三大核心原则：
- **SOLID 原则**：面向对象设计的五大原则
  - 单一职责原则 (SRP)
  - 开闭原则 (OCP)
  - 里氏替换原则 (LSP)
  - 接口隔离原则 (ISP)
  - 依赖倒置原则 (DIP)
- **DRY 原则**：避免代码重复
- **KISS 原则**：保持简单

包含大量实际代码示例和项目特定的实践指南。

### 2. [CODE_STYLE_GUIDE.md](./CODE_STYLE_GUIDE.md)
**代码风格指南**

规范代码的编写格式和风格：
- 命名规范（类、函数、变量等）
- 文件组织结构
- 代码格式（缩进、空格、换行等）
- 注释规范
- 错误处理模式
- TypeScript 特定规范

---

## 🎯 为什么需要这些规范？

### 1. 代码一致性
统一的编码风格让团队成员能够：
- 快速理解他人编写的代码
- 减少代码审查时的摩擦
- 降低维护成本

### 2. 可维护性
遵循 SOLID 和 DRY 原则的代码：
- 易于理解和修改
- 减少 bug 的产生
- 便于重构和优化

### 3. 可扩展性
良好的架构设计使得：
- 添加新游戏更容易
- 功能扩展不影响现有代码
- 插件化开发成为可能

### 4. 团队协作
明确的规范有助于：
- 新成员快速上手
- 减少沟通成本
- 提高开发效率

---

## 🚀 快速开始

### 第一次阅读
如果你是第一次参与项目开发，建议按以下顺序阅读：

1. **先阅读本文档（README.md）** - 了解整体概况
2. **然后阅读 KISS 原则部分** - 理解"简单优先"的思想
3. **浏览代码风格指南** - 熟悉基本的命名和格式规范
4. **深入学习 SOLID 原则** - 理解面向对象设计的核心思想
5. **实践 DRY 原则** - 在编码过程中避免重复

### 日常开发
在日常开发中：

1. **编码前**：思考如何应用 SOLID 和 KISS 原则
2. **编码中**：遵循代码风格指南
3. **编码后**：使用检查清单进行自查
4. **提交前**：确保代码符合所有规范

---

## 📋 代码审查检查清单

在提交代码前，请确保通过以下检查：

### 架构和设计
- [ ] 代码遵循 SOLID 原则
- [ ] 没有重复的逻辑（DRY）
- [ ] 保持简单，避免过度设计（KISS）
- [ ] 新功能通过扩展实现，而非修改现有代码

### 代码风格
- [ ] 命名规范正确（类、函数、变量）
- [ ] 代码格式符合规范（缩进、空格、换行）
- [ ] 公共 API 有完整的注释
- [ ] 文件组织结构合理

### TypeScript
- [ ] 使用严格模式
- [ ] 公共 API 有明确的类型注解
- [ ] 避免使用 `any` 类型
- [ ] 正确处理 `null` 和 `undefined`

### 错误处理
- [ ] 不吞掉错误
- [ ] 使用自定义错误类型
- [ ] 错误信息清晰有用
- [ ] 异步操作正确处理错误

### 测试
- [ ] 编写了必要的单元测试
- [ ] 测试覆盖关键逻辑
- [ ] 所有测试通过

---

## 🛠️ 开发工具配置

### 推荐的编辑器配置

#### VSCode
安装以下扩展：
- ESLint
- Prettier
- TypeScript Hero
- Error Lens

配置文件 `.vscode/settings.json`：
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 代码检查工具

#### ESLint
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

#### Prettier
```bash
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```

#### 运行检查
```bash
# 检查代码风格
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

---

## 📖 实践示例

### 示例 1：添加新游戏

遵循 SOLID 和 KISS 原则添加新游戏：

```typescript
// 1. 定义游戏接口（开闭原则）
interface BoardGame {
  initialize(config: GameConfig): GameState;
  processMove(move: Move, state: GameState): GameState;
  checkGameEnd(state: GameState): boolean;
}

// 2. 实现具体游戏（单一职责）
class PokerGame implements BoardGame {
  initialize(config: GameConfig): GameState {
    // 简单直接的初始化（KISS）
    return {
      deck: this.createDeck(),
      players: config.players,
      currentPlayer: 0
    };
  }

  processMove(move: Move, state: GameState): GameState {
    // 验证移动
    if (!this.isValidMove(move, state)) {
      throw new GameError('Invalid move');
    }

    // 执行移动
    return this.executeMove(move, state);
  }

  checkGameEnd(state: GameState): boolean {
    return state.winner !== null;
  }

  // 私有辅助方法（单一职责）
  private createDeck(): Card[] {
    // 创建扑克牌
  }

  private isValidMove(move: Move, state: GameState): boolean {
    // 验证逻辑
  }

  private executeMove(move: Move, state: GameState): GameState {
    // 执行逻辑
  }
}
```

### 示例 2：复用公共逻辑

遵循 DRY 原则避免重复：

```typescript
// 不要在每个游戏中重复验证逻辑
// ❌ 错误
class UNOGame {
  processMove(move: Move) {
    if (!move) throw new Error('Move required');
    if (!move.player) throw new Error('Player required');
    // ... 游戏逻辑
  }
}

class PokerGame {
  processMove(move: Move) {
    if (!move) throw new Error('Move required');
    if (!move.player) throw new Error('Player required');
    // ... 游戏逻辑
  }
}

// ✅ 正确 - 提取公共验证
class MoveValidator {
  static validate(move: Move): void {
    if (!move) throw new ValidationError('Move required');
    if (!move.player) throw new ValidationError('Player required');
  }
}

class UNOGame {
  processMove(move: Move) {
    MoveValidator.validate(move);
    // ... 游戏逻辑
  }
}

class PokerGame {
  processMove(move: Move) {
    MoveValidator.validate(move);
    // ... 游戏逻辑
  }
}
```

---

## 🤝 贡献指南

### 提交代码流程

1. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **编写代码**
   - 遵循所有开发规范
   - 编写必要的测试
   - 添加适当的注释

3. **自查**
   - 使用检查清单自查
   - 运行所有测试
   - 运行代码检查工具

4. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit 消息规范

使用语义化的 commit 消息：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码风格调整（不影响功能）
refactor: 代码重构
test: 添加测试
chore: 构建配置或辅助工具变动
```

示例：
```
feat: add Poker game implementation
fix: resolve network timeout issue
docs: update API documentation
refactor: simplify card shuffling algorithm
```

---

## 📚 学习资源

### SOLID 原则
- [SOLID Principles Explained](https://www.digitalocean.com/community/conceptual_articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design)
- [Clean Code by Robert C. Martin](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)

### TypeScript
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### 设计模式
- [Design Patterns: Elements of Reusable Object-Oriented Software](https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612)
- [Refactoring Guru](https://refactoring.guru/design-patterns)

---

## ❓ FAQ

### Q: 规范是强制的吗？
A: 是的。这些规范是为了保证代码质量和团队协作效率。所有提交的代码都应该遵循这些规范。

### Q: 如果规范与实际情况冲突怎么办？
A: 规范是指导而非教条。如果遇到特殊情况，可以在代码审查时讨论。但需要在注释中说明为什么需要偏离规范。

### Q: 如何建议修改规范？
A: 欢迎提出改进建议！可以通过以下方式：
1. 在团队会议上讨论
2. 创建 Issue 说明问题和建议
3. 提交 PR 修改规范文档

### Q: 旧代码不符合规范怎么办？
A: 遵循"童子军规则"：让代码比你发现时更好一点。在修改旧代码时，顺便让它符合规范。但不要为了规范而大规模重构稳定的代码。

---

## 📝 总结

这些规范的目标是：
- ✅ 提高代码质量
- ✅ 增强可维护性
- ✅ 促进团队协作
- ✅ 加快开发速度

记住：**好的代码是写给人看的，顺便让机器执行。**

如有任何问题或建议，欢迎讨论！
