# 全 Bot 批量分析异常清单 — 2026-06-19

> 测试日期: 2026-06-19
> 测试形式: **node 确定性批量回归**（非 Playwright）——
> [`frontend/src/games/his/ai/bot-analysis.test.js`](../../../../frontend/src/games/his/ai/bot-analysis.test.js)
> 用 vitest fake timers 驱动真实 bot loop（`scheduleBotAction`），12 个种子（1000–1011）全 Bot 跑满整局，
> `dominationVictoryEnabled: false`。该工具默认 `describe.skip`，按需取消跳过即可复跑。
> 结果: 12 局全部跑完到终局；胜方分布见下；引擎稳定性修复 1 项。
> 已修复: **#1 [BOT CHAIN BROKEN] 假阳性**（本轮触发并已修，见下）。

---

## 批量数据（种子 1000–1011）

| 指标 | 值 |
| --- | --- |
| 胜方分布 | **france 7** / england 2 / protestant 2 / hapsburg 1 / ottoman 0 / papacy 0 |
| 胜利类型 | time_limit 9 / religious_victory 2 / standard_victory 1 |
| 平均回合 | 8.7（多数跑满 T9） |
| 平均新教空间 | 35.1（2 局到 50 触发宗教胜利） |
| **新宣战数（war_declared）** | **0（全程，所有势力）** |
| 平均每局战斗数 | 4.5 |
| 各势力发起战斗 | ottoman 12 / england 15 / hapsburg 11 / france 10 / papacy 6 / protestant 0 |
| stuck / chainBroken（修复后） | **0 / 0**（修复前 6 / 2） |

---

## #1 ✅ 已修复 — [BOT CHAIN BROKEN] 假阳性（对局结束后仍调度 bot）

- **现象**: 种子 1003、1006 各出现 `[BOT STUCK]`×3 + `[BOT CHAIN BROKEN]`×1。捕获错误均为
  `protestant phase: action ... → Game is not running`（END_IMPULSE / PASS 全部因 "Game is not running" 失败）。
- **推测（已证实）**: 即时胜利（军事 auto-win / 宗教胜利）可在**行动阶段中途**结束对局——
  `engine.executeMove` 内 `checkGameEnd().ended` 置 `isRunning=false`，但 `state.phase` 仍是 `action`、
  `activePower` 仍是 bot。`getNextActingBotPower` 旧版**只看 phase 不看 status**，于是继续返回该 bot →
  尾随的一次 bot 动作链全部命中 `if (!this.isRunning) 'Game is not running'` → 误报 chain broken。对局其实已正常结束。
- **复现分析方式**: `bot-analysis.test.js` 跑种子 1003/1006；或单测
  `bot-controller.test.js` › `scheduleBotAction — game-over guard`。
- **相关代码位置**: `ai/bot-controller.js` `getNextActingBotPower`（已加 `if (state.status && state.status !== 'playing') return null;`）；
  `game/engine.js:167-171` 置 `isRunning=false`。
- **修复**: 守卫已加；批量复跑 stuck/chainBroken 归 0，胜负结果完全不变（仅消除结束后的尾随日志）。
  并加回归单测 2 条。**附带收益**: `bot-fullgame.test.js` 的 `chainBroken===0` 断言此前对会触发行动阶段即时胜利的
  种子是脆的，现已稳健。

---

## #2 ℹ️ 已结案（仅复核）— 法兰西支配

- **现象**: 12 局中 france 胜 7（58%），ottoman / papacy 零胜。
- **状态**: **此即已结案的 #Y**——[`2026-06-15_france-dominance-analysis.md`](2026-06-15_france-dominance-analysis.md)
  已用 VP-by-source 遥测定因（France 的 run 优势 100% 来自城堡 Chateaux VP 引擎），判为
  **可接受的 HIS 固有非对称，决定不改平衡**。本轮 7/12 与当时 ~5/8 同量级，**不重开**该决策。
- **处置**: 无需动作。若将来要再压低，方向是 #3（更主动的外交可能改变格局），而非直接改计分。

---

## #3 ⚠️ 行为偏差（只记录）— 全程零新宣战

- **现象**: `war_declared` 事件**全程为 0**（所有势力、所有局），但战斗仍发生（均 4.5/局）——
  即战斗**全部来自 1517 开局既有战争状态**，外交阶段从不新增战争。
- **推测**: 外交阶段 bot 决策实质恒为 PASS（`decideDiplomacy` 当前为偏保守/桩实现），从不主动 `DECLARE_WAR`。
  这限制了战略变化（战线固定为开局格局）。注意：这与 `TEST_REQUIREMENTS` 警示的「force-pass → 零战斗」
  不同——此处仍有战斗（开局战争），但**无任何新宣战**。
- **复现分析方式**: 同上批量；看 `warDeclares=0` 与 `battlesBy` 同时存在。
- **相关代码位置**: `ai/bot-controller.js` `decideDiplomacy`；`ai/bot-negotiation.js`。
- **处置**: **不在本轮修**（行为调优）；列入 PLAN「行为调优待办」，与 #2 一并评估（更主动的外交可能也改变 #2 的平衡）。

---

## 整体修复建议顺序

1. ✅ #1 已修（引擎稳定性，已完成）。
2. #3 外交主动性（恒 PASS → 适度 DECLARE_WAR）——唯一仍开放、可操作的行为调优项；列入 PLAN「行为调优待办」。
3. #2 已结案（接受的非对称），无需动作。

## 数据归档

复跑命令（生成本表数字，先取消该文件 `describe.skip`）：

```bash
npx vitest run src/games/his/ai/bot-analysis.test.js
```
