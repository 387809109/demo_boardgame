/**
 * Here I Stand — State Query Helpers
 *
 * Pure functions that query game state. No mutations.
 */

import {
  MAJOR_POWERS, IMPULSE_ORDER, RULERS,
  KEY_VP_TRACK, PROTESTANT_CARD_DRAW,
  CARD_TYPE
} from '../constants.js';
import { CARDS, CARD_BY_NUMBER } from '../data/cards.js';

/**
 * Get the power assigned to a player.
 * @param {Object} state
 * @param {string} playerId
 * @returns {string|null} Power name or null
 */
export function getPowerForPlayer(state, playerId) {
  return state.powerByPlayer[playerId] || null;
}

/**
 * Get the player assigned to a power.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Player ID or null
 */
export function getPlayerForPower(state, power) {
  return state.playerByPower[power] || null;
}

/**
 * Count key spaces controlled by a power.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function countKeysForPower(state, power) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.isKey && sp.controller === power) count++;
  }
  return count;
}

/**
 * Count electorates under a power's political control.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function countElectoratesForPower(state, power) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.isElectorate && sp.controller === power) count++;
  }
  return count;
}

/**
 * Get the active ruler object for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {Object} Ruler object with { id, name, battle, command, admin, cardBonus }
 */
export function getActiveRuler(state, power) {
  const rulerId = state.rulers[power];
  const rulers = RULERS[power];
  return rulers.find(r => r.id === rulerId) || rulers[0];
}

/**
 * Get the number of cards a power should draw.
 * Non-Protestant: from KEY_VP_TRACK based on key count + ruler cardBonus.
 * Protestant: fixed 4 or 5 based on electorate control.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function getCardDrawCount(state, power) {
  const ruler = getActiveRuler(state, power);

  if (power === 'protestant') {
    const electorates = countElectoratesForPower(state, 'protestant');
    const base = electorates >= PROTESTANT_CARD_DRAW.electorateThreshold
      ? PROTESTANT_CARD_DRAW.withElectorates
      : PROTESTANT_CARD_DRAW.base;
    return base + ruler.cardBonus;
  }

  const track = KEY_VP_TRACK[power];
  if (!track) return 1;

  const keys = countKeysForPower(state, power);
  const clampedKeys = Math.min(keys, track.cards.length - 1);
  const baseCards = Math.max(track.cards[clampedKeys], 1);
  return baseCards + ruler.cardBonus;
}

/**
 * Get VP from key control for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function getKeyVp(state, power) {
  if (power === 'protestant') return 0; // Protestant VP from spaces track, not keys
  const track = KEY_VP_TRACK[power];
  if (!track) return 0;
  const keys = countKeysForPower(state, power);
  const clamped = Math.min(keys, track.vp.length - 1);
  return track.vp[clamped];
}

/**
 * Check whether a power can pass in the action phase.
 * Cannot pass if: home card in hand, mandatory event in hand, or hand size > admin rating.
 * @param {Object} state
 * @param {string} power
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canPass(state, power) {
  const hand = state.hands[power];
  if (!hand) return { allowed: true };

  // Check home cards
  for (const cardNum of hand) {
    const card = CARD_BY_NUMBER[cardNum];
    if (!card) continue;
    if (card.deck === 'home') {
      return { allowed: false, reason: 'Must play home card before passing' };
    }
  }

  // Check mandatory events
  for (const cardNum of hand) {
    const card = CARD_BY_NUMBER[cardNum];
    if (!card) continue;
    if (card.category === 'MANDATORY') {
      return { allowed: false, reason: 'Must play mandatory event before passing' };
    }
  }

  // Check hand size vs admin rating
  const ruler = getActiveRuler(state, power);
  if (hand.length > ruler.admin) {
    return {
      allowed: false,
      reason: `Hand size (${hand.length}) exceeds admin rating (${ruler.admin})`
    };
  }

  return { allowed: true };
}

/**
 * Get the next power in impulse order after the current one.
 * @param {Object} state
 * @returns {string} Next power
 */
export function getNextImpulsePower(state) {
  const nextIndex = (state.impulseIndex + 1) % IMPULSE_ORDER.length;
  return IMPULSE_ORDER[nextIndex];
}

/**
 * Check if a card number is in any tracked location (deck, hands, discard, removed).
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function isCardInPlay(state, cardNumber) {
  if (state.deck.includes(cardNumber)) return true;
  if (state.discard.includes(cardNumber)) return true;
  if (state.removedCards.includes(cardNumber)) return true;
  for (const power of MAJOR_POWERS) {
    if (state.hands[power].includes(cardNumber)) return true;
  }
  return false;
}
