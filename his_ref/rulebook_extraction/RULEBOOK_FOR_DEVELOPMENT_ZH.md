# Here I Stand - 开发规则规范（中文）

来源依据：
- `his_ref/HIS-Rules-2010.pdf`
- `his_ref/rulebook_extraction/RULEBOOK_SECTION_NORMALIZED.md`
- `his_ref/rulebook_extraction/RULEBOOK_FOR_DEVELOPMENT.md`

用途：
- 面向程序实现的规则文档。
- 将原规则重写为可执行的状态、流程和判定规则。
- 卡牌逐条文本效果未在本文完整展开，需结合卡牌数据实现。

## 1. 游戏总览

- 玩家数：2-6（低人数局可共享势力）。
- 主要势力：奥斯曼、哈布斯堡、英格兰、法兰西、教廷、新教。
- 次要势力：热那亚、匈牙利/波希米亚、苏格兰、威尼斯。
- 回合上限：最多 9 回合。
- 即时胜利：
1. 军事胜利：非新教势力在行动阶段满足其自动胜利关键城阈值，且所需关键城无动乱。
2. 宗教胜利：新教势力达到 50 个新教影响空间（动乱空间不计）。
- 回合结算胜利：
1. 标准胜利：达到至少 25 VP 且总分最高。
2. 支配胜利：第 4 回合及以后，VP < 25 且至少领先每个对手 5 VP。
3. 时间胜利：第 9 回合结束时 VP 最高。

## 2. 核心状态模型

```ts
export type MajorPower =
  | 'ottoman'
  | 'hapsburg'
  | 'england'
  | 'france'
  | 'papacy'
  | 'protestant';

export type MinorPower =
  | 'genoa'
  | 'hungary_bohemia'
  | 'scotland'
  | 'venice';

export type Religion = 'catholic' | 'protestant' | 'other';
export type SpaceType = 'key' | 'electorate' | 'fortress' | 'unfortified';

export interface SpaceState {
  id: string;
  type: SpaceType;
  homePower: MajorPower | MinorPower | 'independent';
  politicalControl: MajorPower | MinorPower | 'independent';
  religion: Religion;
  unrest: boolean;
  isPort: boolean;
  besiegedBy: MajorPower[];
  occupiedBy: UnitStack[];
}

export interface UnitStack {
  owner: MajorPower | MinorPower;
  regulars: number;
  mercenaries: number;
  cavalry: number;
  squadrons: number;
  corsairs: number;
  armyLeaders: string[];
  navalLeaders: string[];
}

export interface RulerState {
  power: MajorPower;
  rulerId: string;
  adminRating: number;
  cardBonus: number;
}

export type CardType =
  | 'home'
  | 'mandatory_event'
  | 'event'
  | 'response'
  | 'combat';

export interface CardState {
  id: string;
  type: CardType;
  cp: number;
  ownerPower?: MajorPower;
  removeIfEvent: boolean;
  mandatoryDueTurn?: number;
}

export interface DiplomaticState {
  atWar: Record<MajorPower, Record<MajorPower | MinorPower, boolean>>;
  alliedMajor: Record<MajorPower, Record<MajorPower, boolean>>;
  alliedMinor: Record<MinorPower, MajorPower | null>;
  loanedSquadrons: Array<{ from: MajorPower; to: MajorPower; count: number }>;
}

export interface GameState {
  turn: number;
  phase:
    | 'luther_95'
    | 'card_draw'
    | 'diplomacy'
    | 'diet_of_worms'
    | 'spring_deployment'
    | 'action'
    | 'winter'
    | 'new_world'
    | 'victory_determination';
  impulseOrder: MajorPower[];
  activePower: MajorPower | null;
  spaces: Record<string, SpaceState>;
  rulers: Record<MajorPower, RulerState>;
  diplomacy: DiplomaticState;
  deck: string[];
  discard: string[];
  removedCards: string[];
  hands: Record<MajorPower, string[]>;
  homeCardPlayed: Record<MajorPower, boolean>;
  vp: Record<MajorPower, number>;
  bonusVp: Record<MajorPower, number>;
  markers: Record<string, unknown>;
}
```

## 3. 常量与顺序

- 冲动顺序固定：
1. 奥斯曼
2. 哈布斯堡
3. 英格兰
4. 法兰西
5. 教廷
6. 新教
- 大多数战斗命中规则：掷骰 `>= 5` 记为 1 命中。
- 战斗平局默认防守方胜（宗教子系统有特例）。

## 4. 回合与阶段引擎

每回合阶段顺序：
1. `luther_95`（仅第 1 回合）
2. `card_draw`
3. `diplomacy`（第 1 回合为简化版）
4. `diet_of_worms`（仅第 1 回合）
5. `spring_deployment`
6. `action`（冲动循环，直到 6 家连续 Pass）
7. `winter`
8. `new_world`
9. `victory_determination`

行动阶段循环：
- 每个势力轮到时只能选一项：
1. 出牌换 CP。
2. 事件方式打牌。
3. Pass。
- 不可 Pass 条件：
1. 本势力 Home 牌仍在手。
2. 有 Mandatory 牌仍在手。
3. 手牌数大于当前君主行政值。
- 连续 6 次 Pass 后阶段结束。

## 5. 卡牌系统

卡牌类型：
- Home：每回合固定进手牌；不能被随机抽走；打出后放在势力板，不进弃牌堆。
- Mandatory Event：抽到当回合行动阶段必须打；先结算事件，再给 2 CP；多数会移出游戏。
- Event：普通事件，可改为 CP 使用。
- Response：可在对应时机打断流程。
- Combat：仅在己方参与战斗时可作为事件打出，否则可当 CP。

牌库生命周期：
1. 抽牌阶段先加入本回合可入场/变量卡。
2. 洗共享牌库。
3. 按基础抽牌数 + 君主加成发牌。
4. 手牌 = 新发牌 + 上回合保留牌 + Home 牌。
5. 弃牌堆下回合回洗。

基础抽牌数：
- 非新教：按势力板关键城轨道（受关键城动乱惩罚，至少 1 张）。
- 新教：若新教政治控制选帝侯 >= 4，则 5 张，否则 4 张。

## 6. 君主与行政值

- 君主提供两项核心属性：
1. `adminRating`：回合结束可保留手牌上限。
2. `cardBonus`：抽牌加成。
- 奥斯曼与哈布斯堡在本版中君主固定（苏莱曼/查理五世）。
- 其他势力君主通过 Mandatory 事件更替。
- 部分君主会改变宗教系统判定。

## 7. 单位与编队

陆军类型：
- 常备军（全部势力）
- 雇佣军（除奥斯曼外主要势力）
- 骑兵（仅奥斯曼）

海军类型：
- 战列中队（除新教与匈牙利/波希米亚）
- 海盗船（仅奥斯曼）

陆上编队上限：
- 无将领：最多 4 个陆军单位。
- 1 名将领：上限 = 该将领指挥值。
- 2+ 将领：上限 = 指挥值最高两名之和。
- 将领本身不计入陆军单位数量。

## 8. 外交阶段（9.1-9.6）

子段顺序：
1. 谈判
2. 同盟
3. 求和
4. 赎回将领
5. 解除绝罚
6. 宣战

谈判可改变的状态：
- 协议停战（白和）。
- 建立一回合同盟。
- 同盟内借出海军中队/海军将领。
- 归还俘虏将领。
- 让渡空间政治控制。
- 交换手牌。
- 教廷可批准亨利离婚。

同盟：
- 持续到冬季同盟清除步骤。
- 同盟空间视为友方；可单向借舰队。
- 教廷与奥斯曼不能结盟。

求和：
- 必须满足可求和前置损失条件。
- 过程包含胜者 VP、空间控制调整、部队回撤、战争结束。
- 新教与哈布斯堡/教廷之间受施马尔卡尔登同盟限制。

宣战：
- 按外交矩阵支付 CP。
- 目标合法性限制必须全部满足。
- 更新战争状态并处理次要势力介入。

## 9. 春季调动（阶段 5）

- 每势力可免费将 1 个编队从首都调往友控目标。
- 按冲动顺序执行。
- 路径约束：
1. 全程友控。
2. 路径无动乱。
3. 可在严格条件下跨 1 个海域。
4. 不可越山道（特定事件可豁免）。
- 哈布斯堡有双首都特殊规则。
- 新教无首都，不能春季调动。

## 10. 行动目录（11.1）

- CP 按“逐个行动”消耗并立即完整结算。
- 主要行动族：
1. 陆上移动/越山道移动。
2. 海上移动。
3. 造兵。
4. 强攻/海外战。
5. 控制无防御空间与去动乱。
6. 宗教行动（论文、译经、神学辩论、烧书、耶稣会大学、圣彼得工程）。
7. 新大陆行动（探索、殖民、征服）。

限制：
- `explore`、`colonize`、`conquer` 每势力每回合最多一次。
- CP 不可跨冲动保留。

## 11. 控制、补给线、动乱（12）

补给线 LOC：
- 控制变化与强攻常见前置条件。
- 从友控且可作为来源的要塞/本土空间追踪。
- 路径需友控且无动乱。
- 与冬季回撤路径判定不同（LOC 对敌军更敏感）。

控制无防御空间：
- 1 CP，满足占领/邻接/敌方状态等条件后翻控制。

动乱效果：
- 阻断 LOC。
- 限制移动、建造、计分与部分海盗防御效果。
- 可被对应行动清除。

## 12. 陆上移动与反应（13）

移动动作：
- 平地移动：1 CP。
- 越山道移动：2 CP。

流程核心：
1. 编队合法性检查。
2. 目的地合法性检查（战争/同盟/控制）。
3. 敌军拦截窗口。
4. 防守方可规避战斗/退入工事。
5. 同格敌军仍共存则进入野战。

拦截：
- 邻接且满足条件的敌军可尝试。
- 多方可拦截时按冲动顺序。
- 首个成功拦截会阻断其他拦截者。

## 13. 野战（14）

骰池：
- 进攻方：每陆军 1 骰 + 最高将领战斗值。
- 防守方：同上 + 防守加 1 骰。

结算：
1. 双方出战斗牌（先攻后守）。
2. 掷骰计命中。
3. 按命中分配损失。
4. 全灭方将领被俘。
5. 败方撤退（或可退入工事）。
6. 若在要塞空间且攻方胜，继续检查围城成立。

撤退限制：
- 不可退入动乱、敌占、非法控制空间或海域。
- 无合法退路则部队全灭且将领被俘。

## 14. 围城、强攻、解围（15）

围城成立：
- 守方退入工事后，外部围城方陆军数量必须严格多于工事内守军。

强攻：
- 1 CP。
- 通常不能在同一冲动“刚围上就强攻”（事件例外）。
- 需满足 LOC 与海上封锁条件。
- 按强攻专用骰池结算。
- 成功则夺取控制并处理守方将领/海军后果。

解围军：
- 友军进入围城空间发起野战，结果可能解围、部分解围或失败撤退。

破围：
- 围方若不再“严格多于”守方，围城立即破裂并触发围方撤退/无路则消灭。

## 15. 海战子系统（16）

海上移动：
- 1 CP，可在该次行动中移动该势力所有符合条件的海军堆。
- 执行顺序：移动 -> 反应牌 -> 拦截 -> 规避战斗 -> 海战。

海战：
- 中队每个 2 骰，海盗船每个 1 骰。
- 最高海将战斗值加骰。
- 港口防守方额外 +1 骰。
- 奥斯曼海盗船与中队损失分配有特殊规则。
- 战后按海域/港口规则撤退。

海运：
- 使用海上路径运输陆军编队。
- 每段 1 CP。
- 编队上限 5 陆军 + 将领。
- 冲动结束前必须回到港口。
- 若登陆后野战失败，运输部队会被消灭。

海盗：
- 奥斯曼专属，2 CP，每海域每回合最多一次。
- 先由目标方进行反海盗掷骰，再由存活海盗船进行劫掠掷骰。
- 每个劫掠命中由目标方三选一承受代价（失舰、失牌、给奥斯曼海盗 VP）。

## 16. 建造（17）

通则：
- 默认只能在友控本土空间/港口建造（事件可改写）。
- 动乱空间不能建造。
- 实体棋子数量是硬上限。

陆军建造：
- 常备军：2 CP。
- 雇佣军：1 CP（非奥斯曼主要势力）。
- 骑兵：1 CP（仅奥斯曼）。

海军建造：
- 中队：2 CP（除新教外）。
- 海盗船：1 CP（仅奥斯曼，且需满足巴巴里海盗等前提与港口条件）。

## 17. 宗教子系统（18）

这是独立于军事系统的“对抗型判定模块”。

核心入口：
- 95 条（首回合强制）
- 沃姆斯会议（首回合）
- 发表论文
- 翻译圣经
- 发起神学辩论
- 烧书
- 各类事件触发的改宗/反改宗

改宗尝试算法：
1. 选择合法天主教目标空间。
2. 计算新教骰池（邻接/改革家/驻军 + 加成）。
3. 新教掷骰，取最高修正值。
4. 检查自动成功。
5. 教廷计算并掷防守骰池。
6. 比较最高值与平局归属规则。
7. 成功则翻宗教影响并处理选帝侯等附带效果。

反改宗算法镜像处理，按教廷主动方规则与其特定平局/自动成功条件执行。

神学辩论：
- 按规则随机或指定辩士。
- 双方掷骰并比较命中。
- 首轮平手可能进入第二轮。
- 按差值翻宗教空间。
- 差值超过辩士值触发烧死/羞辱并计 VP。

## 18. 冬季阶段（19）

全局顺序：
1. 移除借舰标记。
2. 移除本回合临时叛将。
3. 海军回港。
4. 陆军与将领回要塞（必要时受损耗）。
5. 清除主要势力同盟标记。
6. 各友控且无动乱首都补 1 常备军（哈布斯堡可双首都补；新教无此补员）。
7. 清除海盗标记。
8. 全部辩士翻回未承诺面。
9. 到期 Mandatory 事件自动结算。

## 19. 新大陆子系统（20）

动作：
- 殖民
- 探索
- 征服

关键点：
- 仅英法哈可执行。
- 行动阶段放“进行中”标记。
- 新大陆阶段统一结算。
- 探索/征服按 `2d6 + 修正` 查表。
- 可能获得 VP、发现、殖民收益、额外抽牌潜力或探险家损失。
- 财富收益在抽牌阶段检查。

## 20. 主要势力特规（21）

奥斯曼：
- 骑兵、海盗船、海盗行动、海盗港与海外战特规。

哈布斯堡：
- 双首都及相关调动/回撤特规。

英格兰：
- 亨利八世婚姻与继承轨道。
- 玛丽一世时期特规。

法兰西：
- 艺术赞助与城堡 VP 机制。

教廷：
- 耶稣会解锁、绝罚系统、罗马洗劫、圣彼得工程计分。

新教：
- 施马尔卡尔登同盟前限制。
- 触发后转入完整军事参与。

## 21. 次要势力与独立关键城（22）

次要势力状态：
- `inactive`
- `active(allied_to_major)`

激活/停用：
- 由外交介入与特定事件驱动。
- 激活后视作其同盟主要势力的军事延伸。
- 匈牙利/波希米亚有特殊永久激活路径。

独立关键城：
- 可被主要势力夺取并长期维持，除非被特定事件改回独立。

## 22. 计分与胜利（23）

VP 构成：
- 基础 VP（关键城/选帝侯轨道）
- 特殊 VP 轨道（如新教空间等）
- 奖励 VP 标记（事件、辩论、新大陆、战争等）

胜利判定算法：
1. 行动阶段持续检查即时军事/宗教胜利。
2. 胜利判定阶段计算各家总 VP。
3. 检查标准胜利。
4. 检查支配胜利（仅第 4 回合及之后）。
5. 若第 9 回合仍无胜者，按时间胜利处理。
6. 平手按前回合 VP 逐回溯打破。

## 23. 推荐引擎模块拆分

1. `cards/`
2. `diplomacy/`
3. `movement_land/`
4. `combat_field/`
5. `siege/`
6. `movement_naval/`
7. `piracy/`
8. `reformation/`
9. `winter/`
10. `new_world/`
11. `scoring/`

## 24. 校验顺序与规则优先级

动作合法性校验顺序：
1. 阶段是否合法。
2. 势力是否可执行。
3. 牌/CP 支付是否合法。
4. 目标是否合法（战争/同盟/空间/单位）。
5. 次数上限是否合法（每回合/每冲动）。
6. 中断窗口（Response/Combat）是否正确处理。

优先级原则：
- 具体卡牌/事件文本优先于基础通则。
- 两个文本冲突时，按时机窗口与主动方顺序结算，除非文本另有明确指定。

## 25. 最低测试矩阵

1. 第 1 回合流程（95 条、沃姆斯、简化外交）。
2. Pass 合法性（Home/Mandatory/admin 限制）。
3. LOC + 控制 + 动乱联动。
4. 拦截/规避/退入工事链路。
5. 围城建立-强攻-解围-破围状态机。
6. 海上移动 + 拦截 + 多段海运。
7. 海盗收益在“空手牌/VP 上限”下的边界。
8. 宗教系统平局归属与语言区修正。
9. 冬季回撤损耗与“首都被敌控”特例。
10. 新大陆结算顺序与查表结果。
11. 次要势力激活/停用与匈牙利特例。
12. 标准/支配/时间胜利与平手回溯。

## 26. 范围说明

- 本文是开发规范，不是逐字法条式全文翻译。
- 精确卡牌文本、查表数值、场景设定请以官方规则与数据源为准。
- OCR 模糊处应回查原 PDF 作为最终依据。
