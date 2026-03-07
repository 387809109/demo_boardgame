/**
 * Here I Stand — new-world-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import {
  validateExplore, executeExplore,
  validateColonize, executeColonize,
  validateConquer, executeConquer,
  getAvailableExplorers, getAvailableConquistadors
} from './new-world-actions.js';

function stateWithNewWorld(overrides = {}) {
  const state = createTestState();
  state.newWorld = {
    underwayExplorations: [],
    underwayConquests: [],
    underwayColonies: [],
    colonies: [],
    conquests: [],
    claimedDiscoveries: [],
    claimedConquests: [],
    placedExplorers: [],
    placedConquistadors: [],
    deadExplorers: [],
    deadConquistadors: [],
    exploredThisTurn: {},
    colonizedThisTurn: {},
    conqueredThisTurn: {},
    ...overrides
  };
  return state;
}

// ── Explore ─────────────────────────────────────────────────────────

describe('validateExplore', () => {
  it('valid for england', () => {
    const state = stateWithNewWorld();
    const result = validateExplore(state, 'england');
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(2);
  });

  it('valid for france', () => {
    const state = stateWithNewWorld();
    expect(validateExplore(state, 'france').valid).toBe(true);
  });

  it('valid for hapsburg', () => {
    const state = stateWithNewWorld();
    expect(validateExplore(state, 'hapsburg').valid).toBe(true);
  });

  it('invalid for ottoman', () => {
    const state = stateWithNewWorld();
    expect(validateExplore(state, 'ottoman').valid).toBe(false);
  });

  it('invalid for papacy', () => {
    const state = stateWithNewWorld();
    expect(validateExplore(state, 'papacy').valid).toBe(false);
  });

  it('invalid for protestant', () => {
    const state = stateWithNewWorld();
    expect(validateExplore(state, 'protestant').valid).toBe(false);
  });

  it('invalid if already explored this turn', () => {
    const state = stateWithNewWorld({ exploredThisTurn: { england: true } });
    expect(validateExplore(state, 'england').valid).toBe(false);
  });

  it('invalid if no available explorers', () => {
    const state = stateWithNewWorld({
      deadExplorers: ['cabot_eng', 'chancellor', 'rut', 'willoughby']
    });
    expect(validateExplore(state, 'england').valid).toBe(false);
  });
});

describe('executeExplore', () => {
  it('marks explored and adds underway', () => {
    const state = stateWithNewWorld();
    const helpers = createMockHelpers();
    executeExplore(state, 'france', helpers);
    expect(state.newWorld.exploredThisTurn.france).toBe(true);
    expect(state.newWorld.underwayExplorations).toHaveLength(1);
    expect(state.newWorld.underwayExplorations[0].power).toBe('france');
  });
});

// ── Colonize ────────────────────────────────────────────────────────

describe('validateColonize', () => {
  it('valid for hapsburg (cost 2)', () => {
    const state = stateWithNewWorld();
    const result = validateColonize(state, 'hapsburg');
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(2);
  });

  it('valid for england (cost 3)', () => {
    const state = stateWithNewWorld();
    const result = validateColonize(state, 'england');
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(3);
  });

  it('invalid if already colonized this turn', () => {
    const state = stateWithNewWorld({ colonizedThisTurn: { england: true } });
    expect(validateColonize(state, 'england').valid).toBe(false);
  });

  it('invalid if colony limit reached (england = 2)', () => {
    const state = stateWithNewWorld({
      colonies: [{ power: 'england' }, { power: 'england' }]
    });
    expect(validateColonize(state, 'england').valid).toBe(false);
  });

  it('counts underway colonies toward limit', () => {
    const state = stateWithNewWorld({
      colonies: [{ power: 'france' }],
      underwayColonies: [{ power: 'france' }]
    });
    expect(validateColonize(state, 'france').valid).toBe(false);
  });

  it('hapsburg can have 3 colonies', () => {
    const state = stateWithNewWorld({
      colonies: [{ power: 'hapsburg' }, { power: 'hapsburg' }]
    });
    expect(validateColonize(state, 'hapsburg').valid).toBe(true);
  });

  it('invalid for ottoman', () => {
    const state = stateWithNewWorld();
    expect(validateColonize(state, 'ottoman').valid).toBe(false);
  });
});

describe('executeColonize', () => {
  it('marks colonized and adds underway', () => {
    const state = stateWithNewWorld();
    const helpers = createMockHelpers();
    executeColonize(state, 'hapsburg', helpers);
    expect(state.newWorld.colonizedThisTurn.hapsburg).toBe(true);
    expect(state.newWorld.underwayColonies).toHaveLength(1);
  });
});

// ── Conquer ─────────────────────────────────────────────────────────

describe('validateConquer', () => {
  it('valid for hapsburg (cost 4)', () => {
    const state = stateWithNewWorld();
    const result = validateConquer(state, 'hapsburg');
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(4);
  });

  it('valid for england (cost 4)', () => {
    const state = stateWithNewWorld();
    expect(validateConquer(state, 'england').valid).toBe(true);
  });

  it('invalid if already conquered this turn', () => {
    const state = stateWithNewWorld({ conqueredThisTurn: { hapsburg: true } });
    expect(validateConquer(state, 'hapsburg').valid).toBe(false);
  });

  it('invalid for hapsburg with no available conquistadors', () => {
    const state = stateWithNewWorld({
      deadConquistadors: ['cordova', 'coronado', 'cortez', 'montejo', 'pizarro']
    });
    expect(validateConquer(state, 'hapsburg').valid).toBe(false);
  });

  it('invalid for ottoman', () => {
    const state = stateWithNewWorld();
    expect(validateConquer(state, 'ottoman').valid).toBe(false);
  });
});

describe('executeConquer', () => {
  it('marks conquered and adds underway', () => {
    const state = stateWithNewWorld();
    const helpers = createMockHelpers();
    executeConquer(state, 'england', helpers);
    expect(state.newWorld.conqueredThisTurn.england).toBe(true);
    expect(state.newWorld.underwayConquests).toHaveLength(1);
  });
});

// ── Available leaders ───────────────────────────────────────────────

describe('getAvailableExplorers', () => {
  it('returns all explorers for power when none used', () => {
    const state = stateWithNewWorld();
    expect(getAvailableExplorers(state, 'england')).toHaveLength(4);
    expect(getAvailableExplorers(state, 'france')).toHaveLength(4);
    expect(getAvailableExplorers(state, 'hapsburg')).toHaveLength(7);
  });

  it('excludes dead explorers', () => {
    const state = stateWithNewWorld({ deadExplorers: ['cabot_eng'] });
    expect(getAvailableExplorers(state, 'england')).toHaveLength(3);
  });

  it('excludes placed explorers', () => {
    const state = stateWithNewWorld({
      placedExplorers: [{ explorerId: 'cartier', discoveryId: 'mississippi', power: 'france' }]
    });
    expect(getAvailableExplorers(state, 'france')).toHaveLength(3);
  });
});

describe('getAvailableConquistadors', () => {
  it('returns all 5 when none used', () => {
    const state = stateWithNewWorld();
    expect(getAvailableConquistadors(state)).toHaveLength(5);
  });

  it('excludes dead conquistadors', () => {
    const state = stateWithNewWorld({ deadConquistadors: ['cortez', 'pizarro'] });
    expect(getAvailableConquistadors(state)).toHaveLength(3);
  });
});
