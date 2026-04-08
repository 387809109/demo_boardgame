/**
 * HIS shared theme — power colors, labels, and display helpers
 * Single source of truth for all HIS UI files.
 * @module games/his/ui/his-theme
 */

// ── Power Colors (matches config.json canonical values) ─────────

/** @type {Record<string, string>} */
export const POWER_COLORS = {
  ottoman:    '#2e7d32',
  hapsburg:   '#c6873e',
  england:    '#c62828',
  france:     '#1565c0',
  papacy:     '#7b1fa2',
  protestant: '#2c3e50',
};

/** Minor / vassal powers */
export const MINOR_COLORS = {
  independent: '#9e9e9e',
  hungary:     '#8d6e63',
  scotland:    '#42a5f5',
  venice:      '#00838f',
  genoa:       '#d84315',
};

/** All power colors (major + minor) */
export const ALL_POWER_COLORS = { ...POWER_COLORS, ...MINOR_COLORS };

// ── Power Labels (Chinese) ──────────────────────────────────────

/** @type {Record<string, string>} */
export const POWER_LABELS = {
  ottoman:    '奥斯曼',
  hapsburg:   '哈布斯堡',
  england:    '英格兰',
  france:     '法兰西',
  papacy:     '教廷',
  protestant: '新教',
};

/** Minor power labels */
export const MINOR_LABELS = {
  independent: '独立',
  hungary:     '匈牙利',
  scotland:    '苏格兰',
  venice:      '威尼斯',
  genoa:       '热那亚',
};

/** All labels (major + minor) */
export const ALL_LABELS = { ...POWER_LABELS, ...MINOR_LABELS };

// ── Display Helpers ─────────────────────────────────────────────

/**
 * Get contrasting text color (black or white) for a hex background.
 * Uses W3C luminance formula.
 * @param {string} hex - e.g. '#2e7d32'
 * @returns {'#000'|'#fff'}
 */
export function contrastText(hex) {
  if (!hex || hex[0] !== '#') return '#fff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
}

/**
 * Get power color, falling back to a neutral gray.
 * @param {string} power
 * @returns {string} hex color
 */
export function powerColor(power) {
  return ALL_POWER_COLORS[power] || '#666';
}

/**
 * Get power display label, falling back to the raw key.
 * @param {string} power
 * @returns {string}
 */
export function powerLabel(power) {
  return ALL_LABELS[power] || power;
}

/**
 * Convenience: get color with alpha suffix (e.g. '#2e7d3222' for bg tints).
 * @param {string} power
 * @param {string} [alpha='22'] - 2-digit hex alpha
 * @returns {string}
 */
export function powerTint(power, alpha = '22') {
  return powerColor(power) + alpha;
}
