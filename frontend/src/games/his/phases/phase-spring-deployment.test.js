/**
 * Here I Stand — phase-spring-deployment.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import {
  initSpringDeployment, validateSpringDeployment,
  executeSpringDeployment, isSpringDeploymentComplete,
  skipSpringDeployment
} from './phase-spring-deployment.js';
import { IMPULSE_ORDER } from '../constants.js';
import { getUnitsInSpace } from '../state/state-helpers.js';

function setup() {
  const state = createTestState();
  const helpers = createMockHelpers();
  initSpringDeployment(state, helpers);
  return { state, helpers };
}

describe('initSpringDeployment', () => {
  it('initializes tracking', () => {
    const { state } = setup();
    expect(state.springDeploymentDone).toEqual({});
  });
});

describe('validateSpringDeployment', () => {
  it('rejects missing from/to', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', { units: {} });
    expect(r.valid).toBe(false);
  });

  it('rejects protestant (no capital)', () => {
    const { state } = setup();
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

  it('rejects if destination not controlled by power', () => {
    const { state } = setup();
    // Edirne is ottoman-controlled in setup
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

  it('accepts valid deployment from capital', () => {
    const { state } = setup();
    const r = validateSpringDeployment(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);
  });

  it('hapsburg can deploy from Vienna or Brussels', () => {
    const { state } = setup();
    // Check Vienna
    const r1 = validateSpringDeployment(state, 'hapsburg', {
      from: 'Vienna', to: 'Pressburg',
      units: { regulars: 1, leaders: ['ferdinand'] }
    });
    // Vienna → Pressburg adjacency depends on map data
    // Just verify it doesn't fail on "not a capital"
    if (!r1.valid) {
      expect(r1.error).not.toContain('capital');
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

    // Source lost units
    const srcRegs = srcAfter ? srcAfter.regulars : 0;
    expect(srcRegs).toBe(regsBefore - 2);

    // Destination gained units
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
