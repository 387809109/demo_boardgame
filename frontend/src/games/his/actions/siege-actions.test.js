/**
 * Here I Stand — siege-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  establishSiege, validateAssault, executeAssault,
  checkSiegeBreak, checkRelief, hasLineOfCommunication
} from './siege-actions.js';
import { startCpSpending } from './cp-manager.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function makeStack(power, regs = 3, mercs = 0, cav = 0, leaders = []) {
  return {
    owner: power, regulars: regs, mercenaries: mercs,
    cavalry: cav, squadrons: 0, corsairs: 0, leaders
  };
}

function cpState(cp = 10) {
  const state = createTestState();
  startCpSpending(state, 99, cp);
  return state;
}

function findFortress(state, controller) {
  return Object.entries(state.spaces).find(
    ([, sp]) => sp.isFortress && sp.controller === controller
  );
}

/**
 * Set up Belgrade as a fortress besieged by Ottoman.
 * Ottoman has LOC via Nicopolis (Ottoman) → Scutari (Ottoman fortress).
 */
function setupOttomanSiege(cp = 10) {
  const state = cpState(cp);
  const belgrade = state.spaces['Belgrade'];
  belgrade.controller = 'hapsburg';
  belgrade.isFortress = true;
  belgrade.besieged = true;
  belgrade.besiegedBy = 'ottoman';
  belgrade.siegeEstablishedImpulse = -1;
  belgrade.units.push(makeStack('ottoman', 5));
  return state;
}

describe('establishSiege', () => {
  it('marks space as besieged', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      establishSiege(state, fort[0], 'ottoman', helpers);
      expect(state.spaces[fort[0]].besieged).toBe(true);
      expect(state.spaces[fort[0]].besiegedBy).toBe('ottoman');
    }
  });

  it('records siege impulse', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.turnNumber = 42;
      establishSiege(state, fort[0], 'ottoman', helpers);
      expect(state.spaces[fort[0]].siegeEstablishedImpulse).toBe(42);
    }
  });
});

describe('validateAssault', () => {
  it('rejects when space not besieged', () => {
    const state = cpState();
    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not under siege');
  });

  it('rejects when not the besieger', () => {
    const state = setupOttomanSiege();
    state.spaces['Belgrade'].besiegedBy = 'france';
    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not the besieger');
  });

  it('rejects same impulse as establishment', () => {
    const state = setupOttomanSiege();
    state.spaces['Belgrade'].siegeEstablishedImpulse = state.turnNumber;
    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('same impulse');
  });

  it('rejects same card impulse even when turnNumber has advanced', () => {
    const state = setupOttomanSiege();
    state.activeCardNumber = 99;
    state.turn = 1;
    state.turnNumber += 3; // simulate later actions in same impulse
    state.spaces['Belgrade'].siegeEstablishedImpulse = state.turnNumber - 2;
    state.spaces['Belgrade'].siegeEstablishedTurn = 1;
    state.spaces['Belgrade'].siegeEstablishedCardNumber = 99;
    state.spaces['Belgrade'].siegeEstablishedBy = 'ottoman';

    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('same impulse');
  });

  it('rejects insufficient CP', () => {
    const state = setupOttomanSiege(0);
    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });

  it('rejects without line of communication', () => {
    const state = setupOttomanSiege();
    // Cut LOC by making all Ottoman spaces non-Ottoman
    state.spaces['Nicopolis'].controller = 'hapsburg';
    state.spaces['Nezh'].controller = 'hapsburg';
    state.spaces['Szegedin'].controller = 'hapsburg';
    state.spaces['Scutari'].controller = 'hapsburg';

    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('line of communication');
  });

  it('accepts valid assault with LOC', () => {
    const state = setupOttomanSiege();
    const r = validateAssault(state, 'ottoman', { space: 'Belgrade' });
    expect(r.valid).toBe(true);
  });
});

describe('executeAssault', () => {
  it('returns assault result with dice', () => {
    const state = setupOttomanSiege();
    const helpers = createMockHelpers();

    const result = executeAssault(state, 'ottoman',
      { space: 'Belgrade' }, helpers);
    expect(result).toHaveProperty('attackerDice');
    expect(result).toHaveProperty('defenderDice');
    expect(result).toHaveProperty('success');
  });

  it('deducts CP', () => {
    const state = setupOttomanSiege(10);
    const helpers = createMockHelpers();

    executeAssault(state, 'ottoman', { space: 'Belgrade' }, helpers);
    expect(state.cpRemaining).toBeLessThan(10);
  });

  it('successful assault changes controller', () => {
    let success = false;
    for (let i = 0; i < 50 && !success; i++) {
      const s = setupOttomanSiege();
      const h = createMockHelpers();
      // No defenders, lots of attackers — high success chance
      s.spaces['Belgrade'].units = [makeStack('ottoman', 8)];
      s.spaces['Belgrade'].controller = 'hapsburg';

      const r = executeAssault(s, 'ottoman', { space: 'Belgrade' }, h);
      if (r.success) {
        expect(s.spaces['Belgrade'].controller).toBe('ottoman');
        expect(s.spaces['Belgrade'].besieged).toBe(false);
        success = true;
      }
    }
    expect(success).toBe(true);
  });

  it('uses half dice when defenders present', () => {
    const state = setupOttomanSiege();
    const helpers = createMockHelpers();
    state.spaces['Belgrade'].units = [
      makeStack('ottoman', 6),
      makeStack('hapsburg', 2)
    ];

    const result = executeAssault(state, 'ottoman',
      { space: 'Belgrade' }, helpers);
    // 6 regulars / 2 = 3 dice (rounded up)
    expect(result.attackerDice).toBe(3);
  });
});

describe('hasLineOfCommunication', () => {
  it('returns true when path to friendly fortress exists', () => {
    const state = cpState();
    // Ottoman at Nicopolis, Scutari is Ottoman fortress
    expect(hasLineOfCommunication(state, 'Nicopolis', 'ottoman')).toBe(true);
  });

  it('returns false when no path to friendly fortress', () => {
    const state = cpState();
    // Give Ottoman a random isolated space with no fortress nearby
    state.spaces['Paris'].controller = 'ottoman';
    // Paris neighbors are all France-controlled
    expect(hasLineOfCommunication(state, 'Paris', 'ottoman')).toBe(false);
  });

  it('returns true when space itself is a friendly fortress', () => {
    const state = cpState();
    // Scutari is Ottoman fortress
    expect(hasLineOfCommunication(state, 'Scutari', 'ottoman')).toBe(true);
  });

  it('returns true via capital even if not fortress', () => {
    const state = cpState();
    // Istanbul is Ottoman capital
    expect(hasLineOfCommunication(state, 'Istanbul', 'ottoman')).toBe(true);
  });
});

describe('checkSiegeBreak', () => {
  it('breaks siege when besieger has fewer units', () => {
    const state = setupOttomanSiege();
    const helpers = createMockHelpers();
    state.spaces['Belgrade'].units = [
      makeStack('ottoman', 1),
      makeStack('hapsburg', 3)
    ];

    const broken = checkSiegeBreak(state, 'Belgrade', helpers);
    expect(broken).toBe(true);
    expect(state.spaces['Belgrade'].besieged).toBe(false);
  });

  it('does not break siege when besieger has more units', () => {
    const state = setupOttomanSiege();
    const helpers = createMockHelpers();
    state.spaces['Belgrade'].units = [
      makeStack('ottoman', 5),
      makeStack('hapsburg', 2)
    ];

    const broken = checkSiegeBreak(state, 'Belgrade', helpers);
    expect(broken).toBe(false);
    expect(state.spaces['Belgrade'].besieged).toBe(true);
  });
});

describe('checkRelief', () => {
  it('returns shouldBattle for besieged space', () => {
    const state = setupOttomanSiege();
    const result = checkRelief(state, 'Belgrade');
    expect(result.shouldBattle).toBe(true);
    expect(result.besiegingPower).toBe('ottoman');
  });

  it('returns false for non-besieged space', () => {
    const state = cpState();
    const result = checkRelief(state, 'Paris');
    expect(result.shouldBattle).toBe(false);
  });
});
