/**
 * Here I Stand — Spring Deployment Phase
 *
 * Each power (in impulse order) may make one free formation move
 * from a capital to a friendly-controlled destination.
 *
 * Rules:
 * - Protestant cannot deploy (no capital)
 * - Hapsburg can deploy from either Vienna or Brussels
 * - Path must be through friendly-controlled spaces (simplified: just origin + destination)
 * - No pass crossings allowed
 * - Optional: one sea zone crossing (simplified for Phase 4)
 */

import { CAPITALS, IMPULSE_ORDER } from '../constants.js';
import {
  getUnitsInSpace, countLandUnits, getConnectionType,
  getFormationCap
} from '../state/state-helpers.js';

/**
 * Initialize spring deployment phase.
 * @param {Object} state
 * @param {Object} helpers
 */
export function initSpringDeployment(state, helpers) {
  state.springDeploymentDone = {};
  helpers.logEvent(state, 'spring_deployment_start', {});
}

/**
 * Validate a spring deployment action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { from, to, units: { regulars, mercenaries, cavalry, leaders } }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSpringDeployment(state, power, actionData) {
  const { from, to, units } = actionData;
  if (!from || !to) return { valid: false, error: 'Missing from/to' };
  if (!units) return { valid: false, error: 'Missing units' };

  // Already deployed this phase
  if (state.springDeploymentDone && state.springDeploymentDone[power]) {
    return { valid: false, error: 'Already deployed this phase' };
  }

  // Protestant cannot deploy
  const capitals = CAPITALS[power];
  if (!capitals || capitals.length === 0) {
    return { valid: false, error: 'No capital for deployment' };
  }

  // Must deploy from a capital
  if (!capitals.includes(from)) {
    return { valid: false, error: `Must deploy from a capital (${capitals.join(' or ')})` };
  }

  // Source capital must be friendly-controlled
  const fromSp = state.spaces[from];
  if (!fromSp) return { valid: false, error: `Space "${from}" not found` };
  if (fromSp.controller !== power) {
    return { valid: false, error: 'Capital not under your control' };
  }

  // Destination must exist and be friendly-controlled
  const toSp = state.spaces[to];
  if (!toSp) return { valid: false, error: `Space "${to}" not found` };
  if (toSp.controller !== power) {
    return { valid: false, error: 'Destination not under your control' };
  }

  // No unrest at destination
  if (toSp.unrest) {
    return { valid: false, error: 'Cannot deploy to space with unrest' };
  }

  // Check connection type — no passes
  const connType = getConnectionType(from, to);
  if (!connType) {
    return { valid: false, error: `${from} and ${to} are not adjacent` };
  }
  if (connType === 'pass') {
    return { valid: false, error: 'Cannot deploy over a pass' };
  }

  // Check source has the units
  const stack = getUnitsInSpace(state, from, power);
  if (!stack) return { valid: false, error: `No units in ${from}` };

  const moveRegs = units.regulars || 0;
  const moveMercs = units.mercenaries || 0;
  const moveCav = units.cavalry || 0;
  const moveLeaders = units.leaders || [];

  if (moveRegs > stack.regulars) return { valid: false, error: 'Not enough regulars' };
  if (moveMercs > stack.mercenaries) return { valid: false, error: 'Not enough mercenaries' };
  if (moveCav > stack.cavalry) return { valid: false, error: 'Not enough cavalry' };

  for (const lid of moveLeaders) {
    if (!stack.leaders.includes(lid)) {
      return { valid: false, error: `Leader ${lid} not in ${from}` };
    }
  }

  // Formation cap
  const totalUnits = moveRegs + moveMercs + moveCav;
  const cap = getFormationCap(moveLeaders);
  if (totalUnits > cap) {
    return { valid: false, error: `Exceeds formation cap (${totalUnits} > ${cap})` };
  }

  return { valid: true };
}

/**
 * Execute a spring deployment move.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { from, to, units }
 * @param {Object} helpers
 */
export function executeSpringDeployment(state, power, actionData, helpers) {
  const { from, to, units } = actionData;

  // Remove from source
  const srcStack = getUnitsInSpace(state, from, power);
  srcStack.regulars -= (units.regulars || 0);
  srcStack.mercenaries -= (units.mercenaries || 0);
  srcStack.cavalry -= (units.cavalry || 0);
  for (const lid of (units.leaders || [])) {
    const idx = srcStack.leaders.indexOf(lid);
    if (idx !== -1) srcStack.leaders.splice(idx, 1);
  }

  // Remove empty stacks
  if (countLandUnits(srcStack) === 0 && srcStack.leaders.length === 0 &&
      (srcStack.squadrons || 0) === 0 && (srcStack.corsairs || 0) === 0) {
    const srcSpace = state.spaces[from];
    srcSpace.units = srcSpace.units.filter(u => u !== srcStack);
  }

  // Add to destination
  let dstStack = getUnitsInSpace(state, to, power);
  if (!dstStack) {
    dstStack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    state.spaces[to].units.push(dstStack);
  }
  dstStack.regulars += (units.regulars || 0);
  dstStack.mercenaries += (units.mercenaries || 0);
  dstStack.cavalry += (units.cavalry || 0);
  for (const lid of (units.leaders || [])) {
    dstStack.leaders.push(lid);
  }

  // Mark as deployed
  if (!state.springDeploymentDone) state.springDeploymentDone = {};
  state.springDeploymentDone[power] = true;

  helpers.logEvent(state, 'spring_deployment', { power, from, to, units });
}

/**
 * Check if all powers have completed spring deployment (or skipped).
 * @param {Object} state
 * @returns {boolean}
 */
export function isSpringDeploymentComplete(state) {
  for (const power of IMPULSE_ORDER) {
    if (!state.springDeploymentDone || !state.springDeploymentDone[power]) {
      return false;
    }
  }
  return true;
}

/**
 * Mark a power as having skipped spring deployment.
 * @param {Object} state
 * @param {string} power
 */
export function skipSpringDeployment(state, power) {
  if (!state.springDeploymentDone) state.springDeploymentDone = {};
  state.springDeploymentDone[power] = true;
}
