# 魔笛手 (Piper)

## 1. 角色概述

| 属性 | 值 |
|------|-----|
| **角色 ID** | `piper` |
| **中文名称** | 魔笛手 |
| **英文名称** | Piper |
| **阵营** | `neutral`（第三方独立阵营） |
| **优先级** | `P1`（进阶角色） |
| **夜晚行动** | `NIGHT_PIPER_CHARM` |
| **胜利条件** | 在自己存活时，使“除自己外”的所有存活玩家都处于魅惑状态 |
| **核心定位** | 控制型第三方胜利角色（非击杀） |

**角色类型判断**：主动夜间技能 + 持续状态 + 第三方阵营角色。

---

## 2. 角色能力

### 2.1 核心能力：夜晚魅惑

每个夜晚，魔笛手可以选择若干名目标（默认 2 名）施加魅惑：

- 目标获得 `CHARMED` 状态（持久状态）。
- 魅惑不造成伤害，不改变目标原有角色技能。
- 魅惑仅影响魔笛手胜利判定。

### 2.2 魅惑状态特征

- 一旦被魅惑，状态默认不会自动消失。
- 玩家死亡后不再计入魔笛手胜利条件（仅统计存活玩家）。
- 若魔笛手死亡，魅惑状态可保留在状态数据中，但不再产生胜利效果（默认规则）。

### 2.3 默认能力限制

- 不能魅惑自己（默认 `piperCanCharmSelf = false`）。
- 不能在同一行动中重复选择同一目标。
- 默认只能选择“尚未被魅惑”的玩家（`piperCanRecharm = false`）。

---

## 3. 行动时机与优先级

根据当前配置，魔笛手处于夜间优先级 11：

| 优先级 | 角色 | 操作 |
|--------|------|------|
| 10 | Witch | 救人/毒杀 |
| **11** | **Piper** | **魅惑** |
| 12 | Oracle | 标记 |

### 3.1 设计理由

1. 魅惑不属于击杀/保护，通常应在主要生死事件后结算。
2. 放在女巫之后，可确保“当夜死亡玩家”不会被错误计入新魅惑胜利判定。
3. 便于在夜间末尾统一检查“全体存活玩家是否已被魅惑”。

### 3.2 胜利判定触发时机

建议在夜间结算完成后立即检查魔笛手胜利：

1. 处理夜间死亡（狼刀、毒药、义警等）
2. 应用当夜魅惑结果
3. 检查：若魔笛手存活且其余存活玩家均已魅惑 -> 立即结束游戏，`winner = 'piper'`

---

## 4. 数据结构

### 4.1 `state.roleStates` 建议新增字段

```javascript
roleStates: {
  // ...existing fields
  piperCharmedIds: [],      // 已被魅惑玩家ID列表
  piperLastCharmedIds: []   // 上一夜新增魅惑目标（用于UI提示）
}
```

### 4.2 行动数据格式

```javascript
{
  actionType: 'NIGHT_PIPER_CHARM',
  actionData: {
    targetIds: ['playerA', 'playerB']
  }
}
```

说明：

- `targetIds` 长度由 `piperCharmTargetsPerNight` 决定（默认 2）。
- 可选扩展：支持 1~N 动态长度，当前 P1 建议固定 2（不足时允许少选，见配置）。

### 4.3 可见信息建议

- `piper` 自己可见：`piperCharmedIds`、`piperLastCharmedIds`。
- 非 piper 玩家默认不可见魅惑名单（除非配置开启公开）。

---

## 5. 验证规则

在 `validateNightAction` 中添加 `NIGHT_PIPER_CHARM` 分支，规则如下：

1. 行动者必须是 `piper` 且存活。
2. 必须在夜间且轮到其行动步骤。
3. `targetIds` 必须为数组，长度满足配置要求。
4. 每个目标必须存在且存活。
5. 目标不可重复。
6. 默认不能包含自己（`piperCanCharmSelf = false`）。
7. 默认不能选择已魅惑玩家（`piperCanRecharm = false`）。

建议错误文案：

- `必须选择目标玩家`
- `目标玩家不存在`
- `目标玩家已死亡`
- `不能重复选择同一名玩家`
- `魔笛手不能魅惑自己`
- `目标已被魅惑`

---

## 6. 解析逻辑

### 6.1 行动收集（`_collectNightAction`）

收到 `NIGHT_PIPER_CHARM` 时：

1. 写入 `state.nightActions[playerId]`。
2. 从 `pendingNightRoles` 移除该玩家。

### 6.2 夜晚结算（`resolveNightActions` 或 `resolveNight` 后置步骤）

建议流程：

1. 在夜晚死亡结算后，收集 `NIGHT_PIPER_CHARM` 行动。
2. 过滤出仍存活且未被魅惑（按配置）的目标。
3. 合并进入 `roleStates.piperCharmedIds`（去重）。
4. 记录 `roleStates.piperLastCharmedIds`（仅本夜新增）。
5. 追加公告事件（可选）：`piper_charm_applied`（仅对 piper 可见）。

### 6.3 胜利条件扩展（`checkWinConditions`）

建议新增判定：

```javascript
if (alivePiperExists) {
  const othersAlive = alivePlayers.filter(p => p.roleId !== 'piper');
  const allCharmed = othersAlive.every(p => piperCharmedIds.includes(p.id));
  if (allCharmed) {
    return { ended: true, winner: 'piper', reason: 'all_alive_charmed' };
  }
}
```

### 6.4 与当前胜利判定顺序的关系

建议顺序（避免被基础阵营判定覆盖）：

1. 特殊立即胜利（如 jester）
2. **piper 胜利**
3. lovers 胜利
4. village / werewolf 基础胜利

---

## 7. 与其他角色的交互

### 7.1 与狼人

- 狼人可正常击杀魔笛手。
- 魔笛手死亡后不再触发其胜利条件（默认规则）。

### 7.2 与守卫/医生/女巫

- 魅惑是状态施加，不是攻击。
- 默认不受守卫、医生、女巫解药影响。

### 7.3 与丘比特（恋人）

- 恋人需要分别被魅惑，不存在“连带魅惑”。
- 若恋人一方死亡，另一方殉情后均不再计入存活魅惑判定。

### 7.4 与义警

- 义警可射杀魔笛手，阻止其继续魅惑。
- 若义警射杀已被魅惑玩家，不影响已记录魅惑集合，但该玩家死亡后不再参与胜利统计。

### 7.5 与白痴/小丑

- 白痴/小丑均可被魅惑，魅惑不改变其被动胜利/免死机制。
- 小丑被白天处决仍可按小丑规则立即获胜，优先于后续夜间魅惑逻辑。

---

## 8. 边界情况

1. **目标不足 2 人**：当可选未魅惑目标不足时，是否允许少选（建议允许，避免死锁）。
2. **同夜目标死亡**：被当夜杀死的目标不计入最终存活魅惑统计。
3. **魔笛手死亡当夜同时达成全魅惑**：默认不判定 piper 胜利（需存活条件）。
4. **重复魅惑提交**：夜间重复提交应按现有规则拒绝。
5. **多魔笛手扩展局**：当前 P1 默认单魔笛手，若扩展需将 charm 状态按施法者分桶。
6. **仅剩魔笛手存活**：建议视为达成“其余存活玩家全被魅惑”而胜利（需在胜利顺序中明确）。
7. **魅惑名单包含死亡玩家**：统计胜利时只检查存活玩家。
8. **魅惑公开配置切换**：关闭公开时，非 piper 不应在 UI 看到 charm 信息。
9. **被 jail/roleblock（后续角色）**：若行动被阻断，本夜不新增魅惑。
10. **同一夜 charm + piper 被击杀**：应先结算死亡，再判定是否允许 charm 生效（建议死亡后无效，规则需固定）。

---

## 9. 配置选项

建议新增以下配置（P1 可先实现核心子集）：

```json
{
  "rules": {
    "piperCharmTargetsPerNight": 2,
    "piperCanCharmSelf": false,
    "piperCanRecharm": false,
    "piperNeedsAliveToWin": true,
    "piperRevealCharmedList": false
  }
}
```

字段说明：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `piperCharmTargetsPerNight` | number | `2` | 每晚可魅惑目标数量 |
| `piperCanCharmSelf` | boolean | `false` | 是否允许魅惑自己 |
| `piperCanRecharm` | boolean | `false` | 是否允许重复魅惑已魅惑玩家 |
| `piperNeedsAliveToWin` | boolean | `true` | piper 是否必须存活才可获胜 |
| `piperRevealCharmedList` | boolean | `false` | 是否向非 piper 公开魅惑名单 |

---

## 10. 测试场景

以下为 P1 建议测试清单（共 34 条）。

### 10.1 基础功能（1-8）

1. 魔笛手可在夜间提交 `NIGHT_PIPER_CHARM`。
2. 成功魅惑 2 名未魅惑目标。
3. `piperCharmedIds` 正确去重并持久化。
4. `piperLastCharmedIds` 记录当夜新增目标。
5. 夜间非魔笛手提交该行动被拒绝。
6. 非夜间提交魅惑被拒绝。
7. 非本人步骤提交魅惑被拒绝。
8. `NIGHT_SKIP` 对魔笛手可用且不新增魅惑。

### 10.2 验证规则（9-16）

9. `targetIds` 缺失时验证失败。
10. 目标数量不符合配置时失败。
11. 包含不存在玩家 ID 时失败。
12. 包含死亡玩家时失败。
13. 同一目标重复选择时失败。
14. `piperCanCharmSelf = false` 时自魅失败。
15. `piperCanCharmSelf = true` 时自魅成功。
16. `piperCanRecharm = false` 时重复魅惑失败。

### 10.3 胜利条件（17-24）

17. piper 存活且其余存活玩家全被魅惑时立即胜利。
18. 仅部分存活玩家被魅惑时不胜利。
19. piper 死亡后即使其余玩家全被魅惑也不胜利（默认规则）。
20. 当夜新增魅惑后立即触发胜利（夜结算后判定）。
21. 被魅惑玩家死亡后不再阻碍胜利判定。
22. 仅剩 piper 存活时触发 piper 胜利（若采用该规则）。
23. 与 village/werewolf 基础胜利冲突时，按既定优先级返回正确 winner。
24. 与 jester 胜利冲突时，jester 优先（白天即结束）。

### 10.4 交互测试（25-30）

25. 魔笛手被狼人夜杀后无法再魅惑。
26. 守卫/医生保护不影响魅惑生效。
27. 女巫解药不影响魅惑状态。
28. 恋人需分别魅惑，魅惑不联动。
29. 义警击杀魔笛手后，不再出现新增魅惑。
30. 白痴/小丑被魅惑不改变其原有特殊机制。

### 10.5 边界与回归（31-34）

31. 可选目标不足时允许少选并正常推进（若采用少选策略）。
32. 同夜 charm 目标与狼刀目标重叠时，最终状态与死亡统计一致。
33. 历史日志记录 charm 事件（便于回放）。
34. 未启用 piper 的对局流程与胜利判定无回归。

---

## Phase 1 完成检查

- [x] 10 个章节完整
- [x] 边界情况 ≥ 5（已提供 10 个）
- [x] 测试场景 ≥ 30（已提供 34 个）
- [x] 数据结构清晰定义
- [x] 优先级与胜利判定路径明确

