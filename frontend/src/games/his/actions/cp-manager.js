/**
 * Here I Stand — CP Spending Manager
 *
 * Manages the lifecycle of CP spending within an impulse:
 * card played → CP allocated → sub-actions spent → impulse ends.
 */

import { ACTION_COSTS } from '../constants.js';
import { ACTION_COST_KEY } from './action-types.js';

/**
 * Enter CP spending mode after playing a card.
 * @param {Object} state - Game state (mutated)
 * @param {number} cardNumber - The card that was played
 * @param {number} cp - CP value of the card
 */
export function startCpSpending(state, cardNumber, cp) {
  state.cpRemaining = cp;
  state.activeCardNumber = cardNumber;
  state.impulseActions = [];
  state.pendingReformation = null;
  state.pendingDebate = null;
}

/**
 * Spend CP for an action.
 * @param {Object} state
 * @param {number} amount
 */
export function spendCp(state, amount) {
  state.cpRemaining -= amount;
}

/**
 * End CP spending and clean up impulse state.
 * @param {Object} state
 */
export function endCpSpending(state) {
  state.cpRemaining = 0;
  state.activeCardNumber = null;
  state.impulseActions = [];
  state.pendingReformation = null;
  state.pendingDebate = null;
}

/**
 * Check if in CP spending mode.
 * @param {Object} state
 * @returns {boolean}
 */
export function isInCpMode(state) {
  return state.cpRemaining > 0 || state.activeCardNumber !== null;
}

/**
 * Check if there is a pending sub-interaction that must resolve first.
 * @param {Object} state
 * @returns {boolean}
 */
export function hasPendingInteraction(state) {
  return state.pendingReformation !== null || state.pendingDebate !== null;
}

/**
 * Check if a power can afford a specific action.
 * @param {Object} state
 * @param {string} power
 * @param {string} actionType - ACTION_TYPES key
 * @returns {{ affordable: boolean, cost: number, reason?: string }}
 */
export function canAfford(state, power, actionType) {
  const costKey = ACTION_COST_KEY[actionType];
  if (!costKey) {
    return { affordable: false, cost: 0, reason: 'Unknown action type' };
  }

  const powerCosts = ACTION_COSTS[power];
  if (!powerCosts) {
    return { affordable: false, cost: 0, reason: 'Unknown power' };
  }

  const cost = powerCosts[costKey];
  if (cost === null || cost === undefined) {
    return { affordable: false, cost: 0, reason: 'Action not available for this power' };
  }

  if (state.cpRemaining < cost) {
    return {
      affordable: false,
      cost,
      reason: `Not enough CP (need ${cost}, have ${state.cpRemaining})`
    };
  }

  return { affordable: true, cost };
}

/**
 * Get the CP cost for a specific action by a specific power.
 * Returns null if the action is unavailable.
 * @param {string} power
 * @param {string} actionType
 * @returns {number|null}
 */
export function getActionCost(power, actionType) {
  const costKey = ACTION_COST_KEY[actionType];
  if (!costKey) return null;
  const cost = ACTION_COSTS[power]?.[costKey];
  return cost === undefined ? null : cost;
}

/**
 * Get list of CP actions a power can currently afford.
 * @param {Object} state
 * @param {string} power
 * @returns {Array<{ actionType: string, cost: number }>}
 */
export function getAvailableCpActions(state, power) {
  const available = [];
  for (const [actionType, costKey] of Object.entries(ACTION_COST_KEY)) {
    const cost = ACTION_COSTS[power]?.[costKey];
    if (cost !== null && cost !== undefined && state.cpRemaining >= cost) {
      available.push({ actionType, cost });
    }
  }
  return available;
}
