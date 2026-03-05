/**
 * Here I Stand — retreat.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  findLegalRetreats, canWithdrawIntoFortification,
  executeRetreat, eliminateFormation
} from './retreat.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function addUnits(state, space, power, count = 1) {
  state.spaces[space].units.push({
    owner: power, regulars: count, mercenaries: 0,
    cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
  });
}

describe('findLegalRetreats', () => {
  it('returns adjacent non-enemy spaces', () => {
    const state = createTestState();
    // Edirne is adjacent to Istanbul; should be legal for ottoman
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    expect(retreats).toContain('Edirne');
  });

  it('excludes enemy-occupied spaces', () => {
    const state = createTestState();
    addUnits(state, 'Edirne', 'hapsburg', 3);
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    expect(retreats).not.toContain('Edirne');
  });

  it('excludes spaces with unrest', () => {
    const state = createTestState();
    state.spaces['Edirne'].unrest = true;
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    expect(retreats).not.toContain('Edirne');
  });

  it('excludes enemy-controlled spaces without friendly units', () => {
    const state = createTestState();
    state.spaces['Edirne'].controller = 'hapsburg';
    // Remove any ottoman units from Edirne
    state.spaces['Edirne'].units = state.spaces['Edirne'].units.filter(
      u => u.owner !== 'ottoman'
    );
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    expect(retreats).not.toContain('Edirne');
  });

  it('allows enemy-controlled space if friendly units are present', () => {
    const state = createTestState();
    state.spaces['Edirne'].controller = 'hapsburg';
    addUnits(state, 'Edirne', 'ottoman', 1);
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    expect(retreats).toContain('Edirne');
  });
});

describe('canWithdrawIntoFortification', () => {
  it('returns true for own fortress', () => {
    const state = createTestState();
    // Find a fortress controlled by hapsburg
    const fortress = Object.entries(state.spaces).find(
      ([, sp]) => sp.isFortress && sp.controller === 'hapsburg'
    );
    if (fortress) {
      expect(canWithdrawIntoFortification(state, fortress[0], 'hapsburg'))
        .toBe(true);
    }
  });

  it('returns false for non-fortress', () => {
    const state = createTestState();
    expect(canWithdrawIntoFortification(state, 'Istanbul', 'ottoman'))
      .toBe(false);
  });

  it('returns false for enemy-controlled fortress', () => {
    const state = createTestState();
    const fortress = Object.entries(state.spaces).find(
      ([, sp]) => sp.isFortress && sp.controller === 'hapsburg'
    );
    if (fortress) {
      expect(canWithdrawIntoFortification(state, fortress[0], 'ottoman'))
        .toBe(false);
    }
  });
});

describe('executeRetreat', () => {
  it('moves all units to destination', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Place ottoman units at Edirne
    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 3, mercenaries: 0,
      cavalry: 1, squadrons: 0, corsairs: 0, leaders: ['ibrahim']
    }];

    executeRetreat(state, 'Edirne', 'ottoman', 'Istanbul', helpers);

    // Edirne should have no ottoman units
    const edirneOtt = state.spaces['Edirne'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(edirneOtt).toBeUndefined();

    // Istanbul should have the retreated units merged
    const istOtt = state.spaces['Istanbul'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(istOtt).toBeDefined();
    expect(istOtt.leaders).toContain('ibrahim');
  });
});

describe('eliminateFormation', () => {
  it('removes all units and captures leaders', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 2, mercenaries: 1,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: ['ibrahim']
    }];

    const result = eliminateFormation(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.eliminatedUnits).toBe(3);
    expect(result.capturedLeaders).toContain('ibrahim');
    expect(state.capturedLeaders.hapsburg).toContain('ibrahim');
  });

  it('removes stack from space', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];

    eliminateFormation(state, 'Edirne', 'ottoman', 'hapsburg', helpers);

    const ottStack = state.spaces['Edirne'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(ottStack).toBeUndefined();
  });

  it('returns 0 if no units', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [];
    const result = eliminateFormation(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );
    expect(result.eliminatedUnits).toBe(0);
  });
});
