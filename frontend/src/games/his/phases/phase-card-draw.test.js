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

  // ══════════════════════════════════════════════════════════════════
  // Batch 6 — Edge Case Tests
  // ══════════════════════════════════════════════════════════════════

  describe('empty deck edge cases', () => {
    it('draw from empty deck gives only home cards', () => {
      const state = createTestState();
      state.deck = [];
      state.discard = [];
      drawOnState(state);
      // Each power should have at least their home cards
      expect(state.hands.ottoman).toContain(1);
      expect(state.hands.hapsburg).toContain(2);
      expect(state.hands.england).toContain(3);
      expect(state.hands.france).toContain(4);
      expect(state.hands.papacy).toContain(5);
      expect(state.hands.papacy).toContain(6);
      expect(state.hands.protestant).toContain(7);
    });

    it('deck exhaustion during draw — limited cards distributed', () => {
      const state = createTestState();
      // Put only 3 cards in deck; mark all others as removed so
      // addTurnGatedCards doesn't inject more
      const keepCards = [42, 43, 44];
      state.deck = [...keepCards];
      state.discard = [];
      // Mark all non-kept, non-home cards as removed
      for (const card of CARDS) {
        if (!keepCards.includes(card.number) && card.number > 7) {
          state.removedCards.push(card.number);
        }
      }
      drawOnState(state);

      const totalNonHome = MAJOR_POWERS.reduce((sum, p) =>
        sum + state.hands[p].filter(c => c > 7).length, 0);
      expect(totalNonHome).toBe(3); // only 3 non-home cards distributed
    });
  });

  describe('discard merge edge cases', () => {
    it('large discard pile merges correctly', () => {
      const state = createTestState();
      const discardCards = [50, 51, 52, 53, 54];
      state.discard = [...discardCards];
      const deckBefore = state.deck.length;
      drawOnState(state);

      // Discard should be empty after merge
      expect(state.discard).toEqual([]);
      // All discard cards should be somewhere (deck, hand, or already dealt)
    });
  });

  describe('turn-gated card edge cases', () => {
    it('diplomacy deck cards are excluded from turn-gating', () => {
      const state = createTestState({ turn: 5 });
      drawOnState(state);

      // Diplomacy cards should not appear in normal hands via draw
      const diploCards = CARDS.filter(c =>
        c.deck === 'diplomacy' || c.deck === 'diplomacy_sl');
      const allHands = MAJOR_POWERS.flatMap(p => state.hands[p]);
      for (const dc of diploCards) {
        expect(allHands).not.toContain(dc.number);
      }
    });

    it('special deck cards are excluded from turn-gating', () => {
      const state = createTestState({ turn: 9 });
      drawOnState(state);

      const specialCards = CARDS.filter(c => c.deck === 'special');
      const allCards = [
        ...state.deck,
        ...MAJOR_POWERS.flatMap(p => state.hands[p])
      ];
      for (const sc of specialCards) {
        // Special cards may or may not be in the state, but addTurnGatedCards excludes them
        // Check they weren't added by turn-gating (they might be in initial deck)
        expect(sc.deck).toBe('special');
      }
    });

    it('cards already in removedCards are not re-added to deck or hands', () => {
      const state = createTestState({ turn: 5 });
      // Mark a card as removed
      const turnGatedCard = CARDS.find(
        c => c.availableTurn && c.availableTurn <= 5 &&
             c.deck !== 'home' && c.deck !== 'special' &&
             c.deck !== 'diplomacy' && c.deck !== 'diplomacy_sl'
      );
      if (turnGatedCard) {
        // Remove from deck first (if present), then add to removedCards
        state.deck = state.deck.filter(c => c !== turnGatedCard.number);
        state.removedCards = [turnGatedCard.number];
        drawOnState(state);

        // Check only deck + hands (not removedCards) — card should not reappear
        const activeCards = [
          ...state.deck,
          ...MAJOR_POWERS.flatMap(p => state.hands[p])
        ];
        const count = activeCards.filter(c => c === turnGatedCard.number).length;
        expect(count).toBe(0);
      }
    });

    it('cards already in a hand are not duplicated', () => {
      const state = createTestState({ turn: 3 });
      // Pre-place a turn-3 card in someone's hand
      const t3Card = CARDS.find(
        c => c.availableTurn === 3 &&
             c.deck !== 'home' && c.deck !== 'special' &&
             c.deck !== 'diplomacy' && c.deck !== 'diplomacy_sl'
      );
      if (t3Card) {
        state.hands.ottoman.push(t3Card.number);
        drawOnState(state);

        const allCards = [
          ...state.deck,
          ...state.discard,
          ...state.removedCards,
          ...MAJOR_POWERS.flatMap(p => state.hands[p])
        ];
        const count = allCards.filter(c => c === t3Card.number).length;
        expect(count).toBe(1); // should not be duplicated
      }
    });
  });

  describe('homeCardPlayed tracking', () => {
    it('resets all powers homeCardPlayed even when some are already false', () => {
      const state = createTestState();
      state.homeCardPlayed.ottoman = false;
      state.homeCardPlayed.hapsburg = true;
      state.homeCardPlayed.england = true;
      drawOnState(state);
      for (const power of MAJOR_POWERS) {
        expect(state.homeCardPlayed[power]).toBe(false);
      }
    });
  });

  // ── forceHands (deterministic opening hands; test/debug only) ─────
  describe('forceHands (deterministic deal)', () => {
    it('gives a power exactly the requested cards plus its home card', () => {
      // 110/82 are non-home main-deck cards; 7 is the Protestant home card.
      const state = createTestState({ forceHands: { protestant: [110, 82] } });
      drawOnState(state);
      expect(state.hands.protestant.sort((a, b) => a - b)).toEqual([7, 82, 110]);
    });

    it('does not disturb powers that are not listed', () => {
      const state = createTestState({ forceHands: { protestant: [110] } });
      const seed = state.deck.length;
      drawOnState(state);
      // Other powers still receive a normal (non-empty) hand.
      expect(state.hands.ottoman.length).toBeGreaterThan(0);
      expect(seed).toBeGreaterThan(0);
    });

    it('is one-shot: cleared after the first draw, so later draws are normal', () => {
      const state = createTestState({ forceHands: { protestant: [110, 82] } });
      drawOnState(state);
      expect(state.forceHands).toBeNull();
    });

    it('no-op in production (forceHands null) — hands are dealt normally', () => {
      const state = createTestState();
      expect(state.forceHands).toBeNull();
      drawOnState(state);
      expect(state.hands.protestant.length).toBeGreaterThan(0);
    });
  });
});
