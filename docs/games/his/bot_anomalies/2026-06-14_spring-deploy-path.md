# #AC 春季部署落点未校验路径 — 2026-06-14（第五轮）

> 来源: 门控对齐审查（第四轮）的全-bot 验证轮顺带捕获
> 形式: 同一「bot 路由 vs 引擎校验」对齐方法，应用到春季部署子系统
> 结果: 定位根因（AtPeace 分支返回前不校验路径）并修复（镜像 AtWar 分支的先校验后路由）

---

## 现象

- `[BOT STUCK] hapsburg SPRING_DEPLOY {"from":"Vienna","to":"Tunis",...} → No valid spring deployment path`
- 8 局门控验证批次中 1 次（已被兜底链恢复，0 chain broken，跑满 T9）
- hapsburg 试图从 Vienna 春季部署到 Tunis（跨地中海，无有效陆路），引擎拒绝

---

## 根因（与 #F/#G/#K 同类：bot 路由 vs 引擎校验不对齐）

bot 有两个春季部署决策分支（[bot-phases.js](../../../../frontend/src/games/his/ai/bot-phases.js)）：

| 分支 | 行为 | 路径校验 |
| — | — | — |
| `decideSpringDeploymentAtWar` | 朝敌方关键空间部署 | ✅ 返回前 `validateSpringDeployment(...).valid`（line 574） |
| `decideSpringDeploymentAtPeace` | 向己控、单位最少的关键空间移 1 单位 | ❌ **选定 bestKey 后直接返回，从不校验**（旧 line 632） |

引擎 `validateSpringDeployment`（[phase-spring-deployment.js:147](../../../../frontend/src/games/his/phases/phase-spring-deployment.js#L147)）在 line 230 调用 `canTraceSpringDeploymentPath` 校验路径可达性，不可达则 line 238 返回 `No valid spring deployment path`。

AtPeace 按"己控、单位最少、非本土优先"评分选 `bestKey`，但**未镜像该路径前置**——当最优落点（如 Tunis）从源首都不可达时，bot 仍路由 → 引擎拒绝 → `[BOT STUCK]`。

> 为何只在 AtPeace 出现：AtWar 已在 line 574 校验，任何返回动作必合法；唯一未校验的返回点是 AtPeace。England 经 Home 牌宣战时走 AtWar 例外，亦已校验。

---

## 修复

将 `decideSpringDeploymentAtPeace` 改为镜像 AtWar 模式——按优先级遍历（destination key × source capital），`validateSpringDeployment` 通过才返回，逐一回退；均不可达则返回 null（→ 上层 `decideSpringDeployment` 返回 PASS，安全跳过本阶段，见 [bot-controller.js:339-342](../../../../frontend/src/games/his/ai/bot-controller.js#L339)）。

- 候选源首都：己控、单位超出驻军需求
- 候选落点：己控关键空间（非首都），按"单位最少 + 非本土优先"排序
- 对每个（落点, 首都）组合校验路径，返回首个合法者

保留 §2.9「单位最少关键空间」偏好，仅额外跳过不可达落点。该修复为**严格收紧**：只增加校验过滤，不会引入新动作（最坏 PASS），故不可能引入新 stuck。

**相关代码**：[bot-phases.js `decideSpringDeploymentAtPeace`](../../../../frontend/src/games/his/ai/bot-phases.js#L588)

---

## 验证

- **单测**：48 文件 / **2486 通过**（+1：`#AC` 回归用例——和平态下最优落点非法时，bot 绝不路由引擎会拒的部署）
- **全-bot 活体（6 局独立对局）**：6 局全 T9，**0 `[BOT STUCK]`、0 `[BOT CHAIN BROKEN]`、0 春季部署 stuck**（`No valid spring deployment path` 0 次）。#AC 不再复现。

---

## 整体结论

| 维度 | 结论 |
| — | — |
| 根因 | AtPeace 分支返回前不校验路径（AtWar 已校验） |
| 修复 | AtPeace 镜像 AtWar：先 `validateSpringDeployment` 后路由，回退/PASS |
| 性质 | 严格收紧（仅加校验过滤），不可能引入新 stuck |
| 单测 | 2486 通过 |

**方法学**：门控对齐审查（setter/route → engine-validate）不仅适用事件门控，同样揭示了动作子系统（春季部署）的「bot 路由未镜像引擎前置」缺口。同型历史异常：#F/#G/#K（单位摆渡/移动路径）、#H/#O（LOC）、#R/#Z（事件解锁门控）。
