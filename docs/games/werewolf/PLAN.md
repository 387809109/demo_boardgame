# 狼人杀游戏开发计划

> 创建日期: 2026-01-27
> 最后更新: 2026-01-31
> 状态: Phase 1 ✅ + Phase 2 P0 ✅ + Phase 3 P0 测试 ✅ + 顺序夜间阶段 ✅ (综合测试未完成)

---

## 开发前准备

### 文档完善 ✅ 已完成

- [x] **RULES.md** - 完整的游戏规则细节
  - [x] 支持的角色列表及能力 (P0-P3 共 30+ 角色)
  - [x] 定义夜间行动优先级顺序 (12 级优先级)
  - [x] 明确特殊规则处理 (保护限制规则 10.4、遗言规则 10.5 等)
  - [x] 定义玩家数量与角色配置表
  - [x] 白天发言与投票秩序规则
  - [x] Leader 机制
  - [x] 日间投票多数规则 (dayVoteMajority)

- [x] **werewolf.html** - 用户规则书内容
  - [x] 完善角色介绍
  - [x] 添加游戏流程说明
  - [x] 补充策略提示

---

## 开发阶段

### Phase 1: 游戏核心框架

| 任务 ID | 描述 | 依赖 | 优先级 | 状态 |
|---------|------|------|--------|------|
| T-F070 | 创建 `games/werewolf/config.json` | RULES.md | P0 | ✅ 已完成 |
| T-F071 | 创建 `games/werewolf/index.js` 游戏类 | T-F070 | P0 | ✅ 已完成 |
| T-F072 | 创建 `games/werewolf/rules.js` 规则基础框架 | T-F071 | P0 | ✅ 已完成 |
| T-F073 | 创建 `games/werewolf/ui.js` UI 框架 | T-F071 | P0 | ✅ 已完成 |

**T-F070: config.json**
```
- 游戏元数据 (id, name, minPlayers, maxPlayers)
- gameType: "multiplayer", supportsAI: false
- settingsSchema (游戏选项)
- 基础角色配置 (P0 角色)
```

**T-F071: index.js (WerewolfGame 类)**
```
- initialize(config) - 角色分配、状态初始化
- processMove(move, state) - 处理各类行动
- checkGameEnd(state) - 胜利条件检查
- validateMove(move, state) - 行动合法性验证
- getVisibleState(playerId) - 玩家可见状态
- 阶段管理 (夜晚/白天/投票)
```

**T-F072: rules.js 基础框架**
```
- 角色基类和工厂方法
- 通用行动验证逻辑
- 死亡结算逻辑
- 投票计算逻辑
```

**T-F073: ui.js (WerewolfUI 类)**
```
- render(state, playerId, onAction) - 主渲染
- renderNightPhase() - 夜晚界面
- renderDayPhase() - 白天界面
- renderRoleInfo() / renderPlayerList()
- renderVotePanel() / renderActionPanel()
```

---

### Phase 2: 角色实现 (按优先级分批)

#### P0 角色 - 基础必备 (6 角色)

| 任务 ID | 描述 | 依赖 | 状态 |
|---------|------|------|------|
| T-F076 | 实现 P0 基础角色 | T-F072 | ✅ 已完成 |

**T-F076 包含角色:**
| 角色 | ID | 阵营 | 能力 |
|------|-----|------|------|
| 村民 | `villager` | village | 无特殊能力 |
| 狼人 | `werewolf` | werewolf | 夜晚合议击杀 |
| 预言家 | `seer` | village | 夜晚查验身份 |
| 医生 | `doctor` | village | 夜晚保护一人 |
| 猎人 | `hunter` | village | 死亡时反杀 |
| 女巫 | `witch` | village | 救人/毒杀各一次 |

**验收标准:**
- [x] 6 个 P0 角色全部可用
- [x] 基础游戏流程完整 (夜晚→白天→投票→循环)
- [x] 胜利条件正确判定
- [x] 单元测试覆盖所有 P0 角色 (82 tests)
- [ ] 手动端到端测试 (UI 渲染、多人联机)

---

#### P1 角色 - 进阶扩展 (8 角色)

| 任务 ID | 描述 | 依赖 | 状态 |
|---------|------|------|------|
| T-F077 | 实现 P1 进阶角色 | T-F076 | 待开发 |

**T-F077 包含角色:**
| 角色 | ID | 阵营 | 能力 |
|------|-----|------|------|
| 守卫 | `bodyguard` | village | 保护目标免于击杀 |
| 丘比特 | `cupid` | neutral | 首夜连结恋人 |
| 警长 | `sheriff` | village | 查验返回可疑/无辜 |
| 私刑者 | `vigilante` | village | 夜晚射杀一人 |
| 白痴 | `idiot` | village | 被投票处决时不死，失去投票权 |
| 小丑 | `jester` | neutral | 被投票处决时胜利 |
| 魔笛手 | `piper` | neutral | 魅惑全体则胜 |
| 队长 | `captain` | village | 加倍票权 |

**验收标准:**
- [ ] 8 个 P1 角色全部可用
- [ ] 恋人机制正确实现
- [ ] 中立阵营胜利条件正确
- [ ] 单元测试覆盖所有 P1 角色

---

#### P2 角色 - 高级扩展 (11 角色)

| 任务 ID | 描述 | 依赖 | 状态 |
|---------|------|------|------|
| T-F078 | 实现 P2 高级角色 | T-F077 | 待开发 |

**T-F078 包含角色:**
| 角色 | ID | 阵营 | 能力 |
|------|-----|------|------|
| 守护天使 | `guardian_angel` | village | 保护防止攻击 |
| 狱卒 | `jailer` | village | 监禁并阻止行动 |
| 小偷 | `thief` | neutral | 首夜交换角色 |
| 侦探 | `detective` | village | 比较两人阵营 |
| 炸弹人 | `bomb` | neutral | 被击杀时反杀 |
| 小女孩 | `little_girl` | village | 偷看狼人 |
| 追踪者 | `tracker` | village | 得知目标访问了谁 |
| 守望者 | `watcher` | village | 得知谁访问了目标 |
| 先知 | `oracle` | village | 死亡时公开目标身份 |
| 共济会 | `mason` | village | 互相认识 |
| 酒保 | `roleblocker` | neutral | 阻止目标行动 |

**验收标准:**
- [ ] 11 个 P2 角色全部可用
- [ ] 复杂交互正确 (监禁+阻止、追踪+守望)
- [ ] 单元测试覆盖所有 P2 角色

---

#### P3 角色 - 后续扩展 (17 角色)

| 任务 ID | 描述 | 依赖 | 状态 |
|---------|------|------|------|
| T-F079 | 实现 P3 扩展角色 | T-F078 | 待开发 |

**T-F079 包含角色:**
| 角色 | ID | 阵营 |
|------|-----|------|
| 磨坊主 | `miller` | village |
| 教父 | `godfather` | werewolf |
| 狼王 | `alpha_werewolf` | werewolf |
| 连环杀手 | `serial_killer` | neutral |
| 司机 | `bus_driver` | neutral |
| 邪教领袖 | `cult_leader` | neutral |
| 狼人首领 | `werewolf_leader` | werewolf |
| 狼人巫师 | `wolf_witch` | werewolf |
| 狼人先知 | `wolf_seer` | werewolf |
| 狼人守卫 | `wolf_guard` | werewolf |
| 黑市商人 | `dealer` | neutral |
| 纵火犯 | `arsonist` | neutral |
| 放逐者 | `exile` | neutral |
| 骗子 | `trickster` | neutral |
| 复仇者 | `avenger` | village |
| 替罪羊 | `scapegoat` | village |
| 牧师 | `priest` | village |
| 护符师 | `warder` | village |
| 沉默者 | `silencer` | werewolf |
| 影子 | `shadow` | neutral |
| 替身 | `decoy` | village |

**验收标准:**
- [ ] 所有 P3 角色可用
- [ ] 复杂阵营交互正确
- [ ] 单元测试覆盖

---

### Phase 3: 测试与优化

| 任务 ID | 描述 | 依赖 | 优先级 | 状态 |
|---------|------|------|--------|------|
| T-F074 | P0 角色单元测试 (82 tests) | T-F076 | P0 | ✅ 已完成 |
| T-F075 | 集成测试 (完整游戏流程/手动) | T-F073 | P1 | 待开发 |
| T-F080 | P1-P3 角色单元测试 | T-F077+ | P2 | 待开发 |

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

夜晚子阶段按优先级执行 (参见 RULES.md 4.2):
```
1. Cupid (连结恋人，仅首夜)
2. Thief (交换角色，仅首夜)
3. Jailer (监禁目标)
4. Roleblocker (阻止目标行动)
5. Seer/Sheriff/Detective (查验)
6. Tracker/Watcher (追踪/监视)
7. Doctor/Bodyguard/Guardian Angel (保护)
8. Werewolf (击杀)
9. Vigilante/Serial Killer (射杀/击杀)
10. Witch (救人/毒杀)
11. Piper (魅惑)
12. Oracle (标记)
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

1. ~~**获取/确认详细规则** - 与用户确认具体的规则细节~~ ✅ 已完成
2. ~~**完善 RULES.md** - 补充所有 TODO 项~~ ✅ 已完成
3. ~~**完善 werewolf.html** - 补充用户规则内容~~ ✅ 已完成
4. ~~**Phase 1 核心框架** - config/index/rules/ui~~ ✅ 已完成
5. ~~**Phase 2 P0 角色** - 6 个基础角色实现~~ ✅ 已完成
6. ~~**Phase 3 P0 测试** - 74 项单元测试~~ ✅ 已完成
7. **手动端到端测试** - UI 渲染、游戏流程、多人联机验证
8. **Phase 2 P1 角色** - 7 个进阶角色 (T-F077)
