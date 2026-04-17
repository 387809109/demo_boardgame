# Here I Stand — AI (HISBOT) 开发计划

## 概述

基于 Russ Brown 的 HISBOT v1.1 非官方 AI 系统实现单人/少人模式。HISBOT 是**卡驱动行为系统**——每个 Bot 势力拥有 8 张行为卡组，每回合翻出 1 张决定该势力的谈判参数和行动优先级。本质上是**确定性规则引擎 + 随机化（翻牌顺序）**，非常适合代码实现。

**参考文档**：[`docs/games/his/HISBOT_REF.md`](HISBOT_REF.md)（已从 `his_ref/HISBOT.md` 整理完成，1825 行结构化参考文档）

---

## 文件结构

```
frontend/src/games/his/ai/
├── bot-controller.js        # 顶层协调器：驱动 Bot 势力完整回合
├── behavior-cards.js        # 6 势力 × 8 张行为卡数据 + 牌组管理
├── bot-negotiation.js       # 交易评估、Bot-Bot 交易、条约令牌
├── bot-goals.js             # 19 个目标执行器（Garrison, Troops, Siege 等）
├── bot-card-play.js         # 卡牌类型路由：Home/Event/Mandatory/Combat-Response
├── bot-event-criteria.js    # 135 张事件卡判定表（是否打出事件效果）
├── bot-helpers.js           # 共用启发式：最近空间、放置/移除单位、驻军计算
├── bot-phases.js            # 阶段特定逻辑：春季部署、宣战、冬季归营、新世界、帝国议会
├── bot-combat.js            # 战斗决策：避战、撤退、拦截、退入堡垒
└── *.test.js                # 各模块对应测试
```

---

## 分阶段开发计划

### Phase A0: 参考文档整理

> 将扫描风格的 `his_ref/HISBOT.md` 重写为结构化、AI 可读的技术参考文档 `docs/games/his/HISBOT_REF.md`。

| 步骤 | 任务 | 输出 |
|------|------|------|
| A0.1 | 提取并结构化「行为序列」部分（Sequence of Play）：Luther's 95 Theses → Card Draw → Negotiation → Peace → Ransom → Excommunication → War → Diet → Spring Deploy → Action → Winter → New World | `HISBOT_REF.md` §1 |
| A0.2 | 提取并结构化「目标」部分（Goals）：19 个目标的完整判定逻辑、条件、单位放置/移除规则 | `HISBOT_REF.md` §2 |
| A0.3 | 提取并结构化「参考」部分（Reference）：按字母排序的 30+ 条行为规则 | `HISBOT_REF.md` §3 |
| A0.4 | 提取并结构化「事件卡判定表」：~90 条事件卡 → 结构化表格（卡号、卡名、打出条件、条约条件） | `HISBOT_REF.md` §4 |
| A0.5 | 提取并结构化「行为卡数据」：6 势力 × (5 唯一卡 + 3 Continue 卡) 的完整谈判/目标数据 | `HISBOT_REF.md` §5 |
| A0.6 | 提取「Home 卡判定表」和「Bot 规则例外」（额外单位、免费突击、+1CP 延续等） | `HISBOT_REF.md` §6 |

**原则**：零信息丢失——原文档所有规则、数值、优先级、条件判定必须完整保留。去掉扫描格式噪声（页码、重复文本、page images 引用），重组为面向开发的分节结构。

---

### Phase A: 数据与基础设施

| 步骤 | 任务 | 范围 |
|------|------|------|
| A1 | **行为卡数据** — 48 张卡（6 势力 × 8 张）结构化 JSON：`{home, war, negotiations:{...}, goals:[{type, count}]}` | `behavior-cards.js` |
| A2 | **牌组管理** — 洗牌、翻牌、Goodwill/Bad Faith 追踪、Continue 卡逻辑、牌组耗尽重洗、Schmalkaldic League 重置、统治者更替重置 | `behavior-cards.js` |
| A3 | **Bot 控制器骨架** — `BotController` 类，接收 `state` + `power`，返回 `{actionType, actionData}`（与人类玩家格式一致）。主循环检查是否轮到 Bot 并自动执行。 | `bot-controller.js` |
| A4 | **Bot 初始设置** — 按 HISBOT 规则添加额外起始单位，`config.json` 设 `supportsAI: true` | `config.json`, `state-init.js` |
| A5 | **游戏循环集成** — 将 `BotController` 接入 `main.js` AI 回合调度。每次 `processMove` 后，若下一玩家是 Bot，延迟触发 Bot 行动。 | `main.js` |

---

### Phase B: 阶段特定逻辑

| 步骤 | 任务 | 范围 |
|------|------|------|
| B1 | **抓牌阶段** — Bot 手牌堆叠为面朝下，Home 卡在底部（教廷：Leipzig Debate 最底 + Papal Bull 在其上） | `bot-phases.js` |
| B2 | **谈判段** — 人类→Bot 交易评估（报价/要求值比较）、Bot→Bot 颜色编码交易、Goodwill 卡、Bad Faith 卡、交易最大数限制 | `bot-negotiation.js` |
| B3 | **宣战段** — 按行为卡 `war` 字段宣战、用翻出的卡牌支付 CP、War Limitations（各势力限制条件）、英格兰 Home 卡例外 | `bot-phases.js` |
| B4 | **春季部署** — 战时 vs 和平时逻辑、编队选择、目的地优先级（最近敌方钥匙、驻军维护）、哈布斯堡双首都处理 | `bot-phases.js` |
| B5 | **帝国议会** — 翻顶牌、强制事件/1CP 回退到 Home 卡 | `bot-phases.js` |
| B6 | **冬季阶段** — 海军归港（最近首都、港口优先级）、陆军归营（驻军过剩→遣返首都、未设防→最近堡垒）、免费移除 1 个不满标记 | `bot-phases.js` |
| B7 | **新世界阶段** — 探索选择优先级（按总探索加值分 ≤+1 和 ≥+2 两套） | `bot-phases.js` |
| B8 | **绝罚/求和/赎回段** — 自动决策规则 | `bot-phases.js` |

---

### Phase C: 行动阶段 — 出牌路由

| 步骤 | 任务 | 范围 |
|------|------|------|
| C1 | **卡牌类型路由** — 从手牌堆翻牌，按类型分发：Home → Event → Mandatory → Combat/Response → CP Goals | `bot-card-play.js` |
| C2 | **Home 卡判定** — 7 种独立行为（奥斯曼战斗反应、哈布斯堡查理五世移动、英格兰宣战/婚姻、法国城堡、教廷绝罚/辩论、新教路德替换） | `bot-card-play.js` |
| C3 | **事件卡判定表** — ~90 条事件卡决策条目（页 18-19 完整数据） | `bot-event-criteria.js` |
| C4 | **条约令牌逻辑** — 检查 Bot 是否持有条约令牌、代令牌势力打出事件、Ganging Up（21+ VP 阈值） | `bot-card-play.js` |
| C5 | **战斗/响应卡处理** — 翻出后面朝上搁置、满足条件时打出、卡牌保存（行政能力评级上限） | `bot-card-play.js` |

---

### Phase D: 目标执行器（最大阶段）

| 步骤 | 任务 | 覆盖目标 |
|------|------|----------|
| D1 | **军事基础目标** — Garrison（驻军补充）、Troops（正规军）、Mercenaries（佣兵）、Cavalry（骑兵） | 4 个 |
| D2 | **军事移动目标** — Advance（推进）、Land Battle（陆战，含解围优先）、Siege（围城：外国战争→突击→发起/增援） | 3 个 |
| D3 | **海军目标** — Set Sail（出航，含海盗船独立逻辑）、Naval Battle（海战）、Shipbuilding（造船）、Piracy（海盗） | 4 个 |
| D4 | **控制目标** — Remove Unrest（优先）→ Political Control，含单单位移动 | 1 个 |
| D5 | **宗教目标** — Translate（翻译，含辩士承诺优先级）、Publish（出版）、Debate（辩论）、St. Peter's（圣彼得大教堂）、Burn（焚书）、Jesuit（耶稣会大学） | 6 个 |
| D6 | **新世界目标** — Explore、Colonize、Conquer | 3 个 |
| D7 | **目标分发器** — 遍历行为卡优先级列表、检查条件、花费 CP、循环回顶部、+1 CP 令牌溢出处理 | `bot-goals.js` |

---

### Phase E: Bot 辅助工具与战斗决策

| 步骤 | 任务 | 范围 |
|------|------|------|
| E1 | **空间计算** — 最近空间（CP 加权，山口=2，海路穿越）、驻军需求计算器、补给线检查 | `bot-helpers.js` |
| E2 | **单位放置/移除** — 放置优先级（首都驻军→最近敌方→领袖位置）、移除优先级（最远、佣兵优先） | `bot-helpers.js` |
| E3 | **战斗决策** — 避战（己方≤敌方一半）、拦截（仅防御被围堡垒）、撤退（最近友方堡垒）、退入堡垒（≤4 单位） | `bot-combat.js` |
| E4 | **编队扩充** — 沿移动路径收编单位/领袖（不违反驻军/指挥限制）、佣兵比例规则 | `bot-helpers.js` |

---

### Phase F: 集成与打磨

| 步骤 | 任务 | 范围 |
|------|------|------|
| F1 | **全 Bot 对局测试** — 6 Bot 完整对局，验证无崩溃/无限循环、所有阶段正确完成 | 集成测试 |
| F2 | **混合对局测试** — 1 人类 + 5 Bot，验证 Bot 行动在事件日志中正确展示，UI 带延迟显示 Bot 动作 | 手动测试 |
| F3 | **Bot 规则例外** — 开局额外单位、行动阶段末免费突击、+1 CP 延续令牌、事件持续时间延长、免费移除不满 | `bot-controller.js` |
| F4 | **最终秋季突击** — 行动阶段结束后对所有活跃围城免费突击 + 外国战争免费行动 | `bot-controller.js` |
| F5 | **难度设置** — 可选每回合额外抓牌（Turn 4+ 或 Turn 1+） | config |
| F6 | **UI 标识** — Bot 势力徽章、"Bot 思考中…" 动画、行动日志显示 Bot 决策理由 | UI |

---

## 关键设计决策

| 决策 | 方案 | 理由 |
|------|------|------|
| Bot 动作格式 | 生成与人类相同的 `{actionType, actionData}` 并通过 `processMove` | 复用全部验证/状态变更逻辑，无独立代码路径 |
| 执行节奏 | Bot 动作带 ~500ms-1s 延迟 | 人类可在事件日志中看到每步决策 |
| 行为卡牌组状态 | 存储在 `state.botDecks[power]` | 支持存档/读档和回放系统 |
| 谈判 UI | 人类填写简化版 Offer Sheet，系统按行为卡值自动评估 | HISBOT 谈判是数值比较，不需要自由文本 |
| 无效行动处理 | 所有动作经 `validateMove` → 无效则跳过目标、尝试下一个 | Bot 永远不会生成非法状态 |
| 循环保护 | 所有目标耗尽 → pass；+1 CP 令牌溢出；无手牌 → 消耗搁置卡 | 避免无限循环 |

---

## 规模估算

| 模块 | 预估行数 |
|------|---------|
| behavior-cards.js（数据 + 牌组管理） | ~600 |
| bot-controller.js | ~300 |
| bot-negotiation.js | ~400 |
| bot-goals.js | ~800 |
| bot-card-play.js | ~400 |
| bot-event-criteria.js | ~500 |
| bot-helpers.js | ~500 |
| bot-phases.js | ~600 |
| bot-combat.js | ~200 |
| 测试 | ~2,000 |
| **合计** | **~6,300** |

---

## 依赖与前置条件

- **11.5 存档/读档**（推荐先完成）— Bot 牌组状态需要序列化
- **11.4 边界测试**（推荐先完成）— 确保引擎稳固后再让 Bot 大量调用

---

## 风险评估

| 风险 | 缓解措施 |
|------|----------|
| Bot 生成无效动作 | 所有动作经 `validateMove`；无效 → 跳过，尝试下一目标 |
| 无限循环（无有效目标/无手牌） | 目标耗尽自动 pass；+1 CP 令牌溢出处理 |
| 谈判复杂度 | 先实现 Bot-Bot 自动交易；人类-Bot 谈判在 Phase B2 |
| 135 张事件卡判定 | 大部分是简单条件判断；表驱动，非过程式 |
| 战斗中的多步响应窗口 | Bot 在 W1-W7 窗口直接按事件卡判定表决策 |

---

## Bug 修复记录 (2026-04-17)

全 Bot 对局测试发现并修复 7 个关键 Bug，所有修改位于 `bot-goals.js`:

| # | Bug 描述 | 原因 | 修复 |
|---|----------|------|------|
| 1 | 海军移动格式不匹配，引擎收到空 `movements: []` | Bot 发送 `{from, to, squadrons}`，引擎期望 `{movements: [{from, to}]}` | 包装为 movements 数组 |
| 2 | `executeLandBattle` 跳过所有堡垒空间 | `if (isFortified(destSp)) continue` 无差别跳过 | 添加 `canAttack` 判断，允许对交战方堡垒进攻 |
| 3 | `executeAdvance` 阻止进入敌方堡垒 | 硬编码 `controller !== power → continue` | 添加 `canAttack` 条件，交战时允许通过 |
| 4 | `findNavalMove` 忽略海盗船 (corsairs) | 仅检查 `stack.squadrons`，未检查 `stack.corsairs` | 添加 corsairs 检查 |
| 5 | `findPiracyTarget` 错误要求宣战 | 使用了 `areAtWar` 检查 | 移除战争检查 (§13.5 海盗不需宣战) |
| 6 | `findNavalBattleTarget` 为空桩 | 直接 `return null` | 完整实现 BFS 海战目标搜索 |
| 7 | 行为卡缺少 ADVANCE 目标时无法推进 | 5 张奥斯曼行为卡中 3 张无 ADVANCE 目标 | 新增 `advanceTowardTarget` + `findNearestEnemyFortification` 辅助函数，作为 siege/land_battle 的后备 |

**验证**: Game 4 — 506 轮, 0 错误, 法国 T4 统治胜利。奥斯曼: 10 次编队移动 + 6 次海军行动 + 1 次宣战 (修复前: 0 次编队移动, 海军全空)。
