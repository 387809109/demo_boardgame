/**
 * Here I Stand — Naval Movement, Combat & Piracy
 *
 * Naval move (1 CP, batch all stacks), naval combat resolution,
 * and Ottoman piracy.
 */

import { ACTION_COSTS, NAVAL_COMBAT, COMBAT } from '../constants.js';
import { spendCp } from './cp-manager.js';
import { getUnitsInSpace } from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { SEA_ZONES, SEA_EDGES, PORTS_BY_SEA_ZONE } from '../data/map-data.js';
import { rollDice } from './religious-actions.js';

// ── Naval Movement ──────────────────────────────────────────────

/**
 * Validate a naval movement action (1 CP, moves all eligible stacks).
 * @param {Object} state
 * @param {string} power
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNavalMove(state, power) {
  const cost = ACTION_COSTS[power]?.naval_move;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform naval movement' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }
  return { valid: true };
}

/**
 * Execute naval movement — move squadrons/corsairs between sea zones
 * and ports.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { movements: [{ from, to }] }
 * @param {Object} helpers
 */
export function executeNavalMove(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].naval_move;
  spendCp(state, cost);

  const { movements = [] } = actionData;
  for (const { from, to } of movements) {
    moveNavalStack(state, from, to, power);
  }

  state.impulseActions.push({ type: 'naval_move', movements });
  helpers.logEvent(state, 'naval_move', { power, movements });
}

/**
 * Move a naval stack (squadrons/corsairs) between spaces.
 */
function moveNavalStack(state, from, to, power) {
  const srcStack = getUnitsInSpace(state, from, power);
  if (!srcStack) return;

  let dstStack = getUnitsInSpace(state, to, power);
  if (!dstStack) {
    dstStack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    state.spaces[to].units.push(dstStack);
  }

  dstStack.squadrons += srcStack.squadrons;
  dstStack.corsairs += srcStack.corsairs;
  srcStack.squadrons = 0;
  srcStack.corsairs = 0;

  // Move naval leaders
  const navalLeaders = srcStack.leaders.filter(lid => {
    const l = LEADER_BY_ID[lid];
    return l && l.type === 'naval';
  });
  for (const lid of navalLeaders) {
    const idx = srcStack.leaders.indexOf(lid);
    if (idx !== -1) {
      srcStack.leaders.splice(idx, 1);
      dstStack.leaders.push(lid);
    }
  }

  // Remove empty stack
  if (srcStack.regulars === 0 && srcStack.mercenaries === 0 &&
      srcStack.cavalry === 0 && srcStack.squadrons === 0 &&
      srcStack.corsairs === 0 && srcStack.leaders.length === 0) {
    const sp = state.spaces[from];
    sp.units = sp.units.filter(u => u !== srcStack);
  }
}

// ── Naval Combat ────────────────────────────────────────────────

/**
 * Get the highest naval leader battle rating.
 * @param {string[]} leaderIds
 * @returns {number}
 */
function getNavalLeaderRating(leaderIds) {
  let best = 0;
  for (const lid of leaderIds) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.type === 'naval' && leader.battle > best) {
      best = leader.battle;
    }
  }
  return best;
}

/**
 * Resolve naval combat between two powers in a space (port or sea zone).
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {boolean} defenderInPort
 * @param {Object} helpers
 * @returns {Object} Naval combat result
 */
export function resolveNavalCombat(state, space, attackerPower,
  defenderPower, defenderInPort, helpers) {
  const attackerStack = getUnitsInSpace(state, space, attackerPower);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  if (!attackerStack || !defenderStack) {
    return { error: 'Both sides must have naval units' };
  }

  // Attacker dice: 2/squadron + 1/corsair + naval leader
  const attSquadDice = attackerStack.squadrons * NAVAL_COMBAT.dicePerSquadron;
  const attCorsDice = attackerStack.corsairs * NAVAL_COMBAT.dicePerCorsair;
  const attLeaderBonus = getNavalLeaderRating(attackerStack.leaders);
  let attackerDice = attSquadDice + attCorsDice + attLeaderBonus;
  attackerDice = Math.max(attackerDice, 1);

  // Defender dice: same + port bonus
  const defSquadDice = defenderStack.squadrons * NAVAL_COMBAT.dicePerSquadron;
  const defCorsDice = defenderStack.corsairs * NAVAL_COMBAT.dicePerCorsair;
  const defLeaderBonus = getNavalLeaderRating(defenderStack.leaders);
  let defenderDice = defSquadDice + defCorsDice + defLeaderBonus;
  if (defenderInPort) defenderDice += NAVAL_COMBAT.portDefenderBonusDice;
  defenderDice = Math.max(defenderDice, 1);

  // Roll
  const attackerRolls = rollDice(attackerDice);
  const defenderRolls = rollDice(defenderDice);

  const attackerHits = attackerRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;

  // Winner: tie = defender
  let winner, winnerPower, loserPower;
  if (attackerHits > defenderHits) {
    winner = 'attacker';
    winnerPower = attackerPower;
    loserPower = defenderPower;
  } else {
    winner = 'defender';
    winnerPower = defenderPower;
    loserPower = attackerPower;
  }

  // Apply naval casualties: 1 squadron per 2 hits
  const attSquadLoss = Math.floor(defenderHits / NAVAL_COMBAT.hitsPerSquadronLost);
  const defSquadLoss = Math.floor(attackerHits / NAVAL_COMBAT.hitsPerSquadronLost);

  applyNavalCasualties(attackerStack, attSquadLoss, defenderHits);
  applyNavalCasualties(defenderStack, defSquadLoss, attackerHits);

  // Odd hit against loser eliminates 1 extra squadron
  const loserStack = loserPower === attackerPower ? attackerStack : defenderStack;
  const hitsVsLoser = loserPower === attackerPower ? defenderHits : attackerHits;
  if (hitsVsLoser % 2 === 1 && loserStack.squadrons > 0) {
    loserStack.squadrons--;
  }

  // Clean up empty stacks
  const sp = state.spaces[space];
  sp.units = sp.units.filter(u =>
    u.regulars > 0 || u.mercenaries > 0 || u.cavalry > 0 ||
    u.squadrons > 0 || u.corsairs > 0 || u.leaders.length > 0
  );

  const result = {
    winner,
    winnerPower,
    loserPower,
    attackerDice,
    defenderDice,
    attackerRolls,
    defenderRolls,
    attackerHits,
    defenderHits
  };

  helpers.logEvent(state, 'naval_combat', { space, ...result });
  return result;
}

/**
 * Apply naval casualties to a stack.
 * @param {Object} stack
 * @param {number} squadronLoss
 * @param {number} totalHits - Total hits received (for corsair overflow)
 */
function applyNavalCasualties(stack, squadronLoss, totalHits) {
  const actualSquadLoss = Math.min(squadronLoss, stack.squadrons);
  stack.squadrons -= actualSquadLoss;

  // Remaining hits after squadron losses hit corsairs (Ottoman)
  const hitsUsedOnSquads = actualSquadLoss * NAVAL_COMBAT.hitsPerSquadronLost;
  const remainingHits = totalHits - hitsUsedOnSquads;
  if (remainingHits > 0 && stack.corsairs > 0) {
    const corsairLoss = Math.min(remainingHits, stack.corsairs);
    stack.corsairs -= corsairLoss;
  }
}

// ── Piracy ──────────────────────────────────────────────────────

/**
 * Validate a piracy action (Ottoman only, 2 CP, once per sea zone per turn).
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { seaZone, targetPower }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePiracy(state, power, actionData) {
  if (power !== 'ottoman') {
    return { valid: false, error: 'Only Ottoman can perform piracy' };
  }

  const { seaZone, targetPower } = actionData;
  if (!seaZone) return { valid: false, error: 'Missing sea zone' };
  if (!targetPower) return { valid: false, error: 'Missing target power' };

  const cost = ACTION_COSTS[power]?.initiate_piracy;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot perform piracy' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Once per sea zone per turn
  if (state.piracyUsed[seaZone]) {
    return { valid: false, error: 'Already used piracy in this sea zone this turn' };
  }

  // Must have corsairs in the sea zone
  const stack = getUnitsInSpace(state, seaZone, power);
  if (!stack || stack.corsairs === 0) {
    return { valid: false, error: 'No corsairs in this sea zone' };
  }

  return { valid: true };
}

/**
 * Execute a piracy action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { seaZone, targetPower }
 * @param {Object} helpers
 * @returns {Object} Piracy result
 */
export function executePiracy(state, power, actionData, helpers) {
  const { seaZone, targetPower } = actionData;
  const cost = ACTION_COSTS[power].initiate_piracy;
  spendCp(state, cost);

  const stack = getUnitsInSpace(state, seaZone, power);

  // Anti-piracy roll by target (1 die per target squadron in zone)
  const targetStack = getUnitsInSpace(state, seaZone, targetPower);
  const antiPiracyDice = targetStack ? targetStack.squadrons : 0;
  const antiPiracyRolls = antiPiracyDice > 0 ? rollDice(antiPiracyDice) : [];
  const antiPiracyHits = antiPiracyRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;

  // Remove corsairs hit by anti-piracy
  const corsairsBefore = stack.corsairs;
  stack.corsairs = Math.max(0, stack.corsairs - antiPiracyHits);

  // Piracy roll (1 die per remaining corsair + piracy rating)
  let piracyDice = stack.corsairs;
  for (const lid of stack.leaders) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.piracy) piracyDice += leader.piracy;
  }
  piracyDice = Math.max(piracyDice, 0);

  const piracyRolls = piracyDice > 0 ? rollDice(piracyDice) : [];
  const piracyHits = piracyRolls.filter(
    d => d >= NAVAL_COMBAT.hitThreshold).length;

  // Mark used
  state.piracyUsed[seaZone] = true;

  const result = {
    antiPiracyDice,
    antiPiracyRolls,
    antiPiracyHits,
    corsairsLost: corsairsBefore - stack.corsairs,
    piracyDice,
    piracyRolls,
    piracyHits
  };

  state.impulseActions.push({ type: 'piracy', seaZone, targetPower });
  helpers.logEvent(state, 'piracy', { power, seaZone, targetPower, ...result });

  return result;
}
