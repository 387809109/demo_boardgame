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
| 义警 | `vigilante` | village | NIGHT_VIGILANTE_KILL | 夜晚射杀一人 |
| 白痴 | `idiot` | village | 无 | 被投票处决时不死，失去投票权 |
| 小丑 | `jester` | neutral | 无 | 被投票处决时胜利 |
| 魔笛手 | `piper` | neutral | NIGHT_PIPER_CHARM | 夜晚魅惑玩家，魅惑全体则胜 |

### 3.4 高级角色 (P2 - 扩展)

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

### 3.5 高级角色 (P3 - 后续扩展)

| 角色 | ID | 阵营 | 优先级 | 简述 |
|------|-----|------|--------|------|
| 磨坊主 | `miller` | village | P3 | 村民但在查验中显示为邪恶 |
| 教父 | `godfather` | werewolf | P3 | 查验时显示为无辜 |
| 狼王 | `alpha_werewolf` | werewolf | P3 | 查验时不显示为狼人 |
| 连环杀手 | `serial_killer` | neutral | P3 | 独狼阵营，每晚击杀一人，存活到最后获胜 |
| 司机 | `bus_driver` | neutral | P3 | 交换两名玩家的夜晚行动目标 |
| 邪教领袖 | `cult_leader` | neutral | P3 | 夜晚招募形成独立阵营 |
| 狼人首领 | `werewolf_leader` | werewolf | P3 | 狼人阵营核心，可决定夜晚击杀目标（替代合议） |
| 狼人巫师 | `wolf_witch` | werewolf | P3 | 狼人阵营，拥有一次毒杀或干扰能力 |
| 狼人先知 | `wolf_seer` | werewolf | P3 | 夜晚可查验玩家阵营 |
| 狼人守卫 | `wolf_guard` | werewolf | P3 | 夜晚可保护一名狼人 |
| 黑市商人 | `dealer` | neutral | P3 | 夜晚向目标提供随机能力或负面效果 |
| 纵火犯 | `arsonist` | neutral | P3 | 夜晚泼油，任意夜晚点燃全部被标记者 |
| 放逐者 | `exile` | neutral | P3 | 夜晚将目标暂时移出游戏一晚 |
| 骗子 | `trickster` | neutral | P3 | 夜晚伪造一次访问或行动记录 |
| 复仇者 | `avenger` | village | P3 | 被击杀后，下一夜自动击杀其杀手 |
| 替罪羊 | `scapegoat` | village | P3 | 被处决后，投票其的玩家之一将被惩罚 |
| 牧师 | `priest` | village | P3 | 可解除诅咒/魅惑/中毒等状态 |
| 护符师 | `warder` | village | P3 | 为目标施加一次性护符，抵挡一次致命效果 |
| 沉默者 | `silencer` | werewolf | P3 | 夜晚使目标次日无法发言 |
| 影子 | `shadow` | neutral | P3 | 夜晚跟随目标，复制其夜晚行动 |
| 替身 | `decoy` | village | P3 | 夜晚可吸引一次针对目标的击杀 |

### 3.6 角色 JSON Schema

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
| 9 | Vigilante/Serial Killer | 射杀/击杀 |
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

#### 5.2.1 狼人夜间协作与投票

- 狼人阵营彼此可见，夜晚可进行讨论与协作
- 狼人需要通过投票决定当晚的击杀目标
- 狼人可以选择弃票
- 若投票结果平票（例如多名玩家得票相同，或全部弃票导致无人得票），则当晚无人被狼人击杀
- 医生与女巫会得知狼人的最终目标，或得知当晚无人被狼人击杀

### 5.3 白天流程

```
1. 公布夜晚死亡情况
2. （若启用 Leader 且为第一天）完成 Leader 产生流程
3. 死亡玩家发表遗言（可选）
4. 触发死亡时技能 (Hunter 开枪等)
5. 存活玩家按规则顺序依次发言讨论
6. 按同一顺序进行投票（投票时禁止发言）
7. 若平票，进入候选人复盘发言与二次投票
8. 被放逐玩家发表遗言
9. 触发处决时技能
10. 检查胜利条件
11. 如未结束，进入下一个夜晚
```

#### 5.3.1 白天发言与投票秩序

- 白天讨论采用顺序发言
- 轮到某人发言时，其他玩家不可插话
- 进入投票环节后，所有玩家不可发言，直至投票结束

#### 5.3.2 白天讨论与投票的顺序规则

- 默认顺序：从昨夜受害者开始（若有多名受害者，随机选一名作为起点），随后按逆时针顺序进行
- 若启用 Leader 且领袖存活，则顺序改为按 5.3.3 的规则执行
- 除非额外游戏选项或角色技能改变顺序/赋予优先权，所有可投票玩家依次参与讨论与投票
- 投票开始后，所有人按顺序投票，若有唯一最高票者，则其被处决
- 若出现平票，进入“候选人复盘”环节：仅平票候选人依照同样顺序进行发言
- 复盘发言结束后，其他玩家仅对候选人进行二次投票，票数最高者被处决
- 若二次投票再次平票，则当日无人被处决

#### 5.3.3 可选规则：Leader（领袖）机制

- 默认启用：`leaderEnabled = true`
- 领袖产生时机：游戏第一天，Captain 身份公开后（若本局无 Captain，则在第一天开始时）进行
- 领袖产生流程：
  - 全体玩家按随机起点，逆时针顺序依次发言
  - 每位玩家表态是否愿意成为领袖候选人
  - 非候选人对候选人投票（候选人不参与投票，可弃票）
  - 票数最高者成为领袖；若平票，则在平票者中随机选一名领袖
- 领袖存活时的讨论/投票顺序：
  - 若昨夜有多人死亡，领袖选择其中一人作为顺序起点
  - 领袖决定当日讨论与投票采用顺时针或逆时针
  - 若领袖不是最后一位发言者，讨论结束后领袖获得一次额外发言，再进入投票
  - 投票顺序与讨论顺序一致
- 若领袖机制未启用或领袖已死亡，则回退到默认顺序规则

#### 5.3.4 日间投票多数规则（dayVoteMajority）

- 当 `dayVoteMajority = true` 时，只有**得票严格大于弃票数**的玩家才可能被处决或进入二次投票
  - 例：2 票 vs 2 票，弃票 2 -> 无人处决，直接进入夜晚
  - 例：3 票 vs 3 票，弃票 2 -> 平票进入二次投票
  - 例：3 票 vs 1 票，弃票 2 -> 3 票者处决
  - 例：3 票 vs 弃票 3 -> 无人处决，直接进入夜晚
- 二次投票时规则相同：只有**得票严格大于弃票数**者才可被处决
- 当 `dayVoteMajority = false` 时，不考虑弃票数，直接按最高票/平票进入二次投票处理

---

## 6. 操作类型定义

### 6.1 操作类型枚举

```javascript
const ACTION_TYPES = {
  // 夜间操作 - 击杀类（Kill）
  NIGHT_WOLF_KILL: 'NIGHT_WOLF_KILL',
  NIGHT_VIGILANTE_KILL: 'NIGHT_VIGILANTE_KILL',
  NIGHT_SERIAL_KILL: 'NIGHT_SERIAL_KILL',

  // 夜间操作 - 击杀类（Effect / Special Kill）
  NIGHT_WITCH_POISON: 'NIGHT_WITCH_POISON',           // Poison（默认绕过保护）
  NIGHT_ARSONIST_DOUSE: 'NIGHT_ARSONIST_DOUSE',       // 对目标泼油（标记）
  NIGHT_ARSONIST_IGNITE: 'NIGHT_ARSONIST_IGNITE',     // 点燃所有被泼油目标（群体致死）
  NIGHT_WOLF_WITCH_POISON: 'NIGHT_WOLF_WITCH_POISON', // 狼人巫师：毒杀/效果杀（可选实现）

  // 夜间操作 - 侦查类
  NIGHT_SEER_CHECK: 'NIGHT_SEER_CHECK',
  NIGHT_SHERIFF_CHECK: 'NIGHT_SHERIFF_CHECK',
  NIGHT_DETECTIVE_COMPARE: 'NIGHT_DETECTIVE_COMPARE',
  NIGHT_TRACK: 'NIGHT_TRACK',
  NIGHT_WATCH: 'NIGHT_WATCH',
  NIGHT_LITTLE_GIRL_PEEK: 'NIGHT_LITTLE_GIRL_PEEK',

  // 夜间操作 - 保护类（Protect / Guard）
  NIGHT_DOCTOR_PROTECT: 'NIGHT_DOCTOR_PROTECT',
  NIGHT_BODYGUARD_PROTECT: 'NIGHT_BODYGUARD_PROTECT',
  NIGHT_GUARDIAN_ANGEL_PROTECT: 'NIGHT_GUARDIAN_ANGEL_PROTECT',
  NIGHT_WOLF_GUARD_PROTECT: 'NIGHT_WOLF_GUARD_PROTECT', // 狼人守卫：保护狼人（可选实现）
  NIGHT_WARDER_WARD: 'NIGHT_WARDER_WARD',               // 护符师：施加一次性护符（抵挡一次致死事件）

  // 夜间操作 - 女巫（Heal）
  NIGHT_WITCH_SAVE: 'NIGHT_WITCH_SAVE',

  // 夜间操作 - 控制类（Control）
  NIGHT_JAILER_JAIL: 'NIGHT_JAILER_JAIL',
  NIGHT_ROLEBLOCK: 'NIGHT_ROLEBLOCK',
  NIGHT_BUS_DRIVER_SWAP: 'NIGHT_BUS_DRIVER_SWAP',

  // 夜间操作 - 阵营/关系/状态（Meta / State）
  NIGHT_CUPID_LINK: 'NIGHT_CUPID_LINK',
  NIGHT_THIEF_STEAL: 'NIGHT_THIEF_STEAL',
  NIGHT_PIPER_CHARM: 'NIGHT_PIPER_CHARM',
  NIGHT_RECRUIT: 'NIGHT_RECRUIT',                   // cult_leader 招募
  NIGHT_SILENCER_SILENCE: 'NIGHT_SILENCER_SILENCE', // 沉默者：令目标次日禁言（状态）
  NIGHT_PRIEST_CLEANSE: 'NIGHT_PRIEST_CLEANSE',     // 牧师：清除魅惑/中毒/诅咒等（状态）

  // 夜间操作 - 狼人阵营扩展（可选实现）
  NIGHT_WEREWOLF_LEADER_SET_KILL: 'NIGHT_WEREWOLF_LEADER_SET_KILL', // 狼人首领：指定狼刀目标（覆盖合议）
  NIGHT_WOLF_SEER_CHECK: 'NIGHT_WOLF_SEER_CHECK',                   // 狼人先知：查验阵营（或角色）
  NIGHT_EXILE_BANISH: 'NIGHT_EXILE_BANISH',                         // 放逐者：将目标移出一晚（隔离）

  // 白天操作
  DAY_REVEAL_CAPTAIN: 'DAY_REVEAL_CAPTAIN',
  DAY_NOMINATE: 'DAY_NOMINATE',
  DAY_VOTE: 'DAY_VOTE',
  DAY_SKIP_VOTE: 'DAY_SKIP_VOTE',

  // 被动触发（Passive / Trigger）
  HUNTER_SHOOT: 'HUNTER_SHOOT',
  AVENGER_TRIGGER_KILL: 'AVENGER_TRIGGER_KILL', // 复仇者：死后标记/触发对杀手的反击（依实现）
  LAST_WORDS: 'LAST_WORDS',
};
```

### 6.2 操作数据结构

```javascript
// 击杀类（Kill）
{ type: 'NIGHT_WOLF_KILL', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_VIGILANTE_KILL', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_SERIAL_KILL', actorId, targetId, phase: 'night' }

// 毒杀 / 效果杀（Poison / Effect）
{ type: 'NIGHT_WITCH_POISON', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_WOLF_WITCH_POISON', actorId, targetId, phase: 'night' } // 可选

// 纵火犯（Arsonist）
{ type: 'NIGHT_ARSONIST_DOUSE', actorId, targetId, phase: 'night' }    // 给目标添加 OILED 状态
{ type: 'NIGHT_ARSONIST_IGNITE', actorId, phase: 'night' }             // 击杀所有 OILED 目标

// 侦查类
{ type: 'NIGHT_SEER_CHECK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_SHERIFF_CHECK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_DETECTIVE_COMPARE', actorId, targetIds: [playerA, playerB], phase: 'night' }
{ type: 'NIGHT_TRACK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_WATCH', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_LITTLE_GIRL_PEEK', actorId, phase: 'night' } // 实现可为无 targetId 或 targetId=wolves

// 保护类
{ type: 'NIGHT_DOCTOR_PROTECT', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_BODYGUARD_PROTECT', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_GUARDIAN_ANGEL_PROTECT', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_WOLF_GUARD_PROTECT', actorId, targetId, phase: 'night' } // 可选：仅保护狼人
{ type: 'NIGHT_WARDER_WARD', actorId, targetId, phase: 'night' }        // 护符：一次性致死抵挡

// 女巫（治疗）
{ type: 'NIGHT_WITCH_SAVE', actorId, phase: 'night' }  // 仅对女巫选择的原始目标生效

// 控制类
{ type: 'NIGHT_JAILER_JAIL', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_ROLEBLOCK', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_BUS_DRIVER_SWAP', actorId, targetIds: [playerA, playerB], phase: 'night' }
{ type: 'NIGHT_EXILE_BANISH', actorId, targetId, phase: 'night' } // 放逐：目标当夜不在场

// 关系/状态类
{ type: 'NIGHT_CUPID_LINK', actorId, targetIds: [playerA, playerB], phase: 'night' }
{ type: 'NIGHT_THIEF_STEAL', actorId, targetRoleIndex, phase: 'night' }
{ type: 'NIGHT_PIPER_CHARM', actorId, targetId, phase: 'night' }
{ type: 'NIGHT_RECRUIT', actorId, targetId, phase: 'night' }            // 邪教招募
{ type: 'NIGHT_SILENCER_SILENCE', actorId, targetId, phase: 'night' }    // 次日禁言
{ type: 'NIGHT_PRIEST_CLEANSE', actorId, targetId, phase: 'night' }      // 清除状态（如 CHARMED/POISONED/OILED 等）

// 狼人阵营扩展（可选）
{ type: 'NIGHT_WEREWOLF_LEADER_SET_KILL', actorId, targetId, phase: 'night' } // 覆盖狼刀目标
{ type: 'NIGHT_WOLF_SEER_CHECK', actorId, targetId, phase: 'night' }

// 白天
{ type: 'DAY_REVEAL_CAPTAIN', actorId, phase: 'day' }
{ type: 'DAY_NOMINATE', actorId, targetId, phase: 'day' }
{ type: 'DAY_VOTE', actorId, targetId, phase: 'day' }
{ type: 'DAY_SKIP_VOTE', actorId, phase: 'day' }

// 被动触发
{ type: 'HUNTER_SHOOT', actorId, targetId }
{ type: 'AVENGER_TRIGGER_KILL', actorId, targetId } // targetId 通常为“杀手”；也可实现为延迟事件
{ type: 'LAST_WORDS', actorId }
```

### 6.3 操作效果

#### 6.3.1 击杀与伤害

| 操作 | 效果 | 条件 |
|------|------|------|
| NIGHT_WOLF_KILL | 目标进入夜晚死亡队列（Kill） | 仅狼人队伍，夜晚阶段 |
| NIGHT_WEREWOLF_LEADER_SET_KILL | 指定 NIGHT_WOLF_KILL 的最终 targetId（覆盖合议） | 仅 `werewolf_leader`，夜晚阶段 |
| NIGHT_VIGILANTE_KILL | 目标进入夜晚死亡队列（Kill） | 仅 Vigilante，夜晚阶段 |
| NIGHT_SERIAL_KILL | 目标进入夜晚死亡队列（Kill） | 仅 Serial Killer，夜晚阶段 |
| NIGHT_WITCH_POISON | 目标进入夜晚死亡队列（Poison，默认绕过保护，见 10.4.8） | Witch 毒药未用过 |
| NIGHT_WOLF_WITCH_POISON | 目标进入夜晚死亡队列（Poison/Effect） | 仅 `wolf_witch`，能力未用过（可选） |
| NIGHT_ARSONIST_IGNITE | 所有 `OILED` 玩家进入死亡队列（Effect Kill，通常不视为“普通击杀”） | 仅 Arsonist，夜晚阶段 |

#### 6.3.2 侦查与信息

| 操作 | 效果 | 条件 |
|------|------|------|
| NIGHT_SEER_CHECK | 返回目标阵营 (village/werewolf) | 仅 Seer，夜晚阶段 |
| NIGHT_WOLF_SEER_CHECK | 返回目标阵营/身份（按实现约定） | 仅 `wolf_seer`，夜晚阶段（可选） |
| NIGHT_SHERIFF_CHECK | 返回"可疑/无辜" | 仅 Sheriff，夜晚阶段 |
| NIGHT_DETECTIVE_COMPARE | 返回两名目标是否同阵营 | 仅 Detective，夜晚阶段 |
| NIGHT_TRACK | 返回目标当夜访问了谁（若无访问则为空） | 仅 Tracker，夜晚阶段 |
| NIGHT_WATCH | 返回当夜访问目标的玩家列表 | 仅 Watcher，夜晚阶段 |
| NIGHT_LITTLE_GIRL_PEEK | 获取狼人击杀的“部分信息”（按实现） | 仅 Little Girl，夜晚阶段 |

#### 6.3.3 保护与治疗

| 操作 | 效果 | 条件 |
|------|------|------|
| NIGHT_DOCTOR_PROTECT | 阻止一次普通击杀导致的死亡（按 10.4 判定） | 仅 Doctor，夜晚阶段 |
| NIGHT_BODYGUARD_PROTECT | 拦截一次普通击杀并替死（按 10.4 判定） | 仅 Bodyguard，夜晚阶段 |
| NIGHT_GUARDIAN_ANGEL_PROTECT | 阻止一次普通击杀导致的死亡（按 10.4 判定） | 仅 Guardian Angel（常见版），夜晚阶段 |
| NIGHT_WOLF_GUARD_PROTECT | 保护目标免于一次普通击杀（通常仅允许保护狼人） | 仅 `wolf_guard`（可选） |
| NIGHT_WARDER_WARD | 为目标添加一次性护符：抵挡一次致死事件（Kill 或 Effect，按实现） | 仅 `warder`，夜晚阶段 |
| NIGHT_WITCH_SAVE | 阻止一次死亡事件（仅对女巫选定的原始目标，未处于死亡状态则失效） | Witch 救人药水未用过 |

#### 6.3.4 控制与状态

| 操作 | 效果 | 条件 |
|------|------|------|
| NIGHT_JAILER_JAIL | 目标进入 `JAILED`：当夜被保护且其夜晚行动被阻止 | 仅 Jailer，夜晚阶段 |
| NIGHT_ROLEBLOCK | 阻止目标夜晚行动（不移除其状态） | 仅 Roleblocker，夜晚阶段 |
| NIGHT_BUS_DRIVER_SWAP | 交换两名玩家当夜“被指向”的目标（目标重映射） | 仅 Bus Driver，夜晚阶段 |
| NIGHT_EXILE_BANISH | 目标当夜 `ABSENT`：不接收任何访问/击杀/保护，且自身无法行动 | 仅 `exile`（可选） |
| NIGHT_CUPID_LINK | 绑定恋人关系 | 仅首夜 |
| NIGHT_THIEF_STEAL | 与额外牌交换并继承角色 | 仅首夜或按规则限制 |
| NIGHT_PIPER_CHARM | 给目标添加 `CHARMED`；魅惑全体则 Piper 胜利 | 仅 Piper，夜晚阶段 |
| NIGHT_RECRUIT | 将目标加入邪教阵营或转换阵营（按实现） | 仅 Cult Leader，夜晚阶段 |
| NIGHT_SILENCER_SILENCE | 给目标添加 `SILENCED`：次日禁止发言/投票（按实现） | 仅 Silencer，夜晚阶段 |
| NIGHT_PRIEST_CLEANSE | 清除目标的负面状态（如 `POISONED`/`CHARMED`/`OILED` 等，按实现） | 仅 Priest，夜晚阶段 |
| NIGHT_ARSONIST_DOUSE | 给目标添加 `OILED` 状态（可多夜累计） | 仅 Arsonist，夜晚阶段 |

#### 6.3.5 白天与流程

| 操作 | 效果 | 条件 |
|------|------|------|
| DAY_VOTE | 计票处决候选人 | 白天阶段 |
| DAY_SKIP_VOTE | 放弃投票 | 白天阶段 |
| LAST_WORDS | 允许被处决者在规则允许时发言（可选实现） | 通常仅白天处决触发 |

#### 6.3.6 被动/触发

| 操作 | 效果 | 条件 |
|------|------|------|
| HUNTER_SHOOT | 带走一名玩家（立即或结算后，按实现） | Hunter 死亡触发 |
| AVENGER_TRIGGER_KILL | 对“杀手”生成一次反击击杀（可为延迟事件） | Avenger 死亡触发（按实现） |


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

根据玩家数量推荐的角色配置（仅作参考，实际对局需手动设定 roleCounts）：

| 玩家数 | 狼人 | 村民 | 神职角色 | 中立 |
|--------|------|------|----------|------|
| 6-7 | 2 | 2 | Seer + Doctor | 0 |
| 8-9 | 2 | 3 | Seer + Doctor + Witch | 0 |
| 10-11 | 3 | 3 | Seer + Doctor + Witch | Thief |
| 12-14 | 3 | 4 | Seer + Doctor + Witch + Hunter | Thief + Piper |
| 15-20 | 4 | 5 | Seer + Doctor + Witch + Hunter + Bodyguard | Thief + Cupid + Piper |

> 说明：本项目不提供自动生成 roleCounts 的算法，角色数量需由配置手动指定。

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
  // Serial Killer: 独自存活（或满足其单独胜利条件）

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

- 同时保护/治疗的判定统一按 **10.4 保护限制规则** 执行
- 默认：保护不叠加，治疗仅在目标“即将死亡”时生效且不转移目标

### 10.3 猎人开枪规则

- 猎人被狼人杀死：可以开枪
- 猎人被投票处决：可以开枪
- 猎人被女巫毒死：可配置是否能开枪 (默认: 不能)

### 10.4 保护限制规则

> 本节定义 **Doctor / Bodyguard / Guardian Angel（常见版）/ Witch（治疗）**  
> 与 **Werewolf / Vigilante / Serial Killer 等击杀类技能** 的**统一交互与限制规则**。

---

#### 10.4.1 保护类型分类（用于判定）

- **阻断型保护（Preventive Protection）**
  - Doctor
  - Guardian Angel（常见版）
- **拦截型保护（Interceptive Protection）**
  - Bodyguard
- **治疗型保护（Healing Protection）**
  - Witch（治疗药水）
- **免疫型保护（Immunity Protection）**
  - *本规则未启用（Guardian Angel 非免疫版）*

---

#### 10.4.2 击杀类型分类（用于判定）

- **普通击杀（Kill）**
  - Werewolf
  - Vigilante
  - Serial Killer（默认）
- **毒杀 / 效果杀（Poison / Effect）**
  - Witch（毒药）
  - 其他标记为 *Poison* 的技能

---

#### 10.4.3 基本限制原则（全局）

- 每个夜晚：
  - 每个**保护技能最多生效一次**
  - 每个**击杀技能视为一次独立致死事件**
- **保护不叠加次数**
  - 多个保护 ≠ 多次免死
- **除非明确声明为“免疫”**
  - 否则所有保护均为 *一次性*

---

#### 10.4.4 Bodyguard（拦截型）规则

- Bodyguard 目标被 **普通击杀** 时：
  - Bodyguard **拦截第一个到达的击杀**
  - 拦截后：
    - Bodyguard 成为新的受害者
    - 原目标不再处于死亡状态
- Bodyguard：
  - 每夜 **只能拦截一次**
  - **不能拦截毒杀**
- 若 Bodyguard 被拦截击杀：
  - 视为一次普通死亡事件

---

#### 10.4.5 Doctor / Guardian Angel（常见版）（阻断型）规则

- Doctor / Guardian Angel：
  - **阻止一次普通击杀导致的死亡**
- 生效对象：
  - 判定阶段中 **当前即将死亡的玩家**
- 限制：
  - 每夜 **只能阻止一次死亡**
  - **不能阻止毒杀（默认）**
- 若同夜发生多次击杀：
  - 仅阻止其中 **一次**

---

#### 10.4.6 Witch（治疗药水）规则

- Witch 治疗：
  - **阻止一次死亡事件**
  - 不区分击杀来源（普通击杀 / 被拦截后的死亡）
- 治疗目标：
  - **仅限 Witch 选择的原始目标**
- 限制：
  - 若目标当夜未处于死亡状态 → 治疗失效
  - 治疗 **不转移目标**
- Witch 治疗 ≠ Doctor：
  - 不阻止攻击
  - 仅在“即将死亡”时生效

---

#### 10.4.7 多重保护与多重击杀的统一处理规则

- 处理顺序（推荐）：
  1. **拦截（Bodyguard）**
  2. **阻断（Doctor / Guardian Angel）**
  3. **治疗（Witch heal）**
  4. **结算剩余击杀**
- 若同一玩家同夜遭受 ≥2 次普通击杀：
  - Bodyguard 最多拦截 1 次
  - Doctor / GA 最多阻止 1 次
  - Witch 最多治疗 1 次
  - **仍可能死亡**
- 保护不产生“连锁保护”

---

#### 10.4.8 毒杀的特殊规则

- Witch 毒药：
  - **绕过所有保护**
    - Doctor
    - Bodyguard
    - Guardian Angel
    - Witch 治疗（除非规则明确允许解毒）
- 仅以下情况可阻止毒杀：
  - Witch 被 roleblock
  - 特殊“解毒”规则明确声明

---

#### 10.4.9 示例（标准判定）

- **示例 1：单次普通击杀 + Doctor**
  - 情况：
    - A 被 Werewolf 击杀
    - Doctor 保护 A
  - 判定：
    - Doctor 阻止该次击杀
  - 结果：
    - A 活

---

- **示例 2：单次普通击杀 + Bodyguard**
  - 情况：
    - A 被 Werewolf 击杀
    - Bodyguard 保护 A
  - 判定：
    - Bodyguard 拦截击杀
    - Bodyguard 成为受害者
  - 结果：
    - A 活
    - Bodyguard 死

---

- **示例 3：单次普通击杀 + Bodyguard + Doctor**
  - 情况：
    - A 被 Werewolf 击杀
    - Bodyguard 保护 A
    - Doctor 保护 A
  - 判定：
    - Bodyguard 拦截击杀
    - Doctor 阻止 Bodyguard 的死亡
  - 结果：
    - A 活
    - Bodyguard 活

---

- **示例 4：单次普通击杀 + Bodyguard + Witch（治疗）**
  - 情况：
    - A 被 Werewolf 击杀
    - Bodyguard 保护 A
    - Witch 对 A 使用治疗
  - 判定：
    - Bodyguard 拦截击杀
    - A 不再处于死亡状态
    - Witch 治疗目标 A，但 A 未死亡 → 治疗失效
  - 结果：
    - A 活
    - Bodyguard 死

---

- **示例 5：单次普通击杀 + Doctor + Witch（治疗）**
  - 情况：
    - A 被 Vigilante 击杀
    - Doctor 保护 A
    - Witch 对 A 使用治疗
  - 判定：
    - Doctor 阻止死亡
    - Witch 治疗判定时 A 未死亡 → 治疗失效
  - 结果：
    - A 活

---

- **示例 6：双重普通击杀 + Doctor**
  - 情况：
    - A 被 Werewolf + Serial Killer 同夜击杀
    - Doctor 保护 A
  - 判定：
    - Doctor 阻止其中一次击杀
    - 另一击杀仍然生效
  - 结果：
    - A 死

---

- **示例 7：双重普通击杀 + Bodyguard**
  - 情况：
    - A 被 Werewolf + Serial Killer 同夜击杀
    - Bodyguard 保护 A
  - 判定：
    - Bodyguard 拦截第一次击杀
    - 第二次击杀直接命中 A
  - 结果：
    - A 死
    - Bodyguard 死

---

- **示例 8：双重普通击杀 + Bodyguard + Doctor**
  - 情况：
    - A 被 Werewolf + Serial Killer 同夜击杀
    - Bodyguard 保护 A
    - Doctor 保护 A
  - 判定：
    - 第一次击杀 → Bodyguard 拦截
    - Doctor 阻止 Bodyguard 的死亡
    - 第二次击杀 → 无剩余保护 → 命中 A
  - 结果：
    - A 死
    - Bodyguard 活

---

- **示例 9：双重普通击杀 + Bodyguard + Witch（治疗）**
  - 情况：
    - A 被 Werewolf + Vigilante 同夜击杀
    - Bodyguard 保护 A
    - Witch 对 A 使用治疗
  - 判定：
    - 第一次击杀 → Bodyguard 拦截 → Bodyguard 死亡
    - 第二次击杀 → 命中 A → A 处于死亡状态
    - Witch 治疗阻止 A 的死亡
  - 结果：
    - A 活
    - Bodyguard 死

---

- **示例 10：毒杀 + 任意保护**
  - 情况：
    - A 被 Witch 使用毒药
    - Doctor / Bodyguard / Guardian Angel / Witch（治疗）任意存在
  - 判定：
    - 毒杀绕过所有保护
  - 结果：
    - A 死

---

- **示例 11：毒杀 + Roleblock Witch**
  - 情况：
    - Witch 计划对 A 使用毒药
    - Witch 被 Roleblock
  - 判定：
    - 毒杀未发生
  - 结果：
    - A 活

---

- **示例 12：Guardian Angel（常见版）与 Doctor 同时保护**
  - 情况：
    - A 被 Werewolf 击杀
    - Guardian Angel（常见版）保护 A
    - Doctor 保护 A
  - 判定：
    - 任意一个阻断死亡
    - 另一保护失效
  - 结果：
    - A 活

---

#### 10.4.10 实现建议（给 AI / 引擎）

- 将每个夜晚建模为：
  - `kill_events[]`
  - `protection_events[]`
- 每个 protection：
  - `max_effect = 1`
- 判定时：
  - 不允许 protection stack
  - 不允许 heal 转移目标
- 所有例外必须 **显式声明**

### 10.5 遗言规则

- 遗言名额选项（`lastWordsMode`）：
  - `none`：无人有遗言
  - `all`：所有死亡玩家都有遗言
  - `limit_by_initial_wolves`（默认）：遗言总名额 = 初始狼人数量
- 遗言适用范围（`lastWordsScope`）：
  - `day_only`（默认）：仅白天处决者有遗言
  - `day_and_night`：白天处决者与夜晚受害者均可获得遗言
- 遗言顺序（`lastWordsOrder`）：
  - `seating_order`（默认）：符合遗言条件玩家中随机一人先发言，随后按座位顺时针
  - `death_resolution`：按死亡结算顺序发言
- 当同一时段有多名玩家符合遗言条件但名额不足时，随机选取获得遗言的玩家

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
  leaderEnabled: true,             // 是否启用 Leader 机制
  lastWordsMode: 'limit_by_initial_wolves', // 遗言名额规则
  protectAgainstPoison: false,     // 保护是否能抵消女巫毒杀
  protectAgainstVigilante: true,   // 保护是否能抵消猎人夜杀

  // 女巫配置
  witchCanSaveSelf: true,          // 女巫是否可以自救
  witchSaveFirstNightOnly: false,  // 女巫救人仅首夜有效

  // 时间配置 (秒)
  nightActionTime: 30,             // 夜间行动时间
  discussionTime: 300,             // 白天讨论时间
  voteTime: 30,                    // 投票时间
  lastWordsTime: 30,               // 遗言时间
  lastWordsScope: 'day_only',      // 遗言适用范围
  lastWordsOrder: 'seating_order', // 遗言顺序
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
| `dayVoteMajority` | boolean | true | 是否要求得票严格大于弃票数才可处决 |
| `leaderEnabled` | boolean | true | 是否启用 Leader 机制 |
| `lastWordsMode` | string | limit_by_initial_wolves | 遗言名额规则 (none/all/limit_by_initial_wolves) |
| `witchCanSaveSelf` | boolean | true | 女巫是否可以自救 |
| `lastWordsScope` | string | day_only | 遗言适用范围 (day_only/day_and_night) |
| `lastWordsOrder` | string | seating_order | 遗言顺序 (seating_order/death_resolution) |
| `protectAgainstPoison` | boolean | false | 保护是否能抵消女巫毒杀 |
| `protectAgainstVigilante` | boolean | true | 保护是否能抵消猎人夜杀 |

---

## 13. 参考资料

- Mafia/Werewolf 经典规则 (日夜流程与胜利条件)
- Werewolves of Miller's Hollow 角色设定 (Seer/Hunter/Cupid/Witch)
- 各类变体角色能力参考 (Doctor/Guardian Angel/Sheriff/Detective 等)
