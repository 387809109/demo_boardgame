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

// ── Edge Case Tests ───────────────────────────────────────────────

describe('DIPLOMACY_SEGMENTS constant — segment sequence', () => {
  it('contains exactly 5 segments in the correct order', () => {
    expect(DIPLOMACY_SEGMENTS).toEqual([
      'negotiation',
      'sue_for_peace',
      'ransom',
      'excommunication',
      'declarations_of_war'
    ]);
  });

  it('segment order matches advanceDiplomacySegment traversal', () => {
    const { state, helpers } = setup();
    const visited = [getCurrentSegment(state)];
    while (advanceDiplomacySegment(state, helpers)) {
      visited.push(getCurrentSegment(state));
    }
    expect(visited).toEqual(DIPLOMACY_SEGMENTS);
  });
});

describe('advanceDiplomacySegment — advance after completion', () => {
  it('wraps back to first segment when advanced past the end', () => {
    const { state, helpers } = setup();
    // Advance through all segments to complete diplomacy
    for (let i = 0; i < DIPLOMACY_SEGMENTS.length; i++) {
      advanceDiplomacySegment(state, helpers);
    }
    expect(getCurrentSegment(state)).toBeNull();

    // Advance again — indexOf(null)===-1, so -1 < length-1, wraps to index 0
    const result = advanceDiplomacySegment(state, helpers);
    expect(result).toBe(true);
    expect(getCurrentSegment(state)).toBe('negotiation');
  });

  it('does not crash on repeated advances after completion', () => {
    const { state, helpers } = setup();
    for (let i = 0; i < DIPLOMACY_SEGMENTS.length; i++) {
      advanceDiplomacySegment(state, helpers);
    }

    // Calling advance after null wraps to negotiation, then continues
    expect(() => {
      for (let i = 0; i < 10; i++) {
        advanceDiplomacySegment(state, helpers);
      }
    }).not.toThrow();
  });
});

describe('canActInSegment — null segment edge cases', () => {
  it('returns false for all powers when diplomacy is complete', () => {
    const { state, helpers } = setup();
    for (let i = 0; i < DIPLOMACY_SEGMENTS.length; i++) {
      advanceDiplomacySegment(state, helpers);
    }
    for (const power of IMPULSE_ORDER) {
      expect(canActInSegment(state, power)).toBe(false);
    }
  });

  it('returns false for papacy when segment is null', () => {
    const { state } = setup();
    state.diplomacySegment = null;
    expect(canActInSegment(state, 'papacy')).toBe(false);
  });

  it('returns false for undefined segment (missing property)', () => {
    const state = createTestState();
    // diplomacySegment is not set (undefined)
    expect(canActInSegment(state, 'ottoman')).toBe(false);
  });
});

describe('allActedInSegment — extra unknown power in diplomacyActed', () => {
  it('ignores extra unknown powers and checks only IMPULSE_ORDER', () => {
    const { state } = setup();
    // Mark an unknown power
    state.diplomacyActed['unknown_power'] = true;
    state.diplomacyActed['alien_faction'] = true;
    // Not all real powers have acted
    expect(allActedInSegment(state)).toBe(false);
  });

  it('returns true when all IMPULSE_ORDER powers acted, extra keys ignored', () => {
    const { state } = setup();
    for (const p of IMPULSE_ORDER) markActed(state, p);
    state.diplomacyActed['bogus_power'] = true;
    expect(allActedInSegment(state)).toBe(true);
  });

  it('excommunication segment ignores extra powers, only needs papacy', () => {
    const { state } = setup();
    state.diplomacySegment = 'excommunication';
    state.diplomacyActed['unknown'] = true;
    expect(allActedInSegment(state)).toBe(false);
    markActed(state, 'papacy');
    expect(allActedInSegment(state)).toBe(true);
  });
});

describe('markActed — idempotency', () => {
  it('marking same power twice does not break state', () => {
    const { state } = setup();
    markActed(state, 'ottoman');
    markActed(state, 'ottoman');
    expect(state.diplomacyActed['ottoman']).toBe(true);
    // canAct should still be false
    expect(canActInSegment(state, 'ottoman')).toBe(false);
  });

  it('marking same power twice still allows other powers', () => {
    const { state } = setup();
    markActed(state, 'ottoman');
    markActed(state, 'ottoman');
    expect(canActInSegment(state, 'hapsburg')).toBe(true);
  });

  it('allActedInSegment unaffected by double-marking', () => {
    const { state } = setup();
    for (const p of IMPULSE_ORDER) {
      markActed(state, p);
      markActed(state, p); // double mark
    }
    expect(allActedInSegment(state)).toBe(true);
  });
});

describe('initDiplomacyPhase — resets segment tracking', () => {
  it('resets segment to first after mid-phase re-init', () => {
    const { state, helpers } = setup();
    advanceDiplomacySegment(state, helpers);
    advanceDiplomacySegment(state, helpers);
    expect(getCurrentSegment(state)).toBe('ransom');

    // Re-init should reset
    initDiplomacyPhase(state, helpers);
    expect(getCurrentSegment(state)).toBe('negotiation');
  });

  it('clears diplomacyActed when re-initialized', () => {
    const { state, helpers } = setup();
    markActed(state, 'ottoman');
    markActed(state, 'hapsburg');

    initDiplomacyPhase(state, helpers);
    expect(state.diplomacyActed).toEqual({});
  });

  it('resets tracking arrays when re-initialized', () => {
    const { state, helpers } = setup();
    state.peaceMadeThisTurn.push('some_peace');
    state.alliancesFormedThisTurn.push('some_alliance');

    initDiplomacyPhase(state, helpers);
    expect(state.peaceMadeThisTurn).toEqual([]);
    expect(state.alliancesFormedThisTurn).toEqual([]);
  });

  it('resets from completed state back to first segment', () => {
    const { state, helpers } = setup();
    // Complete all segments
    for (let i = 0; i < DIPLOMACY_SEGMENTS.length; i++) {
      advanceDiplomacySegment(state, helpers);
    }
    expect(isDiplomacyComplete(state)).toBe(true);

    // Re-init
    initDiplomacyPhase(state, helpers);
    expect(isDiplomacyComplete(state)).toBe(false);
    expect(getCurrentSegment(state)).toBe('negotiation');
  });
});
