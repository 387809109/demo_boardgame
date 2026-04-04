/**
 * Here I Stand — Immediate Victory Checks
 *
 * Called after control-changing actions (space capture, reformation,
 * siege resolution, events) to detect instant-win conditions.
 *
 * Two victory types:
 *   1. Military auto-win — non-Protestant power reaches key threshold
 *   2. Religious victory — Protestant reaches 50 influenced spaces
 */

import {
  KEY_VP_TRACK, PROTESTANT_RELIGIOUS_VICTORY, MAJOR_POWERS
} from '../constants.js';

/**
 * Count key spaces (isKey squares) controlled by each power.
 *
 * Only square key spaces (isKey: true) count toward the VP/auto-win track.
 * German electorates (isElectorate: true) are a separate mechanic for
 * the Diet of Worms and Schmalkaldic League — they do NOT count toward
 * military auto-win thresholds.
 *
 * @param {Object} state
 * @returns {Object} { [power]: number }
 */
export function countKeysByPower(state) {
  const counts = {};
  for (const power of MAJOR_POWERS) {
    counts[power] = 0;
  }
  for (const sp of Object.values(state.spaces)) {
    if (!sp.isKey) continue;
    if (!sp.controller) continue;
    counts[sp.controller] = (counts[sp.controller] || 0) + 1;
  }
  return counts;
}

/**
 * Count Protestant-influenced spaces (excluding spaces in unrest).
 * @param {Object} state
 * @returns {number}
 */
export function countProtestantSpaces(state) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.religion === 'protestant' && !sp.unrest) {
      count++;
    }
  }
  return count;
}

/**
 * Check for immediate victory conditions.
 * Should be called after any action that changes space control or religion.
 *
 * @param {Object} state
 * @returns {{ victory: boolean, winner?: string, type?: string }}
 */
export function checkImmediateVictory(state) {
  // 1. Military auto-win — check each non-Protestant power
  //    Per rules: keys in unrest cover VP track boxes, reducing effective count.
  //    Auto-win only triggers if effective keys (total - unrest) >= threshold.
  const keyCounts = countKeysByPower(state);
  const unrestCounts = {};
  for (const power of MAJOR_POWERS) unrestCounts[power] = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.isKey && sp.controller && sp.unrest) {
      unrestCounts[sp.controller] = (unrestCounts[sp.controller] || 0) + 1;
    }
  }
  for (const power of MAJOR_POWERS) {
    if (power === 'protestant') continue; // Protestant doesn't have key auto-win
    const track = KEY_VP_TRACK[power];
    if (!track) continue;
    const effectiveKeys = keyCounts[power] - (unrestCounts[power] || 0);
    if (effectiveKeys >= track.autoWin) {
      return { victory: true, winner: power, type: 'military_auto_win' };
    }
  }

  // 2. Religious victory — Protestant reaches 50 spaces
  const protSpaces = countProtestantSpaces(state);
  if (protSpaces >= PROTESTANT_RELIGIOUS_VICTORY) {
    return { victory: true, winner: 'protestant', type: 'religious_victory' };
  }

  return { victory: false };
}
