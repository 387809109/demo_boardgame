# HISBOT 事件决策随机抽样（Phase H / D 方案）— 立项计划

> **状态**：✅ H1–H3 已完成（2026-04-25），H4 (UI 滑块) 推迟
> **所属**：HIS AI 开发 — 接续 [AI_PLAN.md](AI_PLAN.md) Phase G 之后的 Phase H
> **范围**：在 Phase G 确定性事件评分基础上，引入受控阈值随机化（threshold-jitter），让真人对战可选启用非确定性 Bot 行为；Phase G 测试基线在默认配置下 100% 保留
>
> **完成 commits**：
> - H1 `fd078b8` — `state.botEventRandomness` clamp + 8 boundary tests
> - H2 `b209910` — `shouldRouteToEvent` 纯函数 + `routeEventCard` jitter 接入 + 16 sampling tests
> - H3 `<this commit>` — `[event-vs-cp]` 遥测扩字段 + HISBOT_REF.md §8.5.3 + AI_PLAN 状态翻完成
>
> **基线对比**：r=0 default 与 commit `b7b48c7`（Phase G + Inquisition tier-scoring）完全一致（85 events exact match）；r=0.1 实测 80 events (-5.9%) 落在 ±25% 容忍区间内，游戏结局可变化（验证随机性确实改变决策路径）
>
> **H4 状态**：UI 滑块 lobby 暴露推迟到首次需要时；当前可通过 `window.app._startHisGame(null, { botEventRandomness: 0.1 })` 程序化注入

---

## Context

[Phase G](BOT_EVENT_SCORING_PLAN.md) 已落地确定性事件评分。当前 `routeEventCard` 决策：

```
PLAY_CARD_EVENT  iff  eventScore > cpUtility + EVENT_VS_CP_THRESHOLD(0.05)
```

确定性带来三个观察到的局限：

1. **重复对局完全相同** — 给定相同初始牌堆顺序，6 个 Bot 每次决策固定，剧本可预测，缺乏多样性
2. **接近分数无表达力** — `eventScore=0.50, cpUtility=0.46` 与 `eventScore=0.50, cpUtility=0.20` 在确定性逻辑下完全相同（都打事件），但前者其实是"勉强决定"
3. **score 校准的边界 case 一刀切** — Inquisition 0.3 floor / 0.7 mid-tier 等阈值的微调对决策结果可能产生跃迁式改变

D 方案在最初讨论中作为 Phase G 的"未来扩展"保留：**当 eventScore / cpUtility 接近时，引入受控随机性**。本立项把它落地为独立 Phase H，向后兼容（默认关闭），不影响 G 测试基线。

**目标**：让玩家可选地启用真人对战的非确定性 Bot 行为，同时保持回归测试在确定性模式下不变。

---

## 设计

### 决策逻辑（threshold-jitter）

把固定的 `EVENT_VS_CP_THRESHOLD = 0.05` 替换为一个受 `botEventRandomness` 缩放的随机区间：

```javascript
// bot-card-play.js routeEventCard
const r = state.botEventRandomness || 0;          // 0..0.3, default 0
const jitter = r > 0 ? (rng() - 0.5) * 2 * r : 0; // uniform[-r, +r]
const threshold = EVENT_VS_CP_THRESHOLD + jitter;
if (es > cs + threshold) { /* event */ }
```

这种设计的关键性质：

- **`r = 0`**：jitter = 0，行为与 Phase G 完全一致 → 确定性回归测试不变
- **`r = 0.1`**：threshold ∈ [-0.05, 0.15]
  - `es=1.0, cs=0.2`（明显事件）：es > [0.15, 0.35] 永远满足 → 仍走事件
  - `es=0.5, cs=0.45`（接近）：es > [0.40, 0.60] 偶尔满足 → 大约 50/50
  - `es=0.2, cs=0.8`（明显 CP）：es > [0.75, 0.95] 永远不满足 → 仍走 CP
- **自然只随机化"接近分数"**，不需要显式 band 检测

### Config 接入

镜像 [`dominationVictoryEnabled`](../../../frontend/src/games/his/state/state-init.js#L226) 的写法：

| 位置 | 改动 |
|---|---|
| `state-init.js` | 加 `botEventRandomness: clamp(options.botEventRandomness ?? 0, 0, 0.3)` |
| `config.json` | 加 UI 选项 type=number, default=0, min=0, max=0.3, step=0.05 |
| `main.js _startHisGame` | 已经支持 `extraOptions` 直传，无需改 |

### RNG 注入

复用 [`shuffle(arr, rng = Math.random)`](../../../frontend/src/games/his/ai/behavior-cards.js#L939) 的模式：

```javascript
export function routeEventCard(state, power, cardNumber, card, rng = Math.random) { ... }
```

- 生产环境：`Math.random`（不可重放，但非确定性正是用户想要的）
- 单元测试：传入种子化伪随机数生成器（mulberry32 一段 ≈ 7 行，无需新增依赖）
- 不持久化 RNG 实例到 state（避免存档/克隆问题）；`botEventRandomness` 配置值随 state 序列化

### 决策遥测

扩展 G5 的 `[event-vs-cp]` 日志，加 `threshold` / `r`：

```
[event-vs-cp] papacy 47 es=0.90 cs=0.62 threshold=0.07 → event  (r=0.10)
```

---

## 实施阶段

| 子阶段 | 工作 | 产出 | 验证 | 预估 |
|---|---|---|---|---|
| H1 | 加 `state.botEventRandomness` + init clamp + state-init 单测 | `state-init.js`、`state-init.test.js` | clamp 边界（< 0 / > 0.3 / 非数值） | 0.5 天 |
| H2 | `routeEventCard` 引入 jitter + 注入式 RNG + 单测 | `bot-card-play.js`、`bot-card-play.test.js` | r=0 时与 G5 决策 100% 一致；r=0.1 + 固定种子下 mid-band 出现 ~50/50；r=0 下原有测试全过 | 0.5 天 |
| H3 | 扩展决策遥测 + 文档同步 | `[event-vs-cp]` 日志增字段；HISBOT_REF.md §8.5.3 偏离记录；AI_PLAN.md 注册 Phase H 完成 | 跨 3 次实测决策可读取 | 0.25 天 |
| H4 | 可选：config.json UI 滑块（数字输入） | `config.json` | Lobby 开启房间能见到设置项；`_startHisGame` 仍可程序化覆盖 | 0.25 天（可推迟） |

**总计 1.25–1.5 天**（H4 可推迟到首次需要 UI 时）。

---

## 待修改文件清单

### 直接修改

- [frontend/src/games/his/state/state-init.js](../../../frontend/src/games/his/state/state-init.js) — 加 `botEventRandomness` 字段 + clamp
- [frontend/src/games/his/ai/bot-card-play.js](../../../frontend/src/games/his/ai/bot-card-play.js) — `routeEventCard` jitter + RNG 注入参数
- [frontend/src/games/his/ai/bot-card-play.test.js](../../../frontend/src/games/his/ai/bot-card-play.test.js) — 新增 H2 抽样行为单测（种子化 RNG）
- [frontend/src/games/his/state/state-init.test.js](../../../frontend/src/games/his/state/state-init.test.js) — clamp 边界单测

### 文档更新

- [HISBOT_REF.md](HISBOT_REF.md) §8.5.3 — 记录 D 方案偏离原 HISBOT 确定性的注入式随机
- [AI_PLAN.md](AI_PLAN.md) — Phase H 章节
- [PLAN.md](PLAN.md) "立项待开发" 处

### 配置（H4 可选）

- [frontend/src/games/his/config.json](../../../frontend/src/games/his/config.json) — UI 设置项

---

## 成功标准

1. **回归不变**：`r = 0`（默认）下，HIS 单元测试全部通过；9 回合 live 与 Phase G 末态（commit `b7b48c7`）逐 action diff 一致（确定性 100% 保持）
2. **抽样可观测**：`r = 0.1` + 固定种子时，对若干 mid-band 决策样本运行 1000 次，event/CP 比例落在 [40%, 60%] 区间
3. **抽样不破坏**：`r = 0.1` 下跑 9 回合 live，`PLAY_CARD_EVENT` 计数仍在 ±25%（拓宽容忍区间）
4. **遥测可读**：`[event-vs-cp]` 输出含 `threshold`、`r` 字段
5. **范围保护**：clamp 把 negative / > 0.3 / NaN / undefined 安全归零

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 引入随机性导致回归测试不可重放 | 默认 r=0；单测显式注入种子化 RNG；live regression test 文档明确写"D 方案默认关闭" |
| 极端 jitter 让明显的 CP 决策偶尔变事件 | uniform[-r, +r] 与 0.05 基线比较，r ≤ 0.3 时仍保留正阈值偏向；分数差 ≥ 0.5 时几乎不会反转 |
| 玩家不知道随机度的实际效果 | UI 描述写明"0=完全确定，0.1=偶尔出乎意料，0.3=显著多样性"；AI_PLAN.md 给定校准建议 |
| 引入 RNG 状态破坏 save/load | 不持久化随机度的内部状态（不存 RNG 实例），每次决策独立采样；`botEventRandomness` 配置值随 state 一起序列化 |

---

## 验证方式

### 登记 PR（首个 PR，仅文档）

- `BOT_EVENT_RANDOMNESS_PLAN.md` 在 docs 目录可读
- `AI_PLAN.md` 找到 Phase H 入口
- `PLAN.md` 登记条目可见

### H1 验收

```bash
cd frontend
npx vitest run src/games/his/state/state-init.test.js
```

边界：默认 0、负数 clamp 0、> 0.3 clamp 0.3、非数值 fallback 0。

### H2 验收

```bash
cd frontend
npx vitest run src/games/his                    # tests pass with r=0
# 新增 H2 测试：r=0.1 + seeded RNG 下 mid-band 1000 次抽样 ∈ [400, 600] event picks
# Playwright MCP r=0 9 回合：与 b7b48c7 baseline 行为一致
# Playwright MCP r=0.1 9 回合：PLAY_CARD_EVENT 在 ±25% 基线
```

### H3 验收

- 浏览器 DevTools 过滤 `[event-vs-cp]`，验证日志含 `threshold` 和 `r`
- HISBOT_REF.md §8.5.3 可读

### H4 验收（可选）

- Lobby 创建房间，能看到"事件随机度"设置项
- 选择不同值 → 反映在 `state.botEventRandomness`

---

## 启动条件

- ✅ Phase G G1–G5 全部完成（commits `30f9794` → `6cfa6c0`）
- ✅ Inquisition tier-scoring G4 follow-up 已完成（`b7b48c7`）
- ✅ 2026-04-23 / 2026-04-25 回归基线已建立

可随时开工。
