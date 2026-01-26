/**
 * UNO Rules Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  COLORS,
  CARD_TYPES,
  canPlayCard,
  applyCardEffect,
  shouldCallUno,
  forgotUno,
  getUnoPenalty,
  calculateHandScore,
  generateDeck,
  shuffleDeck
} from './rules.js';

// Helper function to create test cards
function createCard(type, color = null, value = null) {
  return {
    id: `test-${type}-${color}-${value}`,
    type,
    color,
    value
  };
}

describe('UNO Rules', () => {
  describe('COLORS', () => {
    it('should have 4 colors', () => {
      expect(COLORS).toHaveLength(4);
      expect(COLORS).toContain('red');
      expect(COLORS).toContain('blue');
      expect(COLORS).toContain('green');
      expect(COLORS).toContain('yellow');
    });
  });

  describe('CARD_TYPES', () => {
    it('should have all card types defined', () => {
      expect(CARD_TYPES.NUMBER).toBe('number');
      expect(CARD_TYPES.SKIP).toBe('skip');
      expect(CARD_TYPES.REVERSE).toBe('reverse');
      expect(CARD_TYPES.DRAW_TWO).toBe('draw_two');
      expect(CARD_TYPES.WILD).toBe('wild');
      expect(CARD_TYPES.WILD_DRAW_FOUR).toBe('wild_draw_four');
    });
  });

  describe('canPlayCard', () => {
    describe('Wild cards', () => {
      it('should always allow playing Wild card', () => {
        const wild = createCard(CARD_TYPES.WILD);
        const topCard = createCard(CARD_TYPES.NUMBER, 'red', 5);
        expect(canPlayCard(wild, topCard, 'red')).toBe(true);
        expect(canPlayCard(wild, topCard, 'blue')).toBe(true);
      });

      it('should always allow playing Wild Draw Four card', () => {
        const wildDrawFour = createCard(CARD_TYPES.WILD_DRAW_FOUR);
        const topCard = createCard(CARD_TYPES.NUMBER, 'green', 9);
        expect(canPlayCard(wildDrawFour, topCard, 'green')).toBe(true);
        expect(canPlayCard(wildDrawFour, topCard, 'yellow')).toBe(true);
      });
    });

    describe('Color matching', () => {
      it('should allow playing card with matching color', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'red', 3);
        const topCard = createCard(CARD_TYPES.NUMBER, 'red', 7);
        expect(canPlayCard(card, topCard, 'red')).toBe(true);
      });

      it('should allow playing card matching current color (not top card color)', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'blue', 5);
        const topCard = createCard(CARD_TYPES.WILD, null, null);
        // Current color is blue (set by wild card)
        expect(canPlayCard(card, topCard, 'blue')).toBe(true);
      });

      it('should reject card with different color and no match', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'red', 3);
        const topCard = createCard(CARD_TYPES.NUMBER, 'blue', 7);
        expect(canPlayCard(card, topCard, 'blue')).toBe(false);
      });
    });

    describe('Number matching', () => {
      it('should allow playing number card with matching value', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'red', 5);
        const topCard = createCard(CARD_TYPES.NUMBER, 'blue', 5);
        expect(canPlayCard(card, topCard, 'blue')).toBe(true);
      });

      it('should reject number card with different value and color', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'red', 3);
        const topCard = createCard(CARD_TYPES.NUMBER, 'blue', 5);
        expect(canPlayCard(card, topCard, 'blue')).toBe(false);
      });
    });

    describe('Action card matching', () => {
      it('should allow playing Skip on Skip with different color', () => {
        const card = createCard(CARD_TYPES.SKIP, 'red');
        const topCard = createCard(CARD_TYPES.SKIP, 'blue');
        expect(canPlayCard(card, topCard, 'blue')).toBe(true);
      });

      it('should allow playing Reverse on Reverse with different color', () => {
        const card = createCard(CARD_TYPES.REVERSE, 'green');
        const topCard = createCard(CARD_TYPES.REVERSE, 'yellow');
        expect(canPlayCard(card, topCard, 'yellow')).toBe(true);
      });

      it('should allow playing Draw Two on Draw Two with different color', () => {
        const card = createCard(CARD_TYPES.DRAW_TWO, 'red');
        const topCard = createCard(CARD_TYPES.DRAW_TWO, 'blue');
        expect(canPlayCard(card, topCard, 'blue')).toBe(true);
      });

      it('should NOT allow playing action card on different action card', () => {
        const card = createCard(CARD_TYPES.SKIP, 'red');
        const topCard = createCard(CARD_TYPES.REVERSE, 'blue');
        expect(canPlayCard(card, topCard, 'blue')).toBe(false);
      });

      it('should NOT allow playing number on action card type match (action cards only)', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'red', 5);
        const topCard = createCard(CARD_TYPES.SKIP, 'blue');
        expect(canPlayCard(card, topCard, 'blue')).toBe(false);
      });
    });
  });

  describe('applyCardEffect', () => {
    const mockState = {
      currentColor: 'red',
      direction: 1,
      drawPending: 0
    };

    describe('Number cards', () => {
      it('should only update currentColor for number cards', () => {
        const card = createCard(CARD_TYPES.NUMBER, 'blue', 5);
        const effect = applyCardEffect(card, mockState);
        expect(effect.currentColor).toBe('blue');
        expect(effect.skipNext).toBe(false);
        expect(effect.reverseDirection).toBe(false);
        expect(effect.drawPending).toBe(0);
      });
    });

    describe('Skip card', () => {
      it('should set skipNext to true', () => {
        const card = createCard(CARD_TYPES.SKIP, 'green');
        const effect = applyCardEffect(card, mockState);
        expect(effect.currentColor).toBe('green');
        expect(effect.skipNext).toBe(true);
        expect(effect.reverseDirection).toBe(false);
        expect(effect.drawPending).toBe(0);
      });
    });

    describe('Reverse card', () => {
      it('should set reverseDirection to true', () => {
        const card = createCard(CARD_TYPES.REVERSE, 'yellow');
        const effect = applyCardEffect(card, mockState);
        expect(effect.currentColor).toBe('yellow');
        expect(effect.skipNext).toBe(false);
        expect(effect.reverseDirection).toBe(true);
        expect(effect.drawPending).toBe(0);
      });
    });

    describe('Draw Two card', () => {
      it('should set drawPending to 2 but NOT skipNext (player must draw first)', () => {
        const card = createCard(CARD_TYPES.DRAW_TWO, 'red');
        const effect = applyCardEffect(card, mockState);
        expect(effect.currentColor).toBe('red');
        expect(effect.skipNext).toBe(false); // Next player must draw, then skip happens
        expect(effect.reverseDirection).toBe(false);
        expect(effect.drawPending).toBe(2);
      });
    });

    describe('Wild card', () => {
      it('should set currentColor to chosen color', () => {
        const card = createCard(CARD_TYPES.WILD);
        const effect = applyCardEffect(card, mockState, 'blue');
        expect(effect.currentColor).toBe('blue');
        expect(effect.skipNext).toBe(false);
        expect(effect.reverseDirection).toBe(false);
        expect(effect.drawPending).toBe(0);
      });

      it('should use state currentColor if no color chosen', () => {
        const card = createCard(CARD_TYPES.WILD);
        const effect = applyCardEffect(card, mockState, null);
        // Falls back to state.currentColor when chosenColor is null
        expect(effect.currentColor).toBe('red');
      });
    });

    describe('Wild Draw Four card', () => {
      it('should set currentColor to chosen color and drawPending to 4 but NOT skipNext', () => {
        const card = createCard(CARD_TYPES.WILD_DRAW_FOUR);
        const effect = applyCardEffect(card, mockState, 'green');
        expect(effect.currentColor).toBe('green');
        expect(effect.skipNext).toBe(false); // Next player must draw, then skip happens
        expect(effect.reverseDirection).toBe(false);
        expect(effect.drawPending).toBe(4);
      });
    });
  });

  describe('shouldCallUno', () => {
    it('should return true when hand has 1 card', () => {
      const hand = [createCard(CARD_TYPES.NUMBER, 'red', 5)];
      expect(shouldCallUno(hand)).toBe(true);
    });

    it('should return false when hand has more than 1 card', () => {
      const hand = [
        createCard(CARD_TYPES.NUMBER, 'red', 5),
        createCard(CARD_TYPES.NUMBER, 'blue', 3)
      ];
      expect(shouldCallUno(hand)).toBe(false);
    });

    it('should return false when hand is empty', () => {
      expect(shouldCallUno([])).toBe(false);
    });
  });

  describe('forgotUno', () => {
    it('should return true when hand has 1 card and did not call UNO', () => {
      const hand = [createCard(CARD_TYPES.NUMBER, 'red', 5)];
      expect(forgotUno(hand, false)).toBe(true);
    });

    it('should return false when hand has 1 card but called UNO', () => {
      const hand = [createCard(CARD_TYPES.NUMBER, 'red', 5)];
      expect(forgotUno(hand, true)).toBe(false);
    });

    it('should return false when hand has more than 1 card', () => {
      const hand = [
        createCard(CARD_TYPES.NUMBER, 'red', 5),
        createCard(CARD_TYPES.NUMBER, 'blue', 3)
      ];
      expect(forgotUno(hand, false)).toBe(false);
    });
  });

  describe('getUnoPenalty', () => {
    it('should return default penalty of 2 when no custom value', () => {
      expect(getUnoPenalty()).toBe(2);
      expect(getUnoPenalty(undefined)).toBe(2);
      expect(getUnoPenalty(null)).toBe(2);
    });

    it('should return custom penalty when provided', () => {
      expect(getUnoPenalty(1)).toBe(1);
      expect(getUnoPenalty(4)).toBe(4);
    });
  });

  describe('calculateHandScore', () => {
    it('should calculate score for number cards correctly', () => {
      const hand = [
        createCard(CARD_TYPES.NUMBER, 'red', 0),
        createCard(CARD_TYPES.NUMBER, 'blue', 5),
        createCard(CARD_TYPES.NUMBER, 'green', 9)
      ];
      expect(calculateHandScore(hand)).toBe(0 + 5 + 9);
    });

    it('should score Skip as 20 points', () => {
      const hand = [createCard(CARD_TYPES.SKIP, 'red')];
      expect(calculateHandScore(hand)).toBe(20);
    });

    it('should score Reverse as 20 points', () => {
      const hand = [createCard(CARD_TYPES.REVERSE, 'blue')];
      expect(calculateHandScore(hand)).toBe(20);
    });

    it('should score Draw Two as 20 points', () => {
      const hand = [createCard(CARD_TYPES.DRAW_TWO, 'green')];
      expect(calculateHandScore(hand)).toBe(20);
    });

    it('should score Wild as 50 points', () => {
      const hand = [createCard(CARD_TYPES.WILD)];
      expect(calculateHandScore(hand)).toBe(50);
    });

    it('should score Wild Draw Four as 50 points', () => {
      const hand = [createCard(CARD_TYPES.WILD_DRAW_FOUR)];
      expect(calculateHandScore(hand)).toBe(50);
    });

    it('should calculate total score for mixed hand', () => {
      const hand = [
        createCard(CARD_TYPES.NUMBER, 'red', 7),     // 7
        createCard(CARD_TYPES.SKIP, 'blue'),          // 20
        createCard(CARD_TYPES.WILD),                  // 50
        createCard(CARD_TYPES.DRAW_TWO, 'green')      // 20
      ];
      expect(calculateHandScore(hand)).toBe(7 + 20 + 50 + 20);
    });

    it('should return 0 for empty hand', () => {
      expect(calculateHandScore([])).toBe(0);
    });
  });

  describe('generateDeck', () => {
    it('should generate exactly 108 cards', () => {
      const deck = generateDeck();
      expect(deck).toHaveLength(108);
    });

    it('should have 4 zero cards (one per color)', () => {
      const deck = generateDeck();
      const zeros = deck.filter(c => c.type === CARD_TYPES.NUMBER && c.value === 0);
      expect(zeros).toHaveLength(4);
      expect(zeros.filter(c => c.color === 'red')).toHaveLength(1);
      expect(zeros.filter(c => c.color === 'blue')).toHaveLength(1);
      expect(zeros.filter(c => c.color === 'green')).toHaveLength(1);
      expect(zeros.filter(c => c.color === 'yellow')).toHaveLength(1);
    });

    it('should have 8 of each number 1-9 (two per color)', () => {
      const deck = generateDeck();
      for (let num = 1; num <= 9; num++) {
        const cards = deck.filter(c => c.type === CARD_TYPES.NUMBER && c.value === num);
        expect(cards).toHaveLength(8);
      }
    });

    it('should have 8 Skip cards (two per color)', () => {
      const deck = generateDeck();
      const skips = deck.filter(c => c.type === CARD_TYPES.SKIP);
      expect(skips).toHaveLength(8);
    });

    it('should have 8 Reverse cards (two per color)', () => {
      const deck = generateDeck();
      const reverses = deck.filter(c => c.type === CARD_TYPES.REVERSE);
      expect(reverses).toHaveLength(8);
    });

    it('should have 8 Draw Two cards (two per color)', () => {
      const deck = generateDeck();
      const drawTwos = deck.filter(c => c.type === CARD_TYPES.DRAW_TWO);
      expect(drawTwos).toHaveLength(8);
    });

    it('should have 4 Wild cards', () => {
      const deck = generateDeck();
      const wilds = deck.filter(c => c.type === CARD_TYPES.WILD);
      expect(wilds).toHaveLength(4);
      wilds.forEach(c => expect(c.color).toBeNull());
    });

    it('should have 4 Wild Draw Four cards', () => {
      const deck = generateDeck();
      const wildDrawFours = deck.filter(c => c.type === CARD_TYPES.WILD_DRAW_FOUR);
      expect(wildDrawFours).toHaveLength(4);
      wildDrawFours.forEach(c => expect(c.color).toBeNull());
    });

    it('should have unique card IDs', () => {
      const deck = generateDeck();
      const ids = deck.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(deck.length);
    });
  });

  describe('shuffleDeck', () => {
    it('should return a new array', () => {
      const deck = generateDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).not.toBe(deck);
    });

    it('should preserve all cards', () => {
      const deck = generateDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).toHaveLength(deck.length);

      // Check all original cards are present
      const originalIds = deck.map(c => c.id).sort();
      const shuffledIds = shuffled.map(c => c.id).sort();
      expect(shuffledIds).toEqual(originalIds);
    });

    it('should change the order (with high probability)', () => {
      const deck = generateDeck();
      const shuffled = shuffleDeck(deck);

      // Count how many cards are in different positions
      let differentPositions = 0;
      for (let i = 0; i < deck.length; i++) {
        if (deck[i].id !== shuffled[i].id) {
          differentPositions++;
        }
      }

      // With 108 cards, it's extremely unlikely to have the same order
      // We expect at least 90% of cards to be in different positions
      expect(differentPositions).toBeGreaterThan(deck.length * 0.9);
    });
  });
});
