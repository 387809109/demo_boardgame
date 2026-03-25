/**
 * Here I Stand — HISBOT Auxiliary Helpers (Phase E)
 *
 * E1: Spatial computation (§4.3 closest-space BFS, supply line checks)
 * E2: Unit placement/removal priorities (§4.17, §4.18, §4.21, §4.22)
 * E4: Formation growing (§4.11 pick-up along path, §4.15 merc ratio)
 *
 * All functions are pure queries — no state mutations.
 */

import { CAPITALS, FORMATION } from '../constants.js';
import {
  LAND_ADJACENCY, SEA_ADJACENCY, PORTS_BY_SEA_ZONE, SPACE_BY_NAME
} from '../data/map-data.js';
import { ARMY_LEADERS, LEADER_BY_ID } from '../data/leaders.js';
import {
  getAdjacentSpaces, getAllAdjacentSpaces, getConnectionType,
  getUnitsInSpace, countLandUnits, isFortified, getFormationCap,
  isHomeSpace, findNearestFortifiedSpace
} from '../state/state-helpers.js';
import { areAtWar, getWarsOf } from '../state/war-helpers.js';
import { getGarrisonRequirement } from './bot-goals.js';

// ═══════════════════════════════════════════════════════════════════════
//  E1: SPATIAL COMPUTATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * §4.3 Closest Space — weighted BFS with pass=2 cost.
 * Optionally considers single sea-zone crossing.
 *
 * Tie-breaking:
 *   1. Paths without passes or naval transport
 *   2. Paths with passes but no naval transport
 *   3. Paths with naval transport (single sea zone)
 *
 * Does not trace through spaces the power cannot enter.
 *
 * @param {Object} state
 * @param {string} from
 * @param {string} to
 * @param {string} power
 * @param {Object} [opts]
 * @param {boolean} [opts.allowSea=true] - Allow single sea-zone crossing
 * @returns {{ distance: number, usesPass: boolean, usesSea: boolean }|null}
 */
export function weightedDistance(state, from, to, power, opts = {}) {
  const allowSea = opts.allowSea !== false;
  if (from === to) return { distance: 0, usesPass: false, usesSea: false };

  // BFS with weighted edges (connection=1, pass=2)
  const visited = new Map(); // spaceName → best cost
  // Each entry: { space, cost, usesPass, usesSea }
  const queue = [{ space: from, cost: 0, usesPass: false, usesSea: false }];
  visited.set(from, 0);

  let best = null;

  while (queue.length > 0) {
    // Sort by cost (priority queue via sort — small maps so acceptable)
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();

    if (best && current.cost >= best.distance) continue;

    // Land adjacency
    const adj = getAdjacentSpaces(current.space);

    for (const next of adj.connections) {
      const nextCost = current.cost + 1;
      if (next === to) {
        const candidate = {
          distance: nextCost,
          usesPass: current.usesPass,
          usesSea: current.usesSea
        };
        if (!best || comparePaths(candidate, best) < 0) best = candidate;
        continue;
      }
      if (!canTraverse(state, next, power)) continue;
      const prev = visited.get(next);
      if (prev !== undefined && prev <= nextCost) continue;
      visited.set(next, nextCost);
      queue.push({
        space: next, cost: nextCost,
        usesPass: current.usesPass, usesSea: current.usesSea
      });
    }

    for (const next of adj.passes) {
      const nextCost = current.cost + 2;
      if (next === to) {
        const candidate = {
          distance: nextCost,
          usesPass: true,
          usesSea: current.usesSea
        };
        if (!best || comparePaths(candidate, best) < 0) best = candidate;
        continue;
      }
      if (!canTraverse(state, next, power)) continue;
      const prev = visited.get(next);
      if (prev !== undefined && prev <= nextCost) continue;
      visited.set(next, nextCost);
      queue.push({
        space: next, cost: nextCost,
        usesPass: true, usesSea: current.usesSea
      });
    }

    // Sea crossing: from port → across one sea zone → to port in same zone
    if (allowSea && !current.usesSea) {
      const seaCrossings = getSeaCrossings(current.space);
      for (const destPort of seaCrossings) {
        const nextCost = current.cost + 1; // Sea crossing = 1 move
        if (destPort === to) {
          const candidate = {
            distance: nextCost,
            usesPass: current.usesPass,
            usesSea: true
          };
          if (!best || comparePaths(candidate, best) < 0) best = candidate;
          continue;
        }
        if (!canTraverse(state, destPort, power)) continue;
        const prev = visited.get(destPort);
        if (prev !== undefined && prev <= nextCost) continue;
        visited.set(destPort, nextCost);
        queue.push({
          space: destPort, cost: nextCost,
          usesPass: current.usesPass, usesSea: true
        });
      }
    }
  }

  return best;
}

/**
 * Compare two path results for tie-breaking per §4.3.
 * Returns <0 if a is preferred, >0 if b is preferred.
 */
function comparePaths(a, b) {
  if (a.distance !== b.distance) return a.distance - b.distance;
  // Same distance: prefer no pass/no sea → pass only → sea
  const rank = (p) => {
    if (!p.usesPass && !p.usesSea) return 0;
    if (p.usesPass && !p.usesSea) return 1;
    return 2;
  };
  return rank(a) - rank(b);
}

/**
 * Check if a power can traverse a space (not blocked by impassable rules).
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
function canTraverse(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp) return false;
  // Don't traverse spaces with unresolved enemy siege that blocks entry
  // For BFS purposes, allow traversal through own and neutral spaces
  return true;
}

/**
 * Get all ports reachable via single sea zone crossing from a port.
 * @param {string} spaceName
 * @returns {string[]}
 */
function getSeaCrossings(spaceName) {
  const mapSp = SPACE_BY_NAME[spaceName];
  if (!mapSp || !mapSp.is_port) return [];

  const connectedZones = mapSp.connected_sea_zones || [];
  const destinations = [];
  for (const zone of connectedZones) {
    const ports = PORTS_BY_SEA_ZONE[zone] || [];
    for (const port of ports) {
      if (port !== spaceName) destinations.push(port);
    }
  }
  return destinations;
}

/**
 * Find closest space to a given origin matching a predicate.
 * Uses §4.3 weighted BFS.
 *
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @param {Function} predicate - (spaceName, spaceObj) => boolean
 * @param {Object} [opts]
 * @returns {{ space: string, distance: number }|null}
 */
export function findClosestSpace(state, from, power, predicate, opts = {}) {
  const allowSea = opts.allowSea !== false;
  if (!state.spaces[from]) return null;

  // Check 'from' itself
  const fromSp = state.spaces[from];
  if (fromSp && predicate(from, fromSp)) {
    return { space: from, distance: 0 };
  }

  const visited = new Map();
  const queue = [{ space: from, cost: 0, usesSea: false }];
  visited.set(from, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();

    const adj = getAdjacentSpaces(current.space);

    for (const next of adj.connections) {
      const nextCost = current.cost + 1;
      const sp = state.spaces[next];
      if (sp && predicate(next, sp)) {
        const prev = visited.get(next);
        if (prev === undefined || prev > nextCost) {
          return { space: next, distance: nextCost };
        }
      }
      if (!canTraverse(state, next, power)) continue;
      const prev = visited.get(next);
      if (prev !== undefined && prev <= nextCost) continue;
      visited.set(next, nextCost);
      queue.push({ space: next, cost: nextCost, usesSea: current.usesSea });
    }

    for (const next of adj.passes) {
      const nextCost = current.cost + 2;
      const sp = state.spaces[next];
      if (sp && predicate(next, sp)) {
        const prev = visited.get(next);
        if (prev === undefined || prev > nextCost) {
          return { space: next, distance: nextCost };
        }
      }
      if (!canTraverse(state, next, power)) continue;
      const prev = visited.get(next);
      if (prev !== undefined && prev <= nextCost) continue;
      visited.set(next, nextCost);
      queue.push({ space: next, cost: nextCost, usesSea: current.usesSea });
    }

    // Sea crossing
    if (allowSea && !current.usesSea) {
      for (const destPort of getSeaCrossings(current.space)) {
        const nextCost = current.cost + 1;
        const sp = state.spaces[destPort];
        if (sp && predicate(destPort, sp)) {
          const prev = visited.get(destPort);
          if (prev === undefined || prev > nextCost) {
            return { space: destPort, distance: nextCost };
          }
        }
        if (!canTraverse(state, destPort, power)) continue;
        const prev = visited.get(destPort);
        if (prev !== undefined && prev <= nextCost) continue;
        visited.set(destPort, nextCost);
        queue.push({ space: destPort, cost: nextCost, usesSea: true });
      }
    }
  }

  return null;
}

/**
 * Simple BFS distance (unweighted, pass=1).
 * @param {string} from
 * @param {string} to
 * @returns {number|null}
 */
export function simpleBfsDistance(from, to) {
  if (from === to) return 0;
  const visited = new Set([from]);
  const queue = [{ space: from, dist: 0 }];
  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    for (const n of getAllAdjacentSpaces(space)) {
      if (n === to) return dist + 1;
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push({ space: n, dist: dist + 1 });
    }
  }
  return null;
}

/**
 * Check if a space has supply line to a friendly fortification.
 * Supply line = path through friendly-controlled spaces (no unrest).
 *
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
export function hasSupplyLine(state, spaceName, power) {
  // A space in a friendly fortification is self-supplied
  const sp = state.spaces[spaceName];
  if (sp && sp.controller === power && isFortified(sp)) return true;

  // BFS to find any friendly fortification through friendly territory
  return findNearestFortifiedSpace(state, spaceName, power) !== null;
}

// ═══════════════════════════════════════════════════════════════════════
//  E2: UNIT PLACEMENT / REMOVAL PRIORITIES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Enhanced land unit placement (§4.17).
 * Replaces the simplified version in bot-goals.js.
 *
 * Priority:
 *   1. Capital if garrison not met
 *   2. Fortified space closest to enemy that doesn't meet garrison
 *   3. Space with leader closest to enemy land units (including independents)
 *   4. Capital
 *
 * @param {Object} state
 * @param {string} power
 * @returns {string|null}
 */
export function chooseLandUnitPlacementEnhanced(state, power) {
  const capitals = CAPITALS[power] || [];

  // 1. Capital if garrison not met
  for (const cap of capitals) {
    const req = getGarrisonRequirement(state, cap, power);
    const stack = getUnitsInSpace(state, cap, power);
    if (countLandUnits(stack) < req) return cap;
  }

  // 2. Fortified space closest to enemy below garrison
  const deficits = findGarrisonDeficitsWithDistance(state, power);
  if (deficits.length > 0) {
    return deficits[0].space;
  }

  // 3. Space with leader closest to enemy
  const leaderSpace = findLeaderNearestEnemy(state, power);
  if (leaderSpace) return leaderSpace;

  // 4. Capital fallback
  for (const cap of capitals) {
    const capSp = state.spaces[cap];
    if (capSp && capSp.controller === power) return cap;
  }

  // Protestant or other power with no capital — any controlled fortification
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller === power && isFortified(sp)) return name;
  }
  return null;
}

/**
 * Find garrison deficits sorted by proximity to enemy.
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{space: string, deficit: number, enemyDist: number}>}
 */
function findGarrisonDeficitsWithDistance(state, power) {
  const deficits = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power) continue;
    if (!isFortified(sp)) continue;
    const req = getGarrisonRequirement(state, name, power);
    if (req <= 0) continue;
    const stack = getUnitsInSpace(state, name, power);
    if (countLandUnits(stack) < req) {
      const enemyDist = distToNearestEnemy(state, name, power);
      deficits.push({ space: name, deficit: req - countLandUnits(stack), enemyDist });
    }
  }
  // Sort: closest to enemy first, then largest deficit
  deficits.sort((a, b) => a.enemyDist - b.enemyDist || b.deficit - a.deficit);
  return deficits;
}

/**
 * Distance to nearest enemy land unit (simple BFS, unweighted).
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @returns {number} Distance (Infinity if no enemy found)
 */
function distToNearestEnemy(state, from, power) {
  const visited = new Set([from]);
  const queue = [{ space: from, dist: 0 }];
  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    if (dist > 0) {
      const sp = state.spaces[space];
      if (sp) {
        for (const u of sp.units || []) {
          if (u.owner !== power && countLandUnits(u) > 0) return dist;
        }
      }
    }
    for (const n of getAllAdjacentSpaces(space)) {
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push({ space: n, dist: dist + 1 });
    }
  }
  return Infinity;
}

/**
 * Find space containing a power's leader that is closest to enemy.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null}
 */
function findLeaderNearestEnemy(state, power) {
  let bestSpace = null;
  let bestDist = Infinity;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power) continue;
    const stack = getUnitsInSpace(state, name, power);
    if (!stack || !stack.leaders || stack.leaders.length === 0) continue;
    const d = distToNearestEnemy(state, name, power);
    if (d < bestDist) {
      bestDist = d;
      bestSpace = name;
    }
  }
  return bestSpace;
}

/**
 * Enhanced naval placement (§4.18).
 * Priority: port closest to enemy naval → closest to enemy land → closest to capital.
 * Avoids ports with 2+ squadrons unless all have 2+.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {string|null}
 */
export function chooseNavalPlacementEnhanced(state, power) {
  const ports = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller === power && sp.isPort) {
      const stack = getUnitsInSpace(state, name, power);
      const squadrons = stack?.squadrons || 0;
      ports.push({ name, squadrons });
    }
  }
  if (ports.length === 0) return null;

  // Prefer ports with < 2 squadrons, unless all have 2+
  const lowPorts = ports.filter(p => p.squadrons < 2);
  const candidates = lowPorts.length > 0 ? lowPorts : ports;
  const candidateNames = candidates.map(p => p.name);

  // Priority 1: closest to enemy naval units
  const navalResult = findClosestToTarget(state, candidateNames, power,
    (name, sp) => hasEnemyNaval(state, name, power));
  if (navalResult) return navalResult;

  // Priority 2: closest to enemy land units
  const landResult = findClosestToTarget(state, candidateNames, power,
    (name, sp) => {
      for (const u of sp.units || []) {
        if (u.owner !== power && countLandUnits(u) > 0) return true;
      }
      return false;
    });
  if (landResult) return landResult;

  // Priority 3: closest to capital
  const capitals = CAPITALS[power] || [];
  if (capitals.length > 0) {
    let bestPort = candidateNames[0];
    let bestDist = Infinity;
    for (const port of candidateNames) {
      for (const cap of capitals) {
        const d = simpleBfsDistance(port, cap);
        if (d !== null && d < bestDist) {
          bestDist = d;
          bestPort = port;
        }
      }
    }
    return bestPort;
  }

  return candidateNames[0];
}

/**
 * Check if a port space's connected sea zones have enemy naval units.
 * @param {Object} state
 * @param {string} portName
 * @param {string} power
 * @returns {boolean}
 */
function hasEnemyNaval(state, portName, power) {
  const mapSp = SPACE_BY_NAME[portName];
  if (!mapSp) return false;
  const zones = mapSp.connected_sea_zones || [];
  for (const zone of zones) {
    const seaState = state.seaZones?.[zone];
    if (!seaState) continue;
    for (const fleet of seaState.fleets || []) {
      if (fleet.owner !== power && (fleet.squadrons || 0) > 0) return true;
    }
  }
  return false;
}

/**
 * Among a set of candidate spaces, find the one "closest" to any space
 * matching a target predicate (measured from each candidate to target).
 *
 * @param {Object} state
 * @param {string[]} candidates
 * @param {string} power
 * @param {Function} targetPredicate
 * @returns {string|null}
 */
function findClosestToTarget(state, candidates, power, targetPredicate) {
  // Find all target spaces
  const targets = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (targetPredicate(name, sp)) targets.push(name);
  }
  if (targets.length === 0) return null;

  let bestCandidate = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    for (const tgt of targets) {
      const d = simpleBfsDistance(cand, tgt);
      if (d !== null && d < bestDist) {
        bestDist = d;
        bestCandidate = cand;
      }
    }
  }
  return bestCandidate;
}

/**
 * §4.21 Removing Land Units — choose which unit to remove.
 *
 * Priority:
 *   1. Unit that won't violate garrison, farthest from enemy (or capital if at peace)
 *   2. Mercenaries/cavalry before regulars
 *   3. If must violate garrison → farthest from enemy/capital
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ space: string, unitType: string }|null}
 */
export function chooseUnitToRemove(state, power) {
  const atWar = getWarsOf(state, power).length > 0;

  // Collect spaces with removable units
  const removable = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power) continue;
    const stack = getUnitsInSpace(state, name, power);
    const total = countLandUnits(stack);
    if (total <= 0) continue;

    const garrison = getGarrisonRequirement(state, name, power);
    const surplus = total - garrison;
    const dist = atWar
      ? distToNearestEnemy(state, name, power)
      : distToCapital(state, name, power);

    removable.push({
      space: name,
      stack,
      surplus,
      dist,
      hasMerc: (stack.mercenaries || 0) > 0 || (stack.cavalry || 0) > 0
    });
  }

  if (removable.length === 0) return null;

  // Prefer: has surplus > 0 → farthest → mercenary/cavalry first
  removable.sort((a, b) => {
    // Surplus first (won't violate garrison)
    const aSafe = a.surplus > 0 ? 1 : 0;
    const bSafe = b.surplus > 0 ? 1 : 0;
    if (aSafe !== bSafe) return bSafe - aSafe;
    // Farthest from enemy/capital
    if (a.dist !== b.dist) return b.dist - a.dist;
    // Mercenaries/cavalry first
    if (a.hasMerc !== b.hasMerc) return a.hasMerc ? -1 : 1;
    return 0;
  });

  const chosen = removable[0];
  // Pick unit type: mercenary > cavalry > regular
  const unitType = (chosen.stack.mercenaries || 0) > 0 ? 'mercenary'
    : (chosen.stack.cavalry || 0) > 0 ? 'cavalry'
      : 'regular';

  return { space: chosen.space, unitType };
}

/**
 * Distance from a space to the power's nearest capital.
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @returns {number}
 */
function distToCapital(state, from, power) {
  const capitals = CAPITALS[power] || [];
  let best = Infinity;
  for (const cap of capitals) {
    const d = simpleBfsDistance(from, cap);
    if (d !== null && d < best) best = d;
  }
  return best;
}

/**
 * §4.22 Removing Naval Units — choose which squadron to remove.
 *
 * At war: farthest from enemy naval → farthest from enemy land.
 * At peace: farthest from capital.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Port name
 */
export function chooseNavalUnitToRemove(state, power) {
  const atWar = getWarsOf(state, power).length > 0;
  const ports = [];

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power) continue;
    const stack = getUnitsInSpace(state, name, power);
    if (!stack || (stack.squadrons || 0) <= 0) continue;
    ports.push(name);
  }

  if (ports.length === 0) return null;

  if (atWar) {
    // Farthest from enemy naval → farthest from enemy land
    let bestPort = ports[0];
    let bestScore = -Infinity;

    for (const port of ports) {
      const navalDist = hasEnemyNaval(state, port, power) ? 0
        : distToNearestEnemyNaval(state, port, power);
      const landDist = distToNearestEnemy(state, port, power);
      // Higher = farther = preferred
      const score = navalDist * 1000 + landDist;
      if (score > bestScore) {
        bestScore = score;
        bestPort = port;
      }
    }
    return bestPort;
  }

  // At peace: farthest from capital
  let bestPort = ports[0];
  let bestDist = -1;
  for (const port of ports) {
    const d = distToCapital(state, port, power);
    if (d > bestDist) {
      bestDist = d;
      bestPort = port;
    }
  }
  return bestPort;
}

/**
 * Distance to nearest port with enemy naval units.
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @returns {number}
 */
function distToNearestEnemyNaval(state, from, power) {
  // Check all ports for enemy naval
  let best = Infinity;
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.isPort) continue;
    if (hasEnemyNaval(state, name, power)) {
      const d = simpleBfsDistance(from, name);
      if (d !== null && d < best) best = d;
    }
  }
  // Also check sea zones directly
  for (const [zone, seaState] of Object.entries(state.seaZones || {})) {
    for (const fleet of seaState.fleets || []) {
      if (fleet.owner !== power && (fleet.squadrons || 0) > 0) {
        const ports = PORTS_BY_SEA_ZONE[zone] || [];
        for (const port of ports) {
          const d = simpleBfsDistance(from, port);
          if (d !== null && d < best) best = d;
        }
      }
    }
  }
  return best;
}

/**
 * §4.5 Displacement — choose destination for displaced units.
 * Priority: keys/electorates → closest fortification to capital.
 *
 * @param {Object} state
 * @param {string} power
 * @param {string} from - Space being displaced from
 * @returns {string|null}
 */
export function chooseDisplacementDestination(state, power, from) {
  const candidates = [];
  for (const adj of getAllAdjacentSpaces(from)) {
    const sp = state.spaces[adj];
    if (!sp || sp.controller !== power) continue;
    if (!isFortified(sp)) continue;
    candidates.push({ name: adj, isKey: sp.isKey || sp.isElectorate });
  }

  if (candidates.length === 0) {
    // Fallback: nearest friendly fortification via BFS
    return findNearestFortifiedSpace(state, from, power);
  }

  // Prefer keys/electorates
  candidates.sort((a, b) => {
    if (a.isKey !== b.isKey) return b.isKey ? 1 : -1;
    return distToCapital(state, a.name, power) - distToCapital(state, b.name, power);
  });

  return candidates[0].name;
}

// ═══════════════════════════════════════════════════════════════════════
//  E4: FORMATION GROWING (§4.11)
// ═══════════════════════════════════════════════════════════════════════

/**
 * §4.11 Growing Formations — pick up units/leaders along movement path.
 *
 * When moving for Advance/Land Battle/Siege goals, units above garrison
 * requirements may be collected along the route within formation size limits.
 *
 * @param {Object} state
 * @param {string} power
 * @param {string} from - Starting space
 * @param {string} to - Destination space
 * @param {{ regulars: number, mercenaries: number, cavalry: number, leaders: string[] }} initialForce
 * @returns {{ regulars: number, mercenaries: number, cavalry: number, leaders: string[] }}
 */
export function growFormationAlongPath(state, power, from, to, initialForce) {
  const path = findLandPath(state, from, to);
  if (!path || path.length <= 2) return initialForce;

  const force = {
    regulars: initialForce.regulars || 0,
    mercenaries: initialForce.mercenaries || 0,
    cavalry: initialForce.cavalry || 0,
    leaders: [...(initialForce.leaders || [])]
  };

  // Walk intermediate spaces (skip from and to)
  for (let i = 1; i < path.length - 1; i++) {
    const spaceName = path[i];
    const sp = state.spaces[spaceName];
    if (!sp || sp.controller !== power) continue;

    const stack = getUnitsInSpace(state, spaceName, power);
    if (!stack) continue;

    const garrison = getGarrisonRequirement(state, spaceName, power);
    const total = countLandUnits(stack);
    const available = total - garrison;
    if (available <= 0 && (!stack.leaders || stack.leaders.length === 0)) continue;

    const currentSize = force.regulars + force.mercenaries + force.cavalry;
    const cap = getFormationCap(force.leaders);
    const room = cap - currentSize;
    if (room <= 0 && (!stack.leaders || stack.leaders.length === 0)) continue;

    // Pick up leaders first (they increase formation cap)
    if (stack.leaders) {
      for (const lid of stack.leaders) {
        if (!force.leaders.includes(lid)) {
          force.leaders.push(lid);
        }
      }
    }

    // Recalculate cap with new leaders
    const newCap = getFormationCap(force.leaders);
    const newRoom = newCap - currentSize;
    const pickup = Math.min(available, Math.max(newRoom, 0));
    if (pickup <= 0) continue;

    // Apply §4.15 mercenary ratio: maintain at least the same ratio
    const pickupResult = applyMercenaryRatio(stack, pickup);
    force.regulars += pickupResult.regulars;
    force.mercenaries += pickupResult.mercenaries;
    force.cavalry += pickupResult.cavalry;
  }

  return force;
}

/**
 * §4.15 Mercenaries and Regular Units — maintain mercenary ratio.
 *
 * When choosing from a mixed stack, the chosen formation must include
 * at least an equivalent ratio of mercenaries.
 *
 * @param {Object} stack - { regulars, mercenaries, cavalry }
 * @param {number} count - Units to pick
 * @returns {{ regulars: number, mercenaries: number, cavalry: number }}
 */
export function applyMercenaryRatio(stack, count) {
  const regs = stack.regulars || 0;
  const mercs = stack.mercenaries || 0;
  const cavs = stack.cavalry || 0;
  const total = regs + mercs + cavs;

  if (total === 0 || count <= 0) return { regulars: 0, mercenaries: 0, cavalry: 0 };

  const actual = Math.min(count, total);

  // Mercenary ratio: mercs / total
  if (mercs + cavs === 0) return { regulars: actual, mercenaries: 0, cavalry: 0 };
  if (regs === 0) {
    // All mercenary/cavalry
    const mPick = Math.min(mercs, actual);
    const cPick = Math.min(cavs, actual - mPick);
    return { regulars: 0, mercenaries: mPick, cavalry: cPick };
  }

  // Mixed: maintain at least the same ratio of mercs+cav
  const mercRatio = (mercs + cavs) / total;
  const minMercCav = Math.ceil(actual * mercRatio);
  const mercCavPick = Math.min(minMercCav, mercs + cavs);
  const regPick = Math.min(actual - mercCavPick, regs);

  const mPick = Math.min(mercs, mercCavPick);
  const cPick = Math.min(cavs, mercCavPick - mPick);
  const totalPicked = regPick + mPick + cPick;

  // Fill remaining if needed
  if (totalPicked < actual) {
    const extra = actual - totalPicked;
    const extraReg = Math.min(regs - regPick, extra);
    const extraMerc = Math.min(mercs - mPick, extra - extraReg);
    const extraCav = Math.min(cavs - cPick, extra - extraReg - extraMerc);
    return {
      regulars: regPick + extraReg,
      mercenaries: mPick + extraMerc,
      cavalry: cPick + extraCav
    };
  }

  return { regulars: regPick, mercenaries: mPick, cavalry: cPick };
}

/**
 * Find a land path between two spaces (BFS, unweighted).
 * @param {Object} state
 * @param {string} from
 * @param {string} to
 * @returns {string[]|null} Path including from and to
 */
function findLandPath(state, from, to) {
  if (from === to) return [from];
  const visited = new Set([from]);
  const queue = [[from]];
  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    for (const next of getAllAdjacentSpaces(current)) {
      if (visited.has(next)) continue;
      visited.add(next);
      const newPath = [...path, next];
      if (next === to) return newPath;
      queue.push(newPath);
    }
  }
  return null;
}

/**
 * §4.12 Hapsburg Capitals — both capitals are treated as "the capital".
 * Returns all capitals for a power.
 * @param {string} power
 * @returns {string[]}
 */
export function getCapitals(power) {
  return CAPITALS[power] || [];
}

/**
 * §4.13 Independent spaces — treated as enemy by all Bot powers.
 * Check if there's an independent-controlled fortified space within 2.
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function hasNearbyIndependentThreat(state, power) {
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power || !isFortified(sp)) continue;
    // Check within 2 spaces for independent fortified space
    const visited = new Set([name]);
    let frontier = [name];
    for (let d = 0; d < 2; d++) {
      const next = [];
      for (const s of frontier) {
        for (const n of getAllAdjacentSpaces(s)) {
          if (visited.has(n)) continue;
          visited.add(n);
          const nsp = state.spaces[n];
          if (nsp && nsp.controller === 'independent' && isFortified(nsp)) {
            return true;
          }
          next.push(n);
        }
      }
      frontier = next;
    }
  }
  return false;
}
