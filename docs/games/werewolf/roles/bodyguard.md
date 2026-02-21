# 守卫 (Bodyguard)

## 1. 角色基本信息

| 属性 | 值 |
|------|-----|
| **角色 ID** | `bodyguard` |
| **中文名称** | 守卫 |
| **英文名称** | Bodyguard / Guardian |
| **阵营** | `village` (好人阵营) |
| **优先级** | `P1` (进阶角色) |
| **夜晚行动** | `NIGHT_BODYGUARD_PROTECT` |
| **胜利条件** | 消灭所有狼人 |
| **行动时机** | 每个夜晚（在狼人击杀之前） |

---

## 2. 核心规则

### 2.1 基本功能

- **每夜守护**：守卫在每个夜晚行动一次
- **选择目标**：可以选择一名存活玩家进行守护（是否包括自己取决于配置）
- **保护效果**：如果被守护的玩家当晚被狼人袭击（`NIGHT_WOLF_KILL`），该玩家不会死亡
- **优先级**：守卫的保护行动在狼人击杀**之前**执行（priority 7 vs 8）

### 2.2 保护机制

守卫的保护仅对**狼人击杀**生效，不能阻止：
- 女巫的毒药（`NIGHT_WITCH_POISON`）
- 义警的射杀（`NIGHT_VIGILANTE_KILL`）
- 其他非狼刀的致死效果

---

## 3. 可选规则设定

守卫的行为受以下游戏配置影响：

### 3.1 是否允许自守 (`bodyguardCanSelfProtect`)

| 配置值 | 行为 |
|--------|------|
| `true` | 守卫可以守护自己 |
| `false` | 守卫只能守护其他玩家 |

**推荐默认值**: `true` （初级局）/ `false` （进阶局）

**验证逻辑**：
- 当 `bodyguardCanSelfProtect = false` 时，`targetId === playerId` 返回验证错误

---

### 3.2 是否允许连续守护同一人 (`bodyguardCanRepeat`)

| 配置值 | 行为 |
|--------|------|
| `true` | 守卫可以连续多晚守护同一名玩家 |
| `false` | 守卫不能连续两晚守护同一名玩家 |

**推荐默认值**: `false` （防止守卫一直守护关键角色如预言家）

**验证逻辑**：
- 记录上一晚的守护目标 `lastProtectedId`
- 当 `bodyguardCanRepeat = false` 且 `targetId === lastProtectedId` 时，返回验证错误

---

### 3.3 守卫与女巫解药的交互 (`guardWitchInteraction`)

| 配置值 | 行为 |
|--------|------|
| `"coexist"` | 守卫保护 + 女巫解药可以共存，两者都生效 |
| `"conflict"` | 守卫保护 + 女巫解药同时作用时，目标反而死亡（**守药同死**） |

**推荐默认值**: `"coexist"` （经典版）/ `"conflict"` （进阶局）

**结算逻辑**（在 `resolveNightActions` 中）：

```javascript
// 伪代码示例
const isProtectedByGuard = nightActions.some(
  a => a.actionType === 'NIGHT_BODYGUARD_PROTECT' && a.targetId === victimId
);
const isSavedByWitch = nightActions.some(
  a => a.actionType === 'NIGHT_WITCH_SAVE' && a.targetId === victimId
);

if (isProtectedByGuard && isSavedByWitch) {
  if (guardWitchInteraction === 'conflict') {
    // 守药同死：目标仍然死亡
    victimSurvives = false;
  } else {
    // 守药共存：目标存活
    victimSurvives = true;
  }
} else if (isProtectedByGuard || isSavedByWitch) {
  // 仅一方保护：目标存活
  victimSurvives = true;
}
```

---

## 4. 夜晚行动优先级分析

根据 `RULES.md` 的夜晚行动优先级表：

| 优先级 | 角色 | 操作 |
|--------|------|------|
| 7 | **Doctor / Bodyguard / Guardian Angel** | 保护 |
| 8 | Werewolf | 击杀 |
| 10 | Witch | 救人/毒杀 |

### 优先级设计理由

1. **守卫先于狼刀（7 < 8）**：
   - 守卫的保护是"预设屏障"，在狼刀执行前生效
   - 当狼人选择目标时，守卫已经完成守护设置

2. **守卫先于女巫（7 < 10）**：
   - 女巫在狼刀结算后才得知被刀目标
   - 女巫可以看到"被狼刀但被守卫保护"的结果
   - 女巫可以选择是否对已被守卫保护的目标使用解药（取决于 `guardWitchInteraction` 配置）

3. **与医生同级（priority 7）**：
   - 守卫和医生的保护机制类似（都是预设保护）
   - 在本实现中，守卫是"村民阵营的保护角色"，医生是 P0 版本，守卫是 P1 增强版
   - 如果同时存在，两者保护不冲突（都生效）

---

## 5. 与现有 P0 角色的交互

### 5.1 守卫 vs 狼人（Werewolf）

| 场景 | 结果 |
|------|------|
| 守卫守护玩家 A，狼人击杀玩家 A | 玩家 A **存活** |
| 守卫守护玩家 A，狼人击杀玩家 B | 玩家 B **死亡**（守卫保护无效） |
| 守卫死亡，无法守护 | 当晚无守卫保护 |

---

### 5.2 守卫 vs 女巫（Witch）

#### 场景 1：守卫保护成功，女巫未行动
- 狼人击杀玩家 A
- 守卫守护玩家 A
- 女巫看到："玩家 A 被刀但未死"（或"无人死亡"，取决于实现）
- **结果**：玩家 A 存活，女巫可以保留解药

#### 场景 2：守卫保护 + 女巫解药（`guardWitchInteraction = "coexist"`）
- 狼人击杀玩家 A
- 守卫守护玩家 A
- 女巫使用解药救玩家 A
- **结果**：玩家 A 存活（两者不冲突）

#### 场景 3：守卫保护 + 女巫解药（`guardWitchInteraction = "conflict"`）
- 狼人击杀玩家 A
- 守卫守护玩家 A
- 女巫使用解药救玩家 A
- **结果**：玩家 A **死亡**（守药同死）

#### 场景 4：女巫毒药 vs 守卫保护
- 女巫对玩家 B 使用毒药
- 守卫守护玩家 B
- **结果**：玩家 B **死亡**（守卫无法阻止毒药）

---

### 5.3 守卫 vs 预言家（Seer）

- **无直接交互**
- 预言家可以查验守卫，结果为"好人"
- 守卫可以守护预言家，保护其不被狼刀

---

### 5.4 守卫 vs 医生（Doctor）

| 场景 | 结果 |
|------|------|
| 守卫守护玩家 A，医生保护玩家 A，狼人击杀 A | 玩家 A **存活**（两者保护叠加，不冲突） |
| 守卫守护玩家 A，医生保护玩家 B，狼人击杀 A | 玩家 A **存活**（守卫保护生效） |
| 守卫守护玩家 A，医生保护玩家 B，狼人击杀 B | 玩家 B **存活**（医生保护生效） |

**注意**：守卫和医生的规则设定应保持一致（如是否允许自守、是否允许连续守护同一人）

---

### 5.5 守卫 vs 猎人（Hunter）

#### 场景 1：守卫保护猎人，狼人击杀猎人
- 狼人击杀猎人
- 守卫守护猎人
- **结果**：猎人存活，**不触发开枪**

#### 场景 2：女巫毒死守卫保护的猎人
- 女巫对猎人使用毒药
- 守卫守护猎人
- **结果**：猎人死亡（毒药无视守卫），**触发开枪**

#### 场景 3：守卫被猎人误杀
- 守卫白天被投票处决 / 被女巫毒杀 / 被狼刀（未被保护）
- 猎人开枪选择守卫
- **结果**：守卫死亡（无特殊交互）

---

### 5.6 守卫 vs 村民（Villager）

- **无直接交互**
- 守卫可以守护村民

---

## 6. Edge Cases（易错情境与正确结算）

### 6.1 守卫自守与连续守护的组合

| `bodyguardCanSelfProtect` | `bodyguardCanRepeat` | 场景 | 是否合法 |
|---------------------------|----------------------|------|----------|
| `true` | `true` | 守卫连续 3 晚守护自己 | ✅ 合法 |
| `true` | `false` | 守卫连续 2 晚守护自己 | ❌ 非法（第 2 晚验证失败） |
| `false` | `true` | 守卫第 1 晚守护自己 | ❌ 非法（验证失败） |
| `false` | `false` | 守卫第 1 晚守护玩家 A，第 2 晚守护玩家 A | ❌ 非法（第 2 晚验证失败） |

**验证顺序**：
1. 先检查 `bodyguardCanSelfProtect`
2. 再检查 `bodyguardCanRepeat`

---

### 6.2 狼人平票导致无人被刀

| 场景 | 结果 |
|------|------|
| 狼人投票平票（或全部弃票），当晚无人被狼刀 | 守卫的保护无效（无攻击事件） |
| 女巫看到"无人被刀" | 女巫不能使用解药（无目标） |

---

### 6.3 守卫保护的玩家被多种方式攻击

| 攻击方式 | 是否被守卫阻止 |
|----------|----------------|
| 狼人击杀 (`NIGHT_WOLF_KILL`) | ✅ 是 |
| 女巫毒药 (`NIGHT_WITCH_POISON`) | ❌ 否 |
| 义警射杀 (`NIGHT_VIGILANTE_KILL`) | ❌ 否 |
| 炸弹人反杀 (`bomb` 触发) | ❌ 否 |

**场景示例**：
- 狼人击杀玩家 A
- 守卫守护玩家 A
- 女巫对玩家 A 使用毒药
- **结果**：玩家 A 死亡（守卫只阻止了狼刀，毒药仍然生效）

---

### 6.4 守卫死亡与保护失效

| 场景 | 结果 |
|------|------|
| 守卫第 2 晚被狼刀死亡 | 第 2 晚无守卫保护行动（在狼刀前已死亡则无法行动） |
| 守卫第 1 晚被女巫毒死 | 第 1 晚守卫已完成行动（priority 7 < 10），保护仍然生效 |
| 守卫白天被投票处决 | 下一晚无守卫保护 |

**重要**：夜晚行动是"并发提交，按优先级结算"，守卫在死亡前可以提交行动。

---

### 6.5 守药同死的多种触发情况

**前提**：`guardWitchInteraction = "conflict"`

| 场景 | 是否触发守药同死 | 结果 |
|------|------------------|------|
| 守卫守护 A + 女巫解药救 A（A 被狼刀） | ✅ 是 | A 死亡 |
| 守卫守护 A + 女巫解药救 B（A 被狼刀） | ❌ 否 | A 存活，B 无事件 |
| 守卫守护 A + 医生保护 A（A 被狼刀） | ❌ 否 | A 存活（守卫+医生不冲突） |
| 守卫守护 A + 女巫毒药杀 A | ❌ 否 | A 死于毒药（守卫无效，无守药交互） |

**守药同死的精确条件**：
1. `guardWitchInteraction = "conflict"`
2. 目标被狼刀
3. 守卫守护该目标
4. 女巫对该目标使用解药
5. **四个条件同时满足**

---

### 6.6 守卫被狼刀，守卫守护的猎人被女巫毒

| 事件 | 优先级 | 结果 |
|------|--------|------|
| 守卫守护猎人 | 7 | 设置保护标记 |
| 狼人击杀守卫 | 8 | 守卫死亡 |
| 女巫毒杀猎人 | 10 | 猎人死亡（守卫保护无法阻止毒药） |

**第 2 天白天**：
- 公布死亡：守卫 + 猎人
- 猎人触发开枪（猎人死于毒药，触发被动技能）

---

### 6.7 守卫连续守护边界情况

**场景**：守卫第 1 晚守护玩家 A，第 2 晚玩家 A 死亡（被女巫毒死），第 3 晚守卫能否再次守护 A？

| `bodyguardCanRepeat` | 玩家 A 状态 | 第 3 晚能否守护 A |
|----------------------|-------------|-------------------|
| `false` | 死亡 | ⚠️ **不适用**（A 已死亡，无法选为目标） |
| `false` | 存活 | ❌ 否（上次守护目标是 A） |
| `true` | 存活 | ✅ 是 |

**验证逻辑**：
- 先验证目标存活
- 再检查 `lastProtectedId`（记录的是"上一晚守护的玩家 ID"，即使该玩家后续死亡）

---

### 6.8 守卫 + 医生 + 女巫三重保护

| 配置 | 场景 | 结果 |
|------|------|------|
| `guardWitchInteraction = "coexist"` | 守卫守护 A + 医生保护 A + 女巫解药救 A（A 被狼刀） | A 存活（三重保护不冲突） |
| `guardWitchInteraction = "conflict"` | 守卫守护 A + 医生保护 A + 女巫解药救 A（A 被狼刀） | ⚠️ **未定义行为**（需明确：守药冲突是否考虑医生？） |

**推荐解决方案**：
- `guardWitchInteraction = "conflict"` 只检测 **守卫 + 女巫**，医生保护不参与冲突判定
- 结算优先级：医生保护 → 守卫保护 → 女巫解药 → 判定守药冲突

---

## 7. 测试场景清单

### 7.1 基础功能测试（6 个用例）

1. ✅ 守卫守护成功阻止狼刀
2. ✅ 守卫守护无效（狼刀目标不是守卫保护的玩家）
3. ✅ 守卫守护无法阻止女巫毒药
4. ✅ 守卫自守（`bodyguardCanSelfProtect = true`）
5. ✅ 守卫自守被拒绝（`bodyguardCanSelfProtect = false`）
6. ✅ 守卫死亡后无法行动

---

### 7.2 连续守护测试（4 个用例）

7. ✅ 守卫连续两晚守护同一人（`bodyguardCanRepeat = true`）
8. ✅ 守卫连续两晚守护同一人被拒绝（`bodyguardCanRepeat = false`）
9. ✅ 守卫第 1 晚守护 A，第 2 晚守护 B，第 3 晚再守护 A（`bodyguardCanRepeat = false`）
10. ✅ 守卫连续自守被拒绝（`bodyguardCanSelfProtect = true, bodyguardCanRepeat = false`）

---

### 7.3 守药交互测试（6 个用例）

11. ✅ 守卫保护 + 女巫解药共存（`guardWitchInteraction = "coexist"`）
12. ✅ 守卫保护 + 女巫解药冲突（`guardWitchInteraction = "conflict"`）
13. ✅ 守卫保护生效，女巫未行动
14. ✅ 女巫解药生效，守卫未守护该目标
15. ✅ 守卫守护 A + 女巫解药救 B（不同目标，无冲突）
16. ✅ 守卫保护 + 女巫毒药（守卫无法阻止毒药）

---

### 7.4 与其他 P0 角色交互测试（5 个用例）

17. ✅ 守卫守护预言家，狼刀预言家 → 预言家存活
18. ✅ 守卫守护猎人，狼刀猎人 → 猎人存活，不触发开枪
19. ✅ 守卫守护猎人，女巫毒猎人 → 猎人死亡并开枪
20. ✅ 守卫 + 医生同时保护同一目标 → 目标存活（双重保护不冲突）
21. ✅ 守卫被狼刀，医生保护守卫 → 守卫存活

---

### 7.5 Edge Cases 测试（8 个用例）

22. ✅ 狼人平票无人被刀，守卫保护无效
23. ✅ 守卫守护的玩家同时被狼刀 + 女巫毒 → 死于毒药
24. ✅ 守卫第 1 晚被女巫毒死，第 1 晚的保护仍生效
25. ✅ 守卫连续守护边界：第 2 晚目标死亡，第 3 晚能否再守护（验证目标存活）
26. ✅ 守卫守护 A + 医生保护 A + 女巫解药救 A（三重保护，`guardWitchInteraction = "coexist"`）
27. ✅ 守卫守护 A + 医生保护 A + 女巫解药救 A（三重保护，`guardWitchInteraction = "conflict"`）
28. ✅ 守卫选择无效目标（死亡玩家/不存在的 playerId）→ 验证失败
29. ✅ 守卫在非夜晚阶段提交行动 → 验证失败

---

### 7.6 多轮游戏测试（3 个用例）

30. ✅ 守卫连续 5 晚守护不同目标，均成功
31. ✅ 守卫守护序列：A → B → A → C（`bodyguardCanRepeat = false`）
32. ✅ 守卫在游戏中被处决，后续无保护行动

---

**预计测试用例总数**：32 个

---

## 8. 配置建议

在 `frontend/src/games/werewolf/config.json` 中新增以下配置项：

```json
{
  "rules": {
    "bodyguardCanSelfProtect": true,
    "bodyguardCanRepeat": false,
    "guardWitchInteraction": "coexist"
  },
  "settingsSchema": {
    "bodyguardCanSelfProtect": {
      "type": "boolean",
      "label": "守卫能否自守",
      "description": "守卫是否可以守护自己",
      "default": true
    },
    "bodyguardCanRepeat": {
      "type": "boolean",
      "label": "守卫能否连续守护同一人",
      "description": "守卫是否可以连续两晚守护同一名玩家",
      "default": false
    },
    "guardWitchInteraction": {
      "type": "select",
      "label": "守卫与女巫解药的交互",
      "description": "守卫保护 + 女巫解药同时作用时的结算方式",
      "options": [
        { "value": "coexist", "label": "共存（两者都生效，目标存活）" },
        { "value": "conflict", "label": "冲突（守药同死，目标死亡）" }
      ],
      "default": "coexist"
    }
  }
}
```

---

## 9. 实现检查清单

- [ ] 在 `config.json` 的 `roles.p1` 中添加 `bodyguard` 角色定义
- [ ] 在 `config.json` 的 `nightActionPriority` 中设置 `bodyguard` 为 priority 7
- [ ] 在 `config.json` 的 `rules` 和 `settingsSchema` 中添加 3 个配置项
- [ ] 在 `rules.js` 中实现 `validateBodyguardAction` 函数（检查自守、连续守护）
- [ ] 在 `game-phases.js` 的 `resolveNightActions` 中添加守卫保护逻辑
- [ ] 在 `game-phases.js` 中处理 `guardWitchInteraction` 的守药冲突逻辑
- [ ] 在 `ui-panels-night.js` 中复用现有的目标选择器（与医生类似）
- [ ] 在 `index.test.js` 中添加 32 个测试用例
- [ ] 更新 `RULES.md` 的 Section 10（特殊规则）添加守药同死说明
- [ ] 手动测试验证所有 Edge Cases

---

## 10. UI 呈现与交互方式

### 选择模式

`single` — 通过环形座位图点击单个玩家头像选择守护目标。

守卫已在 `roleHasNightAction()` 中注册，框架自动通过 `_getNightSelectionConfig()` 提供环形单选。

### 夜间面板内容

面板文件：`ui-panels-roles.js` → `renderBodyguardPanel(ctx)`

显示内容：

- **上次守护信息**：若 `bodyguardLastProtect` 有值，显示"昨晚守护: {玩家名}"
- **连续守护限制提示**：若 `allowRepeatedProtect` 为 false，显示"(今晚不可再选)"
- **当前选择**：若已点选目标，显示"已选择守护: {玩家名}"
- **未选择提示**：显示"点击环形布局中的玩家头像选择要守护的玩家"

### 操作栏按钮

- **确认行动**：选择目标后启用
  - 按钮文案：`确认行动`
  - 启用条件：`selectedTarget !== null`

### 徽章显示

无专属徽章。

### 可见状态字段

`_getVisibleRoleStates` 中暴露给守卫玩家：

- `bodyguardLastProtect`: 上一晚守护的目标 ID

### 白天 UI 影响

无特殊白天 UI 变化。

---

## 11. 参考资料

- **经典狼人杀规则**：[百度百科 - 狼人杀](https://baike.baidu.com/item/狼人杀)
- **守药同死规则来源**：天黑请闭眼进阶规则、狼人杀 Online
- **类似角色**：医生（P0）、守护天使（P2）、狼人守卫（P3）

---

**文档版本**：v1.0
**创建日期**：2026-02-15
**作者**：AI-assisted
**待审核**：✅ 请确认规则设定是否符合预期
