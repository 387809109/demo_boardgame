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
  isMinorPower, getMinorAlly
} from '../state/war-helpers.js';
import { getUnitsInSpace, isHomeSpace } from '../state/state-helpers.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { LEADER_BY_ID } from '../data/leaders.js';

function makeDiploPairKey(a, b) {
  return [a, b].sort().join('|');
}

function hasDiploPair(list, a, b) {
  if (!Array.isArray(list) || list.length === 0) return false;
  const key = makeDiploPairKey(a, b);
  for (const entry of list) {
    if (typeof entry === 'string') {
      if (entry === key) return true;
      if (entry.includes('|') || entry.includes('-')) {
        const parts = entry.split(entry.includes('|') ? '|' : '-');
        if (parts.length === 2 && makeDiploPairKey(parts[0], parts[1]) === key) {
          return true;
        }
      }
      continue;
    }
    if (entry && typeof entry === 'object' && entry.a && entry.b) {
      if (makeDiploPairKey(entry.a, entry.b) === key) return true;
    }
  }
  return false;
}

function recordDiploPair(list, a, b) {
  if (!Array.isArray(list)) return;
  const key = makeDiploPairKey(a, b);
  if (!list.includes(key)) list.push(key);
}

function countPowerMercenaries(state, power) {
  let total = 0;
  for (const sp of Object.values(state.spaces)) {
    for (const stack of sp.units || []) {
      if (stack.owner === power) {
        total += stack.mercenaries || 0;
      }
    }
  }
  return total;
}

function removePowerMercenaries(state, power, count) {
  let remaining = count;
  for (const sp of Object.values(state.spaces)) {
    for (const stack of sp.units || []) {
      if (stack.owner !== power || remaining <= 0) continue;
      const available = stack.mercenaries || 0;
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      stack.mercenaries -= take;
      remaining -= take;
    }
    if (remaining <= 0) break;
  }
}

function hasLossesEligibleForPeace(state, power, target) {
  // Leader captured by target
  const capturedByTarget = state.capturedLeaders?.[target] || [];
  const lostLeader = capturedByTarget.some((leaderId) => {
    const leader = LEADER_BY_ID[leaderId];
    return leader?.faction === power;
  });
  if (lostLeader) return true;

  // Any home space of power currently controlled by target
  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    if (!isHomeSpace(spaceName, power)) continue;
    if (sp.controller === target) return true;
  }

  return false;
}

function getNegotiableCardsInHand(state, power) {
  const hand = state.hands?.[power] || [];
  return hand.filter((cardNumber) => CARD_BY_NUMBER[cardNumber]?.deck !== 'home');
}

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

  // Cannot DOW a power you allied with this diplomacy phase
  if (hasDiploPair(state.alliancesFormedThisTurn, power, target)) {
    return { valid: false, error: 'Cannot declare war on a power you allied with this turn' };
  }

  // Protestant restrictions
  if (power === 'protestant' || target === 'protestant') {
    if (!state.schmalkaldicLeagueFormed) {
      return { valid: false, error: 'Protestant cannot participate in wars before Schmalkaldic League' };
    }
  }

  // Cannot DOW on power you made peace with this turn
  if (hasDiploPair(state.peaceMadeThisTurn, power, target)) {
    return { valid: false, error: 'Cannot declare war on a power you made peace with this turn' };
  }

  // Calculate cost
  let cost;
  if (isMinorPower(target)) {
    if (target === 'hungary_bohemia' && power !== 'ottoman') {
      return { valid: false, error: 'Only Ottoman can declare war on Hungary/Bohemia' };
    }
    if (target === 'scotland') {
      if (['ottoman', 'papacy', 'protestant'].includes(power)) {
        return { valid: false, error: `${power} cannot declare war on Scotland` };
      }
      if (areAllied(state, power, 'france')) {
        return { valid: false, error: 'Cannot declare war on Scotland while allied with France' };
      }
      if (hasDiploPair(state.peaceMadeThisTurn, power, 'france')) {
        return { valid: false, error: 'Cannot declare war on Scotland after peacing with France this turn' };
      }
    }
    if (target === 'venice') {
      if (power === 'england') {
        return { valid: false, error: 'England cannot declare war on Venice' };
      }
      if (areAllied(state, power, 'papacy')) {
        return { valid: false, error: 'Cannot declare war on Venice while allied with Papacy' };
      }
      if (hasDiploPair(state.peaceMadeThisTurn, power, 'papacy')) {
        return { valid: false, error: 'Cannot declare war on Venice after peacing with Papacy this turn' };
      }
    }

    const minorAlly = getMinorAlly(state, target);
    if (minorAlly && minorAlly !== power) {
      return { valid: false, error: `${target} is allied with ${minorAlly}; declare war on ${minorAlly} instead` };
    }

    cost = DOW_MINOR_COST;
    // Check if minor is allied to declaring power
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

  // Final-turn peace segment is skipped (tournament: turn 6, standard: turn 9)
  const finalTurn = state.finalTurn || 9;
  if (state.turn >= finalTurn) {
    return { valid: false, error: 'Cannot sue for peace in final turn' };
  }

  // Protestant vs Hapsburg/Papacy peace restriction
  const proVsCathPower =
    (power === 'protestant' && (target === 'hapsburg' || target === 'papacy'))
    || (target === 'protestant' && (power === 'hapsburg' || power === 'papacy'));
  if (proVsCathPower) {
    return { valid: false, error: 'Peace not allowed between Protestant and Hapsburg/Papacy in this war' };
  }

  if (!hasLossesEligibleForPeace(state, power, target)) {
    return { valid: false, error: 'Cannot sue for peace without captured leader or lost home space' };
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

  // Winner (target) gets 1 VP (2 VP if war involved Ottoman)
  const winnerVp = (power === 'ottoman' || target === 'ottoman') ? 2 : 1;
  if (state.vp[target] !== undefined) {
    state.vp[target] += winnerVp;
  }

  // Track peace made this turn
  if (!state.peaceMadeThisTurn) state.peaceMadeThisTurn = [];
  recordDiploPair(state.peaceMadeThisTurn, power, target);

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
      // Papacy and Ottoman can never ally
      if ((power === 'papacy' && target === 'ottoman') ||
          (power === 'ottoman' && target === 'papacy')) {
        return { valid: false, error: 'Papacy and Ottoman can never form an alliance' };
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
      if (getNegotiableCardsInHand(state, power).length < count) {
        return { valid: false, error: 'Not enough non-home cards in hand to gift' };
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
      if (countPowerMercenaries(state, power) < count) {
        return { valid: false, error: 'Not enough mercenaries to gift' };
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
      recordDiploPair(state.peaceMadeThisTurn, power, target);
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
      // Draw random cards from giver hand (home cards excluded)
      const drawn = [];
      const giverHand = state.hands[power] || [];
      const giftable = getNegotiableCardsInHand(state, power);

      for (let i = 0; i < count && giftable.length > 0; i++) {
        const pickIdx = Math.floor(Math.random() * giftable.length);
        const card = giftable.splice(pickIdx, 1)[0];
        const handIdx = giverHand.indexOf(card);
        if (handIdx !== -1) giverHand.splice(handIdx, 1);
        state.hands[target].push(card);
        drawn.push(card);
      }
      helpers.logEvent(state, 'negotiate_gift_cards', { power, target, count: drawn.length });
      return { cardsGifted: drawn.length };
    }

    case 'gift_mercenaries': {
      const { count, space } = actionData;
      removePowerMercenaries(state, power, count);

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
 * §9.4: Captor draws 1 random card from ransoming power's hand.
 * @param {Object} state
 * @param {string} power - Power paying ransom
 * @param {Object} actionData - { captor, leaderId }
 * @param {Object} helpers
 * @returns {{ ransomed: boolean, cardDrawn: boolean }}
 */
export function executeRansom(state, power, actionData, helpers) {
  const { captor, leaderId } = actionData;

  // Remove from captured list
  const captured = state.capturedLeaders[captor];
  const idx = captured.indexOf(leaderId);
  if (idx !== -1) captured.splice(idx, 1);

  // §9.4: Captor draws 1 random card from ransoming power's hand
  let cardDrawn = false;
  const ransomHand = state.hands?.[power] || [];
  if (ransomHand.length > 0) {
    const pickIdx = Math.floor(Math.random() * ransomHand.length);
    const card = ransomHand.splice(pickIdx, 1)[0];
    if (state.hands[captor]) {
      state.hands[captor].push(card);
    }
    cardDrawn = true;
  }

  helpers.logEvent(state, 'ransom_leader', {
    power, captor, leaderId, cardDrawn
  });

  return { ransomed: true, cardDrawn };
}
