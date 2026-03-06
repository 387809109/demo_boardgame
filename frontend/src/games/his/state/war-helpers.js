/**
 * Here I Stand — War & Alliance Helpers
 *
 * Query functions for diplomatic state: wars, alliances, minor powers.
 */

import { MINOR_POWERS } from '../constants.js';

// ── War Queries ─────────────────────────────────────────────────

/**
 * Check if two powers are at war.
 * @param {Object} state
 * @param {string} powerA
 * @param {string} powerB
 * @returns {boolean}
 */
export function areAtWar(state, powerA, powerB) {
  return state.wars.some(
    w => (w.a === powerA && w.b === powerB) ||
         (w.a === powerB && w.b === powerA)
  );
}

/**
 * Get all powers that a given power is at war with.
 * @param {Object} state
 * @param {string} power
 * @returns {string[]}
 */
export function getWarsOf(state, power) {
  const enemies = [];
  for (const w of state.wars) {
    if (w.a === power) enemies.push(w.b);
    else if (w.b === power) enemies.push(w.a);
  }
  return enemies;
}

/**
 * Add a war between two powers.
 * No-op if already at war.
 * @param {Object} state
 * @param {string} powerA
 * @param {string} powerB
 */
export function addWar(state, powerA, powerB) {
  if (areAtWar(state, powerA, powerB)) return;
  state.wars.push({ a: powerA, b: powerB });
}

/**
 * Remove a war between two powers.
 * @param {Object} state
 * @param {string} powerA
 * @param {string} powerB
 */
export function removeWar(state, powerA, powerB) {
  state.wars = state.wars.filter(
    w => !((w.a === powerA && w.b === powerB) ||
           (w.a === powerB && w.b === powerA))
  );
}

// ── Alliance Queries ────────────────────────────────────────────

/**
 * Check if two powers are allied.
 * @param {Object} state
 * @param {string} powerA
 * @param {string} powerB
 * @returns {boolean}
 */
export function areAllied(state, powerA, powerB) {
  return state.alliances.some(
    a => (a.a === powerA && a.b === powerB) ||
         (a.a === powerB && a.b === powerA)
  );
}

/**
 * Get all allies of a power.
 * @param {Object} state
 * @param {string} power
 * @returns {string[]}
 */
export function getAlliesOf(state, power) {
  const allies = [];
  for (const a of state.alliances) {
    if (a.a === power) allies.push(a.b);
    else if (a.b === power) allies.push(a.a);
  }
  return allies;
}

/**
 * Add an alliance between two powers.
 * @param {Object} state
 * @param {string} powerA
 * @param {string} powerB
 */
export function addAlliance(state, powerA, powerB) {
  if (areAllied(state, powerA, powerB)) return;
  state.alliances.push({ a: powerA, b: powerB });
}

/**
 * Remove an alliance between two powers.
 * @param {Object} state
 * @param {string} powerA
 * @param {string} powerB
 */
export function removeAlliance(state, powerA, powerB) {
  state.alliances = state.alliances.filter(
    a => !((a.a === powerA && a.b === powerB) ||
           (a.a === powerB && a.b === powerA))
  );
}

// ── Minor Power Queries ─────────────────────────────────────────

/**
 * Check if a power ID is a minor power.
 * @param {string} power
 * @returns {boolean}
 */
export function isMinorPower(power) {
  return MINOR_POWERS.includes(power);
}

/**
 * Get which major power a minor power is allied to (active status).
 * Returns null if minor is inactive.
 * @param {Object} state
 * @param {string} minorPower
 * @returns {string|null}
 */
export function getMinorAlly(state, minorPower) {
  for (const a of state.alliances) {
    if (a.a === minorPower && !MINOR_POWERS.includes(a.b)) return a.b;
    if (a.b === minorPower && !MINOR_POWERS.includes(a.a)) return a.a;
  }
  return null;
}

/**
 * Check if a minor power is active (allied to a major power).
 * @param {Object} state
 * @param {string} minorPower
 * @returns {boolean}
 */
export function isMinorActive(state, minorPower) {
  return getMinorAlly(state, minorPower) !== null;
}

// ── Composite Queries ───────────────────────────────────────────

/**
 * Check if a power can attack another (are at war, directly or via minors).
 * A major power at war with a minor's ally is also at war with that minor.
 * @param {Object} state
 * @param {string} attacker
 * @param {string} target
 * @returns {boolean}
 */
export function canAttack(state, attacker, target) {
  // Direct war
  if (areAtWar(state, attacker, target)) return true;

  // Attacker at war with minor's major ally
  if (isMinorPower(target)) {
    const ally = getMinorAlly(state, target);
    if (ally && areAtWar(state, attacker, ally)) return true;
  }

  // Target is a major, attacker is at war with target's allied minor
  // (doesn't make you at war with the major — only the minor fights)

  return false;
}

/**
 * Check if a space is controlled by a power that is an enemy of the given power.
 * Takes into account alliances (allied spaces are friendly).
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
export function isEnemyControlled(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp || !sp.controller) return false;
  if (sp.controller === power) return false;
  if (areAllied(state, sp.controller, power)) return false;
  return areAtWar(state, sp.controller, power) || canAttack(state, power, sp.controller);
}
