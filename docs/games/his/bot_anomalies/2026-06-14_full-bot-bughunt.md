# 全 Bot 9 回合测试 — 加量猎 bug + 修复验证 — 2026-06-14（第三轮）

> 测试日期: 2026-06-14（同日第三轮，稳定性复验之后）
> 测试形式: Playwright MCP 全 Bot 引擎回归（`window.app._startHisGame(null, { dominationVictoryEnabled: false })`），默认 `r = 0`
> 牌堆洗牌每局随机（非种子化），独立对局
> 动机: 第二轮 6 局虽全干净，但异常为间歇性——加大样本量（8 局）专项猎残余 bug
> 结果: 捕获并修复 **#Z**（卡 55 Jesuit Education 缺 `jesuitFoundingEnabled` 门控）；修复后 8 局 0 stuck / 0 chain broken

---

## Step 0 验证结论 — 先前异常基线全部保持

全程（猎 bug 局 + 修复后 8 局）先前 #F–#X 修复均未回归（任意签名 0 次）。
唯一新发现为 #Z（下述），与先前修复无关。

---

## #Z 卡 55 Jesuit Education 缺 `jesuitFoundingEnabled` 门控 — ✅ 已修复

**现象**：

- `[BOT STUCK] papacy PLAY_CARD_EVENT {"cardNumber":55} → Society of Jesus must be played first`
- 加量猎 bug 第 1 局即捕获（papacy 持卡 55 但本局尚未打出 Society of Jesus）

**根因**：

- 卡 55 (Jesuit Education) 引擎 `validate` 要求 `state.jesuitFoundingEnabled`（须先打出 Society of Jesus 启用耶稣会大学），见 [event-actions-extended.js:15](../../../../frontend/src/games/his/actions/event-actions-extended.js#L15)
- bot `score`/`shouldPlay` 仅 `p === 'papacy' ? 1.0`，未镜像 `jesuitFoundingEnabled`
- 启用前 bot 仍路由 event → 引擎拒绝 → `[BOT STUCK]`（与 #R piracyEnabled 完全同型）

**复现/分析方式**：

1. `state.jesuitFoundingEnabled = false`，`shouldPlayEvent(state, 'papacy', 55)` 应为 false
2. 对照 `EXTENDED_EVENT_HANDLERS[55].validate` 的 `!state.jesuitFoundingEnabled` 短路

**相关代码位置**：

- [bot-event-criteria.js 卡 55](../../../../frontend/src/games/his/ai/bot-event-criteria.js) — `shouldPlay`+`score` 加 `!!s.jesuitFoundingEnabled`
- [event-actions-extended.js:13-19](../../../../frontend/src/games/his/actions/event-actions-extended.js#L13-L19) — 卡 55 `validate`
- [event-actions.js:581](../../../../frontend/src/games/his/actions/event-actions.js#L581) — Society of Jesus 设置 `jesuitFoundingEnabled = true`（唯一来源）

**修复**：卡 55 `shouldPlay`+`score` 加 `!!s.jesuitFoundingEnabled` 前置；未启用时返回 false/0 → 走 CP 路径。

**验证**：修复后 8 局 `Society of Jesus must be played first` **0 次**。更新卡 55 单测为双态断言（启用前 false / 启用后 true）。

**状态**：✅ 已修复

> 备注：耶稣会门控仅卡 55 一处（全代码库 `jesuitFoundingEnabled` 仅此 validate 引用）。

---

## 修复后验证（8 局独立对局）

| # | 结束 | 胜者 | actions | stuck |
|---|---|---|---|---|
| 1 | T9 time_limit | france | 1255 | 0 |
| 2 | T9 time_limit | france | 1256 | 0 |
| 3 | T9 time_limit | france | 1239 | 0 |
| 4 | T9 time_limit | france | 1229 | 0 |
| 5 | T8 standard_victory | france | 1147 | 0 |
| 6 | T9 time_limit | hapsburg | 1226 | 0 |
| 7 | T9 time_limit | france | 1264 | 0 |
| 8 | T9 time_limit | france | 1257 | 0 |

- **8 局全 0 `[BOT STUCK]`、0 `[BOT CHAIN BROKEN]`**；#Z 不再复现
- 胜者分布：**France 7 / Hapsburg 1**

---

## 行为/平衡性观察（持续，仅记录）

### #Y France 一边倒胜出（持续）— ⏳ 记录（AI 平衡调优候选）

- 本轮 8 局 France 7/8（另 1 局 Hapsburg）；累计跨三轮：复验 6/6 + 终验 4/5 + 本轮 7/8
- 与 [2026-06-14_full-bot-stability-reverify.md](2026-06-14_full-bot-stability-reverify.md) #Y 同一观察，证据进一步加强
- 非引擎缺陷（引擎结算全程 0 异常）；归 HISBOT 行为层平衡调优，本轮不动代码

---

## 整体结论

| 维度 | 结论 |
|---|---|
| 新引擎异常 | #Z（卡 55 jesuit 门控）✅ 已修复 |
| Step 0 回归 | #F–#X 全程零回归 |
| 修复后验证 | 8 局 0 stuck / 0 chain broken |
| 行为观察 | #Y France 一边倒持续（7/8），AI 平衡调优候选 |

**方法学补记**：第二轮"6 局全干净"是该样本结论；加大到 8+ 局后仍能暴露间歇性 #Z，说明猎 bug 需要足够样本量。`jesuitFoundingEnabled`（#Z）与 `piracyEnabled`（#R）同属"需前置事件解锁的二阶事件卡"模式——此类卡应统一审查 bot 侧是否镜像解锁前置。

---

## 数据归档

- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1
- setTimeout 加速：300–2000 ms 压到 40 ms（~40min 对局压到 ~75–85s）
- 牌堆洗牌每局随机（非种子化）
- 猎 bug 局：第 1 局即捕获 #Z（papacy 卡 55）；该批因源码热更新（Vite HMR）中断，#Z 已定位即足够
- 修复后 8 局：T8–T9，France 7 / Hapsburg 1，0 stuck / 0 chain broken
- 基线代码：commit `99371b7` + #Z 修复（本轮新增）；2483 HIS 单测通过
- 先前修复（#F–#X、Inquisition、Phase G/H）跨各局均未回归
