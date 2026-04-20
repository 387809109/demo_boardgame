# HIS 实机测试要求（全 Bot 引擎回归测试）

## 测试性质

这是一种**游戏引擎层的回归测试**，通过让 6 个势力全部由 HISBOT 控制来自动跑完整局游戏。

**覆盖范围：**

- 游戏引擎（validateMove / processMove / 所有阶段转换）
- 回合结构完整性（外交 → 行动 → 冬季 → 胜利判定）
- Bot 之间的真实交互（宣战、战斗响应、谈判）
- stateUpdated → UI 渲染链路

**不覆盖：**

- 人类玩家 UI 输入面板（按钮点击、地图交互等）
- 多步骤 UI 操作流程
- 错误反馈 UI 显示

UI 层的测试需要通过 Playwright E2E（`e2e/games/his/`）另行覆盖。

---

## 测试目标

完整跑完 HIS 全局 7 个回合（T1–T7），验证引擎在无人工干预下能稳定运行。

---

## 开局方式

### 新对局

在浏览器控制台执行：

```javascript
// 全 bot 观战（6 势力均为 HISBOT）
window.app._startHisGame()

// 或：指定某一势力由人类控制，其余 5 个为 HISBOT
window.app._startHisGame('hapsburg')
```

`_startHisGame()` 会在 `initialize()` 时完整走 `initBotDecks + placeBotExtraUnits` 流程，T1 的额外单位会正确放置。

### 读档继续

1. 在大厅点击「📂 读档」加载存档
2. 在控制台将存档中的人类势力转为 bot：

```javascript
window.app._addBotPower('protestant')
```

1. 如需切换控制哪个势力（例如改为观察法兰西）：

```javascript
window.app._addBotPower('protestant')   // 原人类势力转为 bot
window.app._takeOverPower('france')     // 从 bot 接管法兰西
```

---

## 存档规则

- 每回合 `victory_determination` 阶段结束后存档一次
- 发现 bug 时，修复后从最近存档继续，不重开新局
- **测试完整结束后**（无论正常通关还是游戏结束），删除本次测试产生的所有存档

---

## 游戏设定要求

- 所有阶段必须按真实规则执行，不得人工跳过或强制推进
- 外交阶段（宣战、求和、谈判）必须正常执行
- 战斗必须自然发生（外交宣战 → 行动阶段触发战斗目标）
- **统治胜利**：若测试任务中没有明确指定是否启用，则使用默认设置（**启用**）；否则按照任务指示选择设置

---

## Bug 处理原则

- Bot 卡住不动 = 代码有 bug，**必须排查修复**，不得绕过
- 查看控制台 `[BOT CHAIN BROKEN]` 日志定位问题
- 修复后从最近存档恢复继续测试

**禁止的捷径：**

| 捷径 | 后果 |
| --- | --- |
| 外交阶段 force-pass | 无宣战 → 无战争状态 → 全程零战斗 |
| bot 卡住时手动执行动作 | 掩盖 bug |
| 重开新局而非读档 | 丢失测试进度 |

---

## 测试执行与异常归档流程

每次全 Bot 回归测试的标准流程如下。最终产物是 `docs/games/his/bot_anomalies/YYYY-MM-DD_<标签>.md`，
用于驱动下一轮 HISBOT 行为调优。

### Step 1 — 执行全 Bot 对局

通过 Playwright MCP 直接驱动浏览器（非脚本化测试），便于实时观察：

```javascript
browser_navigate('http://localhost:5173')
browser_evaluate(() => window.app._startHisGame())   // 6 势力全部为 HISBOT
// 或：window.app._startHisGame('hapsburg') 观察单一势力
```

在每回合 `victory_determination` 结束后存档。发现阻塞性 bug 时**立即停止**、修复、从最近存档继续。

### Step 2 — 实时记录观察

观察以下信号并原始记录到草稿笔记：

- **控制台警告 / 错误**：尤其 `[BOT CHAIN BROKEN]`、非法 action、单位/空间不一致告警
- **势力 action 分布**：某势力是否反复触发同一 goal 却无产出（如多次宣战零攻击、反复造舰零突击）
- **宗教压力曲线**：新教 / 天主教空间数按回合推进
- **胜负终局指标**：胜方、胜利类型、回合数、VP、宗教空间数

### Step 3 — 定位与修复（当局内）

对于**阻塞性** bug（卡住不动、异常报错）：必须当场修复后继续，否则后续观察失真。
对于**行为偏差**（非阻塞，但策略不合理）：**只记录，不在测试中途修复**，避免污染本次样本。

若测试中修改了原版 HISBOT 行为（如添加压力触发、覆写优先级等），**必须**在 [`HISBOT_REF.md`](../HISBOT_REF.md) 的 "实现偏离记录"
章节写明：偏离点、原版行为、触发条件、动机、回归验证方式、还原路径。

### Step 4 — 产出异常清单文档

测试结束后，基于 [`../BOT_PENDING_ANOMALIES.md`](../BOT_PENDING_ANOMALIES.md) 模板，在 [`../bot_anomalies/`](../bot_anomalies/) 下新建：

```text
docs/games/his/bot_anomalies/YYYY-MM-DD_<标签>.md
```

文件名示例：`2026-04-19_full-bot-9turns.md`、`2026-05-03_protestant-only.md`。

每条异常按「现象 / 推测 / 复现分析方式 / 相关代码位置」四段结构书写，并在文末给出
"整体修复建议顺序" 和 "数据归档" 两节。

### Step 5 — 更新索引指针

- 在 [`../PLAN.md`](../PLAN.md) "行为调优待办" 处更新指向最新的 `bot_anomalies/` 文档
- 若本次产生了 HISBOT 偏离，同步更新 [`../HISBOT_REF.md`](../HISBOT_REF.md) 对应章节
- 如有已修复的历史条目，保留链接但标注 "✅ 已修复 (commit XXXXXXX)"

### Step 6 — 提交

提交信息格式：`fix(his): <本次核心修复> + <文档更新>`，例如：

```text
fix(his): papacy defensive override + debater ability tooltip + anomaly docs
```

若本次仅为观察测试（无代码改动），提交信息改为：`docs(his): record 20YY-MM-DD full-bot test anomalies`。

---

## 数据归档建议

`bot_anomalies/` 下的文档可附带下列原始数据（文件命名保持同一日期前缀）：

- `YYYY-MM-DD_*.history.json` — `state.history` 完整行动序列
- `YYYY-MM-DD_*.actions.csv` — 按势力 × action 类型统计
- `YYYY-MM-DD_*.console.log` — 控制台原始日志（过滤 `[BOT]` / `[WARN]`）

便于后续跨轮回归对比与回归脚本提取。
