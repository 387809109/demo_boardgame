/**
 * Here I Stand — Initial State Builder
 *
 * Constructs the full game state from scenario data + player list.
 */

import { MAJOR_POWERS, IMPULSE_ORDER, RELIGION } from '../constants.js';
import { LAND_SPACES, SEA_ZONES } from '../data/map-data.js';
import { CARDS } from '../data/cards.js';
import { SCENARIO_1517 } from '../data/setup-1517.js';

/** Home card numbers per power (cards 1–7) */
const HOME_CARDS = {
  ottoman: [1],
  hapsburg: [2],
  england: [3],
  france: [4],
  papacy: [5, 6],
  protestant: [7]
};

/** Initial ruler IDs per power (1517 scenario) */
const INITIAL_RULERS = {
  ottoman: 'suleiman',
  hapsburg: 'charles_v',
  england: 'henry_viii',
  france: 'francis_i',
  papacy: 'leo_x',
  protestant: 'luther'
};

/**
 * Build initial game state for a new HIS game.
 * @param {Array<{id: string, nickname: string, isHost: boolean}>} players
 * @param {Object} options - Game options from lobby
 * @returns {Object} Complete initial game state
 */
export function buildInitialState(players, options = {}) {
  const scenario = SCENARIO_1517;

  // Map players to powers by impulse order
  const powerByPlayer = {};
  const playerByPower = {};
  const playerList = players.map((p, i) => {
    const power = IMPULSE_ORDER[i];
    powerByPlayer[p.id] = power;
    playerByPower[power] = p.id;
    return { id: p.id, nickname: p.nickname, isHost: p.isHost || false, power };
  });

  // Build space states from map data + scenario
  const spaces = buildSpaces(scenario);

  // Place units from scenario deployments
  placeUnits(spaces, scenario.deployments);
  placeUnits(spaces, scenario.minorDeployments);
  placeIndependentUnits(spaces, scenario.independentDeployments);

  // Build initial deck (exclude home cards, scenario-excluded cards, and special timing cards)
  const homeCardNumbers = new Set(Object.values(HOME_CARDS).flat());
  const excludedSet = new Set(scenario.excludedCards);
  const deck = CARDS
    .filter(c =>
      !homeCardNumbers.has(c.number) &&
      !excludedSet.has(c.number) &&
      c.deck !== 'home' &&
      c.deck !== 'special' &&
      c.deck !== 'diplomacy' &&
      c.deck !== 'diplomacy_sl' &&
      (c.availableTurn === null || c.availableTurn <= scenario.startTurn)
    )
    .map(c => c.number);

  // Initialize empty hands (cards dealt during card_draw phase)
  const hands = {};
  const homeCardPlayed = {};
  for (const power of MAJOR_POWERS) {
    hands[power] = [];
    homeCardPlayed[power] = false;
  }

  // VP from scenario
  const vp = { ...scenario.vp };
  const bonusVp = {};
  for (const power of MAJOR_POWERS) {
    bonusVp[power] = 0;
  }

  return {
    // Core
    turn: 1,
    phase: 'card_draw',
    turnNumber: 1,
    status: 'playing',
    players: playerList,
    powerByPlayer,
    playerByPower,
    activePower: null,

    // Map
    spaces,

    // Cards
    deck,
    discard: [],
    removedCards: [],
    hands,
    homeCardPlayed,

    // Diplomacy
    wars: scenario.wars.map(w => ({ ...w })),
    alliances: [],
    peaceMadeThisTurn: [],
    alliancesFormedThisTurn: [],
    diplomacySegment: null,
    diplomacyActed: {},
    springDeploymentDone: {},
    excommunicated: [],

    // VP
    vp,
    bonusVp,

    // Rulers
    rulers: { ...INITIAL_RULERS },

    // Power-specific tracks
    piracyTrack: scenario.powerState.ottoman.piracyTrack,
    chateauxTrack: scenario.powerState.france.chateauxTrack,
    stPetersProgress: scenario.powerState.papacy.stPetersProgress,
    stPetersVp: scenario.powerState.papacy.stPetersVp,
    protestantSpaces: scenario.powerState.protestant.protestantSpaces,
    translationTracks: { ...scenario.powerState.protestant.translationTracks },
    henryMaritalStatus: scenario.powerState.england.maritalStatus,
    edwardBorn: false,
    elizabethBorn: false,
    jesuitUnlocked: false,
    schmalkaldicLeagueFormed: false,
    algiersInPlay: false,

    // Debaters (track who is in play + committed status)
    debaters: {
      papal: scenario.powerState.papacy.debaters.map(
        id => ({ id, committed: false })
      ),
      protestant: scenario.powerState.protestant.debaters.map(
        id => ({ id, committed: false })
      )
    },

    // Jesuit universities
    jesuitUniversities: [],

    // Action phase
    impulseIndex: 0,
    consecutivePasses: 0,

    // CP spending (Phase 2)
    cpRemaining: 0,
    activeCardNumber: null,
    impulseActions: [],
    pendingReformation: null,
    pendingDebate: null,

    // Combat (Phase 3)
    pendingBattle: null,
    pendingInterception: null,
    capturedLeaders: {},
    piracyUsed: {},

    // Event markers
    augsburgConfessionActive: false,
    printingPressActive: false,
    wartburgActive: false,

    // New World
    newWorld: {
      underwayExplorations: [],
      underwayConquests: [],
      underwayColonies: [],
      colonies: [],
      conquests: [],
      claimedDiscoveries: [],
      claimedConquests: [],
      placedExplorers: [],
      placedConquistadors: [],
      deadExplorers: [],
      deadConquistadors: [],
      exploredThisTurn: {},
      colonizedThisTurn: {},
      conqueredThisTurn: {}
    },

    // Excommunication
    excommunicatedReformers: [],  // reformer IDs removed this turn (return next turn)
    excommunicatedRulers: {},     // { [power]: true } — persists until removed
    mandatoryEventsPlayed: [],    // card numbers of mandatory events already resolved

    // Turn 1 tracking
    lutherPlaced: false,
    pendingDietOfWorms: null,

    // Meta
    eventLog: []
  };
}

/**
 * Build space state records from map data + scenario markers.
 */
function buildSpaces(scenario) {
  const spaces = {};

  // Initialize from map data
  for (const sp of LAND_SPACES) {
    spaces[sp.name] = {
      controller: sp.controller,
      religion: RELIGION.CATHOLIC,
      unrest: false,
      units: [],
      isKey: sp.isKey,
      isElectorate: sp.isElectorate,
      isFortress: sp.isFortress,
      isPort: sp.isPort,
      languageZone: sp.languageZone,
      connectedSeaZones: sp.connectedSeaZones,
      besieged: false,
      besiegedBy: null,
      siegeEstablishedImpulse: null
    };
  }

  // Apply control markers from scenario
  for (const [power, spaceNames] of Object.entries(scenario.controlMarkers)) {
    for (const name of spaceNames) {
      if (spaces[name]) spaces[name].controller = power;
    }
  }

  // Catholic markers on Protestant home spaces
  for (const name of scenario.catholicMarkers) {
    if (spaces[name]) {
      spaces[name].religion = RELIGION.CATHOLIC;
    }
  }

  // Special markers (e.g., French HCM on Turin)
  for (const marker of scenario.specialMarkers) {
    if (spaces[marker.space]) {
      if (marker.type === 'catholic_control') {
        spaces[marker.space].religion = RELIGION.CATHOLIC;
      }
    }
  }

  // Ottoman-controlled spaces are 'other' religion
  for (const sp of LAND_SPACES) {
    if (sp.controller === 'ottoman' || sp.controller === 'hungary') {
      if (spaces[sp.name]) {
        spaces[sp.name].religion = RELIGION.OTHER;
      }
    }
  }

  return spaces;
}

/**
 * Place units from deployment data into spaces.
 */
function placeUnits(spaces, deployments) {
  for (const [power, placements] of Object.entries(deployments)) {
    for (const { space, units } of placements) {
      if (!spaces[space]) continue;
      const stack = {
        owner: power,
        regulars: units.regulars || 0,
        mercenaries: units.mercenaries || 0,
        cavalry: units.cavalry || 0,
        squadrons: units.squadrons || 0,
        corsairs: units.corsairs || 0,
        leaders: units.leaders || []
      };
      // Only add if there are actual units or leaders
      if (stack.regulars || stack.mercenaries || stack.cavalry ||
          stack.squadrons || stack.corsairs || stack.leaders.length) {
        spaces[space].units.push(stack);
      }
    }
  }
}

/**
 * Place independent garrison units.
 */
function placeIndependentUnits(spaces, deployments) {
  for (const { space, units } of deployments) {
    if (!spaces[space]) continue;
    const stack = {
      owner: 'independent',
      regulars: units.regulars || 0,
      mercenaries: 0,
      cavalry: 0,
      squadrons: 0,
      corsairs: 0,
      leaders: []
    };
    if (stack.regulars) {
      spaces[space].units.push(stack);
    }
  }
}
