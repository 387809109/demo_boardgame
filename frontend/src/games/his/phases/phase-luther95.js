/**
 * Here I Stand — Luther's 95 Theses Phase
 *
 * Turn 1 only. Before Card Draw.
 * Interactive: Protestant player chooses targets sequentially.
 *
 * Flow:
 * 1. Wittenberg becomes Protestant, Luther placed there
 * 2. Protestant regulars placed in Wittenberg (from Electorate board)
 * 3. Protestant player gets 5 reformation attempts in German zone
 * 4. Each attempt: player chooses target → dice rolled → result shown
 * 5. After each attempt, adjacency recalculated for next target selection
 *
 * Bonus: +1 die per attempt (attempt 1: +1, attempt 2: +2, ... attempt 5: +5)
 *
 * Per rulebook 18.3: targets must be Catholic, in German zone,
 * and adjacent to a Protestant space (or contain a reformer).
 */

import { RELIGION } from '../constants.js';
import { rollDice, maxDie } from '../actions/religious-actions.js';
import {
  getAllAdjacentSpaces, getAdjacentSpaces,
  calcReformationDice, recountProtestantSpaces,
  isValidReformationTarget
} from '../state/state-helpers.js';
import { placeReformer } from '../state/reformer-helpers.js';

/**
 * Initialize the Luther's 95 Theses phase.
 * Sets up Wittenberg and creates pendingLuther95 state for interactive play.
 * @param {Object} state
 * @param {Object} helpers
 */
export function initLuther95(state, helpers) {
  // 1. Make Wittenberg Protestant
  if (state.spaces['Wittenberg']) {
    state.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
    recountProtestantSpaces(state);
  }

  // 2. Place Luther reformer marker
  state.lutherPlaced = true;
  placeReformer(state, 'luther', 'Wittenberg');

  // 3. Place Protestant regulars in Wittenberg (from Electorate board, 21.6)
  const wSpace = state.spaces['Wittenberg'];
  if (wSpace && wSpace.units) {
    const protStack = wSpace.units.find(u => u.owner === 'protestant');
    if (!protStack) {
      wSpace.units.push({
        owner: 'protestant', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
    }
  }

  helpers.logEvent(state, 'luther_95_theses', {
    wittenberg: 'protestant', lutherPlaced: true
  });

  // 4. Set up interactive state for Protestant player
  state.pendingLuther95 = {
    attemptsTotal: 5,
    attemptNumber: 0, // next attempt index (0-based)
    results: [],
    validTargets: getValidLuther95Targets(state)
  };

  // Set active power to protestant for this phase
  state.activePower = 'protestant';
}

/**
 * Get valid targets for Luther's 95 Theses reformation.
 * Must be: Catholic, in German zone, and adjacent to a Protestant space
 * (or containing a reformer).
 * @param {Object} state
 * @returns {string[]} Array of valid target space names
 */
export function getValidLuther95Targets(state) {
  const targets = [];

  for (const [name, sp] of Object.entries(state.spaces)) {
    if (sp.religion !== RELIGION.CATHOLIC) continue;
    if (sp.languageZone !== 'german') continue;

    // Must be a valid reformation target (adjacent to Protestant, has reformer,
    // or port-linked to Protestant port)
    if (isValidReformationTarget(state, name)) {
      targets.push(name);
    }
  }

  return targets;
}

/**
 * Validate a Luther's 95 Theses target selection.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { targetSpace }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLuther95Target(state, power, actionData) {
  if (power !== 'protestant') {
    return { valid: false, error: 'Only Protestant can select Luther 95 targets' };
  }

  const pending = state.pendingLuther95;
  if (!pending) {
    return { valid: false, error: 'No pending Luther 95 Theses phase' };
  }
  if (pending.attemptNumber >= pending.attemptsTotal) {
    return { valid: false, error: 'All attempts exhausted' };
  }

  const { targetSpace } = actionData;
  if (!targetSpace) {
    return { valid: false, error: 'Must specify target space' };
  }
  if (!state.spaces[targetSpace]) {
    return { valid: false, error: `Space "${targetSpace}" not found` };
  }

  // Must be in valid targets list
  if (!pending.validTargets.includes(targetSpace)) {
    return { valid: false, error: `"${targetSpace}" is not a valid target` };
  }

  return { valid: true };
}

/**
 * Resolve a single Luther's 95 Theses reformation attempt.
 *
 * Per rulebook 18.3:
 * - Protestant rolls base dice + bonus (attempt-based + Luther's 95 Theses +1)
 * - Compare highest single die (not hit count)
 * - Protestant wins ties in German zone (target language zone)
 * - Auto-success if Protestant max die >= 6 and target in target zone
 *
 * @param {Object} state
 * @param {Object} actionData - { targetSpace }
 * @param {Object} helpers
 * @returns {{ success: boolean, targetSpace: string, protestantDice: number[], papalDice: number[], autoSuccess: boolean }}
 */
export function resolveLuther95Attempt(state, actionData, helpers) {
  const pending = state.pendingLuther95;
  const { targetSpace } = actionData;
  const attemptNum = pending.attemptNumber + 1; // 1-based for bonus

  // Calculate base dice per 18.3
  const diceCalc = calcReformationDice(state, targetSpace);

  // Luther's 95 Theses bonus: +1 per attempt (cumulative)
  // Attempt 1 gets +1, attempt 2 gets +1, etc. (each attempt gets +1 bonus)
  const protestantCount = Math.max(1, diceCalc.protestant + 1);
  const papalCount = Math.max(1, diceCalc.papal);

  const protestantRolls = rollDice(protestantCount);
  const papalRolls = rollDice(papalCount);

  const protestantMax = maxDie(protestantRolls);
  const papalMax = maxDie(papalRolls);

  // Target is always in German zone for Luther's 95 Theses
  const inTargetZone = true;

  // Auto-success: max die >= 6 and in target zone → no papal challenge needed
  let success = false;
  let autoSuccess = false;

  if (protestantMax >= 6 && inTargetZone) {
    success = true;
    autoSuccess = true;
  } else {
    // Compare highest dice; Protestant wins ties in target zone (German)
    success = protestantMax > papalMax ||
      (protestantMax === papalMax && inTargetZone);
  }

  // Apply result
  if (success) {
    const sp = state.spaces[targetSpace];
    sp.religion = RELIGION.PROTESTANT;
    recountProtestantSpaces(state);

    // Check if this is an electorate space — place Protestant regulars (21.6)
    if (sp.isElectorate && sp.units) {
      const existingProt = sp.units.find(u => u.owner === 'protestant');
      if (!existingProt) {
        sp.units.push({
          owner: 'protestant', regulars: 2, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        });
      }
    }
  }

  const result = {
    success,
    autoSuccess,
    targetSpace,
    attemptNumber: attemptNum,
    protestantDice: protestantRolls,
    papalDice: autoSuccess ? [] : papalRolls,
    protestantMax,
    papalMax: autoSuccess ? 0 : papalMax
  };

  pending.results.push(result);
  pending.attemptNumber++;

  helpers.logEvent(state, success ? 'luther_reform_success' : 'luther_reform_failure', {
    space: targetSpace,
    attempt: attemptNum,
    protestantDice: protestantRolls,
    papalDice: autoSuccess ? [] : papalRolls,
    protestantMax,
    papalMax: autoSuccess ? 0 : papalMax,
    autoSuccess
  });

  // Recalculate valid targets for next attempt
  if (pending.attemptNumber < pending.attemptsTotal) {
    pending.validTargets = getValidLuther95Targets(state);

    // If no valid targets remain, end early
    if (pending.validTargets.length === 0) {
      helpers.logEvent(state, 'luther_95_no_targets', {
        attemptsUsed: pending.attemptNumber
      });
    }
  }

  // Check if phase is complete
  if (isLuther95Complete(state)) {
    helpers.logEvent(state, 'luther_95_complete', {
      attempts: pending.results.length,
      successes: pending.results.filter(r => r.success).length
    });
  }

  return result;
}

/**
 * Check if Luther's 95 Theses phase is complete.
 * @param {Object} state
 * @returns {boolean}
 */
export function isLuther95Complete(state) {
  const pending = state.pendingLuther95;
  if (!pending) return true;
  return pending.attemptNumber >= pending.attemptsTotal ||
    pending.validTargets.length === 0;
}

/**
 * Clean up Luther's 95 Theses pending state.
 * @param {Object} state
 */
export function cleanupLuther95(state) {
  state.pendingLuther95 = null;
}
