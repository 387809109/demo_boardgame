/**
 * Rule Validator Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleValidator, createCommonRules } from './rules.js';

// Helper function to create test state
function createTestState(overrides = {}) {
  return {
    players: [{ id: 'player1' }, { id: 'player2' }],
    currentPlayer: 'player1',
    status: 'playing',
    ...overrides
  };
}

// Helper function to create test rule
function createTestRule(id, validate = () => true, apply = null) {
  return {
    id,
    description: `Test rule ${id}`,
    validate: (state, move) => validate(state, move),
    errorMessage: `Rule ${id} failed`,
    ...(apply && { apply })
  };
}

describe('RuleValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new RuleValidator();
  });

  describe('constructor', () => {
    it('should initialize with empty rules map', () => {
      expect(validator.rules.size).toBe(0);
      expect(validator.getRuleIds()).toEqual([]);
    });
  });

  describe('addRule', () => {
    it('should add a rule', () => {
      const rule = createTestRule('testRule');
      validator.addRule(rule);

      expect(validator.rules.size).toBe(1);
      expect(validator.rules.has('testRule')).toBe(true);
    });

    it('should add multiple rules', () => {
      validator.addRule(createTestRule('rule1'));
      validator.addRule(createTestRule('rule2'));
      validator.addRule(createTestRule('rule3'));

      expect(validator.rules.size).toBe(3);
    });

    it('should overwrite rule with same id', () => {
      const rule1 = createTestRule('testRule', () => true);
      const rule2 = createTestRule('testRule', () => false);
      rule2.errorMessage = 'Updated error';

      validator.addRule(rule1);
      validator.addRule(rule2);

      expect(validator.rules.size).toBe(1);
      expect(validator.rules.get('testRule').errorMessage).toBe('Updated error');
    });
  });

  describe('removeRule', () => {
    it('should remove an existing rule', () => {
      validator.addRule(createTestRule('testRule'));
      expect(validator.rules.has('testRule')).toBe(true);

      validator.removeRule('testRule');
      expect(validator.rules.has('testRule')).toBe(false);
    });

    it('should handle removing non-existent rule gracefully', () => {
      expect(() => validator.removeRule('nonExistent')).not.toThrow();
    });
  });

  describe('validateMove', () => {
    it('should return valid when no rules exist', () => {
      const result = validator.validateMove({}, createTestState());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid when all rules pass', () => {
      validator.addRule(createTestRule('rule1', () => true));
      validator.addRule(createTestRule('rule2', () => true));

      const result = validator.validateMove({}, createTestState());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid with errors when a rule fails', () => {
      validator.addRule(createTestRule('passingRule', () => true));
      validator.addRule(createTestRule('failingRule', () => false));

      const result = validator.validateMove({}, createTestState());
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule failingRule failed');
    });

    it('should collect errors from multiple failing rules', () => {
      validator.addRule(createTestRule('fail1', () => false));
      validator.addRule(createTestRule('fail2', () => false));

      const result = validator.validateMove({}, createTestState());
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Rule fail1 failed');
      expect(result.errors).toContain('Rule fail2 failed');
    });

    it('should pass move and state to validation function', () => {
      const validateFn = vi.fn().mockReturnValue(true);
      validator.addRule({
        id: 'testRule',
        description: 'Test',
        validate: validateFn,
        errorMessage: 'Error'
      });

      const move = { actionType: 'test', playerId: 'player1' };
      const state = createTestState();

      validator.validateMove(move, state);

      expect(validateFn).toHaveBeenCalledWith(state, move);
    });

    it('should catch and log errors from validation functions', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Validation error');

      validator.addRule({
        id: 'throwingRule',
        description: 'Test',
        validate: () => { throw error; },
        errorMessage: 'Should not see this'
      });

      const result = validator.validateMove({}, createTestState());

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule validation error: throwingRule');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('validateRule', () => {
    it('should validate a single passing rule', () => {
      validator.addRule(createTestRule('testRule', () => true));

      const result = validator.validateRule('testRule', {}, createTestState());
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate a single failing rule', () => {
      validator.addRule(createTestRule('testRule', () => false));

      const result = validator.validateRule('testRule', {}, createTestState());
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rule testRule failed');
    });

    it('should return error for non-existent rule', () => {
      const result = validator.validateRule('nonExistent', {}, createTestState());
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rule not found: nonExistent');
    });

    it('should catch errors from validation function', () => {
      validator.addRule({
        id: 'throwingRule',
        description: 'Test',
        validate: () => { throw new Error('Validation failed'); },
        errorMessage: 'Error'
      });

      const result = validator.validateRule('throwingRule', {}, createTestState());
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Validation failed');
    });
  });

  describe('applyRule', () => {
    it('should apply rule effect to state', () => {
      const applyFn = (state) => ({ ...state, modified: true });
      validator.addRule(createTestRule('testRule', () => true, applyFn));

      const state = createTestState();
      const newState = validator.applyRule('testRule', state);

      expect(newState.modified).toBe(true);
      expect(state.modified).toBeUndefined(); // Original unchanged
    });

    it('should return original state for rule without apply function', () => {
      validator.addRule(createTestRule('testRule', () => true));

      const state = createTestState();
      const newState = validator.applyRule('testRule', state);

      expect(newState).toBe(state);
    });

    it('should return original state for non-existent rule', () => {
      const state = createTestState();
      const newState = validator.applyRule('nonExistent', state);

      expect(newState).toBe(state);
    });

    it('should catch errors from apply function and return original state', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const applyFn = () => { throw new Error('Apply error'); };
      validator.addRule(createTestRule('throwingRule', () => true, applyFn));

      const state = createTestState();
      const newState = validator.applyRule('throwingRule', state);

      expect(newState).toBe(state);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getRuleIds', () => {
    it('should return empty array when no rules', () => {
      expect(validator.getRuleIds()).toEqual([]);
    });

    it('should return all rule IDs', () => {
      validator.addRule(createTestRule('rule1'));
      validator.addRule(createTestRule('rule2'));
      validator.addRule(createTestRule('rule3'));

      const ids = validator.getRuleIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('rule1');
      expect(ids).toContain('rule2');
      expect(ids).toContain('rule3');
    });
  });

  describe('clear', () => {
    it('should remove all rules', () => {
      validator.addRule(createTestRule('rule1'));
      validator.addRule(createTestRule('rule2'));
      expect(validator.rules.size).toBe(2);

      validator.clear();

      expect(validator.rules.size).toBe(0);
      expect(validator.getRuleIds()).toEqual([]);
    });

    it('should work on empty validator', () => {
      expect(() => validator.clear()).not.toThrow();
    });
  });
});

describe('createCommonRules', () => {
  let commonRules;

  beforeEach(() => {
    commonRules = createCommonRules();
  });

  it('should return object with playerTurn, gameInProgress, and playerExists rules', () => {
    expect(commonRules).toHaveProperty('playerTurn');
    expect(commonRules).toHaveProperty('gameInProgress');
    expect(commonRules).toHaveProperty('playerExists');
  });

  describe('playerTurn rule', () => {
    it('should have correct structure', () => {
      const rule = commonRules.playerTurn;
      expect(rule.id).toBe('playerTurn');
      expect(rule.description).toBeDefined();
      expect(typeof rule.validate).toBe('function');
      expect(rule.errorMessage).toBeDefined();
    });

    it('should validate when it is the player turn', () => {
      const state = { currentPlayer: 'player1' };
      const move = { playerId: 'player1' };
      expect(commonRules.playerTurn.validate(state, move)).toBe(true);
    });

    it('should fail when it is not the player turn', () => {
      const state = { currentPlayer: 'player1' };
      const move = { playerId: 'player2' };
      expect(commonRules.playerTurn.validate(state, move)).toBe(false);
    });
  });

  describe('gameInProgress rule', () => {
    it('should have correct structure', () => {
      const rule = commonRules.gameInProgress;
      expect(rule.id).toBe('gameInProgress');
      expect(rule.description).toBeDefined();
      expect(typeof rule.validate).toBe('function');
      expect(rule.errorMessage).toBeDefined();
    });

    it('should validate when game status is playing', () => {
      const state = { status: 'playing' };
      expect(commonRules.gameInProgress.validate(state, {})).toBe(true);
    });

    it('should fail when game status is not playing', () => {
      expect(commonRules.gameInProgress.validate({ status: 'waiting' }, {})).toBe(false);
      expect(commonRules.gameInProgress.validate({ status: 'ended' }, {})).toBe(false);
      expect(commonRules.gameInProgress.validate({ status: 'paused' }, {})).toBe(false);
    });
  });

  describe('playerExists rule', () => {
    it('should have correct structure', () => {
      const rule = commonRules.playerExists;
      expect(rule.id).toBe('playerExists');
      expect(rule.description).toBeDefined();
      expect(typeof rule.validate).toBe('function');
      expect(rule.errorMessage).toBeDefined();
    });

    it('should validate when player exists in game', () => {
      const state = { players: [{ id: 'player1' }, { id: 'player2' }] };
      const move = { playerId: 'player1' };
      expect(commonRules.playerExists.validate(state, move)).toBe(true);
    });

    it('should fail when player does not exist in game', () => {
      const state = { players: [{ id: 'player1' }, { id: 'player2' }] };
      const move = { playerId: 'player3' };
      expect(commonRules.playerExists.validate(state, move)).toBe(false);
    });

    it('should fail with empty players array', () => {
      const state = { players: [] };
      const move = { playerId: 'player1' };
      expect(commonRules.playerExists.validate(state, move)).toBe(false);
    });
  });

  describe('integration with RuleValidator', () => {
    it('should work when added to RuleValidator', () => {
      const validator = new RuleValidator();
      Object.values(commonRules).forEach(rule => validator.addRule(rule));

      const state = {
        currentPlayer: 'player1',
        status: 'playing',
        players: [{ id: 'player1' }, { id: 'player2' }]
      };
      const validMove = { playerId: 'player1' };
      const invalidMove = { playerId: 'player3' };

      expect(validator.validateMove(validMove, state).valid).toBe(true);
      expect(validator.validateMove(invalidMove, state).valid).toBe(false);
    });
  });
});
