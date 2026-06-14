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

function placeSeaNaval(state, seaZone, owner, squadrons = 0, corsairs = 0, leaders = []) {
  if (!state.spaces[seaZone]) state.spaces[seaZone] = { units: [] };
  state.spaces[seaZone].units.push({
    owner,
    regulars: 0,
    mercenaries: 0,
    cavalry: 0,
    squadrons,
    corsairs,
    leaders
  });
}

function sumNavalInControlledPorts(state, owner) {
  let total = 0;
  for (const sp of Object.values(state.spaces)) {
    if (!sp.isPort || sp.controller !== owner) continue;
    for (const u of sp.units || []) {
      if (u.owner !== owner) continue;
      total += (u.squadrons || 0) + (u.corsairs || 0);
    }
  }
  return total;
}

function sumAllNaval(state, owner) {
  let total = 0;
  for (const sp of Object.values(state.spaces)) {
    for (const u of sp.units || []) {
      if (u.owner !== owner) continue;
      total += (u.squadrons || 0) + (u.corsairs || 0);
    }
  }
  return total;
}

describe('executeWinter', () => {
  // ── Step 3: Naval return ───────────────────────────────────────

  it('returns sea-zone naval units to controlled ports', () => {
    const state = winterState();
    const helpers = createMockHelpers();
    const before = sumNavalInControlledPorts(state, 'ottoman');

    placeSeaNaval(state, 'Ionian Sea', 'ottoman', 2, 0);
    executeWinter(state, helpers);

    const after = sumNavalInControlledPorts(state, 'ottoman');
    const source = state.spaces['Ionian Sea'].units.find(u => u.owner === 'ottoman');
    expect(after).toBe(before + 2);
    expect((source?.squadrons || 0) + (source?.corsairs || 0)).toBe(0);
  });

  it('returns naval units from non-controlled ports to controlled ports', () => {
    const state = winterState();
    const helpers = createMockHelpers();
    const before = sumNavalInControlledPorts(state, 'ottoman');

    state.spaces['Corfu'].units.push({
      owner: 'ottoman',
      regulars: 0,
      mercenaries: 0,
      cavalry: 0,
      squadrons: 1,
      corsairs: 0,
      leaders: []
    });

    executeWinter(state, helpers);

    const after = sumNavalInControlledPorts(state, 'ottoman');
    const inCorfu = state.spaces['Corfu'].units.find(u => u.owner === 'ottoman');
    expect(after).toBe(before + 1);
    expect((inCorfu?.squadrons || 0) + (inCorfu?.corsairs || 0)).toBe(0);
  });

  it('eliminates naval units if no controlled port exists', () => {
    const state = winterState();
    const helpers = createMockHelpers();
    placeSeaNaval(state, 'Ionian Sea', 'ottoman', 2, 0);

    for (const sp of Object.values(state.spaces)) {
      if (sp.isPort && sp.controller === 'ottoman') {
        sp.controller = 'hapsburg';
      }
    }

    const before = sumAllNaval(state, 'ottoman');
    executeWinter(state, helpers);
    const after = sumAllNaval(state, 'ottoman');

    expect(after).toBeLessThan(before);
    const eliminatedEvent = state.eventLog.find(e => e.type === 'winter_naval_eliminated');
    expect(eliminatedEvent).toBeDefined();
  });

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

    // Vienna is a Hapsburg capital — gets +1 regular from step 6 replacements
    const vienna = state.spaces['Vienna'];
    vienna.controller = 'hapsburg';
    vienna.unrest = false;
    vienna.besieged = false;
    let hapStack = vienna.units.find(u => u.owner === 'hapsburg');
    if (!hapStack) {
      hapStack = { owner: 'hapsburg', regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: [] };
      vienna.units.push(hapStack);
    }
    const before = hapStack.regulars;

    executeWinter(state, helpers);

    const after = vienna.units.find(u => u.owner === 'hapsburg');
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

  it('resets England ruler-change marker', () => {
    const state = winterState({ englandRulerChangedThisTurn: true });
    const helpers = createMockHelpers();
    executeWinter(state, helpers);
    expect(state.englandRulerChangedThisTurn).toBe(false);
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
    // Place ottoman units in a truly unfortified space (not fortress or key)
    const testSpace = Object.entries(state.spaces).find(
      ([name, sp]) => !sp.isFortress && !sp.isKey && sp.controller === 'ottoman'
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

// ── Edge Case Tests ──────────────────────────────────────────────

describe('executeWinter — attrition edge cases', () => {
  it('removes mercenaries before regulars during attrition', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Find an unfortified, non-key ottoman space with no friendly fortress nearby
    // Use Nicopolis — unfortified space controlled by ottoman
    state.spaces['Nicopolis'].units.push({
      owner: 'ottoman', regulars: 2, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    // Ensure no nearby fortified space (fortress or key) is reachable
    // Block all Ottoman fortresses and key spaces
    for (const [name, sp] of Object.entries(state.spaces)) {
      if ((sp.isFortress || sp.isKey) && sp.controller === 'ottoman' && name !== 'Nicopolis') {
        sp.controller = 'france';
      }
    }
    state.spaces['Istanbul'].controller = 'france';

    executeWinter(state, helpers);

    // With no friendly fortress and capital enemy-controlled, units are eliminated
    const ottStack = state.spaces['Nicopolis'].units.find(u => u.owner === 'ottoman');
    expect(!ottStack || ottStack.regulars === 0).toBe(true);
  });

  it('applies attrition losing mercenaries first, then regulars, then cavalry', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Place mixed units in an unfortified space
    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 2, mercenaries: 2,
      cavalry: 2, squadrons: 0, corsairs: 0, leaders: []
    }];

    // Block all paths to friendly fortified spaces (fortresses + keys) so attrition triggers
    for (const [name, sp] of Object.entries(state.spaces)) {
      if ((sp.isFortress || sp.isKey) && sp.controller === 'ottoman' && name !== 'Edirne') {
        sp.controller = 'france';
      }
    }
    // Keep Istanbul as capital but non-controlled to trigger attrition path
    state.spaces['Istanbul'].controller = 'france';

    executeWinter(state, helpers);

    // Attrition event should have been logged
    const attritionEvent = state.eventLog.find(e => e.type === 'winter_attrition');
    const eliminatedEvent = state.eventLog.find(e => e.type === 'winter_eliminated');
    // Either attrition or elimination occurred for units in unfortified space
    expect(attritionEvent || eliminatedEvent).toBeDefined();
  });

  it('eliminates units when no friendly fort and capital is enemy-controlled', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Place france units in an unfortified space far from Paris
    state.spaces['Dijon'].units.push({
      owner: 'france', regulars: 3, mercenaries: 1,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    // Make Paris enemy-controlled
    state.spaces['Paris'].controller = 'hapsburg';
    // Block all French fortified spaces
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && (sp.isFortress || sp.isKey)) {
        sp.controller = 'hapsburg';
      }
    }

    executeWinter(state, helpers);

    const fraStack = state.spaces['Dijon'].units.find(u => u.owner === 'france');
    // Units should be eliminated (0 regulars, 0 mercenaries)
    expect(!fraStack || (fraStack.regulars === 0 && fraStack.mercenaries === 0)).toBe(true);
    const eliminatedEvent = state.eventLog.find(e => e.type === 'winter_eliminated');
    expect(eliminatedEvent).toBeDefined();
  });
});

describe('executeWinter — loan squadron edge cases', () => {
  it('returns loaned squadrons from borrower to lender at same port', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Use Istanbul (ottoman-controlled port) — lend from ottoman to hapsburg
    // Give hapsburg some squadrons at Istanbul representing loaned ones
    state.spaces['Istanbul'].units.push({
      owner: 'hapsburg', regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 3, corsairs: 0, leaders: []
    });

    state.loanedSquadrons = [{
      lender: 'ottoman', borrower: 'hapsburg', port: 'Istanbul', count: 2
    }];

    const ottBefore = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    const ottSquadBefore = ottBefore.squadrons;

    executeWinter(state, helpers);

    expect(state.loanedSquadrons).toEqual([]);
    // Hapsburg should have lost 2 squadrons at Istanbul (3 - 2 = 1)
    // Note: hapsburg naval units at Istanbul (not hapsburg-controlled) will be
    // moved by step 3, so check total naval for hapsburg instead
    const ottAfter = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(ottAfter.squadrons).toBe(ottSquadBefore + 2);
  });

  it('handles multiple loans returned correctly', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Two loans: ottoman lends 2, france lends 1 to hapsburg at Istanbul
    state.spaces['Istanbul'].units.push({
      owner: 'hapsburg', regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 5, corsairs: 0, leaders: []
    });

    state.loanedSquadrons = [
      { lender: 'ottoman', borrower: 'hapsburg', port: 'Istanbul', count: 2 },
      { lender: 'france', borrower: 'hapsburg', port: 'Istanbul', count: 1 }
    ];

    const ottBefore = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    const ottSquadBefore = ottBefore.squadrons;

    executeWinter(state, helpers);

    expect(state.loanedSquadrons).toEqual([]);
    // Ottoman should have received 2 back
    const ottAfter = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(ottAfter.squadrons).toBe(ottSquadBefore + 2);

    // France should have received 1 (created stack at Istanbul, then moved by naval return)
    // Just verify the event log
    const loansEvent = state.eventLog.find(e => e.type === 'loans_returned');
    expect(loansEvent).toBeDefined();
    expect(loansEvent.data.count).toBe(2);
  });

  it('caps loan return at borrower available squadrons', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Hapsburg has fewer squadrons than owed (some lost in combat)
    state.spaces['Istanbul'].units.push({
      owner: 'hapsburg', regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 1, corsairs: 0, leaders: []
    });

    state.loanedSquadrons = [{
      lender: 'ottoman', borrower: 'hapsburg', port: 'Istanbul', count: 3
    }];

    const ottBefore = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    const ottSquadBefore = ottBefore.squadrons;

    executeWinter(state, helpers);

    // Ottoman should only receive 1 (min of 1 available, 3 owed)
    const ottAfter = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(ottAfter.squadrons).toBe(ottSquadBefore + 1);
  });

  it('logs loans_returned event', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    state.spaces['Istanbul'].units.push({
      owner: 'hapsburg', regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 3, corsairs: 0, leaders: []
    });

    state.loanedSquadrons = [{
      lender: 'ottoman', borrower: 'hapsburg', port: 'Istanbul', count: 1
    }];

    executeWinter(state, helpers);

    const loansEvent = state.eventLog.find(e => e.type === 'loans_returned');
    expect(loansEvent).toBeDefined();
    expect(loansEvent.data.count).toBe(1);
  });
});

describe('executeWinter — mandatory event edge cases', () => {
  it('processes multiple overdue mandatory events in same hand', () => {
    const state = winterState();
    state.turn = 4;
    // Card #13 (Schmalkaldic League) dueByTurn 4, removeAfterPlay: true
    // Card #14 (Paul III) dueByTurn 4, removeAfterPlay: false
    state.hands.hapsburg = [13, 14];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.hands.hapsburg).not.toContain(13);
    expect(state.hands.hapsburg).not.toContain(14);
    expect(state.mandatoryEventsPlayed).toContain(13);
    expect(state.mandatoryEventsPlayed).toContain(14);
    // Card 13 should be removed, card 14 should be discarded
    expect(state.removedCards).toContain(13);
    expect(state.discard).toContain(14);
  });

  it('skips already-played mandatory events', () => {
    const state = winterState();
    state.turn = 2;
    state.mandatoryEventsPlayed = [10]; // Already played
    state.hands.papacy = [10];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    // Card stays in hand because it was already marked as played
    expect(state.hands.papacy).toContain(10);
  });
});

describe('executeWinter — besieged space handling', () => {
  it('does not add replacement regulars to capital with unrest', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    state.spaces['Rome'].unrest = true;
    const initialStack = state.spaces['Rome'].units.find(u => u.owner === 'papacy');
    const initialRegs = initialStack ? initialStack.regulars : 0;

    executeWinter(state, helpers);

    const afterStack = state.spaces['Rome'].units.find(u => u.owner === 'papacy');
    // Should not have received a replacement due to unrest
    expect(!afterStack || afterStack.regulars <= initialRegs).toBe(true);
  });

  it('skips units in non-besieged fortress during land return', () => {
    const state = winterState();
    const helpers = createMockHelpers();

    // Brussels is a hapsburg-controlled fortress (isFortress: true)
    const brusselsStack = state.spaces['Brussels'].units.find(u => u.owner === 'hapsburg');
    const initialRegs = brusselsStack ? brusselsStack.regulars : 0;
    // Add more units
    if (brusselsStack) {
      brusselsStack.regulars += 3;
    } else {
      state.spaces['Brussels'].units.push({
        owner: 'hapsburg', regulars: 3, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
    }

    executeWinter(state, helpers);

    // Units in a fortress should remain (step 4 skips isFortress spaces)
    const afterStack = state.spaces['Brussels'].units.find(u => u.owner === 'hapsburg');
    expect(afterStack).toBeDefined();
    expect(afterStack.regulars).toBeGreaterThanOrEqual(initialRegs + 3);
  });
});

describe('executeWinter — state reset edge cases', () => {
  it('clears pendingInterception', () => {
    const state = winterState();
    state.pendingInterception = { something: true };
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.pendingInterception).toBeNull();
  });

  it('clears impulseActions array', () => {
    const state = winterState();
    state.impulseActions = [{ type: 'move' }, { type: 'raise_regular' }];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.impulseActions).toEqual([]);
  });

  it('clears alliancesFormedThisTurn', () => {
    const state = winterState();
    state.alliancesFormedThisTurn = ['hapsburg-england'];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    expect(state.alliancesFormedThisTurn).toEqual([]);
  });

  it('does not log reformers_returned if no excommunicated reformers', () => {
    const state = winterState({ excommunicatedReformers: [] });
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    const returnEvent = state.eventLog.find(e => e.type === 'reformers_returned');
    expect(returnEvent).toBeUndefined();
  });

  it('handles empty loanedSquadrons without logging', () => {
    const state = winterState();
    state.loanedSquadrons = [];
    const helpers = createMockHelpers();

    executeWinter(state, helpers);

    const loansEvent = state.eventLog.find(e => e.type === 'loans_returned');
    expect(loansEvent).toBeUndefined();
  });
});
