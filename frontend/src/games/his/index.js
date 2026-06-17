/**
 * Here I Stand — Game Implementation
 * @module games/his
 */

import { GameEngine } from '../../game/engine.js';
import config from './config.json';
import { MAJOR_POWERS, VICTORY } from './constants.js';
import { buildInitialState } from './state/state-init.js';
import {
  initBotDecks, placeBotExtraUnits, isBotPower, botPlayerId
} from './ai/bot-controller.js';
import { getVisibleState } from './state/state-visible.js';
import {
  getPowerForPlayer, getPowersForPlayer, playerControlsPower,
  canPass, isFortified, getAllVpTotals, getAllVpBreakdowns
} from './state/state-helpers.js';
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
  validateControlUnfortified, controlUnfortified,
  validateFightForeignWar, fightForeignWar
} from './actions/military-actions.js';

// Religious actions
import {
  validatePublishTreatise, publishTreatise,
  validateBurnBooks, burnBooks,
  validateReformationAttempt, resolveReformationAttempt, hasAnyReformationTargets,
  validateTranslateScripture, translateScripture,
  validateBuildStPeters, buildStPeters,
  validateFoundJesuit, foundJesuit,
  rollDice
} from './actions/religious-actions.js';

// Debate actions
import {
  validateCallDebate, callDebate,
  validateDebateStep, resolveDebateStep,
  validateDebateFlip, resolveDebateFlip
} from './actions/debate-actions.js';

// Combat actions
import {
  resolveFieldBattle, initiateFieldBattle, executeFieldBattle,
  finalizeFieldBattle
} from './actions/combat-actions.js';
import {
  validateAssault, executeAssault, finalizeAssault
} from './actions/siege-actions.js';
import {
  validateNavalMove, executeNavalMove,
  validatePiracy, executePiracy,
  validateNavalTransport, executeNavalTransport
} from './actions/naval-actions.js';
import { resolveInterception } from './actions/interception.js';
import {
  findLegalRetreats, executeRetreat, eliminateFormation
} from './actions/retreat.js';

// Excommunication actions
import {
  validateExcommunicateReformer, excommunicateReformer,
  validateExcommunicateRuler, excommunicateRuler,
  validateRemoveExcommunication, removeExcommunication
} from './actions/excommunication-actions.js';

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

// Response card actions
import {
  handlePlayResponseCard, handleDeclineResponse, getNextCombatWindow,
  createCombatCardWindow, advanceMercenaryWindow,
  getNextPostRollWindow,
  canAnyPowerInterrupt, createInterruptWindow, advanceInterruptWindow
} from './actions/response-actions.js';

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
  [ACTION_TYPES.NAVAL_TRANSPORT]: {
    validate: validateNavalTransport, execute: executeNavalTransport
  },
  [ACTION_TYPES.FIGHT_FOREIGN_WAR]: {
    validate: validateFightForeignWar, execute: fightForeignWar
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

    // Bot initialization: set up AI-controlled powers
    const botPowerIds = options.botPowers || [];
    if (botPowerIds.length > 0) {
      initBotDecks(state, botPowerIds);
      placeBotExtraUnits(state);

      // Register bot player IDs in power mappings
      for (const power of botPowerIds) {
        const bpId = botPlayerId(power);
        state.playerByPower[power] = bpId;
        state.powerByPlayer[bpId] = power;
        state.powersForPlayer[bpId] = [power];
      }
    }

    // Run Turn 1: Luther's 95 Theses (interactive — waits for Protestant input)
    const helpers = this._getPhaseHelpers();
    transitionPhase(state, PHASES.LUTHER_95, helpers);

    return state;
  }

  /**
   * Resolve the acting power for a move based on phase context.
   * @private
   * @param {Object} state
   * @param {string} playerId
   * @param {string} actionType
   * @param {Object} actionData
   * @returns {string|null} The power this action is for
   */
  _resolveActingPower(state, playerId, actionType, actionData) {
    // Response cards: acting power is the responding power
    if (actionType === ACTION_TYPES.PLAY_RESPONSE_CARD ||
        actionType === ACTION_TYPES.DECLINE_RESPONSE) {
      return state.pendingResponse?.respondingPower || null;
    }

    // Impulse-based phases: acting power is activePower
    if (state.phase === PHASES.ACTION ||
        state.phase === PHASES.SPRING_DEPLOYMENT) {
      return state.activePower;
    }

    // Luther 95: always protestant
    if (state.phase === PHASES.LUTHER_95) {
      return 'protestant';
    }

    // Simultaneous phases: use forPower from actionData, or primary power
    if (actionData?.forPower) {
      return actionData.forPower;
    }

    // Fallback: find first controlled power that can act in this context
    const powers = getPowersForPlayer(state, playerId);
    if (state.phase === PHASES.DIET_OF_WORMS) {
      const validDiet = ['protestant', 'hapsburg', 'papacy'];
      const match = powers.find(p =>
        validDiet.includes(p) &&
        state.pendingDietOfWorms?.cards[p] == null
      );
      return match || powers[0];
    }

    return powers[0] || getPowerForPlayer(state, playerId);
  }

  // ── Save/Load Metadata ─────────────────────────────────────────

  /** @override */
  _getSaveMetadata() {
    const s = this.state;
    if (!s) return {};
    return {
      turn: s.turn,
      phase: s.phase,
      activePower: s.activePower,
      playerCount: s.players?.length || 0,
      vp: s.vp ? { ...s.vp } : {}
    };
  }

  /** @override */
  _autoLabel() {
    const s = this.state;
    if (!s) return 'HIS Save';
    const phaseNames = {
      luther_95: '九十五条论纲',
      card_draw: '抽牌',
      diplomacy: '外交',
      diet_of_worms: '沃尔姆斯会议',
      spring_deployment: '春季部署',
      action: '行动',
      winter: '冬季',
      new_world: '新世界',
      victory_determination: '胜利判定'
    };
    const phaseName = phaseNames[s.phase] || s.phase;
    return `第${s.turn || '?'}回合 — ${phaseName}`;
  }

  /**
   * Validate a move before processing.
   * @param {Object} move - { actionType, actionData, playerId }
   * @param {Object} state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMove(move, state) {
    const { actionType, actionData = {}, playerId } = move;

    if (!actionType) {
      return { valid: false, error: 'Missing actionType' };
    }

    const playerPowers = getPowersForPlayer(state, playerId);

    if (playerPowers.length === 0) {
      return { valid: false, error: 'Player not assigned to a power' };
    }

    // PHASE_ADVANCE can be sent by any player
    if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
      return { valid: true };
    }

    // Resolve acting power based on phase context
    const power = this._resolveActingPower(
      state, playerId, actionType, actionData
    );

    // Diplomacy phase actions
    if (state.phase === PHASES.DIPLOMACY) {
      if (!power || !playerControlsPower(state, playerId, power)) {
        return { valid: false, error: 'You do not control this power' };
      }
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
        case ACTION_TYPES.REMOVE_EXCOMMUNICATION:
          if (state.diplomacySegment !== 'remove_excommunication') {
            return { valid: false, error: 'Not in remove excommunication segment' };
          }
          return validateRemoveExcommunication(state, power, actionData);
        case ACTION_TYPES.PASS:
          return { valid: true };
        default:
          return { valid: false, error: `Invalid action for diplomacy phase: ${actionType}` };
      }
    }

    // Luther's 95 Theses phase actions
    if (state.phase === PHASES.LUTHER_95) {
      if (!playerControlsPower(state, playerId, 'protestant')) {
        return { valid: false, error: 'Only Protestant player can act' };
      }
      if (actionType === ACTION_TYPES.SELECT_LUTHER95_TARGET) {
        return validateLuther95Target(state, 'protestant', actionData);
      }
      if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
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
        if (!power || !validPowers.includes(power)) {
          return { valid: false, error: 'Only Protestant, Hapsburg, and Papacy participate' };
        }
        if (!playerControlsPower(state, playerId, power)) {
          return { valid: false, error: 'You do not control this power' };
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
      if (!playerControlsPower(state, playerId, state.activePower)) {
        return { valid: false, error: 'Not your spring deployment impulse' };
      }
      const sdPower = state.activePower;
      if (actionType === ACTION_TYPES.SPRING_DEPLOY) {
        return validateSpringDeployment(state, sdPower, actionData);
      }
      if (actionType === ACTION_TYPES.PASS) {
        return { valid: true };
      }
      return { valid: false, error: `Invalid action for spring deployment: ${actionType}` };
    }

    // Action phase moves require it to be this power's impulse
    if (state.phase === PHASES.ACTION) {
      // Response card actions can be played by non-active power
      if (actionType === ACTION_TYPES.PLAY_RESPONSE_CARD ||
          actionType === ACTION_TYPES.DECLINE_RESPONSE) {
        if (!state.pendingResponse) {
          return { valid: false, error: 'No pending response window' };
        }
        const respPower = state.pendingResponse.respondingPower;
        if (!playerControlsPower(state, playerId, respPower)) {
          return { valid: false, error: 'Not your response window' };
        }
        if (actionType === ACTION_TYPES.PLAY_RESPONSE_CARD) {
          const cardNumber = actionData?.cardNumber;
          if (!cardNumber ||
              !state.pendingResponse.validCards.includes(cardNumber)) {
            return { valid: false, error: 'Invalid response card' };
          }
          if (!state.hands[respPower]?.includes(cardNumber)) {
            return { valid: false, error: 'Card not in hand' };
          }
        }
        return { valid: true };
      }

      if (!playerControlsPower(state, playerId, state.activePower)) {
        return { valid: false, error: 'Not your impulse' };
      }

      const actPower = state.activePower;

      // Sub-interactions (reformation, debate, battle, interception)
      if (actionType === ACTION_TYPES.RESOLVE_REFORMATION_ATTEMPT) {
        if (state.pendingReformation?.autoFlip) {
          return validateDebateFlip(state, actPower, actionData);
        }
        return validateReformationAttempt(state, actPower, actionData);
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
      if (actionType === ACTION_TYPES.AVOID_BATTLE) {
        if (!state.pendingBattle) {
          return { valid: false, error: 'No pending battle to avoid' };
        }
        return { valid: true };
      }

      // Auto-clear pendingReformation when no valid targets remain
      if (state.pendingReformation) {
        const pr = state.pendingReformation;
        const left = pr.attemptsLeft ?? pr.attemptsRemaining ?? 0;
        if (left <= 0 || !hasAnyReformationTargets(state, pr)) {
          state.pendingReformation = null;
        }
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
        // §2.10.3 Final Autumn Assaults: free ASSAULT allowed outside CP mode
        const isFreeAutumnAssault =
          actionType === ACTION_TYPES.ASSAULT && actionData?.free === true;
        if (!isInCpMode(state) && !isFreeAutumnAssault) {
          return { valid: false, error: 'Not in CP spending mode' };
        }
        const handler = CP_ACTION_HANDLERS[actionType];
        if (handler) {
          return handler.validate(state, actPower, actionData);
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
        const passCheck = canPass(state, actPower);
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
        if (!cardNumber || !state.hands[actPower].includes(cardNumber)) {
          return { valid: false, error: 'Card not in hand' };
        }
        // Validate event-specific constraints
        if (actionType === ACTION_TYPES.PLAY_CARD_EVENT) {
          const eventCheck = validateEvent(state, actPower, cardNumber, actionData);
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
    const power = this._resolveActingPower(
      newState, playerId, actionType, actionData
    );

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
      this._handleSpringDeploymentAction(
        newState, newState.activePower, actionType, actionData, helpers
      );
      newState.turnNumber++;
      return newState;
    }

    // Action phase — use activePower for impulse-based actions
    const actPower = newState.activePower;

    switch (actionType) {
      case ACTION_TYPES.PASS:
        this._handlePass(newState, actPower, helpers);
        break;

      case ACTION_TYPES.PLAY_CARD_CP:
        this._handlePlayCardCp(newState, actPower, actionData, helpers);
        break;

      case ACTION_TYPES.PLAY_CARD_EVENT:
        this._handlePlayCardEvent(newState, actPower, actionData, helpers);
        break;

      case ACTION_TYPES.END_IMPULSE:
        this._handleEndImpulse(newState, actPower, helpers);
        break;

      case ACTION_TYPES.PHASE_ADVANCE:
        advancePhase(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_REFORMATION_ATTEMPT:
        if (newState.pendingReformation?.autoFlip) {
          resolveDebateFlip(newState, actPower, actionData, helpers);
        } else {
          resolveReformationAttempt(newState, actPower, actionData, helpers);
        }
        this._checkVictory(newState, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_DEBATE_STEP:
        resolveDebateStep(newState, actPower, actionData, helpers);
        this._checkVictory(newState, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_BATTLE:
        this._handleResolveBattle(newState, actPower, helpers);
        this._checkVictory(newState, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_INTERCEPTION:
        this._handleResolveInterception(newState, actPower, actionData, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.RESOLVE_RETREAT:
        this._handleResolveRetreat(newState, actPower, actionData, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.WITHDRAW_INTO_FORTIFICATION:
        this._handleWithdraw(newState, actPower, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.AVOID_BATTLE:
        this._handleAvoidBattle(newState, actPower, actionData, helpers);
        this._checkAutoEndImpulse(newState, helpers);
        break;

      case ACTION_TYPES.PLAY_RESPONSE_CARD: {
        const respPower = newState.pendingResponse?.respondingPower || actPower;
        this._handlePlayResponseCard(newState, respPower, actionData, helpers);
        this._checkVictory(newState, helpers);
        break;
      }

      case ACTION_TYPES.DECLINE_RESPONSE: {
        const respPower = newState.pendingResponse?.respondingPower || actPower;
        this._handleDeclineResponse(newState, respPower, helpers);
        this._checkVictory(newState, helpers);
        break;
      }

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

    // §21.3 Mary I impulse check — if England under Mary I plays a
    // non-mandatory card, d6 1-3 means Papacy hijacks the impulse.
    const card = CARD_BY_NUMBER[cardNumber];
    if (power === 'england' && this._isMaryIHijack(state, card, helpers)) {
      // Card consumed, impulse ends (Papacy already acted)
      hand.splice(cardIndex, 1);
      if (card?.deck === 'home') {
        state.homeCardPlayed[power] = true;
      } else if (card?.removeAfterPlay) {
        state.removedCards.push(cardNumber);
      } else {
        state.discard.push(cardNumber);
      }
      state.consecutivePasses = 0;
      this._handleEndImpulse(state, power, helpers);
      return;
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Determine where the card goes
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

    // §21.3 Mary I impulse check — same as CP play
    const card = CARD_BY_NUMBER[cardNumber];
    if (power === 'england' && this._isMaryIHijack(state, card, helpers)) {
      hand.splice(cardIndex, 1);
      if (card?.deck === 'home') {
        state.homeCardPlayed[power] = true;
      } else if (card?.removeAfterPlay) {
        state.removedCards.push(cardNumber);
      } else {
        state.discard.push(cardNumber);
      }
      state.consecutivePasses = 0;
      this._handleEndImpulse(state, power, helpers);
      return;
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Determine where the card goes
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

    // Check for W7 Wartburg interrupt before executing the event
    const { powers } = canAnyPowerInterrupt(state, 'event_play');
    if (powers.length > 0) {
      // Store the pending event for deferred execution
      state.pendingEventPlay = {
        cardNumber,
        power,
        actionData
      };
      createInterruptWindow(state, 'event_play', {
        cardNumber, power
      });
      // Save W7 tracking for multi-responder advancement
      if (state.pendingResponse) {
        state.pendingW7 = {
          respondingPowers: state.pendingResponse.respondingPowers,
          currentResponderIndex:
            state.pendingResponse.currentResponderIndex
        };
      }
      return;
    }

    // No interrupt — execute the event immediately
    this._executeEventAndAdvance(state, power, cardNumber, actionData, helpers);
  }

  /**
   * Execute a deferred or immediate event card and advance impulse.
   * @private
   */
  _executeEventAndAdvance(state, power, cardNumber, actionData, helpers) {
    const result = executeEvent(state, power, cardNumber, actionData, helpers);

    // If event grants CP, enter CP spending mode
    if (result?.grantCp) {
      startCpSpending(state, cardNumber, result.grantCp);
    } else if (!hasPendingInteraction(state)) {
      // Event-only card with no pending sub-interactions — advance impulse.
      // If the event created a pendingReformation/pendingDebate/etc., stay on
      // the current power so they can resolve it before the impulse advances.
      advanceImpulse(state);
    }
  }

  /**
   * Handle END_IMPULSE — clean up CP state and advance.
   * @private
   */
  /**
   * §21.3 Mary I impulse check.
   * Under Mary I, England rolls d6 for non-mandatory cards.
   * 1-3: Papacy hijacks the impulse for religious action.
   * 4-6: England proceeds normally.
   * Skip if all English home spaces are already Catholic.
   * @returns {boolean} true if Papacy hijacked the impulse
   * @private
   */
  _isMaryIHijack(state, card, helpers) {
    if (state.rulers?.england !== 'mary_i') return false;

    // Mandatory events always proceed normally
    if (card && card.category === 'MANDATORY') return false;

    // If all English home spaces are Catholic, skip check
    const englishHomeSpaces = Object.values(state.spaces).filter(
      sp => sp.homePower === 'england'
    );
    const allCatholic = englishHomeSpaces.every(
      sp => sp.religion === 'catholic'
    );
    if (allCatholic) return false;

    const die = rollDice(1)[0];
    helpers.logEvent(state, 'mary_i_check', {
      die, card: card?.number, title: card?.title
    });

    if (die >= 4) return false; // England proceeds normally

    // d6 1-3: Papacy takes religious action with the card's CP.
    // Papacy performs counter-reformation attempts in English zone
    // (the CP is from the hijacked card, not Papacy's own pool).
    const cp = card?.cp || 0;
    if (cp >= 1) {
      // Set up counter-reformation attempts directly (bypass spendCp)
      const attempts = Math.min(cp, 2); // burn books = 2 attempts max
      state.pendingReformation = {
        type: 'counter_reformation',
        zone: 'english',
        attemptsLeft: attempts,
        initiator: 'papacy'
      };
      helpers.logEvent(state, 'mary_i_hijack', {
        action: cp >= 3 ? 'burn_books_and_debate' : 'burn_books',
        cp, zone: 'english', attempts
      });
    }
    return true;
  }

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
      state.winner = result.winner;
      state.winReason = result.type;
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

    // Don't clear pendingBattle yet — initiateFieldBattle may pause
    const result = initiateFieldBattle(
      state, space, attackerPower, defenderPower, helpers
    );

    // If battle paused for response window, keep pendingBattle
    if (result.paused) {
      state.pendingBattle.battleType = 'field';
      state.pendingBattle.lastWindow = result.window;
      state.pendingBattle.responses = {};

      // Save W1 tracking data on pendingBattle for multi-responder
      if (result.window === 'W1' && state.pendingResponse) {
        state.pendingBattle.w1 = {
          respondingPowers: state.pendingResponse.respondingPowers,
          currentResponderIndex:
            state.pendingResponse.currentResponderIndex
        };
      }
      return;
    }

    // Battle completed synchronously (no response windows)
    state.pendingBattle = null;
  }

  /**
   * Handle playing a combat response card.
   * @private
   */
  _handlePlayResponseCard(state, power, actionData, helpers) {
    const result = handlePlayResponseCard(
      state, power, actionData, helpers
    );
    if (!result.success) return;
    this._advanceAfterResponse(state, result, helpers);
  }

  /**
   * Handle declining a combat response.
   * @private
   */
  _handleDeclineResponse(state, power, helpers) {
    const result = handleDeclineResponse(state, power, helpers);
    if (!result.success) return;
    this._advanceAfterResponse(state, result, helpers);
  }

  /**
   * After a response card is played or declined, check if another
   * window should open or if the battle should execute.
   * @private
   */
  _advanceAfterResponse(state, result, helpers) {
    const { window: currentWindow, responses, battleState } = result;

    // W7 impulse interrupt window — not tied to a battle
    if (currentWindow === 'W7') {
      this._advanceAfterW7(state, result, helpers);
      return;
    }

    // W5 Siege Artillery — assault post-roll, not a pendingBattle flow
    if (currentWindow === 'W5') {
      this._advanceAfterW5(state, helpers);
      return;
    }

    const battle = state.pendingBattle;

    if (!battle) return;

    const { space, attackerPower, defenderPower } = battle;
    const battleType = battle.battleType || 'field';

    // Post-roll windows: W4 finalizes the field battle. (W5 is handled above
    // via _advanceAfterW5; W6 naval post-roll is not yet integrated.)
    if (currentWindow === 'W4' || currentWindow === 'W6') {
      state.pendingBattle = null;
      if (currentWindow === 'W4') {
        finalizeFieldBattle(
          state, space, attackerPower, defenderPower, helpers,
          battleState || {}
        );
      }
      // W6 naval post-roll finalization: future integration with naval combat
      return;
    }

    // W1: check if more mercenary responders remain
    if (currentWindow === 'W1' && battle.w1) {
      // Reconstruct pendingResponse so advanceMercenaryWindow can work
      state.pendingResponse = {
        window: 'W1',
        context: {
          type: battleType,
          space,
          attackerPower,
          defenderPower
        },
        respondingPowers: battle.w1.respondingPowers,
        currentResponderIndex: battle.w1.currentResponderIndex,
        responses: responses || {},
        battleState: battleState || {}
      };

      const w1Next = advanceMercenaryWindow(state, helpers);
      if (w1Next === 'W1') {
        battle.lastWindow = 'W1';
        battle.responses = responses;
        // Update W1 tracking on pendingBattle
        battle.w1.currentResponderIndex =
          state.pendingResponse.currentResponderIndex;
        return;
      }
      // W1 done — fall through to check W2/W3
      state.pendingResponse = null;
    }

    const nextWindow = getNextCombatWindow(
      currentWindow, state, space, attackerPower, defenderPower,
      battleType, { responses }
    );

    if (nextWindow) {
      const created = createCombatCardWindow(
        state, nextWindow, space, attackerPower, defenderPower,
        battleType, { responses }
      );
      if (created) {
        battle.lastWindow = nextWindow;
        // Store responses on pendingBattle for tracking
        battle.responses = responses;
        return;
      }
    }

    // No more pre-roll windows — execute the battle (may pause at W4)
    const execResult = executeFieldBattle(
      state, space, attackerPower, defenderPower, helpers,
      { responses }
    );

    if (execResult && execResult.paused) {
      // Battle paused at W4 — keep pendingBattle alive
      battle.lastWindow = execResult.window;
      battle.responses = responses;
      return;
    }

    // Battle completed — clear pendingBattle (handlePostBattle sets
    // it to retreat_choice if needed, so only clear if still field_battle)
    if (state.pendingBattle === battle) {
      state.pendingBattle = null;
    }
  }

  /**
   * Advance after a W5 (Siege Artillery) post-roll response. The assault was
   * paused after rolling; finalize it now (applying any #35 bonus dice the
   * responder set) and resume normal impulse bookkeeping.
   * @private
   */
  _advanceAfterW5(state, helpers) {
    const ctx = state.pendingAssault;
    state.pendingAssault = null;
    if (!ctx) return;
    finalizeAssault(state, ctx, helpers);
    this._checkVictory(state, helpers);
    this._checkAutoEndImpulse(state, helpers);
  }

  /**
   * Advance after a W7 impulse interrupt response.
   * Handles multi-responder iteration and deferred event execution.
   * @private
   */
  _advanceAfterW7(state, result, helpers) {
    const { responses, battleState } = result;

    // Check if more W7 responders remain
    // Reconstruct pendingResponse so advanceInterruptWindow can work
    const triggerType = battleState?.type
      || result.battleState?.type
      || 'impulse_start';
    const context = {
      type: triggerType,
      triggerData: battleState || {}
    };

    // Use w7 tracking on state if available
    if (state.pendingW7) {
      state.pendingResponse = {
        window: 'W7',
        context,
        respondingPowers: state.pendingW7.respondingPowers,
        currentResponderIndex: state.pendingW7.currentResponderIndex,
        responses: responses || {},
        battleState: battleState || {}
      };

      const w7Next = advanceInterruptWindow(state, helpers);
      if (w7Next === 'W7') {
        // Update W7 tracking
        state.pendingW7.currentResponderIndex =
          state.pendingResponse.currentResponderIndex;
        return;
      }
      // W7 done — fall through to resolve
      state.pendingResponse = null;
    }

    // Clean up W7 tracking
    state.pendingW7 = null;

    // Resolve the deferred action based on trigger type
    const pendingEvent = state.pendingEventPlay;
    if (pendingEvent) {
      state.pendingEventPlay = null;

      // If Wartburg was played (#37), the event is cancelled
      if (state.pendingEventCancelled) {
        state.pendingEventCancelled = null;
        helpers.logEvent(state, 'event_cancelled_by_wartburg', {
          cancelledCard: pendingEvent.cardNumber,
          cancelledPower: pendingEvent.power
        });
        // Event cancelled — advance impulse
        advanceImpulse(state);
        return;
      }

      // No cancellation — execute the deferred event
      this._executeEventAndAdvance(
        state, pendingEvent.power, pendingEvent.cardNumber,
        pendingEvent.actionData, helpers
      );
      return;
    }

    // For impulse_start interrupts (#31/#32/#38), their handlers
    // already modified state flags. Just continue the impulse.
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
    if (isFortified(sp, state) && sp.controller !== winnerPower) {
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
   * Handle avoid battle — defender retreats before field battle.
   * §12: defender may evade/avoid battle instead of fighting.
   * @private
   */
  _handleAvoidBattle(state, power, actionData, helpers) {
    const battle = state.pendingBattle;
    if (!battle) return;

    const { space, defenderPower, attackerPower } = battle;
    const destination = actionData?.destination;

    // Validate retreat destination
    if (destination) {
      const legalRetreats = findLegalRetreats(state, space, defenderPower || power);
      const isLegal = legalRetreats.some(r => r.space === destination);
      if (!isLegal) {
        helpers.logEvent(state, 'avoid_battle_failed', {
          power: defenderPower || power, space, destination,
          reason: 'illegal_retreat'
        });
        return;
      }
      executeRetreat(state, space, defenderPower || power, destination, helpers);
    } else {
      // No destination — eliminate if no legal retreats
      const retreats = findLegalRetreats(state, space, defenderPower || power);
      if (retreats.length > 0) {
        executeRetreat(state, space, defenderPower || power, retreats[0].space, helpers);
      } else {
        eliminateFormation(state, space, defenderPower || power, helpers);
      }
    }

    state.pendingBattle = null;
    helpers.logEvent(state, 'avoid_battle', {
      power: defenderPower || power, space, destination
    });
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
      case ACTION_TYPES.REMOVE_EXCOMMUNICATION:
        removeExcommunication(state, power, actionData, helpers);
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
      return this._buildEndResult(state, state.winner || null, state.winReason || null);
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

    if (state.dominationVictoryEnabled !== false && state.turn >= VICTORY.dominationMinTurn) {
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
   * Per-power VP breakdown by source (balance analysis, e.g. #Y).
   * @returns {Object} { [power]: { total, key, track, run, bonus, keys } }
   */
  getScoreBreakdown() {
    return getAllVpBreakdowns(this.state);
  }

  /**
   * Calculate total VP for all powers (track VP + bonus VP).
   * @private
   */
  _calculateVpTotals(state) {
    return getAllVpTotals(state);
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
        score: vpTotals[power],
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
