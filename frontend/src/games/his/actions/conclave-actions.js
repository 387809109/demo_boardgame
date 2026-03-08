/**
 * Here I Stand — Papal Conclave
 *
 * When a pope dies, a conclave determines which power gains
 * influence over the new pope (bonus VP / card draw).
 * The successor is deterministic (RULERS.papacy order).
 */

import { RULERS, CAPITALS } from '../constants.js';
import { getAllAdjacentSpaces } from '../state/state-helpers.js';
import { rollDice } from './religious-actions.js';

/**
 * Trigger a papal conclave after a pope's death.
 * @param {Object} state
 * @param {Object} helpers
 * @returns {Object} Conclave result
 */
export function triggerConclave(state, helpers) {
  const currentPope = state.rulers.papacy;
  const succession = RULERS.papacy;
  const currentIdx = succession.findIndex(r => r.id === currentPope);

  // Find next pope in succession
  const nextIdx = currentIdx + 1;
  if (nextIdx >= succession.length) {
    helpers.logEvent(state, 'conclave_no_successor', { currentPope });
    return { status: 'no_successor' };
  }

  const newPope = succession[nextIdx];

  // Each major power rolls 1 die
  const voters = ['ottoman', 'hapsburg', 'england', 'france', 'papacy'];
  const votes = {};

  for (const power of voters) {
    const rolls = rollDice(1);
    let bonus = 0;

    // Hapsburg and France get +1 if they control a space adjacent to Rome
    if (power === 'hapsburg' || power === 'france') {
      const romeAdj = getAllAdjacentSpaces(state, 'Rome');
      for (const adj of romeAdj) {
        const sp = state.spaces[adj];
        if (sp && sp.controller === power) {
          bonus = 1;
          break;
        }
      }
    }

    // Papacy always gets +1
    if (power === 'papacy') bonus = 1;

    votes[power] = {
      roll: rolls[0],
      bonus,
      total: rolls[0] + bonus
    };
  }

  // Find highest roller
  let winnerPower = null;
  let highestTotal = -1;
  for (const [power, vote] of Object.entries(votes)) {
    if (vote.total > highestTotal) {
      highestTotal = vote.total;
      winnerPower = power;
    }
  }

  // Winner gains 1 VP and draws 1 card
  const reward = { vp: 1, cardDraw: 1 };
  if (state.vp[winnerPower] !== undefined) {
    state.vp[winnerPower] += reward.vp;
  }

  // Install new pope
  state.rulers.papacy = newPope.id;

  const result = {
    status: 'conclave_complete',
    previousPope: currentPope,
    newPope: newPope.id,
    votes,
    winner: winnerPower,
    reward
  };

  helpers.logEvent(state, 'conclave', result);
  return result;
}

/**
 * Check if a conclave should be triggered (pope has died/been replaced).
 * @param {Object} state
 * @param {string} deadPopeId
 * @returns {boolean}
 */
export function shouldTriggerConclave(state, deadPopeId) {
  const succession = RULERS.papacy;
  const idx = succession.findIndex(r => r.id === deadPopeId);
  // Conclave happens if there's a successor and the current pope matches
  return idx >= 0 && idx < succession.length - 1 &&
    state.rulers.papacy === deadPopeId;
}
