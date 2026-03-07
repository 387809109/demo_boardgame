/**
 * Here I Stand — phase-luther95.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import { executeLuther95 } from './phase-luther95.js';
import { RELIGION } from '../constants.js';

describe('executeLuther95', () => {
  it('makes Wittenberg Protestant', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    executeLuther95(state, helpers);
    expect(state.spaces['Wittenberg'].religion).toBe(RELIGION.PROTESTANT);
  });

  it('sets lutherPlaced flag', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    executeLuther95(state, helpers);
    expect(state.lutherPlaced).toBe(true);
  });

  it('performs reformation attempts on adjacent spaces', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    executeLuther95(state, helpers);

    // Should have logged luther_95_theses and luther_95_complete events
    const startLog = state.eventLog.find(e => e.type === 'luther_95_theses');
    expect(startLog).toBeDefined();

    const completeLog = state.eventLog.find(e => e.type === 'luther_95_complete');
    expect(completeLog).toBeDefined();
    expect(completeLog.data.attempts).toBeGreaterThan(0);
    expect(completeLog.data.attempts).toBeLessThanOrEqual(5);
  });

  it('converts some spaces probabilistically (run 20 times)', () => {
    let totalSuccesses = 0;
    for (let i = 0; i < 20; i++) {
      const state = createTestState();
      const helpers = createMockHelpers();
      executeLuther95(state, helpers);
      const log = state.eventLog.find(e => e.type === 'luther_95_complete');
      totalSuccesses += log.data.successes;
    }
    // With +1 bonus die, should succeed at least sometimes
    expect(totalSuccesses).toBeGreaterThan(0);
    // But not always succeed on every attempt
    expect(totalSuccesses).toBeLessThan(20 * 5);
  });

  it('updates protestantSpaces count', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    const before = state.protestantSpaces;
    executeLuther95(state, helpers);
    // At minimum Wittenberg was added
    expect(state.protestantSpaces).toBeGreaterThan(before);
  });

  it('logs individual reformation attempt results', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    executeLuther95(state, helpers);

    const reformLogs = state.eventLog.filter(
      e => e.type === 'luther_reform_success' || e.type === 'luther_reform_failure'
    );
    expect(reformLogs.length).toBeGreaterThan(0);
    // Each log should have dice info
    expect(reformLogs[0].data).toHaveProperty('protestantDice');
    expect(reformLogs[0].data).toHaveProperty('papalDice');
  });
});
