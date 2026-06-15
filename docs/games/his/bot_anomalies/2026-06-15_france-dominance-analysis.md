# #Y France 一边倒 — 平衡性分析（第一批数据）— 2026-06-15

> 性质：HISBOT 行为层平衡观察（**非引擎缺陷**，引擎结算全程 0 异常）。
> 背景：多轮全-bot 对局 France 累计约 21/22 胜（复验 6/6 + 终验 4/5 + bughunt 7/8 + 门控验证 8/8）。失衡为真实信号，非噪声。
> 方法原则：**先量化 → 拆解 VP 来源 → 受控实验定因 → 才动平衡**。目标不是六家胜率均等（HIS 本身非对称，France/Ottoman 历史就强），而是判断"bot 是否让某些势力发挥远低于其应有潜力"。

---

## 分析工具（本轮新增遥测）

- [`getVpBreakdown(state, power)`](../../../../frontend/src/games/his/state/state-helpers.js) / `getAllVpBreakdowns` — 按来源精确拆解每家 VP，各桶之和 == 权威终局总分 `getAllVpTotals`：
  - `key`：关键空间控制 VP（`KEY_VP_TRACK`）
  - `track`：其他动态轨（新教空间 / 海盗 / 圣彼得）
  - `run`：`state.vp` 运行分（事件 / 控制 / France 城堡 Chateaux）
  - `bonus`：`state.bonusVp` 杂项事件
- [`HISGame.getScoreBreakdown()`](../../../../frontend/src/games/his/index.js) — 暴露给 harness 读取
- [`_runHisBotBatch`](../../../../frontend/src/main.js) — 每局记录 `winner` + 每家 `src`（VP-by-source）；种子化可复现

跑法：`await window.app._runHisBotBatch({ games: 8, seed: 1000 })`

---

## 第一批基线（8 局，seed 1000–1007，r=0）

8 局全 `ended` T9，0 `[BOT STUCK]` / 0 `[BOT CHAIN BROKEN]`。

### 胜率

| 势力 | 胜 | 局（seed） |
| — | — | — |
| france | **5** | 1000, 1002, 1004, 1005, 1006 |
| england | 2 | 1003, 1007 |
| hapsburg | 1 | 1001 |
| ottoman / papacy / protestant | 0 | — |

> **注**：本（修复后）种子样本 France 仅 **5/8**，明显低于此前未种子轮的 ~8/8（复验 6/6、bughunt 7/8、门控验证 8/8）。可能因 #AA/#AB/#AC 修复改善了垫底家（如 FOUND_JESUIT 复活利好 papacy、卡59 复活利好 England/Papacy），或纯属 8 局小样本方差。胜率需更大 N 才有把握；但下方 VP-来源结构是稳健信号。

### 终局 VP-by-source 均值（8 局）

| 势力 | 总分 | key | track | run | bonus | keys(数) |
| — | — | — | — | — | — | — |
| **france** | **18.4** | 10.5 | 0 | **6.5** | 1.4 | 5.3 |
| hapsburg | 14.0 | 9.6 | 0 | 1.4 | 3.0 | 8.6 |
| england | 12.1 | 10.3 | 0 | 0.6 | 1.3 | 4.6 |
| protestant | 10.9 | 0 | 9.5 | 0.4 | 1.0 | 0 |
| ottoman | 10.0 | 9.5 | 0.4 | 0.1 | 0 | 4.8 |
| papacy | 9.1 | 4.5 | 4.6 | 0 | 0 | 2.3 |

### 观察 / 定因

1. **France 的领先几乎全在 `run` 桶**：France `run=6.5`，其余各家 `run ≤ 1.4`（hapsburg 1.4、england 0.6、其他 ~0）。而 France 的 **key VP（10.5）与对手相当**（england 10.3 / hapsburg 9.6 / ottoman 9.5）——**France 不是靠多占关键空间赢，而是靠 run 桶**。
   - `run` = `state.vp`(事件/控制/**城堡 Chateaux**)。**城堡是头号嫌疑**(France 招牌 VP 引擎,bot 主页/目标积极建堡)。待加 chateaux 专属桶精确确认。
2. **垫底家 run≈0**：papacy(9.1)/ottoman(10.0) 几乎无 run VP。ottoman 总分几乎全来自 key(9.5,海盗/征服没转成 run 分);papacy 靠 track(宗教/圣彼得 4.6)+ 少量 key。它们缺一个像城堡那样的"持续 VP 积累渠道",或其 bot 目标没把军事/宗教成果转成 VP。
3. **hapsburg 占最多关键空间(8.6)但 key VP 封顶**(~9.6,KEY_VP_TRACK 高位平台),总分 14 居次——控制再多边际收益递减。

**初步结论**:#Y 的主因是 **France 的 run/城堡 VP 渠道**,而非关键空间或行动顺序。这是一个可调的杠杆,且本轮 5/8 表明修复后失衡已减弱。

### 城堡确认(代码 + 数据,已坐实)

**代码**:城堡 Table 掷骰的 VP 经 [event-actions.js:157](../../../../frontend/src/games/his/actions/event-actions.js#L157) `state.vp.france += result.vp` 计入权威总分(即在 `run` 桶内),并由 `state.chateauVp` 精确记录([:158](../../../../frontend/src/games/his/actions/event-actions.js#L158))。`getVpBreakdown` 现新增 `chateaux` 子字段(= France 的 `state.chateauVp`,run 的子集)隔离它。

**数据**:加 `chateaux` 字段后单局确认(seed 2000,France 胜,total 18):**`run = 6`,其中 `chateaux = 6`** —— France 的 run 优势 **100% 来自城堡**。结合基线 France run 均值 6.5(其余各家 ≤1.4),**#Y 主因精确锁定 = France 城堡 VP 引擎**。

**定性**:城堡是 France 的**设计性招牌 VP 引擎**(其他势力无等价的"被动持续 VP 渠道":奥斯曼靠海盗/征服转 key、教廷靠宗教/圣彼得、英西靠 key)。所以 France 经城堡领先**部分属 HIS 固有非对称**,而非纯 bot bug——只是 bot 每回合积极掷城堡把它最大化了。处置应权衡:是接受(France 本就该强),还是认为 bot 掷城堡过于优先 / 垫底家 VP 转化太弱。

---

## 后续步骤（按定因排序）

1. ✅ **已完成 — 确认城堡是 run 的主体**：`getVpBreakdown` 加了 `chateaux` 子字段;seed 2000 单局 run=6=chateaux(100%)。见上「城堡确认」。
2. **扩大样本**：跑 30 局(`_runHisBotBatch({games:30, seed:2000})`)给胜率上置信区间——确认修复后 France 是否真降到 ~5/8 量级。**务必在前台标签页跑**:后台标签 setTimeout 被浏览器节流,单局从 ~50s 拖到 ~6min(本轮 8 局花了约 45min)。
3. **单杠杆 A/B**(同种子对比胜率位移):
   - 下调 France 城堡目标权重(behavior-cards France 的 `CONTROL`/城堡相关目标);或
   - 上调垫底家(Papacy/Ottoman)的 VP 转化目标优先级。
4. **r 扫描**:同种子跑 r=0 / 0.15 / 0.3,看多样性与 France 占比变化。
5. **处置**:若属 France 固有强势(城堡本就是其 VP 引擎)→ 记录可接受;若垫底家发挥不足 → 针对性调其目标 + 同种子重测确认不引入新失衡。

> 工具已就绪:`_runHisBotBatch` 自动产出每局 winner + VP-by-source;A/B 改一个权重后同 seed 重跑即可干净对比。

---

## 数据归档

- 工具：`_runHisBotBatch`（真实 bot loop，种子确定性，setTimeout 加速）
- 样本：8 局，seed 1000–1007，`dominationVictoryEnabled: false`，`r=0`
- 基线代码：commit `85d409f` + 本轮 VP-breakdown 遥测
