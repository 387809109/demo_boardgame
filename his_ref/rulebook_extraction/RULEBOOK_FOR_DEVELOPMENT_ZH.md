# Here I Stand - 开发规则规范（中文）

来源依据：
- `his_ref/HIS-Rules-2010.pdf`
- `his_ref/rulebook_extraction/RULEBOOK_SECTION_NORMALIZED.md`
- `his_ref/rulebook_extraction/RULEBOOK_FOR_DEVELOPMENT.md`

用途：
- 面向程序实现的规则文档。
- 将原规则重写为可执行的状态、流程和判定规则。

配套数据文件（从游戏组件提取）：
- `POWER_CARDS.md` — 行动消耗、统治者属性、VP/关键城轨、势力专属机制
- `SCENARIO_1517_SETUP.md` — 6人1517开局初始单位部署、VP、外交状态
- `RELIGIOUS_STRUGGLE.md` — 新教空间轨（0–50双VP值）、全部27名辩士属性/加值
- `SEQUENCE_OF_PLAY.md` — 9阶段结构、逐回合辩士/卡牌/强制事件时间表
- `RULEBOOK_SECTION_NORMALIZED_ZH.md` — 完整中文规则书（主参考）
- `RULEBOOK_SECTION_NORMALIZED.md` — 完整英文规则书（校验参考）

延迟提取（开发相应模块时直接参考图片源）：
- 战斗表格：`his_ref/img/classified/action summary.jpg`
- 地图拓扑：`his_ref/img/classified/world map.jpg`
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
export type LanguageZone = 'german' | 'english' | 'french' | 'spanish' | 'italian';

export interface SpaceState {
  id: string;
  type: SpaceType;
  homePower: MajorPower | MinorPower | 'independent';
  politicalControl: MajorPower | MinorPower | 'independent';
  religion: Religion;
  unrest: boolean;
  isPort: boolean;
  isFortified: boolean; // 关键城始终有防御；选帝侯无防御
  languageZone: LanguageZone | null; // 奥斯曼/非欧洲空间为 null
  adjacentSpaces: string[];
  adjacentSeaZones: string[];
  passConnections: string[]; // 山道连接（移动花费 2 CP）
  hasJesuitUniversity: boolean;
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

export interface LeaderState {
  id: string;
  owner: MajorPower | MinorPower;
  type: 'army' | 'naval';
  commandRating: number; // 编队上限
  battleRating: number; // 战斗加骰
  location: string | null; // 空间/海域 id，null 表示离场/被俘
  captured: boolean;
  capturedBy: MajorPower | null;
}

export interface ReformerState {
  id: string; // 如 'luther', 'calvin', 'zwingli'
  alive: boolean;
  location: string | null; // 空间 id
  committed: boolean;
  debateValue: number;
  excommunicated: boolean;
}

export interface RulerState {
  power: MajorPower;
  rulerId: string;
  adminRating: number; // 回合间可保留手牌上限
  cardBonus: number; // 抽牌加成
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

  // 将领与改革家
  leaders: Record<string, LeaderState>;
  reformers: Record<string, ReformerState>;

  // 英格兰特规
  henryMaritalStatus: string; // 轨道位置: 'start' | 'ask_divorce' | 'anne_boleyn' | 'jane_seymour' | ...
  edwardBorn: boolean;
  elizabethBorn: boolean;

  // 教廷特规
  stPetersProgress: number; // 圣彼得工程已投入 CP
  jesuitUnlocked: boolean; // Society of Jesus 事件后为 true

  // 新教特规
  schmalkaldicLeagueFormed: boolean;
  translationTrack: Record<LanguageZone, number>; // 各语言区圣经翻译进度 (0-6)
  protestantSpaceCount: number; // 缓存值，用于宗教胜利判定

  // 奥斯曼特规
  piracyVp: number; // 0-10 上限
  algiersInPlay: boolean; // Barbary Pirates 事件后为 true

  // 新大陆
  newWorld: {
    colonies: Record<MajorPower, number>; // 殖民地标记数
    explorersUnderway: Array<{ power: MajorPower; explorer: string; destination: string }>;
    conquestsUnderway: Array<{ power: MajorPower; conquistador: string; destination: string }>;
    galleons: Record<MajorPower, boolean>;
    plantations: Record<MajorPower, boolean>;
    potosi: MajorPower | null;
    raiders: Record<MajorPower, boolean>;
  };

  // 当回合激活事件标记
  augsburgConfessionActive: boolean;
  printingPressActive: boolean;
  wartburgActive: boolean;
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

第 1 回合：

1. `luther_95`（交互阶段：新教玩家在德语区进行 5 次顺序改宗尝试，每次选择目标后掷骰结算，每次 +1 奖励骰）
2. `card_draw`（特殊开局设定 — 放置初始单位、发起始手牌；第 2 回合起：加入回合门控卡、洗牌、发牌）
3. `diplomacy`（简化版 — 无求和/赎回/绝罚子段）
4. `diet_of_worms`（仅第 1 回合 — 哈布斯堡、教廷、新教各出 1 牌）
5. `spring_deployment`
6. `action`（冲动循环，直到 6 家连续 Pass）
7. `winter`
8. `new_world`
9. `victory_determination`

第 2 回合起：仅执行阶段 2-9（无 `luther_95` 和 `diet_of_worms`）。

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

子段执行顺序：
1. 谈判（9.1）— 同盟（9.2）在此段内达成
2. 求和（9.3）
3. 赎回将领（9.4）
4. 解除绝罚（9.5）
5. 宣战（9.6）

注：9.2 同盟是规则说明章节，不是独立子段；同盟在谈判中缔结。

谈判可改变的状态：
- 协议停战（白和；不授予 War Winner VP）。
- 建立一回合同盟（冬季移除）。
- 同盟内借出海军中队/海军将领。
- 归还俘虏将领。
- 让渡空间政治控制（不含己方首都和结盟次要势力本土关键城）。
- 给另一势力最多 2 次随机抽手牌（同回合只能单向；Home 牌不可被抽）。
- 给另一势力最多 4 个雇佣军（同回合只能单向；不能给奥斯曼）。
- 教廷可批准亨利离婚。
- 教廷可撤销对某君主的绝罚。

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

结算（12 步流程，详见第 14 节）：
1. Response 窗口（Landsknechts / Swiss Mercenaries）。
2. 攻方骰 = 每陆军 1 骰 + 最高将领战斗值。
3. 守方骰 = 每陆军 1 骰 + 最高将领战斗值 + 1 防守加骰。
4. 攻方可打 Combat 卡。
5. 守方可打 Combat 卡。
6. 双方掷骰；>= 5 为命中。
7. 奥斯曼 Janissaries 响应窗口（每回合限一次）。
8. 判定胜者（平手 = 守方胜）。
9. 分配损失；双方全灭时：骰数多方保留 1 单位；骰数相同则守方保留 1。
10. 被全灭方将领被俘。
11. 败方撤退（或退入工事）。
12. 若为要塞空间且攻方胜且外部兵力严格多于工事内守军，围城成立。

撤退限制：
- 不可退入动乱、敌占、非法控制空间或海域。
- 无合法退路则部队全灭且将领被俘。

## 14. 围城、强攻、解围（15）

围城成立：
- 守方退入工事后，外部围城方陆军数量必须严格多于工事内守军。

强攻：
- 1 CP。
- 不能在同一冲动”刚围上就强攻”（Roxelana 事件例外）。
- 4 项前置：上一冲动已围城、有 LOC、邻接海域无敌方海军、港口内有敌舰时需海上优势。
- 攻方骰：无守军时每单位 1 骰（骑兵不算）；有守军时每 2 单位 1 骰向上取整（骑兵不算）。
- 守方骰：每单位 1 骰（骑兵不算）+ 1 防守加骰。
- 骑兵可作为强攻损失承受。
- 成功条件：至少 1 命中、守军全灭、至少 1 攻方存活。
- Siege Artillery 响应卡窗口（初始掷骰后）。

解围军：
- 友军进入围城空间发起野战，结果可能解围、部分解围或失败撤退。

破围：
- 围方若不再“严格多于”守方，围城立即破裂并触发围方撤退/无路则消灭。

## 15. 海战子系统（16）

海上移动：
- 1 CP，可在该次行动中移动该势力所有符合条件的海军堆。
- 执行顺序：移动 -> 反应牌 -> 拦截 -> 规避战斗 -> 海战。

海战（10 步流程，详见第 16.2 节）：
- 攻方骰：每中队 2 骰 + 每海盗船 1 骰 + 最高海将战斗值。
- 守方骰：同公式 + 港口防守加 1 骰。
- 双方可打 Combat 卡（先攻后守）。
- 掷骰；>= 5 为命中。
- Janissaries / Professional Rowers 响应窗口。
- 平手 = 守方胜。
- 损失分配：每 2 命中损 1 中队；剩余命中对奥斯曼消灭海盗船；败方奇数命中多损 1 中队；胜方奇数命中忽略。双方全灭时骰多方保留 1 单位。
- 撤退：港口战 — 攻方必退至邻接海域（即使胜）；海域战 — 败方退至己控港口或无敌方海军的海域。

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

这是独立于军事系统的”对抗型判定模块”。

核心入口：

- 95 条论纲（首回合强制，独立阶段，在抽牌前执行）
- 沃姆斯会议（首回合）
- 发表论文（2 CP，指定语言区 2 次尝试）
- 翻译圣经（1+ CP，推进翻译轨）
- 发起神学辩论（3 CP）
- 烧书（2 CP，教廷反改宗）
- 各类事件触发的改宗/反改宗

### 95 条论纲（第 1 回合，第 1 阶段）

交互阶段 — 新教玩家顺序选择目标：

1. Wittenberg 变为新教；放置路德改革家；从选帝侯板放入 2 个新教常备军。
2. 新教获得 5 次改宗尝试，**仅限德语区**。
3. 每次尝试：新教玩家选择合法目标 → 掷骰 → 显示结果。
4. 每次尝试结束后，**重新计算**合法目标（新转化的空间产生新邻接）。
5. 每次尝试获得 **+1 奖励骰**（来自 95 条论纲事件）。
6. 这是唯一一张结算后不额外给 2 CP 的强制事件牌。

### 改宗尝试算法（18.3）

1. **选择目标**：必须为天主教，且满足以下之一：含改革家、邻接新教空间（含山口）、港口相连新教港口。目标可在任意语言区，但平局归属和自动成功仅在目标语言区内生效。
2. **新教基础骰**（仅连接，不含山口；排除动乱空间）：
   - 每个邻接新教空间 +1
   - 每个邻接改革家 +1
   - 每个邻接新教陆军堆 +1
   - 目标空间内有改革家 +2
   - 目标空间内有新教陆军堆 +2
   - 即使以上均为 0，也至少 1 骰
3. **额外骰**（若满足）：
   - 本回合已打出印刷机：+1
   - 来自 95 条论纲：+1
   - 适用辩士加值：+1
4. **新教掷骰**：掷总骰数；若全本圣经或加尔文教规适用且目标在目标语言区，每颗骰 +1。记录**最高单颗修正后点数**（非命中数）。
5. **自动成功**：最高修正后点数 ≥ 6 且目标在目标语言区 → 直接成功，无需教廷防守。
6. **教廷防守骰**（仅连接，排除山口/动乱）：
   - 每个邻接天主教空间 +1
   - 每个邻接耶稣会大学 +1
   - 每个邻接天主教陆军堆 +1
   - 目标空间内有耶稣会大学 +2
   - 目标空间内有天主教陆军堆 +2
   - 至少 1 骰
7. **教廷掷骰**：记录最高单颗点数。
8. **比较**：新教最高 > 教廷最高 → 成功。**平局**：目标在目标语言区内新教胜，否则教廷胜。
9. **成功时**：翻为新教。若为选帝侯空间，从选帝侯板放入 2 个新教常备军（21.6）。

### 反改宗算法（18.4）

镜像改宗，角色互换：

- 教廷主攻（邻接骰规则同改宗但针对天主教方）。
- 自动成功：教廷最高 = 6 且目标在目标语言区且教皇为 Paul III 或 Julius III。
- 平局：仅当教皇为 Paul III/Julius III 且目标在目标语言区时教廷胜；否则新教胜。
- 奥格斯堡信条：若本回合打出，教廷每颗骰 −1。

### 神学辩论（18.5）

- 按规则随机或指定辩士。
- 进攻方掷骰：辩士辩论值 + 3 颗骰，每个 5/6 = 1 命中。
- 防守方：未承诺辩士 = 辩论值 + 2 颗骰；已承诺 = 辩论值 + 1 颗骰。
- 首轮平手 → 同语言区再抽辩士进入第二轮。
- 第二轮仍平 → 辩论无结果。
- 胜方按命中差翻宗教空间。
- 教廷胜且差值 > 新教辩士辩论值 → 烧死（教廷获等值 VP）。
- 新教胜且差值 > 教廷辩士辩论值 → 羞辱（新教获等值 VP）。

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
