/**
 * Validation utilities
 * @module utils/validators
 */

/**
 * Valid message types from client
 */
const CLIENT_MESSAGE_TYPES = ['JOIN', 'LEAVE', 'START_GAME', 'GAME_ACTION', 'CHAT_MESSAGE', 'PING'];

/**
 * Valid message types from server
 */
const SERVER_MESSAGE_TYPES = [
  'PLAYER_JOINED', 'PLAYER_LEFT', 'GAME_STARTED',
  'GAME_STATE_UPDATE', 'GAME_ENDED', 'CHAT_MESSAGE_BROADCAST',
  'PONG', 'ERROR'
];

/**
 * Validate WebSocket message format
 * @param {Object} message - Message to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }

  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Message must have a type string' };
  }

  const allTypes = [...CLIENT_MESSAGE_TYPES, ...SERVER_MESSAGE_TYPES];
  if (!allTypes.includes(message.type)) {
    return { valid: false, error: `Invalid message type: ${message.type}` };
  }

  if (!message.timestamp || typeof message.timestamp !== 'number') {
    return { valid: false, error: 'Message must have a numeric timestamp' };
  }

  if (!message.playerId || typeof message.playerId !== 'string') {
    return { valid: false, error: 'Message must have a playerId string' };
  }

  return { valid: true };
}

/**
 * Validate player ID format
 * @param {string} id - Player ID
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePlayerId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Player ID must be a non-empty string' };
  }

  if (id.length < 5 || id.length > 50) {
    return { valid: false, error: 'Player ID must be 5-50 characters' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: 'Player ID can only contain letters, numbers, underscores and dashes' };
  }

  return { valid: true };
}

/**
 * Validate nickname
 * @param {string} name - Nickname
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNickname(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nickname must be a non-empty string' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, error: 'Nickname must be 1-20 characters' };
  }

  // Allow Unicode (Chinese, etc) but block some problematic chars
  if (/[<>\"\'\\]/.test(trimmed)) {
    return { valid: false, error: 'Nickname contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validate room ID format
 * @param {string} id - Room ID
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRoomId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Room ID must be a non-empty string' };
  }

  if (id.length < 4 || id.length > 20) {
    return { valid: false, error: 'Room ID must be 4-20 characters' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: 'Room ID can only contain letters, numbers, underscores and dashes' };
  }

  return { valid: true };
}

/**
 * Validate IP address (IPv4)
 * @param {string} ip - IP address
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateIPAddress(ip) {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address must be a non-empty string' };
  }

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return { valid: false, error: 'Invalid IP address format' };
  }

  const parts = ip.split('.').map(Number);
  if (parts.some(n => n < 0 || n > 255)) {
    return { valid: false, error: 'IP address octets must be 0-255' };
  }

  return { valid: true };
}

/**
 * Validate game config
 * @param {Object} config - Game configuration
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateGameConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Config must be an object' };
  }

  if (!config.gameType || typeof config.gameType !== 'string') {
    return { valid: false, error: 'Config must have a gameType string' };
  }

  if (config.maxPlayers !== undefined) {
    if (!Number.isInteger(config.maxPlayers) || config.maxPlayers < 2 || config.maxPlayers > 20) {
      return { valid: false, error: 'maxPlayers must be an integer between 2 and 20' };
    }
  }

  return { valid: true };
}

/**
 * Validate chat message
 * @param {string} message - Chat message
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateChatMessage(message) {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Chat message must be a non-empty string' };
  }

  const trimmed = message.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: 'Chat message cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Chat message too long (max 500 characters)' };
  }

  return { valid: true };
}

export default {
  validateMessage,
  validatePlayerId,
  validateNickname,
  validateRoomId,
  validateIPAddress,
  validateGameConfig,
  validateChatMessage
};
