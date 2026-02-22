# 丘比特角色技术规则文档

## 1. 角色概述

### 基本信息
- **角色ID**: `cupid`
- **角色中文名**: 丘比特
- **英文名**: Cupid
- **阵营**: 村民阵营 (`village`)
- **优先级**: P1（高优先级，首夜特殊角色）

### 简要描述
丘比特在游戏首夜可以选择两名玩家（可包括自己）连结为恋人。恋人双方得知彼此身份，形成特殊的连结关系。如果恋人一方死亡，另一方立即殉情。如果恋人分属不同阵营（一狼一村），则双方脱离原阵营，形成独立的"恋人阵营"。

### 胜利条件
- **丘比特本人**：连结恋人后变为普通村民，跟随村民阵营胜利条件（优先级 4）。如果丘比特将自己选为恋人之一，则跟随恋人阵营胜利条件
- **同阵营恋人**：保持原阵营，胜利条件不变
- **异阵营恋人**：组成恋人阵营，胜利条件为场上只剩恋人双方存活 — **胜利优先级 3**

---

## 2. 角色能力

### 主要能力
**连结恋人 (Link Lovers)**

- **能力描述**: 丘比特在首夜可以选择场上的任意两名玩家（包括自己），将他们连结为恋人
- **能力效果**:
  - 被选中的两名玩家成为恋人，得知彼此身份
  - 恋人双方在每个夜晚可以私聊交流（如果配置允许）
  - 恋人一方死亡时，另一方立即殉情
  - 如果恋人分属不同阵营，双方脱离原阵营形成恋人阵营
- **持续时间**: 恋人关系持续到游戏结束，无法解除
- **能力限制**:
  - 只能在首夜使用一次
  - 必须选择正好两名玩家
  - 选择后无法撤销或更改
  - 连结后丘比特变为普通村民（可选配置）

### 被动能力
**殉情机制 (Lover's Death)**

- 当恋人中的一方死亡时，另一方立即殉情
- 殉情是即时的，发生在死亡结算的同一时刻
- 殉情优先于其他角色能力（猎人、白痴等）
- 死亡原因记录为 `lover_death`

---

## 3. 行动时机与优先级

### 夜间优先级
**优先级 1** - 连结恋人（仅首夜）

**原因**:
- 恋人关系的建立会影响其他玩家的决策和策略
- 需要在其他夜间行动之前确定恋人关系
- 如果有盗贼（优先级 2），丘比特应在盗贼之前行动，避免恋人被交换角色

### 首夜行动流程
1. 丘比特行动：选择两名玩家成为恋人
2. 系统通知恋人双方彼此的身份
3. 系统检查恋人阵营（如果一狼一村，更新阵营为 `lovers`）
4. 丘比特变为普通村民（如果配置要求）
5. 进入下一优先级的夜间行动

### 后续夜晚
- 丘比特无夜间行动（已变为普通村民）
- 恋人可以夜间私聊（如果配置允许）

---

## 4. 数据结构

### 4.1 游戏状态字段

#### state.links.lovers
```javascript
// 存储恋人双方的玩家 ID
state.links.lovers = [playerId1, playerId2];
// 类型: Array<string> | null
// 默认值: null
// 说明: 如果场上存在恋人，则为包含两个玩家 ID 的数组
```

#### state.roleStates.cupidLinked
```javascript
// 丘比特是否已连结恋人
state.roleStates.cupidLinked = false;
// 类型: boolean
// 默认值: false
// 说明: 首夜丘比特行动后设为 true，防止后续夜晚重复行动
```

### 4.2 行动数据格式

#### NIGHT_CUPID_LINK
```javascript
{
  "actionType": "NIGHT_CUPID_LINK",
  "actionData": {
    "lovers": [playerId1, playerId2]  // 正好两个玩家 ID
  }
}
```

#### NIGHT_SKIP（丘比特跳过）
```javascript
{
  "actionType": "NIGHT_SKIP",
  "actionData": {}
}
```

### 4.3 玩家阵营更新

当恋人分属不同阵营时：
```javascript
// 更新恋人双方的 team 字段
state.playerMap[playerId1].team = 'lovers';
state.playerMap[playerId2].team = 'lovers';
```

---

## 5. 验证规则

### 5.1 行动阶段验证
```javascript
// 检查是否为首夜
if (state.round !== 1) {
  return { valid: false, error: '丘比特只能在首夜行动' };
}

// 检查是否已经连结过
if (state.roleStates?.cupidLinked) {
  return { valid: false, error: '丘比特已经使用过能力' };
}
```

### 5.2 目标验证
```javascript
const { lovers } = actionData;

// 检查是否提供了 lovers 数组
if (!lovers || !Array.isArray(lovers)) {
  return { valid: false, error: '必须选择两名玩家' };
}

// 检查是否正好两名玩家
if (lovers.length !== 2) {
  return { valid: false, error: '必须选择正好两名玩家' };
}

// 检查两个玩家不能相同
if (lovers[0] === lovers[1]) {
  return { valid: false, error: '不能选择同一名玩家两次' };
}

// 检查玩家是否存在且存活
for (const loverId of lovers) {
  if (!state.playerMap[loverId]) {
    return { valid: false, error: '选择的玩家不存在' };
  }
  if (!state.playerMap[loverId].alive) {
    return { valid: false, error: '不能选择已死亡的玩家' };
  }
}
```

### 5.3 自恋验证（可选配置）
```javascript
if (!state.options.cupidCanSelfLove) {
  if (lovers.includes(playerId)) {
    return { valid: false, error: '丘比特不能将自己选为恋人' };
  }
}
```

---

## 6. 解析逻辑

### 6.1 夜间行动解析（首夜）

#### 步骤 1: 连结恋人
```javascript
// 优先级 1: 丘比特连结恋人（仅首夜）
if (state.round === 1) {
  for (const [playerId, action] of Object.entries(state.nightActions)) {
    if (action.actionType === 'NIGHT_CUPID_LINK' && action.actionData?.lovers) {
      const [lover1, lover2] = action.actionData.lovers;

      // 设置恋人关系
      state.links.lovers = [lover1, lover2];

      // 标记丘比特已使用能力
      state.roleStates.cupidLinked = true;

      // 检查恋人阵营
      const team1 = state.playerMap[lover1].team;
      const team2 = state.playerMap[lover2].team;

      // 如果一狼一村，更新为恋人阵营
      if (team1 !== team2 &&
          (team1 === 'werewolf' || team2 === 'werewolf') &&
          (team1 === 'village' || team2 === 'village')) {
        state.playerMap[lover1].team = 'lovers';
        state.playerMap[lover2].team = 'lovers';
      }

      // 如果配置要求同阵营恋人也脱离
      if (state.options.sameSideLoversSeparate && team1 === team2) {
        state.playerMap[lover1].team = 'lovers';
        state.playerMap[lover2].team = 'lovers';
      }

      // 通知恋人（通过 announcements 或专门机制）
      announcements.push({
        type: 'lovers_linked',
        lovers: [lover1, lover2],
        message: '恋人已连结'
      });

      break;  // 只处理一个丘比特行动
    }
  }
}
```

### 6.2 死亡触发器处理

在 `_processDeathTriggers` 中添加：
```javascript
// 检查恋人殉情
if (state.links.lovers) {
  const [lover1, lover2] = state.links.lovers;

  for (const deadId of deadIds) {
    if (deadId === lover1 && state.playerMap[lover2]?.alive) {
      // 恋人 1 死亡，恋人 2 殉情
      helpers.markPlayerDead(state, lover2, 'lover_death');
      // 注意：殉情不触发猎人等技能
    } else if (deadId === lover2 && state.playerMap[lover1]?.alive) {
      // 恋人 2 死亡，恋人 1 殉情
      helpers.markPlayerDead(state, lover1, 'lover_death');
    }
  }
}
```

**重要**: 殉情不应触发猎人射击、白痴翻牌等能力。需要在触发器中添加 `cause` 检查：
```javascript
// 在猎人触发器中
if (cause === 'lover_death') {
  return;  // 殉情不触发猎人
}
```

---

## 7. 与其他角色的交互

### 7.1 与保护类角色（医生/守卫）
- **正常交互**: 恋人可以被医生/守卫保护，免于狼人击杀
- **殉情不可阻止**: 如果另一半恋人死亡导致殉情，保护无法阻止

### 7.2 与击杀类角色（狼人/女巫）
- **狼人恋人**: 狼人作为恋人仍可参与击杀投票，但如果击杀了另一半恋人，自己也会殉情
- **女巫毒杀**: 女巫毒死恋人之一，另一半立即殉情

### 7.3 与猎人
- **殉情优先**: 猎人因殉情而死时，**不能开枪**
- **正常死亡**: 猎人被击杀/处决（非殉情）时，可以正常开枪

**实现**:
```javascript
if (deadPlayer.roleId === 'hunter') {
  const canShoot = cause !== 'lover_death' &&
                   (cause !== 'witch_poison' || state.options.hunterShootOnPoison);
  if (canShoot) {
    state.hunterPendingShoot = deadId;
  }
}
```

### 7.4 与白痴
- **殉情优先**: 白痴因殉情而死时，**不能翻牌**
- **正常处决**: 白痴被投票处决（非殉情）时，可以正常翻牌

**实现**: 在投票处决逻辑中，检查白痴是否被触发时，确保不是殉情导致的死亡

### 7.5 与盗贼（如有）
- **优先级顺序**: 建议丘比特优先级 1，盗贼优先级 2
- **影响**: 丘比特先连结恋人，盗贼后交换角色时，恋人关系不变（恋人关系绑定玩家ID，不绑定角色）

### 7.6 与第三方阵营
- **恋人阵营独立性**: 恋人阵营（一狼一村时）是独立的第三方阵营
- **胜利互斥**: 场上只能有一个第三方阵营获胜
- **与连环杀手/吹笛者**: 如果有其他第三方阵营，恋人阵营与之竞争

---

## 8. 边界情况

### 8.1 丘比特将自己选为恋人之一
**场景**: 丘比特选择自己和另一名玩家成为恋人

**处理**:
- 如果配置 `cupidCanSelfLove = true`，允许此操作
- 丘比特成为恋人后，仍变为普通村民（不再有丘比特能力）
- 如果连结一狼一村（包括自己），则丘比特脱离村民阵营，加入恋人阵营

**测试场景**:
- 丘比特（村民）+ 狼人 → 恋人阵营
- 丘比特（村民）+ 村民 → 村民阵营

### 8.2 选择两名狼人为恋人
**场景**: 丘比特选择两名狼人成为恋人

**处理**:
- 允许此操作
- 两名狼人保持狼人阵营（同阵营恋人不脱离）
- 如果一方死亡，另一方殉情，对狼人阵营不利

**策略影响**: 这通常是丘比特的失误，因为会削弱狼人阵营

### 8.3 恋人死亡触发时机
**场景**: 夜晚狼人杀死恋人 A，在夜晚结算时恋人 B 的状态

**处理**:
- 殉情是**即时的**，发生在死亡结算的同一时刻
- 在 `resolveNight` → `markPlayerDead` → `_processDeathTriggers` 流程中处理
- 恋人 A 被标记死亡后，立即触发恋人 B 的殉情

**时序**:
1. 狼人击杀恋人 A
2. 夜晚结束，进入 DAY_ANNOUNCE
3. 调用 `resolveNight`，标记恋人 A 死亡（cause: 'wolf_kill'）
4. 调用 `_processDeathTriggers([恋人A], 'wolf_kill')`
5. 检测到恋人关系，立即标记恋人 B 死亡（cause: 'lover_death'）
6. **不**递归调用 `_processDeathTriggers` for 恋人 B（避免触发猎人等）

### 8.4 首夜丘比特未行动
**场景**: 丘比特首夜选择 NIGHT_SKIP 或超时未行动

**处理**:
- 丘比特失去连结恋人的能力
- 丘比特变为普通村民
- 后续夜晚无法再次连结恋人

**实现**:
```javascript
// 在首夜结束后检查
if (state.round === 1 && !state.roleStates.cupidLinked) {
  // 如果有丘比特但未连结，标记为已使用（防止后续行动）
  const cupidPlayer = Object.values(state.playerMap).find(p => p.roleId === 'cupid' && p.alive);
  if (cupidPlayer) {
    state.roleStates.cupidLinked = true;  // 防止后续夜晚行动
  }
}
```

### 8.5 恋人中一方被投票处决
**场景**: 白天投票处决恋人 A，恋人 B 的状态

**处理**:
- 遗言阶段结束后（PHASE_ADVANCE from DAY_ANNOUNCE to NIGHT），恋人 B 立即殉情
- 如果被处决的是白痴且翻牌存活，另一半**不会**殉情（因为白痴未死亡）

**时序**:
1. 投票结果：恋人 A 被处决
2. 如果恋人 A 是猎人，可以开枪
3. 如果恋人 A 是白痴，可以翻牌（如果翻牌则不死，恋人 B 不殉情）
4. 遗言阶段：恋人 A 发表遗言
5. PHASE_ADVANCE 到 NIGHT：标记恋人 A 死亡（cause: 'execution'）
6. 触发 `_processDeathTriggers`，恋人 B 殉情

### 8.6 恋人阵营与其他第三方阵营
**场景**: 场上同时存在恋人阵营和连环杀手

**处理**:
- 两个第三方阵营**互斥**，只能有一个获胜
- 胜利条件检查时，优先检查恋人阵营（如果恋人存活）

**实现**:
```javascript
// 在 checkWinConditions 中
if (state.links.lovers) {
  const [lover1, lover2] = state.links.lovers;
  const lover1Alive = state.playerMap[lover1]?.alive;
  const lover2Alive = state.playerMap[lover2]?.alive;

  if (lover1Alive && lover2Alive) {
    // 检查是否只剩恋人双方
    const aliveCount = Object.values(state.playerMap).filter(p => p.alive).length;
    if (aliveCount === 2) {
      return { ended: true, winner: 'lovers', reason: '恋人阵营获胜' };
    }
  }
}
```

### 8.7 丘比特死亡后恋人关系
**场景**: 丘比特在连结恋人后死亡

**处理**:
- 丘比特死亡**不影响**已连结的恋人关系
- 恋人关系持续到游戏结束或恋人双方死亡

**原因**: 恋人关系存储在 `state.links.lovers`，与丘比特的存活状态无关

### 8.8 恋人双方同时死亡
**场景**: 夜晚女巫同时毒死两名恋人（极端情况）

**处理**:
- 理论上不会发生（女巫只能毒一人）
- 如果通过特殊机制（如多个击杀源）同时死亡，不触发殉情（已经同时死亡）

**实现**: `_processDeathTriggers` 在标记死亡前检查，如果恋人双方都已在 `deadIds` 中，不额外触发殉情

---

## 9. 配置选项

### 9.1 cupidCanSelfLove
```javascript
{
  "name": "cupidCanSelfLove",
  "type": "boolean",
  "default": true,
  "label": "丘比特可否自恋",
  "description": "是否允许丘比特将自己选为恋人之一"
}
```

**影响**:
- `true`: 丘比特可以选择自己和另一名玩家
- `false`: 丘比特只能选择其他两名玩家，验证时拦截包含自己的选择

### 9.2 sameSideLoversSeparate
```javascript
{
  "name": "sameSideLoversSeparate",
  "type": "boolean",
  "default": false,
  "label": "同阵营恋人脱离阵营",
  "description": "如果设为 true，即使两名恋人同属一个阵营，也会脱离原阵营形成独立的恋人阵营"
}
```

**影响**:
- `false`（默认）: 只有一狼一村才形成恋人阵营
- `true`: 任何恋人组合都脱离原阵营，形成独立的恋人阵营

### 9.3 loversNightChat
```javascript
{
  "name": "loversNightChat",
  "type": "boolean",
  "default": false,
  "label": "恋人夜间私聊",
  "description": "恋人是否可以在夜间私聊。如果设为 false，恋人只知道彼此身份但无法交流"
}
```

**影响**:
- `true`: 恋人可以在夜间私聊（需要实现聊天机制）
- `false`（默认）: 恋人只知道彼此身份，无法私聊

**注意**: 当前版本恋人私聊功能暂未实现，此配置仅作为扩展预留

---

## 10. UI 呈现与交互方式

### 选择模式

`multi` — 通过环形座位图点击多个玩家头像，固定选择 2 名玩家作为恋人。

丘比特不在 `roleHasNightAction()` 中注册，需要在 `ui.js` 中实现专用的多选逻辑：

- `_cupidSelectedLovers: Set` — 构造函数中初始化
- `_getCupidSelectionConfig()` — 返回 `{ multiSelect: true, selectedIds: [...] }`
- `_handleCupidSelect(targetId)` — 切换选中，上限 2 人时替换最早选中
- `getSelectionConfig()` 中在 `roleHasNightAction` 判断之前检查丘比特

### 夜间面板内容

面板文件：`ui-panels-roles.js` → `renderCupidPanel(ctx)`

显示内容：

- **已连结状态**：若 `cupidLinked` 为 true，显示"你已连结恋人，变为普通村民"
- **操作提示**：显示"点击左侧玩家头像选择两名恋人"
- **选择计数**：显示"已选择: {名字1} 和 {名字2} (N/2)" 或 "已选择 0 / 2 名玩家"
- **确认按钮**：选满 2 人后启用

### 操作栏按钮

- **提示按钮**（不可点击）：`请在上方面板选择恋人`

### 徽章显示

- **恋人徽章**：连结完成后，恋人双方在对方的环形头像上看到 `{ type: 'lover', text: '恋人' }` 徽章
- **可见范围**：仅恋人双方可见（通过 `roleStates.loverPartnerId` 判断）

### 可见状态字段

`_getVisibleRoleStates` 中暴露：

- `cupidLinked`: 是否已完成连结（丘比特和恋人均可见）
- `loverPartnerId`: 恋人伙伴的 ID（仅恋人双方可见）

### 白天 UI 影响

无特殊白天 UI 变化。恋人徽章在所有阶段持续显示。

---

## 11. 测试场景

### 11.1 基础功能测试（6 个）

#### 测试 1: 成功连结两名村民为恋人
- 丘比特首夜选择两名村民（非狼人）
- 验证 `state.links.lovers` 正确设置
- 验证两名村民保持村民阵营
- 验证丘比特变为普通村民（roleStates.cupidLinked = true）

#### 测试 2: 连结一狼一村，形成恋人阵营
- 丘比特首夜选择一名狼人和一名村民
- 验证 `state.links.lovers` 正确设置
- 验证两名玩家的 team 更新为 'lovers'
- 验证恋人阵营胜利条件生效

#### 测试 3: 丘比特将自己选为恋人之一（cupidCanSelfLove = true）
- 丘比特选择自己和另一名玩家
- 验证成功连结
- 验证丘比特成为恋人

#### 测试 4: 拒绝自恋（cupidCanSelfLove = false）
- 配置 `cupidCanSelfLove = false`
- 丘比特尝试选择自己和另一名玩家
- 验证验证失败，错误消息正确

#### 测试 5: 首夜丘比特跳过，失去能力
- 丘比特首夜提交 NIGHT_SKIP
- 验证 `cupidLinked = true`
- 验证后续夜晚无法再次连结

#### 测试 6: 验证必须选择正好两名玩家
- 尝试选择 0 名、1 名、3 名玩家
- 验证全部失败

### 11.2 殉情机制测试（4 个）

#### 测试 7: 恋人一方被狼人杀死，另一方殉情
- 夜晚狼人击杀恋人之一
- 验证另一方立即标记为死亡（cause: 'lover_death'）
- 验证 nightDeaths 包含两条死亡记录

#### 测试 8: 恋人一方被投票处决，另一方殉情
- 白天投票处决恋人之一
- 验证遗言阶段后，另一方殉情
- 验证 cause: 'lover_death'

#### 测试 9: 恋人一方被女巫毒杀，另一方殉情
- 女巫毒杀恋人之一
- 验证另一方殉情

#### 测试 10: 恋人一方被保护后存活，另一方不殉情
- 医生保护恋人 A，狼人击杀恋人 A
- 验证恋人 A 存活
- 验证恋人 B 不殉情

### 11.3 与其他角色交互测试（5 个）

#### 测试 11: 猎人恋人因殉情死亡，不触发开枪
- 恋人 A 是猎人，恋人 B 被击杀
- 验证恋人 A 殉情但不触发 hunterPendingShoot

#### 测试 12: 猎人恋人被正常击杀，可以开枪
- 恋人 A 是猎人，恋人 A 被狼人击杀（非殉情）
- 验证恋人 A 可以开枪
- 验证恋人 B 殉情

#### 测试 13: 白痴恋人被投票处决但翻牌存活，另一方不殉情
- 恋人 A 是白痴，被投票处决
- 白痴翻牌存活
- 验证恋人 B 不殉情（因为白痴未死）

#### 测试 14: 狼人恋人参与击杀另一半，自己也殉情
- 恋人 A 是狼人，狼人阵营击杀恋人 B
- 验证恋人 B 死亡
- 验证恋人 A 殉情

#### 测试 15: 医生/守卫保护恋人，免于击杀
- 医生保护恋人 A
- 狼人击杀恋人 A
- 验证恋人 A 存活，恋人 B 不殉情

### 11.4 恋人阵营胜利条件测试（3 个）

#### 测试 16: 恋人阵营获胜（只剩恋人双方）
- 场上只剩恋人双方存活（一狼一村）
- 验证游戏结束，winner = 'lovers'

#### 测试 17: 恋人阵营失败（一方死亡）
- 恋人双方中有一方死亡（双方都死）
- 验证游戏继续或以其他阵营获胜

#### 测试 18: 同阵营恋人不改变胜利条件
- 两名村民恋人
- 验证跟随村民阵营胜利条件

### 11.5 配置选项测试（3 个）

#### 测试 19: sameSideLoversSeparate = true，同阵营恋人也脱离
- 配置 `sameSideLoversSeparate = true`
- 连结两名村民
- 验证双方 team 更新为 'lovers'

#### 测试 20: 丘比特非首夜尝试行动，失败
- 丘比特在第 2 夜尝试连结恋人
- 验证验证失败

#### 测试 21: 连结两名狼人为恋人
- 丘比特选择两名狼人
- 验证双方保持狼人阵营
- 验证殉情机制仍然生效

### 11.6 边界情况测试（5 个）

#### 测试 22: 丘比特死亡后恋人关系不变
- 丘比特连结恋人后死亡
- 验证恋人关系仍然有效
- 验证殉情机制仍然生效

#### 测试 23: 尝试选择同一名玩家两次
- 丘比特尝试选择 [p1, p1]
- 验证验证失败

#### 测试 24: 尝试选择已死亡的玩家（极端情况）
- 如果首夜有玩家死亡（理论上不可能，但防御性编程）
- 验证验证失败

#### 测试 25: 恋人被投票处决，猎人遗言后殉情
- 恋人 A 被投票处决，恋人 A 发表遗言
- 遗言后恋人 B 殉情

#### 测试 26: 多个死亡触发时的殉情处理
- 夜晚多人死亡（如狼杀 + 女巫毒），其中包括恋人
- 验证殉情正确触发

### 11.7 UI 测试场景（3 个）

#### 测试 27: UI 显示所有存活玩家
- 首夜丘比特行动
- 验证 UI 显示所有存活玩家列表

#### 测试 28: UI 限制只能选择两名玩家
- 尝试选择 0/1/3 名玩家
- 验证确认按钮禁用或提示错误

#### 测试 29: UI 跳过按钮功能
- 丘比特点击跳过按钮
- 验证提交 NIGHT_SKIP
- 验证丘比特失去能力

---

## 总结

丘比特是一个**首夜特殊角色**，能力在游戏初期产生深远影响。实现时需要特别注意：

1. **殉情优先级**: 殉情应优先于猎人、白痴等角色能力
2. **阵营判断**: 正确判断恋人是否应脱离原阵营
3. **胜利条件**: 恋人阵营的独立胜利条件检查
4. **死亡触发**: 在 `_processDeathTriggers` 中处理殉情，避免递归触发
5. **首夜限制**: 严格限制只能在首夜行动一次

**复杂度评估**: 中等偏高
- 需要修改 5 个文件（config, rules, index, ui, test）
- 需要添加胜利条件检查逻辑
- 需要特殊处理死亡触发器（避免猎人触发）
- 测试用例较多（建议 15-18 个）
