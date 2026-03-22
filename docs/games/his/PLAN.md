# Here I Stand (教改风云) - 开发总体计划

## Context

Here I Stand (HIS) 是一款经典的卡牌驱动六方兵棋桌游，覆盖 16 世纪欧洲宗教改革时代（1517-1555）。目标是在现有桌游平台上实现完整的线上多人版本。

**决策**：1517 全剧本优先 | SVG 交互地图 | 暂不支持 AI | 核心机制优先，渐进扩展

---

## 当前进度

| 指标 | 数值 |
|------|------|
| 源码文件 | 58 个 JS 文件 |
| 测试文件 | 34 个 test.js 文件 |
| 源码行数 | ~26,100 行 |
| 测试行数 | ~18,200 行 |
| 单元测试 | **1,451 个**，全部通过 |
| 事件处理器 | **135/135 张卡牌已实现** |

**已完成 Phase**：0 ✅ → 1 ✅ → 2 ✅ → 3 ✅ → 4 ✅ → 5 ✅ → 6 ✅ → 7 ✅ → 8 ✅ → 9 ✅ → 10 ✅(核心)

**当前**：Phase 11（多人联机与打磨）— 11.1 ✅，11.4 🔶，11.7 ✅ 完成（响应卡系统 W1-W7 + UI）

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
| 10.9 | CSS 主题对齐（统一色调） | `theme/his.css` | ❌ | 🟢 低 |
| 10.10 | 玩家规则书 | `public/rules/his.html` | ❌ | 🟢 低 |

---

### Phase 11: 多人联机与打磨 ⬅️ 进行中

> **中优先级**：网络同步、场景变体、存档等完整游戏体验。

| # | 任务 | 状态 | 优先级 |
|---|------|------|--------|
| 11.1 | 多人网络同步验证 | ✅ | 🔴 高 |
| 11.2 | 2-5 人变体（一人控制多势力） | ❌ | 🟡 中 |
| 11.3 | 锦标赛场景（1532） | ❌ | 🟡 中 |
| 11.4 | 边界用例全面测试 | 🔶 进行中 | 🟡 中 |
| 11.5 | 存档/读档 | ❌ | 🟡 中 |
| 11.6 | 大状态深拷贝性能优化 | ❌ | 🟢 低 |
| 11.7 | 响应卡系统（引擎 W1-W7 + UI） | ✅ | 🟡 中 |
| 11.8 | 回放系统（查看历史行动） | ❌ | 🟢 低 |

**11.1 验证结果**：config/export/getVisibleState/processMove 格式/网络收发路径/状态大小均正确。修复了 UI-only action（SELECT_CARD、SELECT_SPACE）泄漏到引擎的问题，以及 action 格式 `{type,data}` → `{actionType,actionData}` 的统一。

**11.4 边界用例测试进展**（+392 新测试，870→1451）：

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
- `military-actions.test.js` +28：山口移动、领袖/骑兵随队、阻挡验证、征募/佣兵/舰队边界、骑兵资格
- `naval-actions.test.js` +17：海战触发/骰数/领袖加值/平局/伤亡、海盗 VP 上限、舰队消灭
- `state-helpers.test.js` +16：空间单位查询、岛屿/山口邻接、路径搜索阻挡、势力映射、改革空间计数

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
| Phase 11 多人联机 | ~1,000 | — | ⬅️ |
| **源码合计** | ~27,500 | **~25,300** | |
| **测试合计** | ~8,000-12,000 | **~18,200** | 1,451 tests |

**依赖关系图**：
```
P0 → P1 → P2 → P3 → P5 → P6 → P7 → P8（已完成）
                ↘ P4 ↗                    ↓
                                    P9（SVG+UI）✅
                                         ↓
                                    P10（卡牌事件 UI）✅
                                         ↓
                                    P11（多人联机）⬅️ 当前
```

---

## 测试覆盖

| 测试文件 | 测试数 | 覆盖模块 |
|----------|--------|----------|
| state-init.test.js | 35 | 初始化、数据完整性 |
| state-helpers.test.js | 76 | 查询工具、路径搜索、辩士、邻接、改革计数 |
| state-visible.test.js | 29 | 信息隐藏、深拷贝、旁观者 |
| war-helpers.test.js | 33 | 战争/同盟状态 |
| victory-checks.test.js | 41 | 胜利条件、阈值边界 |
| reformer-helpers.test.js | 15 | 宗教改革者追踪 |
| cp-manager.test.js | 22 | CP 花费 |
| military-actions.test.js | 75 | 移动、征募、建造、山口、骑兵资格 |
| naval-actions.test.js | 69 | 海军、海盗、海战骰数/伤亡、舰队消灭 |
| combat-actions.test.js | 54 | 野战、领袖类型、伤亡级联、W1-W4 窗口 |
| siege-actions.test.js | 35 | 围城、半骰进位、LOC、W5 |
| interception.test.js | 17 | 拦截、骑兵修正、山口排除 |
| retreat.test.js | 25 | 撤退、堡垒容量、领袖移动 |
| religious-actions.test.js | 44 | 改革、出版、翻译、焚书 |
| debate-actions.test.js | 49 | 辩论 + 特伦托会议 |
| diplomacy-actions.test.js | 49 | 外交 |
| excommunication-actions.test.js | 24 | 绝罚 |
| event-actions.test.js | 79 | 事件卡 #1-54 |
| event-actions-extended.test.js | 120 | 事件卡 #55-116 |
| event-actions-diplomacy.test.js | 32 | 外交牌 #201-219 |
| event-display.test.js | 28 | 事件展示 UI |
| new-world-actions.test.js | 28 | 新世界 |
| loan-actions.test.js | 16 | 中队借调、零边界、多借调 |
| conclave-actions.test.js | 30 | 教宗选举、平票、继承链 |
| phase-manager.test.js | 26 | 阶段状态机 |
| phase-card-draw.test.js | 14 | 抽牌 |
| phase-diplomacy.test.js | 30 | 外交阶段、段序、幂等 |
| phase-spring-deployment.test.js | 26 | 春季部署 |
| phase-diet-of-worms.test.js | 17 | 沃尔姆斯议会 |
| phase-luther95.test.js | 29 | 95 条论纲 |
| phase-new-world.test.js | 14 | 新世界阶段、发现回退 |
| phase-winter.test.js | 37 | 冬季阶段、损耗、借调归还、围城 |
| index.test.js | 75 | 集成测试、响应卡流程、W7 中断 |
| response-actions.test.js | 159 | 响应卡系统（W1-W7） |
| **合计** | **1,451** | |

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
