/**
 * Here I Stand — cp-manager.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  startCpSpending, spendCp, endCpSpending,
  isInCpMode, hasPendingInteraction,
  canAfford, getActionCost, getAvailableCpActions
} from './cp-manager.js';
import { createTestState } from '../test-helpers.js';

describe('startCpSpending', () => {
  it('sets cpRemaining and activeCardNumber', () => {
    const state = createTestState();
    startCpSpending(state, 42, 5);
    expect(state.cpRemaining).toBe(5);
    expect(state.activeCardNumber).toBe(42);
    expect(state.impulseActions).toEqual([]);
  });

  it('clears any pending state', () => {
    const state = createTestState();
    state.pendingReformation = { type: 'reformation' };
    startCpSpending(state, 10, 3);
    expect(state.pendingReformation).toBeNull();
    expect(state.pendingDebate).toBeNull();
  });
});

describe('spendCp', () => {
  it('decrements cpRemaining', () => {
    const state = createTestState();
    state.cpRemaining = 5;
    spendCp(state, 2);
    expect(state.cpRemaining).toBe(3);
  });

  it('can go to zero', () => {
    const state = createTestState();
    state.cpRemaining = 1;
    spendCp(state, 1);
    expect(state.cpRemaining).toBe(0);
  });
});

describe('endCpSpending', () => {
  it('resets all CP state', () => {
    const state = createTestState();
    state.cpRemaining = 3;
    state.activeCardNumber = 42;
    state.impulseActions = ['move'];
    state.pendingReformation = { type: 'reformation' };
    endCpSpending(state);
    expect(state.cpRemaining).toBe(0);
    expect(state.activeCardNumber).toBeNull();
    expect(state.impulseActions).toEqual([]);
    expect(state.pendingReformation).toBeNull();
  });
});

describe('isInCpMode', () => {
  it('true when cpRemaining > 0', () => {
    expect(isInCpMode({ cpRemaining: 1, activeCardNumber: null })).toBe(true);
  });

  it('true when activeCardNumber is set', () => {
    expect(isInCpMode({ cpRemaining: 0, activeCardNumber: 42 })).toBe(true);
  });

  it('false when both zero/null', () => {
    expect(isInCpMode({ cpRemaining: 0, activeCardNumber: null })).toBe(false);
  });
});

describe('hasPendingInteraction', () => {
  it('true with pendingReformation', () => {
    expect(hasPendingInteraction({ pendingReformation: {}, pendingDebate: null })).toBe(true);
  });

  it('true with pendingDebate', () => {
    expect(hasPendingInteraction({ pendingReformation: null, pendingDebate: {} })).toBe(true);
  });

  it('false when all null', () => {
    expect(hasPendingInteraction({
      pendingReformation: null, pendingDebate: null,
      pendingBattle: null, pendingInterception: null
    })).toBe(false);
  });
});

describe('canAfford', () => {
  it('affordable when enough CP', () => {
    const state = createTestState();
    state.cpRemaining = 5;
    const result = canAfford(state, 'ottoman', 'RAISE_REGULAR');
    expect(result.affordable).toBe(true);
    expect(result.cost).toBe(2);
  });

  it('not affordable when insufficient CP', () => {
    const state = createTestState();
    state.cpRemaining = 1;
    const result = canAfford(state, 'ottoman', 'RAISE_REGULAR');
    expect(result.affordable).toBe(false);
    expect(result.reason).toContain('Not enough CP');
  });

  it('not available for power', () => {
    const state = createTestState();
    state.cpRemaining = 5;
    // Ottoman cannot buy mercenaries
    const result = canAfford(state, 'ottoman', 'BUY_MERCENARY');
    expect(result.affordable).toBe(false);
    expect(result.reason).toContain('not available');
  });

  it('unknown action type', () => {
    const state = createTestState();
    state.cpRemaining = 5;
    const result = canAfford(state, 'ottoman', 'NONSENSE');
    expect(result.affordable).toBe(false);
  });
});

describe('getActionCost', () => {
  it('returns cost for valid action', () => {
    expect(getActionCost('ottoman', 'RAISE_REGULAR')).toBe(2);
    expect(getActionCost('protestant', 'TRANSLATE_SCRIPTURE')).toBe(1);
  });

  it('returns null for unavailable action', () => {
    expect(getActionCost('ottoman', 'BUY_MERCENARY')).toBeNull();
    expect(getActionCost('protestant', 'BUILD_SQUADRON')).toBeNull();
  });

  it('returns null for unknown action', () => {
    expect(getActionCost('ottoman', 'UNKNOWN')).toBeNull();
  });
});

describe('getAvailableCpActions', () => {
  it('returns actions power can afford', () => {
    const state = createTestState();
    state.cpRemaining = 2;
    const actions = getAvailableCpActions(state, 'ottoman');
    const types = actions.map(a => a.actionType);
    expect(types).toContain('MOVE_FORMATION');
    expect(types).toContain('RAISE_REGULAR');
    expect(types).toContain('RAISE_CAVALRY');
    // Cannot afford initiate_piracy (2 CP) — wait, 2 CP is enough
    // Cannot do publish_treatise (null for ottoman)
    expect(types).not.toContain('PUBLISH_TREATISE');
  });

  it('returns empty when no CP', () => {
    const state = createTestState();
    state.cpRemaining = 0;
    expect(getAvailableCpActions(state, 'ottoman')).toEqual([]);
  });

  it('protestant has religious actions', () => {
    const state = createTestState();
    state.cpRemaining = 5;
    const actions = getAvailableCpActions(state, 'protestant');
    const types = actions.map(a => a.actionType);
    expect(types).toContain('PUBLISH_TREATISE');
    expect(types).toContain('TRANSLATE_SCRIPTURE');
    expect(types).toContain('CALL_DEBATE');
  });
});
