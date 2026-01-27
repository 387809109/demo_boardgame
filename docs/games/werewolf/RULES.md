# 狼人杀 游戏规则 - AI Coding 参考文档

> 本文档面向 AI 编程助手，提供结构化的游戏规则和数据定义。
>
> **使用说明**: 本规则基于经典 Werewolf/Mafia 玩法（夜晚行动 + 白天讨论投票）。

## 1. 游戏概述

| 属性 | 值 |
|------|-----|
| 游戏ID | `werewolf` |
| 玩家数量 | 6-20 人 (可配置) |
| 游戏类型 | 社交推理/派对 |
| 胜利条件 | 村民阵营消灭所有狼人；狼人阵营人数达到/超过村民则胜利 |

---

## 2. 游戏元素定义

### 2.1 基础元素结构

```javascript
/**
 * @typedef {Object} GameElement
 * @property {string} id - 唯一标识符
 * @property {string} type - 元素类型
 * @property {*} value - 元素值
 * @property {string=} roleId - 角色ID（若适用）
 * @property {string=} team - 阵营（'village'|'werewolf'|'neutral'）
 */
```

### 2.2 元素类型枚举

```javascript
const ELEMENT_TYPES = {
  ROLE: 'role',
  TEAM: 'team',
  PHASE: 'phase',
  VOTE: 'vote',
  ELIMINATION: 'elimination',
  LINK: 'link',
};
```

### 2.3 阵营枚举

```javascript
const TEAMS = {
  VILLAGE: 'village',     // 好人阵营
  WEREWOLF: 'werewolf',   // 狼人阵营
  NEUTRAL: 'neutral'      // 中立阵营
};
```

---

## 3. 角色定义

### 3.1 角色结构

```javascript
/**
 * @typedef {Object} Role
 * @property {string} id - 角色标识符
 * @property {string} name - 角色名称
 * @property {string} team - 阵营 ('village'|'werewolf'|'neutral')
 * @property {string} priority - 开发优先级 ('P0'|'P1'|'P2'|'P3')
 * @property {string[]} actionTypes - 可执行的操作类型
 * @property {string} winCondition - 胜利条件
 * @property {string[]} constraints - 配置约束
 */
```

### 3.2 基础角色 (P0 - 优先实现)

| 角色 | ID | 阵营 | 夜晚行动 | 简述 |
|------|-----|------|----------|------|
| 村民 | `villager` | village | 无 | 普通村民，依靠白天讨论与投票找出狼人 |
| 狼人 | `werewolf` | werewolf | NIGHT_WOLF_KILL | 夜晚合议击杀一人 |
| 预言家 | `seer` | village | NIGHT_SEER_CHECK | 夜晚查看一名玩家身份/阵营 |
| 医生 | `doctor` | village | NIGHT_DOCTOR_PROTECT | 夜晚保护一名玩家免于击杀 |
| 猎人 | `hunter` | village | 无 (被动) | 被处决或击杀时可反杀一名玩家 |
| 女巫 | `witch` | village | NIGHT_WITCH_SAVE/POISON | 救人/毒杀各一次 |

### 3.3 进阶角色 (P1 - 扩展)

| 角色 | ID | 阵营 | 夜晚行动 | 简述 |
|------|-----|------|----------|------|
| 守卫 | `bodyguard` | village | NIGHT_BODYGUARD_PROTECT | 保护目标免于夜晚击杀 |
| 丘比特 | `cupid` | neutral | NIGHT_CUPID_LINK | 首夜连结两名恋人 |
| 警长 | `sheriff` | village | NIGHT_SHERIFF_CHECK | 夜晚查验返回"可疑/无辜" |
| 私刑者 | `vigilante` | village | NIGHT_VIGILANTE_KILL | 夜晚射杀一人 |
| 白痴 | `idiot` | neutral | 无 | 仅当被投票处决时胜利 |
| 魔笛手 | `piper` | neutral | NIGHT_PIPER_CHARM | 夜晚魅惑玩家，魅惑全体则胜 |
| 队长 | `captain` | village | DAY_REVEAL_CAPTAIN | 白天公开后获得加倍票权 |

### 3.4 高级角色 (P2/P3 - 后续扩展)

| 角色 | ID | 阵营 | 优先级 | 简述 |
|------|-----|------|--------|------|
| 守护天使 | `guardian_angel` | village | P2 | 保护他人，防止夜晚攻击 |
| 狱卒 | `jailer` | village | P2 | 监禁保护目标并阻止其夜晚行动 |
| 小偷 | `thief` | neutral | P2 | 首夜可与额外牌交换并继承其角色 |
| 侦探 | `detective` | village | P2 | 夜晚比较两名玩家是否同阵营 |
| 炸弹人 | `bomb` | neutral | P2 | 被夜晚击杀时反杀攻击者 |
| 小女孩 | `little_girl` | village | P2 | 可偷看狼人行动，被发现会死亡 |
| 追踪者 | `tracker` | village | P2 | 夜晚得知目标访问了谁 |
| 守望者 | `watcher` | village | P2 | 夜晚得知谁访问了目标 |
| 先知 | `oracle` | village | P2 | 死亡时公开其最后目标身份 |
| 共济会 | `mason` | village | P2 | Mason 彼此认识并确认同阵营 |
| 酒保 | `roleblocker` | neutral | P2 | 夜晚阻止目标执行夜晚行动 |
| 磨坊主 | `miller` | village | P3 | 村民但在查验中显示为邪恶 |
| 教父 | `godfather` | werewolf | P3 | 查验时显示为无辜 |
| 狼王 | `alpha_werewolf` | werewolf | P3 | 查验时不显示为狼人 |
| 司机 | `bus_driver` | neutral | P3 | 交换两名玩家的夜晚行动目标 |
| 邪教领袖 | `cult_leader` | neutral | P3 | 夜晚招募形成独立阵营 |

### 3.5 角色 JSON Schema

```javascript
{
  "id": "string",           // 角色ID (snake_case)
  "name": "string",         // 显示名称
  "team": "village|werewolf|neutral",
  "priority": "P0|P1|P2|P3",
  "actionTypes": ["string"], // 可执行的操作类型
  "winCondition": "string",  // 胜利条件
  "constraints": ["string"]  // 配置约束
}
```

---

## 4. 游戏阶段

### 4.1 阶段枚举

```javascript
const PHASES = {
  WAITING: 'waiting',           // 等待开始
  NIGHT: 'night',               // 夜晚阶段
  DAY_ANNOUNCE: 'day_announce', // 白天公布死亡
  DAY_DISCUSSION: 'day_discussion', // 白天讨论
  DAY_VOTE: 'day_vote',         // 白天投票
  DAY_EXECUTION: 'day_execution', // 处决阶段
  ENDED: 'ended'                // 游戏结束
};
```

### 4.2 夜间行动优先级

按以下顺序依次执行夜间行动：

| 优先级 | 角色 | 操作 |
|--------|------|------|
| 1 | Cupid | 连结恋人 (仅首夜) |
| 2 | Thief | 交换角色 (仅首夜) |
| 3 | Jailer | 监禁目标 |
| 4 | Roleblocker | 阻止目标行动 |
| 5 | Seer/Sheriff/Detective | 查验 |
| 6 | Tracker/Watcher | 追踪/监视 |
| 7 | Doctor/Bodyguard/Guardian Angel | 保护 |
| 8 | Werewolf | 击杀 |
| 9 | Vigilante | 射杀 |
| 10 | Witch | 救人/毒杀 |
| 11 | Piper | 魅惑 |
| 12 | Oracle | 标记 |

---

## 5. 游戏流程

### 5.1 初始化流程

```
1. 设定玩家人数、角色集合与数量（可配置）
2. 随机分配角色并保密；记录所有角色
3. 游戏从夜晚开始
```

### 5.2 夜晚流程

```
1. 所有玩家闭眼
2. 按优先级依次执行夜间行动:
   - 特殊首夜行动 (Cupid, Thief)
   - 控制类行动 (Jailer, Roleblocker)
   - 侦查类行动 (Seer, Sheriff, Detective, Tracker, Watcher)
   - 保护类行动 (Doctor, Bodyguard, Guardian Angel)
   - 击杀类行动 (Werewolf, Vigilante)
   - 女巫行动 (查看被杀者，决定是否用药)
   - 其他行动 (Piper, Oracle)
3. 结算夜晚行动结果
4. 天亮，进入白天阶段
```

### 5.3 白天流程

```
1. 公布夜晚死亡情况
2. 死亡玩家发表遗言（可选）
3. 触发死亡时技能 (Hunter 开枪等)
4. 存活玩家自由讨论
5. 投票放逐玩家
6. 被放逐玩家发表遗言
7. 触发处决时技能
8. 检查胜利条件
9. 如未结束，进入下一个夜晚
```

---

## 6. 操作类型定义

### 6.1 操作类型枚举

```javascript
const ACTION_TYPES = {
  // 夜间操作 - 击杀类
  NIGHT_WOLF_KILL: 'NIGHT_WOLF_KILL',
  NIGHT_VIGILANTE_KILL: 'NIGHT_VIGILANTE_KILL',

  // 夜间操作 - 侦查类
  NIGHT_SEER_CHECK: 'NIGHT_SEER_CHECK',
  NIGHT_SHERIFF_CHECK: 'NIGHT_SHERIFF_CHECK',
  NIGHT_DETECTIVE_COMPARE: 'NIGHT_DETECTIVE_COMPARE',
  NIGHT_TRACK: 'NIGHT_TRACK',
  NIGHT_WATCH: 'NIGHT_WATCH',
  NIGHT_LITTLE_GIRL_PEEK: 'NIGHT_LITTLE_GIRL_PEEK',

  // 夜间操作 - 保护类
  NIGHT_DOCTOR_PROTECT: 'NIGHT_DOCTOR_PROTECT',
  NIGHT_BODYGUARD_PROTECT: 'NIGHT_BODYGUARD_PROTECT',
  NIGHT_GUARDIAN_ANGEL_PROTECT: 'NIGHT_GUARDIAN_ANGEL_PROTECT',

  // 夜间操作 - 女巫
  NIGHT_WITCH_SAVE: 'NIGHT_WITCH_SAVE',
  NIGHT_WITCH_POISON: 'NIGHT_WITCH_POISON',

  // 夜间操作 - 控制类
  NIGHT_JAILER_JAIL: 'NIGHT_JAILER_JAIL',
  NIGHT_ROLEBLOCK: 'NIGHT_ROLEBLOCK',
  NIGHT_BUS_DRIVER_SWAP: 'NIGHT_BUS_DRIVER_SWAP',

  // 夜间操作 - 特殊
  NIGHT_CUPID_LINK: 'NIGHT_CUPID_LINK',
  NIGHT_THIEF_STEAL: 'NIGHT_THIEF_STEAL',
  NIGHT_PIPER_CHARM: 'NIGHT_PIPER_CHARM',
  NIGHT_ORACLE_FOCUS: 'NIGHT_ORACLE_FOCUS',
  NIGHT_RECRUIT: 'NIGHT_RECRUIT',

  // 白天操作
  DAY_REVEAL_CAPTAIN: 'DAY_REVEAL_CAPTAIN',
  DAY_NOMINATE: 'DAY_NOMINATE',
  DAY_VOTE: 'DAY_VOTE',
  DAY_SKIP_VOTE: 'DAY_SKIP_VOTE',

  // 被动触发
  HUNTER_SHOOT: 'HUNTER_SHOOT',
  LAST_WORDS: 'LAST_WORDS',
};
```

### 6.2 操作数据结构

```javascript
// 击杀类
{ type: 'NIGHT_WOLF_KILL', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_VIGILANTE_KILL', actorId, targetId, phase: 'night' }

// 侦查类
{ type: 'NIGHT_SEER_CHECK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_SHERIFF_CHECK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_DETECTIVE_COMPARE', actorId, targetIds: [playerA, playerB], phase: 'night' }
{ type: 'NIGHT_TRACK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_WATCH', actorId, targetId, phase: 'night' }

// 保护类
{ type: 'NIGHT_DOCTOR_PROTECT', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_BODYGUARD_PROTECT', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_GUARDIAN_ANGEL_PROTECT', actorId, targetId, phase: 'night' }

// 女巫
{ type: 'NIGHT_WITCH_SAVE', actorId, phase: 'night' }  // 救当晚被杀的人
{ type: 'NIGHT_WITCH_POISON', actorId, targetId, phase: 'night' }

// 控制类
{ type: 'NIGHT_JAILER_JAIL', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_ROLEBLOCK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_BUS_DRIVER_SWAP', actorId, targetIds: [playerA, playerB], phase: 'night' }

// 特殊
{ type: 'NIGHT_CUPID_LINK', actorId, targetIds: [playerA, playerB], phase: 'night' }
{ type: 'NIGHT_THIEF_STEAL', actorId, targetRoleIndex, phase: 'night' }
{ type: 'NIGHT_PIPER_CHARM', actorId, targetId, phase: 'night' }

// 白天
{ type: 'DAY_VOTE', actorId, targetId, phase: 'day' }
{ type: 'DAY_SKIP_VOTE', actorId, phase: 'day' }
{ type: 'HUNTER_SHOOT', actorId, targetId }
```

### 6.3 操作效果

| 操作 | 效果 | 条件 |
|------|------|------|
| NIGHT_WOLF_KILL | 目标进入夜晚死亡队列 | 仅狼人队伍，夜晚阶段 |
| NIGHT_SEER_CHECK | 返回目标阵营 (village/werewolf) | 仅 Seer，夜晚阶段 |
| NIGHT_SHERIFF_CHECK | 返回"可疑/无辜" | 仅 Sheriff，夜晚阶段 |
| NIGHT_DETECTIVE_COMPARE | 返回两名目标是否同阵营 | 仅 Detective，夜晚阶段 |
| NIGHT_DOCTOR_PROTECT | 目标免疫夜晚击杀一次 | 仅 Doctor，夜晚阶段 |
| NIGHT_WITCH_SAVE | 取消当夜死亡队列中的被狼杀者 | Witch 救人药水未用过 |
| NIGHT_WITCH_POISON | 添加一名玩家至死亡队列 | Witch 毒药未用过 |
| NIGHT_CUPID_LINK | 绑定恋人关系 | 仅首夜 |
| NIGHT_ROLEBLOCK | 阻止目标夜晚行动 | 仅 Roleblocker，夜晚阶段 |
| NIGHT_PIPER_CHARM | 魅惑目标；魅惑全体即可胜利 | 仅 Piper，夜晚阶段 |
| DAY_VOTE | 计票处决候选人 | 白天阶段 |
| HUNTER_SHOOT | 带走一名玩家 | 猎人死亡时触发 |

---

## 7. 游戏状态结构

```javascript
/**
 * @typedef {Object} Player
 * @property {string} id - 玩家ID
 * @property {string} name - 玩家昵称
 * @property {string} roleId - 角色ID
 * @property {string} team - 阵营 'village'|'werewolf'|'neutral'
 * @property {boolean} alive - 是否存活
 * @property {Object} roleState - 角色特定状态
 */

/**
 * @typedef {Object} WerewolfGameState
 * @property {Object.<string, Player>} players - 玩家映射
 * @property {string} phase - 当前阶段
 * @property {number} round - 第几轮 (天数)
 * @property {string} status - 游戏状态 ('waiting'|'playing'|'ended')
 * @property {string[]} nightKillQueue - 夜晚死亡队列
 * @property {string|null} nightWolfTarget - 狼人击杀目标
 * @property {Object.<string, string>} votes - 投票记录 (voterId -> targetId)
 * @property {Object} nightActions - 当晚行动记录
 * @property {Object} links - 特殊关系 { lovers: [playerA, playerB] }
 * @property {Object} roleStates - 角色状态 { witchSaveUsed, witchPoisonUsed, ... }
 * @property {string|null} winner - 获胜阵营
 * @property {Object[]} eventLog - 事件日志
 */
```

---

## 8. 角色配置推荐

根据玩家数量推荐的角色配置：

| 玩家数 | 狼人 | 村民 | 神职角色 | 中立 |
|--------|------|------|----------|------|
| 6-7 | 2 | 2 | Seer + Doctor | 0 |
| 8-9 | 2 | 3 | Seer + Doctor + Witch | 0 |
| 10-11 | 3 | 3 | Seer + Doctor + Witch | Thief |
| 12-14 | 3 | 4 | Seer + Doctor + Witch + Hunter | Thief + Piper |
| 15-20 | 4 | 5 | Seer + Doctor + Witch + Hunter + Bodyguard | Thief + Cupid + Piper |

### 配置生成算法

```javascript
const presets = [
  { min: 6, max: 7, roles: ['seer', 'doctor'], wolves: 2, neutrals: [] },
  { min: 8, max: 9, roles: ['seer', 'doctor', 'witch'], wolves: 2, neutrals: [] },
  { min: 10, max: 11, roles: ['seer', 'doctor', 'witch'], wolves: 3, neutrals: ['thief'] },
  { min: 12, max: 14, roles: ['seer', 'doctor', 'witch', 'hunter'], wolves: 3, neutrals: ['thief', 'piper'] },
  { min: 15, max: 20, roles: ['seer', 'doctor', 'witch', 'hunter', 'bodyguard'], wolves: 4, neutrals: ['thief', 'cupid', 'piper'] }
];

function buildDistribution(playerCount) {
  const preset = presets.find(p => playerCount >= p.min && playerCount <= p.max);
  const roleCounts = { werewolf: preset.wolves };

  for (const roleId of [...preset.roles, ...preset.neutrals]) {
    roleCounts[roleId] = 1;
  }

  const used = Object.values(roleCounts).reduce((sum, c) => sum + c, 0);
  roleCounts.villager = Math.max(playerCount - used, 0);

  return roleCounts;
}
```

---

## 9. 游戏结束条件

```javascript
function checkGameEnd(state) {
  const alive = Object.values(state.players).filter(p => p.alive);
  const wolves = alive.filter(p => p.team === 'werewolf').length;
  const villagers = alive.filter(p => p.team === 'village').length;

  // 狼人全部死亡 -> 好人胜利
  if (wolves === 0) {
    return { ended: true, winner: 'village', reason: 'all_wolves_eliminated' };
  }

  // 狼人数量 >= 好人数量 -> 狼人胜利
  if (wolves >= villagers) {
    return { ended: true, winner: 'werewolf', reason: 'parity_or_majority' };
  }

  // 检查特殊胜利条件
  // Piper: 所有存活玩家都被魅惑
  // Lovers: 恋人是最后存活的玩家

  return { ended: false, winner: null, reason: '' };
}
```

---

## 10. 特殊规则

### 10.1 恋人规则 (Cupid)

- 首夜丘比特连结两名玩家成为恋人
- 恋人中一人死亡，另一人立即殉情死亡
- 恋人可跨阵营（可选配置）
- 如果恋人是最后存活的玩家，恋人获胜

### 10.2 同守同救规则

- 当 Doctor 和 Witch 同时保护同一目标时的处理（可配置）
- 默认：救一次有效，不会因重复保护而死亡

### 10.3 猎人开枪规则

- 猎人被狼人杀死：可以开枪
- 猎人被投票处决：可以开枪
- 猎人被女巫毒死：可配置是否能开枪 (默认: 不能)

### 10.4 保护限制规则

- Doctor: 可配置是否能自保 (`allowDoctorSelfProtect`)
- Doctor/Bodyguard: 可配置是否能连续保护同一人 (`allowRepeatedProtect`)
- Guardian Angel: 不能自保

---

## 11. 错误代码

| 代码 | 说明 |
|------|------|
| `GAME_NOT_STARTED` | 游戏未开始 |
| `INVALID_PHASE` | 操作阶段不匹配 |
| `NOT_YOUR_TURN` | 不是你的行动阶段 |
| `PLAYER_DEAD` | 玩家已死亡 |
| `ACTION_NOT_ALLOWED` | 角色不允许此操作 |
| `TARGET_INVALID` | 无效的目标 |
| `TARGET_ALREADY_DEAD` | 目标已死亡 |
| `RESOURCE_EXHAUSTED` | 药水/能力已用完 |
| `CANNOT_SELF_TARGET` | 不能以自己为目标 |
| `REPEATED_PROTECT` | 不能连续保护同一人 |

---

## 12. 配置选项

```javascript
const defaultConfig = {
  // 角色配置
  enabledRoles: ['villager', 'werewolf', 'seer', 'doctor', 'hunter', 'witch'],
  roleCounts: { werewolf: 2, seer: 1, doctor: 1 },

  // 游戏规则
  revealRolesOnDeath: true,        // 死亡是否公开角色
  allowDoctorSelfProtect: true,    // Doctor 是否可自保
  allowRepeatedProtect: false,     // 是否允许连续保护同一人
  hunterShootOnPoison: false,      // 猎人被毒死是否能开枪
  dayVoteMajority: true,           // 是否需要过半票处决

  // 女巫配置
  witchCanSaveSelf: true,          // 女巫是否可以自救
  witchSaveFirstNightOnly: false,  // 女巫救人仅首夜有效

  // 时间配置 (秒)
  nightActionTime: 30,             // 夜间行动时间
  discussionTime: 300,             // 白天讨论时间
  voteTime: 30,                    // 投票时间
  lastWordsTime: 30,               // 遗言时间
};
```

### 配置选项说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabledRoles` | string[] | [...] | 启用的角色列表 |
| `roleCounts` | object | {...} | 指定角色数量 |
| `revealRolesOnDeath` | boolean | true | 死亡是否公开角色 |
| `allowDoctorSelfProtect` | boolean | true | Doctor 是否可自保 |
| `allowRepeatedProtect` | boolean | false | 是否允许连续保护同一人 |
| `hunterShootOnPoison` | boolean | false | 猎人被毒死是否能开枪 |
| `dayVoteMajority` | boolean | true | 是否需要过半票处决 |
| `witchCanSaveSelf` | boolean | true | 女巫是否可以自救 |

---

## 13. 参考资料

- Mafia/Werewolf 经典规则 (日夜流程与胜利条件)
- Werewolves of Miller's Hollow 角色设定 (Seer/Hunter/Cupid/Witch)
- 各类变体角色能力参考 (Doctor/Guardian Angel/Sheriff/Detective 等)
