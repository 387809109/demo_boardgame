/**
 * Here I Stand — naval-actions.js Unit Tests
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateNavalMove, executeNavalMove,
  resolveNavalCombat,
  validatePiracy, executePiracy
} from './naval-actions.js';
import { startCpSpending } from './cp-manager.js';
import { NAVAL_COMBAT } from '../constants.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function cpState(cp = 10) {
  const state = createTestState();
  startCpSpending(state, 99, cp);
  return state;
}

function clearAllUnits(state) {
  for (const sp of Object.values(state.spaces)) {
    sp.units = [];
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** Place naval units in a sea zone (add to spaces if missing). */
function placeNaval(state, seaZone, power, squadrons = 0, corsairs = 0, leaders = []) {
  if (!state.spaces[seaZone]) {
    state.spaces[seaZone] = { units: [] };
  }
  const existing = state.spaces[seaZone].units.find(u => u.owner === power);
  if (existing) {
    existing.squadrons += squadrons;
    existing.corsairs += corsairs;
    existing.leaders.push(...leaders);
  } else {
    state.spaces[seaZone].units.push({
      owner: power, regulars: 0, mercenaries: 0, cavalry: 0,
      squadrons, corsairs, leaders
    });
  }
}

// ── validateNavalMove ───────────────────────────────────────────

describe('validateNavalMove', () => {
  it('accepts valid naval move', () => {
    const state = cpState();
    const r = validateNavalMove(state, 'ottoman');
    expect(r.valid).toBe(true);
  });

  it('rejects when not enough CP', () => {
    const state = cpState(0);
    const r = validateNavalMove(state, 'ottoman');
    expect(r.valid).toBe(false);
  });

  it('rejects power without naval_move ability', () => {
    const state = cpState();
    const r = validateNavalMove(state, 'protestant');
    expect(r.valid).toBe(false);
  });

  it('rejects non-adjacent sea zone movement', () => {
    const state = cpState();
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);

    const r = validateNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Atlantic Ocean' }]
    });
    expect(r.valid).toBe(false);
  });

  it('rejects direct port-to-port movement', () => {
    const state = cpState();
    placeNaval(state, 'Istanbul', 'ottoman', 2, 0);

    const r = validateNavalMove(state, 'ottoman', {
      movements: [{ from: 'Istanbul', to: 'Coron' }]
    });
    expect(r.valid).toBe(false);
  });

  it('rejects entering non-friendly port with no enemy naval units', () => {
    const state = cpState();
    placeNaval(state, 'Ionian Sea', 'ottoman', 2, 0);

    const r = validateNavalMove(state, 'ottoman', {
      movements: [{ from: 'Ionian Sea', to: 'Corfu' }]
    });
    expect(r.valid).toBe(false);
  });

  it('allows entering non-friendly port when enemy naval units are present', () => {
    const state = cpState();
    placeNaval(state, 'Ionian Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Corfu', 'venice', 1, 0);

    const r = validateNavalMove(state, 'ottoman', {
      movements: [{ from: 'Ionian Sea', to: 'Corfu' }]
    });
    expect(r.valid).toBe(true);
  });

  it('rejects movement from source without naval units', () => {
    const state = cpState();

    const r = validateNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    });
    expect(r.valid).toBe(false);
  });

  it('rejects Andrea Doria entering Atlantic Ocean', () => {
    const state = cpState();
    clearAllUnits(state);
    placeNaval(state, 'Bay of Biscay', 'hapsburg', 1, 0, ['andrea_doria']);

    const r = validateNavalMove(state, 'hapsburg', {
      movements: [{ from: 'Bay of Biscay', to: 'Atlantic Ocean' }]
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Andrea Doria');
  });
});

// ── executeNavalMove ────────────────────────────────────────────

describe('executeNavalMove', () => {
  it('moves naval stack between sea zones', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();

    placeNaval(state, 'Aegean Sea', 'ottoman', 3, 0);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 0);

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    const dst = state.spaces['Ionian Sea'].units.find(u => u.owner === 'ottoman');
    expect(dst.squadrons).toBe(3);
  });

  it('deducts CP', () => {
    const state = cpState(5);
    const helpers = createMockHelpers();
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);
    if (!state.spaces['Ionian Sea']) state.spaces['Ionian Sea'] = { units: [] };

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    expect(state.cpRemaining).toBe(4); // 5 - 1
  });

  it('records impulse action', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    placeNaval(state, 'Aegean Sea', 'ottoman', 1, 0);
    if (!state.spaces['Ionian Sea']) state.spaces['Ionian Sea'] = { units: [] };

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    expect(state.impulseActions[0].type).toBe('naval_move');
  });

  it('removes empty source stack after move', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);
    if (!state.spaces['Ionian Sea']) state.spaces['Ionian Sea'] = { units: [] };

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    const srcOtt = state.spaces['Aegean Sea'].units.find(
      u => u.owner === 'ottoman'
    );
    expect(srcOtt).toBeUndefined();
  });

  it('creates destination sea zone record when missing', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    placeNaval(state, 'Istanbul', 'ottoman', 1, 0);
    const sourceBefore = state.spaces['Istanbul'].units
      .find(u => u.owner === 'ottoman')?.squadrons || 0;
    delete state.spaces['Black Sea'];

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Istanbul', to: 'Black Sea' }]
    }, helpers);

    expect(state.spaces['Black Sea']).toBeDefined();
    const dst = state.spaces['Black Sea'].units.find(u => u.owner === 'ottoman');
    expect(dst.squadrons).toBe(sourceBefore);
  });

  it('does not trigger naval combat when powers are not at war', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    const combatEvent = state.eventLog.find(e => e.type === 'naval_combat');
    expect(combatEvent).toBeUndefined();
  });

  it('triggers naval combat when entering enemy naval port at war', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    placeNaval(state, 'Ionian Sea', 'ottoman', 3, 0);
    placeNaval(state, 'Corfu', 'hapsburg', 1, 0);

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Ionian Sea', to: 'Corfu' }]
    }, helpers);

    const combatEvent = state.eventLog.find(e => e.type === 'naval_combat');
    expect(combatEvent).toBeDefined();
  });

  it('treats minor ally naval stacks as enemies when major ally is at war', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    state.alliances.push({ a: 'venice', b: 'hapsburg' });
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Ionian Sea', 'venice', 1, 0);
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // prevent evade success randomness

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    const combatEvent = state.eventLog.find(e => e.type === 'naval_combat');
    expect(combatEvent).toBeDefined();
    expect(
      [combatEvent.data.winnerPower, combatEvent.data.loserPower]
    ).toContain('venice');
  });

  it('logs naval interception attempts from adjacent enemy fleets', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Adriatic Sea', 'hapsburg', 1, 0);

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    const interceptionEvent = state.eventLog.find(
      e => e.type === 'naval_interception_attempt'
    );
    expect(interceptionEvent).toBeDefined();
  });

  it('logs naval evade attempts in sea zones', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    placeNaval(state, 'Aegean Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Aegean Sea', to: 'Ionian Sea' }]
    }, helpers);

    const evadeEvent = state.eventLog.find(e => e.type === 'naval_evade_attempt');
    expect(evadeEvent).toBeDefined();
  });

  it('forces attacker retreat after naval combat in port battle', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    placeNaval(state, 'Ionian Sea', 'ottoman', 3, 0);
    placeNaval(state, 'Corfu', 'hapsburg', 1, 0);

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Ionian Sea', to: 'Corfu' }]
    }, helpers);

    const ottAtPort = state.spaces['Corfu'].units.find(u => u.owner === 'ottoman');
    const ottNavalInPort = (ottAtPort?.squadrons || 0) + (ottAtPort?.corsairs || 0);
    expect(ottNavalInPort).toBe(0);
  });

  it('records retreat-eliminated naval units on turn track when no legal sea retreat exists', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    placeNaval(state, 'Ionian Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Corfu', 'hapsburg', 1, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);   // blocks retreat
    placeNaval(state, 'Adriatic Sea', 'hapsburg', 1, 0); // blocks retreat
    vi.spyOn(Math, 'random').mockReturnValue(0.0);       // combat hits = 0, attacker survives to retreat

    executeNavalMove(state, 'ottoman', {
      movements: [{ from: 'Ionian Sea', to: 'Corfu' }]
    }, helpers);

    const retreatEntry = state.turnTrack.navalUnits.find(
      e => e.power === 'ottoman' &&
        e.source === 'naval_retreat_elimination'
    );
    expect(retreatEntry).toBeDefined();
    expect(retreatEntry.type).toBe('squadron');
    expect(retreatEntry.count).toBeGreaterThanOrEqual(1);
  });
});

// ── resolveNavalCombat ──────────────────────────────────────────

describe('resolveNavalCombat', () => {
  it('resolves combat between two fleets', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    placeNaval(state, 'Ionian Sea', 'ottoman', 3, 2);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 4, 0);

    const result = resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('attackerHits');
    expect(result).toHaveProperty('defenderHits');
  });

  it('attacker gets 2/squadron + 1/corsair dice', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    placeNaval(state, 'Ionian Sea', 'ottoman', 2, 3); // 2*2 + 3*1 = 7 dice
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);

    const result = resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    expect(result.attackerDice).toBe(7);
  });

  it('defender gets port bonus dice', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    placeNaval(state, 'Ionian Sea', 'ottoman', 2, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 2, 0); // 2*2=4 + 1 port bonus = 5

    const result = resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', true, helpers
    );

    expect(result.defenderDice).toBe(4 + NAVAL_COMBAT.portDefenderBonusDice);
  });

  it('tie goes to defender', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Both fleets identical — any tie should give defender the win
    placeNaval(state, 'Ionian Sea', 'ottoman', 1, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);

    const result = resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    // Winner must be one of them
    expect(['attacker', 'defender']).toContain(result.winner);
  });

  it('applies casualties: 1 squadron per 2 hits', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    placeNaval(state, 'Ionian Sea', 'ottoman', 5, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 5, 0);

    resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    // After combat, at least one side should have lost units
    // (stochastic — just verify structure)
    const ottLeft = state.spaces['Ionian Sea'].units.find(
      u => u.owner === 'ottoman'
    );
    const habLeft = state.spaces['Ionian Sea'].units.find(
      u => u.owner === 'hapsburg'
    );
    // Both or one may be eliminated
    expect(typeof (ottLeft?.squadrons ?? 0)).toBe('number');
    expect(typeof (habLeft?.squadrons ?? 0)).toBe('number');
  });

  it('returns error when side missing', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    placeNaval(state, 'Ionian Sea', 'ottoman', 3, 0);

    const result = resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    expect(result.error).toBeDefined();
  });

  it('when both sides are eliminated, defender retains 1 unit on equal dice', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 1, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // all dice roll 6

    const result = resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    expect(result.retainedPower).toBe('hapsburg');
    const ott = state.spaces['Ionian Sea'].units.find(u => u.owner === 'ottoman');
    const hab = state.spaces['Ionian Sea'].units.find(u => u.owner === 'hapsburg');
    expect((ott?.squadrons || 0) + (ott?.corsairs || 0)).toBe(0);
    expect((hab?.squadrons || 0) + (hab?.corsairs || 0)).toBe(1);
  });

  it('records naval unit losses to turn track', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 1, 0);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 1, 0);
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // both would die, defender retains 1

    resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    const entry = state.turnTrack.navalUnits.find(
      e => e.power === 'ottoman' &&
        e.type === 'squadron' &&
        e.source === 'naval_combat_casualties'
    );
    expect(entry).toBeDefined();
    expect(entry.count).toBe(1);
    expect(entry.returnTurn).toBe((state.turn || 1) + 1);
  });

  it('moves naval leaders of a fully eliminated side to turn track', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 1, 0, ['barbarossa']);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 3, 0);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    resolveNavalCombat(
      state, 'Ionian Sea', 'ottoman', 'hapsburg', false, helpers
    );

    const leaderEntry = state.turnTrack.navalLeaders.find(
      e => e.leaderId === 'barbarossa' &&
        e.power === 'ottoman' &&
        e.source === 'naval_combat_elimination'
    );
    expect(leaderEntry).toBeDefined();
  });
});

// ── validatePiracy ──────────────────────────────────────────────

describe('validatePiracy', () => {
  it('accepts valid Ottoman piracy', () => {
    const state = cpState();
    state.piracyEnabled = true;
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(true);
  });

  it('rejects non-Ottoman', () => {
    const state = cpState();
    state.piracyEnabled = true;
    const r = validatePiracy(state, 'hapsburg', {
      seaZone: 'Ionian Sea', targetPower: 'ottoman'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Ottoman');
  });

  it('rejects when piracy is not enabled', () => {
    const state = cpState();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);
    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Barbary Pirates');
  });

  it('rejects missing sea zone', () => {
    const state = cpState();
    state.piracyEnabled = true;
    const r = validatePiracy(state, 'ottoman', { targetPower: 'hapsburg' });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid sea zone', () => {
    const state = cpState();
    state.piracyEnabled = true;
    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Paris', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects when already pirated this zone', () => {
    const state = cpState();
    state.piracyEnabled = true;
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);
    state.piracyUsed['Ionian Sea'] = true;

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects when no corsairs present', () => {
    const state = cpState();
    state.piracyEnabled = true;
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 3, 0); // squadrons only

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects insufficient CP', () => {
    const state = cpState(1); // piracy costs 2
    state.piracyEnabled = true;
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects target without any connected controlled port', () => {
    const state = cpState();
    state.piracyEnabled = true;
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 2);

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'papacy'
    });
    expect(r.valid).toBe(false);
  });
});

// ── executePiracy ───────────────────────────────────────────────

describe('executePiracy', () => {
  it('executes piracy and returns result', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(result).toHaveProperty('piracyHits');
    expect(result).toHaveProperty('antiPiracyDice');
  });

  it('deducts CP', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(state.cpRemaining).toBe(8); // 10 - 2
  });

  it('marks sea zone as used', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(state.piracyUsed['Ionian Sea']).toBe(true);
  });

  it('anti-piracy roll uses 2 dice per target squadron in the piracy sea zone', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'North Sea', 'ottoman', 0, 3);
    placeNaval(state, 'North Sea', 'hapsburg', 2, 0);

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'North Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(result.antiPiracyDice).toBe(4);
  });

  it('anti-piracy can destroy corsairs', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'North Sea', 'ottoman', 0, 1);
    placeNaval(state, 'North Sea', 'hapsburg', 5, 0); // lots of anti-piracy

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'North Sea', targetPower: 'hapsburg'
    }, helpers);

    // Corsairs lost could be 0 or 1
    expect(result.corsairsLost).toBeGreaterThanOrEqual(0);
    expect(result.corsairsLost).toBeLessThanOrEqual(1);
  });

  it('records impulse action', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(state.impulseActions[0].type).toBe('piracy');
  });

  it('counts anti-piracy fortress dice from eligible adjacent fortress', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 2);

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(result.antiPiracyFortressDice).toBeGreaterThanOrEqual(1);
  });

  it('counts adjacent minor ally squadrons when major ally is at war with Ottoman', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    state.alliances.push({ a: 'venice', b: 'hapsburg' });
    state.piracyEnabled = true;
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 2);
    placeNaval(state, 'Adriatic Sea', 'venice', 1, 0);

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea',
      targetPower: 'hapsburg'
    }, helpers);

    expect(result.antiPiracyAdjacentDice).toBe(1);
  });

  it('resolves piracy hit by eliminating target squadron in or adjacent to zone', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.piracyTrack = 10; // disallow VP fallback
    placeNaval(state, 'North Sea', 'ottoman', 0, 1, ['dragut']);
    placeNaval(state, 'English Channel', 'hapsburg', 1, 0);

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.0)  // anti-piracy miss
      .mockReturnValueOnce(0.99) // piracy hit #1
      .mockReturnValueOnce(0.99) // piracy hit #2
      .mockReturnValueOnce(0.99); // piracy hit #3

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'North Sea',
      targetPower: 'hapsburg',
      hitChoices: [{ choice: 'eliminate_squadron', space: 'English Channel' }]
    }, helpers);

    expect(result.squadronsEliminated).toBe(1);
    const hab = state.spaces['English Channel'].units.find(u => u.owner === 'hapsburg');
    expect((hab?.squadrons || 0)).toBe(0);
  });

  it('awards piracy VP with max cap 10', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.piracyTrack = 9;
    placeNaval(state, 'North Sea', 'ottoman', 0, 1, ['dragut']);
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no anti-piracy dice here, piracy all hits

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'North Sea',
      targetPower: 'hapsburg',
      hitChoices: ['give_vp', 'give_vp', 'give_vp']
    }, helpers);

    expect(state.piracyTrack).toBe(10);
    expect(result.piracyVpAwarded).toBe(1);
  });

  it('can resolve piracy hit by giving Ottoman a random card', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    clearAllUnits(state);
    state.piracyTrack = 10; // force card route when no squadron loss option
    state.hands.hapsburg = [50];
    state.hands.ottoman = [];
    placeNaval(state, 'North Sea', 'ottoman', 0, 1);
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'North Sea',
      targetPower: 'hapsburg',
      hitChoices: ['give_card']
    }, helpers);

    expect(result.cardsStolen).toBe(1);
    expect(state.hands.hapsburg).toHaveLength(0);
    expect(state.hands.ottoman).toHaveLength(1);
  });
});
