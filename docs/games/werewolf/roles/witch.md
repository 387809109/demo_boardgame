# 女巫 (Witch)

## 1. 角色基本信息

| 属性 | 值 |
|------|-----|
| **角色 ID** | `witch` |
| **中文名称** | 女巫 |
| **英文名称** | Witch |
| **阵营** | `village` (好人阵营) |
| **优先级** | `P0` (基础角色) |
| **夜晚行动** | `NIGHT_WITCH_SAVE`、`NIGHT_WITCH_POISON`、`NIGHT_WITCH_COMBINED` |
| **胜利条件** | 跟随村民阵营：消灭所有狼人（优先级 4） |
| **行动时机** | 每个夜晚（在狼人和义警之后，priority 10） |

---

## 2. 核心规则

### 2.1 解药 (Save Potion)

- 女巫持有 1 瓶解药，**全局仅可使用一次**。
- 当女巫回合开始时，系统通过 `witch_night_info` 公告提供 `wolfTarget`（当晚被狼人袭击的目标）。
- 使用解药可取消狼人击杀（`wolf_kill`），令被刀目标存活。
- 使用后 `roleStates.witchSaveUsed = true`，后续夜晚不可再使用解药。

### 2.2 毒药 (Poison Potion)

- 女巫持有 1 瓶毒药，**全局仅可使用一次**。
- 毒药可选择任意一名存活玩家作为目标，该目标当晚死亡。
- 毒药具有 `bypassesProtection: true` 属性，**无视所有保护效果**（包括守卫、医生等）。
- 使用后 `roleStates.witchPoisonUsed = true`，后续夜晚不可再使用毒药。

### 2.3 同夜同时使用 (Combined Action)

- 女巫可以在**同一个夜晚**同时使用解药和毒药。
- 当两种药水在同一夜使用时，系统将其合并为 `NIGHT_WITCH_COMBINED` 行动。
- 合并行动的数据结构：

```javascript
{
  actionType: 'NIGHT_WITCH_COMBINED',
  actionData: {
    usedSave: true,
    poisonTargetId: 'player-xxx'
  }
}
```

### 2.4 狼刀信息获取

- 女巫回合开始时，系统自动发送 `witch_night_info` 公告。
- 公告包含 `wolfTarget` 字段，指示当晚被狼人选中的目标。
- 若狼人投票平票或弃票（无人被刀），`wolfTarget` 为 `null`，此时解药无法使用（无可救目标）。

### 2.5 行动结束机制

- 女巫步骤仅在提交 `NIGHT_SKIP` 时结束。
- 这一设计允许女巫在同一回合内先后使用解药和毒药，再通过 NIGHT_SKIP 确认结束。

---

## 3. 可选规则设定

女巫的行为受以下游戏配置影响：

### 3.1 是否允许自救 (`witchCanSaveSelf`)

| 配置值 | 行为 |
|--------|------|
| `true` | 女巫被狼刀时可以对自己使用解药 |
| `false` | 女巫被狼刀时不能对自己使用解药 |

**推荐默认值**: `true`（经典局）/ `false`（进阶局）

**验证逻辑**：
- 当 `witchCanSaveSelf = false` 时，若 `wolfTarget === playerId`（女巫自己被刀），返回验证错误
- 女巫仍然能看到自己被刀的信息，只是无法使用解药

---

### 3.2 解药是否仅首夜可用 (`witchSaveFirstNightOnly`)

| 配置值 | 行为 |
|--------|------|
| `false` | 解药在任何夜晚均可使用（只要未被消耗） |
| `true` | 解药仅在第 1 轮夜晚可使用，之后即使未消耗也无法使用 |

**推荐默认值**: `false`（经典局）

**验证逻辑**：
- 当 `witchSaveFirstNightOnly = true` 且 `state.round > 1` 时，返回验证错误

---

### 3.3 守卫与女巫解药的交互 (`guardWitchInteraction`)

| 配置值 | 行为 |
|--------|------|
| `"coexist"` | 守卫保护 + 女巫解药可以共存，两者都生效，目标存活 |
| `"conflict"` | 守卫保护 + 女巫解药同时作用时，目标反而死亡（**守药同死**） |

**推荐默认值**: `"coexist"`（经典版）/ `"conflict"`（进阶局）

**结算逻辑**（在 `resolveNightActions` 中）：

```javascript
// 伪代码示例
if (guardWitchInteraction === 'conflict' && witchUsedSave && wolfTarget) {
  const guardProtectedWolfTarget = nightActions.some(
    a => a.actionType === 'NIGHT_BODYGUARD_PROTECT'
      && a.actionData?.targetId === wolfTarget
  );
  if (guardProtectedWolfTarget) {
    // 守药同死：撤销解药效果，目标仍然死亡
    // 添加 guard_witch_conflict 事件
  }
}
```

---

## 4. 夜晚行动优先级分析

根据 `config.json` 的夜晚行动优先级表：

| 优先级 | 角色 | 操作 |
|--------|------|------|
| 7 | Doctor / Bodyguard / Guardian Angel | 保护 |
| 8 | Werewolf | 击杀 |
| 9 | Vigilante / Serial Killer | 射杀/击杀 |
| **10** | **Witch** | **救人/毒杀** |
| 11 | Piper | 魅惑 |

### 优先级设计理由

1. **女巫在狼人之后（10 > 8）**：
   - 女巫需要先获取狼刀结果才能决定是否使用解药
   - 系统在女巫回合开始时提供 `wolfTarget` 信息

2. **女巫在义警之后（10 > 9）**：
   - 义警的射杀先于女巫行动
   - 女巫毒药和义警射杀是独立的击杀事件，按优先级依次结算

3. **女巫在保护之后（10 > 7）**：
   - 守卫/医生的保护已在 priority 7 完成预设
   - 女巫的解药是"事后补救"，毒药是"事后追加"
   - 毒药的 `bypassesProtection: true` 确保无视已预设的保护

4. **女巫是最后的关键决策者**：
   - 作为 priority 10 的行动者，女巫在获取所有前序信息后做出决策
   - 这符合经典狼人杀中"女巫最后行动"的设计

---

## 5. 与现有角色的交互

### 5.1 女巫解药 vs 狼人击杀 (Werewolf)

| 场景 | 结果 |
|------|------|
| 狼人击杀玩家 A，女巫使用解药 | 玩家 A **存活**（wolf_kill 被取消） |
| 狼人击杀玩家 A，女巫未使用解药 | 玩家 A **死亡** |
| 狼人无人被刀（平票/弃票），女巫无法使用解药 | 无事件 |

---

### 5.2 女巫毒药 vs 保护类角色

女巫毒药具有 `bypassesProtection: true`，**无视所有保护效果**：

| 场景 | 结果 |
|------|------|
| 女巫毒杀玩家 A，守卫守护玩家 A | 玩家 A **死亡**（毒药无视守卫） |
| 女巫毒杀玩家 A，医生保护玩家 A | 玩家 A **死亡**（毒药无视医生） |
| 女巫毒杀玩家 A，守卫 + 医生同时保护 A | 玩家 A **死亡**（毒药无视所有保护） |

---

### 5.3 女巫 vs 守卫 (Bodyguard) — 守药交互

#### 场景 1：守卫保护成功，女巫未使用解药（`guardWitchInteraction` 无影响）
- 狼人击杀玩家 A，守卫守护玩家 A
- 女巫看到 `wolfTarget` 为玩家 A
- **结果**：玩家 A 存活（守卫保护生效），女巫可保留解药

#### 场景 2：守卫保护 + 女巫解药共存（`guardWitchInteraction = "coexist"`）
- 狼人击杀玩家 A，守卫守护玩家 A，女巫使用解药救玩家 A
- **结果**：玩家 A **存活**（两者不冲突，解药消耗）

#### 场景 3：守卫保护 + 女巫解药冲突（`guardWitchInteraction = "conflict"`）
- 狼人击杀玩家 A，守卫守护玩家 A，女巫使用解药救玩家 A
- **结果**：玩家 A **死亡**（守药同死，解药消耗）

---

### 5.4 女巫 vs 预言家 (Seer)

- **预言家查验女巫**：结果为"好人"（女巫属于 village 阵营）
- **无直接技能交互**
- 女巫可以毒杀/解救预言家

---

### 5.5 女巫 vs 猎人 (Hunter) — 毒杀与开枪

| 场景 | 结果 |
|------|------|
| 女巫毒杀猎人 | 猎人死亡，**有条件触发开枪**（取决于猎人 `hunterCanShootWhenPoisoned` 配置） |
| 女巫解药救猎人（猎人被狼刀） | 猎人存活，不触发开枪 |

**关键规则**：猎人被女巫毒杀时是否可以开枪，由 `hunterCanShootWhenPoisoned` 配置控制（默认 `true`）。

---

### 5.6 女巫 vs 村民 (Villager)

- **无直接交互**
- 女巫可以解救/毒杀村民

---

## 6. Edge Cases（易错情境与正确结算）

### 6.1 女巫自救

| `witchCanSaveSelf` | 女巫被狼刀 | 结果 |
|--------------------|-----------|------|
| `true` | 女巫使用解药 | 女巫**存活**（解药消耗） |
| `false` | 女巫尝试使用解药 | **验证失败**，解药不消耗 |
| `true` | 解药已用完 | **验证失败**，女巫死亡 |

---

### 6.2 女巫同夜使用解药 + 毒药

| 场景 | 结果 |
|------|------|
| 解药救玩家 A + 毒药杀玩家 B | A 存活，B 死亡（两药独立生效） |
| 解药救玩家 A + 毒药杀玩家 A | A 存活（解药取消 wolf_kill）但 A 同时死于毒药 → **A 死亡**（毒药 `bypassesProtection: true`） |
| 解药救自己 + 毒药杀目标 | 女巫存活 + 目标死亡 |

**重要**：同夜使用两药时，系统合并为 `NIGHT_WITCH_COMBINED`，结算中分别处理解药（取消 wolf_kill）和毒药（添加 witch_poison 死亡事件）。

---

### 6.3 女巫解救已被守卫保护的目标

| `guardWitchInteraction` | 守卫守护 A + 女巫解药救 A | 结果 |
|-------------------------|--------------------------|------|
| `"coexist"` | 两者不冲突 | A 存活，解药消耗（浪费） |
| `"conflict"` | 守药同死 | A **死亡**，解药消耗 |

**注意**：在 `"coexist"` 模式下，即使守卫已保护成功，女巫仍可使用解药（但属于浪费）。系统不会阻止这种操作，因为女巫无法知道守卫是否已保护该目标。

---

### 6.4 女巫毒杀被守卫保护的玩家

- 守卫守护玩家 A，女巫对玩家 A 使用毒药
- **结果**：玩家 A **死亡**
- **原因**：毒药 `bypassesProtection: true`，守卫保护仅对 `wolf_kill` 生效

---

### 6.5 女巫被义警射杀 — 已提交行动仍结算

| 场景 | 结果 |
|------|------|
| 义警射杀女巫（priority 9），女巫已提交行动（priority 10） | 女巫死亡，但**已提交的行动仍然结算** |

**设计原因**：夜晚行动是"并发提交，按优先级结算"。女巫在 priority 10 的行动已提交到系统中，即使女巫在同夜因义警（priority 9）死亡，行动仍然生效。

---

### 6.6 狼人弃票 — 无解药目标

| 场景 | 结果 |
|------|------|
| 狼人投票平票或全部弃票，当晚无人被刀 | `wolfTarget = null`，女巫**无法使用解药** |
| 女巫仍可使用毒药 | 毒药不依赖 wolfTarget |
| 女巫选择 NIGHT_SKIP | 正常结束回合 |

---

### 6.7 重复提交同类药水

| 场景 | 结果 |
|------|------|
| 女巫先提交 `NIGHT_WITCH_SAVE`，再提交 `NIGHT_WITCH_SAVE` | **验证失败**（重复提交检测） |
| 女巫先提交 `NIGHT_WITCH_POISON`，再提交 `NIGHT_WITCH_POISON` | **验证失败**（重复提交检测） |
| 女巫先提交 `NIGHT_WITCH_SAVE`，再提交 `NIGHT_WITCH_POISON` | **合法**，合并为 `NIGHT_WITCH_COMBINED` |

**实现细节**：系统在 `validateNightAction` 中追踪已提交的行动类型，通过 `usedSave` / `usedPoison` 标记防止同类药水重复使用。

---

## 7. 测试场景清单

### 7.1 解药基础功能测试（6 个用例）

1. 女巫使用解药成功救活被狼刀的目标
2. 女巫解药使用后 `witchSaveUsed` 标记为 `true`
3. `witchSaveUsed = true` 时再次使用解药，验证失败
4. 无 `wolfTarget` 时使用解药，验证失败
5. 女巫收到 `witch_night_info` 公告且包含正确的 `wolfTarget`
6. 女巫解药取消 wolf_kill 后，白天死亡列表不包含被救目标

---

### 7.2 毒药基础功能测试（5 个用例）

7. 女巫使用毒药成功击杀目标
8. 女巫毒药使用后 `witchPoisonUsed` 标记为 `true`
9. `witchPoisonUsed = true` 时再次使用毒药，验证失败
10. 毒药目标必须存活，已死亡目标验证失败
11. 毒药死亡原因标记为 `witch_poison`

---

### 7.3 同夜双药测试（4 个用例）

12. 同一夜先使用解药后使用毒药，两者均生效
13. 同一夜先使用毒药后使用解药，两者均生效
14. 合并行动 `NIGHT_WITCH_COMBINED` 正确记录 `usedSave` 和 `poisonTargetId`
15. 同夜双药后 `witchSaveUsed` 和 `witchPoisonUsed` 均标记为 `true`

---

### 7.4 自救配置测试（4 个用例）

16. `witchCanSaveSelf = true`：女巫被狼刀时自救成功
17. `witchCanSaveSelf = false`：女巫被狼刀时自救验证失败
18. `witchCanSaveSelf = false`：女巫被狼刀时仍可看到 `wolfTarget` 信息
19. `witchCanSaveSelf = true` + 解药已用完：自救验证失败

---

### 7.5 首夜限制测试（3 个用例）

20. `witchSaveFirstNightOnly = false`：第 2 轮使用解药成功
21. `witchSaveFirstNightOnly = true`：第 2 轮使用解药验证失败
22. `witchSaveFirstNightOnly = true`：第 1 轮使用解药成功

---

### 7.6 守药交互测试（4 个用例）

23. `guardWitchInteraction = "coexist"`：守卫保护 + 女巫解药，目标存活
24. `guardWitchInteraction = "conflict"`：守卫保护 + 女巫解药，目标死亡（守药同死）
25. 守卫守护 A + 女巫解药救 B（不同目标），无冲突
26. `guardWitchInteraction = "conflict"` 但守卫未守护狼刀目标，女巫解药正常生效

---

### 7.7 毒药无视保护测试（3 个用例）

27. 女巫毒杀守卫保护的玩家，目标死亡
28. 女巫毒杀医生保护的玩家，目标死亡
29. 女巫毒杀被守卫 + 医生双重保护的玩家，目标死亡

---

### 7.8 角色交互测试（5 个用例）

30. 女巫毒杀猎人 + `hunterCanShootWhenPoisoned = true`：猎人开枪
31. 女巫毒杀猎人 + `hunterCanShootWhenPoisoned = false`：猎人不开枪
32. 预言家查验女巫，结果为好人
33. 女巫被义警射杀，已提交的行动仍然结算
34. 女巫毒杀恋人之一，另一方触发殉情

---

### 7.9 行动流程测试（4 个用例）

35. 女巫使用 `NIGHT_SKIP` 正常结束回合（不使用任何药水）
36. 女巫回合仅在 `NIGHT_SKIP` 提交时结束
37. 重复提交同类药水（解药/毒药）被拒绝
38. 非女巫玩家提交 `NIGHT_WITCH_SAVE` / `NIGHT_WITCH_POISON` 被拒绝

---

### 7.10 边界情况测试（4 个用例）

39. 狼人弃票无人被刀，女巫无法使用解药但可使用毒药
40. 女巫死亡后无法行动
41. 两药均已用完时，女巫夜晚仅可 NIGHT_SKIP
42. 加入女巫后夜间步骤顺序仍为 8(狼) → 9(义警) → 10(女巫)

---

**预计测试用例总数**：42 个

---

## 8. 配置建议

在 `frontend/src/games/werewolf/config.json` 的 `settingsSchema` 中已包含以下配置项：

```json
{
  "rules": {
    "witchCanSaveSelf": true,
    "witchSaveFirstNightOnly": false,
    "guardWitchInteraction": "coexist"
  },
  "settingsSchema": {
    "witchCanSaveSelf": {
      "type": "boolean",
      "label": "女巫可自救",
      "description": "女巫是否可以用救人药水救自己",
      "default": true,
      "group": "witch"
    },
    "witchSaveFirstNightOnly": {
      "type": "boolean",
      "label": "女巫仅首夜可救",
      "description": "女巫的救人药水是否仅首夜可使用",
      "default": false,
      "group": "witch"
    },
    "guardWitchInteraction": {
      "type": "select",
      "label": "守卫与女巫解药的交互",
      "description": "守卫保护 + 女巫解药同时作用时的结算方式",
      "options": [
        { "value": "coexist", "label": "共存（两者都生效，目标存活）" },
        { "value": "conflict", "label": "冲突（守药同死，目标死亡）" }
      ],
      "default": "coexist",
      "group": "doctor_guard"
    }
  }
}
```

---

## 9. 实现检查清单

- [x] 在 `config.json` 的 `roles.p0` 中包含 `witch` 角色定义
- [x] 在 `config.json` 的 `nightActionPriority` 中设置 `witch` 为 priority 10
- [x] 在 `config.json` 的 `rules` 和 `settingsSchema` 中包含 3 个配置项
- [x] 在 `rules.js` 中实现 `NIGHT_WITCH_SAVE` 验证逻辑
- [x] 在 `rules.js` 中实现 `NIGHT_WITCH_POISON` 验证逻辑
- [x] 在 `rules.js` 中实现 `NIGHT_WITCH_COMBINED` 合并行动与重复提交检测
- [x] 在 `rules-resolution.js` 中实现解药取消 wolf_kill 逻辑
- [x] 在 `rules-resolution.js` 中实现毒药击杀逻辑（`bypassesProtection: true`）
- [x] 在 `rules-resolution.js` 中实现 `guardWitchInteraction` 守药冲突逻辑
- [x] 在 `index.js` 中实现 `witch_night_info` 公告发送（包含 `wolfTarget`）
- [x] 在 `ui-panels-roles.js` 中实现女巫夜间面板
- [x] 在 `ui-panels-night.js` 中实现女巫多步操作面板
- [ ] 在 `index.test.js` 中添加 42 个测试用例
- [ ] 手动测试验证所有 Edge Cases

---

## 10. UI 呈现与交互方式

### 选择模式

`special` — 女巫采用**多步操作面板**，而非标准环形单选。

女巫的夜间交互与其他角色不同：不是简单的"选择目标 → 确认"，而是包含"查看狼刀信息 → 决定解药 → 决定毒药 → 确认结束"的多步流程。

### 夜间面板内容

面板文件：`ui-panels-roles.js` → witch 相关渲染函数

显示内容：

- **狼刀信息**：显示 `wolfTarget` 的身份，例如"今晚被狼人袭击的是: {玩家名}"；若无人被刀则显示"今晚无人被狼人袭击"
- **解药按钮**：
  - 可用状态：显示"使用解药 (剩余: 1)"，点击后执行 `NIGHT_WITCH_SAVE`
  - 已使用状态：显示"解药已用完"，按钮禁用
  - 无目标状态：无人被刀时，按钮禁用
  - 配置限制状态：`witchCanSaveSelf = false` 且自己被刀时，显示提示"不可自救"
  - 首夜限制状态：`witchSaveFirstNightOnly = true` 且非首夜时，按钮禁用
- **毒药按钮**：
  - 可用状态：显示"使用毒药 (剩余: 1)"，点击后进入目标选择
  - 已使用状态：显示"毒药已用完"，按钮禁用
  - 毒药目标选择通过环形座位图点击存活玩家完成
- **药水剩余计数**：始终显示解药和毒药的剩余数量

### 操作栏按钮

- **确认结束**：通过提交 `NIGHT_SKIP` 确认女巫回合结束
  - 按钮文案：`确认行动`
  - 始终可用（女巫可以选择不使用任何药水直接跳过）
  - 女巫必须手动点击确认才能结束回合

### 徽章显示

无专属徽章。

### 可见状态字段

`_getVisibleRoleStates` 中暴露给女巫玩家：

- `witchSaveUsed`: 解药是否已使用
- `witchPoisonUsed`: 毒药是否已使用

### 白天 UI 影响

无特殊白天 UI 变化。

---

## 11. 参考资料

- **经典狼人杀规则**：[百度百科 - 狼人杀](https://baike.baidu.com/item/狼人杀)
- **女巫规则来源**：米勒山谷狼人（Les Loups-Garous de Thiercelieux）原版角色
- **守药同死规则来源**：天黑请闭眼进阶规则、狼人杀 Online 竞技规则
- **相关角色**：医生（P0，保护类）、守卫（P1，保护类）、猎人（P0，被动触发类）
- **项目实现文件**：
  - `frontend/src/games/werewolf/rules.js` — 验证逻辑
  - `frontend/src/games/werewolf/rules-resolution.js` — 夜晚结算逻辑
  - `frontend/src/games/werewolf/config.json` — 角色与配置定义
  - `frontend/src/games/werewolf/ui-panels-roles.js` — 夜间面板 UI

---

**文档版本**：v1.0
**创建日期**：2026-02-22
**作者**：AI-assisted
**待审核**：已实现（P0 基础角色，核心功能已就绪）
