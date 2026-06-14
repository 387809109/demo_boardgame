# 全 Bot 9 回合测试 — 稳定性复验 + 平衡性观察 — 2026-06-14（第二轮）

> 测试日期: 2026-06-14（同日第二轮，#R–#X 修复 commit `99371b7` 之后）
> 测试形式: Playwright MCP 全 Bot 引擎回归（`window.app._startHisGame(null, { dominationVictoryEnabled: false })`），默认 `r = 0`
> 牌堆洗牌每局随机（非种子化），6 局为 6 局独立对局
> 结果: **引擎层完全干净**——6 局 0 `[BOT STUCK]`、0 `[BOT CHAIN BROKEN]`，全部跑满 T9
> 重点: 复验 #F–#X 全部修复不回归；新一轮无新引擎异常；记录 France 一边倒平衡性观察

---

## Step 0 验证结论 — 先前异常基线全部保持

6 局独立对局，先前所有 `✅ 已修复` 异常均未回归（任意签名 0 次）：

| 编号 | 异常 | 6 局观察 | 状态 |
|---|---|---|---|
| #F/#G/#K | 各方向单位摆渡 | 0 次双向摆渡热路径 | ✅ 已验证 |
| #H/#O | ASSAULT/秋季突击 LOC 缺失 | **0** × `No line of communication` / `No LOC` | ✅ 已验证 |
| #J | T9 SUE_FOR_PEACE 拒绝 | **0** × `final turn` | ✅ 已验证 |
| #L | 无效 RESOLVE_REFORMATION / CALL_DEBATE | **0** | ✅ 已验证 |
| #M/#N | 卡 95 source / 卡 100 Not playable | **0** | ✅ 已验证 |
| #P/#Q | 卡 65/85 Luther / 卡 13 强制前置 | **0** | ✅ 已验证 |
| #R | 卡 84/89 piracy 门控 | **0** × `Barbary Pirates must be played first` | ✅ 已验证 |
| #S | 卡 4 Francis 被俘 | **0** × `Francis I is captured` | ✅ 已验证 |
| #T | 主页卡幻影出牌 | **0** × `Card not in hand` | ✅ 已验证 |
| #U | EXPLORE 探险家误判 | **0** × `No available explorers` | ✅ 已验证 |
| #V | 卡 59 换君前置 | **0** × `has not changed rulers` | ✅ 已验证 |
| #W | DECLARE_WAR 媾和 | **0** × `made peace with this turn` | ✅ 已验证 |
| #X | marital 已满 | **0** × `Cannot advance marital status further` | ✅ 已验证 |
| — | Inquisition / Phase G/H | 评分路径正常，无空 burn | ✅ 已验证 |

**结论**：累计 #F–#X 全部修复在 6 局随机对局中零回归，引擎决策链稳定。

---

## 本轮基线指标（6 局独立对局）

| # | 结束 | 胜者 | 排名 (VP) | actions | events | CP | 宗教 (P/C) |
|---|---|---|---|---|---|---|---|
| 1 | T9 standard_victory | france | france:25 england:17 papacy:12 hapsburg:10 ottoman:8 protestant:8 | 1293 | 79 | 188 | 25/86 |
| 2 | T9 time_limit | france | france:21 england:16 ottoman:12 hapsburg:10 papacy:10 protestant:10 | 1229 | 95 | 167 | 28/83 |
| 3 | T9 time_limit | france | france:23 england:17 ottoman:13 hapsburg:10 protestant:10 papacy:9 | 1304 | 84 | 181 | 31/80 |
| 4 | T9 time_limit | france | france:22 ottoman:12 hapsburg:10 england:10 papacy:10 protestant:9 | 1218 | 86 | 162 | 29/82 |
| 5 | T9 time_limit | france | france:20 protestant:14 hapsburg:13 england:13 ottoman:8 papacy:7 | 1211 | 81 | 169 | 42/69 |
| 6 | T9 time_limit | france | france:24 papacy:12 england:11 hapsburg:10 ottoman:9 protestant:8 | 1299 | 82 | 182 | 26/85 |

- 总计：6 局全 T9，**0 `[BOT STUCK]`、0 `[BOT CHAIN BROKEN]`**
- actions 均值 ~1259（1211–1304）；events 均值 ~84.5；CP 均值 ~175
- 宗教终局 Protestant 空间 25–42（均值 ~30），Catholic 69–86 —— 改革推进存在但未达宗教胜利阈值

---

## 行为/平衡性观察（仅记录，非引擎缺陷）

### #Y France 一边倒胜出（6/6）— ⏳ 仅记录（AI 平衡调优候选）

**现象**：

- 本轮 **France 胜 6/6**，VP 20–25；第二名常为 England（10–17），其余势力 7–13
- 跨轮一致：先前 #R–#X 终验 5 局 France 4/5、#T 验证 5 局 France 3/5；本轮 6/6 为最强信号
- France 不仅胜率高，且 VP 领先幅度大（每局领先第二名 ~5–13 VP）

**推测**：

- 非引擎正确性问题（引擎结算全程 0 异常）；属 HISBOT 行为层平衡 —— France 的行为牌目标优先级 + 主页卡（Chateaux Table VP）+ 关键空间积累使其 VP 增长显著快于其他势力
- 其他势力（尤其 Papacy/Ottoman/Hapsburg）VP 偏低，可能是其行为牌目标对 VP 转化效率较低，或宗教/军事目标未有效转化为 VP
- `r = 0`（确定性 event-vs-cp 阈值）可能放大单一最优策略，降低对局多样性

**复现/分析方式**：

1. 统计各势力 VP 来源构成（关键空间 / 主页卡 / 事件 / 宗教），定位 France 领先的主要 VP 渠道
2. 对比 France 与垫底势力的行为牌目标命中率与 CP 利用率
3. 试以 `r > 0`（如 0.15–0.3）跑多局，观察 event 决策随机化是否提升对局多样性与平衡

**严重性**：低（不影响引擎正确性与测试推进）。属 AI 平衡/调优范畴，非本测试框架（引擎回归）的阻塞项。

**建议**：归入 HISBOT 平衡调优待办，非引擎修复。本轮不动代码（遵循 TEST_REQUIREMENTS Step 3「行为偏差仅记录」）。

---

## 整体结论

| 维度 | 结论 |
|---|---|
| 引擎正确性 | ✅ 6 局 0 stuck / 0 chain broken，#F–#X 全部不回归 |
| 新引擎异常 | 无 |
| 本轮代码改动 | 无（纯复验） |
| 行为/平衡观察 | #Y France 一边倒（6/6），记为 AI 调优候选 |

本轮无需引擎修复——这是 #M–#X 连续多轮修复后的首个完全干净复验局，标志 bot-route vs engine-validate 不对齐类异常已收敛。后续测试重点可从"引擎卡死"转向"AI 平衡/对局多样性"。

---

## 数据归档

- 测试环境：`localhost:5173`，Chrome via Playwright MCP，6 × HISBOT v1.1
- setTimeout 加速：300–2000 ms 压到 40 ms（~40min 对局压到 ~75–85s）
- 牌堆洗牌每局随机（非种子化），6 局为 6 局独立对局
- 6 局全 T9：1 standard_victory（France 25 VP）+ 5 time_limit，**France 6/6 胜**
- `[BOT STUCK]` 0、`[BOT CHAIN BROKEN]` 0（全 6 局）
- 基线代码：commit `99371b7`（#R–#X 修复后），2483 HIS 单测通过
- 先前修复（#F–#X、Inquisition、Phase G/H）跨 6 局均未回归
