/**
 * Here I Stand — Field Battle Resolution
 *
 * 12-step combat procedure from Section 14 of the rulebook.
 * Dice pool: 1 per land unit + highest leader battle rating.
 * Defender gets +1 bonus die. Hit threshold ≥ 5.
 */

import { COMBAT } from '../constants.js';
import {
  getUnitsInSpace, countLandUnits
} from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { rollDice } from './religious-actions.js';
import {
  findLegalRetreats, canWithdrawIntoFortification,
  executeRetreat, eliminateFormation
} from './retreat.js';

// ── Dice Calculation ────────────────────────────────────────────

/**
 * Get the highest battle rating among leaders in a stack.
 * @param {string[]} leaderIds
 * @returns {number}
 */
export function getHighestBattleRating(leaderIds) {
  let best = 0;
  for (const lid of leaderIds) {
    const leader = LEADER_BY_ID[lid];
    if (leader && leader.type === 'army' && leader.battle > best) {
      best = leader.battle;
    }
  }
  return best;
}

/**
 * Calculate dice pool for a side in field battle.
 * @param {Object} stack - Unit stack
 * @param {boolean} isDefender
 * @returns {{ dice: number, unitCount: number, leaderBonus: number }}
 */
export function calculateBattleDice(stack, isDefender) {
  const unitCount = countLandUnits(stack);
  const leaderBonus = getHighestBattleRating(stack.leaders);
  let dice = unitCount + leaderBonus;
  if (isDefender) dice += COMBAT.defenderBonusDice;
  return { dice: Math.max(dice, 1), unitCount, leaderBonus };
}

// ── Apply Casualties ────────────────────────────────────────────

/**
 * Apply hits to a unit stack (1 hit = 1 land unit removed).
 * Removes mercenaries first, then regulars, then cavalry.
 * @param {Object} stack - Unit stack (mutated)
 * @param {number} hits
 * @returns {number} Actual casualties applied
 */
export function applyCasualties(stack, hits) {
  let remaining = hits;
  let total = 0;

  // Remove mercenaries first
  const mercLoss = Math.min(remaining, stack.mercenaries);
  stack.mercenaries -= mercLoss;
  remaining -= mercLoss;
  total += mercLoss;

  // Then regulars
  const regLoss = Math.min(remaining, stack.regulars);
  stack.regulars -= regLoss;
  remaining -= regLoss;
  total += regLoss;

  // Then cavalry
  const cavLoss = Math.min(remaining, stack.cavalry);
  stack.cavalry -= cavLoss;
  remaining -= cavLoss;
  total += cavLoss;

  return total;
}

// ── Field Battle ────────────────────────────────────────────────

/**
 * Resolve a field battle between two powers at a space.
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {Object} helpers
 * @returns {Object} Battle result
 */
export function resolveFieldBattle(state, space, attackerPower,
  defenderPower, helpers) {
  const attackerStack = getUnitsInSpace(state, space, attackerPower);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  if (!attackerStack || !defenderStack) {
    return { error: 'Both sides must have units in the space' };
  }

  // Step 1: Response window for Landsknechts/Swiss (stub for Phase 6)

  // Steps 2-3: Calculate dice
  const attackerCalc = calculateBattleDice(attackerStack, false);
  const defenderCalc = calculateBattleDice(defenderStack, true);

  // Steps 4-5: Combat card play windows (stub for Phase 6)

  // Step 6: Roll dice, count hits
  const attackerRolls = rollDice(attackerCalc.dice);
  const defenderRolls = rollDice(defenderCalc.dice);

  const attackerHits = attackerRolls.filter(
    d => d >= COMBAT.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= COMBAT.hitThreshold).length;

  // Step 7: Janissaries response window (stub for Phase 6)

  // Step 8: Determine winner (tie = defender wins)
  let winner, loser, winnerPower, loserPower;
  if (attackerHits > defenderHits) {
    winner = 'attacker';
    winnerPower = attackerPower;
    loserPower = defenderPower;
  } else {
    // Tie or defender has more hits → defender wins
    winner = 'defender';
    winnerPower = defenderPower;
    loserPower = attackerPower;
  }

  // Step 9: Apply casualties
  const attackerCasualties = applyCasualties(attackerStack, defenderHits);
  const defenderCasualties = applyCasualties(defenderStack, attackerHits);

  const attackerRemaining = countLandUnits(attackerStack);
  const defenderRemaining = countLandUnits(defenderStack);

  // Both eliminated: side with more dice retains 1 unit
  if (attackerRemaining === 0 && defenderRemaining === 0) {
    if (attackerCalc.dice > defenderCalc.dice) {
      attackerStack.regulars = 1;
      winner = 'attacker';
      winnerPower = attackerPower;
      loserPower = defenderPower;
    } else {
      // Equal or defender more → defender retains
      defenderStack.regulars = 1;
      winner = 'defender';
      winnerPower = defenderPower;
      loserPower = attackerPower;
    }
  }

  // Step 10: Capture loser's leaders
  const loserStack = loserPower === attackerPower
    ? attackerStack : defenderStack;
  const capturedLeaders = [];

  if (countLandUnits(loserStack) === 0 && loserStack.leaders.length > 0) {
    capturedLeaders.push(...loserStack.leaders);
    if (!state.capturedLeaders[winnerPower]) {
      state.capturedLeaders[winnerPower] = [];
    }
    state.capturedLeaders[winnerPower].push(...loserStack.leaders);
    loserStack.leaders = [];
  }

  // Clean up empty stacks
  const sp = state.spaces[space];
  sp.units = sp.units.filter(u =>
    countLandUnits(u) > 0 || u.leaders.length > 0 ||
    u.squadrons > 0 || u.corsairs > 0
  );

  const result = {
    winner,
    winnerPower,
    loserPower,
    attackerDice: attackerCalc.dice,
    defenderDice: defenderCalc.dice,
    attackerRolls,
    defenderRolls,
    attackerHits,
    defenderHits,
    attackerCasualties,
    defenderCasualties,
    capturedLeaders
  };

  helpers.logEvent(state, 'field_battle', {
    space, ...result
  });

  // Steps 11-12: Set up pending retreat/siege
  handlePostBattle(state, space, result, helpers);

  return result;
}

// ── Post-Battle ─────────────────────────────────────────────────

/**
 * Handle retreat and siege initiation after field battle.
 * @param {Object} state
 * @param {string} space
 * @param {Object} battleResult
 * @param {Object} helpers
 */
function handlePostBattle(state, space, battleResult, helpers) {
  const { loserPower, winnerPower } = battleResult;
  const loserStack = getUnitsInSpace(state, space, loserPower);

  if (!loserStack || countLandUnits(loserStack) === 0) {
    // Loser fully eliminated — check siege initiation
    checkSiegeInitiation(state, space, winnerPower, helpers);
    return;
  }

  // Step 11: Loser retreats or withdraws into fortification
  const sp = state.spaces[space];
  if (canWithdrawIntoFortification(state, space, loserPower)) {
    // Loser can withdraw into fortification — set up pending choice
    state.pendingBattle = {
      type: 'retreat_choice',
      space,
      loserPower,
      winnerPower,
      canWithdraw: true,
      retreatOptions: findLegalRetreats(state, space, loserPower)
    };
  } else {
    const retreatOptions = findLegalRetreats(state, space, loserPower);
    if (retreatOptions.length === 0) {
      // No legal retreat → eliminate
      eliminateFormation(state, space, loserPower, winnerPower, helpers);
      checkSiegeInitiation(state, space, winnerPower, helpers);
    } else if (retreatOptions.length === 1) {
      // Auto-retreat to only option
      executeRetreat(state, space, loserPower, retreatOptions[0], helpers);
      checkSiegeInitiation(state, space, winnerPower, helpers);
    } else {
      // Multiple retreat options — set pending
      state.pendingBattle = {
        type: 'retreat_choice',
        space,
        loserPower,
        winnerPower,
        canWithdraw: false,
        retreatOptions
      };
    }
  }
}

/**
 * Check if a siege should be initiated after battle.
 * Step 12: attacker won at fortress with more units than garrison.
 */
function checkSiegeInitiation(state, space, winnerPower, helpers) {
  const sp = state.spaces[space];
  if (!sp.isFortress) return;

  // Check if there are defender units inside (withdrew into fort)
  const defenderUnits = sp.units.filter(u => u.owner !== winnerPower);
  const defenderCount = defenderUnits.reduce(
    (sum, u) => sum + countLandUnits(u), 0
  );

  const winnerStack = getUnitsInSpace(state, space, winnerPower);
  const winnerCount = winnerStack ? countLandUnits(winnerStack) : 0;

  if (winnerCount > defenderCount && sp.controller !== winnerPower) {
    sp.besieged = true;
    sp.besiegedBy = winnerPower;
    sp.siegeEstablishedImpulse = state.turnNumber;

    helpers.logEvent(state, 'siege_established', {
      space, besiegedBy: winnerPower
    });
  }
}
