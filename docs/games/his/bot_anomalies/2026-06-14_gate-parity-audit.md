# 门控对齐静态审查 — #AA / #AB — 2026-06-14（第四轮）

> 审查日期: 2026-06-14（同日第四轮，bughunt #Z 之后）
> 形式: **静态审查**（非随机对局）——以 [state-init.js](../../../../frontend/src/games/his/state/state-init.js) 声明的布尔门控为锚，对每个标志建「设置点 → 引擎读取点 → bot 镜像点」三联表
> 动机: #Z 暴露「需前置事件解锁的二阶门控」模式后，统一穷举该类卡，避免再靠随机对局碰巧触发
> 结果: 挖出 **3 个真 bug**（随机对局零报警，因双 bug 互相掩盖）；已按"统一/接线"方式修复

---

## 为什么静态审查能查出随机对局查不出的 bug

全-bot 测试只在「bot 路由了引擎拒绝的动作」时报 `[BOT STUCK]`。但当**引擎死门控**与**bot 自我拦截**同时存在时，bot 先拦截、引擎门控永不触发 → **零日志**。本轮 jesuit 集群正是此型：连续多轮全-bot 测试一次都没报过，静态三联表一查即现。

---

## 三联表（关键项）

| 标志 | 设置(true) | 引擎门控读取 | bot 镜像 | 判定 |
| — | — | — | — | — |
| `piracyEnabled` | ✅ Barbary Pirates ([event-actions.js:447](../../../../frontend/src/games/his/actions/event-actions.js#L447)) | 卡84/89·建海盗·劫掠 | ✅ #R | ✅ 完好 |
| `jesuitFoundingEnabled` | ✅ Society of Jesus ([event-actions.js:581](../../../../frontend/src/games/his/actions/event-actions.js#L581)) | 卡55 | ✅ #Z | ✅ 完好（本轮升为 canonical） |
| `edwardBorn` | ✅ [event-actions.js:410](../../../../frontend/src/games/his/actions/event-actions.js#L410) | 卡116 Rough Wooing | ✅ | ✅ 完好 |
| `lutherPlaced` | ✅ turn1 ([phase-luther95.js:43](../../../../frontend/src/games/his/phases/phase-luther95.js#L43)) | 卡7/卡37/response | ⚠️ 未显式（turn1 即真） | ✅ 实质安全 |
| `schmalkaldicLeagueFormed` | ✅ [event-actions.js:529](../../../../frontend/src/games/his/actions/event-actions.js#L529) | Protestant 参战 | ✅ 无行为牌以 prot 为 war 目标 | ✅ 安全 |
| `augsburgConfessionActive` | ✅ event:1132（winter 重置） | 改革修正值（非门控） | n/a | ✅ 良性 |
| `printingPressActive` | ✅ extended:882 | 改革修正值（非门控） | n/a | ✅ 良性 |
| `elizabethBorn` | ✅ event:413 | 仅 UI | n/a | ✅ 仅展示 |
| **`jesuitUnlocked`** | ❌ **从不设置** | FOUND_JESUIT ([religious-actions.js:434](../../../../frontend/src/games/his/actions/religious-actions.js#L434)) | — | ❌ **#AA 死门控** |
| **`englandRulerChangedThisTurn`** | ❌ **从不设置** | 卡59 Lady Jane Grey ([event-actions-extended.js:128](../../../../frontend/src/games/his/actions/event-actions-extended.js#L128)) | ✅ 镜像永假标志(#V) | ❌ **#AB 死门控** |
| **`societyOfJesusPlayed`** | ❌ **从不设置** | — | bot executeJesuits ([bot-goals.js:1001](../../../../frontend/src/games/his/ai/bot-goals.js#L1001)) | ❌ **#AA 掩盖体** |

---

## #AA Jesuit 集群（一概念三名字，断成两截）— ✅ 已修复

**现象**：连续多轮全-bot 测试零报警，但「教廷花 CP 建耶稣会大学」(FOUND_JESUIT, §4.19) 从未在对局中发生。

**根因**：同一概念「Society of Jesus 已打出」被三个不同名字表示，互不连通：

- `jesuitFoundingEnabled` —— Society of Jesus (卡15) **唯一实际设置**的标志，卡55 读它（✅ 此链正常）
- `jesuitUnlocked` —— FOUND_JESUIT 动作读它，但**生产代码从无 setter**（仅 state-init 初始化为 false）→ 动作永久被拒
- `societyOfJesusPlayed` —— bot executeJesuits 读它，亦**从无 setter** → bot 永不路由该动作

**掩盖链**：bot 先因 `societyOfJesusPlayed` 永假而自我拦截 → 引擎 `jesuitUnlocked` 死门控永不触发 → `[BOT STUCK]` 零次。

**修复**：统一为单一 canonical 标志 `jesuitFoundingEnabled`（已在用且 #Z 刚测过）：

- [state-init.js](../../../../frontend/src/games/his/state/state-init.js) — 声明 `jesuitFoundingEnabled: false`，删除死标志 `jesuitUnlocked`
- [religious-actions.js:434](../../../../frontend/src/games/his/actions/religious-actions.js#L434) — FOUND_JESUIT 改读 `jesuitFoundingEnabled`
- [bot-goals.js:1001](../../../../frontend/src/games/his/ai/bot-goals.js#L1001) — executeJesuits 改读 `jesuitFoundingEnabled`，删除 `societyOfJesusPlayed`
- 测试：religious-actions.test.js / bot-goals.test.js 旧标志引用统一重命名

**效果**：Society of Jesus 打出后，教廷与 papacy-bot 恢复「建耶稣会大学」能力。

**状态**：✅ 已修复

---

## #AB England 换君标志从不设置（卡59 Lady Jane Grey 永久不可打）— ✅ 已修复

**现象**：卡59 Lady Jane Grey 引擎要求 `englandRulerChangedThisTurn`，但换君链路 `replaceRuler`（henry→edward→mary→elizabeth，卡19/21/23）**从不设它**，亦无回合重置 → 卡59 永久打不出。

**与 #V 的关系**：#V 此前让 bot 镜像 `englandRulerChangedThisTurn`（永假）以消除 `has not changed rulers` 的 stuck —— 这是**治标**：bot 绕开了一张谁都打不出的牌。本 #AB 治本：接上 setter，卡59 恢复可打，#V 镜像随之正确生效（换君当回合才打）。

**修复**：

- [event-actions.js `replaceRuler`](../../../../frontend/src/games/his/actions/event-actions.js#L43) — `power === 'england'` 时置 `state.englandRulerChangedThisTurn = true`（覆盖卡19/21/23 三次换君）
- [phase-winter.js `resetTurnState`](../../../../frontend/src/games/his/phases/phase-winter.js) — 紧邻 augsburg 重置处加 `state.englandRulerChangedThisTurn = false`（"this turn" 语义：换君当回合有效，回合末清）
- [state-init.js](../../../../frontend/src/games/his/state/state-init.js) — 声明 `englandRulerChangedThisTurn: false`
- 测试：event-actions.test.js（#19 后置真）+ phase-winter.test.js（winter 重置）各加 1 断言

**状态**：✅ 已修复

---

## 已澄清/无害（无需改）

- `lutherPlaced` bot 未显式镜像 → 纯理论（turn1 即置真，卡7/37 可打前必为真）
- `schmalkaldicLeagueFormed`：14 张行为牌 war 目标无一为 protestant → bot 永不路由「对 Protestant 宣战」，结盟前门控碰不到

## 死标志（记录，本轮不改 — 无路由风险，属未完成特性）

- `algiersInPlay`：state-init 声明但**全代码库无人读写** → 死声明（疑似 Barbary/Algiers 特性未完成）
- `wartburgActive`：同上死声明（卡37 The Wartburg 改用 `pendingEventCancelled` 实现）
- `juliaGonzagaActive`：extended:731 设置但**无人读取** → 死 setter（卡84 残留效果未消费；属"效果完整性"另一类，非门控对齐）

> 以上三项不影响引擎正确性与 bot 路由，归 HISBOT/引擎特性完善待办。

---

## 验证

**① 单测**：48 文件 / **2485 通过**（2483 → +2：Edward VI 置标志、winter 重置）

**② 确定性集成检查**（浏览器内 dynamic import 真实模块，隔离 state，端到端）：

| 检查 | 结果 |
| — | — |
| #AA `jesuitUnlocked` 已从 state 移除 | ✅ |
| #AA Society 前 FOUND_JESUIT 拒绝（`Jesuits not yet unlocked`） | ✅ |
| #AA Society 后 `validateFoundJesuit` 通过 + `foundJesuit` 落子成功 | ✅ |
| #AB 换君前卡59 拒绝（`England has not changed rulers this turn`） | ✅ |
| #AB `englandRulerChangedThisTurn=true` 后卡59 通过 | ✅ |

> 此为关键正向证据：全-bot 概率性触发不到这两条路径（见下），但确定性检查证明它们已复活并端到端可用。

**③ 全-bot 活体（8 局独立对局）**：

- **8 局全 T9，0 `[BOT CHAIN BROKEN]`**
- **#AA/#AB 相关：0 stuck**。其中 **4 局打出 Society of Jesus**（`jesuitFoundingEnabled=true`）均 0 stuck → 死门控确已撤除（修复前此处被 bot 自我拦截而静默；修复后路径开放且不报错）
- 新签名 `not yet unlocked` / `England has not changed` **0 次**；#F–#Z 任意签名 **0 次**（零回归）
- England 换君事件本批未抽到（概率性，故卡59 未活体触发；已由 ② 确定性覆盖）
- 胜者：France 8/8（#Y 持续，非引擎缺陷）

**④ 顺带发现 #AC（与本次改动无关，已记录）**：

- `[BOT STUCK] hapsburg SPRING_DEPLOY {from:"Vienna", to:"Tunis"} → No valid spring deployment path`（8 局中 1 次，已被兜底链恢复，0 chain broken）
- 属 bot 春季部署落点寻路 vs 引擎路径校验不对齐（同 #F/#G/#K 类，**非** gate-parity，**不涉** jesuit/england 改动）
- 春季部署子系统的独立异常，归后续单独处理

---

## 整体结论

| 维度 | 结论 |
| — | — |
| 审查方法 | 静态三联表（setter→reader→bot），按语义族而非单一命名 |
| 新发现 | #AA jesuit 集群（3 名字）、#AB england 换君 —— 均为随机对局测不出的死门控 |
| 修复 | 统一 canonical 标志 + 接线 setter/reset；启用此前静默禁用的 FOUND_JESUIT 与卡59 |
| 死标志 | algiersInPlay / wartburgActive / juliaGonzagaActive 记录待办 |
| 单测 | 2485 通过 |

**方法学补记**：`jesuitUnlocked`(#AA) 第一次 grep `Enabled` 未命中——解锁标志命名不统一（`*Enabled`/`*Unlocked`/`*Played`/...），审查必须按语义族穷举。「引擎死门控 + bot 自我拦截」的双 bug 对卡死检测完全隐形，唯静态对照可揭示。
