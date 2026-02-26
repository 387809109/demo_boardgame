# Here I Stand (教改风云) - 开发总体计划

## Context

Here I Stand (HIS) 是一款经典的卡牌驱动六方兵棋桌游，覆盖 16 世纪欧洲宗教改革时代（1517-1555）。目标是在现有桌游平台上实现完整的线上多人版本。

**决策**：1517 全剧本优先 | SVG 交互地图 | 暂不支持 AI | 核心机制优先，渐进扩展

---

## 文件结构

```
frontend/src/games/his/
├── config.json                    # 游戏元数据、settingsSchema、势力定义
├── constants.js                   # 枚举：ACTION_TYPES, PHASES, POWERS 等
├── index.js                       # HISGame extends GameEngine（入口）
├── data/
│   ├── cards.js                   # ~110 张卡牌定义
│   ├── map-spaces.js              # ~200 个地图空间
│   ├── map-connections.js         # 邻接关系
│   ├── leaders.js                 # 领袖定义
│   ├── units.js                   # 单位类型
│   └── setup.js                   # 1517 初始设置（部队、控制权、VP）
├── state/
│   ├── state-init.js              # 初始状态构建
│   ├── state-visible.js           # getVisibleState() 信息过滤
│   └── state-helpers.js           # 状态查询工具函数
├── phases/
│   ├── phase-manager.js           # 阶段状态机
│   ├── phase-card-draw.js         # 抽牌阶段
│   ├── phase-diplomacy.js         # 外交阶段
│   ├── phase-action.js            # 行动阶段（脉冲轮转）
│   ├── phase-winter.js            # 冬季阶段
│   └── phase-response.js          # 响应卡中断窗口
├── rules/
│   ├── rules-validation.js        # 操作合法性验证
│   ├── rules-cards.js             # 卡牌打出、事件触发
│   ├── rules-combat.js            # 野战、围城、海战
│   ├── rules-movement.js          # 移动验证、路径计算
│   ├── rules-diplomacy.js         # 宣战、同盟、和约
│   ├── rules-reformation.js       # 宗教改革、辩论、出版
│   ├── rules-special.js           # 亨利八世、新世界、海盗、建造
│   ├── rules-scoring.js           # VP 计算、胜利条件
│   └── rules-winter.js            # 冬季损耗与控制判定
├── map/
│   ├── map-svg.js                 # SVG 地图渲染、缩放、平移
│   ├── map-overlay.js             # 单位/控制标记/高亮叠加层
│   └── map-interaction.js         # 点击/拖拽/提示交互
├── ui/
│   ├── ui.js                      # 主 UI 类（挂载点）
│   ├── ui-hand.js                 # 手牌显示与打出
│   ├── ui-power-panel.js          # 势力仪表盘（VP、特殊能力）
│   ├── ui-action-panel.js         # 行动选择面板
│   ├── ui-combat.js               # 战斗结算显示
│   ├── ui-diplomacy.js            # 外交协商界面
│   ├── ui-reformation.js          # 宗教改革 UI
│   └── ui-status-bar.js           # 回合轨/VP轨/战争状态
├── index.test.js                  # 核心逻辑测试
└── rules.test.js                  # 规则验证测试

docs/games/his/
├── RULES.md                       # AI 技术规则文档
└── PLAN.md                        # 本开发计划

frontend/public/rules/
└── his.html                       # 玩家规则书
```

---

## 核心数据模型

### 卡牌

```javascript
{ id, title, cp, associatedPower, type, turn,
  eventText, eventId, mandatory, response, combat, removeAfterEvent }
```

### 地图空间

```javascript
{ id, name, type, terrain, fortified, fortificationLevel,
  homePower, isKey, religion, svgX, svgY,
  landConnections[], seaConnections[], passConnections[] }
```

### 游戏状态（顶层）

```javascript
{
  powers: { [powerId]: { playerId, vp, hand[], cardDraw, specialState } },
  spaces: { [spaceId]: { controlledBy, besieged, siegeProgress, reformed } },
  units: { [spaceId]: UnitState[] },
  cards: { drawPile[], discardPile[], removedPile[] },
  phase: { current, subPhase, activePower, impulseNumber, impulseOrder[],
           pendingResponse, pendingCombat },
  diplomacy: { wars[], alliances[], loans[] },
  reformation: { reformedSpaces[], debatesPending },
  turn, turnNumber, status, winner, eventLog[]
}
```

---

## 开发阶段

### Phase 0: 文档与数据基础
> 产出：静态数据文件 + 规则文档。无游戏逻辑。

| # | 任务 | 文件 |
|---|------|------|
| 0.1 | 创建 RULES.md（AI 技术规则文档，按 TEMPLATE.md 格式） | `docs/games/his/RULES.md` |
| 0.2 | 创建 PLAN.md（本开发计划） | `docs/games/his/PLAN.md` |
| 0.3 | 创建 config.json（元数据、settingsSchema、势力定义） | `config.json` |
| 0.4 | 创建 constants.js（ACTION_TYPES、PHASES、POWERS 枚举） | `constants.js` |
| 0.5 | 创建 ~110 张卡牌定义 | `data/cards.js` |
| 0.6 | 创建 ~200 个地图空间定义 | `data/map-spaces.js` |
| 0.7 | 创建地图邻接关系 | `data/map-connections.js` |
| 0.8 | 创建领袖、单位类型定义 | `data/leaders.js`, `data/units.js` |
| 0.9 | 创建 1517 初始设置 | `data/setup.js` |
| 0.10 | 数据完整性测试 | 测试文件 |

**里程碑**：所有静态数据就绪，可独立验证

---

### Phase 1: 引擎骨架与回合结构
> 产出：可初始化、抽牌、轮转回合的空壳游戏。

| # | 任务 | 文件 |
|---|------|------|
| 1.1 | HISGame 类（extends GameEngine） | `index.js` |
| 1.2 | 初始状态构建器 | `state/state-init.js` |
| 1.3 | 阶段状态机（抽牌→外交→行动→冬季→下回合） | `phases/phase-manager.js` |
| 1.4 | 抽牌阶段逻辑 | `phases/phase-card-draw.js` |
| 1.5 | 冬季阶段基础（推进回合、简单 VP 检查） | `phases/phase-winter.js` |
| 1.6 | 外交阶段存根（全员 pass） | `phases/phase-diplomacy.js` |
| 1.7 | 行动阶段脉冲轮转（出牌/pass，全 pass 则结束） | `phases/phase-action.js` |
| 1.8 | getVisibleState() 隐藏对手手牌 | `state/state-visible.js` |
| 1.9 | 状态查询工具函数 | `state/state-helpers.js` |
| 1.10 | 注册到 main.js | `main.js` |

**里程碑**：6 人加入后可看到势力分配和手牌，回合从 1 轮转到 9

---

### Phase 2: 卡牌打出与 CP 行动
> 产出：可出牌获得 CP，用 CP 移动和建造单位。

| # | 任务 |
|---|------|
| 2.1 | 卡牌打出验证（本势力牌限制、强制事件规则） |
| 2.2 | 出牌处理：从手牌移除，分配 CP |
| 2.3 | 陆地移动：路径验证、邻接检查、单位限制 |
| 2.4 | 建造单位：在合法位置放置正规军/雇佣兵 |
| 2.5 | PASS 行动（不出牌） |
| 2.6 | 强制事件检测（抽到时必须打出） |

**里程碑**：策略核心循环可运行——出牌、移动、建造

---

### Phase 3: 战斗系统
> 产出：野战、围城、海战完整可用。

| # | 任务 |
|---|------|
| 3.1 | 野战结算（骰子 + 修正 + 领袖加成） |
| 3.2 | 围城机制（强攻 vs 消耗，多回合跟踪） |
| 3.3 | 海战结算 |
| 3.4 | 撤退规则与追击 |
| 3.5 | 战斗卡打出（战斗中从手牌打出） |
| 3.6 | 响应卡中断窗口 |
| 3.7 | 拦截机制（经过敌军时触发） |
| 3.8 | 领袖被俘/阵亡 |

**里程碑**：完整军事游戏——可以发动战争、打仗、围城

---

### Phase 4: 外交系统
> 产出：宣战、同盟、和约完整可用。

| # | 任务 |
|---|------|
| 4.1 | 宣战（限制条件、花费） |
| 4.2 | 求和（和约条款、让步） |
| 4.3 | 结盟（联合作战） |
| 4.4 | 贷款 |
| 4.5 | 外交限制（不能攻击盟友等） |

**里程碑**：政治+军事完整——六方可以外交博弈并开战

---

### Phase 5: VP 计分与胜利条件
> 产出：准确的 VP 追踪和胜利判定。

| # | 任务 |
|---|------|
| 5.1 | 六方各自 VP 计算规则 |
| 5.2 | 25 VP 自动胜利检测 |
| 5.3 | 冬季 VP 结算 |
| 5.4 | 第 9 回合终局计分 |
| 5.5 | 平局判定规则 |

**里程碑**：游戏有赢家——核心游戏"可结算"

---

### Phase 6: 卡牌事件（最大阶段）
> 产出：~110 张卡牌事件全部实现。

| # | 任务 |
|---|------|
| 6.1 | 事件处理系统（注册表模式，按 eventId 分发） |
| 6.2 | 奥斯曼事件（~15 张） |
| 6.3 | 哈布斯堡事件（~15 张） |
| 6.4 | 英格兰事件（~15 张） |
| 6.5 | 法兰西事件（~15 张） |
| 6.6 | 教廷事件（~15 张） |
| 6.7 | 新教事件（~15 张） |
| 6.8 | 通用事件（~20 张） |
| 6.9 | 强制事件与响应事件 |

**里程碑**：完整卡牌驱动体验——每张牌可作为事件或 CP 使用

---

### Phase 7: 特殊机制
> 产出：HIS 标志性子系统全部实现。

| # | 任务 |
|---|------|
| 7.1 | 宗教改革（翻转空间、反宗教改革） |
| 7.2 | 神学辩论（骰子结算） |
| 7.3 | 宗教著作出版 |
| 7.4 | 亨利八世婚姻/离婚/英格兰教会 |
| 7.5 | 新世界探索 |
| 7.6 | 海盗（巴巴里海盗、私掠船） |
| 7.7 | 建造（要塞、圣彼得大教堂） |
| 7.8 | 施马尔卡尔登联盟 |

**里程碑**：规则完整——物理版 HIS 的所有机制均已实现

---

### Phase 8: SVG 地图与基础 UI
> 产出：可视化、可交互的游戏界面。

| # | 任务 |
|---|------|
| 8.1 | 制作/转换欧洲 SVG 地图（~200 空间） |
| 8.2 | SVG 渲染、缩放、平移 |
| 8.3 | 单位/控制标记/宗教标记叠加层 |
| 8.4 | 空间点击选择、移动交互 |
| 8.5 | 主 UI 类 |
| 8.6 | 手牌显示与打出界面 |
| 8.7 | 势力仪表盘 |
| 8.8 | 回合/阶段状态栏 |

**里程碑**：首个"可发布"版本——通过 Web UI 完整游玩

> **注意**：Phase 8 可从 Phase 2 完成后并行开发

---

### Phase 9: 高级 UI 与打磨
> 产出：丰富的子系统 UI 与用户体验打磨。

| # | 任务 |
|---|------|
| 9.1 | 战斗结算 UI（骰子动画、修正展示） |
| 9.2 | 外交协商界面 |
| 9.3 | 宗教改革 UI |
| 9.4 | 行动选择面板（上下文菜单） |
| 9.5 | 工具提示（空间、单位、卡牌） |
| 9.6 | 游戏日志/事件历史面板 |
| 9.7 | 玩家规则书 `his.html` |
| 9.8 | CSS 主题对齐 |

---

### Phase 10: 场景、边界与多人测试

| # | 任务 |
|---|------|
| 10.1 | 2-5 人变体（一人控制多势力） |
| 10.2 | 锦标赛场景（1532）|
| 10.3 | 边界用例全面测试 |
| 10.4 | 多人网络同步验证 |
| 10.5 | 大状态深拷贝性能优化 |
| 10.6 | 存档/读档 |

---

## 关键技术决策

| 决策 | 方案 | 理由 |
|------|------|------|
| **状态深拷贝** | `JSON.parse(JSON.stringify())` | 与现有游戏一致；如有性能问题再引入 Immer |
| **事件系统** | 注册表模式 `{ eventId: handler }` | 每个 handler 独立可测，避免巨型 switch |
| **脉冲轮转** | 自定义轮转逻辑 | HIS 不是简单的"下一个玩家"，需覆盖 getNextPlayer |
| **响应卡窗口** | `pendingResponse` 状态 | 参考狼人杀猎人开枪的中断模式 |
| **地图渲染** | 静态 SVG 底图 + 动态 SVG 叠加 | 可缩放、CSS 可控、交互性好 |
| **信息隐藏** | `getVisibleState(playerId)` | 每方只能看到自己的手牌和已知信息 |
| **2-5 人支持** | 一人控制多势力 | `activePower` 追踪当前行动势力（非玩家） |
| **文件拆分** | 按职责拆分，每文件 < 1000 行 | 遵循 dev_rules 规范 |
| **helpers 注入** | 参考狼人杀 `_getPhaseHelpers()` | 解决 phases/ 与 index.js 的循环依赖 |

---

## 规模估算

| 阶段 | 代码行数 | 依赖 |
|------|---------|------|
| Phase 0 文档与数据 | ~4,000 | 无 |
| Phase 1 引擎骨架 | ~2,500 | P0 |
| Phase 2 卡牌与 CP | ~2,500 | P1 |
| Phase 3 战斗系统 | ~2,500 | P2 |
| Phase 4 外交 | ~1,500 | P2 |
| Phase 5 VP 与胜利 | ~1,000 | P3+P4 |
| Phase 6 卡牌事件 | ~3,000 | P5 |
| Phase 7 特殊机制 | ~2,500 | P5 |
| Phase 8 SVG 地图+UI | ~4,000 | P2+（可并行） |
| Phase 9 高级 UI | ~3,000 | P8 |
| Phase 10 场景与测试 | ~1,000 | P7 |
| **总计** | **~27,500** | |
| 测试代码 | **~8,000-12,000** | |

**依赖关系图**：
```
P0 → P1 → P2 → P3 → P5 → P6
                ↘ P4 ↗     ↘ (并行)
                            P7
           P2 → P8 → P9
                            P7+P9 → P10
```
P3/P4 可并行，P6/P7 可并行，P8 从 P2 起可并行

---

## 测试策略

1. **数据完整性测试** (P0)：卡牌字段有效、邻接关系双向、初始设置引用合法 ID
2. **规则模块单元测试** (P2-P7)：每个 rules-*.js 对应测试文件
3. **集成测试** (P5+)：模拟完整游戏序列，验证每步状态
4. **信息隐藏测试**：验证 getVisibleState() 不泄露隐藏信息
5. **场景回放测试**：录制已知对局序列，回放验证最终状态

运行命令：
```bash
cd frontend && npm test -- src/games/his/
```

---

## 关键参考文件

| 文件 | 用途 |
|------|------|
| `frontend/src/game/engine.js` | 基类接口：initialize, processMove, checkGameEnd |
| `frontend/src/games/werewolf/index.js` | 复杂游戏实现参考（阶段管理、信息隐藏） |
| `frontend/src/games/werewolf/game-phases.js` | 阶段拆分 + helpers 注入模式 |
| `frontend/src/games/werewolf/config.json` | settingsSchema 配置参考 |
| `frontend/src/main.js` | 游戏注册入口 |
| `docs/games/TEMPLATE.md` | RULES.md 文档模板 |
