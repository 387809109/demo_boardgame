/**
 * Here I Stand — Bot Controller
 *
 * Top-level coordinator that drives Bot powers through each game phase.
 * Generates standard {actionType, actionData} moves identical to human
 * players, processed through the same validateMove/processMove pipeline.
 *
 * Based on HISBOT v1.1 (Russ Brown).
 */

import { MAJOR_POWERS, IMPULSE_ORDER } from '../constants.js';
import { PHASES } from '../phases/phase-manager.js';
import { ACTION_TYPES } from '../actions/action-types.js';
import { getPowerForPlayer, getPowersForPlayer } from '../state/state-helpers.js';
import {
  BEHAVIOR_CARDS, CARD_BY_ID, BOT_EXTRA_UNITS,
  initBotDeck, revealBehaviorCard, getActiveBehaviorCard
} from './behavior-cards.js';
import {
  stackBotHand, pickDietOfWormsCard,
  decideSpringDeployment as decideSpringDeploy,
  decideWarDeclaration, shouldSueForPeace,
  shouldRansomLeader, shouldGrantCardToRescind
} from './bot-phases.js';
import { areAtWar, getWarsOf } from '../state/war-helpers.js';
import {
  decideCardPlay as routeCardPlay,
  decideResponsePlay, getFinalAutumnAssaults
} from './bot-card-play.js';
import { dispatchGoalAction } from './bot-goals.js';

// ── Bot Identification ─────────────────────────────────────────────

/**
 * Check if a power is controlled by a Bot.
 * @param {Object} state - Game state
 * @param {string} power - Power id
 * @returns {boolean}
 */
export function isBotPower(state, power) {
  return !!state.botPowers?.[power];
}

/**
 * Get all powers controlled by Bots.
 * @param {Object} state
 * @returns {string[]}
 */
export function getBotPowers(state) {
  if (!state.botPowers) return [];
  return MAJOR_POWERS.filter(p => state.botPowers[p]);
}

/**
 * Get the Bot's virtual player ID for a power.
 * @param {string} power
 * @returns {string}
 */
export function botPlayerId(power) {
  return `bot_${power}`;
}

// ── Bot Deck State ─────────────────────────────────────────────────

/**
 * Initialize bot deck state for all bot powers.
 * Called during game setup after determining which powers are Bots.
 *
 * @param {Object} state - Game state (mutated)
 * @param {string[]} botPowerIds - Powers played by Bots
 */
export function initBotDecks(state, botPowerIds) {
  state.botDecks = state.botDecks || {};
  state.botPowers = state.botPowers || {};

  for (const power of botPowerIds) {
    state.botPowers[power] = true;
    state.botDecks[power] = initBotDeck(power);
  }
}

/**
 * Place extra starting unit for each Bot power (§1.3).
 * Adds one regular to the specified space, merging into existing stack
 * for that power if present.
 *
 * @param {Object} state - Game state (mutated)
 */
export function placeBotExtraUnits(state) {
  for (const power of getBotPowers(state)) {
    const info = BOT_EXTRA_UNITS[power];
    if (!info) continue;

    const space = state.spaces[info.space];
    if (!space) continue;
    if (!space.units) space.units = [];

    // Try to merge into existing stack for this power
    const existing = space.units.find(u => u.owner === power);
    if (existing) {
      existing.regulars = (existing.regulars || 0) + 1;
    } else {
      space.units.push({
        owner: power,
        regulars: 1,
        mercenaries: 0,
        cavalry: 0,
        squadrons: 0,
        corsairs: 0,
        leaders: []
      });
    }
  }
}

// ── Main Decision Engine ───────────────────────────────────────────

/**
 * Determine the next action for a Bot power given the current state.
 * Returns null if the Bot has no action to take.
 *
 * @param {Object} state - Current game state
 * @param {string} power - The Bot power to act for
 * @returns {{ actionType: string, actionData: Object }|null}
 */
export function decideBotAction(state, power) {
  if (!isBotPower(state, power)) return null;

  switch (state.phase) {
    case PHASES.LUTHER_95:
      return decideLuther95(state, power);

    case PHASES.CARD_DRAW:
      return null; // Card draw is automatic

    case PHASES.DIPLOMACY:
      return decideDiplomacy(state, power);

    case PHASES.DIET_OF_WORMS:
      return decideDietOfWorms(state, power);

    case PHASES.SPRING_DEPLOYMENT:
      return decideSpringDeployment(state, power);

    case PHASES.ACTION:
      return decideAction(state, power);

    case PHASES.WINTER:
      return null; // Winter is automatic

    case PHASES.NEW_WORLD:
      return null; // New World is automatic

    case PHASES.VICTORY_DETERMINATION:
      return null;

    default:
      return null;
  }
}

// ── Phase Decision Stubs ───────────────────────────────────────────
// Each returns {actionType, actionData} or null.
// Full logic implemented in Phase B/C/D.

/**
 * Luther's 95 Theses: Bot Protestant selects reformation targets.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideLuther95(state, power) {
  if (power !== 'protestant') return null;
  if (state.phase !== PHASES.LUTHER_95) return null;

  // Check if there are remaining attempts
  const pending = state.luther95;
  if (!pending || pending.remaining <= 0) {
    return { actionType: ACTION_TYPES.PHASE_ADVANCE, actionData: {} };
  }

  // Pick first available target (stub — Phase B will add smart targeting)
  const targets = pending.targets || [];
  if (targets.length > 0) {
    return {
      actionType: ACTION_TYPES.SELECT_LUTHER95_TARGET,
      actionData: { targetSpace: targets[0] }
    };
  }

  return { actionType: ACTION_TYPES.PHASE_ADVANCE, actionData: {} };
}

/**
 * Diplomacy: Bot handles war declarations, peace, negotiation, ransom,
 * excommunication segments.
 *
 * HISBOT §2.3-§2.7 logic routed by diplomacySegment.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideDiplomacy(state, power) {
  const segment = state.diplomacySegment;

  // Already acted in this segment?
  if (state.diplomacyActed?.[power]) return null;

  switch (segment) {
    case 'sue_for_peace': {
      // Check all enemies — sue for peace if conditions met
      const enemies = getWarsOf(state, power);
      for (const enemy of enemies) {
        if (shouldSueForPeace(state, power, enemy)) {
          return {
            actionType: ACTION_TYPES.SUE_FOR_PEACE,
            actionData: { target: enemy, forPower: power }
          };
        }
      }
      return { actionType: ACTION_TYPES.PASS, actionData: { forPower: power } };
    }

    case 'ransom': {
      const { shouldRansom, leaderId } = shouldRansomLeader(state, power);
      if (shouldRansom && leaderId) {
        return {
          actionType: ACTION_TYPES.RANSOM_LEADER,
          actionData: { leaderId, forPower: power }
        };
      }
      return { actionType: ACTION_TYPES.PASS, actionData: { forPower: power } };
    }

    case 'excommunication': {
      if (shouldGrantCardToRescind(state, power)) {
        return {
          actionType: ACTION_TYPES.REMOVE_EXCOMMUNICATION,
          actionData: { forPower: power, grantCard: true }
        };
      }
      return { actionType: ACTION_TYPES.PASS, actionData: { forPower: power } };
    }

    case 'declarations_of_war': {
      const { shouldDeclare, target, isEnglandHomeCard } = decideWarDeclaration(state, power);
      // England exception: delays to Action Phase first impulse
      if (shouldDeclare && !isEnglandHomeCard && target) {
        return {
          actionType: ACTION_TYPES.DECLARE_WAR,
          actionData: { target, forPower: power }
        };
      }
      return { actionType: ACTION_TYPES.PASS, actionData: { forPower: power } };
    }

    case 'negotiation':
    default:
      // Bot-to-Bot deals are resolved automatically (not via actions).
      // Human-to-Bot proposals evaluated via bot-negotiation.js (UI-driven).
      return { actionType: ACTION_TYPES.PASS, actionData: { forPower: power } };
  }
}

/**
 * Diet of Worms: Bot submits a card.
 *
 * HISBOT §2.8: Flip top card of hand deck.
 * If mandatory event or 1 CP → use Home card instead.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideDietOfWorms(state, power) {
  const validPowers = ['protestant', 'hapsburg', 'papacy'];
  if (!validPowers.includes(power)) return null;

  // Already submitted?
  if (state.pendingDietOfWorms?.cards[power] != null) return null;

  const hand = state.hands[power] || [];
  if (hand.length === 0) return null;

  const pick = pickDietOfWormsCard(state, power);
  if (!pick) return null;

  return {
    actionType: ACTION_TYPES.SUBMIT_DIET_CARD,
    actionData: { cardNumber: pick.cardNumber, forPower: power }
  };
}

/**
 * Spring Deployment: Bot deploys units.
 *
 * HISBOT §2.9: At war → deploy formation toward enemy key.
 * At peace → move single unit to weakest controlled key.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideSpringDeployment(state, power) {
  if (state.activePower !== power) return null;
  if (state.springDeploymentDone?.[power]) return null;

  const deploy = decideSpringDeploy(state, power);
  if (deploy) return deploy;

  return { actionType: ACTION_TYPES.PASS, actionData: {} };
}

/**
 * Action Phase: Bot plays cards and executes goals.
 * This is the most complex decision — routes through:
 * 1. Pending interactions (response cards, battles, retreats)
 * 2. Card play (Home, Event, CP)
 * 3. Goal execution within CP mode
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideAction(state, power) {
  // Response windows can involve non-active powers
  if (state.pendingResponse) {
    return decideResponse(state, power);
  }

  if (state.activePower !== power) return null;
  if (state.pendingBattle) {
    return decideBattle(state, power);
  }
  if (state.pendingInterception) {
    return decideInterception(state, power);
  }
  if (state.pendingReformation) {
    return decideReformation(state, power);
  }
  if (state.pendingDebate) {
    return decideDebate(state, power);
  }

  // In CP mode: execute next goal from behavior card
  if (state.cpRemaining > 0) {
    return decideGoalAction(state, power);
  }

  // Not in CP mode: play next card or pass
  return decideCardPlay(state, power);
}

// ── Sub-Decision Stubs ─────────────────────────────────────────────

/**
 * Response card decision: play or decline.
 *
 * HISBOT §5 + §2.10: Check set-aside Combat/Response cards.
 * Only play if it could change the state of the game.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideResponse(state, power) {
  const respPower = state.pendingResponse?.respondingPower;
  if (respPower && isBotPower(state, respPower)) {
    return decideResponsePlay(state, respPower);
  }
  return null;
}

/**
 * Battle decision: resolve, retreat, withdraw.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideBattle(state, power) {
  // Stub: auto-resolve
  // Full implementation in Phase E3
  if (state.pendingBattle?.type === 'retreat_choice') {
    return { actionType: ACTION_TYPES.RESOLVE_RETREAT, actionData: { retreat: false } };
  }
  if (state.pendingBattle?.canWithdraw) {
    return { actionType: ACTION_TYPES.WITHDRAW_INTO_FORTIFICATION, actionData: {} };
  }
  return { actionType: ACTION_TYPES.RESOLVE_BATTLE, actionData: {} };
}

/**
 * Interception decision.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideInterception(state, power) {
  // Stub: decline interception
  // Full implementation in Phase E3
  return {
    actionType: ACTION_TYPES.RESOLVE_INTERCEPTION,
    actionData: { intercept: false }
  };
}

/**
 * Reformation attempt target selection.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideReformation(state, power) {
  // Stub: auto-resolve
  return {
    actionType: ACTION_TYPES.RESOLVE_REFORMATION_ATTEMPT,
    actionData: {}
  };
}

/**
 * Debate step resolution.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideDebate(state, power) {
  return {
    actionType: ACTION_TYPES.RESOLVE_DEBATE_STEP,
    actionData: {}
  };
}

/**
 * Card play decision: choose which card to play and how.
 *
 * HISBOT §2.10: Flip top card from hand deck and route:
 *   Home → §6 criteria → event or CPs
 *   Event → §5 criteria → event, Treaty, Gang Up, or CPs
 *   Mandatory → play event + spend remaining CPs
 *   Combat/Response → set aside or play if §5 criteria met
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideCardPlay(state, power) {
  return routeCardPlay(state, power);
}

/**
 * Goal execution within CP mode. Iterates behavior card priority list.
 *
 * HISBOT §3: Walk behavior card goal priorities, find first executable
 * goal with remaining CPs. Track execution counts per impulse via
 * state.botGoalCounts[power].
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideGoalAction(state, power) {
  return dispatchGoalAction(state, power);
}

// ── Bot Action Scheduler ───────────────────────────────────────────

/** Default delay between Bot actions (ms) */
const BOT_ACTION_DELAY = 800;

/**
 * Schedule the next Bot action if the active power is a Bot.
 * Called after each processMove to check if the next actor is a Bot.
 *
 * @param {Object} game - HISGame instance
 * @param {Function} executeMove - Function to execute a move: (move) => void
 * @param {number} [delay=800] - Delay in ms before Bot acts
 * @returns {number|null} Timer ID if scheduled, null otherwise
 */
export function scheduleBotAction(game, executeMove, delay = BOT_ACTION_DELAY) {
  const state = game.getState();
  if (!state) return null;

  // Determine which power needs to act next
  const nextPower = getNextActingBotPower(state);
  if (!nextPower) return null;

  return setTimeout(() => {
    const currentState = game.getState();
    if (!currentState) return;

    const action = decideBotAction(currentState, nextPower);
    if (action) {
      executeMove({
        ...action,
        playerId: botPlayerId(nextPower)
      });
    }
  }, delay);
}

/**
 * Determine which Bot power should act next.
 * @param {Object} state
 * @returns {string|null}
 */
function getNextActingBotPower(state) {
  // Response window: check if responding power is a Bot
  if (state.pendingResponse) {
    const rp = state.pendingResponse.respondingPower;
    return isBotPower(state, rp) ? rp : null;
  }

  // Phases with activePower (action, spring deployment)
  if (state.activePower && isBotPower(state, state.activePower)) {
    return state.activePower;
  }

  // Simultaneous phases (diplomacy, diet)
  if (state.phase === PHASES.DIPLOMACY) {
    // Find first Bot that hasn't acted in current segment
    for (const power of IMPULSE_ORDER) {
      if (isBotPower(state, power)) {
        // Check if this Bot can still act (stub — needs segment tracking)
        return power;
      }
    }
  }

  if (state.phase === PHASES.DIET_OF_WORMS) {
    const pending = state.pendingDietOfWorms;
    if (pending) {
      for (const power of ['protestant', 'hapsburg', 'papacy']) {
        if (isBotPower(state, power) && pending.cards[power] == null) {
          return power;
        }
      }
    }
  }

  // Luther 95: Protestant Bot
  if (state.phase === PHASES.LUTHER_95 && isBotPower(state, 'protestant')) {
    return 'protestant';
  }

  return null;
}
