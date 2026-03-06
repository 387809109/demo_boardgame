/**
 * Here I Stand — phase-diplomacy.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import {
  initDiplomacyPhase, canActInSegment, markActed,
  allActedInSegment, advanceDiplomacySegment,
  getCurrentSegment, isDiplomacyComplete
} from './phase-diplomacy.js';
import { DIPLOMACY_SEGMENTS, IMPULSE_ORDER } from '../constants.js';

function setup() {
  const state = createTestState();
  const helpers = createMockHelpers();
  initDiplomacyPhase(state, helpers);
  return { state, helpers };
}

describe('initDiplomacyPhase', () => {
  it('sets first segment', () => {
    const { state } = setup();
    expect(state.diplomacySegment).toBe('negotiation');
  });

  it('initializes tracking arrays', () => {
    const { state } = setup();
    expect(state.peaceMadeThisTurn).toEqual([]);
    expect(state.alliancesFormedThisTurn).toEqual([]);
    expect(state.diplomacyActed).toEqual({});
  });
});

describe('canActInSegment', () => {
  it('returns true for powers that have not acted', () => {
    const { state } = setup();
    expect(canActInSegment(state, 'ottoman')).toBe(true);
  });

  it('returns false after power has acted', () => {
    const { state } = setup();
    markActed(state, 'ottoman');
    expect(canActInSegment(state, 'ottoman')).toBe(false);
  });

  it('returns false when no segment active', () => {
    const { state } = setup();
    state.diplomacySegment = null;
    expect(canActInSegment(state, 'ottoman')).toBe(false);
  });

  it('excommunication segment: only papacy can act', () => {
    const { state } = setup();
    state.diplomacySegment = 'excommunication';
    expect(canActInSegment(state, 'papacy')).toBe(true);
    expect(canActInSegment(state, 'ottoman')).toBe(false);
    expect(canActInSegment(state, 'hapsburg')).toBe(false);
  });
});

describe('allActedInSegment', () => {
  it('returns false when not all powers have acted', () => {
    const { state } = setup();
    markActed(state, 'ottoman');
    expect(allActedInSegment(state)).toBe(false);
  });

  it('returns true when all powers have acted', () => {
    const { state } = setup();
    for (const p of IMPULSE_ORDER) markActed(state, p);
    expect(allActedInSegment(state)).toBe(true);
  });

  it('excommunication: only needs papacy', () => {
    const { state } = setup();
    state.diplomacySegment = 'excommunication';
    expect(allActedInSegment(state)).toBe(false);
    markActed(state, 'papacy');
    expect(allActedInSegment(state)).toBe(true);
  });
});

describe('advanceDiplomacySegment', () => {
  it('advances through all 5 segments', () => {
    const { state, helpers } = setup();
    expect(getCurrentSegment(state)).toBe('negotiation');

    advanceDiplomacySegment(state, helpers);
    expect(getCurrentSegment(state)).toBe('sue_for_peace');

    advanceDiplomacySegment(state, helpers);
    expect(getCurrentSegment(state)).toBe('ransom');

    advanceDiplomacySegment(state, helpers);
    expect(getCurrentSegment(state)).toBe('excommunication');

    advanceDiplomacySegment(state, helpers);
    expect(getCurrentSegment(state)).toBe('declarations_of_war');

    const more = advanceDiplomacySegment(state, helpers);
    expect(more).toBe(false);
    expect(getCurrentSegment(state)).toBeNull();
  });

  it('resets diplomacyActed on each advance', () => {
    const { state, helpers } = setup();
    markActed(state, 'ottoman');
    advanceDiplomacySegment(state, helpers);
    expect(state.diplomacyActed).toEqual({});
  });
});

describe('isDiplomacyComplete', () => {
  it('false during phase', () => {
    const { state } = setup();
    expect(isDiplomacyComplete(state)).toBe(false);
  });

  it('true after all segments', () => {
    const { state, helpers } = setup();
    for (let i = 0; i < DIPLOMACY_SEGMENTS.length; i++) {
      advanceDiplomacySegment(state, helpers);
    }
    expect(isDiplomacyComplete(state)).toBe(true);
  });
});
