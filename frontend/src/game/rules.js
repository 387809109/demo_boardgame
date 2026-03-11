/**
 * Rule Validator - Generic rule validation framework
 * @module game/rules
 */

/**
 * @typedef {Object} Rule
 * @property {string} id - Rule identifier
 * @property {string} description - Rule description
 * @property {Function} validate - Validation function (state, move) => boolean
 * @property {string} errorMessage - Error message when rule fails
 */

/**
 * Generic Rule Validator class
 */
export class RuleValidator {
  constructor() {
    /** @type {Map<string, Rule>} */
    this.rules = new Map();
  }

  /**
   * Add a rule
   * @param {Rule} rule - Rule to add
   */
  addRule(rule) {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a rule
   * @param {string} ruleId - Rule ID to remove
   */
  removeRule(ruleId) {
    this.rules.delete(ruleId);
  }

  /**
   * Validate a move against all rules
   * @param {Object} move - Move to validate
   * @param {Object} state - Current game state
   * @returns {{ valid: boolean, errors: Array<string> }}
   */
  validateMove(move, state) {
    const errors = [];

    for (const rule of this.rules.values()) {
      try {
        if (!rule.validate(state, move)) {
          errors.push(rule.errorMessage);
        }
      } catch (err) {
        console.error(`Rule ${rule.id} threw error:`, err);
        errors.push(`Rule validation error: ${rule.id}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single rule
   * @param {string} ruleId - Rule ID
   * @param {Object} move - Move to validate
   * @param {Object} state - Current game state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateRule(ruleId, move, state) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return { valid: false, error: `Rule not found: ${ruleId}` };
    }

    try {
      const result = rule.validate(state, move);
      return {
        valid: result,
        error: result ? undefined : rule.errorMessage
      };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  /**
   * Apply a rule's effect to state
   * @param {string} ruleId - Rule ID
   * @param {Object} state - Current game state
   * @returns {Object} New state after applying rule
   */
  applyRule(ruleId, state) {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.apply) {
      return state;
    }

    try {
      return rule.apply(state);
    } catch (err) {
      console.error(`Error applying rule ${ruleId}:`, err);
      return state;
    }
  }

  /**
   * Get all rule IDs
   * @returns {Array<string>}
   */
  getRuleIds() {
    return Array.from(this.rules.keys());
  }

  /**
   * Clear all rules
   */
  clear() {
    this.rules.clear();
  }
}

/**
 * Create common game rules
 * @returns {Object} Common rules
 */
export function createCommonRules() {
  return {
    /**
     * Rule: It must be the player's turn
     */
    playerTurn: {
      id: 'playerTurn',
      description: 'Player can only act on their turn',
      validate: (state, move) => state.currentPlayer === move.playerId,
      errorMessage: '不是你的回合'
    },

    /**
     * Rule: Game must be in progress
     */
    gameInProgress: {
      id: 'gameInProgress',
      description: 'Game must be in progress',
      validate: (state) => state.status === 'playing',
      errorMessage: '游戏未在进行中'
    },

    /**
     * Rule: Player must be in the game
     */
    playerExists: {
      id: 'playerExists',
      description: 'Player must be in the game',
      validate: (state, move) => state.players.some(p => p.id === move.playerId),
      errorMessage: '玩家不在游戏中'
    }
  };
}

export default RuleValidator;
