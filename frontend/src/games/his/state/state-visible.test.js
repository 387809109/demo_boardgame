/**
 * Here I Stand — state-visible.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { getVisibleState } from './state-visible.js';
import { MAJOR_POWERS } from '../constants.js';
import { createStateAfterDraw } from '../test-helpers.js';

describe('getVisibleState', () => {
  const fullState = createStateAfterDraw();

  it('shows own hand as array', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(Array.isArray(visible.hands.ottoman)).toBe(true);
  });

  it('shows other hands as numbers', () => {
    const visible = getVisibleState(fullState, 'p1');
    for (const power of MAJOR_POWERS) {
      if (power === 'ottoman') continue;
      expect(typeof visible.hands[power]).toBe('number');
    }
  });

  it('other hand counts match original lengths', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(visible.hands.hapsburg).toBe(fullState.hands.hapsburg.length);
  });

  it('deck is a number (count)', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(typeof visible.deck).toBe('number');
    expect(visible.deck).toBe(fullState.deck.length);
  });

  it('discard is a number (count)', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(typeof visible.discard).toBe('number');
  });

  it('does not mutate original state', () => {
    const deckBefore = [...fullState.deck];
    const handBefore = [...fullState.hands.ottoman];
    getVisibleState(fullState, 'p1');
    expect(fullState.deck).toEqual(deckBefore);
    expect(fullState.hands.ottoman).toEqual(handBefore);
  });

  it('unknown player sees all hands as numbers', () => {
    const visible = getVisibleState(fullState, 'spectator');
    for (const power of MAJOR_POWERS) {
      expect(typeof visible.hands[power]).toBe('number');
    }
  });

  it('preserves public information', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(visible.vp).toEqual(fullState.vp);
    expect(visible.turn).toBe(fullState.turn);
    expect(visible.phase).toBe(fullState.phase);
    expect(Object.keys(visible.spaces)).toHaveLength(
      Object.keys(fullState.spaces).length
    );
  });

  it('each player sees their own hand', () => {
    for (let i = 0; i < 6; i++) {
      const pid = `p${i + 1}`;
      const power = MAJOR_POWERS[i];
      const visible = getVisibleState(fullState, pid);
      expect(Array.isArray(visible.hands[power])).toBe(true);
    }
  });

  // ── Edge Case Tests ──────────────────────────────────────────────

  describe('empty hands', () => {
    it('serializes empty hand (0 cards) as empty array for own power', () => {
      const state = createStateAfterDraw();
      state.hands.ottoman = [];
      const visible = getVisibleState(state, 'p1');
      expect(Array.isArray(visible.hands.ottoman)).toBe(true);
      expect(visible.hands.ottoman).toHaveLength(0);
    });

    it('serializes empty hand (0 cards) as number 0 for other power', () => {
      const state = createStateAfterDraw();
      state.hands.hapsburg = [];
      const visible = getVisibleState(state, 'p1');
      expect(visible.hands.hapsburg).toBe(0);
    });

    it('serializes all empty hands correctly', () => {
      const state = createStateAfterDraw();
      for (const power of MAJOR_POWERS) {
        state.hands[power] = [];
      }
      const visible = getVisibleState(state, 'p1');
      // Own hand: empty array
      expect(Array.isArray(visible.hands.ottoman)).toBe(true);
      expect(visible.hands.ottoman).toHaveLength(0);
      // Others: number 0
      for (const power of MAJOR_POWERS) {
        if (power === 'ottoman') continue;
        expect(visible.hands[power]).toBe(0);
      }
    });
  });

  describe('unknown / spectator player ID', () => {
    it('spectator sees all hands as numbers', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, 'spectator-xyz');
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
      }
    });

    it('null player ID sees all hands as numbers', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, null);
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
      }
    });

    it('undefined player ID sees all hands as numbers', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, undefined);
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
      }
    });

    it('empty string player ID sees all hands as numbers', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, '');
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
      }
    });

    it('spectator hand counts match original hand lengths', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, 'observer');
      for (const power of MAJOR_POWERS) {
        expect(visible.hands[power]).toBe(state.hands[power].length);
      }
    });
  });

  describe('deep clone verification', () => {
    it('mutating visible state hands does not affect original', () => {
      const state = createStateAfterDraw();
      const originalHand = [...state.hands.ottoman];
      const visible = getVisibleState(state, 'p1');
      // Mutate the visible hand
      visible.hands.ottoman.push(999);
      expect(state.hands.ottoman).toEqual(originalHand);
      expect(state.hands.ottoman).not.toContain(999);
    });

    it('mutating visible state spaces does not affect original', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, 'p1');
      const firstSpaceName = Object.keys(visible.spaces)[0];
      const originalController = state.spaces[firstSpaceName].controller;
      // Mutate the visible space
      visible.spaces[firstSpaceName].controller = 'MUTATED';
      expect(state.spaces[firstSpaceName].controller).toBe(
        originalController
      );
    });

    it('mutating visible state vp does not affect original', () => {
      const state = createStateAfterDraw();
      const originalVp = { ...state.vp };
      const visible = getVisibleState(state, 'p1');
      visible.vp.ottoman = 999;
      expect(state.vp).toEqual(originalVp);
    });

    it('mutating visible state deck count does not affect original', () => {
      const state = createStateAfterDraw();
      const originalDeckLength = state.deck.length;
      const visible = getVisibleState(state, 'p1');
      visible.deck = 0;
      // Original deck should still be an array with original length
      expect(state.deck.length).toBe(originalDeckLength);
    });
  });

  describe('deck and discard edge cases', () => {
    it('empty deck shows as 0', () => {
      const state = createStateAfterDraw();
      state.deck = [];
      const visible = getVisibleState(state, 'p1');
      expect(visible.deck).toBe(0);
    });

    it('empty discard shows as 0', () => {
      const state = createStateAfterDraw();
      state.discard = [];
      const visible = getVisibleState(state, 'p1');
      expect(visible.discard).toBe(0);
    });

    it('deck count matches original deck length exactly', () => {
      const state = createStateAfterDraw();
      // Add some cards to deck to make it non-trivial
      state.deck = [1, 2, 3, 4, 5];
      const visible = getVisibleState(state, 'p1');
      expect(visible.deck).toBe(5);
    });

    it('discard count matches original discard length exactly', () => {
      const state = createStateAfterDraw();
      state.discard = [10, 20, 30];
      const visible = getVisibleState(state, 'p1');
      expect(visible.discard).toBe(3);
    });

    it('deck contents are not visible (only count)', () => {
      const state = createStateAfterDraw();
      state.deck = [42, 99, 101];
      const visible = getVisibleState(state, 'p1');
      expect(typeof visible.deck).toBe('number');
      expect(visible.deck).not.toEqual(expect.arrayContaining([42]));
    });
  });

  describe('all hands shown as numbers for unrecognized player', () => {
    it('player ID not in powerByPlayer gets all numeric hands', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, 'nonexistent-player-42');
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
        expect(visible.hands[power]).toBe(state.hands[power].length);
      }
    });

    it('numeric player ID not in powerByPlayer gets all numeric hands', () => {
      const state = createStateAfterDraw();
      const visible = getVisibleState(state, '12345');
      for (const power of MAJOR_POWERS) {
        expect(typeof visible.hands[power]).toBe('number');
      }
    });
  });
});
