# 警长机制 (Captain Mechanism)

## 1. 机制概述

| 属性 | 值 |
|------|-----|
| **机制 ID** | `captain` |
| **中文名称** | 警长 / 队长 |
| **英文名称** | Captain / Sheriff |
| **性质** | 公共头衔（非角色身份） |
| **阵营** | 无（继承持有者自身阵营） |
| **产生时机** | 第一天白天（第一个夜晚结束后） |
| **核心能力** | 白天投票权重加成 |
| **死亡处理** | 移交警徽或撕警徽 |

**关键原则**：警长是一个**附加在玩家身上的头衔**，不改变持有者的角色身份、阵营或技能。任何阵营、任何身份的玩家都可以成为警长。

---

## 2. 核心规则

### 2.1 投票权重加成

警长在白天公投（`DAY_VOTE`）时拥有额外投票权重。

| 配置项 | 投票权重 | 说明 |
|--------|----------|------|
| `captainVoteWeight = 1.5` | 1.5 票 | **标准规则**（推荐默认） |
| `captainVoteWeight = 2` | 2 票 | 强势规则 |

**权重生效范围**：
- **生效**：白天处决投票（`DAY_VOTE`），包括二次投票
- **不生效**：警长竞选投票（`CAPTAIN_VOTE`）

**计算逻辑**：
```javascript
// 伪代码：计算白天投票票数时考虑警长权重
function calculateVoteResult(votes, state) {
  const voteCounts = {};
  for (const [voterId, targetId] of Object.entries(votes)) {
    if (targetId === null) continue; // 弃票不计
    const weight = (voterId === state.captainPlayerId) ? state.captainVoteWeight : 1;
    voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
  }
  return voteCounts;
}
```

### 2.2 警长头衔的公开性

- 警长身份**全场公开**，所有玩家可见 `captainPlayerId`
- 警长持有者的**角色身份不因此暴露**

### 2.3 警长与投票权的关系

- 警长加成是乘数，必须有基础投票权才生效
- 若警长因其他机制失去投票权（如白痴翻牌后），则**权重加成无效**（0 × 1.5 = 0）

---

## 3. 竞选流程

警长竞选在**第一天白天**、夜间公告结束后进行。竞选完成后进入正常讨论阶段。

### 3.1 阶段流程

```
NIGHT → DAY_ANNOUNCE → CAPTAIN_ELECTION → DAY_DISCUSSION → DAY_VOTE → ...
                       ↑ 仅第一天 (day === 1)
```

竞选由以下子阶段组成：

```
CAPTAIN_REGISTER → CAPTAIN_SPEECH → CAPTAIN_VOTE → [CAPTAIN_RUNOFF_SPEECH → CAPTAIN_RUNOFF_VOTE] → 结束
```

### 3.2 上警阶段 (`CAPTAIN_REGISTER`)

1. 所有存活玩家选择是否参选：
   - 发送 `CAPTAIN_REGISTER`（上警）
   - 不操作或发送 `CAPTAIN_WITHDRAW`（不上警）
2. 上警阶段有**时间限制**（配置项 `captainRegisterTime`），超时未操作视为不参选
3. 上警人数记录到 `captainCandidates: string[]`

**特殊情况**：
- 若无人上警：**警长空缺**，直接进入 `DAY_DISCUSSION`
- 若仅 1 人上警：该玩家**自动当选**，跳过发言和投票

### 3.3 竞选发言阶段 (`CAPTAIN_SPEECH`)

1. 所有候选人（`captainCandidates`）依次发言
2. 发言顺序：按座位顺时针顺序
3. 发言完成后提交 `PHASE_ADVANCE` 进入下一位
4. **退水机制**：候选人可在发言阶段发送 `CAPTAIN_WITHDRAW` 退出竞选
   - 退出后从 `captainCandidates` 移除
   - 若退水后仅剩 1 人：该玩家自动当选
   - 若退水后无人剩余：警长空缺

### 3.4 竞选投票阶段 (`CAPTAIN_VOTE`)

1. **所有存活玩家**（包括候选人自己）对候选人投票
2. 每人一票（无权重加成），可弃票
3. 投票方式：顺序投票，按座位顺时针
4. 得票最高者当选警长

### 3.5 平票处理

若最高票出现平票：

1. **平票候选人进行二次发言**（`CAPTAIN_RUNOFF_SPEECH`）
2. **全体玩家对平票候选人进行二次投票**（`CAPTAIN_RUNOFF_VOTE`）
3. 二次投票仍平票时，按配置 `captainTieBreaker` 决定：

| `captainTieBreaker` | 行为 |
|---------------------|------|
| `"none"` | 警长空缺（**推荐默认**） |
| `"random"` | 平票者中随机选一名当选 |

### 3.6 竞选结果

- 当选者：`captainPlayerId = winnerId`，广播 `CAPTAIN_ELECTED` 事件
- 空缺：`captainPlayerId = null`，本局无警长

---

## 4. 警长死亡处理

当警长出局时（无论死亡原因），进入**警徽移交阶段**。

### 4.1 触发条件

警长（`captainPlayerId` 非空且指向存活玩家）的持有者死亡时触发。死亡来源包括：

| 死亡方式 | 是否触发移交 |
|----------|-------------|
| 白天被投票处决 | ✅ 触发 |
| 夜晚被狼人击杀 | ✅ 触发 |
| 夜晚被女巫毒杀 | ✅ 触发 |
| 被猎人/义警射杀 | ✅ 触发 |
| 情侣殉情 | ✅ 触发 |

### 4.2 移交流程

```
警长死亡 → 死亡技能结算（猎人开枪等） → CAPTAIN_TRANSFER 阶段 → 移交/撕徽 → 继续游戏
```

1. **先结算死亡触发技能**（猎人开枪、连锁死亡等）
2. 进入 `CAPTAIN_TRANSFER` 子阶段
3. 死亡的警长玩家选择：
   - **移交**：发送 `CAPTAIN_TRANSFER { targetId }` 指定一名**存活玩家**继承警长
   - **撕警徽**：发送 `CAPTAIN_TEAR` 不指定继承人，警长身份消失

### 4.3 移交规则

- 只能移交给**存活**玩家
- 不能移交给自己（已死亡）
- 移交后新警长立即生效
- 撕徽后 `captainPlayerId = null`，本局不再有警长
- 有时间限制（配置项 `captainTransferTime`），超时视为撕警徽

### 4.4 多人死亡时的移交顺序

夜晚可能有多人死亡。若警长在其中：

1. 公布全部夜间死亡
2. 按死亡结算顺序处理触发技能（猎人开枪等）
3. **最后**处理警长移交（所有死亡和连锁结算完毕后）
4. 这确保警长在选择继承人时，知道最终的存活名单

---

## 5. 可选规则设定

### 5.1 警长投票权重 (`captainVoteWeight`)

| 配置值 | 行为 |
|--------|------|
| `1.5` | 标准权重（**推荐默认**） |
| `2` | 强势权重 |

### 5.2 竞选平票处理 (`captainTieBreaker`)

| 配置值 | 行为 |
|--------|------|
| `"none"` | 平票则警长空缺（**推荐默认**） |
| `"random"` | 平票则随机选一人当选 |

### 5.3 是否启用警长机制 (`captainEnabled`)

| 配置值 | 行为 |
|--------|------|
| `true` | 启用警长竞选和权重（**推荐默认**） |
| `false` | 禁用警长机制，无竞选阶段 |

### 5.4 竞选上警时间 (`captainRegisterTime`)

- 类型：`number`（秒）
- 默认值：`30`
- 说明：上警阶段每人的选择时间

### 5.5 警徽移交时间 (`captainTransferTime`)

- 类型：`number`（秒）
- 默认值：`30`
- 说明：警长死亡后选择继承人的时间，超时视为撕徽

---

## 6. 游戏阶段集成

### 6.1 新增阶段

在 `PHASES` 枚举中新增以下子阶段：

```javascript
// game-phases.js PHASES 新增
CAPTAIN_REGISTER: 'captain_register',     // 上警/退水阶段
CAPTAIN_SPEECH: 'captain_speech',         // 候选人发言阶段
CAPTAIN_VOTE: 'captain_vote',             // 竞选投票阶段
CAPTAIN_RUNOFF_SPEECH: 'captain_runoff_speech', // 平票二次发言
CAPTAIN_RUNOFF_VOTE: 'captain_runoff_vote',     // 平票二次投票
CAPTAIN_TRANSFER: 'captain_transfer',     // 警徽移交阶段
```

### 6.2 阶段转换

**第一天白天**（仅当 `captainEnabled = true` 且 `day === 1`）：

```
DAY_ANNOUNCE → CAPTAIN_REGISTER → CAPTAIN_SPEECH → CAPTAIN_VOTE
  → [CAPTAIN_RUNOFF_SPEECH → CAPTAIN_RUNOFF_VOTE] → DAY_DISCUSSION → DAY_VOTE
```

**后续白天**（day > 1）正常流程不变：

```
DAY_ANNOUNCE → DAY_DISCUSSION → DAY_VOTE
```

**警长死亡时**（嵌入死亡结算流程）：

```
死亡结算 → 猎人开枪/连锁处理 → CAPTAIN_TRANSFER → 继续（遗言/下一阶段）
```

---

## 7. 与现有角色/机制的交互

### 7.1 警长 vs 白痴 (Idiot)

| 场景 | 结果 |
|------|------|
| 白痴是警长，被投票处决，首次触发翻牌免死 | 白痴不死亡，**保留警长身份**（不触发移交） |
| 白痴警长翻牌后失去投票权 | 警长权重加成无效（失去投票权 × 1.5 = 0） |
| 白痴警长后续再被处决（第二次无免死） | 白痴死亡，触发正常的警徽移交 |

### 7.2 警长 vs 猎人 (Hunter)

| 场景 | 结果 |
|------|------|
| 猎人是警长，被狼人击杀 | 先结算猎人开枪，再进行警徽移交 |
| 猎人是警长，被女巫毒杀（不可开枪规则下） | 不触发开枪，直接进行警徽移交 |
| 猎人开枪射杀的目标恰好是警长 | 被射杀的警长也触发移交流程 |

**结算顺序**：猎人开枪 → 开枪连锁结算 → 警长移交

### 7.3 警长 vs 义警 (Vigilante)

| 场景 | 结果 |
|------|------|
| 义警射杀警长 | 警长死亡，触发移交 |
| 义警是警长且误杀（射杀好人），导致自身下一夜自杀 | 义警死亡时触发警徽移交 |

### 7.4 警长 vs 情侣 (Cupid/Lovers)

| 场景 | 结果 |
|------|------|
| 警长是情侣之一，另一方死亡 → 警长殉情 | 警长死亡，触发移交（殉情结算完毕后进行，可选列表为最终存活者） |

### 7.5 警长 vs 预言家 (Seer)

- **无直接机制交互**
- 预言家查验警长：结果为警长持有者的**实际阵营**（非"警长"）

### 7.6 警长 vs 狼人 (Werewolf)

- **无直接机制交互**
- 狼人可以竞选并当选警长
- 狼人击杀警长后正常触发移交流程

### 7.7 警长 vs 守卫/医生 (Bodyguard/Doctor)

| 场景 | 结果 |
|------|------|
| 守卫保护警长，狼人击杀警长 | 警长存活（保护成功），不触发移交 |
| 女巫毒杀警长，守卫保护警长 | 警长死亡（守卫无法阻止毒药），触发移交 |

### 7.8 警长 vs 小丑 (Jester)

| 场景 | 结果 |
|------|------|
| 小丑是警长，被投票处决 | 小丑胜利条件触发，同时进行警徽移交 |
| 小丑投票处决触发游戏结束 | 游戏结束，无需移交 |

### 7.9 警长 vs 魔笛手 (Piper)

- **无直接机制交互**
- 警长可以被魅惑，不影响警长身份

---

## 8. Edge Cases（易错情境与正确结算）

### 8.1 连锁死亡中的警长移交时机

**场景**：警长（猎人）被杀 → 猎人开枪射杀玩家 C → 玩家 C 是情侣，情侣 D 殉情。

**结算顺序**：
1. 警长（猎人）死亡
2. 猎人开枪 → 玩家 C 死亡
3. 情侣殉情 → 玩家 D 死亡
4. **所有连锁结算完成后** → 警长选择继承人（从最终存活名单中选）

**关键**：由于移交在所有死亡结算之后进行，警长看到的是最终存活名单，不可能选到已死亡的玩家。验证逻辑仅需检查 `target.alive === true`。

### 8.2 白痴警长翻牌后的投票权重

**场景**：白痴是警长，被投票处决触发翻牌免死，后续投票中白痴仍是警长。

**结果**：
- 白痴失去投票权（`canVote = false`）
- 权重加成名义存在但实际无效（无投票权则不参与投票计算）
- 白痴仍是警长持有者（可在死亡时移交）

### 8.3 竞选中所有候选人退水

**场景**：3 人上警，发言阶段全部退水。

**结果**：警长空缺（`captainPlayerId = null`），直接进入 `DAY_DISCUSSION`

### 8.4 竞选投票全部弃票

**场景**：所有投票者均弃票，无人得票。

**结果**：警长空缺，直接进入 `DAY_DISCUSSION`

### 8.5 警长白天被处决时的移交时机

**场景**：警长在白天被投票处决。

**结算顺序**：
1. 投票结算 → 警长被处决
2. 检查白痴翻牌等特殊效果
3. 若确认死亡 → 死亡技能触发（猎人开枪等）
4. 连锁死亡结算完毕
5. 最后 → 警长移交阶段
6. 移交/撕徽完成 → 遗言阶段

### 8.6 仅剩一人存活且为警长

- 游戏已按胜负条件结束，无需处理警长移交

### 8.7 第一天无人死亡跳过公告直接竞选

**场景**：第一夜无人死亡。

**结果**：`DAY_ANNOUNCE`（宣布无人死亡）→ `CAPTAIN_REGISTER`（正常竞选），流程不变

---

## 9. 游戏状态字段

```javascript
// 新增到 game state
{
  // 警长机制状态
  captainPlayerId: null,          // 当前警长的 playerId，null 表示无警长
  captainVoteWeight: 1.5,         // 警长投票权重（从配置读取）

  // 竞选相关（仅竞选阶段使用）
  captainCandidates: [],          // 上警候选人 playerId 列表
  captainSpeakerQueue: [],        // 竞选发言队列
  captainCurrentSpeaker: null,    // 当前发言候选人
  captainVotes: {},               // 竞选投票 { voterId: candidateId }
  captainVoterQueue: [],          // 竞选投票顺序队列
  captainCurrentVoter: null,      // 当前投票者
  captainRunoffCandidates: [],    // 平票候选人（二次投票用）

  // 移交相关（仅移交阶段使用）
  captainTransferPending: false,  // 是否处于移交等待中
}
```

---

## 10. 操作类型定义

### 10.1 新增操作类型

```javascript
const CAPTAIN_ACTION_TYPES = {
  CAPTAIN_REGISTER: 'CAPTAIN_REGISTER',         // 上警
  CAPTAIN_WITHDRAW: 'CAPTAIN_WITHDRAW',         // 退水
  CAPTAIN_VOTE: 'CAPTAIN_VOTE',                 // 竞选投票
  CAPTAIN_SKIP_VOTE: 'CAPTAIN_SKIP_VOTE',       // 竞选弃票
  CAPTAIN_TRANSFER: 'CAPTAIN_TRANSFER',         // 移交警徽
  CAPTAIN_TEAR: 'CAPTAIN_TEAR',                 // 撕警徽
};
```

### 10.2 操作数据结构

```javascript
// 上警
{ type: 'CAPTAIN_REGISTER', actorId, phase: 'day' }

// 退水
{ type: 'CAPTAIN_WITHDRAW', actorId, phase: 'day' }

// 竞选投票（投给某候选人）
{ type: 'CAPTAIN_VOTE', actorId, targetId, phase: 'day' }

// 竞选弃票
{ type: 'CAPTAIN_SKIP_VOTE', actorId, phase: 'day' }

// 移交警徽（指定继承人）
{ type: 'CAPTAIN_TRANSFER', actorId, targetId, phase: 'day' }  // actorId = 死亡的警长

// 撕警徽
{ type: 'CAPTAIN_TEAR', actorId, phase: 'day' }  // actorId = 死亡的警长
```

---

## 11. 验证逻辑

### 11.1 上警验证

```javascript
function validateCaptainRegister(state, actorId) {
  if (state.phase !== PHASES.CAPTAIN_REGISTER) {
    return { valid: false, error: 'NOT_CAPTAIN_REGISTER_PHASE' };
  }
  const player = state.players.find(p => p.id === actorId);
  if (!player || !player.alive) {
    return { valid: false, error: 'PLAYER_NOT_ALIVE' };
  }
  if (state.captainCandidates.includes(actorId)) {
    return { valid: false, error: 'ALREADY_REGISTERED' };
  }
  return { valid: true };
}
```

### 11.2 退水验证

```javascript
function validateCaptainWithdraw(state, actorId) {
  if (state.phase !== PHASES.CAPTAIN_REGISTER &&
      state.phase !== PHASES.CAPTAIN_SPEECH) {
    return { valid: false, error: 'NOT_CAPTAIN_ELECTION_PHASE' };
  }
  if (!state.captainCandidates.includes(actorId)) {
    return { valid: false, error: 'NOT_A_CANDIDATE' };
  }
  return { valid: true };
}
```

### 11.3 竞选投票验证

```javascript
function validateCaptainVote(state, actorId, targetId) {
  if (state.phase !== PHASES.CAPTAIN_VOTE &&
      state.phase !== PHASES.CAPTAIN_RUNOFF_VOTE) {
    return { valid: false, error: 'NOT_CAPTAIN_VOTE_PHASE' };
  }
  const voter = state.players.find(p => p.id === actorId);
  if (!voter || !voter.alive) {
    return { valid: false, error: 'PLAYER_NOT_ALIVE' };
  }
  if (actorId !== state.captainCurrentVoter) {
    return { valid: false, error: 'NOT_YOUR_TURN_TO_VOTE' };
  }
  const candidates = state.phase === PHASES.CAPTAIN_RUNOFF_VOTE
    ? state.captainRunoffCandidates
    : state.captainCandidates;
  if (targetId !== null && !candidates.includes(targetId)) {
    return { valid: false, error: 'TARGET_NOT_A_CANDIDATE' };
  }
  return { valid: true };
}
```

### 11.4 移交验证

```javascript
function validateCaptainTransfer(state, actorId, targetId) {
  if (state.phase !== PHASES.CAPTAIN_TRANSFER) {
    return { valid: false, error: 'NOT_CAPTAIN_TRANSFER_PHASE' };
  }
  if (actorId !== state.captainPlayerId) {
    return { valid: false, error: 'NOT_THE_CAPTAIN' };
  }
  const target = state.players.find(p => p.id === targetId);
  if (!target || !target.alive) {
    return { valid: false, error: 'CAPTAIN_TRANSFER_TARGET_DEAD' };
  }
  return { valid: true };
}
```

---

## 12. 测试场景清单

### 12.1 竞选流程测试（8 个用例）

1. ✅ 正常竞选：多人上警 → 发言 → 投票 → 最高票当选
2. ✅ 仅一人上警 → 自动当选，跳过发言和投票
3. ✅ 无人上警 → 警长空缺
4. ✅ 竞选投票平票 → 二次发言 → 二次投票 → 最高票当选
5. ✅ 竞选二次投票仍平票 → `captainTieBreaker = "none"` → 警长空缺
6. ✅ 竞选二次投票仍平票 → `captainTieBreaker = "random"` → 随机当选
7. ✅ 退水后仅剩一人 → 自动当选
8. ✅ 所有候选人退水 → 警长空缺

### 12.2 投票权重测试（6 个用例）

9. ✅ 警长白天投票权重为 1.5 倍（标准规则）
10. ✅ 警长白天投票权重为 2 倍（强势规则）
11. ✅ 警长权重导致原本平票变为一方获胜
12. ✅ 警长弃票时权重不计算
13. ✅ 警长竞选投票时无权重加成（一人一票）
14. ✅ 无警长时所有玩家投票权重均为 1

### 12.3 警徽移交测试（6 个用例）

15. ✅ 警长白天被处决 → 移交给存活玩家 → 新警长生效
16. ✅ 警长夜晚被击杀 → 移交给存活玩家 → 新警长生效
17. ✅ 警长选择撕警徽 → 警长身份消失
18. ✅ 移交超时 → 视为撕徽
19. ✅ 移交目标必须存活（选择死亡玩家 → 验证失败）
20. ✅ 移交后新警长在后续投票中享有权重

### 12.4 角色交互测试（8 个用例）

21. ✅ 白痴警长被处决 → 翻牌免死 → 保留警长身份，不触发移交
22. ✅ 白痴警长翻牌后投票权重无效（失去投票权 × 1.5 = 0）
23. ✅ 猎人警长被杀 → 先开枪 → 再移交警徽
24. ✅ 猎人开枪射杀警长 → 被射杀的警长触发移交
25. ✅ 情侣中一方是警长 → 另一方死亡 → 警长殉情 → 触发移交
26. ✅ 义警射杀警长 → 警长死亡触发移交
27. ✅ 守卫保护警长成功 → 警长存活，不触发移交
28. ✅ 女巫毒杀警长 → 守卫无法阻止 → 警长死亡触发移交

### 12.5 Edge Cases 测试（7 个用例）

29. ✅ 连锁死亡中的移交时机（猎人开枪 → 情侣殉情 → 最后移交，只能选最终存活者）
30. ✅ 白痴警长翻牌后再次被处决 → 正常死亡并移交
31. ✅ 竞选中候选人在发言阶段退水 → 从队列移除
32. ✅ 竞选投票全部弃票 → 警长空缺
33. ✅ `captainEnabled = false` → 无竞选阶段，直接进入讨论
34. ✅ 第二天及以后不再进行竞选
35. ✅ 第一天无人死亡 → 公告后正常进入竞选

### 12.6 验证错误测试（6 个用例）

36. ✅ 非竞选阶段发送 `CAPTAIN_REGISTER` → 拒绝
37. ✅ 非候选人发送 `CAPTAIN_WITHDRAW` → 拒绝
38. ✅ 非当前投票者发送 `CAPTAIN_VOTE` → 拒绝
39. ✅ 投票给非候选人 → 拒绝
40. ✅ 非警长玩家发送 `CAPTAIN_TRANSFER` → 拒绝
41. ✅ 非移交阶段发送 `CAPTAIN_TRANSFER` → 拒绝

**预计测试用例总数**：41 个

---

## 13. 配置建议

在 `frontend/src/games/werewolf/config.json` 中新增以下配置项：

```json
{
  "rules": {
    "captainEnabled": true,
    "captainVoteWeight": 1.5,
    "captainTieBreaker": "none",
    "captainRegisterTime": 30,
    "captainTransferTime": 30
  },
  "settingsSchema": {
    "captainEnabled": {
      "type": "boolean",
      "label": "启用警长机制",
      "description": "是否在第一天白天进行警长竞选",
      "default": true
    },
    "captainVoteWeight": {
      "type": "select",
      "label": "警长投票权重",
      "description": "警长在白天投票时的票数权重",
      "options": [
        { "value": 1.5, "label": "1.5 票（标准）" },
        { "value": 2, "label": "2 票（强势）" }
      ],
      "default": 1.5
    },
    "captainTieBreaker": {
      "type": "select",
      "label": "竞选平票处理",
      "description": "竞选投票平票后的处理方式",
      "options": [
        { "value": "none", "label": "警长空缺" },
        { "value": "random", "label": "随机选一人当选" }
      ],
      "default": "none"
    }
  }
}
```

---

## 14. 实现检查清单

- [x] 在 `config.json` 的 `rules` 和 `settingsSchema` 中添加 5 个配置项
- [x] 在 `game-phases.js` 的 `PHASES` 中新增 6 个竞选/移交阶段
- [x] 在 `game-phases.js` 中实现竞选流程的阶段转换逻辑
- [x] 在 `game-phases.js` 中实现 `DAY_ANNOUNCE → CAPTAIN_REGISTER` 的条件跳转（仅第一天）
- [x] 在 `game-phases.js` 的死亡结算流程中插入 `CAPTAIN_TRANSFER` 阶段
- [x] 在 `index.js` 的 `ACTION_TYPES` 中新增 6 个操作类型
- [x] 在 `index.js` 的 `processMove` 中处理 6 种竞选/移交操作
- [x] 在 `index.js` 的 `initialize` 中初始化警长状态字段
- [x] 在 `rules.js` 中实现 6 个验证函数（register/withdraw/vote/skipVote/transfer/tear）
- [x] 修改 `rules.js` 的 `calculateVoteResult` 加入警长权重计算
- [x] 修改 `rules.js` 的 `canPlayerVote` 确保白痴警长交互正确
- [x] 在 `ui-panels-day.js` 中新增竞选 UI 面板（上警/发言/投票）
- [x] 在 `ui-panels-day.js` 中新增移交 UI 面板（选择继承人/撕徽按钮）
- [x] 在 `ui.js` 中处理竞选阶段的渲染分发
- [x] 在 `index.test.js` 中添加 37 个测试用例（258 狼人杀测试 / 740 总测试通过）
- [x] 更新 `RULES.md` 添加警长机制描述（5.3.3 节摘要 + 链接至本文档）
- [x] 更新 `getVisibleState()` 暴露警长相关公开状态

---

## 15. 参考资料

- **经典狼人杀规则**：线下面杀常见规则
- **主流线上平台**：狼人杀官方、天天狼人杀
- **相关角色**：白痴（翻牌免死与投票权交互）、猎人（死亡技能与移交顺序）

---

**文档版本**：v2.0
**创建日期**：2026-02-15
**更新日期**：2026-02-22
**状态**：✅ 已实现（37 个专项测试 + 8 个 UI 测试通过）
