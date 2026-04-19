/**
 * Here I Stand — HISBOT Goal Executors (Phase D)
 *
 * §3 Goal Selection: Bot powers spend CPs based on the prioritized
 * goal list on their Behavior Card. Start with the first goal; if
 * criteria apply and enough CPs → execute. If cannot → next goal.
 * After completing a goal, return to top of priority list.
 *
 * If CPs remain but no goals can execute → grant +1 CP token.
 *
 * 21 goal types across 6 categories:
 *   D1 Military basics: Garrison, Troops, Mercenaries, Cavalry
 *   D2 Military movement: Advance, Land Battle, Siege
 *   D3 Naval: Set Sail, Naval Battle, Shipbuilding, Piracy
 *   D4 Control: Remove Unrest / Political Control
 *   D5 Religious: Translate, Publish, Debate, St. Peter's, Burn, Jesuits
 *   D6 New World: Explore, Colonize, Conquer
 */

import { ACTION_TYPES } from '../actions/action-types.js';
import {
  ACTION_COSTS, CAPITALS, MAJOR_POWERS, RELIGION,
  DEBATERS, NEW_WORLD_POWERS, TRANSLATION
} from '../constants.js';
import { GOAL_TYPES } from './behavior-cards.js';
import { getActiveBehaviorCard } from './behavior-cards.js';
import {
  getUnitsInSpace, countLandUnits, isHomeSpace, isFortified,
  getAdjacentSpaces, getAllAdjacentSpaces, hasEnemyUnits,
  getConnectionType, findFriendlyPath, findNearestFortifiedSpace,
  countKeysForPower, getActiveRuler,
  isValidReformationTarget, isValidCounterReformTarget,
  calcReformationDice, calcCounterReformationDice,
  getAvailableDebaters, getFormationCap
} from '../state/state-helpers.js';
import { areAtWar, canAttack } from '../state/war-helpers.js';
import { hasLineOfCommunicationForControl } from '../actions/military-actions.js';
import { SEA_ZONES, PORTS_BY_SEA_ZONE } from '../data/map-data.js';

// ── Constants ────────────────────────────────────────────────────────

/** Maps goal type → ACTION_COSTS key */
const GOAL_COST_KEY = {
  [GOAL_TYPES.GARRISON]: 'raise_regular',
  [GOAL_TYPES.TROOPS]: 'raise_regular',
  [GOAL_TYPES.MERCENARIES]: 'buy_mercenary',
  [GOAL_TYPES.CAVALRY]: 'raise_cavalry',
  [GOAL_TYPES.ADVANCE]: 'move_formation',
  [GOAL_TYPES.SET_SAIL]: 'naval_move',
  [GOAL_TYPES.NAVAL_BATTLE]: 'naval_move',
  [GOAL_TYPES.LAND_BATTLE]: 'move_formation',
  [GOAL_TYPES.SIEGE]: 'move_formation',
  [GOAL_TYPES.CONTROL]: 'control_unfortified',
  [GOAL_TYPES.SHIPBUILDING]: 'build_squadron',
  [GOAL_TYPES.PIRACY]: 'initiate_piracy',
  [GOAL_TYPES.EXPLORE]: 'explore',
  [GOAL_TYPES.COLONIZE]: 'colonize',
  [GOAL_TYPES.CONQUER]: 'conquer',
  [GOAL_TYPES.TRANSLATE]: 'translate_scripture',
  [GOAL_TYPES.PUBLISH]: 'publish_treatise',
  [GOAL_TYPES.DEBATE]: 'call_debate',
  [GOAL_TYPES.ST_PETERS]: 'build_st_peters',
  [GOAL_TYPES.BURN]: 'burn_books',
  [GOAL_TYPES.JESUITS]: 'found_jesuit'
};

// ── Garrison Requirements (§4.10) ────────────────────────────────────

/**
 * Calculate garrison requirement for a space.
 * Capital: 2 base, Key/Electorate: 1 base, Others: 0.
 * +1 if within 2 spaces of an enemy land unit.
 *
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {number}
 */
export function getGarrisonRequirement(state, spaceName, power) {
  const space = state.spaces[spaceName];
  if (!space) return 0;

  const capitals = CAPITALS[power] || [];
  let base = 0;
  if (capitals.includes(spaceName)) {
    base = 2;
  } else if (space.isKey || space.isElectorate) {
    base = 1;
  }

  // Check for nearby enemy units (within 2 spaces)
  if (isFortified(space) && hasNearbyEnemy(state, spaceName, power, 2)) {
    base += 1;
  }

  return base;
}

/**
 * Check if any enemy land units within N spaces.
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @param {number} range
 * @returns {boolean}
 */
function hasNearbyEnemy(state, spaceName, power, range) {
  const visited = new Set([spaceName]);
  let frontier = [spaceName];

  for (let d = 0; d < range; d++) {
    const next = [];
    for (const s of frontier) {
      const adj = getAllAdjacentSpaces(s);
      for (const n of adj) {
        if (visited.has(n)) continue;
        visited.add(n);
        // Check for enemy units
        const sp = state.spaces[n];
        if (sp) {
          for (const u of sp.units || []) {
            if (u.owner !== power && countLandUnits(u) > 0) return true;
          }
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return false;
}

/**
 * Find spaces below garrison requirement for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{space: string, deficit: number}>}
 */
function findGarrisonDeficits(state, power) {
  const deficits = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power) continue;
    const req = getGarrisonRequirement(state, name, power);
    if (req <= 0) continue;
    const stack = getUnitsInSpace(state, name, power);
    const count = countLandUnits(stack);
    if (count < req) {
      deficits.push({ space: name, deficit: req - count });
    }
  }
  return deficits;
}

// ── Unit Placement Helpers (§4.17, §4.18) ────────────────────────────

/**
 * Choose where to place a new land unit (§4.17).
 * Priority: capital below garrison → closest fortification below garrison
 *   → space with leader closest to enemy → capital.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Space name
 */
export function chooseLandUnitPlacement(state, power) {
  const capitals = CAPITALS[power] || [];
  const buildable = (space) => {
    const sp = state.spaces[space];
    if (!sp || sp.controller !== power) return false;
    if (!isHomeSpace(space, power)) return false;
    if (hasEnemyUnits(state, space, power)) return false;
    if (sp.unrest) return false;
    return true;
  };

  // 1. Capital if garrison not met and buildable
  for (const cap of capitals) {
    if (!buildable(cap)) continue;
    const req = getGarrisonRequirement(state, cap, power);
    const stack = getUnitsInSpace(state, cap, power);
    if (countLandUnits(stack) < req) return cap;
  }

  // 2. Home space below garrison that is buildable
  const deficits = findGarrisonDeficits(state, power).filter(d => buildable(d.space));
  if (deficits.length > 0) {
    return deficits[0].space;
  }

  // 3. Capital fallback
  for (const cap of capitals) {
    if (buildable(cap)) return cap;
  }

  // 4. Any buildable home space
  for (const name of Object.keys(state.spaces)) {
    if (buildable(name)) return name;
  }
  return null;
}

/**
 * Choose where to place a new naval squadron (§4.18).
 * Priority: port closest to enemy naval → closest to enemy land → closest to capital.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Port space name
 */
export function chooseNavalPlacement(state, power) {
  // Find all buildable home ports (must also be clear of enemies + unrest)
  const ports = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.isPort) continue;
    if (sp.controller !== power) continue;
    if (!isHomeSpace(name, power)) continue;
    if (hasEnemyUnits(state, name, power)) continue;
    if (sp.unrest) continue;
    ports.push(name);
  }
  if (ports.length === 0) return null;

  // Simplified: choose port closest to capital
  const capitals = CAPITALS[power] || [];
  if (capitals.length === 0) return ports[0];

  return ports[0]; // Will be refined in Phase E
}

/**
 * Choose where to place an Ottoman corsair (§4.18).
 * Priority: port with Barbarossa/Dragut → most corsairs → Algiers → Athens.
 * @param {Object} state
 * @returns {string|null}
 */
function chooseCorsairPlacement(state) {
  // Simplified: Algiers if controlled, else Athens
  const algiers = state.spaces['Algiers'];
  if (algiers && algiers.controller === 'ottoman') return 'Algiers';
  const athens = state.spaces['Athens'];
  if (athens && athens.controller === 'ottoman') return 'Athens';
  return null;
}

// ── Distance Helper ──────────────────────────────────────────────────

/**
 * Find nearest enemy-controlled space from a starting space.
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @returns {{space: string, distance: number}|null}
 */
function findNearestEnemySpace(state, from, power) {
  const visited = new Set([from]);
  const queue = [{ space: from, dist: 0 }];

  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    if (dist > 0) {
      const sp = state.spaces[space];
      if (sp) {
        for (const u of sp.units || []) {
          if (u.owner !== power && u.owner !== 'independent' &&
              canAttack(state, power, u.owner) && countLandUnits(u) > 0) {
            return { space, distance: dist };
          }
        }
      }
    }
    const adj = getAllAdjacentSpaces(space);
    for (const n of adj) {
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push({ space: n, dist: dist + 1 });
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
//  D1: MILITARY BASICS — Garrison, Troops, Mercenaries, Cavalry
// ═══════════════════════════════════════════════════════════════════════

/**
 * Garrison goal (§3.1): Build regular in home spaces below garrison level.
 * If not enough CPs for regular → buy mercenary or cavalry instead.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp - Remaining CPs
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeGarrison(state, power, cp) {
  // Must build in home, controlled, no enemy, no unrest space (§4.17 validation rules)
  const deficits = findGarrisonDeficits(state, power).filter(d => {
    const sp = state.spaces[d.space];
    return isHomeSpace(d.space, power) &&
           !hasEnemyUnits(state, d.space, power) &&
           !sp.unrest;
  });
  if (deficits.length === 0) return null;

  const target = deficits[0].space;
  const costs = ACTION_COSTS[power];

  // Try regular first
  if (costs.raise_regular && cp >= costs.raise_regular) {
    return {
      action: {
        actionType: ACTION_TYPES.RAISE_REGULAR,
        actionData: { space: target }
      },
      cpCost: costs.raise_regular
    };
  }

  // Fallback: mercenary
  if (costs.buy_mercenary && cp >= costs.buy_mercenary) {
    return {
      action: {
        actionType: ACTION_TYPES.BUY_MERCENARY,
        actionData: { space: target }
      },
      cpCost: costs.buy_mercenary
    };
  }

  // Fallback: cavalry
  if (costs.raise_cavalry && cp >= costs.raise_cavalry) {
    return {
      action: {
        actionType: ACTION_TYPES.RAISE_CAVALRY,
        actionData: { space: target }
      },
      cpCost: costs.raise_cavalry
    };
  }

  return null;
}

/**
 * Troops goal (§3.2): Build regular land unit. §4.17 placement.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeTroops(state, power, cp) {
  const cost = ACTION_COSTS[power].raise_regular;
  if (!cost || cp < cost) return null;

  const target = chooseLandUnitPlacement(state, power);
  if (!target) return null;

  return {
    action: {
      actionType: ACTION_TYPES.RAISE_REGULAR,
      actionData: { space: target }
    },
    cpCost: cost
  };
}

/**
 * Mercenaries goal (§3.3): Buy mercenary land unit.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeMercenaries(state, power, cp) {
  const cost = ACTION_COSTS[power].buy_mercenary;
  if (!cost || cp < cost) return null;

  // Only buy when there's a real need — avoid capital hoarding.
  // Need = garrison deficit OR forward army below formation cap with leader.
  const target = findMercenaryTarget(state, power);
  if (!target) return null;

  return {
    action: {
      actionType: ACTION_TYPES.BUY_MERCENARY,
      actionData: { space: target }
    },
    cpCost: cost
  };
}

/**
 * Pick a space that actually benefits from another mercenary.
 * Priority: garrison deficit → leader stack below formation cap → null.
 */
function findMercenaryTarget(state, power) {
  const buildable = (space) => {
    const sp = state.spaces[space];
    if (!sp || sp.controller !== power) return false;
    if (!isHomeSpace(space, power)) return false;
    if (hasEnemyUnits(state, space, power)) return false;
    if (sp.unrest) return false;
    return true;
  };

  // 1. Garrison deficit in home
  const deficits = findGarrisonDeficits(state, power).filter(d => buildable(d.space));
  if (deficits.length > 0) return deficits[0].space;

  // 2. Leader stack below formation cap — reinforce a fighting army
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!buildable(name)) continue;
    const stack = getUnitsInSpace(state, name, power);
    if (!stack) continue;
    const leaders = stack.leaders || [];
    if (leaders.length === 0) continue;
    const cap = getFormationCap(leaders);
    if (!cap || cap === Infinity) continue;
    if (countLandUnits(stack) >= cap) continue;
    return name;
  }

  return null;
}

/**
 * Cavalry goal (§3.4): Build cavalry unit (Ottoman only).
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeCavalry(state, power, cp) {
  const cost = ACTION_COSTS[power].raise_cavalry;
  if (!cost || cp < cost) return null;

  const target = chooseLandUnitPlacement(state, power);
  if (!target) return null;

  return {
    action: {
      actionType: ACTION_TYPES.RAISE_CAVALRY,
      actionData: { space: target }
    },
    cpCost: cost
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  D2: MILITARY MOVEMENT — Advance, Land Battle, Siege
// ═══════════════════════════════════════════════════════════════════════

/**
 * Advance goal (§3.5): Move formation of ≥2 units closer to enemy.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeAdvance(state, power, cp) {
  const cost = ACTION_COSTS[power].move_formation;
  if (!cost || cp < cost) return null;

  // Find spaces with ≥2 units above garrison
  const candidates = findMovableFormations(state, power, 2);
  if (candidates.length === 0) return null;

  // Find nearest enemy to move toward
  for (const cand of candidates) {
    const nearestEnemy = findNearestEnemySpace(state, cand.space, power);
    if (!nearestEnemy) continue;

    // Find adjacent space that is closer to enemy
    const adj = getAllAdjacentSpaces(cand.space);
    const currentDist = nearestEnemy.distance;
    for (const dest of adj) {
      const destSp = state.spaces[dest];
      if (!destSp) continue;
      // Can't march through enemy fortification unless at war (siege/battle)
      if (isFortified(destSp) && destSp.controller !== power &&
          (!destSp.controller || !canAttack(state, power, destSp.controller))) continue;
      // Skip spaces with units of a power we're not at war with
      if (hasEnemyUnitsNotAtWar(state, dest, power)) continue;
      // Check actual movement cost (pass = 2 CP)
      const connType = getConnectionType(cand.space, dest);
      const moveCost = connType === 'pass'
        ? (ACTION_COSTS[power].move_over_pass || 2)
        : cost;
      if (cp < moveCost) continue;
      const destDist = bfsDistance(state, dest, nearestEnemy.space);
      if (destDist !== null && destDist < currentDist) {
        return {
          action: {
            actionType: ACTION_TYPES.MOVE_FORMATION,
            actionData: {
              from: cand.space, to: dest,
              units: {
                ...capUnitsToFormation(
                  { regulars: cand.regulars, mercenaries: cand.mercenaries, cavalry: cand.cavalry },
                  cand.leaders
                ),
                leaders: cand.leaders
              }
            }
          },
          cpCost: moveCost
        };
      }
    }
  }
  return null;
}

/**
 * Land Battle goal (§3.8): Relieve siege or fight in unfortified space.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeLandBattle(state, power, cp) {
  const cost = ACTION_COSTS[power].move_formation;
  if (!cost || cp < cost) return null;

  // Priority 1: Relieve a siege on our key/electorate
  const siegeRelief = findSiegeRelief(state, power);
  if (siegeRelief) {
    const reliefConn = getConnectionType(siegeRelief.from, siegeRelief.to);
    const reliefCost = reliefConn === 'pass'
      ? (ACTION_COSTS[power].move_over_pass || 2) : cost;
    if (cp >= reliefCost) {
      return {
        action: {
          actionType: ACTION_TYPES.MOVE_FORMATION,
          actionData: {
            from: siegeRelief.from, to: siegeRelief.to,
            units: { ...siegeRelief.units, leaders: siegeRelief.leaders }
          }
        },
        cpCost: reliefCost
      };
    }
  }

  // Priority 2: Attack space with enemy units (fortified or not) where we outnumber
  const candidates = findMovableFormations(state, power, 2);
  for (const cand of candidates) {
    const adj = getAllAdjacentSpaces(cand.space);
    for (const dest of adj) {
      const destSp = state.spaces[dest];
      if (!destSp) continue;
      // For fortified spaces, must be at war with controller
      if (isFortified(destSp) && destSp.controller && destSp.controller !== power) {
        if (!canAttack(state, power, destSp.controller)) continue;
      }
      // Count enemy units (only powers we can attack)
      let enemyCount = 0;
      let hasNonWarEnemy = false;
      for (const u of destSp.units || []) {
        if (u.owner === power || u.owner === 'independent') continue;
        if (!canAttack(state, power, u.owner)) { hasNonWarEnemy = true; continue; }
        enemyCount += countLandUnits(u);
      }
      // Skip if space has units of a power we're not at war with
      if (hasNonWarEnemy) continue;
      // Attack if we outnumber, OR if enemy-controlled fortified space (to siege)
      const isEnemyFort = isFortified(destSp) && destSp.controller !== power;
      if ((enemyCount > 0 && enemyCount < cand.totalUnits) ||
          (isEnemyFort && cand.totalUnits >= 2)) {
        // Check pass cost
        const connType = getConnectionType(cand.space, dest);
        const moveCost = connType === 'pass'
          ? (ACTION_COSTS[power].move_over_pass || 2) : cost;
        if (cp < moveCost) continue;
        return {
          action: {
            actionType: ACTION_TYPES.MOVE_FORMATION,
            actionData: {
              from: cand.space, to: dest,
              units: {
                ...capUnitsToFormation(
                  { regulars: cand.regulars, mercenaries: cand.mercenaries, cavalry: cand.cavalry },
                  cand.leaders
                ),
                leaders: cand.leaders
              }
            }
          },
          cpCost: moveCost
        };
      }
    }
  }

  // Fallback: Advance toward nearest enemy units (implicit advance)
  const advanceToBattle = advanceTowardTarget(state, power, cp, 'enemy_units');
  if (advanceToBattle) return advanceToBattle;

  return null;
}

/**
 * Siege goal (§3.9): Foreign War → Assault → Initiate/Reinforce Siege.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeSiege(state, power, cp) {
  // Sub-priority 1: Foreign War action
  const fwAction = checkForeignWar(state, power, cp);
  if (fwAction) return fwAction;

  // Sub-priority 2: Assault existing siege
  const assaultCost = ACTION_COSTS[power].assault;
  if (assaultCost && cp >= assaultCost) {
    const siegeTarget = findAssaultTarget(state, power);
    if (siegeTarget) {
      return {
        action: {
          actionType: ACTION_TYPES.ASSAULT,
          actionData: { space: siegeTarget }
        },
        cpCost: assaultCost
      };
    }
  }

  // Sub-priority 3: Initiate new siege
  const moveCost = ACTION_COSTS[power].move_formation;
  if (!moveCost || cp < moveCost) return null;

  const siegeMove = findSiegeTarget(state, power);
  if (siegeMove) {
    const connType = getConnectionType(siegeMove.from, siegeMove.to);
    const siegeMoveCost = connType === 'pass'
      ? (ACTION_COSTS[power].move_over_pass || 2) : moveCost;
    if (cp >= siegeMoveCost) {
      return {
        action: {
          actionType: ACTION_TYPES.MOVE_FORMATION,
          actionData: {
            from: siegeMove.from, to: siegeMove.to,
            units: { ...siegeMove.units, leaders: siegeMove.leaders }
          }
        },
        cpCost: siegeMoveCost
      };
    }
  }

  // Sub-priority 4: Advance toward nearest enemy fortification (implicit advance)
  const advanceToSiege = advanceTowardTarget(state, power, cp, 'fortification');
  if (advanceToSiege) return advanceToSiege;

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
//  D3: NAVAL — Set Sail, Naval Battle, Shipbuilding, Piracy
// ═══════════════════════════════════════════════════════════════════════

/**
 * Set Sail goal (§3.6): Naval move based on sea zone priorities.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeSetSail(state, power, cp) {
  const cost = ACTION_COSTS[power].naval_move;
  if (!cost || cp < cost) return null;

  // Find squadrons that should move
  const move = findNavalMove(state, power);
  if (!move) return null;

  return {
    action: {
      actionType: ACTION_TYPES.NAVAL_MOVE,
      actionData: { movements: [{ from: move.from, to: move.to }] }
    },
    cpCost: cost
  };
}

/**
 * Naval Battle goal (§3.7): Move squadrons to engage enemy fleet.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeNavalBattle(state, power, cp) {
  const cost = ACTION_COSTS[power].naval_move;
  if (!cost || cp < cost) return null;

  // Find sea zone with enemy ships where Bot has advantage
  const battle = findNavalBattleTarget(state, power);
  if (!battle) return null;

  return {
    action: {
      actionType: ACTION_TYPES.NAVAL_MOVE,
      actionData: { movements: [{ from: battle.from, to: battle.to }] }
    },
    cpCost: cost
  };
}

/**
 * Shipbuilding goal (§3.11): Build squadron or corsair.
 * Ottoman: build corsair if 1 CP remaining or Barbary Pirates card.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeShipbuilding(state, power, cp) {
  // Ottoman corsair special logic — requires Barbary Pirates event in play
  if (power === 'ottoman' && state.piracyEnabled) {
    const corsairCost = ACTION_COSTS.ottoman.build_corsair;
    const deck = state.botDecks?.ottoman;
    const card = deck ? getActiveBehaviorCard(deck) : null;
    const isBarbary = card?.id === 'ottoman_barbary_pirates';

    if (corsairCost && cp >= corsairCost && (cp === 1 || isBarbary)) {
      const port = chooseCorsairPlacement(state);
      if (port) {
        return {
          action: {
            actionType: ACTION_TYPES.BUILD_CORSAIR,
            actionData: { space: port }
          },
          cpCost: corsairCost
        };
      }
    }
  }

  // Regular squadron
  const cost = ACTION_COSTS[power].build_squadron;
  if (!cost || cp < cost) return null;

  const port = chooseNavalPlacement(state, power);
  if (!port) return null;

  return {
    action: {
      actionType: ACTION_TYPES.BUILD_SQUADRON,
      actionData: { space: port }
    },
    cpCost: cost
  };
}

/**
 * Piracy goal (§3.12): Ottoman corsair piracy action.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executePiracy(state, power, cp) {
  if (power !== 'ottoman') return null;
  if (!state.piracyEnabled) return null;
  const cost = ACTION_COSTS.ottoman.initiate_piracy;
  if (!cost || cp < cost) return null;

  // Find sea zone with corsairs and valid target
  const target = findPiracyTarget(state);
  if (!target) return null;

  return {
    action: {
      actionType: ACTION_TYPES.PIRACY,
      actionData: { seaZone: target.seaZone, targetPower: target.targetPower }
    },
    cpCost: cost
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  D4: CONTROL — Remove Unrest / Political Control
// ═══════════════════════════════════════════════════════════════════════

/**
 * Control goal (§3.10): Remove unrest (priority) or take political control.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeControl(state, power, cp) {
  const cost = ACTION_COSTS[power].control_unfortified;
  if (!cost || cp < cost) return null;

  // Priority 1: Remove unrest from controlled space
  const unrestTarget = findUnrestTarget(state, power);
  if (unrestTarget) {
    return {
      action: {
        actionType: ACTION_TYPES.CONTROL_UNFORTIFIED,
        actionData: { space: unrestTarget, removeUnrest: true }
      },
      cpCost: cost
    };
  }

  // Priority 2: Political control of unfortified space
  const controlTarget = findControlTarget(state, power);
  if (controlTarget) {
    return {
      action: {
        actionType: ACTION_TYPES.CONTROL_UNFORTIFIED,
        actionData: { space: controlTarget }
      },
      cpCost: cost
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
//  D5: RELIGIOUS — Translate, Publish, Debate, St. Peter's, Burn, Jesuits
// ═══════════════════════════════════════════════════════════════════════

/**
 * Translate goal (§3.16): Protestant translates scripture.
 * Language selection: complete full bible if possible → commit debater
 *   → priority: German NT → French NT → English NT → German FB → etc.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeTranslate(state, power, cp) {
  if (power !== 'protestant') return null;
  const cost = ACTION_COSTS.protestant.translate_scripture;
  if (!cost || cp < cost) return null;

  const tracks = state.translationTracks;
  if (!tracks) return null;

  // Choose language by priority
  const language = chooseTranslationLanguage(state, tracks);
  if (!language) return null;

  return {
    action: {
      actionType: ACTION_TYPES.TRANSLATE_SCRIPTURE,
      actionData: { zone: language }
    },
    cpCost: cost
  };
}

/**
 * Publish goal (§3.17): Protestant/English publishes treatise.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executePublish(state, power, cp) {
  if (power !== 'protestant' && power !== 'england') return null;
  const cost = ACTION_COSTS[power].publish_treatise;
  if (!cost || cp < cost) return null;

  // Determine target zone
  let zone;
  if (power === 'protestant') {
    // German unless ≤6 Catholic spaces remain → French
    const germanCatholic = countCatholicInZone(state, 'german');
    zone = germanCatholic <= 6 ? 'french' : 'german';
  } else {
    // England: English zone only, after reformation started
    if (!state.englishReformationStarted) return null;
    zone = 'english';
  }

  // Find target space using §4.20 criteria
  const target = chooseReformationTarget(state, zone, power);
  if (!target) return null;

  return {
    action: {
      actionType: ACTION_TYPES.PUBLISH_TREATISE,
      actionData: { space: target, zone }
    },
    cpCost: cost
  };
}

/**
 * Debate goal (§3.18): Call theological debate.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeDebate(state, power, cp) {
  if (power !== 'papacy' && power !== 'protestant') return null;
  const cost = ACTION_COSTS[power].call_debate;
  if (!cost || cp < cost) return null;

  let zone;
  if (power === 'papacy') {
    // Choose zone with most Protestant spaces
    zone = chooseDebateZonePapacy(state);
  } else {
    // Choose zone with highest-rated uncommitted Protestant debater
    zone = chooseDebateZoneProtestant(state);
  }
  if (!zone) return null;

  return {
    action: {
      actionType: ACTION_TYPES.CALL_DEBATE,
      actionData: { zone }
    },
    cpCost: cost
  };
}

/**
 * St. Peter's goal (§3.19): Papacy builds St. Peter's if incomplete.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeStPeters(state, power, cp) {
  if (power !== 'papacy') return null;
  const cost = ACTION_COSTS.papacy.build_st_peters;
  if (!cost || cp < cost) return null;

  // Check if St. Peter's is already complete (max 5 VP @ 5 CP per VP = 25 progress)
  const stVp = state.stPetersVp || 0;
  if (stVp >= 5) return null;

  return {
    action: {
      actionType: ACTION_TYPES.BUILD_ST_PETERS,
      actionData: {}
    },
    cpCost: cost
  };
}

/**
 * Burn goal (§3.20): Papacy burns books.
 * Commit debaters: Cajetan → Tetzel → Caraffa.
 * Choose zone with most counterreformation dice.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeBurn(state, power, cp) {
  if (power !== 'papacy') return null;
  const cost = ACTION_COSTS.papacy.burn_books;
  if (!cost || cp < cost) return null;

  // Find target using §4.20 counterreformation criteria
  const target = chooseCounterReformTarget(state);
  if (!target) return null;

  // BURN_BOOKS needs a language zone, not a space name
  const targetSp = state.spaces[target];
  const zone = targetSp?.languageZone;
  if (!zone) return null;

  // Choose debater to commit: Cajetan → Tetzel → Caraffa
  const debater = chooseBurnDebater(state);

  return {
    action: {
      actionType: ACTION_TYPES.BURN_BOOKS,
      actionData: { zone, debater: debater?.id || null }
    },
    cpCost: cost
  };
}

/**
 * Jesuits goal (§3.21): Found Jesuit university.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeJesuits(state, power, cp) {
  if (power !== 'papacy') return null;
  const cost = ACTION_COSTS.papacy.found_jesuit;
  if (!cost || cp < cost) return null;

  // Check prereq: Society of Jesus event must have been played
  if (!state.societyOfJesusPlayed) return null;

  // Choose space: Catholic influence, adjacent to most Protestant spaces,
  // not within 2 of existing Jesuit university (§4.19)
  const target = chooseJesuitPlacement(state);
  if (!target) return null;

  return {
    action: {
      actionType: ACTION_TYPES.FOUND_JESUIT,
      actionData: { space: target }
    },
    cpCost: cost
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  D6: NEW WORLD — Explore, Colonize, Conquer
// ═══════════════════════════════════════════════════════════════════════

/**
 * Explore goal (§3.13): Take explore action if explorers remain.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeExplore(state, power, cp) {
  if (!NEW_WORLD_POWERS.includes(power)) return null;
  const cost = ACTION_COSTS[power].explore;
  if (!cost || cp < cost) return null;

  // Check if explorers available and unclaimed discoveries exist
  const nw = state.newWorld;
  if (!nw) return null;
  if (nw.exploredThisTurn?.[power]) return null; // Already explored this turn
  const usedExplorers = [...(nw.placedExplorers || []), ...(nw.deadExplorers || [])];
  const availableExplorers = getExplorersForPower(power)
    .filter(e => !usedExplorers.includes(e));
  if (availableExplorers.length === 0) return null;

  return {
    action: {
      actionType: ACTION_TYPES.EXPLORE,
      actionData: { explorer: availableExplorers[0] }
    },
    cpCost: cost
  };
}

/**
 * Colonize goal (§3.14): Take colonize action.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeColonize(state, power, cp) {
  if (!NEW_WORLD_POWERS.includes(power)) return null;
  const cost = ACTION_COSTS[power].colonize;
  if (!cost || cp < cost) return null;

  // Only one colonize action per impulse
  if (state.newWorld?.colonizedThisTurn?.[power]) return null;

  // Check colony slots available
  const nw = state.newWorld;
  if (!nw) return null;
  const existingColonies = (nw.colonies || []).filter(c => c.power === power).length;
  const maxColonies = power === 'hapsburg' ? 3 : 2;
  if (existingColonies >= maxColonies) return null;

  return {
    action: {
      actionType: ACTION_TYPES.COLONIZE,
      actionData: {}
    },
    cpCost: cost
  };
}

/**
 * Conquer goal (§3.15): Take conquer action.
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action: Object, cpCost: number}|null}
 */
export function executeConquer(state, power, cp) {
  if (!NEW_WORLD_POWERS.includes(power)) return null;
  const cost = ACTION_COSTS[power].conquer;
  if (!cost || cp < cost) return null;

  // Check conquistadors available
  const nw = state.newWorld;
  if (!nw) return null;
  const usedConq = [...(nw.placedConquistadors || []), ...(nw.deadConquistadors || [])];
  const availableConq = getConquistadorsForPower(power)
    .filter(c => !usedConq.includes(c));
  if (availableConq.length === 0) return null;

  return {
    action: {
      actionType: ACTION_TYPES.CONQUER,
      actionData: { conquistador: availableConq[0] }
    },
    cpCost: cost
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  D7: GOAL DISPATCHER
// ═══════════════════════════════════════════════════════════════════════

/** Goal type → executor function mapping */
const GOAL_EXECUTORS = {
  [GOAL_TYPES.GARRISON]: executeGarrison,
  [GOAL_TYPES.TROOPS]: executeTroops,
  [GOAL_TYPES.MERCENARIES]: executeMercenaries,
  [GOAL_TYPES.CAVALRY]: executeCavalry,
  [GOAL_TYPES.ADVANCE]: executeAdvance,
  [GOAL_TYPES.SET_SAIL]: executeSetSail,
  [GOAL_TYPES.NAVAL_BATTLE]: executeNavalBattle,
  [GOAL_TYPES.LAND_BATTLE]: executeLandBattle,
  [GOAL_TYPES.SIEGE]: executeSiege,
  [GOAL_TYPES.CONTROL]: executeControl,
  [GOAL_TYPES.SHIPBUILDING]: executeShipbuilding,
  [GOAL_TYPES.PIRACY]: executePiracy,
  [GOAL_TYPES.EXPLORE]: executeExplore,
  [GOAL_TYPES.COLONIZE]: executeColonize,
  [GOAL_TYPES.CONQUER]: executeConquer,
  [GOAL_TYPES.TRANSLATE]: executeTranslate,
  [GOAL_TYPES.PUBLISH]: executePublish,
  [GOAL_TYPES.DEBATE]: executeDebate,
  [GOAL_TYPES.ST_PETERS]: executeStPeters,
  [GOAL_TYPES.BURN]: executeBurn,
  [GOAL_TYPES.JESUITS]: executeJesuits
};

/**
 * Main goal dispatcher (§3): iterate behavior card's priority list,
 * find first executable goal, return its action.
 *
 * Tracks per-impulse execution counts via state.botGoalCounts[power].
 * When all goals exhausted → return GRANT_CP_TOKEN or END_IMPULSE.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null} { actionType, actionData, goalId?, cpCost? }
 */
export function dispatchGoalAction(state, power) {
  const cp = state.cpRemaining || 0;
  if (cp <= 0) return null;

  // Get active behavior card
  const deck = state.botDecks?.[power];
  if (!deck) return null;
  const card = getActiveBehaviorCard(deck);
  if (!card || !card.goals || card.goals.length === 0) {
    return { actionType: ACTION_TYPES.END_IMPULSE, actionData: {} };
  }

  // Execution counts for this impulse (reset by controller between impulses)
  const counts = state.botGoalCounts?.[power] || {};

  // Iterate priority list
  for (const goal of card.goals) {
    const { type, max } = goal;
    const executor = GOAL_EXECUTORS[type];
    if (!executor) continue;

    // Check max executions this impulse
    const used = counts[type] || 0;
    if (used >= max) continue;

    // Check base CP cost — skip if power cannot perform this action
    const costKey = GOAL_COST_KEY[type];
    const baseCost = costKey ? ACTION_COSTS[power]?.[costKey] : null;
    if (baseCost === null || baseCost === undefined) continue;
    if (cp < baseCost) continue;

    // Try executing the goal
    const result = executor(state, power, cp);
    if (result) {
      return {
        ...result.action,
        goalId: type,
        cpCost: result.cpCost
      };
    }
  }

  // No goals executable — grant +1 CP token (adds 1 CP to next card)
  return {
    actionType: ACTION_TYPES.END_IMPULSE,
    actionData: { grantCpToken: true }
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS (for movement, naval, control, religious goals)
// ═══════════════════════════════════════════════════════════════════════

// ── Military Movement Helpers ────────────────────────────────────────

/**
 * Cap a units object to the formation cap determined by the leaders list.
 * Removes units proportionally: regulars first, then cavalry, then mercenaries.
 * @param {{regulars:number, mercenaries:number, cavalry:number}} units
 * @param {string[]} leaders
 * @returns {{regulars:number, mercenaries:number, cavalry:number}}
 */
function capUnitsToFormation(units, leaders) {
  const cap = getFormationCap(leaders || []);
  const total = (units.regulars || 0) + (units.mercenaries || 0) + (units.cavalry || 0);
  if (total <= cap) return units;
  // Remove surplus from regulars first (most plentiful), then cavalry, then mercs
  let surplus = total - cap;
  let r = units.regulars || 0;
  let c = units.cavalry || 0;
  let m = units.mercenaries || 0;
  const trimR = Math.min(r, surplus); r -= trimR; surplus -= trimR;
  const trimC = Math.min(c, surplus); c -= trimC; surplus -= trimC;
  const trimM = Math.min(m, surplus); m -= trimM;
  return { regulars: r, mercenaries: m, cavalry: c };
}

/**
 * Check if a space has enemy units belonging to a power we're NOT at war with.
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
function hasEnemyUnitsNotAtWar(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp) return false;
  for (const u of sp.units || []) {
    if (u.owner === power || u.owner === 'independent') continue;
    if (countLandUnits(u) > 0 && !canAttack(state, power, u.owner)) return true;
  }
  return false;
}

/**
 * Find spaces with movable formations (units above garrison).
 * @param {Object} state
 * @param {string} power
 * @param {number} minUnits - Minimum units required
 * @returns {Array<{space, regulars, mercenaries, cavalry, leaders, totalUnits}>}
 */
function findMovableFormations(state, power, minUnits) {
  const formations = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller !== power) continue;
    const stack = getUnitsInSpace(state, name, power);
    if (!stack) continue;
    const total = countLandUnits(stack);
    const garrison = getGarrisonRequirement(state, name, power);
    const available = total - garrison;
    if (available >= minUnits) {
      formations.push({
        space: name,
        regulars: Math.min(stack.regulars || 0, available),
        mercenaries: Math.min(stack.mercenaries || 0, available),
        cavalry: Math.min(stack.cavalry || 0, available),
        leaders: stack.leaders || [],
        totalUnits: available
      });
    }
  }
  // Sort: largest formation first
  formations.sort((a, b) => b.totalUnits - a.totalUnits);
  return formations;
}

/**
 * BFS distance between two spaces.
 * @param {Object} state
 * @param {string} from
 * @param {string} to
 * @returns {number|null}
 */
function bfsDistance(state, from, to) {
  if (from === to) return 0;
  const visited = new Set([from]);
  const queue = [{ space: from, dist: 0 }];
  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    const adj = getAllAdjacentSpaces(space);
    for (const n of adj) {
      if (n === to) return dist + 1;
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push({ space: n, dist: dist + 1 });
    }
  }
  return null;
}

/**
 * Advance a formation toward a distant target when no adjacent target exists.
 * Used as fallback by executeSiege and executeLandBattle so that behavior
 * cards without an explicit ADVANCE goal can still move troops toward enemies.
 *
 * @param {Object} state
 * @param {string} power
 * @param {number} cp - Remaining CPs
 * @param {'fortification'|'enemy_units'} targetType
 * @returns {{action: Object, cpCost: number}|null}
 */
function advanceTowardTarget(state, power, cp, targetType) {
  const cost = ACTION_COSTS[power].move_formation;
  if (!cost || cp < cost) return null;

  const formations = findMovableFormations(state, power, 2);
  if (formations.length === 0) return null;

  for (const cand of formations) {
    // BFS from formation to find nearest target
    let target = null;
    if (targetType === 'enemy_units') {
      target = findNearestEnemySpace(state, cand.space, power);
    } else {
      // 'fortification' — BFS for nearest enemy-controlled fortification we're at war with
      target = findNearestEnemyFortification(state, cand.space, power);
    }
    if (!target) continue;

    const currentDist = target.distance;
    if (currentDist <= 1) continue; // Already adjacent — siege/battle should handle directly

    // Find adjacent space that moves us closer
    const adj = getAllAdjacentSpaces(cand.space);
    for (const dest of adj) {
      const destSp = state.spaces[dest];
      if (!destSp) continue;
      // Can't march through enemy fortification unless at war
      if (isFortified(destSp) && destSp.controller !== power &&
          (!destSp.controller || !canAttack(state, power, destSp.controller))) continue;
      // Skip spaces with units of a power we're not at war with
      if (hasEnemyUnitsNotAtWar(state, dest, power)) continue;
      // Check pass cost
      const connType = getConnectionType(cand.space, dest);
      const moveCost = connType === 'pass'
        ? (ACTION_COSTS[power].move_over_pass || 2) : cost;
      if (cp < moveCost) continue;
      const destDist = bfsDistance(state, dest, target.space);
      if (destDist !== null && destDist < currentDist) {
        return {
          action: {
            actionType: ACTION_TYPES.MOVE_FORMATION,
            actionData: {
              from: cand.space, to: dest,
              units: {
                ...capUnitsToFormation(
                  { regulars: cand.regulars, mercenaries: cand.mercenaries, cavalry: cand.cavalry },
                  cand.leaders
                ),
                leaders: cand.leaders
              }
            }
          },
          cpCost: moveCost
        };
      }
    }
  }
  return null;
}

/**
 * BFS to find nearest enemy-controlled fortification we are at war with.
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @returns {{space: string, distance: number}|null}
 */
function findNearestEnemyFortification(state, from, power) {
  const visited = new Set([from]);
  const queue = [{ space: from, dist: 0 }];

  while (queue.length > 0) {
    const { space, dist } = queue.shift();
    if (dist > 0) {
      const sp = state.spaces[space];
      if (sp && isFortified(sp) && sp.controller && sp.controller !== power &&
          canAttack(state, power, sp.controller)) {
        return { space, distance: dist };
      }
    }
    const adj = getAllAdjacentSpaces(space);
    for (const n of adj) {
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push({ space: n, dist: dist + 1 });
    }
  }
  return null;
}

/**
 * Find a siege to relieve (Bot's key/electorate under siege).
 * @param {Object} state
 * @param {string} power
 * @returns {{from, to, units, leaders}|null}
 */
function findSiegeRelief(state, power) {
  // Find our spaces under siege
  const underSiege = [];
  for (const [name, sp] of Object.entries(state.spaces)) {
    if ((sp.isKey || sp.isElectorate) && sp.controller === power && sp.siege) {
      underSiege.push(name);
    }
  }
  if (underSiege.length === 0) return null;

  // Find formation that can relieve
  const formations = findMovableFormations(state, power, 2);
  for (const siege of underSiege) {
    for (const form of formations) {
      const adj = getAllAdjacentSpaces(form.space);
      if (adj.includes(siege)) {
        return {
          from: form.space, to: siege,
          units: capUnitsToFormation(
            { regulars: form.regulars, mercenaries: form.mercenaries, cavalry: form.cavalry },
            form.leaders
          ),
          leaders: form.leaders
        };
      }
    }
  }
  return null;
}

/**
 * Check if a foreign war action is available (§3.9 sub-priority 1).
 * @param {Object} state
 * @param {string} power
 * @param {number} cp
 * @returns {{action, cpCost}|null}
 */
function checkForeignWar(state, power, cp) {
  const fwCost = ACTION_COSTS[power].fight_foreign_war;
  if (!fwCost || cp < fwCost) return null;

  const foreignWars = Array.isArray(state.foreignWars) ? state.foreignWars : [];
  for (const fw of foreignWars) {
    if (fw.targetPower !== power) continue;
    const friendly = fw.friendlyUnits || 0;
    const enemy = fw.enemyUnits || 0;
    if (friendly >= enemy) {
      return {
        action: {
          actionType: ACTION_TYPES.ASSAULT,
          actionData: { foreignWar: fw.cardNumber }
        },
        cpCost: fwCost
      };
    }
  }
  return null;
}

/**
 * Find existing siege to assault (§3.9 sub-priority 2).
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Space name
 */
function findAssaultTarget(state, power) {
  let best = null;
  let bestSize = 0;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.besieged || sp.besiegedBy !== power) continue;
    // Cannot assault in same impulse as siege establishment (validateAssault rule)
    if (sp.siegeEstablishedImpulse === state.turnNumber) continue;
    if (
      sp.siegeEstablishedCardNumber != null &&
      state.activeCardNumber != null &&
      sp.siegeEstablishedTurn === state.turn &&
      sp.siegeEstablishedBy === power &&
      sp.siegeEstablishedCardNumber === state.activeCardNumber
    ) continue;
    // §14 port: enemy naval in adjacent sea zone blocks assault
    if (sp.isPort && (sp.connectedSeaZones || []).length > 0) {
      let blocked = false;
      for (const sz of sp.connectedSeaZones) {
        const seaState = state.spaces[sz];
        if (!seaState?.units) continue;
        const enemyNaval = seaState.units.find(u =>
          u.owner !== power && canAttack(state, power, u.owner) &&
          ((u.squadrons || 0) > 0 || (u.corsairs || 0) > 0)
        );
        if (enemyNaval) { blocked = true; break; }
      }
      if (blocked) continue;
    }
    const stack = getUnitsInSpace(state, name, power);
    const size = countLandUnits(stack);
    if (size > bestSize) {
      bestSize = size;
      best = name;
    }
  }
  return best;
}

/**
 * Find enemy fortification to initiate siege (§3.9 sub-priority 3).
 * Priority: keys first, then largest formation, then highest command.
 * @param {Object} state
 * @param {string} power
 * @returns {{from, to, units, leaders}|null}
 */
function findSiegeTarget(state, power) {
  const formations = findMovableFormations(state, power, 2);
  if (formations.length === 0) return null;

  // Find enemy fortifications adjacent to our formations
  const targets = [];
  for (const form of formations) {
    const adj = getAllAdjacentSpaces(form.space);
    for (const dest of adj) {
      const sp = state.spaces[dest];
      if (!sp || !isFortified(sp)) continue;
      if (sp.controller === power) continue;
      // Must be at war with the controller
      if (sp.controller && !canAttack(state, power, sp.controller)) continue;
      // Don't re-siege if already under siege by us
      if (sp.besieged && sp.besiegedBy === power) continue;
      // Skip if space has units of a power we can't attack
      if (hasEnemyUnitsNotAtWar(state, dest, power)) continue;
      targets.push({
        from: form.space, to: dest,
        units: capUnitsToFormation(
          { regulars: form.regulars, mercenaries: form.mercenaries, cavalry: form.cavalry },
          form.leaders
        ),
        leaders: form.leaders,
        isKey: sp.isKey || false,
        formSize: form.totalUnits
      });
    }
  }

  if (targets.length === 0) return null;

  // Sort: keys first, then largest formation
  targets.sort((a, b) => {
    if (a.isKey !== b.isKey) return b.isKey ? 1 : -1;
    return b.formSize - a.formSize;
  });

  return targets[0];
}

// ── Naval Helpers ────────────────────────────────────────────────────

/**
 * Find a naval move for Set Sail goal.
 * Simplified: move squadron from port to adjacent sea zone without enemies.
 * @param {Object} state
 * @param {string} power
 * @returns {{from, to, squadrons}|null}
 */
function findNavalMove(state, power) {
  // Find ports with our squadrons or corsairs
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.isPort || sp.controller !== power) continue;
    const stack = getUnitsInSpace(state, name, power);
    if (!stack) continue;
    const hasNaval = (stack.squadrons || 0) > 0 || (stack.corsairs || 0) > 0;
    if (!hasNaval) continue;

    // Find connected sea zone
    const seaZones = sp.connectedSeaZones || [];
    for (const sz of seaZones) {
      return { from: name, to: sz };
    }
  }
  return null;
}

/**
 * Find naval battle target — sea zone with enemy ships reachable from our port.
 * @param {Object} state
 * @param {string} power
 * @returns {{from, to}|null}
 */
function findNavalBattleTarget(state, power) {
  // Find ports/sea zones with our naval assets
  for (const [name, sp] of Object.entries(state.spaces)) {
    const stack = getUnitsInSpace(state, name, power);
    if (!stack) continue;
    const ourNaval = (stack.squadrons || 0) + (stack.corsairs || 0);
    if (ourNaval === 0) continue;

    // Check adjacent sea zones for enemy fleets
    const adj = sp.isPort ? (sp.connectedSeaZones || []) : getAllAdjacentSpaces(name);
    for (const sz of adj) {
      const szSp = state.spaces[sz];
      if (!szSp || szSp.type !== 'sea_zone') continue;
      // Count enemy naval assets in this sea zone
      let enemyNaval = 0;
      for (const u of szSp.units || []) {
        if (u.owner === power || u.owner === 'independent') continue;
        if (!canAttack(state, power, u.owner)) continue;
        enemyNaval += (u.squadrons || 0) + (u.corsairs || 0);
      }
      // Engage if we have advantage or at least equal
      if (enemyNaval > 0 && ourNaval >= enemyNaval) {
        return { from: name, to: sz };
      }
    }
  }
  return null;
}

// ── Control Helpers ──────────────────────────────────────────────────

/**
 * Find space with unrest to remove (§3.10 priority 1).
 * Priority: home spaces → closest to capital.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null}
 */
function findUnrestTarget(state, power) {
  const homeUnrest = [];
  const otherUnrest = [];

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.unrest) continue;
    // Must have a unit present to take control action
    const stack = getUnitsInSpace(state, name, power);
    const hasUnit = countLandUnits(stack) > 0;
    if (!hasUnit) continue;

    if (sp.controller === power) {
      if (isHomeSpace(name, power)) {
        homeUnrest.push(name);
      } else {
        otherUnrest.push(name);
      }
    }
    // Protestant special: can remove unrest from Protestant-influenced spaces
    if (power === 'protestant' && sp.religion === RELIGION.PROTESTANT) {
      if (!homeUnrest.includes(name) && !otherUnrest.includes(name)) {
        otherUnrest.push(name);
      }
    }
  }

  if (homeUnrest.length > 0) return homeUnrest[0];
  if (otherUnrest.length > 0) return otherUnrest[0];
  return null;
}

/**
 * Find unfortified space for political control (§3.10 priority 2).
 * Priority: home spaces → closest to capital.
 * Must have a friendly unit present and space not already controlled.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null}
 */
function findControlTarget(state, power) {
  const homeTargets = [];
  const otherTargets = [];

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.controller === power) continue;
    if (isFortified(sp)) continue;
    // Must have our unit present
    const stack = getUnitsInSpace(state, name, power);
    if (!stack || countLandUnits(stack) === 0) continue;

    if (!hasLineOfCommunicationForControl(state, power, name)) continue;

    if (isHomeSpace(name, power)) {
      homeTargets.push(name);
    } else {
      otherTargets.push(name);
    }
  }

  if (homeTargets.length > 0) return homeTargets[0];
  if (otherTargets.length > 0) return otherTargets[0];
  return null;
}

// ── Religious Helpers ────────────────────────────────────────────────

/**
 * Choose translation language (§3.16).
 * Priority: German → French → English. Skip if full bible complete.
 * tracks[lang] is a number (0..fullBibleCp) tracking cumulative CP spent.
 * @param {Object} state
 * @param {Object} tracks - { german: number, french: number, english: number }
 * @returns {string|null} 'german'|'french'|'english'
 */
function chooseTranslationLanguage(state, tracks) {
  const langs = ['german', 'french', 'english'];

  for (const lang of langs) {
    const progress = tracks[lang] || 0;
    if (progress >= TRANSLATION.fullBibleCp) continue; // Full bible complete
    // French requires Calvin placed; English requires Cranmer placed
    if (lang === 'french' && !state.calvinPlaced) continue;
    if (lang === 'english' && !state.cranmerPlaced) continue;
    return lang;
  }
  return null;
}

/**
 * Count Catholic spaces in a language zone.
 * @param {Object} state
 * @param {string} zone
 * @returns {number}
 */
function countCatholicInZone(state, zone) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.languageZone === zone && sp.religion === RELIGION.CATHOLIC) count++;
  }
  return count;
}

/**
 * Choose reformation target space (§4.20).
 * Target with greatest attack dice, prefer electorates/keys.
 * @param {Object} state
 * @param {string} zone
 * @param {string} power
 * @returns {string|null}
 */
function chooseReformationTarget(state, zone, power) {
  let best = null;
  let bestDice = 0;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (zone && sp.languageZone !== zone) continue;
    if (!isValidReformationTarget(state, name)) continue;

    const dice = calcReformationDice(state, name);
    const attackDice = dice.protestant || 0;
    if (attackDice > bestDice || (attackDice === bestDice && (sp.isKey || sp.isElectorate))) {
      bestDice = attackDice;
      best = name;
    }
  }
  return best;
}

/**
 * Choose counterreformation target (§4.20).
 * @param {Object} state
 * @returns {string|null}
 */
function chooseCounterReformTarget(state) {
  let best = null;
  let bestDice = 0;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!isValidCounterReformTarget(state, name)) continue;

    const dice = calcCounterReformationDice(state, name);
    const attackDice = dice.papal || 0;
    if (attackDice > bestDice || (attackDice === bestDice && (sp.isKey || sp.isElectorate))) {
      bestDice = attackDice;
      best = name;
    }
  }
  return best;
}

/**
 * Choose Papacy debater to commit for Burn Books.
 * Priority: Cajetan → Tetzel → Caraffa.
 * @param {Object} state
 * @returns {{id: string}|null}
 */
function chooseBurnDebater(state) {
  const commitOrder = ['cajetan', 'tetzel', 'caraffa'];
  const debaters = state.debaters?.papal || [];
  for (const id of commitOrder) {
    const d = debaters.find(dd => dd.id === id && !dd.committed);
    if (d) return d;
  }
  return null;
}

/**
 * Choose debate zone for Papacy (§3.18): zone with most Protestant spaces.
 * @param {Object} state
 * @returns {string|null}
 */
function chooseDebateZonePapacy(state) {
  const zones = ['german', 'french', 'english'];
  let bestZone = null;
  let bestCount = 0;

  for (const zone of zones) {
    let count = 0;
    for (const sp of Object.values(state.spaces)) {
      if (sp.languageZone === zone && sp.religion === RELIGION.PROTESTANT) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestZone = zone;
    }
  }
  return bestZone;
}

/**
 * Choose debate zone for Protestant (§3.18): zone with highest-rated
 * uncommitted debater. Tie → German → French → English.
 * @param {Object} state
 * @returns {string|null}
 */
function chooseDebateZoneProtestant(state) {
  const zones = ['german', 'french', 'english'];
  let bestZone = null;
  let bestRating = 0;

  for (const zone of zones) {
    const debaters = getAvailableDebaters(state, 'protestant', zone, false);
    const uncommitted = debaters.filter(d => !d.committed);
    for (const d of uncommitted) {
      const def = DEBATERS.find(dd => dd.id === d.id);
      const rating = def?.value || 0;
      if (rating > bestRating) {
        bestRating = rating;
        bestZone = zone;
      }
    }
  }
  return bestZone;
}

/**
 * Choose Jesuit university placement (§4.19).
 * Catholic space adjacent to most Protestant spaces, not within 2 of existing.
 * @param {Object} state
 * @returns {string|null}
 */
function chooseJesuitPlacement(state) {
  const existing = state.jesuitUniversities || [];
  let best = null;
  let bestAdj = 0;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.religion !== RELIGION.CATHOLIC) continue;

    // Not within 2 spaces of existing Jesuit university
    let tooClose = false;
    for (const jName of existing) {
      const dist = bfsDistance(state, name, jName);
      if (dist !== null && dist <= 2) { tooClose = true; break; }
    }
    if (tooClose) continue;

    // Count adjacent Protestant spaces (connections only, not passes)
    const adj = getAdjacentSpaces(name);
    let protCount = 0;
    for (const n of adj.connections) {
      const nSp = state.spaces[n];
      if (nSp && nSp.religion === RELIGION.PROTESTANT) protCount++;
    }
    if (protCount > bestAdj) {
      bestAdj = protCount;
      best = name;
    }
  }
  return best;
}

// ── Piracy Helpers ───────────────────────────────────────────────────

/**
 * Find piracy target for Ottoman (§3.12).
 * @param {Object} state
 * @returns {{seaZone: string, targetPower: string}|null}
 */
function findPiracyTarget(state) {
  // Iterate actual sea zones — corsairs must be IN a sea zone to initiate piracy.
  // Ports holding corsairs need a separate NAVAL_MOVE first.
  for (const seaZone of SEA_ZONES) {
    const stack = getUnitsInSpace(state, seaZone, 'ottoman');
    if (!stack || (stack.corsairs || 0) === 0) continue;
    if (state.piracyUsed?.[seaZone]) continue;

    // Any non-Ottoman major power controlling a port on this sea zone is a target.
    // Piracy does NOT require being at war (§13.5).
    for (const portName of PORTS_BY_SEA_ZONE[seaZone] || []) {
      const portSp = state.spaces[portName];
      if (!portSp) continue;
      const ctrl = portSp.controller;
      if (!ctrl || ctrl === 'ottoman') continue;
      if (!MAJOR_POWERS.includes(ctrl)) continue;
      return { seaZone, targetPower: ctrl };
    }
  }
  return null;
}

// ── New World Helpers ────────────────────────────────────────────────

/** Explorer IDs by power (from leaders.js) */
function getExplorersForPower(power) {
  // Based on game setup: each power has specific explorers
  const explorers = {
    england: ['cabot', 'willoughby', 'chancellor', 'frobisher', 'drake'],
    france: ['verrazano', 'cartier', 'roberval', 'laudonniere', 'ribaut'],
    hapsburg: ['ponce_de_leon', 'de_ayllon', 'narvaez', 'de_soto', 'coronado']
  };
  return explorers[power] || [];
}

/** Conquistador IDs by power */
function getConquistadorsForPower(power) {
  const conquistadors = {
    hapsburg: ['cortes', 'pizarro', 'de_alvarado', 'de_montejo', 'de_quesada']
  };
  return conquistadors[power] || [];
}
