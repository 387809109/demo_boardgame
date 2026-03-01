/**
 * Here I Stand — Card Draw Phase
 *
 * Handles: add turn-gated cards, merge discard, shuffle, deal to each power.
 */

import { MAJOR_POWERS } from '../constants.js';
import { CARDS } from '../data/cards.js';
import { getCardDrawCount, isCardInPlay } from '../state/state-helpers.js';

/** Home card numbers per power */
const HOME_CARDS = {
  ottoman: [1],
  hapsburg: [2],
  england: [3],
  france: [4],
  papacy: [5, 6],
  protestant: [7]
};

/** All home card numbers (flat set for quick lookup) */
const HOME_CARD_SET = new Set(Object.values(HOME_CARDS).flat());

/**
 * Execute the full card draw phase.
 * Mutates state in place.
 * @param {Object} state
 * @param {Object} helpers
 */
export function executeCardDraw(state, helpers) {
  // 1. Add turn-gated cards that are now available
  addTurnGatedCards(state);

  // 2. Merge discard pile back into deck
  state.deck.push(...state.discard);
  state.discard = [];

  // 3. Shuffle deck
  shuffleDeck(state.deck);

  // 4. Deal cards to each power (in impulse order)
  for (const power of MAJOR_POWERS) {
    const drawCount = getCardDrawCount(state, power);
    const dealt = state.deck.splice(0, drawCount);
    state.hands[power].push(...dealt);
  }

  // 5. Add home cards to each power's hand
  for (const power of MAJOR_POWERS) {
    for (const cardNum of HOME_CARDS[power]) {
      if (!state.hands[power].includes(cardNum)) {
        state.hands[power].push(cardNum);
      }
    }
    state.homeCardPlayed[power] = false;
  }

  helpers.logEvent(state, 'cards_dealt', {
    turn: state.turn,
    counts: Object.fromEntries(
      MAJOR_POWERS.map(p => [p, state.hands[p].length])
    )
  });
}

/**
 * Add turn-gated cards that become available this turn.
 * Cards with availableTurn <= current turn that aren't already tracked anywhere.
 * Excludes home cards, diplomacy cards, and special-timing cards.
 */
function addTurnGatedCards(state) {
  const EXCLUDED_DECKS = new Set(['home', 'special', 'diplomacy', 'diplomacy_sl']);

  for (const card of CARDS) {
    // Skip excluded deck types
    if (EXCLUDED_DECKS.has(card.deck)) continue;

    // Skip home cards
    if (HOME_CARD_SET.has(card.number)) continue;

    // Skip if not yet available
    if (card.availableTurn === null || card.availableTurn > state.turn) continue;

    // Skip if already in play somewhere
    if (isCardInPlay(state, card.number)) continue;

    // Add to deck
    state.deck.push(card.number);
  }
}

/**
 * Fisher-Yates shuffle (in place).
 * @param {Array} arr
 */
function shuffleDeck(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
