/**
 * Here I Stand — loan-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  validateLoanSquadrons, executeLoanSquadrons, returnLoanedSquadrons
} from './loan-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function loanState(overrides = {}) {
  const state = createTestState({
    loanedSquadrons: [],
    ...overrides
  });
  // Set up alliance and squadrons for testing
  state.alliances.push({ a: 'ottoman', b: 'france' });

  // Place Ottoman squadrons in Istanbul (a port)
  const istanbul = state.spaces['Istanbul'];
  let ottStack = istanbul.units.find(u => u.owner === 'ottoman');
  if (!ottStack) {
    ottStack = {
      owner: 'ottoman', regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    istanbul.units.push(ottStack);
  }
  ottStack.squadrons = 4;

  return state;
}

describe('validateLoanSquadrons', () => {
  it('rejects when powers not allied', () => {
    const state = loanState();
    state.alliances = []; // Remove alliance
    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 1
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('allied');
  });

  it('rejects invalid port', () => {
    const state = loanState();
    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Wittenberg', count: 1
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not a port');
  });

  it('rejects insufficient squadrons', () => {
    const state = loanState();
    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 10
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('insufficient');
  });

  it('rejects besieged port', () => {
    const state = loanState();
    state.spaces['Istanbul'].besieged = true;
    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 1
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('besieged');
  });

  it('accepts valid loan', () => {
    const state = loanState();
    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    });
    expect(r.valid).toBe(true);
  });
});

describe('executeLoanSquadrons', () => {
  it('transfers squadrons from lender to borrower', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    }, helpers);

    const istanbul = state.spaces['Istanbul'];
    const ottStack = istanbul.units.find(u => u.owner === 'ottoman');
    const fraStack = istanbul.units.find(u => u.owner === 'france');

    expect(ottStack.squadrons).toBe(2); // 4 - 2
    expect(fraStack.squadrons).toBe(2);
  });

  it('records loan for Winter return', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    }, helpers);

    expect(state.loanedSquadrons).toHaveLength(1);
    expect(state.loanedSquadrons[0]).toEqual({
      lender: 'ottoman', borrower: 'france',
      port: 'Istanbul', count: 2
    });
  });
});

describe('returnLoanedSquadrons', () => {
  it('returns loaned squadrons to lender', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    // Execute loan first
    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    }, helpers);

    // Now return
    returnLoanedSquadrons(state, helpers);

    const istanbul = state.spaces['Istanbul'];
    const ottStack = istanbul.units.find(u => u.owner === 'ottoman');
    const fraStack = istanbul.units.find(u => u.owner === 'france');

    expect(ottStack.squadrons).toBe(4); // restored
    expect(fraStack.squadrons).toBe(0);
    expect(state.loanedSquadrons).toEqual([]);
  });

  it('handles partial return if borrower lost squadrons', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    }, helpers);

    // Simulate borrower losing 1 squadron in combat
    const fraStack = state.spaces['Istanbul'].units.find(u => u.owner === 'france');
    fraStack.squadrons = 1;

    returnLoanedSquadrons(state, helpers);

    const ottStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(ottStack.squadrons).toBe(3); // 2 + 1 (partial return)
  });

  it('no-op when no loans exist', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    returnLoanedSquadrons(state, helpers);

    // Should not crash or log
    expect(state.loanedSquadrons).toEqual([]);
  });
});
