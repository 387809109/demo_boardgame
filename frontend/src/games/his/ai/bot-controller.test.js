/**
 * Here I Stand — Bot Controller Tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestState } from '../test-helpers.js';
import {
  isBotPower, getBotPowers, botPlayerId,
  initBotDecks, placeBotExtraUnits,
  decideBotAction
} from './bot-controller.js';
import { CARD_BY_ID } from './behavior-cards.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  return state;
}

// ── Bot Identification ──────────────────────────────────────────────

describe('isBotPower', () => {
  it('returns true for Bot powers', () => {
    const state = createBotState(['ottoman']);
    expect(isBotPower(state, 'ottoman')).toBe(true);
  });

  it('returns false for non-Bot powers', () => {
    const state = createBotState(['ottoman']);
    expect(isBotPower(state, 'hapsburg')).toBe(false);
  });

  it('returns false when no botPowers in state', () => {
    const state = createTestState();
    expect(isBotPower(state, 'ottoman')).toBe(false);
  });
});

describe('getBotPowers', () => {
  it('returns all Bot powers in MAJOR_POWERS order', () => {
    const state = createBotState(['france', 'ottoman']);
    const bots = getBotPowers(state);
    expect(bots).toEqual(['ottoman', 'france']);
  });

  it('returns empty array when no bots', () => {
    const state = createTestState();
    expect(getBotPowers(state)).toEqual([]);
  });
});

describe('botPlayerId', () => {
  it('generates bot_<power> format', () => {
    expect(botPlayerId('ottoman')).toBe('bot_ottoman');
    expect(botPlayerId('papacy')).toBe('bot_papacy');
  });
});

// ── Bot Deck Initialization ─────────────────────────────────────────

describe('initBotDecks', () => {
  it('creates botDecks and botPowers on state', () => {
    const state = createTestState();
    initBotDecks(state, ['ottoman', 'england']);
    expect(state.botPowers.ottoman).toBe(true);
    expect(state.botPowers.england).toBe(true);
    expect(state.botDecks.ottoman).toBeDefined();
    expect(state.botDecks.england).toBeDefined();
  });

  it('each deck has drawPile, faceUp, goodwill', () => {
    const state = createBotState(['france']);
    const deck = state.botDecks.france;
    expect(deck.drawPile).toHaveLength(6);
    expect(deck.faceUp).toHaveLength(0);
    expect(deck.goodwill).toHaveLength(2);
  });

  it('Protestant deck has specific Goodwill cards', () => {
    const state = createBotState(['protestant']);
    const deck = state.botDecks.protestant;
    expect(deck.goodwill).toContain('protestant_preventative_war');
    expect(deck.goodwill).toContain('protestant_die_by_the_sword');
  });

  it('all deck card IDs are valid', () => {
    const state = createBotState(['hapsburg']);
    const deck = state.botDecks.hapsburg;
    const allIds = [...deck.drawPile, ...deck.goodwill];
    for (const id of allIds) {
      expect(CARD_BY_ID[id]).toBeDefined();
      expect(CARD_BY_ID[id].power).toBe('hapsburg');
    }
  });
});

// ── Bot Extra Units ─────────────────────────────────────────────────

describe('placeBotExtraUnits', () => {
  it('adds a regular unit to the specified space', () => {
    const state = createBotState(['ottoman']);
    // Clear Athens units first
    if (state.spaces['Athens']) {
      state.spaces['Athens'].units = [];
    }
    placeBotExtraUnits(state);

    const athens = state.spaces['Athens'];
    expect(athens).toBeDefined();
    const ottomanStack = athens.units.find(u => u.owner === 'ottoman');
    expect(ottomanStack).toBeDefined();
    expect(ottomanStack.regulars).toBeGreaterThanOrEqual(1);
  });

  it('merges into existing stack', () => {
    const state = createBotState(['hapsburg']);
    // Pre-place a stack in Barcelona
    if (state.spaces['Barcelona']) {
      state.spaces['Barcelona'].units = [{
        owner: 'hapsburg', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];
    }
    placeBotExtraUnits(state);
    const stack = state.spaces['Barcelona'].units.find(u => u.owner === 'hapsburg');
    expect(stack.regulars).toBe(3); // 2 + 1
  });

  it('only places for Bot powers, not human powers', () => {
    const state = createBotState(['ottoman']);
    // Clear both Athens and Barcelona
    if (state.spaces['Athens']) state.spaces['Athens'].units = [];
    if (state.spaces['Barcelona']) state.spaces['Barcelona'].units = [];

    placeBotExtraUnits(state);

    // Ottoman (Bot) should have unit in Athens
    const athensOtt = state.spaces['Athens']?.units?.find(u => u.owner === 'ottoman');
    expect(athensOtt).toBeDefined();

    // Hapsburg (not Bot) should NOT have extra unit in Barcelona
    const barcHap = state.spaces['Barcelona']?.units?.find(u => u.owner === 'hapsburg');
    expect(barcHap).toBeUndefined();
  });
});

// ── decideBotAction ─────────────────────────────────────────────────

describe('decideBotAction', () => {
  it('returns null for non-Bot power', () => {
    const state = createBotState(['ottoman']);
    const action = decideBotAction(state, 'hapsburg');
    expect(action).toBeNull();
  });

  it('returns an action for Bot power in luther_95 phase', () => {
    const state = createBotState(['protestant']);
    state.phase = 'luther_95';
    state.luther95 = {
      remaining: 3,
      targets: ['Erfurt', 'Leipzig', 'Magdeburg']
    };
    const action = decideBotAction(state, 'protestant');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('SELECT_LUTHER95_TARGET');
    expect(action.actionData.targetSpace).toBe('Erfurt');
  });

  it('returns PHASE_ADVANCE when luther_95 is complete', () => {
    const state = createBotState(['protestant']);
    state.phase = 'luther_95';
    state.luther95 = { remaining: 0, targets: [] };
    const action = decideBotAction(state, 'protestant');
    expect(action.actionType).toBe('PHASE_ADVANCE');
  });

  it('returns PASS for diplomacy phase (stub)', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'diplomacy';
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('PASS');
  });

  it('returns null for card_draw phase (automatic)', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'card_draw';
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });

  it('returns SUBMIT_DIET_CARD for diet_of_worms', () => {
    const state = createBotState(['papacy']);
    state.phase = 'diet_of_worms';
    state.pendingDietOfWorms = {
      cards: { protestant: null, hapsburg: null, papacy: null }
    };
    state.hands.papacy = [5, 42, 60];
    const action = decideBotAction(state, 'papacy');
    expect(action.actionType).toBe('SUBMIT_DIET_CARD');
    expect(action.actionData.cardNumber).toBe(5);
  });

  it('returns null for diet when already submitted', () => {
    const state = createBotState(['papacy']);
    state.phase = 'diet_of_worms';
    state.pendingDietOfWorms = {
      cards: { protestant: null, hapsburg: null, papacy: 5 }
    };
    const action = decideBotAction(state, 'papacy');
    expect(action).toBeNull();
  });

  it('returns PASS for spring_deployment (stub)', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'spring_deployment';
    state.activePower = 'ottoman';
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('PASS');
  });

  it('returns null for spring_deployment when not active power', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'spring_deployment';
    state.activePower = 'hapsburg';
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });
});

describe('decideBotAction — action phase', () => {
  it('plays card for event or CP based on §5 criteria', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    // Card 42 = Roxelana, Ottoman always plays as event
    state.hands.ottoman = [42, 50];
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('PLAY_CARD_EVENT');
    expect(action.actionData.cardNumber).toBe(42);
  });

  it('passes when hand is empty', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.cpRemaining = 0;
    state.hands.ottoman = [];
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('PASS');
  });

  it('ends impulse when in CP mode (stub)', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.cpRemaining = 3;
    const action = decideBotAction(state, 'ottoman');
    expect(action.actionType).toBe('END_IMPULSE');
  });

  it('declines response when Bot is responding', () => {
    const state = createBotState(['hapsburg']);
    state.phase = 'action';
    state.activePower = 'ottoman';
    state.pendingResponse = {
      respondingPower: 'hapsburg',
      validCards: [2]
    };
    const action = decideBotAction(state, 'hapsburg');
    expect(action.actionType).toBe('DECLINE_RESPONSE');
  });

  it('returns null for action phase when not active power', () => {
    const state = createBotState(['ottoman']);
    state.phase = 'action';
    state.activePower = 'hapsburg';
    state.cpRemaining = 0;
    const action = decideBotAction(state, 'ottoman');
    expect(action).toBeNull();
  });
});

// ── HISGame Integration ─────────────────────────────────────────────

describe('HISGame with Bot initialization', () => {
  let HISGame;

  beforeAll(async () => {
    const mod = await import('../index.js');
    HISGame = mod.default || mod.HISGame;
  });

  it('initializes with bot powers', () => {
    const game = new HISGame('offline');
    game.start({
      gameType: 'his',
      players: [
        { id: 'p1', nickname: 'Human', isHost: true }
      ],
      options: {
        botPowers: ['ottoman', 'hapsburg', 'england', 'france', 'papacy'],
        powerAssignment: [
          ['protestant'],
          ['ottoman'],
          ['hapsburg'],
          ['england'],
          ['france'],
          ['papacy']
        ]
      }
    });

    const state = game.getState();
    expect(state.botPowers.ottoman).toBe(true);
    expect(state.botPowers.hapsburg).toBe(true);
    expect(state.botPowers.protestant).toBeUndefined();
    expect(state.botDecks.ottoman).toBeDefined();
    expect(state.botDecks.ottoman.drawPile).toHaveLength(6);
  });

  it('places extra Bot units at start', () => {
    const game = new HISGame('offline');
    game.start({
      gameType: 'his',
      players: [
        { id: 'p1', nickname: 'Human', isHost: true }
      ],
      options: {
        botPowers: ['ottoman'],
        powerAssignment: [
          ['protestant'],
          ['ottoman'],
          ['hapsburg'],
          ['england'],
          ['france'],
          ['papacy']
        ]
      }
    });

    const state = game.getState();
    const athens = state.spaces['Athens'];
    expect(athens).toBeDefined();
    // Should have Ottoman units (original + extra bot unit)
    const ottStack = athens.units.find(u => u.owner === 'ottoman');
    expect(ottStack).toBeDefined();
    // At least 1 regular from bot setup
    expect(ottStack.regulars).toBeGreaterThanOrEqual(1);
  });

  it('registers bot player IDs in state mappings', () => {
    const game = new HISGame('offline');
    game.start({
      gameType: 'his',
      players: [
        { id: 'p1', nickname: 'Human', isHost: true }
      ],
      options: {
        botPowers: ['ottoman'],
        powerAssignment: [
          ['protestant'],
          ['ottoman'],
          ['hapsburg'],
          ['england'],
          ['france'],
          ['papacy']
        ]
      }
    });

    const state = game.getState();
    expect(state.playerByPower.ottoman).toBe('bot_ottoman');
    expect(state.powerByPlayer['bot_ottoman']).toBe('ottoman');
    expect(state.powersForPlayer['bot_ottoman']).toEqual(['ottoman']);
  });
});
