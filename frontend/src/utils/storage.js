/**
 * Storage utilities for config and session data
 * @module utils/storage
 */

const CONFIG_KEY = 'boardgame_config';

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
  exportConfig,
  importConfig
};
