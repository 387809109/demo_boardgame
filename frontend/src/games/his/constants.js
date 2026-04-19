/**
 * Here I Stand — Game Constants
 *
 * All enums, action costs, VP tracks, and static game tables.
 * Sources: RULEBOOK_FOR_DEVELOPMENT.md, POWER_CARDS.md,
 *          RELIGIOUS_STRUGGLE.md, SEQUENCE_OF_PLAY.md
 */

// ── Major & Minor Powers ───────────────────────────────────────────

export const MAJOR_POWERS = [
  'ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'
];

export const MINOR_POWERS = [
  'genoa', 'hungary_bohemia', 'scotland', 'venice'
];

/** Fixed impulse order within the Action Phase */
export const IMPULSE_ORDER = [
  'ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'
];

/**
 * Default power assignments for 3-6 player games.
 * Each entry maps player count → array of power groups (one group per player).
 * Based on official HIS 500th Anniversary recommended combinations.
 */
export const DEFAULT_POWER_ASSIGNMENTS = {
  6: [['ottoman'], ['hapsburg'], ['england'], ['france'], ['papacy'], ['protestant']],
  5: [['ottoman'], ['hapsburg'], ['england'], ['france'], ['papacy', 'protestant']],
  4: [['ottoman'], ['hapsburg'], ['england', 'protestant'], ['france', 'papacy']],
  3: [['ottoman'], ['hapsburg', 'england'], ['france', 'papacy', 'protestant']]
};

// ── Enums ──────────────────────────────────────────────────────────

export const RELIGION = {
  CATHOLIC: 'catholic',
  PROTESTANT: 'protestant',
  OTHER: 'other'
};

export const SPACE_TYPE = {
  KEY: 'key',
  ELECTORATE: 'electorate',
  FORTRESS: 'fortress',
  UNFORTIFIED: 'unfortified'
};

export const LANGUAGE_ZONE = {
  GERMAN: 'german',
  ENGLISH: 'english',
  FRENCH: 'french',
  SPANISH: 'spanish',
  ITALIAN: 'italian'
};

export const CARD_TYPE = {
  HOME: 'home',
  MANDATORY_EVENT: 'mandatory_event',
  EVENT: 'event',
  RESPONSE: 'response',
  COMBAT: 'combat'
};

export const PHASE = {
  LUTHER_95: 'luther_95',
  CARD_DRAW: 'card_draw',
  DIPLOMACY: 'diplomacy',
  DIET_OF_WORMS: 'diet_of_worms',
  SPRING_DEPLOYMENT: 'spring_deployment',
  ACTION: 'action',
  WINTER: 'winter',
  NEW_WORLD: 'new_world',
  VICTORY_DETERMINATION: 'victory_determination'
};

export const UNIT_TYPE = {
  REGULAR: 'regular',
  MERCENARY: 'mercenary',
  CAVALRY: 'cavalry',
  SQUADRON: 'squadron',
  CORSAIR: 'corsair'
};

export const DEBATER_FACTION = {
  LUTHERAN: 'lutheran',
  CALVINIST: 'calvinist',
  ANGLICAN: 'anglican',
  PAPAL: 'papal'
};

// ── Turn Phases (ordered) ──────────────────────────────────────────

export const PHASE_ORDER = [
  PHASE.LUTHER_95,          // Turn 1 only
  PHASE.CARD_DRAW,
  PHASE.DIPLOMACY,
  PHASE.DIET_OF_WORMS,      // Turn 1 only
  PHASE.SPRING_DEPLOYMENT,
  PHASE.ACTION,
  PHASE.WINTER,
  PHASE.NEW_WORLD,
  PHASE.VICTORY_DETERMINATION
];

// ── Action Costs (per power) ───────────────────────────────────────

/**
 * CP cost for each action by power.
 * null = action unavailable for that power.
 */
export const ACTION_COSTS = {
  ottoman: {
    move_formation: 1,
    move_over_pass: 2,
    naval_move: 1,
    buy_mercenary: null,
    raise_regular: 2,
    raise_cavalry: 1,
    build_squadron: 2,
    build_corsair: 1,
    assault: 1,
    fight_foreign_war: 1,
    control_unfortified: 1,
    initiate_piracy: 2,
    explore: null,
    colonize: null,
    conquer: null,
    publish_treatise: null,
    translate_scripture: null,
    call_debate: null,
    build_st_peters: null,
    burn_books: null,
    found_jesuit: null
  },
  hapsburg: {
    move_formation: 1,
    move_over_pass: 2,
    naval_move: 1,
    buy_mercenary: 1,
    raise_regular: 2,
    raise_cavalry: null,
    build_squadron: 2,
    build_corsair: null,
    assault: 1,
    fight_foreign_war: null,
    control_unfortified: 1,
    initiate_piracy: null,
    explore: 2,
    colonize: 2,
    conquer: 4,
    publish_treatise: null,
    translate_scripture: null,
    call_debate: null,
    build_st_peters: null,
    burn_books: null,
    found_jesuit: null
  },
  england: {
    move_formation: 1,
    move_over_pass: 2,
    naval_move: 1,
    buy_mercenary: 1,
    raise_regular: 2,
    raise_cavalry: null,
    build_squadron: 2,
    build_corsair: null,
    assault: 1,
    fight_foreign_war: 1,
    control_unfortified: 1,
    initiate_piracy: null,
    explore: 2,
    colonize: 3,
    conquer: 4,
    publish_treatise: 3,   // English zone only
    translate_scripture: null,
    call_debate: null,
    build_st_peters: null,
    burn_books: null,
    found_jesuit: null
  },
  france: {
    move_formation: 1,
    move_over_pass: 2,
    naval_move: 1,
    buy_mercenary: 1,
    raise_regular: 2,
    raise_cavalry: null,
    build_squadron: 2,
    build_corsair: null,
    assault: 1,
    fight_foreign_war: null,
    control_unfortified: 1,
    initiate_piracy: null,
    explore: 2,
    colonize: 3,
    conquer: 4,
    publish_treatise: null,
    translate_scripture: null,
    call_debate: null,
    build_st_peters: null,
    burn_books: null,
    found_jesuit: null
  },
  papacy: {
    move_formation: 1,
    move_over_pass: 2,
    naval_move: 1,
    buy_mercenary: 1,
    raise_regular: 2,
    raise_cavalry: null,
    build_squadron: 2,
    build_corsair: null,
    assault: 1,
    fight_foreign_war: null,
    control_unfortified: 1,
    initiate_piracy: null,
    explore: null,
    colonize: null,
    conquer: null,
    publish_treatise: null,
    translate_scripture: null,
    call_debate: 3,
    build_st_peters: 1,
    burn_books: 2,
    found_jesuit: 3
  },
  protestant: {
    move_formation: 1,
    move_over_pass: 2,
    naval_move: null,
    buy_mercenary: 1,
    raise_regular: 2,
    raise_cavalry: null,
    build_squadron: null,
    build_corsair: null,
    assault: 1,
    fight_foreign_war: null,
    control_unfortified: 1,
    initiate_piracy: null,
    explore: null,
    colonize: null,
    conquer: null,
    publish_treatise: 2,
    translate_scripture: 1,
    call_debate: 3,
    build_st_peters: null,
    burn_books: null,
    found_jesuit: null
  }
};

// ── Ruler Attributes ───────────────────────────────────────────────

export const RULERS = {
  ottoman: [
    { id: 'suleiman', name: 'Suleiman', battle: 2, command: 12, admin: 2, cardBonus: 0 }
  ],
  hapsburg: [
    { id: 'charles_v', name: 'Charles V', battle: 2, command: 10, admin: 2, cardBonus: 0 }
  ],
  england: [
    { id: 'henry_viii', name: 'Henry VIII', battle: 1, command: 8, admin: 1, cardBonus: 1 },
    { id: 'edward_vi', name: 'Edward VI', battle: 0, command: 0, admin: 1, cardBonus: 1 },
    { id: 'mary_i', name: 'Mary I', battle: 0, command: 0, admin: 1, cardBonus: 0 },
    { id: 'elizabeth_i', name: 'Elizabeth I', battle: 0, command: 0, admin: 2, cardBonus: 1 }
  ],
  france: [
    { id: 'francis_i', name: 'Francis I', battle: 1, command: 8, admin: 1, cardBonus: 1 },
    { id: 'henry_ii', name: 'Henry II', battle: 0, command: 8, admin: 2, cardBonus: 0 }
  ],
  papacy: [
    { id: 'leo_x', name: 'Leo X', battle: 0, command: 0, admin: 0, cardBonus: 0 },
    { id: 'clement_vii', name: 'Clement VII', battle: 0, command: 0, admin: 0, cardBonus: 0 },
    { id: 'paul_iii', name: 'Paul III', battle: 0, command: 0, admin: 1, cardBonus: 0 },
    { id: 'julius_iii', name: 'Julius III', battle: 0, command: 0, admin: 1, cardBonus: 0 },
    { id: 'paul_iv', name: 'Paul IV', battle: 0, command: 0, admin: 0, cardBonus: 1 }
  ],
  protestant: [
    { id: 'luther', name: 'Martin Luther', battle: 0, command: 0, admin: 2, cardBonus: 0 }
  ]
};

// ── VP & Card Draw Tracks (per key count) ──────────────────────────

/**
 * Index = number of keys controlled. VP/cards for that key count.
 * Last entry = Auto Win threshold.
 */
export const KEY_VP_TRACK = {
  //           keys:  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14
  ottoman:  { vp:   [0,  2,  4,  6,  8, 10, 12, 14, 16, 18, 20],
              cards: [0,  2,  2,  3,  3,  4,  4,  5,  5,  6,  6],
              autoWin: 11 },
  hapsburg: { vp:   [0,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14],
              cards: [0,  1,  2,  2,  3,  3,  4,  4,  5,  5,  6,  6,  7,  7],
              autoWin: 14 },
  england:  { vp:   [0,  3,  5,  7,  9, 11, 13, 15, 17],
              cards: [0,  1,  1,  2,  2,  3,  3,  4,  4],
              autoWin: 9 },
  france:   { vp:   [0,  2,  4,  6,  8, 10, 12, 14, 16, 18, 20],
              cards: [0,  1,  1,  1,  2,  2,  3,  3,  4,  4,  4,  5],
              autoWin: 13 },
  papacy:   { vp:   [0,  2,  4,  6,  8, 10, 12],
              cards: [0,  2,  3,  3,  4,  4,  4],
              autoWin: 7 }
  // Protestant uses fixed card draw rule, not key track
};

/** Protestant card draw: 5 if >=4 electorates under Protestant political control, else 4 */
export const PROTESTANT_CARD_DRAW = { base: 4, withElectorates: 5, electorateThreshold: 4 };

// ── Protestant Spaces Track (VP lookup) ────────────────────────────

/**
 * Index = number of Protestant-influenced spaces.
 * Each entry: [papalVP, protestantVP].
 * Position 50 = religious victory (instant win).
 */
export const PROTESTANT_SPACES_TRACK = [
  [15,0],[15,0],[15,0],[14,0],[14,0],[14,1],[13,1],[13,2],[13,2],[13,2],
  [12,3],[12,3],[12,3],[12,4],[11,4],[11,4],[11,5],[10,5],[10,5],[10,6],
  [9,6],[9,6],[9,7],[8,7],[8,7],[7,7],[7,7],[6,8],[6,8],[5,8],
  [5,9],[5,9],[4,9],[4,10],[3,10],[3,10],[3,10],[2,10],[2,10],[4,11],
  [3,11],[3,11],[3,11],[2,11],[2,11],[1,11],[1,11],[1,11],[1,11],[1,11]
];

export const PROTESTANT_RELIGIOUS_VICTORY = 50;

// ── Saint Peter's Construction ─────────────────────────────────────

export const ST_PETERS = {
  cpPerVp: 5,
  maxVp: 5
};

// ── Piracy Track ───────────────────────────────────────────────────

/** Index = piracy marker position; value = Ottoman VP from piracy */
export const PIRACY_VP_TRACK = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ── Henry's Marital Status ─────────────────────────────────────────

export const MARITAL_STATUS = [
  'catherine_of_aragon',
  'ask_divorce',
  'anne_boleyn',
  'jane_seymour',
  'anne_of_cleves',
  'kathryn_howard',
  'katherine_parr'
];

/**
 * Pregnancy Table (rule 21.3).
 * Roll 1d6 when Henry remarries.
 * Result: no_child, boy (Edward), girl (Elizabeth), or both.
 */
export const PREGNANCY_TABLE = [
  null, // index 0 unused
  { result: 'no_child' },        // roll 1
  { result: 'no_child' },        // roll 2
  { result: 'boy' },             // roll 3 — Edward born
  { result: 'girl' },            // roll 4 — Elizabeth born
  { result: 'boy' },             // roll 5 — Edward born
  { result: 'boy_and_girl' }     // roll 6 — Both born
];

// ── Chateaux Table (France) ────────────────────────────────────────

export const CHATEAU_TABLE = [
  { minRoll: -Infinity, maxRoll: 2,  vp: 0, drawCards: 2, discardCards: 1 },
  { minRoll: 3,         maxRoll: 4,  vp: 1, drawCards: 1, discardCards: 1 },
  { minRoll: 5,         maxRoll: 7,  vp: 1, drawCards: 1, discardCards: 0 },
  { minRoll: 8,         maxRoll: Infinity, vp: 1, drawCards: 2, discardCards: 1 }
];

export const CHATEAU_MODIFIERS = {
  milanControlled: 2,
  florenceControlled: 1,
  threeItalianKeys: 2,
  tournament: 1,
  homeSpaceLost: -1,
  homeSpaceOccupied: -2
};

export const CHATEAU_VP_TRACK = [0, 1, 2, 3, 4, 5, 6];

// ── Translation Tracks ─────────────────────────────────────────────

export const TRANSLATION = {
  newTestamentCp: 6,
  newTestamentRolls: 6,
  fullBibleCp: 10,
  fullBibleRolls: 6,
  fullBibleBonusRolls: 1
};

// ── Formation Rules ────────────────────────────────────────────────

export const FORMATION = {
  noLeaderMax: 4,
  hitThreshold: 5     // dice >= 5 are hits
};

// ── Victory Conditions ─────────────────────────────────────────────

export const VICTORY = {
  standardVp: 25,
  dominationMinTurn: 4,
  dominationGap: 5,
  maxTurns: 9,
  consecutivePassesToEnd: 6
};

// ── Debaters ───────────────────────────────────────────────────────

export const DEBATERS = [
  // Protestant — Lutheran
  { id: 'luther',          name: 'Luther',          faction: 'lutheran',  value: 4, entryTurn: 1, zone: 'german', ability: '德语区翻译圣经时额外获得CP' },
  { id: 'melanchthon',     name: 'Melanchthon',     faction: 'lutheran',  value: 3, entryTurn: 1, zone: 'german', ability: '德语区翻译圣经时额外获得CP' },
  { id: 'bucer',           name: 'Bucer',           faction: 'lutheran',  value: 2, entryTurn: 1, zone: 'german', ability: '斯特拉斯堡2格内的宗教改革+1骰' },
  { id: 'carlstadt',       name: 'Carlstadt',       faction: 'lutheran',  value: 1, entryTurn: 1, zone: 'german', ability: '可用论文同时尝试改革3个德语区地点；失败会引发骚乱' },
  { id: 'zwingli',         name: 'Zwingli',         faction: 'lutheran',  value: 3, entryTurn: 2, zone: 'german', ability: '苏黎世2格内的宗教改革+1骰' },
  { id: 'oekolampadius',   name: 'Oekolampadius',   faction: 'lutheran',  value: 2, entryTurn: 2, zone: 'german', ability: '巴塞尔2格内的宗教改革+1骰' },
  { id: 'bullinger',       name: 'Bullinger',       faction: 'lutheran',  value: 2, entryTurn: 3, zone: 'german', ability: '任意区域辩论第二轮可介入' },

  // Protestant — Calvinist
  { id: 'calvin',          name: 'Calvin',          faction: 'calvinist',  value: 4, entryTurn: 4, zone: 'french', ability: '可用论文同时尝试改革3个法语区地点' },
  { id: 'farel',           name: 'Farel',           faction: 'calvinist',  value: 2, entryTurn: 4, zone: 'french', ability: '日内瓦2格内的宗教改革+1骰' },
  { id: 'cop',             name: 'Cop',             faction: 'calvinist',  value: 2, entryTurn: 4, zone: 'french', ability: '巴黎2格内的宗教改革+1骰' },
  { id: 'olivetan',        name: 'Olivetan',        faction: 'calvinist',  value: 1, entryTurn: 4, zone: 'french', ability: '法语区翻译圣经时额外获得CP' },

  // Protestant — Anglican
  { id: 'tyndale',         name: 'Tyndale',         faction: 'anglican',  value: 2, entryTurn: 2, zone: 'english', ability: '英语区翻译圣经时额外获得CP' },
  { id: 'cranmer',         name: 'Cranmer',         faction: 'anglican',  value: 3, entryTurn: 4, zone: 'english', conditional: true, ability: '伦敦2格内的宗教改革+1骰（须亨利八世娶安妮·博林后进场）' },
  { id: 'coverdale',       name: 'Coverdale',       faction: 'anglican',  value: 2, entryTurn: 4, zone: 'english', conditional: true, ability: '英语区翻译圣经时额外获得CP（Cranmer进场后出现）' },
  { id: 'latimer',         name: 'Latimer',         faction: 'anglican',  value: 1, entryTurn: 4, zone: 'english', conditional: true, ability: '英格兰境内宗教改革+1骰（Cranmer进场后出现）' },
  { id: 'wishart',         name: 'Wishart',         faction: 'anglican',  value: 1, entryTurn: 6, zone: 'english', ability: '苏格兰境内宗教改革+1骰' },
  { id: 'knox',            name: 'Knox',            faction: 'anglican',  value: 3, entryTurn: 6, zone: 'english', ability: '英格兰或苏格兰境内宗教改革+1骰' },

  // Papal
  { id: 'eck',             name: 'Eck',             faction: 'papal',     value: 3, entryTurn: 1, zone: null, ability: '作为攻方发起辩论时+1骰' },
  { id: 'campeggio',       name: 'Campeggio',       faction: 'papal',     value: 2, entryTurn: 1, zone: null, ability: '辩论失败后可掷1骰；5或6则无视失败结果' },
  { id: 'aleander',        name: 'Aleander',        faction: 'papal',     value: 2, entryTurn: 1, zone: null, ability: '终结辩论时，胜方额外翻转1格' },
  { id: 'tetzel',          name: 'Tetzel',          faction: 'papal',     value: 1, entryTurn: 1, zone: null, ability: '烧书行动花费1CP向圣彼得大教堂献礼' },
  { id: 'cajetan',         name: 'Cajetan',         faction: 'papal',     value: 1, entryTurn: 1, zone: null, ability: '可用烧书同时目标3格' },
  { id: 'contarini',       name: 'Contarini',       faction: 'papal',     value: 2, entryTurn: 2, zone: null, ability: '查理五世2格内反宗教改革+1骰' },
  { id: 'pole',            name: 'Pole',            faction: 'papal',     value: 3, entryTurn: 5, zone: null, ability: '特伦特会议期间教廷+1骰' },
  { id: 'caraffa',         name: 'Caraffa',         faction: 'papal',     value: 2, entryTurn: 5, zone: null, ability: '任意区域烧书时可同时目标3格' },
  { id: 'loyola',          name: 'Loyola',          faction: 'papal',     value: 4, entryTurn: 6, zone: null, ability: '建立耶稣会大学仅需2CP' },
  { id: 'faber',           name: 'Faber',           faction: 'papal',     value: 3, entryTurn: 6, zone: null, ability: '对选帝侯进行反宗教改革+2骰' },
  { id: 'canisius',        name: 'Canisius',        faction: 'papal',     value: 3, entryTurn: 6, zone: null, ability: '雷根斯堡2格内反宗教改革+1骰' },
  { id: 'gardiner',        name: 'Gardiner',        faction: 'papal',     value: 3, entryTurn: 7, zone: null, ability: '作为攻方在英语区辩论时+1骰' }
];

// ── Theological Debate ─────────────────────────────────────────────

export const DEBATE = {
  attackerBaseBonus: 3,
  defenderUncommittedBonus: 2,
  defenderCommittedBonus: 1,
  hitThreshold: 5
};

// ── Field Battle ─────────────────────────────────────────────────

export const COMBAT = {
  hitThreshold: 5,
  defenderBonusDice: 1,
  transportCap: 5,
  interceptionThreshold: 5
};

// ── Naval Combat ────────────────────────────────────────────────

export const NAVAL_COMBAT = {
  dicePerSquadron: 2,
  dicePerCorsair: 1,
  hitThreshold: 5,
  hitsPerSquadronLost: 2,
  portDefenderBonusDice: 1
};

// ── Diplomacy Phase Segment Order ──────────────────────────────────

export const DIPLOMACY_SEGMENTS = [
  'negotiation',
  'sue_for_peace',
  'ransom',
  'excommunication',
  'declarations_of_war'
];

// ── Excommunication Targets ────────────────────────────────────────

export const EXCOMMUNICATION_SLOTS = [
  'luther', 'zwingli', 'cranmer', 'calvin',
  'henry_viii', 'francis_i', 'charles_v'
];

// ── Declaration of War CP Costs ────────────────────────────────────
// Cross-reference: DOW_COSTS[declarer][target] = CP cost
// null = illegal DOW

export const DOW_COSTS = {
  ottoman:    { hapsburg: 4, england: 6, france: 5, papacy: 5, protestant: null },
  hapsburg:   { ottoman: 4, england: 3, france: 3, papacy: 2, protestant: null },
  england:    { ottoman: 6, hapsburg: 3, france: 2, papacy: 4, protestant: null },
  france:     { ottoman: 5, hapsburg: 3, england: 2, papacy: 3, protestant: null },
  papacy:     { ottoman: 5, hapsburg: 2, england: 4, france: 3, protestant: null },
  protestant: { ottoman: null, hapsburg: null, england: null, france: null, papacy: null }
};

/** Minor power DOW always costs 1 CP */
export const DOW_MINOR_COST = 1;

// ── Intervention Costs ─────────────────────────────────────────────

export const INTERVENTION_COSTS = {
  scotland: { power: 'france', cost: 2 },
  venice: { power: 'papacy', cost: 2 }
};

// ── Negotiation Limits ─────────────────────────────────────────────

export const NEGOTIATION_LIMITS = {
  maxCardDrawGifts: 2,
  maxMercenaryGifts: 4
};

// ── Capital Spaces ─────────────────────────────────────────────────

export const CAPITALS = {
  ottoman: ['Istanbul'],
  hapsburg: ['Vienna', 'Valladolid'],
  england: ['London'],
  france: ['Paris'],
  papacy: ['Rome'],
  protestant: []
};

// ── New World ─────────────────────────────────────────────────────

export const NEW_WORLD_POWERS = ['england', 'france', 'hapsburg'];

/** Max colonies per power */
export const COLONY_LIMITS = {
  england: 2,
  france: 2,
  hapsburg: 3
};

/**
 * Exploration results by modified 2d6 roll.
 * Ranges: <=4 lost, 5-6 nothing, 7-9 discovery, 10+ deep penetration
 */
export const EXPLORATION_RESULTS = {
  LOST: 'lost',           // <= 4
  NO_DISCOVERY: 'none',   // 5–6
  DISCOVERY: 'discovery', // 7–9
  DEEP: 'deep'            // 10+
};

export function getExplorationResult(roll) {
  if (roll <= 4) return EXPLORATION_RESULTS.LOST;
  if (roll <= 6) return EXPLORATION_RESULTS.NO_DISCOVERY;
  if (roll <= 9) return EXPLORATION_RESULTS.DISCOVERY;
  return EXPLORATION_RESULTS.DEEP;
}

/**
 * Discoveries in order (index 7–9 match die roll).
 * Deep penetration (10+) gives choice.
 */
export const DISCOVERIES = [
  null, null, null, null, null, null, null,
  { id: 'st_lawrence', name: 'St. Lawrence River', vp: 1 },
  { id: 'great_lakes', name: 'Great Lakes', vp: 1 },
  { id: 'mississippi', name: 'Mississippi River', vp: 1 }
];

export const AMAZON = { id: 'amazon', name: 'Amazon River', vp: 2 };
export const PACIFIC_STRAIT = { id: 'pacific_strait', name: 'Pacific Strait', vp: 1 };
export const CIRCUMNAVIGATION = { id: 'circumnavigation', name: 'Circumnavigation', vp: 2 };

/**
 * Circumnavigation results by modified 2d6 roll.
 * <=9: failure (explorer removed), 10-11: success, 12+: success + card
 */
export function getCircumnavigationResult(roll) {
  if (roll <= 9) return 'failure';
  if (roll <= 11) return 'success';
  return 'success_card';
}

/**
 * Conquest results by modified 2d6 roll.
 * <=6: killed, 7-8: nothing, 9+: conquest
 */
export const CONQUEST_RESULTS = {
  KILLED: 'killed',
  NO_CONQUEST: 'none',
  CONQUEST: 'conquest'
};

export function getConquestResult(roll) {
  if (roll <= 6) return CONQUEST_RESULTS.KILLED;
  if (roll <= 8) return CONQUEST_RESULTS.NO_CONQUEST;
  return CONQUEST_RESULTS.CONQUEST;
}

/**
 * Conquests in order (index 9–11 match die roll).
 */
export const CONQUESTS = [
  null, null, null, null, null, null, null, null, null,
  { id: 'inca', name: 'Inca Empire', vp: 2 },
  { id: 'aztec', name: 'Aztec Empire', vp: 2 },
  { id: 'maya', name: 'Maya', vp: 1 }
];

/**
 * New World Riches table (2d6 per colony/conquest during Card Draw).
 * Colony column vs Conquest column differ.
 */
export const RICHES_RESULTS = {
  DEPLETE: 'deplete',
  CARD: 'card',
  GALLEON: 'galleon',
  NO_EFFECT: 'ne',
  ELIMINATED: 'elim'
};

/**
 * New World Riches Table — lookup by 2d6 roll.
 * Each row: { inca, aztec, maya, potosi, colony }
 * Values: 'deplete' | 'card' | 'galleon' | 'elim' | 'ne' (no effect)
 *
 * Colony column: 'elim' = colony eliminated, 'ne' = no effect.
 * Conquest columns: 'deplete' = draw card + conquest depleted (VP kept),
 * 'galleon' = draw card only if Galleons marker present, 'card' = draw card.
 */
export const NEW_WORLD_RICHES_TABLE = {
  2:  { inca: 'deplete', aztec: 'deplete', maya: 'deplete', potosi: 'elim',    colony: 'elim' },
  3:  { inca: 'deplete', aztec: 'deplete', maya: 'deplete', potosi: 'elim',    colony: 'elim' },
  4:  { inca: 'deplete', aztec: 'deplete', maya: 'deplete', potosi: 'ne',      colony: 'elim' },
  5:  { inca: 'deplete', aztec: 'deplete', maya: 'deplete', potosi: 'ne',      colony: 'ne' },
  6:  { inca: 'card',    aztec: 'ne',      maya: 'ne',      potosi: 'ne',      colony: 'ne' },
  7:  { inca: 'galleon', aztec: 'galleon', maya: 'galleon', potosi: 'galleon', colony: 'ne' },
  8:  { inca: 'card',    aztec: 'card',    maya: 'card',    potosi: 'card',    colony: 'galleon' },
  9:  { inca: 'card',    aztec: 'card',    maya: 'card',    potosi: 'card',    colony: 'card' },
  10: { inca: 'card',    aztec: 'card',    maya: 'card',    potosi: 'card',    colony: 'card' },
  11: { inca: 'card',    aztec: 'card',    maya: 'card',    potosi: 'card',    colony: 'card' },
  12: { inca: 'card',    aztec: 'card',    maya: 'card',    potosi: 'card',    colony: 'card' },
};
