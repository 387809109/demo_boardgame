/**
 * Here I Stand — Siege Mechanics
 *
 * Siege establish, assault, relief, and break.
 * Section 15 of the rulebook.
 */

import { ACTION_COSTS, COMBAT } from '../constants.js';
import { spendCp } from './cp-manager.js';
import {
  getUnitsInSpace, countLandUnits, getAllAdjacentSpaces
} from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { rollDice } from './religious-actions.js';
import { applyCasualties } from './combat-actions.js';
import { hasLineOfCommunicationForControl } from './military-actions.js';

// ── Line of Communication ───────────────────────────────────────

/**
 * Check if a power has a line of communication from a space.
 * LOC = path of friendly-controlled land spaces to a friendly
 * fortified home space (fortress or capital).
 * @param {Object} state
 * @param {string} space - Source space
 * @param {string} power - Power needing LOC
 * @returns {boolean}
 */
export function hasLineOfCommunication(state, space, power) {
  return hasLineOfCommunicationForControl(state, power, space);
}

// ── Establish Siege ─────────────────────────────────────────────

/**
 * Establish a siege at a fortified space.
 * Called automatically after field battle when attacker wins at fortress
 * and has more units than inside the fortification.
 * @param {Object} state
 * @param {string} space
 * @param {string} besiegingPower
 * @param {Object} helpers
 */
export function establishSiege(state, space, besiegingPower, helpers) {
  const sp = state.spaces[space];
  sp.besieged = true;
  sp.besiegedBy = besiegingPower;
  sp.siegeEstablishedImpulse = state.turnNumber;
  sp.siegeEstablishedTurn = state.turn;
  sp.siegeEstablishedCardNumber = state.activeCardNumber ?? null;
  sp.siegeEstablishedBy = besiegingPower;

  helpers.logEvent(state, 'siege_established', {
    space, besiegedBy: besiegingPower
  });
}

// ── Validate Assault ────────────────────────────────────────────

/**
 * Validate an assault action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { space }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAssault(state, power, actionData) {
  const { space } = actionData;
  if (!space) return { valid: false, error: 'Missing space' };

  const sp = state.spaces[space];
  if (!sp) return { valid: false, error: `Space "${space}" not found` };
  if (!sp.besieged) return { valid: false, error: 'Space is not under siege' };
  if (sp.besiegedBy !== power) {
    return { valid: false, error: 'You are not the besieger' };
  }

  // Cannot assault in the same impulse that established the siege.
  const sameCardImpulse = (
    sp.siegeEstablishedCardNumber != null &&
    state.activeCardNumber != null &&
    sp.siegeEstablishedTurn === state.turn &&
    sp.siegeEstablishedBy === power &&
    sp.siegeEstablishedCardNumber === state.activeCardNumber
  );
  if (sameCardImpulse || sp.siegeEstablishedImpulse === state.turnNumber) {
    return { valid: false, error: 'Cannot assault in same impulse as siege establishment' };
  }

  // Check CP
  const cost = ACTION_COSTS[power]?.assault;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform assault' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Must have units in the space
  const stack = getUnitsInSpace(state, space, power);
  if (!stack || countLandUnits(stack) === 0) {
    return { valid: false, error: 'No units available for assault' };
  }

  // LOC check: must have a path to a friendly fortified home space
  if (!hasLineOfCommunication(state, space, power)) {
    return { valid: false, error: 'No line of communication to a friendly fortified space' };
  }

  return { valid: true };
}

// ── Execute Assault ─────────────────────────────────────────────

/**
 * Execute an assault on a besieged fortress.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { space }
 * @param {Object} helpers
 * @returns {Object} Assault result
 */
export function executeAssault(state, power, actionData, helpers) {
  const { space } = actionData;
  const cost = ACTION_COSTS[power].assault;
  spendCp(state, cost);

  const sp = state.spaces[space];
  const attackerStack = getUnitsInSpace(state, space, power);

  // Find defender stack (power that controls the space)
  const defenderPower = sp.controller;
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  // Calculate attacker dice (cavalry ignored in assaults)
  const attackerLandNoCAv = attackerStack.regulars + attackerStack.mercenaries;
  let attackerDice;
  if (!defenderStack || countLandUnits(defenderStack) === 0) {
    // No defenders: 1 die per unit
    attackerDice = attackerLandNoCAv;
  } else {
    // Defenders present: 1 die per 2 units, rounded up
    attackerDice = Math.ceil(attackerLandNoCAv / 2);
  }

  // §15.3: Add highest leader battle rating as extra dice for attacker
  let attackerLeaderBonus = 0;
  for (const lid of attackerStack.leaders) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.battle > attackerLeaderBonus) {
      attackerLeaderBonus = leader.battle;
    }
  }
  attackerDice += attackerLeaderBonus;
  attackerDice = Math.max(attackerDice, 1);

  // Defender dice (cavalry ignored) + 1 bonus
  let defenderDice = 0;
  if (defenderStack) {
    defenderDice = defenderStack.regulars + defenderStack.mercenaries;

    // Add highest defender leader battle rating
    let defenderLeaderBonus = 0;
    for (const lid of defenderStack.leaders) {
      const leader = LEADER_BY_ID[lid];
      if (leader && leader.battle > defenderLeaderBonus) {
        defenderLeaderBonus = leader.battle;
      }
    }
    defenderDice += defenderLeaderBonus;
  }
  defenderDice += COMBAT.defenderBonusDice;
  defenderDice = Math.max(defenderDice, 1);

  // Roll dice
  const attackerRolls = rollDice(attackerDice);
  const defenderRolls = rollDice(defenderDice);

  const attackerHits = attackerRolls.filter(
    d => d >= COMBAT.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= COMBAT.hitThreshold).length;

  // Apply casualties (cavalry can be taken as assault losses for attacker)
  const attackerCasualties = applyCasualties(attackerStack, defenderHits);
  let defenderCasualties = 0;
  if (defenderStack) {
    defenderCasualties = applyCasualties(defenderStack, attackerHits);
  }

  // Check success: at least 1 hit, no defenders remain, at least 1 attacker
  const defenderRemaining = defenderStack ? countLandUnits(defenderStack) : 0;
  const attackerRemaining = countLandUnits(attackerStack);

  const success = attackerHits >= 1 &&
    defenderRemaining === 0 &&
    attackerRemaining >= 1;

  if (success) {
    // Siege succeeds — attacker takes control
    sp.besieged = false;
    sp.besiegedBy = null;
    sp.siegeEstablishedImpulse = null;
    sp.siegeEstablishedTurn = null;
    sp.siegeEstablishedCardNumber = null;
    sp.siegeEstablishedBy = null;
    sp.controller = power;

    // Capture defender leaders
    if (defenderStack && defenderStack.leaders.length > 0) {
      if (!state.capturedLeaders[power]) {
        state.capturedLeaders[power] = [];
      }
      state.capturedLeaders[power].push(...defenderStack.leaders);
      defenderStack.leaders = [];
    }
  }

  // Clean up empty stacks
  sp.units = sp.units.filter(u =>
    countLandUnits(u) > 0 || u.leaders.length > 0 ||
    u.squadrons > 0 || u.corsairs > 0
  );

  const result = {
    success,
    attackerDice,
    defenderDice,
    attackerRolls,
    defenderRolls,
    attackerHits,
    defenderHits,
    attackerCasualties,
    defenderCasualties
  };

  state.impulseActions.push({ type: 'assault', space });
  helpers.logEvent(state, 'assault', { power, space, ...result });

  return result;
}

// ── Break Siege ─────────────────────────────────────────────────

/**
 * Check if a siege should be broken (besieger no longer has more
 * land units than defenders).
 * @param {Object} state
 * @param {string} space
 * @param {Object} helpers
 * @returns {boolean} Whether the siege was broken
 */
export function checkSiegeBreak(state, space, helpers) {
  const sp = state.spaces[space];
  if (!sp.besieged) return false;

  const besiegedBy = sp.besiegedBy;
  const besiegerStack = getUnitsInSpace(state, space, besiegedBy);
  const besiegerCount = besiegerStack ? countLandUnits(besiegerStack) : 0;

  // Count defender units (controlled power's units)
  const defenderPower = sp.controller;
  const defenderStack = getUnitsInSpace(state, space, defenderPower);
  const defenderCount = defenderStack ? countLandUnits(defenderStack) : 0;

  if (besiegerCount <= defenderCount) {
    sp.besieged = false;
    sp.besiegedBy = null;
    sp.siegeEstablishedImpulse = null;
    sp.siegeEstablishedTurn = null;
    sp.siegeEstablishedCardNumber = null;
    sp.siegeEstablishedBy = null;

    helpers.logEvent(state, 'siege_broken', { space, reason: 'insufficient_units' });
    return true;
  }

  return false;
}

// ── Relief ──────────────────────────────────────────────────────

/**
 * Check if a relief force arriving at a besieged space should trigger
 * a field battle. This is called when friendly units move into a
 * besieged space.
 * @param {Object} state
 * @param {string} space
 * @returns {{ shouldBattle: boolean, besiegingPower?: string }}
 */
export function checkRelief(state, space) {
  const sp = state.spaces[space];
  if (!sp.besieged) return { shouldBattle: false };
  return { shouldBattle: true, besiegingPower: sp.besiegedBy };
}
