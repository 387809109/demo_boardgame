/**
 * Here I Stand — Diet of Worms Phase
 *
 * Turn 1 only. Between Diplomacy and Spring Deployment.
 *
 * Procedure (Section 18.1):
 * 1. Protestant, Hapsburg, Papacy each select 1 card from hand
 *    (not mandatory event; home card OK)
 * 2. Protestant rolls (card CP + 4) dice; hits on 5-6
 * 3. Papacy rolls (card CP) dice; Hapsburg rolls (card CP) dice;
 *    hits on 5-6 combined as Catholic total
 * 4. Protestant hits > Catholic: flip diff spaces to Protestant
 *    (German zone, adjacent to existing Protestant spaces)
 * 5. Catholic hits > Protestant: flip diff spaces to Catholic
 *    (German zone, adjacent to existing Catholic spaces)
 * 6. Tie: no effect
 *
 * Card disposal follows normal play rules:
 * - Home cards: mark as played
 * - Remove After Play: moved to removed pile
 * - Others: moved to discard pile
 */

import { RELIGION } from '../constants.js';
import { rollDice } from '../actions/religious-actions.js';
import {
  getAllAdjacentSpaces, recountProtestantSpaces
} from '../state/state-helpers.js';
import { CARD_BY_NUMBER } from '../data/cards.js';

/**
 * Initialize the Diet of Worms phase.
 * Sets up pending state waiting for card commitments.
 * @param {Object} state
 * @param {Object} helpers
 */
export function initDietOfWorms(state, helpers) {
  state.pendingDietOfWorms = {
    cards: {},       // { power: cardNumber }
    resolved: false
  };
  helpers.logEvent(state, 'diet_of_worms_start', {});
}

/**
 * Submit a card for the Diet of Worms.
 * @param {Object} state
 * @param {string} power - 'protestant', 'hapsburg', or 'papacy'
 * @param {number} cardNumber
 * @param {Object} helpers
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDietCard(state, power, cardNumber) {
  if (!state.pendingDietOfWorms) {
    return { valid: false, error: 'Not in Diet of Worms phase' };
  }
  if (!['protestant', 'hapsburg', 'papacy'].includes(power)) {
    return { valid: false, error: 'Only Protestant, Hapsburg, and Papacy participate' };
  }
  if (state.pendingDietOfWorms.cards[power] !== undefined) {
    return { valid: false, error: 'Already submitted a card' };
  }
  if (!state.hands[power].includes(cardNumber)) {
    return { valid: false, error: 'Card not in hand' };
  }
  // Cannot play mandatory event cards
  const card = CARD_BY_NUMBER[cardNumber];
  if (card && card.category === 'MANDATORY') {
    return { valid: false, error: 'Cannot play a mandatory event card' };
  }
  return { valid: true };
}

/**
 * Submit a card commitment for the Diet of Worms.
 * When all 3 powers have submitted, auto-resolves.
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @param {Object} helpers
 * @returns {{ resolved: boolean, result?: Object }}
 */
export function submitDietCard(state, power, cardNumber, helpers) {
  state.pendingDietOfWorms.cards[power] = cardNumber;

  // Remove card from hand
  const hand = state.hands[power];
  const idx = hand.indexOf(cardNumber);
  if (idx !== -1) hand.splice(idx, 1);

  // Handle card disposal
  const card = CARD_BY_NUMBER[cardNumber];
  if (card && card.deck === 'home') {
    state.homeCardPlayed[power] = true;
  } else if (card?.removeAfterPlay) {
    state.removedCards.push(cardNumber);
  } else {
    state.discard.push(cardNumber);
  }

  helpers.logEvent(state, 'diet_card_submitted', {
    power, cardNumber, cp: card?.cp || 0
  });

  // Check if all 3 have submitted
  const { cards } = state.pendingDietOfWorms;
  if (cards.protestant !== undefined &&
      cards.hapsburg !== undefined &&
      cards.papacy !== undefined) {
    const result = resolveDietOfWorms(state, helpers);
    return { resolved: true, result };
  }

  return { resolved: false };
}

/**
 * Resolve the Diet of Worms once all cards are committed.
 * @param {Object} state
 * @param {Object} helpers
 * @returns {{ protestantHits: number, catholicHits: number, spacesFlipped: string[] }}
 */
function resolveDietOfWorms(state, helpers) {
  const { cards } = state.pendingDietOfWorms;

  const protCard = CARD_BY_NUMBER[cards.protestant];
  const hapCard = CARD_BY_NUMBER[cards.hapsburg];
  const papCard = CARD_BY_NUMBER[cards.papacy];

  const protCP = protCard?.cp || 0;
  const hapCP = hapCard?.cp || 0;
  const papCP = papCard?.cp || 0;

  // Protestant rolls CP + 4 dice
  const protDice = rollDice(protCP + 4);
  const protHits = protDice.filter(d => d >= 5).length;

  // Catholic: Hapsburg + Papacy combined
  const hapDice = rollDice(Math.max(1, hapCP));
  const papDice = rollDice(Math.max(1, papCP));
  const catholicHits = hapDice.filter(d => d >= 5).length +
    papDice.filter(d => d >= 5).length;

  const diff = Math.abs(protHits - catholicHits);
  const spacesFlipped = [];

  if (protHits > catholicHits) {
    // Protestant victory: flip diff spaces to Protestant in German zone
    flipSpaces(state, diff, RELIGION.PROTESTANT, spacesFlipped);
  } else if (catholicHits > protHits) {
    // Catholic victory: flip diff spaces to Catholic in German zone
    flipSpaces(state, diff, RELIGION.CATHOLIC, spacesFlipped);
  }
  // Tie: no effect

  recountProtestantSpaces(state);

  state.pendingDietOfWorms.resolved = true;
  state.pendingDietOfWorms = null;
  state.dietOfWormsResolved = true;

  helpers.logEvent(state, 'diet_of_worms_resolved', {
    protestantHits: protHits, catholicHits,
    protDice, hapDice, papDice,
    spacesFlipped, winner: protHits > catholicHits ? 'protestant' :
      catholicHits > protHits ? 'catholic' : 'draw'
  });

  return { protestantHits: protHits, catholicHits, spacesFlipped };
}

/**
 * Flip spaces in the German zone for Diet of Worms resolution.
 * Must be adjacent to an existing space of the target religion.
 * @param {Object} state
 * @param {number} count - Number of spaces to flip
 * @param {string} toReligion - RELIGION.PROTESTANT or RELIGION.CATHOLIC
 * @param {string[]} flipped - Array to collect flipped space names
 */
function flipSpaces(state, count, toReligion, flipped) {
  const fromReligion = toReligion === RELIGION.PROTESTANT
    ? RELIGION.CATHOLIC : RELIGION.PROTESTANT;

  for (let i = 0; i < count; i++) {
    // Find a valid space: German zone, currently fromReligion,
    // adjacent to a toReligion space (including just-flipped ones)
    let found = false;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.languageZone !== 'german') continue;
      if (sp.religion !== fromReligion) continue;

      const adj = getAllAdjacentSpaces(name);
      const hasAdjacentTarget = adj.some(adjName => {
        const adjSp = state.spaces[adjName];
        return adjSp && adjSp.religion === toReligion;
      });

      if (hasAdjacentTarget) {
        sp.religion = toReligion;
        flipped.push(name);
        found = true;
        break;
      }
    }
    if (!found) break; // No more valid spaces
  }
}

/**
 * Check if the Diet of Worms phase is complete.
 * @param {Object} state
 * @returns {boolean}
 */
export function isDietComplete(state) {
  return !state.pendingDietOfWorms;
}

/**
 * Check if a power still needs to submit a card.
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function needsDietCard(state, power) {
  if (!state.pendingDietOfWorms) return false;
  if (!['protestant', 'hapsburg', 'papacy'].includes(power)) return false;
  return state.pendingDietOfWorms.cards[power] === undefined;
}
