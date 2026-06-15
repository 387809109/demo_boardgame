# HIS Playwright UI 交互测试 — 2026-06-15

> 形式: 按 [TEST_REQUIREMENTS_PLAYWRIGHT.md](../test/TEST_REQUIREMENTS_PLAYWRIGHT.md)，Claude 扮演**新教**，
> 通过 Playwright 真实 UI 点击执行；其余 5 势力内部 HISBOT 自动运行。
> 开局: `window.app._startHisGame('protestant')`，统治胜利=默认(启用)。

## 缺陷清单

### UI-1（外观）回合横幅显示 `turnNumber`（脉冲计数器）而非 `turn`（真实回合）

- **现象**: 顶部横幅「回合 N」在 T1 内一路涨到 11，与状态栏正确的「T1」不符。
- **根因**: [game-board.js:106](../../../../frontend/src/layout/game-board.js#L106) 与 [:544](../../../../frontend/src/layout/game-board.js#L544) 显示 `state.turnNumber`。HIS 中 `turnNumber` 是**每动作自增的脉冲计数器**（用于围城时序 `siegeEstablishedImpulse === state.turnNumber`，见 index.js:627/645/658/667/764），真实回合是 `state.turn`。UNO/狼人杀的 `turnNumber` 才是回合数。
- **修复方向**: game-board.js 优先用 `state.turn`，未定义时回退 `turnNumber`：`回合 ${state.turn ?? state.turnNumber ?? 1}`。UNO/狼人杀无 `state.turn` → 回退不变；HIS 有 → 取正确值。
- **状态**: ✅ 已修复（game-board.js 两处）。读档后横幅正确显示「回合 1」。

### UI-2（阻断）Diet of Worms 阶段手牌不可点击 → 无法提交卡牌

- **现象**: T1 沃尔姆斯帝国会议轮到新教提交卡牌，面板提示「请先从手牌中选择一张卡牌」，但手牌 `.his-card` 全部 `cursor:default`、无 click 监听 → 无法选牌 → 「提交卡牌」按钮永久 disabled。整个 Diet 阶段无法通过 UI 推进。
- **根因**: [ui.js:317-318](../../../../frontend/src/games/his/ui.js#L317) `canPlay` 仅在 `phase === 'action'`（或 response 窗口）为真；`diet_of_worms` 阶段未纳入 → 手牌渲染 `isClickable=false`（[hand-panel.js:107](../../../../frontend/src/games/his/ui/hand-panel.js#L107)）。但 action-panel 的 Diet 面板（[action-panel.js:377](../../../../frontend/src/games/his/ui/action-panel.js#L377)）依赖 `state._uiSelectedCard`（由手牌 SELECT_CARD 点击设置）。
- **修复方向**: ui.js `canPlay` 增加 diet 分支——本势力在 diet 阶段且尚未提交时允许点击手牌：
  `(state.phase === 'diet_of_worms' && state.pendingDietOfWorms && state.pendingDietOfWorms.cards[this._playerPower] == null)`。
- **注意**: ui.js 有**两处** `canPlay` 计算（renderActions:317 与 updateState:370），两处都要改。
- **状态**: ✅ 已修复（ui.js 两处）。读档后手牌 `cursor:pointer`，点击 #110→「已选择卡牌 #110」→提交成功，Diet 结算（新教额外 +1 改革，空间 6→7），进入 spring_deployment。

### UI-3（小缺口）存档无 UI 删除入口

- **现象**: 存/读档对话框仅支持「存档到槽位」与「读档」，无删除按钮（全代码库无 `删除/deleteSave/removeSave/🗑` 等）。测试结束按文档「通过 UI 删除存档」无法执行。
- **影响**: 小。功能缺口，非 bug。
- **处置**: 本次经存储层（localStorage `boardgame_save_his_slot_*`）清除 4 个测试槽位完成清理；建议后续在读档对话框每条目加删除按钮。
- **状态**: 记录待办（未修）。

## 进度

- T1 路德 95 论纲: 5 次改革全部成功（Brandenburg★ → Magdeburg → Leipzig → Nuremberg → Mainz★），新教空间 6（含 2 选帝侯），UI 地图点击（SVG polygon dispatch）路径正常。
- T1 抽牌: 自动完成，新教手牌 [110,90,82,83,7]。
- T1 外交: 5 bot 全 PASS；新教无军、未结盟、不可宣战 → PASS（忠于 HISBOT，非 force-pass）。
- T1 沃尔姆斯会议: 提交卡 #110（HISBOT 顶牌规则），结算新教额外 +1 改革（空间 6→7）。
- T1 春季部署: 5 bot done，新教无野战军 → 跳过部署。
- T1 行动阶段（新教全程 UI 操作）:
  - 脉冲1: #90 Printing Press 触发事件（printingPressActive，赠 3 次任意区域改革 → Cologne★/Trier★ 转新教，Cologne 第二次成功，6 选帝侯全部新教化）。
  - 脉冲2: #83 用作 CP(3) → 发表论文(德语,2 次: Worms/Erfurt 成功) + 翻译圣经(德语→1)。
  - 脉冲3: #82 用作 CP(2) → 发表论文(德语,2 次: 均失败-掷骰)。
  - 脉冲4: #7 Here I Stand 用作 CP(5) → 发表论文×2(德语,Regensburg/Kassel/Strasburg/Münster 成功) + 翻译圣经(德语→2)。
  - 新教手牌耗尽 → PASS；6 连 PASS 结束行动阶段。
- T1 winter/新世界/胜利判定/抽牌：引擎自动链式推进（新教无相关决策），均正常；victory_determination_pass（无人获胜），turn_advance → T2。
- **T1 结算**: 新教 15 空间（起始 6），全部 6 选帝侯新教化，德语圣经翻译=2，Printing Press 在场；VP 新教 4（spaces track）。其余: 奥8/哈10/英9/法13/教15。
- 存档: slot_1（T1 diet）、slot_2（T2 外交起点=T1 完成检查点）。
- **测试经验**: 地图空间为 SVG `<polygon data-name>`，不在无障碍树 → 用 `dispatchEvent(MouseEvent)` 五连（pointerdown/mousedown/pointerup/mouseup/click）点击；其余按钮/手牌为真实 DOM `.click()`。改革流程: 「掷骰尝试」按钮 → 进入选择态 → 点地图目标 → 自动结算 → 「关闭」结果弹窗。
- **外交「轮到我」判定**: 外交阶段 `activePower` 字段会停在最后一个 bot（如 hapsburg）不变，**不能**用它判断新教是否该行动；应查 `diplomacyActed[protestant] !== true`（动作面板用 `canActInSegment` 判定，非 `activePower`）。否则会误判为「卡住」。

## T2 进度（新教全程 UI）

- 外交: 5 段全过（negotiation/sue_for_peace/ransom/**excommunication**(新增段)/declarations_of_war），新教全 PASS；bot 已宣战（哈-法、法-教、奥-匈波）。
- 春季部署: 跳过。
- 行动（脉冲）:
  - #96 Sale of Moluccas(1517-only) 用作 CP(3) → 发表论文(德,Lübeck✓) + 翻译圣经(德→3)。
  - #72 Cloth Prices 用作 CP(3) → 发表论文(德,Hamburg✓) + 翻译圣经(德→4)。
  - #79 Fuggers 用作 CP(3) → **召集辩论(德语)**: Luther vs Campeggio，第1轮 Luther 1 命中/0 → 新教胜 → **autoFlip 奖励翻 1 格**(Bremen✓ 无需掷骰)。**辩论 UI 全链路验证通过**（选区→掷骰→结算→胜负→翻格）。
  - #7 Here I Stand 用作 CP(5) → 发表论文×2(德,Stettin✓/Salzburg✓) + 翻译圣经(德→5)。
  - 余 #32 Gout（RESPONSE-only，普通脉冲不可打）→ PASS 退出。
- winter/新世界/胜利/抽牌自动链推进 → T3。
- **T2 结算**: 新教 20 空间，德语圣经=5，VP 新教 6；奥10/哈11/英9/法14/教13。存档 slot_2(T2)、slot_3(T3 起点)。

## UI 交互覆盖总览（已验证通过）

| 子系统 | 路径 | 状态 |
| — | — | — |
| 地图交互 | SVG polygon 点击选格 | ✅ |
| 路德 95 论纲 | 选格→自动掷骰→结果弹窗 | ✅ |
| 沃尔姆斯会议 | 选手牌→提交（**修复 UI-2 后**） | ✅ |
| 外交 | 全 5 段跳过/判定 | ✅ |
| 春季部署 | 跳过 | ✅ |
| 卡牌 | 触发事件 / 用作 CP / PASS / RESPONSE 持有 | ✅ |
| 改革(CP) | 发表论文→选区→掷骰尝试×N | ✅ |
| 改革(事件赠) | Printing Press 赠 3 次任意区域 | ✅ |
| 翻译圣经 | 选区推进轨道(德语 0→5) | ✅ |
| 神学辩论 | 召集辩论→选区→掷骰→结算→autoFlip 翻格 | ✅ |
| 存/读档 | 大厅读档 + 局内存档（含 HMR 重载后读档续局） | ✅ |
| 阶段链 | winter→新世界→胜利判定→抽牌→下回合 自动推进 | ✅ |
| 回合横幅 | 显示真实 turn（**修复 UI-1 后**） | ✅ |

**T3 顺带观察（停测前自然出现，结果弹窗均正常）**: 教廷 bot 对新教格 **Augsburg 发动反宗教改革→失败**（新教骰 max6 vs 天主教 max3，引擎自动防守，无需新教 UI 介入）；法兰西野战 Modena 胜；哈布斯堡新世界探索发现 St. Lawrence。反宗教改革反推路径由引擎自动结算，新教侧无阻断式 UI。

**未触发**: 新教主动参与的战斗结算 UI、新教手动 RESPONSE 窗口（Gout/Siege 等 RESPONSE 卡未遇触发时机）。

## 结论

2 个真实 UI 缺陷（UI-1 回合横幅、UI-2 Diet 手牌不可点）已修复并经读档验证；HIS 核心交互面 UI 端到端可用，T1–T2 全程稳定，0 报错、0 卡死。
