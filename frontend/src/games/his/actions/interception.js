/**
 * Here I Stand — Interception Mechanics
 *
 * When a formation moves into a space, adjacent enemy stacks may
 * attempt to intercept. Interceptions resolve by impulse order;
 * first successful intercept blocks others.
 */

import { IMPULSE_ORDER, COMBAT } from '../constants.js';
import {
  getAllAdjacentSpaces, getUnitsInSpace
} from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { rollDice } from './religious-actions.js';

// ── Check Interceptions ─────────────────────────────────────────

/**
 * Find powers that can attempt interception when a formation moves.
 * @param {Object} state
 * @param {string} fromSpace - Where the formation is moving from
 * @param {string} toSpace - Where the formation is moving to
 * @param {string} movingPower - The power that is moving
 * @returns {Array<{ power: string, space: string }>} Potential interceptors sorted by impulse order
 */
export function checkInterceptions(state, fromSpace, toSpace, movingPower) {
  const adjacent = getAllAdjacentSpaces(toSpace);
  const interceptors = [];

  for (const adjName of adjacent) {
    // Don't intercept from the source space
    if (adjName === fromSpace) continue;

    const sp = state.spaces[adjName];
    if (!sp) continue;

    // Check each unit stack in the adjacent space
    for (const stack of sp.units) {
      if (stack.owner === movingPower) continue;
      // Only powers at war with moving power can intercept
      // For Phase 3 we simplify: any non-allied power with units can intercept
      // (diplomacy/war checks come in Phase 4)
      if (stack.regulars + stack.mercenaries + stack.cavalry > 0) {
        // Don't add duplicates for same power
        if (!interceptors.find(i => i.power === stack.owner && i.space === adjName)) {
          interceptors.push({ power: stack.owner, space: adjName });
        }
      }
    }
  }

  // Sort by impulse order
  interceptors.sort((a, b) => {
    const ai = IMPULSE_ORDER.indexOf(a.power);
    const bi = IMPULSE_ORDER.indexOf(b.power);
    return ai - bi;
  });

  return interceptors;
}

// ── Resolve Interception ────────────────────────────────────────

/**
 * Resolve an interception attempt.
 * @param {Object} state
 * @param {string} interceptorPower
 * @param {string} interceptorSpace - Where the interceptor is
 * @param {string} targetSpace - The space being intercepted into
 * @param {Object} helpers
 * @returns {{ success: boolean, roll: number, threshold: number }}
 */
export function resolveInterception(state, interceptorPower, interceptorSpace,
  targetSpace, helpers) {
  const stack = getUnitsInSpace(state, interceptorSpace, interceptorPower);
  if (!stack) return { success: false, roll: 0, threshold: COMBAT.interceptionThreshold };

  // Base threshold: 5+
  let threshold = COMBAT.interceptionThreshold;

  // Leader modifier: highest battle rating reduces threshold
  let leaderBonus = 0;
  for (const lid of stack.leaders) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.battle > leaderBonus) {
      leaderBonus = leader.battle;
    }
  }
  threshold -= leaderBonus;

  const [roll] = rollDice(1);

  const success = roll >= threshold;

  if (success) {
    // Move interceptor into target space
    moveInterceptor(state, interceptorSpace, targetSpace, interceptorPower);
  }

  helpers.logEvent(state, 'interception_attempt', {
    interceptorPower, interceptorSpace, targetSpace,
    roll, threshold, success
  });

  return { success, roll, threshold };
}

/**
 * Move an intercepting stack into the battle space.
 * @param {Object} state
 * @param {string} fromSpace
 * @param {string} toSpace
 * @param {string} power
 */
function moveInterceptor(state, fromSpace, toSpace, power) {
  const srcStack = getUnitsInSpace(state, fromSpace, power);
  if (!srcStack) return;

  let dstStack = getUnitsInSpace(state, toSpace, power);
  if (!dstStack) {
    dstStack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    state.spaces[toSpace].units.push(dstStack);
  }

  dstStack.regulars += srcStack.regulars;
  dstStack.mercenaries += srcStack.mercenaries;
  dstStack.cavalry += srcStack.cavalry;
  for (const lid of srcStack.leaders) {
    dstStack.leaders.push(lid);
  }

  // Remove from source
  state.spaces[fromSpace].units = state.spaces[fromSpace].units.filter(
    u => u !== srcStack
  );
}
