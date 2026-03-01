/**
 * Here I Stand — Shared Test Helpers
 */

import { buildInitialState } from './state/state-init.js';
import { executeCardDraw } from './phases/phase-card-draw.js';

/** Standard 6-player list */
export const TEST_PLAYERS = [
  { id: 'p1', nickname: 'Alice', isHost: true },
  { id: 'p2', nickname: 'Bob' },
  { id: 'p3', nickname: 'Charlie' },
  { id: 'p4', nickname: 'Diana' },
  { id: 'p5', nickname: 'Eve' },
  { id: 'p6', nickname: 'Frank' }
];

/**
 * Create a fresh initial state (before card draw).
 * @param {Object} [overrides] - Properties to override on the state
 * @returns {Object}
 */
export function createTestState(overrides = {}) {
  const state = buildInitialState(TEST_PLAYERS, {});
  return { ...state, ...overrides };
}

/**
 * Create a state that has completed the first card draw.
 * @returns {Object}
 */
export function createStateAfterDraw() {
  const state = buildInitialState(TEST_PLAYERS, {});
  const helpers = createMockHelpers();
  executeCardDraw(state, helpers);
  return state;
}

/**
 * Create a mock helpers object for phase functions.
 * @returns {Object}
 */
export function createMockHelpers() {
  return {
    logEvent: (state, type, data) => {
      state.eventLog.push({ type, data });
    }
  };
}
