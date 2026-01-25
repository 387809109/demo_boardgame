# [游戏名称] 游戏规则 - AI Coding 参考文档

> 本文档面向 AI 编程助手，提供结构化的游戏规则和数据定义。
>
> **使用说明**: 复制此模板到 `docs/games/[game-name]/RULES.md`，然后填充具体内容。

## 1. 游戏概述

| 属性 | 值 |
|------|-----|
| 游戏ID | `game-id` |
| 玩家数量 | X-Y 人 |
| 游戏类型 | 卡牌/棋盘/派对/策略 |
| 胜利条件 | [描述胜利条件] |

---

## 2. 游戏元素定义

### 2.1 基础元素结构

```javascript
/**
 * @typedef {Object} GameElement
 * @property {string} id - 唯一标识符
 * @property {string} type - 元素类型
 * @property {*} value - 元素值
 * // 添加其他必要字段...
 */
```

### 2.2 元素类型枚举

```javascript
const ELEMENT_TYPES = {
  TYPE_A: 'type_a',
  TYPE_B: 'type_b',
  // ...
};
```

### 2.3 元素列表

| 类型 | 数量 | 说明 |
|------|------|------|
| TYPE_A | X | 描述 |
| TYPE_B | Y | 描述 |

---

## 3. 游戏规则

### 3.1 初始化规则

```
1. [初始化步骤 1]
2. [初始化步骤 2]
3. ...
```

### 3.2 回合流程

```
1. [回合开始]
2. [玩家操作]
3. [效果结算]
4. [回合结束]
```

### 3.3 核心规则算法

```javascript
/**
 * 判断操作是否合法
 * @param {Object} action - 玩家操作
 * @param {Object} state - 当前状态
 * @returns {boolean}
 */
function isValidAction(action, state) {
  // 实现验证逻辑
}
```

---

## 4. 操作类型定义

### 4.1 操作类型枚举

```javascript
const ACTION_TYPES = {
  ACTION_A: 'ACTION_A',
  ACTION_B: 'ACTION_B',
  // ...
};
```

### 4.2 操作数据结构

```javascript
// ACTION_A
{ field1: value1, field2: value2 }

// ACTION_B
{ field1: value1 }
```

### 4.3 操作效果

| 操作 | 效果 | 条件 |
|------|------|------|
| ACTION_A | [效果描述] | [触发条件] |
| ACTION_B | [效果描述] | [触发条件] |

---

## 5. 游戏状态结构

```javascript
/**
 * @typedef {Object} GameState
 * @property {Array<Player>} players - 玩家列表
 * @property {string} currentPlayer - 当前玩家 ID
 * @property {number} turnNumber - 回合数
 * @property {string} status - 游戏状态 ('waiting'|'playing'|'ended')
 * // 添加游戏特定字段...
 */
```

---

## 6. 计分规则

### 6.1 分值定义

| 元素/行为 | 分值 |
|----------|------|
| [元素A] | X 分 |
| [行为B] | Y 分 |

### 6.2 计分算法

```javascript
function calculateScore(player, state) {
  // 实现计分逻辑
}
```

---

## 7. 特殊规则

### 7.1 [特殊规则名称]

[详细描述]

### 7.2 [特殊规则名称]

[详细描述]

---

## 8. 游戏结束条件

```javascript
function checkGameEnd(state) {
  // 条件 1: ...
  // 条件 2: ...
  return { ended: boolean, winner: playerId, reason: string };
}
```

---

## 9. 错误代码

| 代码 | 说明 |
|------|------|
| `ERROR_CODE_1` | 错误描述 |
| `ERROR_CODE_2` | 错误描述 |

---

## 10. 配置选项

```json
{
  "option1": "defaultValue",
  "option2": true
}
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `option1` | "defaultValue" | 选项描述 |
| `option2` | true | 选项描述 |

---

## 11. 参考资料

- [官方规则链接]
- [其他参考]
