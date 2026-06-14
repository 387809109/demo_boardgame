# 全 Bot 9 回合测试 — 事件结算正确性专项验证 — 2026-06-14

> 测试日期: 2026-06-14
> 测试形式: Playwright MCP 全 Bot 引擎回归（`window.app._startHisGame(null, { dominationVictoryEnabled: false })`），默认 `r = 0` 确定性模式
> 牌堆洗牌为**每局随机**（`Math.random`，非种子化），故每局为独立对局，非重放
> 前提: 基于 #P/#Q 修复完成的代码（最新 commit `a6f105d`，2477 HIS 单测通过）
> 重点: 验证先前所有 `✅ 已修复` 异常不回归，并核查每条 `PLAY_CARD_EVENT` 被引擎正确结算

---

## Step 0 验证结论 — 先前异常基线全部保持

本次 2 局（修复前 1 局 + 修复后 1 局）观察，先前修复均未回归。修复前局出现的 8 次
`[BOT STUCK]` 全部为**新异常**（#R/#S/#T/#U），无一命中先前签名：

| 编号 | 异常 | 修复 commit | 2026-06-14 观察 | 状态 |
|---|---|---|---|---|
| #F/#G | France/Hapsburg 摆渡 | `a4c5a0e` | 0 次双向摆渡热路径 | ✅ 已验证 |
| #H | ASSAULT LOC 缺失栈卡 | `a4c5a0e` | **0** × `*** ASSAULT *** No line of communication` | ✅ 已验证 |
| #J | T9 SUE_FOR_PEACE 拒绝 | `a4c5a0e` | **0** × `*** SUE_FOR_PEACE *** final turn` | ✅ 已验证 |
| #K | Ottoman Buda↔Pressburg 摆渡 | `6eb4bca` 前 | **0** 次双向 siege 摆渡 | ✅ 已验证 |
| #L | Protestant 无效 RESOLVE_REFORMATION / CALL_DEBATE | `6eb4bca` | **0** × `No attempts remaining` / `Defender has no available debaters` | ✅ 已验证 |
| #M | France `PLAY_CARD_EVENT 95` 缺 source space | `118ed19` | **0** × `*** PLAY_CARD_EVENT 95 *** Must specify source space` | ✅ 已验证 |
| #N | Protestant `PLAY_CARD_EVENT 100` Not playable | `118ed19` | **0** × `*** PLAY_CARD_EVENT 100 *** Not playable by Protestant` | ✅ 已验证 |
| #O | 秋季自动突击 LOC 缺失 | `9b9928e` | **0** × `*** ASSAULT free=true *** No LOC` | ✅ 已验证 |
| #P | 卡 65/85 Luther 已献身门控 | `a6f105d` | **0** × `*** PLAY_CARD_EVENT 65/85 *** Luther is committed` | ✅ 已验证 |
| #Q | 卡 13 Schmalkaldic League 强制前置 | `a6f105d` | **0** × `*** PLAY_CARD_EVENT 13 *** Must be Turn 2 or later` | ✅ 已验证 |
| — | Inquisition 空 burn | `b7b48c7` | 抽到但 score < cs 时路由 CP，无空 burn | ✅ 已验证 |
| — | Phase G 评分化 / Phase H 随机化 | `6cfa6c0` / `7195a1b` | events 全走 score 路径，r=0 default | ✅ 已验证 |

---

## 本次基线指标（2 局独立对局）

| 指标 | Run 1（修复前） | Run 2（#R/#S/#U 修复后） |
|---|---|---|
| 结束回合 | T9 | T9 |
| 结束原因 | `time_limit`（France 20 VP） | `time_limit`（France） |
| 总行动数 | 1298 | 1257 |
| 总事件播放 | 78 | — |
| 总 CP 出牌 | 177 | — |
| `[BOT CHAIN BROKEN]` | 0 | 0 |
| `[BOT STUCK]` | 8（#R×1 / #S×4 / #T×2 / #U×1） | **0** |
| 耗时 | ~81s | ~79s |

> Run 1 终局排名：france 20 / england 12 / protestant 12 / hapsburg 10 / ottoman 8 / papacy 8。
> Run 2 为 #R/#S/#U 修复后的干净验证局，**0 [BOT STUCK]**。#T 本局未复现（随机牌堆，属间歇性，未修复，详见下）。
> 行动分布（Run 1）：PASS 355 / PLAY_CARD_CP 177 / MOVE_FORMATION 131 / RESOLVE_REFORMATION_ATTEMPT 117 / NAVAL_MOVE 104 / PLAY_CARD_EVENT 78 …

---

## 新发现异常

四处均属 **bot 路由 vs 引擎验证不对齐** 类（与 #M/#N/#O/#P/#Q 同源）：bot 把动作路由到引擎会
拒绝的形态 → 记 `[BOT STUCK]`，随后 fallback 链救场。#R/#S/#U 已按既定模式（镜像引擎前置）修复；
#T 根因在更深的手牌不同步层，按 TEST_REQUIREMENTS Step 3「行为偏差仅记录」留作跟进。

### #R 卡 84/89 忽略 piracyEnabled 门控（低优先级）— ✅ 已修复

**现象**：

- 1× `[BOT STUCK] ottoman PLAY_CARD_EVENT {"cardNumber":89} → Barbary Pirates must be played first`
- 卡 89 *Pirate Haven* 与卡 84 *Julia Gonzaga* 的引擎 `validate` 均要求 `state.piracyEnabled`（须先打出 Barbary Pirates 启用海盗），见 `event-actions-extended.js#847`（89）与 `#722`（84）

**推测**：

- 卡 89 bot `score` 恒为 `p === 'ottoman' ? 1.0`，未检查 `piracyEnabled`
- 卡 84 bot `score` 仅检查 ottoman + corsairs ≥ 2，同样缺 `piracyEnabled`（corsairs 可在海盗启用前为 0，但 score 路径仍可能触发）
- 海盗未启用时 bot 仍路由 event → 引擎拒绝 → `[BOT STUCK]`

**复现/分析方式**：

1. `state.piracyEnabled = false`，调用 `shouldPlayEvent(state, 'ottoman', 89)` 观察是否仍返回 true
2. 对照引擎 `EXTENDED_EVENT_HANDLERS[89].validate` / `[84].validate` 的 `!state.piracyEnabled` 短路

**相关代码位置**：

- [frontend/src/games/his/ai/bot-event-criteria.js:626-639](../../../../frontend/src/games/his/ai/bot-event-criteria.js#L626-L639) — 卡 84 `shouldPlay`/`score` 加 `piracyEnabled`
- [frontend/src/games/his/ai/bot-event-criteria.js:694-700](../../../../frontend/src/games/his/ai/bot-event-criteria.js#L694-L700) — 卡 89 同上
- [frontend/src/games/his/actions/event-actions-extended.js:847-855](../../../../frontend/src/games/his/actions/event-actions-extended.js#L847-L855) — 卡 89 `validate`

**修复**：卡 84/89 的 `shouldPlay`+`score` 均加 `!!s.piracyEnabled` 前置。`piracyEnabled` 假时返回 false/0 → 走 CP 路径。

**验证**：Run 2 `*** PLAY_CARD_EVENT 89 *** Barbary Pirates must be played first` **0 次**。新增卡 89 piracy-gate 单测 + 卡 84 双态断言。

**状态**：✅ 已修复

### #S 卡 4 France 主页卡在 Francis I 被俘时仍打出（低优先级）— ✅ 已修复

**现象**：

- 4× `[BOT STUCK] france PLAY_CARD_EVENT {"cardNumber":4,"homeEffect":"chateau_roll","modifier":2} → Francis I is captured`
- 卡 4 *Patron of the Arts*（Chateaux Table roll）引擎 `validate` 要求 `rulers.france === 'francis_i'` 且 Francis I 不在 `capturedLeaders`（`event-actions.js#125-129`）

**推测**：

- `evaluateFranceHome` 仅检查 `ruler?.id !== 'francis_i'`（被俘时 ruler id 仍为 francis_i），未检查是否被俘
- Francis I 被俘期间 bot 每个 impulse 重复路由卡 4 → 引擎拒绝 → 4× `[BOT STUCK]`（同一被俘窗口内反复触发）

**复现/分析方式**：

1. `state.rulers.france = { id: 'francis_i' }`、`state.capturedLeaders = { hapsburg: ['francis_i'] }`，调用 `evaluateHomeCard(state, 'france')` 观察是否仍返回 chateau_roll
2. 对照引擎 `EVENT_HANDLERS[4].validate` 的 capturedLeaders 短路

**相关代码位置**：

- [frontend/src/games/his/ai/bot-card-play.js:329-335](../../../../frontend/src/games/his/ai/bot-card-play.js#L329-L335) — `evaluateFranceHome` 加 `isLeaderCaptured(state, 'francis_i')` 短路
- [frontend/src/games/his/ai/bot-card-play.js:319-324](../../../../frontend/src/games/his/ai/bot-card-play.js#L319-L324) — 复用既有 `isLeaderCaptured` 助手
- [frontend/src/games/his/actions/event-actions.js:125-129](../../../../frontend/src/games/his/actions/event-actions.js#L125-L129) — 卡 4 `validate`

**修复**：`evaluateFranceHome` 在 ruler 检查后追加 `if (isLeaderCaptured(state, 'francis_i')) return null;`，被俘时不路由主页卡 → 走 CP 路径。

**验证**：Run 2 `*** PLAY_CARD_EVENT 4 *** Francis I is captured` **0 次**。新增 France-captured 单测。

**状态**：✅ 已修复

### #U EXPLORE 误判可用探险家（低优先级）— ✅ 已修复

**现象**：

- 1× `[BOT STUCK] france EXPLORE {"explorer":"verrazano"} → No available explorers`
- 引擎 `validateExplore`（`new-world-actions.js#39-42`）以 `getAvailableExplorers(state, power).length === 0` 判定，bot 却认为仍有可用探险家

**根因**：

- bot 旧 `executeExplore`（bot-goals.js）自建过滤：`usedExplorers = [...placedExplorers(对象数组), ...deadExplorers(字符串数组)]` 后 `getExplorersForPower(power).filter(e => !usedExplorers.includes(e))`
- 两处不一致：①`placedExplorers` 是 `{explorerId}` 对象数组，引擎用 `.map(e => e.explorerId)`，bot 用 `.includes(字符串)` 永不匹配 → 已放置探险家从不被排除；②`getExplorersForPower` 的硬编码 id（`cabot`/`verrazano`…）与引擎 `EXPLORERS` 的真实 id（`cabot_eng`/`chancellor`/`rut`/`willoughby`…）不符且数量过时
- 结果：bot 高估可用数 → 路由 EXPLORE → 引擎判 0 可用 → `[BOT STUCK]`（引擎 `executeExplore` 仅以 `{power}` 入 underway，忽略 explorer id，故 id 不符不致命，但可用数误判致命）

**复现/分析方式**：

1. `state.newWorld.deadExplorers = ['cabot_eng','chancellor','rut','willoughby']`，调用 `executeExplore(state,'england',5)` 应返回 null
2. 对照引擎 `getAvailableExplorers` 的 `deadExplorers + placedExplorers.map(e=>e.explorerId)` 集合

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `executeExplore` 改为直接复用引擎 `getAvailableExplorers`；删除过时的 `getExplorersForPower`
- [frontend/src/games/his/actions/new-world-actions.js:154-161](../../../../frontend/src/games/his/actions/new-world-actions.js#L154-L161) — `getAvailableExplorers`（单一事实源）

**修复**：`bot-goals.js` 引入并复用引擎 `getAvailableExplorers(state, power)`，`actionData.explorer` 取 `available[0].id`；移除 bot 自建的 `getExplorersForPower` 重复实现（DRY，杜绝 id/数据漂移）。同步更新 4 个受影响 explore 单测为引擎数据模型。

**验证**：Run 2 `*** EXPLORE *** No available explorers` **0 次**。

**状态**：✅ 已修复

### #T England 卡 3 主页卡 marital "Card not in hand"（低优先级）— ⏳ 仅记录（待修复）

**现象**：

- 1× `[BOT STUCK] england PLAY_CARD_EVENT {"cardNumber":3,"mode":"marital"} → Card not in hand`
- 紧随 1× `[BOT STUCK] CP fallback failed: Card not in hand`（event→CP fallback 同样因卡 3 不在手牌而失败）

**根因（埋点复现已坐实）**：

加临时 `[#T-PROBE]` 日志跑全-Bot 复现，T7 捕获 Ottoman 同型异常：

```text
[#T-PROBE] ottoman turn:7 phantom:1 act:PLAY_CARD_EVENT {cardNumber:1,mode:recruit}
  homeCardPlayed:{ottoman:true,...} hand:[7] setAside:[24,33]
```

- **卡 7 = "Here I Stand"，`deck:'home'`（cp 5）——是发给玩家的通用主牌堆卡，并非某势力的"主页卡"**。`classifyCard(7)` 因 `deck==='home'` 返回 `'home'`
- 生产路径：`decideCardPlay` 取 `hand[0]=7` → `classifyCard='home'` → `routeHomeCard(state, power, 7)` → `evaluateHomeCard` → `evaluateOttomanHome` **硬编码返回 `HOME_CARDS.ottoman = 1`（Janissaries）**
- 但该势力自己的主页卡（卡 1 / England 卡 3）本回合已打出（`homeCardPlayed[power]=true` → 已从手牌 splice），不在手牌中 → 引擎 `validate` 判 "Card not in hand"
- 即 `routeHomeCard` 混淆了"被选中的 home-deck 卡（7 Here I Stand）"与"势力主页卡（1/3）"：选中 7，却尝试打 1/3
- `game.getState()` 实为实时引用（`return this.state`，无克隆），与早先"快照陈旧"猜测不符——真正问题是 `evaluateHomeCard` 无条件按 `HOME_CARDS[power]` 出牌，无视该卡是否在手

**相关代码位置**：

- [frontend/src/games/his/ai/bot-card-play.js:674-704](../../../../frontend/src/games/his/ai/bot-card-play.js#L674-L704) — `routeHomeCard` 加 `HOME_CARDS[power]` 在手判定
- [frontend/src/games/his/ai/bot-card-play.js:171-196](../../../../frontend/src/games/his/ai/bot-card-play.js#L171-L196) — `evaluateHomeCard`（按 `HOME_CARDS[power]` 出牌）
- [frontend/src/games/his/ai/bot-controller.js:683-702](../../../../frontend/src/games/his/ai/bot-controller.js#L683-L702) — 兜底消噪分支（quiet re-decide）
- [frontend/src/games/his/index.js:596-597](../../../../frontend/src/games/his/index.js#L596-L597) — 引擎 `PLAY_CARD_*` 的 `Card not in hand` 判定

**修复（双层）**：

1. **根因（producer）**：`routeHomeCard` 仅当 `HOME_CARDS[power]` 确在 `state.hands[power]` 时才调用 `evaluateHomeCard` 出主页卡效果；否则把**实际被选中的卡**（`cardNumber=hand[0]`，必在手）当 CP 打出。这是单一事实源的正确镜像，且非死代码（routeHomeCard 对任意 home-deck 卡如 #7 都会进入）
2. **兜底消噪（controller）**：`error==='Card not in hand'` 时先 quiet re-decide（清理 botSetAside 中幻影卡后重决策一次），成功即静默恢复；失败才落入标准 fallback。作为任何残余 desync 的安全网

**验证**：修复后跑 **5 局**独立对局，`Card not in hand` **0 次**、`[BOT CHAIN BROKEN]` **0 次**（详见数据归档）。新增 #T producer 回归单测（ottoman 持 #7、#1 已打 → 打 #7 作 CP，不出幻影 #1 事件）。

**严重性**：低。fallback 本可救场，但属噪声且暴露 producer 缺陷，已根治。

**状态**：✅ 已修复

---

## #T 验证衍生发现（同 eligibility-mirror 类）— ✅ 已一并修复

修复 #T 后跑 5 局验证，`Card not in hand` 0 次确认根治；期间新出现 3 处同类
（bot 路由 vs 引擎前置不对齐）异常，均 fallback 救场、0 chain broken。三者已一并修复：

### #V 卡 59 忽略"英格兰本回合换君"前置 — ✅ 已修复

- 现象：`[BOT STUCK] protestant PLAY_CARD_EVENT {"cardNumber":59} → England has not changed rulers this turn`
- 引擎：`EXTENDED_EVENT_HANDLERS[59].validate` 要求 `state.englandRulerChangedThisTurn`（[event-actions-extended.js:128](../../../../frontend/src/games/his/actions/event-actions-extended.js#L128)）
- 根因：卡 59 (Lady Jane Grey) bot `score`/`shouldPlay` 仅查 papacy/protestant，未镜像 `englandRulerChangedThisTurn`
- 修复：[bot-event-criteria.js 卡 59](../../../../frontend/src/games/his/ai/bot-event-criteria.js) `shouldPlay`+`score` 加 `!!s.englandRulerChangedThisTurn` 前置

### #W DECLARE_WAR 忽略"本回合已与其媾和" — ✅ 已修复

- 现象：`[BOT STUCK] hapsburg DECLARE_WAR {"target":"france"} → Cannot declare war on a power you made peace with this turn`
- 引擎：`validateDeclareWar` 查 `hasDiploPair(state.peaceMadeThisTurn, power, target)`（[diplomacy-actions.js:137](../../../../frontend/src/games/his/actions/diplomacy-actions.js#L137)）
- 根因：`decideWarDeclaration`（bot-phases.js）按行为牌 war 字段选目标，未排除 `peaceMadeThisTurn` 对子
- 修复：导出引擎 `hasDiploPair`，[decideWarDeclaration](../../../../frontend/src/games/his/ai/bot-phases.js) 在"已开战"检查后追加 `peaceMadeThisTurn` 对子检查（DRY 复用引擎判定）

### #X 卡 3 marital 婚姻状态已满仍推进 — ✅ 已修复

- 现象：`[BOT STUCK] england PLAY_CARD_EVENT {"cardNumber":3,"mode":"marital"} → Cannot advance marital status further`
- 引擎：marital idx 已达 `MARITAL_STATUS.length-1` 时拒绝（[event-actions.js:374](../../../../frontend/src/games/his/actions/event-actions.js#L374)）
- 根因：`evaluateEnglandHome` 仅查 Henry 存活+未被俘，未查婚姻状态是否还能推进
- 修复：[evaluateEnglandHome](../../../../frontend/src/games/his/ai/bot-card-play.js) marital 分支加 `canAdvanceMarital`（未设置时按初始状态 idx 0，仅终态阻断；与 #S/#T 同属 England/France 主页卡前置补全）

---

## 整体修复状态

| 编号 | 处置 | 核心改动 |
|---|---|---|
| #R | ✅ 已修复 | 卡 84/89 `shouldPlay`+`score` 加 `piracyEnabled` 门控 |
| #S | ✅ 已修复 | `evaluateFranceHome` 加 `isLeaderCaptured('francis_i')` 短路 |
| #U | ✅ 已修复 | `executeExplore` 复用引擎 `getAvailableExplorers`，删除过时 `getExplorersForPower` |
| #T | ✅ 已修复 | `routeHomeCard` 加 `HOME_CARDS[power]` 在手判定（根因：#7 "Here I Stand" home-deck 卡触发主页路由）+ controller 兜底 quiet re-decide |
| #V | ✅ 已修复 | 卡 59 `shouldPlay`+`score` 加 `englandRulerChangedThisTurn` 前置 |
| #W | ✅ 已修复 | `decideWarDeclaration` 加 `peaceMadeThisTurn` 对子检查（复用导出的引擎 `hasDiploPair`） |
| #X | ✅ 已修复 | `evaluateEnglandHome` marital 加 `canAdvanceMarital` 前置 |

**最终状态**：本轮 7 处异常（#R/#S/#T/#U/#V/#W/#X）全部 ✅ 已修复，均为 bot 路由 vs 引擎前置不对齐类（低风险单点镜像）。

---

## 数据归档

- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1
- setTimeout 加速：300–2000 ms 压到 40 ms（~40min 对局压到 ~80s）
- 牌堆洗牌每局随机（非种子化），各局为独立对局
- **Run 1（#R/#S/#U/#T 修复前）**: T9 `time_limit`（France 20 VP），1298 actions，78 events，8 stuck（#R×1/#S×4/#T×2/#U×1）
- **Run 2（#R/#S/#U 修复后、#T 修复前）**: T9 `time_limit`（France），1257 actions，**0 stuck**
- **#T 根因复现局**: T7 捕获 `[#T-PROBE]` ottoman 卡 1（#7 "Here I Stand" 触发），坐实根因
- **#T 修复后 5 局验证**: 全部 T9，胜者 england/france/france/hapsburg/france，actions 1326/1239/1304/1248/1273，`Card not in hand` **0**、`[BOT CHAIN BROKEN]` **0**；新出现 #V/#W/#X 各 1 次（同类）
- **#V/#W/#X 修复后 5 局最终验证**: 全部 T9，胜者 france/hapsburg/france/france/france，actions 1308/1284/1271/1256/1230，**`[BOT STUCK]` 0、`[BOT CHAIN BROKEN]` 0**（最干净的一轮，无任何残余异常）
- 修复后单测：**2483 HIS 单测通过**（新增 #R 卡89 / #S France-captured / #T producer / #V 卡59 / #W 媾和 / #X marital 共 6 项，改写 4 项 explore + 1 项卡84 为引擎数据模型）
- 先前修复（#F–#Q、Inquisition、Phase G/H）跨各局均未回归
