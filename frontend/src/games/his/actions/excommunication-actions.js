/**
 * Here I Stand — Excommunication System
 *
 * Two tracks:
 *   excommunicatedReformers[] — reformer IDs removed this turn (return next Winter)
 *   excommunicatedRulers{}    — { [power]: true } persists until removed
 *
 * Grounds for ruler excommunication (rule 21.5):
 *   - Power is at war with Papacy
 *   - Power is allied with Ottoman
 *   - Power controls a Papal home space
 */

import { EXCOMMUNICATION_SLOTS } from '../constants.js';
import { areAtWar, areAllied } from '../state/war-helpers.js';

// ── Papal Home Spaces ──────────────────────────────────────────────

const PAPAL_HOME_SPACES = [
  'Rome', 'Ancona', 'Bologna', 'Ravenna', 'Trent'
];

// ── Eligible Ruler Targets ─────────────────────────────────────────

const EXCOMMUNICABLE_RULERS = ['england', 'france', 'hapsburg'];

// ── Grounds Check ──────────────────────────────────────────────────

/**
 * Check if grounds exist to excommunicate a ruler.
 * @param {Object} state
 * @param {string} targetPower
 * @returns {{ hasGrounds: boolean, reasons: string[] }}
 */
export function checkExcommunicationGrounds(state, targetPower) {
  const reasons = [];

  // At war with Papacy
  if (areAtWar(state, targetPower, 'papacy')) {
    reasons.push('at_war_with_papacy');
  }

  // Allied with Ottoman
  if (areAllied(state, targetPower, 'ottoman')) {
    reasons.push('allied_with_ottoman');
  }

  // Controls a Papal home space
  for (const spaceName of PAPAL_HOME_SPACES) {
    const sp = state.spaces[spaceName];
    if (sp && sp.controller === targetPower) {
      reasons.push('controls_papal_space');
      break;
    }
  }

  return { hasGrounds: reasons.length > 0, reasons };
}

// ── Excommunicate Reformer ─────────────────────────────────────────

/**
 * Validate excommunicating a Protestant reformer.
 * @param {Object} state
 * @param {string} power - Must be 'papacy'
 * @param {Object} actionData - { reformerId }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateExcommunicateReformer(state, power, actionData) {
  if (power !== 'papacy') {
    return { valid: false, error: 'Only Papacy can excommunicate' };
  }
  const { reformerId } = actionData;
  if (!reformerId) {
    return { valid: false, error: 'Must specify reformer' };
  }
  // Check reformer is valid target
  const validReformers = EXCOMMUNICATION_SLOTS.filter(
    id => !['henry_viii', 'francis_i', 'charles_v'].includes(id)
  );
  if (!validReformers.includes(reformerId)) {
    return { valid: false, error: 'Invalid reformer target' };
  }
  // Already excommunicated
  if (state.excommunicatedReformers.includes(reformerId)) {
    return { valid: false, error: 'Already excommunicated' };
  }
  return { valid: true };
}

/**
 * Execute excommunication of a Protestant reformer.
 * Reformer is removed from map and added to excommunicatedReformers.
 * Returns next Winter phase (step 9).
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { reformerId }
 * @param {Object} helpers
 */
export function excommunicateReformer(state, power, actionData, helpers) {
  const { reformerId } = actionData;

  state.excommunicatedReformers.push(reformerId);

  // Remove reformer from map
  for (const sp of Object.values(state.spaces)) {
    if (sp.reformer === reformerId) {
      sp.reformer = null;
      break;
    }
  }

  helpers.logEvent(state, 'excommunicate_reformer', {
    power, reformerId
  });
}

// ── Excommunicate Ruler ────────────────────────────────────────────

/**
 * Validate excommunicating a ruler.
 * @param {Object} state
 * @param {string} power - Must be 'papacy'
 * @param {Object} actionData - { targetPower }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateExcommunicateRuler(state, power, actionData) {
  if (power !== 'papacy') {
    return { valid: false, error: 'Only Papacy can excommunicate' };
  }
  const { targetPower } = actionData;
  if (!targetPower) {
    return { valid: false, error: 'Must specify target power' };
  }
  if (!EXCOMMUNICABLE_RULERS.includes(targetPower)) {
    return { valid: false, error: 'Cannot excommunicate this power' };
  }
  if (state.excommunicatedRulers[targetPower]) {
    return { valid: false, error: 'Ruler already excommunicated' };
  }
  // Check grounds
  const { hasGrounds } = checkExcommunicationGrounds(state, targetPower);
  if (!hasGrounds) {
    return { valid: false, error: 'No grounds for excommunication' };
  }
  return { valid: true };
}

/**
 * Execute excommunication of a ruler.
 * Places unrest markers on up to 2 target power's unoccupied Catholic home spaces.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { targetPower, unrestSpaces?: string[] }
 * @param {Object} helpers
 */
export function excommunicateRuler(state, power, actionData, helpers) {
  const { targetPower, unrestSpaces = [] } = actionData;

  state.excommunicatedRulers[targetPower] = true;

  // Place up to 2 unrest markers on qualifying spaces
  let placed = 0;
  for (const spaceName of unrestSpaces) {
    if (placed >= 2) break;
    const sp = state.spaces[spaceName];
    if (!sp) continue;
    // Must be target power's controlled space, Catholic influence, no unrest
    if (sp.controller === targetPower && sp.religion === 'catholic' && !sp.unrest) {
      const hasEnemyUnits = sp.units.some(u => u.owner !== targetPower &&
        (u.regulars + u.mercenaries + u.cavalry) > 0);
      if (!hasEnemyUnits) {
        sp.unrest = true;
        placed++;
      }
    }
  }

  helpers.logEvent(state, 'excommunicate_ruler', {
    power, targetPower, unrestPlaced: placed
  });
}

// ── Remove Excommunication ─────────────────────────────────────────

/**
 * Validate removing excommunication from a ruler (diplomacy phase).
 * @param {Object} state
 * @param {string} power - Must be 'papacy'
 * @param {Object} actionData - { targetPower }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRemoveExcommunication(state, power, actionData) {
  if (power !== 'papacy') {
    return { valid: false, error: 'Only Papacy can remove excommunication' };
  }
  const { targetPower } = actionData;
  if (!targetPower) {
    return { valid: false, error: 'Must specify target power' };
  }
  if (!state.excommunicatedRulers[targetPower]) {
    return { valid: false, error: 'Ruler is not excommunicated' };
  }
  return { valid: true };
}

/**
 * Remove excommunication from a ruler.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { targetPower }
 * @param {Object} helpers
 */
export function removeExcommunication(state, power, actionData, helpers) {
  const { targetPower } = actionData;
  delete state.excommunicatedRulers[targetPower];

  helpers.logEvent(state, 'remove_excommunication', {
    power, targetPower
  });
}

// ── Query Helpers ──────────────────────────────────────────────────

/**
 * Check if a power's ruler is excommunicated.
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function isRulerExcommunicated(state, power) {
  return !!state.excommunicatedRulers[power];
}

/**
 * Check if a reformer is excommunicated.
 * @param {Object} state
 * @param {string} reformerId
 * @returns {boolean}
 */
export function isReformerExcommunicated(state, reformerId) {
  return state.excommunicatedReformers.includes(reformerId);
}
