# 全 Bot 9 回合测试异常清单 — 2026-04-23

> 测试日期: 2026-04-23
> 测试形式: Playwright MCP 全 Bot 引擎回归测试（`window.app._startHisGame(null, { dominationVictoryEnabled: false })`）
> 结果: **T9 时间到期 `time_limit`，法兰西以最高 VP 胜出**
> 前提: 基于 2026-04-22 修复的 #B / #C / #D（以及 2026-04-19 修复的 #1 / #2 / #4）基线上运行

## 验证结论 — 先前异常已修复（通过本次实机验证）

| 编号 | 异常 | 修复日期 | 2026-04-23 观察 | 状态 |
|---|---|---|---|---|
| #1 | 英格兰对苏格兰零突击 | 2026-04-19 | **18 × `MOVE_FORMATION`**（Bristol→Shrewsbury→Carlisle→Berwick→Edinburgh、London→Lincoln→York→Berwick→Edinburgh 完整链路），1 × `ASSAULT`，Edinburgh 现由英格兰控制（4 regulars + 1 merc 驻军），并进一步尝试 Stirling 扩张 | ✅ 已验证 |
| #2 | 奥斯曼 0 次攻击匈牙利 | 2026-04-19 | **41 × `MOVE_FORMATION`**（Istanbul→Edirne→Sofia→Nezh→Belgrade→Mohacs→Buda 完整推进 5 次），Buda 现被奥斯曼围攻（`besieged: true, besiegedBy: ottoman`），`DECLARE_WAR ottoman→papacy/hungary_bohemia` 正常触发 | ✅ 已验证 |
| #4 | 法国反复 `SUE_FOR_PEACE` | 2026-04-19 | 全局 `SUE_FOR_PEACE` / `PROPOSE_PEACE` 计数 = **0**，9 回合共 2 次 `DECLARE_WAR`（ottoman→papacy、hapsburg→ottoman） | ✅ 已验证 |
| #B | 奥斯曼主力散兵 | 2026-04-22 | 奥斯曼形成有效突击链 Istanbul→Buda，主力抵达并围攻首都，不再是 T5 的 8 空间散兵 | ✅ 已验证 |
| #C | 教廷 Ravenna→Modena 死循环 | 2026-04-22 | Ravenna→Modena 4 次 + **Modena→Milan 2 次**（Modena 驻军成功续推至 Milan，修复生效），Milan 现由法国控制但教廷短暂夺控链路可见 | ✅ 已验证 |
| #D | Hapsburg `CONTROL_UNFORTIFIED Ragusa` 栈卡 | 2026-04-22 | **0 × `[BOT STUCK] hapsburg CONTROL_UNFORTIFIED Ragusa`** 控制台告警；Ragusa 当前为 independent（无非盟友单位冲突） | ✅ 已验证 |

### 本次运行基础指标

| 指标 | 值 |
|---|---|
| 结束回合 | T9（`victory_determination`） |
| 结束原因 | `time_limit`（非 domination 也非 25 VP） |
| 胜方 | france |
| 总行动数 | 1239 |
| `[BOT STUCK]` 次数 | 8（详见 #H / #I） |
| `[BOT CHAIN BROKEN]` 次数 | 0 |
| 宣战总计 | 2 | 
| 活跃战争 | 7（1517 起始 5 + DoW 2） |
| `SUE_FOR_PEACE` / `PROPOSE_PEACE` | 0 / 0 |
| Schmalkaldic League | 已结成 |
| 宗教空间 | Catholic 79 / Protestant 32 / Other 32 |
| 总 `MOVE_FORMATION` | 156 |
| 总 `ASSAULT` | 7 |

### 势力 action 分布摘要

| 势力 | PASS | MOVE | ASSAULT | BATTLE | NAVAL | BUILD_SQ | DoW | 特殊 |
|---|---|---|---|---|---|---|---|---|
| ottoman | 62 | 41 | 2 | 9 | 6 | 0 | 1 | 1 × PIRACY |
| hapsburg | 46 | 47 | 1 | 11 | 19 | 4 | 1 | 3 × EXPLORE |
| england | 56 | 18 | 1 | 4 | 18 | 10 | 0 | — |
| france | 54 | 44 | 3 | 6 | 13 | 4 | 0 | 2 × CONTROL |
| papacy | 61 | 6 | 0 | 2 | 15 | 5 | 0 | 15 × BURN + 31 × REFORM + 23 × PUBLISH |
| protestant | 56 | 0 | 0 | 0 | 0 | 0 | 0 | 74 × REFORM + 14 × DEBATE + 23 × PUBLISH + 10 × TRANSLATE + 13 × RAISE |

---

## 新发现异常（按优先级）

## #F 法兰西 Antwerp ↔ Liege 无限对调（高优先级）— ✅ 已修复

**现象**：

- 法兰西 9 回合共 44 次 `MOVE_FORMATION`，其中 **31 次在 Antwerp ↔ Liege 之间对调**：
  - `Antwerp → Liege` × 17
  - `Liege → Antwerp` × 14
  - 累计占法国 MOVE 的 ~70%
- 终局状态：Antwerp / Liege / Brussels 均由法兰西控制，Antwerp 驻 5 regulars、Liege 空、Brussels 1 regular（fortified）
- 该空间对已在 T2 左右完全被法兰西拿下，之后无敌军威胁，法军却在两地之间持续摆渡

**推测**：

- 法国 behavior card 的 `ADVANCE` / `SIEGE` goal 在无合法前进目标时，`advanceTowardTarget` 返回的"最近敌方堡垒" BFS 可能指向更远的目标（如 England 空间或其他远端）
- Antwerp 与 Liege 之间 BFS 距离差为 0（都等距目标），但函数 `tryAdvanceWithMinUnits` 里 `destDist < currentDist` 只要求"严格更近"——正常情况下应避免摆动
- 但若目标在两边都可到达（例如 Brussels 以外有英格兰海岸线），一侧比另一侧近 1 格时 bot 就会来回抖动（每移动一步，新目标变成另一端）
- 另一可能：`findNearestEnemyFortification` 随遗留战线/supply line 变化反复切换目标

**复现/分析方式**：

1. 复现法国主力到达 Antwerp 后的状态，打印 `advanceTowardTarget(state, 'france', cp, 'fortification')` 的 target 选择与候选邻居
2. 增加 "目标空间是否刚从此走过" 的短期记忆防抖（state.lastMoveFrom[power]），若 dest === lastFrom 则 penalty
3. 评估在 `tryAdvanceWithMinUnits` 中要求 `destDist < currentDist - 1`（跳过距离差 ≤1 的无意义换位）——风险：可能阻挡某些合法多段推进

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js:1336-1408](../../../../frontend/src/games/his/ai/bot-goals.js#L1336-L1408) — `advanceTowardTarget` / `tryAdvanceWithMinUnits`
- [frontend/src/games/his/ai/bot-goals.js:1417-1438](../../../../frontend/src/games/his/ai/bot-goals.js#L1417-L1438) — `findNearestEnemyFortification`

**修复**：引入 `state.botLastMoves[power] = { from, to }` 持久追踪，由 bot-controller 在 MOVE_FORMATION **之前**写入（processMove 深克隆 state，所以必须 pre-move 写入才能传进 newState）。bot-goals 新增 `isReverseOfLastMove` 助手，在 `tryAdvanceWithMinUnits` 与 `executeAdvance` 的 dest 循环里 skip 掉立刻反向上一步的候选。

**验证**（2026-04-23 修复后重跑，T8 religious_victory）：

- France `Antwerp→Liege` / `Liege→Antwerp`：不再出现于热路径（全部 < 3 次）
- England `Edinburgh→Stirling` 从 12 次 + 对向 10 次，降为 5 次单向（反向完全消失）
- Hapsburg Bordeaux↔Limoges：仅剩 3 次单向（反向完全消失）

**状态**：✅ 已修复

---

## #G Hapsburg Bordeaux ↔ Limoges 空壳军对调（中优先级）— ✅ 已修复（同 #F）

**现象**：

- 终局 Hapsburg 军力分布中，Bordeaux（法国控制）内出现 `hapsburg:R0 M0 C0 S0` —— 零单位的遗留 stack
- Hapsburg 对该残留 stack 执行了 4 × `Bordeaux → Limoges` + 4 × `Limoges → Bordeaux` 的摆渡
- 与 #F 同构：已空的单位对象仍被 `findMovableFormations` 当作合法阵型候选

**推测**：

- #C 修复让 `findMovableFormations` 包含本方单位落脚的非控空间，但 **`countLandUnits(stack) === 0` 的空 stack 理论上应当被过滤**
- 当前代码：`if (total === 0) continue;` 看似已有过滤，但若 stack 对象存在而 regulars/mercenaries/cavalry 在战斗中归零而对象残留，`getUnitsInSpace` 返回的 stack `total === 0`——应 OK
- 更可能：Bordeaux 中 hapsburg 的 0 单位 stack 来自 **battle 后未被清理**，或 engine 在 `applyCasualties` 后保留了 0 单位 stack 对象
- 另一假设：是 stack 可能含 leader（`leaders[]` 非空），`countLandUnits` 不计 leader，但 `available = total - garrison = 0` 对 minUnits=1 检查被通过？需要验证边界

**复现/分析方式**：

1. 确认 Bordeaux `state.spaces.Bordeaux.units` 数组内容：是否有 hapsburg 0-unit stack 仅含 leader
2. 检查 `findMovableFormations` 返回值——加断点记录 Bordeaux 是否被选作候选
3. 若确为 leader-only stack，需补充 `available >= minUnits` **且** `totalLandUnits >= 1` 双重判断
4. 或统一在 `countLandUnits` 返回 0 时移除该 stack（engine 侧清理）

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js:1276-1299](../../../../frontend/src/games/his/ai/bot-goals.js#L1276-L1299) — `findMovableFormations`
- [frontend/src/games/his/actions/military-actions.js](../../../../frontend/src/games/his/actions/military-actions.js) — `applyCasualties` / stack cleanup

**修复**：问题根因本就是 #F 的摆渡——零单位 stack 是多轮摆渡后被战损清空的残留，每次摆渡时单位数还 >0。#F 的防抖修复后 Bordeaux↔Limoges 摆渡天然消失，空壳 stack 也不再被反复拨弄，无需单独过滤 leader-only stack。

**状态**：✅ 已修复（随 #F 一并解决）

---

## #H Ottoman / Hapsburg `ASSAULT` LOC 缺失导致栈卡（中优先级）— ✅ 已修复

**现象**：

- 控制台 `[BOT STUCK]` 告警 7 次：
  - `ottoman ASSAULT {space: 'Buda'}` × 3 + `ottoman ASSAULT {target: 'Buda', free: true}` × 1
  - `hapsburg ASSAULT {space: 'Scutari'}` × 2 + `hapsburg ASSAULT {target: 'Scutari', free: true}` × 1
  - 错误：`No line of communication to a friendly fortified space`
- 奥斯曼确实在围攻 Buda（`besieged: true, besiegedBy: 'ottoman'`），但 Belgrade 已被 Hapsburg 围攻，**主补给线被切断**，ASSAULT 在引擎层被拒绝
- Hapsburg 派出深入巴尔干的突击队（Agram→Belgrade→Nezh→Scutari→Durazzo），Scutari/Durazzo 远离 Hapsburg 本土且无控点中继

**推测**：

- `findAssaultTarget` / `executeSiege` 在 bot 侧只检查 "我们在围攻 X" 或 "X 在我们相邻"，**未检查 `hasLineOfCommunicationToAssault`**（或等价 LOC 判定）
- 引擎 `validateAssault` 要求 LOC 存在；bot 请求被拒绝后走 fallback chain 但浪费了决策机会
- 特别针对 Ottoman: 围攻 Buda 时，若 Belgrade（LOC 关键节点）被 Hapsburg 反围，奥斯曼应当**优先解围 Belgrade** 而非继续 ASSAULT Buda

**复现/分析方式**：

1. 在 `findAssaultTarget` 中引入 `hasLineOfCommunicationToAssault(state, power, target)` 预检——复用军事动作层已有的 LOC 函数
2. 若目标缺乏 LOC：降级为 `findSiegeRelief`（解己方被围关键节点）或 `advanceTowardTarget` 重新补线
3. 评估 Ottoman 的 `SIEGE` 优先级在 behavior card 上是否包含 "relieve supply" 触发器

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `executeSiege` / `findAssaultTarget`
- [frontend/src/games/his/actions/military-actions.js](../../../../frontend/src/games/his/actions/military-actions.js) — `validateAssault` 的 LOC 检查
- [frontend/src/games/his/ai/bot-goals.js:1446-1473](../../../../frontend/src/games/his/ai/bot-goals.js#L1446-L1473) — `findSiegeRelief`

**修复**：`findAssaultTarget` 在候选筛选开头加入 `hasLineOfCommunicationForControl(state, power, name)` 预检，镜像引擎 `validateAssault` 的 LOC 条件。测试侧同步更新 `executeSiege` 两个围攻用例，显式把中继键空间（Belgrade/Mohacs/Buda/Pressburg）置为攻方控制以保障 LOC 通路。

**验证**（修复后重跑）：`[BOT STUCK] *** ASSAULT *** No line of communication` 控制台告警从 7 次降为 **0 次**。

**状态**：✅ 已修复

---

## #I 教廷军事推进量过低（低优先级）— 未修复（留作后续）

**现象**：

- 教廷 9 回合共 **6 × `MOVE_FORMATION`**（含 #C 的 Ravenna→Modena 4 + Modena→Milan 2）
- 同期宗教行动活跃：31 × `RESOLVE_REFORMATION_ATTEMPT`（防御反攻改革地块）、15 × `BURN_BOOKS`、23 × `PUBLISH_TREATISE`
- 结果：Ravenna 囤积 6 regulars（可移动阵型达标但未推进）、Modena 空、Milan 由法国控制——教廷对 France / Ottoman 两线战争军事贡献几乎为零

**推测**：

- Papacy 行为卡 goal 序列中，`BURN` / `PUBLISH` / `REFORMATION` 响应优先级远高于 `SIEGE` / `LAND_BATTLE`，且 `goal.max` 对宗教类为 INF，CP 被优先消耗完
- `protestantSpaces >= 25` 的防御 override（[bot-goals.js:1165](../../../../frontend/src/games/his/ai/bot-goals.js#L1165)）进一步把 BURN/DEBATE 置顶，军事 goal 几乎得不到 CP
- 战术上虽有合理性（守宗教战场），但面对 Milan 被 France 拿下、Ravenna 直接受威胁时，教廷 **应在 protestantSpaces < 25 阈值时保留一定军事预算**

**复现/分析方式**：

1. 在教廷 CP 分配上记录每 impulse 的"实际执行 goal"分布，验证 SIEGE/LAND_BATTLE 是否长期 0 调用
2. 调整防御 override 触发阈值：改为"当 protestantSpaces 单回合增长 ≥ N"才启用，而非绝对数值
3. 或：对 Papacy 主动战争（France / Ottoman）的 SIEGE 预算最低留出 1 CP（即 goal.max 改为 "reserve 1 CP for military if at war"）

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js:1161-1172](../../../../frontend/src/games/his/ai/bot-goals.js#L1161-L1172) — Papacy defensive override
- [frontend/src/games/his/ai/behavior-cards.js:652-774](../../../../frontend/src/games/his/ai/behavior-cards.js#L652-L774) — 教廷 5 张 behavior cards 的 goal 序列

---

## #J T9 `SUE_FOR_PEACE` 最终回合拒绝（观察，非 Bug）— ✅ 已修复

**现象**：

- 控制台告警 1 次：`[BOT STUCK] hapsburg SUE_FOR_PEACE {target: 'france', forPower: 'hapsburg'} → Cannot sue for peace in final turn`
- 引擎正确按规则（最终回合不接受求和）拒绝
- Hapsburg bot 在 T9 diplomacy 阶段仍尝试求和法兰西

**说明**：

- 规则正确；bot 侧应在 `shouldSueForPeace` 中加 `if (state.turn >= VICTORY.maxTurns) return false` 预检，避免浪费决策
- 非阻塞，但每局终点都会产生 1 次无意义告警

**相关代码位置**：

- [frontend/src/games/his/ai/bot-phases.js](../../../../frontend/src/games/his/ai/bot-phases.js) — `shouldSueForPeace`
- [frontend/src/games/his/actions/diplomacy-actions.js](../../../../frontend/src/games/his/actions/diplomacy-actions.js) — `validateSueForPeace`

**修复**：`shouldSueForPeace` 开头插入 `if (state.turn >= (state.finalTurn || 9)) return false;`，在 Bot 决策层提前 return false，与引擎 `validateSueForPeace` 的最终回合拒绝对齐。

**状态**：✅ 已修复

---

## 整体修复状态

| 编号 | 处置 | 核心改动 |
|---|---|---|
| #F | ✅ 已修复 | `state.botLastMoves[power]` 跨 impulse 持久追踪，`isReverseOfLastMove` 在 advance 候选 dest 循环中剔除立即反向；bot-controller **pre-move** 写入以绕过 `processMove` 深克隆 |
| #G | ✅ 已修复 | 随 #F 一并解决（空壳 stack 是摆渡战损残留） |
| #H | ✅ 已修复 | `findAssaultTarget` 加 `hasLineOfCommunicationForControl` 预检；相关单元测试补齐 LOC 中继 |
| #I | 未修复（留作后续） | 教廷 6/9 回合的军事推进偏低，但非阻塞；Schmalkaldic League 后可进一步评估是否调 behavior card 或防御 override 阈值 |
| #J | ✅ 已修复 | `shouldSueForPeace` 加最终回合预检 |

---

## 数据归档

- 最终 `history.length = 1239`
- 最终 VP 分布（partial，未含 track VP）：`vp: {france:5, papacy:2, others:0}`，`bonusVp: {hapsburg:3, france:2, england:1, protestant:1}`
- 最终 space controller 分布关键片段：Edinburgh=england（Scotland 沦陷）、Antwerp/Brussels/Bordeaux/Milan/Modena=france、Belgrade=ottoman（被 Hapsburg 围）、Buda=hungary_bohemia（被 ottoman 围）、Ravenna=papacy（6 regulars 囤积）
- 活跃战争：hapsburg-france、france-papacy、ottoman-hungary_bohemia、ottoman-papacy、england-scotland、hapsburg-ottoman、england-hapsburg（7 条）
- Reformations: 32 Protestant 空间（<50 宗教胜利阈值）
- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1，`dominationVictoryEnabled: false`
- setTimeout 加速 patch：将 500–1200 ms 的延时压到 40 ms，使单场测试耗时从 ~40 min 压到 ~7 min
