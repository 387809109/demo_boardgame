/**
 * Here I Stand — Diplomacy Actions
 *
 * Declaration of War, Suing for Peace, Negotiations, Ransom.
 * Section 8-9 of the rulebook.
 */

import {
  DOW_COSTS, DOW_MINOR_COST, INTERVENTION_COSTS,
  NEGOTIATION_LIMITS, MAJOR_POWERS
} from '../constants.js';
import {
  areAtWar, addWar, removeWar, areAllied, addAlliance,
  removeAlliance, isMinorPower, getMinorAlly, canAttack
} from '../state/war-helpers.js';
import { getUnitsInSpace, countLandUnits } from '../state/state-helpers.js';

// ── Declaration of War ─────────────────────────────────────────

/**
 * Validate a Declaration of War.
 * @param {Object} state
 * @param {string} power - Declaring power
 * @param {Object} actionData - { target, cardNumber? }
 * @returns {{ valid: boolean, cost?: number, error?: string }}
 */
export function validateDOW(state, power, actionData) {
  const { target } = actionData;
  if (!target) return { valid: false, error: 'Missing target' };

  // Already at war
  if (areAtWar(state, power, target)) {
    return { valid: false, error: `Already at war with ${target}` };
  }

  // Cannot DOW an ally
  if (areAllied(state, power, target)) {
    return { valid: false, error: `Cannot declare war on an ally` };
  }

  // Protestant restrictions
  if (power === 'protestant' || target === 'protestant') {
    if (!state.schmalkaldicLeagueFormed) {
      return { valid: false, error: 'Protestant cannot participate in wars before Schmalkaldic League' };
    }
  }

  // Cannot DOW on power you made peace with this turn
  if (state.peaceMadeThisTurn && state.peaceMadeThisTurn.includes(target)) {
    return { valid: false, error: 'Cannot declare war on a power you made peace with this turn' };
  }

  // Calculate cost
  let cost;
  if (isMinorPower(target)) {
    cost = DOW_MINOR_COST;
    // Check if minor is allied to declaring power
    const minorAlly = getMinorAlly(state, target);
    if (minorAlly === power) {
      return { valid: false, error: `${target} is your minor ally` };
    }
  } else if (isMinorPower(power)) {
    return { valid: false, error: 'Minor powers cannot declare war' };
  } else {
    cost = DOW_COSTS[power]?.[target];
    if (cost === null || cost === undefined) {
      return { valid: false, error: `Cannot declare war on ${target}` };
    }
  }

  return { valid: true, cost };
}

/**
 * Execute a Declaration of War.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { target }
 * @param {Object} helpers
 * @returns {{ war: { a: string, b: string }, intervention?: Object }}
 */
export function executeDOW(state, power, actionData, helpers) {
  const { target } = actionData;

  // Add war
  addWar(state, power, target);

  const result = { war: { a: power, b: target } };

  // Check for intervention opportunities
  const intervention = INTERVENTION_COSTS[target];
  if (intervention && intervention.power !== power) {
    // Flag pending intervention (e.g., France for Scotland, Papacy for Venice)
    result.intervention = {
      minor: target,
      interventionPower: intervention.power,
      cost: intervention.cost
    };
  }

  helpers.logEvent(state, 'declare_war', {
    power, target, ...result
  });

  return result;
}

// ── Suing for Peace ────────────────────────────────────────────

/**
 * Validate suing for peace.
 * @param {Object} state
 * @param {string} power - Power suing for peace
 * @param {Object} actionData - { target }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSueForPeace(state, power, actionData) {
  const { target } = actionData;
  if (!target) return { valid: false, error: 'Missing target' };

  if (!areAtWar(state, power, target)) {
    return { valid: false, error: `Not at war with ${target}` };
  }

  return { valid: true };
}

/**
 * Execute suing for peace (simplified: end war, winner gets VP).
 * @param {Object} state
 * @param {string} power - Power suing (loser)
 * @param {Object} actionData - { target }
 * @param {Object} helpers
 * @returns {{ warEnded: boolean, winnerVp?: number }}
 */
export function executeSueForPeace(state, power, actionData, helpers) {
  const { target } = actionData;

  removeWar(state, power, target);

  // Winner (target) gets 1 VP for winning the war
  const winnerVp = 1;
  if (state.vp[target] !== undefined) {
    state.vp[target] += winnerVp;
  }

  // Track peace made this turn
  if (!state.peaceMadeThisTurn) state.peaceMadeThisTurn = [];
  state.peaceMadeThisTurn.push(target);

  // Also add reverse so target can't DOW power either
  if (!state.peaceMadeThisTurn.includes(power)) {
    state.peaceMadeThisTurn.push(power);
  }

  helpers.logEvent(state, 'sue_for_peace', {
    power, target, winnerVp
  });

  return { warEnded: true, winnerVp };
}

// ── Negotiations ───────────────────────────────────────────────

/**
 * Validate a negotiation action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { type, target, ... }
 *   type: 'end_war' | 'form_alliance' | 'transfer_space' |
 *         'gift_cards' | 'gift_mercenaries' | 'return_leader'
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNegotiate(state, power, actionData) {
  const { type, target } = actionData;
  if (!type) return { valid: false, error: 'Missing negotiation type' };
  if (!target) return { valid: false, error: 'Missing target' };

  switch (type) {
    case 'end_war':
      if (!areAtWar(state, power, target)) {
        return { valid: false, error: `Not at war with ${target}` };
      }
      return { valid: true };

    case 'form_alliance':
      if (areAllied(state, power, target)) {
        return { valid: false, error: 'Already allied' };
      }
      if (areAtWar(state, power, target)) {
        return { valid: false, error: 'Cannot ally while at war' };
      }
      return { valid: true };

    case 'transfer_space': {
      const { space } = actionData;
      if (!space) return { valid: false, error: 'Missing space' };
      const sp = state.spaces[space];
      if (!sp) return { valid: false, error: `Space "${space}" not found` };
      if (sp.controller !== power) {
        return { valid: false, error: 'Can only transfer spaces you control' };
      }
      return { valid: true };
    }

    case 'gift_cards': {
      const { count } = actionData;
      if (!count || count < 1) return { valid: false, error: 'Invalid card count' };
      if (count > NEGOTIATION_LIMITS.maxCardDrawGifts) {
        return { valid: false, error: `Max ${NEGOTIATION_LIMITS.maxCardDrawGifts} card gifts per turn` };
      }
      return { valid: true };
    }

    case 'gift_mercenaries': {
      const { count } = actionData;
      if (!count || count < 1) return { valid: false, error: 'Invalid mercenary count' };
      if (count > NEGOTIATION_LIMITS.maxMercenaryGifts) {
        return { valid: false, error: `Max ${NEGOTIATION_LIMITS.maxMercenaryGifts} mercenary gifts` };
      }
      if (target === 'ottoman') {
        return { valid: false, error: 'Cannot gift mercenaries to Ottoman' };
      }
      return { valid: true };
    }

    case 'return_leader': {
      const { leaderId } = actionData;
      if (!leaderId) return { valid: false, error: 'Missing leaderId' };
      const captured = state.capturedLeaders[power] || [];
      if (!captured.includes(leaderId)) {
        return { valid: false, error: 'Leader not in your captured list' };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: `Unknown negotiation type: ${type}` };
  }
}

/**
 * Execute a negotiation action.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData
 * @param {Object} helpers
 * @returns {Object} Result
 */
export function executeNegotiate(state, power, actionData, helpers) {
  const { type, target } = actionData;

  switch (type) {
    case 'end_war': {
      removeWar(state, power, target);
      if (!state.peaceMadeThisTurn) state.peaceMadeThisTurn = [];
      state.peaceMadeThisTurn.push(target, power);
      helpers.logEvent(state, 'negotiate_end_war', { power, target });
      return { warEnded: true };
    }

    case 'form_alliance': {
      addAlliance(state, power, target);
      if (!state.alliancesFormedThisTurn) state.alliancesFormedThisTurn = [];
      state.alliancesFormedThisTurn.push({ a: power, b: target });
      helpers.logEvent(state, 'negotiate_alliance', { power, target });
      return { allied: true };
    }

    case 'transfer_space': {
      const { space } = actionData;
      state.spaces[space].controller = target;
      helpers.logEvent(state, 'negotiate_transfer', { power, target, space });
      return { transferred: space };
    }

    case 'gift_cards': {
      const { count } = actionData;
      // Draw random cards from deck for target
      const drawn = [];
      for (let i = 0; i < count && state.deck.length > 0; i++) {
        const idx = Math.floor(Math.random() * state.deck.length);
        const card = state.deck.splice(idx, 1)[0];
        state.hands[target].push(card);
        drawn.push(card);
      }
      helpers.logEvent(state, 'negotiate_gift_cards', { power, target, count: drawn.length });
      return { cardsGifted: drawn.length };
    }

    case 'gift_mercenaries': {
      const { count, space } = actionData;
      // Add mercenaries to target's stack at specified space
      let stack = getUnitsInSpace(state, space, target);
      if (!stack) {
        stack = {
          owner: target, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        state.spaces[space].units.push(stack);
      }
      stack.mercenaries += count;
      helpers.logEvent(state, 'negotiate_gift_mercs', { power, target, count, space });
      return { mercenariesGifted: count };
    }

    case 'return_leader': {
      const { leaderId } = actionData;
      const captured = state.capturedLeaders[power];
      const idx = captured.indexOf(leaderId);
      if (idx !== -1) captured.splice(idx, 1);
      helpers.logEvent(state, 'negotiate_return_leader', { power, target, leaderId });
      return { leaderReturned: leaderId };
    }

    default:
      return {};
  }
}

// ── Ransom ─────────────────────────────────────────────────────

/**
 * Validate ransoming a captured leader.
 * @param {Object} state
 * @param {string} power - Power paying ransom (wants leader back)
 * @param {Object} actionData - { captor, leaderId }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRansom(state, power, actionData) {
  const { captor, leaderId } = actionData;
  if (!captor) return { valid: false, error: 'Missing captor' };
  if (!leaderId) return { valid: false, error: 'Missing leaderId' };

  const captured = state.capturedLeaders[captor] || [];
  if (!captured.includes(leaderId)) {
    return { valid: false, error: 'Leader not captured by that power' };
  }

  return { valid: true };
}

/**
 * Execute ransoming a captured leader.
 * Captor gains 1 VP, leader returned to owner.
 * @param {Object} state
 * @param {string} power - Power paying ransom
 * @param {Object} actionData - { captor, leaderId }
 * @param {Object} helpers
 * @returns {{ ransomed: boolean, vp: number }}
 */
export function executeRansom(state, power, actionData, helpers) {
  const { captor, leaderId } = actionData;

  // Remove from captured list
  const captured = state.capturedLeaders[captor];
  const idx = captured.indexOf(leaderId);
  if (idx !== -1) captured.splice(idx, 1);

  // Captor gains 1 VP
  const ransomVp = 1;
  if (state.vp[captor] !== undefined) {
    state.vp[captor] += ransomVp;
  }

  helpers.logEvent(state, 'ransom_leader', {
    power, captor, leaderId, vp: ransomVp
  });

  return { ransomed: true, vp: ransomVp };
}
