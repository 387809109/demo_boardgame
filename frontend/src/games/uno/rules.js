/**
 * UNO Game Rules
 * @module games/uno/rules
 */

/**
 * UNO Card colors
 */
export const COLORS = ['red', 'blue', 'green', 'yellow'];

/**
 * UNO Card types
 */
export const CARD_TYPES = {
  NUMBER: 'number',      // 0-9
  SKIP: 'skip',          // Skip next player
  REVERSE: 'reverse',    // Reverse direction
  DRAW_TWO: 'draw_two',  // +2
  WILD: 'wild',          // Wild card (choose color)
  WILD_DRAW_FOUR: 'wild_draw_four' // +4
};

/**
 * Check if a card can be played on top of another card
 * @param {Object} card - Card to play
 * @param {Object} topCard - Current top card on discard pile
 * @param {string} currentColor - Current active color (for wild cards)
 * @returns {boolean}
 */
export function canPlayCard(card, topCard, currentColor) {
  // Wild cards can always be played
  if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
    return true;
  }

  // Color matches
  if (card.color === currentColor) {
    return true;
  }

  // Same type of action card
  if (card.type !== CARD_TYPES.NUMBER && card.type === topCard.type) {
    return true;
  }

  // Same number
  if (card.type === CARD_TYPES.NUMBER && topCard.type === CARD_TYPES.NUMBER && card.value === topCard.value) {
    return true;
  }

  return false;
}

/**
 * Apply card effect and return new state
 * @param {Object} card - Card played
 * @param {Object} state - Current game state
 * @param {string} chosenColor - Color chosen (for wild cards)
 * @returns {Object} Updated state changes
 */
export function applyCardEffect(card, state, chosenColor = null) {
  const changes = {
    currentColor: card.color || chosenColor || state.currentColor,
    drawPending: 0,
    skipNext: false,
    reverseDirection: false
  };

  switch (card.type) {
    case CARD_TYPES.SKIP:
      changes.skipNext = true;
      break;

    case CARD_TYPES.REVERSE:
      changes.reverseDirection = true;
      break;

    case CARD_TYPES.DRAW_TWO:
      changes.drawPending = 2;
      // Note: skipNext is false - the next player must draw cards first,
      // then they are skipped after drawing (handled in processMove)
      break;

    case CARD_TYPES.WILD:
      changes.currentColor = chosenColor || state.currentColor;
      break;

    case CARD_TYPES.WILD_DRAW_FOUR:
      changes.currentColor = chosenColor || state.currentColor;
      changes.drawPending = 4;
      // Note: skipNext is false - the next player must draw cards first,
      // then they are skipped after drawing (handled in processMove)
      break;
  }

  return changes;
}

/**
 * Check if player needs to call UNO
 * @param {Array} hand - Player's hand
 * @returns {boolean}
 */
export function shouldCallUno(hand) {
  return hand.length === 1;
}

/**
 * Check if player forgot to call UNO (has 1 card, didn't call)
 * @param {Array} hand - Player's hand
 * @param {boolean} calledUno - Whether player called UNO
 * @returns {boolean}
 */
export function forgotUno(hand, calledUno) {
  return hand.length === 1 && !calledUno;
}

/**
 * Get penalty for forgetting UNO
 * @param {number} [customPenalty] - Custom penalty amount from game options
 * @returns {number}
 */
export function getUnoPenalty(customPenalty) {
  return customPenalty ?? 2; // Default: Draw 2 cards
}

/**
 * Calculate score for remaining cards in hand
 * @param {Array} hand - Cards in hand
 * @returns {number}
 */
export function calculateHandScore(hand) {
  return hand.reduce((sum, card) => {
    switch (card.type) {
      case CARD_TYPES.NUMBER:
        return sum + (card.value || 0);
      case CARD_TYPES.SKIP:
      case CARD_TYPES.REVERSE:
      case CARD_TYPES.DRAW_TWO:
        return sum + 20;
      case CARD_TYPES.WILD:
      case CARD_TYPES.WILD_DRAW_FOUR:
        return sum + 50;
      default:
        return sum;
    }
  }, 0);
}

/**
 * Generate a full UNO deck
 * @returns {Array<Object>}
 */
export function generateDeck() {
  const deck = [];
  let cardId = 0;

  // Number cards (0-9 for each color, 0 has 1 copy, others have 2)
  COLORS.forEach(color => {
    // One 0 per color
    deck.push({
      id: `card-${cardId++}`,
      type: CARD_TYPES.NUMBER,
      color,
      value: 0
    });

    // Two of each 1-9
    for (let num = 1; num <= 9; num++) {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `card-${cardId++}`,
          type: CARD_TYPES.NUMBER,
          color,
          value: num
        });
      }
    }

    // Two of each action card per color
    [CARD_TYPES.SKIP, CARD_TYPES.REVERSE, CARD_TYPES.DRAW_TWO].forEach(type => {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: `card-${cardId++}`,
          type,
          color,
          value: null
        });
      }
    });
  });

  // Wild cards (4 of each)
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `card-${cardId++}`,
      type: CARD_TYPES.WILD,
      color: null,
      value: null
    });

    deck.push({
      id: `card-${cardId++}`,
      type: CARD_TYPES.WILD_DRAW_FOUR,
      color: null,
      value: null
    });
  }

  return deck;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array (new array)
 */
export function shuffleDeck(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get card display text
 * @param {Object} card - Card object
 * @returns {string}
 */
export function getCardDisplayText(card) {
  switch (card.type) {
    case CARD_TYPES.NUMBER:
      return String(card.value);
    case CARD_TYPES.SKIP:
      return '⊘';
    case CARD_TYPES.REVERSE:
      return '⟲';
    case CARD_TYPES.DRAW_TWO:
      return '+2';
    case CARD_TYPES.WILD:
      return '✦';
    case CARD_TYPES.WILD_DRAW_FOUR:
      return '+4';
    default:
      return '?';
  }
}

/**
 * Get card type display name
 * @param {string} type - Card type
 * @returns {string}
 */
export function getCardTypeName(type) {
  const names = {
    [CARD_TYPES.NUMBER]: '数字',
    [CARD_TYPES.SKIP]: '跳过',
    [CARD_TYPES.REVERSE]: '反转',
    [CARD_TYPES.DRAW_TWO]: '+2',
    [CARD_TYPES.WILD]: '万能',
    [CARD_TYPES.WILD_DRAW_FOUR]: '+4'
  };
  return names[type] || type;
}

/**
 * Get color display name
 * @param {string} color - Color
 * @returns {string}
 */
export function getColorName(color) {
  const names = {
    red: '红色',
    blue: '蓝色',
    green: '绿色',
    yellow: '黄色'
  };
  return names[color] || color;
}

export default {
  COLORS,
  CARD_TYPES,
  canPlayCard,
  applyCardEffect,
  shouldCallUno,
  forgotUno,
  getUnoPenalty,
  calculateHandScore,
  generateDeck,
  shuffleDeck,
  getCardDisplayText,
  getCardTypeName,
  getColorName
};
