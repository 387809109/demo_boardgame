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
1. **根据 HISBOT 逻辑决策**：按照 HISBOT 规则（行为牌目标优先级、事件牌判断表等）决定本次行动
1. **通过 Playwright 模拟点击执行**：找到对应 UI 元素并点击，走真实的 UI 输入路径
1. **验证结果**：确认 UI 正确响应后继续

Claude 的决策结果应与 HISBOT 在相同局面下的决策一致——**决策逻辑用 HISBOT，执行方式用 Playwright 点击**。

---

## 存档规则

- 每回合 `victory_determination` 阶段结束后通过 UI 存档按钮存档一次
- 发现 bug 时，修复后从最近存档继续，不重开新局

---

## 游戏设定要求

- 所有阶段按真实规则执行，不得跳过或强制推进
- 外交阶段（宣战、求和、谈判）必须正常执行
- 战斗必须自然发生

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
