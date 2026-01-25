# UNO 游戏规则 - AI Coding 参考文档

> 本文档面向 AI 编程助手，提供结构化的游戏规则和数据定义。

## 1. 游戏概述

| 属性 | 值 |
|------|-----|
| 游戏ID | `uno` |
| 玩家数量 | 2-10 人 |
| 初始手牌 | 7 张 |
| 胜利条件 | 首个打出所有手牌的玩家获胜 |

---

## 2. 卡牌定义

### 2.1 卡牌结构

```javascript
/**
 * @typedef {Object} Card
 * @property {string} id - 唯一标识符 (格式: "{color}-{type}-{index}")
 * @property {string|null} color - 卡牌颜色 (red|blue|green|yellow|null)
 * @property {string} type - 卡牌类型
 * @property {number|null} value - 数字值 (0-9 或 null)
 */
```

### 2.2 颜色枚举

```javascript
const COLORS = {
  RED: 'red',
  BLUE: 'blue',
  GREEN: 'green',
  YELLOW: 'yellow'
};
```

### 2.3 卡牌类型枚举

```javascript
const CARD_TYPES = {
  NUMBER: 'number',      // 数字牌 (0-9)
  SKIP: 'skip',          // 跳过
  REVERSE: 'reverse',    // 反转
  DRAW_TWO: 'draw_two',  // +2
  WILD: 'wild',          // 万能牌
  WILD_DRAW_FOUR: 'wild_draw_four'  // +4 万能牌
};
```

---

## 3. 牌组构成

### 3.1 标准牌组 (108张)

| 类型 | 每种颜色数量 | 颜色 | 总计 |
|------|-------------|------|------|
| 数字 0 | 1 | 红蓝绿黄 | 4 |
| 数字 1-9 | 各 2 | 红蓝绿黄 | 72 |
| 跳过 (Skip) | 2 | 红蓝绿黄 | 8 |
| 反转 (Reverse) | 2 | 红蓝绿黄 | 8 |
| +2 (Draw Two) | 2 | 红蓝绿黄 | 8 |
| 万能 (Wild) | - | 无色 | 4 |
| +4 万能 (Wild Draw Four) | - | 无色 | 4 |

### 3.2 生成牌组算法

```javascript
function generateDeck() {
  const deck = [];
  let cardIndex = 0;

  // 每种颜色的牌
  for (const color of ['red', 'blue', 'green', 'yellow']) {
    // 数字 0: 每色 1 张
    deck.push({
      id: `${color}-0-${cardIndex++}`,
      color,
      type: 'number',
      value: 0
    });

    // 数字 1-9: 每色各 2 张
    for (let num = 1; num <= 9; num++) {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `${color}-${num}-${cardIndex++}`,
          color,
          type: 'number',
          value: num
        });
      }
    }

    // 功能牌: 每色各 2 张
    for (const type of ['skip', 'reverse', 'draw_two']) {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `${color}-${type}-${cardIndex++}`,
          color,
          type,
          value: null
        });
      }
    }
  }

  // 万能牌: 4 张
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild-${cardIndex++}`,
      color: null,
      type: 'wild',
      value: null
    });
  }

  // +4 万能牌: 4 张
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `wild-draw-four-${cardIndex++}`,
      color: null,
      type: 'wild_draw_four',
      value: null
    });
  }

  return deck;
}
```

---

## 4. 出牌规则

### 4.1 可出牌判定

```javascript
/**
 * 判断卡牌是否可以打出
 * @param {Card} card - 要打出的牌
 * @param {Card} topCard - 弃牌堆顶牌
 * @param {string} currentColor - 当前有效颜色
 * @returns {boolean}
 */
function canPlayCard(card, topCard, currentColor) {
  // 万能牌永远可出
  if (card.type === 'wild' || card.type === 'wild_draw_four') {
    return true;
  }

  // 颜色匹配
  if (card.color === currentColor) {
    return true;
  }

  // 数字匹配
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
    return true;
  }

  // 类型匹配 (功能牌)
  if (card.type !== 'number' && card.type === topCard.type) {
    return true;
  }

  return false;
}
```

### 4.2 出牌优先级 (AI决策参考)

1. 优先出与当前颜色匹配的牌
2. 优先出功能牌 (跳过、反转、+2)
3. 保留万能牌和 +4 到关键时刻
4. 当手牌剩余 2 张时，考虑喊 UNO

---

## 5. 功能牌效果

### 5.1 效果定义表

| 卡牌类型 | 效果 | 特殊说明 |
|---------|------|---------|
| Skip | 跳过下一位玩家 | - |
| Reverse | 反转出牌顺序 | 2人游戏时等同于Skip |
| Draw Two | 下一位玩家摸2张并跳过 | 摸牌前不能出牌 |
| Wild | 选择当前颜色 | - |
| Wild Draw Four | 选择颜色+下一位摸4张 | 摸牌前不能出牌 |

### 5.2 效果处理逻辑

```javascript
/**
 * 应用卡牌效果
 * @param {Card} card - 打出的牌
 * @param {GameState} state - 当前状态
 * @param {string} chosenColor - 选择的颜色 (万能牌)
 * @returns {Object} 效果结果
 */
function applyCardEffect(card, state, chosenColor = null) {
  const result = {
    currentColor: card.color || chosenColor,
    skipNext: false,
    reverseDirection: false,
    drawPending: 0
  };

  switch (card.type) {
    case 'skip':
      result.skipNext = true;
      break;

    case 'reverse':
      result.reverseDirection = true;
      break;

    case 'draw_two':
      result.drawPending = 2;
      result.skipNext = true;
      break;

    case 'wild':
      result.currentColor = chosenColor;
      break;

    case 'wild_draw_four':
      result.currentColor = chosenColor;
      result.drawPending = 4;
      result.skipNext = true;
      break;
  }

  return result;
}
```

---

## 6. UNO 喊叫规则

### 6.1 规则说明

- 当玩家手牌剩余 **1-2 张** 时，可以喊 "UNO"
- 如果玩家打出倒数第二张牌后未喊 UNO，其他玩家可以质疑
- 被成功质疑的玩家需要摸 **2 张** 罚牌

### 6.2 状态追踪

```javascript
// 游戏状态中的 UNO 相关字段
{
  unoCalledBy: null,  // 已喊 UNO 的玩家 ID
}

// 操作类型
const UNO_ACTIONS = {
  CALL_UNO: 'CALL_UNO',
  CHALLENGE_UNO: 'CHALLENGE_UNO'
};
```

---

## 7. 游戏流程

### 7.1 初始化流程

```
1. 生成并洗牌
2. 每位玩家发 7 张牌
3. 翻开第一张非万能牌作为起始牌
4. 如果起始牌是功能牌，应用其效果
5. 确定第一位玩家
```

### 7.2 回合流程

```
1. 检查是否有待摸牌 (drawPending > 0)
   └─ 是: 必须先摸牌
   └─ 否: 继续

2. 玩家选择操作:
   a. 打出一张合法的牌
   b. 摸一张牌
      └─ 摸到的牌可出: 可选择打出或跳过
      └─ 摸到的牌不可出: 自动跳过

3. 如果打出牌:
   a. 从手牌移除该牌
   b. 放入弃牌堆
   c. 应用卡牌效果
   d. 重置 UNO 状态

4. 转移到下一位玩家
```

### 7.3 结束条件

```javascript
function checkGameEnd(state) {
  for (const player of state.players) {
    if (state.hands[player.id].length === 0) {
      return {
        ended: true,
        winner: player.id
      };
    }
  }
  return { ended: false };
}
```

---

## 8. 计分规则

### 8.1 卡牌分值

| 卡牌类型 | 分值 |
|---------|------|
| 数字牌 (0-9) | 面值 |
| Skip | 20 |
| Reverse | 20 |
| Draw Two | 20 |
| Wild | 50 |
| Wild Draw Four | 50 |

### 8.2 计分算法

```javascript
function calculateHandScore(hand) {
  return hand.reduce((total, card) => {
    if (card.type === 'number') {
      return total + card.value;
    }
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
      return total + 50;
    }
    return total + 20; // skip, reverse, draw_two
  }, 0);
}
```

---

## 9. 游戏状态结构

```javascript
/**
 * @typedef {Object} UnoGameState
 * @property {Array<Player>} players - 玩家列表
 * @property {string} currentPlayer - 当前玩家 ID
 * @property {number} currentPlayerIndex - 当前玩家索引
 * @property {number} turnNumber - 回合数
 * @property {string} status - 游戏状态 ('waiting'|'playing'|'ended')
 * @property {number} direction - 出牌方向 (1=顺时针, -1=逆时针)
 * @property {string} currentColor - 当前有效颜色
 * @property {Object<string, Card[]>} hands - 各玩家手牌
 * @property {Card[]} deck - 摸牌堆
 * @property {Card[]} discardPile - 弃牌堆
 * @property {number} drawPending - 待摸牌数
 * @property {Object|null} lastAction - 上一个操作
 * @property {string|null} unoCalledBy - 喊了 UNO 的玩家
 * @property {string|null} winner - 获胜者
 */
```

---

## 10. 操作类型定义

```javascript
const UNO_ACTIONS = {
  PLAY_CARD: 'PLAY_CARD',       // 出牌
  DRAW_CARD: 'DRAW_CARD',       // 摸牌
  SKIP_TURN: 'SKIP_TURN',       // 跳过回合
  CALL_UNO: 'CALL_UNO',         // 喊 UNO
  CHALLENGE_UNO: 'CHALLENGE_UNO' // 质疑 UNO
};

// 操作数据结构
// PLAY_CARD
{ cardId: string, chosenColor?: string }

// DRAW_CARD
{ }

// SKIP_TURN
{ }

// CALL_UNO
{ }

// CHALLENGE_UNO
{ targetPlayerId: string }
```

---

## 11. 错误代码

| 代码 | 说明 |
|------|------|
| `GAME_NOT_STARTED` | 游戏未开始 |
| `NOT_YOUR_TURN` | 不是你的回合 |
| `CARD_NOT_IN_HAND` | 你没有这张牌 |
| `MUST_DRAW_FIRST` | 必须先摸牌 |
| `INVALID_CARD` | 这张牌无法出 |
| `CHOOSE_COLOR_REQUIRED` | 请选择颜色 |
| `CANNOT_SKIP` | 只能在摸牌后跳过 |
| `INVALID_UNO_CALL` | 只有剩余1-2张牌时才能喊UNO |
| `INVALID_CHALLENGE` | 该玩家不能被质疑 |

---

## 12. 配置选项

```json
{
  "initialCards": 7,
  "drawPenalty": 2,
  "stackDrawCards": false,
  "forcePlay": false,
  "sevenSwap": false,
  "zeroRotate": false
}
```

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `initialCards` | 7 | 初始手牌数 |
| `drawPenalty` | 2 | 未喊 UNO 的罚牌数 |
| `stackDrawCards` | false | 是否允许叠加 +2/+4 |
| `forcePlay` | false | 摸到可出的牌是否必须出 |
| `sevenSwap` | false | 出 7 是否与他人换手牌 |
| `zeroRotate` | false | 出 0 是否轮转所有手牌 |
