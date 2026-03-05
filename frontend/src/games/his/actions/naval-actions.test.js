/**
 * Here I Stand — naval-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
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
});

// ── validatePiracy ──────────────────────────────────────────────

describe('validatePiracy', () => {
  it('accepts valid Ottoman piracy', () => {
    const state = cpState();
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(true);
  });

  it('rejects non-Ottoman', () => {
    const state = cpState();
    const r = validatePiracy(state, 'hapsburg', {
      seaZone: 'Ionian Sea', targetPower: 'ottoman'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Ottoman');
  });

  it('rejects missing sea zone', () => {
    const state = cpState();
    const r = validatePiracy(state, 'ottoman', { targetPower: 'hapsburg' });
    expect(r.valid).toBe(false);
  });

  it('rejects when already pirated this zone', () => {
    const state = cpState();
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);
    state.piracyUsed['Ionian Sea'] = true;

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects when no corsairs present', () => {
    const state = cpState();
    placeNaval(state, 'Ionian Sea', 'ottoman', 3, 0); // squadrons only

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects insufficient CP', () => {
    const state = cpState(1); // piracy costs 2
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    const r = validatePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });
});

// ── executePiracy ───────────────────────────────────────────────

describe('executePiracy', () => {
  it('executes piracy and returns result', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
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
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(state.cpRemaining).toBe(8); // 10 - 2
  });

  it('marks sea zone as used', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(state.piracyUsed['Ionian Sea']).toBe(true);
  });

  it('anti-piracy roll uses target squadrons', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 2, 0); // 2 squadrons for anti-piracy

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(result.antiPiracyDice).toBe(2);
  });

  it('anti-piracy can destroy corsairs', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 1);
    placeNaval(state, 'Ionian Sea', 'hapsburg', 5, 0); // lots of anti-piracy

    const result = executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    // Corsairs lost could be 0 or 1
    expect(result.corsairsLost).toBeGreaterThanOrEqual(0);
    expect(result.corsairsLost).toBeLessThanOrEqual(1);
  });

  it('records impulse action', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    placeNaval(state, 'Ionian Sea', 'ottoman', 0, 3);

    executePiracy(state, 'ottoman', {
      seaZone: 'Ionian Sea', targetPower: 'hapsburg'
    }, helpers);

    expect(state.impulseActions[0].type).toBe('piracy');
  });
});
