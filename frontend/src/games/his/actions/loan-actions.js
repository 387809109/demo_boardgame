/**
 * Here I Stand — Squadron Loan System
 *
 * Allied powers may loan squadrons during the Action Phase.
 * Loaned squadrons are returned during Winter (phase-winter.js).
 */

import { areAllied } from '../state/war-helpers.js';
import { getUnitsInSpace } from '../state/state-helpers.js';

/**
 * Validate a squadron loan.
 * @param {Object} state
 * @param {string} lender - Power lending squadrons
 * @param {Object} actionData - { borrower, port, count }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateLoanSquadrons(state, lender, actionData) {
  const { borrower, port, count } = actionData;

  if (!borrower) return { valid: false, error: 'Missing borrower' };
  if (!port) return { valid: false, error: 'Missing port' };
  if (!count || count < 1) return { valid: false, error: 'Must loan at least 1 squadron' };

  if (!areAllied(state, lender, borrower)) {
    return { valid: false, error: 'Powers must be allied to loan squadrons' };
  }

  const sp = state.spaces[port];
  if (!sp) return { valid: false, error: `Port "${port}" not found` };
  if (!sp.isPort) return { valid: false, error: `"${port}" is not a port` };
  if (sp.besieged) return { valid: false, error: 'Cannot loan from a besieged port' };

  // Check lender has squadrons in this port
  const stack = getUnitsInSpace(state, port, lender);
  if (!stack || stack.squadrons < count) {
    return {
      valid: false,
      error: `Lender has insufficient squadrons in ${port} (has ${stack?.squadrons || 0}, need ${count})`
    };
  }

  return { valid: true };
}

/**
 * Execute a squadron loan.
 * @param {Object} state
 * @param {string} lender
 * @param {Object} actionData - { borrower, port, count }
 * @param {Object} helpers
 */
export function executeLoanSquadrons(state, lender, actionData, helpers) {
  const { borrower, port, count } = actionData;

  // Remove from lender's stack
  const lenderStack = getUnitsInSpace(state, port, lender);
  lenderStack.squadrons -= count;

  // Add to borrower's stack (create if needed)
  const sp = state.spaces[port];
  let borrowerStack = sp.units.find(u => u.owner === borrower);
  if (!borrowerStack) {
    borrowerStack = {
      owner: borrower, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    sp.units.push(borrowerStack);
  }
  borrowerStack.squadrons += count;

  // Record loan for Winter return
  state.loanedSquadrons.push({
    lender,
    borrower,
    port,
    count
  });

  helpers.logEvent(state, 'squadron_loan', {
    lender, borrower, port, count
  });
}

/**
 * Return all loaned squadrons to their lenders.
 * Called during Winter phase.
 * @param {Object} state
 * @param {Object} helpers
 */
export function returnLoanedSquadrons(state, helpers) {
  if (!state.loanedSquadrons || state.loanedSquadrons.length === 0) return;

  for (const loan of state.loanedSquadrons) {
    const { lender, borrower, port, count } = loan;
    const sp = state.spaces[port];
    if (!sp) continue;

    // Remove from borrower
    const borrowerStack = sp.units.find(u => u.owner === borrower);
    if (borrowerStack) {
      const toReturn = Math.min(borrowerStack.squadrons, count);
      borrowerStack.squadrons -= toReturn;

      // Return to lender
      let lenderStack = sp.units.find(u => u.owner === lender);
      if (!lenderStack) {
        lenderStack = {
          owner: lender, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(lenderStack);
      }
      lenderStack.squadrons += toReturn;
    }
  }

  helpers.logEvent(state, 'loans_returned', {
    count: state.loanedSquadrons.length
  });

  state.loanedSquadrons = [];
}
