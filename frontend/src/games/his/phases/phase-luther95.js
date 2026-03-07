/**
 * Here I Stand — Luther's 95 Theses Phase
 *
 * Turn 1 only. Before Card Draw.
 * - Wittenberg becomes Protestant
 * - Luther reformer placed in Wittenberg
 * - 5 reformation attempts on Catholic spaces adjacent to Wittenberg
 * - Protestant gets +1 bonus die per attempt
 */

import { RELIGION } from '../constants.js';
import { rollDice, maxDie } from '../actions/religious-actions.js';
import {
  getAllAdjacentSpaces, calcReformationDice, recountProtestantSpaces
} from '../state/state-helpers.js';

/**
 * Execute the Luther's 95 Theses phase.
 * Fully automatic — no player input needed.
 * @param {Object} state
 * @param {Object} helpers
 */
export function executeLuther95(state, helpers) {
  // 1. Make Wittenberg Protestant
  if (state.spaces['Wittenberg']) {
    state.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
    recountProtestantSpaces(state);
  }

  // 2. Place Luther reformer marker
  state.lutherPlaced = true;

  helpers.logEvent(state, 'luther_95_theses', {
    wittenberg: 'protestant', lutherPlaced: true
  });

  // 3. Find adjacent Catholic spaces for reformation attempts
  const adjacent = getAllAdjacentSpaces('Wittenberg');
  const catholicTargets = adjacent.filter(name => {
    const sp = state.spaces[name];
    return sp && sp.religion === RELIGION.CATHOLIC;
  });

  // 4. Perform 5 reformation attempts (or fewer if not enough targets)
  const maxAttempts = 5;
  const results = [];

  for (let i = 0; i < maxAttempts && catholicTargets.length > 0; i++) {
    // Pick first available Catholic target (in order)
    // After a successful conversion, the target is removed from pool
    const targetIdx = i % catholicTargets.length;
    const targetSpace = catholicTargets[targetIdx];

    // Check if still Catholic (may have been converted in a prior attempt)
    if (state.spaces[targetSpace].religion !== RELIGION.CATHOLIC) {
      // Remove from pool and retry
      catholicTargets.splice(targetIdx, 1);
      if (catholicTargets.length === 0) break;
      i--; // Retry this attempt with next target
      continue;
    }

    const result = resolveLutherReformation(state, targetSpace, helpers);
    results.push(result);

    if (result.success) {
      // Remove converted space from target pool
      const idx = catholicTargets.indexOf(targetSpace);
      if (idx !== -1) catholicTargets.splice(idx, 1);
    }
  }

  helpers.logEvent(state, 'luther_95_complete', {
    attempts: results.length,
    successes: results.filter(r => r.success).length
  });
}

/**
 * Resolve a single Luther's 95 Theses reformation attempt.
 * Special rule: Protestant gets +1 bonus die.
 * @param {Object} state
 * @param {string} targetSpace
 * @param {Object} helpers
 * @returns {{ success: boolean, space: string, protestantDice: number[], papalDice: number[] }}
 */
function resolveLutherReformation(state, targetSpace, helpers) {
  const diceCalc = calcReformationDice(state, targetSpace);

  // +1 bonus die for Luther's 95 Theses
  const protestantCount = Math.max(1, diceCalc.protestant + 1);
  const papalCount = Math.max(1, diceCalc.papal);

  const protestantRolls = rollDice(protestantCount);
  const papalRolls = rollDice(papalCount);

  const protestantMax = maxDie(protestantRolls);
  const papalMax = maxDie(papalRolls);

  // Protestant wins ties in German zone (Wittenberg adjacent = German)
  const sp = state.spaces[targetSpace];
  const inGermanZone = sp.languageZone === 'german';
  const success = protestantMax > papalMax ||
    (protestantMax === papalMax && inGermanZone);

  if (success) {
    sp.religion = RELIGION.PROTESTANT;
    recountProtestantSpaces(state);
  }

  helpers.logEvent(state, success ? 'luther_reform_success' : 'luther_reform_failure', {
    space: targetSpace, protestantDice: protestantRolls, papalDice: papalRolls
  });

  return { success, space: targetSpace, protestantDice: protestantRolls, papalDice: papalRolls };
}
