/**
 * Here I Stand — Retreat & Withdrawal Logic
 *
 * After losing a field battle, the loser must retreat to an adjacent
 * legal space or withdraw into a fortification. If no legal option
 * exists, units are eliminated and leaders captured.
 */

import {
  getAllAdjacentSpaces, getUnitsInSpace, hasEnemyUnits,
  countLandUnits, isFortified
} from '../state/state-helpers.js';
import { areAllied } from '../state/war-helpers.js';
import { LAND_SPACES } from '../data/map-data.js';

/** Max units that can withdraw into a fortification */
const WITHDRAWAL_CAP = 4;

// ── Find Legal Retreats ─────────────────────────────────────────

/**
 * Find all legal retreat destinations from a space for a power.
 * Rules: adjacent land space, not enemy-occupied, not unrest,
 * not enemy-controlled (unless friendly units present).
 * @param {Object} state
 * @param {string} space
 * @param {string} power
 * @returns {string[]} Legal retreat destination names
 */
export function findLegalRetreats(state, space, power) {
  const adjacent = getAllAdjacentSpaces(space);
  const results = [];

  for (const adjName of adjacent) {
    const sp = state.spaces[adjName];
    if (!sp) continue;

    // No retreating into unrest
    if (sp.unrest) continue;

    // No retreating into enemy-occupied space
    if (hasEnemyUnits(state, adjName, power)) continue;

    // No retreating into enemy-controlled space
    // (allowed if controlled by self, ally, or has own units present)
    if (sp.controller !== power && sp.controller !== null) {
      if (!areAllied(state, sp.controller, power)) {
        const friendly = getUnitsInSpace(state, adjName, power);
        if (!friendly) continue;
      }
    }

    results.push(adjName);
  }

  return results;
}

// ── Withdraw Into Fortification ─────────────────────────────────

/**
 * Check if a power can withdraw into the fortification at a space.
 * @param {Object} state
 * @param {string} space
 * @param {string} power
 * @returns {boolean}
 */
export function canWithdrawIntoFortification(state, space, power) {
  const sp = state.spaces[space];
  if (!sp || !isFortified(sp)) return false;

  // Must be controlled by the withdrawing power or an allied power
  if (sp.controller !== power && !areAllied(state, sp.controller, power)) {
    return false;
  }

  // Max 4 units can occupy a fortification
  const existingUnits = sp.units.reduce(
    (sum, u) => sum + countLandUnits(u), 0
  );
  if (existingUnits >= WITHDRAWAL_CAP) return false;

  return true;
}

// ── Execute Retreat ─────────────────────────────────────────────

/**
 * Move a defeated formation to a retreat destination.
 * @param {Object} state
 * @param {string} fromSpace
 * @param {string} power
 * @param {string} destination
 * @param {Object} helpers
 */
export function executeRetreat(state, fromSpace, power, destination, helpers) {
  const srcStack = getUnitsInSpace(state, fromSpace, power);
  if (!srcStack) return;

  // Move all units to destination
  let dstStack = getUnitsInSpace(state, destination, power);
  if (!dstStack) {
    dstStack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    state.spaces[destination].units.push(dstStack);
  }

  dstStack.regulars += srcStack.regulars;
  dstStack.mercenaries += srcStack.mercenaries;
  dstStack.cavalry += srcStack.cavalry;
  for (const lid of srcStack.leaders) {
    dstStack.leaders.push(lid);
  }

  // Remove from source
  const srcSpace = state.spaces[fromSpace];
  srcSpace.units = srcSpace.units.filter(u => u !== srcStack);

  helpers.logEvent(state, 'retreat', { power, from: fromSpace, to: destination });
}

// ── Eliminate (No Retreat) ──────────────────────────────────────

/**
 * Eliminate a formation and capture its leaders when no retreat is available.
 * @param {Object} state
 * @param {string} space
 * @param {string} power - The power being eliminated
 * @param {string} capturingPower
 * @param {Object} helpers
 * @returns {{ eliminatedUnits: number, capturedLeaders: string[] }}
 */
export function eliminateFormation(state, space, power, capturingPower, helpers) {
  const stack = getUnitsInSpace(state, space, power);
  if (!stack) return { eliminatedUnits: 0, capturedLeaders: [] };

  const eliminated = countLandUnits(stack);
  const captured = [...stack.leaders];

  // Capture leaders
  if (captured.length > 0 && capturingPower) {
    if (!state.capturedLeaders[capturingPower]) {
      state.capturedLeaders[capturingPower] = [];
    }
    state.capturedLeaders[capturingPower].push(...captured);
  }

  // Remove stack
  const sp = state.spaces[space];
  sp.units = sp.units.filter(u => u !== stack);

  helpers.logEvent(state, 'eliminate_formation', {
    power, space, eliminated, capturedLeaders: captured
  });

  return { eliminatedUnits: eliminated, capturedLeaders: captured };
}
