/**
 * Here I Stand — HISBOT Behavior Cards
 *
 * 48 Behavior Cards (6 powers × 8 cards: 5 unique + 3 Continue).
 * Data sourced from HISBOT_REF.md §7.
 *
 * Each unique card specifies:
 *   - home: whether to play Home card for its event
 *   - war: which power/minor to declare war on (null = none)
 *   - negotiations: offer/request values per item type
 *   - goals: ordered priority list with max executions
 *   - colorCoded: Bot-to-Bot negotiation item→target mappings
 *
 * Continue cards: reuse previous card's settings. If no previous
 * card exists, draw again until a non-Continue appears.
 */

// ── Negotiation Item Keys ──────────────────────────────────────────
// NA represented as null for both OFR and REQ.
// '—' in REQ for End War / Alliance means "not applicable as offer".

/**
 * @typedef {Object} NegotiationRow
 * @property {number|null} ofr - Offer value (null = cannot offer)
 * @property {number|null} req - Request value (null = cannot request)
 * @property {number|null} max - Max exchanges (null = unlimited/NA)
 */

/**
 * @typedef {Object} GoalEntry
 * @property {string} type - Goal type identifier
 * @property {number} max - Max executions (Infinity = unlimited)
 */

/**
 * @typedef {Object} BehaviorCard
 * @property {string} id - Unique card identifier
 * @property {string} name - Display name
 * @property {string} power - Owning power
 * @property {boolean} isContinue - Whether this is a Continue card
 * @property {boolean} home - Play Home card for event?
 * @property {string|null} war - Target for war declaration
 * @property {Object<string, NegotiationRow>} negotiations
 * @property {GoalEntry[]} goals - Prioritized goal list
 * @property {Object<string, string>} colorCoded - Item→target power for Bot-Bot deals
 */

// ── Goal Types ─────────────────────────────────────────────────────

export const GOAL_TYPES = {
  GARRISON: 'garrison',
  TROOPS: 'troops',
  MERCENARIES: 'mercenaries',
  CAVALRY: 'cavalry',
  ADVANCE: 'advance',
  SET_SAIL: 'set_sail',
  NAVAL_BATTLE: 'naval_battle',
  LAND_BATTLE: 'land_battle',
  SIEGE: 'siege',
  CONTROL: 'control',
  SHIPBUILDING: 'shipbuilding',
  PIRACY: 'piracy',
  EXPLORE: 'explore',
  COLONIZE: 'colonize',
  CONQUER: 'conquer',
  TRANSLATE: 'translate',
  PUBLISH: 'publish',
  DEBATE: 'debate',
  ST_PETERS: 'st_peters',
  BURN: 'burn',
  JESUITS: 'jesuits'
};

// ── Negotiation Item Keys ──────────────────────────────────────────

export const NEG_ITEMS = {
  END_WAR: 'endWar',
  ALLIANCE: 'alliance',
  LOAN_SQUADRON: 'loanSquadron',
  RETURN_LEADER: 'returnLeader',
  YIELD_FORTIFIED: 'yieldFortified',
  CARD_DRAW: 'cardDraw',
  MERCENARIES: 'mercenaries',
  GRANT_DIVORCE: 'grantDivorce',
  RESCIND_EXCOMM: 'rescindExcomm',
  TREATY: 'treaty'
};

// ── Helper: build negotiation object ───────────────────────────────

function neg(endWar, alliance, loanSq, retLdr, yieldFort, cardDr, mercs, divorce, excomm, treaty) {
  return {
    [NEG_ITEMS.END_WAR]: endWar,
    [NEG_ITEMS.ALLIANCE]: alliance,
    [NEG_ITEMS.LOAN_SQUADRON]: loanSq,
    [NEG_ITEMS.RETURN_LEADER]: retLdr,
    [NEG_ITEMS.YIELD_FORTIFIED]: yieldFort,
    [NEG_ITEMS.CARD_DRAW]: cardDr,
    [NEG_ITEMS.MERCENARIES]: mercs,
    [NEG_ITEMS.GRANT_DIVORCE]: divorce,
    [NEG_ITEMS.RESCIND_EXCOMM]: excomm,
    [NEG_ITEMS.TREATY]: treaty
  };
}

/** Shorthand for { ofr, req, max } */
function nr(ofr, req, max) {
  return { ofr, req, max };
}

/** Shorthand for goal entry */
function g(type, max) {
  return { type, max };
}

const INF = Infinity;
const NA = nr(null, null, null);

// ── Continue Card Factory ──────────────────────────────────────────

function continueCard(power, index) {
  return {
    id: `${power}_continue_${index}`,
    name: 'Continue',
    power,
    isContinue: true,
    home: false,
    war: null,
    negotiations: {},
    goals: [],
    colorCoded: {}
  };
}

// ═══════════════════════════════════════════════════════════════════
//  OTTOMAN BEHAVIOR CARDS
// ═══════════════════════════════════════════════════════════════════

const OTTOMAN_CARDS = [
  {
    id: 'ottoman_spoils_of_war',
    name: 'Spoils of War',
    power: 'ottoman',
    isContinue: false,
    home: true,
    war: 'hapsburg',
    negotiations: neg(
      nr(null, 4, null), nr(null, 0, null), nr(1, 1, 2), nr(2, 2, 1),
      nr(6, 6, 1), nr(2, 3, 2), NA, NA, NA, nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.NAVAL_BATTLE, 1), g(GOAL_TYPES.LAND_BATTLE, 1),
      g(GOAL_TYPES.ADVANCE, 1), g(GOAL_TYPES.CAVALRY, 1),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.PIRACY, 1),
      g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'england', alliance: 'england', returnLeader: 'papacy',
      cardDraw: 'england', treaty: 'papacy'
    }
  },
  {
    id: 'ottoman_masters_of_the_sea',
    name: 'Masters of the Sea',
    power: 'ottoman',
    isContinue: false,
    home: true,
    war: 'venice',
    negotiations: neg(
      nr(null, 5, null), nr(null, 0, null), nr(2, 3, 2), nr(1, 1, 1),
      nr(5, 5, 1), nr(2, 2, 2), NA, NA, NA, nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.PIRACY, 2),
      g(GOAL_TYPES.SET_SAIL, 3), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.GARRISON, 2), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.SHIPBUILDING, INF)
    ],
    colorCoded: {
      endWar: 'hapsburg', alliance: 'hapsburg', returnLeader: 'hapsburg',
      cardDraw: 'protestant', treaty: 'hapsburg'
    }
  },
  {
    id: 'ottoman_spread_thin',
    name: 'Spread Thin',
    power: 'ottoman',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 5, null), nr(null, 1, null), nr(0, 1, 2), nr(2, 1, 1),
      nr(5, 7, 1), nr(2, 3, 2), NA, NA, NA, nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.GARRISON, 1), g(GOAL_TYPES.SIEGE, 3),
      g(GOAL_TYPES.LAND_BATTLE, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.SHIPBUILDING, 1), g(GOAL_TYPES.PIRACY, 2),
      g(GOAL_TYPES.CAVALRY, 2), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'england', alliance: 'england', returnLeader: 'hapsburg',
      cardDraw: 'england'
    }
  },
  {
    id: 'ottoman_the_wise_sultan',
    name: 'The Wise Sultan',
    power: 'ottoman',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 3, null), nr(null, 0, null), nr(0, 1, 2), nr(2, 2, 2),
      nr(5, 5, 1), nr(2, 3, 2), NA, NA, NA, nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, 2), g(GOAL_TYPES.LAND_BATTLE, 1),
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.GARRISON, 2),
      g(GOAL_TYPES.CONTROL, INF), g(GOAL_TYPES.PIRACY, 1),
      g(GOAL_TYPES.SHIPBUILDING, 1), g(GOAL_TYPES.ADVANCE, 2),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'france', alliance: 'france', loanSquadron: 'france',
      cardDraw: 'protestant', treaty: 'france'
    }
  },
  {
    id: 'ottoman_barbary_pirates',
    name: 'Barbary Pirates',
    power: 'ottoman',
    isContinue: false,
    home: false,
    war: 'papacy',
    negotiations: neg(
      nr(null, 5, null), nr(null, 0, null), nr(2, 2, 1), nr(1, 1, 1),
      nr(6, 6, 1), nr(3, 3, 2), NA, NA, NA, nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 1),
      g(GOAL_TYPES.PIRACY, 3), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.LAND_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 3),
      g(GOAL_TYPES.TROOPS, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.SHIPBUILDING, INF)
    ],
    colorCoded: {
      endWar: 'france', alliance: 'france', loanSquadron: 'france',
      returnLeader: 'france', cardDraw: 'protestant', treaty: 'protestant'
    }
  },
  continueCard('ottoman', 1),
  continueCard('ottoman', 2),
  continueCard('ottoman', 3)
];

// ═══════════════════════════════════════════════════════════════════
//  HAPSBURG BEHAVIOR CARDS
// ═══════════════════════════════════════════════════════════════════

const HAPSBURG_CARDS = [
  {
    id: 'hapsburg_holy_roman_empire',
    name: 'Holy Roman Empire',
    power: 'hapsburg',
    isContinue: false,
    home: true,
    war: 'france',
    negotiations: neg(
      nr(null, 5, null), nr(null, 1, null), nr(0, 1, 2), nr(2, 2, 1),
      nr(6, 7, 1), nr(2, 3, 1), nr(1, 1, 2), NA, nr(2, null, null), nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.ADVANCE, 2), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.EXPLORE, 1), g(GOAL_TYPES.CONQUER, 1),
      g(GOAL_TYPES.CONTROL, INF), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'ottoman', returnLeader: 'ottoman',
      cardDraw: 'england', treaty: 'ottoman'
    }
  },
  {
    id: 'hapsburg_sea_power',
    name: 'Sea Power',
    power: 'hapsburg',
    isContinue: false,
    home: true,
    war: 'ottoman',
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(2, 3, 2), nr(2, 2, 1),
      nr(5, 5, 1), nr(3, 2, 2), nr(0, 1, 2), NA, nr(2, null, null), nr(3, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.EXPLORE, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.LAND_BATTLE, 1), g(GOAL_TYPES.TROOPS, 1),
      g(GOAL_TYPES.SIEGE, 3), g(GOAL_TYPES.SHIPBUILDING, INF),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'england', alliance: 'england', returnLeader: 'protestant',
      cardDraw: 'england', treaty: 'england'
    }
  },
  {
    id: 'hapsburg_consolidation',
    name: 'Consolidation',
    power: 'hapsburg',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(0, 1, 2), nr(2, 2, 2),
      nr(6, 6, 1), nr(2, 2, 2), nr(1, 1, 2), NA, nr(2, null, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.TROOPS, 2),
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 1),
      g(GOAL_TYPES.SHIPBUILDING, 2), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.EXPLORE, 1), g(GOAL_TYPES.COLONIZE, 1),
      g(GOAL_TYPES.LAND_BATTLE, 2), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      returnLeader: 'france', yieldFortified: 'protestant', treaty: 'france'
    }
  },
  {
    id: 'hapsburg_chosen_of_god',
    name: 'Chosen of God',
    power: 'hapsburg',
    isContinue: false,
    home: true,
    war: 'england',
    negotiations: neg(
      nr(null, 6, null), nr(null, 0, null), nr(2, 2, 2), nr(2, 2, 1),
      nr(6, 6, 1), nr(2, 2, 2), nr(1, 2, 2), NA, nr(1, null, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.LAND_BATTLE, 2), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.ADVANCE, 1), g(GOAL_TYPES.CONTROL, INF),
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.EXPLORE, 1),
      g(GOAL_TYPES.COLONIZE, 1), g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      returnLeader: 'ottoman', cardDraw: 'papacy', treaty: 'papacy'
    }
  },
  {
    id: 'hapsburg_new_spain',
    name: 'New Spain',
    power: 'hapsburg',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 6, null), nr(null, 0, null), nr(2, 2, 2), nr(1, 1, 1),
      nr(6, 6, 1), nr(2, 3, 2), nr(0, 0, 2), NA, nr(1, null, null), nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 1),
      g(GOAL_TYPES.EXPLORE, 1), g(GOAL_TYPES.COLONIZE, 1),
      g(GOAL_TYPES.TROOPS, 2), g(GOAL_TYPES.CONQUER, 1),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.SHIPBUILDING, INF), g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'france', yieldFortified: 'france',
      cardDraw: 'papacy', treaty: 'papacy'
    }
  },
  continueCard('hapsburg', 1),
  continueCard('hapsburg', 2),
  continueCard('hapsburg', 3)
];

// ═══════════════════════════════════════════════════════════════════
//  ENGLAND BEHAVIOR CARDS
// ═══════════════════════════════════════════════════════════════════

const ENGLAND_CARDS = [
  {
    id: 'england_expedition',
    name: 'Expedition',
    power: 'england',
    isContinue: false,
    home: true,
    war: 'france',
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(2, 2, 1), nr(2, 2, 1),
      nr(7, 7, 1), nr(2, 3, 1), nr(1, 2, 2), nr(4, null, null),
      nr(2, null, null), nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.LAND_BATTLE, INF), g(GOAL_TYPES.ADVANCE, 1),
      g(GOAL_TYPES.SHIPBUILDING, 1), g(GOAL_TYPES.EXPLORE, 1),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'hapsburg', alliance: 'hapsburg', loanSquadron: 'hapsburg',
      cardDraw: 'protestant', mercenaries: 'hapsburg', treaty: 'protestant'
    }
  },
  {
    id: 'england_rule_britannia',
    name: 'Rule Britannia',
    power: 'england',
    isContinue: false,
    home: true,
    war: 'scotland',
    negotiations: neg(
      nr(null, 3, null), nr(null, 1, null), nr(2, 3, 2), nr(1, 1, 2),
      nr(6, 6, 1), nr(3, 2, 1), nr(0, 1, 2), nr(3, null, null),
      nr(2, null, null), nr(3, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, INF), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.SHIPBUILDING, 1), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.LAND_BATTLE, 2), g(GOAL_TYPES.EXPLORE, 1),
      g(GOAL_TYPES.COLONIZE, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.SHIPBUILDING, INF), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'france', alliance: 'ottoman', returnLeader: 'france',
      mercenaries: 'france', treaty: 'ottoman'
    }
  },
  {
    id: 'england_island_fortress',
    name: 'Island Fortress',
    power: 'england',
    isContinue: false,
    home: true,
    war: 'scotland',
    negotiations: neg(
      nr(null, 3, null), nr(null, 1, null), nr(2, 2, 1), nr(2, 2, 1),
      nr(6, 6, 1), nr(3, 3, 2), nr(1, 1, 2), nr(4, null, null),
      nr(1, null, null), nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, 2), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.NAVAL_BATTLE, INF),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.TROOPS, 2),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'hapsburg', yieldFortified: 'hapsburg',
      cardDraw: 'papacy', mercenaries: 'papacy', treaty: 'hapsburg'
    }
  },
  {
    id: 'england_defender_of_faith',
    name: 'Defender of the Faith',
    power: 'england',
    isContinue: false,
    home: true,
    war: 'scotland',
    negotiations: neg(
      nr(null, 4, null), nr(null, 0, null), nr(1, 2, 2), nr(2, 2, 1),
      nr(6, 6, 1), nr(2, 3, 2), nr(1, 2, 2), nr(4, null, null),
      nr(3, null, null), nr(2, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.LAND_BATTLE, 2), g(GOAL_TYPES.NAVAL_BATTLE, 3),
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.PUBLISH, 2), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.ADVANCE, 1), g(GOAL_TYPES.CONTROL, INF),
      g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      alliance: 'ottoman', cardDraw: 'protestant',
      mercenaries: 'protestant', treaty: 'ottoman'
    }
  },
  {
    id: 'england_new_england',
    name: 'New England',
    power: 'england',
    isContinue: false,
    home: true,
    war: 'hapsburg',
    negotiations: neg(
      nr(null, 5, null), nr(null, 0, null), nr(2, 2, 1), nr(1, 1, 1),
      nr(5, 5, 1), nr(2, 2, 2), nr(0, 1, 2), nr(3, null, null),
      nr(2, null, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 3), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.EXPLORE, 1), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.COLONIZE, 1), g(GOAL_TYPES.MERCENARIES, 2),
      g(GOAL_TYPES.SHIPBUILDING, INF), g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'france', alliance: 'france', returnLeader: 'france',
      cardDraw: 'papacy', mercenaries: 'france', treaty: 'france'
    }
  },
  continueCard('england', 1),
  continueCard('england', 2),
  continueCard('england', 3)
];

// ═══════════════════════════════════════════════════════════════════
//  FRANCE BEHAVIOR CARDS
// ═══════════════════════════════════════════════════════════════════

const FRANCE_CARDS = [
  {
    id: 'france_the_knight_king',
    name: 'The Knight King',
    power: 'france',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(0, 1, 2), nr(2, 2, 1),
      nr(7, 7, 1), nr(2, 2, 1), nr(1, 2, 2), NA,
      nr(3, null, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.NAVAL_BATTLE, 1), g(GOAL_TYPES.SET_SAIL, 1),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.ADVANCE, 1),
      g(GOAL_TYPES.CONQUER, 1), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'papacy', alliance: 'papacy', loanSquadron: 'papacy',
      returnLeader: 'papacy', cardDraw: 'ottoman'
    }
  },
  {
    id: 'france_field_of_cloth_gold',
    name: 'Field of Cloth and Gold',
    power: 'france',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 3, null), nr(null, 0, null), nr(1, 1, 2), nr(1, 1, 2),
      nr(6, 6, 1), nr(2, 2, 2), nr(1, 1, 2), NA,
      nr(2, null, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.SET_SAIL, 1), g(GOAL_TYPES.GARRISON, INF),
      g(GOAL_TYPES.LAND_BATTLE, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.EXPLORE, 1),
      g(GOAL_TYPES.ADVANCE, 1), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.TROOPS, INF)
    ],
    colorCoded: {
      endWar: 'england', returnLeader: 'protestant',
      yieldFortified: 'protestant', cardDraw: 'england',
      mercenaries: 'protestant', treaty: 'protestant'
    }
  },
  {
    id: 'france_italian_wars',
    name: 'Italian Wars',
    power: 'france',
    isContinue: false,
    home: true,
    war: 'genoa',
    negotiations: neg(
      nr(null, 4, null), nr(null, 0, null), nr(1, 1, 1), nr(2, 2, 1),
      nr(5, 7, 1), nr(3, 3, 2), nr(1, 1, 2), NA,
      nr(2, null, null), nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.LAND_BATTLE, INF), g(GOAL_TYPES.TROOPS, 1),
      g(GOAL_TYPES.CONTROL, INF), g(GOAL_TYPES.EXPLORE, 1),
      g(GOAL_TYPES.SHIPBUILDING, 2), g(GOAL_TYPES.ADVANCE, 1),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'england', alliance: 'england', loanSquadron: 'england',
      returnLeader: 'protestant', yieldFortified: 'protestant',
      mercenaries: 'protestant', treaty: 'england'
    }
  },
  {
    id: 'france_machiavellian',
    name: 'Machiavellian',
    power: 'france',
    isContinue: false,
    home: true,
    war: 'papacy',
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(1, 2, 2), nr(2, 2, 1),
      nr(6, 6, 1), nr(3, 2, 1), nr(1, 2, 2), NA,
      nr(1, null, null), nr(3, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.LAND_BATTLE, INF), g(GOAL_TYPES.NAVAL_BATTLE, 1),
      g(GOAL_TYPES.EXPLORE, 1), g(GOAL_TYPES.ADVANCE, 1),
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.CONQUER, 1),
      g(GOAL_TYPES.SHIPBUILDING, 1), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'hapsburg', alliance: 'hapsburg', loanSquadron: 'hapsburg',
      returnLeader: 'ottoman', cardDraw: 'ottoman',
      mercenaries: 'hapsburg', treaty: 'hapsburg'
    }
  },
  {
    id: 'france_the_empire',
    name: 'The Empire',
    power: 'france',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 2, null), nr(null, 1, null), nr(2, 2, 1), nr(1, 1, 1),
      nr(5, 5, 1), nr(2, 2, 2), nr(0, 1, 2), NA,
      nr(2, null, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.SET_SAIL, 2),
      g(GOAL_TYPES.COLONIZE, 1), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.LAND_BATTLE, 2), g(GOAL_TYPES.TROOPS, 1),
      g(GOAL_TYPES.CONTROL, INF), g(GOAL_TYPES.EXPLORE, 1),
      g(GOAL_TYPES.SHIPBUILDING, INF)
    ],
    colorCoded: {
      endWar: 'papacy', returnLeader: 'papacy',
      yieldFortified: 'hapsburg', cardDraw: 'hapsburg', treaty: 'papacy'
    }
  },
  continueCard('france', 1),
  continueCard('france', 2),
  continueCard('france', 3)
];

// ═══════════════════════════════════════════════════════════════════
//  PAPACY BEHAVIOR CARDS
// ═══════════════════════════════════════════════════════════════════

const PAPACY_CARDS = [
  {
    id: 'papacy_rebuilding',
    name: 'Rebuilding',
    power: 'papacy',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 3, null), nr(null, 1, null), nr(1, 1, 1), nr(2, 2, 1),
      nr(5, 5, 1), nr(1, 1, 1), nr(0, 1, 2), nr(null, 3, null),
      nr(null, 2, null), nr(1, 1, null)
    ),
    goals: [
      g(GOAL_TYPES.SET_SAIL, 1), g(GOAL_TYPES.MERCENARIES, 2),
      g(GOAL_TYPES.SHIPBUILDING, 1), g(GOAL_TYPES.SIEGE, 3),
      g(GOAL_TYPES.BURN, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.LAND_BATTLE, INF), g(GOAL_TYPES.TROOPS, 2),
      g(GOAL_TYPES.ST_PETERS, INF)
    ],
    colorCoded: {
      endWar: 'france', alliance: 'hapsburg', loanSquadron: 'hapsburg',
      mercenaries: 'hapsburg', rescindExcomm: 'france'
    }
  },
  {
    id: 'papacy_exsurge_domine',
    name: 'Exsurge Domine',
    power: 'papacy',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(1, 1, 1), nr(2, 2, 1),
      nr(5, 5, 1), nr(3, 3, 1), nr(0, 1, 2), nr(null, 5, null),
      nr(null, 3, null), nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SET_SAIL, 1), g(GOAL_TYPES.JESUITS, 1),
      g(GOAL_TYPES.GARRISON, 2), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.LAND_BATTLE, INF), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.JESUITS, 1), g(GOAL_TYPES.BURN, INF),
      g(GOAL_TYPES.ST_PETERS, INF)
    ],
    colorCoded: {
      endWar: 'ottoman', returnLeader: 'ottoman',
      grantDivorce: 'england', rescindExcomm: 'england', treaty: 'ottoman'
    }
  },
  {
    id: 'papacy_warrior_pope',
    name: 'Warrior Pope',
    power: 'papacy',
    isContinue: false,
    home: false,
    war: 'france',
    negotiations: neg(
      nr(null, 3, null), nr(null, 2, null), nr(0, 1, 1), nr(1, 2, 1),
      nr(5, 6, 1), nr(2, 2, 2), nr(1, 2, 2), nr(null, 3, null),
      nr(null, 2, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, INF),
      g(GOAL_TYPES.SET_SAIL, 2), g(GOAL_TYPES.SHIPBUILDING, 2),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.TROOPS, 1),
      g(GOAL_TYPES.BURN, 2), g(GOAL_TYPES.ADVANCE, 1),
      g(GOAL_TYPES.NAVAL_BATTLE, 1), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      alliance: 'hapsburg', loanSquadron: 'hapsburg',
      grantDivorce: 'england', rescindExcomm: 'england', treaty: 'hapsburg'
    }
  },
  {
    id: 'papacy_great_debate',
    name: 'Great Debate',
    power: 'papacy',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 4, null), nr(null, 1, null), nr(1, 2, 1), nr(2, 2, 1),
      nr(5, 5, 1), nr(2, 2, 1), nr(0, 1, 2), nr(null, 5, null),
      nr(null, 3, null), nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.SET_SAIL, 1), g(GOAL_TYPES.DEBATE, 1),
      g(GOAL_TYPES.MERCENARIES, 2), g(GOAL_TYPES.SHIPBUILDING, 1),
      g(GOAL_TYPES.CONTROL, 1), g(GOAL_TYPES.BURN, 2),
      g(GOAL_TYPES.SIEGE, 3), g(GOAL_TYPES.LAND_BATTLE, INF),
      g(GOAL_TYPES.NAVAL_BATTLE, 2), g(GOAL_TYPES.ST_PETERS, INF)
    ],
    colorCoded: {
      endWar: 'france', returnLeader: 'protestant',
      rescindExcomm: 'france', treaty: 'france'
    }
  },
  {
    id: 'papacy_worldly_things',
    name: 'Worldly Things',
    power: 'papacy',
    isContinue: false,
    home: false,
    war: 'genoa',
    negotiations: neg(
      nr(null, 3, null), nr(null, 0, null), nr(1, 2, 1), nr(1, 1, 1),
      nr(5, 5, 1), nr(3, 3, 2), nr(1, 1, 2), nr(null, 2, null),
      nr(null, 2, null), nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, 3), g(GOAL_TYPES.LAND_BATTLE, INF),
      g(GOAL_TYPES.NAVAL_BATTLE, 1), g(GOAL_TYPES.SET_SAIL, 1),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.ADVANCE, 1),
      g(GOAL_TYPES.SHIPBUILDING, 2), g(GOAL_TYPES.TROOPS, INF),
      g(GOAL_TYPES.ST_PETERS, INF)
    ],
    colorCoded: {
      returnLeader: 'protestant', grantDivorce: 'england',
      rescindExcomm: 'england'
    }
  },
  continueCard('papacy', 1),
  continueCard('papacy', 2),
  continueCard('papacy', 3)
];

// ═══════════════════════════════════════════════════════════════════
//  PROTESTANT BEHAVIOR CARDS
// ═══════════════════════════════════════════════════════════════════

const PROTESTANT_CARDS = [
  {
    id: 'protestant_preventative_war',
    name: 'Preventative War',
    power: 'protestant',
    isContinue: false,
    home: false,
    war: null,
    isGoodwillDefault: true, // Specifically removed as Goodwill at setup
    negotiations: neg(
      nr(null, 1, null), nr(null, 0, null), NA, nr(2, 2, 1),
      nr(6, 6, 1), nr(2, 2, 1), nr(1, 2, 3), NA, NA, nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.CONTROL, INF), g(GOAL_TYPES.MERCENARIES, 2),
      g(GOAL_TYPES.ADVANCE, 1), g(GOAL_TYPES.TRANSLATE, 2),
      g(GOAL_TYPES.TROOPS, 2), g(GOAL_TYPES.PUBLISH, INF),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'ottoman', alliance: 'ottoman', returnLeader: 'papacy',
      treaty: 'ottoman'
    }
  },
  {
    id: 'protestant_die_by_the_sword',
    name: 'Die by the Sword',
    power: 'protestant',
    isContinue: false,
    home: false,
    war: null,
    isGoodwillDefault: true, // Specifically removed as Goodwill at setup
    negotiations: neg(
      nr(null, 1, null), nr(null, 1, null), NA, nr(2, 2, 1),
      nr(6, 6, 1), nr(3, 3, 1), nr(1, 2, 2), NA, NA, nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, INF),
      g(GOAL_TYPES.ADVANCE, 1), g(GOAL_TYPES.TROOPS, 1),
      g(GOAL_TYPES.PUBLISH, 1), g(GOAL_TYPES.TRANSLATE, 2),
      g(GOAL_TYPES.CONTROL, INF), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'france', returnLeader: 'hapsburg',
      yieldFortified: 'france', cardDraw: 'france'
    }
  },
  {
    id: 'protestant_oratory',
    name: 'Oratory',
    power: 'protestant',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 0, null), nr(null, 1, null), NA, nr(1, 1, 1),
      nr(5, 5, 1), nr(3, 3, 2), nr(1, 1, 2), NA, NA, nr(3, 3, null)
    ),
    goals: [
      g(GOAL_TYPES.DEBATE, 1), g(GOAL_TYPES.GARRISON, 2),
      g(GOAL_TYPES.TRANSLATE, 2), g(GOAL_TYPES.LAND_BATTLE, 2),
      g(GOAL_TYPES.CONTROL, 2), g(GOAL_TYPES.TROOPS, 1),
      g(GOAL_TYPES.PUBLISH, INF), g(GOAL_TYPES.TRANSLATE, 2),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'france', alliance: 'france',
      yieldFortified: 'france', treaty: 'france'
    }
  },
  {
    id: 'protestant_sola_scriptura',
    name: 'Sola Scriptura',
    power: 'protestant',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 0, null), nr(null, 1, null), NA, nr(2, 2, 1),
      nr(5, 5, 1), nr(2, 2, 1), nr(0, 1, 2), NA, NA, nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.GARRISON, 2), g(GOAL_TYPES.TRANSLATE, 3),
      g(GOAL_TYPES.TROOPS, 1), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.SIEGE, INF), g(GOAL_TYPES.LAND_BATTLE, 1),
      g(GOAL_TYPES.PUBLISH, 2), g(GOAL_TYPES.TRANSLATE, INF),
      g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'england', alliance: 'england',
      yieldFortified: 'hapsburg', mercenaries: 'england', treaty: 'england'
    }
  },
  {
    id: 'protestant_disputations',
    name: 'Disputations',
    power: 'protestant',
    isContinue: false,
    home: true,
    war: null,
    negotiations: neg(
      nr(null, 1, null), nr(null, 0, null), NA, nr(1, 1, 1),
      nr(4, 5, 1), nr(2, 2, 1), nr(1, 1, 2), NA, NA, nr(2, 2, null)
    ),
    goals: [
      g(GOAL_TYPES.GARRISON, 2), g(GOAL_TYPES.PUBLISH, 2),
      g(GOAL_TYPES.TRANSLATE, 3), g(GOAL_TYPES.CONTROL, 2),
      g(GOAL_TYPES.LAND_BATTLE, 1), g(GOAL_TYPES.SIEGE, INF),
      g(GOAL_TYPES.PUBLISH, INF), g(GOAL_TYPES.MERCENARIES, INF)
    ],
    colorCoded: {
      endWar: 'ottoman', alliance: 'ottoman', returnLeader: 'papacy'
    }
  },
  continueCard('protestant', 1),
  continueCard('protestant', 2),
  continueCard('protestant', 3)
];

// ═══════════════════════════════════════════════════════════════════
//  ALL CARDS + LOOKUP
// ═══════════════════════════════════════════════════════════════════

/** All 48 behavior cards indexed by power */
export const BEHAVIOR_CARDS = {
  ottoman: OTTOMAN_CARDS,
  hapsburg: HAPSBURG_CARDS,
  england: ENGLAND_CARDS,
  france: FRANCE_CARDS,
  papacy: PAPACY_CARDS,
  protestant: PROTESTANT_CARDS
};

/** Lookup card by id */
export const CARD_BY_ID = Object.fromEntries(
  Object.values(BEHAVIOR_CARDS).flat().map(c => [c.id, c])
);

/** Get all unique (non-Continue) cards for a power */
export function getUniqueCards(power) {
  return BEHAVIOR_CARDS[power].filter(c => !c.isContinue);
}

/** Get Continue cards for a power */
export function getContinueCards(power) {
  return BEHAVIOR_CARDS[power].filter(c => c.isContinue);
}

// ═══════════════════════════════════════════════════════════════════
//  DECK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Fisher-Yates shuffle (in-place).
 * @param {Array} arr
 * @param {Function} [rng] - Optional RNG returning [0,1). Defaults to Math.random.
 * @returns {Array} The shuffled array
 */
export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Initialize a Bot deck for a power. Sets aside 2 Goodwill cards,
 * creates a 6-card draw pile.
 *
 * Protestant special: Preventative War and Die by the Sword are
 * always the Goodwill cards (removed at setup, added back after SL).
 *
 * @param {string} power
 * @param {Function} [rng] - Optional RNG for shuffle
 * @returns {{ drawPile: string[], faceUp: string[], goodwill: string[] }}
 *   Card IDs in each pile
 */
export function initBotDeck(power, rng) {
  const allCards = BEHAVIOR_CARDS[power];

  if (power === 'protestant') {
    // Protestant: specifically remove Preventative War + Die by the Sword
    const goodwillIds = [
      'protestant_preventative_war',
      'protestant_die_by_the_sword'
    ];
    const drawCards = allCards
      .filter(c => !goodwillIds.includes(c.id))
      .map(c => c.id);
    shuffle(drawCards, rng);
    return {
      drawPile: drawCards,
      faceUp: [],
      goodwill: [...goodwillIds]
    };
  }

  // Other powers: shuffle all 8, set aside top 2 as Goodwill
  const ids = allCards.map(c => c.id);
  shuffle(ids, rng);
  const goodwill = ids.splice(0, 2);
  return {
    drawPile: ids,
    faceUp: [],
    goodwill
  };
}

/**
 * Reveal the next Behavior Card from the draw pile.
 * Handles Continue card logic and deck reshuffling.
 *
 * @param {Object} deck - { drawPile, faceUp, goodwill }
 * @param {Function} [rng] - Optional RNG for reshuffle
 * @returns {string} The active card ID (may be same as previous if Continue)
 */
export function revealBehaviorCard(deck, rng) {
  // If draw pile empty, reshuffle face-up cards
  if (deck.drawPile.length === 0) {
    deck.drawPile = shuffle([...deck.faceUp], rng);
    deck.faceUp = [];
  }

  const cardId = deck.drawPile.shift();
  const card = CARD_BY_ID[cardId];

  if (card.isContinue) {
    if (deck.faceUp.length > 0) {
      // Tuck Continue under current face-up card, use same card
      deck.faceUp.push(cardId);
      return deck.faceUp[0]; // Return top face-up (the active card)
    }
    // No face-up cards: place Continue face-up, ignore, draw again
    deck.faceUp.push(cardId);
    return revealBehaviorCard(deck, rng);
  }

  // Non-Continue: place on top of face-up pile
  deck.faceUp.unshift(cardId);
  return cardId;
}

/**
 * Get the currently active Behavior Card for a power's deck.
 * @param {Object} deck - { drawPile, faceUp, goodwill }
 * @returns {BehaviorCard|null}
 */
export function getActiveBehaviorCard(deck) {
  if (deck.faceUp.length === 0) return null;
  // Active card is the first non-Continue in faceUp
  for (const id of deck.faceUp) {
    const card = CARD_BY_ID[id];
    if (!card.isContinue) return card;
  }
  return null;
}

/**
 * Reset deck after Schmalkaldic League (Protestant only).
 * Shuffles all 8 cards, sets aside 2 as new Goodwill.
 *
 * @param {string} power - Should be 'protestant'
 * @param {Function} [rng]
 * @returns {{ drawPile: string[], faceUp: string[], goodwill: string[] }}
 */
export function resetDeckForSchmalkaldic(power, rng) {
  const allIds = BEHAVIOR_CARDS[power].map(c => c.id);
  shuffle(allIds, rng);
  const goodwill = allIds.splice(0, 2);
  return {
    drawPile: allIds,
    faceUp: [],
    goodwill
  };
}

/**
 * Reset deck after ruler death (Hapsburgs, Ottomans).
 * Reshuffles all 8 cards, sets aside 2 as new Goodwill.
 *
 * @param {string} power
 * @param {Function} [rng]
 * @returns {{ drawPile: string[], faceUp: string[], goodwill: string[] }}
 */
export function resetDeckForRulerDeath(power, rng) {
  const allIds = BEHAVIOR_CARDS[power].map(c => c.id);
  shuffle(allIds, rng);
  const goodwill = allIds.splice(0, 2);
  return {
    drawPile: allIds,
    faceUp: [],
    goodwill
  };
}

/**
 * Extra starting unit placement for Bot powers.
 * @type {Object<string, {space: string, unit: string}>}
 */
export const BOT_EXTRA_UNITS = {
  ottoman: { space: 'Athens', unit: 'regular' },
  hapsburg: { space: 'Barcelona', unit: 'regular' },
  england: { space: 'Calais', unit: 'regular' },
  france: { space: 'Milan', unit: 'regular' },    // 1517 scenario
  papacy: { space: 'Rome', unit: 'regular' },
  protestant: { space: 'Brandenburg', unit: 'regular' } // Electorate display for 1517
};
