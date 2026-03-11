# 狼人杀角色开发 Agent - 提示词模板

> **使用说明**：将本模板中的 `{PROMPT}` 部分复制粘贴给 AI，替换 `{roleId}` 和 `{description}` 为实际角色信息。

---

## 完整提示词

```markdown
# 任务：开发狼人杀新角色

你是一个专门为狼人杀游戏开发新角色的 Agent。请严格按照以下 3 阶段流程完成角色开发。

## 输入

**角色ID**：{roleId}
**角色描述**：{description}

## 上下文

- **项目**：桌游集成客户端 - 狼人杀模块
- **技术栈**：Vanilla JavaScript (前端) + Node.js (后端)
- **参考实现**：bodyguard (守卫) 角色
- **参考文档**：
  - `docs/dev_rules/ROLE_DEVELOPMENT_AGENT.md` - 完整工作流程
  - `docs/games/werewolf/roles/bodyguard.md` - 文档模板
  - `docs/games/TEMPLATE.md` - 通用模板

## 阶段 1: 创建角色文档

### 任务
创建文件 `docs/games/werewolf/roles/{roleId}.md`，包含以下 10 个章节：

1. **角色概述**
   - 角色名称（中英文）
   - 阵营（village/werewolf/third_party）
   - 优先级（P0/P1/P2/P3）
   - 简要描述
   - 胜利条件（含胜利条件优先级，参考 `RULES.md` 第 9.1 节）

2. **角色能力**
   - 能力详细说明
   - 触发时机和条件
   - 能力效果和持续时间
   - 能力限制（次数、冷却等）

3. **行动时机与优先级**
   - 夜间行动优先级（参考下表）
   - 白天行动时机
   - 与其他角色的时序关系

4. **数据结构**
   - 状态字段定义（`roleStates` 中的字段）
   - 行动数据格式（`actionData` 结构）
   - 配置选项定义

5. **验证规则**
   - 所有验证条件的详细说明
   - 错误消息定义
   - 边界条件检查

6. **解析逻辑**
   - 夜间行动处理流程
   - 白天行动处理流程
   - 状态更新逻辑

7. **与其他角色的交互**
   - 与保护类角色的交互
   - 与击杀类角色的交互
   - 与特殊状态的交互
   - 冲突和优先级处理

8. **边界情况**（至少 5 个）
   - 首夜特殊情况
   - 死亡触发情况
   - 多重效果叠加
   - 能力失效条件
   - 其他特殊场景

9. **配置选项**
   - 可选规则列表
   - 每个选项的说明和默认值
   - 选项对游戏的影响

10. **UI 呈现与交互方式**
    - 选择模式（`single` / `multi` / `none`）
    - 夜间面板内容（显示哪些状态信息、提示文本）
    - 操作栏按钮（确认、跳过等按钮文案和启用条件）
    - 徽章显示（是否需要在环形座位图上添加徽章，对谁可见）
    - 可见状态字段（`_getVisibleRoleStates` 中需暴露的字段）
    - 白天阶段 UI 影响（如有特殊白天交互）

    **选择模式说明**：
    - `single`：通过环形座位图点击单个玩家头像选目标（如 doctor, bodyguard）。在 `roleHasNightAction()` 注册即可，框架自动支持。
    - `multi`：通过环形座位图点击多个玩家头像（如 cupid 选 2 人, piper 选 N 人）。需要在 `ui.js` 中添加专用的 `_get{Role}SelectionConfig()` 和 `_handle{Role}Select()` 方法。
    - `none`：无需选择玩家目标，使用中央面板按钮触发（如 witch save, idiot 被动）。

11. **测试场景**（至少 30 个）
    - 基础功能测试场景
    - 交互测试场景
    - 边界情况测试场景
    - 配置选项测试场景

### 决策指南

#### 角色类型判断
基于角色描述，判断角色属于以下哪种类型：

1. **主动夜间技能**：每晚主动选择目标执行能力
   - 示例：预言家、医生、守卫、女巫
   - 需要：UI 面板、优先级分配、验证逻辑

2. **被动能力**：无主动行动，能力自动触发
   - 示例：猎人（死亡时射击）、白痴（处决时不死）
   - 需要：触发器逻辑、特殊处理

3. **首夜特殊**：仅首夜行动，之后无能力或变化
   - 示例：丘比特（连结恋人）、盗贼（交换角色）
   - 需要：round === 1 检查、状态转换

4. **持续状态**：赋予玩家持续的特殊状态
   - 示例：恋人（连结状态）、魅惑（魔笛手魅惑的玩家）
   - 需要：状态存储、多阶段影响

5. **第三方阵营**：独立胜利条件
   - 示例：连环杀手、吹笛者
   - 需要：自定义胜利条件、独立目标追踪
   - **必须**：明确指定在胜利条件优先级表中的位置（参考 `RULES.md` 第 9.1 节），并编写优先级冲突测试

#### 优先级分配

参考现有优先级表，为新角色分配合适的优先级：

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

**分配原则**：
- 首夜特殊：1-2
- 信息获取：3-5（在击杀前）
- 保护类：6-7（在击杀前）
- 击杀类：8-9
- 救援/反击：10+（在击杀后）

#### 交互分析

分析新角色与现有角色的交互：

- **保护类交互**：是否会被医生/守卫保护？是否与保护冲突？
- **击杀类交互**：是否会产生击杀？是否可被击杀？
- **女巫交互**：女巫能否救回/毒杀？是否有特殊规则？
- **猎人交互**：角色死亡是否触发猎人技能？
- **状态交互**：是否受恋人、魅惑等状态影响？

### 输出验证

完成后检查：

- [ ] 所有 11 个章节完整
- [ ] 边界情况 ≥ 5 个
- [ ] 测试场景 ≥ 30 个
- [ ] 数据结构清晰定义
- [ ] 夜间行动优先级合理分配
- [ ] 胜利条件优先级明确（第三方阵营须指定在优先级表中的位置）
- [ ] 交互分析全面
- [ ] UI 交互方式明确（选择模式、面板内容、徽章、可见状态）

---

## ⛔ 人工审核关卡（必须）

**阶段 1 完成后，你必须暂停并等待用户审核。禁止自动进入阶段 2。**

完成阶段 1 后，执行以下操作：

1. **报告完成**：告知用户文档已生成，给出文件路径
2. **提供摘要**：角色类型、阵营、优先级、关键能力、主要交互
3. **请求审核**：明确输出以下文字：

   > 📋 阶段 1（文档）已完成，请审核 `docs/games/werewolf/roles/{roleId}.md`。
   > 确认无误后回复 **"继续"** 以进入代码实现阶段。
   > 如有修改意见请直接提出，我会先修改文档。

4. **等待确认**：在收到用户明确确认前，不得执行阶段 2 的任何操作

**审核要点**（供用户参考）：
- 角色能力描述是否准确
- 优先级分配是否合理
- 与其他角色的交互是否正确
- 边界情况是否覆盖完整
- 数据结构设计是否合理

---

## 阶段 2: 实现代码

### 2.1 修改 `config.json`

**文件路径**：`frontend/src/games/werewolf/config.json`

#### 操作 1: 添加角色定义

在 `"roles"` 对象中添加：

```json
"{roleId}": {
  "id": "{roleId}",
  "name": "角色中文名",
  "team": "village|werewolf|third_party",
  "priority": "P0|P1|P2|P3",
  "description": "简短描述",
  "actionTypes": ["NIGHT_XXX_ACTION"],  // 如无夜间行动则为空数组
  "abilities": ["ability1", "ability2"]
}
```

#### 操作 2: 添加夜间优先级（如适用）

在 `"nightActionPriority"` 数组中添加或更新：

```json
{
  "priority": 数字,
  "roles": ["existingRole", "{roleId}"],
  "description": "行动描述"
}
```

**注意**：如果优先级已存在（如 7: doctor/bodyguard），则添加到该优先级的 roles 数组中。

#### 操作 3: 添加配置选项（如适用）

在 `"settingsSchema"` 对象中添加：

```json
"{optionName}": {
  "type": "boolean|select|number",
  "label": "选项中文名",
  "default": "默认值",
  "options": [  // 仅 type === "select"
    { "value": "value1", "label": "显示名1" },
    { "value": "value2", "label": "显示名2" }
  ]
}
```

#### 操作 4: 更新默认配置

在 `"rules"` 对象中添加：

```json
"{optionName}": "默认值"
```

### 2.2 修改 `rules.js`

**文件路径**：`frontend/src/games/werewolf/rules.js`

#### 操作 1: 添加验证规则

在 `validateNightAction` 函数中（如是夜间行动）或 `validateDayVote` 中（如是白天行动），添加 case：

```javascript
case 'NIGHT_{ROLE}_ACTION': {
  // 检查目标是否存在且存活
  if (!targetId || !state.playerMap[targetId]?.alive) {
    return { valid: false, error: '目标无效' };
  }

  // 检查角色特定条件
  if (/* 条件1 */) {
    return { valid: false, error: '错误消息1' };
  }

  if (/* 条件2 */) {
    return { valid: false, error: '错误消息2' };
  }

  break;
}
```

#### 操作 2: 添加解析逻辑

在 `resolveNightActions` 函数中，根据优先级在适当位置添加：

```javascript
// ── Step X: {角色名}行动 ──
const {roleId}Actions = [];
for (const [, action] of Object.entries(state.nightActions)) {
  if (action.actionType === 'NIGHT_{ROLE}_ACTION' && action.actionData?.targetId) {
    {roleId}Actions.push({
      targetId: action.actionData.targetId,
      // 其他相关数据
    });
  }
}

// 处理行动效果
for (const action of {roleId}Actions) {
  // 应用效果到 kills, protections, announcements 等
}
```

#### 操作 3: 处理交互

如果与其他角色有特殊交互（如 bodyguard-witch conflict），添加交互逻辑：

```javascript
// ── Step X.5: {角色名}交互处理 ──
if (/* 交互条件 */) {
  // 处理交互效果
  announcements.push({
    type: 'interaction_type',
    message: '交互消息'
  });
}
```

### 2.3 修改 `index.js`

**文件路径**：`frontend/src/games/werewolf/index.js`

#### 操作 1: 添加 ACTION_TYPES

在 `export const ACTION_TYPES` 对象中添加（约第 31-46 行）：

```javascript
NIGHT_{ROLE}_ACTION: 'NIGHT_{ROLE}_ACTION',
```

#### 操作 2: 初始化角色状态

在 `initialize` 方法的 `roleStates` 对象中添加（约第 176-180 行）：

```javascript
{roleId}LastAction: null,
{roleId}UsedAbility: false,
// 其他角色特定状态
```

#### 操作 3: 添加行动处理

在 `processMove` 方法的 switch 语句中添加 case（约第 339-347 行）：

```javascript
case ACTION_TYPES.NIGHT_{ROLE}_ACTION:
  this._collectNightAction(newState, move);
  if (newState.pendingNightRoles.length === 0) {
    advanceNightStep(newState, helpers);
  }
  break;
```

#### 操作 4: 更新状态

在 `_collectNightAction` 方法或相关位置更新状态（约第 584-670 行）：

```javascript
if (actionType === ACTION_TYPES.NIGHT_{ROLE}_ACTION) {
  state.roleStates.{roleId}LastAction = actionData?.targetId || null;
  state.roleStates.{roleId}UsedAbility = true;
}
```

#### 操作 5: 添加游戏选项

在 `initialize` 方法的 `gameOptions` 对象中添加（约第 86-100 行）：

```javascript
{optionName}: options.{optionName} ?? config.rules.{optionName},
```

### 2.4 修改 `ui-panels-night.js`（如有夜间行动）

**文件路径**：`frontend/src/games/werewolf/ui-panels-night.js`

#### 操作 1: 创建渲染函数

添加导出函数：

```javascript
/**
 * 渲染 {角色名} 夜间面板
 * @param {Object} ctx - { state, playerId, selectedTarget }
 * @returns {HTMLElement}
 */
export function render{Role}Panel(ctx) {
  const { state, playerId, selectedTarget } = ctx;
  const lastAction = state.roleStates?.{roleId}LastAction;

  const panel = document.createElement('div');
  panel.className = 'role-action-panel';

  // 显示上次行动信息
  if (lastAction) {
    const info = document.createElement('p');
    info.className = 'info-text';
    info.textContent = `上次保护：${state.playerMap[lastAction]?.nickname || '未知'}`;
    panel.appendChild(info);
  }

  // 显示当前选择
  if (selectedTarget) {
    const current = document.createElement('p');
    current.className = 'current-selection';
    current.textContent = `当前选择：${state.playerMap[selectedTarget]?.nickname || '未知'}`;
    panel.appendChild(current);
  }

  // 显示限制提示（如适用）
  if (/* 有限制条件 */) {
    const warning = document.createElement('p');
    warning.className = 'warning-text';
    warning.textContent = '警告信息';
    panel.appendChild(warning);
  }

  return panel;
}
```

**UI 原则**：
- 保持简洁，只显示关键信息
- 复用现有 CSS 类名
- 参考 `renderDoctorPanel` 和 `renderBodyguardPanel`

#### 操作 2: 添加到主渲染器

在 `renderNightPanel` 函数的 switch 语句中添加（约第 30-50 行）：

```javascript
case '{roleId}':
  el.appendChild(render{Role}Panel(ctx));
  break;
```

### 代码质量检查

完成代码后，检查以下项目：

- [ ] ACTION_TYPES 已添加并导出
- [ ] 验证规则覆盖所有边界情况
- [ ] 状态初始化完整（包括所有需要的字段）
- [ ] 行动处理逻辑正确（processMove 中有对应 case）
- [ ] 与其他角色的交互已实现
- [ ] 配置选项已添加到 gameOptions
- [ ] UI 面板简洁清晰（如适用）
- [ ] 代码符合项目风格（camelCase, 2-space indent）
- [ ] 无冗余代码
- [ ] 关键逻辑有注释

---

## 阶段 3: 创建测试

### 任务

在 `frontend/src/games/werewolf/index.test.js` 文件末尾添加测试套件。

### 测试结构

```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// {ROLE} (P1) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('{Role} (P1)', () => {
  // 测试用玩家配置
  const P1_{ROLE}_COUNTS = {
    werewolf: 2,
    seer: 1,
    doctor: 1,
    {roleId}: 1,
    // 根据需要添加其他角色
    villager: 1
  };

  const PLAYERS = [
    ...SEVEN_PLAYERS,  // 或 TEST_PLAYERS，根据需要
    { id: 'p8', nickname: 'Player8' }  // 如需 8 人
  ];

  // ─── 基础功能测试 ───

  describe('Basic Functionality', () => {
    it('should perform basic ability correctly', () => {
      const { game } = setupGame({
        players: PLAYERS,
        roleCounts: P1_{ROLE}_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: '{roleId}',
          // 其他角色分配
        }
      });

      // 执行夜间行动
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_{ROLE}_ACTION, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});

      // 验证结果
      const state = game.getState();
      expect(state.roleStates.{roleId}LastAction).toBe('p8');
      // 其他断言
    });

    it('should enforce validation rule 1', () => {
      // 使用 validateMove 测试验证规则
      const { game, state } = setupGame({ /* ... */ });

      // 确保角色在 pendingNightRoles 中
      if (!state.pendingNightRoles.includes('p5')) {
        state.pendingNightRoles.push('p5');
      }

      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_{ROLE}_ACTION, actionData: { targetId: 'invalid' } },
        state
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('预期错误消息');
    });

    // 3-5 个基础功能测试
  });

  // ─── 角色交互测试 ───

  describe('Interactions with Other Roles', () => {
    it('should interact correctly with {role1}', () => {
      // 测试与特定角色的交互
    });

    it('should interact correctly with {role2}', () => {
      // 测试与另一个角色的交互
    });

    // 每个相关角色 1-2 个交互测试
  });

  // ─── 边界情况测试 ───

  describe('Edge Cases', () => {
    it('should handle first night special case', () => {
      // 测试首夜特殊逻辑（如适用）
    });

    it('should handle death trigger', () => {
      // 测试死亡触发（如适用）
    });

    it('should handle ability limit', () => {
      // 测试能力限制（次数、冷却等）
    });

    it('should handle multiple effects stacking', () => {
      // 测试多重效果叠加
    });

    it('should handle config option variant', () => {
      // 测试配置选项的不同设置
    });

    // 至少 5 个边界情况测试
  });
});
```

### 测试辅助工具

使用现有的测试辅助函数：

```javascript
// 初始化游戏
const { game, state } = setupGame({
  players: PLAYERS,
  roleCounts: ROLE_COUNTS,
  roleMap: { p1: 'werewolf', p2: 'seer', ... },
  options: { optionName: value }
});

// 提交夜间行动
submitNight(game, playerId, actionType, actionData);

// 跳过白天进入夜晚
advanceToNight(game);

// 推进到讨论阶段
advanceToDiscussion(game);

// 执行投票
playVoteRound(game, { p1: 'p2', p2: 'p3' });  // votePlan
```

### 重要注意事项

1. **女巫行动**：女巫的 `NIGHT_WITCH_SAVE` 和 `NIGHT_WITCH_POISON` 之后需要显式 `NIGHT_SKIP`：
   ```javascript
   submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_SAVE, {});
   submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
   ```

2. **状态属性名**：确保使用正确的状态属性：
   - `state.nightDeaths` 而非 `state.deaths`
   - `state.playerMap[id].alive` 检查存活状态

3. **executeMove vs validateMove**：
   - `executeMove` 返回 `{ success: boolean, error: string }`
   - `validateMove` 返回 `{ valid: boolean, error: string }`

4. **夜间步骤顺序**：按照优先级顺序提交行动（seer → doctor → bodyguard → werewolf → witch）

### 测试数量指南

- **简单角色**：8-10 个测试
- **中等复杂**：10-12 个测试
- **复杂角色**：12-15 个测试

### 运行测试

```bash
cd frontend
npm test -- src/games/werewolf/index.test.js
```

### 修复失败测试

如果测试失败，检查：

1. ACTION_TYPES 是否正确导出
2. 状态属性名称是否一致
3. 验证逻辑返回格式是否正确
4. 女巫行动后是否添加 NIGHT_SKIP
5. 使用 `game.getState()` 打印实际状态进行调试

### 输出验证

- [ ] 所有测试通过（绿色 ✓）
- [ ] 测试数量符合指南（10-15 个）
- [ ] 覆盖所有主要功能
- [ ] 覆盖所有边界情况（至少 5 个）
- [ ] 测试代码清晰易懂
- [ ] 测试用例相互独立

---

## 阶段 4: 提交代码

### Git 提交

```bash
# 查看修改状态
git status

# 添加所有修改
git add -A

# 创建提交
git commit -m "$(cat <<'EOF'
feat(werewolf): add {roleId} role (P1)

Implements {roleId} role with complete documentation, code, and tests.

Changes:
- Add {roleId} role documentation (docs/games/werewolf/roles/{roleId}.md)
- Add {roleId} definition to config.json
- Add {roleId} validation and resolution logic to rules.js
- Add {roleId} ACTION_TYPES and state management to index.js
- Add {roleId} night panel to ui-panels-night.js (if applicable)
- Add {roleId} test suite (N tests) to index.test.js

Tests: XXX frontend (XXX werewolf) / XXX backend - all passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# 查看提交
git log --oneline -1
```

---

## 最终检查清单

### 文档

- [ ] 所有 11 个章节完整
- [ ] 边界情况 ≥ 5 个
- [ ] 测试场景 ≥ 30 个
- [ ] 数据结构清晰
- [ ] 夜间行动优先级合理
- [ ] 胜利条件优先级明确
- [ ] UI 交互方式明确

### 代码
- [ ] config.json 更新完整
- [ ] rules.js 验证和解析逻辑正确
- [ ] index.js ACTION_TYPES, 状态管理完整
- [ ] ui-panels-night.js UI 简洁（如适用）
- [ ] 代码符合风格规范

### 测试
- [ ] 所有测试通过
- [ ] 测试数量充足（10-15 个）
- [ ] 覆盖所有功能和边界情况
- [ ] 测试代码清晰

### 提交
- [ ] 提交信息清晰
- [ ] 包含 Co-Authored-By
- [ ] 所有文件已暂存
- [ ] 测试通过

---

## 完成

恭喜！角色开发完成。请向用户报告：

1. **文档位置**：`docs/games/werewolf/roles/{roleId}.md`
2. **代码修改**：列出修改的文件
3. **测试结果**：测试数量和通过状态
4. **提交哈希**：git commit hash
5. **下一步建议**：是否需要手动测试，是否继续开发其他角色
```

---

## 使用示例

### 示例 1: 开发丘比特角色

```markdown
# 任务：开发狼人杀新角色

## 输入

**角色ID**：cupid
**角色描述**：丘比特在首夜连结两名玩家为恋人，恋人一方死亡时另一方殉情。丘比特连结后变为普通村民。村民阵营，但如果两名恋人中有一狼一村，则恋人双方都脱离原阵营，单独获胜条件为"恋人存活且其他所有人死亡"。

[... 后续按照模板执行 ...]
```

### 示例 2: 开发白痴角色

```markdown
# 任务：开发狼人杀新角色

## 输入

**角色ID**：idiot
**角色描述**：白痴是村民阵营角色。白痴在白天被投票处决时不会死亡，而是翻开身份证明自己是白痴，但之后失去投票权。白痴被狼人杀死时正常死亡。白痴的胜利条件与村民阵营相同。

[... 后续按照模板执行 ...]
```

---

## 附录：快速参考

### 常用 ACTION_TYPES 命名规范
- `NIGHT_{ROLE}_ACTION` - 夜间主要行动
- `DAY_{ROLE}_ACTION` - 白天主要行动
- `{ROLE}_SPECIAL` - 特殊行动

### 常用状态字段命名
- `{roleId}LastAction` - 上次行动的目标
- `{roleId}UsedAbility` - 是否已使用能力
- `{roleId}Count` - 使用次数计数

### 常用验证错误消息
- `"目标无效"` - 目标不存在或已死亡
- `"{角色}不能{行动}自己"` - 自我目标限制
- `"不能连续两晚{行动}同一人"` - 重复目标限制
- `"{能力}已用完"` - 次数限制
- `"当前不是你的行动阶段"` - 时机错误

---

## 版本信息

**版本**：1.0
**更新日期**：2026-02-15
**基于**：bodyguard 角色开发经验
