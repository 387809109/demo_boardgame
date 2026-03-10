/**
 * Here I Stand — Military CP Actions
 *
 * Movement, building units, controlling spaces.
 */

import { ACTION_COSTS, CAPITALS } from '../constants.js';
import { spendCp } from './cp-manager.js';
import {
  getAdjacentSpaces, getConnectionType,
  getUnitsInSpace, hasEnemyUnits,
  getFormationCap, countLandUnits, isHomeSpace
} from '../state/state-helpers.js';
import { canAttack, getAlliesOf } from '../state/war-helpers.js';
import { SEA_EDGES, SEA_ZONES, PORTS_BY_SEA_ZONE } from '../data/map-data.js';

const SEA_ADJACENCY = (() => {
  const adj = {};
  for (const seaZone of SEA_ZONES) adj[seaZone] = [];
  for (const { a, b } of SEA_EDGES) {
    if (adj[a]) adj[a].push(b);
    if (adj[b]) adj[b].push(a);
  }
  return adj;
})();

function getFriendlyPowers(state, power) {
  return new Set([power, ...getAlliesOf(state, power)]);
}

function stackHasAnyUnitsOrLeaders(stack) {
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

function stackHasLandUnits(stack) {
  if (!stack) return false;
  return (stack.regulars || 0) > 0 ||
    (stack.mercenaries || 0) > 0 ||
    (stack.cavalry || 0) > 0;
}

function hasPowerLandUnitsInSpace(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp || !sp.units) return false;
  return sp.units.some(stack => stack.owner === power && stackHasLandUnits(stack));
}

function hasNonFriendlyLandUnitsInSpace(state, spaceName, friendlyPowers) {
  const sp = state.spaces[spaceName];
  if (!sp || !sp.units) return false;
  return sp.units.some(
    stack => !friendlyPowers.has(stack.owner) && stackHasLandUnits(stack)
  );
}

function hasEnemyUnitsInSpaceForLoc(state, spaceName, friendlyPowers) {
  const sp = state.spaces[spaceName];
  if (!sp || !sp.units) return false;
  return sp.units.some(
    stack => !friendlyPowers.has(stack.owner) && stackHasAnyUnitsOrLeaders(stack)
  );
}

function hasPowerAdjacentLandUnits(state, targetSpace, power) {
  const adj = getAdjacentSpaces(targetSpace);
  return adj.connections.some(spaceName => hasPowerLandUnitsInSpace(state, spaceName, power));
}

function hasEnemyAdjacentLandUnits(state, targetSpace, friendlyPowers) {
  const adj = getAdjacentSpaces(targetSpace);
  return adj.connections.some(spaceName =>
    hasNonFriendlyLandUnitsInSpace(state, spaceName, friendlyPowers)
  );
}

function getConnectedSeaZonesForPort(state, portName) {
  const zones = new Set(state.spaces[portName]?.connectedSeaZones || []);
  for (const [seaZone, ports] of Object.entries(PORTS_BY_SEA_ZONE)) {
    if (ports.includes(portName)) zones.add(seaZone);
  }
  return [...zones];
}

function hasFriendlyNavalSupportInSeaZone(state, seaZone, friendlyPowers) {
  const sp = state.spaces[seaZone];
  if (!sp || !sp.units) return false;
  return sp.units.some(stack =>
    friendlyPowers.has(stack.owner) &&
    ((stack.squadrons || 0) > 0 || (stack.corsairs || 0) > 0)
  );
}

function isValidLocIntermediateLandSpace(state, spaceName, friendlyPowers) {
  const sp = state.spaces[spaceName];
  if (!sp) return false;
  if (!friendlyPowers.has(sp.controller)) return false;
  if (sp.unrest) return false;
  if (hasEnemyUnitsInSpaceForLoc(state, spaceName, friendlyPowers)) return false;
  if (!state.schmalkaldicLeagueFormed && sp.isElectorate) return false;
  return true;
}

function getLocSourceSpaces(state, friendlyPowers) {
  const sources = [];
  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    if (!friendlyPowers.has(sp.controller)) continue;
    const owner = sp.controller;
    if (!isHomeSpace(spaceName, owner)) continue;
    const capitals = CAPITALS[owner] || [];
    const canSource = sp.isFortress || capitals.includes(spaceName);
    if (!canSource) continue;
    if (!isValidLocIntermediateLandSpace(state, spaceName, friendlyPowers)) continue;
    sources.push(spaceName);
  }
  return sources;
}

export function hasLineOfCommunicationForControl(state, power, targetSpace) {
  const friendlyPowers = getFriendlyPowers(state, power);
  const sources = getLocSourceSpaces(state, friendlyPowers);
  if (sources.length === 0) return false;

  const visited = new Set(sources);
  const queue = [...sources];

  while (queue.length > 0) {
    const current = queue.shift();
    const currentIsSea = SEA_ZONES.includes(current);

    if (currentIsSea) {
      for (const nextSea of (SEA_ADJACENCY[current] || [])) {
        if (visited.has(nextSea)) continue;
        if (!hasFriendlyNavalSupportInSeaZone(state, nextSea, friendlyPowers)) continue;
        if (hasEnemyUnitsInSpaceForLoc(state, nextSea, friendlyPowers)) continue;
        visited.add(nextSea);
        queue.push(nextSea);
      }

      for (const port of (PORTS_BY_SEA_ZONE[current] || [])) {
        if (port === targetSpace) return true;
        if (visited.has(port)) continue;
        if (!isValidLocIntermediateLandSpace(state, port, friendlyPowers)) continue;
        visited.add(port);
        queue.push(port);
      }

      continue;
    }

    const adj = getAdjacentSpaces(current);
    const landNeighbors = [...adj.connections, ...adj.passes];
    for (const nextLand of landNeighbors) {
      if (nextLand === targetSpace) return true;
      if (visited.has(nextLand)) continue;
      if (!isValidLocIntermediateLandSpace(state, nextLand, friendlyPowers)) continue;
      visited.add(nextLand);
      queue.push(nextLand);
    }

    const currentSp = state.spaces[current];
    if (!currentSp?.isPort) continue;

    for (const seaZone of getConnectedSeaZonesForPort(state, current)) {
      if (visited.has(seaZone)) continue;
      if (!hasFriendlyNavalSupportInSeaZone(state, seaZone, friendlyPowers)) continue;
      if (hasEnemyUnitsInSpaceForLoc(state, seaZone, friendlyPowers)) continue;
      visited.add(seaZone);
      queue.push(seaZone);
    }
  }

  return false;
}

// ── Movement ──────────────────────────────────────────────────────

/**
 * Validate a formation move.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { from, to, units: { regulars, mercenaries, cavalry, leaders } }
 * @returns {{ valid: boolean, cost?: number, error?: string }}
 */
export function validateMoveFormation(state, power, actionData) {
  const { from, to, units } = actionData;
  if (!from || !to) return { valid: false, error: 'Missing from/to' };
  if (!units) return { valid: false, error: 'Missing units to move' };

  // Check spaces exist
  if (!state.spaces[from]) return { valid: false, error: `Space "${from}" not found` };
  if (!state.spaces[to]) return { valid: false, error: `Space "${to}" not found` };

  // Check adjacency
  const connType = getConnectionType(from, to);
  if (!connType) return { valid: false, error: `${from} and ${to} are not adjacent` };

  // Calculate cost
  const costKey = connType === 'pass' ? 'move_over_pass' : 'move_formation';
  const cost = ACTION_COSTS[power]?.[costKey];
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform this movement' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Check source has the units
  const stack = getUnitsInSpace(state, from, power);
  if (!stack) return { valid: false, error: `No units in ${from}` };

  const moveRegs = units.regulars || 0;
  const moveMercs = units.mercenaries || 0;
  const moveCav = units.cavalry || 0;
  const moveLeaders = units.leaders || [];

  if (moveRegs > stack.regulars) {
    return { valid: false, error: 'Not enough regulars' };
  }
  if (moveMercs > stack.mercenaries) {
    return { valid: false, error: 'Not enough mercenaries' };
  }
  if (moveCav > stack.cavalry) {
    return { valid: false, error: 'Not enough cavalry' };
  }
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

  // War check: must be able to attack any enemy in destination
  if (hasEnemyUnits(state, to, power)) {
    const enemyStacks = state.spaces[to].units.filter(
      u => u.owner !== power && u.owner !== 'independent' &&
        (u.regulars > 0 || u.mercenaries > 0 || u.cavalry > 0)
    );
    for (const es of enemyStacks) {
      if (!canAttack(state, power, es.owner)) {
        return { valid: false, error: `Not at war with ${es.owner}` };
      }
    }
  }

  return { valid: true, cost };
}

/**
 * Execute a formation move.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData
 * @param {Object} helpers
 */
export function moveFormation(state, power, actionData, helpers) {
  const { from, to, units } = actionData;
  const connType = getConnectionType(from, to);
  const costKey = connType === 'pass' ? 'move_over_pass' : 'move_formation';
  const cost = ACTION_COSTS[power][costKey];

  spendCp(state, cost);

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

  state.impulseActions.push({ type: 'move', from, to, units });
  helpers.logEvent(state, 'move_formation', { power, from, to, units });

  // If moved into enemy-occupied space → set pending battle
  if (hasEnemyUnits(state, to, power)) {
    // Find the defending power (first enemy stack)
    const defenderStack = state.spaces[to].units.find(
      u => u.owner !== power && u.owner !== 'independent' &&
        (u.regulars > 0 || u.mercenaries > 0 || u.cavalry > 0)
    );
    if (defenderStack) {
      state.pendingBattle = {
        type: 'field_battle',
        space: to,
        attackerPower: power,
        defenderPower: defenderStack.owner,
        fromSpace: from
      };
    }
  }
}

// ── Build Units ───────────────────────────────────────────────────

/**
 * Validate building a unit.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { space }
 * @param {string} unitType - 'regular'|'mercenary'|'cavalry'|'squadron'|'corsair'
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBuild(state, power, actionData, unitType) {
  const { space } = actionData;
  if (!space) return { valid: false, error: 'Missing space' };
  if (!state.spaces[space]) return { valid: false, error: `Space "${space}" not found` };

  const sp = state.spaces[space];

  // Naval units need port, land units need home space
  const isNaval = unitType === 'squadron' || unitType === 'corsair';
  if (isNaval) {
    if (!sp.isPort) return { valid: false, error: 'Must build naval units in a port' };
  }

  // Home space check (original controller)
  if (!isHomeSpace(space, power)) {
    return { valid: false, error: 'Must build in a home space' };
  }

  // No enemy units
  if (hasEnemyUnits(state, space, power)) {
    return { valid: false, error: 'Cannot build in enemy-occupied space' };
  }

  // No unrest
  if (sp.unrest) {
    return { valid: false, error: 'Cannot build in space with unrest' };
  }

  return { valid: true };
}

/**
 * Add a unit to a space.
 */
function addUnit(state, space, power, unitType) {
  let stack = getUnitsInSpace(state, space, power);
  if (!stack) {
    stack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    state.spaces[space].units.push(stack);
  }
  switch (unitType) {
    case 'regular': stack.regulars++; break;
    case 'mercenary': stack.mercenaries++; break;
    case 'cavalry': stack.cavalry++; break;
    case 'squadron': stack.squadrons++; break;
    case 'corsair': stack.corsairs++; break;
  }
}

/**
 * Raise a regular (2 CP).
 */
export function raiseRegular(state, power, actionData, helpers) {
  spendCp(state, ACTION_COSTS[power].raise_regular);
  addUnit(state, actionData.space, power, 'regular');
  state.impulseActions.push({ type: 'raise_regular', space: actionData.space });
  helpers.logEvent(state, 'raise_regular', { power, space: actionData.space });
}

export function validateRaiseRegular(state, power, actionData) {
  const check = validateBuild(state, power, actionData, 'regular');
  if (!check.valid) return check;
  const cost = ACTION_COSTS[power]?.raise_regular;
  if (cost === null) return { valid: false, error: 'Cannot raise regulars' };
  if (state.cpRemaining < cost) return { valid: false, error: `Not enough CP (need ${cost})` };
  return { valid: true };
}

/**
 * Buy a mercenary (1 CP).
 */
export function buyMercenary(state, power, actionData, helpers) {
  spendCp(state, ACTION_COSTS[power].buy_mercenary);
  addUnit(state, actionData.space, power, 'mercenary');
  state.impulseActions.push({ type: 'buy_mercenary', space: actionData.space });
  helpers.logEvent(state, 'buy_mercenary', { power, space: actionData.space });
}

export function validateBuyMercenary(state, power, actionData) {
  const check = validateBuild(state, power, actionData, 'mercenary');
  if (!check.valid) return check;
  const cost = ACTION_COSTS[power]?.buy_mercenary;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot buy mercenaries' };
  }
  if (state.cpRemaining < cost) return { valid: false, error: `Not enough CP (need ${cost})` };
  return { valid: true };
}

/**
 * Raise cavalry (1 CP, Ottoman only).
 */
export function raiseCavalry(state, power, actionData, helpers) {
  spendCp(state, ACTION_COSTS[power].raise_cavalry);
  addUnit(state, actionData.space, power, 'cavalry');
  state.impulseActions.push({ type: 'raise_cavalry', space: actionData.space });
  helpers.logEvent(state, 'raise_cavalry', { power, space: actionData.space });
}

export function validateRaiseCavalry(state, power, actionData) {
  const check = validateBuild(state, power, actionData, 'cavalry');
  if (!check.valid) return check;
  const cost = ACTION_COSTS[power]?.raise_cavalry;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot raise cavalry' };
  }
  if (state.cpRemaining < cost) return { valid: false, error: `Not enough CP (need ${cost})` };
  return { valid: true };
}

/**
 * Build squadron (2 CP).
 */
export function buildSquadron(state, power, actionData, helpers) {
  spendCp(state, ACTION_COSTS[power].build_squadron);
  addUnit(state, actionData.space, power, 'squadron');
  state.impulseActions.push({ type: 'build_squadron', space: actionData.space });
  helpers.logEvent(state, 'build_squadron', { power, space: actionData.space });
}

export function validateBuildSquadron(state, power, actionData) {
  const check = validateBuild(state, power, actionData, 'squadron');
  if (!check.valid) return check;
  const cost = ACTION_COSTS[power]?.build_squadron;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot build squadrons' };
  }
  if (state.cpRemaining < cost) return { valid: false, error: `Not enough CP (need ${cost})` };
  return { valid: true };
}

/**
 * Build corsair (1 CP, Ottoman only).
 */
export function buildCorsair(state, power, actionData, helpers) {
  spendCp(state, ACTION_COSTS[power].build_corsair);
  addUnit(state, actionData.space, power, 'corsair');
  state.impulseActions.push({ type: 'build_corsair', space: actionData.space });
  helpers.logEvent(state, 'build_corsair', { power, space: actionData.space });
}

export function validateBuildCorsair(state, power, actionData) {
  const { space } = actionData || {};
  if (!space) return { valid: false, error: 'Missing space' };
  if (!state.spaces[space]) return { valid: false, error: `Space "${space}" not found` };

  const sp = state.spaces[space];
  const isOttoman = power === 'ottoman';
  if (!isOttoman) {
    return { valid: false, error: 'Cannot build corsairs' };
  }
  if (!state.piracyEnabled) {
    return { valid: false, error: 'Cannot build corsairs before Barbary Pirates is in play' };
  }
  if (!sp.isPort) {
    return { valid: false, error: 'Must build corsairs in a port' };
  }

  const controlledByOttoman = sp.controller === 'ottoman';
  const inOttomanHomePort = controlledByOttoman && isHomeSpace(space, 'ottoman');
  const inAlgiers = controlledByOttoman && space === 'Algiers';
  const inPirateHaven = controlledByOttoman && Boolean(sp.pirateHaven);
  if (!inOttomanHomePort && !inAlgiers && !inPirateHaven) {
    return {
      valid: false,
      error: 'Corsairs can be built only in Ottoman home ports, Algiers, or Ottoman pirate havens'
    };
  }

  if (hasEnemyUnits(state, space, power)) {
    return { valid: false, error: 'Cannot build in enemy-occupied space' };
  }
  if (sp.unrest) {
    return { valid: false, error: 'Cannot build in space with unrest' };
  }

  const cost = ACTION_COSTS[power]?.build_corsair;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot build corsairs' };
  }
  if (state.cpRemaining < cost) return { valid: false, error: `Not enough CP (need ${cost})` };
  return { valid: true };
}

// ── Control Unfortified Space ─────────────────────────────────────

/**
 * Validate controlling an unfortified space.
 */
export function validateControlUnfortified(state, power, actionData) {
  const { space } = actionData;
  if (!space) return { valid: false, error: 'Missing space' };
  const sp = state.spaces[space];
  if (!sp) return { valid: false, error: `Space "${space}" not found` };
  if (sp.isFortress) return { valid: false, error: 'Space is fortified' };

  const friendlyPowers = getFriendlyPowers(state, power);
  const removingUnrest = Boolean(sp.unrest);
  const hasPowerInSpace = hasPowerLandUnitsInSpace(state, space, power);
  const hasPowerAdjacent = hasPowerAdjacentLandUnits(state, space, power);
  const hasEnemyAdjacent = hasEnemyAdjacentLandUnits(state, space, friendlyPowers);

  if (removingUnrest) {
    const protestantSpecial = (
      power === 'protestant' &&
      !state.schmalkaldicLeagueFormed &&
      isHomeSpace(space, 'protestant')
    );

    if (!hasPowerInSpace && !protestantSpecial && !(hasPowerAdjacent && !hasEnemyAdjacent)) {
      return {
        valid: false,
        error: 'Must occupy unrest space, qualify for Protestant special removal, or control adjacent space with no enemy adjacent'
      };
    }
  } else {
    if (sp.controller === power) return { valid: false, error: 'Already controlled' };
    if (friendlyPowers.has(sp.controller)) {
      return { valid: false, error: 'Cannot take control of a friendly-controlled space' };
    }

    if (hasNonFriendlyLandUnitsInSpace(state, space, friendlyPowers)) {
      return { valid: false, error: 'Cannot control space with non-allied land units present' };
    }

    if (!hasLineOfCommunicationForControl(state, power, space)) {
      return { valid: false, error: 'No line of communication to target space' };
    }

    if (!hasPowerInSpace && !(hasPowerAdjacent && !hasEnemyAdjacent)) {
      return {
        valid: false,
        error: 'Must occupy target or have adjacent land units with no enemy land units adjacent'
      };
    }
  }

  const cost = ACTION_COSTS[power]?.control_unfortified;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot control unfortified spaces' };
  }
  if (state.cpRemaining < cost) return { valid: false, error: `Not enough CP (need ${cost})` };
  return { valid: true };
}

/**
 * Execute controlling an unfortified space.
 */
export function controlUnfortified(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].control_unfortified;
  spendCp(state, cost);
  const sp = state.spaces[actionData.space];
  const removedUnrest = Boolean(sp.unrest);

  if (removedUnrest) {
    sp.unrest = false;
  } else {
    sp.controller = power;
  }

  state.impulseActions.push({
    type: 'control_unfortified',
    space: actionData.space,
    removedUnrest
  });
  helpers.logEvent(state, 'control_unfortified', {
    power, space: actionData.space, removedUnrest
  });
}
