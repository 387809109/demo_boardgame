# 狼人杀 游戏规则 - AI Coding 参考文档

> 本文档面向 AI 编程助手，提供结构化的游戏规则和数据定义。
>
> **状态**: 模板待填充 - 需要补充具体规则细节

## 1. 游戏概述

| 属性 | 值 |
|------|-----|
| 游戏ID | `werewolf` |
| 玩家数量 | 6-12 人 |
| 游戏类型 | 社交推理/派对 |
| 胜利条件 | 狼人阵营：消灭所有好人 / 好人阵营：消灭所有狼人 |

---

## 2. 角色定义

### 2.1 角色结构

```javascript
/**
 * @typedef {Object} Role
 * @property {string} id - 角色标识符
 * @property {string} name - 角色名称
 * @property {string} team - 阵营 ('werewolf'|'villager'|'neutral')
 * @property {boolean} hasNightAction - 是否有夜间行动
 * @property {number} priority - 夜间行动优先级 (越小越先)
 * @property {string} description - 角色描述
 */
```

### 2.2 阵营枚举

```javascript
const TEAMS = {
  WEREWOLF: 'werewolf',   // 狼人阵营
  VILLAGER: 'villager',   // 好人阵营
  NEUTRAL: 'neutral'      // 中立阵营 (可选)
};
```

### 2.3 角色类型枚举

```javascript
const ROLE_TYPES = {
  // 狼人阵营
  WEREWOLF: 'werewolf',           // 狼人
  // TODO: 添加其他狼人角色

  // 好人阵营
  VILLAGER: 'villager',           // 普通村民
  SEER: 'seer',                   // 预言家
  WITCH: 'witch',                 // 女巫
  HUNTER: 'hunter',               // 猎人
  GUARD: 'guard',                 // 守卫
  // TODO: 添加其他好人角色

  // 中立阵营 (可选)
  // TODO: 定义中立角色
};
```

### 2.4 角色配置表

> TODO: 填充各角色的详细配置

| 角色 | 阵营 | 夜间行动 | 优先级 | 数量(基础) | 说明 |
|------|------|---------|--------|-----------|------|
| 狼人 | 狼人 | 是 | 3 | 2-3 | TODO: 描述 |
| 村民 | 好人 | 否 | - | 2-4 | TODO: 描述 |
| 预言家 | 好人 | 是 | 1 | 0-1 | TODO: 描述 |
| 女巫 | 好人 | 是 | 4 | 0-1 | TODO: 描述 |
| 猎人 | 好人 | 否 | - | 0-1 | TODO: 描述 |
| 守卫 | 好人 | 是 | 2 | 0-1 | TODO: 描述 |

---

## 3. 游戏阶段

### 3.1 阶段枚举

```javascript
const PHASES = {
  WAITING: 'waiting',       // 等待开始
  NIGHT: 'night',           // 夜晚阶段
  DAY_DISCUSSION: 'day_discussion',   // 白天讨论
  DAY_VOTE: 'day_vote',     // 白天投票
  LAST_WORDS: 'last_words', // 遗言阶段
  ENDED: 'ended'            // 游戏结束
};
```

### 3.2 夜间子阶段

```javascript
const NIGHT_SUBPHASES = {
  GUARD_PROTECT: 'guard_protect',   // 守卫守护
  SEER_CHECK: 'seer_check',         // 预言家查验
  WEREWOLF_KILL: 'werewolf_kill',   // 狼人杀人
  WITCH_ACTION: 'witch_action',     // 女巫用药
  // TODO: 添加其他夜间子阶段
};
```

---

## 4. 游戏流程

### 4.1 初始化流程

```
1. 根据玩家数量确定角色配置
2. 随机分配角色给每位玩家
3. 进入第一个夜晚
```

### 4.2 夜晚流程

```
1. 所有玩家闭眼
2. 按优先级依次执行夜间行动:
   a. 守卫选择守护目标 (不能连续守护同一人)
   b. 预言家选择查验目标
   c. 狼人睁眼并选择击杀目标
   d. 女巫查看被杀玩家，决定是否用药
3. 天亮，公布夜晚结果
```

### 4.3 白天流程

```
1. 公布昨晚死亡情况
2. 死亡玩家发表遗言 (可选)
3. 存活玩家自由讨论
4. 投票放逐玩家
5. 被放逐玩家发表遗言
6. 检查胜利条件
7. 如未结束，进入下一个夜晚
```

---

## 5. 操作类型定义

### 5.1 操作类型枚举

```javascript
const ACTION_TYPES = {
  // 夜间操作
  WEREWOLF_KILL: 'WEREWOLF_KILL',     // 狼人击杀
  SEER_CHECK: 'SEER_CHECK',           // 预言家查验
  WITCH_SAVE: 'WITCH_SAVE',           // 女巫救人
  WITCH_POISON: 'WITCH_POISON',       // 女巫毒人
  GUARD_PROTECT: 'GUARD_PROTECT',     // 守卫守护

  // 白天操作
  DISCUSS: 'DISCUSS',                 // 发言
  VOTE: 'VOTE',                       // 投票
  SKIP_VOTE: 'SKIP_VOTE',             // 弃票

  // 特殊操作
  HUNTER_SHOOT: 'HUNTER_SHOOT',       // 猎人开枪
  LAST_WORDS: 'LAST_WORDS',           // 遗言
};
```

### 5.2 操作数据结构

```javascript
// WEREWOLF_KILL - 狼人击杀
{ targetId: string }

// SEER_CHECK - 预言家查验
{ targetId: string }

// WITCH_SAVE - 女巫救人
{ }  // 救当晚被杀的人

// WITCH_POISON - 女巫毒人
{ targetId: string }

// GUARD_PROTECT - 守卫守护
{ targetId: string }

// VOTE - 投票
{ targetId: string }

// HUNTER_SHOOT - 猎人开枪
{ targetId: string }

// LAST_WORDS - 遗言
{ message: string }
```

---

## 6. 游戏状态结构

```javascript
/**
 * @typedef {Object} WerewolfGameState
 * @property {Array<Player>} players - 玩家列表
 * @property {Object<string, Role>} roles - 玩家角色映射 (playerId -> role)
 * @property {string} currentPhase - 当前阶段
 * @property {string|null} currentSubPhase - 当前子阶段 (夜晚时)
 * @property {number} dayNumber - 第几天
 * @property {Array<string>} alivePlayers - 存活玩家 ID 列表
 * @property {Array<string>} deadPlayers - 死亡玩家 ID 列表
 * @property {Object} nightActions - 当晚行动记录
 * @property {Object} voteRecord - 投票记录
 * @property {Object} witchPotions - 女巫药水状态
 * @property {string|null} lastGuardTarget - 守卫上一晚守护的目标
 * @property {Array<Object>} deathAnnouncements - 待公布的死亡信息
 * @property {string} status - 游戏状态 ('waiting'|'playing'|'ended')
 * @property {string|null} winner - 获胜阵营
 */
```

---

## 7. 特殊规则

### 7.1 同守同救规则

> TODO: 定义守卫和女巫同时保护同一目标时的处理

### 7.2 狼人自刀规则

> TODO: 定义狼人是否可以选择不杀人或自刀

### 7.3 平票处理规则

> TODO: 定义投票平票时的处理方式

### 7.4 猎人开枪规则

> TODO: 定义猎人被毒死是否能开枪

---

## 8. 游戏结束条件

```javascript
function checkGameEnd(state) {
  const aliveWerewolves = countAliveByTeam(state, 'werewolf');
  const aliveVillagers = countAliveByTeam(state, 'villager');

  // 狼人全部死亡 -> 好人胜利
  if (aliveWerewolves === 0) {
    return { ended: true, winner: 'villager', reason: '所有狼人已被消灭' };
  }

  // 狼人数量 >= 好人数量 -> 狼人胜利
  if (aliveWerewolves >= aliveVillagers) {
    return { ended: true, winner: 'werewolf', reason: '狼人数量达到或超过好人' };
  }

  // TODO: 添加其他结束条件 (如屠边)

  return { ended: false };
}
```

---

## 9. 错误代码

| 代码 | 说明 |
|------|------|
| `GAME_NOT_STARTED` | 游戏未开始 |
| `NOT_YOUR_TURN` | 不是你的行动阶段 |
| `INVALID_TARGET` | 无效的目标 |
| `TARGET_ALREADY_DEAD` | 目标已死亡 |
| `ACTION_ALREADY_USED` | 该行动已使用 (如女巫药水) |
| `CANNOT_SELF_TARGET` | 不能以自己为目标 |
| `GUARD_SAME_TARGET` | 守卫不能连续守护同一人 |
| `NOT_YOUR_ROLE` | 你没有该角色的能力 |

---

## 10. 配置选项

```json
{
  "settingsSchema": {
    "roleConfig": {
      "type": "object",
      "label": "角色配置",
      "description": "自定义游戏中的角色数量"
    },
    "firstNightKill": {
      "type": "boolean",
      "label": "首夜有刀",
      "description": "第一个夜晚狼人是否可以杀人",
      "default": true
    },
    "witchSelfSave": {
      "type": "boolean",
      "label": "女巫自救",
      "description": "女巫是否可以在被杀时救自己",
      "default": true
    },
    "hunterPoisonShoot": {
      "type": "boolean",
      "label": "猎人被毒可开枪",
      "description": "猎人被女巫毒死时是否能开枪",
      "default": false
    },
    "discussionTime": {
      "type": "number",
      "label": "讨论时间(秒)",
      "description": "白天讨论阶段的时间限制",
      "default": 300,
      "min": 60,
      "max": 600
    },
    "voteTime": {
      "type": "number",
      "label": "投票时间(秒)",
      "description": "投票阶段的时间限制",
      "default": 30,
      "min": 10,
      "max": 60
    }
  }
}
```

---

## 11. 玩家数量与角色配置推荐

> TODO: 根据玩家数量定义推荐的角色配置

| 玩家数 | 狼人 | 预言家 | 女巫 | 猎人 | 守卫 | 村民 |
|--------|------|--------|------|------|------|------|
| 6 | 2 | 1 | 0 | 0 | 0 | 3 |
| 8 | 2 | 1 | 1 | 0 | 0 | 4 |
| 9 | 3 | 1 | 1 | 1 | 0 | 3 |
| 12 | 4 | 1 | 1 | 1 | 1 | 4 |

---

## 12. 参考资料

- TODO: 添加官方或权威规则参考链接
- TODO: 添加变体规则参考

---

## 开发备注

> 以下内容需要在开发前确认:

- [ ] 确认支持的角色列表
- [ ] 确认夜间行动优先级顺序
- [ ] 确认特殊规则的处理方式
- [ ] 确认是否支持中立阵营
- [ ] 确认 AI 玩家行为逻辑 (可选功能)
