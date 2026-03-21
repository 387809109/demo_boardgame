/**
 * Here I Stand — Response Card System
 *
 * Manages response windows during combat:
 *   W1 — Mercenary cards (#33 Landsknechts, #36 Swiss Mercenaries)
 *         Any player in impulse order, before dice calculation.
 *   W2 — Attacker combat card (#24-30)
 *   W3 — Defender combat card (#24-30)
 *   W4 — Janissaries (#1 in combat mode) — Ottoman re-roll, field only
 *   W5 — Siege Artillery (#35) — bonus to assault roll
 *   W6 — Professional Rowers (#34) — bonus to naval combat
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
import { IMPULSE_ORDER } from '../constants.js';

// ── W1 Mercenary Card Eligibility Rules ──────────────────────────

/**
 * Per-card eligibility for mercenary cards (#33, #36).
 * Each entry: { extraCheck: (state, power) => boolean }
 *   #33 Landsknechts     — any player
 *   #36 Swiss Mercenaries — not Ottoman
 */
const MERCENARY_CARD_RULES = {
  33: { // Landsknechts — any player
    extraCheck: () => true
  },
  36: { // Swiss Mercenaries — not Ottoman
    extraCheck: (_state, power) => power !== 'ottoman'
  }
};

/**
 * Get valid mercenary cards a power can play in a field battle.
 * @param {Object} state
 * @param {string} power
 * @returns {number[]} Array of card numbers the power can legally play
 */
export function getValidMercenaryCards(state, power) {
  const hand = state.hands[power];
  if (!hand || hand.length === 0) return [];

  const valid = [];
  for (const cardNum of hand) {
    const rule = MERCENARY_CARD_RULES[cardNum];
    if (!rule) continue;
    if (!rule.extraCheck(state, power)) continue;
    valid.push(cardNum);
  }
  return valid;
}

/**
 * Check which major powers can play a mercenary card.
 * Returns powers in impulse order who hold #33 or #36.
 * @param {Object} state
 * @returns {{ powers: string[] }}
 */
export function canAnyPowerRespondMercenary(state) {
  const powers = [];
  for (const power of IMPULSE_ORDER) {
    const cards = getValidMercenaryCards(state, power);
    if (cards.length > 0) {
      powers.push(power);
    }
  }
  return { powers };
}

/**
 * Create a W1 mercenary response window.
 * Iterates through all major powers in impulse order.
 * @param {Object} state
 * @param {string} space - Space where field battle occurs
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {Object} [battleState] - Carried-forward battle state info
 * @returns {boolean} true if window was created, false if no power can
 */
export function createMercenaryWindow(
  state, space, attackerPower, defenderPower, battleState
) {
  const { powers } = canAnyPowerRespondMercenary(state);
  if (powers.length === 0) return false;

  const validCards = getValidMercenaryCards(state, powers[0]);

  state.pendingResponse = {
    window: 'W1',
    context: {
      type: 'field',
      space,
      attackerPower,
      defenderPower
    },
    respondingPower: powers[0],
    respondingPowers: powers,
    currentResponderIndex: 0,
    validCards,
    responses: (battleState && battleState.responses) || {},
    battleState: battleState || {}
  };

  return true;
}

/**
 * Advance the W1 mercenary window to the next responder.
 * Called after the current responder plays or declines.
 * @param {Object} state
 * @param {Object} helpers
 * @returns {'W1'|null} 'W1' if another power can respond, null if done
 */
export function advanceMercenaryWindow(state, helpers) {
  const pending = state.pendingResponse;
  if (!pending || pending.window !== 'W1') return null;

  const { respondingPowers, currentResponderIndex, context } = pending;
  const nextIndex = currentResponderIndex + 1;

  if (nextIndex >= respondingPowers.length) {
    // All powers have responded — W1 is done
    return null;
  }

  const nextPower = respondingPowers[nextIndex];
  const validCards = getValidMercenaryCards(state, nextPower);

  // Skip powers that no longer have valid cards (edge case)
  if (validCards.length === 0) {
    pending.currentResponderIndex = nextIndex;
    return advanceMercenaryWindow(state, helpers);
  }

  state.pendingResponse = {
    window: 'W1',
    context,
    respondingPower: nextPower,
    respondingPowers,
    currentResponderIndex: nextIndex,
    validCards,
    responses: pending.responses || {},
    battleState: pending.battleState || {}
  };

  return 'W1';
}

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
 * After W1 (mercenaries), check if W2 (attacker) should open.
 * After W2 (attacker), check if W3 (defender) should open.
 * After W3 (defender), return null to proceed to dice roll.
 * @param {'W1'|'W2'|'W3'} currentWindow
 * @param {Object} state
 * @param {string} space
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {BattleType} battleType
 * @param {Object} [battleState]
 * @returns {'W2'|'W3'|null}
 */
export function getNextCombatWindow(
  currentWindow, state, space, attackerPower, defenderPower,
  battleType, battleState
) {
  if (currentWindow === 'W1') {
    // After mercenaries, check if attacker can play a combat card
    const saved = state.pendingResponse;
    state.pendingResponse = {
      context: {
        type: battleType,
        space,
        attackerPower,
        defenderPower
      }
    };

    const attackerCards = getValidCombatCards(
      state, attackerPower, battleType, 'attacker'
    );

    if (attackerCards.length > 0) {
      state.pendingResponse = saved;
      return 'W2';
    }

    const defenderCards = getValidCombatCards(
      state, defenderPower, battleType, 'defender'
    );

    state.pendingResponse = saved;

    if (defenderCards.length > 0) return 'W3';
    return null;
  }

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

  // After W3, proceed to dice roll (post-roll windows are separate)
  return null;
}

// ── Post-Roll Card Rules (W4/W5/W6) ────────────────────────────

/**
 * Post-roll card eligibility: which cards can be played after dice
 * are rolled but before the result is finalized.
 *
 *   #1  Janissaries (combat mode) — Ottoman only, field battle only
 *   #35 Siege Artillery — any combatant, assault only
 *   #34 Professional Rowers — any combatant, naval only
 */
const POST_ROLL_CARD_RULES = {
  1: { // Janissaries (combat mode) — Ottoman only, field battle only
    battleTypes: new Set(['field']),
    powerRestriction: 'ottoman',
    window: 'W4'
  },
  35: { // Siege Artillery — any combatant, assault only
    battleTypes: new Set(['assault']),
    powerRestriction: null,
    window: 'W5'
  },
  34: { // Professional Rowers — any combatant, naval only
    battleTypes: new Set(['naval']),
    powerRestriction: null,
    window: 'W6'
  }
};

/**
 * Get valid post-roll cards a power can play for a given battle type.
 * @param {Object} state
 * @param {string} power
 * @param {BattleType} battleType
 * @returns {number[]} Array of card numbers the power can legally play
 */
export function getValidPostRollCards(state, power, battleType) {
  const hand = state.hands[power];
  if (!hand || hand.length === 0) return [];

  const valid = [];
  for (const cardNum of hand) {
    const rule = POST_ROLL_CARD_RULES[cardNum];
    if (!rule) continue;
    if (!rule.battleTypes.has(battleType)) continue;
    if (rule.powerRestriction && rule.powerRestriction !== power) continue;
    valid.push(cardNum);
  }
  return valid;
}

/**
 * Check if any power involved in combat can play a post-roll card.
 * W4: only Ottoman, field only.
 * W5: attacker or defender, assault only.
 * W6: attacker or defender, naval only.
 * @param {Object} state
 * @param {BattleType} battleType
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @returns {{ canRespond: boolean, respondingPower?: string,
 *             windowType?: string }}
 */
export function canAnyPowerRespondPostRoll(
  state, battleType, attackerPower, defenderPower
) {
  // Check attacker first, then defender
  for (const power of [attackerPower, defenderPower]) {
    const cards = getValidPostRollCards(state, power, battleType);
    if (cards.length > 0) {
      // Determine window type from the first matching card
      const rule = POST_ROLL_CARD_RULES[cards[0]];
      return {
        canRespond: true,
        respondingPower: power,
        windowType: rule.window
      };
    }
  }
  return { canRespond: false };
}

/**
 * Create a post-roll response window (W4, W5, or W6).
 * @param {Object} state
 * @param {'W4'|'W5'|'W6'} windowType
 * @param {string} space - Space where combat occurs
 * @param {string} attackerPower
 * @param {string} defenderPower
 * @param {BattleType} battleType
 * @param {Object} [battleState] - Carried-forward battle state
 * @returns {boolean} true if window was created
 */
export function createPostRollWindow(
  state, windowType, space, attackerPower, defenderPower,
  battleType, battleState
) {
  // Determine which power(s) can respond
  const powersToCheck = windowType === 'W4'
    ? ['ottoman']
    : [attackerPower, defenderPower];

  let respondingPower = null;
  let validCards = [];

  for (const power of powersToCheck) {
    const cards = getValidPostRollCards(state, power, battleType);
    if (cards.length > 0) {
      respondingPower = power;
      validCards = cards;
      break;
    }
  }

  if (!respondingPower || validCards.length === 0) return false;

  state.pendingResponse = {
    window: windowType,
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
 * Determine the next response window after a post-roll window.
 * Post-roll windows are terminal for their battle type —
 * W4 is always last for field, W5 for assault, W6 for naval.
 * @param {'W4'|'W5'|'W6'} currentWindow
 * @returns {null}
 */
export function getNextPostRollWindow(currentWindow) {
  // Post-roll windows are always the final window for their battle type
  return null;
}
