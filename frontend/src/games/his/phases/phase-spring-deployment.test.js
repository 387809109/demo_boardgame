/**
 * Here I Stand - phase-spring-deployment.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import {
  initSpringDeployment, validateSpringDeployment,
  executeSpringDeployment, isSpringDeploymentComplete,
  skipSpringDeployment
} from './phase-spring-deployment.js';
import { IMPULSE_ORDER, MAJOR_POWERS } from '../constants.js';
import { PORTS_BY_SEA_ZONE } from '../data/map-data.js';
import { getUnitsInSpace } from '../state/state-helpers.js';

function setup() {
  const state = createTestState();
  const helpers = createMockHelpers();
  initSpringDeployment(state, helpers);
  return { state, helpers };
}

function clearMajorNavalInSeaZone(state, seaZone, keepOwners = []) {
  const keep = new Set(keepOwners);
  for (const portName of (PORTS_BY_SEA_ZONE[seaZone] || [])) {
    const sp = state.spaces[portName];
    if (!sp) continue;
    for (const stack of sp.units) {
      if (!MAJOR_POWERS.includes(stack.owner) || keep.has(stack.owner)) continue;
      stack.squadrons = 0;
      stack.corsairs = 0;
    }
  }
}

describe('initSpringDeployment', () => {
  it('initializes tracking and impulse order state', () => {
    const { state } = setup();
    expect(state.springDeploymentDone).toEqual({});
    expect(state.activePower).toBe('ottoman');
    expect(state.impulseIndex).toBe(0);
  });
});

describe('validateSpringDeployment', () => {
  it('rejects when not active power', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'hapsburg', {
      from: 'Vienna', to: 'Pressburg', units: { regulars: 1, leaders: ['ferdinand'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('impulse');
  });

  it('rejects missing from/to', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', { units: {} });
    expect(r.valid).toBe(false);
  });

  it('rejects same source and destination', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Istanbul', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('must differ');
  });

  it('rejects no-op deployment with zero units and leaders', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: {}
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('at least one');
  });

  it('rejects protestant (no capital)', () => {
    const { state } = setup();
    state.activePower = 'protestant';
    const r = validateSpringDeployment(state, 'protestant', {
      from: 'Wittenberg', to: 'Erfurt', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('No capital');
  });

  it('rejects non-capital origin', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Edirne', to: 'Istanbul', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('capital');
  });

  it('rejects if capital not controlled', () => {
    const { state } = setup();
    state.spaces['Istanbul'].controller = 'hapsburg';
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not under your control');
  });

  it('rejects if destination not friendly-controlled', () => {
    const { state } = setup();
    state.spaces['Edirne'].controller = 'hapsburg';
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Destination');
  });

  it('rejects if already deployed', () => {
    const { state } = setup();
    state.springDeploymentDone.ottoman = true;
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Already');
  });

  it('accepts valid multi-space deployment path', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul',
      to: 'Sofia',
      units: { regulars: 2, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);
  });

  it('rejects path through unrest', () => {
    const { state } = setup();
    state.spaces['Edirne'].unrest = true;
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul',
      to: 'Sofia',
      units: { regulars: 2, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('path');
  });

  it('rejects entering space with unfriendly units', () => {
    const { state } = setup();
    state.spaces['Edirne'].units.push({
      owner: 'hapsburg', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul',
      to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('path');
  });

  it('allows allied destination and allied units in destination', () => {
    const { state } = setup();
    state.alliances.push({ a: 'ottoman', b: 'hapsburg' });
    state.spaces['Edirne'].controller = 'hapsburg';
    state.spaces['Edirne'].units.push({
      owner: 'hapsburg', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul',
      to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);
  });

  it('rejects pass-crossing route without Spring Preparations', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul',
      to: 'Durazzo',
      units: { regulars: 2, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('path');
  });

  it('allows pass-crossing route with Spring Preparations', () => {
    const { state } = setup();
    state.enhancedSpringDeployment = 'ottoman';
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul',
      to: 'Durazzo',
      units: { regulars: 2, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);
  });

  it('rejects sea crossing with more than 5 land units without Spring Preparations', () => {
    const { state } = setup();
    state.activePower = 'france';
    state.spaces['Genoa'].controller = 'france';
    state.spaces['Genoa'].units = [];
    clearMajorNavalInSeaZone(state, 'Gulf of Lyon', ['france']);

    const paris = getUnitsInSpace(state, 'Paris', 'france');
    paris.regulars = 6;

    const r = validateSpringDeployment(state, 'france', {
      from: 'Paris',
      to: 'Genoa',
      units: { regulars: 6, leaders: ['francis_i'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('path');
  });

  it('allows sea crossing with more than 5 land units with Spring Preparations', () => {
    const { state } = setup();
    state.activePower = 'france';
    state.enhancedSpringDeployment = 'france';
    state.spaces['Genoa'].controller = 'france';
    state.spaces['Genoa'].units = [];
    clearMajorNavalInSeaZone(state, 'Gulf of Lyon', ['france']);

    const paris = getUnitsInSpace(state, 'Paris', 'france');
    paris.regulars = 6;

    const r = validateSpringDeployment(state, 'france', {
      from: 'Paris',
      to: 'Genoa',
      units: { regulars: 6, leaders: ['francis_i'] }
    });
    expect(r.valid).toBe(true);
  });

  it('rejects sea crossing when another major power has naval units in bordering ports', () => {
    const { state } = setup();
    state.activePower = 'france';
    state.spaces['Genoa'].controller = 'france';
    state.spaces['Genoa'].units = [];
    clearMajorNavalInSeaZone(state, 'Gulf of Lyon', ['france']);

    const barcelonaStack = getUnitsInSpace(state, 'Barcelona', 'hapsburg');
    barcelonaStack.squadrons = 1;

    const r = validateSpringDeployment(state, 'france', {
      from: 'Paris',
      to: 'Genoa',
      units: { regulars: 4 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('path');
  });

  it('allows sea crossing past other major fleets with Spring Preparations', () => {
    const { state } = setup();
    state.activePower = 'france';
    state.enhancedSpringDeployment = 'france';
    state.spaces['Genoa'].controller = 'france';
    state.spaces['Genoa'].units = [];
    clearMajorNavalInSeaZone(state, 'Gulf of Lyon', ['france']);

    const barcelonaStack = getUnitsInSpace(state, 'Barcelona', 'hapsburg');
    barcelonaStack.squadrons = 1;

    const r = validateSpringDeployment(state, 'france', {
      from: 'Paris',
      to: 'Genoa',
      units: { regulars: 4 }
    });
    expect(r.valid).toBe(true);
  });

  it('hapsburg can deploy from Vienna or Valladolid', () => {
    const { state } = setup();
    state.activePower = 'hapsburg';

    const r1 = validateSpringDeployment(state, 'hapsburg', {
      from: 'Vienna', to: 'Pressburg',
      units: { regulars: 1, leaders: ['ferdinand'] }
    });

    const r2 = validateSpringDeployment(state, 'hapsburg', {
      from: 'Valladolid', to: 'Barcelona',
      units: { regulars: 1 }
    });

    if (!r1.valid) {
      expect(r1.error).not.toContain('capital');
    }
    if (!r2.valid) {
      expect(r2.error).not.toContain('capital');
    }
  });
});

describe('executeSpringDeployment', () => {
  it('moves units from capital to destination', () => {
    const { state, helpers } = setup();
    const srcBefore = getUnitsInSpace(state, 'Istanbul', 'ottoman');
    const regsBefore = srcBefore.regulars;

    executeSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2, leaders: ['suleiman'] }
    }, helpers);

    const srcAfter = getUnitsInSpace(state, 'Istanbul', 'ottoman');
    const dstAfter = getUnitsInSpace(state, 'Edirne', 'ottoman');

    const srcRegs = srcAfter ? srcAfter.regulars : 0;
    expect(srcRegs).toBe(regsBefore - 2);

    expect(dstAfter).toBeDefined();
    expect(dstAfter.regulars).toBeGreaterThanOrEqual(2);
    expect(dstAfter.leaders).toContain('suleiman');
  });

  it('marks power as deployed', () => {
    const { state, helpers } = setup();
    executeSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    }, helpers);
    expect(state.springDeploymentDone.ottoman).toBe(true);
  });
});

describe('isSpringDeploymentComplete', () => {
  it('false when not all powers done', () => {
    const { state } = setup();
    skipSpringDeployment(state, 'ottoman');
    expect(isSpringDeploymentComplete(state)).toBe(false);
  });

  it('true when all powers done', () => {
    const { state } = setup();
    for (const p of IMPULSE_ORDER) {
      skipSpringDeployment(state, p);
    }
    expect(isSpringDeploymentComplete(state)).toBe(true);
  });
});

describe('skipSpringDeployment', () => {
  it('marks power as done', () => {
    const { state } = setup();
    skipSpringDeployment(state, 'france');
    expect(state.springDeploymentDone.france).toBe(true);
  });
});
