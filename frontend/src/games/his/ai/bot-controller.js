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
import {
  getPowerForPlayer, getPowersForPlayer,
  isValidReformationTarget, isValidCounterReformTarget, isTwoPlayer
} from '../state/state-helpers.js';
import { canActInSegment } from '../phases/phase-diplomacy.js';
import { getDiplomacy2PActor } from '../phases/phase-diplomacy-2p.js';
import { decideDiplomacy2P } from './bot-diplomacy-2p.js';
import {
  BEHAVIOR_CARDS, CARD_BY_ID, BOT_EXTRA_UNITS,
  initBotDeck, revealBehaviorCard, getActiveBehaviorCard
} from './behavior-cards.js';
import {
  stackBotHand, pickDietOfWormsCard,
  decideSpringDeployment as decideSpringDeploy,
  decideWarDeclaration, shouldSueForPeace,
  shouldRansomLeader, shouldGrantCardToRescind,
  decideWinterActions
} from './bot-phases.js';
import { areAtWar, getWarsOf } from '../state/war-helpers.js';
import {
  decideCardPlay as routeCardPlay,
  decideResponsePlay, getFinalAutumnAssaults
} from './bot-card-play.js';
import { dispatchGoalAction } from './bot-goals.js';
import { decideBattleAction, decideInterceptionAction } from './bot-combat.js';
import {
  getNextAutumnAssault, markAutumnAssaultDone,
  processBotTurnStart, getExtraCardCount, initBotDifficulty,
  BOT_DIFFICULTY
} from './bot-rules.js';

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

/**
 * Full Bot initialization: decks, extra units, difficulty.
 *
 * @param {Object} state - Game state (mutated)
 * @param {string[]} botPowerIds - Powers played by Bots
 * @param {string} [difficulty='normal'] - Bot difficulty level
 */
export function initBotGame(state, botPowerIds, difficulty = 'normal') {
  initBotDecks(state, botPowerIds);
  placeBotExtraUnits(state);
  initBotDifficulty(state, difficulty);
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
      return isTwoPlayer(state)
        ? decideDiplomacy2P(state, power)
        : decideDiplomacy(state, power);

    case PHASES.DIET_OF_WORMS:
      return decideDietOfWorms(state, power);

    case PHASES.SPRING_DEPLOYMENT:
      return decideSpringDeployment(state, power);

    case PHASES.ACTION:
      return decideAction(state, power);

    case PHASES.WINTER:
      return decideWinter(state, power);

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

  const pending = state.pendingLuther95;
  if (!pending) return { actionType: ACTION_TYPES.PHASE_ADVANCE, actionData: {} };

  // All attempts used or no valid targets left
  if (pending.attemptNumber >= pending.attemptsTotal ||
      (pending.validTargets || []).length === 0) {
    return { actionType: ACTION_TYPES.PHASE_ADVANCE, actionData: {} };
  }

  // Pick first available target
  const targets = pending.validTargets || [];
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
      // England exception: delays to Action Phase first impulse via home card
      if (shouldDeclare && isEnglandHomeCard && target) {
        state.englandHomeCardWar = target;
      }
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
  // isInCpMode === cpRemaining > 0 || activeCardNumber !== null
  if (state.cpRemaining > 0 || state.activeCardNumber != null) {
    if (state.cpRemaining > 0) {
      const goalAction = decideGoalAction(state, power);
      if (goalAction) return goalAction;
    }
    // No goals to execute (or cpRemaining === 0 but card still active) — end impulse
    return { actionType: ACTION_TYPES.END_IMPULSE, actionData: {} };
  }

  // Not in CP mode: play next card
  const cardAction = decideCardPlay(state, power);

  // If card play is null or PASS → check final autumn assaults before ending
  if (!cardAction || cardAction.actionType === ACTION_TYPES.PASS) {
    const assault = getNextAutumnAssault(state, power);
    if (assault) {
      markAutumnAssaultDone(state, power, assault.actionData.target);
      return assault;
    }
    // Ensure we always return a valid action so the bot chain continues
    return cardAction || { actionType: ACTION_TYPES.PASS, actionData: {} };
  }

  return cardAction;
}

/**
 * Winter Phase: Bot free unrest removal (§2.11 / §8).
 *
 * Most winter actions are automatic; Bot gets one free unrest removal.
 *
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideWinter(state, power) {
  if (state.activePower && state.activePower !== power) return null;

  // Check if Bot has already removed unrest this turn
  if (state.botWinterUnrestDone?.[power]) return null;

  const winter = decideWinterActions(state, power);

  if (winter.unrestRemoval) {
    return {
      actionType: ACTION_TYPES.CONTROL_UNFORTIFIED,
      actionData: {
        target: winter.unrestRemoval,
        free: true,
        removeUnrest: true,
        forPower: power
      }
    };
  }

  return null;
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
  return decideBattleAction(state, power);
}

/**
 * Interception decision.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideInterception(state, power) {
  return decideInterceptionAction(state, power);
}

/**
 * Reformation attempt target selection.
 * Picks the first valid target space respecting zone and type constraints.
 * @param {Object} state
 * @param {string} power
 * @returns {Object|null}
 */
function decideReformation(state, power) {
  const pending = state.pendingReformation;
  if (!pending) return null;

  // Engine rejects RESOLVE_REFORMATION_ATTEMPT once attempts are exhausted
  // (religious-actions.js validateReformationAttempt — both field names
  // attemptsLeft / attemptsRemaining are supported). Skip up front so the
  // bot doesn't burn an impulse on a guaranteed-invalid action.
  const attemptsLeft = pending.attemptsLeft ?? pending.attemptsRemaining ?? 0;
  if (attemptsLeft <= 0) {
    return { actionType: ACTION_TYPES.END_IMPULSE, actionData: {} };
  }

  const isCounterRef = pending.type === 'counter_reformation';
  const zoneFilter = (pending.zone || (pending.zones !== 'all' ? pending.zones : null));

  // Find a valid target using engine's adjacency validator
  for (const [name, sp] of Object.entries(state.spaces)) {
    if (zoneFilter && sp.languageZone !== zoneFilter) continue;
    const valid = isCounterRef
      ? isValidCounterReformTarget(state, name)
      : isValidReformationTarget(state, name);
    if (!valid) continue;
    return {
      actionType: ACTION_TYPES.RESOLVE_REFORMATION_ATTEMPT,
      actionData: { targetSpace: name }
    };
  }

  // No valid targets remain — clear pending and end impulse
  return { actionType: ACTION_TYPES.END_IMPULSE, actionData: {} };
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

    const pid = botPlayerId(nextPower);

    // ── Behavior card reveal + hand stacking (once per turn, at action phase) ─
    // HISBOT §2.10: At the start of each turn's action phase, each Bot reveals
    // the next card from their behavior card deck. Also re-stacks the hand.
    if (currentState.phase === PHASES.ACTION) {
      const deck = currentState.botDecks?.[nextPower];
      if (deck) {
        const revealedTurn = currentState.botBehaviorCardRevealedTurn?.[nextPower] || 0;
        if (revealedTurn < (currentState.turn || 1)) {
          revealBehaviorCard(deck);
          if (currentState.hands?.[nextPower]) {
            stackBotHand(currentState.hands[nextPower], nextPower);
          }
          if (!currentState.botBehaviorCardRevealedTurn) currentState.botBehaviorCardRevealedTurn = {};
          currentState.botBehaviorCardRevealedTurn[nextPower] = currentState.turn || 1;
        }
      }
    }

    // Decide action — wrap in try/catch so a crash in AI logic never kills the chain.
    let action;
    try {
      action = decideBotAction(currentState, nextPower);

      // SET_ASIDE_CARD is bot-internal: move card from hand to botSetAside,
      // then re-decide the next card to play.
      let setAsideLoops = 0;
      while (action?.actionType === 'SET_ASIDE_CARD' && setAsideLoops++ < 10) {
        const cardNumber = action.actionData?.cardNumber;
        if (cardNumber != null) {
          const hand = currentState.hands?.[nextPower];
          if (hand) {
            const idx = hand.indexOf(cardNumber);
            if (idx !== -1) hand.splice(idx, 1);
          }
          if (!currentState.botSetAside) currentState.botSetAside = {};
          if (!currentState.botSetAside[nextPower]) currentState.botSetAside[nextPower] = [];
          currentState.botSetAside[nextPower].push(cardNumber);
        }
        action = decideBotAction(currentState, nextPower);
      }
    } catch (err) {
      console.error('[BOT CRASH]', nextPower, err.message, err.stack?.split('\n')[1] || '');
      action = null;
    }

    // If no action decided, fall back to PASS to keep the chain alive
    if (!action || action.actionType === 'SET_ASIDE_CARD') {
      action = { actionType: ACTION_TYPES.PASS, actionData: {} };
    }

    // ── Goal count tracking ─────────────────────────────────────────
    // Playing a card starts a new CP impulse — reset goal execution counts.
    if (action.actionType === ACTION_TYPES.PLAY_CARD_CP ||
        action.actionType === ACTION_TYPES.PLAY_CARD_EVENT) {
      if (!currentState.botGoalCounts) currentState.botGoalCounts = {};
      currentState.botGoalCounts[nextPower] = {};
    }
    // Executing a goal — increment count so max-caps are respected.
    if (action.goalId) {
      if (!currentState.botGoalCounts) currentState.botGoalCounts = {};
      if (!currentState.botGoalCounts[nextPower]) currentState.botGoalCounts[nextPower] = {};
      currentState.botGoalCounts[nextPower][action.goalId] =
        (currentState.botGoalCounts[nextPower][action.goalId] || 0) + 1;
    }

    // If playing from set-aside, move card back to hand so engine validation passes
    if (action.actionData?.fromSetAside) {
      const cardNumber = action.actionData.cardNumber;
      const setAside = currentState.botSetAside?.[nextPower];
      if (setAside && cardNumber != null) {
        const idx = setAside.indexOf(cardNumber);
        if (idx !== -1) setAside.splice(idx, 1);
        if (!currentState.hands[nextPower]) currentState.hands[nextPower] = [];
        currentState.hands[nextPower].push(cardNumber);
      }
      // Remove the fromSetAside flag — engine doesn't know about it
      delete action.actionData.fromSetAside;
    }

    // Stash the about-to-happen MOVE_FORMATION so advance logic can reject
    // an immediate reverse (prevents Antwerp↔Liege shuttle). Must be set
    // BEFORE executeMove: processMove deep-clones state into the new state,
    // so post-move mutations to `currentState` would be silently dropped.
    if (action.actionType === ACTION_TYPES.MOVE_FORMATION &&
        action.actionData?.from && action.actionData?.to) {
      if (!currentState.botLastMoves) currentState.botLastMoves = {};
      currentState.botLastMoves[nextPower] = {
        from: action.actionData.from,
        to: action.actionData.to
      };
    }

    const move = { ...action, playerId: pid };
    const result = executeMove(move);
    if (result?.success) return;

    // Benign hand desync (#T): the chosen card is no longer in the engine's
    // hand (e.g. the power's home card was already played this turn but a
    // different 'home'-deck card like "Here I Stand" was selected). The root
    // cause is fixed in routeHomeCard; this is a safety net for any residual
    // desync — purge the phantom from bot bookkeeping and re-decide once,
    // quietly, before treating it as stuck.
    if (result?.error === 'Card not in hand') {
      const phantom = action.actionData?.cardNumber;
      if (phantom != null) {
        const sa = currentState.botSetAside?.[nextPower];
        if (sa) { const i = sa.indexOf(phantom); if (i !== -1) sa.splice(i, 1); }
      }
      const retry = decideBotAction(currentState, nextPower);
      if (retry && retry.actionType !== 'SET_ASIDE_CARD' &&
          retry.actionType !== ACTION_TYPES.PASS) {
        const r = executeMove({ ...retry, playerId: pid });
        if (r?.success) return;
      }
      // Quiet recovery did not land — fall through to the standard chain.
    }

    console.warn('[BOT STUCK]', nextPower, action.actionType,
      JSON.stringify(action.actionData).substring(0, 100), '→', result?.error);

    // Primary action failed — try fallback chain
    const cardNum = action.actionData?.cardNumber;

    // 0) If stuck inside a response window, decline and let the active power continue
    if (currentState.pendingResponse?.respondingPower === nextPower) {
      const dr = executeMove({ actionType: ACTION_TYPES.DECLINE_RESPONSE, actionData: {}, playerId: pid });
      if (dr?.success) return;
      console.warn('[BOT STUCK] DECLINE_RESPONSE failed:', dr?.error);
    }

    // 1) Event failed → try as CP
    if (action.actionType === ACTION_TYPES.PLAY_CARD_EVENT && cardNum != null) {
      const r = executeMove({ actionType: ACTION_TYPES.PLAY_CARD_CP, actionData: { cardNumber: cardNum }, playerId: pid });
      if (r?.success) return;
      console.warn('[BOT STUCK] CP fallback failed:', r?.error);
    }

    // 2) CP failed → try as Event
    if (action.actionType === ACTION_TYPES.PLAY_CARD_CP && cardNum != null) {
      const r = executeMove({ actionType: ACTION_TYPES.PLAY_CARD_EVENT, actionData: { cardNumber: cardNum }, playerId: pid });
      if (r?.success) return;
      console.warn('[BOT STUCK] Event fallback failed:', r?.error);
    }

    // 3) Try any card in hand (including set-aside) as CP
    const hand = currentState.hands?.[nextPower] || [];
    const setAsideCards = currentState.botSetAside?.[nextPower] || [];
    // Move all set-aside cards back to hand for fallback attempts
    if (setAsideCards.length > 0 && hand.length === 0) {
      hand.push(...setAsideCards);
      setAsideCards.length = 0;
    }
    for (const cn of hand) {
      if (cn === cardNum) continue; // Already tried
      const r = executeMove({ actionType: ACTION_TYPES.PLAY_CARD_CP, actionData: { cardNumber: cn }, playerId: pid });
      if (r?.success) return;
    }

    // 4) Try END_IMPULSE to escape CP mode
    if (currentState.cpRemaining > 0 || currentState.activeCardNumber != null) {
      const r = executeMove({ actionType: ACTION_TYPES.END_IMPULSE, actionData: {}, playerId: pid });
      if (r?.success) return;
      console.warn('[BOT STUCK] END_IMPULSE failed:', r?.error);
    }

    // 5) Last resort: PASS
    if (action.actionType !== ACTION_TYPES.PASS) {
      const pr = executeMove({ actionType: ACTION_TYPES.PASS, actionData: {}, playerId: pid });
      if (pr?.success) return;
      console.warn('[BOT STUCK] PASS also failed:', pr?.error, 'hand:', JSON.stringify(hand));
    }

    // All fallbacks exhausted — the chain is broken. Log a clear error so the bug
    // can be identified and fixed. Re-kick with a longer delay to avoid tight loops.
    console.error('[BOT CHAIN BROKEN]', nextPower,
      'phase:', currentState.phase,
      'cpRemaining:', currentState.cpRemaining,
      'hand:', JSON.stringify(hand),
      'pending:', JSON.stringify({
        response: !!currentState.pendingResponse,
        battle: !!currentState.pendingBattle,
        reformation: !!currentState.pendingReformation,
        debate: !!currentState.pendingDebate,
      })
    );
    // Force-kick chain with delay so the player can observe the stuck state
    setTimeout(() => executeMove({ actionType: ACTION_TYPES.PASS, actionData: {}, playerId: pid }), delay * 3);
  }, delay);
}

/**
 * Determine which Bot power should act next.
 * @param {Object} state
 * @returns {string|null}
 */
function getNextActingBotPower(state) {
  // Game over — no one acts. An immediate victory can end the game mid-action
  // phase (status='ended' while phase is still 'action'); without this guard the
  // chain keeps scheduling, the trailing move fails "Game is not running", and a
  // spurious [BOT CHAIN BROKEN] is logged.
  if (state.status && state.status !== 'playing') return null;

  // Response window: check if responding power is a Bot
  if (state.pendingResponse) {
    const rp = state.pendingResponse.respondingPower;
    return isBotPower(state, rp) ? rp : null;
  }

  // Phases with activePower — only ACTION and SPRING_DEPLOYMENT use sequential turns
  if (state.activePower && isBotPower(state, state.activePower) &&
      (state.phase === PHASES.ACTION || state.phase === PHASES.SPRING_DEPLOYMENT)) {
    return state.activePower;
  }

  // Two-player Diplomacy phase (§9): the actor is the Remove-At-War Papacy or
  // the head of the play queue (getDiplomacy2PActor), not a standard segment.
  if (state.phase === PHASES.DIPLOMACY && isTwoPlayer(state)) {
    const actor = getDiplomacy2PActor(state);
    return actor && isBotPower(state, actor) ? actor : null;
  }

  // Simultaneous phases (diplomacy, diet)
  if (state.phase === PHASES.DIPLOMACY) {
    // Find first Bot that hasn't acted and can act in current segment
    for (const power of IMPULSE_ORDER) {
      if (isBotPower(state, power) &&
          !state.diplomacyActed?.[power] &&
          canActInSegment(state, power)) {
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
