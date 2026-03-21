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

  // ── Edge Case Tests ──────────────────────────────────────────────

  describe('countKeysByPower — edge cases', () => {
    it('counts electorates as key spaces toward totals', () => {
      const state = victoryState();
      // Find an electorate and assign it to england
      let found = false;
      for (const [name, sp] of Object.entries(state.spaces)) {
        if (sp.isElectorate) {
          sp.controller = 'england';
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
      const counts = countKeysByPower(state);
      expect(counts.england).toBeGreaterThan(0);
    });

    it('ignores spaces with null controller', () => {
      const state = victoryState();
      // Set all key/electorate controllers to null
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) {
          sp.controller = null;
        }
      }
      const counts = countKeysByPower(state);
      for (const power of ['ottoman', 'hapsburg', 'england', 'france',
        'papacy', 'protestant']) {
        expect(counts[power]).toBe(0);
      }
    });

    it('ignores spaces with undefined controller', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) {
          sp.controller = undefined;
        }
      }
      const counts = countKeysByPower(state);
      for (const power of ['ottoman', 'hapsburg', 'england', 'france',
        'papacy', 'protestant']) {
        expect(counts[power]).toBe(0);
      }
    });

    it('counts space with both isKey and isElectorate only once', () => {
      const state = victoryState();
      // Create a synthetic space that is both key and electorate
      state.spaces['TestDualSpace'] = {
        isKey: true,
        isElectorate: true,
        controller: 'france',
        religion: 'catholic',
        unrest: false,
        units: []
      };
      const counts = countKeysByPower(state);
      // Remove the synthetic space and re-count to get diff
      const expected = countKeysByPower(victoryState());
      expect(counts.france).toBe(expected.france + 1);
    });

    it('returns zero for power not controlling any keys', () => {
      const state = victoryState();
      // Clear all protestant key control
      for (const sp of Object.values(state.spaces)) {
        if ((sp.isKey || sp.isElectorate) &&
          sp.controller === 'protestant') {
          sp.controller = 'ottoman';
        }
      }
      const counts = countKeysByPower(state);
      expect(counts.protestant).toBe(0);
    });

    it('handles empty spaces object', () => {
      const state = victoryState();
      state.spaces = {};
      const counts = countKeysByPower(state);
      for (const power of ['ottoman', 'hapsburg', 'england', 'france',
        'papacy', 'protestant']) {
        expect(counts[power]).toBe(0);
      }
    });
  });

  describe('countProtestantSpaces — edge cases', () => {
    it('returns zero when no spaces are protestant', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        sp.religion = 'catholic';
      }
      expect(countProtestantSpaces(state)).toBe(0);
    });

    it('counts all spaces if all are protestant without unrest', () => {
      const state = victoryState();
      const totalSpaces = Object.keys(state.spaces).length;
      for (const sp of Object.values(state.spaces)) {
        sp.religion = 'protestant';
        sp.unrest = false;
      }
      expect(countProtestantSpaces(state)).toBe(totalSpaces);
    });

    it('excludes all protestant spaces when all have unrest', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        sp.religion = 'protestant';
        sp.unrest = true;
      }
      expect(countProtestantSpaces(state)).toBe(0);
    });

    it('handles empty spaces object', () => {
      const state = victoryState();
      state.spaces = {};
      expect(countProtestantSpaces(state)).toBe(0);
    });
  });

  describe('checkImmediateVictory — boundary conditions', () => {
    // Helper: assign exactly N key/electorate spaces to a power
    function assignKeys(state, power, count) {
      let assigned = 0;
      for (const sp of Object.values(state.spaces)) {
        if ((sp.isKey || sp.isElectorate) && assigned < count) {
          sp.controller = power;
          assigned++;
        }
      }
      return assigned;
    }

    // Helper: set exactly N protestant (non-unrest) spaces
    function setProtestantSpaces(state, count) {
      let set = 0;
      for (const sp of Object.values(state.spaces)) {
        if (set < count) {
          sp.religion = 'protestant';
          sp.unrest = false;
          set++;
        } else {
          sp.religion = 'catholic';
        }
      }
      return set;
    }

    // ── Ottoman threshold: autoWin = 11 ──

    it('no Ottoman auto-win at 10 keys (threshold - 1)', () => {
      const state = victoryState();
      // Clear all controllers first to avoid interference
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'ottoman', 10);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('Ottoman auto-win at exactly 11 keys (threshold)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'ottoman', 11);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('ottoman');
      expect(result.type).toBe('military_auto_win');
    });

    it('Ottoman auto-win at 12 keys (threshold + 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'ottoman', 12);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('ottoman');
    });

    // ── Hapsburg threshold: autoWin = 14 ──

    it('no Hapsburg auto-win at 13 keys (threshold - 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'hapsburg', 13);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('Hapsburg auto-win at exactly 14 keys (threshold)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'hapsburg', 14);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('hapsburg');
    });

    // ── England threshold: autoWin = 9 ──

    it('no England auto-win at 8 keys (threshold - 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'england', 8);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('England auto-win at exactly 9 keys (threshold)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'england', 9);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('england');
      expect(result.type).toBe('military_auto_win');
    });

    it('England auto-win at 10 keys (threshold + 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'england', 10);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('england');
    });

    // ── France threshold: autoWin = 13 ──

    it('no France auto-win at 12 keys (threshold - 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'france', 12);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('France auto-win at exactly 13 keys (threshold)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'france', 13);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('france');
      expect(result.type).toBe('military_auto_win');
    });

    // ── Papacy threshold: autoWin = 7 ──

    it('no Papacy auto-win at 6 keys (threshold - 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'papacy', 6);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('Papacy auto-win at exactly 7 keys (threshold)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'papacy', 7);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('papacy');
      expect(result.type).toBe('military_auto_win');
    });

    it('Papacy auto-win at 8 keys (threshold + 1)', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      assignKeys(state, 'papacy', 8);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('papacy');
    });

    // ── Protestant religious victory boundary ──

    it('no religious victory at exactly 49 spaces', () => {
      const state = victoryState();
      setProtestantSpaces(state, 49);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('religious victory at exactly 50 spaces', () => {
      const state = victoryState();
      setProtestantSpaces(state, 50);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('protestant');
      expect(result.type).toBe('religious_victory');
    });

    it('religious victory at 51 spaces (threshold + 1)', () => {
      const state = victoryState();
      setProtestantSpaces(state, 51);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('protestant');
      expect(result.type).toBe('religious_victory');
    });

    // ── Electorates count as key spaces for military auto-win ──

    it('electorates count toward military auto-win threshold', () => {
      const state = victoryState();
      // Clear all controllers
      for (const sp of Object.values(state.spaces)) {
        if (sp.isKey || sp.isElectorate) sp.controller = null;
      }
      // Assign only electorates to papacy (need 7 for auto-win)
      let electorateCount = 0;
      let keyCount = 0;
      for (const sp of Object.values(state.spaces)) {
        if (sp.isElectorate && electorateCount < 7) {
          sp.controller = 'papacy';
          electorateCount++;
        }
      }
      // If electorates alone are enough (6 electorates exist), top up
      // with key spaces
      const remaining = 7 - electorateCount;
      if (remaining > 0) {
        for (const sp of Object.values(state.spaces)) {
          if (sp.isKey && !sp.isElectorate &&
            sp.controller !== 'papacy' && keyCount < remaining) {
            sp.controller = 'papacy';
            keyCount++;
          }
        }
      }
      const counts = countKeysByPower(state);
      expect(counts.papacy).toBeGreaterThanOrEqual(7);
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('papacy');
    });

    // ── Military auto-win takes priority over religious victory ──

    it('military auto-win checked before religious victory', () => {
      const state = victoryState();
      // Set up both conditions simultaneously
      // Give Ottoman 11 keys
      let keyCount = 0;
      for (const sp of Object.values(state.spaces)) {
        if ((sp.isKey || sp.isElectorate) && keyCount < 11) {
          sp.controller = 'ottoman';
          keyCount++;
        }
      }
      // Also set 50 protestant spaces
      let protCount = 0;
      for (const sp of Object.values(state.spaces)) {
        if (protCount < 50) {
          sp.religion = 'protestant';
          sp.unrest = false;
          protCount++;
        }
      }
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      // Military auto-win is checked first in the code
      expect(result.type).toBe('military_auto_win');
    });

    // ── No victory when state is clean ──

    it('no victory when all key spaces have null controller and no protestant spaces', () => {
      const state = victoryState();
      for (const sp of Object.values(state.spaces)) {
        sp.controller = null;
        sp.religion = 'catholic';
      }
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    // ── Unrest boundary: exactly at threshold with unrest ──

    it('no religious victory at 50 protestant spaces when 1 is in unrest (49 effective)', () => {
      const state = victoryState();
      let set = 0;
      for (const sp of Object.values(state.spaces)) {
        if (set < 50) {
          sp.religion = 'protestant';
          sp.unrest = (set === 49); // last one in unrest
          set++;
        } else {
          sp.religion = 'catholic';
        }
      }
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(false);
    });

    it('religious victory at 51 protestant spaces when 1 is in unrest (50 effective)', () => {
      const state = victoryState();
      let set = 0;
      for (const sp of Object.values(state.spaces)) {
        if (set < 51) {
          sp.religion = 'protestant';
          sp.unrest = (set === 0); // first one in unrest
          set++;
        } else {
          sp.religion = 'catholic';
        }
      }
      const result = checkImmediateVictory(state);
      expect(result.victory).toBe(true);
      expect(result.winner).toBe('protestant');
      expect(result.type).toBe('religious_victory');
    });
  });
});
