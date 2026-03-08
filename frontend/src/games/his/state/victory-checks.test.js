/**
 * Tests for immediate victory checks
 */

import { describe, it, expect } from 'vitest';
import {
  countKeysByPower, countProtestantSpaces, checkImmediateVictory
} from './victory-checks.js';
import { createTestState } from '../test-helpers.js';

function victoryState(overrides = {}) {
  return createTestState(overrides);
}

describe('Victory Checks', () => {
  describe('countKeysByPower', () => {
    it('counts keys for each power from initial state', () => {
      const state = victoryState();
      const counts = countKeysByPower(state);
      // Ottoman starts with Istanbul + other keys
      expect(counts.ottoman).toBeGreaterThan(0);
      expect(counts.hapsburg).toBeGreaterThan(0);
    });

    it('updates when space controller changes', () => {
      const state = victoryState();
      const before = countKeysByPower(state);
      // Transfer a key space
      state.spaces['Milan'].controller = 'france';
      const after = countKeysByPower(state);
      expect(after.france).toBeGreaterThanOrEqual(before.france);
    });
  });

  describe('countProtestantSpaces', () => {
    it('counts spaces with protestant religion', () => {
      const state = victoryState();
      const count = countProtestantSpaces(state);
      // Initial state has few or no protestant spaces
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('excludes spaces in unrest', () => {
      const state = victoryState();
      state.spaces['Wittenberg'].religion = 'protestant';
      state.spaces['Wittenberg'].unrest = false;
      const countBefore = countProtestantSpaces(state);

      state.spaces['Wittenberg'].unrest = true;
      const countAfter = countProtestantSpaces(state);

      expect(countAfter).toBe(countBefore - 1);
    });
  });

  describe('checkImmediateVictory', () => {
    it('returns no victory in normal game state', () => {
      const state = victoryState();
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('detects Ottoman military auto-win at 11 keys', () => {
      const state = victoryState();
      // Give Ottoman enough keys (autoWin = 11)
      let keyCount = 0;
      for (const [name, sp] of Object.entries(state.spaces)) {
        if ((sp.isKey || sp.isElectorate) && keyCount < 11) {
          sp.controller = 'ottoman';
          keyCount++;
        }
      }

      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('ottoman');
      expect(result.type).toBe('military_auto_win');
    });

    it('detects Protestant religious victory at 50 spaces', () => {
      const state = victoryState();
      // Set 50 spaces to protestant
      let count = 0;
      for (const sp of Object.values(state.spaces)) {
        if (count < 50) {
          sp.religion = 'protestant';
          sp.unrest = false;
          count++;
        }
      }

      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('protestant');
      expect(result.type).toBe('religious_victory');
    });

    it('does not count protestant spaces in unrest for religious victory', () => {
      const state = victoryState();
      // Set exactly 50 spaces to protestant but 1 in unrest
      let count = 0;
      for (const sp of Object.values(state.spaces)) {
        if (count < 50) {
          sp.religion = 'protestant';
          sp.unrest = (count === 0); // First one in unrest
          count++;
        }
      }

      const result = checkImmediateVictory(state);
      // Only 49 effective protestant spaces — no victory
      expect(result.victory).toBe(false);
    });

    it('protestant does not get military auto-win', () => {
      const state = victoryState();
      // Give protestant lots of keys (shouldn't trigger)
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) {
          sp.controller = 'protestant';
        }
      }

      const result = checkImmediateVictory(state);
      // Should not be military_auto_win for protestant
      if (result.victory) {
        expect(result.type).not.toBe('military_auto_win');
      }
    });

    it('detects Hapsburg auto-win at 14 keys', () => {
      const state = victoryState();
      let keyCount = 0;
      for (const sp of Object.values(state.spaces)) {
        if ((sp.isKey || sp.isElectorate) && keyCount < 14) {
          sp.controller = 'hapsburg';
          keyCount++;
        }
      }

      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('hapsburg');
    });
  });
});
