/**
 * Here I Stand — HISBOT Rule Exceptions & Integration (Phase F)
 *
 * §8 Bot-specific rule exceptions that differ from human play:
 *   F3.1  Event Duration Extensions (4 cards: Augsburg Confession,
 *         Calvin Expelled, Julia Gonzaga, Printing Press)
 *   F3.2  Free Unrest Removal during Winter (§2.11)
 *   F3.3  Fortress Unit Placement on negotiation/peace gains
 *   F3.4  Extended Excommunication Debater Return (Papal Bull §6)
 *   F3.5  Extended Threat to Power leader removal
 *   F3.6  No Phony War penalty for Bots (§4.34)
 *   F4    Final Autumn Assaults at end of Action Phase (§2.10.3)
 *   F5    Difficulty Settings — extra card draw
 */

import { ACTION_TYPES } from '../actions/action-types.js';
import { CAPITALS } from '../constants.js';
import {
  getUnitsInSpace, countLandUnits, isFortified, isHomeSpace
} from '../state/state-helpers.js';
import { isBotPower, getBotPowers } from './bot-controller.js';
import { getFinalAutumnAssaults } from './bot-card-play.js';

// ═══════════════════════════════════════════════════════════════════════
//  F3.1 EVENT DURATION EXTENSIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Cards whose effects last an additional turn when played by a Bot.
 *
 * §8: "Augsburg Confession, Calvin Expelled, Julia Gonzaga,
 *      Printing Press — effects last until end of following turn."
 *
 * Map: cardNumber → { name, extraTurns }
 */
export const EXTENDED_EVENT_CARDS = {
  // These card numbers are from the card data; exact numbers depend on
  // the card database. We use the canonical card identifiers.
  // Augsburg Confession
  109: { name: 'Augsburg Confession', extraTurns: 1 },
  // Calvin Expelled (Papacy plays)
  84:  { name: 'Calvin Expelled', extraTurns: 1 },
  // Julia Gonzaga (Ottoman plays)
  72:  { name: 'Julia Gonzaga', extraTurns: 1 },
  // Printing Press (Protestant plays)
  91:  { name: 'Printing Press', extraTurns: 1 }
};

/**
 * Check if a card played by a Bot should have extended duration.
 *
 * @param {Object} state
 * @param {string} power - Power playing the card
 * @param {number} cardNumber
 * @returns {{ extended: boolean, expiryTurn: number|null }}
 */
export function checkExtendedEventDuration(state, power, cardNumber) {
  if (!isBotPower(state, power)) return { extended: false, expiryTurn: null };

  const ext = EXTENDED_EVENT_CARDS[cardNumber];
  if (!ext) return { extended: false, expiryTurn: null };

  const currentTurn = state.turn || 1;
  return {
    extended: true,
    expiryTurn: currentTurn + 1 + ext.extraTurns
  };
}

/**
 * Track active extended events for Bot powers.
 * Call after a Bot plays an event card with extended duration.
 *
 * Stores in state.botExtendedEvents[]: { cardNumber, power, expiryTurn }
 *
 * @param {Object} state - Mutated
 * @param {string} power
 * @param {number} cardNumber
 * @param {number} expiryTurn
 */
export function registerExtendedEvent(state, power, cardNumber, expiryTurn) {
  if (!state.botExtendedEvents) state.botExtendedEvents = [];
  state.botExtendedEvents.push({ cardNumber, power, expiryTurn });
}

/**
 * Remove expired extended events at the start of a turn.
 * Call during turn setup.
 *
 * @param {Object} state - Mutated
 * @param {number} currentTurn
 * @returns {Array<{ cardNumber: number, power: string }>} Removed events
 */
export function expireExtendedEvents(state, currentTurn) {
  if (!state.botExtendedEvents) return [];

  const expired = state.botExtendedEvents.filter(e => e.expiryTurn <= currentTurn);
  state.botExtendedEvents = state.botExtendedEvents.filter(
    e => e.expiryTurn > currentTurn
  );
  return expired;
}

/**
 * Check if an event card's effect is still active (extended by Bot).
 *
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function isExtendedEventActive(state, cardNumber) {
  return (state.botExtendedEvents || []).some(e => e.cardNumber === cardNumber);
}

// ═══════════════════════════════════════════════════════════════════════
//  F3.2 FREE UNREST REMOVAL (Winter Phase)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate free unrest removal action for each Bot power during Winter.
 *
 * §8 / §2.11: "Remove one unrest marker for free each turn during Winter."
 * Already computed by bot-phases.js pickUnrestRemoval() — this function
 * wraps it into an action.
 *
 * @param {Object} state
 * @param {string} power
 * @param {string|null} targetSpace - From decideWinterActions().unrestRemoval
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function makeFreeUnrestRemovalAction(state, power, targetSpace) {
  if (!targetSpace) return null;
  if (!isBotPower(state, power)) return null;

  return {
    actionType: ACTION_TYPES.CONTROL_UNFORTIFIED,
    actionData: {
      target: targetSpace,
      free: true,
      removeUnrest: true,
      forPower: power
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  F3.3 FORTRESS UNIT PLACEMENT ON NEGOTIATION/PEACE
// ═══════════════════════════════════════════════════════════════════════

/**
 * When a Bot gains control of a fortress through negotiations or suing
 * for peace, it moves a land unit to that fortification.
 *
 * §8: "Compensates for lack of strategic planning."
 *
 * @param {Object} state
 * @param {string} power - Bot power gaining the fortress
 * @param {string} spaceName - The fortress space gained
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function makeFortressGarrisonAction(state, power, spaceName) {
  if (!isBotPower(state, power)) return null;

  const sp = state.spaces[spaceName];
  if (!sp || !isFortified(sp)) return null;

  // Already has units there?
  const existing = getUnitsInSpace(state, spaceName, power);
  if (existing && countLandUnits(existing) > 0) return null;

  return {
    actionType: ACTION_TYPES.RAISE_REGULAR,
    actionData: {
      target: spaceName,
      free: true,
      count: 1,
      forPower: power,
      reason: 'fortress_garrison'
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  F3.4 EXTENDED EXCOMMUNICATION DEBATER RETURN
// ═══════════════════════════════════════════════════════════════════════

/**
 * Excommunicated debaters are not returned until end of the FOLLOWING turn
 * when played by a Bot (Papal Bull §6).
 *
 * §8: "Extended effect for Bot timing."
 *
 * @param {Object} state
 * @param {string} debaterId
 * @param {number} currentTurn
 */
export function registerExcommunicatedDebater(state, debaterId, currentTurn) {
  if (!state.botExcommunicatedDebaters) state.botExcommunicatedDebaters = [];
  state.botExcommunicatedDebaters.push({
    debaterId,
    returnTurn: currentTurn + 2 // End of following turn
  });
}

/**
 * Check if an excommunicated debater should be returned this turn.
 *
 * @param {Object} state
 * @param {string} debaterId
 * @param {number} currentTurn
 * @returns {boolean}
 */
export function shouldReturnExcommunicatedDebater(state, debaterId, currentTurn) {
  const entry = (state.botExcommunicatedDebaters || []).find(
    e => e.debaterId === debaterId
  );
  if (!entry) return true; // Not tracked → normal return timing
  return currentTurn >= entry.returnTurn;
}

/**
 * Clean up returned debater entries.
 *
 * @param {Object} state - Mutated
 * @param {number} currentTurn
 * @returns {string[]} Debater IDs that should now be returned
 */
export function processExcommunicatedDebaterReturns(state, currentTurn) {
  if (!state.botExcommunicatedDebaters) return [];

  const returning = state.botExcommunicatedDebaters.filter(
    e => currentTurn >= e.returnTurn
  );
  state.botExcommunicatedDebaters = state.botExcommunicatedDebaters.filter(
    e => currentTurn < e.returnTurn
  );
  return returning.map(e => e.debaterId);
}

// ═══════════════════════════════════════════════════════════════════════
//  F3.5 EXTENDED THREAT TO POWER
// ═══════════════════════════════════════════════════════════════════════

/**
 * When Threat to Power is played by a Bot, the leader is removed
 * for one additional turn.
 *
 * §8: "Leader removed for one additional turn when played by Bot."
 *
 * @param {Object} state
 * @param {string} leaderId
 * @param {number} currentTurn
 * @param {boolean} playedByBot
 * @returns {number} Turn on which the leader returns
 */
export function calcThreatToReturnTurn(state, leaderId, currentTurn, playedByBot) {
  // Normal: returns at end of current turn (turn + 1)
  // Bot: returns at end of following turn (turn + 2)
  return playedByBot ? currentTurn + 2 : currentTurn + 1;
}

/**
 * Track a Threat to Power removal.
 *
 * @param {Object} state - Mutated
 * @param {string} leaderId
 * @param {number} returnTurn
 */
export function registerThreatToLeader(state, leaderId, returnTurn) {
  if (!state.botThreatLeaders) state.botThreatLeaders = [];
  state.botThreatLeaders.push({ leaderId, returnTurn });
}

/**
 * Process leader returns from Threat to Power at turn start.
 *
 * @param {Object} state - Mutated
 * @param {number} currentTurn
 * @returns {string[]} Leader IDs to return
 */
export function processThreatLeaderReturns(state, currentTurn) {
  if (!state.botThreatLeaders) return [];

  const returning = state.botThreatLeaders.filter(
    e => currentTurn >= e.returnTurn
  );
  state.botThreatLeaders = state.botThreatLeaders.filter(
    e => currentTurn < e.returnTurn
  );
  return returning.map(e => e.leaderId);
}

// ═══════════════════════════════════════════════════════════════════════
//  F3.6 NO PHONY WAR PENALTY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Bots never take the Phony War -1 VP marker.
 *
 * §4.34 / §8: "Bot powers never take Phony War -1 VP marker."
 *
 * @param {Object} state
 * @param {string} power
 * @returns {boolean} True if this power is exempt from Phony War penalty
 */
export function isExemptFromPhonyWar(state, power) {
  return isBotPower(state, power);
}

// ═══════════════════════════════════════════════════════════════════════
//  F4 FINAL AUTUMN ASSAULTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get the next final autumn assault action for a Bot power.
 *
 * Called at the end of the Action Phase when a Bot has played all cards.
 * Returns one assault at a time (caller should loop until null).
 *
 * §2.10.3: "Free assaults at end of Action Phase on all active sieges
 * and eligible foreign wars."
 *
 * @param {Object} state
 * @param {string} power
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function getNextAutumnAssault(state, power) {
  if (!isBotPower(state, power)) return null;

  // Track which assaults have been executed
  const done = state.botAutumnAssaultsDone?.[power] || [];
  const assaults = getFinalAutumnAssaults(state, power);

  for (const assault of assaults) {
    const key = assault.actionData.target;
    if (!done.includes(key)) {
      // Mark as pending (caller must mark done after execution)
      return assault;
    }
  }

  return null;
}

/**
 * Mark an autumn assault as completed.
 *
 * @param {Object} state - Mutated
 * @param {string} power
 * @param {string} target
 */
export function markAutumnAssaultDone(state, power, target) {
  if (!state.botAutumnAssaultsDone) state.botAutumnAssaultsDone = {};
  if (!state.botAutumnAssaultsDone[power]) state.botAutumnAssaultsDone[power] = [];
  state.botAutumnAssaultsDone[power].push(target);
}

/**
 * Reset autumn assault tracking (call at start of Action Phase).
 *
 * @param {Object} state - Mutated
 */
export function resetAutumnAssaults(state) {
  state.botAutumnAssaultsDone = {};
}

// ═══════════════════════════════════════════════════════════════════════
//  F5 DIFFICULTY SETTINGS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Bot difficulty levels.
 *
 * §2.2: "Optional difficulty: Deal one additional card to each Bot power
 * beginning with turn 4. For even more challenge, start dealing additional
 * cards on turn 1."
 */
export const BOT_DIFFICULTY = {
  NORMAL: 'normal',       // No extra cards
  HARD: 'hard',           // +1 card from Turn 4
  EXPERT: 'expert'        // +1 card from Turn 1
};

/**
 * Calculate extra cards to deal to a Bot power this turn.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {number} Extra cards (0 or 1)
 */
export function getExtraCardCount(state, power) {
  if (!isBotPower(state, power)) return 0;

  const difficulty = state.botDifficulty || BOT_DIFFICULTY.NORMAL;
  const turn = state.turn || 1;

  switch (difficulty) {
    case BOT_DIFFICULTY.EXPERT:
      return 1; // +1 every turn
    case BOT_DIFFICULTY.HARD:
      return turn >= 4 ? 1 : 0; // +1 from Turn 4 onward
    default:
      return 0;
  }
}

/**
 * Initialize Bot difficulty on game state.
 *
 * @param {Object} state - Mutated
 * @param {string} [difficulty='normal']
 */
export function initBotDifficulty(state, difficulty = BOT_DIFFICULTY.NORMAL) {
  state.botDifficulty = difficulty;
}

// ═══════════════════════════════════════════════════════════════════════
//  TURN START/END HOOKS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Process all Bot turn-start housekeeping.
 * Call at the beginning of each turn.
 *
 * - Expire extended events
 * - Return excommunicated debaters
 * - Return Threat to Power leaders
 * - Reset +1 CP tokens
 * - Reset autumn assault tracking
 *
 * @param {Object} state - Mutated
 * @returns {{ expiredEvents: Array, returnedDebaters: string[], returnedLeaders: string[] }}
 */
export function processBotTurnStart(state) {
  const currentTurn = state.turn || 1;

  const expiredEvents = expireExtendedEvents(state, currentTurn);
  const returnedDebaters = processExcommunicatedDebaterReturns(state, currentTurn);
  const returnedLeaders = processThreatLeaderReturns(state, currentTurn);

  // Reset +1 CP tokens at turn start
  if (state.botCpTokens) {
    for (const power of getBotPowers(state)) {
      state.botCpTokens[power] = 0;
    }
  }

  // Reset autumn assault tracking for new turn
  resetAutumnAssaults(state);

  return { expiredEvents, returnedDebaters, returnedLeaders };
}
