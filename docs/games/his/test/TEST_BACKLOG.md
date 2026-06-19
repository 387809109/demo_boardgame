# HIS 测试待办（按优先度）

> 记录尚未覆盖的测试缺口，按优先度排列，供后续逐项执行。
> 已覆盖：引擎层（3334 单测 + gate-parity 审查 + full-bot batch 回归）、UI 渲染契约（ui-gating 覆盖测试）。
> 可用工具见 [TEST_REQUIREMENTS_PLAYWRIGHT.md](TEST_REQUIREMENTS_PLAYWRIGHT.md) 「确定性 UI 测试机制」：
> ① ui-gating 覆盖测试（node，纯函数穷举）② `forceHands`+`rngSeed`（确定性发牌/掷骰）③ live Playwright（仅集成）。
> 进度记号：⬜ 未开始 / 🟡 进行中 / ✅ 完成。

---

## P1 — 高优先（复用 `forceHands`，无浏览器依赖）

### 🟡 1. 其余 5 势力的特有 UI 路径

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

### ⬜ 5. HIS 多人联机

- LAN（WebSocket）+ Cloud（Supabase）下 `GAME_ACTION` 的双客户端同步、中途重连。
- 大体量 HIS 状态的同步正确性（大厅/网络测试为通用，未针对 HIS 验证）。

### ⬜ 6. 移动端响应式与性能

- 密集地图（149 空间）+ 多面板在小屏的可用性。
- 每个动作触发的整图重渲染性能。

### ⬜ 7. 外交牌库子系统（diplomacy-deck subsystem）

> 由 P1「整卡 no-op 审计」升级而来（2026-06-20）。当前引擎**完全未建**外交牌库——外交卡（`diplomacy`/
> `diplomacy_sl`）从不发牌、`state.diplomacyDeck`/`diplomacyHand`/`diplomacyDiscard` 从未初始化、`event-actions.js:551`
> 的 `if (state.diplomacyDeck)` 是死代码，故 **#201-219 全部外交事件 handler 在正常对局不可达**。

实现范围（独立大功能，需逐项核实卡面规则）：

- 外交卡牌库 + 各势力外交手牌 + 弃牌堆 + played-this-turn 跟踪 + 回合末重洗（含 Machiavelli/入侵卡回洗规则）。
- 每回合外交段发外交卡的发牌流程（与现有 `phase-diplomacy.js` 五段集成）。
- 解锁并落实依赖手牌的两张 no-op：**#205 Diplomatic Pressure**（查看对手外交手牌 → 强制弃+补抽 / 互换）、
  **#215 Machiavelli**（从外交牌库/弃牌堆选入侵卡打出 → 重洗）。
- 打外交卡的 UI 流程 + bot 决策接入。
- 清理死代码 `if (state.diplomacyDeck)`（要么补 init，要么删该桩）。

---

## 执行约定

- 优先 P1：用 `forceHands` 在 node/确定性层走通，能下沉为 `ui-gating` 纯函数契约的就下沉并加穷举用例；仅集成相关才上 Playwright。
- 每完成一项：回填本表状态，并在对应 `bot_anomalies/` 或 test 文档记录发现与修复。
- 发现的任何 UI bug 优先复现为 node 层断言（见 2026-06-15 两个 UI bug 的处理方式）。
