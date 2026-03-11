/**
 * Game Registry - Register and create game instances
 * @module game/registry
 */

/** @type {Map<string, { GameClass: Function, config: Object }>} */
const gameRegistry = new Map();

/**
 * Register a game type
 * @param {string} id - Game type ID
 * @param {Function} GameClass - Game class constructor
 * @param {Object} config - Game configuration (from config.json)
 */
export function registerGame(id, GameClass, config) {
  if (gameRegistry.has(id)) {
    console.warn(`Game "${id}" is already registered, overwriting`);
  }

  gameRegistry.set(id, { GameClass, config });
}

/**
 * Unregister a game type
 * @param {string} id - Game type ID
 */
export function unregisterGame(id) {
  gameRegistry.delete(id);
}

/**
 * Create a game instance
 * @param {string} gameType - Game type ID
 * @param {'offline'|'online'} [mode='offline'] - Game mode
 * @returns {Object} Game instance
 */
export function createGame(gameType, mode = 'offline') {
  const entry = gameRegistry.get(gameType);

  if (!entry) {
    throw new Error(`Game type "${gameType}" is not registered`);
  }

  return new entry.GameClass(mode);
}

/**
 * Get game configuration
 * @param {string} gameType - Game type ID
 * @returns {Object|null} Game configuration
 */
export function getGameConfig(gameType) {
  const entry = gameRegistry.get(gameType);
  return entry ? entry.config : null;
}

/**
 * Get list of all registered games
 * @returns {Array<Object>} List of game configs
 */
export function getGameList() {
  const games = [];

  for (const [id, entry] of gameRegistry) {
    games.push({
      id,
      ...entry.config
    });
  }

  return games;
}

/**
 * Check if a game type is registered
 * @param {string} gameType - Game type ID
 * @returns {boolean}
 */
export function hasGame(gameType) {
  return gameRegistry.has(gameType);
}

/**
 * Get registered game count
 * @returns {number}
 */
export function getGameCount() {
  return gameRegistry.size;
}

/**
 * Clear all registered games
 */
export function clearRegistry() {
  gameRegistry.clear();
}

export default {
  registerGame,
  unregisterGame,
  createGame,
  getGameConfig,
  getGameList,
  hasGame,
  getGameCount,
  clearRegistry
};
