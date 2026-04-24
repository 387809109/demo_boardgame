# HISBOT 事件评分化（Phase G）— 立项计划

> **状态**：待开发（2026-04-23 立项）
> **所属**：HIS AI 开发 — 接续 [AI_PLAN.md](AI_PLAN.md) Phase A–F 之后的 Phase G
> **范围**：Bot 事件 vs CP 决策从布尔 `shouldPlay` 升级为 `score(0..1)`；D 方案（随机抽样）作未来扩展保留

---

## Context

当前 HISBOT 在"卡牌打为事件 vs CP"的决策上是布尔二分：
[bot-event-criteria.js:799 `shouldPlay(state, power, cardNumber) → bool`](../../../frontend/src/games/his/ai/bot-event-criteria.js#L799) 返回 true 即打事件，否则走 CP。
[bot-card-play.js:647 `routeEventCard`](../../../frontend/src/games/his/ai/bot-card-play.js#L647) 按 §5 自身收益 → 条约义务 → Ganging Up → CP 的优先级走确定性分支。

两个后果：

1. 所有 `shouldPlay=false` 的事件被永久拉黑，包括"本回合弱利好"的场景
2. `shouldPlay=true` 的事件即使 CP 更值也强制走事件路径

2026-04-23 全 Bot 9 回合回归中 `PLAY_CARD_EVENT` 占比 86/1286 ≈ 6.7%，在无明确瓶颈证据下仍嫌保守。

**目标**：把 `shouldPlay(s,p)→bool` 升级为 `score(s,p)→0..1` 的连续评分，并配合 CP 侧的效用评估，让 Bot 选择更细腻、可调、仍可回归。D 方案作为后续扩展保留，本立项不实现。

---

## 设计

### 数据结构（兼容过渡层）

```javascript
// bot-event-criteria.js
EVENT_CRITERIA[n] = {
  title: '...',
  shouldPlay: (s, p) => bool,       // 保留，过渡期兼容
  score:      (s, p) => 0..1,       // 新字段（主路径）
  treaty:     (s, p, tp) => bool    // 不动
}

// 统一入口（新增）
export function eventScore(s, p, cardNumber) {
  const c = EVENT_CRITERIA[cardNumber];
  if (!c) return 0;
  if (typeof c.score === 'function') return clamp01(c.score(s, p));
  return c.shouldPlay?.(s, p) ? 0.8 : 0;   // 过渡期 fallback
}
```

### CP 效用评估

```javascript
// bot-card-play.js（或新 bot-score-utils.js）
export function cpUtility(state, power, cardNumber) {
  const card = CARD_BY_NUMBER[cardNumber];
  const cp = card?.cp || 0;
  const baseCpValue = Math.min(cp / 5, 1);                            // 5 CP ≈ 1.0
  const goalSaturation = computeGoalSaturation(state, power);         // 0..1
  const warBonus = getWarsOf(state, power).length > 0 ? 0.15 : 0;
  return clamp01(baseCpValue * (1 - goalSaturation * 0.6) + warBonus);
}
```

`goalSaturation` 读 [state.botGoalCounts 与 getActiveBehaviorCard](../../../frontend/src/games/his/ai/bot-goals.js#L1155-L1161)（已存在，可复用）。已执行 goal 数 / 本卡 goals 总 max → 0..1。

### 路由决策

```javascript
// bot-card-play.js routeEventCard 修改
function routeEventCard(state, power, cardNumber, card) {
  const es = eventScore(state, power, cardNumber);
  const cs = cpUtility(state, power, cardNumber);
  const THRESHOLD = 0.05;

  if (es > cs + THRESHOLD) {
    return { actionType: PLAY_CARD_EVENT, actionData: { cardNumber } };
  }
  // 条约 / Ganging Up 分支保持现状
  ...
}
```

**关键约束**：Treaty、Ganging Up、Home、Mandatory、Combat-Response 五个分支本期**完全不动**。

---

## 实施阶段

| Phase | 工作 | 产出 | 验证 | 预估 |
|---|---|---|---|---|
| G1 | 基础设施：`eventScore` / `cpUtility` / `computeGoalSaturation` + 单测 | `bot-event-criteria.js` 导出 `eventScore`；新模块 `bot-score-utils.js`（或复用 `bot-card-play.js`） | 单测：已有 `shouldPlay:true` 卡 `eventScore≥0.8`；`:false` 卡 `eventScore=0` | 0.5 天 |
| G2 | `routeEventCard` 切到评分路径；**不改**任何 `EVENT_CRITERIA` 条目 | 修改 [bot-card-play.js:647](../../../frontend/src/games/his/ai/bot-card-play.js#L647) | 2414 HIS 单测全通过；9 回合 live `PLAY_CARD_EVENT` 在 ±15% 基线浮动 | 0.5 天 |
| G3 | Top-20 高频卡显式 `score` 函数替换布尔（`Copernicus` / `Roxelana` / `Plantations` / `Michelangelo` / `Jesuit Education` 等） | 修改 `bot-event-criteria.js` 约 20 条 | live 回归：事件播放率 +3-5pp；宗教/战争/VP 总量无显著倒退；新增无 anomaly | 1 天 |
| G4 | 剩余 ~68 张卡 `score` 迁移（可分 2-3 次 PR） | 完整 `bot-event-criteria.js` 评分化 | 每批迁移后跑 2414 单测 + 1 次 9 回合 live | 2-3 天 |
| G5 | 文档同步 + 评分决策观测 | `HISBOT_REF.md` §8.5 实现偏离记录新增条目；`AI_PLAN.md` Phase G 标记完成；`console.debug('[event-vs-cp]', power, card, es, cs, chose)` 取证 | 跨 3 次 live 测试决策可复现性检查 | 0.5 天 |

**总计约 4.5-5.5 天**（不含 D 方案）。

### D 方案（未来扩展，不在本立项范围）

`state.config.botEventRandomness ∈ [0, 0.3]`，评分差 `|es - cs| < 0.1` 时做概率抽样；回归默认 0，真人对战默认 0.1。G 完成后独立开展。

---

## 待修改文件清单

### 直接修改

- [frontend/src/games/his/ai/bot-event-criteria.js](../../../frontend/src/games/his/ai/bot-event-criteria.js) — 88 条 criteria 增加 `score` 字段；新增 `eventScore` 导出
- [frontend/src/games/his/ai/bot-card-play.js](../../../frontend/src/games/his/ai/bot-card-play.js) — `routeEventCard` 切换评分路径；新增 `cpUtility` / `computeGoalSaturation`
- [frontend/src/games/his/ai/bot-card-play.test.js](../../../frontend/src/games/his/ai/bot-card-play.test.js) — 新增 `eventScore` / `cpUtility` 单测

### 新增（可选）

- `frontend/src/games/his/ai/bot-score-utils.js` — 如 G1 选择拆模块存放评分工具

### 文档更新

- [HISBOT_REF.md](HISBOT_REF.md) §8.5 — 记录偏离原 HISBOT 布尔规则的评分化改造
- [AI_PLAN.md](AI_PLAN.md) — Phase G 章节（已登记）
- [PLAN.md](PLAN.md) — "行为调优待办" 处（已登记）

---

## 成功标准

1. 所有 2414 HIS 单元测试通过
2. 一次 9 回合全 Bot 回归（`dominationVictoryEnabled: false`）：
   - `PLAY_CARD_EVENT` 计数在 G2 后 ±15% 基线（86 次）浮动
   - 无新增 `[BOT CHAIN BROKEN]` 警告
   - 无新增 anomaly（以 [2026-04-23_full-bot-9turns.md](bot_anomalies/2026-04-23_full-bot-9turns.md) 为基线）
3. 评分决策可观测：`console.debug` 输出供调试
4. 同状态同决策 — 100% 可复现

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| `shouldPlay` / `score` 双轨带来不一致 | `eventScore` 统一入口；fallback 规则显式写在注释中 |
| `cpUtility` 边界 case 漏（如 Mandatory 已分支） | G2 只改 `routeEventCard`，其他路由冻结 |
| 阈值 0.05 经验不准 | 首版以最近基线 86 次反推；记录在 `HISBOT_REF.md` 偏离说明里 |
| `goalSaturation` 实现复杂度 | G1 先实现简化版 `cp≥3 ? 0.6 : 0.4`；G3 再精化用 `botGoalCounts` |

---

## 验证方式

### G1 验收

```bash
cd frontend
npx vitest run src/games/his/ai/bot-card-play.test.js    # 新增单测通过
```

### G2 验收

```bash
cd frontend
npx vitest run src/games/his                              # 2414 全通过
# Playwright MCP 9 回合 live（dominationVictoryEnabled: false）
# 对比 PLAY_CARD_EVENT 计数 vs 2026-04-23 基线 86
```

### G3-G4 验收

每批迁移后：2414 单测 + 1 次 9 回合 live + 对比前一版决策差异（取样 10-20 次关键决策点）。

### G5 验收

- `HISBOT_REF.md` §8.5 新增条目可读
- `console.debug('[event-vs-cp]')` 在浏览器 dev tools 能取到

---

## 启动条件

本立项前置条件均已满足：

- HISBOT Phase A–F 已完成（参考 [AI_PLAN.md](AI_PLAN.md)）
- 2026-04-22 / 2026-04-23 全 Bot 回归基线已建立
- `EVENT_CRITERIA` 与 `routeEventCard` 现状经过实测验证
