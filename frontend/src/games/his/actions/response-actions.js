/**
 * Here I Stand — Response Card System
 *
 * Manages response windows during combat (W2/W3 for combat cards).
 * Each window pauses game flow to allow a player to play a response
 * card or decline.
 *
 * Combat cards are #24-30 and have specific battle-type restrictions:
 *   #24 Arquebusiers   — field or naval (not assault/piracy)
 *   #25 Field Artillery — field only
 *   #26 Mercenaries Bribed — field only, NOT by/against Ottoman
 *   #27 Mercenaries Grow Restless — assault only (defender only)
 *   #28 Siege Mining    — assault only (attacker only)
 *   #29 Surprise Attack — field only
 *   #30 Tercios         — field only
 */

import { CARD_BY_NUMBER } from '../data/cards.js';
import { EVENT_HANDLERS } from './event-actions.js';

// ── Combat Card Eligibility Rules ────────────────────────────────

/**
 * @typedef {'field'|'assault'|'naval'} BattleType
 * @typedef {'attacker'|'defender'} CombatRole
 */

/**
 * Per-card eligibility: which battle types and roles can use it.
 * Each entry: { types: Set<BattleType>, roles: Set<CombatRole>,
 *               extraCheck?: (state, power, context) => boolean }
 */
const COMBAT_CARD_RULES = {
  24: {
    types: new Set(['field', 'naval']),
    roles: new Set(['attacker', 'defender'])
  },
  25: {
    types: new Set(['field']),
    roles: new Set(['attacker', 'defender'])
  },
  26: {
    types: new Set(['field']),
    roles: new Set(['attacker', 'defender']),
    /**
     * Not playable by the Ottomans or if the opponent is Ottoman.
     */
    extraCheck(state, power, context) {
      if (power === 'ottoman') return false;
      const opponent = power === context.attackerPower
        ? context.defenderPower
        : context.attackerPower;
      return opponent !== 'ottoman';
    }
  },
  27: {
    types: new Set(['assault']),
    roles: new Set(['defender'])
  },
  28: {
    types: new Set(['assault']),
    roles: new Set(['attacker'])
  },
  29: {
    types: new Set(['field']),
    roles: new Set(['attacker', 'defender'])
  },
  30: {
    types: new Set(['field']),
    roles: new Set(['attacker', 'defender'])
  }
};

// ── Public API ───────────────────────────────────────────────────

/**
 * Get valid combat cards a power can play for a given battle.
 * @param {Object} state
 * @param {string} power
 * @param {BattleType} battleType
 * @param {CombatRole} role
 * @returns {number[]} Array of card numbers the power can legally play
 */
export function getValidCombatCards(state, power, battleType, role) {
  const hand = state.hands[power];
  if (!hand || hand.length === 0) return [];

  const context = state.pendingResponse
    ? state.pendingResponse.context
    : null;

  const valid = [];
  for (const cardNum of hand) {
    const rule = COMBAT_CARD_RULES[cardNum];
    if (!rule) continue;
    if (!rule.types.has(battleType)) continue;
    if (!rule.roles.has(role)) continue;
    if (rule.extraCheck && context) {
      if (!rule.extraCheck(state, power, context)) continue;
    }
    valid.push(cardNum);
  }
  return valid;
}

/**
 * Check whether attacker/defender can play any combat card.
 * @param {Object} state
 * @param {BattleType} battleType
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @returns {{ attackerCanRespond: boolean, defenderCanRespond: boolean }}
 */
export function canAnyPowerRespondCombat(
  state, battleType, attackerPower, defenderPower
) {
  // Build a temporary context so getValidCombatCards' extraCheck works
  const saved = state.pendingResponse;
  state.pendingResponse = {
    context: {
      type: battleType,
      attackerPower,
      defenderPower
    }
  };

  const attackerCards = getValidCombatCards(
    state, attackerPower, battleType, 'attacker'
  );
  const defenderCards = getValidCombatCards(
    state, defenderPower, battleType, 'defender'
  );

  state.pendingResponse = saved;

  return {
    attackerCanRespond: attackerCards.length > 0,
    defenderCanRespond: defenderCards.length > 0
  };
}

/**
 * Create a combat card response window.
 * @param {Object} state
 * @param {'W2'|'W3'} window - W2 = attacker, W3 = defender
 * @param {string} space - Space where combat occurs
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {BattleType} battleType
 * @param {Object} [battleState] - Carried-forward battle state info
 * @returns {boolean} true if window was created, false if no valid cards
 */
export function createCombatCardWindow(
  state, window, space, attackerPower, defenderPower,
  battleType, battleState
) {
  const respondingPower = window === 'W2'
    ? attackerPower
    : defenderPower;
  const role = window === 'W2' ? 'attacker' : 'defender';

  // Temporarily set context for extraCheck in getValidCombatCards
  const saved = state.pendingResponse;
  state.pendingResponse = {
    context: {
      type: battleType,
      space,
      attackerPower,
      defenderPower
    }
  };

  const validCards = getValidCombatCards(
    state, respondingPower, battleType, role
  );

  if (validCards.length === 0) {
    state.pendingResponse = saved;
    return false;
  }

  state.pendingResponse = {
    window,
    context: {
      type: battleType,
      space,
      attackerPower,
      defenderPower
    },
    respondingPower,
    validCards,
    responses: (battleState && battleState.responses) || {},
    battleState: battleState || {}
  };

  return true;
}

/**
 * Handle a player playing a combat response card.
 * @param {Object} state
 * @param {string} power
 * @param {Object} actionData - { cardNumber }
 * @param {Object} helpers
 * @returns {{ success: boolean, cardNumber?: number, window?: string,
 *             error?: string }}
 */
export function handlePlayResponseCard(state, power, actionData, helpers) {
  if (!state.pendingResponse) {
    return { success: false, error: 'No pending response window' };
  }
  if (state.pendingResponse.respondingPower !== power) {
    return {
      success: false,
      error: `Not ${power}'s turn to respond`
    };
  }

  const { cardNumber } = actionData;
  if (!state.pendingResponse.validCards.includes(cardNumber)) {
    return {
      success: false,
      error: `Card ${cardNumber} is not a valid response`
    };
  }

  const hand = state.hands[power];
  const idx = hand.indexOf(cardNumber);
  if (idx === -1) {
    return {
      success: false,
      error: `Card ${cardNumber} not in hand`
    };
  }

  // Remove from hand
  hand.splice(idx, 1);

  // Discard or remove
  const cardDef = CARD_BY_NUMBER[cardNumber];
  if (cardDef && cardDef.removeAfterPlay) {
    state.removedCards.push(cardNumber);
  } else {
    state.discard.push(cardNumber);
  }

  // Apply combat card effect via EVENT_HANDLERS
  const handler = EVENT_HANDLERS[cardNumber];
  if (handler && handler.execute) {
    const eventActionData = {
      ...actionData,
      targetSpace: state.pendingResponse.context.space,
      targetPower: power === state.pendingResponse.context.attackerPower
        ? state.pendingResponse.context.defenderPower
        : state.pendingResponse.context.attackerPower
    };
    handler.execute(state, power, eventActionData, helpers);
  }

  // Record the response
  const window = state.pendingResponse.window;
  state.pendingResponse.responses[window] = {
    power,
    cardNumber
  };

  // Log
  const title = cardDef ? cardDef.title : `Card #${cardNumber}`;
  helpers.logEvent(state, 'play_response_card', {
    power,
    cardNumber,
    title,
    window
  });

  // Clear pending (caller decides what happens next)
  const responses = { ...state.pendingResponse.responses };
  const battleSt = { ...state.pendingResponse.battleState };
  state.pendingResponse = null;

  return { success: true, cardNumber, window, responses, battleState: battleSt };
}

/**
 * Handle a player declining to play a response card.
 * @param {Object} state
 * @param {string} power
 * @param {Object} helpers
 * @returns {{ success: boolean, window?: string, error?: string }}
 */
export function handleDeclineResponse(state, power, helpers) {
  if (!state.pendingResponse) {
    return { success: false, error: 'No pending response window' };
  }
  if (state.pendingResponse.respondingPower !== power) {
    return {
      success: false,
      error: `Not ${power}'s turn to respond`
    };
  }

  const window = state.pendingResponse.window;
  const responses = { ...state.pendingResponse.responses };
  const battleSt = { ...state.pendingResponse.battleState };

  helpers.logEvent(state, 'decline_response', { power, window });

  state.pendingResponse = null;

  return { success: true, window, responses, battleState: battleSt };
}

/**
 * Determine the next combat response window after the current one.
 * After W2 (attacker), check if W3 (defender) should open.
 * After W3 (defender), return null to proceed to dice roll.
 * @param {'W2'|'W3'} currentWindow
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {BattleType} battleType
 * @param {Object} [battleState]
 * @returns {'W3'|null}
 */
export function getNextCombatWindow(
  currentWindow, state, space, attackerPower, defenderPower,
  battleType, battleState
) {
  if (currentWindow === 'W2') {
    // After attacker responds/declines, check if defender can respond
    const saved = state.pendingResponse;
    state.pendingResponse = {
      context: {
        type: battleType,
        space,
        attackerPower,
        defenderPower
      }
    };

    const defenderCards = getValidCombatCards(
      state, defenderPower, battleType, 'defender'
    );

    state.pendingResponse = saved;

    if (defenderCards.length > 0) return 'W3';
    return null;
  }

  // After W3, proceed to dice roll
  return null;
}
