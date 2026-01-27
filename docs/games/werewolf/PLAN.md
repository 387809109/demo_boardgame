# 狼人杀游戏开发计划

> 创建日期: 2026-01-27
> 状态: 待开始

---

## 开发前准备

### 文档完善 (必须)

在编写代码前，需要完成以下文档:

- [ ] **RULES.md** - 补充完整的游戏规则细节
  - [ ] 确认支持的角色列表及能力
  - [ ] 定义夜间行动优先级顺序
  - [ ] 明确特殊规则处理 (同守同救、平票等)
  - [ ] 定义玩家数量与角色配置表

- [ ] **werewolf.html** - 补充用户规则书内容
  - [ ] 完善角色介绍
  - [ ] 添加游戏示例
  - [ ] 补充策略提示

---

## 开发阶段

### Phase 1: 游戏核心 (P0)

| 任务 ID | 描述 | 依赖 | 预估工作量 |
|---------|------|------|-----------|
| T-F070 | 创建 `games/werewolf/config.json` | RULES.md | 小 |
| T-F071 | 创建 `games/werewolf/index.js` 游戏类 | T-F070 | 大 |
| T-F072 | 创建 `games/werewolf/rules.js` 规则验证 | T-F071 | 中 |

**T-F070: config.json**
```
- 游戏元数据 (id, name, minPlayers, maxPlayers)
- 角色配置
- settingsSchema (游戏选项)
- supportsAI: false (初期不支持)
```

**T-F071: index.js (WerewolfGame 类)**
```
- initialize(config) - 角色分配、状态初始化
- processMove(move, state) - 处理各类行动
- checkGameEnd(state) - 胜利条件检查
- validateMove(move, state) - 行动合法性验证
- getVisibleState(playerId) - 玩家可见状态 (隐藏其他玩家角色)
- 阶段管理 (夜晚/白天/投票)
```

**T-F072: rules.js**
```
- 角色定义和能力
- 行动验证逻辑
- 死亡结算逻辑
- 投票计算逻辑
```

### Phase 2: UI 实现 (P0)

| 任务 ID | 描述 | 依赖 | 预估工作量 |
|---------|------|------|-----------|
| T-F073 | 创建 `games/werewolf/ui.js` | T-F071 | 大 |

**T-F073: ui.js (WerewolfUI 类)**
```
- render(state, playerId, onAction) - 主渲染
- renderNightPhase() - 夜晚界面 (角色行动)
- renderDayPhase() - 白天界面 (讨论/投票)
- renderRoleInfo() - 角色信息展示
- renderPlayerList() - 玩家列表 (存活/死亡状态)
- renderVotePanel() - 投票面板
- renderActionPanel() - 角色行动面板
```

### Phase 3: 测试 (P1)

| 任务 ID | 描述 | 依赖 | 预估工作量 |
|---------|------|------|-----------|
| T-F074 | 单元测试 | T-F072 | 中 |
| T-F075 | 集成测试 | T-F073 | 中 |

---

## 技术要点

### 1. 状态隐藏

狼人杀的核心挑战是**信息隐藏**：
- 玩家只能看到自己的角色
- 狼人可以看到其他狼人
- 预言家的查验结果只有自己知道
- 需要实现 `getVisibleState(playerId)` 返回该玩家可见的状态

```javascript
getVisibleState(playerId) {
  const visibleState = { ...this.state };

  // 隐藏其他玩家的角色
  visibleState.roles = {
    [playerId]: this.state.roles[playerId]
  };

  // 如果是狼人，显示其他狼人
  if (this.state.roles[playerId].team === 'werewolf') {
    for (const [id, role] of Object.entries(this.state.roles)) {
      if (role.team === 'werewolf') {
        visibleState.roles[id] = role;
      }
    }
  }

  return visibleState;
}
```

### 2. 阶段状态机

```
WAITING -> NIGHT -> DAY_DISCUSSION -> DAY_VOTE -> [LAST_WORDS] -> NIGHT/ENDED
```

夜晚子阶段按优先级执行:
```
GUARD_PROTECT (优先级 1)
  -> SEER_CHECK (优先级 2)
  -> WEREWOLF_KILL (优先级 3)
  -> WITCH_ACTION (优先级 4)
```

### 3. 行动收集与结算

夜晚阶段需要收集所有角色的行动，然后统一结算:

```javascript
// 收集行动
nightActions = {
  guard: { targetId: 'player3' },
  seer: { targetId: 'player2' },
  werewolf: { targetId: 'player1' },
  witch: { save: false, poison: 'player4' }
};

// 结算逻辑
resolveNight() {
  const guardTarget = nightActions.guard?.targetId;
  const killTarget = nightActions.werewolf?.targetId;

  // 判断是否被守护
  if (killTarget && killTarget !== guardTarget) {
    // 被杀死
  }
  // 女巫救人...
  // 女巫毒人...
}
```

### 4. 与 UNO 的主要差异

| 方面 | UNO | 狼人杀 |
|------|-----|--------|
| 回合制 | 严格轮流 | 阶段制 (夜晚同时行动) |
| 信息 | 部分隐藏 (手牌) | 大量隐藏 (角色) |
| 行动 | 单一玩家操作 | 多玩家同时/顺序操作 |
| 结束 | 单人获胜 | 阵营获胜 |
| 交互 | 出牌即时 | 需要收集后结算 |

---

## 文件结构

```
frontend/src/games/werewolf/
├── config.json      # 游戏配置
├── index.js         # WerewolfGame 类
├── rules.js         # 规则定义和验证
├── ui.js            # UI 组件
└── index.test.js    # 单元测试
```

---

## 风险与挑战

1. **阶段管理复杂性** - 需要精确控制夜晚各角色的行动顺序
2. **并发行动处理** - 夜晚多个角色同时行动，需要正确收集和结算
3. **信息隐藏** - 确保每个玩家只能看到应该看到的信息
4. **联机同步** - 需要处理玩家掉线、超时等情况
5. **UI 复杂度** - 需要为不同角色、不同阶段显示不同的操作界面

---

## 下一步行动

1. **获取/确认详细规则** - 与用户确认具体的规则细节
2. **完善 RULES.md** - 补充所有 TODO 项
3. **完善 werewolf.html** - 补充用户规则内容
4. **开始 Phase 1 开发** - 从 config.json 开始
