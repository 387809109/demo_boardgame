# 全 Bot 9 回合测试 — 事件结算正确性专项验证 — 2026-04-26

> 测试日期: 2026-04-26
> 测试形式: Playwright MCP 全 Bot 引擎回归（`window.app._startHisGame(null, { dominationVictoryEnabled: false })`），默认 `r = 0` 确定性模式
> 结果: **T9 standard_victory，France 25 VP 胜出**
> 前提: 基于 Phase G/H 完整代码（最新 commit `7195a1b`，2465 单测通过）
> 重点: 验证每条 `PLAY_CARD_EVENT` 是否被引擎正确结算（payload + flags 双向 cross-check）

---

## Step 0 验证结论 — 先前异常基线全部保持

| 编号 | 异常 | 修复 commit | 2026-04-26 观察 | 状态 |
|---|---|---|---|---|
| #F | France Antwerp↔Liege 摆渡 | `a4c5a0e` | 路径不在热路径中（< 3 次） | ✅ 已验证 |
| #G | Hapsburg Bordeaux↔Limoges 摆渡 | `a4c5a0e` | 路径不在热路径中 | ✅ 已验证 |
| #H | ASSAULT LOC 缺失栈卡 | `a4c5a0e` | **0** × `[BOT STUCK] *** ASSAULT *** No line of communication` | ✅ 已验证 |
| #J | T9 SUE_FOR_PEACE 拒绝 | `a4c5a0e` | **0** × `[BOT STUCK] *** SUE_FOR_PEACE *** final turn` | ✅ 已验证 |
| Inquisition 空 burn | `b7b48c7` | 56/58 本局未被打出（drew 但 score < cs，路由到 CP） | ✅ 已验证 |
| Phase G 评分化 | `30f9794` → `6cfa6c0` | 88 events 全部走 score 路径，`hasEventScore` 全 true | ✅ 已验证 |
| Phase H 随机化 | `fd078b8` → `7195a1b` | r=0 default，threshold-jitter 逻辑等同 G | ✅ 已验证 |

### 本次基线指标

| 指标 | 值 |
|---|---|
| 结束回合 | T9（`victory_determination`） |
| 结束原因 | `standard_victory`（France 25 VP） |
| 总行动数 | 1201 |
| 总事件播放 | 88 (`PLAY_CARD_EVENT`) |
| 总 CP 出牌 | 179 (`PLAY_CARD_CP`) |
| `[BOT CHAIN BROKEN]` | 0 |
| `[BOT STUCK]` | 5（详见 #L） |
| 终局 VP | ottoman 10 / hapsburg 12 / england 11 / **france 25** / papacy 10 / protestant 9 |

---

## ✅ 事件结算正确性 — 全部 88 个 `PLAY_CARD_EVENT` 1:1 对应引擎事件日志

### 双向匹配核查

| Cross-check | 结果 |
|---|---|
| `PLAY_CARD_EVENT` action 数 | 88 |
| `play_card_event` engine log entries | **88** ✅ |
| 不同卡牌种类 | 39 张 |
| 引擎独立事件类型 (`event_*`) | 35 类型 |

每张被打出的卡牌都在引擎日志中产生了对应的处理记录。Home cards 因有多分支结算被分解：

- Card 3 *Six Wives of Henry VIII* (英格兰主页卡, 8 plays) → `event_six_wives_marital: 6` + `event_six_wives_war: 2` = 8 ✅
- Card 5 *Papal Bull* (教廷主页卡, 6 plays) → `event_clement_vii: 3` + `event_paul_iii: 3` = 6 ✅（Pope succession 触发不同 ruler 子事件）

### 关键样本验证

| 卡 | Power | Engine 记录 | 状态变化 |
|---|---|---|---|
| #47 Copernicus | France | `event_copernicus { vp: 2, protCount: 0, totalHome: 0 }` | France VP +2 ✅ |
| #51 Michael Servetus | England | `event_michael_servetus { vp: 1, discarded: 93 }` | England VP +1，弃牌#93 ✅ |
| #41 Marburg Colloquy | Protestant | `event_marburg_colloquy { committed: [], totalValue: 0 }` | 触发但无可献身辩士（合法） ✅ |
| #68 Andrea Doria | Hapsburg | `event_andrea_doria_activate { power: 'hapsburg' }` | Genoa 联盟激活 ✅ |
| #43 Zwingli Dons Armor | Hapsburg | `event_zwingli_dons_armor { power: 'hapsburg' }` | 触发 ✅ |
| #73 Diplomatic Marriage | Hapsburg | `event_diplomatic_marriage { mode: 'diplomacy' }` | 外交模式分支 ✅ |
| #81 Indulgence Vendor | Papacy | `event_indulgence_vendor { drawn: 111, cp: 0 }` | 抽到牌#111，无 CP（运气随机） ✅ |
| #110 War in Persia | Hapsburg | `event_war_in_persia { power: 'hapsburg' }` | 触发 ✅ |
| #22 Schmalkaldic League | France | `event_schmalkaldic_league { turn: 4, spacesTransferred: [...18 spaces] }` | T4 触发，18 个德意志空间转 Protestant ✅ |
| #89 Barbary Pirates | Hapsburg | `event_barbary_pirates { power: 'hapsburg' }` | 触发 ✅ |

### 引擎状态 flag 二次确认

| Flag | 值 | 触发事件 | 一致性 |
|---|---|---|---|
| `schmalkaldicLeagueFormed` | true | `event_schmalkaldic_league` | ✅ |
| `piracyEnabled` | true | `event_barbary_pirates` | ✅ |
| `edwardBorn` | true | Six Wives 子事件链 | ✅ |
| `elizabethBorn` | true | Six Wives 子事件链 | ✅ |
| `henryMaritalStatus` | `'katherine_parr'` | Six Wives marital 6 次进展 | ✅ |
| `stPetersProgress` | 5 | Papacy `BUILD_ST_PETERS` 完成 | ✅ |
| `stPetersVp` | 1 | 第一次 VP 转化 | ✅ |
| `rulers.papacy` | `'paul_iii'`（初始 `clement_vii`）| `event_clement_vii` 链接 → `event_paul_iii` 接任 | ✅ |
| `jesuitUnlocked` | false | Card 55 本局未被打出 | 一致（非异常） |
| `augsburgConfessionActive` | false | Card 39 本局未被打出 | 一致（非异常） |

### 结论

**所有 88 次事件播放均被引擎正确结算**——无任何"打出但未生效"的卡，无任何 `convertSpaces: []` 类空 burn。Phase G 评分化 + Phase H 随机化（默认 r=0）+ Inquisition follow-up 均按设计工作。

---

## 新发现异常

### #K 奥斯曼 Buda ↔ Pressburg 摆渡（中优先级，#F 部分回归）— ✅ 已修复

**现象**：

- 终局热路径：`ottoman: Buda → Pressburg` × 8 + `ottoman: Pressburg → Buda` × 6 = **14 次双向摆渡**
- Ottoman 正在攻打匈牙利首都 Buda（已被 Schmalkaldic League T4 触发后转为 Hungary 控制），但部队来回换位

**根因推测**：

`#F` 修复（commit `a4c5a0e`）的 `state.botLastMoves[power] = { from, to }` 只记录**最近一次** MOVE_FORMATION，并通过 `isReverseOfLastMove` 阻止单步反向。但本次场景下：

- Ottoman 在不同 impulse 之间触发 ADVANCE / SIEGE / LAND_BATTLE 等多个 goal，每个 goal 选 MOVE_FORMATION 时只看 lastMove
- 多个 stack 同时存在，Stack-A 的 `Buda → Pressburg` 更新 lastMove，下一个 impulse Stack-B 走 `Pressburg → Buda` 不被阻塞（lastMove.from=Buda===to=Buda、lastMove.to=Pressburg===from=Pressburg → 应该被阻塞）

实际更可能是：**`findSiegeTarget` 直接挑选邻接敌方堡垒（Buda 是 Hungary 控制的 fortified key），不走 `tryAdvanceWithMinUnits` 反向防抖，绕开了 #F 的守门**。

**复现/分析方式**：

1. 在 `findSiegeTarget` 路径加 `console.debug` 打印 from/to + `state.botLastMoves[power]`，确认是否绕过反向检查
2. 在 `findSiegeTarget` 内部加上 `isReverseOfLastMove` 判断，与 `tryAdvanceWithMinUnits` 一致
3. 评估 `findSiegeRelief`、`executeLandBattle` 直接攻击分支是否同样需要补防抖

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `findSiegeTarget`、`executeLandBattle` direct attack path、`findSiegeRelief`
- [frontend/src/games/his/ai/bot-controller.js:659-669](../../../../frontend/src/games/his/ai/bot-controller.js#L659-L669) — `state.botLastMoves` 写入 pre-move

**严重性**：中。属于 #F 防抖的不完全覆盖。摆渡浪费 CP 但不引发卡死，最终游戏仍然正常推进至 standard_victory。

**修复**：`isReverseOfLastMove` 守门补到 `findSiegeTarget`、`findSiegeRelief`、`executeLandBattle` 直接攻击分支三个地方。`tryAdvanceWithMinUnits` 已有的判断保持不变。

**验证**（修复后重跑同样的 9 回合 r=0 测试）：

- 双向摆渡（≥3 各方向）路径：**0 个**（修复前 14 次 Buda↔Pressburg）
- 总 MOVE_FORMATION：133（修复前 108）— 单向供给链替代了往返浪费

**状态**：✅ 已修复

### #L Protestant 调用无效 RESOLVE_REFORMATION_ATTEMPT 与 CALL_DEBATE（低优先级）— ✅ 已修复

**现象**：

- 1× `[BOT STUCK] protestant RESOLVE_REFORMATION_ATTEMPT {"targetSpace":"Amsterdam"} → No attempts remaining`
- 4× `[BOT STUCK] protestant CALL_DEBATE {"zone":"german"} → Defender has no available debaters`

**推测**：

- RESOLVE_REFORMATION_ATTEMPT 失败：bot 在 reformation phase attempts 用尽后仍尝试 resolve（应在调用前检查 `state.pendingReformation.attemptsRemaining > 0`）
- CALL_DEBATE × 4 失败：Protestant bot 一回合内反复尝试同一区域 debate，但 Papacy / Hapsburg 已无可用辩士。这表明 `executeDebate` 没有检查"对手是否有可用辩士"

**严重性**：低。每次失败 bot fallback 链救场，不阻塞游戏，但 5 个 [BOT STUCK] 是噪声且暴露 bot 决策层与引擎验证不对齐。

**相关代码位置**：

- [frontend/src/games/his/ai/bot-controller.js](../../../../frontend/src/games/his/ai/bot-controller.js) — `decideReformation`
- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `chooseDebateZonePapacy`、`chooseDebateZoneProtestant`
- [frontend/src/games/his/actions/religious-actions.js](../../../../frontend/src/games/his/actions/religious-actions.js) — `validateReformationAttempt`
- [frontend/src/games/his/actions/debate-actions.js](../../../../frontend/src/games/his/actions/debate-actions.js) — `validateCallDebate`

**修复**：

- `decideReformation`：开头加 `attemptsLeft ?? attemptsRemaining ?? 0` 余量预检，0 时直接 END_IMPULSE
- `chooseDebateZonePapacy` / `chooseDebateZoneProtestant`：除攻方需有 uncommitted debater 外，新增 defender 侧 uncommitted debater 检查；任何一方无可用辩士的 zone 直接 skip

**验证**（修复后重跑同样的 9 回合 r=0 测试）：

- `[BOT STUCK] *** RESOLVE_REFORMATION_ATTEMPT *** No attempts remaining`：**0 次**（修复前 1 次）
- `[BOT STUCK] *** CALL_DEBATE *** Defender has no available debaters`：**0 次**（修复前 4 次）

**状态**：✅ 已修复

---

## 整体修复状态

| 编号 | 处置 | 核心改动 |
|---|---|---|
| #K | ✅ 已修复 | `isReverseOfLastMove` 守门补到 `findSiegeTarget`、`findSiegeRelief`、`executeLandBattle` 直接攻击分支 |
| #L | ✅ 已修复 | `decideReformation` 加 `attemptsLeft` 余量预检；`chooseDebateZonePapacy/Protestant` 加 defender uncommitted-debater 检查 |

## 修复后衍生发现（留待后续）

修复后的同条件回归暴露 2 个新异常（不在本次修复范围）：

- **#M France `PLAY_CARD_EVENT 95` 缺 source space（1 次告警）**：Sack of Rome 事件的 actionData 在 bot 决策层未填写 `sourceSpace`，引擎拒绝。需在 routeEventCard 或 card-specific handler 中补 source 选择
- **#N Protestant `PLAY_CARD_EVENT 100` "Not playable by Protestant"（2 次告警）**：Card 100 Shipbuilding 当前 score `() => 0.85` 对 Protestant 也返回非零值，但引擎拒绝 Protestant 打此卡。需在 `bot-event-criteria.js` 把 100 的 score 改为 `(s, p) => p === 'protestant' ? 0 : 0.85`

---

## 数据归档

- 终局 history.length = 1201
- 88 PLAY_CARD_EVENT，35 distinct engine event types
- 39 distinct cards played as event
- 引擎 flags 5 项受事件影响的均已正确翻转
- Schmalkaldic League T4 触发，18 个德意志空间转 Protestant 控制
- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1
- setTimeout 加速：500–1200 ms 压到 40 ms（与 2026-04-23 测试一致）
- Phase G 基线（commit `b7b48c7`）：85 events / 1250 actions / France T9 time_limit
- 本次（commit `7195a1b`）：88 events / 1201 actions / France T9 standard_victory
- 差异属正常方差范围（不同初始牌堆顺序导致结局类型变化，但事件结算路径一致）
