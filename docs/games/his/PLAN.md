# Here I Stand (教改风云) - 开发总体计划

## Context

Here I Stand (HIS) 是一款经典的卡牌驱动六方兵棋桌游，覆盖 16 世纪欧洲宗教改革时代（1517-1555）。目标是在现有桌游平台上实现完整的线上多人版本。

**决策**：1517 全剧本优先 | SVG 交互地图 | 暂不支持 AI | 核心机制优先，渐进扩展

---

## 当前进度

| 指标 | 数值 |
|------|------|
| 源码文件 | 37 个 JS 文件 |
| 测试文件 | 30 个 test.js 文件 |
| 源码行数 | ~12,500 行 |
| 测试行数 | ~8,000 行 |
| 单元测试 | **718 个**，全部通过 |
| 事件处理器 | 25/135 张卡牌已实现 |

**已完成 Phase**：0 ✅ → 1 ✅ → 2 ✅ → 3 ✅ → 4 ✅ → 5 ✅ → 6 (部分) → 7 ✅

**当前**：Phase 6 补全（剩余事件卡）

---

## 实际文件结构

```
frontend/src/games/his/
├── config.json                          # 游戏元数据
├── constants.js                    623  # 枚举、代价表、辩士、VP轨、领袖、战斗参数
├── index.js                        878  # HISGame（入口、validateMove、processMove）
├── test-helpers.js                      # createTestState()、createMockHelpers()
│
├── data/
│   ├── cards.js                  1,381  # 135 张卡牌定义
│   ├── map-data.js               1,660  # 134 陆地空间 + 15 海域 + 邻接
│   ├── leaders.js                       # 38 领袖/探险家/征服者
│   └── setup-1517.js                    # 1517 初始设置
│
├── state/
│   ├── state-init.js               313  # 初始状态构建（含所有 pending 字段）
│   ├── state-helpers.js            627  # 查询工具（getUnitsInSpace、路径搜索、辩士查询等）
│   ├── state-visible.js                 # getVisibleState() 信息过滤
│   ├── war-helpers.js                   # areAtWar()、areAllied()
│   ├── victory-checks.js               # checkImmediateVictory()
│   └── reformer-helpers.js             # 宗教改革者追踪
│
├── actions/
│   ├── action-types.js                  # ACTION_TYPES 常量
│   ├── cp-manager.js                    # CP 花费模式生命周期
│   ├── military-actions.js         364  # 移动、征募、建造（陆地）
│   ├── naval-actions.js            322  # 海军移动、海盗
│   ├── combat-actions.js           288  # 野战结算
│   ├── siege-actions.js            278  # 围城（强攻、LOC、解围）
│   ├── interception.js                  # 拦截
│   ├── retreat.js                       # 撤退
│   ├── religious-actions.js        387  # 改革/反改革、出版、翻译、焚书、耶稣会
│   ├── debate-actions.js           569  # 辩论（含特伦托会议多轮结算）
│   ├── diplomacy-actions.js        371  # 宣战、求和、谈判、赎回领袖
│   ├── excommunication-actions.js  243  # 绝罚改革者/统治者
│   ├── event-actions.js            881  # 事件分发表 EVENT_HANDLERS[N]（25 张）
│   ├── new-world-actions.js             # 探索、征服、殖民
│   ├── loan-actions.js                  # 中队借调（盟友间）
│   └── conclave-actions.js              # 教宗选举
│
└── phases/
    ├── phase-manager.js            247  # 阶段状态机 + 胜利判定
    ├── phase-card-draw.js               # 抽牌阶段
    ├── phase-diplomacy.js               # 外交阶段（5 段式）
    ├── phase-spring-deployment.js       # 春季部署
    ├── phase-diet-of-worms.js      223  # 沃尔姆斯帝国议会（T1 特殊）
    ├── phase-luther95.js                # 95 条论纲（T1 特殊）
    ├── phase-new-world.js          313  # 新世界探索结算
    └── phase-winter.js             335  # 冬季阶段（9 步骤）
```

### 计划 vs 实际差异

原计划中设计但未采用的目录/文件：
- ❌ `rules/` 目录 — 验证逻辑直接放在各 `actions/` 文件中（validate + execute 模式）
- ❌ `data/units.js` — 单位类型定义合并到 `constants.js`
- ❌ `phases/phase-action.js` — 行动阶段脉冲轮转集成在 `index.js` 的 processMove 中
- ❌ `phases/phase-response.js` — 响应卡窗口通过 `pendingBattle`/`pendingResponse` 状态管理
- ❌ `map/` 目录 — UI 层尚未实现
- ❌ `ui/` 目录 — UI 层尚未实现

---

## 开发阶段

### Phase 0: 文档与数据基础 ✅ 完成

| # | 任务 | 状态 |
|---|------|------|
| 0.1 | PLAN.md 开发计划 | ✅ |
| 0.2 | config.json 游戏元数据 | ✅ |
| 0.3 | constants.js 枚举与参数表 | ✅ |
| 0.4 | cards.js 135 张卡牌 | ✅ |
| 0.5 | map-data.js 134 空间 + 15 海域 | ✅ |
| 0.6 | leaders.js 38 领袖/探险家 | ✅ |
| 0.7 | setup-1517.js 初始设置 | ✅ |
| 0.8 | 数据完整性测试 | ✅ state-init.test.js (33 tests) |

---

### Phase 1: 引擎骨架与回合结构 ✅ 完成

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 1.1 | HISGame 类 | `index.js` | ✅ |
| 1.2 | 初始状态构建 | `state/state-init.js` | ✅ |
| 1.3 | 阶段状态机 | `phases/phase-manager.js` | ✅ |
| 1.4 | 抽牌阶段 | `phases/phase-card-draw.js` | ✅ |
| 1.5 | 冬季阶段 | `phases/phase-winter.js` | ✅（9 步完整） |
| 1.6 | 外交阶段 | `phases/phase-diplomacy.js` | ✅（5 段式） |
| 1.7 | 脉冲轮转 | `index.js` processMove | ✅（集成在入口） |
| 1.8 | getVisibleState | `state/state-visible.js` | ✅ |
| 1.9 | 状态查询工具 | `state/state-helpers.js` | ✅ |

---

### Phase 2: 卡牌打出与 CP 行动 ✅ 完成

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 2.1 | 卡牌打出验证 | `index.js` validateMove | ✅ |
| 2.2 | CP 花费管理 | `actions/cp-manager.js` | ✅ |
| 2.3 | 陆地移动 | `actions/military-actions.js` | ✅ |
| 2.4 | 建造单位 | `actions/military-actions.js` | ✅ |
| 2.5 | PASS 行动 | `index.js` | ✅ |
| 2.6 | 宗教改革/反改革 | `actions/religious-actions.js` | ✅ |
| 2.7 | 出版论著 | `actions/religious-actions.js` | ✅ |
| 2.8 | 翻译圣经 | `actions/religious-actions.js` | ✅ |
| 2.9 | 神学辩论 | `actions/debate-actions.js` | ✅ |
| 2.10 | 新教空间轨道 | `state/state-helpers.js` recountProtestantSpaces | ✅ |

---

### Phase 3: 战斗系统 ✅ 完成

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 3.1 | 野战结算 | `actions/combat-actions.js` | ✅ |
| 3.2 | 围城机制 | `actions/siege-actions.js` | ✅（含 LOC 验证） |
| 3.3 | 海战结算 | `actions/naval-actions.js` | ✅ |
| 3.4 | 撤退 | `actions/retreat.js` | ✅ |
| 3.5 | 拦截 | `actions/interception.js` | ✅ |
| 3.6 | 领袖被俘 | `actions/combat-actions.js`, `siege-actions.js` | ✅ |

---

### Phase 4: 外交系统 ✅ 完成

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 4.1 | 宣战 | `actions/diplomacy-actions.js` | ✅ |
| 4.2 | 求和 | `actions/diplomacy-actions.js` | ✅ |
| 4.3 | 结盟/谈判 | `actions/diplomacy-actions.js` | ✅ |
| 4.4 | 赎回领袖 | `actions/diplomacy-actions.js` | ✅ |
| 4.5 | 中队借调 | `actions/loan-actions.js` | ✅ |
| 4.6 | 战争/同盟查询 | `state/war-helpers.js` | ✅ |

---

### Phase 5: VP 计分与胜利条件 ✅ 完成

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 5.1 | VP 计算 | `constants.js` KEY_VP_TRACK | ✅ |
| 5.2 | 25 VP 自动胜利 | `state/victory-checks.js` | ✅ |
| 5.3 | 统治胜利（T4+，差距≥5） | `state/victory-checks.js` | ✅ |
| 5.4 | 第 9 回合终局 | `phases/phase-manager.js` resolveVictoryDetermination | ✅ |
| 5.5 | 即时胜利检测 | `state/victory-checks.js` checkImmediateVictory | ✅ |

---

### Phase 6: 卡牌事件 ⚠️ 部分完成（25/135）

> 框架完成，已实现 25 张关键事件卡处理器。

| # | 任务 | 状态 |
|---|------|------|
| 6.1 | 事件分发框架 `EVENT_HANDLERS[N]` | ✅ |
| 6.2 | Home Cards (#1-#7) | ✅ 7 张全部实现 |
| 6.3 | 统治者继承 (#10, #14, #19-#23) | ✅ 7 张 |
| 6.4 | 特殊事件 (#9, #11-#13, #15-#18) | ✅ 8 张 |
| 6.5 | 外交/军事事件 (#97, #113, #114) | ✅ 3 张 |
| 6.6 | 剩余事件卡 (~110 张) | ❌ 待实现 |

**已实现的 25 张**：
`#1` Janissaries, `#2` Holy Roman Emperor, `#3` Six Wives, `#4` Francis I,
`#5` Clement VII, `#6` Leipzig Debate, `#7` Here I Stand,
`#9` Barbary Pirates, `#10` Clement VII (succession), `#11` Schmalkaldic League,
`#12` Copernicus, `#13` Michelangelo, `#14` Paul III,
`#15` Printing Press, `#16` Peasants War, `#17` Council of Trent,
`#18` Dragut, `#19` Edward VI, `#20` Henry II, `#21` Mary I,
`#22` Julius III, `#23` Elizabeth I,
`#97` Scots Raid, `#113` Imperial Coronation, `#114` La Forêt's Embassy

---

### Phase 7: 特殊机制 ✅ 完成

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 7.1 | 亨利八世婚姻/继承 | `actions/event-actions.js` #3,#19,#21,#23 | ✅ |
| 7.2 | 新世界探索/征服/殖民 | `actions/new-world-actions.js`, `phases/phase-new-world.js` | ✅ |
| 7.3 | 海盗 | `actions/naval-actions.js` | ✅ |
| 7.4 | 绝罚机制 | `actions/excommunication-actions.js` | ✅ |
| 7.5 | 辩士承诺/取消 | `actions/debate-actions.js` | ✅ |
| 7.6 | 焚烧书籍 | `actions/religious-actions.js` | ✅ |
| 7.7 | 耶稣会 | `actions/religious-actions.js` | ✅ |
| 7.8 | 施马尔卡尔登联盟 | `actions/event-actions.js` #11 | ✅ |
| 7.9 | 宗教改革者追踪 | `state/reformer-helpers.js` | ✅ |
| 7.10 | 特伦托会议（多轮辩论） | `actions/debate-actions.js` | ✅ |
| 7.11 | 教宗选举 | `actions/conclave-actions.js` | ✅ |
| 7.12 | Turn 1 特殊阶段 | `phases/phase-luther95.js`, `phase-diet-of-worms.js` | ✅ |
| 7.13 | 春季部署 | `phases/phase-spring-deployment.js` | ✅ |
| 7.14 | 围城 LOC 验证 | `actions/siege-actions.js` hasLineOfCommunication | ✅ |
| 7.15 | 中队借调 | `actions/loan-actions.js` | ✅ |

---

### Phase 8: 剩余事件卡补全 ❌ 待开始

> 实现剩余 ~110 张事件卡处理器。按势力分批。

| # | 任务 | 卡牌数 |
|---|------|--------|
| 8.1 | 奥斯曼事件 | ~12 张 |
| 8.2 | 哈布斯堡事件 | ~12 张 |
| 8.3 | 英格兰事件 | ~12 张 |
| 8.4 | 法兰西事件 | ~12 张 |
| 8.5 | 教廷事件 | ~12 张 |
| 8.6 | 新教事件 | ~12 张 |
| 8.7 | 通用/外交事件 | ~25 张 |
| 8.8 | 响应卡 + 战斗卡 | ~15 张 |

**里程碑**：135 张卡牌事件全部可用

---

### Phase 9: SVG 地图与基础 UI ❌ 待开始

> 可视化、可交互的游戏界面。可从 Phase 2 起并行。

| # | 任务 | 文件 |
|---|------|------|
| 9.1 | 制作/转换欧洲 SVG 地图 | `map/map-svg.js` |
| 9.2 | SVG 渲染、缩放、平移 | `map/map-svg.js` |
| 9.3 | 单位/控制/宗教标记叠加 | `map/map-overlay.js` |
| 9.4 | 空间点击、移动交互 | `map/map-interaction.js` |
| 9.5 | 主 UI 类 | `ui/ui.js` |
| 9.6 | 手牌显示与打出 | `ui/ui-hand.js` |
| 9.7 | 势力仪表盘 | `ui/ui-power-panel.js` |
| 9.8 | 回合/阶段状态栏 | `ui/ui-status-bar.js` |

**里程碑**：首个"可发布"版本——通过 Web UI 完整游玩

---

### Phase 10: 高级 UI 与打磨 ❌ 待开始

| # | 任务 |
|---|------|
| 10.1 | 战斗结算 UI（骰子动画） |
| 10.2 | 外交协商界面 |
| 10.3 | 宗教改革 UI |
| 10.4 | 行动选择面板 |
| 10.5 | 工具提示（空间、单位、卡牌） |
| 10.6 | 游戏日志面板 |
| 10.7 | 玩家规则书 `his.html` |
| 10.8 | CSS 主题对齐 |

---

### Phase 11: 场景、边界与多人测试 ❌ 待开始

| # | 任务 |
|---|------|
| 11.1 | 2-5 人变体（一人控制多势力） |
| 11.2 | 锦标赛场景（1532） |
| 11.3 | 边界用例全面测试 |
| 11.4 | 多人网络同步验证 |
| 11.5 | 大状态深拷贝性能优化 |
| 11.6 | 存档/读档 |

---

## 关键技术决策

| 决策 | 方案 | 理由 |
|------|------|------|
| **状态深拷贝** | `JSON.parse(JSON.stringify())` | 与现有游戏一致；如有性能问题再引入 Immer |
| **事件系统** | 注册表模式 `EVENT_HANDLERS[N]` | 每个 handler 独立可测，避免巨型 switch |
| **规则验证** | validate + execute 模式（每个 action 文件内） | 原计划的 `rules/` 目录改为直接集成在 actions/ |
| **脉冲轮转** | 集成在 `index.js` processMove | 不需要独立的 `phase-action.js` |
| **响应卡窗口** | `pendingBattle`/`pendingResponse` 状态 | 中断式状态机 |
| **地图渲染** | 静态 SVG 底图 + 动态 SVG 叠加 | 可缩放、CSS 可控 |
| **信息隐藏** | `getVisibleState(playerId)` | 每方只能看到自己的手牌 |
| **2-5 人支持** | 一人控制多势力 | `activePower` 追踪行动势力 |
| **文件拆分** | 按职责拆分，每文件 < 1000 行 | 遵循 dev_rules 规范 |
| **helpers 注入** | `_getPhaseHelpers()` | 解决 phases/ 与 index.js 的循环依赖 |

---

## 规模统计（实际）

| 阶段 | 计划行数 | 实际行数 | 状态 |
|------|---------|---------|------|
| Phase 0 数据 | ~4,000 | ~3,700 | ✅ |
| Phase 1 引擎骨架 | ~2,500 | ~2,100 | ✅ |
| Phase 2 卡牌与 CP | ~2,500 | ~2,400 | ✅ |
| Phase 3 战斗系统 | ~2,500 | ~1,500 | ✅ |
| Phase 4 外交 | ~1,500 | ~900 | ✅ |
| Phase 5 VP 与胜利 | ~1,000 | ~400 | ✅ |
| Phase 6 事件卡 | ~3,000 | ~900 (25/135) | ⚠️ |
| Phase 7 特殊机制 | ~2,500 | ~1,500 | ✅ |
| Phase 8 剩余事件 | — | — | ❌ |
| Phase 9 SVG+UI | ~4,000 | — | ❌ |
| Phase 10 高级 UI | ~3,000 | — | ❌ |
| Phase 11 场景测试 | ~1,000 | — | ❌ |
| **源码合计** | ~27,500 | **~12,500** | |
| **测试合计** | ~8,000-12,000 | **~8,000** | 718 tests |

**依赖关系图**：
```
P0 → P1 → P2 → P3 → P5 → P6(部分) → P7 ← 当前位置
                ↘ P4 ↗                    ↓
                                          P8（剩余事件卡）
           P2 ────────────────→ P9（SVG+UI）→ P10
                                              ↑
                                    P7+P8 → P11
```

---

## 测试覆盖

| 测试文件 | 测试数 | 覆盖模块 |
|----------|--------|----------|
| state-init.test.js | 33 | 初始化、数据完整性 |
| state-helpers.test.js | 54 | 查询工具、路径搜索、辩士 |
| state-visible.test.js | 9 | 信息隐藏 |
| war-helpers.test.js | 31 | 战争/同盟状态 |
| victory-checks.test.js | 10 | 胜利条件 |
| reformer-helpers.test.js | 15 | 宗教改革者追踪 |
| cp-manager.test.js | 21 | CP 花费 |
| military-actions.test.js | 32 | 移动、征募、建造 |
| naval-actions.test.js | 25 | 海军、海盗 |
| combat-actions.test.js | 20 | 野战 |
| siege-actions.test.js | 20 | 围城、LOC |
| interception.test.js | 9 | 拦截 |
| retreat.test.js | 12 | 撤退 |
| religious-actions.test.js | 44 | 改革、出版、翻译、焚书 |
| debate-actions.test.js | 49 | 辩论 + 特伦托会议 |
| diplomacy-actions.test.js | 46 | 外交 |
| excommunication-actions.test.js | 24 | 绝罚 |
| event-actions.test.js | 79 | 事件卡（25 张） |
| new-world-actions.test.js | 28 | 新世界 |
| loan-actions.test.js | 10 | 中队借调 |
| conclave-actions.test.js | 13 | 教宗选举 |
| phase-manager.test.js | 24 | 阶段状态机 |
| phase-card-draw.test.js | 14 | 抽牌 |
| phase-diplomacy.test.js | 13 | 外交阶段 |
| phase-spring-deployment.test.js | 14 | 春季部署 |
| phase-diet-of-worms.test.js | 14 | 沃尔姆斯议会 |
| phase-luther95.test.js | 6 | 95 条论纲 |
| phase-new-world.test.js | 8 | 新世界阶段 |
| phase-winter.test.js | 18 | 冬季阶段 |
| index.test.js | 23 | 集成测试 |
| **合计** | **718** | |

运行命令：
```bash
cd frontend && npx vitest run src/games/his/
```

---

## 数据源文件

| 输出 | 来源 |
|------|------|
| `data/cards.js` | `his_ref/img/processed/all_cards_classified.json` (135 cards) |
| `data/map-data.js` | `his_ref/img/processed/his_vmod_map_data.corrected.json` (134 spaces, 15 sea zones, 223 edges) |
| `data/leaders.js` | `his_ref/img/processed/leaders_and_explorers.json` (38 leaders/explorers) |
| `data/setup-1517.js` | `his_ref/rulebook_extraction/SCENARIO_1517_SETUP.md` |
| `constants.js` | `his_ref/rulebook_extraction/RULEBOOK_FOR_DEVELOPMENT.md` + `POWER_CARDS.md` |

---

## 关键参考文件

| 文件 | 用途 |
|------|------|
| `frontend/src/game/engine.js` | 基类接口：initialize, processMove, checkGameEnd |
| `frontend/src/games/werewolf/index.js` | 复杂游戏实现参考（阶段管理、信息隐藏） |
| `frontend/src/games/werewolf/game-phases.js` | 阶段拆分 + helpers 注入模式 |
| `docs/games/TEMPLATE.md` | RULES.md 文档模板 |
