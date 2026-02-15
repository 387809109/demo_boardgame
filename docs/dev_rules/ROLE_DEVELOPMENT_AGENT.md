# 狼人杀角色开发 Agent

## 概述

本 Agent 用于自动化开发狼人杀游戏的新角色，包括文档编写、代码实现和测试创建的完整流程。

**基于模板**：bodyguard (守卫) 角色的成功实现
**适用范围**：所有狼人杀角色（村民阵营、狼人阵营、第三方阵营）
**开发周期**：单个角色完整开发约 1-2 小时

---

## 使用方法

### 输入格式

```
角色英文ID, "角色简要描述（包含能力、时机、特殊规则）"
```

**示例**：
```
cupid, "丘比特在首夜连结两名玩家为恋人，恋人一方死亡时另一方殉情。丘比特连结后变为普通村民"
vigilante, "守夜人每晚可以选择射杀一名玩家，但射杀错误会有惩罚"
idiot, "白痴被投票处决时不会死亡，但会失去投票权。白痴被狼人杀死时正常死亡"
```

### 输出产物

1. **文档**：`docs/games/werewolf/roles/{roleId}.md`
2. **代码**：集成到 `config.json`, `rules.js`, `index.js`, `ui-panels-night.js`
3. **测试**：集成到 `index.test.js`，包含 10-15 个测试用例
4. **提交**：完整的 git commit

---

## 工作流程

### 阶段 1: 创建角色文档

**目标**：生成完整的技术规则文档

**文件**：`docs/games/werewolf/roles/{roleId}.md`

**必需章节**（基于 [TEMPLATE.md](../games/TEMPLATE.md)）：

1. **角色概述** - 基本信息、阵营、胜利条件
2. **角色能力** - 详细的技能描述和触发时机
3. **行动时机与优先级** - 夜间/白天行动顺序
4. **数据结构** - 状态字段、行动数据格式
5. **验证规则** - 所有验证条件的详细说明
6. **解析逻辑** - 夜间/白天行动的处理流程
7. **与其他角色的交互** - 保护、击杀、特殊状态的交互
8. **边界情况** - 至少 5 个特殊场景
9. **配置选项** - 可选的游戏规则变体
10. **测试场景** - 至少 30 个测试用例描述

**关键决策点**：
- **角色类型判断**：主动夜间技能 / 被动能力 / 首夜特殊 / 持续状态 / 第三方阵营
- **优先级分配**：参考现有优先级表（1: cupid, 5: seer, 7: doctor/bodyguard, 8: werewolf, 10: witch）
- **交互分析**：与现有角色的冲突、叠加、覆盖关系

**输出验证**：
- [ ] 所有 10 个章节完整
- [ ] 边界情况 ≥ 5 个
- [ ] 测试场景 ≥ 30 个
- [ ] 数据结构清晰定义
- [ ] 优先级合理分配

---

### 阶段 2: 实现代码

**目标**：将规则文档转化为可运行的代码

#### 2.1 配置定义 (`config.json`)

**位置**：`frontend/src/games/werewolf/config.json`

**修改内容**：

1. **添加角色定义** (`roles` 对象)：
```json
"{roleId}": {
  "id": "{roleId}",
  "name": "角色中文名",
  "team": "village|werewolf|third_party",
  "priority": "P0|P1|P2|P3",
  "description": "简短描述",
  "actionTypes": ["NIGHT_XXX_ACTION"],
  "abilities": ["ability1", "ability2"]
}
```

2. **添加夜间优先级** (`nightActionPriority` 数组，如有夜间行动)：
```json
{ "priority": 7, "roles": ["doctor", "bodyguard", "{roleId}"], "description": "保护" }
```

3. **添加配置选项** (`settingsSchema` 对象，如有可选规则)：
```json
"{optionName}": {
  "type": "boolean|select|number",
  "label": "选项中文名",
  "default": "默认值",
  "options": [...]  // 仅 select 类型
}
```

4. **更新默认配置** (`rules` 对象)：
```json
"{optionName}": "默认值"
```

#### 2.2 验证逻辑 (`rules.js`)

**位置**：`frontend/src/games/werewolf/rules.js`

**修改内容**：

1. **添加验证规则** (在 `validateNightAction` 或 `validateDayVote` 中)：
```javascript
case 'NIGHT_{ROLE}_ACTION': {
  // 检查角色特定条件
  if (/* 条件 */) {
    return { valid: false, error: '错误消息' };
  }
  break;
}
```

2. **添加解析逻辑** (在 `resolveNightActions` 中)：
```javascript
// 步骤 X: 收集 {角色} 行动
for (const [, action] of Object.entries(state.nightActions)) {
  if (action.actionType === 'NIGHT_{ROLE}_ACTION' && action.actionData?.targetId) {
    // 处理行动
  }
}
```

3. **处理交互** (在相关步骤中)：
```javascript
// 例如：保护、击杀、特殊状态的叠加
```

#### 2.3 状态管理 (`index.js`)

**位置**：`frontend/src/games/werewolf/index.js`

**修改内容**：

1. **添加 ACTION_TYPES**（第 31-46 行）：
```javascript
export const ACTION_TYPES = {
  // ... 现有类型
  NIGHT_{ROLE}_ACTION: 'NIGHT_{ROLE}_ACTION',
  // ...
};
```

2. **初始化角色状态**（`initialize` 方法中的 `roleStates`）：
```javascript
roleStates: {
  // ... 现有状态
  {roleId}LastAction: null,
  {roleId}UsedAbility: false,
  // ...
}
```

3. **添加行动处理**（`processMove` 方法中）：
```javascript
case ACTION_TYPES.NIGHT_{ROLE}_ACTION:
  this._collectNightAction(newState, move);
  if (newState.pendingNightRoles.length === 0) {
    advanceNightStep(newState, helpers);
  }
  break;
```

4. **更新状态**（在 `_collectNightAction` 或相关方法中）：
```javascript
if (actionType === ACTION_TYPES.NIGHT_{ROLE}_ACTION) {
  state.roleStates.{roleId}LastAction = actionData?.targetId || null;
}
```

5. **添加游戏选项**（`initialize` 方法中的 `gameOptions`）：
```javascript
const gameOptions = {
  // ... 现有选项
  {optionName}: options.{optionName} ?? config.rules.{optionName},
  // ...
};
```

#### 2.4 UI 面板 (`ui-panels-night.js`，如有夜间行动)

**位置**：`frontend/src/games/werewolf/ui-panels-night.js`

**修改内容**：

1. **导出渲染函数**：
```javascript
export function render{Role}Panel(ctx) {
  const { state, playerId, selectedTarget } = ctx;
  const lastAction = state.roleStates?.{roleId}LastAction;

  const panel = document.createElement('div');
  panel.className = 'role-action-panel';

  // 显示上次行动信息
  if (lastAction) {
    // ...
  }

  // 显示当前选择
  if (selectedTarget) {
    // ...
  }

  return panel;
}
```

2. **添加到主渲染器** (`renderNightPanel` 函数中)：
```javascript
case '{roleId}':
  el.appendChild(render{Role}Panel(ctx));
  break;
```

**UI 原则**：
- 保持简洁，复用现有 UI 组件
- 显示关键信息：上次行动、当前选择、限制提示
- 参考 `renderDoctorPanel` 和 `renderBodyguardPanel`

#### 2.5 代码质量检查

**验证清单**：
- [ ] ACTION_TYPES 已添加并导出
- [ ] 验证规则覆盖所有边界情况
- [ ] 状态初始化完整
- [ ] 行动处理逻辑正确
- [ ] 与其他角色的交互已实现
- [ ] 配置选项已添加到 gameOptions
- [ ] UI 面板简洁清晰（如适用）
- [ ] 代码符合项目风格规范

---

### 阶段 3: 创建测试

**目标**：全面覆盖角色功能和边界情况

**文件**：`frontend/src/games/werewolf/index.test.js`

**测试结构**：

```javascript
describe('{Role} (P1)', () => {
  // 测试配置
  const P1_{ROLE}_COUNTS = {
    werewolf: 2,
    seer: 1,
    {roleId}: 1,
    // ... 其他必要角色
    villager: 1
  };

  const PLAYERS = [
    ...SEVEN_PLAYERS,
    { id: 'p8', nickname: 'Player8' }  // 如需 8 人
  ];

  describe('Basic Functionality', () => {
    it('should perform basic ability', () => { /* ... */ });
    it('should enforce validation rules', () => { /* ... */ });
    it('should handle ability cooldown/limit', () => { /* ... */ });
    // 3-5 个基础功能测试
  });

  describe('Interactions with Other Roles', () => {
    it('should interact correctly with {role1}', () => { /* ... */ });
    it('should interact correctly with {role2}', () => { /* ... */ });
    // 每个相关角色 1-2 个交互测试
  });

  describe('Edge Cases', () => {
    it('should handle edge case 1', () => { /* ... */ });
    it('should handle edge case 2', () => { /* ... */ });
    // 至少 5 个边界情况测试
  });
});
```

**测试数量指南**：
- **简单角色**（如白痴、猎人）：8-10 个测试
- **中等复杂**（如守卫、守夜人）：10-12 个测试
- **复杂角色**（如丘比特、吹笛者）：12-15 个测试

**测试覆盖要求**：
1. **基础功能**：能力正常工作、状态正确更新
2. **验证规则**：所有错误条件被拦截
3. **角色交互**：与现有角色的所有交互场景
4. **边界情况**：
   - 首夜特殊逻辑（如适用）
   - 死亡触发器（如适用）
   - 能力限制和冷却
   - 多重保护/击杀叠加
   - 配置选项的不同组合

**测试辅助工具**：
- `setupGame()`：初始化游戏
- `submitNight()`：提交夜间行动
- `advanceToNight()`：跳过白天进入夜晚
- `playVoteRound()`：执行投票
- 参考现有测试获取更多辅助函数

**运行测试**：
```bash
cd frontend
npm test -- src/games/werewolf/index.test.js
```

**修复策略**（如测试失败）：
1. 检查 ACTION_TYPES 是否正确导出
2. 检查状态属性名称是否一致
3. 检查验证逻辑是否返回正确格式
4. 检查夜间行动是否需要 NIGHT_SKIP
5. 使用 `game.getState()` 检查实际状态

**输出验证**：
- [ ] 所有测试通过（绿色）
- [ ] 覆盖所有主要功能
- [ ] 覆盖所有边界情况
- [ ] 测试代码清晰易懂

---

## 角色类型判断指南

### 1. 主动夜间技能角色
**特征**：每晚主动选择目标执行能力
**示例**：预言家、医生、守卫、女巫
**实现要点**：
- 添加到 `nightActionPriority`
- 实现验证和解析逻辑
- 创建 UI 面板

### 2. 被动能力角色
**特征**：无主动行动，能力自动触发
**示例**：猎人（死亡时射击）、白痴（处决时不死）
**实现要点**：
- 在 `_processDeathTriggers` 中处理
- 或在投票解析中特殊处理
- 无需 UI 面板

### 3. 首夜特殊角色
**特征**：仅首夜行动，之后无能力或变化
**示例**：丘比特（连结恋人）、盗贼（交换角色）
**实现要点**：
- 优先级设为 1-2
- 验证逻辑检查 `state.round === 1`
- 行动后可能需要状态转换

### 4. 持续状态角色
**特征**：赋予玩家持续的特殊状态
**示例**：警长（持有徽章）、恋人（连结状态）
**实现要点**：
- 在 `state.links` 或专门字段存储状态
- 状态影响投票、死亡等多个阶段
- 可能需要公开信息机制

### 5. 第三方阵营角色
**特征**：独立胜利条件，非村民非狼人
**示例**：连环杀手、吹笛者
**实现要点**：
- `team: "third_party"`
- 修改 `checkWinConditions` 添加新胜利条件
- 可能需要专门的状态追踪

---

## 优先级分配规则

### 现有优先级表

| 优先级 | 角色 | 说明 |
|--------|------|------|
| 1 | cupid | 连结恋人（仅首夜） |
| 2 | thief | 交换角色（仅首夜） |
| 3 | jailer | 监禁目标 |
| 5 | seer | 查验 |
| 7 | doctor, bodyguard, guardian_angel | 保护 |
| 8 | werewolf | 击杀 |
| 9 | vigilante, serial_killer | 射杀/击杀 |
| 10 | witch | 救人/毒杀 |

### 分配原则

1. **首夜特殊**：优先级 1-2
2. **信息获取**：优先级 3-5（在击杀前）
3. **保护类**：优先级 6-7（在击杀前，保护生效）
4. **击杀类**：优先级 8-9（主要击杀行动）
5. **救援/反击**：优先级 10+（在击杀后，可救回或额外击杀）

### 新角色优先级建议

- **吹笛者**（魅惑）：优先级 6（在保护和击杀之间）
- **守夜人**（射杀）：优先级 9（与女巫毒杀同级）
- **连环杀手**（击杀）：优先级 9
- **监禁者**（监禁）：优先级 3（信息类，早于保护）

---

## 文件修改清单

每个新角色通常需要修改以下文件：

### 必需修改
- [ ] `docs/games/werewolf/roles/{roleId}.md` - 新建文档
- [ ] `frontend/src/games/werewolf/config.json` - 添加角色定义
- [ ] `frontend/src/games/werewolf/rules.js` - 添加验证和解析逻辑
- [ ] `frontend/src/games/werewolf/index.js` - 添加 ACTION_TYPES 和状态管理
- [ ] `frontend/src/games/werewolf/index.test.js` - 添加测试套件

### 条件修改
- [ ] `frontend/src/games/werewolf/ui-panels-night.js` - 如有夜间行动
- [ ] `frontend/src/games/werewolf/game-phases.js` - 如需修改胜利条件或特殊阶段逻辑

### 辅助更新
- [ ] `docs/prd/frontend/TASKS.md` - 更新任务进度（如适用）
- [ ] `PROGRESS.md` - 记录开发进度

---

## 参考模板

### 完整实现参考
**守卫 (bodyguard) 角色** - 最佳实践示例

**文档**：`docs/games/werewolf/roles/bodyguard.md`
- 完整的 10 章节结构
- 32 个测试场景
- 29 个边界情况
- guard-witch 复杂交互处理

**代码提交**：
- `9c29b15` - 初始实现（文档 + 代码）
- `ae80db3` - 测试集成和修复

**关键特性**：
- 配置驱动（3 个可选规则）
- 复杂交互（guard-witch conflict/coexist）
- 完整测试覆盖（10 个测试）

---

## 质量标准

### 文档质量
- [ ] 所有章节完整且详细
- [ ] 边界情况覆盖全面（≥5 个）
- [ ] 测试场景描述清晰（≥30 个）
- [ ] 数据结构定义准确

### 代码质量
- [ ] 符合项目代码风格（SOLID, DRY, KISS）
- [ ] 变量命名清晰（camelCase）
- [ ] 注释适当（复杂逻辑需要注释）
- [ ] 无冗余代码
- [ ] UI 简洁（如适用）

### 测试质量
- [ ] 所有测试通过
- [ ] 覆盖率 ≥ 90%
- [ ] 测试用例独立
- [ ] 断言清晰明确
- [ ] 测试描述准确

### Git 提交
- [ ] 提交信息清晰（格式：`feat(werewolf): add {role} role (P1)`）
- [ ] 包含 Co-Authored-By 署名
- [ ] 代码已构建和测试
- [ ] 无未追踪文件

---

## 常见问题

### Q: 如何判断角色是否需要夜间 UI？
**A**: 如果角色有主动夜间行动且需要选择目标，则需要 UI 面板。被动能力、首夜特殊（连结后无能力）通常不需要。

### Q: 如何处理与女巫的交互？
**A**: 女巫在优先级 10，可以看到当晚的击杀结果。如果你的角色会产生击杀或保护，需要在女巫行动前确定结果。参考 bodyguard-witch 交互。

### Q: 如何处理多重保护叠加？
**A**: 在 `resolveNightActions` 的保护应用步骤中，所有保护都会生效（除非有特殊冲突规则，如 guard-witch conflict）。

### Q: 如何添加新的胜利条件？
**A**: 修改 `rules.js` 中的 `checkWinConditions` 函数，添加第三方阵营的胜利判断逻辑。

### Q: 测试中 "当前不是你的行动阶段" 错误？
**A**: 检查：1) 角色是否在 `pendingNightRoles` 中；2) 是否在正确的夜间步骤；3) 优先级是否正确配置。

### Q: 女巫行动后为什么夜晚没有结束？
**A**: 女巫的 SAVE 和 POISON 不会自动结束夜晚步骤，需要显式提交 `NIGHT_SKIP`。参考测试中的模式。

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-02-15 | 初始版本，基于 bodyguard 角色开发经验 |

---

## 联系与反馈

如在使用过程中遇到问题或需要补充说明，请参考：
- `docs/dev_rules/ROLE_AGENT_PROMPT.md` - Agent 提示词模板
- `docs/games/werewolf/roles/bodyguard.md` - 参考实现
- `docs/dev_rules/README.md` - 开发规范总览
