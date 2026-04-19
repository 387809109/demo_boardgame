# HISBOT 待分析异常清单

> 创建日期: 2026-04-19
> 上一次测试: 2026-04-19 全 Bot 9 回合 Playwright 引擎测试（新教 T9 宗教胜利 50 地点）
> 已修复: #0 教廷防御目标压力覆写（见 [HISBOT_REF.md §8.5.1](HISBOT_REF.md)）

本文档记录在 HISBOT 全 Bot 回归测试中观察到但尚未定位根因的行为异常。每条注明：

- **现象**：测试中观察到的具体异常行为
- **推测**：可能的代码成因
- **复现/分析方式**：推荐的下一步调查步骤

---

## 分析前提：再次执行基线测试

在逐条深入前，**先在当前代码（包含 Papacy 防御覆写修复）上重跑一次全 Bot 测试**，观察：

1. 新教是否仍能宗教胜利（或延后至 T9/T10）？
2. 教廷 `BURN_BOOKS` / `CALL_DEBATE` 调用次数是否显著提升？
3. 其他异常（#1-#7）现象是否因 Papacy 策略转变而派生变化？

运行方式参考 [test/TEST_REQUIREMENTS.md](test/TEST_REQUIREMENTS.md)：

```javascript
// Playwright MCP 会话内
browser_navigate('http://localhost:5173')
browser_evaluate(() => window.app._startHisGame())  // 6 Bot 对局
// 等待 state.status === 'ended'，抓取 history 并归档
```

---

## #1 英格兰大量造舰 + 对苏格兰零突击（中优先级）

**现象**：
- 英格兰在 Rule Britannia 卡激活时反复触发 `BUILD_SQUADRON`，但从未对 Edinburgh 发起围城或突击
- 尽管与苏格兰处于开战状态且理论上有陆路 London→Lincoln→York→Berwick→Edinburgh（4 格）

**推测**：
- Rule Britannia 卡的 `SHIPBUILDING` 出现两次（position 3 max=1，position 9 max=INF），导致早期 SHIPBUILDING 满额后仍被 SHIPBUILDING(INF) 槽位无限触发
- `findSiegeTarget` 要求阵型邻接敌方堡垒，London 阵型需先移动 3 步才能邻接 Edinburgh，`advanceTowardTarget` 逻辑上应该可以推进
- 可能 `findMovableFormations(minUnits=2)` 在某处（如移动后 Lincoln 只剩 2 单位时）被驻军需求卡住

**复现/分析方式**：

1. 在 `dispatchGoalAction` 尾部加临时日志，记录每次 Papacy+England 的 `goal.type / cost / result`，跑全 Bot 测试抓取 England 的 goal 命中序列
2. 抓取几个 England 的行动回合快照（`state.spaces['London' 'Lincoln' 'York' 'Berwick']` 的 units/garrison），手动走一遍 `advanceTowardTarget('fortification')` 确认 BFS 是否返回 Edinburgh
3. 若确认 advance 无法推进，检查 `hasEnemyUnitsNotAtWar` 是否误判或 `canAttack(england, scotland)` 的附庸国状态

**相关代码位置**：

- [bot-goals.js:605 `executeSiege`](../../../frontend/src/games/his/ai/bot-goals.js#L605)
- [bot-goals.js:1320 `advanceTowardTarget`](../../../frontend/src/games/his/ai/bot-goals.js#L1320)
- [behavior-cards.js:412 `england_rule_britannia`](../../../frontend/src/games/his/ai/behavior-cards.js#L412)

---

## #2 奥斯曼 3 次宣战 → 0 次攻击（高优先级）

**现象**：
- 奥斯曼在一局内宣战 3 次（多次 `DECLARE_WAR`），但未触发 `ASSAULT` / `MOVE_FORMATION` 到敌方钥匙
- 可能宣战后立即陷入 "无可执行目标" 循环

**推测**：
- 宣战后 `executeSiege` 未能在宣战对象的方向上成功找到阵型/路径
- 奥斯曼的起点空间与 Hapsburg/Venice 钥匙跨海，可能需要海运却未触发 `executeSetSail` 的对陆运输逻辑
- `decideWarDeclaration` 可能选择了不合理的宣战对象（如已被他人削弱的 Venice）

**复现/分析方式**：

1. 在 `bot-phases.js` 的 `decideWarDeclaration` 尾部记录 `{power, target, reason}`
2. 抓取宣战后 Ottoman 的第一个 Action Phase 脉冲，检查 `dispatchGoalAction` 是否返回 END_IMPULSE
3. 检查 `findSiegeTarget` 对 Ottoman 跨海目标的处理（Ottoman→Hungary/Buda 需陆路；Ottoman→Venice 需海运）

**相关代码位置**：

- [bot-phases.js `decideWarDeclaration`](../../../frontend/src/games/his/ai/bot-phases.js)
- [bot-goals.js:605 `executeSiege`](../../../frontend/src/games/his/ai/bot-goals.js#L605)

---

## #3 秋季免费突击：围城方单位不存在仍尝试突击（中优先级）

**现象**：
- 控制台警告：秋季免费突击对某堡垒执行 `ASSAULT`，但该空间无本方单位
- 可能是围城方单位在本回合其他事件（如撤退、死亡）中被移除后，`turnTrack.autumnAssaults` 未同步

**推测**：
- `getFinalAutumnAssaults` 收集时围城方单位尚在，结算时已被移除
- `markAutumnAssaultDone` 只按空间名去重，未校验围城方单位仍存在

**复现/分析方式**：

1. 在 `getNextAutumnAssault` 返回前加校验：`getUnitsInSpace(state, target, power)?.regulars + mercs + cavalry > 0`
2. 若校验为空则跳过并记录事件，观察是否消除警告
3. 回归 `bot-rules.test.js` 确认不破坏现有测试

**相关代码位置**：

- [bot-rules.js `getNextAutumnAssault` / `getFinalAutumnAssaults`](../../../frontend/src/games/his/ai/bot-rules.js)
- [bot-card-play.js `getFinalAutumnAssaults`](../../../frontend/src/games/his/ai/bot-card-play.js)

---

## #4 法国反复 `SUE_FOR_PEACE` 刷屏（低优先级）

**现象**：
- 法国在同一外交段内多次尝试 `SUE_FOR_PEACE`，条件未满足仍反复发起

**推测**：
- `shouldSueForPeace` 条件判定为 true 一次后，未在同段内记录 "已尝试" 标记
- 或 `diplomacySegment` 状态机未正确前进

**复现/分析方式**：

1. 在 `bot-phases.js` `shouldSueForPeace` 返回 true 时记录 `{power, targetPower, reason}`
2. 同时记录对应 action 执行结果
3. 检查外交段幂等标志（是否有 `france.peaceAttempted` 类状态）

**相关代码位置**：

- [bot-phases.js `shouldSueForPeace`](../../../frontend/src/games/his/ai/bot-phases.js)
- [bot-controller.js `decideDiplomacy`](../../../frontend/src/games/his/ai/bot-controller.js)

---

## #5 英格兰在亨利八世被俘后仍重试出 Card #3 (Marital)（低优先级）

**现象**：
- Card #3（King's Marital Status）的 HISBOT 出牌条件要求亨利八世在场 + T2+
- 测试中亨利被俘后，英格兰仍将 #3 作为候选 Home 卡打出

**推测**：
- `evaluateHomeCard` 对英格兰 Home 卡的亨利存活校验不完整
- 或 `isLeaderCaptured('henry_viii')` 检查未正确挂载

**复现/分析方式**：

1. 单元测试：构造 Henry VIII 在 `state.capturedLeaders` 中的状态，调用 `evaluateHomeCard(state, 'england', 3)`，预期返回 null 或 "not_eligible"
2. 若现有测试未覆盖此分支，补加测试后修正实现

**相关代码位置**：

- [bot-card-play.js `evaluateHomeCard`](../../../frontend/src/games/his/ai/bot-card-play.js)

---

## #6 哈布斯堡 SPRING_DEPLOY 目标断联（Vienna→Tunis 案例）（中优先级）

**现象**：
- 哈布斯堡春季部署时，将 Vienna 单位部署到 Tunis（跨海 + 非直连），引擎报错或忽略
- 典型事件日志：`spring_deploy` 目标与 source 无连接

**推测**：
- `decideSpringDeploy` 在战时选择 "最近敌方钥匙" 时未限制可达性（BFS 距离 vs. 海运距离混淆）
- 或对 Hapsburg 的 "Vienna/Madrid 双首都" 逻辑选错了分发点

**复现/分析方式**：

1. 构造 Hapsburg 对 Ottoman 开战 + Tunis 为近敌钥匙的 state
2. 调用 `decideSpringDeploy(state, 'hapsburg')`，检查返回的 movements 是否合法
3. 校验 source→target 在 `weightedDistance` 下应 ≤ 4 格且路径合法

**相关代码位置**：

- [bot-phases.js `decideSpringDeploy`](../../../frontend/src/games/his/ai/bot-phases.js)
- [bot-helpers.js `weightedDistance`](../../../frontend/src/games/his/ai/bot-helpers.js)

---

## #7 哈布斯堡强制 Card #13 触发条件（低优先级）

**现象**：
- Card #13（Charles V 移动/Home 卡强制）触发条件判定可能过宽或过窄
- 未在可疑时机打出，或在不该打出时打出

**推测**：
- HISBOT §6 规定 Hapsburg Home Card: "如果 Charles V 不在德语区或匈牙利本土 + 与 Ottoman/Protestant 开战"
- 实现可能漏了 "与 Protestant 开战" 分支，或 "德语区定义" 不完整

**复现/分析方式**：

1. 对照 [HISBOT_REF.md §6](HISBOT_REF.md#6-home-card-criteria) Hapsburg Home Card 条款
2. 单元测试 `bot-card-play.test.js` 中 Hapsburg Home Card 分支：构造 Charles V 在各区域 × 战争状态组合，验证 `evaluateHomeCard` 返回值

**相关代码位置**：

- [bot-card-play.js `evaluateHomeCard` - Hapsburg 分支](../../../frontend/src/games/his/ai/bot-card-play.js)

---

## 整体修复建议顺序

当重跑基线测试后，建议按以下顺序逐条分析：

1. **#3（秋季突击守卫）** — 改动范围最小（新增一处空单位校验），独立可测
2. **#2（Ottoman 宣战无攻击）** — 最影响 Bot 战略表现
3. **#1（England 造舰+零突击）** — 需要比较完整的 goal 路径追踪
4. **#5（England Marital）** & **#7（Hapsburg Card #13）** — 纯 Home 卡判定分支，可单元测试驱动
5. **#6（Hapsburg 春季部署）** — 需构造具体 state 复现
6. **#4（France 求和刷屏）** — 日志噪声问题，优先级最低

---

## 数据归档建议

每次基线测试运行后，建议保存：

- `state.history`（完整行动序列）
- 按势力统计的 action 分布（如 `OTTOMAN: {DECLARE_WAR: 3, ASSAULT: 0, ...}`）
- 控制台警告 + 事件日志
- 胜方 / 败方 / VP / 宗教空间数等关键指标

保存位置建议：`docs/games/his/test/runs/YYYY-MM-DD_全bot/` 目录，便于跨修复对比。
