/**
 * Here I Stand — New World Actions (Explore, Colonize, Conquer)
 *
 * These CP actions place "underway" markers during the Action Phase.
 * Resolution happens in the New World Phase (phase-new-world.js).
 *
 * Rules (§20):
 * - Only england, france, hapsburg may use these actions
 * - Each action once per turn per power
 * - Explore costs 2 CP; Colonize costs 2 (hapsburg) / 3 (england/france); Conquer costs 4 CP
 * - Explore requires available explorer in pool
 * - Conquer requires available conquistador/conquest marker
 * - Colonize limited to 2 colonies (eng/fra) or 3 (hap)
 */

import { ACTION_COSTS, NEW_WORLD_POWERS, COLONY_LIMITS } from '../constants.js';
import { EXPLORERS, CONQUISTADORS } from '../data/leaders.js';

// ── Explore ─────────────────────────────────────────────────────────

/**
 * Validate an Explore action.
 * @param {Object} state
 * @param {string} power
 * @returns {{ valid: boolean, cost?: number, error?: string }}
 */
export function validateExplore(state, power) {
  if (!NEW_WORLD_POWERS.includes(power)) {
    return { valid: false, error: 'Power cannot explore' };
  }

  const cost = ACTION_COSTS[power].explore;
  if (cost === null) return { valid: false, error: 'Power cannot explore' };

  if (state.newWorld.exploredThisTurn[power]) {
    return { valid: false, error: 'Already explored this turn' };
  }

  // Must have available explorer (not dead, not on map, not underway)
  const available = getAvailableExplorers(state, power);
  if (available.length === 0) {
    return { valid: false, error: 'No available explorers' };
  }

  return { valid: true, cost };
}

/**
 * Execute an Explore action — place underway marker.
 * @param {Object} state
 * @param {string} power
 * @param {Object} helpers
 */
export function executeExplore(state, power, helpers) {
  state.newWorld.exploredThisTurn[power] = true;
  state.newWorld.underwayExplorations.push({ power });

  helpers.logEvent(state, 'explore_underway', { power });
}

// ── Colonize ────────────────────────────────────────────────────────

/**
 * Validate a Colonize action.
 * @param {Object} state
 * @param {string} power
 * @returns {{ valid: boolean, cost?: number, error?: string }}
 */
export function validateColonize(state, power) {
  if (!NEW_WORLD_POWERS.includes(power)) {
    return { valid: false, error: 'Power cannot colonize' };
  }

  const cost = ACTION_COSTS[power].colonize;
  if (cost === null) return { valid: false, error: 'Power cannot colonize' };

  if (state.newWorld.colonizedThisTurn[power]) {
    return { valid: false, error: 'Already colonized this turn' };
  }

  // Check colony limit
  const currentColonies = state.newWorld.colonies.filter(c => c.power === power).length;
  const crossingColonies = state.newWorld.underwayColonies.filter(c => c.power === power).length;
  const limit = COLONY_LIMITS[power] || 2;
  if (currentColonies + crossingColonies >= limit) {
    return { valid: false, error: `Colony limit reached (${limit})` };
  }

  return { valid: true, cost };
}

/**
 * Execute a Colonize action — place colony in crossing atlantic.
 * @param {Object} state
 * @param {string} power
 * @param {Object} helpers
 */
export function executeColonize(state, power, helpers) {
  state.newWorld.colonizedThisTurn[power] = true;
  state.newWorld.underwayColonies.push({ power });

  helpers.logEvent(state, 'colonize_underway', { power });
}

// ── Conquer ─────────────────────────────────────────────────────────

/**
 * Validate a Conquer action.
 * @param {Object} state
 * @param {string} power
 * @returns {{ valid: boolean, cost?: number, error?: string }}
 */
export function validateConquer(state, power) {
  if (!NEW_WORLD_POWERS.includes(power)) {
    return { valid: false, error: 'Power cannot conquer' };
  }

  const cost = ACTION_COSTS[power].conquer;
  if (cost === null) return { valid: false, error: 'Power cannot conquer' };

  if (state.newWorld.conqueredThisTurn[power]) {
    return { valid: false, error: 'Already conquered this turn' };
  }

  // Hapsburg needs available conquistador; england/france use conquest markers
  if (power === 'hapsburg') {
    const available = getAvailableConquistadors(state);
    if (available.length === 0) {
      return { valid: false, error: 'No available conquistadors' };
    }
  }

  return { valid: true, cost };
}

/**
 * Execute a Conquer action — place conquest underway marker.
 * @param {Object} state
 * @param {string} power
 * @param {Object} helpers
 */
export function executeConquer(state, power, helpers) {
  state.newWorld.conqueredThisTurn[power] = true;
  state.newWorld.underwayConquests.push({ power });

  helpers.logEvent(state, 'conquer_underway', { power });
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Get available explorers for a power (not dead, not on map).
 */
export function getAvailableExplorers(state, power) {
  const allForPower = EXPLORERS.filter(e => e.faction === power);
  const usedIds = new Set([
    ...state.newWorld.deadExplorers,
    ...state.newWorld.placedExplorers.map(e => e.explorerId)
  ]);
  return allForPower.filter(e => !usedIds.has(e.id));
}

/**
 * Get available conquistadors (Hapsburg only, not dead, not on map).
 */
export function getAvailableConquistadors(state) {
  const usedIds = new Set([
    ...state.newWorld.deadConquistadors,
    ...state.newWorld.placedConquistadors.map(c => c.conquistadorId)
  ]);
  return CONQUISTADORS.filter(c => !usedIds.has(c.id));
}
