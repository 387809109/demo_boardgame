/**
 * Here I Stand — Reformer Helpers
 *
 * Reformers are on-map markers tracked via space.reformer property.
 * They affect reformation/counter-reformation dice calculations.
 *
 * Key reformers: Luther (Wittenberg), Zwingli (Zurich), Calvin (Geneva)
 */

import { getAllAdjacentSpaces, getAdjacentSpaces } from './state-helpers.js';

/**
 * Place a reformer on the map.
 * @param {Object} state
 * @param {string} reformerId
 * @param {string} spaceName
 */
export function placeReformer(state, reformerId, spaceName) {
  // Remove from any existing location first
  removeReformer(state, reformerId);

  const sp = state.spaces[spaceName];
  if (sp) {
    sp.reformer = reformerId;
  }
}

/**
 * Remove a reformer from the map.
 * @param {Object} state
 * @param {string} reformerId
 */
export function removeReformer(state, reformerId) {
  for (const sp of Object.values(state.spaces)) {
    if (sp.reformer === reformerId) {
      sp.reformer = null;
      return;
    }
  }
}

/**
 * Get the reformer in a space (if any).
 * @param {Object} state
 * @param {string} spaceName
 * @returns {string|null} Reformer ID or null
 */
export function getReformerInSpace(state, spaceName) {
  const sp = state.spaces[spaceName];
  return sp?.reformer || null;
}

/**
 * Find the space a reformer is currently in.
 * @param {Object} state
 * @param {string} reformerId
 * @returns {string|null} Space name or null
 */
export function getReformerLocation(state, reformerId) {
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.reformer === reformerId) return name;
  }
  return null;
}

/**
 * Get all reformer IDs in spaces adjacent to the given space.
 * @param {Object} state
 * @param {string} spaceName
 * @returns {string[]} Array of reformer IDs
 */
export function getAdjacentReformers(state, spaceName) {
  const adjacent = getAllAdjacentSpaces(spaceName);
  const reformers = [];
  for (const adjName of adjacent) {
    const sp = state.spaces[adjName];
    if (sp?.reformer) {
      reformers.push(sp.reformer);
    }
  }
  return reformers;
}

/**
 * Calculate dice bonus from reformers for reformation/counter-reformation.
 *
 * Per rulebook 18.3:
 * - +2 dice if reformer is in the target space itself
 * - +1 die per adjacent reformer (connections only, NOT passes or unrest spaces)
 *
 * @param {Object} state
 * @param {string} targetSpace
 * @returns {{ adjacentBonus: number, inSpaceBonus: number, total: number }}
 */
export function getReformerDiceBonus(state, targetSpace) {
  let adjacentBonus = 0;
  let inSpaceBonus = 0;

  // Check target space for reformer
  const targetReformer = getReformerInSpace(state, targetSpace);
  if (targetReformer) {
    inSpaceBonus = 2;
  }

  // Check adjacent spaces for reformers (connections only, not passes)
  // Per 18.3: "隔山口、或处于动乱空间内的邻接空间/改革家/单位堆不提供加骰"
  const adj = getAdjacentSpaces(targetSpace);
  for (const adjName of adj.connections) {
    const sp = state.spaces?.[adjName];
    if (!sp) continue;
    if (sp.unrest) continue; // unrest spaces don't provide bonuses
    if (sp.reformer) {
      adjacentBonus++;
    }
  }

  return {
    adjacentBonus,
    inSpaceBonus,
    total: adjacentBonus + inSpaceBonus
  };
}
