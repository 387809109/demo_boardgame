/**
 * Here I Stand — military-actions.js Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateMoveFormation, moveFormation,
  validateRaiseRegular, raiseRegular,
  validateBuyMercenary, buyMercenary,
  validateRaiseCavalry, raiseCavalry,
  validateBuildSquadron, buildSquadron,
  validateBuildCorsair, buildCorsair,
  validateControlUnfortified, controlUnfortified
} from './military-actions.js';
import { startCpSpending } from './cp-manager.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

/** Set up a state in CP-spending mode */
function cpState(cp = 10) {
  const state = createTestState();
  startCpSpending(state, 99, cp);
  return state;
}

describe('validateMoveFormation', () => {
  it('rejects missing from/to', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', { units: {} });
    expect(r.valid).toBe(false);
  });

  it('rejects non-adjacent spaces', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Paris', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not adjacent');
  });

  it('rejects when source has no units', () => {
    const state = cpState();
    // Edirne is adjacent to Istanbul but may have no ottoman units
    state.spaces['Edirne'].units = [];
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Edirne', to: 'Istanbul', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('No units');
  });

  it('rejects when not enough regulars', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 99 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Not enough regulars');
  });

  it('rejects exceeding formation cap (no leader)', () => {
    const state = cpState();
    // Move units without leaders — cap is 4
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 5 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('formation cap');
  });

  it('accepts valid move with leader', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 4, cavalry: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);
    expect(r.cost).toBeGreaterThan(0);
  });

  it('rejects move into enemy-occupied space', () => {
    const state = cpState();
    // Put hapsburg units in Edirne
    state.spaces['Edirne'].units.push({
      owner: 'hapsburg', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('enemy');
  });

  it('rejects when CP is insufficient', () => {
    const state = cpState(0);
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });
});

describe('moveFormation', () => {
  it('moves units from source to destination', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const before = state.spaces['Istanbul'].units[0].regulars;

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2, leaders: ['ibrahim'] }
    }, helpers);

    // Source should have fewer regulars
    const srcStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(srcStack.regulars).toBe(before - 2);
    expect(srcStack.leaders).not.toContain('ibrahim');

    // Destination should have the moved units (may merge with existing)
    const dstStack = state.spaces['Edirne'].units.find(u => u.owner === 'ottoman');
    expect(dstStack.regulars).toBeGreaterThanOrEqual(2);
    expect(dstStack.leaders).toContain('ibrahim');
  });

  it('deducts CP', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    const before = state.cpRemaining;

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    }, helpers);

    expect(state.cpRemaining).toBeLessThan(before);
  });

  it('records impulse action', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    }, helpers);

    expect(state.impulseActions).toHaveLength(1);
    expect(state.impulseActions[0].type).toBe('move');
  });

  it('merges into existing stack at destination', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Pre-place ottoman units at Edirne
    state.spaces['Edirne'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2 }
    }, helpers);

    const dstStack = state.spaces['Edirne'].units.find(u => u.owner === 'ottoman');
    expect(dstStack.regulars).toBe(3); // 1 existing + 2 moved
  });

  it('removes empty source stack', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Set up a space with exactly 1 regular, no leaders, no naval
    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];

    moveFormation(state, 'ottoman', {
      from: 'Edirne', to: 'Istanbul',
      units: { regulars: 1 }
    }, helpers);

    const ottomanInEdirne = state.spaces['Edirne'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(ottomanInEdirne).toBeUndefined();
  });
});

describe('validateRaiseRegular', () => {
  it('accepts raising in home space with CP', () => {
    const state = cpState();
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects non-home space', () => {
    const state = cpState();
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Paris' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('home space');
  });

  it('rejects when CP insufficient', () => {
    const state = cpState(1); // raise_regular costs 2
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
  });

  it('rejects space with unrest', () => {
    const state = cpState();
    state.spaces['Istanbul'].unrest = true;
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('unrest');
  });
});

describe('raiseRegular', () => {
  it('adds 1 regular to space', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const before = state.spaces['Istanbul'].units[0].regulars;
    raiseRegular(state, 'ottoman', { space: 'Istanbul' }, helpers);
    expect(state.spaces['Istanbul'].units[0].regulars).toBe(before + 1);
  });
});

describe('validateBuyMercenary', () => {
  it('accepts buying in home space', () => {
    const state = cpState();
    const r = validateBuyMercenary(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(true);
  });

  it('rejects for ottoman (cannot buy mercs)', () => {
    const state = cpState();
    const r = validateBuyMercenary(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
  });
});

describe('buyMercenary', () => {
  it('adds 1 mercenary to space', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const stack = state.spaces['Vienna'].units.find(u => u.owner === 'hapsburg');
    const before = stack.mercenaries;
    buyMercenary(state, 'hapsburg', { space: 'Vienna' }, helpers);
    expect(stack.mercenaries).toBe(before + 1);
  });
});

describe('validateRaiseCavalry', () => {
  it('accepts for ottoman', () => {
    const state = cpState();
    const r = validateRaiseCavalry(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects for non-ottoman', () => {
    const state = cpState();
    const r = validateRaiseCavalry(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
  });
});

describe('validateBuildSquadron', () => {
  it('accepts for port home space', () => {
    const state = cpState();
    // Istanbul is a port
    const r = validateBuildSquadron(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects for non-port space', () => {
    const state = cpState();
    // Vienna is not a port
    const r = validateBuildSquadron(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('port');
  });
});

describe('validateBuildCorsair', () => {
  it('accepts for ottoman port', () => {
    const state = cpState();
    const r = validateBuildCorsair(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects for non-ottoman', () => {
    const state = cpState();
    const r = validateBuildCorsair(state, 'hapsburg', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
  });
});

describe('validateControlUnfortified', () => {
  it('rejects fortified space', () => {
    const state = cpState();
    // Besançon is a fortress — place ottoman units to bypass "no units" check
    state.spaces['Besançon'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Besançon' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('fortified');
  });

  it('rejects if already controlled', () => {
    const state = cpState();
    // Find an unfortified ottoman space
    const space = Object.entries(state.spaces).find(
      ([, sp]) => sp.controller === 'ottoman' && !sp.isFortress
    );
    if (space) {
      const r = validateControlUnfortified(state, 'ottoman', { space: space[0] });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('Already controlled');
    }
  });

  it('rejects without units in space', () => {
    const state = cpState();
    // Find an unfortified non-ottoman space with no ottoman units
    const space = Object.entries(state.spaces).find(
      ([, sp]) => sp.controller === 'france' && !sp.isFortress
    );
    if (space) {
      const r = validateControlUnfortified(state, 'ottoman', { space: space[0] });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('units');
    }
  });

  it('accepts valid unfortified space with units', () => {
    const state = cpState();
    // Find unfortified non-ottoman space and place ottoman units there
    const entry = Object.entries(state.spaces).find(
      ([, sp]) => sp.controller !== 'ottoman' && !sp.isFortress
    );
    if (entry) {
      entry[1].units.push({
        owner: 'ottoman', regulars: 1, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
      const r = validateControlUnfortified(state, 'ottoman', { space: entry[0] });
      expect(r.valid).toBe(true);
    }
  });
});

describe('controlUnfortified', () => {
  it('changes controller', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const entry = Object.entries(state.spaces).find(
      ([, sp]) => sp.controller !== 'ottoman' && !sp.isFortress
    );
    if (entry) {
      entry[1].units.push({
        owner: 'ottoman', regulars: 1, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
      controlUnfortified(state, 'ottoman', { space: entry[0] }, helpers);
      expect(state.spaces[entry[0]].controller).toBe('ottoman');
    }
  });
});
