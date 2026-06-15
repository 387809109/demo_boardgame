# HIS 实机测试要求（Playwright UI 交互测试）

## 测试性质

通过 Playwright 模拟真人浏览器操作进行端到端测试。

- **Claude 控制的势力**：根据 HISBOT 决策逻辑决定行动，但通过 Playwright 模拟点击来执行——经过真实的 UI 输入路径，而非直接调用引擎内部接口
- **其余 5 个势力**：由内部 HISBOT 自动运行（直接 executeMove）
- **测试覆盖**：游戏引擎层 + UI 交互层（按钮、面板、地图交互、多步骤操作流程）

---

## 测试目标

完整跑完 HIS 全局 7 个回合（T1–T7），验证引擎与 UI 在协同下能稳定运行。

---

## 开局方式

### 新对局

在浏览器控制台执行，指定 Claude 控制的势力，其余 5 个为内部 HISBOT：

```javascript
window.app._startHisGame('protestant')   // Claude 扮演新教
window.app._startHisGame('hapsburg')     // Claude 扮演哈布斯堡
// 以此类推
```

### 读档继续

1. 在大厅点击「📂 读档」加载存档（存档中已有人类势力）
1. 若需要切换 Claude 控制的势力：

```javascript
window.app._addBotPower('protestant')   // 将旧人类势力转为 bot
window.app._takeOverPower('hapsburg')   // Claude 接管哈布斯堡
```

---

## Claude 的行动流程

每轮到 Claude 控制的势力行动时：

1. **读取游戏状态**：通过 Playwright 截图或 `window.app.currentGame.getState()` 获取当前状态
1. **根据 HISBOT 逻辑决策**：按照 HISBOT 规则（行为牌目标优先级、事件牌判断表等）决定本次行动，但卡牌打法见下方覆盖说明
1. **通过 Playwright 模拟点击执行**：找到对应 UI 元素并点击，走真实的 UI 输入路径
1. **验证结果**：确认 UI 正确响应后继续

Claude 的决策以 HISBOT 为基础，但对**卡牌打法**做如下覆盖：

> 每张手牌**优先尝试打出事件效果**；只有当事件效果对当前势力无益（例如敌方事件、当前条件不满足）时，才改为用作 CP。目标选择、外交、战斗等其余决策仍遵循 HISBOT 规则。执行方式一律用 Playwright 点击。

---

## 存档规则

- 每回合 `victory_determination` 阶段结束后通过 UI 存档按钮存档一次
- 发现 bug 时，修复后从最近存档继续，不重开新局
- **测试完整结束后**（无论正常通关还是游戏结束），通过 UI 删除本次测试产生的所有存档

---

## 游戏设定要求

- 所有阶段按真实规则执行，不得跳过或强制推进
- 外交阶段（宣战、求和、谈判）必须正常执行
- 战斗必须自然发生
- **统治胜利**：若测试任务中没有明确指定是否启用，则使用默认设置（**启用**）；否则按照任务指示选择设置

---

## Bug 处理原则

- Bot 卡住不动 = 引擎 bug，必须排查修复
- UI 无响应 / 点击无效 = UI bug，必须排查修复
- 查看控制台 `[BOT CHAIN BROKEN]` 日志定位引擎问题
- 修复后从最近存档恢复继续

**禁止的捷径：**

| 捷径 | 后果 |
| --- | --- |
| 外交阶段 force-pass | 无宣战 → 全程零战斗 |
| 用控制台直接 executeMove 代替 Playwright 点击 | 绕过 UI 测试，失去测试意义 |
| bot 卡住时手动推进 | 掩盖 bug |
| 重开新局而非读档 | 丢失测试进度 |

---

## 确定性 UI 测试机制（高效覆盖，免靠运气）

整局 Playwright 实跑（本文档主体）成本高、靠抽牌运气才能触发某些面板。为高效覆盖**所有 UI 交互**，引入两层确定性机制（与引擎 gate-parity 覆盖测试同理念）：

### A. UI 门控覆盖测试（node 环境，免浏览器，CI 友好）

把「某状态下某势力能做/看到什么」的渲染契约抽成**纯函数**，穷举断言：

- [`ui-gating.js`](../../../../frontend/src/games/his/ui/ui-gating.js) — `handCanPlay` / `isActionPanelActive` / `activePanelKey`（唯一真源；此前 `canPlay` 在 ui.js 两处 + action-panel.js 重复，正是 UI-2「Diet 手牌不可点」的根因）。
- [`ui-gating.test.js`](../../../../frontend/src/games/his/ui/ui-gating.test.js) — 穷举 `{阶段 × 势力 × 待决叠加层}`，含 UI-1/UI-2 回归用例。
- [`turn-display.js`](../../../../frontend/src/utils/turn-display.js) + 测试 — UI-1 回合横幅（`turn` 优先于 `turnNumber`）。

> 关键：本会话 Playwright 发现的两个 bug 都是**纯 `state → 渲染` 契约 bug**，根本不需要浏览器即可复现/防回归。优先用本层穷举，浏览器只跑集成确认。

### B. 确定性发牌 `forceHands`（按需触达卡驱动路径）

`rngSeed`（[rng.js](../../../../frontend/src/games/his/state/rng.js)）固定洗牌/掷骰；`forceHands` 进一步**指定开局手牌**，无需靠运气抽到目标卡即可走到「打某事件 / RESPONSE 卡 / 召集辩论」等路径：

```js
window.app._startHisGame('protestant', { rngSeed: 42, forceHands: { protestant: [110, 82] } })
```

- 经 [state-init.js](../../../../frontend/src/games/his/state/state-init.js) → [phase-card-draw.js](../../../../frontend/src/games/his/phases/phase-card-draw.js) `applyForcedHands`；**一次性**（首个 card_draw 后清空）；`forceHands` 为空时生产路径零影响。
- 指定的非家牌精确成为该势力手牌 + 其家牌；其余势力正常发牌。

### C.（后续，可选）少量种子化 Playwright golden-path `.spec.js`

仅用真实浏览器验证 jsdom 验不到的部分：SVG `<polygon>` 命中、HMR 重载 + 存读档往返、真实 pointer 事件。每个用 `rngSeed`+`forceHands` 钉死，约 5 条，非穷举。

> 边界：「所有 UI 交互」不可能逐状态穷举；可达目标是**每个面板/控件的契约全覆盖 + 任意失败可确定性复现**——A+B 已提供，C/D 增强集成信心。
