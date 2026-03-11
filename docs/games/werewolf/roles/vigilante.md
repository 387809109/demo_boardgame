# 义警 (Vigilante)

## 1. 角色概述

| 属性 | 值 |
|------|-----|
| **角色 ID** | `vigilante` |
| **中文名称** | 义警 |
| **英文名称** | Vigilante |
| **阵营** | `village` (好人阵营) |
| **优先级** | `P1` (进阶角色) |
| **夜晚行动** | `NIGHT_VIGILANTE_KILL` |
| **胜利条件** | 跟随村民阵营：消灭所有狼人（优先级 4） |
| **核心定位** | 主动进攻型神职，夜晚主动射杀目标 |

**角色类型判断**：主动夜间技能角色（每晚可主动选择目标）。

---

## 2. 角色能力

### 2.1 核心能力：夜晚射杀

- 义警在夜晚可以选择 1 名存活玩家作为目标并射杀。
- 射杀在夜晚结算中作为一次独立击杀事件处理（`vigilante_kill`）。
- 默认不可选择自己作为目标。

### 2.2 射击次数限制

- 义警的射击次数受配置项 `vigilanteMaxShots` 控制。
- 默认值建议为 `1`（标准局）。
- 当 `vigilanteShotsUsed >= vigilanteMaxShots` 时，义警仍可 `NIGHT_SKIP`，但不能再提交射杀行动。

### 2.3 误杀惩罚（可配置）

当义警射杀导致好人阵营目标死亡时（详见 6.4 判定），根据 `vigilanteMisfirePenalty` 处理：

- `none`：无惩罚
- `lose_ability`：永久失去射杀能力（`vigilanteLocked = true`）
- `suicide_next_night`（默认）：下一夜自动死亡（`vigilantePendingSuicide = true`）

---

## 3. 行动时机与优先级

根据当前夜间优先级表：

| 优先级 | 角色 | 操作 |
|--------|------|------|
| 8 | Werewolf | 夜晚击杀 |
| **9** | **Vigilante** | **射杀** |
| 10 | Witch | 救人/毒杀 |

### 3.1 设计理由

1. 义警属于主动击杀角色，置于狼人之后、女巫之前，符合“先主要击杀，后补救”的顺序。
2. 义警与连环杀手共享“击杀类”层级，便于后续 P3 扩展。
3. 若配置允许保护抵消义警攻击，则保护已在优先级 7 完成预设，优先级顺序清晰。

### 3.2 下一夜自杀的触发时机

- 当 `vigilantePendingSuicide = true` 且该玩家仍存活时，在下一夜结算中直接死亡（原因：`vigilante_recoil`）。
- 推荐在夜晚结算开始阶段处理，避免与当夜其他行动产生歧义。

---

## 4. 数据结构

### 4.1 `state.roleStates` 新增字段

```javascript
roleStates: {
  // ...existing fields
  vigilanteShotsUsed: 0,
  vigilanteLastTarget: null,
  vigilanteLocked: false,
  vigilantePendingSuicide: false
}
```

字段说明：

- `vigilanteShotsUsed`：已使用射击次数
- `vigilanteLastTarget`：上一晚射击目标（用于 UI 提示）
- `vigilanteLocked`：是否因误杀惩罚被永久禁用
- `vigilantePendingSuicide`：是否在下一夜自杀

### 4.2 行动数据格式

```javascript
{
  actionType: 'NIGHT_VIGILANTE_KILL',
  actionData: { targetId: 'player-xxx' }
}
```

---

## 5. 验证规则

在 `validateNightAction` 中新增 `NIGHT_VIGILANTE_KILL` 分支，规则如下：

1. 必须是义警本人提交。
2. 目标必须存在且存活。
3. 不能以自己为目标。
4. 若 `vigilanteCanShootFirstNight = false` 且 `state.round === 1`，拒绝。
5. 若 `roleStates.vigilanteLocked = true`，拒绝。
6. 若 `roleStates.vigilanteShotsUsed >= options.vigilanteMaxShots`，拒绝。
7. 若义警处于 `vigilantePendingSuicide = true`，拒绝主动射杀（仅允许 `NIGHT_SKIP`）。

建议错误文案：

- `义警已失去射杀能力`
- `义警射击次数已用完`
- `义警首夜不能开枪`
- `义警不能射击自己`
- `义警将于今夜反噬死亡，无法执行射杀`

---

## 6. 解析逻辑

### 6.1 行动收集（`_collectNightAction`）

当 `actionType === NIGHT_VIGILANTE_KILL` 时：

1. 记录 `nightActions[playerId]`。
2. 更新 `roleStates.vigilanteLastTarget`。
3. `roleStates.vigilanteShotsUsed += 1`。
4. 从 `pendingNightRoles` 移除该玩家。

### 6.2 夜晚结算新增步骤（`resolveNightActions`）

推荐顺序（兼容现有实现）：

1. 收集狼人击杀（已有）
2. 收集义警击杀（新增）
3. 收集毒药击杀（已有）
4. 收集保护（已有）
5. 应用保护
6. 应用女巫救人（已有）
7. 结算最终死亡
8. 根据“义警击杀结果”判定误杀惩罚

义警击杀事件建议结构：

```javascript
kills.push({
  targetId: vigilanteTargetId,
  cause: 'vigilante_kill',
  bypassesProtection: !state.options.protectAgainstVigilante
});
```

### 6.3 保护交互（与现有配置衔接）

- 当 `protectAgainstVigilante = true`：义警击杀可被保护类技能抵消。
- 当 `protectAgainstVigilante = false`：义警击杀绕过保护。

### 6.4 误杀判定标准

建议采用“最终死亡判定”以减少争议：

- 仅当某玩家最终死亡且其 `deathCause === 'vigilante_kill'` 时，才触发义警误杀判定。
- 若该玩家所属阵营为好人阵营（`village`），触发惩罚。
- 若该玩家未死亡（被保护/被救活），不触发惩罚。

### 6.5 下一夜自杀处理

若 `vigilantePendingSuicide = true`：

- 在下一夜结算中将义警标记死亡（`vigilante_recoil`）。
- 死亡后清除 `vigilantePendingSuicide`。
- `vigilante_recoil` 属于**惩罚性强制死亡**，不属于 `Kill`，不受 `protectAgainstVigilante` 影响。
- 该死亡不可被守卫/医生/女巫解药阻止或救回（即使同夜存在保护与治疗行动）。

---

## 7. 与其他角色的交互

### 7.1 与守卫/医生

- 由 `protectAgainstVigilante` 决定义警击杀是否可被保护抵消。
- 默认建议：`true`（保护可抵消义警击杀）。
- 义警因误杀触发的 `vigilante_recoil` 不可被守卫/医生抵消。

### 7.2 与女巫

- 义警可被女巫毒杀，正常死亡。
- 当前实现下女巫解药主要围绕狼刀目标，是否可救义警目标由后续实现策略决定；P1 推荐保持现状不扩展。
- 义警因误杀触发的 `vigilante_recoil` 不可被女巫解药救回。

### 7.3 与丘比特（恋人）

- 若义警击杀恋人之一，另一方触发殉情（`lover_death`）。
- 若被击杀者因保护未死，则不触发殉情。

### 7.4 与猎人

- 义警击杀猎人会触发猎人死亡后开枪（遵循现有猎人规则）。
- 义警误杀导致自己“下一夜自杀”，该死亡不应触发额外特殊豁免。

### 7.5 与白痴/小丑

- 义警夜杀白痴：白痴正常死亡（白痴仅对白天处决免死）。
- 义警夜杀小丑：不会触发小丑胜利（小丑只在白天投票处决时胜利）。

---

## 8. 边界情况

1. **射击次数耗尽后继续提交击杀**：应验证失败。
2. **首夜禁枪配置下首夜射击**：应验证失败。
3. **目标当夜同时被狼刀和义警击杀**：最终仅记录一次死亡，避免重复触发死亡链。
4. **目标被保护导致未死亡**：义警误杀惩罚不触发（按 6.4 建议）。
5. **义警已标记下一夜自杀仍尝试射杀**：应验证失败。
6. **义警在待自杀夜被其他方式先击杀**：不重复死亡，不产生重复日志。
7. **义警击杀恋人导致殉情链**：应只触发一次殉情递归，避免死循环。
8. **义警死亡后夜晚面板仍显示可操作**：应由 `alive` 状态屏蔽。
9. **义警对不存在/已死亡目标射杀**：应验证失败。
10. **多义警扩展局**：当前 P1 默认单义警，若扩展多义警需改为按 playerId 维护状态映射。

---

## 9. 配置选项

建议在 `config.json` 中新增（或补齐）以下选项：

```json
{
  "rules": {
    "vigilanteMaxShots": 1,
    "vigilanteCanShootFirstNight": true,
    "vigilanteMisfirePenalty": "suicide_next_night",
    "protectAgainstVigilante": true
  }
}
```

`settingsSchema` 建议：

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `vigilanteMaxShots` | number | `1` | 义警总射击次数 |
| `vigilanteCanShootFirstNight` | boolean | `true` | 首夜是否允许开枪 |
| `vigilanteMisfirePenalty` | select | `suicide_next_night` | 误杀惩罚策略 |
| `protectAgainstVigilante` | boolean | `true` | 保护是否可抵消义警击杀 |

`vigilanteMisfirePenalty` 备选值：

- `none`
- `lose_ability`
- `suicide_next_night`

---

## 10. UI 呈现与交互方式

### 选择模式

`single` — 通过环形座位图点击单个玩家头像选择射击目标。

义警已在 `roleHasNightAction()` 中注册，框架自动通过 `_getNightSelectionConfig()` 提供环形单选。当义警被锁定（`vigilanteLocked`）、待自杀（`vigilantePendingSuicide`）或射击次数用尽时，`_getNightSelectionConfig()` 返回 `null`，环形选择不可用。

### 夜间面板内容

面板文件：`ui-panels-roles.js` → `renderVigilantePanel(ctx)`

显示内容：

- **剩余射击次数**：显示"剩余射击: N / M"
- **上次射击目标**：若 `vigilanteLastTarget` 有值，显示"上次射击: {玩家名}"
- **锁定/自杀提示**：若 `vigilanteLocked` 或 `vigilantePendingSuicide`，显示警告信息
  - 待自杀："你将于今夜反噬死亡，无法执行射杀。"
  - 已锁定："你已失去射杀能力，今晚只能跳过行动。"
- **次数用尽提示**：显示"射击次数已用完，今晚只能跳过行动。"
- **当前选择**：若已点选目标且可射击，显示"已选择射击: {玩家名}"
- **未选择提示**：显示"点击环形布局中的玩家头像选择要射击的玩家"

### 操作栏按钮

- **确认行动**：选择目标后启用
  - 按钮文案：`确认行动`
  - 启用条件：`selectedTarget !== null` 且未锁定且有剩余次数

### 徽章显示

无专属徽章。

### 可见状态字段

`_getVisibleRoleStates` 中暴露给义警玩家：

- `vigilanteShotsUsed`: 已使用射击次数
- `vigilanteLastTarget`: 上一晚射击的目标 ID
- `vigilanteLocked`: 是否已被锁定（失去能力）
- `vigilantePendingSuicide`: 是否待自杀（下一夜开始时死亡）
- `vigilanteMaxShots`: 最大射击次数

### 白天 UI 影响

无特殊白天 UI 变化。

---

## 11. 测试场景

以下为 P1 阶段建议测试清单（共 32 个）。

### 11.1 基础功能（1-8）

1. 义警夜晚成功射杀目标。
2. 义警射杀后进入白天，死亡列表包含 `vigilante_kill`。
3. 义警可选择 `NIGHT_SKIP` 跳过行动。
4. 义警不能射击自己。
5. 义警不能射击已死亡玩家。
6. 义警不能射击不存在的玩家 ID。
7. 义警非夜晚阶段提交行动被拒绝。
8. 非义警玩家提交 `NIGHT_VIGILANTE_KILL` 被拒绝。

### 11.2 次数与状态（9-14）

9. `vigilanteMaxShots = 1` 时，第二次射击被拒绝。
10. `vigilanteMaxShots = 2` 时，可连续两晚射击。
11. 射击后 `vigilanteShotsUsed` 正确累加。
12. 射击后 `vigilanteLastTarget` 正确更新。
13. `vigilanteLocked = true` 时，射击被拒绝。
14. `vigilantePendingSuicide = true` 时，射击被拒绝。

### 11.3 配置规则（15-19）

15. `vigilanteCanShootFirstNight = false` 时首夜射击失败。
16. `vigilanteCanShootFirstNight = true` 时首夜射击成功。
17. `protectAgainstVigilante = true` 时，医生保护可抵消义警击杀。
18. `protectAgainstVigilante = true` 时，守卫保护可抵消义警击杀。
19. `protectAgainstVigilante = false` 时，保护无法抵消义警击杀。

### 11.4 误杀惩罚（20-26）

20. 误杀好人 + `none`：不触发惩罚。
21. 误杀好人 + `lose_ability`：后续射击被拒绝。
22. 误杀好人 + `suicide_next_night`：下一夜自动死亡。
23. 射杀狼人不触发误杀惩罚。
24. 射击目标未死亡时（被保护），不触发误杀惩罚。
25. 已进入下一夜自杀后，不重复触发自杀事件。
26. 义警进入下一夜自杀时，不可被守卫/医生/女巫解药阻止或救回。

### 11.5 角色交互（27-31）

27. 义警射杀猎人，猎人触发开枪（按配置）。
28. 义警射杀白痴，白痴正常死亡（不翻牌）。
29. 义警射杀小丑，不触发小丑胜利。
30. 义警射杀恋人之一，另一名恋人殉情。
31. 义警射杀被女巫毒杀同一目标时，死亡记录稳定且无重复触发。

### 11.6 流程与回归（32-33）

32. 加入义警后夜间步骤顺序仍为 8(狼) → 9(义警) → 10(女巫)。
33. 未包含义警的对局不受影响（回归测试）。

---

## Phase 1 完成检查

- [x] 10 个章节完整
- [x] 边界情况 ≥ 5（已提供 10 个）
- [x] 测试场景 ≥ 30（已提供 33 个）
- [x] 数据结构清晰定义
- [x] 优先级与交互规则可执行
