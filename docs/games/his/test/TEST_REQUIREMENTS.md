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

---

## 游戏设定要求

- 所有阶段必须按真实规则执行，不得人工跳过或强制推进
- 外交阶段（宣战、求和、谈判）必须正常执行
- 战斗必须自然发生（外交宣战 → 行动阶段触发战斗目标）

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
