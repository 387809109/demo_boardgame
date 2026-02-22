# 狼人 (Werewolf)

## 1. 角色基本信息

| 属性 | 值 |
|------|-----|
| **角色 ID** | `werewolf` |
| **中文名称** | 狼人 |
| **英文名称** | Werewolf |
| **阵营** | `werewolf` (狼人阵营) |
| **优先级** | `P0` (基础角色) |
| **夜晚行动** | `NIGHT_WOLF_KILL` (另有 `NIGHT_WOLF_TENTATIVE` 用于 UI 协调) |
| **胜利条件** | 狼人数量 >= 村民数量（胜利优先级 5，最低） |
| **行动时机** | 每个夜晚（在医生/守卫之后，女巫之前） |

---

## 2. 核心规则

### 2.1 合议击杀机制

狼人是唯一采用**多人合议**机制的角色。所有存活狼人在同一夜晚步骤中行动：

- **投票记录**：每位狼人提交 `NIGHT_WOLF_KILL`，指定击杀目标，记录在 `wolfVotes[playerId]` 中
- **共识判定**：由 `resolveWolfConsensus()` 统计所有狼人投票，票数最高且唯一的目标被击杀
- **平票处理**：若最高票数有多个目标（平票），返回 `null`，当晚无人被狼刀
- **全部弃票**：所有狼人弃票（`targetId = null`）时，同样无人被击杀

```javascript
// resolveWolfConsensus 伪代码
function resolveWolfConsensus(state) {
  const wolfVotes = state.wolfVotes || {};
  const voteCounts = {};

  for (const [wolfId, targetId] of Object.entries(wolfVotes)) {
    if (targetId === null) continue; // 弃票不计入
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }

  const entries = Object.entries(voteCounts);
  if (entries.length === 0) return null; // 无有效票

  const maxVotes = Math.max(...entries.map(([, c]) => c));
  const topTargets = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);

  if (topTargets.length > 1) return null; // 平票 = 无击杀
  return topTargets[0];
}
```

### 2.2 拟投票（Tentative Vote）

为了支持狼人之间的协调沟通，引入 `NIGHT_WOLF_TENTATIVE` 动作：

- **功能**：预览性投票，让队友看到自己的意向，但**不消耗行动次数**
- **记录位置**：`wolfTentativeVotes[playerId]`，与正式投票 `wolfVotes[playerId]` 分开存储
- **可反复修改**：拟投票可以多次提交、随时更改
- **不参与结算**：`resolveWolfConsensus()` 只读取 `wolfVotes`，不读取 `wolfTentativeVotes`
- **提交正式票后**：`NIGHT_WOLF_KILL` 提交时，对应的 `wolfTentativeVotes[playerId]` 会被删除

### 2.3 狼人互相可见

- 所有狼人互相知晓身份，通过 `wolfTeamIds` 字段暴露给狼人阵营玩家
- `wolfTeamIds` 列出所有同阵营狼人的 playerId 数组
- 非狼人玩家的 `wolfTeamIds` 为 `null`，无法看到狼人身份
- 此可见性在游戏全程有效（不限于夜晚）

### 2.4 弃票机制

- 狼人可以通过 `NIGHT_SKIP` 提交弃票，记录 `wolfVotes[playerId] = null`
- 弃票的投票不计入 `resolveWolfConsensus()` 的统计
- 弃票后同样会删除对应的 `wolfTentativeVotes[playerId]`

---

## 3. 可选规则设定

狼人角色本身没有专属配置项，但受以下全局配置影响：

### 3.1 守卫与女巫解药的交互 (`guardWitchInteraction`)

| 配置值 | 行为 |
|--------|------|
| `"coexist"` | 守卫保护 + 女巫解药可以共存，狼刀目标存活 |
| `"conflict"` | 守卫保护 + 女巫解药同时作用时，目标反而死亡（守药同死） |

此配置间接影响狼人击杀的最终结算结果。

### 3.2 角色数量配置

狼人的数量由 `defaultRoleCounts` 决定，随玩家人数缩放：

| 玩家人数 | 狼人数量 |
|----------|----------|
| 6-7 人 | 2 |
| 8-9 人 | 2 |
| 10-11 人 | 3 |
| 12-14 人 | 3 |
| 15-20 人 | 4 |

---

## 4. 夜晚行动优先级分析

根据 `config.json` 的 `nightActionPriority` 表：

| 优先级 | 角色 | 操作 |
|--------|------|------|
| 5 | Seer / Detective | 查验 |
| 7 | Doctor / Bodyguard / Guardian Angel | 保护 |
| **8** | **Werewolf** | **击杀** |
| 9 | Vigilante / Serial Killer | 射杀/击杀 |
| 10 | Witch | 救人/毒杀 |
| 11 | Piper | 魅惑 |

### 优先级设计理由

1. **狼人在保护之后（8 > 7）**：
   - 医生/守卫的保护是"预设屏障"，在狼刀执行前已生效
   - 狼刀执行时，保护标记已存在，结算时判断是否被阻止

2. **狼人在女巫之前（8 < 10）**：
   - 女巫需要先知道"谁被狼刀"才能决定是否救人
   - 狼人投票结果 `resolveWolfConsensus()` 先结算，女巫再看到被刀目标

3. **多狼同步行动（grouped by priority 8）**：
   - 所有狼人共享 priority 8，在同一步骤中行动
   - 框架按 priority 分组，同组角色并行提交，统一结算
   - 不存在"先后顺序"问题，所有狼人的投票一起计入共识

---

## 5. 与现有角色的交互

### 5.1 狼人 vs 医生（Doctor）

| 场景 | 结果 |
|------|------|
| 狼人击杀玩家 A，医生保护玩家 A | 玩家 A **存活**（医生保护生效） |
| 狼人击杀玩家 A，医生保护玩家 B | 玩家 A **死亡**（医生保护无效） |
| 狼人击杀医生，医生自守 | 医生存活（取决于 `allowDoctorSelfProtect` 配置） |

---

### 5.2 狼人 vs 守卫（Bodyguard）

| 场景 | 结果 |
|------|------|
| 狼人击杀玩家 A，守卫守护玩家 A | 玩家 A **存活**（守卫保护生效） |
| 狼人击杀玩家 A，守卫守护玩家 B | 玩家 A **死亡**（守卫保护无效） |
| 狼人击杀守卫 | 守卫死亡（除非被其他角色保护） |

---

### 5.3 狼人 vs 女巫（Witch）

#### 场景 1：女巫解药救人
- 狼人击杀玩家 A
- 女巫使用解药救玩家 A
- **结果**：玩家 A **存活**

#### 场景 2：女巫解药 + 守卫保护（`guardWitchInteraction = "coexist"`）
- 狼人击杀玩家 A
- 守卫守护玩家 A + 女巫解药救玩家 A
- **结果**：玩家 A **存活**（两者不冲突）

#### 场景 3：女巫解药 + 守卫保护（`guardWitchInteraction = "conflict"`）
- 狼人击杀玩家 A
- 守卫守护玩家 A + 女巫解药救玩家 A
- **结果**：玩家 A **死亡**（守药同死）

#### 场景 4：狼刀未命中，女巫无法救人
- 狼人平票，当晚无人被刀
- **结果**：女巫看到"无人被刀"，不能使用解药

---

### 5.4 狼人 vs 预言家（Seer）

| 场景 | 结果 |
|------|------|
| 预言家查验狼人 | 查验结果为**狼人**（werewolf 阵营） |
| 狼人击杀预言家 | 预言家死亡（除非被保护） |

---

### 5.5 狼人 vs 猎人（Hunter）

| 场景 | 结果 |
|------|------|
| 狼人击杀猎人（无保护） | 猎人死亡，**触发开枪**被动技能 |
| 狼人击杀猎人，但猎人被守卫/医生保护 | 猎人存活，**不触发**开枪 |
| 猎人被女巫毒死（非狼刀） | 猎人死亡并开枪（与狼人无关） |

---

### 5.6 狼人 vs 守卫 + 医生双重保护

| 场景 | 结果 |
|------|------|
| 狼人击杀 A，守卫守护 A + 医生保护 A | A **存活**（双重保护不冲突，任一即生效） |

---

### 5.7 狼人 vs 义警（Vigilante）

| 场景 | 结果 |
|------|------|
| 义警夜间射杀狼人 | 狼人死亡（义警 priority 9 > 狼人 priority 8，但结算独立） |
| 狼人击杀义警 | 义警死亡（除非被保护） |
| 狼人击杀玩家 A，同夜义警射杀玩家 B | 两人各自死亡，互不影响 |

---

### 5.8 狼人 vs 丘比特（Cupid）恋人机制

| 场景 | 结果 |
|------|------|
| 狼人击杀恋人之一 | 恋人殉情，另一恋人也死亡 |
| 狼人本身是恋人之一 | 狼人 team 变为 `lovers`，胜利条件改为恋人胜利 |

---

### 5.9 狼人 vs 村民（Villager）

- **无直接交互**
- 村民是狼人的主要猎杀目标

---

## 6. Edge Cases（易错情境与正确结算）

### 6.1 狼人投票平票

| 场景 | 结果 |
|------|------|
| 2 狼：狼 A 投玩家 X，狼 B 投玩家 Y | **平票**，`resolveWolfConsensus()` 返回 `null`，当晚无人被刀 |
| 3 狼：狼 A 投 X，狼 B 投 Y，狼 C 投 Z | **三方平票**，无人被刀 |
| 3 狼：狼 A 投 X，狼 B 投 X，狼 C 投 Y | 狼 X 获 2 票，**共识达成**，X 被击杀 |

---

### 6.2 所有狼人弃票

| 场景 | 结果 |
|------|------|
| 所有狼人提交 `NIGHT_SKIP`（`wolfVotes[id] = null`） | `voteCounts` 为空，返回 `null`，无人被刀 |
| 部分弃票 + 部分投票 | 只计有效投票，按正常共识规则结算 |
| 部分弃票 + 剩余平票 | 返回 `null`，无人被刀 |

---

### 6.3 仅剩单只狼人

| 场景 | 结果 |
|------|------|
| 仅 1 狼存活，投票击杀目标 | 独票即共识，目标被击杀 |
| 仅 1 狼存活，弃票 | 无人被刀 |
| 仅 1 狼存活，拟投票后未确认 | 拟投票不参与结算，视为未提交，当晚无人被刀 |

---

### 6.4 狼人击杀恋人伴侣

| 场景 | 结果 |
|------|------|
| 狼人击杀恋人 A，恋人 B 是队友狼人 | A 死亡 → B 殉情死亡（即使 B 是狼人） |
| 狼人击杀恋人 A，恋人 B 是村民 | A 死亡 → B 殉情死亡 |
| 恋人狼 B 对恋人 A 投了击杀票 | 投票有效，但 A 死亡后 B 也殉情 |

**注意**：殉情机制在结算时自动触发，不依赖狼人是否知道恋人身份。

---

### 6.5 狼人被义警同夜射杀

| 场景 | 结果 |
|------|------|
| 义警射杀狼人 A，狼人 A 当晚已投票击杀目标 | 狼人 A 的投票仍然有效（夜晚行动并发提交，按优先级结算） |
| 义警射杀狼人 A，只有 A 一只狼 | A 的投票生效（priority 8 < 9，但行动已提交），击杀目标死亡；A 也死亡 |
| 义警射杀狼人 A，另有狼人 B 存活 | A 的投票仍计入共识统计 |

**重要**：夜晚行动是"并发提交，按优先级结算"，狼人在被击杀前已提交行动，其投票参与共识计算。

---

### 6.6 狼人目标被多重击杀

| 攻击来源 | 是否被保护阻止 |
|----------|----------------|
| 狼人击杀 (`NIGHT_WOLF_KILL`) | ✅ 可被医生/守卫保护 |
| 女巫毒药 (`NIGHT_WITCH_POISON`) | ❌ 独立结算，不受保护阻止 |
| 义警射杀 (`NIGHT_VIGILANTE_KILL`) | ❌ 独立结算 |

**场景示例**：
- 狼人击杀玩家 A，义警也射杀玩家 A，守卫守护玩家 A
- **结果**：守卫阻止狼刀，但义警射杀生效，玩家 A **死亡**

---

### 6.7 `NIGHT_WOLF_TENTATIVE` 与 `NIGHT_WOLF_KILL` 的时序

| 操作序列 | 结果 |
|----------|------|
| 狼人先拟投票 X，再确认击杀 X | `wolfTentativeVotes` 被删除，`wolfVotes` 记录 X |
| 狼人先拟投票 X，再确认击杀 Y | `wolfTentativeVotes` 被删除，`wolfVotes` 记录 Y |
| 狼人拟投票 X，未确认 | `wolfTentativeVotes` 保留 X，`wolfVotes` 无记录，不参与结算 |
| 狼人确认击杀后再次拟投票 | 拟投票无效（已提交正式投票后不可再变更） |

---

## 7. 测试场景清单

### 7.1 基础功能测试（6 个用例）

1. ✅ 单只狼人击杀目标成功（独票即共识）
2. ✅ 多只狼人全部投同一目标，目标被击杀
3. ✅ 狼人不能对同阵营狼人提交 `NIGHT_WOLF_KILL`（目标为队友时验证失败）
4. ✅ 非狼人角色提交 `NIGHT_WOLF_KILL` 被拒绝
5. ✅ 非狼人角色提交 `NIGHT_WOLF_TENTATIVE` 被拒绝
6. ✅ 狼人对已死亡目标提交 `NIGHT_WOLF_KILL` 被拒绝

---

### 7.2 共识机制测试（6 个用例）

7. ✅ 2 狼投票一致 → 目标被击杀
8. ✅ 2 狼投票不一致（平票）→ 无人被刀
9. ✅ 3 狼中 2 狼投同一目标，1 狼投另一目标 → 多数目标被击杀
10. ✅ 3 狼三方平票 → 无人被刀
11. ✅ 所有狼人弃票 → 无人被刀
12. ✅ 部分狼人弃票 + 剩余投票一致 → 目标被击杀

---

### 7.3 拟投票测试（5 个用例）

13. ✅ 狼人提交 `NIGHT_WOLF_TENTATIVE`，记录在 `wolfTentativeVotes` 中
14. ✅ 狼人拟投票可以反复修改（多次提交 `NIGHT_WOLF_TENTATIVE`）
15. ✅ 拟投票 `targetId: null` 表示拟弃票，正确记录
16. ✅ 提交 `NIGHT_WOLF_KILL` 后，对应 `wolfTentativeVotes` 被删除
17. ✅ 仅有拟投票未确认时，`resolveWolfConsensus()` 不计入该狼人票数

---

### 7.4 可见性测试（5 个用例）

18. ✅ 狼人可以看到 `wolfTeamIds`（包含所有队友 ID）
19. ✅ 非狼人玩家的 `wolfTeamIds` 为 `null`
20. ✅ 狼人在夜晚可以看到 `wolfVotes`（队友的正式投票）
21. ✅ 狼人在夜晚可以看到 `wolfTentativeVotes`（队友的拟投票）
22. ✅ 非狼人玩家的 `wolfVotes` 和 `wolfTentativeVotes` 为空对象 `{}`

---

### 7.5 与其他角色交互测试（8 个用例）

23. ✅ 狼人击杀目标被医生保护 → 目标存活
24. ✅ 狼人击杀目标被守卫守护 → 目标存活
25. ✅ 狼人击杀目标被女巫解药救 → 目标存活
26. ✅ 预言家查验狼人 → 查验结果为"狼人"
27. ✅ 狼人击杀猎人（无保护）→ 猎人死亡，触发开枪
28. ✅ 狼人击杀猎人（被守卫保护）→ 猎人存活，不触发开枪
29. ✅ 守卫守护 + 女巫解药（`guardWitchInteraction = "conflict"`）→ 守药同死
30. ✅ 义警同夜射杀狼人，狼人的投票仍参与结算

---

### 7.6 Edge Cases 测试（6 个用例）

31. ✅ 狼人平票后女巫无法使用解药（无被刀目标）
32. ✅ 单只狼人弃票 → 无人被刀
33. ✅ 狼人击杀恋人 → 恋人伴侣殉情
34. ✅ 狼人自身是恋人，击杀恋人伴侣 → 自身殉情
35. ✅ 新一轮夜晚开始时 `wolfVotes` 和 `wolfTentativeVotes` 被重置为 `{}`
36. ✅ 狼人选择无效目标（不存在的 playerId）→ 验证失败

---

### 7.7 多轮游戏测试（2 个用例）

37. ✅ 连续 3 轮狼人合议击杀不同目标，均正确结算
38. ✅ 狼人在游戏过程中逐渐减少（被处决/射杀），共识机制自动适应

---

**预计测试用例总数**：38 个

---

## 8. 配置建议

狼人角色本身无专属配置项。在 `frontend/src/games/werewolf/config.json` 中的相关配置如下：

### 8.1 角色定义（已存在）

```json
{
  "roles": {
    "p0": {
      "werewolf": {
        "id": "werewolf",
        "name": "狼人",
        "team": "werewolf",
        "priority": "P0",
        "actionTypes": ["NIGHT_WOLF_KILL"],
        "description": "夜晚与其他狼人合议击杀一人",
        "winCondition": "狼人数量达到或超过村民"
      }
    }
  }
}
```

### 8.2 夜晚行动优先级（已存在）

```json
{
  "nightActionPriority": [
    { "priority": 8, "roles": ["werewolf"], "description": "击杀" }
  ]
}
```

### 8.3 影响狼人结算的全局配置

```json
{
  "rules": {
    "guardWitchInteraction": "coexist"
  },
  "settingsSchema": {
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

- [x] 在 `config.json` 的 `roles.p0` 中定义 `werewolf` 角色
- [x] 在 `config.json` 的 `nightActionPriority` 中设置 `werewolf` 为 priority 8
- [x] 在 `index.js` 中定义 `ACTION_TYPES.NIGHT_WOLF_KILL` 和 `ACTION_TYPES.NIGHT_WOLF_TENTATIVE`
- [x] 在 `index.js` 中初始化 `wolfVotes: {}` 和 `wolfTentativeVotes: {}` 状态
- [x] 在 `rules.js` 的 `validateNightAction` 中实现狼人行动验证（角色检查）
- [x] 在 `rules.js` 的 `validateNightAction` 中处理 `NIGHT_WOLF_TENTATIVE`（不消耗行动）
- [x] 在 `rules.js` 中实现 `resolveWolfConsensus()` 共识函数
- [x] 在 `game-phases.js` 的 `resolveNightActions` 中调用 `resolveWolfConsensus()` 获取击杀目标
- [x] 在 `game-phases.js` 中新一轮夜晚开始时重置 `wolfVotes` 和 `wolfTentativeVotes`
- [x] 在 `index.js` 的 `processMove` 中处理 `NIGHT_WOLF_KILL` 和 `NIGHT_WOLF_TENTATIVE` 状态更新
- [x] 在 `index.js` 的 `_getVisibleRoleStates` 中暴露 `wolfTeamIds`、`wolfVotes`、`wolfTentativeVotes`
- [x] 在 `ui-panels-wolf.js` 中实现狼人投票面板 UI
- [x] 在 `ui.js` 的 `_getNightSelectionConfig` 中配置狼人可选目标
- [x] 在 `rules-resolution.js` 的 `checkWinConditions` 中实现狼人胜利条件（wolves >= villagers）
- [x] 在 `index.test.js` 中添加狼人相关测试用例
- [ ] 手动测试验证所有 Edge Cases

---

## 10. UI 呈现与交互方式

### 选择模式

`single` — 通过环形座位图点击单个玩家头像选择击杀目标。

狼人在 `_getNightSelectionConfig()` 中注册，可选目标为所有存活玩家（`getAlivePlayerIds(state)`）。UI 层通过徽章标记队友，帮助狼人避免误选。

### 夜间面板内容

面板文件：`ui-panels-wolf.js` → `renderWolfVotesPanel(ctx)`

显示内容：

- **我的目标**：显示当前投票状态
  - 未选择时：显示"选中: 未选择"
  - 已拟投票时：显示"? 已拟: {玩家名}" 或 "? 已拟: 弃票"
  - 已确认时：显示"✓ 已确认: {玩家名}" 或 "✓ 已确认: 弃票"
  - 已选中但未提交时：显示"选中: {玩家名}"

- **队友投票状态**：列出所有队友（`wolfTeamIds` 排除自己）的投票情况
  - 已确认投票：显示 "✓ {目标名}" 或 "✓ 弃票"
  - 已拟投票：显示 "? {目标名} (拟)" 或 "? 弃票 (拟)"
  - 未选择：显示 "— 未选择"

### 操作栏按钮

四个按钮，分两组：

**拟投票组（secondary 风格）**：
- **拟投票**：选择目标后启用，提交 `NIGHT_WOLF_TENTATIVE`
  - 启用条件：`selectedTarget !== null`
- **拟弃票**：随时可用（除非已确认），提交 `NIGHT_WOLF_TENTATIVE` + `targetId: null`
  - 禁用条件：`hasMyActual === true`

**正式投票组（danger 风格）**：
- **确认击杀**：选择目标后启用，提交 `NIGHT_WOLF_KILL`
  - 启用条件：`selectedTarget !== null && !hasMyActual`
- **确认弃票**：随时可用（除非已确认），提交 `NIGHT_SKIP`
  - 禁用条件：`hasMyActual === true`

### 徽章显示

- **同伴**：在环形座位图中，狼人队友（`wolfTeamIds` 中除自己外的玩家）显示队友标记徽章，帮助狼人识别同伴、避免误杀

### 可见状态字段

`_getVisibleRoleStates` 中暴露给狼人玩家的字段：

- `wolfTeamIds`: 所有同阵营狼人的 playerId 数组（全程可见）
- `wolfVotes`: 所有狼人的正式投票记录（仅夜晚阶段可见）
- `wolfTentativeVotes`: 所有狼人的拟投票记录（仅夜晚阶段可见）

非狼人玩家：
- `wolfTeamIds`: `null`
- `wolfVotes`: `{}`（空对象）
- `wolfTentativeVotes`: `{}`（空对象）

### 白天 UI 影响

无特殊白天 UI 变化。狼人在白天阶段与其他玩家一样参与讨论和投票。

---

## 11. 参考资料

- **经典狼人杀规则**：[百度百科 - 狼人杀](https://baike.baidu.com/item/狼人杀)
- **狼人杀 Online**：多平台在线版本的投票共识机制参考
- **项目内部文档**：
  - `docs/games/werewolf/RULES.md` — 游戏技术规则总览
  - `frontend/src/games/werewolf/config.json` — 角色定义与配置
  - `frontend/src/games/werewolf/rules.js` — 验证逻辑与 `resolveWolfConsensus()`
  - `frontend/src/games/werewolf/rules-resolution.js` — 夜晚结算与胜利条件
  - `frontend/src/games/werewolf/ui-panels-wolf.js` — 狼人投票面板 UI
- **关联角色文档**：
  - `docs/games/werewolf/roles/bodyguard.md` — 守卫（保护交互）
  - `docs/games/werewolf/roles/vigilante.md` — 义警（同夜击杀交互）
  - `docs/games/werewolf/roles/cupid.md` — 丘比特（恋人殉情交互）

---

**文档版本**：v1.0
**创建日期**：2026-02-22
**作者**：AI-assisted
**待审核**：✅ 请确认规则设定是否符合预期
