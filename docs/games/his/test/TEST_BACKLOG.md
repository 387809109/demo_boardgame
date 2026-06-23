# HIS 测试待办（按优先度）

> 记录尚未覆盖的测试缺口，按优先度排列，供后续逐项执行。
> 已覆盖：引擎层（3334 单测 + gate-parity 审查 + full-bot batch 回归）、UI 渲染契约（ui-gating 覆盖测试）。
> 可用工具见 [TEST_REQUIREMENTS_PLAYWRIGHT.md](TEST_REQUIREMENTS_PLAYWRIGHT.md) 「确定性 UI 测试机制」：
> ① ui-gating 覆盖测试（node，纯函数穷举）② `forceHands`+`rngSeed`（确定性发牌/掷骰）③ live Playwright（仅集成）。
> 进度记号：⬜ 未开始 / 🟡 进行中 / ✅ 完成。

---

## P1 — 高优先（复用 `forceHands`，无浏览器依赖）

### 🟡 1. 其余 5 势力的特有 UI 路径

**进度（2026-06-20，Playwright 人类可玩性走查 — 以 Ottoman 实机驱动整轮 T1）**：起单机局控 Ottoman、5 AI，
走通 外交 5 段 → 春季部署 → 行动阶段 的人类侧 UI，并查出并修复 **2 个真 UI bug**：

- 🐛✅ **状态栏在外交/diet 段显示错误行动方**（`fix(his): status bar shows real actor during diplomacy`）。
  `status-bar` 直接读 `state.activePower`，而该字段只在 impulse 序阶段维护；外交/diet 段它残留上一个设值者
  （T1 由 Luther95 设为 `protestant`），于是轮到人类时仍显示「▶ [BOT] 新教 思考中」——人类**无从得知该自己行动**。
  新增 `ui-gating.getActivePower(state)`（与 `isActionPanelActive` 同款分阶段回合模型），`status-bar` 改用之。
  穷举节点测试 +8，live 复核：外交 5 段 + 春季 + 行动**每阶段显示正确**。
- 🐛✅ **Ottoman 海盗/海盗船 CP 动作在 `piracyEnabled=false` 时仍出现于菜单**（`fix(his): gate Ottoman
  piracy/corsair CP actions on piracyEnabled`）。引擎 `validatePiracy`/`validateBuildCorsair` 在 Barbary Pirates
  入场前拒收，但 UI 照样出 `海盗行动`/`建造海盗船`、高亮合法港口、允许走完选择流——白走一趟交互（无海盗船、
  不扣 CP）。**修正（2026-06-20 复核）**：引擎拒收**确有反馈**——`_handleGameAction` 在 `!result.success` 时
  `showToast(result.error)`（3s 自动消失，早前误判「无反馈」系 toast 已自动消失后才扫描的测量偏差，见末尾 ⚠️）。
  故此修的正当性是「**菜单不应提供引擎必拒的动作**」（与既有按成本门控同理），而非「补反馈」。
  `cpActionsFor` 增门控（首版 `opts.piracyEnabled`，后泛化为 `opts.unavailable`）；`action-panel` 传 `state.piracyEnabled`。
  节点测试 +1，live 复核：`piracyEnabled=false` 时菜单只剩 7 项（无海盗/海盗船）。Ottoman 的 `PIRACY`/
  `BUILD_CORSAIR`/`NAVAL_MOVE` 选择流入口与 `BUILD_CORSAIR` 端到端（含引擎拒收路径）由此走通。
- 🐛✅ **CP 菜单/引擎门控一致性（gate-parity）泛化**（`fix(his): generalize CP-menu/engine gate parity`）：
  以 piracy 同款审计全部 CP 动作 validator 的「状态前置」拒收点，新查出 3 类同类问题（菜单提供、引擎必拒——
  会 toast 报错但白走交互）：
  **FOUND_JESUIT**（需 `jesuitFoundingEnabled`，Society of Jesus 前）、**EXPLORE/COLONIZE/CONQUER**
  （`newWorld.*ThisTurn[power]` 每回合各一次，用后菜单仍出）。统一收敛为唯一真源 `ui-gating.unavailableCpActions
  (state, power)`（与各 `validate*` 门一一对应）；`cpActionsFor` 改收 `opts.unavailable: Set`，`action-panel` 传之。
  节点测试 +5（逐门 + 逐势力 + null 安全）。
- 🐛✅ **资源耗尽门补全**（`fix(his): gate CP menu on New World piece exhaustion + St Peter's complete`）：
  `unavailableCpActions` 再补 **EXPLORE「无可用探险家」/ COLONIZE「殖民上限」/ CONQUER「无征服者」（仅 Hapsburg）/
  BUILD_ST_PETERS「已完工 `stPetersVp>=maxVp`」**——直接复用引擎 helper `getAvailableExplorers/getAvailableConquistadors`
  以及 `COLONY_LIMITS/ST_PETERS`（无环；数组存在性守卫防局部态抛错）。节点测试 +4（用真 EXPLORERS/CONQUISTADORS 数据）。
  **至此 item 1 gate-parity 收口**：菜单不再提供任何引擎必拒的 CP 动作。

**进度（2026-06-20，item 2 其余势力 live 走查 + item 3 弹窗）**：

- ✅ **Hapsburg 新世界 端到端走通（无 bug）**：实机 单击「探索」→ `exploredThisTurn=true` + 一个 exploration 进入
  `underwayExplorations`（航行中）；**新世界面板**（`new-world-panel.js`，曾致 Vercel 失败、从未 UI 测）正确渲染
  征服/殖民地/航行中/财富表并实时反映该探索。**顺带 live 复核 item 1 的每回合门**：探索后菜单立即移除「探索」。
  「征服」缺席经核实为**成本门**（Hapsburg conquer=4CP > 余 3CP），非误门控（征服者 0 placed/0 dead = 有货）。
- ✅ **Papacy 宗教菜单逻辑（确定性核实，无 bug）**：`cpActionsFor('papacy',2,…)` 宗教组 = `[BUILD_ST_PETERS,BURN_BOOKS]`，
  FOUND_JESUIT 被正确门控（jesuit 未解锁）、CALL_DEBATE 因成本(3>2)排除。live 驱动 Papacy 因 reformation 弹窗反复
  拦截合成点击而退化（即 item 3），故宗教菜单改以 node 确定性核实（免弹窗干扰）。
- ✅ **England 继承换君（Lady Jane Grey #59）已覆盖**（2026-06-23，`england-succession.test.js` +3，node/构造态）：
  #59 仅在 `englandRulerChangedThisTurn` 为真时可打，中局窗口 live 难触及，故以构造的行动阶段态走**真实 move 管线**
  （`applyStateUpdate` → `executeMove` → `validateMove` 门 → `processMove` 执行）钉死人类出牌路径：条件假时
  `executeMove` 拒收（error 含 England、手牌不动、无 `pendingLadyJaneGrey`）；条件真时成功（`pendingLadyJaneGrey.giveTo`
  含 protestant/papacy、#59 因 `removeAfterPlay` 进 `removedCards`、记 `event_lady_jane_grey`）。**verify-before-implement
  决定不改 UI 门控**：「触发事件」按钮**有意不按卡预门控**——许多事件（如 #6 Leipzig）的 validator 需点击后选目标、
  空 actionData 会被拒，预门控会**误隐藏**可打的卡；#59 依赖引擎门 + 既有拒收 toast（`_handleGameAction`）。
  ⇒ **item 1 全部势力特有 UI 路径收口**。
- 🐛✅ **item 3 — reformation/debate 结算弹窗自动消失**（`fix(his): auto-dismiss reformation/debate result modals`）：
  `_detectNewEvents` 对每条改革/辩论结果弹全屏 `ReligiousDisplay`（含 bot 整回合数十次），背景遮罩需手动「关闭」→
  bot 回合反复挡板并干扰操作。`ReligiousDisplay._show` 加自动隐藏定时器（`RESULT_AUTO_HIDE_MS=3.5s`，每条结果重置→
  bot 连发只闪最后一条）；`hide()` 清定时器（关闭/点背景仍可提前关）。日志保留全史。node 测 +3，live 复核
  弹窗 `none→flex→none` 自动消失、无需手动关闭。
- ✅ **已澄清（原列为「无反馈」缺口，经核实为误判并撤回）**：被引擎拒收的 move **确有反馈**——
  `main._handleGameAction` 在 `!result.success` 时 `showToast(result.error)`（3s）；选择流完成也经 `ui.js:_startSelectionFlow`
  的 `onComplete → this.onAction → _handleGameAction` 走此路。早前「无 toast」系 3s 自动消失后才扫描 DOM 的测量偏差
  （同 2026-06-19 宣战事件名误判一类）。**故不新建「拒收反馈」功能（已存在）**。
- ⚠️ **仍待（真 UX 小项）**：各 reformation 结算弹窗在 bot 行动期间不断弹出且需手动「关闭」——弹窗策略可后续优化。

本会话仅驱动了新教（Protestant）。以下面板/路径从未经 UI 触发，用 `forceHands` 指定相关卡 + 构造对应状态后逐一走通，并把稳定的渲染契约下沉到 `ui-gating`：

- **Papacy**：主动发起反宗教改革、绝罚（excommunication 段）、创立耶稣会（`FOUND_JESUIT`，#AA 相关）、烧书（`BURN_BOOKS`）、建造圣彼得（`BUILD_ST_PETERS`）。
- **Hapsburg**：新世界 探索 / 殖民 / 征服（`EXPLORE`/`COLONIZE`/`CONQUER`）UI。
- **Ottoman**：海盗 / 建海盗船 / 海军移动（`PIRACY`/`BUILD_CORSAIR`/`NAVAL_MOVE`）UI。
- **England**：继承换君 → 卡 59 Lady Jane Grey（#AB 相关；需 `englandRulerChangedThisTurn`）。
- **France**：chateaux 相关交互。

**进度（2026-06-17）**：CP 行动菜单的**每势力可见性契约**已下沉为 `ui-gating` 纯函数 `cpActionsFor`（唯一真源
`CP_ACTION_CATALOG`），取代了 `action-panel._renderCpActions` 中三处重复的 `costs[a.cost] != null && <= cp`
过滤。`ui-gating.test.js` 新增 10 条穷举用例，独立钉死各势力特有路径的**可见集合**：仅 Ottoman 有
海盗/海盗船/骑兵；新世界仅 Hapsburg/England/France；仅 Papacy 可创耶稣会/建圣彼得/烧书；英格兰为唯一
非改革方的发表论文方；Protestant 无海军；并交叉校验 `cpActionsFor` 与 `ACTION_COSTS` 一致、可负担门控。
**进度（2026-06-18，事件卡 `pending*` 未消费审计）**：审计「事件 handler 设了 `state.pending*` 但全局
无人读取」的事件效果（reads = 非赋值引用数）。**16 个 `pending*` 字段读取数为 0**：CounterReformation、
DebateCall、DiplomaticPressure、DiscardChoice、ForeignRecruits、FreeAssault、GiveCard、HandReveal、
HandReview、LadyJaneGrey、LeipzigDebate、MachiavelliChoice、PeaceRestore、SkipImpulse、
StPetersContribution、TreacheryAssault、Unrest。**两类**：(a) **赘余旗标**——主效果走别的路径（如 #76 Foreign
Recruits 靠 `return {grantCp:4}`、#208/#112/#207 靠 `pendingCardDraw` 抽牌），`pending*` 只是死代码；
(b) **真 no-op**——整/主效果丢失。已修 (b) 一例：**#61 Mary Defies Council**——卡面「教廷在英语区做 3 次反
改革尝试」，旧码设**未被读取**的 `pendingCounterReformation`（且键名 `attemptsRemaining/zones` 与解析器
解耦），改为设**被消费**的 `pendingReformation = { type:'counter_reformation', zone:'english', attemptsLeft:3 }`
（`attemptsLeft` 才是 `resolveReformationAttempt` 递减的键）。原测试锁定了 bug（断言赘余字段），已改为断言
落到 `pendingReformation`。`event-actions-extended.test.js` 仍 145 绿。

**0-read 字段分类（供逐项跟进）**：

- **整卡 no-op（卡几乎只设该字段，最高优先）**：✅ **#6 Leipzig Debate 已修**（2026-06-18）——卡面「召集
  神学辩论，可指定己方辩手或令某新教辩手本场不可用」。从 `callDebate` 抽出无 CP 消耗的 `initiateDebate`
  （CP 动作与事件共用；支持 `attackerId` 指定攻方辩手、`blockDefenderId` 屏蔽守方辩手），#6 改为调用它设
  **被消费**的 `pendingDebate`（旧 `pendingLeipzigDebate` 从此不再写）。原 2 条测试锁定 bug，已改为断言真实开
  辩（攻方=papal、指定辩手生效、被屏蔽者不会成为守方）。✅ **#105 Treachery! 已修**（2026-06-19）——卡面
  「对被围困工事立即发起突击（无视 LOC/海军限制）；突击后若围攻方仍多于工事内单位，则全歼守军、俘获将领、
  夺取空间」。从 `executeAssault` 抽出共享 `rollAssault`，新增 `treacheryAssault`（无 W5——#35 需 LOC 而本卡
  绕过；含 overrun 规则）；#105 改为调用它（旧 `pendingTreacheryAssault` 不再写）。`event-actions-extended.test.js`
  +2（overrun 路径用 `Math.random=0` 确定性触发、非围困为 no-op）。**顺带修引擎隐患**：新 `extended→siege→
  response→event` 形成的导入环会在「以 extended 为入口」时触发 `Object.assign(EVENT_HANDLERS,...)` 的 TDZ；
  改为**惰性合并**（首次 `executeEvent/validateEvent` 时合并），环变为调用时安全（node 直接 import extended 已通过）。
  ⛔ **#205 Diplomatic Pressure / #215 Machiavelli — 经核实判定「受阻于缺失的外交牌库子系统」，不作 no-op 修**
  （2026-06-20，verify-before-implement）。两卡都直接操作**外交牌库/手牌**：#205「查看对手外交手牌→强制弃牌
  并补抽 / 与对手互换外交牌」、#215「从外交牌库或弃牌堆选一张入侵卡打出，然后连同 Machiavelli 一起重洗外交
  牌库」。但本引擎**根本没有外交牌库子系统**——经全仓核查：(a) 外交牌（`deck:'diplomacy'`/`'diplomacy_sl'`）
  在 `state-init.js:100-101` 建牌库与 `phase-card-draw.js:82` 发牌时**均被显式排除**，从不进入任何 `state.hands`；
  (b) `state.diplomacyDeck`/`diplomacyHand`/`diplomacyDiscard` **从未初始化**——唯一引用 `event-actions.js:551`
  `if (state.diplomacyDeck)` 恒 false（死代码）；(c) 外交阶段（`phase-diplomacy.js`）建模的是谈判/求和/赎将/绝罚/
  宣战五段，**与外交卡牌库无关**。结论：**全部 #201-219 外交事件 handler 在正常对局里均不可达**（无人发到手、
  无人抽、无路由），#205/#215 只是这片**未建子系统**的冰山一角，并非 #6/#61/#105/#42 那种「路由到既有消费者」
  的受限 no-op。faithfully 实现 = 新建整套外交牌库子系统（每回合发外交卡、各势力外交手牌、弃牌堆、
  played-this-turn、重洗、对应 UI 与打牌流程）+ 全引擎集成——属**独立大功能**，已升级为下方「P3 外交牌库子系统」，
  不在本 no-op 审计范围内。**按 verify-before-implement：不凭空补子系统、不给永不执行的 handler 做装饰性修。**
  ⇒ **整卡 no-op 审计到此收口**：可路由的 4 张已修（#6/#61/#105/#42），剩 #205/#215 因缺子系统挂起（见 P3）。
- **部分丢失（主效果走 `pendingCardDraw`/`grantCp` 等仍生效，次效果丢）**：#74 Diplomatic Overture
  （GiveCard）、#56（HandReview）、#62 Book of Common Prayer（Unrest）、#73 Diplomatic Marriage 和平模式
  （PeaceRestore）、#219 Spanish Inquisition 一分支（HandReveal）、#208/#112/#207（StPeters/Discard/DebateCall
  次效果）、#38 Halley 跳过模式（SkipImpulse）。✅ **#42 Roxelana 自由突击分支已修**（2026-06-19）——奥斯曼
  分支「苏莱曼编队获一次免费突击，甚至可打非围困要塞」原设**未消费**的 `pendingFreeAssault`，自由突击从不发生。
  现 `validateAssault` 承认该 grant（持卡势力 + `isFree`：跳过「未围困/同脉冲建围」校验、要求编队含 `requireLeader`
  苏莱曼；LOC/海军仍校验），`executeAssault` 用后即清。`siege-actions.test.js` +4。**注**：grant 在引擎层可用；
  bot 是否主动使用属 AI 调优，非引擎 no-op。
- **赘余旗标（主效果另有路径，字段为死代码，可清理）**：#76 Foreign Recruits（ForeignRecruits，靠 `grantCp`）。

**仍待办**：①~~整卡 no-op 逐卡实现~~ **已收口**（4 张已修；#205/#215 受阻于缺失子系统 → 见 P3「外交牌库子系统」）
②各动作点击后的多步**选择流程**（target selection，需集成层）③事件卡多步 UI（Lady Jane Grey 抽牌+选牌等
draw+choose 交互流程）④绝罚段 / 反宗教改革面板。②③④均需真实浏览器集成层 → 归入 P2「人类可玩性走查」。

### 🟡 2. 人类侧战斗与响应窗口

**进度（2026-06-20，人类侧 live 驱动响应链 — 查出并修复 1 个 render bug）**：以 Ottoman（攻方）实机驱动一场
野战：到行动阶段后构造 `pendingBattle`（Edirne，ottoman vs hapsburg）+ 双方 units + `forceHands`（攻方持战斗卡 #24），
经 `_handleGameAction('RESOLVE_BATTLE')`（= 战斗面板「解决战斗」按钮）开 **W2** 响应窗口；面板正确渲染（响应方=奥斯曼、
可用响应卡 + 放弃响应）。**🐛✅ 查出真 render bug**：响应卡按钮显示「#24 **undefined**」——HIS 卡名字段是 `title` 而
`action-panel`（及 `hand-panel` 两处）读 `card.name`（恒 undefined）。修法：把卡名解析下沉到纯模型
`responsePanelModel.cards[].name = card.title || card.name || 'Card #N'`，`action-panel` 直接渲染之（去掉自身查表）；
`hand-panel` 两处同改 title-first（对齐 `ui.js` 手牌渲染）。`ui-gating.test.js` +2（#24→"Arquebusiers"、未知→"Card #N"）。
**live 复核**：W2 按钮现显示「#24 Arquebusiers」，点击驱动完整链 `event_arquebusiers → play_response_card →
decline_response（守方 bot W3）→ field_battle` 结算（ottoman 5R→3R）。**W2→W3→结算端到端走通**。
**进度（2026-06-20 续，人类侧逐窗 live 驱动）**：又驱动 **W1/W5/W6**（共 5 窗、3 种战斗类型、4 张不同卡，卡名全部正确）：

- **W1 佣兵**（野战，持 #33）→ 按钮「#33 Landsknechts」+ 放弃；**W2 攻方战斗卡** →「#24 Arquebusiers」；守方 W3 由 bot 处置；
  连发 `decline×3 → field_battle` 结算。
- **W5 攻城炮**（assault，围困 Edirne + 持 #35）→「#35 Siege Artillery」→ 出牌驱动
  `event_siege_artillery → play_response_card → siege_artillery_bonus → assault`（+2 骰、突击 finalize）。
- **W6 划桨手**（naval，Ionian Sea→Corfu + 持 #34）→「#34 Professional Rowers」→ 出牌驱动
  `professional_rowers_bonus → naval_combat → naval_retreat → naval_move`（+3 骰、海战 finalize）。

复用「构造 `pendingBattle`/围困/海战态 + `forceHands` + `_handleGameAction(RESOLVE_BATTLE/ASSAULT/NAVAL_MOVE)`」手法
（见 [[project_his_testing]]）。**响应窗口 UI 至此充分覆盖**：5 窗 × 3 战斗类型 live 走通、卡名修复全局生效。
**进度（2026-06-20 续，战斗面板 + 拦截面板 live 复核）**：用「改 state + `currentGame.emit('stateUpdated', s)`」强制重渲染，
驱动两个**不同模型**的面板：**战斗面板** `battlePanelModel`——结算分支「解决战斗」（攻方）渲染+点击 → `field_battle`；
退入工事分支「退入工事 / 应战」（守方）渲染+点击「退入工事」→ `field_battle → siege_established`（守军退入要塞、转围城）。
**拦截面板** `interceptionPanelModel`——「尝试拦截 / 避战」渲染。**verify-before-claim 抓到一例自摆乌龙**：守方退入面板初次为空，
疑似「守方在攻方脉冲无法决策」的门控 bug——核 `bot-controller.decideAction:362`（`decideBattle/Interception` 同样要求
`activePower===power`）证明引擎在守方/拦截方决策时**会把 `activePower` 设为决策方**；初次为空仅因我测试里把 `activePower`
设成了攻方（测试构造错误），改对即正常渲染，**非 bug**。
**仍待（同 `responsePanelModel` 接线、render bug 已统一修，低边际价值）**：**W4 禁卫军**（post-roll 条件触发，本次未自然出现）、
**W7 脉冲中断**（跨脉冲，RESPONSE 卡如 Gout/Wartburg）。**至此 A1（人类侧战斗+响应窗口）实质完成**：5 响应窗 + 战斗（结算/退入工事）+
拦截面板均 live 走通，全程仅 1 个真 bug（卡名 undefined，已修）。

本会话所有战斗均为 bot-vs-bot 自动结算；以下从未由人类侧驱动，且响应链历来易出 bug：

- `pendingBattle` / `pendingInterception` / 突击（assault）面板。
- W1–W7 响应卡窗口（佣兵 / 攻守方战斗卡 / 禁卫军 / 攻城炮 / 划桨手 / 脉冲中断）及 `RESPONSE` 卡（如 Gout、Siege Artillery）。
- 工具：`forceHands` 发到响应/战斗卡 + 构造开战状态后触发。

**进度（2026-06-17）**：三个战斗-响应面板的**控件与出招契约**已下沉为 `ui-gating` 纯函数
`responsePanelModel` / `battlePanelModel` / `interceptionPanelModel`，`action-panel` 三个 `_render*` 方法
改为直接消费（移除内联分支 + 重复的窗口常量，控件用 `{label, move}` 或 `{label, select}` 统一描述）。
`ui-gating.test.js` 新增 15 条穷举用例钉死：W1–W7 全窗口 label/hint 映射（不泄露裸窗口 id）、
**仅响应方**可见响应卡与放弃按钮（旁观者 `cards=[]`、不可 decline——响应链最易错处）、各控件
emit 的精确 move（`PLAY_RESPONSE_CARD`/`DECLINE_RESPONSE`/`RESOLVE_BATTLE`/`WITHDRAW_INTO_FORTIFICATION`/
`RESOLVE_INTERCEPTION`/`AVOID_BATTLE`/撤退走选择流）、退入工事 vs 单结算分支、避战门控。
**进度（2026-06-17，续）— 引擎层路由走通**：核查 `index.test.js` 发现野战响应链
（W1→W2→W3→W4 及 W7 脉冲中断：Wartburg/Foul Weather/Gout/Halley）**已**经 `game.processMove`
端到端覆盖（~40 用例）。新补 **拦截链路由**：`index.test.js` 新增 `processMove — interception routing`
4 用例，钉死 `RESOLVE_INTERCEPTION` 经顶层路由 → `_handleResolveInterception` 的成功（在 targetSpace
建 `field_battle`，攻=移动方/守=拦截方）/失败/空 `pendingInterception` 安全无操作分支（此前 bot 测试只验
*决策* `actionType`，从不经路由执行）。

**进度（2026-06-17，W5 实现）**：**W5（攻城炮 #35，突击）已接入实战流程并经 `processMove` 端到端覆盖**。
据卡面规则（#35：进攻方突击 +2 骰、命中值 3–6、需「至发起方设防本土空间 ≤4 陆地空间的交通线」）实现：

- `siege-actions.js`：`executeAssault` 拆为 掷骰阶段（满足「持 #35 且 `assaultLocWithinRange` LOC≤4」时存
  `state.pendingAssault` + 开 W5 窗口暂停）+ `finalizeAssault`（消费既有 `EVENT_HANDLERS[35]` 设的
  `state.pendingCombatBonus`，按命中值 3 计 +2 骰加成，再算伤亡/夺控）。新增深度受限 BFS `assaultLocWithinRange`。
- `index.js`：`_advanceAfterResponse` 新增 W5 分支 → `_advanceAfterW5` → `finalizeAssault`（含胜负/自动结束脉冲）；
  原 `// W5/W6 finalization` 桩缩为仅 W6。复用既有 `EVENT_HANDLERS[35]`（曾只设 `pendingCombatBonus` 无人消费）。
- 测试：`index.test.js` +5（暂停/出 #35 加成/放弃/LOC 门控/无牌不开窗），`siege-actions.test.js` +3（LOC BFS 直测）。

**进度（2026-06-17，W6 Mode B 实现）**：**W6（划桨手 #34，海战 +3 骰 = Mode B）已接入实战流程并经
`processMove` 端到端覆盖**。因海战嵌在「移动→多场海战」同步循环里，把海军移动改造成**可跨 processMove
恢复的状态机**：

- `naval-actions.js`：`resolveNavalCombat` 拆为 掷骰阶段（持 #34 即存 `state.pendingNavalCombat` + 开 W6
  暂停）+ `finalizeNavalCombat`（消费 `EVENT_HANDLERS[34]` 'combat' 模式设的 `pendingCombatBonus`，给
  响应方一侧 +3 骰，post-roll 掷骰加命中）。`executeNavalMove` → `pendingNavalMove` + 可恢复
  `continueNavalMove`（逐 movement 跑 拦截/移动/避战 + 海战序列；遇 W6 暂停即返回，留状态待恢复）。
  抽出共享 `applyNavalRetreatAndBreak`（同步路径与恢复路径共用 撤退+终止判定）。
- `index.js`：`_advanceAfterResponse` 新增 W6 分支 → `_advanceAfterW6`（finalize 该场海战 → 撤退 →
  `continueNavalMove` 续跑剩余 movement/海战，可再次于下一场 W6 暂停）；旧 W4/W6 桩缩为仅 W4。
- `response-actions.js`：W6 窗口出 #34 默认 'combat' 模式（否则 handler 默认 'modify' → +3 骰永不生效，
  此前的真实集成缺陷）。`EVENT_HANDLERS[34]` 'combat' 模式记录 `power` 以定加成归属。
- 测试：`index.test.js` +4（暂停/出 #34 加成归攻方/放弃/无牌不开窗）；既有 naval 71 测全绿（行为保持）。

**进度（2026-06-19，#34 Mode A 接入 — 自动生效）**：原方案（多候选拦截/避战循环改可恢复 + ±2 交互窗口）
经评估为最大单项重构、收益仅 ±2，且**现有拦截/避战本就全自动无玩家窗口**。故按「与自动模型一致」实现：
`naval-actions.applyRowersRollModifier` 在每次 拦截/避战 掷骰后，若**受益方持 #34** 且 ±2 能**翻转接近阈值
（9）的结果**则自动施加并消耗该卡——移动方可把成功的 9/10 拦截/避战 −2 否掉，拦截/逃逸方可把 7/8 +2 成功。
每次掷骰至多一次 ±2。`naval-actions.test.js` +4（−2 否决 / +2 强成 / 无持卡不动 / 不能翻转则不浪费卡，
均用固定 `Math.random` 序列确定性触发）。全 bot 跑到终局回归仍绿。
**简化说明**：非字面「交互响应窗口」，而是在自动拦截模型下由引擎做「最优使用」决策（与现有设计一致）；
`EVENT_HANDLERS[34]` 的 `pendingNavalModifier`（modify 模式）随之成为赘余旗标。

**进度（2026-06-17，面板契约补全）**：辩论/改革（反改革）面板的渲染契约已下沉为 `ui-gating` 纯函数
`reformationPanelModel` / `debatePanelModel`，`action-panel` 两个 `_render*` 改为消费（统一 `_controlButton`）。
`ui-gating.test.js` +8：改革 vs 反改革标题、`attemptsLeft/attemptsRemaining` 与 `zone/zones('all'→null)` 归一、
`autoFlip` 切换「翻转/掷骰」控件、辩论 phase→label 映射与「仅掷骰后露命中数」。至此 response/battle/
interception/reformation/debate 五类待决面板的 state→渲染契约全部穷举锁定。

**进度（2026-06-17，AVOID_BATTLE 修 bug + 路由覆盖）**：为 `AVOID_BATTLE` 补 `processMove` 端到端覆盖时
**查出 3 个真 bug**并修复（`index._handleAvoidBattle`）：`findLegalRetreats` 返回**空间名字符串数组**，但旧码
当对象用——`legalRetreats.some(r => r.space === dest)`（恒 false → 任何撤退都判非法）、`retreats[0].space`
（自动撤退目的地恒 `undefined`）、`eliminateFormation(state, space, power, helpers)` 漏传 `capturingPower`
（实为 5 参 → 无法撤退时**抛异常**）。修正后 `index.test.js` +5 钉死：合法目的地撤退并清战斗 / 非法目的地记
`avoid_battle_failed` 且保留战斗可重试 / 无目的地自动撤到首个合法 / 无合法撤退则歼灭（原崩溃路径）/ 无
`pendingBattle` 安全无操作。

**进度（2026-06-18，Gout #32 效果接入）**：此前 `pendingGout`（及 `pendingFoulWeather`）只设不消费——
打出后**无任何效果**。已实现 Gout 核心效果：`EVENT_HANDLERS[32]` 额外扣 1 CP（Charles V+HRE 转移例外
未建模）；`index.validateMove` 拦截**含被点名将领的** `MOVE_FORMATION`/`ASSAULT`；`advanceImpulse` 在脉冲
结束时清 `pendingGout`/`pendingFoulWeather`。`index.test.js` +6（扣 CP / CP 不破 0 / 含将领的移动·突击被拦 /
不含则放行 / 脉冲推进清除）。

**进度（2026-06-18，Foul Weather #31 效果接入）**：同 Gout 模式实现 #31：`EVENT_HANDLERS[31]` 扣 1 CP +
补 `noNavalTransport` 字段；`validateMove` 对 `targetPower` 拦截 突击/海盗/海军移动/海军运输（整脉冲）；
`advanceImpulse` 清除（与 Gout 共用）。`index.test.js` +4。**部分**：卡面「陆军每单位最多移动 1 空间」因本
引擎 `MOVE_FORMATION` 本就是单步邻接移动（≤1 空间），未额外做「每单位整脉冲移动总距离」计数限制。

**仍待办**：①#34 Mode A（拦截/避战 ±2 响应窗口，大改造，单独排期）②Foul Weather「每单位 ≤1 空间总距离」
精确限制（需按单位记录整脉冲移动，当前单步模型已基本满足）。

---

## P2 — 中优先（需真实浏览器，layer C；需引入 Playwright runner 依赖）

### 🟡 3. 种子化 Playwright 集成回归 `.spec.js`

仅覆盖 jsdom/node 验不到的部分，每条用 `rngSeed`+`forceHands` 钉死：

- SVG `<polygon data-name>` 命中测试（真实指针事件）。**需浏览器，仍待办。**
- HMR 重载后续局。**需浏览器，仍待办。**
- **mid-`pending*` 存读档**：在战斗 / 辩论 / 改革进行中存档，再读档续局。✅ **引擎层已覆盖**
  （2026-06-18，`save-load.test.js` +2）：①全部 10 类待决状态（battle/response/interception/reformation/
  debate/navalCombat/navalMove/assault/gout/foulWeather）经 `exportSave→importSave` 深拷贝往返逐字段保真；
  ②**载入后续局**——把对局驱动到 W5（攻城炮）暂停、存档、导入新对局实例、`DECLINE_RESPONSE` 续局 →
  突击正确结算（`pendingAssault` 清空 + 记 `assault`）。**仅载入后的 UI 重渲染**属浏览器部分，仍待办。

### 🟡 4. 跑到对局结束

- 胜利判定（统治 / 宗教 / 军事）、`game-result` 结算屏、后期回合（T3–T9）机制。
- 用固定 `rngSeed` 跑一局直到分出胜负，验证终局 UI 与计分。

**进度（2026-06-18，胜负判定集成）**：胜利阈值（`checkImmediateVictory` 军事/宗教、`checkGameEnd`
标准/统治/时限）此前已分别穷举单测。本次补 **`_checkVictory → checkGameEnd → _buildEndResult` 集成链**
（`index.test.js` +4）：军事 auto-win（奥斯曼 11 钥）与宗教胜利（新教 50 空间）经 `_checkVictory` 置
`status='ended'/winner/winReason` 后，`checkGameEnd` 的 `status==='ended'` 分支（此前未测）返回正确
`winnerPower/winner(playerId)/reason` 与**全 6 势力计分排名**（rank 1..N、VP 降序）；`_checkVictory` 已结束
幂等、开局无胜利。`game-result` 结算屏为**通用 UI**（消费 `{ended,winner,winnerPower,reason,rankings}`，
非 HIS 专属）。

**进度（2026-06-18，种子化全-bot 跑到终局）**：新增 `ai/bot-fullgame.test.js`——node/CI 版的
`_runHisBotBatch`。关键洞察：`transitionPhase` 让自动阶段（card_draw/winter/new_world/victory_determination）
自链（resolve + `advancePhase`），故全局由交互阶段的 bot 决策驱动。**复用真实 bot loop**（`scheduleBotAction`）
而非重写：用 vitest **fake timers** 把 setTimeout 链同步化——每次 `runOnlyPendingTimers()` 触发一个 bot 动作、
其 `executeMove` 再续接下一个；`Math.random` 用 mulberry32(seed) 播种确定性。3 个固定种子各**跑满整局到 T9**
（~2.6s/局，关闭统治胜利），断言 **clean run**（到达终止态 + `stuck===0` + `chainBroken===0`，对齐
`_runHisBotBatch.clean`）+ **后期回合机制确实执行**（turn≥3 且 eventLog 有 `new_world` 的 `phase_change`）+
产出 `winnerPower` + 全 6 势力计分。覆盖所有动作类（事件/CP 子动作/响应/部署/战斗链）的端到端引擎稳定性回归。
（每条 `it` 给 30s 超时，避免并行负载下 5s 默认超时误报。）

> **仍待办（可选）**：T3–T9 **特定机制**的逐项断言（如新世界探索/殖民产出量、宗教压力曲线）——避免过度约束
> bot 行为（见 TEST_REQUIREMENTS「只记录不中途修复行为偏差」），仅在需要时补结构性（非行为性）断言。

---

## P3 — 较大独立工作

### 🟢 5. HIS 多人联机 — **RNG 确定性阻断已修（方案 A）；双客户端 live 联机仍待**

**✅ 已修（2026-06-21，方案 A：状态内播种 RNG）**：所有引擎掷骰/选牌改走 `state.rngState` 播种的 PRNG
（`state/rng.js` 的 `nextRandom/rollDie/randInt`，原地推进）；`processMove` 为本次 move 设「活动状态」作用域，
故**同 state 重放同 move 必得同骰**。`religious-actions.rollDice` 内部改走 `rollDie()`（签名不变 → ~38 处调用方零改动），
另替换 ~31 处内联 `Math.random`（event/extended/diplomacy/naval/debate/diplomacy-actions/new-world）。`state-init`
从 `options.rngSeed`（无则 `Date.now`+单调计数，避免扰动 mock）播种 `state.rngState`。**种子传播天然成立**：host 开局
`getState()`（含 `rngState`）经 START_GAME 广播，客户端 `applyStateUpdate` 整态采纳 → 两端同种子起步、move 重放同步。
回归 `multiplayer-determinism.test.js`（同 move 同 state 必同 / rngState 推进 / 异种子异骰）。全 HIS 2630 绿、build 绿。

**✅ 引擎级双客户端 lockstep 模拟（2026-06-21）**：`multiplayer-determinism.test.js` 新增「two-client lockstep」——
两个 `HISGame` 实例**以不同起始种子**启动，皆 `applyStateUpdate(host 广播态)`，再把一步掷骰 move **只发 action**
（actionType+actionData，无骰，即 `sendGameAction` 上线格式）转发给远端重放；host 本地执行后两端**整态逐字段相等**
（单位/eventLog 骰值/rngState/VP），覆盖 野战/突击/海战。仅 eventLog `timestamp`（Date.now 元数据）剥离后比对。

**✅ LAN 真机三客户端 live 验（2026-06-21）**：起本地 WS 后端（7777）+ 3 个浏览器标签（各自 `sessionStorage` →
**独立 playerId**）。建房（host）+ 两端加入 → **房间双向同步**（三端互见）；host 开局 → 三端齐入 GameBoard。
**关键集成证据**：三端 `state.rngState` **完全一致**（`3912184817`）、`powerByPlayer`/单位指纹逐字段相同 → host 播种态
经广播正确传播。**引擎确定性（已证）+ 同种子起步（live 证）= lockstep 成立**。
**❌ 先前报的 2 个「联机 setup 缺口」均撤回（verify-before-implement：经核实皆非 bug）**：
①**`roomSupportsAI=false` 系刻意设计**——HIS `config.json` 明列 `onlineSupportsAI: false`（单机可 vs AI，联机刻意禁 AI）；
联机 HIS 为纯人类对局，3 人即经 `DEFAULT_POWER_ASSIGNMENTS[3]` 分组覆盖全部 6 势力（`[['ottoman'],['hapsburg','england'],
['france','papacy','protestant']]`），无需 AI 填充。②**「卡在 luther_95」系误判**——protestant 由玩家3（控
france/papacy/protestant 组）掌控，其行动面板**正常显示「选择目标空间」**；游戏只是在**正确等待玩家3 输入**，
我误当无 bot 而空等。**驱动玩家3 的人类 move 后立证 lockstep**：玩家3 作为 protestant 在 Brandenburg 发起改革
（掷骰，`rngState 3912184817 → -1078559346`、改革成功），host 经 WS 转发**重放得完全相同 rngState/结果**
（Brandenburg→protestant）。⇒ **一次掷骰人类 move 跨真机 WS 同步、RNG 结果一致**——这正是先前以为被「卡死」挡住的
live 战斗同步证据。**联机 HIS（3 人真机）端到端可玩且 lockstep 已 live 证实。**
**✅ 中途重连 live 验（2026-06-21）**：把对局推进数步（玩家3 连发 3 次 luther_95 改革，`rngState` 经
`3915270483→…→-571520404`、三端同步），然后对玩家2 标签**断开 WS**（`net.ws.close()`，非 manual disconnect）→
**自动重连成功**（`readyState=1`、回到 GameBoard），**`rngState` 重连后仍 `-571520404` 不变**、eventLog 保真。
配合代码核实——重连快照走 `getVisibleState`（仅遮蔽他方手牌/牌库计数，**`rngState` 顶层字段原样保留**）、经
`applyStateUpdate` 整态替换 → **重连后客户端 rngState 与他端一致、lockstep 不破**（这正是 RNG 修复对重连的关键要求）。
**⚠️ 顺带发现（与 RNG 无关，UX 观察）**：**整页刷新 (reload) 不会自动重连**——刷新后落回大厅（`playerId` 经
`sessionStorage` 保留但对局会话未持久化/未自动恢复）。重连特性仅对**活实例的瞬时 WS 断连**生效，非页面刷新。
若要「刷新可续局」需额外持久化对局会话，属独立 UX 功能、非 bug。
**✅ 已实现「刷新可续局」（2026-06-23，local 模式）**：复用既有重连机制——无需重写。三处接线：
①`GAME_STARTED` 给重连上下文打 `gameStarted:true` 标记（`_saveReconnectContext` 改为**跨中途多次再存保留**该标记，
仅开局/终局显式改写，避免 `PLAYER_JOINED` 等顺带再存把它抹掉）；②游戏结束 (`_showGameResult`) 置 `gameStarted:false`；
③启动 (`_init`) 在 `showLobby()` 后调 `_resumeSessionIfAvailable()`——若存在「进行中、playerId 匹配、local 且
有 serverUrl+sessionId」的上下文，弹确认框→`_retryReconnectFromContext(ctx)`（既有路径：重建 network+room→
requestReconnect→host 发 `GAME_SNAPSHOT`→`_handleGameSnapshot` 整态恢复，`rngState` 随快照保留→lockstep 不破）；
拒绝则清上下文留在大厅。`_startGame` 本就懒加载游戏 bundle，故刷新后 HIS bundle 未加载也能恢复。
`app.integration.test.js` +10（标记/保留/各 reject 门/接受重连/拒绝清理）。**cloud 模式暂缓**（auth 异步恢复 playerId，
启动时上下文未必匹配，`_resumableContext` 显式跳过 cloud——属后续）。**host 自身刷新仍受既有限制**（无他端供快照），
与瞬时 WS 断连同源，非本功能引入。
**仍待（可选）**：断连期间他端推进后重连「补齐」（本次因对局停在掉线方 protestant 而未驱动，但快照=host 当前态
天然补齐，机制已证）；Cloud（Supabase）路径（需凭据）；联机 AI 对手（新功能，翻 `onlineSupportsAI` + 验 host 跑 bot 广播）。

- LAN（WebSocket）+ Cloud（Supabase）下 `GAME_ACTION` 的双客户端同步、中途重连。
- 大体量 HIS 状态的同步正确性（大厅/网络测试为通用，未针对 HIS 验证）。

**🟥 阻断发现（2026-06-21，verify-before-implement）**：当前同步模型是 **lockstep 重放**——远端收到
`GAME_STATE_UPDATE.lastAction` 后用 `executeMove(action)` **在本地重新执行该 move**（`app-online-room-methods.js:570`）。
但 **HIS 战斗/宗教/辩论掷骰用裸 `Math.random()`**（`religious-actions.rollDice`、`combat-actions`/`debate-actions`
及 ~31 处内联掷骰；仅**牌库** RNG 经 `state/rng.js` 播种，**战斗骰未播种**），且 `resolveFieldBattle` **不从
`actionData` 读骰**（无条件 `rollDice()`），转发的 action 也**不带骰值**（`sendGameAction` 发原始 `actionData`，
`processMove` 只克隆 state 不回写骰值）。**实测确证**：同一 `RESOLVE_BATTLE` 对同一 state 跑 3 次得 3 种结果
（攻骰 `[2,2,5,5,3]` / `[6,6,6,6,6]` / `[4,1,1,6,4]`，`identical=false`）。⇒ **两客户端在首个掷骰 move 即状态分叉、不可逆 desync**
（野战/突击/海战/改革/辩论/conclave/多张事件卡全中招）。这正是 C8「大体量 HIS 状态同步正确性」未验区的根因。

**修复方案（架构级，需单独排期 + 决策，勿擅自大改）**：

- **A（推荐）状态内播种 RNG**：把骰子 RNG 并入 `state`（仿现有牌库 `rng.js` 的 mulberry32），所有引擎掷骰改走该
  state-rng（每次掷骰推进 rng 状态）→ 同 state 重放同 move 必得同骰，rng 状态随 state 同步则两端永不分叉。
  顺带让全引擎 deterministic-on-replay（测试无需再覆写 `Math.random`）。改动 ~31 掷骰点，集中但量大。
- **B 把骰值写入转发 action**：host 掷骰后将骰值写回 `actionData`，各 resolver 改「`actionData.dieN ?? roll`」优先
  （部分事件卡已是此式，野战/突击/海战未做），转发携骰。点多、易漏。
- **C host 权威态同步**：host 执行掷骰 move 后广播**结果 state**（非 move），客户端整态替换。改变中继模型、带宽大（HIS 态大）。

### ✅ 6. 移动端响应式与性能

- ✅ **每动作整图重渲染性能已优化**（2026-06-23，`perf(his): diff-based map updates`）：旧 `MapOverlay.update`
  **每动作拆毁并重建全部单位栈**（1517 态 ~45 占用空间 → **~181 个 SVG 节点**），`MapRenderer._updateIndicators`
  亦 `innerHTML=''` + 全 134 空间重扫。改为**按空间签名 diff**：`MapOverlay` 缓存每空间的栈节点 + units 签名，仅重建
  签名变化的空间、保留未变节点、清空空间移除栈（`_renderUnitStack`→`_buildUnitStack` 返回节点由调用方插入/缓存）；
  `_updateIndicators` 同款（缓存 siege/unrest 签名，抽 `_buildIndicator`）。微基准（fake-DOM，真浏览器增益更大）：
  无变更更新 181→**0** 节点、单空间变更 181→**3**。输出与全重建一致。`map-render-diff.test.js` +10 钉死正确性 +
  diff 保证（无变更=0 创建且节点身份保持；单变更只重建该空间；空/清除移除）。
- ✅ **移动端响应式布局已实现**（2026-06-23，`feat(his): responsive layout`）：`HisUI._ensureResponsiveStyles()` 一次性
  注入 `<style id="his-responsive-styles">`，把布局关键尺寸（map flex/min/max-height、sidebar min/max-width、game-ui
  overflow）从内联移到类规则（`his-game-ui`/`his-main-area`/`his-map-container`/`his-sidebar`），使 `@media (max-width:820px)`
  可覆写：窄屏 `his-main-area` 翻为 `flex-direction:column`（地图在上、侧栏满宽在下）、地图 `max-height:52vh`、侧栏
  `width:100%;max-height:42vh`、`his-game-ui` 改 `overflow-y:auto` 整体可滚。**Live 验收（Playwright resize）**：
  桌面 1440×900 = row（map 680 + sidebar 220 并排、`max-height:70vh` 不变）；移动 390×844 = column
  （`flexDirection:column`、侧栏在地图下方满宽、`overflow-y:auto`、地图 240px/52vh）。build 绿。

### 🟢 7. 外交牌库子系统（diplomacy-deck subsystem）

> 由 P1「整卡 no-op 审计」升级而来（2026-06-20）。

**⚠️ 关键核实（2026-06-21，verify-before-implement）**：外交牌库是 HIS **两人局专属**组件——入侵模拟卡
（French/Spanish/Ottoman Invasion 等）模拟的是**未被玩家操控的列强**，仅在两人局（教廷阵营 vs 新教阵营）成立。
本项目只实现 **3–6 人局**（`config.json` minPlayers:3、`DEFAULT_POWER_ASSIGNMENTS` 仅 3–6、RULES/SEQUENCE 无外交牌库），
且项目自身已显式延后两人局（`SCENARIO_1517_SETUP.md:160`「Extract if/when 2-player variant is implemented」）。
故 **#201-219 在 3–6 人局根本不可达**，「忠实实现」= 建整个两人局变体。按用户选定的 **"subsystem unit only"** 范围，
本次只建**自洽子系统**（不接入 3–6 人回合流程）。

**✅ 已建（2026-06-21，子系统单元）**：新增 `state/diplomacy-deck.js`——

- **数据子系统**：`diplomacyDeck`（洗好的基础牌 201-212）、`diplomacyHands{papacy,protestant}`、`diplomacyDiscard`、
  `diplomacyPlayedThisTurn`、`diplomacyForcedPlay`；`initDiplomacyDeck`/`ensureDiplomacyDeck`/`isDiplomacyDeckActive`。
- **发牌/打牌/弃牌/互换/重洗**：`drawDiplomacyCard`（牌库空自动回洗弃牌堆）、`playDiplomacyCard`（→playedThisTurn，
  消费 forcedPlay 约束）、`discardDiplomacyCard`、`swapDiplomacyCards`、`reshuffleDiplomacyDeck`（可选 includePlayed）、
  `endDiplomacyTurn`（playedThisTurn→discard）、`removeFromDiplomacyPiles`。
- **SL 卡加入**：`addSchmalkaldicDiplomacyCards`（施马尔卡尔登同盟成立时把 213-219 洗入；幂等、去重、子系统未激活时 no-op）。
- **#205 Diplomatic Pressure 真机制**：教廷→指定新教本回合必打哪张（`diplomacyForcedPlay`）；新教→强制对手弃牌+补抽 / 互换一张。
- **#215 Machiavelli 真机制**：落后 VP 方（平局→打牌方，`trailingDiplomacySide`）从牌库/弃牌堆选一张**入侵卡**（非本回合已打）
  打出其事件 → 把 Machiavelli(215)+该入侵卡+弃牌堆全部洗回牌库。
- **死代码清理**：`event-actions.js` 的 `#13` 把 `if (state.diplomacyDeck){push 213-219}` 死桩改为
  `addSchmalkaldicDiplomacyCards(state)`（3–6 人局因子系统未激活而正确 no-op，全-bot 终局测仍绿）。
- **测试**：`state/diplomacy-deck.test.js` +26（牌池/init/SL 加入/发打弃换/重洗/回合清理/trailing-VP），
  `event-actions-diplomacy.test.js` 的 #205/#215 改为断言真机制（原仅断言占位 `pending*`）。HIS 全套 2662 绿、build 绿。

**仍待（=两人局变体本身，单独大排期）**：把子系统接入两人局回合流程（外交段发牌：每方抽 1、T2+ 各打 1，见
`his_ref/img/_vmod_docs/sequence_twoplayer.html`）、两人阵营分组、打外交卡的 UI 流程 + bot 决策、联机隐藏手牌遮蔽
（`getVisibleState`）。子系统已就绪，待两人局 setup 调 `initDiplomacyDeck` 即可消费。

---

## 执行约定

- 优先 P1：用 `forceHands` 在 node/确定性层走通，能下沉为 `ui-gating` 纯函数契约的就下沉并加穷举用例；仅集成相关才上 Playwright。
- 每完成一项：回填本表状态，并在对应 `bot_anomalies/` 或 test 文档记录发现与修复。
- 发现的任何 UI bug 优先复现为 node 层断言（见 2026-06-15 两个 UI bug 的处理方式）。
