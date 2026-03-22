/**
 * Here I Stand — military-actions.js Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateMoveFormation, moveFormation,
  validateRaiseRegular, raiseRegular,
  validateBuyMercenary, buyMercenary,
  validateRaiseCavalry, raiseCavalry,
  validateBuildSquadron, buildSquadron,
  validateBuildCorsair, buildCorsair,
  validateControlUnfortified, controlUnfortified
} from './military-actions.js';
import { startCpSpending } from './cp-manager.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

/** Set up a state in CP-spending mode */
function cpState(cp = 10) {
  const state = createTestState();
  startCpSpending(state, 99, cp);
  return state;
}

describe('validateMoveFormation', () => {
  it('rejects missing from/to', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', { units: {} });
    expect(r.valid).toBe(false);
  });

  it('rejects non-adjacent spaces', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Paris', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not adjacent');
  });

  it('rejects when source has no units', () => {
    const state = cpState();
    // Edirne is adjacent to Istanbul but may have no ottoman units
    state.spaces['Edirne'].units = [];
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Edirne', to: 'Istanbul', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('No units');
  });

  it('rejects when not enough regulars', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 99 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Not enough regulars');
  });

  it('rejects exceeding formation cap (no leader)', () => {
    const state = cpState();
    // Move units without leaders — cap is 4
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 5 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('formation cap');
  });

  it('accepts valid move with leader', () => {
    const state = cpState();
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 4, cavalry: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);
    expect(r.cost).toBeGreaterThan(0);
  });

  it('allows move into enemy-occupied space (triggers pendingBattle)', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    // Declare war so movement is legal
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    // Put hapsburg units in Edirne
    state.spaces['Edirne'].units.push({
      owner: 'hapsburg', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(true);

    // Execute and verify pendingBattle is set
    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    }, helpers);
    expect(state.pendingBattle).toBeDefined();
    expect(state.pendingBattle.type).toBe('field_battle');
    expect(state.pendingBattle.attackerPower).toBe('ottoman');
    expect(state.pendingBattle.defenderPower).toBe('hapsburg');
  });

  it('allows move into active minor stack when allied major is at war', () => {
    const state = cpState();
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    state.alliances.push({ a: 'venice', b: 'hapsburg' });
    state.spaces['Edirne'].units.push({
      owner: 'venice', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1 }
    });
    expect(r.valid).toBe(true);
  });

  it('rejects move into active minor stack when allied major is not at war', () => {
    const state = cpState();
    state.alliances.push({ a: 'venice', b: 'hapsburg' });
    state.spaces['Edirne'].units.push({
      owner: 'venice', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('venice');
  });

  it('rejects when CP is insufficient', () => {
    const state = cpState(0);
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne', units: { regulars: 1, leaders: ['suleiman'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });
});

describe('moveFormation', () => {
  it('moves units from source to destination', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const before = state.spaces['Istanbul'].units[0].regulars;

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2, leaders: ['ibrahim'] }
    }, helpers);

    // Source should have fewer regulars
    const srcStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(srcStack.regulars).toBe(before - 2);
    expect(srcStack.leaders).not.toContain('ibrahim');

    // Destination should have the moved units (may merge with existing)
    const dstStack = state.spaces['Edirne'].units.find(u => u.owner === 'ottoman');
    expect(dstStack.regulars).toBeGreaterThanOrEqual(2);
    expect(dstStack.leaders).toContain('ibrahim');
  });

  it('deducts CP', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    const before = state.cpRemaining;

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    }, helpers);

    expect(state.cpRemaining).toBeLessThan(before);
  });

  it('records impulse action', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['suleiman'] }
    }, helpers);

    expect(state.impulseActions).toHaveLength(1);
    expect(state.impulseActions[0].type).toBe('move');
  });

  it('merges into existing stack at destination', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Pre-place ottoman units at Edirne
    state.spaces['Edirne'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2 }
    }, helpers);

    const dstStack = state.spaces['Edirne'].units.find(u => u.owner === 'ottoman');
    expect(dstStack.regulars).toBe(3); // 1 existing + 2 moved
  });

  it('removes empty source stack', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Set up a space with exactly 1 regular, no leaders, no naval
    state.spaces['Edirne'].units = [{
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];

    moveFormation(state, 'ottoman', {
      from: 'Edirne', to: 'Istanbul',
      units: { regulars: 1 }
    }, helpers);

    const ottomanInEdirne = state.spaces['Edirne'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(ottomanInEdirne).toBeUndefined();
  });
});

describe('validateRaiseRegular', () => {
  it('accepts raising in home space with CP', () => {
    const state = cpState();
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects non-home space', () => {
    const state = cpState();
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Paris' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('home space');
  });

  it('rejects when CP insufficient', () => {
    const state = cpState(1); // raise_regular costs 2
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
  });

  it('rejects space with unrest', () => {
    const state = cpState();
    state.spaces['Istanbul'].unrest = true;
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('unrest');
  });
});

describe('raiseRegular', () => {
  it('adds 1 regular to space', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const before = state.spaces['Istanbul'].units[0].regulars;
    raiseRegular(state, 'ottoman', { space: 'Istanbul' }, helpers);
    expect(state.spaces['Istanbul'].units[0].regulars).toBe(before + 1);
  });
});

describe('validateBuyMercenary', () => {
  it('accepts buying in home space', () => {
    const state = cpState();
    const r = validateBuyMercenary(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(true);
  });

  it('rejects for ottoman (cannot buy mercs)', () => {
    const state = cpState();
    const r = validateBuyMercenary(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
  });
});

describe('buyMercenary', () => {
  it('adds 1 mercenary to space', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const stack = state.spaces['Vienna'].units.find(u => u.owner === 'hapsburg');
    const before = stack.mercenaries;
    buyMercenary(state, 'hapsburg', { space: 'Vienna' }, helpers);
    expect(stack.mercenaries).toBe(before + 1);
  });
});

describe('validateRaiseCavalry', () => {
  it('accepts for ottoman', () => {
    const state = cpState();
    const r = validateRaiseCavalry(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects for non-ottoman', () => {
    const state = cpState();
    const r = validateRaiseCavalry(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
  });
});

describe('validateBuildSquadron', () => {
  it('accepts for port home space', () => {
    const state = cpState();
    // Istanbul is a port
    const r = validateBuildSquadron(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects for non-port space', () => {
    const state = cpState();
    // Vienna is not a port
    const r = validateBuildSquadron(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('port');
  });
});

describe('validateBuildCorsair', () => {
  it('accepts for ottoman port', () => {
    const state = cpState();
    state.piracyEnabled = true;
    const r = validateBuildCorsair(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(true);
  });

  it('rejects for non-ottoman', () => {
    const state = cpState();
    state.piracyEnabled = true;
    const r = validateBuildCorsair(state, 'hapsburg', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
  });

  it('rejects when piracy is not enabled', () => {
    const state = cpState();
    state.piracyEnabled = false;
    const r = validateBuildCorsair(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Barbary Pirates');
  });

  it('accepts in Ottoman-controlled Algiers when piracy enabled', () => {
    const state = cpState();
    state.piracyEnabled = true;
    state.spaces.Algiers.controller = 'ottoman';
    state.spaces.Algiers.units = [];

    const r = validateBuildCorsair(state, 'ottoman', { space: 'Algiers' });
    expect(r.valid).toBe(true);
  });

  it('accepts in Ottoman-controlled pirate haven port when piracy enabled', () => {
    const state = cpState();
    state.piracyEnabled = true;
    state.spaces.Tripoli.controller = 'ottoman';
    state.spaces.Tripoli.pirateHaven = true;
    state.spaces.Tripoli.units = [];

    const r = validateBuildCorsair(state, 'ottoman', { space: 'Tripoli' });
    expect(r.valid).toBe(true);
  });
});

describe('validateControlUnfortified', () => {
  it('rejects fortified space', () => {
    const state = cpState();
    // Besançon is a fortress — place ottoman units to bypass other checks
    state.spaces['Besançon'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Besançon' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('fortified');
  });

  it('rejects if already controlled', () => {
    const state = cpState();
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Nicopolis' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Already controlled');
  });

  it('accepts controlling occupied unfortified space with LOC', () => {
    const state = cpState();
    state.spaces['Nicopolis'].controller = 'france';
    // Place ottoman units so power occupies the space
    state.spaces['Nicopolis'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Nicopolis' });
    expect(r.valid).toBe(true);
  });

  it('rejects when no line of communication', () => {
    const state = cpState();
    state.spaces['Nicopolis'].controller = 'france';
    state.spaces['Istanbul'].controller = 'hapsburg';
    state.spaces['Scutari'].controller = 'hapsburg';
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Nicopolis' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('line of communication');
  });

  it('accepts adjacent control when friendly land adjacent and no enemy adjacent', () => {
    const state = cpState();
    state.spaces['Sofia'].controller = 'france';
    state.spaces['Sofia'].units = [];
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Sofia' });
    expect(r.valid).toBe(true);
  });

  it('rejects adjacent control when enemy land is adjacent', () => {
    const state = cpState();
    state.spaces['Sofia'].controller = 'france';
    state.spaces['Sofia'].units = [];
    state.spaces['Edirne'].units = [{
      owner: 'france', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];
    state.spaces['Nezh'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Sofia' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('enemy land units adjacent');
  });

  it('does not allow adjacency through pass-only links', () => {
    const state = cpState();
    state.spaces['Larissa'].controller = 'france';
    state.spaces['Larissa'].units = [];
    state.spaces['Larissa'].units = state.spaces['Larissa'].units
      .filter(u => u.owner !== 'ottoman');
    state.spaces['Salonika'].units = state.spaces['Salonika'].units
      .filter(u => u.owner !== 'ottoman');
    state.spaces['Lepanto'].units = (state.spaces['Lepanto'].units || [])
      .filter(u => u.owner !== 'ottoman');
    state.spaces['Athens'].units = state.spaces['Athens'].units
      .filter(u => u.owner !== 'ottoman');
    state.spaces['Durazzo'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateControlUnfortified(state, 'ottoman', { space: 'Larissa' });
    expect(r.valid).toBe(false);
  });

  it('rejects control if non-allied land units are in target space', () => {
    const state = cpState();
    state.spaces['Nicopolis'].controller = 'france';
    state.spaces['Nicopolis'].units.push({
      owner: 'france', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Nicopolis' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('non-allied land units');
  });

  it('allows unrest removal without LOC when occupying unrest space', () => {
    const state = cpState();
    // Use Dijon (non-key, non-fortress French space)
    state.spaces['Dijon'].unrest = true;
    state.spaces['Dijon'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    state.spaces['Istanbul'].controller = 'hapsburg';
    state.spaces['Scutari'].controller = 'hapsburg';

    const r = validateControlUnfortified(state, 'ottoman', { space: 'Dijon' });
    expect(r.valid).toBe(true);
  });

  it('allows Protestant special unrest removal before Schmalkaldic League', () => {
    const state = cpState();
    state.spaces['Wittenberg'].unrest = true;
    state.spaces['Wittenberg'].units = state.spaces['Wittenberg'].units
      .filter(u => u.owner !== 'protestant');
    for (const sp of Object.values(state.spaces)) {
      sp.units = (sp.units || []).filter(u => u.owner !== 'protestant');
    }

    const r = validateControlUnfortified(state, 'protestant', { space: 'Wittenberg' });
    expect(r.valid).toBe(true);
  });

  it('rejects Protestant special unrest removal after Schmalkaldic League', () => {
    const state = cpState();
    state.schmalkaldicLeagueFormed = true;
    state.spaces['Wittenberg'].unrest = true;
    for (const sp of Object.values(state.spaces)) {
      sp.units = (sp.units || []).filter(u => u.owner !== 'protestant');
    }

    const r = validateControlUnfortified(state, 'protestant', { space: 'Wittenberg' });
    expect(r.valid).toBe(false);
  });

  it('rejects friendly-controlled target space', () => {
    const state = cpState();
    state.alliances.push({ a: 'ottoman', b: 'france' });
    state.spaces['Sofia'].controller = 'france';
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Sofia' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('friendly-controlled');
  });
});

describe('controlUnfortified', () => {
  it('changes controller', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.spaces['Edirne'].controller = 'france';
    controlUnfortified(state, 'ottoman', { space: 'Edirne' }, helpers);
    expect(state.spaces['Edirne'].controller).toBe('ottoman');
  });

  it('removes unrest without changing controller', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.spaces['Paris'].controller = 'france';
    state.spaces['Paris'].unrest = true;

    controlUnfortified(state, 'ottoman', { space: 'Paris' }, helpers);
    expect(state.spaces['Paris'].unrest).toBe(false);
    expect(state.spaces['Paris'].controller).toBe('france');
  });
});

// ── Edge Case Tests ──────────────────────────────────────────────

describe('validateMoveFormation — pass movement', () => {
  it('calculates higher cost for pass movement', () => {
    const state = cpState(10);
    // Augsburg-Innsbruck is a pass connection
    // Place hapsburg units in Augsburg
    state.spaces['Augsburg'].units.push({
      owner: 'hapsburg', regulars: 2, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateMoveFormation(state, 'hapsburg', {
      from: 'Augsburg', to: 'Innsbruck', units: { regulars: 2 }
    });
    expect(r.valid).toBe(true);
    // Pass costs 2 CP instead of 1
    expect(r.cost).toBe(2);
  });

  it('rejects pass movement when CP insufficient for pass cost', () => {
    const state = cpState(1); // Have 1 CP, pass needs 2
    state.spaces['Augsburg'].units.push({
      owner: 'hapsburg', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });

    const r = validateMoveFormation(state, 'hapsburg', {
      from: 'Augsburg', to: 'Innsbruck', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });
});

describe('moveFormation — leader movement', () => {
  it('moves leader with formation', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();

    // Ensure leader is present (leaders array may be shared from scenario data)
    const srcStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    if (!srcStack.leaders.includes('ibrahim')) {
      srcStack.leaders.push('ibrahim');
    }

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 2, leaders: ['ibrahim'] }
    }, helpers);

    // Ibrahim should be at destination
    const dstStack = state.spaces['Edirne'].units.find(u => u.owner === 'ottoman');
    expect(dstStack.leaders).toContain('ibrahim');

    // Ibrahim should not be at source
    const srcAfter = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    expect(srcAfter.leaders).not.toContain('ibrahim');
  });

  it('moves cavalry with formation', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();

    const srcStack = state.spaces['Istanbul'].units.find(u => u.owner === 'ottoman');
    // Ensure cavalry exists
    if (srcStack.cavalry < 1) srcStack.cavalry = 1;
    const initialCav = srcStack.cavalry;

    moveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { cavalry: 1, leaders: ['suleiman'] }
    }, helpers);

    const dstStack = state.spaces['Edirne'].units.find(u => u.owner === 'ottoman');
    expect(dstStack.cavalry).toBeGreaterThanOrEqual(1);
    expect(srcStack.cavalry).toBe(initialCav - 1);
  });
});

describe('validateMoveFormation — blocked movement', () => {
  it('rejects moving through unrelated enemy fortified space', () => {
    const state = cpState(10);
    // Try to move to a non-adjacent space (should fail adjacency check)
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Vienna', units: { regulars: 1 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not adjacent');
  });

  it('rejects move when not enough mercenaries', () => {
    const state = cpState(10);
    // Istanbul starts with no mercenaries for ottoman
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { mercenaries: 5 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Not enough mercenaries');
  });

  it('rejects move when not enough cavalry', () => {
    const state = cpState(10);
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { cavalry: 99 }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Not enough cavalry');
  });

  it('rejects move when leader not in source', () => {
    const state = cpState(10);
    const r = validateMoveFormation(state, 'ottoman', {
      from: 'Istanbul', to: 'Edirne',
      units: { regulars: 1, leaders: ['nonexistent_leader'] }
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Leader');
  });
});

describe('validateRaiseRegular — edge cases', () => {
  it('rejects raising regular in enemy-occupied home space', () => {
    const state = cpState(10);
    // Place enemy units in Istanbul
    state.spaces['Istanbul'].units.push({
      owner: 'hapsburg', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('enemy-occupied');
  });

  it('rejects raising regular in non-controlled home space', () => {
    const state = cpState(10);
    state.spaces['Istanbul'].controller = 'hapsburg';
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('control');
  });

  it('rejects raising regular with insufficient CP', () => {
    const state = cpState(1); // raise_regular costs 2 CP
    const r = validateRaiseRegular(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });
});

describe('validateBuyMercenary — edge cases', () => {
  it('validates correct CP cost for hapsburg mercenary', () => {
    const state = cpState(10);
    const r = validateBuyMercenary(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(true);
  });

  it('rejects buying mercenary in space with unrest', () => {
    const state = cpState(10);
    state.spaces['Vienna'].unrest = true;
    const r = validateBuyMercenary(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('unrest');
  });

  it('rejects buying mercenary in non-controlled space', () => {
    const state = cpState(10);
    state.spaces['Vienna'].controller = 'ottoman';
    const r = validateBuyMercenary(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('control');
  });
});

describe('validateBuildSquadron — edge cases', () => {
  it('rejects building squadron in non-home port', () => {
    const state = cpState(10);
    // Marseille is a French port, not hapsburg home
    const r = validateBuildSquadron(state, 'hapsburg', { space: 'Marseille' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('home space');
  });

  it('rejects building squadron with insufficient CP', () => {
    const state = cpState(1); // build_squadron costs 2 CP
    const r = validateBuildSquadron(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });

  it('rejects building squadron for protestant (cannot build)', () => {
    const state = cpState(10);
    const r = validateBuildSquadron(state, 'protestant', { space: 'Wittenberg' });
    expect(r.valid).toBe(false);
  });
});

describe('validateControlUnfortified — additional edge cases', () => {
  it('rejects controlling a key space as fortified', () => {
    const state = cpState();
    // Paris is a key space — therefore fortified
    state.spaces['Paris'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Paris' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('fortified');
  });

  it('accepts controlling when power has units in space and LOC', () => {
    const state = cpState();
    state.spaces['Nicopolis'].controller = 'hapsburg';
    state.spaces['Nicopolis'].units = [];
    state.spaces['Nicopolis'].units.push({
      owner: 'ottoman', regulars: 1, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    });
    const r = validateControlUnfortified(state, 'ottoman', { space: 'Nicopolis' });
    expect(r.valid).toBe(true);
  });
});

describe('validateRaiseCavalry — edge cases', () => {
  it('rejects cavalry for hapsburg', () => {
    const state = cpState(10);
    const r = validateRaiseCavalry(state, 'hapsburg', { space: 'Vienna' });
    expect(r.valid).toBe(false);
  });

  it('rejects cavalry for england', () => {
    const state = cpState(10);
    const r = validateRaiseCavalry(state, 'england', { space: 'London' });
    expect(r.valid).toBe(false);
  });

  it('rejects cavalry for france', () => {
    const state = cpState(10);
    const r = validateRaiseCavalry(state, 'france', { space: 'Paris' });
    expect(r.valid).toBe(false);
  });

  it('rejects cavalry for papacy', () => {
    const state = cpState(10);
    const r = validateRaiseCavalry(state, 'papacy', { space: 'Rome' });
    expect(r.valid).toBe(false);
  });

  it('rejects cavalry for protestant', () => {
    const state = cpState(10);
    const r = validateRaiseCavalry(state, 'protestant', { space: 'Wittenberg' });
    expect(r.valid).toBe(false);
  });

  it('rejects ottoman cavalry in non-home space', () => {
    const state = cpState(10);
    const r = validateRaiseCavalry(state, 'ottoman', { space: 'Paris' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('home space');
  });

  it('rejects ottoman cavalry with insufficient CP', () => {
    const state = cpState(0);
    const r = validateRaiseCavalry(state, 'ottoman', { space: 'Istanbul' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });
});

describe('controlUnfortified — execution edge cases', () => {
  it('records impulse action on control', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.spaces['Edirne'].controller = 'france';
    controlUnfortified(state, 'ottoman', { space: 'Edirne' }, helpers);
    expect(state.impulseActions).toHaveLength(1);
    expect(state.impulseActions[0].type).toBe('control_unfortified');
  });

  it('deducts CP on control', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    const before = state.cpRemaining;
    state.spaces['Edirne'].controller = 'france';
    controlUnfortified(state, 'ottoman', { space: 'Edirne' }, helpers);
    expect(state.cpRemaining).toBeLessThan(before);
  });

  it('logs control event with removedUnrest flag', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    state.spaces['Paris'].controller = 'france';
    state.spaces['Paris'].unrest = true;
    controlUnfortified(state, 'ottoman', { space: 'Paris' }, helpers);
    const logEntry = state.eventLog.find(
      e => e.type === 'control_unfortified' && e.data.removedUnrest === true
    );
    expect(logEntry).toBeDefined();
  });
});
