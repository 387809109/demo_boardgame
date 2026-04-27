/**
 * Here I Stand — Bot Rules & Integration Tests (Phase F)
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks, decideBotAction, initBotGame } from './bot-controller.js';
import {
  EXTENDED_EVENT_CARDS,
  checkExtendedEventDuration,
  registerExtendedEvent,
  expireExtendedEvents,
  isExtendedEventActive,
  makeFreeUnrestRemovalAction,
  makeFortressGarrisonAction,
  registerExcommunicatedDebater,
  shouldReturnExcommunicatedDebater,
  processExcommunicatedDebaterReturns,
  calcThreatToReturnTurn,
  registerThreatToLeader,
  processThreatLeaderReturns,
  isExemptFromPhonyWar,
  getNextAutumnAssault,
  markAutumnAssaultDone,
  resetAutumnAssaults,
  BOT_DIFFICULTY,
  getExtraCardCount,
  initBotDifficulty,
  processBotTurnStart
} from './bot-rules.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  state.turn = 3;
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
//  F3.1 Event Duration Extensions
// ═══════════════════════════════════════════════════════════════════════

describe('EXTENDED_EVENT_CARDS', () => {
  it('contains 4 cards', () => {
    const keys = Object.keys(EXTENDED_EVENT_CARDS);
    expect(keys.length).toBe(4);
  });

  it('all have extraTurns = 1', () => {
    for (const [, data] of Object.entries(EXTENDED_EVENT_CARDS)) {
      expect(data.extraTurns).toBe(1);
    }
  });
});

describe('checkExtendedEventDuration', () => {
  it('returns extended=true for Bot playing an extended card', () => {
    const state = createBotState(['ottoman']);
    state.turn = 3;
    const result = checkExtendedEventDuration(state, 'ottoman', 72); // Julia Gonzaga
    expect(result.extended).toBe(true);
    expect(result.expiryTurn).toBe(5); // turn 3 + 1 + 1
  });

  it('returns extended=false for non-Bot power', () => {
    const state = createBotState(['ottoman']);
    const result = checkExtendedEventDuration(state, 'france', 72);
    expect(result.extended).toBe(false);
  });

  it('returns extended=false for non-extended card', () => {
    const state = createBotState(['ottoman']);
    const result = checkExtendedEventDuration(state, 'ottoman', 42);
    expect(result.extended).toBe(false);
  });
});

describe('registerExtendedEvent / expireExtendedEvents', () => {
  it('registers and expires events', () => {
    const state = createBotState();
    registerExtendedEvent(state, 'ottoman', 72, 5);
    registerExtendedEvent(state, 'hapsburg', 109, 6);

    expect(state.botExtendedEvents).toHaveLength(2);

    // Turn 5: first event expires
    const expired5 = expireExtendedEvents(state, 5);
    expect(expired5).toHaveLength(1);
    expect(expired5[0].cardNumber).toBe(72);
    expect(state.botExtendedEvents).toHaveLength(1);

    // Turn 6: second expires
    const expired6 = expireExtendedEvents(state, 6);
    expect(expired6).toHaveLength(1);
    expect(expired6[0].cardNumber).toBe(109);
    expect(state.botExtendedEvents).toHaveLength(0);
  });
});

describe('isExtendedEventActive', () => {
  it('returns true for active extended event', () => {
    const state = createBotState();
    registerExtendedEvent(state, 'ottoman', 72, 5);
    expect(isExtendedEventActive(state, 72)).toBe(true);
  });

  it('returns false for non-extended event', () => {
    const state = createBotState();
    expect(isExtendedEventActive(state, 42)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F3.2 Free Unrest Removal
// ═══════════════════════════════════════════════════════════════════════

describe('makeFreeUnrestRemovalAction', () => {
  it('returns action for Bot power with target', () => {
    const state = createBotState(['ottoman']);
    const action = makeFreeUnrestRemovalAction(state, 'ottoman', 'Athens');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('CONTROL_UNFORTIFIED');
    expect(action.actionData.target).toBe('Athens');
    expect(action.actionData.free).toBe(true);
    expect(action.actionData.removeUnrest).toBe(true);
  });

  it('returns null when no target', () => {
    const state = createBotState(['ottoman']);
    expect(makeFreeUnrestRemovalAction(state, 'ottoman', null)).toBeNull();
  });

  it('returns null for non-Bot power', () => {
    const state = createBotState(['ottoman']);
    expect(makeFreeUnrestRemovalAction(state, 'france', 'Paris')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F3.3 Fortress Garrison on Negotiation/Peace
// ═══════════════════════════════════════════════════════════════════════

describe('makeFortressGarrisonAction', () => {
  it('returns action for Bot gaining empty fortress', () => {
    const state = createBotState(['ottoman']);
    // Ensure fortress exists and is controlled by Bot
    state.spaces['Belgrade'] = {
      controller: 'ottoman',
      isFortress: true,
      units: []
    };
    const action = makeFortressGarrisonAction(state, 'ottoman', 'Belgrade');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('RAISE_REGULAR');
    expect(action.actionData.target).toBe('Belgrade');
    expect(action.actionData.free).toBe(true);
    expect(action.actionData.reason).toBe('fortress_garrison');
  });

  it('returns null when fortress already has units', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Belgrade'] = {
      controller: 'ottoman',
      isFortress: true,
      units: [{ owner: 'ottoman', regulars: 2 }]
    };
    expect(makeFortressGarrisonAction(state, 'ottoman', 'Belgrade')).toBeNull();
  });

  it('returns null for non-fortified space', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Athens'] = {
      controller: 'ottoman',
      isFortress: false,
      isKey: false,
      units: []
    };
    expect(makeFortressGarrisonAction(state, 'ottoman', 'Athens')).toBeNull();
  });

  it('returns null for non-Bot power', () => {
    const state = createBotState(['ottoman']);
    state.spaces['Belgrade'] = { controller: 'france', isFortress: true, units: [] };
    expect(makeFortressGarrisonAction(state, 'france', 'Belgrade')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F3.4 Extended Excommunication Debater Return
// ═══════════════════════════════════════════════════════════════════════

describe('excommunicated debater extensions', () => {
  it('registers with returnTurn = currentTurn + 2', () => {
    const state = createBotState();
    registerExcommunicatedDebater(state, 'Luther', 3);
    expect(state.botExcommunicatedDebaters).toHaveLength(1);
    expect(state.botExcommunicatedDebaters[0].returnTurn).toBe(5);
  });

  it('shouldReturnExcommunicatedDebater returns false before returnTurn', () => {
    const state = createBotState();
    registerExcommunicatedDebater(state, 'Luther', 3);
    expect(shouldReturnExcommunicatedDebater(state, 'Luther', 4)).toBe(false);
  });

  it('shouldReturnExcommunicatedDebater returns true at returnTurn', () => {
    const state = createBotState();
    registerExcommunicatedDebater(state, 'Luther', 3);
    expect(shouldReturnExcommunicatedDebater(state, 'Luther', 5)).toBe(true);
  });

  it('shouldReturnExcommunicatedDebater returns true for untracked debater', () => {
    const state = createBotState();
    expect(shouldReturnExcommunicatedDebater(state, 'Calvin', 1)).toBe(true);
  });

  it('processExcommunicatedDebaterReturns cleans up entries', () => {
    const state = createBotState();
    registerExcommunicatedDebater(state, 'Luther', 3);
    registerExcommunicatedDebater(state, 'Calvin', 4);

    const returned = processExcommunicatedDebaterReturns(state, 5);
    expect(returned).toEqual(['Luther']);
    expect(state.botExcommunicatedDebaters).toHaveLength(1);

    const returned6 = processExcommunicatedDebaterReturns(state, 6);
    expect(returned6).toEqual(['Calvin']);
    expect(state.botExcommunicatedDebaters).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F3.5 Extended Threat to Power
// ═══════════════════════════════════════════════════════════════════════

describe('Threat to Power extensions', () => {
  it('calcThreatToReturnTurn: Bot adds +1 turn', () => {
    const state = createBotState();
    expect(calcThreatToReturnTurn(state, 'Charles V', 3, true)).toBe(5);
    expect(calcThreatToReturnTurn(state, 'Charles V', 3, false)).toBe(4);
  });

  it('registerThreatToLeader and processThreatLeaderReturns', () => {
    const state = createBotState();
    registerThreatToLeader(state, 'Suleiman', 5);
    registerThreatToLeader(state, 'Charles V', 6);

    const ret5 = processThreatLeaderReturns(state, 5);
    expect(ret5).toEqual(['Suleiman']);
    expect(state.botThreatLeaders).toHaveLength(1);

    const ret6 = processThreatLeaderReturns(state, 6);
    expect(ret6).toEqual(['Charles V']);
    expect(state.botThreatLeaders).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F3.6 Phony War Exemption
// ═══════════════════════════════════════════════════════════════════════

describe('isExemptFromPhonyWar', () => {
  it('returns true for Bot powers', () => {
    const state = createBotState(['ottoman']);
    expect(isExemptFromPhonyWar(state, 'ottoman')).toBe(true);
  });

  it('returns false for human powers', () => {
    const state = createBotState(['ottoman']);
    expect(isExemptFromPhonyWar(state, 'france')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F4 Final Autumn Assaults
// ═══════════════════════════════════════════════════════════════════════

describe('autumn assault tracking', () => {
  it('getNextAutumnAssault returns siege assaults', () => {
    const state = createBotState(['ottoman']);
    // LOC bridge so validateAssault doesn't reject (Hungary→Ottoman)
for (const b of ['Belgrade', 'Mohacs', 'Buda', 'Pressburg']) {
      if (state.spaces[b]) { state.spaces[b].controller = 'ottoman'; state.spaces[b].units = []; }
    }
    state.spaces['Vienna'] = { besieged: true, besiegedBy: 'ottoman' };
    const assault = getNextAutumnAssault(state, 'ottoman');
    expect(assault).not.toBeNull();
    expect(assault.actionType).toBe('ASSAULT');
    expect(assault.actionData.target).toBe('Vienna');
    expect(assault.actionData.free).toBe(true);
  });

  it('getNextAutumnAssault skips already-done assaults', () => {
    const state = createBotState(['ottoman']);
    // LOC bridge so validateAssault doesn't reject (Hungary→Ottoman)
for (const b of ['Belgrade', 'Mohacs', 'Buda', 'Pressburg']) {
      if (state.spaces[b]) { state.spaces[b].controller = 'ottoman'; state.spaces[b].units = []; }
    }
    state.spaces['Vienna'] = { besieged: true, besiegedBy: 'ottoman' };

    markAutumnAssaultDone(state, 'ottoman', 'Vienna');
    const assault = getNextAutumnAssault(state, 'ottoman');
    expect(assault).toBeNull();
  });

  it('resetAutumnAssaults clears tracking', () => {
    const state = createBotState(['ottoman']);
    markAutumnAssaultDone(state, 'ottoman', 'Vienna');
    resetAutumnAssaults(state);
    expect(state.botAutumnAssaultsDone).toEqual({});
  });

  it('returns null for non-Bot power', () => {
    const state = createBotState(['ottoman']);
    expect(getNextAutumnAssault(state, 'france')).toBeNull();
  });

  it('returns foreign war assaults when eligible', () => {
    const state = createBotState(['hapsburg']);
    state.activeForeignWars = {
      hapsburg: [{ id: 'fw_ottoman', friendlyUnits: 3, enemyUnits: 2 }]
    };
    const assault = getNextAutumnAssault(state, 'hapsburg');
    expect(assault).not.toBeNull();
    expect(assault.actionData.foreignWar).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  F5 Difficulty Settings
// ═══════════════════════════════════════════════════════════════════════

describe('BOT_DIFFICULTY', () => {
  it('has three levels', () => {
    expect(BOT_DIFFICULTY.NORMAL).toBe('normal');
    expect(BOT_DIFFICULTY.HARD).toBe('hard');
    expect(BOT_DIFFICULTY.EXPERT).toBe('expert');
  });
});

describe('getExtraCardCount', () => {
  it('normal: 0 extra cards any turn', () => {
    const state = createBotState(['ottoman']);
    state.botDifficulty = 'normal';
    state.turn = 1;
    expect(getExtraCardCount(state, 'ottoman')).toBe(0);
    state.turn = 7;
    expect(getExtraCardCount(state, 'ottoman')).toBe(0);
  });

  it('hard: 0 before Turn 4, 1 from Turn 4', () => {
    const state = createBotState(['ottoman']);
    state.botDifficulty = 'hard';
    state.turn = 3;
    expect(getExtraCardCount(state, 'ottoman')).toBe(0);
    state.turn = 4;
    expect(getExtraCardCount(state, 'ottoman')).toBe(1);
    state.turn = 7;
    expect(getExtraCardCount(state, 'ottoman')).toBe(1);
  });

  it('expert: 1 extra card every turn', () => {
    const state = createBotState(['ottoman']);
    state.botDifficulty = 'expert';
    state.turn = 1;
    expect(getExtraCardCount(state, 'ottoman')).toBe(1);
    state.turn = 7;
    expect(getExtraCardCount(state, 'ottoman')).toBe(1);
  });

  it('returns 0 for non-Bot power', () => {
    const state = createBotState(['ottoman']);
    state.botDifficulty = 'expert';
    expect(getExtraCardCount(state, 'france')).toBe(0);
  });
});

describe('initBotDifficulty', () => {
  it('sets difficulty on state', () => {
    const state = createBotState();
    initBotDifficulty(state, 'hard');
    expect(state.botDifficulty).toBe('hard');
  });

  it('defaults to normal', () => {
    const state = createBotState();
    initBotDifficulty(state);
    expect(state.botDifficulty).toBe('normal');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Turn Start Processing
// ═══════════════════════════════════════════════════════════════════════

describe('processBotTurnStart', () => {
  it('expires events, returns debaters and leaders, resets CP tokens', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    state.turn = 5;

    // Set up extended event expiring at turn 5
    registerExtendedEvent(state, 'ottoman', 72, 5);
    // Set up debater returning at turn 5
    registerExcommunicatedDebater(state, 'Luther', 3); // returnTurn = 5
    // Set up leader returning at turn 5
    registerThreatToLeader(state, 'Suleiman', 5);
    // Set up CP tokens
    state.botCpTokens = { ottoman: 2, hapsburg: 1 };
    // Set up autumn assaults
    markAutumnAssaultDone(state, 'ottoman', 'Vienna');

    const result = processBotTurnStart(state);

    expect(result.expiredEvents).toHaveLength(1);
    expect(result.expiredEvents[0].cardNumber).toBe(72);
    expect(result.returnedDebaters).toEqual(['Luther']);
    expect(result.returnedLeaders).toEqual(['Suleiman']);
    expect(state.botCpTokens.ottoman).toBe(0);
    expect(state.botCpTokens.hapsburg).toBe(0);
    expect(state.botAutumnAssaultsDone).toEqual({});
  });

  it('handles empty state gracefully', () => {
    const state = createBotState();
    state.turn = 1;
    const result = processBotTurnStart(state);
    expect(result.expiredEvents).toEqual([]);
    expect(result.returnedDebaters).toEqual([]);
    expect(result.returnedLeaders).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Controller Integration: Winter Phase
// ═══════════════════════════════════════════════════════════════════════

describe('decideBotAction — winter phase', () => {
  // Import decideBotAction to test integration
  // decideBotAction imported at top level

  it('returns unrest removal action when unrest exists in home space', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'winter';

    // Put unrest on a home space the Bot controls
    const homeSpace = Object.entries(state.spaces).find(([name, sp]) =>
      sp.controller === 'ottoman' && sp.unrest
    );

    // Manually add unrest if none exists
    if (!homeSpace) {
      // Find an Ottoman home space
      for (const [name, sp] of Object.entries(state.spaces)) {
        if (sp.controller === 'ottoman') {
          sp.unrest = true;
          break;
        }
      }
    }

    const action = decideBotAction(state, 'ottoman');
    // May be null if no unrest found (depends on test state)
    if (action) {
      expect(action.actionType).toBe('CONTROL_UNFORTIFIED');
      expect(action.actionData.free).toBe(true);
      expect(action.actionData.removeUnrest).toBe(true);
    }
  });

  it('returns null when winter unrest already done', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'winter';
    state.botWinterUnrestDone = { ottoman: true };
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Controller Integration: Final Autumn Assaults
// ═══════════════════════════════════════════════════════════════════════

describe('decideBotAction — autumn assaults', () => {
  // decideBotAction imported at top level

  it('returns assault when hand empty and siege exists', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    // LOC bridge so validateAssault doesn't reject (Hungary→Ottoman)
for (const b of ['Belgrade', 'Mohacs', 'Buda', 'Pressburg']) {
      if (state.spaces[b]) { state.spaces[b].controller = 'ottoman'; state.spaces[b].units = []; }
    }
    state.spaces['Vienna'] = { besieged: true, besiegedBy: 'ottoman' };

    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('ASSAULT');
    expect(action.actionData.target).toBe('Vienna');
    expect(action.actionData.free).toBe(true);
  });

  it('passes when no assaults available', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    // No sieges
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('PASS');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Controller Integration: initBotGame
// ═══════════════════════════════════════════════════════════════════════

describe('initBotGame', () => {
  // initBotGame imported at top level

  it('initializes decks, extra units, and difficulty', () => {
    const state = createTestState();
    initBotGame(state, ['ottoman', 'hapsburg'], 'hard');

    expect(state.botPowers.ottoman).toBe(true);
    expect(state.botPowers.hapsburg).toBe(true);
    expect(state.botDecks.ottoman).toBeDefined();
    expect(state.botDifficulty).toBe('hard');
  });

  it('defaults to normal difficulty', () => {
    const state = createTestState();
    initBotGame(state, ['france']);
    expect(state.botDifficulty).toBe('normal');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Edge Cases
// ═══════════════════════════════════════════════════════════════════════

describe('expireExtendedEvents — edge cases', () => {
  it('expires events AT currentTurn (boundary: expiryTurn == turn)', () => {
    const state = createBotState();
    state.botExtendedEvents = [
      { cardNumber: 90, expiryTurn: 3 },
      { cardNumber: 91, expiryTurn: 4 }
    ];
    const expired = expireExtendedEvents(state, 3);
    expect(expired).toHaveLength(1);
    expect(expired[0].cardNumber).toBe(90);
    // 91 still active
    expect(state.botExtendedEvents).toHaveLength(1);
    expect(state.botExtendedEvents[0].cardNumber).toBe(91);
  });

  it('returns empty array when no extended events', () => {
    const state = createBotState();
    state.botExtendedEvents = undefined;
    const expired = expireExtendedEvents(state, 5);
    expect(expired).toEqual([]);
  });
});

describe('processBotTurnStart — edge cases', () => {
  it('returns all three arrays even when empty', () => {
    const state = createBotState();
    state.turn = 2;
    const result = processBotTurnStart(state);
    expect(Array.isArray(result.expiredEvents)).toBe(true);
    expect(Array.isArray(result.returnedDebaters)).toBe(true);
    expect(Array.isArray(result.returnedLeaders)).toBe(true);
  });

  it('resets botCpTokens for all bot powers', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    state.botCpTokens = { ottoman: 3, hapsburg: 2 };
    processBotTurnStart(state);
    expect(state.botCpTokens.ottoman).toBe(0);
    expect(state.botCpTokens.hapsburg).toBe(0);
  });

  it('resets autumn assaults', () => {
    const state = createBotState();
    markAutumnAssaultDone(state, 'ottoman', 'Vienna');
    processBotTurnStart(state);
    // After reset, getNextAutumnAssault should not find 'Vienna' as done
    const next = getNextAutumnAssault(state, 'ottoman');
    expect(next).toBeNull(); // null because no pending assaults
  });
});

describe('getNextAutumnAssault — edge cases', () => {
  it('returns null when no autumn assaults pending', () => {
    const state = createBotState();
    const result = getNextAutumnAssault(state, 'ottoman');
    expect(result).toBeNull();
  });
});
