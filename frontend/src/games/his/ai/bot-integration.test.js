/**
 * Here I Stand — Bot Integration Tests (Phase F1)
 *
 * Tests the full Bot decision loop:
 *   - All 6 phases produce valid actions
 *   - No infinite loops when cycling through goals
 *   - Multi-power turn cycling
 *   - Edge cases: empty hands, no targets, all goals exhausted
 *   - Turn start/end housekeeping
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import {
  isBotPower, getBotPowers, botPlayerId,
  initBotDecks, placeBotExtraUnits, decideBotAction,
  initBotGame, scheduleBotAction
} from './bot-controller.js';
import { revealBehaviorCard, getActiveBehaviorCard } from './behavior-cards.js';
import { processBotTurnStart, resetAutumnAssaults } from './bot-rules.js';
import { PHASES } from '../phases/phase-manager.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createFullBotState() {
  const state = createTestState();
  const allPowers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
  initBotGame(state, allPowers, 'normal');
  return state;
}

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  return state;
}

// ═══════════════════════════════════════════════════════════════════════
//  Full 6-Bot State
// ═══════════════════════════════════════════════════════════════════════

describe('Full 6-Bot initialization', () => {
  it('all 6 powers are Bot-controlled', () => {
    const state = createFullBotState();
    const bots = getBotPowers(state);
    expect(bots).toHaveLength(6);
  });

  it('each Bot has a deck', () => {
    const state = createFullBotState();
    for (const power of getBotPowers(state)) {
      expect(state.botDecks[power]).toBeDefined();
      expect(state.botDecks[power].drawPile.length).toBeGreaterThan(0);
    }
  });

  it('difficulty defaults to normal', () => {
    const state = createFullBotState();
    expect(state.botDifficulty).toBe('normal');
  });

  it('extra units are placed for all Bot powers', () => {
    const state = createFullBotState();
    // Ottoman should have extra unit in Athens
    const athens = state.spaces['Athens'];
    expect(athens).toBeDefined();
    const ottStack = athens.units?.find(u => u.owner === 'ottoman');
    expect(ottStack).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Phase-by-Phase Decision Tests
// ═══════════════════════════════════════════════════════════════════════

describe('Bot decisions across all phases', () => {
  it('returns non-null action for Bot in Luther 95 phase', () => {
    const state = createBotState(['protestant']);
    state.phase = PHASES.LUTHER_95;
    state.luther95 = { remaining: 3, targets: ['Erfurt', 'Leipzig'] };
    const action = decideBotAction(state, 'protestant');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('SELECT_LUTHER95_TARGET');
  });

  it('returns null for card_draw (automatic)', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.CARD_DRAW;
    expect(decideBotAction(state, 'ottoman')).toBeNull();
  });

  it('returns PASS for diplomacy', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.DIPLOMACY;
    const action = decideBotAction(state, 'ottoman');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('PASS');
  });

  it('returns SUBMIT_DIET_CARD for diet_of_worms', () => {
    const state = createBotState(['papacy']);
    state.phase = PHASES.DIET_OF_WORMS;
    state.pendingDietOfWorms = {
      cards: { protestant: null, hapsburg: null, papacy: null }
    };
    state.hands.papacy = [5, 42, 60];
    const action = decideBotAction(state, 'papacy');
    expect(action.actionType).toBe('SUBMIT_DIET_CARD');
  });

  it('returns action for spring_deployment', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.SPRING_DEPLOYMENT;
    state.activePower = 'ottoman';
    const action = decideBotAction(state, 'ottoman');
    expect(action).not.toBeNull();
  });

  it('returns action for action phase with cards in hand', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [42]; // Roxelana
    const action = decideBotAction(state, 'ottoman');
    expect(action).not.toBeNull();
  });

  it('returns PASS for action phase with empty hand', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('PASS');
  });

  it('returns null for victory_determination', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.VICTORY_DETERMINATION;
    expect(decideBotAction(state, 'ottoman')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Infinite Loop Prevention
// ═══════════════════════════════════════════════════════════════════════

describe('infinite loop prevention', () => {
  it('Bot always terminates with PASS when no cards and no CPs', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    state.botSetAside = { ottoman: [] };

    // Run decision loop multiple times — should always get PASS
    for (let i = 0; i < 10; i++) {
      const action = decideBotAction(state, 'ottoman');
      expect(action).not.toBeNull();
      expect(action.actionType).toBe('PASS');
    }
  });

  it('multiple Bot powers all get decisions in diplomacy', () => {
    const state = createFullBotState();
    state.phase = PHASES.DIPLOMACY;

    for (const power of getBotPowers(state)) {
      const action = decideBotAction(state, power);
      expect(action).not.toBeNull();
    }
  });

  it('non-active Bot returns null in action phase', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    expect(decideBotAction(state, 'hapsburg')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Turn Start Processing
// ═══════════════════════════════════════════════════════════════════════

describe('turn start processing', () => {
  it('resets CP tokens for all Bot powers', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    state.turn = 2;
    state.botCpTokens = { ottoman: 3, hapsburg: 1 };

    processBotTurnStart(state);

    expect(state.botCpTokens.ottoman).toBe(0);
    expect(state.botCpTokens.hapsburg).toBe(0);
  });

  it('resets autumn assault tracking', () => {
    const state = createBotState(['ottoman']);
    state.turn = 2;
    state.botAutumnAssaultsDone = { ottoman: ['Vienna'] };

    processBotTurnStart(state);
    expect(state.botAutumnAssaultsDone).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Autumn Assaults in Action Phase
// ═══════════════════════════════════════════════════════════════════════

describe('autumn assaults in action phase', () => {
  it('returns free assault when hand empty but siege exists', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    state.spaces['Vienna'] = { siege: { besieger: 'ottoman' } };

    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('ASSAULT');
    expect(action.actionData.target).toBe('Vienna');
    expect(action.actionData.free).toBe(true);
  });

  it('multiple siege targets are iterated', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    state.spaces['Vienna'] = { siege: { besieger: 'ottoman' } };
    state.spaces['Prague'] = { siege: { besieger: 'ottoman' } };

    // First call returns one assault
    const action1 = decideBotAction(state, 'ottoman');
    expect(action1.actionType).toBe('ASSAULT');
    const target1 = action1.actionData.target;

    // Second call should return the other siege target
    const action2 = decideBotAction(state, 'ottoman');
    expect(action2.actionType).toBe('ASSAULT');
    const target2 = action2.actionData.target;
    expect(target2).not.toBe(target1);

    // Third call: all done → PASS
    const action3 = decideBotAction(state, 'ottoman');
    expect(action3.actionType).toBe('PASS');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Winter Phase Integration
// ═══════════════════════════════════════════════════════════════════════

describe('winter phase integration', () => {
  it('returns null when no unrest exists', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.WINTER;
    // No unrest on any space
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });

  it('returns null when winter unrest already done', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.WINTER;
    state.botWinterUnrestDone = { ottoman: true };
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Response Windows
// ═══════════════════════════════════════════════════════════════════════

describe('response window handling', () => {
  it('non-responding Bot returns null', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.pendingResponse = { respondingPower: 'france' };
    // France is not a Bot → should return null
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });

  it('responding Bot gets action', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.pendingResponse = { respondingPower: 'hapsburg' };
    const action = decideBotAction(state, 'hapsburg');
    // Should return some response action (decline if no cards set aside)
    expect(action).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Battle / Interception Delegation
// ═══════════════════════════════════════════════════════════════════════

describe('battle delegation', () => {
  it('delegates pendingBattle to bot-combat', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.pendingBattle = { type: 'land', space: 'Vienna' };
    const action = decideBotAction(state, 'ottoman');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('RESOLVE_BATTLE');
  });

  it('delegates pendingInterception to bot-combat', () => {
    const state = createBotState(['ottoman']);
    state.phase = PHASES.ACTION;
    state.activePower = 'ottoman';
    state.pendingInterception = { targetSpace: 'Vienna' };
    const action = decideBotAction(state, 'ottoman');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('RESOLVE_INTERCEPTION');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Bot Player ID
// ═══════════════════════════════════════════════════════════════════════

describe('botPlayerId', () => {
  it('formats as bot_<power>', () => {
    expect(botPlayerId('ottoman')).toBe('bot_ottoman');
    expect(botPlayerId('papacy')).toBe('bot_papacy');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  Simulated Multi-Turn Sequence
// ═══════════════════════════════════════════════════════════════════════

describe('simulated multi-turn sequence', () => {
  it('processes 3 turns of diplomacy+action without crash', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    const actions = [];

    for (let turn = 1; turn <= 3; turn++) {
      state.turn = turn;
      processBotTurnStart(state);

      // Diplomacy phase
      state.phase = PHASES.DIPLOMACY;
      for (const power of getBotPowers(state)) {
        const action = decideBotAction(state, power);
        if (action) actions.push({ turn, phase: 'diplomacy', power, action });
      }

      // Action phase — each power takes one impulse
      state.phase = PHASES.ACTION;
      for (const power of getBotPowers(state)) {
        state.activePower = power;
        state.cpRemaining = 0;
        state.hands[power] = state.hands[power] || [];
        const action = decideBotAction(state, power);
        if (action) actions.push({ turn, phase: 'action', power, action });
      }
    }

    // Should have produced actions without errors
    expect(actions.length).toBeGreaterThan(0);
    // All actions should have valid actionType
    for (const { action } of actions) {
      expect(typeof action.actionType).toBe('string');
      expect(action.actionType.length).toBeGreaterThan(0);
    }
  });
});
