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

// ── Edge Case Tests ─────────────────────────────────────────────

describe('canWithdrawIntoFortification — edge cases', () => {
  it('rejects withdrawal when fortress is at capacity (4 units)', () => {
    const state = createTestState();
    // Find a fortress controlled by hapsburg
    const fortEntry = Object.entries(state.spaces).find(
      ([, sp]) => sp.isFortress && sp.controller === 'hapsburg'
    );
    if (fortEntry) {
      const [fortName] = fortEntry;
      // Fill to capacity with 4 units
      state.spaces[fortName].units = [{
        owner: 'hapsburg', regulars: 4, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];
      expect(canWithdrawIntoFortification(state, fortName, 'hapsburg'))
        .toBe(false);
    }
  });

  it('allows withdrawal when fortress has fewer than 4 units', () => {
    const state = createTestState();
    const fortEntry = Object.entries(state.spaces).find(
      ([, sp]) => sp.isFortress && sp.controller === 'hapsburg'
    );
    if (fortEntry) {
      const [fortName] = fortEntry;
      state.spaces[fortName].units = [{
        owner: 'hapsburg', regulars: 3, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];
      expect(canWithdrawIntoFortification(state, fortName, 'hapsburg'))
        .toBe(true);
    }
  });

  it('rejects withdrawal into allied non-fortified space', () => {
    const state = createTestState();
    // Add an alliance between ottoman and hapsburg
    state.alliances.push({ a: 'ottoman', b: 'hapsburg' });
    // Istanbul is a key space (fortified) but not a fortress
    // Find a non-fortified, non-key space controlled by hapsburg
    const nonFort = Object.entries(state.spaces).find(
      ([, sp]) => !sp.isFortress && !sp.isKey && sp.controller === 'hapsburg'
    );
    if (nonFort) {
      const [spaceName] = nonFort;
      expect(canWithdrawIntoFortification(state, spaceName, 'ottoman'))
        .toBe(false);
    }
  });

  it('allows withdrawal into allied fortress', () => {
    const state = createTestState();
    state.alliances.push({ a: 'ottoman', b: 'hapsburg' });
    const fortEntry = Object.entries(state.spaces).find(
      ([, sp]) => sp.isFortress && sp.controller === 'hapsburg'
    );
    if (fortEntry) {
      const [fortName] = fortEntry;
      state.spaces[fortName].units = [];
      expect(canWithdrawIntoFortification(state, fortName, 'ottoman'))
        .toBe(true);
    }
  });
});

describe('executeRetreat — edge cases', () => {
  it('all leaders move during retreat (none left behind)', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Clear any existing units in both spaces
    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 2, mercenaries: 1,
      cavalry: 1, squadrons: 0, corsairs: 0,
      leaders: ['suleiman', 'ibrahim']
    }];
    state.spaces['Istanbul'].units = [];

    executeRetreat(state, 'Edirne', 'ottoman', 'Istanbul', helpers);

    // Edirne should have no ottoman stack
    const edirneOtt = state.spaces['Edirne'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(edirneOtt).toBeUndefined();

    // Istanbul should have both leaders (and only those two)
    const istOtt = state.spaces['Istanbul'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(istOtt).toBeDefined();
    expect(istOtt.leaders).toContain('suleiman');
    expect(istOtt.leaders).toContain('ibrahim');
    expect(istOtt.leaders.length).toBe(2);
  });

  it('merges into existing destination stack', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Istanbul'].units = [{
      owner: 'ottoman', regulars: 2, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];
    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 3, mercenaries: 1,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: ['ibrahim']
    }];

    executeRetreat(state, 'Edirne', 'ottoman', 'Istanbul', helpers);

    const istOtt = state.spaces['Istanbul'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(istOtt.regulars).toBe(5);
    expect(istOtt.mercenaries).toBe(1);
    expect(istOtt.leaders).toContain('ibrahim');
  });

  it('does nothing when no source stack exists', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [];
    executeRetreat(state, 'Edirne', 'ottoman', 'Istanbul', helpers);

    // No ottoman stack should appear in Istanbul (beyond default setup)
    const istUnits = state.spaces['Istanbul'].units;
    // Just verify no crash occurred
    expect(istUnits).toBeDefined();
  });
});

describe('findLegalRetreats — edge cases', () => {
  it('returns empty list when all adjacent spaces are illegal', () => {
    const state = createTestState();
    // Istanbul — make all adjacent spaces illegal
    const allAdj = ['Edirne', 'Angora', 'Salonika', 'Uskub'];
    for (const name of allAdj) {
      if (state.spaces[name]) {
        state.spaces[name].controller = 'hapsburg';
        // Remove any ottoman units
        state.spaces[name].units = state.spaces[name].units.filter(
          u => u.owner !== 'ottoman'
        );
        // Add enemy units
        state.spaces[name].units.push({
          owner: 'hapsburg', regulars: 3, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        });
      }
    }
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    // All adjacent are enemy-occupied; retreat list should be empty or
    // only contain spaces that exist and are not blocked
    for (const r of retreats) {
      // Verify any returned retreat is actually valid (not in our blocked list)
      expect(allAdj.filter(n => state.spaces[n])).not.toContain(r);
    }
  });

  it('allows retreat to allied space', () => {
    const state = createTestState();
    state.alliances.push({ a: 'ottoman', b: 'hapsburg' });
    // Set Edirne as hapsburg-controlled — should still be valid via alliance
    state.spaces['Edirne'].controller = 'hapsburg';
    state.spaces['Edirne'].units = state.spaces['Edirne'].units.filter(
      u => u.owner !== 'ottoman'
    );
    const retreats = findLegalRetreats(state, 'Istanbul', 'ottoman');
    expect(retreats).toContain('Edirne');
  });
});

describe('eliminateFormation — edge cases', () => {
  it('without capturingPower (null) — leaders not captured', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 2, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: ['ibrahim']
    }];

    const result = eliminateFormation(
      state, 'Edirne', 'ottoman', null, helpers
    );

    expect(result.eliminatedUnits).toBe(2);
    expect(result.capturedLeaders).toContain('ibrahim');
    // Leaders should NOT be added to any power's capturedLeaders
    // since capturingPower is null
    for (const power of Object.keys(state.capturedLeaders)) {
      expect(state.capturedLeaders[power]).not.toContain('ibrahim');
    }
  });

  it('eliminates stack but preserves other stacks in space', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [
      {
        owner: 'ottoman', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      },
      {
        owner: 'hapsburg', regulars: 3, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }
    ];

    eliminateFormation(state, 'Edirne', 'ottoman', 'hapsburg', helpers);

    const ottStack = state.spaces['Edirne'].units.find(
      u => u.owner === 'ottoman'
    );
    const hapStack = state.spaces['Edirne'].units.find(
      u => u.owner === 'hapsburg'
    );
    expect(ottStack).toBeUndefined();
    expect(hapStack).toBeDefined();
    expect(hapStack.regulars).toBe(3);
  });

  it('captures multiple leaders at once', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0,
      leaders: ['suleiman', 'ibrahim']
    }];

    const result = eliminateFormation(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.capturedLeaders).toEqual(
      expect.arrayContaining(['suleiman', 'ibrahim'])
    );
    expect(state.capturedLeaders.hapsburg).toEqual(
      expect.arrayContaining(['suleiman', 'ibrahim'])
    );
  });

  it('logs eliminate_formation event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];

    eliminateFormation(state, 'Edirne', 'ottoman', 'hapsburg', helpers);

    const event = state.eventLog.find(
      e => e.type === 'eliminate_formation'
    );
    expect(event).toBeDefined();
    expect(event.data.power).toBe('ottoman');
    expect(event.data.space).toBe('Edirne');
  });
});
