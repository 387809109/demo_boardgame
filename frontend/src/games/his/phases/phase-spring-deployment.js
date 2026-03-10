/**
 * Here I Stand - Spring Deployment Phase
 *
 * Each power (in impulse order) may make one free formation move
 * from a capital to a friendly-controlled destination.
 */

import { CAPITALS, IMPULSE_ORDER, MAJOR_POWERS } from '../constants.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { LAND_ADJACENCY, PORTS_BY_SEA_ZONE } from '../data/map-data.js';
import { getUnitsInSpace, countLandUnits, getFormationCap } from '../state/state-helpers.js';
import { getAlliesOf } from '../state/war-helpers.js';

function getFriendlyPowers(state, power) {
  return new Set([power, ...getAlliesOf(state, power)]);
}

function isFriendlyController(space, friendlyPowers) {
  return Boolean(space && friendlyPowers.has(space.controller));
}

function stackHasAnyUnits(stack) {
  if (!stack) return false;
  return (
    (stack.regulars || 0) > 0 ||
    (stack.mercenaries || 0) > 0 ||
    (stack.cavalry || 0) > 0 ||
    (stack.squadrons || 0) > 0 ||
    (stack.corsairs || 0) > 0 ||
    (stack.leaders || []).length > 0
  );
}

function hasUnfriendlyUnitsInSpace(state, spaceName, friendlyPowers) {
  const sp = state.spaces[spaceName];
  if (!sp || !sp.units) return false;
  return sp.units.some(stack => stackHasAnyUnits(stack) && !friendlyPowers.has(stack.owner));
}

function isValidLandStep(state, spaceName, friendlyPowers) {
  const sp = state.spaces[spaceName];
  if (!sp) return false;
  if (!isFriendlyController(sp, friendlyPowers)) return false;
  if (sp.unrest) return false;
  if (hasUnfriendlyUnitsInSpace(state, spaceName, friendlyPowers)) return false;
  return true;
}

function hasBlockingMajorNavalPresence(state, seaZone, deployingPower) {
  const ports = PORTS_BY_SEA_ZONE[seaZone] || [];
  for (const portName of ports) {
    const sp = state.spaces[portName];
    if (!sp || !sp.units) continue;

    for (const stack of sp.units) {
      if (!MAJOR_POWERS.includes(stack.owner)) continue;
      if (stack.owner === deployingPower) continue;
      if ((stack.squadrons || 0) > 0 || (stack.corsairs || 0) > 0) {
        return true;
      }
    }
  }
  return false;
}

function canTraceSpringDeploymentPath(state, power, from, to, options) {
  const {
    allowPassCrossing,
    ignoreSeaBlockers,
    landUnits
  } = options;

  const friendlyPowers = getFriendlyPowers(state, power);
  const allowSeaCrossing = options.ignoreSeaUnitLimit || landUnits <= 5;

  if (!isValidLandStep(state, from, friendlyPowers)) return { ok: false };
  if (!isValidLandStep(state, to, friendlyPowers)) return { ok: false };

  const queue = [{ space: from, usedSea: false }];
  const visited = new Set([`${from}|0`]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.space === to) {
      return { ok: true, usedSea: current.usedSea };
    }

    const adj = LAND_ADJACENCY[current.space] || { connections: [], passes: [] };
    const landNeighbors = allowPassCrossing
      ? [...adj.connections, ...adj.passes]
      : [...adj.connections];

    for (const next of landNeighbors) {
      const key = `${next}|${current.usedSea ? 1 : 0}`;
      if (visited.has(key)) continue;
      if (!isValidLandStep(state, next, friendlyPowers)) continue;
      visited.add(key);
      queue.push({ space: next, usedSea: current.usedSea });
    }

    if (current.usedSea || !allowSeaCrossing) continue;

    const currentSpace = state.spaces[current.space];
    if (!currentSpace || !currentSpace.isPort) continue;

    for (const seaZone of (currentSpace.connectedSeaZones || [])) {
      if (!ignoreSeaBlockers && hasBlockingMajorNavalPresence(state, seaZone, power)) {
        continue;
      }

      for (const portName of (PORTS_BY_SEA_ZONE[seaZone] || [])) {
        if (portName === current.space) continue;

        const key = `${portName}|1`;
        if (visited.has(key)) continue;
        if (!isValidLandStep(state, portName, friendlyPowers)) continue;

        visited.add(key);
        queue.push({ space: portName, usedSea: true });
      }
    }
  }

  return { ok: false };
}

/**
 * Initialize spring deployment phase.
 * @param {Object} state
 * @param {Object} helpers
 */
export function initSpringDeployment(state, helpers) {
  state.springDeploymentDone = {};
  state.impulseIndex = 0;
  state.activePower = IMPULSE_ORDER[0];
  state.enhancedSpringDeployment = null;
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
  if (from === to) return { valid: false, error: 'Source and destination must differ' };
  if (!units) return { valid: false, error: 'Missing units' };
  if (state.activePower && state.activePower !== power) {
    return { valid: false, error: 'Not your spring deployment impulse' };
  }

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

  const friendlyPowers = getFriendlyPowers(state, power);

  // Source capital must be controlled by deploying power
  const fromSp = state.spaces[from];
  if (!fromSp) return { valid: false, error: `Space "${from}" not found` };
  if (fromSp.controller !== power) {
    return { valid: false, error: 'Capital not under your control' };
  }
  if (fromSp.unrest) {
    return { valid: false, error: 'Cannot deploy from space with unrest' };
  }

  // Destination must exist and be friendly-controlled
  const toSp = state.spaces[to];
  if (!toSp) return { valid: false, error: `Space "${to}" not found` };
  if (!friendlyPowers.has(toSp.controller)) {
    return { valid: false, error: 'Destination not friendly-controlled' };
  }

  // No unrest at destination
  if (toSp.unrest) {
    return { valid: false, error: 'Cannot deploy to space with unrest' };
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
    const def = LEADER_BY_ID[lid];
    if (!def || def.type !== 'army') {
      return { valid: false, error: `Leader ${lid} is not an army leader` };
    }
  }

  // Formation cap
  const totalUnits = moveRegs + moveMercs + moveCav;
  if (totalUnits + moveLeaders.length === 0) {
    return { valid: false, error: 'Must move at least one unit or army leader' };
  }
  const cap = getFormationCap(moveLeaders);
  if (totalUnits > cap) {
    return { valid: false, error: `Exceeds formation cap (${totalUnits} > ${cap})` };
  }

  const enhanced = state.enhancedSpringDeployment === power;
  const path = canTraceSpringDeploymentPath(state, power, from, to, {
    allowPassCrossing: enhanced,
    ignoreSeaBlockers: enhanced,
    ignoreSeaUnitLimit: enhanced,
    landUnits: totalUnits
  });

  if (!path.ok) {
    return { valid: false, error: 'No valid spring deployment path' };
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
