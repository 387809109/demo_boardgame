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

  it('returns 0 squadrons when borrower has 0 left', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 3
    }, helpers);

    // Simulate borrower losing ALL squadrons in combat
    const fraStack = state.spaces['Istanbul'].units.find(u => u.owner === 'france');
    fraStack.squadrons = 0;

    const ottBefore = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    const ottBefore_sq = ottBefore.squadrons; // 4 - 3 = 1

    returnLoanedSquadrons(state, helpers);

    const ottStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    // toReturn = Math.min(0, 3) = 0, so lender gets nothing back
    expect(ottStack.squadrons).toBe(ottBefore_sq); // stays at 1
    expect(fraStack.squadrons).toBe(0);
  });

  it('restores exact count to lender when borrower has all', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 3
    }, helpers);

    // Borrower still has all 3
    const fraStack = state.spaces['Istanbul'].units.find(u => u.owner === 'france');
    expect(fraStack.squadrons).toBe(3);

    returnLoanedSquadrons(state, helpers);

    const ottStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    // Had 4, loaned 3 (kept 1), got 3 back → 4
    expect(ottStack.squadrons).toBe(4);
    expect(fraStack.squadrons).toBe(0);
  });

  it('tracks multiple simultaneous loans from different lenders', () => {
    const state = loanState();
    const helpers = createMockHelpers();

    // Add a second alliance: hapsburg-france
    state.alliances.push({ a: 'hapsburg', b: 'france' });

    // Naples already has a hapsburg stack from scenario setup; set its squadrons to 5
    const hapNaples = state.spaces['Naples'].units.find(u => u.owner === 'hapsburg');
    hapNaples.squadrons = 5;

    // Loan 1: Ottoman lends 2 to France in Istanbul
    executeLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    }, helpers);

    // Loan 2: Hapsburg lends 3 to France in Naples
    executeLoanSquadrons(state, 'hapsburg', {
      borrower: 'france', port: 'Naples', count: 3
    }, helpers);

    expect(state.loanedSquadrons).toHaveLength(2);
    expect(state.loanedSquadrons[0].lender).toBe('ottoman');
    expect(state.loanedSquadrons[1].lender).toBe('hapsburg');

    // Verify intermediate state
    expect(hapNaples.squadrons).toBe(2); // 5 - 3

    // Return all loans
    returnLoanedSquadrons(state, helpers);

    const ottStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(ottStack.squadrons).toBe(4); // restored
    expect(hapNaples.squadrons).toBe(5); // restored: 2 + 3
    expect(state.loanedSquadrons).toEqual([]);
  });
});

describe('validateLoanSquadrons — edge cases', () => {
  it('rejects when lender has 0 squadrons in port', () => {
    const state = loanState();
    // Set Ottoman squadrons to 0
    const ottStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    ottStack.squadrons = 0;

    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 1
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('insufficient');
  });

  it('accepts when lender has exactly the count requested', () => {
    const state = loanState();
    // Set Ottoman squadrons to exactly 2
    const ottStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    ottStack.squadrons = 2;

    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 2
    });
    expect(r.valid).toBe(true);
  });

  it('rejects when lender has no unit stack in port', () => {
    const state = loanState();
    // Remove all Ottoman units from Istanbul
    state.spaces['Istanbul'].units = state.spaces['Istanbul'].units.filter(
      u => u.owner !== 'ottoman'
    );

    const r = validateLoanSquadrons(state, 'ottoman', {
      borrower: 'france', port: 'Istanbul', count: 1
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('insufficient');
  });
});
