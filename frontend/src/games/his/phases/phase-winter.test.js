/**
 * Here I Stand — phase-winter.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import { executeWinter } from './phase-winter.js';
import { CAPITALS } from '../constants.js';

function winterState(overrides = {}) {
  const state = createTestState();
  // Ensure new state fields exist
  state.excommunicatedReformers = [];
  state.excommunicatedRulers = {};
  state.mandatoryEventsPlayed = [];
  state.loanedSquadrons = [];
  return { ...state, ...overrides };
}

describe('executeWinter', () => {
  // ── Step 5: Alliance removal ────────────────────────────────────

  it('removes all alliances', () => {
    const state = winterState({
      alliances: [{ a: 'hapsburg', b: 'england' }]
    });
    const helpers = createMockHelpers();
    executeWinter(state, helpers);
    expect(state.alliances).toEqual([]);
  });

  // ── Step 6: Replacements ────────────────────────────────────────

  it('adds 1 regular to each friendly capital', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Brussels is a fortress capital — units stay during land return (step 4)
    const brussels = state.spaces['Brussels'];
    const hapStack = brussels.units.find(u => u.owner === 'hapsburg');
    const before = hapStack ? hapStack.regulars : 0;

    executeWinter(state, helpers);

    const after = brussels.units.find(u => u.owner === 'hapsburg');
    expect(after.regulars).toBeGreaterThanOrEqual(before + 1);
  });

  it('does not add regulars to enemy-controlled capital', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Make London enemy-controlled
    state.spaces['London'].controller = 'france';

    executeWinter(state, helpers);

    // England should not get a replacement in London
    const engStack = state.spaces['London'].units.find(u => u.owner === 'england');
    // Either no stack or no new regular
    expect(!engStack || engStack.regulars === 0).toBe(true);
  });

  it('does not add regulars to besieged capital', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    state.spaces['Paris'].besieged = true;

    executeWinter(state, helpers);

    const fraStack = state.spaces['Paris'].units.find(u => u.owner === 'france');
    // Should not have gotten replacement
    const initialFra = createTestState().spaces['Paris'].units
      .find(u => u.owner === 'france')?.regulars || 0;
    expect(!fraStack || fraStack.regulars <= initialFra).toBe(true);
  });

  // ── Step 7: Piracy removal ──────────────────────────────────────

  it('clears piracy tracking', () => {
    const state = winterState({
      piracyUsed: { 'Western Mediterranean': true }
    });
    const helpers = createMockHelpers();
    executeWinter(state, helpers);
    expect(state.piracyUsed).toEqual({});
  });

  // ── Step 8: Reset turn state ────────────────────────────────────

  it('uncommits all debaters', () => {
    const state = winterState();
    state.debaters.papal[0].committed = true;
    state.debaters.protestant[0].committed = true;
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.debaters.papal.every(d => !d.committed)).toBe(true);
    expect(state.debaters.protestant.every(d => !d.committed)).toBe(true);
  });

  it('clears pending interactions', () => {
    const state = winterState({
      pendingReformation: { something: true },
      pendingDebate: { something: true },
      pendingBattle: { something: true },
      cpRemaining: 5,
      activeCardNumber: 42
    });
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.pendingReformation).toBeNull();
    expect(state.pendingDebate).toBeNull();
    expect(state.pendingBattle).toBeNull();
    expect(state.cpRemaining).toBe(0);
    expect(state.activeCardNumber).toBeNull();
  });

  it('resets diplomacy tracking', () => {
    const state = winterState({
      peaceMadeThisTurn: ['hapsburg-france'],
      diplomacySegment: 'negotiation',
      diplomacyActed: { ottoman: true },
      springDeploymentDone: { england: true }
    });
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.peaceMadeThisTurn).toEqual([]);
    expect(state.diplomacySegment).toBeNull();
    expect(state.diplomacyActed).toEqual({});
    expect(state.springDeploymentDone).toEqual({});
  });

  it('resets augsburg confession marker', () => {
    const state = winterState({ augsburgConfessionActive: true });
    const helpers = createMockHelpers();
    executeWinter(state, helpers);
    expect(state.augsburgConfessionActive).toBe(false);
  });

  // ── Step 9: Overdue mandatory events ────────────────────────────

  it('removes overdue mandatory events from hand', () => {
    const state = winterState();
    state.turn = 2;
    // Card #10 (Clement VII) is due by turn 2
    state.hands.papacy = [10, 42];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.hands.papacy).not.toContain(10);
    expect(state.mandatoryEventsPlayed).toContain(10);
  });

  it('does not remove non-overdue mandatory events', () => {
    const state = winterState();
    state.turn = 1;
    // Card #10 (Clement VII) is due by turn 2 — not overdue yet
    state.hands.papacy = [10];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.hands.papacy).toContain(10);
  });

  it('handles card disposal for overdue removed cards', () => {
    const state = winterState();
    state.turn = 3;
    // Card #9 (Barbary Pirates) due by turn 3, removeAfterPlay: true
    state.hands.ottoman = [9];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.removedCards).toContain(9);
    expect(state.discard).not.toContain(9);
  });

  it('handles card disposal for overdue non-removed cards', () => {
    const state = winterState();
    state.turn = 2;
    // Card #10 (Clement VII) due by turn 2, removeAfterPlay: false
    state.hands.hapsburg = [10];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.discard).toContain(10);
    expect(state.removedCards).not.toContain(10);
  });

  // ── Excommunicated reformers ────────────────────────────────────

  it('returns excommunicated reformers', () => {
    const state = winterState({
      excommunicatedReformers: ['luther', 'zwingli']
    });
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.excommunicatedReformers).toEqual([]);
    const returnEvent = state.eventLog.find(e => e.type === 'reformers_returned');
    expect(returnEvent).toBeDefined();
  });

  // ── Step 2: Renegade leader ─────────────────────────────────────

  it('removes renegade leader from map', () => {
    const state = winterState();
    // Place renegade in a space
    state.spaces['Vienna'].units.push({
      owner: 'independent', regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0,
      leaders: ['renegade']
    });
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    const hasRenegade = state.spaces['Vienna'].units
      .some(u => u.leaders.includes('renegade'));
    expect(hasRenegade).toBe(false);
  });

  // ── Step 1: Loan markers ────────────────────────────────────────

  it('clears loaned squadrons', () => {
    const state = winterState();
    state.loanedSquadrons = [{ from: 'genoa', to: 'france' }];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.loanedSquadrons).toEqual([]);
  });

  // ── Step 4: Land unit return ────────────────────────────────────

  it('moves units from unfortified spaces', () => {
    const state = winterState();
    // Place ottoman units in an unfortified space
    const testSpace = Object.entries(state.spaces).find(
      ([name, sp]) => !sp.isFortress && sp.controller === 'ottoman'
    );
    if (testSpace) {
      const [name, sp] = testSpace;
      sp.units.push({
        owner: 'ottoman', regulars: 3, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
      const helpers = createMockHelpers();

      executeWinter(state, helpers);

      const remaining = sp.units.find(u => u.owner === 'ottoman');
      // Units should have been moved (regulars = 0 in source)
      expect(!remaining || remaining.regulars === 0).toBe(true);
    }
  });

  // ── Event log ───────────────────────────────────────────────────

  it('logs winter event', () => {
    const state = winterState();
    const helpers = createMockHelpers();
    executeWinter(state, helpers);
    const winterEvent = state.eventLog.find(e => e.type === 'winter');
    expect(winterEvent).toBeDefined();
  });
});
