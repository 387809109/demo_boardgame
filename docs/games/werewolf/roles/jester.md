# 小丑 (Jester)

## 1. 角色概述

| 属性 | 值 |
|------|-----|
| **角色 ID** | `jester` |
| **中文名称** | 小丑 / 弄臣 |
| **英文名称** | Jester |
| **阵营** | `neutral`（第三方独立阵营） |
| **优先级** | `P1`（进阶角色） |
| **夜晚行动** | 无 |
| **胜利条件** | 在白天被投票处决（`execution`） |
| **核心机制** | 被白天投票处决时立即单独获胜，游戏结束 |

**角色类型判断**：被动能力 + 第三方阵营角色。

---

## 2. 角色能力

### 2.1 核心能力：处决即胜

当小丑在白天投票结算中被处决时：

1. 小丑按常规进入死亡状态（`alive = false`, `deathCause = 'execution'`）。
2. 立即标记小丑胜利。
3. 游戏在该回合结束判定时直接结束，小丑单独获胜。

### 2.2 能力边界

- 仅白天投票处决触发。
- 夜晚死亡（狼刀/毒杀/开枪/殉情）不触发胜利。
- 平票、无人处决不触发胜利。

### 2.3 无主动技能

- 小丑没有夜晚行动，不产生 `NIGHT_*` 行为。
- 白天仍可正常发言、投票。

---

## 3. 行动时机与优先级

### 3.1 夜间阶段

- 无夜间行动，不进入 `nightActionPriority`。
- 不加入 `pendingNightRoles`。

### 3.2 白天投票结算阶段

在 `resolveVotes` 中，当 `result.executed` 存在时：

1. 先按现有规则处理特殊角色（例如白痴首次处决免死）。
2. 若最终被处决目标为小丑，记录小丑获胜标记。
3. 继续完成当次死亡处理。
4. 由 `checkWinConditions` 在同回合末优先判定小丑胜利并结束游戏。

### 3.3 胜利判定优先级

- 小丑胜利判定优先于阵营常规胜利（村民/狼人）与恋人胜利判定。
- 一旦小丑处决胜利成立，本局结果固定为小丑胜利。

---

## 4. 数据结构

### 4.1 游戏状态字段

```javascript
state.jesterWinnerId = null;
// 类型: string | null
// 含义: 若本局已触发小丑处决胜利，记录该小丑玩家 ID
```

### 4.2 结算输出字段（胜利判定结果）

```javascript
{
  ended: true,
  winner: 'jester',
  reason: 'jester_executed',
  winnerPlayerIds: [jesterPlayerId]
}
```

### 4.3 排名计算

当存在 `winnerPlayerIds` 时，按玩家 ID 判断赢家（而不是按 team 字段）：

```javascript
isWinner = winnerPlayerIds.includes(playerId)
```

---

## 5. 验证规则

### 5.1 行动验证

小丑无额外输入验证规则，复用现有投票验证：

- 存活玩家可投票
- 轮到当前投票者
- 不能投自己
- 可弃票

### 5.2 胜利触发验证

在 `resolveVotes` 中，仅当以下条件同时满足时标记小丑胜利：

- `result.executed` 存在
- `state.playerMap[result.executed].roleId === 'jester'`
- 该次处决为真实处决（非白痴翻牌免死分支）

---

## 6. 解析逻辑

### 6.1 白天投票伪代码

```javascript
function resolveVotes(state, helpers) {
  const result = calculateVoteResult(state.votes, state.options);

  if (result.executed) {
    const executedId = result.executed;
    const executed = state.playerMap[executedId];

    // 白痴首次处决免死分支（已有逻辑）
    if (isIdiotFirstReveal(executed)) {
      revealIdiotAndContinue();
      return;
    }

    // 正常处决
    helpers.markPlayerDead(state, executedId, 'execution');
    helpers.processDeathTriggers(state, [executedId], 'execution');

    // 小丑胜利标记
    if (executed.roleId === 'jester') {
      state.jesterWinnerId = executedId;
    }

    transitionOrWaitHunter();
  }
}
```

### 6.2 胜利判定伪代码

```javascript
function checkWinConditions(state) {
  if (state.jesterWinnerId) {
    return {
      ended: true,
      winner: 'jester',
      reason: 'jester_executed',
      winnerPlayerIds: [state.jesterWinnerId]
    };
  }

  // 其余恋人/村民/狼人判定
  ...
}
```

---

## 7. 与其他角色的交互

### 7.1 与狼人

- 狼人夜晚击杀小丑：小丑死亡但不获胜。
- 小丑被白天处决：小丑立即获胜，狼人目标失败。

### 7.2 与女巫

- 女巫毒杀小丑：小丑不获胜。

### 7.3 与猎人

- 猎人开枪击杀小丑：小丑不获胜。

### 7.4 与白痴

- 白痴首次处决免死优先于“处决即胜”语义（因为白痴并未真正被处决死亡）。
- 小丑与白痴为不同角色，不存在同体冲突。

### 7.5 与丘比特（恋人）

- 若小丑是恋人并被处决：
  - 小丑触发胜利。
  - 恋人殉情流程可发生，但不影响小丑胜利结果。

### 7.6 与游戏结束流程

- 小丑胜利为“个人胜利 + 立即结束”。
- 其他阵营不并列获胜。

---

## 8. 边界情况

1. **平票后无人处决**：小丑不胜利。
2. **平票二轮处决小丑**：小丑胜利。
3. **小丑夜晚被击杀后白天不可处决**：小丑不胜利。
4. **小丑被猎人开枪带走**：小丑不胜利。
5. **小丑被女巫毒杀**：小丑不胜利。
6. **小丑被处决同时触发恋人殉情**：小丑仍胜利。
7. **小丑被处决当日有其他常规胜利条件同时满足**：小丑胜利优先。
8. **开启 revealRolesOnDeath=false**：不影响小丑胜利判定。
9. **开启 dayVoteMajority=true 且票数不足**：小丑不胜利。
10. **同局存在多个中立角色（如 piper）**：仅满足小丑处决条件时由小丑获胜。

---

## 9. 配置选项

当前版本不新增配置项，固定采用“处决即胜且游戏结束”。

| 选项 | 默认值 | 说明 |
|------|--------|------|
| （无） | - | 小丑规则固定为被处决立即单独获胜 |

可扩展（暂不实现）：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `jesterEndsGame` | boolean | `true` | 小丑胜利后是否立刻结束游戏 |
| `jesterRevengeKill` | boolean | `false` | 小丑处决胜利后是否带走一名玩家 |
| `jesterNightImmunity` | boolean | `false` | 小丑是否免疫夜晚击杀 |

---

## 10. 测试场景

以下为建议测试清单（共 34 条）。

### 10.1 基础功能（1-10）

1. 小丑被白天处决时游戏结束。
2. 小丑被白天处决时 `winner = 'jester'`。
3. 小丑被白天处决时 `reason = 'jester_executed'`。
4. 小丑被白天处决时赢家仅小丑本人。
5. 小丑被处决时自身 `deathCause = 'execution'`。
6. 小丑被处决后 `state.status = 'ended'`。
7. 小丑处决胜利时 `state.jesterWinnerId` 正确记录。
8. 小丑存活但未被处决时不触发胜利。
9. 小丑夜晚死亡不触发胜利。
10. 小丑白天弃票不影响其胜利触发条件。

### 10.2 投票与流程（11-20）

11. 平票首轮后进入二轮发言，流程正确。
12. 二轮投票处决小丑时触发胜利。
13. 全员弃票无人处决时小丑不胜利。
14. `dayVoteMajority=true` 且未达多数时小丑不胜利。
15. 小丑被正常投票流程处决时不阻塞回合推进。
16. 小丑被处决时即使有 hunterPendingShoot，也应在回合末判定小丑胜利。
17. 小丑非当前投票人时无法越权操作（回归验证）。
18. 小丑可被投票（非免疫目标）。
19. 小丑可参与投票直到死亡。
20. 小丑处决胜利后不会再进入下一夜。

### 10.3 角色交互（21-29）

21. 狼人夜晚击杀小丑，小丑失败。
22. 女巫毒杀小丑，小丑失败。
23. 猎人开枪击杀小丑，小丑失败。
24. 守卫保护小丑躲过狼刀，不触发胜利。
25. 医生保护小丑躲过狼刀，不触发胜利。
26. 小丑与恋人绑定时被处决，小丑胜利。
27. 小丑与恋人绑定时夜死，不触发胜利。
28. 小丑处决胜利时狼人数量已达优势，仍由小丑胜利。
29. 小丑处决胜利时恋人仅存活两人，仍由小丑胜利。

### 10.4 边界与回归（30-34）

30. 小丑胜利后 `rankings` 仅小丑为 rank 1。
31. 小丑胜利后其余玩家均为 rank 2。
32. UI 结束面板能展示“小丑胜利”。
33. 小丑角色名称在 UI 揭示列表显示为“Jester/小丑映射名”。
34. 引入小丑逻辑后原有村民/狼人胜利测试仍通过。

---

## Phase 1 完成检查

- [x] 10 个章节完整
- [x] 边界情况 ≥ 5（已提供 10 个）
- [x] 测试场景 ≥ 30（已提供 34 个）
- [x] 数据结构清晰定义
- [x] 优先级与时机说明清晰
