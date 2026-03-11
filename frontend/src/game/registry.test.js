/**
 * Game Registry Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerGame,
  unregisterGame,
  createGame,
  getGameConfig,
  getGameList,
  hasGame,
  getGameCount,
  clearRegistry
} from './registry.js';

// Mock game class for testing
class MockGame {
  constructor(mode) {
    this.mode = mode;
    this.initialized = true;
  }
}

class AnotherMockGame {
  constructor(mode) {
    this.mode = mode;
    this.type = 'another';
  }
}

const mockConfig = {
  name: 'Mock Game',
  minPlayers: 2,
  maxPlayers: 4,
  supportsAI: true
};

const anotherMockConfig = {
  name: 'Another Game',
  minPlayers: 3,
  maxPlayers: 6,
  supportsAI: false
};

describe('Game Registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    clearRegistry();
  });

  describe('registerGame', () => {
    it('should register a game type', () => {
      registerGame('mock-game', MockGame, mockConfig);
      expect(hasGame('mock-game')).toBe(true);
    });

    it('should register multiple game types', () => {
      registerGame('mock-game', MockGame, mockConfig);
      registerGame('another-game', AnotherMockGame, anotherMockConfig);
      expect(hasGame('mock-game')).toBe(true);
      expect(hasGame('another-game')).toBe(true);
      expect(getGameCount()).toBe(2);
    });

    it('should overwrite existing registration with warning', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registerGame('mock-game', MockGame, mockConfig);
      registerGame('mock-game', AnotherMockGame, anotherMockConfig);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Game "mock-game" is already registered, overwriting'
      );

      // Verify it was overwritten
      const config = getGameConfig('mock-game');
      expect(config.name).toBe('Another Game');

      consoleSpy.mockRestore();
    });
  });

  describe('unregisterGame', () => {
    it('should remove a registered game', () => {
      registerGame('mock-game', MockGame, mockConfig);
      expect(hasGame('mock-game')).toBe(true);

      unregisterGame('mock-game');
      expect(hasGame('mock-game')).toBe(false);
    });

    it('should handle unregistering non-existent game gracefully', () => {
      // Should not throw
      expect(() => unregisterGame('non-existent')).not.toThrow();
    });
  });

  describe('createGame', () => {
    it('should create a game instance with default mode', () => {
      registerGame('mock-game', MockGame, mockConfig);
      const game = createGame('mock-game');

      expect(game).toBeInstanceOf(MockGame);
      expect(game.mode).toBe('offline');
      expect(game.initialized).toBe(true);
    });

    it('should create a game instance with specified mode', () => {
      registerGame('mock-game', MockGame, mockConfig);
      const game = createGame('mock-game', 'online');

      expect(game).toBeInstanceOf(MockGame);
      expect(game.mode).toBe('online');
    });

    it('should throw error for unregistered game type', () => {
      expect(() => createGame('non-existent')).toThrow(
        'Game type "non-existent" is not registered'
      );
    });

    it('should create correct game type when multiple are registered', () => {
      registerGame('mock-game', MockGame, mockConfig);
      registerGame('another-game', AnotherMockGame, anotherMockConfig);

      const game1 = createGame('mock-game');
      const game2 = createGame('another-game');

      expect(game1).toBeInstanceOf(MockGame);
      expect(game2).toBeInstanceOf(AnotherMockGame);
      expect(game2.type).toBe('another');
    });
  });

  describe('getGameConfig', () => {
    it('should return config for registered game', () => {
      registerGame('mock-game', MockGame, mockConfig);
      const config = getGameConfig('mock-game');

      expect(config).toEqual(mockConfig);
      expect(config.name).toBe('Mock Game');
      expect(config.minPlayers).toBe(2);
      expect(config.maxPlayers).toBe(4);
      expect(config.supportsAI).toBe(true);
    });

    it('should return null for unregistered game', () => {
      const config = getGameConfig('non-existent');
      expect(config).toBeNull();
    });
  });

  describe('getGameList', () => {
    it('should return empty array when no games registered', () => {
      const list = getGameList();
      expect(list).toEqual([]);
    });

    it('should return list of all registered games with id', () => {
      registerGame('mock-game', MockGame, mockConfig);
      registerGame('another-game', AnotherMockGame, anotherMockConfig);

      const list = getGameList();

      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({ id: 'mock-game', ...mockConfig });
      expect(list[1]).toEqual({ id: 'another-game', ...anotherMockConfig });
    });

    it('should include id in each game entry', () => {
      registerGame('test-id', MockGame, mockConfig);
      const list = getGameList();

      expect(list[0].id).toBe('test-id');
    });
  });

  describe('hasGame', () => {
    it('should return true for registered game', () => {
      registerGame('mock-game', MockGame, mockConfig);
      expect(hasGame('mock-game')).toBe(true);
    });

    it('should return false for unregistered game', () => {
      expect(hasGame('non-existent')).toBe(false);
    });

    it('should return false after game is unregistered', () => {
      registerGame('mock-game', MockGame, mockConfig);
      unregisterGame('mock-game');
      expect(hasGame('mock-game')).toBe(false);
    });
  });

  describe('getGameCount', () => {
    it('should return 0 when no games registered', () => {
      expect(getGameCount()).toBe(0);
    });

    it('should return correct count of registered games', () => {
      registerGame('game1', MockGame, mockConfig);
      expect(getGameCount()).toBe(1);

      registerGame('game2', AnotherMockGame, anotherMockConfig);
      expect(getGameCount()).toBe(2);
    });

    it('should decrease after unregistering', () => {
      registerGame('game1', MockGame, mockConfig);
      registerGame('game2', AnotherMockGame, anotherMockConfig);
      expect(getGameCount()).toBe(2);

      unregisterGame('game1');
      expect(getGameCount()).toBe(1);
    });
  });

  describe('clearRegistry', () => {
    it('should remove all registered games', () => {
      registerGame('game1', MockGame, mockConfig);
      registerGame('game2', AnotherMockGame, anotherMockConfig);
      expect(getGameCount()).toBe(2);

      clearRegistry();

      expect(getGameCount()).toBe(0);
      expect(hasGame('game1')).toBe(false);
      expect(hasGame('game2')).toBe(false);
    });

    it('should work on empty registry', () => {
      expect(() => clearRegistry()).not.toThrow();
      expect(getGameCount()).toBe(0);
    });
  });
});
