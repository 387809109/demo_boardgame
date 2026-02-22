# 猎人 (Hunter)

## 1. 角色基本信息

| 属性 | 值 |
|------|-----|
| **角色 ID** | `hunter` |
| **中文名称** | 猎人 |
| **英文名称** | Hunter |
| **阵营** | `village` (好人阵营) |
| **优先级** | `P0` (基础角色) |
| **行动类型** | `HUNTER_SHOOT`（被动触发，非夜晚行动） |
| **胜利条件** | 跟随村民阵营：消灭所有狼人（优先级 4） |
| **行动时机** | 死亡时触发（中断当前游戏流程） |

---

## 2. 核心规则

### 2.1 死亡触发机制

猎人是一个**被动触发型**角色，不在夜晚行动序列中。当猎人死亡时，系统检查死亡原因以决定是否触发开枪：

| 死亡原因 | 能否开枪 | 说明 |
|----------|----------|------|
| `wolf_kill`（狼人击杀） | ✅ 可以 | 角色被强制公开（`forcedRevealRoleIds`） |
| `execution`（白天投票处决） | ✅ 可以 | — |
| `witch_poison`（女巫毒杀） | ⚠️ 取决于配置 | 由 `hunterShootOnPoison` 决定（默认 `false`）；角色被强制公开 |
| `lover_death`（恋人殉情） | ❌ 不可以 | 殉情优先于猎人技能 |
| `vigilante_kill`（义警射杀） | ✅ 可以 | — |
| `hunter_shoot`（被另一个猎人射杀） | ✅ 可以 | 可产生连锁开枪 |

### 2.2 开枪机制

当猎人死亡且满足开枪条件时：

1. 设置 `hunterPendingShoot = hunterId`（猎人的 playerId）
2. 游戏流程暂停，等待猎人选择射击目标
3. 猎人选择一名**存活**玩家作为目标
4. 目标立即死亡，死亡原因为 `hunter_shoot`

### 2.3 连锁击杀

猎人射杀目标后，系统对被射杀的目标调用 `_processDeathTriggers`，可能产生以下连锁效果：

- **射杀另一个猎人**：被射杀的猎人也触发开枪（`hunterPendingShoot` 更新为新猎人的 playerId）
- **射杀恋人**：恋人的另一方殉情（`lover_death`），殉情者若为猎人则**不能**开枪
- **射杀队长**：需要处理队长转移（`captainTransfer`）

### 2.4 角色强制公开

当猎人因 `wolf_kill` 或 `witch_poison` 死亡时，其角色身份被强制公开：

```javascript
state.forcedRevealRoleIds = state.forcedRevealRoleIds || {};
state.forcedRevealRoleIds[deadId] = true;
```

这允许其他玩家（无论 `revealRolesOnDeath` 配置如何）看到该猎人的角色身份。

---

## 3. 可选规则设定

### 3.1 猎人被毒能否开枪 (`hunterShootOnPoison`)

| 配置值 | 行为 |
|--------|------|
| `true` | 猎人被女巫毒死时可以开枪 |
| `false` | 猎人被女巫毒死时不能开枪（默认） |

**推荐默认值**: `false`（经典规则，毒药压制猎人技能）

**设计理由**：在经典狼人杀中，女巫的毒药被视为一种"无声的暗杀"，猎人在中毒时无法反击。设为 `true` 则增强猎人的容错能力。

**验证逻辑**：

```javascript
// _processDeathTriggers 中
if (deadPlayer.roleId === 'hunter') {
  if (cause === 'lover_death') continue; // 殉情不能开枪
  const canShoot = cause !== 'witch_poison' ||
                   state.options.hunterShootOnPoison;
  if (canShoot) {
    state.hunterPendingShoot = deadId;
  }
}
```

---

## 4. 行动时机分析

### 4.1 非夜晚行动角色

猎人**没有**夜晚行动优先级。`HUNTER_SHOOT` 不以 `NIGHT_` 前缀开头，不属于夜间行动序列。在 `getActiveNightRoles` 中被过滤：

```javascript
// Hunter's HUNTER_SHOOT is passive, not a night action
const hasNightAction = roleConfig.actionTypes.some(
  a => a.startsWith('NIGHT_')
);
if (!hasNightAction) continue;
```

### 4.2 死亡触发时机

猎人开枪可能在以下阶段触发：

| 触发阶段 | 场景 | 后续流程 |
|----------|------|----------|
| `DAY_ANNOUNCE`（白天公告） | 猎人在夜晚被狼刀/毒杀 | 开枪 → 处理连锁 → 检查队长转移 → 恢复遗言/发言流程 |
| `DAY_VOTE` 结算后 | 猎人被白天投票处决 | 开枪 → 处理连锁 → 检查队长转移 → 进入夜晚 |

### 4.3 流程中断与恢复

当 `hunterPendingShoot` 有值时，游戏流程被阻塞：

- `PHASE_ADVANCE` 验证中检查 `hunterPendingShoot`，若非空则拒绝推进
- 猎人提交 `HUNTER_SHOOT` 后清除 `hunterPendingShoot`，恢复正常流程

```javascript
// PHASE_ADVANCE 验证
if (state.phase === PHASES.DAY_ANNOUNCE) {
  if (state.hunterPendingShoot) {
    return { valid: false, error: '等待猎人开枪' };
  }
}
```

---

## 5. 与现有角色的交互

### 5.1 猎人 vs 狼人（Werewolf）

| 场景 | 结果 |
|------|------|
| 狼人夜晚击杀猎人 | 猎人死亡，角色强制公开，触发开枪 |
| 猎人开枪射杀狼人 | 狼人死亡，减少狼人阵营人数 |

---

### 5.2 猎人 vs 女巫（Witch）

#### 场景 1：女巫毒杀猎人（`hunterShootOnPoison = false`）
- 女巫对猎人使用毒药
- **结果**：猎人死亡，角色强制公开，**不能开枪**

#### 场景 2：女巫毒杀猎人（`hunterShootOnPoison = true`）
- 女巫对猎人使用毒药
- **结果**：猎人死亡，角色强制公开，**可以开枪**

#### 场景 3：女巫救活被狼刀的猎人
- 狼人击杀猎人，女巫使用解药救猎人
- **结果**：猎人存活，**不触发开枪**（猎人未死亡）

---

### 5.3 猎人 vs 守卫（Bodyguard）

| 场景 | 结果 |
|------|------|
| 守卫守护猎人，狼人击杀猎人 | 猎人存活（守卫保护生效），**不触发开枪** |
| 守卫守护猎人，女巫毒杀猎人 | 猎人死亡（守卫无法阻止毒药），是否开枪取决于 `hunterShootOnPoison` |

---

### 5.4 猎人 vs 医生（Doctor）

| 场景 | 结果 |
|------|------|
| 医生保护猎人，狼人击杀猎人 | 猎人存活（医生保护生效），**不触发开枪** |
| 医生保护猎人，女巫毒杀猎人 | 猎人死亡（医生无法阻止毒药），是否开枪取决于 `hunterShootOnPoison` |

---

### 5.5 猎人 vs 预言家（Seer）

- **无直接交互**
- 预言家可以查验猎人，结果为"好人"

---

### 5.6 猎人 vs 丘比特 / 恋人（Cupid / Lovers）

#### 场景 1：猎人为恋人之一，恋人另一方死亡
- 恋人一方死亡 → 猎人殉情（`lover_death`）
- **结果**：猎人死亡，**不能开枪**（殉情优先于猎人技能）

#### 场景 2：猎人开枪射杀恋人之一
- 猎人射杀玩家 A，玩家 A 是恋人
- **结果**：玩家 A 死亡（`hunter_shoot`），恋人另一方殉情（`lover_death`）

#### 场景 3：猎人开枪射杀恋人之一，恋人另一方也是猎人
- 猎人 A 射杀玩家 X（恋人），恋人另一方猎人 B 殉情
- **结果**：猎人 B 殉情（`lover_death`），猎人 B **不能开枪**

---

### 5.7 猎人 vs 义警（Vigilante）

| 场景 | 结果 |
|------|------|
| 义警夜晚射杀猎人 | 猎人死亡（`vigilante_kill`），触发开枪 |
| 猎人开枪射杀义警 | 义警死亡，无特殊交互 |

---

### 5.8 猎人 vs 猎人（双猎人场景）

| 场景 | 结果 |
|------|------|
| 猎人 A 开枪射杀猎人 B | 猎人 B 死亡（`hunter_shoot`），猎人 B 触发开枪，产生连锁 |
| 猎人 B 连锁开枪射杀猎人 A | ❌ 不可能（猎人 A 已死亡，不是合法目标） |

---

### 5.9 猎人 vs 队长（Captain）

| 场景 | 结果 |
|------|------|
| 猎人死亡且为队长 | 先处理猎人开枪，再处理队长转移 |
| 猎人射杀队长 | 队长死亡，需要进行队长转移 |
| 猎人是队长，被投票处决 | 开枪 → 连锁处理 → 队长转移 → 进入夜晚 |

---

## 6. Edge Cases（易错情境与正确结算）

### 6.1 猎人射杀恋人导致连锁死亡

- 猎人射杀玩家 A
- 玩家 A 是恋人之一 → 恋人 B 殉情（`lover_death`）
- 若恋人 B 是猎人 → 殉情死亡，**不能开枪**（`lover_death` 优先）
- 若恋人 B 是队长 → 需要队长转移

**结算顺序**：
1. 玩家 A 死亡（`hunter_shoot`）
2. `_processDeathTriggers([A], 'hunter_shoot')` → 触发恋人殉情
3. 恋人 B 死亡（`lover_death`）
4. `_processDeathTriggers([B], 'lover_death')` → 猎人 B 不能开枪
5. 检查队长转移

---

### 6.2 猎人开枪在 DAY_ANNOUNCE 与投票处决后的不同处理

| 触发时机 | 处理逻辑 |
|----------|----------|
| `DAY_ANNOUNCE`（夜晚死亡） | 开枪 → 连锁 → 队长转移 → 恢复遗言/首位发言人流程 |
| 投票处决后 | 开枪 → 连锁 → 队长转移 → 进入夜晚（`PHASES.NIGHT`） |

在 `DAY_ANNOUNCE` 阶段，猎人开枪完成后的恢复逻辑：

```javascript
if (newState.phase === PHASES.DAY_ANNOUNCE && !newState.hunterPendingShoot) {
  if (this._checkCaptainTransferNeeded(newState)) {
    this._initiateCaptainTransfer(newState, helpers, PHASES.DAY_ANNOUNCE, 'after_hunter');
  } else {
    assignNightLastWords(newState);
    // 恢复遗言或首位发言人流程
  }
}
```

---

### 6.3 猎人被毒且 `hunterShootOnPoison = false`

- 女巫对猎人使用毒药
- `hunterShootOnPoison = false`
- **结果**：猎人死亡，角色强制公开（`forcedRevealRoleIds`），但**不设置** `hunterPendingShoot`
- 游戏流程正常继续，不等待猎人开枪

---

### 6.4 双猎人场景的连锁开枪

假设存在猎人 A 和猎人 B：

1. 狼人夜晚击杀猎人 A
2. 白天公告阶段，`hunterPendingShoot = A`
3. 猎人 A 选择射杀猎人 B
4. 猎人 B 死亡（`hunter_shoot`），触发 `_processDeathTriggers([B], 'hunter_shoot')`
5. `hunterPendingShoot` 更新为猎人 B 的 playerId
6. 等待猎人 B 选择射击目标
7. 猎人 B 射杀后，`hunterPendingShoot = null`，恢复正常流程

**注意**：猎人 B 不能射杀猎人 A（已死亡），避免死循环。

---

### 6.5 猎人是队长 —— 开枪后转移

- 猎人是队长，被投票处决
- 处决后触发 `_processDeathTriggers`，设置 `hunterPendingShoot`
- 猎人开枪射杀目标
- 清除 `hunterPendingShoot`
- **然后**检查队长转移（`_checkCaptainTransferNeeded`）
- 猎人死亡后将队长徽章转移给指定玩家

**关键**：开枪 → 连锁处理 → 队长转移，顺序不能颠倒。

---

### 6.6 猎人被投票处决，射杀的目标也是猎人且是队长

极端连锁场景：

1. 猎人 A（非队长）被投票处决 → 开枪
2. 猎人 A 射杀猎人 B（队长）
3. 猎人 B 死亡 → `hunterPendingShoot = B`
4. 猎人 B 开枪射杀玩家 C
5. 清除 `hunterPendingShoot`
6. 检查队长转移 → 猎人 B 是队长，需要转移
7. 进入 `CAPTAIN_TRANSFER` 阶段

---

### 6.7 猎人死亡但所有其他玩家也已死亡

- 猎人死亡触发开枪
- 但场上无存活的合法目标
- **处理**：`hunterPendingShoot` 被设置，但猎人无法提交合法的 `HUNTER_SHOOT`（所有目标验证失败）
- 此时应由胜利条件检查结束游戏

---

## 7. 测试场景清单

### 7.1 基础功能测试（1-8）

1. ✅ 猎人被狼人击杀后可以开枪
2. ✅ 猎人被投票处决后可以开枪
3. ✅ 猎人开枪射杀目标，目标死亡原因为 `hunter_shoot`
4. ✅ 猎人开枪后 `hunterPendingShoot` 清除为 `null`
5. ✅ 猎人未死亡时不能提交 `HUNTER_SHOOT`
6. ✅ 非猎人玩家不能提交 `HUNTER_SHOOT`（`hunterPendingShoot !== playerId`）
7. ✅ 猎人射杀目标必须存活（死亡目标验证失败）
8. ✅ 猎人射杀目标必须存在（不存在的 playerId 验证失败）

---

### 7.2 死亡触发条件测试（9-14）

9. ✅ 猎人被狼刀死亡 → 触发 `hunterPendingShoot`
10. ✅ 猎人被投票处决 → 触发 `hunterPendingShoot`
11. ✅ 猎人被义警射杀 → 触发 `hunterPendingShoot`
12. ✅ 猎人被女巫毒杀（`hunterShootOnPoison = false`） → 不触发
13. ✅ 猎人被女巫毒杀（`hunterShootOnPoison = true`） → 触发
14. ✅ 猎人殉情死亡（`lover_death`） → 不触发

---

### 7.3 角色强制公开测试（15-18）

15. ✅ 猎人被狼刀死亡 → `forcedRevealRoleIds[hunterId] = true`
16. ✅ 猎人被女巫毒杀 → `forcedRevealRoleIds[hunterId] = true`
17. ✅ 猎人被投票处决 → 不强制公开（遵循 `revealRolesOnDeath` 配置）
18. ✅ 其他玩家可以通过 `forcedRevealRoleIds` 看到猎人角色

---

### 7.4 流程控制测试（19-23）

19. ✅ `hunterPendingShoot` 非空时 `PHASE_ADVANCE` 被拒绝
20. ✅ 猎人在 `DAY_ANNOUNCE` 开枪后恢复遗言流程
21. ✅ 猎人在投票处决后开枪，然后进入夜晚
22. ✅ 猎人开枪后检查队长转移
23. ✅ 死亡玩家可以提交 `HUNTER_SHOOT`（`canDeadPlayerDoAction` 包含此类型）

---

### 7.5 角色交互测试（24-33）

24. ✅ 守卫守护猎人 + 狼刀猎人 → 猎人存活，不触发开枪
25. ✅ 医生保护猎人 + 狼刀猎人 → 猎人存活，不触发开枪
26. ✅ 女巫解药救猎人 → 猎人存活，不触发开枪
27. ✅ 义警射杀猎人 → 猎人死亡，触发开枪
28. ✅ 猎人射杀恋人之一 → 恋人另一方殉情
29. ✅ 猎人为恋人，恋人另一方死亡 → 猎人殉情，不能开枪
30. ✅ 猎人射杀恋人，恋人另一方为猎人 → 殉情猎人不能开枪
31. ✅ 猎人 A 射杀猎人 B → 猎人 B 触发开枪（连锁）
32. ✅ 猎人射杀队长 → 目标死亡后触发队长转移
33. ✅ 守卫守护猎人 + 女巫毒猎人 → 猎人死亡（守卫无法阻止毒药）

---

### 7.6 Edge Cases 测试（34-40）

34. ✅ 双猎人连锁：猎人 A 射杀猎人 B，猎人 B 继续开枪
35. ✅ 猎人是队长被处决 → 开枪 → 队长转移（顺序正确）
36. ✅ 猎人射杀恋人导致连锁殉情 + 队长转移
37. ✅ `hunterShootOnPoison = false` 时毒杀猎人不阻塞流程
38. ✅ 猎人被毒 + 被狼刀同夜 → 仅死亡一次，根据最终死因判断能否开枪
39. ✅ 猎人开枪射杀的目标同时死于其他原因 → 不重复死亡
40. ✅ 游戏结束条件在猎人开枪连锁后正确检查

---

### 7.7 配置与验证测试（41-44）

41. ✅ `hunterShootOnPoison` 默认值为 `false`
42. ✅ 配置 `hunterShootOnPoison = true` 后女巫毒杀猎人可开枪
43. ✅ 无效目标提交返回 `{ valid: false, error: '目标无效' }`
44. ✅ 非猎人玩家提交返回 `{ valid: false, error: '你不能开枪' }`

---

**预计测试用例总数**：44 个

---

## 8. 配置建议

在 `frontend/src/games/werewolf/config.json` 中的相关配置项：

```json
{
  "rules": {
    "hunterShootOnPoison": false
  },
  "settingsSchema": {
    "hunterShootOnPoison": {
      "type": "boolean",
      "label": "猎人被毒可开枪",
      "description": "猎人被女巫毒死时是否能开枪",
      "default": false,
      "group": "hunter"
    }
  }
}
```

**配置分组**：猎人相关配置归属 `"hunter"` 分组（`settingsGroups` 中已定义）。

**扩展建议**：若未来需要更多猎人配置（如限制射击次数、是否允许射杀自己等），可在 `hunter` 分组中扩展。当前 P0 版本仅需 `hunterShootOnPoison` 一个配置项。

---

## 9. 实现检查清单

- [x] 在 `config.json` 的 `roles.p0` 中定义 `hunter` 角色（`actionTypes: ["HUNTER_SHOOT"]`）
- [x] 在 `config.json` 的 `rules` 和 `settingsSchema` 中添加 `hunterShootOnPoison` 配置项
- [x] 在 `index.js` 的 `ACTION_TYPES` 中注册 `HUNTER_SHOOT`
- [x] 在 `index.js` 的 `validateMove` 中实现 `HUNTER_SHOOT` 验证逻辑
- [x] 在 `index.js` 的 `processMove` 中实现 `HUNTER_SHOOT` 处理逻辑
- [x] 在 `index.js` 的 `_processDeathTriggers` 中实现猎人死亡触发判定
- [x] 在 `_processDeathTriggers` 中处理 `forcedRevealRoleIds`（狼刀/毒杀时强制公开角色）
- [x] 在 `rules.js` 的 `getActiveNightRoles` 中排除猎人（非夜晚行动角色）
- [x] 在 `game-phases.js` 的 `startDayAnnounce` 中处理猎人优先于遗言流程
- [x] 在 `PHASE_ADVANCE` 验证中检查 `hunterPendingShoot` 阻塞流程推进
- [x] 在 `processMove` 中猎人开枪后处理队长转移检查
- [x] 在 `canDeadPlayerDoAction` 中允许死亡玩家提交 `HUNTER_SHOOT`
- [ ] 在 `index.test.js` 中添加 44 个测试用例
- [ ] 手动测试验证所有 Edge Cases

---

## 10. UI 呈现与交互方式

### 选择模式

`single` — 仅当 `hunterPendingShoot === currentPlayerId` 时，通过环形座位图点击单个玩家头像选择射击目标。

猎人的选择界面**不在夜间面板**触发，而是在白天公告阶段或投票处决后触发。框架检测到 `hunterPendingShoot` 后，向对应玩家显示射击选择界面。

### 夜间面板内容

**不适用** — 猎人没有夜间行动面板。猎人在夜晚不参与行动序列，因此不显示夜间面板。

### 白天公告面板

当 `hunterPendingShoot === currentPlayerId` 时，在 `DAY_ANNOUNCE` 阶段显示猎人开枪提示面板：

- **提示信息**：告知猎人已死亡并可以开枪
- **目标选择**：通过环形布局选择一名存活玩家
- **当前选择**：若已点选目标，显示"已选择射杀: {玩家名}"
- **未选择提示**：显示"点击环形布局中的玩家头像选择要射杀的玩家"

### 操作栏按钮

- **确认开枪**：选择目标后启用
  - 按钮文案：`确认开枪`
  - 启用条件：`selectedTarget !== null`

### 徽章显示

无专属徽章。

### 可见状态字段

`_getVisibleRoleStates` 中暴露给猎人玩家：

- `hunterPendingShoot`: 当前等待开枪的猎人 playerId（全局可见，用于 UI 判断是否显示射击界面）

### 白天 UI 影响

当 `hunterPendingShoot` 有值时：

- 其他玩家看到"等待猎人开枪"的提示
- `PHASE_ADVANCE` 按钮被禁用
- 遗言和发言流程暂停

---

## 11. 参考资料

- **经典狼人杀规则**：[百度百科 - 狼人杀](https://baike.baidu.com/item/狼人杀)
- **猎人规则变体来源**：天黑请闭眼经典规则、狼人杀 Online
- **相关角色文档**：
  - 守卫（`bodyguard.md`）—— 保护交互
  - 义警（`vigilante.md`）—— 击杀交互
  - 丘比特（`cupid.md`）—— 恋人殉情交互
- **代码实现**：
  - `frontend/src/games/werewolf/index.js` — `_processDeathTriggers`, `processMove`
  - `frontend/src/games/werewolf/rules.js` — `getActiveNightRoles`
  - `frontend/src/games/werewolf/game-phases.js` — `startDayAnnounce`
  - `frontend/src/games/werewolf/config.json` — 角色定义和配置项

---

**文档版本**：v1.0
**创建日期**：2026-02-22
**作者**：AI-assisted
**待审核**：✅ 请确认规则设定是否符合预期
