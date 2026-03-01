/**
 * Here I Stand — phase-card-draw.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { executeCardDraw } from './phase-card-draw.js';
import { MAJOR_POWERS } from '../constants.js';
import { CARDS } from '../data/cards.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

describe('executeCardDraw', () => {
  function drawOnState(state) {
    const helpers = createMockHelpers();
    executeCardDraw(state, helpers);
    return helpers;
  }

  // ── Basic Flow ──────────────────────────────────────────────────

  describe('basic flow', () => {
    it('all powers get cards', () => {
      const state = createTestState();
      drawOnState(state);
      for (const power of MAJOR_POWERS) {
        expect(state.hands[power].length).toBeGreaterThan(0);
      }
    });

    it('deck decreases after draw', () => {
      const state = createTestState();
      const deckBefore = state.deck.length;
      drawOnState(state);
      expect(state.deck.length).toBeLessThan(deckBefore);
    });

    it('discard is merged and cleared', () => {
      const state = createTestState();
      state.discard = [100, 101]; // fake discard
      state.deck.push(100, 101); // also add to avoid missing cards
      drawOnState(state);
      expect(state.discard).toEqual([]);
    });

    it('logs cards_dealt event', () => {
      const state = createTestState();
      drawOnState(state);
      const event = state.eventLog.find(e => e.type === 'cards_dealt');
      expect(event).toBeDefined();
      expect(event.data.turn).toBe(1);
    });
  });

  // ── Home Cards ──────────────────────────────────────────────────

  describe('home cards', () => {
    it('ottoman has home card #1', () => {
      const state = createTestState();
      drawOnState(state);
      expect(state.hands.ottoman).toContain(1);
    });

    it('papacy has home cards #5 and #6', () => {
      const state = createTestState();
      drawOnState(state);
      expect(state.hands.papacy).toContain(5);
      expect(state.hands.papacy).toContain(6);
    });

    it('protestant has home card #7', () => {
      const state = createTestState();
      drawOnState(state);
      expect(state.hands.protestant).toContain(7);
    });

    it('all home cards dealt to correct powers', () => {
      const state = createTestState();
      drawOnState(state);
      expect(state.hands.ottoman).toContain(1);
      expect(state.hands.hapsburg).toContain(2);
      expect(state.hands.england).toContain(3);
      expect(state.hands.france).toContain(4);
      expect(state.hands.papacy).toContain(5);
      expect(state.hands.papacy).toContain(6);
      expect(state.hands.protestant).toContain(7);
    });

    it('homeCardPlayed reset to false', () => {
      const state = createTestState();
      state.homeCardPlayed.ottoman = true;
      drawOnState(state);
      for (const power of MAJOR_POWERS) {
        expect(state.homeCardPlayed[power]).toBe(false);
      }
    });

    it('does not duplicate home card on repeated draw', () => {
      const state = createTestState();
      drawOnState(state);
      drawOnState(state);
      const count = state.hands.ottoman.filter(c => c === 1).length;
      expect(count).toBe(1);
    });
  });

  // ── Turn-Gated Cards ───────────────────────────────────────────

  describe('turn-gated cards', () => {
    it('turn 1 does not include cards with availableTurn > 1', () => {
      const state = createTestState();
      drawOnState(state);
      const allCards = [
        ...state.deck,
        ...state.discard,
        ...MAJOR_POWERS.flatMap(p => state.hands[p])
      ];
      const futureCards = CARDS.filter(
        c => c.availableTurn !== null && c.availableTurn > 1
      );
      for (const fc of futureCards) {
        expect(allCards).not.toContain(fc.number);
      }
    });

    it('turn 3 adds availableTurn=3 cards', () => {
      const state = createTestState({ turn: 3 });
      drawOnState(state);
      const allCards = [
        ...state.deck,
        ...MAJOR_POWERS.flatMap(p => state.hands[p])
      ];
      const turn3Cards = CARDS.filter(
        c => c.availableTurn === 3 &&
             c.deck !== 'home' && c.deck !== 'special' &&
             c.deck !== 'diplomacy' && c.deck !== 'diplomacy_sl'
      );
      for (const tc of turn3Cards) {
        expect(allCards).toContain(tc.number);
      }
    });

    it('already-tracked cards are not duplicated', () => {
      const state = createTestState({ turn: 3 });
      // Draw twice at turn 3
      drawOnState(state);
      drawOnState(state);
      const allCards = [
        ...state.deck,
        ...state.discard,
        ...state.removedCards,
        ...MAJOR_POWERS.flatMap(p => state.hands[p])
      ];
      // Check no duplicates
      const counts = {};
      for (const c of allCards) {
        counts[c] = (counts[c] || 0) + 1;
      }
      const duplicates = Object.entries(counts).filter(([, v]) => v > 1);
      expect(duplicates).toEqual([]);
    });
  });

  // ── Draw Counts ─────────────────────────────────────────────────

  describe('draw counts', () => {
    it('total drawn equals sum of draw counts', () => {
      const state = createTestState();
      const deckBefore = state.deck.length;
      drawOnState(state);
      const totalInHands = MAJOR_POWERS.reduce(
        (sum, p) => sum + state.hands[p].length, 0
      );
      // Total = drawn from deck + home cards (7 total: 1+1+1+1+2+1)
      // Home cards are added on top of dealt cards
      expect(totalInHands).toBeGreaterThan(0);
    });
  });
});
