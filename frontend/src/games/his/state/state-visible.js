/**
 * Here I Stand — Visible State Filter
 *
 * Masks secret information (other powers' hands, deck contents)
 * before sending state to a player's UI.
 */

import { MAJOR_POWERS } from '../constants.js';

/**
 * Create a player-visible copy of the game state.
 * Other powers' hands are replaced with card counts.
 * Deck is replaced with its size.
 * @param {Object} state - Full game state
 * @param {string} playerId - The player requesting the view
 * @returns {Object} Filtered state safe to send to this player
 */
export function getVisibleState(state, playerId) {
  const clone = JSON.parse(JSON.stringify(state));
  const myPowers = new Set(
    clone.powersForPlayer?.[playerId]
    || (clone.powerByPlayer[playerId] ? [clone.powerByPlayer[playerId]] : [])
  );

  // Replace other powers' hands with card counts
  for (const power of MAJOR_POWERS) {
    if (!myPowers.has(power)) {
      clone.hands[power] = clone.hands[power].length;
    }
  }

  // Hide deck contents (show only count)
  clone.deck = clone.deck.length;

  // Hide discard pile order (keep as count for now)
  clone.discard = clone.discard.length;

  // Two-player variant: mask the opponent side's secret Diplomatic hand (and the
  // deck order) the same way. Only present when the diplomacy-deck subsystem is
  // active (the 2P variant); in hotseat the local seat controls both sides, so
  // `myPowers` covers both and nothing is hidden.
  if (clone.diplomacyHands) {
    for (const side of ['papacy', 'protestant']) {
      if (!myPowers.has(side) && Array.isArray(clone.diplomacyHands[side])) {
        clone.diplomacyHands[side] = clone.diplomacyHands[side].length;
      }
    }
    if (Array.isArray(clone.diplomacyDeck)) clone.diplomacyDeck = clone.diplomacyDeck.length;
  }

  return clone;
}
