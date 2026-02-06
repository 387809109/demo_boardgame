/**
 * AI/MCP service stub
 * Placeholder for future AI integration
 * @module stubs/ai-service
 */

/**
 * Analyze game state (stub)
 * @param {string} gameId - Game identifier
 * @param {object} state - Current game state
 * @returns {Promise<object>} Analysis result
 */
export async function analyzeGameState(gameId, state) {
  return {
    status: 'not_implemented',
    message: 'AI game analysis is not yet available'
  };
}

/**
 * Get card recommendations (stub)
 * @param {string} gameId - Game identifier
 * @param {object} context - Player context
 * @returns {Promise<object>} Recommendations
 */
export async function getCardRecommendations(gameId, context) {
  return {
    status: 'not_implemented',
    message: 'AI card recommendations are not yet available'
  };
}

/**
 * Process MCP tool call (stub)
 * @param {string} toolName - Tool name
 * @param {object} params - Tool parameters
 * @returns {Promise<object>} Tool result
 */
export async function processMcpToolCall(toolName, params) {
  return {
    status: 'not_implemented',
    message: `MCP tool '${toolName}' is not yet available`
  };
}
