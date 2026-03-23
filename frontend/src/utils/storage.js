/**
 * Storage utilities for config and session data
 * @module utils/storage
 */

const CONFIG_KEY = 'boardgame_config';
const ROOM_CREATE_PRESET_KEY = 'boardgame_room_create_presets';

/**
 * Get default configuration
 * @returns {Object}
 */
export function getDefaultConfig() {
  return {
    graphics: {
      resolution: 'auto',
      fullscreen: false,
      quality: 'high'
    },
    audio: {
      master: 80,
      sfx: 70,
      music: 50
    },
    game: {
      language: 'zh-CN',
      defaultNickname: `玩家${Math.floor(Math.random() * 1000)}`
    },
    analytics: {
      enabled: false
    }
  };
}

/**
 * Save configuration to localStorage
 * @param {Object} config - Configuration object
 */
export function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

/**
 * Load configuration from localStorage
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    if (data) {
      return { ...getDefaultConfig(), ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return getDefaultConfig();
}

/**
 * Update specific config values
 * @param {Object} updates - Partial config updates
 */
export function updateConfig(updates) {
  const current = loadConfig();
  const merged = deepMerge(current, updates);
  saveConfig(merged);
  return merged;
}

/**
 * Save session data to sessionStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 */
export function saveSessionData(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to save session data:', err);
  }
}

/**
 * Load session data from sessionStorage
 * @param {string} key - Storage key
 * @returns {*} Stored value or null
 */
export function loadSessionData(key) {
  try {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to load session data:', err);
    return null;
  }
}

/**
 * Clear session data
 * @param {string} [key] - Specific key to clear, or all if omitted
 */
export function clearSessionData(key) {
  if (key) {
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.clear();
  }
}

/**
 * Save room-create preset for a specific game+mode key
 * @param {string} key - Preset key (e.g. "local:uno")
 * @param {Object} preset - Preset payload
 */
export function saveRoomCreatePreset(key, preset) {
  if (!key || !preset || typeof preset !== 'object') {
    return;
  }

  try {
    const data = localStorage.getItem(ROOM_CREATE_PRESET_KEY);
    const allPresets = data ? JSON.parse(data) : {};
    const nextPresets = (allPresets && typeof allPresets === 'object')
      ? { ...allPresets, [key]: preset }
      : { [key]: preset };

    localStorage.setItem(ROOM_CREATE_PRESET_KEY, JSON.stringify(nextPresets));
  } catch (err) {
    console.error('Failed to save room-create preset:', err);
  }
}

/**
 * Load room-create preset for a specific game+mode key
 * @param {string} key - Preset key (e.g. "local:uno")
 * @returns {Object|null} Preset payload or null
 */
export function loadRoomCreatePreset(key) {
  if (!key) {
    return null;
  }

  try {
    const data = localStorage.getItem(ROOM_CREATE_PRESET_KEY);
    if (!data) {
      return null;
    }

    const allPresets = JSON.parse(data);
    if (!allPresets || typeof allPresets !== 'object') {
      return null;
    }

    const preset = allPresets[key];
    return preset && typeof preset === 'object' ? preset : null;
  } catch (err) {
    console.error('Failed to load room-create preset:', err);
    return null;
  }
}

/**
 * Export config to downloadable JSON file
 */
export function exportConfig() {
  const config = loadConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'boardgame-config.json';
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Import config from file
 * @param {File} file - JSON file to import
 * @returns {Promise<Object>} Imported configuration
 */
export function importConfig(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        const merged = { ...getDefaultConfig(), ...config };
        saveConfig(merged);
        resolve(merged);
      } catch (err) {
        reject(new Error('Invalid config file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ── Game Save/Load ──────────────────────────────────────────────────

const GAME_SAVE_PREFIX = 'boardgame_save_';
const AUTO_SAVE_PREFIX = 'boardgame_autosave_';

/**
 * Save game state to a named slot (localStorage).
 * @param {string} slotKey - Slot identifier (e.g. "his_slot_0")
 * @param {Object} saveData - Serializable save object
 */
export function saveGameSlot(slotKey, saveData) {
  try {
    localStorage.setItem(
      GAME_SAVE_PREFIX + slotKey,
      JSON.stringify(saveData)
    );
  } catch (err) {
    console.error('Failed to save game slot:', err);
  }
}

/**
 * Load game state from a named slot.
 * @param {string} slotKey - Slot identifier
 * @returns {Object|null} Save data or null
 */
export function loadGameSlot(slotKey) {
  try {
    const data = localStorage.getItem(GAME_SAVE_PREFIX + slotKey);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to load game slot:', err);
    return null;
  }
}

/**
 * List all saved game slots for a given game ID.
 * Returns metadata only (no full state) sorted by savedAt descending.
 * @param {string} gameId - Game type (e.g. "his")
 * @returns {Array<{ slotKey: string, label: string, savedAt: number, metadata: Object }>}
 */
export function listGameSlots(gameId) {
  const results = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key.startsWith(GAME_SAVE_PREFIX)) continue;
      const slotKey = key.slice(GAME_SAVE_PREFIX.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const save = JSON.parse(raw);
      if (save.gameId !== gameId) continue;
      results.push({
        slotKey,
        label: save.label || slotKey,
        savedAt: save.savedAt || 0,
        metadata: save.metadata || {}
      });
    }
  } catch (err) {
    console.error('Failed to list game slots:', err);
  }
  results.sort((a, b) => b.savedAt - a.savedAt);
  return results;
}

/**
 * Delete a saved game slot.
 * @param {string} slotKey - Slot identifier
 */
export function deleteGameSlot(slotKey) {
  try {
    localStorage.removeItem(GAME_SAVE_PREFIX + slotKey);
  } catch (err) {
    console.error('Failed to delete game slot:', err);
  }
}

/**
 * Export save data to a downloadable JSON file.
 * @param {Object} saveData - Save object
 * @param {string} [filename] - Download filename
 */
export function exportSaveFile(saveData, filename) {
  const blob = new Blob(
    [JSON.stringify(saveData, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'game-save.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import save data from a JSON file.
 * @param {File} file - JSON file to import
 * @returns {Promise<Object>} Parsed save data
 */
export function importSaveFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(new Error('Invalid save file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Auto-save game to sessionStorage (crash recovery).
 * @param {string} gameId - Game type
 * @param {Object} saveData - Save object
 */
export function autoSaveGame(gameId, saveData) {
  try {
    sessionStorage.setItem(
      AUTO_SAVE_PREFIX + gameId,
      JSON.stringify(saveData)
    );
  } catch (err) {
    console.error('Failed to auto-save:', err);
  }
}

/**
 * Load auto-save from sessionStorage.
 * @param {string} gameId - Game type
 * @returns {Object|null} Save data or null
 */
export function loadAutoSave(gameId) {
  try {
    const data = sessionStorage.getItem(AUTO_SAVE_PREFIX + gameId);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to load auto-save:', err);
    return null;
  }
}

/**
 * Clear auto-save for a game.
 * @param {string} gameId - Game type
 */
export function clearAutoSave(gameId) {
  try {
    sessionStorage.removeItem(AUTO_SAVE_PREFIX + gameId);
  } catch (err) {
    console.error('Failed to clear auto-save:', err);
  }
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export default {
  getDefaultConfig,
  saveConfig,
  loadConfig,
  updateConfig,
  saveSessionData,
  loadSessionData,
  clearSessionData,
  saveRoomCreatePreset,
  loadRoomCreatePreset,
  exportConfig,
  importConfig,
  saveGameSlot,
  loadGameSlot,
  listGameSlots,
  deleteGameSlot,
  exportSaveFile,
  importSaveFile,
  autoSaveGame,
  loadAutoSave,
  clearAutoSave
};
