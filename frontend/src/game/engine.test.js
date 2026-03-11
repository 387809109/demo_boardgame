/**
 * Game Engine Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from './engine.js';

// Test subclass that implements abstract methods
class TestGame extends GameEngine {
  initialize(config) {
    return {
      players: config.players,
      currentPlayer: config.players[0].id,
      status: 'playing',
      turnNumber: 1,
      data: config.options?.initialData || {}
    };
  }

  processMove(move, state) {
    if (move.actionType === 'throw') {
      throw new Error('Move processing error');
    }

    return {
      ...state,
      lastMove: move,
      turnNumber: state.turnNumber + 1,
      currentPlayer: this.getNextPlayer(state)
    };
  }

  checkGameEnd(state) {
    if (state.data.shouldEnd) {
      return { ended: true, winner: state.data.winner || state.currentPlayer };
    }
    return { ended: false };
  }

  validateMove(move, state) {
    if (move.actionType === 'invalid') {
      return { valid: false, error: 'Invalid action type' };
    }
    if (move.playerId !== state.currentPlayer) {
      return { valid: false, error: 'Not your turn' };
    }
    return { valid: true };
  }

  enrichMoveForHistory(move, state) {
    return {
      ...move,
      enriched: true,
      turnNumber: state.turnNumber
    };
  }
}

// Test subclass with default validation
class MinimalTestGame extends GameEngine {
  initialize(config) {
    return {
      players: config.players,
      currentPlayer: config.players[0].id,
      status: 'playing'
    };
  }

  processMove(move, state) {
    return { ...state, lastMove: move };
  }

  checkGameEnd(state) {
    return { ended: false };
  }
}

// Helper to create test config
function createTestConfig(overrides = {}) {
  return {
    gameType: 'test',
    maxPlayers: 4,
    players: [
      { id: 'player1', nickname: 'Player 1', isHost: true },
      { id: 'player2', nickname: 'Player 2', isHost: false }
    ],
    options: {},
    ...overrides
  };
}

describe('GameEngine', () => {
  let game;

  beforeEach(() => {
    game = new TestGame('offline');
  });

  describe('constructor', () => {
    it('should initialize with default offline mode', () => {
      const defaultGame = new TestGame();
      expect(defaultGame.mode).toBe('offline');
    });

    it('should initialize with specified mode', () => {
      const onlineGame = new TestGame('online');
      expect(onlineGame.mode).toBe('online');
    });

    it('should initialize with null state', () => {
      expect(game.state).toBeNull();
    });

    it('should initialize with null config', () => {
      expect(game.config).toBeNull();
    });

    it('should initialize with empty history', () => {
      expect(game.history).toEqual([]);
    });

    it('should initialize as not running', () => {
      expect(game.isRunning).toBe(false);
    });
  });

  describe('abstract method enforcement', () => {
    it('should throw error when initialize is not implemented', () => {
      const baseGame = new GameEngine();
      expect(() => baseGame.initialize({})).toThrow('Subclass must implement initialize()');
    });

    it('should throw error when processMove is not implemented', () => {
      const baseGame = new GameEngine();
      expect(() => baseGame.processMove({}, {})).toThrow('Subclass must implement processMove()');
    });

    it('should throw error when checkGameEnd is not implemented', () => {
      const baseGame = new GameEngine();
      expect(() => baseGame.checkGameEnd({})).toThrow('Subclass must implement checkGameEnd()');
    });
  });

  describe('start', () => {
    it('should initialize game state', () => {
      const config = createTestConfig();
      game.start(config);

      expect(game.state).not.toBeNull();
      expect(game.state.players).toEqual(config.players);
      expect(game.state.currentPlayer).toBe('player1');
      expect(game.state.status).toBe('playing');
    });

    it('should store config', () => {
      const config = createTestConfig();
      game.start(config);

      expect(game.config).toBe(config);
    });

    it('should clear history', () => {
      game.history = [{ action: 'old' }];
      game.start(createTestConfig());

      expect(game.history).toEqual([]);
    });

    it('should set isRunning to true', () => {
      game.start(createTestConfig());
      expect(game.isRunning).toBe(true);
    });

    it('should emit gameStarted event', () => {
      const handler = vi.fn();
      game.on('gameStarted', handler);

      game.start(createTestConfig());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(game.state);
    });

    it('should pass options to initialize', () => {
      const config = createTestConfig({
        options: { initialData: { custom: 'value' } }
      });
      game.start(config);

      expect(game.state.data.custom).toBe('value');
    });
  });

  describe('executeMove', () => {
    beforeEach(() => {
      game.start(createTestConfig());
    });

    it('should return error when game is not running', () => {
      game.isRunning = false;

      const result = game.executeMove({ actionType: 'test', playerId: 'player1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game is not running');
    });

    it('should validate move before processing', () => {
      const result = game.executeMove({ actionType: 'invalid', playerId: 'player1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid action type');
    });

    it('should emit invalidMove event for invalid moves', () => {
      const handler = vi.fn();
      game.on('invalidMove', handler);

      game.executeMove({ actionType: 'invalid', playerId: 'player1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].error).toBe('Invalid action type');
    });

    it('should process valid move and update state', () => {
      const move = { actionType: 'test', playerId: 'player1' };
      const result = game.executeMove(move);

      expect(result.success).toBe(true);
      expect(game.state.lastMove).toEqual(move);
      expect(game.state.turnNumber).toBe(2);
    });

    it('should add move to history with timestamp', () => {
      const move = { actionType: 'test', playerId: 'player1' };
      const beforeTime = Date.now();
      game.executeMove(move);
      const afterTime = Date.now();

      expect(game.history).toHaveLength(1);
      expect(game.history[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(game.history[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should enrich move for history', () => {
      const move = { actionType: 'test', playerId: 'player1' };
      game.executeMove(move);

      expect(game.history[0].enriched).toBe(true);
      expect(game.history[0].turnNumber).toBe(1);
    });

    it('should emit stateUpdated event', () => {
      const handler = vi.fn();
      game.on('stateUpdated', handler);

      game.executeMove({ actionType: 'test', playerId: 'player1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(game.state);
    });

    it('should check for game end after move', () => {
      game.state.data = { shouldEnd: true, winner: 'player1' };

      const handler = vi.fn();
      game.on('gameEnded', handler);

      game.executeMove({ actionType: 'test', playerId: 'player1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toEqual({ ended: true, winner: 'player1' });
      expect(game.isRunning).toBe(false);
    });

    it('should catch errors from processMove', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = game.executeMove({ actionType: 'throw', playerId: 'player1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Move processing error');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return new state on success', () => {
      const result = game.executeMove({ actionType: 'test', playerId: 'player1' });

      expect(result.state).toBe(game.state);
      expect(result.state.turnNumber).toBe(2);
    });
  });

  describe('applyStateUpdate', () => {
    beforeEach(() => {
      game.start(createTestConfig());
    });

    it('should update state directly', () => {
      const newState = {
        players: game.state.players,
        currentPlayer: 'player2',
        status: 'playing',
        turnNumber: 5,
        data: {}
      };

      game.applyStateUpdate(newState);

      expect(game.state).toBe(newState);
      expect(game.state.turnNumber).toBe(5);
    });

    it('should emit stateUpdated event', () => {
      const handler = vi.fn();
      game.on('stateUpdated', handler);

      const newState = { ...game.state, turnNumber: 10, data: {} };
      game.applyStateUpdate(newState);

      expect(handler).toHaveBeenCalledWith(newState);
    });

    it('should check for game end', () => {
      const handler = vi.fn();
      game.on('gameEnded', handler);

      const newState = {
        ...game.state,
        data: { shouldEnd: true, winner: 'player2' }
      };
      game.applyStateUpdate(newState);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(game.isRunning).toBe(false);
    });

    it('should set isRunning to false when game ends', () => {
      game.applyStateUpdate({
        ...game.state,
        data: { shouldEnd: true }
      });

      expect(game.isRunning).toBe(false);
    });
  });

  describe('end', () => {
    it('should set isRunning to false', () => {
      game.start(createTestConfig());
      expect(game.isRunning).toBe(true);

      game.end();

      expect(game.isRunning).toBe(false);
    });

    it('should emit gameStopped event', () => {
      game.start(createTestConfig());
      const handler = vi.fn();
      game.on('gameStopped', handler);

      game.end();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('getState', () => {
    it('should return null before game starts', () => {
      expect(game.getState()).toBeNull();
    });

    it('should return current state', () => {
      game.start(createTestConfig());
      const state = game.getState();

      expect(state).toBe(game.state);
      expect(state.currentPlayer).toBe('player1');
    });
  });

  describe('getHistory', () => {
    it('should return empty array before any moves', () => {
      game.start(createTestConfig());
      expect(game.getHistory()).toEqual([]);
    });

    it('should return copy of history', () => {
      game.start(createTestConfig());
      game.executeMove({ actionType: 'test', playerId: 'player1' });

      const history = game.getHistory();

      expect(history).not.toBe(game.history);
      expect(history).toHaveLength(1);
    });

    it('should not allow modifying internal history', () => {
      game.start(createTestConfig());
      game.executeMove({ actionType: 'test', playerId: 'player1' });

      const history = game.getHistory();
      history.push({ fake: 'move' });

      expect(game.history).toHaveLength(1);
    });
  });

  describe('isPlayerTurn', () => {
    it('should return false when state is null', () => {
      expect(game.isPlayerTurn('player1')).toBe(false);
    });

    it('should return true for current player', () => {
      game.start(createTestConfig());
      expect(game.isPlayerTurn('player1')).toBe(true);
    });

    it('should return false for non-current player', () => {
      game.start(createTestConfig());
      expect(game.isPlayerTurn('player2')).toBe(false);
    });
  });

  describe('getNextPlayer', () => {
    it('should return next player in order', () => {
      game.start(createTestConfig());

      const next = game.getNextPlayer(game.state);
      expect(next).toBe('player2');
    });

    it('should wrap around to first player', () => {
      game.start(createTestConfig());
      game.state.currentPlayer = 'player2';

      const next = game.getNextPlayer(game.state);
      expect(next).toBe('player1');
    });

    it('should handle multiple players', () => {
      const config = createTestConfig({
        players: [
          { id: 'p1', nickname: 'P1', isHost: true },
          { id: 'p2', nickname: 'P2', isHost: false },
          { id: 'p3', nickname: 'P3', isHost: false },
          { id: 'p4', nickname: 'P4', isHost: false }
        ]
      });
      game.start(config);

      expect(game.getNextPlayer({ ...game.state, currentPlayer: 'p1' })).toBe('p2');
      expect(game.getNextPlayer({ ...game.state, currentPlayer: 'p2' })).toBe('p3');
      expect(game.getNextPlayer({ ...game.state, currentPlayer: 'p3' })).toBe('p4');
      expect(game.getNextPlayer({ ...game.state, currentPlayer: 'p4' })).toBe('p1');
    });
  });

  describe('validateMove (default implementation)', () => {
    it('should return valid by default', () => {
      const minimalGame = new MinimalTestGame();
      minimalGame.start(createTestConfig());

      const result = minimalGame.validateMove({}, minimalGame.state);
      expect(result.valid).toBe(true);
    });
  });

  describe('enrichMoveForHistory (default implementation)', () => {
    it('should return move unchanged by default', () => {
      const minimalGame = new MinimalTestGame();
      minimalGame.start(createTestConfig());

      const move = { actionType: 'test', playerId: 'player1' };
      const enriched = minimalGame.enrichMoveForHistory(move, minimalGame.state);

      expect(enriched).toBe(move);
    });
  });

  describe('EventEmitter integration', () => {
    it('should support event subscriptions', () => {
      const handler = vi.fn();
      game.on('gameStarted', handler);

      game.start(createTestConfig());
      expect(handler).toHaveBeenCalledTimes(1);

      game.end();
      game.start(createTestConfig());
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should support unsubscribing from events', () => {
      const handler = vi.fn();
      const unsubscribe = game.on('gameStarted', handler);

      game.start(createTestConfig());
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      game.end();
      game.start(createTestConfig());
      // Handler should not be called again after unsubscribe
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple event handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      game.on('stateUpdated', handler1);
      game.on('stateUpdated', handler2);

      game.start(createTestConfig());
      game.executeMove({ actionType: 'test', playerId: 'player1' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });
});
