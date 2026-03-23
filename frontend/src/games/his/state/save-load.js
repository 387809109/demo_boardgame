/**
 * Here I Stand — Save/Load Validation
 *
 * Validates save data before importing to catch corrupted or
 * incompatible saves. Schema-versioned for future migration.
 */

/** Current save schema version */
export const SAVE_VERSION = 1;

/** Maximum save slots per game */
export const MAX_SAVE_SLOTS = 5;

/** Required top-level fields in a save object */
const REQUIRED_SAVE_FIELDS = ['version', 'gameId', 'state'];

/** Required fields in state object (must be non-null) */
const REQUIRED_STATE_FIELDS = [
  'spaces', 'hands', 'deck', 'vp', 'phase',
  'players', 'turn'
];

/** Fields that must exist but may be null (e.g. activePower is null at game start) */
const NULLABLE_STATE_FIELDS = ['activePower'];

/**
 * Validate save data before importing.
 * @param {Object} saveData
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSaveData(saveData) {
  if (!saveData || typeof saveData !== 'object') {
    return { valid: false, error: 'Save data is not an object' };
  }

  // Check top-level fields
  for (const field of REQUIRED_SAVE_FIELDS) {
    if (saveData[field] === undefined || saveData[field] === null) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Check version
  if (typeof saveData.version !== 'number' || saveData.version < 1) {
    return { valid: false, error: 'Invalid save version' };
  }

  // Check gameId
  if (saveData.gameId !== 'his') {
    return { valid: false, error: 'Save is not for Here I Stand' };
  }

  // Check state shape
  const { state } = saveData;
  if (typeof state !== 'object') {
    return { valid: false, error: 'State is not an object' };
  }

  for (const field of REQUIRED_STATE_FIELDS) {
    if (state[field] === undefined || state[field] === null) {
      return { valid: false, error: `State missing required field: ${field}` };
    }
  }

  // Nullable fields: must exist (not undefined) but may be null
  for (const field of NULLABLE_STATE_FIELDS) {
    if (state[field] === undefined) {
      return { valid: false, error: `State missing required field: ${field}` };
    }
  }

  // Check players array
  if (!Array.isArray(state.players) || state.players.length === 0) {
    return { valid: false, error: 'State has no players' };
  }

  // Check hands is object with at least one key
  if (typeof state.hands !== 'object' || Object.keys(state.hands).length === 0) {
    return { valid: false, error: 'State has invalid hands' };
  }

  // Version migration (future)
  // if (saveData.version < SAVE_VERSION) {
  //   return migrateSave(saveData);
  // }

  return { valid: true };
}

/**
 * Generate a slot key from game ID and index.
 * @param {string} gameId
 * @param {number} slotIndex
 * @returns {string}
 */
export function generateSlotKey(gameId, slotIndex) {
  return `${gameId}_slot_${slotIndex}`;
}
