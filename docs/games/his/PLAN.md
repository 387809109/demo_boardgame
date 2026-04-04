# Here I Stand (教改风云) - 开发总体计划

## Context

Here I Stand (HIS) 是一款经典的卡牌驱动六方兵棋桌游，覆盖 16 世纪欧洲宗教改革时代（1517-1555）。目标是在现有桌游平台上实现完整的线上多人版本。

**决策**：1517 全剧本优先 | SVG 交互地图 | AI 基于 HISBOT v1.1 行为卡系统 | 核心机制优先，渐进扩展

---

## 当前进度

| 指标 | 数值 |
|------|------|
| 源码文件 | 70 个 JS 文件 |
| 测试文件 | 48 个 test.js 文件 |
| 源码行数 | ~34,300 行 |
| 测试行数 | ~29,400 行 |
| 单元测试 | **2,403 个**，全部通过 |
| 事件处理器 | **135/135 张卡牌已实现** |

**已完成 Phase**：0 ✅ → 1 ✅ → 2 ✅ → 3 ✅ → 4 ✅ → 5 ✅ → 6 ✅ → 7 ✅ → 8 ✅ → 9 ✅ → 10 ✅(核心) → 12 ✅(AI)

**当前**：Phase 11（多人联机与打磨）⬅️ 进行中

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
│   ├── event-actions.js          1,462  # 事件分发表 EVENT_HANDLERS[N]（#1-54 + 合并）
│   ├── event-actions-extended.js 1,429  # 扩展事件处理器（#55-116）
│   ├── event-actions-diplomacy.js  420  # 外交牌事件处理器（#201-219）
│   ├── new-world-actions.js             # 探索、征服、殖民
│   ├── loan-actions.js                  # 中队借调（盟友间）
│   ├── conclave-actions.js              # 教宗选举
│   └── response-actions.js              # 响应卡系统（W1-W7 全窗口）
│
├── map/
│   ├── map-renderer.js            270  # SVG 地图渲染（134 空间 + 15 海域）
│   ├── map-overlay.js             140  # 单位/控制/宗教标记叠加
│   └── map-interaction.js         130  # 缩放、平移、触摸手势
│
├── ui/
│   ├── status-bar.js              110  # 回合/阶段/VP 状态栏
│   ├── hand-panel.js              260  # 手牌显示与选择
│   ├── power-panel.js             160  # 势力仪表盘
│   ├── action-panel.js            570  # 行动选择面板
│   ├── selection-manager.js       500  # 多步目标选择状态机
│   ├── event-display.js           310  # 卡牌事件展示（模态+横幅+日志格式化）
│   ├── combat-display.js          350  # 战斗/围城/拦截结算展示
│   ├── religious-display.js       280  # 辩论+宗教改革结算展示
│   ├── new-world-display.js      290  # 新世界探索/征服/环航结算展示
│   ├── space-detail.js            220  # 空间详情面板（点击地图空间）
│   ├── game-log.js                180  # 游戏日志面板
│   ├── diplomacy-panel.js              # 外交面板
│   ├── power-detail-panel.js           # 势力详情面板
│   └── religious-struggle-panel.js     # 宗教斗争面板
│
├── ui.js                        1,070  # HisUI 主 UI 类（集成所有子组件）
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
- ✅ `map/` 目录 — Phase 9 实现（map-renderer, map-overlay, map-interaction）
- ✅ `ui/` 目录 — Phase 9-10 实现（12 个子组件）

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

### Phase 6: 卡牌事件 ✅ 完成

> **135/135 张卡牌处理器全部实现**，分布在 3 个文件中。

| # | 任务 | 状态 |
|---|------|------|
| 6.1 | 事件分发框架 `EVENT_HANDLERS[N]` | ✅ |
| 6.2 | Home Cards (#1-#7) | ✅ 7 张 |
| 6.3 | 统治者继承 (#10, #14, #19-#23) | ✅ 7 张 |
| 6.4 | 特殊事件 (#9, #11-#13, #15-#18) | ✅ 8 张 |
| 6.5 | 外交/军事事件 (#97, #113, #114) | ✅ 3 张 |
| 6.6 | 主牌堆卡牌 (#24-#54) | ✅ 31 张 (`event-actions.js`) |
| 6.7 | 扩展事件卡 (#55-#116) | ✅ 59 张 (`event-actions-extended.js`) |
| 6.8 | 外交牌事件 (#201-#219) | ✅ 19 张 (`event-actions-diplomacy.js`) |

**测试**：79 + 120 + 32 = **231 个事件卡测试**，全部通过

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

### Phase 8: 剩余事件卡补全 ✅ 完成

> 已合并至 Phase 6 完成。135/135 处理器分布于 3 个文件，870 个测试全部通过。

---

### Phase 9: SVG 地图与基础 UI ✅ 完成

> 可视化、可交互的游戏界面。

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 9.1 | 地图坐标数据 | `data/map-data.js` (SPACE_COORDINATES) | ✅ |
| 9.2 | SVG 地图渲染 | `map/map-renderer.js` (~270 行) | ✅ |
| 9.3 | 单位/标记叠加 | `map/map-overlay.js` (~140 行) | ✅ |
| 9.4 | 缩放、平移交互 | `map/map-interaction.js` (~130 行) | ✅ |
| 9.5 | 主 UI 类 | `ui.js` (~910 行) | ✅ |
| 9.6 | 手牌面板 | `ui/hand-panel.js` (~250 行) | ✅ |
| 9.7 | 势力仪表盘 | `ui/power-panel.js` (~160 行) | ✅ |
| 9.8 | 状态栏 | `ui/status-bar.js` (~110 行) | ✅ |
| 9.9 | main.js 注册 HisUI | `main.js` | ✅ |
| 9.10 | 行动选择面板 | `ui/action-panel.js` (~570 行) | ✅ |
| 9.11 | 多步目标选择状态机 | `ui/selection-manager.js` (~500 行) | ✅ |
| 9.12 | 提示栏 + 区域/势力/部队选择器 | `ui.js` 内集成 | ✅ |
| 9.13 | 侧栏标签页（外交/详情/宗教面板） | `ui/diplomacy-panel.js` 等 | ✅ |
| 9.14 | 地图指示器（围城/骚乱徽章） | `map/map-renderer.js` | ✅ |

**里程碑**：基础 UI 框架完成——地图交互、手牌、行动选择、目标选择全链路贯通

---

### Phase 10: 卡牌事件 UI 与游戏流程 ✅ 核心完成

> **高优先级**：卡牌事件展示、游戏日志、战斗/辩论结算展示——使游戏流程可玩可读。

| # | 任务 | 文件 | 状态 | 优先级 |
|---|------|------|------|--------|
| 10.1 | 卡牌事件展示组件 | `ui/event-display.js` (~290 行) | ✅ | 🔴 高 |
| 10.2 | 游戏日志面板 | `ui/game-log.js` (~180 行) | ✅ | 🔴 高 |
| 10.3 | 战斗/围城/拦截结算展示 | `ui/combat-display.js` (~350 行) | ✅ | 🔴 高 |
| 10.4 | 辩论+宗教改革结算展示 | `ui/religious-display.js` (~280 行) | ✅ | 🟡 中 |
| 10.5 | (合并至 10.4) | — | ✅ | — |
| 10.6 | 新世界探索/征服结算展示 | `ui/new-world-display.js` (~290 行) | ✅ | 🟡 中 |
| 10.7 | 卡牌详情弹窗（右键预览+日志点击） | `ui/event-display.js` (showCard) | ✅ | 🟡 中 |
| 10.8 | 空间详情弹窗（单位列表+属性） | `ui/space-detail.js` (~220 行) | ✅ | 🟡 中 |
| 10.9 | CSS 主题对齐（统一色调） | `theme/his.css` + `ui/his-theme.js` | ✅ | 🟢 低 |
| 10.10 | 玩家规则书 | `public/rules/his/` (8 页) | ✅ | 🟢 低 |

---

### Phase 11: 多人联机与打磨 ⬅️ 进行中

> **中优先级**：网络同步、场景变体、存档等完整游戏体验。

| # | 任务 | 状态 | 优先级 |
|---|------|------|--------|
| 11.1 | 多人网络同步验证 | ✅ | 🔴 高 |
| 11.2 | 2-5 人变体（一人控制多势力） | ✅ | 🟡 中 |
| 11.3 | 锦标赛场景（1532） | ❌ | 🟡 中 |
| 11.4 | 边界用例全面测试 | ✅ | 🟡 中 |
| 11.5 | 存档/读档 | ✅ | 🟡 中 |
| 11.6 | 大状态深拷贝性能优化 | ❌ | 🟢 低 |
| 11.7 | 响应卡系统（引擎 W1-W7 + UI） | ✅ | 🟡 中 |
| 11.8 | 回放系统（查看历史行动） | ❌ | 🟢 低 |

---

### Phase 12: AI（HISBOT）✅ 完成

> **详细计划**：[`docs/games/his/AI_PLAN.md`](AI_PLAN.md)
>
> 基于 Russ Brown 的 HISBOT v1.1 非官方 AI 系统，实现卡驱动行为卡 Bot，支持 1-5 人 + Bot 补位模式。
> 参考来源：`his_ref/HISBOT.md`（原始扫描文档）

| # | 任务 | 状态 | 优先级 |
|---|------|------|--------|
| A0 | 参考文档整理（HISBOT.md → [HISBOT_REF.md](HISBOT_REF.md)，1825 行） | ✅ | 🔴 高 |
| A | 数据与基础设施（行为卡数据、牌组管理、控制器骨架、游戏循环集成） | ✅ | 🔴 高 |
| B | 阶段特定逻辑（抓牌、谈判、宣战、春季部署、冬季、新世界） | ✅ | 🔴 高 |
| C | 行动阶段出牌路由（Home/Event/Mandatory/Combat-Response 卡判定） | ✅ | 🔴 高 |
| D | 目标执行器（19 个 CP 花费目标：军事/海军/控制/宗教/新世界） | ✅ | 🔴 高 |
| E | Bot 辅助工具与战斗决策（空间计算、单位放置/移除、避战/拦截/撤退） | ✅ | 🟡 中 |
| F | 集成与打磨（全 Bot 对局、混合对局、规则例外、难度设置、UI 标识） | ✅ | 🟡 中 |

**最终规模**：~5,400 行源码 + ~2,800 行测试（12 源码文件 + 12 测试文件）
**前置条件**：11.5（存档/读档）✅ 和 11.4（边界测试）🔶

**Phase A 实现**（+77 新测试，1581→1658）：

- `ai/behavior-cards.js` NEW（~600 行）：48 张行为卡完整数据（6 势力 × 5 唯一卡 + 3 Continue 卡），含谈判参数、目标优先级列表、颜色编码 Bot-Bot 交易映射。牌组管理：`initBotDeck`（Protestant 特殊 Goodwill）、`revealBehaviorCard`（Continue 逻辑 + 牌组耗尽重洗）、`resetDeckForSchmalkaldic`、`resetDeckForRulerDeath`
- `ai/bot-controller.js` NEW（~300 行）：`BotController` 骨架——`decideBotAction` 按阶段路由到 `decideLuther95`/`decideDiplomacy`/`decideDietOfWorms`/`decideSpringDeployment`/`decideAction`，Action 阶段内含 `decideResponse`/`decideBattle`/`decideCardPlay`/`decideGoalAction` 占位。`scheduleBotAction` 延迟调度器 + `getNextActingBotPower` 识别下一个 Bot 玩家
- `config.json`：`supportsAI: true`
- `index.js`：`initialize()` 增加 Bot 初始化——调用 `initBotDecks`/`placeBotExtraUnits`/注册 `bot_<power>` 玩家 ID
- `main.js`：`_scheduleHisBotAction` 方法 + `stateUpdated` 后自动调度下一个 Bot 行动

**Phase B 实现**（+84 新测试，1658→1742）：

- `ai/bot-phases.js` NEW（~520 行）：阶段特定 Bot 决策——`stackBotHand`（Home 卡置底 + 教廷特殊叠放：Leipzig 最底 + Papal Bull 其上）、`shouldSueForPeace`（首都失陷/钥匙失衡检查 + War 字段豁免）、`shouldRansomLeader`（统治者被俘/地图无领袖→最高指挥值优先）、`shouldGrantCardToRescind`（绝罚自动给牌）、`decideWarDeclaration`（6 势力 War Limitation 规则 + 附庸国→宗主国转换 + 英格兰 Home 卡例外）、`getWarDeclarationCost`（手牌 CP 总量检查）、`pickDietOfWormsCard`（翻顶牌 + 强制/1CP→Home 卡回退）、`decideSpringDeployment`（战时→首都编队部署至最近敌方钥匙 ≤4 格 / 和平→单单位补防弱钥匙）、`decideWinterActions`（港口优先级排序 + 最近首都动乱移除）、`pickExplorationChoice`（探索加值 ≤+1 / ≥+2 两套优先级）、`getGarrisonRequirement`（首都 2/钥匙 1/+1 近敌修正）
- `ai/bot-negotiation.js` NEW（~300 行）：`evaluateDeal`（报价/要求值比较 + Bad Faith 罚分 + 最大数限制 + War 字段冲突 + Goodwill 资格判定）、`resolveBotToBotDeal`（颜色编码互认匹配 + 佣兵×2 规则）、`resolveAllBotDeals`（全 Bot 对组合）、`getBadFaithCount`/`canUseGoodwill`/`getGoodwillRemaining`/`isTreatyBlocked`（教廷/哈布斯堡永不与新教交换条约令牌）
- `ai/bot-controller.js` UPDATED：`decideDiplomacy` 按 `diplomacySegment` 路由到 sue_for_peace/ransom/excommunication/declarations_of_war 各段逻辑；`decideDietOfWorms` 调用 `pickDietOfWormsCard`；`decideSpringDeployment` 调用 `decideSpringDeploy` + `springDeploymentDone` 幂等检查

**Phase C 实现**（+90 新测试，1742→1832）：

- `ai/bot-event-criteria.js` NEW（~450 行）：§5 事件卡判定表——`EVENT_CRITERIA`（~60 条目按卡牌编号索引）和 `RESPONSE_CRITERIA`（~11 条目），每条含 `shouldPlay(state, power)` 函数和可选 `satisfiesTreaty(state, power, tokenPower)` 函数。覆盖 A Mighty Fortress/Copernicus（always-play）、Spanish Inquisition/Papal Inquisition（势力限定）、Fuggers/Foreign Recruits（交战条件）、Erasmus（回合条件）、Indulgence Vendor（St. Peter's 检查）、Machiavelli/Diplomatic Overture（never-play）等全部 §5 规则
- `ai/bot-card-play.js` NEW（~550 行）：卡牌出牌路由主模块——`classifyCard`（home/mandatory/combat/response/event 分类）、`evaluateHomeCard`（§6 七势力 Home 卡判定：Ottoman 伊斯坦布尔常备军/Hapsburg 查理五世移动/England 宣战或婚姻/France 城堡骰/Papacy 绝罚或 Leipzig Debate/Protestant 路德替换）、`checkTreatyObligation`（§2.10.1 条约令牌义务）、`getGangingUpTargets`/`shouldPlayEventGangingUp`（§2.10.2 合力打击高 VP 势力）、`shouldSaveCards`（§4.25 节牌判定——统治者 Admin Rating 阈值 + ≥25VP 禁止节牌）、`getFinalAutumnAssaults`（§2.10.3 秋季免费攻城/外国战争）、`decideCardPlay`（5 级路由：空手→Home→Mandatory→Combat/Response→Event）、`decideResponsePlay`（响应窗口决策）
- `ai/bot-controller.js` UPDATED：`decideResponse` 改用 `decideResponsePlay`（不再一律 DECLINE）；`decideCardPlay` 改用 `routeCardPlay`（不再一律 CP）

**Phase D 实现**（+70 新测试，1832→1902）：

- `ai/bot-goals.js` NEW（~800 行）：§3 目标执行器——21 个 CP 花费目标 + 目标分发器。D1 军事基础（`executeGarrison` 驻军补充含 §4.10 驻军需求计算 + 回退到佣兵/骑兵、`executeTroops`/`executeMercenaries`/`executeCavalry` §4.17 放置优先级）；D2 军事移动（`executeAdvance` BFS 近敌搜索 + 编队移动、`executeLandBattle` 解围优先 + 非堡垒空间攻击 + 2倍兵力限制、`executeSiege` 三级子优先：外国战争→突击→发起围城 + 钥匙优先）；D3 海军（`executeSetSail` 海域优先级、`executeNavalBattle` 优势检查、`executeShipbuilding` Ottoman 海盗船特殊逻辑 + Barbary Pirates 卡判定、`executePiracy` 骰数比较）；D4 控制（`executeControl` 驱乱优先→政治控制 + Protestant 新教影响区特殊）；D5 宗教（`executeTranslate` §3.16 语言选择 + Calvin/Cranmer 前置检查、`executePublish` §4.20 宗教改革目标选择、`executeDebate` Papacy 最多新教区/Protestant 最高辩值、`executeStPeters`/`executeBurn` Cajetan→Tetzel→Caraffa 承诺优先、`executeJesuits` §4.19 放置 + Society of Jesus 前置）；D6 新世界（`executeExplore`/`executeColonize`/`executeConquer` 探索者/殖民/征服者可用检查）；D7 目标分发器 `dispatchGoalAction`（遍历行为卡优先级列表 + max 执行次数限制 + §3 CP 溢出→+1 CP 令牌）
- `ai/bot-controller.js` UPDATED：`decideGoalAction` 改用 `dispatchGoalAction`（不再一律 END_IMPULSE）

**Phase E 实现**（+85 新测试，1902→1987）：

- `ai/bot-helpers.js` NEW（~950 行）：E1 空间计算——`weightedDistance`（§4.3 加权 BFS：pass=2、单海域穿越、三级路径偏好排序）、`findClosestSpace`（谓词匹配最近空间）、`simpleBfsDistance`（无权 BFS）、`hasSupplyLine`（补给线检查）。E2 单位放置/移除——`chooseLandUnitPlacementEnhanced`（§4.17 增强版：驻军缺口按近敌排序 + 领袖近敌搜索 + Protestant 无首都处理）、`chooseNavalPlacementEnhanced`（§4.18：近敌海军→近敌陆军→近首都 + 2 艘分散规则）、`chooseUnitToRemove`（§4.21：安全余量→最远→佣兵/骑兵优先）、`chooseNavalUnitToRemove`（§4.22：战时最远敌海军/和时最远首都）、`chooseDisplacementDestination`（§4.5：钥匙/选侯优先→近首都堡垒）。E4 编队扩充——`growFormationAlongPath`（§4.11 沿路径收编单位/领袖 + 指挥上限）、`applyMercenaryRatio`（§4.15 佣兵比例维持）。辅助——`getCapitals`（§4.12 双首都）、`hasNearbyIndependentThreat`（§4.13 独立空间视为敌方）
- `ai/bot-combat.js` NEW（~365 行）：E3 战斗决策——`shouldAvoidLandBattle`（§4.1 ≤半兵力 + 单编队检查）、`shouldAvoidNavalBattle`（§4.1 海军版）、`shouldWithdrawIntoFortification`（§4.2 ≤4 单位入堡）、`chooseSiegeLeader`（§4.2 战斗值≥1 领袖留守）、`shouldIntercept`（§4.14 仅从非堡垒→受围堡垒拦截）、`findRetreatDestination`（§4.23 最近友方堡垒）、`findNavalRetreatDestination`（§4.23 近首都港口 + 海盗船→Algiers 特殊）、`decideBattleAction`（整合避战/入堡/撤退/自动解决）、`decideInterceptionAction`
- `ai/bot-controller.js` UPDATED：`decideBattle` 改用 `decideBattleAction`（不再 stub）；`decideInterception` 改用 `decideInterceptionAction`（不再一律 decline）

**Phase F 实现**（+86 新测试，1987→2073；全套 2884）：

- `ai/bot-rules.js` NEW（~330 行）：§8 Bot 规则例外——F3.1 事件持续延长（`EXTENDED_EVENT_CARDS` 4 张卡 + `registerExtendedEvent`/`expireExtendedEvents`/`isExtendedEventActive`）；F3.2 冬季免费驱乱（`makeFreeUnrestRemovalAction`）；F3.3 谈判/求和获堡垒时自动驻军（`makeFortressGarrisonAction`）；F3.4 绝罚辩士延长返回（`registerExcommunicatedDebater`/`processExcommunicatedDebaterReturns`，returnTurn = currentTurn+2）；F3.5 Threat to Power 延长移除（`calcThreatToReturnTurn`/`registerThreatToLeader`/`processThreatLeaderReturns`）；F3.6 Phony War 豁免（`isExemptFromPhonyWar`）；F4 秋季免费突击（`getNextAutumnAssault`/`markAutumnAssaultDone`/`resetAutumnAssaults` 追踪机制）；F5 难度设置（`BOT_DIFFICULTY` normal/hard/expert + `getExtraCardCount` Turn 4+/Turn 1+ 额外抽牌 + `initBotDifficulty`）；`processBotTurnStart` 回合开始统一处理（过期事件/返回辩士/返回领袖/重置 CP 令牌/重置突击追踪）
- `ai/bot-ui.js` NEW（~270 行）：F6 UI 辅助——`createBotBadge`（难度颜色标识）、`createThinkingIndicator`/`showThinkingIndicator`/`hideThinkingIndicator`（"思考中..." 动画含 CSS keyframe 注入）、`formatBotAction`（Bot 行动日志格式化：事件/移动/突击/宣战等中文标签 + 条约/围攻标记）、`getActiveBotInfo`/`getPowerDisplayList`（UI 状态查询）
- `ai/bot-controller.js` UPDATED：新增 `initBotGame` 统一初始化（decks + units + difficulty）；`decideWinter` 冬季免费驱乱决策；`decideAction` 在手牌耗尽时检查秋季免费突击再 PASS；导入 `bot-rules.js` 的突击追踪和难度初始化
- `ui/status-bar.js` UPDATED：Bot 势力显示 `[BOT]` 前缀 + "思考中..." 标签；VP 显示 Bot 标记（`*`后缀 + tooltip）

**11.1 验证结果**：config/export/getVisibleState/processMove 格式/网络收发路径/状态大小均正确。修复了 UI-only action（SELECT_CARD、SELECT_SPACE）泄漏到引擎的问题，以及 action 格式 `{type,data}` → `{actionType,actionData}` 的统一。

**11.4 边界用例测试进展**（+664 新测试，870→1549→2317→2403）：

第一批（870→997）：

- `index.test.js` +7：阶段门控、undefined actionType 拒绝、consecutivePasses 重置链、VP 平局
- `phase-luther95.test.js` +23：早期终止、选侯国正规军、空目标完成判定
- `phase-diet-of-worms.test.js` +3：修复 MANDATORY 事件卡 flaky test
- `phase-spring-deployment.test.js` +12：首都无部队跳过、最大部署限制
- `interception.test.js` +2、`retreat.test.js` 修复稳定性
- `index.js` validateMove：新增 `!actionType` 防御

第二批（997→1141）：

- `victory-checks.test.js` +30：6 势力自动胜利阈值 ±1 边界、选侯国计数、新教 49/50/51 空间
- `state-visible.test.js` +20：空手牌、旁观者 ID、深拷贝验证、空牌堆
- `phase-diplomacy.test.js` +17：段序验证、完成后重入、幂等标记、重置
- `conclave-actions.test.js` +17：邻接加值、平票、无效教宗 ID、继承链
- `combat-actions.test.js` +12：海军领袖排除、伤亡级联、最少 1 骰
- `siege-actions.test.js` +14：半骰进位、围城平局、LOC 循环路径
- `retreat.test.js` +13：堡垒容量、盟友非堡垒、全领袖撤退、空撤退列表
- `loan-actions.test.js` +6：零中队、精确边界、多借调追踪
- `interception.test.js` +6：奥斯曼骑兵加值、纯海军排除、山口排除、去重
- `phase-new-world.test.js` +6：空探险家池、发现回退链、非哈布斯堡征服

第三批（1330→1451）：

- `index.test.js` +15：W7 多响应者流程、Wartburg 取消事件、#31/#32/#38 中断效果、CP 模式取消
- `response-actions.test.js` +20：W5/W6 投骰后窗口设置/过滤、W7 中断资格/推进/跳过
- `phase-winter.test.js` +16：损耗顺序（佣兵→正规→骑兵）、借调归还、强制事件、围城处理、状态重置

第四批（1482→1549）：

- `event-actions-diplomacy.test.js` +33：#201 重复单位、#202 幂等战争/领袖、#203 全命中/全未命中、#204 激活/停用附庸国、#205 外交压力状态、#206 henry_ii 变体/战争幂等/抽牌、#207 空部署/无效空间、#208 圣彼得贡献、#209 瘟疫移除上限/船队/后备兵、#210 造船上限、#211 SL 后无战争/领袖、#212 威尼斯三模式、#214 查理五世/抽牌、#215 马基雅维利、#218 维也纳围城移除/限制、#219 西班牙宗教裁判所双路径
- `excommunication-actions.test.js` +13：多重罪名叠加、5 教宗领空间逐一验证、罪名去重、缺失参数校验、敌军占领跳过动乱、已有动乱跳过、非天主教跳过、非目标势力跳过、不可开除势力、未放置改革家开除
- `reformer-helpers.test.js` +8：动乱空间排除邻接加骰、多邻接改革家叠加、动乱+同格组合、覆写目标格改革家、不存在空间返回 null、去重、幂等移除、放置后移除清理
- `phase-diet-of-worms.test.js` +7：非阶段校验、Home 卡标记、完成标志、重新计数、骰子日志、天主教胜利翻转区域、无待定时 needsDietCard
- `phase-new-world.test.js` +8：多殖民地放置、征服者全灭跳过、征服优先级顺序、全征服已占领、深渗透 Pacific+Amazon 已占后回退 1VP、全发现已占领、已有环航仍获太平洋 VP
- `military-actions.test.js` +28：山口移动、领袖/骑兵随队、阻挡验证、征募/佣兵/舰队边界、骑兵资格
- `naval-actions.test.js` +17：海战触发/骰数/领袖加值/平局/伤亡、海盗 VP 上限、舰队消灭
- `state-helpers.test.js` +16：空间单位查询、岛屿/山口邻接、路径搜索阻挡、势力映射、改革空间计数

第五批 Bot AI（2073→2198）：

- `bot-goals.test.js` +33：驻军边界（未知空间/选侯/近敌）、单位放置（无空间/Protestant 回退）、围城子优先级、造船/海盗、控制/宗教/新世界边界、dispatchGoalAction（cp=0/无牌组/已满）
- `behavior-cards.test.js` +19：重洗生命周期（抽尽/Continue 逻辑/无牌损失）、getActiveBehaviorCard 边界、initBotDeck（Protestant Goodwill）、数据完整性
- `bot-card-play.test.js` +25：classifyCard 边界、Home 卡六势力判定条件、Leipzig Debate 辩士阈值、条约义务、合力打击 VP 阈值、节牌判定、出牌路由
- `bot-helpers.test.js` +22：weightedDistance（同格/连接/不可达）、BFS、findClosestSpace（4 参数签名）、单位移除/放置、编队扩充/佣兵比例
- `bot-combat.test.js` +25：避战（堡垒/兵力比）、入堡（单位阈值）、拦截（非堡垒/受围目标）、撤退（友方堡垒/海盗→Algiers）、战斗决策整合

第六批 核心规则模块（2198→2317）：

- `religious-actions.test.js` +25：反改革 Augsburg 修正/教宗限定、骰子修正器 Full Bible、验证边界（缺参/未知空间/已天主教）、翻译边界（无效区域/NT 无 VP/Full Bible 修正器/中途无 pending）、St. Peters 多次构建/上限、耶稣会（缺参/未知空间/多建/CP 不足）、出版/焚书边界
- `debate-actions.test.js` +20：非宗教势力辩论、无辩士辩论、无效 debate phase、R2 平局 no_result、R2 defender 骰减少、1 命中差→1 空间翻转、defender 赢→反改革 pending、翻转验证边界（剩余/缺参/未知/非 debate 来源）、Council 验证（非数组/null/无效阶段/不可用辩士/超额）、Council zone=null
- `diplomacy-actions.test.js` +22：自我宣战、本回合结盟后宣战、England→Venice/Ottoman→Scotland/非 Ottoman→Hungary 限制、France→Scotland 限制、Venice 限制（Papacy 同盟/求和后）、自方附庸宣战、最终回合求和、Protestant-Hapsburg/Papacy 和约限制、leader 被俘求和、Ottoman/非 Ottoman VP 差异、未知谈判类型、Papacy-Ottoman 同盟、空手赎回、仅 Home 卡赠送、零数量赠送
- `phase-manager.test.js` +18：T9 同 T2 阶段序、阶段顺序验证、Turn1 特殊阶段转换、未知阶段→null、已结束不操作、T8→T9 过渡、action 初始化、双周期脉冲归位、海军领袖已在地图不重复/无港口延迟/零数量跳过/未来不提前释放
- `phase-card-draw.test.js` +8：空牌堆仅 Home 卡、牌堆耗尽分配、大弃牌堆合并、外交/特殊牌排除、removedCards 不重新加入、手牌中不重复、homeCardPlayed 重置
- `war-helpers.test.js` +12：自我交战检测、多重战争独立、添加不影响现有、多重战争移除、反向移除同盟、空字符串/undefined 非附属国、附属国→附属国无主国、非活跃附属国不可攻击、自我攻击检测、同主国附属国不互攻、不存在空间/附属国传递性/中立非敌

第七批 事件处理器边界（2317→2367）：

- `event-actions.test.js` +26：#18 Dragut 海区/未找到、#26 佣兵贿赂 Ottoman 限制/ceil 数学/目标跳过/新编队、#33 Landsknechts Ottoman 移除/上限差异、#36 Swiss→Ottoman→France、#30 Tercios 反 Hapsburg、#38 Halley 跳过/空手、#42 Roxelana 非 Ottoman 归还/Ottoman 突击、#47 Copernicus 半数边界、#15 耶稣会 Protestant 空间、#37 Wartburg Luther 提交、#5 Papal Bull 去重、#39 Augsburg/#41 Marburg/#52 Michelangelo
- `event-actions-extended.test.js` +25：#57 Philip 弃牌分支、#64 Pilgrimage 占领/动乱、#67 Anabaptists 选侯/占领、#69 Auld Alliance 停用/增援、#78 Frederick 37 未在弃牌堆、#80 Gabelle 非法国、#87 佣兵讨薪/弃牌保留、#100 造船 corsairs、#104 Trace Italienne 独立/动乱、#107 Unsanitary 骑兵溢出/零、#108 Venetian 停用/增援、#60 Maurice 未找到、#116 Rough Wooing 失败、#75 Erasmus T2/T3 边界、#115 Thomas Cromwell 取回/不在弃牌堆

第八批 Bot 模块边界（2367→2403）：

- `bot-controller.test.js` +7：未知阶段 null、空目标 PHASE_ADVANCE、非 Protestant luther_95、人类响应方 null、已移除动乱、victory_determination null、外交已行动
- `bot-phases.test.js` +8：春季部署无余/丢失首都、探索 bonus=2/1 边界、驻军近敌+1、无控制空间 0、stackBotHand 无 Home 卡
- `bot-negotiation.test.js` +8：Protestant-Papacy 反向阻止、交战阻止、无行为卡、Bad Faith 阻止、War 字段阻止 ALLIANCE、超过上限、非 bot bot-to-bot、无颜色编码
- `bot-event-criteria.test.js` +6：不存在卡牌 false、不匹配势力 false、satisfiesTreaty null 条约、不存在卡牌、shouldPlayResponse 不存在/事件卡
- `bot-rules.test.js` +6：expireExtendedEvents 边界(==)、无事件空、processBotTurnStart 全数组、重置 CP tokens、重置秋季突击、getNextAutumnAssault null

**11.5 存档/读档实现**（+32 新测试，1549→1581）：

- `utils/storage.js` +9 函数：`saveGameSlot`/`loadGameSlot`/`listGameSlots`/`deleteGameSlot`（localStorage 5 槽位）+ `exportSaveFile`/`importSaveFile`（JSON 文件导出导入）+ `autoSaveGame`/`loadAutoSave`/`clearAutoSave`（sessionStorage 自动存档）
- `game/engine.js` +`exportSave()`/`importSave()`/`_getSaveMetadata()`/`_autoLabel()` + `executeMove` 自动存档钩子
- `games/his/index.js` +`_getSaveMetadata()`/`_autoLabel()` 覆写（中文阶段名）
- `games/his/state/save-load.js` NEW：`validateSaveData()` 验证存档完整性 + `generateSlotKey()` + 常量
- `games/his/ui.js` +存档/读档/导出/导入按钮（仅离线模式）+ 最小事件系统 `on`/`_emit`
- `main.js` +`_saveGame`/`_showLoadDialog`/`_loadSave`/`_exportGame`/`_importGame` 事件处理

**11.7 响应卡系统设计**：

> 现状：战斗结算是同步单函数（`resolveFieldBattle`），无法暂停等待玩家输入。
> 方案：拆解为 `pendingResponse` 多步状态机，每个响应窗口暂停等待玩家打出响应卡或拒绝。

7 个响应窗口：

| 窗口 | 时机 | 谁可打出 | 卡牌 |
|------|------|----------|------|
| W1 | 进入敌方空间后、骰子计算前 | 任何玩家 | #33 雇佣兵、#36 瑞士佣兵 |
| W2 | 投骰前（野战/突击/海战） | 攻方 | #24-30 战斗卡 |
| W3 | 攻方战斗卡决定后 | 守方 | #24-30 战斗卡 |
| W4 | 双方投骰后、宣布胜者前 | 仅奥斯曼 | #1 禁卫军（战斗模式） |
| W5 | 突击投骰后 | 任何玩家 | #35 攻城炮 |
| W6 | 海战投骰后 | 任何玩家 | #34 划桨手 |
| W7 | 任何玩家脉冲中 | 其他玩家 | #31 恶劣天气、#32 痛风、#37 瓦尔特堡、#38 哈雷彗星 |

实现步骤：

| 步骤 | 内容 | 涉及文件 | 状态 |
|------|------|----------|------|
| S1 | 基础设施：action types + state + response-actions.js | action-types, state-init, cp-manager, response-actions(新) | ✅ |
| S2 | 战斗卡窗口 W2/W3 + combat 拆解 | combat-actions, index.js | ✅ |
| S3 | 佣兵窗口 W1 | response-actions, combat-actions | ✅ |
| S4 | 投骰后窗口 W4/W5/W6 | response-actions, combat-actions, index.js | ✅ |
| S5 | 脉冲中断 W7 (#31/#32/#37/#38) | response-actions, index.js | ✅ |
| S6 | UI 集成：action-panel + hand-panel 响应模式 | action-panel, hand-panel, ui.js | ✅ |

关键设计：
- `state.pendingResponse = { window, context, respondingPowers, currentResponderIndex, validCards, responses, battleState }`
- 新 action types: `PLAY_RESPONSE_CARD`, `DECLINE_RESPONSE`
- `index.js` validateMove 放开非活跃玩家在响应窗口的 action 验证
- 无玩家持有合法卡时自动跳过窗口（`canAnyPowerRespond` 前置检查）

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
| Phase 6 事件卡 | ~3,000 | ~3,300 (135/135) | ✅ |
| Phase 7 特殊机制 | ~2,500 | ~1,500 | ✅ |
| Phase 8 剩余事件 | — | （合并至 P6） | ✅ |
| Phase 9 SVG+UI | ~4,000 | ~3,300 | ✅ |
| Phase 10 卡牌事件 UI | ~3,000 | ~1,100 | ✅ |
| Phase 11 多人联机 | ~1,000 | ~800 | ⬅️ |
| Phase 12 AI (HISBOT) | ~6,300 | ~5,400 | ✅ |
| **源码合计** | ~27,500 | **~34,300** | |
| **测试合计** | ~8,000-12,000 | **~28,000** | 2,317 tests |

**依赖关系图**：
```
P0 → P1 → P2 → P3 → P5 → P6 → P7 → P8（已完成）
                ↘ P4 ↗                    ↓
                                    P9（SVG+UI）✅
                                         ↓
                                    P10（卡牌事件 UI）✅
                                         ↓
                                    P11（多人联机）⬅️ 当前
                                         ↓
                                    P12（AI / HISBOT）✅
```

---

## 测试覆盖

| 测试文件 | 测试数 | 覆盖模块 |
|----------|--------|----------|
| state-init.test.js | 35 | 初始化、数据完整性 |
| state-helpers.test.js | 76 | 查询工具、路径搜索、辩士、邻接、改革计数 |
| state-visible.test.js | 28 | 信息隐藏、深拷贝、旁观者 |
| war-helpers.test.js | 45 | 战争/同盟状态 |
| victory-checks.test.js | 41 | 胜利条件、阈值边界 |
| reformer-helpers.test.js | 23 | 宗教改革者追踪 |
| multi-power.test.js | 31 | 多势力变体（2-5 人） |
| cp-manager.test.js | 22 | CP 花费 |
| military-actions.test.js | 75 | 移动、征募、建造、山口、骑兵资格 |
| naval-actions.test.js | 69 | 海军、海盗、海战骰数/伤亡、舰队消灭 |
| combat-actions.test.js | 54 | 野战、领袖类型、伤亡级联、W1-W4 窗口 |
| siege-actions.test.js | 35 | 围城、半骰进位、LOC、W5 |
| interception.test.js | 17 | 拦截、骑兵修正、山口排除 |
| retreat.test.js | 25 | 撤退、堡垒容量、领袖移动 |
| religious-actions.test.js | 69 | 改革、出版、翻译、焚书 |
| debate-actions.test.js | 69 | 辩论 + 特伦托会议 |
| diplomacy-actions.test.js | 71 | 外交 |
| excommunication-actions.test.js | 36 | 绝罚 |
| event-actions.test.js | 105 | 事件卡 #1-54 |
| event-actions-extended.test.js | 145 | 事件卡 #55-116 |
| event-actions-diplomacy.test.js | 65 | 外交牌 #201-219 |
| event-display.test.js | 28 | 事件展示 UI |
| new-world-actions.test.js | 28 | 新世界 |
| loan-actions.test.js | 16 | 中队借调、零边界、多借调 |
| conclave-actions.test.js | 30 | 教宗选举、平票、继承链 |
| response-actions.test.js | 159 | 响应卡系统（W1-W7） |
| phase-manager.test.js | 44 | 阶段状态机 |
| phase-card-draw.test.js | 22 | 抽牌 |
| phase-diplomacy.test.js | 30 | 外交阶段、段序、幂等 |
| phase-spring-deployment.test.js | 26 | 春季部署 |
| phase-diet-of-worms.test.js | 24 | 沃尔姆斯议会 |
| phase-luther95.test.js | 29 | 95 条论纲 |
| phase-new-world.test.js | 21 | 新世界阶段、发现回退 |
| phase-winter.test.js | 37 | 冬季阶段、损耗、借调归还、围城 |
| index.test.js | 75 | 集成测试、响应卡流程、W7 中断 |
| save-load.test.js | 32 | 存档/读档验证、引擎集成 |
| behavior-cards.test.js | 66 | 行为卡数据完整性、牌组管理、生命周期边界 |
| bot-controller.test.js | 37 | Bot 识别、初始化、决策路由、HISGame 集成 |
| bot-phases.test.js | 62 | Bot 阶段逻辑（抓牌、外交、部署、冬季） |
| bot-negotiation.test.js | 38 | Bot 谈判（报价评估、Bot-Bot 交易） |
| bot-event-criteria.test.js | 51 | Bot 事件卡判定表 |
| bot-card-play.test.js | 70 | Bot 出牌路由、Home 卡评估、条约、存牌边界 |
| bot-goals.test.js | 103 | Bot 目标执行器、驻军/围城/宗教/新世界边界 |
| bot-helpers.test.js | 70 | Bot 空间计算、BFS、单位放置/移除、补给线 |
| bot-combat.test.js | 62 | Bot 战斗决策、避战/拦截/撤退、海战边界 |
| bot-rules.test.js | 50 | Bot 规则例外、难度、秋季突击 |
| bot-ui.test.js | 15 | Bot UI 格式化、状态查询 |
| bot-integration.test.js | 27 | Bot 全流程集成测试 |
| **合计** | **2,403** | |

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
| `data/setup-1517.js` | `docs/games/his/SCENARIO_1517_SETUP.md` |
| `constants.js` | `docs/games/his/RULES.md` + `docs/games/his/POWER_CARDS.md` |

---

## 关键参考文件

| 文件 | 用途 |
|------|------|
| `frontend/src/game/engine.js` | 基类接口：initialize, processMove, checkGameEnd |
| `frontend/src/games/werewolf/index.js` | 复杂游戏实现参考（阶段管理、信息隐藏） |
| `frontend/src/games/werewolf/game-phases.js` | 阶段拆分 + helpers 注入模式 |
| `docs/games/TEMPLATE.md` | RULES.md 文档模板 |
