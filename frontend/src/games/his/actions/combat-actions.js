/**
 * Here I Stand — Field Battle Resolution
 *
 * 12-step combat procedure from Section 14 of the rulebook.
 * Dice pool: 1 per land unit + highest leader battle rating.
 * Defender gets +1 bonus die. Hit threshold >= 5.
 *
 * Battle flow (with response card windows):
 *   initiateFieldBattle  -> (W1 merc?) -> (W2 attacker?) -> (W3 defender?)
 *                        -> executeFieldBattle -> (W4 Janissaries?)
 *                        -> finalizeFieldBattle -> handlePostBattle
 *
 * resolveFieldBattle() is kept as a backward-compatible synchronous wrapper:
 * when called directly (e.g., from tests), if no response windows are needed
 * it completes in one call. If windows would be needed but the caller is
 * going through the wrapper, it skips them and executes immediately.
 */

import { COMBAT } from '../constants.js';
import {
  getUnitsInSpace, countLandUnits, isFortified
} from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { rollDice } from './religious-actions.js';
import {
  findLegalRetreats, canWithdrawIntoFortification,
  executeRetreat, eliminateFormation
} from './retreat.js';
import {
  canAnyPowerRespondCombat, createCombatCardWindow,
  getNextCombatWindow, createMercenaryWindow,
  canAnyPowerRespondPostRoll, createPostRollWindow
} from './response-actions.js';

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

// ── Initiate Field Battle (Step A) ──────────────────────────────

/**
 * Begin a field battle: validate stacks, calculate dice, then check
 * if any combat-card response windows (W2/W3) should open.
 *
 * Returns { paused: true, window } when a response window opens, or
 * delegates to executeFieldBattle() and returns its result directly.
 *
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {Object} helpers
 * @returns {Object} Battle result or { paused: true, window }
 */
export function initiateFieldBattle(state, space, attackerPower,
  defenderPower, helpers) {
  const attackerStack = getUnitsInSpace(state, space, attackerPower);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  if (!attackerStack || !defenderStack) {
    return { error: 'Both sides must have units in the space' };
  }

  // Steps 2-3: Calculate dice
  const attackerCalc = calculateBattleDice(attackerStack, false);
  const defenderCalc = calculateBattleDice(defenderStack, true);

  // Store dice calculations for later execution
  const battleState = {
    attackerCalc,
    defenderCalc,
    responses: {}
  };

  // Step 3b: Check W1 mercenary window (any player, impulse order)
  const mercWindowCreated = createMercenaryWindow(
    state, space, attackerPower, defenderPower, battleState
  );
  if (mercWindowCreated) {
    return { paused: true, window: 'W1' };
  }

  // Steps 4-5: Check combat card windows
  const { attackerCanRespond, defenderCanRespond } =
    canAnyPowerRespondCombat(state, 'field', attackerPower, defenderPower);

  if (attackerCanRespond) {
    // Open W2 (attacker combat card window)
    const created = createCombatCardWindow(
      state, 'W2', space, attackerPower, defenderPower,
      'field', battleState
    );
    if (created) {
      return { paused: true, window: 'W2' };
    }
  }

  if (defenderCanRespond) {
    // Skip to W3 (defender combat card window)
    const created = createCombatCardWindow(
      state, 'W3', space, attackerPower, defenderPower,
      'field', battleState
    );
    if (created) {
      return { paused: true, window: 'W3' };
    }
  }

  // Neither can respond — execute immediately
  return executeFieldBattle(
    state, space, attackerPower, defenderPower, helpers, battleState
  );
}

// ── Resume Field Battle (Step B) ────────────────────────────────

/**
 * Called after a response card is played or declined.
 * Checks if another response window should open; if not, executes
 * the battle with accumulated responses.
 *
 * @param {Object} state
 * @param {Object} helpers
 * @returns {Object} Battle result or { paused: true }
 */
export function resumeFieldBattle(state, helpers) {
  const battle = state.pendingBattle;
  if (!battle) {
    return { error: 'No pending battle to resume' };
  }

  const { space, attackerPower, defenderPower } = battle;
  const battleType = battle.battleType || 'field';

  // Get responses accumulated during windows
  const responses = battle.responses || {};

  const nextWindow = getNextCombatWindow(
    battle.lastWindow, state, space, attackerPower, defenderPower,
    battleType, { responses }
  );

  if (nextWindow) {
    const created = createCombatCardWindow(
      state, nextWindow, space, attackerPower, defenderPower,
      battleType, { responses }
    );
    if (created) {
      battle.lastWindow = nextWindow;
      return { paused: true, window: nextWindow };
    }
  }

  // No more windows — execute the battle
  state.pendingBattle = null;
  return executeFieldBattle(
    state, space, attackerPower, defenderPower, helpers, { responses }
  );
}

// ── Execute Field Battle (Step C) ───────────────────────────────

/**
 * Execute the dice-rolling portion of a field battle.
 * Rolls dice, then checks if W4 (Janissaries) should open.
 * If W4 is needed, pauses and stores rolls in battleState.
 * Otherwise, delegates to finalizeFieldBattle().
 *
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {Object} helpers
 * @param {Object} [battleState] - Accumulated state from response windows
 * @returns {Object} Battle result or { paused: true, window: 'W4' }
 */
export function executeFieldBattle(state, space, attackerPower,
  defenderPower, helpers, battleState = {}) {
  const attackerStack = getUnitsInSpace(state, space, attackerPower);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  if (!attackerStack || !defenderStack) {
    return { error: 'Both sides must have units in the space' };
  }

  // Use pre-calculated dice or recalculate
  const attackerCalc = battleState.attackerCalc
    || calculateBattleDice(attackerStack, false);
  const defenderCalc = battleState.defenderCalc
    || calculateBattleDice(defenderStack, true);

  // Apply combat card bonus dice from responses
  let attackerDice = attackerCalc.dice;
  let defenderDice = defenderCalc.dice;

  if (state.pendingCombatBonus) {
    const bonus = state.pendingCombatBonus;
    if (bonus.attackerBonusDice) {
      attackerDice += bonus.attackerBonusDice;
    }
    if (bonus.defenderBonusDice) {
      defenderDice += bonus.defenderBonusDice;
    }
    state.pendingCombatBonus = null;
  }

  // Step 6: Roll dice
  const attackerRolls = rollDice(attackerDice);
  const defenderRolls = rollDice(defenderDice);

  // Step 7: Check W4 (Janissaries post-roll window) — field only
  const postRollCheck = canAnyPowerRespondPostRoll(
    state, 'field', attackerPower, defenderPower
  );

  if (postRollCheck.canRespond) {
    // Store dice rolls in battleState for finalization after W4
    const updatedBattleState = {
      ...battleState,
      attackerRolls,
      defenderRolls,
      attackerDice,
      defenderDice
    };

    const created = createPostRollWindow(
      state, postRollCheck.windowType, space,
      attackerPower, defenderPower, 'field', updatedBattleState
    );

    if (created) {
      return {
        paused: true,
        window: postRollCheck.windowType,
        rolls: { attackerRolls, defenderRolls }
      };
    }
  }

  // No W4 needed — finalize immediately
  return finalizeFieldBattle(state, space, attackerPower, defenderPower,
    helpers, { ...battleState, attackerRolls, defenderRolls,
      attackerDice, defenderDice });
}

// ── Finalize Field Battle (Step D) ──────────────────────────────

/**
 * Finalize a field battle after all post-roll windows have resolved.
 * Determines winner, applies casualties, handles post-battle effects.
 * Called either directly from executeFieldBattle (no W4) or from
 * _advanceAfterResponse after W4 resolves.
 *
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {Object} helpers
 * @param {Object} battleState - Must contain attackerRolls, defenderRolls,
 *                               attackerDice, defenderDice
 * @returns {Object} Battle result
 */
export function finalizeFieldBattle(state, space, attackerPower,
  defenderPower, helpers, battleState) {
  const attackerStack = getUnitsInSpace(state, space, attackerPower);
  const defenderStack = getUnitsInSpace(state, space, defenderPower);

  if (!attackerStack || !defenderStack) {
    return { error: 'Both sides must have units in the space' };
  }

  const {
    attackerRolls, defenderRolls, attackerDice, defenderDice
  } = battleState;

  // Apply Janissaries bonus (if played during W4)
  let finalAttackerDice = attackerDice;
  if (state.janissariesBonus) {
    finalAttackerDice += state.janissariesBonus.dice;
    state.janissariesBonus = null;
  }

  // Count hits from the dice already rolled
  const attackerHits = attackerRolls.filter(
    d => d >= COMBAT.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= COMBAT.hitThreshold).length;

  // If Janissaries was played, roll extra dice and add hits
  let janissariesExtraHits = 0;
  if (finalAttackerDice > attackerDice) {
    const extraDice = finalAttackerDice - attackerDice;
    const extraRolls = rollDice(extraDice);
    janissariesExtraHits = extraRolls.filter(
      d => d >= COMBAT.hitThreshold).length;
  }
  const totalAttackerHits = attackerHits + janissariesExtraHits;

  // Step 8: Determine winner (tie = defender wins)
  let winner, winnerPower, loserPower;
  if (totalAttackerHits > defenderHits) {
    winner = 'attacker';
    winnerPower = attackerPower;
    loserPower = defenderPower;
  } else {
    // Tie or defender has more hits -> defender wins
    winner = 'defender';
    winnerPower = defenderPower;
    loserPower = attackerPower;
  }

  // Step 9: Apply casualties
  const attackerCasualties = applyCasualties(attackerStack, defenderHits);
  const defenderCasualties = applyCasualties(
    defenderStack, totalAttackerHits
  );

  const attackerRemaining = countLandUnits(attackerStack);
  const defenderRemaining = countLandUnits(defenderStack);

  // Both eliminated: side with more dice retains 1 unit
  if (attackerRemaining === 0 && defenderRemaining === 0) {
    if (finalAttackerDice > defenderDice) {
      attackerStack.regulars = 1;
      winner = 'attacker';
      winnerPower = attackerPower;
      loserPower = defenderPower;
    } else {
      // Equal or defender more -> defender retains
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
    attackerDice: finalAttackerDice,
    defenderDice,
    attackerRolls,
    defenderRolls,
    attackerHits: totalAttackerHits,
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

// ── Backward-Compatible Wrapper ─────────────────────────────────

/**
 * Resolve a field battle between two powers at a space.
 * Backward-compatible: when called directly (from existing tests),
 * skips response windows and completes synchronously.
 *
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {Object} helpers
 * @returns {Object} Battle result
 */
export function resolveFieldBattle(state, space, attackerPower,
  defenderPower, helpers) {
  // Go straight to execute — skip response windows for direct callers
  return executeFieldBattle(
    state, space, attackerPower, defenderPower, helpers
  );
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
      // No legal retreat -> eliminate
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
  if (!isFortified(sp, state)) return;

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
    sp.siegeEstablishedTurn = state.turn;
    sp.siegeEstablishedCardNumber = state.activeCardNumber ?? null;
    sp.siegeEstablishedBy = winnerPower;

    helpers.logEvent(state, 'siege_established', {
      space, besiegedBy: winnerPower
    });
  }
}
