# HIS 测试待办（按优先度）

> 记录尚未覆盖的测试缺口，按优先度排列，供后续逐项执行。
> 已覆盖：引擎层（3334 单测 + gate-parity 审查 + full-bot batch 回归）、UI 渲染契约（ui-gating 覆盖测试）。
> 可用工具见 [TEST_REQUIREMENTS_PLAYWRIGHT.md](TEST_REQUIREMENTS_PLAYWRIGHT.md) 「确定性 UI 测试机制」：
> ① ui-gating 覆盖测试（node，纯函数穷举）② `forceHands`+`rngSeed`（确定性发牌/掷骰）③ live Playwright（仅集成）。
> 进度记号：⬜ 未开始 / 🟡 进行中 / ✅ 完成。

---

## P1 — 高优先（复用 `forceHands`，无浏览器依赖）

### 🟡 1. 其余 5 势力的特有 UI 路径

本会话仅驱动了新教（Protestant）。以下面板/路径从未经 UI 触发，用 `forceHands` 指定相关卡 + 构造对应状态后逐一走通，并把稳定的渲染契约下沉到 `ui-gating`：

- **Papacy**：主动发起反宗教改革、绝罚（excommunication 段）、创立耶稣会（`FOUND_JESUIT`，#AA 相关）、烧书（`BURN_BOOKS`）、建造圣彼得（`BUILD_ST_PETERS`）。
- **Hapsburg**：新世界 探索 / 殖民 / 征服（`EXPLORE`/`COLONIZE`/`CONQUER`）UI。
- **Ottoman**：海盗 / 建海盗船 / 海军移动（`PIRACY`/`BUILD_CORSAIR`/`NAVAL_MOVE`）UI。
- **England**：继承换君 → 卡 59 Lady Jane Grey（#AB 相关；需 `englandRulerChangedThisTurn`）。
- **France**：chateaux 相关交互。

**进度（2026-06-17）**：CP 行动菜单的**每势力可见性契约**已下沉为 `ui-gating` 纯函数 `cpActionsFor`（唯一真源
`CP_ACTION_CATALOG`），取代了 `action-panel._renderCpActions` 中三处重复的 `costs[a.cost] != null && <= cp`
过滤。`ui-gating.test.js` 新增 10 条穷举用例，独立钉死各势力特有路径的**可见集合**：仅 Ottoman 有
海盗/海盗船/骑兵；新世界仅 Hapsburg/England/France；仅 Papacy 可创耶稣会/建圣彼得/烧书；英格兰为唯一
非改革方的发表论文方；Protestant 无海军；并交叉校验 `cpActionsFor` 与 `ACTION_COSTS` 一致、可负担门控。
**仍待办**：①各动作点击后的多步**选择流程**（target selection，需集成层）②事件卡专属 UI 流程
（FOUND_JESUIT #AA / Lady Jane Grey #AB / chateaux 等，非 CP 菜单，靠 `forceHands` 发卡 + 构造状态触发）
③绝罚段 / 反宗教改革面板。

### 🟡 2. 人类侧战斗与响应窗口

本会话所有战斗均为 bot-vs-bot 自动结算；以下从未由人类侧驱动，且响应链历来易出 bug：

- `pendingBattle` / `pendingInterception` / 突击（assault）面板。
- W1–W7 响应卡窗口（佣兵 / 攻守方战斗卡 / 禁卫军 / 攻城炮 / 划桨手 / 脉冲中断）及 `RESPONSE` 卡（如 Gout、Siege Artillery）。
- 工具：`forceHands` 发到响应/战斗卡 + 构造开战状态后触发。

**进度（2026-06-17）**：三个战斗-响应面板的**控件与出招契约**已下沉为 `ui-gating` 纯函数
`responsePanelModel` / `battlePanelModel` / `interceptionPanelModel`，`action-panel` 三个 `_render*` 方法
改为直接消费（移除内联分支 + 重复的窗口常量，控件用 `{label, move}` 或 `{label, select}` 统一描述）。
`ui-gating.test.js` 新增 15 条穷举用例钉死：W1–W7 全窗口 label/hint 映射（不泄露裸窗口 id）、
**仅响应方**可见响应卡与放弃按钮（旁观者 `cards=[]`、不可 decline——响应链最易错处）、各控件
emit 的精确 move（`PLAY_RESPONSE_CARD`/`DECLINE_RESPONSE`/`RESOLVE_BATTLE`/`WITHDRAW_INTO_FORTIFICATION`/
`RESOLVE_INTERCEPTION`/`AVOID_BATTLE`/撤退走选择流）、退入工事 vs 单结算分支、避战门控。
**进度（2026-06-17，续）— 引擎层路由走通**：核查 `index.test.js` 发现野战响应链
（W1→W2→W3→W4 及 W7 脉冲中断：Wartburg/Foul Weather/Gout/Halley）**已**经 `game.processMove`
端到端覆盖（~40 用例）。新补 **拦截链路由**：`index.test.js` 新增 `processMove — interception routing`
4 用例，钉死 `RESOLVE_INTERCEPTION` 经顶层路由 → `_handleResolveInterception` 的成功（在 targetSpace
建 `field_battle`，攻=移动方/守=拦截方）/失败/空 `pendingInterception` 安全无操作分支（此前 bot 测试只验
*决策* `actionType`，从不经路由执行）。

> **⚠ 引擎缺口（本轮发现，非测试缺口）**：**W5（攻城炮 #35，突击）/ W6（划桨手 #34，海战）响应窗口
> 未接入实战流程**。`response-actions.js` 的 `createPostRollWindow`/`canAnyPowerRespondPostRoll` 支持
> W5/W6 且有单测，但 `combat-actions.js` 仅在野战路径调用 post-roll（只产 W4）；`siege-actions.js` /
> `naval-actions.js` **完全不开任何 `pendingResponse`**，且 `index.js:1117` 明确留桩
> `// W5/W6 finalization: future integration with siege/naval`。即突击/海战实战中 #35/#34 永不触发。
> 这是**未实现的功能**而非漏测——需先据 `RULES.md` 核实攻城炮/划桨手的加成规则再实现，不可凭空补码。
> 建议作为独立功能任务排期。

**仍待办**：①W5/W6 功能接入（见上）②`RESPONSE` 卡（Gout/Siege Artillery）效果结算 ③辩论/改革面板路由
④`AVOID_BATTLE` 经路由的撤退合法性分支。

---

## P2 — 中优先（需真实浏览器，layer C；需引入 Playwright runner 依赖）

### ⬜ 3. 种子化 Playwright 集成回归 `.spec.js`

仅覆盖 jsdom/node 验不到的部分，每条用 `rngSeed`+`forceHands` 钉死：

- SVG `<polygon data-name>` 命中测试（真实指针事件）。
- HMR 重载后续局。
- **mid-`pending*` 存读档**：在战斗 / 辩论 / 改革进行中存档，再读档续局（本会话只验过普通阶段的往返）。

### ⬜ 4. 跑到对局结束

- 胜利判定（统治 / 宗教 / 军事）、`game-result` 结算屏、后期回合（T3–T9）机制。
- 用固定 `rngSeed` 跑一局直到分出胜负，验证终局 UI 与计分。

---

## P3 — 较大独立工作

### ⬜ 5. HIS 多人联机

- LAN（WebSocket）+ Cloud（Supabase）下 `GAME_ACTION` 的双客户端同步、中途重连。
- 大体量 HIS 状态的同步正确性（大厅/网络测试为通用，未针对 HIS 验证）。

### ⬜ 6. 移动端响应式与性能

- 密集地图（149 空间）+ 多面板在小屏的可用性。
- 每个动作触发的整图重渲染性能。

---

## 执行约定

- 优先 P1：用 `forceHands` 在 node/确定性层走通，能下沉为 `ui-gating` 纯函数契约的就下沉并加穷举用例；仅集成相关才上 Playwright。
- 每完成一项：回填本表状态，并在对应 `bot_anomalies/` 或 test 文档记录发现与修复。
- 发现的任何 UI bug 优先复现为 node 层断言（见 2026-06-15 两个 UI bug 的处理方式）。
