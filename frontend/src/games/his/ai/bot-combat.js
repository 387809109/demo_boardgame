/**
 * Here I Stand — HISBOT Combat Decisions (Phase E3)
 *
 * §4.1  Avoiding Battle (land & naval)
 * §4.2  Besieged Bot Units (withdraw vs field battle)
 * §4.14 Interception (only from unfortified → fortified under siege)
 * §4.23 Retreat (land → closest friendly fortification, naval → capital)
 *
 * All functions return action objects compatible with bot-controller.js.
 */

import { ACTION_TYPES } from '../actions/action-types.js';
import { CAPITALS } from '../constants.js';
import {
  getUnitsInSpace, countLandUnits, isFortified,
  getAllAdjacentSpaces, getFormationCap,
  findNearestFortifiedSpace
} from '../state/state-helpers.js';
import { getGarrisonRequirement } from './bot-goals.js';
import {
  simpleBfsDistance, findClosestSpace, getCapitals
} from './bot-helpers.js';

// ═══════════════════════════════════════════════════════════════════════
//  §4.1 AVOIDING BATTLE
// ═══════════════════════════════════════════════════════════════════════

/**
 * §4.1 Decide whether to avoid battle (land).
 *
 * Bot avoids if:
 *   - Has ≤ half the attacker's strength
 *   - AND can move as a single formation (all units fit under command cap)
 * Otherwise: stand ground.
 *
 * @param {Object} state
 * @param {string} power - Defending power
 * @returns {{ avoid: boolean, retreatTo: string|null }}
 */
export function shouldAvoidLandBattle(state, power) {
  const battle = state.pendingBattle;
  if (!battle) return { avoid: false, retreatTo: null };

  const spaceName = battle.space;
  const sp = state.spaces[spaceName];

  // Never avoid in fortified space (§4.2 handles that separately)
  if (sp && isFortified(sp)) return { avoid: false, retreatTo: null };

  const defStack = getUnitsInSpace(state, spaceName, power);
  const defStrength = countLandUnits(defStack);
  const atkStrength = battle.attackerStrength || 0;

  // Condition 1: defender ≤ half attacker strength
  if (defStrength > Math.floor(atkStrength / 2)) {
    return { avoid: false, retreatTo: null };
  }

  // Condition 2: can move as single formation
  const leaders = defStack?.leaders || [];
  const cap = getFormationCap(leaders);
  if (defStrength > cap) {
    return { avoid: false, retreatTo: null };
  }

  // Find retreat destination
  const retreatTo = findRetreatDestination(state, spaceName, power);
  if (!retreatTo) return { avoid: false, retreatTo: null };

  return { avoid: true, retreatTo };
}

/**
 * §4.1 Decide whether to avoid naval battle.
 *
 * Bot avoids if fleet has ≤ half the attacker's fleet strength.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ avoid: boolean }}
 */
export function shouldAvoidNavalBattle(state, power) {
  const battle = state.pendingBattle;
  if (!battle || battle.type !== 'naval') return { avoid: false };

  const defStrength = battle.defenderStrength || 0;
  const atkStrength = battle.attackerStrength || 0;

  return { avoid: defStrength <= Math.floor(atkStrength / 2) };
}

// ═══════════════════════════════════════════════════════════════════════
//  §4.2 BESIEGED BOT UNITS
// ═══════════════════════════════════════════════════════════════════════

/**
 * §4.2 Decide whether to withdraw into fortification.
 *
 * When enemy moves into a fortified space occupied by Bot:
 *   - ≤ 4 land units → withdraw into fortification
 *   - Otherwise → fight field battle
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ withdraw: boolean }}
 */
export function shouldWithdrawIntoFortification(state, power) {
  const battle = state.pendingBattle;
  if (!battle) return { withdraw: false };

  const spaceName = battle.space;
  const sp = state.spaces[spaceName];
  if (!sp || !isFortified(sp)) return { withdraw: false };

  const defStack = getUnitsInSpace(state, spaceName, power);
  const defStrength = countLandUnits(defStack);

  return { withdraw: defStrength <= 4 };
}

/**
 * §4.2 After losing field battle in fortified space — retreat survivors
 * into fortification, keeping a single leader with battle rating ≥ 1.
 *
 * @param {Object} state
 * @param {string} power
 * @param {string[]} survivingLeaders
 * @returns {{ retreatLeader: string|null }}
 */
export function chooseSiegeLeader(state, power, survivingLeaders) {
  if (!survivingLeaders || survivingLeaders.length === 0) {
    return { retreatLeader: null };
  }

  // Keep single leader with battle rating ≥ 1
  for (const lid of survivingLeaders) {
    const leader = LEADER_BY_ID?.[lid];
    if (leader && leader.battle >= 1) {
      return { retreatLeader: lid };
    }
  }

  // No leader with battle ≥ 1 — don't keep any
  return { retreatLeader: null };
}

// Import for chooseSiegeLeader
import { LEADER_BY_ID } from '../data/leaders.js';

// ═══════════════════════════════════════════════════════════════════════
//  §4.14 INTERCEPTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * §4.14 Interception Decision.
 *
 * Bots only intercept from unfortified spaces INTO controlled fortified
 * spaces being placed under siege by an enemy.
 *
 * Do not intercept in any other situation.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ intercept: boolean, from: string|null, to: string|null }}
 */
export function shouldIntercept(state, power) {
  const interception = state.pendingInterception;
  if (!interception) return { intercept: false, from: null, to: null };

  const targetSpace = interception.targetSpace;
  const targetSp = state.spaces[targetSpace];

  // Must be a controlled fortified space being sieged
  if (!targetSp || !isFortified(targetSp)) {
    return { intercept: false, from: null, to: null };
  }
  if (targetSp.controller !== power) {
    return { intercept: false, from: null, to: null };
  }

  // Enemy must be placing it under siege (moving into the space)
  if (!interception.enemyMovingIn) {
    return { intercept: false, from: null, to: null };
  }

  // Find adjacent unfortified space with our units above garrison
  const candidates = interception.interceptFrom || [];
  for (const fromSpace of candidates) {
    const fromSp = state.spaces[fromSpace];
    if (!fromSp) continue;

    // Must be unfortified
    if (isFortified(fromSp)) continue;

    const stack = getUnitsInSpace(state, fromSpace, power);
    const total = countLandUnits(stack);
    const garrison = getGarrisonRequirement(state, fromSpace, power);

    if (total > garrison) {
      return { intercept: true, from: fromSpace, to: targetSpace };
    }
  }

  return { intercept: false, from: null, to: null };
}

// ═══════════════════════════════════════════════════════════════════════
//  §4.23 RETREAT
// ═══════════════════════════════════════════════════════════════════════

/**
 * §4.23 Retreat destination for land units.
 *
 * Land units: retreat toward the closest friendly fortification.
 *
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @returns {string|null}
 */
export function findRetreatDestination(state, from, power) {
  return findNearestFortifiedSpace(state, from, power);
}

/**
 * §4.23 Retreat destination for naval units.
 *
 * Naval: move to port or sea zone closest to capital.
 * Ottoman corsairs: retreat toward Algiers, or Istanbul if Algiers not controlled.
 *
 * @param {Object} state
 * @param {string} power
 * @param {Object} [opts]
 * @param {boolean} [opts.isCorsair=false]
 * @returns {string|null}
 */
export function findNavalRetreatDestination(state, power, opts = {}) {
  if (opts.isCorsair && power === 'ottoman') {
    return findCorsairRetreat(state);
  }

  // Find port closest to capital
  const capitals = getCapitals(power);
  if (capitals.length === 0) return null;

  let bestPort = null;
  let bestDist = Infinity;

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (!sp.isPort || sp.controller !== power) continue;
    for (const cap of capitals) {
      const d = simpleBfsDistance(name, cap);
      if (d !== null && d < bestDist) {
        bestDist = d;
        bestPort = name;
      }
    }
  }

  return bestPort;
}

/**
 * Corsair retreat: toward Algiers, or Istanbul if not under Ottoman control.
 * @param {Object} state
 * @returns {string|null}
 */
function findCorsairRetreat(state) {
  const algiers = state.spaces['Algiers'];
  if (algiers && algiers.controller === 'ottoman') return 'Algiers';
  const istanbul = state.spaces['Istanbul'];
  if (istanbul && istanbul.controller === 'ottoman') return 'Istanbul';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
//  COMBINED BATTLE DECISION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Main battle decision function — replaces the stub in bot-controller.js.
 *
 * Handles:
 *   - Avoid battle (§4.1)
 *   - Withdraw into fortification (§4.2)
 *   - Retreat choice
 *   - Auto-resolve
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object} Action object
 */
export function decideBattleAction(state, power) {
  const battle = state.pendingBattle;
  if (!battle) {
    return { actionType: ACTION_TYPES.RESOLVE_BATTLE, actionData: {} };
  }

  // Retreat choice after battle
  if (battle.type === 'retreat_choice') {
    const retreatTo = findRetreatDestination(state, battle.space, power);
    if (retreatTo) {
      return {
        actionType: ACTION_TYPES.RESOLVE_RETREAT,
        actionData: { retreat: true, destination: retreatTo }
      };
    }
    return { actionType: ACTION_TYPES.RESOLVE_RETREAT, actionData: { retreat: false } };
  }

  // Naval battle avoidance
  if (battle.type === 'naval') {
    const { avoid } = shouldAvoidNavalBattle(state, power);
    if (avoid) {
      const retreatPort = findNavalRetreatDestination(state, power,
        { isCorsair: battle.isCorsair });
      return {
        actionType: ACTION_TYPES.AVOID_BATTLE,
        actionData: { destination: retreatPort }
      };
    }
    return { actionType: ACTION_TYPES.RESOLVE_BATTLE, actionData: {} };
  }

  // Land: check avoid battle first (§4.1)
  if (battle.type === 'avoid_battle_choice') {
    const { avoid, retreatTo } = shouldAvoidLandBattle(state, power);
    if (avoid && retreatTo) {
      return {
        actionType: ACTION_TYPES.AVOID_BATTLE,
        actionData: { destination: retreatTo }
      };
    }
    return { actionType: ACTION_TYPES.RESOLVE_BATTLE, actionData: {} };
  }

  // Check withdraw into fortification (§4.2)
  if (battle.canWithdraw) {
    const { withdraw } = shouldWithdrawIntoFortification(state, power);
    if (withdraw) {
      return {
        actionType: ACTION_TYPES.WITHDRAW_INTO_FORTIFICATION,
        actionData: {}
      };
    }
  }

  // Default: resolve battle
  return { actionType: ACTION_TYPES.RESOLVE_BATTLE, actionData: {} };
}

/**
 * Main interception decision function — replaces stub in bot-controller.js.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object} Action object
 */
export function decideInterceptionAction(state, power) {
  const { intercept, from, to } = shouldIntercept(state, power);
  return {
    actionType: ACTION_TYPES.RESOLVE_INTERCEPTION,
    actionData: { intercept, from, to }
  };
}
