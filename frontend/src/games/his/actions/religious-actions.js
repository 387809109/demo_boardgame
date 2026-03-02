/**
 * Here I Stand — Religious CP Actions
 *
 * Reformation, Counter-Reformation, Publish Treatise, Burn Books,
 * Translate Scripture, Build St. Peter's, Found Jesuit University.
 */

import {
  ACTION_COSTS, RELIGION, ST_PETERS, TRANSLATION
} from '../constants.js';
import { spendCp } from './cp-manager.js';
import {
  isValidReformationTarget, isValidCounterReformTarget,
  calcReformationDice, calcCounterReformationDice,
  recountProtestantSpaces, isHomeSpace, hasEnemyUnits
} from '../state/state-helpers.js';

// ── Dice Utilities ────────────────────────────────────────────────

/**
 * Roll n six-sided dice, return array of results.
 * @param {number} n
 * @returns {number[]}
 */
export function rollDice(n) {
  const results = [];
  for (let i = 0; i < Math.max(1, n); i++) {
    results.push(Math.floor(Math.random() * 6) + 1);
  }
  return results;
}

/**
 * Get the highest value in a dice array.
 * @param {number[]} dice
 * @returns {number}
 */
function maxDie(dice) {
  return Math.max(...dice);
}

// ── Publish Treatise ──────────────────────────────────────────────

/**
 * Validate Publish Treatise.
 */
export function validatePublishTreatise(state, power, actionData) {
  const { zone } = actionData;
  if (!zone) return { valid: false, error: 'Must specify language zone' };

  const cost = ACTION_COSTS[power]?.publish_treatise;
  if (cost === null || cost === undefined) {
    return { valid: false, error: 'Cannot publish treatise' };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // England can only target English zone
  if (power === 'england' && zone !== 'english') {
    return { valid: false, error: 'England can only publish in English zone' };
  }

  return { valid: true };
}

/**
 * Execute Publish Treatise — sets up pending reformation attempts.
 */
export function publishTreatise(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].publish_treatise;
  spendCp(state, cost);

  state.pendingReformation = {
    type: 'reformation',
    zone: actionData.zone,
    attemptsLeft: 2,
    initiator: power
  };

  state.impulseActions.push({ type: 'publish_treatise', zone: actionData.zone });
  helpers.logEvent(state, 'publish_treatise', {
    power, zone: actionData.zone, attempts: 2
  });
}

// ── Burn Books ────────────────────────────────────────────────────

/**
 * Validate Burn Books.
 */
export function validateBurnBooks(state, power, actionData) {
  const { zone } = actionData;
  if (!zone) return { valid: false, error: 'Must specify language zone' };
  if (power !== 'papacy') return { valid: false, error: 'Only Papacy can burn books' };

  const cost = ACTION_COSTS[power]?.burn_books;
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  return { valid: true };
}

/**
 * Execute Burn Books — sets up pending counter-reformation attempts.
 */
export function burnBooks(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].burn_books;
  spendCp(state, cost);

  state.pendingReformation = {
    type: 'counter_reformation',
    zone: actionData.zone,
    attemptsLeft: 2,
    initiator: power
  };

  state.impulseActions.push({ type: 'burn_books', zone: actionData.zone });
  helpers.logEvent(state, 'burn_books', {
    power, zone: actionData.zone, attempts: 2
  });
}

// ── Resolve Reformation/Counter-Reformation Attempt ───────────────

/**
 * Validate a single reformation/counter-reformation attempt.
 */
export function validateReformationAttempt(state, power, actionData) {
  const pending = state.pendingReformation;
  if (!pending) return { valid: false, error: 'No pending reformation' };
  if (pending.attemptsLeft <= 0) {
    return { valid: false, error: 'No attempts remaining' };
  }

  const { targetSpace } = actionData;
  if (!targetSpace) return { valid: false, error: 'Must specify target space' };
  if (!state.spaces[targetSpace]) {
    return { valid: false, error: `Space "${targetSpace}" not found` };
  }

  // Zone check
  const sp = state.spaces[targetSpace];
  if (pending.zone && sp.languageZone !== pending.zone) {
    return { valid: false, error: `Target must be in ${pending.zone} zone` };
  }

  // Target validity
  if (pending.type === 'reformation') {
    if (!isValidReformationTarget(state, targetSpace)) {
      return { valid: false, error: 'Invalid reformation target' };
    }
  } else {
    if (!isValidCounterReformTarget(state, targetSpace)) {
      return { valid: false, error: 'Invalid counter-reformation target' };
    }
  }

  return { valid: true };
}

/**
 * Execute a single reformation attempt.
 * @returns {{ success: boolean, protestantDice: number[], papalDice: number[] }}
 */
export function resolveReformationAttempt(state, power, actionData, helpers) {
  const pending = state.pendingReformation;
  const { targetSpace } = actionData;

  const isReformation = pending.type === 'reformation';
  const diceCalc = isReformation
    ? calcReformationDice(state, targetSpace)
    : calcCounterReformationDice(state, targetSpace);

  const protestantRolls = rollDice(
    isReformation ? diceCalc.protestant : diceCalc.protestant
  );
  const papalRolls = rollDice(
    isReformation ? diceCalc.papal : diceCalc.papal
  );

  const protestantMax = maxDie(protestantRolls);
  const papalMax = maxDie(papalRolls);

  // Determine winner
  let success;
  if (isReformation) {
    // Protestant wins ties if in target zone
    const sp = state.spaces[targetSpace];
    const inZone = sp.languageZone === pending.zone;
    success = protestantMax > papalMax || (protestantMax === papalMax && inZone);
  } else {
    // Counter-reformation: Papacy wins if higher
    // Tie: Papacy wins if Paul III or Julius III is ruler and in zone
    const papacyRuler = state.rulers.papacy;
    const tieWin = (papacyRuler === 'paul_iii' || papacyRuler === 'julius_iii') &&
      state.spaces[targetSpace].languageZone === pending.zone;
    success = papalMax > protestantMax || (papalMax === protestantMax && tieWin);
  }

  // Apply result
  if (success) {
    const sp = state.spaces[targetSpace];
    const wasProt = sp.religion === RELIGION.PROTESTANT;
    sp.religion = isReformation ? RELIGION.PROTESTANT : RELIGION.CATHOLIC;
    recountProtestantSpaces(state);

    helpers.logEvent(state, isReformation ? 'reformation_success' : 'counter_reformation_success', {
      space: targetSpace, protestantDice: protestantRolls, papalDice: papalRolls
    });
  } else {
    helpers.logEvent(state, isReformation ? 'reformation_failure' : 'counter_reformation_failure', {
      space: targetSpace, protestantDice: protestantRolls, papalDice: papalRolls
    });
  }

  pending.attemptsLeft--;

  // Clear pending if no attempts left
  if (pending.attemptsLeft <= 0) {
    state.pendingReformation = null;
  }

  return { success, protestantDice: protestantRolls, papalDice: papalRolls };
}

// ── Translate Scripture ───────────────────────────────────────────

/**
 * Validate Translate Scripture.
 */
export function validateTranslateScripture(state, power, actionData) {
  if (power !== 'protestant') {
    return { valid: false, error: 'Only Protestant can translate' };
  }
  const { zone } = actionData;
  if (!zone) return { valid: false, error: 'Must specify language zone' };
  if (!['german', 'english', 'french'].includes(zone)) {
    return { valid: false, error: 'Invalid language zone' };
  }

  const cost = ACTION_COSTS[power]?.translate_scripture;
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Check if track is already complete (Full Bible done)
  const progress = state.translationTracks[zone] || 0;
  if (progress >= TRANSLATION.fullBibleCp) {
    return { valid: false, error: 'Full Bible already completed in this zone' };
  }

  return { valid: true };
}

/**
 * Execute Translate Scripture (1 CP per step).
 */
export function translateScripture(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].translate_scripture;
  spendCp(state, cost);

  const { zone } = actionData;
  const before = state.translationTracks[zone] || 0;
  state.translationTracks[zone] = before + 1;
  const after = state.translationTracks[zone];

  state.impulseActions.push({ type: 'translate', zone });
  helpers.logEvent(state, 'translate_scripture', { power, zone, progress: after });

  // Check New Testament completion
  if (before < TRANSLATION.newTestamentCp && after >= TRANSLATION.newTestamentCp) {
    // Trigger 6 reformation attempts
    state.pendingReformation = {
      type: 'reformation',
      zone,
      attemptsLeft: TRANSLATION.newTestamentRolls,
      initiator: power,
      source: 'new_testament'
    };
    helpers.logEvent(state, 'new_testament_complete', { zone });
  }

  // Check Full Bible completion
  if (before < TRANSLATION.fullBibleCp && after >= TRANSLATION.fullBibleCp) {
    // Trigger 6 reformation attempts with +1 modifier
    state.pendingReformation = {
      type: 'reformation',
      zone,
      attemptsLeft: TRANSLATION.fullBibleRolls,
      initiator: power,
      source: 'full_bible',
      diceModifier: 1
    };
    // Award 1 VP
    state.bonusVp.protestant = (state.bonusVp.protestant || 0) + 1;
    helpers.logEvent(state, 'full_bible_complete', { zone });
  }
}

// ── Build St. Peter's ─────────────────────────────────────────────

/**
 * Validate Build St. Peter's.
 */
export function validateBuildStPeters(state, power) {
  if (power !== 'papacy') return { valid: false, error: 'Only Papacy can build St. Peters' };
  const cost = ACTION_COSTS[power]?.build_st_peters;
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }
  if (state.stPetersVp >= ST_PETERS.maxVp) {
    return { valid: false, error: 'St. Peters already complete' };
  }
  return { valid: true };
}

/**
 * Execute Build St. Peter's (1 CP).
 */
export function buildStPeters(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].build_st_peters;
  spendCp(state, cost);

  state.stPetersProgress++;

  // Award VP at each cpPerVp milestone
  const newVp = Math.min(
    Math.floor(state.stPetersProgress / ST_PETERS.cpPerVp),
    ST_PETERS.maxVp
  );
  if (newVp > state.stPetersVp) {
    state.stPetersVp = newVp;
    helpers.logEvent(state, 'st_peters_vp', { vp: newVp });
  }

  state.impulseActions.push({ type: 'build_st_peters' });
  helpers.logEvent(state, 'build_st_peters', {
    power, progress: state.stPetersProgress, vp: state.stPetersVp
  });
}

// ── Found Jesuit University ───────────────────────────────────────

/**
 * Validate Found Jesuit University.
 */
export function validateFoundJesuit(state, power, actionData) {
  if (power !== 'papacy') return { valid: false, error: 'Only Papacy can found Jesuits' };
  if (!state.jesuitUnlocked) {
    return { valid: false, error: 'Jesuits not yet unlocked (requires Society of Jesus event)' };
  }

  const { space } = actionData;
  if (!space) return { valid: false, error: 'Must specify space' };
  if (!state.spaces[space]) return { valid: false, error: `Space "${space}" not found` };

  // Already has Jesuit
  if (state.jesuitUniversities.includes(space)) {
    return { valid: false, error: 'Space already has a Jesuit university' };
  }

  // Must be a Catholic space
  if (state.spaces[space].religion !== RELIGION.CATHOLIC) {
    return { valid: false, error: 'Must be a Catholic space' };
  }

  const cost = ACTION_COSTS[power]?.found_jesuit;
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  return { valid: true };
}

/**
 * Execute Found Jesuit University.
 */
export function foundJesuit(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].found_jesuit;
  spendCp(state, cost);

  state.jesuitUniversities.push(actionData.space);
  state.impulseActions.push({ type: 'found_jesuit', space: actionData.space });
  helpers.logEvent(state, 'found_jesuit', { power, space: actionData.space });
}
