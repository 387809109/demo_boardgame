/**
 * Message and data validation utilities
 */

const VALID_MESSAGE_TYPES = [
  'JOIN',
  'LEAVE',
  'START_GAME',
  'GAME_ACTION',
  'CHAT_MESSAGE',
  'AI_PLAYER_UPDATE',
  'GAME_SETTINGS_UPDATE',
  'PING'
];

/**
 * Validate a WebSocket message
 * @param {object} message - The message to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }

  if (!message.type || typeof message.type !== 'string') {
    return { valid: false, error: 'Message type is required and must be a string' };
  }

  if (!VALID_MESSAGE_TYPES.includes(message.type)) {
    return { valid: false, error: `Invalid message type: ${message.type}` };
  }

  if (typeof message.timestamp !== 'number' || message.timestamp <= 0) {
    return { valid: false, error: 'Timestamp is required and must be a positive number' };
  }

  if (!message.playerId || typeof message.playerId !== 'string') {
    return { valid: false, error: 'Player ID is required and must be a string' };
  }

  const playerIdValidation = validatePlayerId(message.playerId);
  if (!playerIdValidation.valid) {
    return playerIdValidation;
  }

  return { valid: true };
}

/**
 * Validate a player ID format
 * @param {string} id - The player ID
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validatePlayerId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Player ID must be a non-empty string' };
  }

  if (id.length < 3 || id.length > 64) {
    return { valid: false, error: 'Player ID must be between 3 and 64 characters' };
  }

  // Allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: 'Player ID can only contain letters, numbers, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Validate a room ID format
 * @param {string} id - The room ID
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateRoomId(id) {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Room ID must be a non-empty string' };
  }

  if (id.length < 3 || id.length > 64) {
    return { valid: false, error: 'Room ID must be between 3 and 64 characters' };
  }

  // Allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { valid: false, error: 'Room ID can only contain letters, numbers, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Validate a nickname
 * @param {string} name - The nickname
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateNickname(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nickname must be a non-empty string' };
  }

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, error: 'Nickname must be between 1 and 20 characters' };
  }

  return { valid: true };
}

export default {
  validateMessage,
  validatePlayerId,
  validateRoomId,
  validateNickname
};
