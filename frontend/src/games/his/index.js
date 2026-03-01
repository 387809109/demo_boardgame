/**
 * Here I Stand — Game Implementation
 * @module games/his
 */

import { GameEngine } from '../../game/engine.js';
import config from './config.json';
import { MAJOR_POWERS, IMPULSE_ORDER, VICTORY } from './constants.js';
import { buildInitialState } from './state/state-init.js';
import { getVisibleState } from './state/state-visible.js';
import {
  getPowerForPlayer, canPass, getKeyVp, countKeysForPower
} from './state/state-helpers.js';
import {
  PHASES, transitionPhase, advancePhase, advanceImpulse, getNextPhase
} from './phases/phase-manager.js';
import { CARD_BY_NUMBER } from './data/cards.js';

export { PHASES };

/** Action types for Phase 1 */
export const ACTION_TYPES = {
  PLAY_CARD_CP: 'PLAY_CARD_CP',
  PLAY_CARD_EVENT: 'PLAY_CARD_EVENT',
  PASS: 'PASS',
  PHASE_ADVANCE: 'PHASE_ADVANCE'
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

    // Run the first card draw phase
    const helpers = this._getPhaseHelpers();
    transitionPhase(state, PHASES.CARD_DRAW, helpers);

    return state;
  }

  /**
   * Validate a move before processing.
   * @param {Object} move - { actionType, actionData, playerId }
   * @param {Object} state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMove(move, state) {
    const { actionType, playerId } = move;
    const power = getPowerForPlayer(state, playerId);

    if (!power) {
      return { valid: false, error: 'Player not assigned to a power' };
    }

    // PHASE_ADVANCE can be sent by any player (auto-advance stub phases)
    if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
      return { valid: true };
    }

    // Action phase moves require it to be this power's impulse
    if (state.phase === PHASES.ACTION) {
      if (state.activePower !== power) {
        return { valid: false, error: 'Not your impulse' };
      }

      if (actionType === ACTION_TYPES.PASS) {
        const passCheck = canPass(state, power);
        if (!passCheck.allowed) {
          return { valid: false, error: passCheck.reason };
        }
      }

      if (actionType === ACTION_TYPES.PLAY_CARD_CP ||
          actionType === ACTION_TYPES.PLAY_CARD_EVENT) {
        const cardNumber = move.actionData?.cardNumber;
        if (!cardNumber || !state.hands[power].includes(cardNumber)) {
          return { valid: false, error: 'Card not in hand' };
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
    const { actionType, actionData, playerId } = move;
    const power = getPowerForPlayer(newState, playerId);

    switch (actionType) {
      case ACTION_TYPES.PASS:
        this._handlePass(newState, power, helpers);
        break;

      case ACTION_TYPES.PLAY_CARD_CP:
        this._handlePlayCardCp(newState, power, actionData, helpers);
        break;

      case ACTION_TYPES.PLAY_CARD_EVENT:
        // Stub: treat same as CP play for now (events in Phase 6)
        this._handlePlayCardCp(newState, power, actionData, helpers);
        break;

      case ACTION_TYPES.PHASE_ADVANCE:
        advancePhase(newState, helpers);
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
      // 6 consecutive passes → end action phase
      helpers.logEvent(state, 'action_phase_end', { turn: state.turn });
      advancePhase(state, helpers);
    } else {
      advanceImpulse(state);
    }
  }

  /**
   * Handle playing a card for CP.
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
      // Home cards go back to the power, not discard
      state.homeCardPlayed[power] = true;
    } else if (card && card.removeAfterPlay) {
      state.removedCards.push(cardNumber);
    } else {
      state.discard.push(cardNumber);
    }

    // Reset consecutive passes
    state.consecutivePasses = 0;

    helpers.logEvent(state, 'play_card', {
      power,
      cardNumber,
      title: card?.title,
      cp: card?.cp
    });

    // Advance to next power's impulse
    advanceImpulse(state);
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

    // Only check during victory determination phase
    if (state.phase !== PHASES.VICTORY_DETERMINATION) {
      return { ended: false };
    }

    // Standard victory: VP >= 25 and highest
    const vpTotals = this._calculateVpTotals(state);
    const sorted = Object.entries(vpTotals).sort((a, b) => b[1] - a[1]);
    const highest = sorted[0];

    if (highest[1] >= VICTORY.standardVp) {
      state.status = 'ended';
      return this._buildEndResult(state, highest[0], 'standard_victory');
    }

    // Domination victory: turn >= 4, +5 gap
    if (state.turn >= VICTORY.dominationMinTurn) {
      const second = sorted[1];
      if (highest[1] - second[1] >= VICTORY.dominationGap) {
        state.status = 'ended';
        return this._buildEndResult(state, highest[0], 'domination_victory');
      }
    }

    // Time limit: after turn 9
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
      // Find highest VP
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
