/**
 * Game Engine - Base class for all games
 * @module game/engine
 */

import { EventEmitter } from '../utils/event-emitter.js';

/**
 * @typedef {Object} GameState
 * @property {string} currentPlayer - Current player ID
 * @property {number} turnNumber - Current turn number
 * @property {Array<Player>} players - List of players
 * @property {Object} gameSpecificData - Game-specific state
 */

/**
 * @typedef {Object} Player
 * @property {string} id - Player ID
 * @property {string} nickname - Player nickname
 * @property {boolean} isHost - Whether this player is the host
 */

/**
 * @typedef {Object} GameConfig
 * @property {string} gameType - Type of game
 * @property {number} maxPlayers - Maximum players allowed
 * @property {Array<Player>} players - List of players
 * @property {Object} [options] - Game-specific options
 */

/**
 * @typedef {Object} Move
 * @property {string} actionType - Type of action
 * @property {Object} actionData - Action-specific data
 */

/**
 * Base Game Engine class - extend this for each game
 */
export class GameEngine extends EventEmitter {
  /**
   * @param {'offline'|'online'} mode - Game mode
   */
  constructor(mode = 'offline') {
    super();

    /** @type {'offline'|'online'} */
    this.mode = mode;

    /** @type {GameState|null} */
    this.state = null;

    /** @type {Object|null} */
    this.config = null;

    /** @type {Array<Move>} */
    this.history = [];

    /** @type {boolean} */
    this.isRunning = false;
  }

  /**
   * Initialize the game with config
   * @param {GameConfig} config - Game configuration
   * @returns {GameState} Initial game state
   */
  initialize(config) {
    throw new Error('Subclass must implement initialize()');
  }

  /**
   * Process a player move
   * @param {Move} move - The move to process
   * @param {GameState} state - Current game state
   * @returns {GameState} New game state
   */
  processMove(move, state) {
    throw new Error('Subclass must implement processMove()');
  }

  /**
   * Check if the game has ended
   * @param {GameState} state - Current game state
   * @returns {{ ended: boolean, winner?: string, rankings?: Array }}
   */
  checkGameEnd(state) {
    throw new Error('Subclass must implement checkGameEnd()');
  }

  /**
   * Validate a move before processing
   * @param {Move} move - The move to validate
   * @param {GameState} state - Current game state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMove(move, state) {
    return { valid: true };
  }

  /**
   * Get the next player in turn order
   * @param {GameState} state - Current game state
   * @returns {string} Next player ID
   */
  getNextPlayer(state) {
    const currentIndex = state.players.findIndex(p => p.id === state.currentPlayer);
    const nextIndex = (currentIndex + 1) % state.players.length;
    return state.players[nextIndex].id;
  }

  /**
   * Enrich move data for history storage
   * Override in subclass to add game-specific data (e.g., card details)
   * @param {Move} move - The move
   * @param {GameState} state - Current state before move
   * @returns {Move} Enriched move
   */
  enrichMoveForHistory(move, state) {
    return move;
  }

  /**
   * Start the game
   * @param {GameConfig} config - Game configuration
   */
  start(config) {
    this.config = config;
    this.state = this.initialize(config);
    this.history = [];
    this.isRunning = true;

    this.emit('gameStarted', this.state);
  }

  /**
   * Execute a move
   * @param {Move} move - The move to execute
   * @returns {{ success: boolean, error?: string, state?: GameState }}
   */
  executeMove(move) {
    if (!this.isRunning) {
      return { success: false, error: 'Game is not running' };
    }

    const validation = this.validateMove(move, this.state);
    if (!validation.valid) {
      this.emit('invalidMove', { move, error: validation.error });
      return { success: false, error: validation.error };
    }

    try {
      // Enrich move data before processing (for history)
      const enrichedMove = this.enrichMoveForHistory(move, this.state);

      const newState = this.processMove(move, this.state);
      this.history.push({ ...enrichedMove, timestamp: Date.now() });
      this.state = newState;

      this.emit('stateUpdated', newState);

      const endCheck = this.checkGameEnd(newState);
      if (endCheck.ended) {
        this.isRunning = false;
        this.emit('gameEnded', endCheck);
      }

      return { success: true, state: newState };
    } catch (err) {
      console.error('Error processing move:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Apply state update from network
   * @param {GameState} newState - State from server
   */
  applyStateUpdate(newState) {
    this.state = newState;
    this.emit('stateUpdated', newState);

    const endCheck = this.checkGameEnd(newState);
    if (endCheck.ended) {
      this.isRunning = false;
      this.emit('gameEnded', endCheck);
    }
  }

  /**
   * End the game
   */
  end() {
    this.isRunning = false;
    this.emit('gameStopped');
  }

  /**
   * Get current state
   * @returns {GameState|null}
   */
  getState() {
    return this.state;
  }

  /**
   * Get game history
   * @returns {Array<Move>}
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Check if it's a specific player's turn
   * @param {string} playerId - Player ID to check
   * @returns {boolean}
   */
  isPlayerTurn(playerId) {
    return this.state?.currentPlayer === playerId;
  }
}

export default GameEngine;
