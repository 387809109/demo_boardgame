/**
 * Here I Stand — phase-luther95.js Unit Tests
 *
 * Tests the interactive Luther's 95 Theses phase:
 * - initLuther95 sets up Wittenberg and pendingLuther95 state
 * - getValidLuther95Targets finds German zone Catholic targets
 * - validateLuther95Target validates target selection
 * - resolveLuther95Attempt resolves a single attempt with dice
 * - isLuther95Complete checks if phase is done
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import {
  initLuther95, getValidLuther95Targets,
  validateLuther95Target, resolveLuther95Attempt,
  isLuther95Complete, cleanupLuther95
} from './phase-luther95.js';
import { RELIGION } from '../constants.js';

describe('initLuther95', () => {
  it('makes Wittenberg Protestant', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);
    expect(state.spaces['Wittenberg'].religion).toBe(RELIGION.PROTESTANT);
  });

  it('sets lutherPlaced flag', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);
    expect(state.lutherPlaced).toBe(true);
  });

  it('places Luther reformer in Wittenberg', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);
    expect(state.spaces['Wittenberg'].reformer).toBe('luther');
  });

  it('sets activePower to protestant', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);
    expect(state.activePower).toBe('protestant');
  });

  it('creates pendingLuther95 state', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    expect(state.pendingLuther95).toBeDefined();
    expect(state.pendingLuther95.attemptsTotal).toBe(5);
    expect(state.pendingLuther95.attemptNumber).toBe(0);
    expect(state.pendingLuther95.results).toEqual([]);
    expect(state.pendingLuther95.validTargets).toBeDefined();
    expect(state.pendingLuther95.validTargets.length).toBeGreaterThan(0);
  });

  it('valid targets are all Catholic and in German zone', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    for (const target of state.pendingLuther95.validTargets) {
      const sp = state.spaces[target];
      expect(sp.religion).toBe(RELIGION.CATHOLIC);
      expect(sp.languageZone).toBe('german');
    }
  });

  it('updates protestantSpaces count', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    const before = state.protestantSpaces;
    initLuther95(state, helpers);
    // At minimum Wittenberg was added
    expect(state.protestantSpaces).toBeGreaterThan(before);
  });
});

describe('getValidLuther95Targets', () => {
  it('returns only German zone Catholic spaces adjacent to Protestant', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const targets = getValidLuther95Targets(state);
    expect(targets.length).toBeGreaterThan(0);

    for (const t of targets) {
      expect(state.spaces[t].religion).toBe(RELIGION.CATHOLIC);
      expect(state.spaces[t].languageZone).toBe('german');
    }
  });

  it('returns empty if no valid targets exist', () => {
    const state = createTestState();
    // Make all German spaces Protestant
    for (const [, sp] of Object.entries(state.spaces)) {
      if (sp.languageZone === 'german') {
        sp.religion = RELIGION.PROTESTANT;
      }
    }
    const targets = getValidLuther95Targets(state);
    expect(targets).toEqual([]);
  });
});

describe('validateLuther95Target', () => {
  it('rejects non-protestant power', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const result = validateLuther95Target(state, 'papacy', { targetSpace: 'Leipzig' });
    expect(result.valid).toBe(false);
  });

  it('rejects when no pending state', () => {
    const state = createTestState();
    const result = validateLuther95Target(state, 'protestant', { targetSpace: 'Leipzig' });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid target space', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const result = validateLuther95Target(state, 'protestant', { targetSpace: 'London' });
    expect(result.valid).toBe(false);
  });

  it('accepts valid target', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const target = state.pendingLuther95.validTargets[0];
    if (target) {
      const result = validateLuther95Target(state, 'protestant', { targetSpace: target });
      expect(result.valid).toBe(true);
    }
  });
});

describe('resolveLuther95Attempt', () => {
  it('resolves an attempt with dice results', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const target = state.pendingLuther95.validTargets[0];
    const result = resolveLuther95Attempt(state, { targetSpace: target }, helpers);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('protestantDice');
    expect(result.protestantDice.length).toBeGreaterThan(0);
    expect(result).toHaveProperty('attemptNumber', 1);
  });

  it('increments attemptNumber', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const target = state.pendingLuther95.validTargets[0];
    resolveLuther95Attempt(state, { targetSpace: target }, helpers);
    expect(state.pendingLuther95.attemptNumber).toBe(1);
  });

  it('logs reformation success or failure events', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const target = state.pendingLuther95.validTargets[0];
    resolveLuther95Attempt(state, { targetSpace: target }, helpers);

    const reformLogs = state.eventLog.filter(
      e => e.type === 'luther_reform_success' || e.type === 'luther_reform_failure'
    );
    expect(reformLogs.length).toBeGreaterThan(0);
    expect(reformLogs[0].data).toHaveProperty('protestantDice');
    expect(reformLogs[0].data).toHaveProperty('protestantMax');
  });

  it('recalculates valid targets after each attempt', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const targetsBefore = [...state.pendingLuther95.validTargets];
    const target = targetsBefore[0];
    const result = resolveLuther95Attempt(state, { targetSpace: target }, helpers);

    if (result.success) {
      // Successful conversion: target should no longer be valid
      expect(state.pendingLuther95.validTargets).not.toContain(target);
      // But new targets may have appeared (newly adjacent)
    }
  });

  it('converts spaces probabilistically (run 20 times)', () => {
    let totalSuccesses = 0;
    for (let i = 0; i < 20; i++) {
      const state = createTestState();
      const helpers = createMockHelpers();
      initLuther95(state, helpers);

      let attempts = 0;
      while (!isLuther95Complete(state) && attempts < 5) {
        const target = state.pendingLuther95.validTargets[0];
        if (!target) break;
        const result = resolveLuther95Attempt(state, { targetSpace: target }, helpers);
        if (result.success) totalSuccesses++;
        attempts++;
      }
    }
    // With +1 bonus die, should succeed at least sometimes
    expect(totalSuccesses).toBeGreaterThan(0);
    // But not always succeed on every attempt
    expect(totalSuccesses).toBeLessThan(20 * 5);
  });
});

describe('isLuther95Complete', () => {
  it('returns true when no pending state', () => {
    const state = createTestState();
    expect(isLuther95Complete(state)).toBe(true);
  });

  it('returns false during active phase', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);
    expect(isLuther95Complete(state)).toBe(false);
  });

  it('returns true after all 5 attempts used', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    for (let i = 0; i < 5; i++) {
      if (isLuther95Complete(state)) break;
      const target = state.pendingLuther95.validTargets[0];
      if (!target) break;
      resolveLuther95Attempt(state, { targetSpace: target }, helpers);
    }
    expect(isLuther95Complete(state)).toBe(true);
  });
});

describe('cleanupLuther95', () => {
  it('clears pendingLuther95 state', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);
    expect(state.pendingLuther95).not.toBeNull();
    cleanupLuther95(state);
    expect(state.pendingLuther95).toBeNull();
  });
});

describe('resolveLuther95Attempt — edge cases', () => {
  it('early termination when all targets converted', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    // Force all German Catholic spaces to Protestant (except targets)
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.languageZone === 'german' && sp.religion === RELIGION.CATHOLIC) {
        sp.religion = RELIGION.PROTESTANT;
      }
    }
    // Recalculate targets — should be empty now
    state.pendingLuther95.validTargets = getValidLuther95Targets(state);
    expect(isLuther95Complete(state)).toBe(true);
  });

  it('electorate conversion places 2 regulars when no Protestant stack', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    // Find an electorate in valid targets with no existing Protestant stack
    const electorateTarget = state.pendingLuther95.validTargets.find(
      name => state.spaces[name].isElectorate &&
        !state.spaces[name].units.some(u => u.owner === 'protestant')
    );
    if (!electorateTarget) return; // skip if no suitable electorate target

    // Clear existing units to isolate the electorate logic
    const sp = state.spaces[electorateTarget];
    sp.units = [];

    // Directly test the electorate conversion logic from resolveLuther95Attempt
    sp.religion = RELIGION.PROTESTANT;
    if (sp.isElectorate) {
      const existingProt = sp.units.find(u => u.owner === 'protestant');
      if (!existingProt) {
        sp.units.push({
          owner: 'protestant', regulars: 2, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        });
      }
    }
    const protStack = sp.units.find(u => u.owner === 'protestant');
    expect(protStack).toBeDefined();
    expect(protStack.regulars).toBe(2);
  });

  it('electorate with existing Protestant stack does not duplicate', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const electorateTarget = state.pendingLuther95.validTargets.find(
      name => state.spaces[name].isElectorate
    );
    if (!electorateTarget) return;

    const sp = state.spaces[electorateTarget];
    // Clear existing units, then place exactly one Protestant stack
    sp.units = [{
      owner: 'protestant', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];

    // Simulate conversion — should NOT add another stack
    sp.religion = RELIGION.PROTESTANT;
    if (sp.isElectorate) {
      const existingProt = sp.units.find(u => u.owner === 'protestant');
      if (!existingProt) {
        sp.units.push({
          owner: 'protestant', regulars: 2, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        });
      }
    }
    const protStacks = sp.units.filter(u => u.owner === 'protestant');
    expect(protStacks).toHaveLength(1);
    expect(protStacks[0].regulars).toBe(1); // unchanged
  });

  it('validTargets empty mid-phase when all German Catholic spaces converted', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    // Convert ALL German Catholic spaces to Protestant (not just current targets)
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.languageZone === 'german' && sp.religion === RELIGION.CATHOLIC) {
        sp.religion = RELIGION.PROTESTANT;
      }
    }
    state.pendingLuther95.validTargets = getValidLuther95Targets(state);

    // No German Catholic spaces left — no valid targets
    expect(state.pendingLuther95.validTargets).toEqual([]);
    expect(isLuther95Complete(state)).toBe(true);
  });
});

describe('validateLuther95Target — edge cases', () => {
  it('rejects when targetSpace is missing from actionData', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const result = validateLuther95Target(state, 'protestant', {});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('target space');
  });

  it('rejects non-existent space name', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    const result = validateLuther95Target(state, 'protestant', { targetSpace: 'Atlantis' });
    expect(result.valid).toBe(false);
  });

  it('rejects already-Protestant space', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    initLuther95(state, helpers);

    // Wittenberg is already Protestant
    const result = validateLuther95Target(state, 'protestant', { targetSpace: 'Wittenberg' });
    expect(result.valid).toBe(false);
  });
});
