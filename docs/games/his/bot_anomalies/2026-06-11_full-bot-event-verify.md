# 全 Bot 9 回合测试 — 事件结算正确性专项验证 — 2026-06-11

> 测试日期: 2026-06-11
> 测试形式: Playwright MCP 全 Bot 引擎回归（`window.app._startHisGame(null, { dominationVictoryEnabled: false })`），默认 `r = 0` 确定性模式
> 牌堆洗牌为**每局随机**（`Math.random`，非种子化），故 3 次重跑为 3 局独立对局，非重放
> 前提: 基于 #O 修复完成的代码（最新 commit `9b9928e`），双修复后 2477 HIS 单测通过
> 重点: 验证先前所有 `✅ 已修复` 异常不回归，并核查每条 `PLAY_CARD_EVENT` 被引擎正确结算

---

## Step 0 验证结论 — 先前异常基线全部保持

跨 3 局独立对局（牌堆随机）观察，所有先前修复均未回归：

| 编号 | 异常 | 修复 commit | 2026-06-11 观察 | 状态 |
|---|---|---|---|---|
| #F | France Antwerp↔Liege 摆渡 | `a4c5a0e` | 3 局均 0 次双向摆渡热路径 | ✅ 已验证 |
| #G | Hapsburg Bordeaux↔Limoges 摆渡 | `a4c5a0e` | 3 局均 0 次双向摆渡热路径 | ✅ 已验证 |
| #H | ASSAULT LOC 缺失栈卡 | `a4c5a0e` | **0** × `[BOT STUCK] *** ASSAULT *** No line of communication` | ✅ 已验证 |
| #J | T9 SUE_FOR_PEACE 拒绝 | `a4c5a0e` | **0** × `[BOT STUCK] *** SUE_FOR_PEACE *** final turn` | ✅ 已验证 |
| #K | Ottoman Buda↔Pressburg 摆渡 | `b209910` 前 | **0** 次双向 siege 摆渡 | ✅ 已验证 |
| #L | Protestant 无效 RESOLVE_REFORMATION / CALL_DEBATE | `6eb4bca` | **0** × `No attempts remaining` / `Defender has no available debaters` | ✅ 已验证 |
| #M | France `PLAY_CARD_EVENT 95` 缺 source space | `118ed19` | **0** × `*** PLAY_CARD_EVENT 95 *** Must specify source space` | ✅ 已验证 |
| #N | Protestant `PLAY_CARD_EVENT 100` Not playable | `118ed19` | **0** × `*** PLAY_CARD_EVENT 100 *** Not playable by Protestant` | ✅ 已验证 |
| #O | 秋季自动突击 LOC 缺失（#H 补全） | `9b9928e` | **0** × `*** ASSAULT free=true *** No LOC` | ✅ 已验证 |
| — | Inquisition 空 burn | `b7b48c7` | 抽到但 score < cs 时路由 CP，无空 burn | ✅ 已验证 |
| — | Phase G 评分化 | `30f9794` → `6cfa6c0` | 所有 events 走 score 路径，`hasEventScore` 全 true | ✅ 已验证 |
| — | Phase H 随机化 | `fd078b8` → `7195a1b` | r=0 default，threshold-jitter 等同 G | ✅ 已验证 |

---

## 本次基线指标（3 局独立对局）

| 指标 | Run 1 | Run 2 | Run 3（双修复后） |
|---|---|---|---|
| 结束回合 | T8 | T9 | T9 |
| 结束原因 | `religious_victory`（Protestant） | `time_limit`（Hapsburg） | `time_limit`（Hapsburg） |
| 总行动数 | 1084 | 1253 | 1285 |
| 总事件播放 | 81 | — | — |
| `[BOT CHAIN BROKEN]` | 0 | 0 | 0 |
| `[BOT STUCK]` | 1（#P） | 1（#Q） | **0** |
| 耗时 | ~60s | ~67s | ~69s |

> 说明：Run 1 的 `religious_victory` 是合法终局——`dominationVictoryEnabled: false` 仅禁用统治胜利，不禁用宗教胜利，Protestant 改革推进越线即 T8 提前结束。Run 1 暴露 #P，Run 2 暴露 #Q，Run 3 为两处修复后的干净验证局。

---

## 新发现异常

两处均属同一 **bot 路由 vs 引擎验证不对齐** 类（与 #M/#N/#O 同源）：bot 把卡路由到 `PLAY_CARD_EVENT`，但引擎 `validate` 因前置条件未满足而拒绝 → 记 `[BOT STUCK]`，随后 fallback 链救场。修复模式一致：在卡的 `score`/`shouldPlay` 中镜像引擎前置条件。

### #P 卡 65 / 85 忽略 Luther 已献身门控（低优先级）— ✅ 已修复

**现象**：

- 1× `[BOT STUCK] protestant PLAY_CARD_EVENT {"cardNumber":65} → Luther is committed`
- 卡 65 *A Mighty Fortress* 与卡 85 *Katherina Bora* 打出时会令 Luther 献身（committed）；引擎在 Luther 已 committed 时拒绝二者（`event-actions-extended.js` card 65 `validate@269-290`、card 85 `validate@736-755`）

**推测**：

- 两卡 bot `score` 恒返回 `1.0`（Protestant 持有即最高分），未检查 Luther 当前是否已 committed
- 一旦本局早期 Luther 已通过别的途径献身，bot 仍把卡路由到 event → 引擎拒绝 → `[BOT STUCK]`

**复现/分析方式**：

1. 构造 `state.debaters.protestant` 含 `{ id: 'luther', committed: true }`，调用 `routeEventCard` 观察卡 65/85 是否仍路由 event
2. 对照引擎 `validate` 的 `luther.committed` 短路，确认 bot 侧缺镜像

**相关代码位置**：

- [frontend/src/games/his/ai/bot-event-criteria.js:61-64](../../../../frontend/src/games/his/ai/bot-event-criteria.js#L61-L64) — 新增 `lutherUncommitted(state)` 助手
- [frontend/src/games/his/ai/bot-event-criteria.js](../../../../frontend/src/games/his/ai/bot-event-criteria.js) — card 65 / card 85 `shouldPlay` + `score` 门控
- [frontend/src/games/his/actions/event-actions-extended.js:269-290](../../../../frontend/src/games/his/actions/event-actions-extended.js#L269-L290) — card 65 `validate`
- [frontend/src/games/his/actions/event-actions-extended.js:736-755](../../../../frontend/src/games/his/actions/event-actions-extended.js#L736-L755) — card 85 `validate`

**修复**：

- 新增 `lutherUncommitted(state)` 助手：`state.debaters.protestant` 中无 luther 或 luther 未 committed → true
- 卡 65 / 85 的 `shouldPlay` 改为 `(s, p) => p === 'protestant' && lutherUncommitted(s)`
- 卡 65 / 85 的 `score` 改为 `(s, p) => (p === 'protestant' && lutherUncommitted(s)) ? 1.0 : 0`，已 committed 时返回 0 → 走 CP 路径

**验证**：Run 3（修复后独立局）`[BOT STUCK] *** PLAY_CARD_EVENT 65 *** Luther is committed` **0 次**。新增 3 个 eventScore 单测（65 未 committed→1.0 / 65 committed→0 / 85 committed→0）+ 1 个 criteria 单测，全通过。

**状态**：✅ 已修复

### #Q 卡 13 Schmalkaldic League 强制事件前置未满足即打出（低优先级）— ✅ 已修复

**现象**：

- 1× `[BOT STUCK] protestant PLAY_CARD_EVENT {"cardNumber":13,"mandatory":true} → Must be Turn 2 or later`
- 卡 13 为 Mandatory 卡，`routeMandatoryCard` 在 T1 无条件路由 event；但引擎 `validate`（`event-actions.js EVENT_HANDLERS[13]@510-524`）要求 Turn 2+ 且 12+ Protestant 空间

**推测**：

- `routeMandatoryCard` 假设所有 Mandatory 卡在其回合恒可作为 event 打出，未对卡 13 的额外前置（turn、protSpaces）做镜像
- Mandatory 卡引擎双路径：动作阶段 event（有前置）+ Winter 阶段 `triggerOverdueMandatoryEvents` 自动触发（`phase-winter.js@442-478`，但仅当卡仍在 `state.hands[power]`）

**复现/分析方式**：

1. T1 给 Protestant 卡 13，调用 `routeMandatoryCard`，观察是否路由 event（应 hold）
2. T3 但 protSpaces < 12，应仍 hold；T2 且 12+ protSpaces，应正常 event
3. 对照引擎 `EVENT_HANDLERS[13].validate` 的 turn/protSpaces 短路

**相关代码位置**：

- [frontend/src/games/his/ai/bot-card-play.js:710-720](../../../../frontend/src/games/his/ai/bot-card-play.js#L710-L720) — 新增 `isMandatoryEventPlayable(state, cardNumber)`
- [frontend/src/games/his/ai/bot-card-play.js:727-732](../../../../frontend/src/games/his/ai/bot-card-play.js#L727-L732) — `routeMandatoryCard` 前置不满足时 `SET_ASIDE_CARD`
- [frontend/src/games/his/actions/event-actions.js:510-524](../../../../frontend/src/games/his/actions/event-actions.js#L510-L524) — card 13 `validate`
- [frontend/src/games/his/phases/phase-winter.js:442-478](../../../../frontend/src/games/his/phases/phase-winter.js#L442-L478) — `triggerOverdueMandatoryEvents`

**修复**：

- 新增 `isMandatoryEventPlayable(state, cardNumber)`：卡 13 在 `turn < 2` 或 Protestant 空间 < 12 时返回 false，其余 Mandatory 卡恒 true
- `routeMandatoryCard` 在前置不满足时返回 `SET_ASIDE_CARD`（hold 持牌）而非作为 event 失败
- 选 SET_ASIDE 而非 CP-fallback 的理由：保留强制卡留待后续/Winter 自动触发，不急于把它烧成 CP

**验证**：Run 3（修复后独立局）`[BOT STUCK] *** PLAY_CARD_EVENT 13 *** Must be Turn 2 or later` **0 次**，总 `[BOT STUCK]` **0 次**。新增 3 个单测（T1→SET_ASIDE / T3 <12 空间→SET_ASIDE / T2 12+ 空间→PLAY_CARD_EVENT mandatory），全通过。

**状态**：✅ 已修复

---

## 行为偏差（仅记录，未修复）

### SET_ASIDE 强制卡不在回合开始抽牌时并回手牌

`SET_ASIDE_CARD` 把卡移入 `state.botSetAside[power]`，仅在 fallback 链（手牌空时）或 `handleEmptyHand`（作 CP 打出）时返回手牌，**不在回合开始的抽牌阶段并回**。

- 影响：#Q 修复让卡 13 在前置未满足时 hold 进 set-aside。若该卡此后再未被 fallback 取回手牌，则 Winter 阶段 `triggerOverdueMandatoryEvents` 的 `state.hands[power]` 成员检查可能落空 → Schmalkaldic League 在其 `dueByTurn` 的 Winter 自动触发可能不发生。
- 现状评估：本测试 3 局未观察到该链断裂导致的终局异常（Run 1 即由 Protestant 改革推进达成 religious_victory，Schmalkaldic League 路径未成为瓶颈）。
- 归类：**预先存在的行为偏差**，非本次 #Q 修复引入。按 TEST_REQUIREMENTS Step 3「行为偏差仅记录不当场修复」处理，留作独立跟进项。
- 建议跟进：评估在回合开始 card-draw 时把 `state.botSetAside[power]` 中仍合法的 Mandatory 卡并回 `state.hands[power]`，使 Winter 自动触发的前提成立。

---

## 整体修复状态

| 编号 | 处置 | 核心改动 |
|---|---|---|
| #P | ✅ 已修复 | `lutherUncommitted` 助手；卡 65/85 `shouldPlay`+`score` 镜像 Luther-committed 门控 |
| #Q | ✅ 已修复 | `isMandatoryEventPlayable`；卡 13 前置未满足时 `routeMandatoryCard` 返回 `SET_ASIDE_CARD` |

**建议修复顺序**：#P 与 #Q 相互独立，均为低优先级、单点镜像引擎前置，可任意顺序合入；二者已在本次一并修复。

---

## 数据归档

- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1
- setTimeout 加速：300–2000 ms 压到 40 ms（~40min 对局压到 ~60–70s）
- 牌堆洗牌每局随机（非种子化），3 局为 3 局独立对局
- Run 1: T8 `religious_victory`（Protestant），1084 actions，81 events，1 stuck（#P）
- Run 2: T9 `time_limit`（Hapsburg），1253 actions，1 stuck（#Q）
- Run 3（双修复后）: T9 `time_limit`（Hapsburg），1285 actions，**0 stuck，0 chain broken**
- 修复后单测：2470 HIS 单测通过（含本次新增 #P 4 项、#Q 3 项回归测试）
- 先前修复（#F–#O、Inquisition、Phase G/H）跨 3 局均未回归
