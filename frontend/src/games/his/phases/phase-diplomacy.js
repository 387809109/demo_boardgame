/**
 * Here I Stand — Diplomacy Phase
 *
 * Orchestrates the 5 diplomacy segments in order:
 * 1. Negotiation — mutual agreements (end war, form alliance, transfers, gifts)
 * 2. Sue for Peace — forced peace when qualifying conditions met
 * 3. Ransom — pay to recover captured leaders
 * 4. Excommunication — Papacy removes excommunication
 * 5. Declarations of War — spend cards to declare war
 *
 * Each segment processes in impulse order.
 */

import { DIPLOMACY_SEGMENTS, IMPULSE_ORDER } from '../constants.js';

/**
 * Initialize the diplomacy phase.
 * Sets up segment tracking and per-segment state.
 * @param {Object} state
 * @param {Object} helpers
 */
export function initDiplomacyPhase(state, helpers) {
  state.diplomacySegment = DIPLOMACY_SEGMENTS[0];
  state.diplomacyActed = {};
  state.peaceMadeThisTurn = [];
  state.alliancesFormedThisTurn = [];

  helpers.logEvent(state, 'diplomacy_phase_start', {
    segment: state.diplomacySegment
  });
}

/**
 * Check if a power can act in the current diplomacy segment.
 * @param {Object} state
 * @param {string} power
 * @returns {boolean}
 */
export function canActInSegment(state, power) {
  if (!state.diplomacySegment) return false;
  if (state.diplomacyActed[power]) return false;

  // Excommunication segment: only papacy can act
  if (state.diplomacySegment === 'excommunication' && power !== 'papacy') {
    return false;
  }

  return true;
}

/**
 * Mark a power as having acted in the current segment.
 * @param {Object} state
 * @param {string} power
 */
export function markActed(state, power) {
  state.diplomacyActed[power] = true;
}

/**
 * Check if all powers have acted in the current segment.
 * @param {Object} state
 * @returns {boolean}
 */
export function allActedInSegment(state) {
  if (state.diplomacySegment === 'excommunication') {
    return !!state.diplomacyActed['papacy'];
  }

  for (const power of IMPULSE_ORDER) {
    if (!state.diplomacyActed[power]) return false;
  }
  return true;
}

/**
 * Advance to the next diplomacy segment.
 * Returns true if there are more segments, false if diplomacy is complete.
 * @param {Object} state
 * @param {Object} helpers
 * @returns {boolean} Whether diplomacy continues
 */
export function advanceDiplomacySegment(state, helpers) {
  const idx = DIPLOMACY_SEGMENTS.indexOf(state.diplomacySegment);

  if (idx < DIPLOMACY_SEGMENTS.length - 1) {
    state.diplomacySegment = DIPLOMACY_SEGMENTS[idx + 1];
    state.diplomacyActed = {};

    helpers.logEvent(state, 'diplomacy_segment_advance', {
      segment: state.diplomacySegment
    });
    return true;
  }

  // Diplomacy complete
  state.diplomacySegment = null;
  state.diplomacyActed = {};

  helpers.logEvent(state, 'diplomacy_phase_end', {});
  return false;
}

/**
 * Get the current diplomacy segment.
 * @param {Object} state
 * @returns {string|null}
 */
export function getCurrentSegment(state) {
  return state.diplomacySegment || null;
}

/**
 * Check if the diplomacy phase is complete.
 * @param {Object} state
 * @returns {boolean}
 */
export function isDiplomacyComplete(state) {
  return state.diplomacySegment === null;
}
