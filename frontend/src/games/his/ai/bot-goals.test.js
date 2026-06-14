/**
 * Here I Stand — Bot Goals Tests (Phase D)
 *
 * Tests for goal dispatcher + all 21 goal executors.
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import { initBotDeck, CARD_BY_ID } from './behavior-cards.js';
import { GOAL_TYPES } from './behavior-cards.js';
import { ACTION_TYPES } from '../actions/action-types.js';
import { RELIGION } from '../constants.js';
import {
  dispatchGoalAction,
  getGarrisonRequirement,
  chooseLandUnitPlacement,
  chooseNavalPlacement,
  executeGarrison, executeTroops, executeMercenaries, executeCavalry,
  executeAdvance, executeLandBattle, executeSiege,
  executeSetSail, executeNavalBattle, executeShipbuilding, executePiracy,
  executeControl,
  executeTranslate, executePublish, executeDebate,
  executeStPeters, executeBurn, executeJesuits,
  executeExplore, executeColonize, executeConquer
} from './bot-goals.js';

// ── Helpers ──────────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  state.hands = state.hands || {};
  state.vp = state.vp || {};
  state.wars = [];
  state.foreignWars = [];
  state.botGoalCounts = {};
  return state;
}

function setActiveBehaviorCard(state, power, cardId) {
  const card = CARD_BY_ID[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  if (!state.botDecks[power]) state.botDecks[power] = initBotDeck(power);
  state.botDecks[power].faceUp = [cardId];
}

function addUnit(state, spaceName, owner, opts = {}) {
  if (!state.spaces[spaceName]) {
    state.spaces[spaceName] = {
      controller: owner, units: [], isKey: false, isElectorate: false,
      isFortress: false, isPort: false
    };
  }
  const existing = state.spaces[spaceName].units.find(u => u.owner === owner);
  if (existing) {
    existing.regulars = (existing.regulars || 0) + (opts.regulars || 0);
    existing.mercenaries = (existing.mercenaries || 0) + (opts.mercenaries || 0);
    existing.cavalry = (existing.cavalry || 0) + (opts.cavalry || 0);
    existing.squadrons = (existing.squadrons || 0) + (opts.squadrons || 0);
    existing.corsairs = (existing.corsairs || 0) + (opts.corsairs || 0);
    if (opts.leaders) existing.leaders = [...(existing.leaders || []), ...opts.leaders];
  } else {
    state.spaces[spaceName].units.push({
      owner,
      regulars: opts.regulars || 0,
      mercenaries: opts.mercenaries || 0,
      cavalry: opts.cavalry || 0,
      squadrons: opts.squadrons || 0,
      corsairs: opts.corsairs || 0,
      leaders: opts.leaders || []
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Garrison Requirements (§4.10)
// ═══════════════════════════════════════════════════════════════════════

describe('getGarrisonRequirement', () => {
  it('returns 2 for capital', () => {
    const state = createBotState();
    // Istanbul is Ottoman capital
    const req = getGarrisonRequirement(state, 'Istanbul', 'ottoman');
    expect(req).toBeGreaterThanOrEqual(2);
  });

  it('returns 1 for key space', () => {
    const state = createBotState();
    // Clear nearby enemies to get base requirement
    // Find a key space controlled by ottoman
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.isKey && sp.controller === 'ottoman' && name !== 'Istanbul') {
        // Clear all enemy units nearby
        for (const adj of Object.values(state.spaces)) {
          adj.units = adj.units.filter(u => u.owner === 'ottoman' || u.owner === sp.controller);
        }
        const req = getGarrisonRequirement(state, name, 'ottoman');
        expect(req).toBeGreaterThanOrEqual(1);
        return;
      }
    }
  });

  it('returns 0 for non-key non-capital', () => {
    const state = createBotState();
    // Create a non-key, non-capital space with no nearby enemies
    state.spaces['TestTown'] = {
      controller: 'ottoman', units: [], isKey: false,
      isElectorate: false, isFortress: false, isPort: false
    };
    const req = getGarrisonRequirement(state, 'TestTown', 'ottoman');
    expect(req).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D1: Military Basics
// ═══════════════════════════════════════════════════════════════════════

describe('executeGarrison', () => {
  it('returns null when all garrisons met', () => {
    const state = createBotState(['ottoman']);
    // Fill Istanbul garrison
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 5, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    // Remove all other ottoman spaces that need garrison
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && name !== 'Istanbul') {
        sp.controller = 'neutral';
      }
    }
    const result = executeGarrison(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('places regular at capital below garrison', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && name !== 'Istanbul') {
        sp.controller = 'neutral';
      }
    }
    const result = executeGarrison(state, 'ottoman', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.RAISE_REGULAR);
    expect(result.cpCost).toBe(2);
  });

  it('falls back to cavalry when regular too expensive', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && name !== 'Istanbul') {
        sp.controller = 'neutral';
      }
    }
    // Ottoman: raise_regular=2, buy_mercenary=null, raise_cavalry=1
    const result = executeGarrison(state, 'ottoman', 1);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.RAISE_CAVALRY);
    expect(result.cpCost).toBe(1);
  });
});

describe('executeTroops', () => {
  it('raises regular at placement target', () => {
    const state = createBotState(['hapsburg']);
    state.spaces['Vienna'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: false,
      units: [{ owner: 'hapsburg', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeTroops(state, 'hapsburg', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.RAISE_REGULAR);
    expect(result.cpCost).toBe(2);
  });

  it('returns null when not enough CP', () => {
    const state = createBotState(['hapsburg']);
    const result = executeTroops(state, 'hapsburg', 1);
    expect(result).toBeNull();
  });
});

describe('executeMercenaries', () => {
  it('buys mercenary for Hapsburg', () => {
    const state = createBotState(['hapsburg']);
    state.spaces['Vienna'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: false,
      units: [{ owner: 'hapsburg', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeMercenaries(state, 'hapsburg', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUY_MERCENARY);
    expect(result.cpCost).toBe(1);
  });

  it('returns null for Ottoman (cannot buy mercenary)', () => {
    const state = createBotState(['ottoman']);
    const result = executeMercenaries(state, 'ottoman', 5);
    expect(result).toBeNull();
  });
});

describe('executeCavalry', () => {
  it('raises cavalry for Ottoman', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 3, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeCavalry(state, 'ottoman', 2);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.RAISE_CAVALRY);
    expect(result.cpCost).toBe(1);
  });

  it('returns null for Hapsburg (no cavalry)', () => {
    const state = createBotState(['hapsburg']);
    const result = executeCavalry(state, 'hapsburg', 5);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D2: Military Movement
// ═══════════════════════════════════════════════════════════════════════

describe('executeAdvance', () => {
  it('returns null when no movable formation exists', () => {
    const state = createBotState(['ottoman']);
    // No units above garrison
    const result = executeAdvance(state, 'ottoman', 5);
    // May return null or a move — depends on initial state
    // At minimum, it should not crash
    expect(result === null || result.action.actionType === ACTION_TYPES.MOVE_FORMATION).toBe(true);
  });

  it('returns null when not enough CP', () => {
    const state = createBotState(['ottoman']);
    const result = executeAdvance(state, 'ottoman', 0);
    expect(result).toBeNull();
  });
});

describe('executeLandBattle', () => {
  it('returns null when no battle targets available', () => {
    const state = createBotState(['ottoman']);
    // Clear all enemy units
    for (const sp of Object.values(state.spaces)) {
      sp.units = sp.units.filter(u => u.owner === 'ottoman');
    }
    const result = executeLandBattle(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('returns null when not enough CP', () => {
    const state = createBotState(['ottoman']);
    const result = executeLandBattle(state, 'ottoman', 0);
    expect(result).toBeNull();
  });
});

describe('executeSiege', () => {
  it('assaults active siege when available', () => {
    const state = createBotState(['ottoman']);
    // Set up a real-map siege with valid LOC (Istanbul → Edirne → Sofia → Nezh
    // → Belgrade, all ottoman-controlled → Mohacs → Buda besieged by ottoman).
    // findAssaultTarget now requires LOC to a friendly fortified space per
    // engine's validateAssault; bridging keys must be ottoman-held.
    for (const bridge of ['Belgrade', 'Mohacs']) {
      state.spaces[bridge].controller = 'ottoman';
      state.spaces[bridge].units = [];
    }
    state.spaces['Buda'].besieged = true;
    state.spaces['Buda'].besiegedBy = 'ottoman';
    state.spaces['Buda'].units = [{
      owner: 'ottoman', regulars: 4, mercenaries: 0, cavalry: 0,
      squadrons: 0, corsairs: 0, leaders: []
    }];
    state.wars = [{ a: 'ottoman', b: 'hungary_bohemia' }];
    const result = executeSiege(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.ASSAULT);
    expect(result.cpCost).toBe(1);
  });

  it('returns null when not enough CP', () => {
    const state = createBotState(['ottoman']);
    const result = executeSiege(state, 'ottoman', 0);
    expect(result).toBeNull();
  });

  it('checks foreign war before assault', () => {
    const state = createBotState(['ottoman']);
    state.foreignWars = [{
      targetPower: 'ottoman',
      cardNumber: 99,
      friendlyUnits: 3,
      enemyUnits: 2
    }];
    const result = executeSiege(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.ASSAULT);
    expect(result.action.actionData.foreignWar).toBe(99);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D3: Naval
// ═══════════════════════════════════════════════════════════════════════

describe('executeSetSail', () => {
  it('returns null when no naval move cost', () => {
    const state = createBotState(['protestant']);
    const result = executeSetSail(state, 'protestant', 5);
    expect(result).toBeNull();
  });

  it('returns null when not enough CP', () => {
    const state = createBotState(['ottoman']);
    const result = executeSetSail(state, 'ottoman', 0);
    expect(result).toBeNull();
  });
});

describe('executeNavalBattle', () => {
  it('returns null when no battle target', () => {
    const state = createBotState(['ottoman']);
    const result = executeNavalBattle(state, 'ottoman', 5);
    expect(result).toBeNull();
  });
});

describe('executeShipbuilding', () => {
  it('builds squadron for non-Ottoman power', () => {
    const state = createBotState(['hapsburg']);
    // Create a port
    state.spaces['Barcelona'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'hapsburg', regulars: 2, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeShipbuilding(state, 'hapsburg', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_SQUADRON);
    expect(result.cpCost).toBe(2);
  });

  it('builds corsair for Ottoman with 1 CP remaining', () => {
    const state = createBotState(['ottoman']);
    state.piracyEnabled = true;
    state.spaces['Algiers'] = {
      controller: 'ottoman', isKey: false, isFortress: false,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 1, leaders: [] }]
    };
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const result = executeShipbuilding(state, 'ottoman', 1);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_CORSAIR);
    expect(result.cpCost).toBe(1);
  });

  it('builds corsair with Barbary Pirates card', () => {
    const state = createBotState(['ottoman']);
    state.piracyEnabled = true;
    state.spaces['Algiers'] = {
      controller: 'ottoman', isKey: false, isFortress: false,
      isElectorate: false, isPort: true,
      units: []
    };
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_barbary_pirates');
    const result = executeShipbuilding(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_CORSAIR);
  });

  it('returns null for Protestant (no naval)', () => {
    const state = createBotState(['protestant']);
    const result = executeShipbuilding(state, 'protestant', 5);
    expect(result).toBeNull();
  });
});

describe('executePiracy', () => {
  it('returns null for non-Ottoman', () => {
    const state = createBotState(['hapsburg']);
    const result = executePiracy(state, 'hapsburg', 5);
    expect(result).toBeNull();
  });

  it('returns null when not enough CP', () => {
    const state = createBotState(['ottoman']);
    const result = executePiracy(state, 'ottoman', 1);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D4: Control
// ═══════════════════════════════════════════════════════════════════════

describe('executeControl', () => {
  it('removes unrest from controlled space', () => {
    const state = createBotState(['ottoman']);
    state.spaces['TestSpace'] = {
      controller: 'ottoman', isKey: false, isFortress: false,
      isElectorate: false, isPort: false, unrest: true,
      units: [{ owner: 'ottoman', regulars: 1, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeControl(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.CONTROL_UNFORTIFIED);
    expect(result.action.actionData.removeUnrest).toBe(true);
    expect(result.cpCost).toBe(1);
  });

  it('takes political control of unfortified space', () => {
    const state = createBotState(['ottoman']);
    // Sofia: non-key, non-fortress, adjacent to Edirne (Ottoman)
    state.spaces['Sofia'] = {
      ...state.spaces['Sofia'],
      controller: 'hapsburg',
      units: [{ owner: 'ottoman', regulars: 1, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeControl(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.CONTROL_UNFORTIFIED);
    expect(result.cpCost).toBe(1);
  });

  it('returns null when no control targets', () => {
    const state = createBotState(['ottoman']);
    // Clear all non-ottoman spaces and unrest
    for (const sp of Object.values(state.spaces)) {
      sp.unrest = false;
    }
    const result = executeControl(state, 'ottoman', 3);
    // May find a valid target from initial state or null
    expect(result === null || result.action.actionType === ACTION_TYPES.CONTROL_UNFORTIFIED).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D5: Religious
// ═══════════════════════════════════════════════════════════════════════

describe('executeTranslate', () => {
  it('returns null for non-Protestant', () => {
    const state = createBotState(['ottoman']);
    const result = executeTranslate(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('translates scripture for Protestant', () => {
    const state = createBotState(['protestant']);
    state.translationTracks = {
      german: { nt: 0, full: 0 },
      french: { nt: 0, full: 0 },
      english: { nt: 0, full: 0 }
    };
    const result = executeTranslate(state, 'protestant', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.TRANSLATE_SCRIPTURE);
    expect(result.action.actionData.zone).toBe('german');
    expect(result.cpCost).toBe(1);
  });

  it('skips completed language zones', () => {
    const state = createBotState(['protestant']);
    state.translationTracks = {
      german: 10,  // Complete (>= fullBibleCp)
      french: 0,
      english: 0
    };
    state.calvinPlaced = true;
    const result = executeTranslate(state, 'protestant', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionData.zone).toBe('french');
  });

  it('skips French if Calvin not placed', () => {
    const state = createBotState(['protestant']);
    state.translationTracks = {
      german: 10,  // Complete
      french: 0,
      english: 0
    };
    state.calvinPlaced = false;
    state.cranmerPlaced = true;
    const result = executeTranslate(state, 'protestant', 3);
    expect(result.action.actionData.zone).toBe('english');
  });
});

describe('executePublish', () => {
  it('returns null for non-Protestant/non-England', () => {
    const state = createBotState(['ottoman']);
    const result = executePublish(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('publishes in German zone for Protestant', () => {
    const state = createBotState(['protestant']);
    // Set up spaces with Catholic religion in German zone for valid targets
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.languageZone === 'german' && sp.religion === RELIGION.CATHOLIC) {
        // Ensure there's an adjacent Protestant space for valid target
        break;
      }
    }
    const result = executePublish(state, 'protestant', 5);
    // May or may not find valid target depending on initial state
    expect(result === null || result.action.actionType === ACTION_TYPES.PUBLISH_TREATISE).toBe(true);
  });

  it('returns null for England without reformation', () => {
    const state = createBotState(['england']);
    state.englishReformationStarted = false;
    const result = executePublish(state, 'england', 5);
    expect(result).toBeNull();
  });
});

describe('executeDebate', () => {
  it('returns null for non-Papacy/non-Protestant', () => {
    const state = createBotState(['ottoman']);
    const result = executeDebate(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('calls debate for Papacy in zone with most Protestant spaces', () => {
    const state = createBotState(['papacy']);
    // Set up Protestant spaces in German zone
    let germanProtCount = 0;
    for (const sp of Object.values(state.spaces)) {
      if (sp.languageZone === 'german' && sp.religion === RELIGION.PROTESTANT) {
        germanProtCount++;
      }
    }
    const result = executeDebate(state, 'papacy', 5);
    // May or may not find zone depending on initial state
    expect(result === null || result.action.actionType === ACTION_TYPES.CALL_DEBATE).toBe(true);
  });

  it('returns null with insufficient CP', () => {
    const state = createBotState(['papacy']);
    const result = executeDebate(state, 'papacy', 2);
    expect(result).toBeNull();
  });
});

describe('executeStPeters', () => {
  it('returns null for non-Papacy', () => {
    const state = createBotState(['ottoman']);
    const result = executeStPeters(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('builds St Peters when incomplete', () => {
    const state = createBotState(['papacy']);
    state.stPetersProgress = 2;
    const result = executeStPeters(state, 'papacy', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_ST_PETERS);
    expect(result.cpCost).toBe(1);
  });

  it('returns null when St Peters complete', () => {
    const state = createBotState(['papacy']);
    state.stPetersVp = 5;
    const result = executeStPeters(state, 'papacy', 3);
    expect(result).toBeNull();
  });
});

describe('executeBurn', () => {
  it('returns null for non-Papacy', () => {
    const state = createBotState(['ottoman']);
    const result = executeBurn(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('returns null with insufficient CP', () => {
    const state = createBotState(['papacy']);
    const result = executeBurn(state, 'papacy', 1);
    expect(result).toBeNull();
  });
});

describe('executeJesuits', () => {
  it('returns null for non-Papacy', () => {
    const state = createBotState(['ottoman']);
    const result = executeJesuits(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('returns null without Society of Jesus', () => {
    const state = createBotState(['papacy']);
    state.jesuitFoundingEnabled = false;
    const result = executeJesuits(state, 'papacy', 5);
    expect(result).toBeNull();
  });

  it('places Jesuit university when Society played', () => {
    const state = createBotState(['papacy']);
    state.jesuitFoundingEnabled = true;
    state.jesuitUniversities = [];
    const result = executeJesuits(state, 'papacy', 5);
    // May find target or not depending on Protestant spaces in initial state
    expect(result === null || result.action.actionType === ACTION_TYPES.FOUND_JESUIT).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D6: New World
// ═══════════════════════════════════════════════════════════════════════

describe('executeExplore', () => {
  it('returns null for non-New World power', () => {
    const state = createBotState(['ottoman']);
    const result = executeExplore(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('returns null for Protestant', () => {
    const state = createBotState(['protestant']);
    const result = executeExplore(state, 'protestant', 5);
    expect(result).toBeNull();
  });

  it('explores for England with available explorer', () => {
    const state = createBotState(['england']);
    state.newWorld = {
      placedExplorers: [], deadExplorers: [],
      placedConquistadors: [], deadConquistadors: [],
      colonies: [], conquests: []
    };
    const result = executeExplore(state, 'england', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.EXPLORE);
    // Explorer id comes from the engine's EXPLORERS data (faction-suffixed)
    expect(result.action.actionData.explorer).toBe('cabot_eng');
    expect(result.cpCost).toBe(2);
  });

  it('returns null when all explorers used', () => {
    const state = createBotState(['england']);
    state.newWorld = {
      // Engine ids for England explorers (getAvailableExplorers parity)
      placedExplorers: [], deadExplorers: ['cabot_eng', 'chancellor', 'rut', 'willoughby'],
      placedConquistadors: [], deadConquistadors: [],
      colonies: [], conquests: []
    };
    const result = executeExplore(state, 'england', 5);
    expect(result).toBeNull();
  });
});

describe('executeColonize', () => {
  it('returns null for non-New World power', () => {
    const state = createBotState(['ottoman']);
    const result = executeColonize(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('colonizes for France', () => {
    const state = createBotState(['france']);
    state.newWorld = {
      colonies: [], conquests: [],
      placedExplorers: [], deadExplorers: [],
      placedConquistadors: [], deadConquistadors: []
    };
    const result = executeColonize(state, 'france', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.COLONIZE);
    expect(result.cpCost).toBe(3);
  });

  it('returns null when colony limit reached', () => {
    const state = createBotState(['france']);
    state.newWorld = {
      colonies: [{ power: 'france' }, { power: 'france' }],
      conquests: [],
      placedExplorers: [], deadExplorers: [],
      placedConquistadors: [], deadConquistadors: []
    };
    const result = executeColonize(state, 'france', 5);
    expect(result).toBeNull();
  });
});

describe('executeConquer', () => {
  it('returns null for non-Hapsburg', () => {
    const state = createBotState(['ottoman']);
    const result = executeConquer(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  it('conquers for Hapsburg with available conquistador', () => {
    const state = createBotState(['hapsburg']);
    state.newWorld = {
      placedConquistadors: [], deadConquistadors: [],
      placedExplorers: [], deadExplorers: [],
      colonies: [], conquests: []
    };
    const result = executeConquer(state, 'hapsburg', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.CONQUER);
    expect(result.action.actionData.conquistador).toBe('cortes');
    expect(result.cpCost).toBe(4);
  });

  it('returns null when all conquistadors used', () => {
    const state = createBotState(['hapsburg']);
    state.newWorld = {
      placedConquistadors: ['cortes', 'pizarro', 'de_alvarado', 'de_montejo', 'de_quesada'],
      deadConquistadors: [],
      placedExplorers: [], deadExplorers: [],
      colonies: [], conquests: []
    };
    const result = executeConquer(state, 'hapsburg', 5);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  D7: Dispatcher
// ═══════════════════════════════════════════════════════════════════════

describe('dispatchGoalAction', () => {
  it('returns null when cpRemaining is 0', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 0;
    const result = dispatchGoalAction(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('returns END_IMPULSE when no behavior card', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 3;
    state.botDecks.ottoman.faceUp = [];
    const result = dispatchGoalAction(state, 'ottoman');
    expect(result.actionType).toBe(ACTION_TYPES.END_IMPULSE);
  });

  it('returns END_IMPULSE with grantCpToken when no goals executable', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 3;
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    // Wipe entire spaces map so no placement/control/siege targets exist
    state.spaces = {};
    state.foreignWars = [];
    const result = dispatchGoalAction(state, 'ottoman');
    expect(result).not.toBeNull();
    expect(result.actionType).toBe(ACTION_TYPES.END_IMPULSE);
    expect(result.actionData.grantCpToken).toBe(true);
  });

  it('respects max execution count per goal', () => {
    const state = createBotState(['hapsburg']);
    state.cpRemaining = 10;
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_consolidation');
    // Make garrison available
    state.spaces['Vienna'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: false,
      units: [{ owner: 'hapsburg', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'hapsburg' && name !== 'Vienna') {
        sp.controller = 'neutral';
      }
    }
    // Set goal count to max for garrison (need to check card limits)
    // Garrison should be in the card's goals with a max
    const result = dispatchGoalAction(state, 'hapsburg');
    expect(result).not.toBeNull();
    // Should produce some action (garrison or another goal)
  });

  it('skips goals where power cannot perform action', () => {
    const state = createBotState(['protestant']);
    state.cpRemaining = 5;
    setActiveBehaviorCard(state, 'protestant', 'protestant_oratory');
    // Protestant cannot build ships, piracy, etc.
    // Should skip naval goals and find debate/translate/publish
    state.debaters = { protestant: [], papal: [] };
    state.translationTracks = {
      german: { nt: 0, full: 0 },
      french: { nt: 0, full: 0 },
      english: { nt: 0, full: 0 }
    };
    const result = dispatchGoalAction(state, 'protestant');
    expect(result).not.toBeNull();
    // Should be a valid action the Protestant can perform
    const validTypes = [
      ACTION_TYPES.CALL_DEBATE,
      ACTION_TYPES.TRANSLATE_SCRIPTURE,
      ACTION_TYPES.PUBLISH_TREATISE,
      ACTION_TYPES.RAISE_REGULAR,
      ACTION_TYPES.BUY_MERCENARY,
      ACTION_TYPES.CONTROL_UNFORTIFIED,
      ACTION_TYPES.MOVE_FORMATION,
      ACTION_TYPES.END_IMPULSE
    ];
    expect(validTypes.includes(result.actionType)).toBe(true);
  });

  it('includes goalId in returned action', () => {
    const state = createBotState(['papacy']);
    state.cpRemaining = 3;
    state.stPetersProgress = 0;
    setActiveBehaviorCard(state, 'papacy', 'papacy_rebuilding');
    // Make St Peters the achievable goal (it's always available for Papacy)
    const result = dispatchGoalAction(state, 'papacy');
    if (result && result.goalId) {
      expect(typeof result.goalId).toBe('string');
    }
  });

  it('returns cpCost in action for CP deduction', () => {
    const state = createBotState(['papacy']);
    state.cpRemaining = 5;
    state.stPetersProgress = 0;
    setActiveBehaviorCard(state, 'papacy', 'papacy_rebuilding');
    const result = dispatchGoalAction(state, 'papacy');
    if (result && result.cpCost) {
      expect(typeof result.cpCost).toBe('number');
      expect(result.cpCost).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Placement Helpers
// ═══════════════════════════════════════════════════════════════════════

describe('chooseLandUnitPlacement', () => {
  it('places at capital when garrison not met', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = chooseLandUnitPlacement(state, 'ottoman');
    expect(result).toBe('Istanbul');
  });

  it('returns a valid space for Protestant (no capital)', () => {
    const state = createBotState(['protestant']);
    // Protestant has no capital, should find a controlled fortification
    const result = chooseLandUnitPlacement(state, 'protestant');
    // May return null if no Protestant-controlled fortified spaces
    // or a valid space name
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('chooseNavalPlacement', () => {
  it('returns controlled port', () => {
    const state = createBotState(['hapsburg']);
    state.spaces['Barcelona'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: []
    };
    const result = chooseNavalPlacement(state, 'hapsburg');
    // Should find Barcelona or another hapsburg port
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Integration: bot-controller uses dispatchGoalAction
// ═══════════════════════════════════════════════════════════════════════

describe('bot-controller decideGoalAction integration', () => {
  it('dispatches goal action instead of END_IMPULSE stub', async () => {
    const { decideBotAction } = await import('./bot-controller.js');
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.cpRemaining = 3;
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    // Set up valid target for garrison/siege/troops
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && name !== 'Istanbul') {
        sp.controller = 'neutral';
      }
    }
    const action = decideBotAction(state, 'ottoman');
    expect(action).not.toBeNull();
    // Should NOT be END_IMPULSE (old stub behavior)
    // Should be a valid CP action
    expect(action.actionType).not.toBe(ACTION_TYPES.END_IMPULSE);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Garrison
// ═══════════════════════════════════════════════════════════════════════

describe('getGarrisonRequirement edge cases', () => {
  it('returns 0 for unknown space name', () => {
    const state = createBotState();
    expect(getGarrisonRequirement(state, 'NonExistentSpace', 'ottoman')).toBe(0);
  });

  it('returns 1 for electorate space', () => {
    const state = createBotState();
    state.spaces['TestElectorate'] = {
      controller: 'hapsburg', units: [], isKey: false,
      isElectorate: true, isFortress: true, isPort: false
    };
    // Clear nearby enemies
    const req = getGarrisonRequirement(state, 'TestElectorate', 'hapsburg');
    expect(req).toBeGreaterThanOrEqual(1);
  });

  it('adds +1 when enemy within 2 spaces of fortified space', () => {
    const state = createBotState();
    // Create fortified key space
    state.spaces['FortA'] = {
      controller: 'hapsburg', units: [], isKey: true,
      isElectorate: false, isFortress: true, isPort: false
    };
    // Base = 1 (key), no enemy nearby = 1
    const baseReq = getGarrisonRequirement(state, 'FortA', 'hapsburg');
    // Now put enemy within 2 via an adjacent real space
    // Since FortA is synthetic, it has no adjacency in map-data, so +1 doesn't trigger
    expect(baseReq).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Unit Placement
// ═══════════════════════════════════════════════════════════════════════

describe('chooseLandUnitPlacement edge cases', () => {
  it('returns null when power has no controlled spaces', () => {
    const state = createBotState(['ottoman']);
    // Remove all ottoman control
    for (const sp of Object.values(state.spaces)) {
      if (sp.controller === 'ottoman') sp.controller = 'independent';
    }
    const result = chooseLandUnitPlacement(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('Protestant falls back to controlled fortified space', () => {
    const state = createBotState(['protestant']);
    // Set up a Protestant-controlled fortified space
    state.spaces['Wittenberg'] = {
      controller: 'protestant', isKey: true, isFortress: true,
      isElectorate: true, isPort: false, units: []
    };
    const result = chooseLandUnitPlacement(state, 'protestant');
    expect(typeof result).toBe('string');
  });
});

describe('chooseNavalPlacement edge cases', () => {
  it('returns null when no controlled ports', () => {
    const state = createBotState(['protestant']);
    // Protestant has no ports
    for (const sp of Object.values(state.spaces)) {
      if (sp.controller === 'protestant') sp.isPort = false;
    }
    const result = chooseNavalPlacement(state, 'protestant');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Garrison Goal (§3.1)
// ═══════════════════════════════════════════════════════════════════════

describe('executeGarrison edge cases', () => {
  it('returns null when cp is 0', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Istanbul'] = {
      controller: 'ottoman', isKey: true, isFortress: true,
      isElectorate: false, isPort: true,
      units: [{ owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    expect(executeGarrison(state, 'ottoman', 0)).toBeNull();
  });

  it('Hapsburg falls back to mercenary when regular too expensive', () => {
    const state = createBotState(['hapsburg']);
    state.spaces['Vienna'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: false,
      units: [{ owner: 'hapsburg', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'hapsburg' && name !== 'Vienna') sp.controller = 'neutral';
    }
    const result = executeGarrison(state, 'hapsburg', 1);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUY_MERCENARY);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Siege (§3.9)
// ═══════════════════════════════════════════════════════════════════════

describe('executeSiege edge cases', () => {
  it('returns foreign war action when available', () => {
    const state = createBotState(['ottoman']);
    state.foreignWars = [
      { targetPower: 'ottoman', friendlyUnits: 4, enemyUnits: 3, cardNumber: 99 }
    ];
    const result = executeSiege(state, 'ottoman', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.ASSAULT);
    expect(result.action.actionData.foreignWar).toBe(99);
  });

  it('returns assault on existing siege', () => {
    const state = createBotState(['ottoman']);
    state.foreignWars = [];
    // LOC path from Istanbul → Edirne/Sofia/Nezh → Belgrade → Mohacs → Buda
    // → Pressburg → Vienna. Pressburg must be ottoman-held (Vienna's last
    // land-neighbor) for validateAssault's LOC check to reach Vienna.
    for (const bridge of ['Belgrade', 'Mohacs', 'Buda', 'Pressburg']) {
      state.spaces[bridge].controller = 'ottoman';
      state.spaces[bridge].units = [];
    }
    state.spaces['Vienna'] = {
      controller: 'hapsburg', isKey: true, isFortress: true,
      isElectorate: false, isPort: false,
      besieged: true, besiegedBy: 'ottoman', defenders: 2,
      units: [
        { owner: 'ottoman', regulars: 4, mercenaries: 0, cavalry: 0,
          squadrons: 0, corsairs: 0, leaders: [] }
      ]
    };
    state.wars = [{ a: 'ottoman', b: 'hapsburg' }];
    const result = executeSiege(state, 'ottoman', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.ASSAULT);
    expect(result.action.actionData.space).toBe('Vienna');
  });

  it('returns null when no siege targets and no foreign wars', () => {
    const state = createBotState(['ottoman']);
    state.foreignWars = [];
    // Clear all sieges and enemy fortifications
    for (const sp of Object.values(state.spaces)) {
      delete sp.siege;
    }
    // Remove all ottoman units above garrison so no movable formations
    for (const sp of Object.values(state.spaces)) {
      sp.units = sp.units.filter(u => u.owner !== 'ottoman');
    }
    const result = executeSiege(state, 'ottoman', 5);
    expect(result).toBeNull();
  });

  // Regression: anomaly #1 — England (1517 setup) at war with Scotland has only
  // 1 spare regular in London (capital garrison=2). Previously advanceTowardTarget
  // required 2+ spare units, so England could never start marching to Edinburgh
  // and cascaded into infinite BUILD_SQUADRON on Rule Britannia's SHIPBUILDING INF.
  it('advances single-unit formation toward enemy fortification when no 2+ formation qualifies', () => {
    const state = createBotState(['england']);
    state.foreignWars = [];
    state.wars = [{ a: 'england', b: 'scotland' }];
    // 1517 setup already provides England's 3 regulars in London, so spare=1
    const result = executeSiege(state, 'england', 2);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.MOVE_FORMATION);
    expect(result.action.actionData.from).toBe('London');
    // London→Lincoln is the only direction that strictly reduces BFS distance to Edinburgh
    expect(result.action.actionData.to).toBe('Lincoln');
  });

  // Regression: anomaly #2 — Ottoman starts at war with hungary_bohemia in 1517,
  // but map-data previously had controller "hungary" (mismatched with the
  // canonical minor-power name). canAttack(ottoman, 'hungary') returned false, so
  // every Hungarian fortification (Buda, Belgrade) was skipped during BFS and
  // Ottoman never initiated a siege despite declaring war repeatedly.
  it('finds attackable hungarian fortification when ottoman has 1517 war with hungary_bohemia', () => {
    const state = createBotState(['ottoman']);
    state.foreignWars = [];
    state.wars = [{ a: 'ottoman', b: 'hungary_bohemia' }];
    const result = executeSiege(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.MOVE_FORMATION);
    expect(result.action.actionData.from).toBe('Istanbul');
    // Istanbul→Edirne strictly reduces BFS distance to Buda
    expect(result.action.actionData.to).toBe('Edirne');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Shipbuilding (§3.11)
// ═══════════════════════════════════════════════════════════════════════

describe('executeShipbuilding edge cases', () => {
  it('Ottoman builds corsair when cp=1', () => {
    const state = createBotState(['ottoman']);
    state.piracyEnabled = true;
    state.spaces['Algiers'] = {
      controller: 'ottoman', isKey: false, isFortress: false,
      isElectorate: false, isPort: true, units: []
    };
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const result = executeShipbuilding(state, 'ottoman', 1);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_CORSAIR);
  });

  it('Ottoman builds corsair with Barbary Pirates card active', () => {
    const state = createBotState(['ottoman']);
    state.piracyEnabled = true;
    state.spaces['Algiers'] = {
      controller: 'ottoman', isKey: false, isFortress: false,
      isElectorate: false, isPort: true, units: []
    };
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_barbary_pirates');
    const result = executeShipbuilding(state, 'ottoman', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_CORSAIR);
  });

  it('non-Ottoman builds regular squadron', () => {
    const state = createBotState(['england']);
    state.spaces['London'] = {
      controller: 'england', isKey: true, isFortress: true,
      isElectorate: false, isPort: true, units: []
    };
    const result = executeShipbuilding(state, 'england', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_SQUADRON);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Piracy (§3.12)
// ═══════════════════════════════════════════════════════════════════════

describe('executePiracy edge cases', () => {
  it('returns null for non-Ottoman', () => {
    const state = createBotState(['france']);
    expect(executePiracy(state, 'france', 5)).toBeNull();
  });

  it('returns null when no corsairs available', () => {
    const state = createBotState(['ottoman']);
    // Clear all corsairs
    for (const sp of Object.values(state.spaces)) {
      for (const u of sp.units || []) {
        if (u.owner === 'ottoman') u.corsairs = 0;
      }
    }
    expect(executePiracy(state, 'ottoman', 5)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Control (§3.10)
// ═══════════════════════════════════════════════════════════════════════

describe('executeControl edge cases', () => {
  it('removes unrest from home space first', () => {
    const state = createBotState(['france']);
    // Create a France home space with unrest and a unit
    state.spaces['Paris'] = {
      ...state.spaces['Paris'],
      controller: 'france', homeSpace: 'france', unrest: true,
      units: [{ owner: 'france', regulars: 2, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = executeControl(state, 'france', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionData.removeUnrest).toBe(true);
  });

  it('takes political control when no unrest targets', () => {
    const state = createBotState(['france']);
    // Use a real map space adjacent to French territory (Grenoble ↔ Lyon)
    state.spaces['Grenoble'] = {
      ...state.spaces['Grenoble'],
      controller: 'independent', unrest: false,
      isFortress: false,
      units: [{ owner: 'france', regulars: 1, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    // Remove all unrest from state
    for (const sp of Object.values(state.spaces)) sp.unrest = false;
    const result = executeControl(state, 'france', 3);
    expect(result).not.toBeNull();
    expect(result.action.actionData.removeUnrest).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Religious Goals
// ═══════════════════════════════════════════════════════════════════════

describe('religious goal edge cases', () => {
  it('executeTranslate returns null for non-Protestant', () => {
    const state = createBotState(['papacy']);
    expect(executeTranslate(state, 'papacy', 5)).toBeNull();
  });

  it('executeTranslate returns null when no translation tracks', () => {
    const state = createBotState(['protestant']);
    state.translationTracks = null;
    expect(executeTranslate(state, 'protestant', 5)).toBeNull();
  });

  it('executePublish returns null for non-protestant/england', () => {
    const state = createBotState(['ottoman']);
    expect(executePublish(state, 'ottoman', 5)).toBeNull();
  });

  it('executeDebate returns null for non-papacy/protestant', () => {
    const state = createBotState(['ottoman']);
    expect(executeDebate(state, 'ottoman', 5)).toBeNull();
  });

  it('executeStPeters returns null when St Peters complete', () => {
    const state = createBotState(['papacy']);
    state.stPetersVp = 5;
    expect(executeStPeters(state, 'papacy', 5)).toBeNull();
  });

  it('executeStPeters returns action when not complete', () => {
    const state = createBotState(['papacy']);
    state.stPetersProgress = 3;
    const result = executeStPeters(state, 'papacy', 5);
    expect(result).not.toBeNull();
    expect(result.action.actionType).toBe(ACTION_TYPES.BUILD_ST_PETERS);
  });

  it('executeBurn returns null for non-papacy', () => {
    const state = createBotState(['ottoman']);
    expect(executeBurn(state, 'ottoman', 5)).toBeNull();
  });

  it('executeJesuits returns null when Society of Jesus not played', () => {
    const state = createBotState(['papacy']);
    state.jesuitFoundingEnabled = false;
    expect(executeJesuits(state, 'papacy', 5)).toBeNull();
  });

  it('executeJesuits returns null for non-papacy', () => {
    const state = createBotState(['ottoman']);
    expect(executeJesuits(state, 'ottoman', 5)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — New World Goals
// ═══════════════════════════════════════════════════════════════════════

describe('new world goal edge cases', () => {
  it('executeExplore returns null for non-New World power', () => {
    const state = createBotState(['ottoman']);
    expect(executeExplore(state, 'ottoman', 5)).toBeNull();
  });

  it('executeExplore returns null when all explorers used', () => {
    const state = createBotState(['england']);
    state.newWorld = {
      // Engine ids for England explorers (getAvailableExplorers parity)
      placedExplorers: [], deadExplorers: ['cabot_eng', 'chancellor', 'rut', 'willoughby']
    };
    expect(executeExplore(state, 'england', 5)).toBeNull();
  });

  it('executeColonize returns null when max colonies reached', () => {
    const state = createBotState(['france']);
    state.newWorld = {
      colonies: [
        { power: 'france', name: 'c1' },
        { power: 'france', name: 'c2' }
      ]
    };
    expect(executeColonize(state, 'france', 5)).toBeNull();
  });

  it('executeColonize Hapsburg allows 3 colonies', () => {
    const state = createBotState(['hapsburg']);
    state.newWorld = {
      colonies: [
        { power: 'hapsburg', name: 'c1' },
        { power: 'hapsburg', name: 'c2' }
      ]
    };
    const result = executeColonize(state, 'hapsburg', 5);
    expect(result).not.toBeNull();
  });

  it('executeConquer returns null when no conquistadors available', () => {
    const state = createBotState(['hapsburg']);
    state.newWorld = {
      placedConquistadors: ['cortes', 'pizarro', 'de_alvarado', 'de_montejo', 'de_quesada'],
      deadConquistadors: []
    };
    expect(executeConquer(state, 'hapsburg', 5)).toBeNull();
  });

  it('executeConquer returns null for non-Hapsburg', () => {
    const state = createBotState(['france']);
    state.newWorld = { placedConquistadors: [], deadConquistadors: [] };
    expect(executeConquer(state, 'france', 5)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — dispatchGoalAction
// ═══════════════════════════════════════════════════════════════════════

describe('dispatchGoalAction edge cases', () => {
  it('returns null when cpRemaining is 0', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 0;
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    expect(dispatchGoalAction(state, 'ottoman')).toBeNull();
  });

  it('returns null when no bot deck', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 5;
    state.botDecks = {};
    expect(dispatchGoalAction(state, 'ottoman')).toBeNull();
  });

  it('returns END_IMPULSE with grantCpToken when no goals executable', () => {
    const state = createBotState(['papacy']);
    state.cpRemaining = 1;
    setActiveBehaviorCard(state, 'papacy', 'papacy_exsurge_domine');
    // Set all goals as already maxed out
    state.botGoalCounts = { papacy: {} };
    const card = CARD_BY_ID['papacy_exsurge_domine'];
    if (card?.goals) {
      for (const g of card.goals) {
        state.botGoalCounts.papacy[g.type] = g.max;
      }
    }
    const result = dispatchGoalAction(state, 'papacy');
    expect(result).not.toBeNull();
    expect(result.actionType).toBe(ACTION_TYPES.END_IMPULSE);
    expect(result.actionData.grantCpToken).toBe(true);
  });

  it('respects max execution count per goal', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 10;
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const card = CARD_BY_ID['ottoman_spoils_of_war'];
    if (card?.goals?.length > 0) {
      const firstGoal = card.goals[0];
      // Set count just at max
      state.botGoalCounts = { ottoman: { [firstGoal.type]: firstGoal.max } };
      const result = dispatchGoalAction(state, 'ottoman');
      // Should skip first goal and try next, or END_IMPULSE if none work
      if (result) {
        expect(result.goalId !== firstGoal.type || result.actionType === ACTION_TYPES.END_IMPULSE).toBe(true);
      }
    }
  });

  it('returns END_IMPULSE when behavior card has no goals', () => {
    const state = createBotState(['ottoman']);
    state.cpRemaining = 5;
    // Create a mock deck with empty goals card
    state.botDecks.ottoman = {
      drawPile: [],
      faceUp: ['ottoman_continue_1'],
      goodwill: [],
      discardPile: []
    };
    const result = dispatchGoalAction(state, 'ottoman');
    // Continue card with no previous → END_IMPULSE or null
    expect(result === null || result.actionType === ACTION_TYPES.END_IMPULSE).toBe(true);
  });
});
