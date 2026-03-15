/**
 * Here I Stand — Game Implementation
 * @module games/his
 */

import { GameEngine } from '../../game/engine.js';
import config from './config.json';
import { MAJOR_POWERS, VICTORY } from './constants.js';
import { buildInitialState } from './state/state-init.js';
import { getVisibleState } from './state/state-visible.js';
import { getPowerForPlayer, canPass, isFortified } from './state/state-helpers.js';
import {
  PHASES, transitionPhase, advancePhase, advanceImpulse
} from './phases/phase-manager.js';
import { CARD_BY_NUMBER } from './data/cards.js';
import {
  ACTION_TYPES, isCpAction, isSubAction
} from './actions/action-types.js';
import {
  startCpSpending, endCpSpending, isInCpMode, hasPendingInteraction
} from './actions/cp-manager.js';

// Military actions
import {
  validateMoveFormation, moveFormation,
  validateRaiseRegular, raiseRegular,
  validateBuyMercenary, buyMercenary,
  validateRaiseCavalry, raiseCavalry,
  validateBuildSquadron, buildSquadron,
  validateBuildCorsair, buildCorsair,
  validateControlUnfortified, controlUnfortified
} from './actions/military-actions.js';

// Religious actions
import {
  validatePublishTreatise, publishTreatise,
  validateBurnBooks, burnBooks,
  validateReformationAttempt, resolveReformationAttempt,
  validateTranslateScripture, translateScripture,
  validateBuildStPeters, buildStPeters,
  validateFoundJesuit, foundJesuit
} from './actions/religious-actions.js';

// Debate actions
import {
  validateCallDebate, callDebate,
  validateDebateStep, resolveDebateStep,
  validateDebateFlip, resolveDebateFlip
} from './actions/debate-actions.js';

// Combat actions
import { resolveFieldBattle } from './actions/combat-actions.js';
import {
  validateAssault, executeAssault
} from './actions/siege-actions.js';
import {
  validateNavalMove, executeNavalMove,
  validatePiracy, executePiracy
} from './actions/naval-actions.js';
import { resolveInterception } from './actions/interception.js';
import {
  executeRetreat, eliminateFormation
} from './actions/retreat.js';

// Diplomacy actions
import {
  validateDOW, executeDOW,
  validateSueForPeace, executeSueForPeace,
  validateNegotiate, executeNegotiate,
  validateRansom, executeRansom
} from './actions/diplomacy-actions.js';
import {
  canActInSegment, markActed, allActedInSegment,
  advanceDiplomacySegment, isDiplomacyComplete
} from './phases/phase-diplomacy.js';
import {
  validateSpringDeployment, executeSpringDeployment,
  isSpringDeploymentComplete, skipSpringDeployment
} from './phases/phase-spring-deployment.js';

// New World actions
import {
  validateExplore, executeExplore,
  validateColonize, executeColonize,
  validateConquer, executeConquer
} from './actions/new-world-actions.js';

// Luther's 95 Theses
import {
  validateLuther95Target, resolveLuther95Attempt,
  isLuther95Complete, cleanupLuther95
} from './phases/phase-luther95.js';

// Diet of Worms
import { submitDietCard } from './phases/phase-diet-of-worms.js';

// Event cards
import { executeEvent, validateEvent } from './actions/event-actions.js';

// Victory checks
import { checkImmediateVictory } from './state/victory-checks.js';

export { PHASES, ACTION_TYPES };

/** CP action dispatch table: actionType → { validate, execute } */
const CP_ACTION_HANDLERS = {
  // Military
  [ACTION_TYPES.MOVE_FORMATION]: {
    validate: validateMoveFormation, execute: moveFormation
  },
  [ACTION_TYPES.RAISE_REGULAR]: {
    validate: validateRaiseRegular, execute: raiseRegular
  },
  [ACTION_TYPES.BUY_MERCENARY]: {
    validate: validateBuyMercenary, execute: buyMercenary
  },
  [ACTION_TYPES.RAISE_CAVALRY]: {
    validate: validateRaiseCavalry, execute: raiseCavalry
  },
  [ACTION_TYPES.BUILD_SQUADRON]: {
    validate: validateBuildSquadron, execute: buildSquadron
  },
  [ACTION_TYPES.BUILD_CORSAIR]: {
    validate: validateBuildCorsair, execute: buildCorsair
  },
  [ACTION_TYPES.CONTROL_UNFORTIFIED]: {
    validate: validateControlUnfortified, execute: controlUnfortified
  },
  [ACTION_TYPES.ASSAULT]: {
    validate: validateAssault, execute: executeAssault
  },
  [ACTION_TYPES.NAVAL_MOVE]: {
    validate: validateNavalMove, execute: executeNavalMove
  },
  [ACTION_TYPES.PIRACY]: {
    validate: validatePiracy, execute: executePiracy
  },
  // Religious
  [ACTION_TYPES.PUBLISH_TREATISE]: {
    validate: validatePublishTreatise, execute: publishTreatise
  },
  [ACTION_TYPES.BURN_BOOKS]: {
    validate: validateBurnBooks, execute: burnBooks
  },
  [ACTION_TYPES.TRANSLATE_SCRIPTURE]: {
    validate: validateTranslateScripture, execute: translateScripture
  },
  [ACTION_TYPES.BUILD_ST_PETERS]: {
    validate: validateBuildStPeters, execute: buildStPeters
  },
  [ACTION_TYPES.FOUND_JESUIT]: {
    validate: validateFoundJesuit, execute: foundJesuit
  },
  [ACTION_TYPES.CALL_DEBATE]: {
    validate: validateCallDebate, execute: callDebate
  },
  // New World
  [ACTION_TYPES.EXPLORE]: {
    validate: (state, power) => validateExplore(state, power),
    execute: (state, power, _data, helpers) => executeExplore(state, power, helpers)
  },
  [ACTION_TYPES.COLONIZE]: {
    validate: (state, power) => validateColonize(state, power),
    execute: (state, power, _data, helpers) => executeColonize(state, power, helpers)
  },
  [ACTION_TYPES.CONQUER]: {
    validate: (state, power) => validateConquer(state, power),
    execute: (state, power, _data, helpers) => executeConquer(state, power, helpers)
  }
};

/**
 * Here I Stand game engine.
 */
export class HISGame extends GameEngine {
  constructor(mode = 'offline') {
    super(mode);
    this.config = config;
  }

  /**
   * Phase helper functions injected into phase modules.
   * @private
   */
  _getPhaseHelpers() {
    return {
      logEvent: (state, type, data) => {
        state.eventLog.push({ type, data, timestamp: Date.now() });
      }
    };
  }

  /**
   * Initialize game state from player list and options.
   * @param {Object} gameConfig - { players, options }
   * @returns {Object} Initial game state
   */
  initialize(gameConfig) {
    const { players, options = {} } = gameConfig;
    const state = buildInitialState(players, options);

    // Run Turn 1: Luther's 95 Theses (interactive — waits for Protestant input)
    const helpers = this._getPhaseHelpers();
    transitionPhase(state, PHASES.LUTHER_95, helpers);

    return state;
  }

  /**
   * Validate a move before processing.
   * @param {Object} move - { actionType, actionData, playerId }
   * @param {Object} state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMove(move, state) {
    const { actionType, actionData = {}, playerId } = move;
    const power = getPowerForPlayer(state, playerId);

    if (!power) {
      return { valid: false, error: 'Player not assigned to a power' };
    }

    // PHASE_ADVANCE can be sent by any player
    if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
      return { valid: true };
    }

    // Diplomacy phase actions
    if (state.phase === PHASES.DIPLOMACY) {
      if (!canActInSegment(state, power)) {
        return { valid: false, error: 'Cannot act in this diplomacy segment' };
      }
      switch (actionType) {
        case ACTION_TYPES.DECLARE_WAR:
          if (state.diplomacySegment !== 'declarations_of_war') {
            return { valid: false, error: 'Not in declarations of war segment' };
          }
          return validateDOW(state, power, actionData);
        case ACTION_TYPES.SUE_FOR_PEACE:
          if (state.diplomacySegment !== 'sue_for_peace') {
            return { valid: false, error: 'Not in sue for peace segment' };
          }
          return validateSueForPeace(state, power, actionData);
        case ACTION_TYPES.NEGOTIATE:
          if (state.diplomacySegment !== 'negotiation') {
            return { valid: false, error: 'Not in negotiation segment' };
          }
          return validateNegotiate(state, power, actionData);
        case ACTION_TYPES.RANSOM_LEADER:
          if (state.diplomacySegment !== 'ransom') {
            return { valid: false, error: 'Not in ransom segment' };
          }
          return validateRansom(state, power, actionData);
        case ACTION_TYPES.PASS:
          return { valid: true };
        default:
          return { valid: false, error: `Invalid action for diplomacy phase: ${actionType}` };
      }
    }

    // Luther's 95 Theses phase actions
    if (state.phase === PHASES.LUTHER_95) {
      if (actionType === ACTION_TYPES.SELECT_LUTHER95_TARGET) {
        return validateLuther95Target(state, power, actionData);
      }
      if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
        // Allow advancing only when phase is complete
        if (!isLuther95Complete(state)) {
          return { valid: false, error: 'Luther 95 Theses phase not complete' };
        }
        return { valid: true };
      }
      return { valid: false, error: `Invalid action for Luther 95 phase: ${actionType}` };
    }

    // Diet of Worms phase actions
    if (state.phase === PHASES.DIET_OF_WORMS) {
      if (actionType === ACTION_TYPES.SUBMIT_DIET_CARD) {
        const validPowers = ['protestant', 'hapsburg', 'papacy'];
        if (!validPowers.includes(power)) {
          return { valid: false, error: 'Only Protestant, Hapsburg, and Papacy participate' };
        }
        if (state.pendingDietOfWorms?.cards[power] != null) {
          return { valid: false, error: 'Already submitted a card' };
        }
        const cardNumber = actionData?.cardNumber;
        if (!cardNumber || !state.hands[power].includes(cardNumber)) {
          return { valid: false, error: 'Card not in hand' };
        }
        return { valid: true };
      }
      return { valid: false, error: `Invalid action for Diet of Worms: ${actionType}` };
    }

    // Spring deployment phase actions
    if (state.phase === PHASES.SPRING_DEPLOYMENT) {
      if (state.activePower !== power) {
        return { valid: false, error: 'Not your spring deployment impulse' };
      }
      if (actionType === ACTION_TYPES.SPRING_DEPLOY) {
        return validateSpringDeployment(state, power, actionData);
      }
      if (actionType === ACTION_TYPES.PASS) {
        return { valid: true };
      }
      return { valid: false, error: `Invalid action for spring deployment: ${actionType}` };
    }

    // Action phase moves require it to be this power's impulse
    if (state.phase === PHASES.ACTION) {
      if (state.activePower !== power) {
        return { valid: false, error: 'Not your impulse' };
      }

      // Sub-interactions (reformation, debate, battle, interception)
      if (actionType === ACTION_TYPES.RESOLVE_REFORMATION_ATTEMPT) {
        if (state.pendingReformation?.autoFlip) {
          return validateDebateFlip(state, power, actionData);
        }
        return validateReformationAttempt(state, power, actionData);
      }
      if (actionType === ACTION_TYPES.RESOLVE_DEBATE_STEP) {
        return validateDebateStep(state);
      }
      if (actionType === ACTION_TYPES.RESOLVE_BATTLE) {
        if (!state.pendingBattle) {
          return { valid: false, error: 'No pending battle' };
        }
        return { valid: true };
      }
      if (actionType === ACTION_TYPES.RESOLVE_INTERCEPTION) {
        if (!state.pendingInterception) {
          return { valid: false, error: 'No pending interception' };
        }
        return { valid: true };
      }
      if (actionType === ACTION_TYPES.RESOLVE_RETREAT) {
        if (!state.pendingBattle || state.pendingBattle.type !== 'retreat_choice') {
          return { valid: false, error: 'No pending retreat' };
        }
        return { valid: true };
      }
      if (actionType === ACTION_TYPES.WITHDRAW_INTO_FORTIFICATION) {
        if (!state.pendingBattle || !state.pendingBattle.canWithdraw) {
          return { valid: false, error: 'Cannot withdraw into fortification' };
        }
        return { valid: true };
      }

      // If pending interaction, block other actions
      if (hasPendingInteraction(state)) {
        if (!isSubAction(actionType)) {
          return {
            valid: false,
            error: 'Must resolve pending interaction first'
          };
        }
      }

      // CP sub-actions
      if (isCpAction(actionType)) {
        if (!isInCpMode(state)) {
          return { valid: false, error: 'Not in CP spending mode' };
        }
        const handler = CP_ACTION_HANDLERS[actionType];
        if (handler) {
          return handler.validate(state, power, actionData);
        }
        return { valid: false, error: `Unknown CP action: ${actionType}` };
      }

      // END_IMPULSE
      if (actionType === ACTION_TYPES.END_IMPULSE) {
        if (hasPendingInteraction(state)) {
          return {
            valid: false,
            error: 'Cannot end impulse with pending interaction'
          };
        }
        return { valid: true };
      }

      // PASS
      if (actionType === ACTION_TYPES.PASS) {
        if (isInCpMode(state)) {
          return { valid: false, error: 'Cannot pass while in CP mode' };
        }
        const passCheck = canPass(state, power);
        if (!passCheck.allowed) {
          return { valid: false, error: passCheck.reason };
        }
      }

      // PLAY_CARD_CP / PLAY_CARD_EVENT
      if (actionType === ACTION_TYPES.PLAY_CARD_CP ||
          actionType === ACTION_TYPES.PLAY_CARD_EVENT) {
        if (isInCpMode(state)) {
          return { valid: false, error: 'Already in CP mode' };
        }
        const cardNumber = actionData?.cardNumber;
        if (!cardNumber || !state.hands[power].includes(cardNumber)) {
          return { valid: false, error: 'Card not in hand' };
        }
        // Validate event-specific constraints
        if (actionType === ACTION_TYPES.PLAY_CARD_EVENT) {
          const eventCheck = validateEvent(state, power, cardNumber, actionData);
          if (!eventCheck.valid) return eventCheck;
        }
      }
    }

    return { valid: true };
  }

  /**
   * Process a move and return the new state.
   * @param {Object} move - { actionType, actionData, playerId }
   * @param {Object} state
   * @returns {Object} New game state
   */
  processMove(move, state) {
    const newState = JSON.parse(JSON.stringify(state));
    const helpers = this._getPhaseHelpers();
    const { actionType, actionData = {}, playerId } = move;
    const power = getPowerForPlayer(newState, playerId);

    // Diplomacy phase actions
    if (newState.phase === PHASES.DIPLOMACY) {
      this._handleDiplomacyAction(newState, power, actionType, actionData, helpers);
      newState.turnNumber++;
      return newState;
    }

    // Luther's 95 Theses phase actions
    if (newState.phase === PHASES.LUTHER_95) {
      if (actionType === ACTION_TYPES.SELECT_LUTHER95_TARGET) {
        resolveLuther95Attempt(newState, actionData, helpers);

        // Auto-advance if all attempts done or no valid targets
        if (isLuther95Complete(newState)) {
          cleanupLuther95(newState);
          advancePhase(newState, helpers);
        }
      } else if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
        cleanupLuther95(newState);
        advancePhase(newState, helpers);
      }
      newState.turnNumber++;
      return newState;
    }

    // Diet of Worms phase actions
    if (newState.phase === PHASES.DIET_OF_WORMS) {
      if (actionType === ACTION_TYPES.SUBMIT_DIET_CARD) {
        const result = submitDietCard(newState, power, actionData.cardNumber, helpers);
        // If all 3 powers have submitted, diet resolves and advances
        if (result.resolved) {
          advancePhase(newState, helpers);
        }
      }
      newState.turnNumber++;
      return newState;
    }

    // Spring deployment phase actions
    if (newState.phase === PHASES.SPRING_DEPLOYMENT) {
      this._handleSpringDeploymentAction(newState, power, actionType, actionData, helpers);
      newState.turnNumber++;
      return newState;
    }

    switch (actionType) {
      case ACTION_TYPES.PASS:
        this._handlePass(newState, power, helpers);
        break;

      case ACTION_TYPES.PLAY_CARD_CP:
        this._handlePlayCardCp(newState, power, actionData, helpers);
        break;

      case ACTION_TYPES.PLAY_CARD_EVENT:
        this._handlePlayCardEvent(newState, power, actionData, helpers);
        break;

      case ACTION_TYPES.END_IMPULSE:
        this._handleEndImpulse(newState, power, helpers);
        break;

      case ACTION_TYPES.PHASE_ADVANCE:
        advancePhase(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_REFORMATION_ATTEMPT:
        if (newState.pendingReformation?.autoFlip) {
          resolveDebateFlip(newState, power, actionData, helpers);
        } else {
          resolveReformationAttempt(newState, power, actionData, helpers);
        }
        this._checkVictory(newState, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_DEBATE_STEP:
        resolveDebateStep(newState, power, actionData, helpers);
        this._checkVictory(newState, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_BATTLE:
        this._handleResolveBattle(newState, power, helpers);
        this._checkVictory(newState, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_INTERCEPTION:
        this._handleResolveInterception(newState, power, actionData, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_RETREAT:
        this._handleResolveRetreat(newState, power, actionData, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.WITHDRAW_INTO_FORTIFICATION:
        this._handleWithdraw(newState, power, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      default:
        // CP sub-actions
        if (isCpAction(actionType)) {
          const handler = CP_ACTION_HANDLERS[actionType];
          if (handler) {
            handler.execute(newState, power, actionData, helpers);
          }
          this._checkVictory(newState, helpers);
          this._checkAutoEndImpulse(newState, helpers);
        }
        break;
    }

    newState.turnNumber++;
    return newState;
  }

  /**
   * Handle a PASS action in the action phase.
   * @private
   */
  _handlePass(state, power, helpers) {
    state.consecutivePasses++;
    helpers.logEvent(state, 'pass', { power });

    if (state.consecutivePasses >= VICTORY.consecutivePassesToEnd) {
      helpers.logEvent(state, 'action_phase_end', { turn: state.turn });
      advancePhase(state, helpers);
    } else {
      advanceImpulse(state);
    }
  }

  /**
   * Handle playing a card for CP — enters CP spending mode.
   * @private
   */
  _handlePlayCardCp(state, power, actionData, helpers) {
    const { cardNumber } = actionData;
    const hand = state.hands[power];
    const cardIndex = hand.indexOf(cardNumber);

    if (cardIndex === -1) return;

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Determine where the card goes
    const card = CARD_BY_NUMBER[cardNumber];
    if (card && card.deck === 'home') {
      state.homeCardPlayed[power] = true;
    } else if (card && card.removeAfterPlay) {
      state.removedCards.push(cardNumber);
    } else {
      state.discard.push(cardNumber);
    }

    // Reset consecutive passes
    state.consecutivePasses = 0;

    const cp = card?.cp || 0;

    helpers.logEvent(state, 'play_card', {
      power, cardNumber, title: card?.title, cp
    });

    // Enter CP spending mode
    startCpSpending(state, cardNumber, cp);

    // If card has 0 CP, auto-end impulse
    if (cp === 0) {
      this._handleEndImpulse(state, power, helpers);
    }
  }

  /**
   * Handle playing a card for its event effect.
   * @private
   */
  _handlePlayCardEvent(state, power, actionData, helpers) {
    const { cardNumber } = actionData;
    const hand = state.hands[power];
    const cardIndex = hand.indexOf(cardNumber);

    if (cardIndex === -1) return;

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Determine where the card goes
    const card = CARD_BY_NUMBER[cardNumber];
    if (card && card.deck === 'home') {
      state.homeCardPlayed[power] = true;
    } else if (card && card.removeAfterPlay) {
      state.removedCards.push(cardNumber);
    } else {
      state.discard.push(cardNumber);
    }

    // Track mandatory events
    if (card && card.category === 'MANDATORY') {
      state.mandatoryEventsPlayed.push(cardNumber);
    }

    // Reset consecutive passes
    state.consecutivePasses = 0;

    helpers.logEvent(state, 'play_card_event', {
      power, cardNumber, title: card?.title
    });

    // Execute the event
    const result = executeEvent(state, power, cardNumber, actionData, helpers);

    // If event grants CP, enter CP spending mode
    if (result?.grantCp) {
      startCpSpending(state, cardNumber, result.grantCp);
    } else {
      // Event-only card — end impulse
      advanceImpulse(state);
    }
  }

  /**
   * Handle END_IMPULSE — clean up CP state and advance.
   * @private
   */
  _handleEndImpulse(state, power, helpers) {
    endCpSpending(state);
    advanceImpulse(state);
  }

  /**
   * Check for immediate victory after a control-changing action.
   * @private
   */
  _checkVictory(state, helpers) {
    if (state.status === 'ended') return;
    const result = checkImmediateVictory(state);
    if (result.victory) {
      state.status = 'ended';
      helpers.logEvent(state, 'immediate_victory', {
        winner: result.winner, type: result.type
      });
    }
  }

  /**
   * Auto-end impulse when CP is exhausted and no pending interactions.
   * @private
   */
  _checkAutoEndImpulse(state, helpers) {
    if (state.cpRemaining <= 0 && !hasPendingInteraction(state)) {
      endCpSpending(state);
      advanceImpulse(state);
    }
  }

  /**
   * Resolve a pending field battle.
   * @private
   */
  _handleResolveBattle(state, power, helpers) {
    const battle = state.pendingBattle;
    if (!battle || battle.type !== 'field_battle') return;

    const { space, attackerPower, defenderPower } = battle;
    state.pendingBattle = null;

    resolveFieldBattle(state, space, attackerPower, defenderPower, helpers);
  }

  /**
   * Resolve a pending interception attempt.
   * @private
   */
  _handleResolveInterception(state, power, actionData, helpers) {
    const interception = state.pendingInterception;
    if (!interception) return;

    const { interceptorPower, interceptorSpace, targetSpace } = interception;
    state.pendingInterception = null;

    const result = resolveInterception(
      state, interceptorPower, interceptorSpace, targetSpace, helpers,
      { movingPower: interception.movingPower, fromSpace: interception.fromSpace }
    );

    // If interception succeeded, trigger battle
    if (result.success) {
      state.pendingBattle = {
        type: 'field_battle',
        space: targetSpace,
        attackerPower: interception.movingPower,
        defenderPower: interceptorPower,
        fromSpace: null
      };
    }
  }

  /**
   * Resolve a pending retreat choice.
   * @private
   */
  _handleResolveRetreat(state, power, actionData, helpers) {
    const battle = state.pendingBattle;
    if (!battle || battle.type !== 'retreat_choice') return;

    const { space, loserPower, winnerPower } = battle;
    const destination = actionData?.destination;
    state.pendingBattle = null;

    if (destination && battle.retreatOptions.includes(destination)) {
      executeRetreat(state, space, loserPower, destination, helpers);
    } else {
      // Invalid destination → eliminate
      eliminateFormation(state, space, loserPower, winnerPower, helpers);
    }
  }

  /**
   * Handle withdraw into fortification.
   * @private
   */
  _handleWithdraw(state, power, helpers) {
    const battle = state.pendingBattle;
    if (!battle || !battle.canWithdraw) return;

    const { space, winnerPower } = battle;
    state.pendingBattle = null;

    // Defender stays in the space (withdrawn into fort)
    // Attacker initiates siege
    const sp = state.spaces[space];
    if (isFortified(sp) && sp.controller !== winnerPower) {
      sp.besieged = true;
      sp.besiegedBy = winnerPower;
      sp.siegeEstablishedImpulse = state.turnNumber;
      sp.siegeEstablishedTurn = state.turn;
      sp.siegeEstablishedCardNumber = state.activeCardNumber ?? null;
      sp.siegeEstablishedBy = winnerPower;
      helpers.logEvent(state, 'siege_established', {
        space, besiegedBy: winnerPower
      });
    }
  }

  /**
   * Handle a diplomacy phase action.
   * @private
   */
  _handleDiplomacyAction(state, power, actionType, actionData, helpers) {
    switch (actionType) {
      case ACTION_TYPES.DECLARE_WAR:
        executeDOW(state, power, actionData, helpers);
        markActed(state, power);
        break;
      case ACTION_TYPES.SUE_FOR_PEACE:
        executeSueForPeace(state, power, actionData, helpers);
        markActed(state, power);
        break;
      case ACTION_TYPES.NEGOTIATE:
        executeNegotiate(state, power, actionData, helpers);
        markActed(state, power);
        break;
      case ACTION_TYPES.RANSOM_LEADER:
        executeRansom(state, power, actionData, helpers);
        markActed(state, power);
        break;
      case ACTION_TYPES.PASS:
        markActed(state, power);
        break;
    }

    // Auto-advance segment when all powers have acted
    if (allActedInSegment(state)) {
      const more = advanceDiplomacySegment(state, helpers);
      if (!more) {
        // Diplomacy complete → advance to next phase
        advancePhase(state, helpers);
      }
    }
  }

  /**
   * Handle a spring deployment phase action.
   * @private
   */
  _handleSpringDeploymentAction(state, power, actionType, actionData, helpers) {
    if (actionType === ACTION_TYPES.SPRING_DEPLOY) {
      executeSpringDeployment(state, power, actionData, helpers);
    } else if (actionType === ACTION_TYPES.PASS) {
      skipSpringDeployment(state, power);
    }

    if (isSpringDeploymentComplete(state)) {
      advancePhase(state, helpers);
      return;
    }

    // Continue spring deployment in impulse order.
    do {
      advanceImpulse(state);
    } while (state.springDeploymentDone?.[state.activePower]);
  }

  /**
   * Check if the game has ended.
   * @param {Object} state
   * @returns {{ ended: boolean, winner?: string, reason?: string, rankings?: Array }}
   */
  checkGameEnd(state) {
    if (state.status === 'ended') {
      return this._buildEndResult(state);
    }

    if (state.phase !== PHASES.VICTORY_DETERMINATION) {
      return { ended: false };
    }

    const vpTotals = this._calculateVpTotals(state);
    const sorted = Object.entries(vpTotals).sort((a, b) => b[1] - a[1]);
    const highest = sorted[0];

    if (highest[1] >= VICTORY.standardVp) {
      state.status = 'ended';
      return this._buildEndResult(state, highest[0], 'standard_victory');
    }

    if (state.turn >= VICTORY.dominationMinTurn) {
      const second = sorted[1];
      if (highest[1] - second[1] >= VICTORY.dominationGap) {
        state.status = 'ended';
        return this._buildEndResult(state, highest[0], 'domination_victory');
      }
    }

    if (state.turn >= VICTORY.maxTurns) {
      state.status = 'ended';
      return this._buildEndResult(state, highest[0], 'time_limit');
    }

    return { ended: false };
  }

  /**
   * Get visible state for a specific player.
   * @param {string} playerId
   * @returns {Object} Filtered state
   */
  getVisibleState(playerId) {
    return getVisibleState(this.state, playerId);
  }

  /**
   * Calculate total VP for all powers.
   * @private
   */
  _calculateVpTotals(state) {
    const totals = {};
    for (const power of MAJOR_POWERS) {
      totals[power] = (state.vp[power] || 0) + (state.bonusVp[power] || 0);
    }
    return totals;
  }

  /**
   * Build the end-of-game result object.
   * @private
   */
  _buildEndResult(state, winner = null, reason = null) {
    const vpTotals = this._calculateVpTotals(state);

    if (!winner) {
      const sorted = Object.entries(vpTotals).sort((a, b) => b[1] - a[1]);
      winner = sorted[0][0];
    }

    const rankings = MAJOR_POWERS
      .map(power => ({
        power,
        playerId: state.playerByPower[power],
        vp: vpTotals[power],
        rank: 0
      }))
      .sort((a, b) => b.vp - a.vp)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    return {
      ended: true,
      winner: state.playerByPower[winner],
      winnerPower: winner,
      reason,
      rankings
    };
  }
}

export default HISGame;
