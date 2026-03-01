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
  const myPower = clone.powerByPlayer[playerId];

  // Replace other powers' hands with card counts
  for (const power of MAJOR_POWERS) {
    if (power !== myPower) {
      clone.hands[power] = clone.hands[power].length;
    }
  }

  // Hide deck contents (show only count)
  clone.deck = clone.deck.length;

  // Hide discard pile order (keep as count for now)
  clone.discard = clone.discard.length;

  return clone;
}
