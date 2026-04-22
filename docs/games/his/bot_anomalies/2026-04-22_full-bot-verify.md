# 全 Bot 验证测试异常清单 — 2026-04-22

> 测试日期: 2026-04-22
> 测试形式: Playwright MCP 全 Bot 引擎回归测试（`window.app._startHisGame()`）
> 结果: **法兰西在 T5 以 22 VP 达成 Domination Victory**（gap 10 ≥ 5）
> 前提: 基于 2026-04-19 修复的 #1 / #2 / #4 基线上运行

## 验证结论

### 先前异常已修复（通过实机验证）

| 编号 | 异常 | 2026-04-19 现象 | 2026-04-22 观察 | 状态 |
|---|---|---|---|---|
| #1 | 英格兰对苏格兰零突击 | 0 × `MOVE_FORMATION`，仅造舰 | **11 × `MOVE_FORMATION`**（London→Lincoln→York→Berwick→Edinburgh + Bristol→Shrewsbury→Carlisle→Glasgow），1 × `ASSAULT(Edinburgh)`，1 × `CONTROL_UNFORTIFIED(Glasgow)`。Edinburgh 最终由英格兰控制 | ✅ 已验证 |
| #2 | 奥斯曼 3 次宣战 0 次攻击 | 0 × 军团移动到匈牙利 | **11 × `MOVE_FORMATION`**（含 Istanbul→Edirne→Sofia→Nezh→Belgrade、Scutari→Ragusa、Athens→Larissa→Salonika），1 × `RESOLVE_BATTLE`。Belgrade 有奥斯曼单位驻扎 | ✅ 已验证 |
| #4 | 法国反复 `SUE_FOR_PEACE` | 同一外交段多次触发 | 全局 `SUE_FOR_PEACE` / `PROPOSE_PEACE` 计数 = 0 | ✅ 已验证 |

### 本次运行基础指标

| 指标 | 值 |
|---|---|
| 结束回合 | T5（victory_determination） |
| 结束原因 | `domination_victory`（T4+ 且 VP 差 ≥ 5） |
| 胜方 VP | france 22（初始 12 + 基础 5 + bonus 3 + track 2） |
| 次席 VP | england 12 / papacy 12（同值） |
| 总行动数 | 658 |
| `[BOT STUCK]` 次数 | 2（均为 Hapsburg `CONTROL_UNFORTIFIED Ragusa`） |
| `[BOT CHAIN BROKEN]` 次数 | 0 |
| 宗教空间 | Protestant 23 / Catholic 88 / Other 31 |

---

## 新发现异常（按优先级）

## #A 游戏 T5 即因 Domination Victory 过早结束（测试方法论，非 Bug）

**现象**：

- 测试仅跑到 T5 就因 `topVp - secondVp = 22 - 12 = 10 ≥ 5` 触发 domination victory
- 初始 VP 总计（`getAllVpTotals`）：ottoman 8 / hapsburg 9 / england 9 / france 12 / papacy 19
- T5 末：ottoman 8 / hapsburg 8 / england 12 / france 22 / papacy 12 / protestant 8
- 教廷 VP 从 19 → 12（-7，因 Protestant reformation 吞食 Catholic 空间）
- 法国未做任何激进战役，仅 9 × `MOVE_FORMATION`、2 × `ASSAULT(Brussels, Antwerp)`、1 × `CONTROL_UNFORTIFIED(Modena)`，即凭初始 12 VP 领先 + 教廷自然下滑，坐享胜利

**推测**：

- 规则层面：Domination Victory 门槛（`dominationMinTurn=4, dominationGap=5`，见 `frontend/src/games/his/constants.js` VICTORY block）对 1517 场景偏低
- 1517 开局法国 track VP 本就最高（12），只要教廷被 Protestant 削减 5+ VP，domination 即触发
- Bot 无"反制领跑者"的宏观策略：没有一个国家主动宣战法国，也没 Protestant-Hapsburg 协同遏制
- `getGangingUpTargets` 阈值为 20/21，但法国 T5 已到 22 VP，触发窗口太窄，无法左右外交

**复现/分析方式**：

1. 在 `phase-manager.js:324` 的 domination 检查前加日志，记录 T4–T7 每回合 `vpTotals.sorted[0..2]`
2. 验证 `bot-diplomacy.js` 的 DoW 决策是否参考 `getGangingUpTargets`；若阈值过高（20），降到 `max(initialTopVp + 3, 15)` 作动态触发
3. 考虑：domination 判定是否应对 1517 场景额外 `dominationMinTurn ≥ 5` 或 gap ≥ 7，以拉长游戏样本

**相关代码位置**：

- [frontend/src/games/his/phases/phase-manager.js:324-334](../../../../frontend/src/games/his/phases/phase-manager.js#L324-L334)
- [frontend/src/games/his/constants.js](../../../../frontend/src/games/his/constants.js) — `VICTORY` 常量
- [frontend/src/games/his/ai/bot-card-play.js:393-409](../../../../frontend/src/games/his/ai/bot-card-play.js#L393-L409) — `getGangingUpTargets`

**结论**：Domination Victory（T4+ 且 VP 差 ≥ 5）是 HIS 500th Anniversary 的官方规则，不是 bot bug。本次 T5 终局是规则合法结果。**修复策略为测试方法论**：全 Bot 回归测试应显式使用 `window.app._startHisGame(null, { dominationVictoryEnabled: false })` 禁用统治胜利，以获取完整 9 回合 bot 行为样本。代码层无需改动。

**状态**：✅ 已澄清（测试方法论）

---

## #B 奥斯曼主力军在 Nezh ↔ Belgrade 之间摆渡（中优先级）

**现象**：

- 奥斯曼 `MOVE_FORMATION` 中出现 `Nezh → Belgrade` 4 次、`Sofia → Nezh` 1 次、`Salonika → Sofia` 1 次
- T5 结束时奥斯曼单位在 8 个空间各 1 单位（Athens / Belgrade / Edirne / Istanbul / Ragusa / Salonika / Scutari / Sofia）——**全线散兵，无集中突击阵型**
- 匈牙利 `Buda` 仍被 Hapsburg 增援驻防（1 匈+1 哈），奥斯曼没有形成足以 assault Buda 的主力
- 奥斯曼 `ASSAULT` 计数 = 0，`RESOLVE_BATTLE` 仅 1 次

**推测**：

- `#1 fix` 将 `advanceTowardTarget(targetType='fortification')` 的 `minUnits` 从 2 降到 1，对奥斯曼这种多前线势力产生副作用：单兵小队被允许独立推进，但到达目标后无兵力突击
- 目标选择 `findNearestEnemyFortification` 可能在 BFS 时挑到 Buda（需越过 Belgrade），但每个 CP 窗口只能推一小队，主力在 Nezh/Sofia 重复"前压-回援"振荡
- 缺少 **"集结阈值"**：应在守卫+目标单位数估计达标前停止分散，将小队召回至 Belgrade 集结

**复现/分析方式**：

1. 在 `advanceTowardTarget` 加 `console.debug` 输出 `power / cp / minUnits / chosen.from→chosen.to / formationSize`
2. 验证奥斯曼 6 回合全部 `MOVE_FORMATION` 动作，检查是否同一支单位反复位移
3. 评估在 behavior card 层面增加 `RALLY` 或 `MASS_FORMATION` 优先级：若最近 fortification 未被 assault 且有孤立单位离之 ≤ 2 格，先汇合再推进

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js:1320-1370](../../../../frontend/src/games/his/ai/bot-goals.js#L1320-L1370) — `advanceTowardTarget`（minUnits=1 for fortification）
- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `findNearestEnemyFortification`
- [frontend/src/games/his/ai/behavior-cards.js](../../../../frontend/src/games/his/ai/behavior-cards.js) — `ottoman_expansion` 卡序列

**修复**：`advanceTowardTarget` 现在对 `fortification` 目标采用 `[2, 1]` 两段阈值 —— 先尝试集结 ≥2 单位的阵型推进，只有全部 ≥2 阵型无合法下一步时才回落到 minUnits=1。对 `enemy_units` 目标保持 `[2]`（避免自杀式单兵冲锋）。配合 #C `findMovableFormations` 修复（含未控空间的落脚部队），主力得以在 Modena / Sofia 等中继空间继续推进，而不是留守后被 Ravenna 再次投入。

**状态**：✅ 已修复

---

## #C 教廷过度造舰 + 无陆战推进（中优先级）

**现象**：

- 教廷 5 回合动作分布：`PASS 32 / PLAY_CARD_CP 17 / NAVAL_MOVE 16 / BUILD_SQUADRON 10 / PLAY_CARD_EVENT 6 / BUILD_ST_PETERS 3 / MOVE_FORMATION 3 / RESOLVE_BATTLE 3`
- 所有 `MOVE_FORMATION` 均为 `Ravenna → Modena`（重复 3 次，同一路径）
- 教廷与 France / Genoa / Ottoman 三面开战，却仅 3 次军团移动，且目标重复
- St. Peter's 完成进度 3 / 5（未解锁额外 VP）
- `stPetersVp = 0`（未转化）

**推测**：

- 教廷 behavior card 的 `SHIPBUILDING` 优先级过高（类似 #1 England 的造舰循环），导致 CP 被耗在造舰而非陆战
- `advanceTowardTarget` 对教廷没有返回有效路径（Ravenna 阵型可能被 garrison 要求卡死 → 只剩 1 可用单位，但路径需要 2+ 去进攻 Brussels/Genoa）
- 若 `findSiegeTarget` 返回 `Modena`（独立空间，非敌方堡垒），则 `advanceTowardTarget('fortification')` 不该重复推到同一空间

**复现/分析方式**：

1. 检查教廷 behavior card（`papacy_defense` 或类似）的 goal 序列，确认 `SIEGE` / `SHIPBUILDING` 的 max 配额
2. `findSiegeTarget(state, 'papacy')` 单步调试，看返回哪个 fortification
3. 若教廷 Ravenna 阵型连续 3 次"Ravenna → Modena"，说明 Modena 可能误被识别为目标，需排查 `fortification` target 过滤

**相关代码位置**：

- [frontend/src/games/his/ai/behavior-cards.js](../../../../frontend/src/games/his/ai/behavior-cards.js) — 教廷 behavior card 序列
- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `findSiegeTarget`
- [frontend/src/games/his/ai/bot-card-play.js](../../../../frontend/src/games/his/ai/bot-card-play.js) — 教廷 CP vs event 选择逻辑

**修复**：核查发现 Papacy 5 卡周期 SHIPBUILDING caps 累计上限 6（rebuilding 1 + warrior_pope 2 + great_debate 1 + worldly_things 2），配合多 impulse 执行 10 次造舰是在允许配额内，**非过度造舰**。真正根因是 `findMovableFormations` 只挑选 `sp.controller === power` 的空间，导致从 Ravenna 推进到 Modena（独立空间）的阵型**无法被后续 impulse 视为可移动阵型**，Modena 驻扎单位被"困死"，每轮只能由 Ravenna 再次投入相同路线。

修复后 `findMovableFormations` 对任何**含有本方陆军单位**的空间都纳入候选；非本方控制空间 garrison 视为 0（全部可移动）。这同时解决了 #B 奥斯曼散兵的第二个症状（Nezh / Ragusa 等散落孤立单位再次被纳入 BFS）。

**状态**：✅ 已修复

---

## #D Hapsburg `CONTROL_UNFORTIFIED Ragusa` 重复栈卡（低优先级）

**现象**：

- 2 次控制台告警：`[BOT STUCK] hapsburg CONTROL_UNFORTIFIED {"space":"Ragusa"} → Cannot control space with non-allied land units present`
- Hapsburg bot 尝试控制 Ragusa（独立城邦，港口），但该空间有奥斯曼单位驻留
- 非阻塞（bot 随后执行 PASS 或其他动作），但每次都浪费一个 CP 决策

**推测**：

- Hapsburg 的 `goal_control` 候选未排除"存在非盟友陆军单位"的空间
- 引擎 `validateControlUnfortified` 已正确拒绝，但 bot 端 `findControlCandidates` 缺少 "空间内无敌方单位" 预检

**复现/分析方式**：

1. 在 `bot-goals.js` 的 `executeControl`（或相应函数）中定位 Ragusa 被选为 candidate 的路径
2. 在 candidate 过滤时加入：`spaces[target].units.filter(u => u.owner !== myPower && !isAllied(myPower, u.owner)).length === 0`

**相关代码位置**：

- [frontend/src/games/his/ai/bot-goals.js](../../../../frontend/src/games/his/ai/bot-goals.js) — `executeControl` / 找 CONTROL 候选
- [frontend/src/games/his/actions/military-actions.js](../../../../frontend/src/games/his/actions/military-actions.js) — `validateControlUnfortified`

**修复**：`findControlTarget` 新增 `friendlyPowers = new Set([power, ...getAlliesOf(state, power)])`，并通过新助手 `hasNonFriendlyLandUnits(sp, friendlyPowers)` 预检 —— 镜像 `validateControlUnfortified`，只要空间内含有**任何非盟友陆军单位**（奥斯曼在 Ragusa 的 regular），该空间立即从 CONTROL 候选中剔除。

**状态**：✅ 已修复

---

## #E 匈牙利首都 Buda 由 Hapsburg 自动驻防（观察，非 Bug）

**现象**：

- Buda 最终状态：`hungary_bohemia:regular + hapsburg:regular`
- 1517 规则中 Hapsburg 与 Hungary-Bohemia 是初始盟友，因此奥斯曼对匈宣战时 Hapsburg 自动加入防御

**说明**：

- 这实际是正确规则实现，但对奥斯曼 Bot 是重要战略前提。`findNearestEnemyFortification` 挑选 Buda 作为目标时应加权考虑"守军已含 Hapsburg 增援"，避免盲目推进
- 本次测试中奥斯曼未能 assault Buda，正与 #B 相关

---

## 整体修复状态

| 编号 | 处置 | 核心改动 |
|---|---|---|
| #A | 澄清为测试方法论问题 | 官方规则合法；回归测试建议显式 `dominationVictoryEnabled: false` 以跑满 9 回合 |
| #B | ✅ 已修复 | `advanceTowardTarget` 对 fortification 用 `[2, 1]` 两段阈值；配合 #C 让中继空间阵型可续推 |
| #C | ✅ 已修复 | `findMovableFormations` 不再强制 `sp.controller === power`，含本方单位的任何空间均可被选为起点；非本方控制空间 garrison 视为 0 |
| #D | ✅ 已修复 | `findControlTarget` 新增 `hasNonFriendlyLandUnits` 预检，镜像引擎 `validateControlUnfortified` |
| #E | 观察项（非 Bug） | 规则正确实现，属于奥斯曼的战略前提 |

---

## 数据归档

本次测试原始数据（可选归档）：

- 最终 `g.history.length = 658`
- 最终 VP 分布：`{ottoman:8, hapsburg:8, england:12, france:22, papacy:12, protestant:8}`
- 最终 space controller 分布：`{hapsburg:54, ottoman:15, papacy:4, france:21, independent:12, genoa:2, hungary_bohemia:8, england:14, venice:3, scotland:1, null:8}`
- Reformations 完成：23 个 Protestant 空间（初始 0）
- Scotland 仅剩 1 空间（Edinburgh 被英格兰拿下）
- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1
