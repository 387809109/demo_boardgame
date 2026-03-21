/**
 * Here I Stand — HISGame Integration Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HISGame, ACTION_TYPES, PHASES } from './index.js';
import { MAJOR_POWERS, IMPULSE_ORDER } from './constants.js';
import { CARD_BY_NUMBER } from './data/cards.js';

const TEST_PLAYERS = [
  { id: 'p1', nickname: 'Alice', isHost: true },
  { id: 'p2', nickname: 'Bob' },
  { id: 'p3', nickname: 'Charlie' },
  { id: 'p4', nickname: 'Diana' },
  { id: 'p5', nickname: 'Eve' },
  { id: 'p6', nickname: 'Frank' }
];

function startGame() {
  const game = new HISGame('offline');
  game.start({ players: TEST_PLAYERS, gameType: 'his', options: {} });
  return game;
}

describe('HISGame', () => {
  // ── Constructor ─────────────────────────────────────────────────

  describe('constructor', () => {
    it('loads config', () => {
      const game = new HISGame('offline');
      expect(game.config).toBeDefined();
      expect(game.config.id).toBe('his');
    });
  });

  // ── Initialize ──────────────────────────────────────────────────

  describe('initialize', () => {
    it('returns valid state', () => {
      const game = startGame();
      const state = game.getState();
      expect(state).toBeDefined();
      expect(state.turn).toBe(1);
    });

    it('starts at Luther 95 phase (interactive)', () => {
      const game = startGame();
      const state = game.getState();
      expect(state.phase).toBe('luther_95');
      expect(state.pendingLuther95).toBeDefined();
      expect(state.activePower).toBe('protestant');
    });

    it('assigns all 6 powers', () => {
      const game = startGame();
      const state = game.getState();
      expect(Object.keys(state.powerByPlayer)).toHaveLength(6);
    });
  });

  // ── processMove — PASS ──────────────────────────────────────────

  describe('processMove — PASS', () => {
    let game;

    beforeEach(() => {
      game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = IMPULSE_ORDER[0];
      state.impulseIndex = 0;
      state.consecutivePasses = 0;
      state.pendingLuther95 = null;
      // Set up hands with non-home, non-mandatory cards for pass tests
      for (const power of MAJOR_POWERS) {
        state.hands[power] = [50]; // Card #50 is a non-home, non-mandatory card
      }
    });

    it('increments consecutivePasses', () => {
      const state = game.getState();
      const result = game.executeMove({
        actionType: ACTION_TYPES.PASS,
        playerId: 'p1'
      });
      expect(result.success).toBe(true);
      expect(game.getState().consecutivePasses).toBe(1);
    });

    it('advances activePower', () => {
      game.executeMove({
        actionType: ACTION_TYPES.PASS,
        playerId: 'p1'
      });
      expect(game.getState().activePower).toBe(IMPULSE_ORDER[1]);
    });

    it('6 consecutive passes end action phase', () => {
      // Clear all hands so every power can pass
      const state = game.getState();
      for (const power of MAJOR_POWERS) {
        state.hands[power] = [];
      }
      for (let i = 0; i < 6; i++) {
        const currentState = game.getState();
        const activePower = currentState.activePower;
        const pid = currentState.playerByPower[activePower];
        const result = game.executeMove({
          actionType: ACTION_TYPES.PASS,
          playerId: pid
        });
        expect(result.success).toBe(true);
      }
      expect(game.getState().phase).not.toBe(PHASES.ACTION);
    });
  });

  // ── processMove — PLAY_CARD_CP ──────────────────────────────────

  describe('processMove — PLAY_CARD_CP', () => {
    let game;

    beforeEach(() => {
      game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = 'ottoman';
      state.impulseIndex = 0;
      state.consecutivePasses = 3;
      state.pendingLuther95 = null;
      // Manually deal cards since card_draw hasn't happened
      if (state.hands.ottoman.length === 0) {
        state.hands.ottoman = [1, 8, 9]; // Home card #1 + others
      }
    });

    it('removes card from hand', () => {
      const state = game.getState();
      const card = state.hands.ottoman[0];
      game.executeMove({
        actionType: ACTION_TYPES.PLAY_CARD_CP,
        actionData: { cardNumber: card },
        playerId: 'p1'
      });
      expect(game.getState().hands.ottoman).not.toContain(card);
    });

    it('resets consecutivePasses', () => {
      const state = game.getState();
      const card = state.hands.ottoman[0];
      game.executeMove({
        actionType: ACTION_TYPES.PLAY_CARD_CP,
        actionData: { cardNumber: card },
        playerId: 'p1'
      });
      expect(game.getState().consecutivePasses).toBe(0);
    });

    it('enters CP mode (does not immediately advance)', () => {
      const state = game.getState();
      const card = state.hands.ottoman[0];
      game.executeMove({
        actionType: ACTION_TYPES.PLAY_CARD_CP,
        actionData: { cardNumber: card },
        playerId: 'p1'
      });
      // Phase 2: card play enters CP mode, does NOT advance impulse
      const newState = game.getState();
      expect(newState.activePower).toBe('ottoman');
      expect(newState.activeCardNumber).toBe(card);
    });

    it('advances after END_IMPULSE', () => {
      const state = game.getState();
      const card = state.hands.ottoman[0];
      game.executeMove({
        actionType: ACTION_TYPES.PLAY_CARD_CP,
        actionData: { cardNumber: card },
        playerId: 'p1'
      });
      game.executeMove({
        actionType: ACTION_TYPES.END_IMPULSE,
        playerId: 'p1'
      });
      expect(game.getState().activePower).toBe(IMPULSE_ORDER[1]);
    });
  });

  // ── validateMove ────────────────────────────────────────────────

  describe('validateMove', () => {
    let game;

    beforeEach(() => {
      game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = 'ottoman';
      state.impulseIndex = 0;
      state.pendingLuther95 = null;
      // Manually deal cards since card_draw hasn't happened
      if (state.hands.ottoman.length === 0) {
        state.hands.ottoman = [1, 8, 9]; // Home card #1 + others
      }
    });

    it('rejects non-assigned player', () => {
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'unknown' },
        game.getState()
      );
      expect(result.valid).toBe(false);
    });

    it('rejects wrong impulse player', () => {
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p2' },
        game.getState()
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('impulse');
    });

    it('rejects pass when home card in hand', () => {
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PASS, playerId: 'p1' },
        game.getState()
      );
      // Ottoman has home card #1 after initialization
      expect(result.valid).toBe(false);
    });

    it('rejects card not in hand', () => {
      const result = game.validateMove(
        {
          actionType: ACTION_TYPES.PLAY_CARD_CP,
          actionData: { cardNumber: 9999 },
          playerId: 'p1'
        },
        game.getState()
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Card not in hand');
    });

    it('allows PHASE_ADVANCE from any player', () => {
      const result = game.validateMove(
        { actionType: ACTION_TYPES.PHASE_ADVANCE, playerId: 'p3' },
        game.getState()
      );
      expect(result.valid).toBe(true);
    });
  });

  // ── checkGameEnd ────────────────────────────────────────────────

  describe('checkGameEnd', () => {
    it('not ended during action phase', () => {
      const game = startGame();
      const result = game.checkGameEnd(game.getState());
      expect(result.ended).toBe(false);
    });

    it('standard victory when VP >= 25', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.VICTORY_DETERMINATION;
      state.vp.ottoman = 25;
      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.winnerPower).toBe('ottoman');
      expect(result.reason).toBe('standard_victory');
    });

    it('domination victory with +5 gap on turn >= 4', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.VICTORY_DETERMINATION;
      state.turn = 4;
      // Set ottoman to 20, all others to 14 or less
      state.vp.ottoman = 20;
      state.vp.hapsburg = 14;
      state.vp.england = 14;
      state.vp.france = 14;
      state.vp.papacy = 15;
      state.vp.protestant = 10;
      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.reason).toBe('domination_victory');
    });

    it('no domination before turn 4', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.VICTORY_DETERMINATION;
      state.turn = 3;
      state.vp.ottoman = 20;
      state.vp.hapsburg = 10;
      state.vp.england = 10;
      state.vp.france = 10;
      state.vp.papacy = 10;
      state.vp.protestant = 10;
      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(false);
    });

    it('time limit after turn 9', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.VICTORY_DETERMINATION;
      state.turn = 9;
      state.vp.ottoman = 20;
      state.vp.papacy = 19;
      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.reason).toBe('time_limit');
    });

    it('rankings sorted by VP', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.VICTORY_DETERMINATION;
      state.vp.ottoman = 25;
      const result = game.checkGameEnd(state);
      expect(result.rankings).toBeDefined();
      expect(result.rankings[0].rank).toBe(1);
      for (let i = 1; i < result.rankings.length; i++) {
        expect(result.rankings[i].vp).toBeLessThanOrEqual(
          result.rankings[i - 1].vp
        );
      }
    });
  });

  // ── getVisibleState ─────────────────────────────────────────────

  describe('getVisibleState', () => {
    it('works through game instance', () => {
      const game = startGame();
      const visible = game.getVisibleState('p1');
      expect(Array.isArray(visible.hands.ottoman)).toBe(true);
      expect(typeof visible.hands.hapsburg).toBe('number');
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('rejects PLAY_CARD_CP during Luther 95 phase', () => {
      const game = startGame();
      // Game starts in luther_95 phase
      expect(game.getState().phase).toBe('luther_95');
      const result = game.executeMove({
        actionType: ACTION_TYPES.PLAY_CARD_CP,
        actionData: { cardNumber: 1 },
        playerId: 'p1'
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Luther 95');
    });

    it('rejects MOVE_FORMATION during Luther 95 phase', () => {
      const game = startGame();
      const result = game.executeMove({
        actionType: ACTION_TYPES.MOVE_FORMATION,
        actionData: { from: 'Istanbul', to: 'Edirne', units: {} },
        playerId: 'p1'
      });
      expect(result.success).toBe(false);
    });

    it('rejects PASS during Luther 95 phase', () => {
      const game = startGame();
      const result = game.executeMove({
        actionType: ACTION_TYPES.PASS,
        playerId: 'p1'
      });
      expect(result.success).toBe(false);
    });

    it('rejects undefined actionType', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = 'ottoman';
      state.pendingLuther95 = null;
      const result = game.executeMove({
        actionType: undefined,
        playerId: 'p1'
      });
      expect(result.success).toBe(false);
    });

    it('consecutivePasses resets after card play then accumulates again', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = 'ottoman';
      state.impulseIndex = 0;
      state.consecutivePasses = 0;
      state.pendingLuther95 = null;
      for (const power of MAJOR_POWERS) {
        state.hands[power] = [50];
      }

      // Ottoman plays card
      state.hands.ottoman = [8, 50];
      game.executeMove({
        actionType: ACTION_TYPES.PLAY_CARD_CP,
        actionData: { cardNumber: 8 },
        playerId: 'p1'
      });
      game.executeMove({
        actionType: ACTION_TYPES.END_IMPULSE,
        playerId: 'p1'
      });
      expect(game.getState().consecutivePasses).toBe(0);

      // Next power passes
      const s2 = game.getState();
      const nextPower = s2.activePower;
      const nextPid = s2.playerByPower[nextPower];
      game.executeMove({
        actionType: ACTION_TYPES.PASS,
        playerId: nextPid
      });
      expect(game.getState().consecutivePasses).toBe(1);
    });

    it('VP tie at time limit — highest VP wins regardless of tie', () => {
      const game = startGame();
      const state = game.getState();
      state.phase = PHASES.VICTORY_DETERMINATION;
      state.turn = 9;
      state.vp.ottoman = 20;
      state.vp.hapsburg = 20;
      state.vp.england = 15;
      state.vp.france = 15;
      state.vp.papacy = 15;
      state.vp.protestant = 10;
      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.reason).toBe('time_limit');
      // Winner should be one of the tied powers
      expect(['ottoman', 'hapsburg']).toContain(result.winnerPower);
    });

    it('getVisibleState for unknown playerId hides all hands', () => {
      const game = startGame();
      const visible = game.getVisibleState('spectator');
      // All hands should be numbers (counts)
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
      }
    });
  });

  // ── Response Card System (S2) ───────────────────────────────────

  describe('Response Card Validation', () => {
    let game;

    function makeActionState() {
      game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = 'ottoman';
      state.impulseIndex = 0;
      state.consecutivePasses = 0;
      state.pendingLuther95 = null;
      return state;
    }

    it('rejects PLAY_RESPONSE_CARD when no pendingResponse', () => {
      const state = makeActionState();
      state.pendingResponse = null;

      const result = game.validateMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p1'
      }, state);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No pending response window');
    });

    it('rejects DECLINE_RESPONSE when no pendingResponse', () => {
      const state = makeActionState();
      state.pendingResponse = null;

      const result = game.validateMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p1'
      }, state);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No pending response window');
    });

    it('rejects PLAY_RESPONSE_CARD when wrong power', () => {
      const state = makeActionState();
      // pendingResponse expects hapsburg (p2), but p1 is ottoman
      state.pendingResponse = {
        window: 'W3',
        respondingPower: 'hapsburg',
        validCards: [24],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };

      const result = game.validateMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p1'  // ottoman, not hapsburg
      }, state);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Not your response window');
    });

    it('rejects DECLINE_RESPONSE when wrong power', () => {
      const state = makeActionState();
      state.pendingResponse = {
        window: 'W3',
        respondingPower: 'hapsburg',
        validCards: [24],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };

      const result = game.validateMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p1'  // ottoman
      }, state);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Not your response window');
    });

    it('rejects PLAY_RESPONSE_CARD with invalid card number', () => {
      const state = makeActionState();
      state.pendingResponse = {
        window: 'W2',
        respondingPower: 'ottoman',
        validCards: [24, 25],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };
      state.hands.ottoman = [24, 25, 50];

      const result = game.validateMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 30 },  // not in validCards
        playerId: 'p1'
      }, state);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid response card');
    });

    it('rejects PLAY_RESPONSE_CARD when card not in hand', () => {
      const state = makeActionState();
      state.pendingResponse = {
        window: 'W2',
        respondingPower: 'ottoman',
        validCards: [24, 25],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };
      // Card 24 is valid but not in hand
      state.hands.ottoman = [50, 51];

      const result = game.validateMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p1'
      }, state);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Card not in hand');
    });

    it('allows non-active power to play PLAY_RESPONSE_CARD', () => {
      const state = makeActionState();
      // Active power is ottoman, but hapsburg (p2) has response window
      state.pendingResponse = {
        window: 'W3',
        respondingPower: 'hapsburg',
        validCards: [24],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };
      state.hands.hapsburg = [24, 50];

      const result = game.validateMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p2'  // hapsburg — not active power (ottoman)
      }, state);

      expect(result.valid).toBe(true);
    });

    it('allows non-active power to play DECLINE_RESPONSE', () => {
      const state = makeActionState();
      state.pendingResponse = {
        window: 'W3',
        respondingPower: 'hapsburg',
        validCards: [24],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };

      const result = game.validateMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p2'
      }, state);

      expect(result.valid).toBe(true);
    });

    it('accepts valid PLAY_RESPONSE_CARD', () => {
      const state = makeActionState();
      state.pendingResponse = {
        window: 'W2',
        respondingPower: 'ottoman',
        validCards: [24, 25],
        context: {
          type: 'field',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        },
        responses: {},
        battleState: {}
      };
      state.hands.ottoman = [24, 50];

      const result = game.validateMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p1'
      }, state);

      expect(result.valid).toBe(true);
    });
  });

  describe('Response Card Battle Flow', () => {
    let game;

    function makeStack(power, regs, mercs = 0, cav = 0, leaders = []) {
      return {
        owner: power, regulars: regs, mercenaries: mercs,
        cavalry: cav, squadrons: 0, corsairs: 0, leaders
      };
    }

    function makeBattleState() {
      game = startGame();
      const state = game.getState();
      state.phase = PHASES.ACTION;
      state.activePower = 'ottoman';
      state.impulseIndex = 0;
      state.consecutivePasses = 0;
      state.pendingLuther95 = null;
      state.cpRemaining = 5;
      state.activeCard = 50;
      state.activeCardNumber = 50;
      return state;
    }

    it('RESOLVE_BATTLE triggers W2 when attacker has combat card', () => {
      const state = makeBattleState();

      // Set up battle
      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0, ['suleiman']),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      // Give attacker a combat card
      state.hands.ottoman = [24, 50];
      state.hands.hapsburg = [52, 53];

      const newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);

      // Battle should have paused — pendingBattle still present
      expect(newState.pendingBattle).not.toBeNull();
      expect(newState.pendingBattle.battleType).toBe('field');
      // Response window should be set for ottoman (attacker)
      expect(newState.pendingResponse).toBeDefined();
      expect(newState.pendingResponse.respondingPower).toBe('ottoman');
      expect(newState.pendingResponse.window).toBe('W2');
    });

    it('full flow: attacker plays card, defender declines, battle executes',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        // Attacker has #24, defender has #25
        state.hands.ottoman = [24, 50];
        state.hands.hapsburg = [25, 53];

        // Step 1: RESOLVE_BATTLE -> opens W2
        let newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W2');
        expect(newState.pendingResponse.respondingPower).toBe('ottoman');

        // Step 2: Attacker plays card #24
        newState = game.processMove({
          actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
          actionData: { cardNumber: 24 },
          playerId: 'p1'
        }, newState);

        // Card removed from hand
        expect(newState.hands.ottoman).not.toContain(24);

        // Should now have W3 for defender (defender has #25)
        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W3');
        expect(newState.pendingResponse.respondingPower).toBe('hapsburg');

        // Step 3: Defender declines
        newState = game.processMove({
          actionType: ACTION_TYPES.DECLINE_RESPONSE,
          actionData: {},
          playerId: 'p2'
        }, newState);

        // Battle should have executed — no more pendingResponse
        expect(newState.pendingResponse).toBeNull();
        // pendingBattle should be cleared (or set to retreat_choice)
        // A field_battle type should no longer be present
        if (newState.pendingBattle) {
          expect(newState.pendingBattle.type).not.toBe('field_battle');
        }

        // Battle event should have been logged
        const battleEvent = newState.eventLog.find(
          e => e.type === 'field_battle'
        );
        expect(battleEvent).toBeDefined();
      });

    it('full flow: both skip -> battle executes immediately', () => {
      const state = makeBattleState();

      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      // No combat cards for either side
      state.hands.ottoman = [50, 51];
      state.hands.hapsburg = [52, 53];

      // RESOLVE_BATTLE should complete synchronously
      const newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);

      // No pending response — battle executed directly
      expect(newState.pendingResponse).toBeNull();
      // pendingBattle cleared or set to retreat
      if (newState.pendingBattle) {
        expect(newState.pendingBattle.type).not.toBe('field_battle');
      }

      // Battle event logged
      const battleEvent = newState.eventLog.find(
        e => e.type === 'field_battle'
      );
      expect(battleEvent).toBeDefined();
    });

    it('RESOLVE_BATTLE skips W2 to W3 when only defender has cards',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        // Only defender has a combat card
        state.hands.ottoman = [50, 51];
        state.hands.hapsburg = [25, 53];

        const newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        // Should jump straight to W3
        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W3');
        expect(newState.pendingResponse.respondingPower).toBe('hapsburg');
      });

    it('attacker declines W2, defender declines W3, battle executes',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        // Both have combat cards
        state.hands.ottoman = [24, 50];
        state.hands.hapsburg = [25, 53];

        // RESOLVE_BATTLE -> W2
        let newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        expect(newState.pendingResponse.window).toBe('W2');

        // Attacker declines
        newState = game.processMove({
          actionType: ACTION_TYPES.DECLINE_RESPONSE,
          actionData: {},
          playerId: 'p1'
        }, newState);

        // Should open W3 for defender
        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W3');
        expect(newState.pendingResponse.respondingPower).toBe('hapsburg');

        // Defender declines
        newState = game.processMove({
          actionType: ACTION_TYPES.DECLINE_RESPONSE,
          actionData: {},
          playerId: 'p2'
        }, newState);

        // Battle executed
        expect(newState.pendingResponse).toBeNull();
        const battleEvent = newState.eventLog.find(
          e => e.type === 'field_battle'
        );
        expect(battleEvent).toBeDefined();
      });

    // ── W1 Mercenary Window Integration Tests ──────────────────

    it('RESOLVE_BATTLE triggers W1 when third party has merc card',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        // Clear all hands, give france #33 (Landsknechts)
        for (const p of Object.keys(state.hands)) {
          state.hands[p] = [50];
        }
        // p4 = france
        state.hands.france = [33, 50];

        const newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        // Battle paused at W1
        expect(newState.pendingBattle).not.toBeNull();
        expect(newState.pendingBattle.lastWindow).toBe('W1');
        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W1');
        expect(newState.pendingResponse.respondingPower).toBe('france');
        expect(newState.pendingResponse.validCards).toContain(33);
      });

    it('full W1 -> W2 -> W3 flow', () => {
      const state = makeBattleState();

      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      // france has merc card, ottoman has combat, hapsburg has combat
      for (const p of Object.keys(state.hands)) {
        state.hands[p] = [50];
      }
      state.hands.france = [33, 50];   // merc card
      state.hands.ottoman = [24, 50];  // combat card
      state.hands.hapsburg = [25, 53]; // combat card

      // Step 1: RESOLVE_BATTLE -> W1 (france)
      let newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);

      expect(newState.pendingResponse.window).toBe('W1');
      expect(newState.pendingResponse.respondingPower).toBe('france');

      // Step 2: France declines W1 merc card
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p4' // france
      }, newState);

      // Should advance to W2 (attacker = ottoman)
      expect(newState.pendingResponse).toBeDefined();
      expect(newState.pendingResponse.window).toBe('W2');
      expect(newState.pendingResponse.respondingPower).toBe('ottoman');

      // Step 3: Ottoman plays combat card #24
      newState = game.processMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p1'
      }, newState);

      // Should advance to W3 (defender = hapsburg)
      expect(newState.pendingResponse).toBeDefined();
      expect(newState.pendingResponse.window).toBe('W3');
      expect(newState.pendingResponse.respondingPower).toBe('hapsburg');

      // Step 4: Hapsburg declines
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p2'
      }, newState);

      // Battle executed
      expect(newState.pendingResponse).toBeNull();
      const battleEvent = newState.eventLog.find(
        e => e.type === 'field_battle'
      );
      expect(battleEvent).toBeDefined();
    });

    it('W1 with multiple responders — both decline, then battle',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        // Two powers have merc cards, no combat cards
        for (const p of Object.keys(state.hands)) {
          state.hands[p] = [50];
        }
        state.hands.england = [33, 50];  // p3
        state.hands.papacy = [36, 50];   // p5

        // Step 1: RESOLVE_BATTLE -> W1 (england first in impulse)
        let newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        expect(newState.pendingResponse.window).toBe('W1');
        expect(newState.pendingResponse.respondingPower).toBe('england');

        // Step 2: England declines
        newState = game.processMove({
          actionType: ACTION_TYPES.DECLINE_RESPONSE,
          actionData: {},
          playerId: 'p3' // england
        }, newState);

        // Should advance to papacy for W1
        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W1');
        expect(newState.pendingResponse.respondingPower).toBe('papacy');

        // Step 3: Papacy declines
        newState = game.processMove({
          actionType: ACTION_TYPES.DECLINE_RESPONSE,
          actionData: {},
          playerId: 'p5' // papacy
        }, newState);

        // No combat cards -> battle executes
        expect(newState.pendingResponse).toBeNull();
        const battleEvent = newState.eventLog.find(
          e => e.type === 'field_battle'
        );
        expect(battleEvent).toBeDefined();
      });

    it('W1 skipped when no merc cards, goes straight to W2', () => {
      const state = makeBattleState();

      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      // No merc cards, attacker has combat card
      for (const p of Object.keys(state.hands)) {
        state.hands[p] = [50];
      }
      state.hands.ottoman = [24, 50]; // combat card

      const newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);

      // Should go straight to W2
      expect(newState.pendingResponse).toBeDefined();
      expect(newState.pendingResponse.window).toBe('W2');
    });

    // ── W7 Impulse Interrupt Window Integration Tests ─────────

    describe('W7 Wartburg Interrupt', () => {
      it('PLAY_CARD_EVENT triggers W7 when Protestant has Wartburg',
        () => {
          const state = makeBattleState();
          state.activePower = 'hapsburg';
          state.lutherPlaced = true;
          // p2 = hapsburg, p6 = protestant
          state.hands.hapsburg = [42, 50]; // card to play as event
          state.hands.protestant = [37, 50]; // Wartburg

          const newState = game.processMove({
            actionType: ACTION_TYPES.PLAY_CARD_EVENT,
            actionData: { cardNumber: 42 },
            playerId: 'p2' // hapsburg
          }, state);

          // Should have W7 response window for protestant
          expect(newState.pendingResponse).toBeDefined();
          expect(newState.pendingResponse.window).toBe('W7');
          expect(newState.pendingResponse.respondingPower)
            .toBe('protestant');
          expect(newState.pendingResponse.validCards).toContain(37);
          // Pending event should be stored
          expect(newState.pendingEventPlay).toBeDefined();
          expect(newState.pendingEventPlay.cardNumber).toBe(42);
          expect(newState.pendingEventPlay.power).toBe('hapsburg');
        });

      it('Protestant plays Wartburg -> event cancelled, impulse advances',
        () => {
          const state = makeBattleState();
          state.activePower = 'hapsburg';
          state.impulseIndex = 1; // hapsburg is index 1
          state.lutherPlaced = true;
          state.hands.hapsburg = [42, 50];
          state.hands.protestant = [37, 50];

          // Step 1: Hapsburg plays event -> W7 opens
          let newState = game.processMove({
            actionType: ACTION_TYPES.PLAY_CARD_EVENT,
            actionData: { cardNumber: 42 },
            playerId: 'p2'
          }, state);

          expect(newState.pendingResponse.window).toBe('W7');

          // Step 2: Protestant plays Wartburg (#37)
          newState = game.processMove({
            actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
            actionData: { cardNumber: 37 },
            playerId: 'p6' // protestant
          }, newState);

          // Event should be cancelled
          expect(newState.pendingResponse).toBeNull();
          expect(newState.pendingEventPlay).toBeNull();
          // Wartburg removed from hand
          expect(newState.hands.protestant).not.toContain(37);
          // Should have logged cancellation
          const cancelLog = newState.eventLog.find(
            e => e.type === 'event_cancelled_by_wartburg'
          );
          expect(cancelLog).toBeDefined();
          expect(cancelLog.data.cancelledCard).toBe(42);
          // Impulse should have advanced
          expect(newState.activePower).not.toBe('hapsburg');
        });

      it('Protestant declines Wartburg -> event executes normally',
        () => {
          const state = makeBattleState();
          state.activePower = 'hapsburg';
          state.lutherPlaced = true;
          state.hands.hapsburg = [42, 50];
          state.hands.protestant = [37, 50];

          // Step 1: Hapsburg plays event -> W7 opens
          let newState = game.processMove({
            actionType: ACTION_TYPES.PLAY_CARD_EVENT,
            actionData: { cardNumber: 42 },
            playerId: 'p2'
          }, state);

          expect(newState.pendingResponse.window).toBe('W7');

          // Step 2: Protestant declines
          newState = game.processMove({
            actionType: ACTION_TYPES.DECLINE_RESPONSE,
            actionData: {},
            playerId: 'p6'
          }, newState);

          // Event should have executed
          expect(newState.pendingResponse).toBeNull();
          expect(newState.pendingEventPlay).toBeNull();
          // Wartburg still in hand
          expect(newState.hands.protestant).toContain(37);
          // Should have logged the event execution
          const eventLog = newState.eventLog.find(
            e => e.type === 'play_card_event'
              && e.data.cardNumber === 42
          );
          expect(eventLog).toBeDefined();
        });

      it('no W7 when Luther is dead', () => {
        const state = makeBattleState();
        state.activePower = 'hapsburg';
        state.lutherPlaced = false; // Luther is dead
        state.hands.hapsburg = [42, 50];
        state.hands.protestant = [37, 50];

        const newState = game.processMove({
          actionType: ACTION_TYPES.PLAY_CARD_EVENT,
          actionData: { cardNumber: 42 },
          playerId: 'p2'
        }, state);

        // No W7 window — event should execute immediately
        expect(newState.pendingResponse).toBeNull();
        // No pending event (it executed)
        expect(newState.pendingEventPlay).toBeFalsy();
      });

      it('no W7 when Protestant is the active power', () => {
        const state = makeBattleState();
        state.activePower = 'protestant';
        state.lutherPlaced = true;
        state.hands.protestant = [37, 42, 50];

        const newState = game.processMove({
          actionType: ACTION_TYPES.PLAY_CARD_EVENT,
          actionData: { cardNumber: 42 },
          playerId: 'p6' // protestant
        }, state);

        // Protestant can't interrupt their own event
        expect(newState.pendingResponse).toBeNull();
        expect(newState.pendingEventPlay).toBeFalsy();
      });

      it('no W7 when Protestant lacks Wartburg', () => {
        const state = makeBattleState();
        state.activePower = 'hapsburg';
        state.lutherPlaced = true;
        state.hands.hapsburg = [42, 50];
        state.hands.protestant = [50, 51]; // No Wartburg

        const newState = game.processMove({
          actionType: ACTION_TYPES.PLAY_CARD_EVENT,
          actionData: { cardNumber: 42 },
          playerId: 'p2'
        }, state);

        // No W7 — event executes
        expect(newState.pendingResponse).toBeNull();
        expect(newState.pendingEventPlay).toBeFalsy();
      });

      it('validates that non-responding power cannot play in W7',
        () => {
          const state = makeBattleState();
          state.activePower = 'hapsburg';
          state.lutherPlaced = true;
          state.hands.hapsburg = [42, 50];
          state.hands.protestant = [37, 50];

          // Trigger W7
          let newState = game.processMove({
            actionType: ACTION_TYPES.PLAY_CARD_EVENT,
            actionData: { cardNumber: 42 },
            playerId: 'p2'
          }, state);

          expect(newState.pendingResponse.window).toBe('W7');

          // Ottoman (p1) tries to play response — should be rejected
          const result = game.validateMove({
            actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
            actionData: { cardNumber: 37 },
            playerId: 'p1'
          }, newState);

          expect(result.valid).toBe(false);
          expect(result.error).toBe('Not your response window');
        });
    });

    // ── W4 Janissaries Post-Roll Window Integration Tests ─────

    it('field battle pauses at W4 when Ottoman has Janissaries (#1)',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        // Ottoman has Janissaries, no combat cards for W2/W3
        for (const p of Object.keys(state.hands)) {
          state.hands[p] = [50];
        }
        state.hands.ottoman = [1, 50]; // Janissaries

        // RESOLVE_BATTLE -> should go through to execute, pause at W4
        const newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        // Battle paused at W4
        expect(newState.pendingBattle).not.toBeNull();
        expect(newState.pendingBattle.lastWindow).toBe('W4');
        expect(newState.pendingResponse).toBeDefined();
        expect(newState.pendingResponse.window).toBe('W4');
        expect(newState.pendingResponse.respondingPower).toBe('ottoman');
        expect(newState.pendingResponse.validCards).toContain(1);
      });

    it('Ottoman declines W4, battle finalizes', () => {
      const state = makeBattleState();

      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      for (const p of Object.keys(state.hands)) {
        state.hands[p] = [50];
      }
      state.hands.ottoman = [1, 50];

      // Step 1: RESOLVE_BATTLE -> W4
      let newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);

      expect(newState.pendingResponse.window).toBe('W4');

      // Step 2: Ottoman declines W4
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p1' // ottoman
      }, newState);

      // Battle executed
      expect(newState.pendingResponse).toBeNull();
      const battleEvent = newState.eventLog.find(
        e => e.type === 'field_battle'
      );
      expect(battleEvent).toBeDefined();
    });

    it('Ottoman plays Janissaries at W4, battle finalizes with bonus',
      () => {
        const state = makeBattleState();

        state.spaces['Edirne'].units = [
          makeStack('ottoman', 5, 0, 0, ['suleiman']),
          makeStack('hapsburg', 3, 0, 0)
        ];
        state.pendingBattle = {
          type: 'field_battle',
          space: 'Edirne',
          attackerPower: 'ottoman',
          defenderPower: 'hapsburg'
        };

        for (const p of Object.keys(state.hands)) {
          state.hands[p] = [50];
        }
        state.hands.ottoman = [1, 50];

        // Step 1: RESOLVE_BATTLE -> W4
        let newState = game.processMove({
          actionType: ACTION_TYPES.RESOLVE_BATTLE,
          actionData: {},
          playerId: 'p1'
        }, state);

        expect(newState.pendingResponse.window).toBe('W4');

        // Step 2: Ottoman plays Janissaries
        newState = game.processMove({
          actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
          actionData: { cardNumber: 1, mode: 'combat' },
          playerId: 'p1'
        }, newState);

        // Battle executed
        expect(newState.pendingResponse).toBeNull();
        const battleEvent = newState.eventLog.find(
          e => e.type === 'field_battle'
        );
        expect(battleEvent).toBeDefined();
        // Janissaries card removed from hand
        expect(newState.hands.ottoman).not.toContain(1);
      });

    it('full flow: W2 -> W3 -> execute -> W4 -> finalize', () => {
      const state = makeBattleState();

      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0, ['suleiman']),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      // Ottoman has combat card + Janissaries, Hapsburg has combat card
      for (const p of Object.keys(state.hands)) {
        state.hands[p] = [50];
      }
      state.hands.ottoman = [24, 1, 50]; // Arquebusiers + Janissaries
      state.hands.hapsburg = [25, 53]; // Field Artillery

      // Step 1: RESOLVE_BATTLE -> W2 (attacker = ottoman)
      let newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);

      expect(newState.pendingResponse.window).toBe('W2');
      expect(newState.pendingResponse.respondingPower).toBe('ottoman');

      // Step 2: Ottoman plays #24 Arquebusiers in W2
      newState = game.processMove({
        actionType: ACTION_TYPES.PLAY_RESPONSE_CARD,
        actionData: { cardNumber: 24 },
        playerId: 'p1'
      }, newState);

      // Should advance to W3
      expect(newState.pendingResponse).toBeDefined();
      expect(newState.pendingResponse.window).toBe('W3');
      expect(newState.pendingResponse.respondingPower).toBe('hapsburg');

      // Step 3: Hapsburg declines W3
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p2'
      }, newState);

      // Should execute and pause at W4 (Ottoman still has #1)
      expect(newState.pendingResponse).toBeDefined();
      expect(newState.pendingResponse.window).toBe('W4');
      expect(newState.pendingResponse.respondingPower).toBe('ottoman');

      // Step 4: Ottoman declines W4
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p1'
      }, newState);

      // Battle finalized
      expect(newState.pendingResponse).toBeNull();
      const battleEvent = newState.eventLog.find(
        e => e.type === 'field_battle'
      );
      expect(battleEvent).toBeDefined();
    });

    it('W4 not triggered when Ottoman lacks #1 after W2/W3', () => {
      const state = makeBattleState();

      state.spaces['Edirne'].units = [
        makeStack('ottoman', 5, 0, 0),
        makeStack('hapsburg', 3, 0, 0)
      ];
      state.pendingBattle = {
        type: 'field_battle',
        space: 'Edirne',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      };

      // Ottoman has combat card but no #1
      for (const p of Object.keys(state.hands)) {
        state.hands[p] = [50];
      }
      state.hands.ottoman = [24, 50]; // Arquebusiers only, no Janissaries
      state.hands.hapsburg = [25, 53];

      // Step 1: W2
      let newState = game.processMove({
        actionType: ACTION_TYPES.RESOLVE_BATTLE,
        actionData: {},
        playerId: 'p1'
      }, state);
      expect(newState.pendingResponse.window).toBe('W2');

      // Step 2: Ottoman declines W2
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p1'
      }, newState);

      // Step 3: W3
      expect(newState.pendingResponse.window).toBe('W3');

      // Step 4: Hapsburg declines W3
      newState = game.processMove({
        actionType: ACTION_TYPES.DECLINE_RESPONSE,
        actionData: {},
        playerId: 'p2'
      }, newState);

      // Battle executed (no W4 pause since Ottoman lacks #1)
      expect(newState.pendingResponse).toBeNull();
      const battleEvent = newState.eventLog.find(
        e => e.type === 'field_battle'
      );
      expect(battleEvent).toBeDefined();
    });
  });
});
