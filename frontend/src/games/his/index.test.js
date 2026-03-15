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
});
