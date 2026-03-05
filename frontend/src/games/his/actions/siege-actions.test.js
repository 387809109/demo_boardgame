/**
 * Here I Stand — siege-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  establishSiege, validateAssault, executeAssault,
  checkSiegeBreak, checkRelief
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
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      const r = validateAssault(state, 'ottoman', { space: fort[0] });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('not under siege');
    }
  });

  it('rejects when not the besieger', () => {
    const state = cpState();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'france';
      const r = validateAssault(state, 'ottoman', { space: fort[0] });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('not the besieger');
    }
  });

  it('rejects same impulse as establishment', () => {
    const state = cpState();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].siegeEstablishedImpulse = state.turnNumber;
      state.spaces[fort[0]].units.push(makeStack('ottoman', 5));
      const r = validateAssault(state, 'ottoman', { space: fort[0] });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('same impulse');
    }
  });

  it('rejects insufficient CP', () => {
    const state = cpState(0);
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].siegeEstablishedImpulse = -1;
      state.spaces[fort[0]].units.push(makeStack('ottoman', 5));
      const r = validateAssault(state, 'ottoman', { space: fort[0] });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('CP');
    }
  });

  it('accepts valid assault', () => {
    const state = cpState();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].siegeEstablishedImpulse = -1;
      state.spaces[fort[0]].units.push(makeStack('ottoman', 5));
      const r = validateAssault(state, 'ottoman', { space: fort[0] });
      expect(r.valid).toBe(true);
    }
  });
});

describe('executeAssault', () => {
  it('returns assault result with dice', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].units.push(makeStack('ottoman', 6));

      const result = executeAssault(state, 'ottoman', { space: fort[0] }, helpers);
      expect(result).toHaveProperty('attackerDice');
      expect(result).toHaveProperty('defenderDice');
      expect(result).toHaveProperty('success');
    }
  });

  it('deducts CP', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].units.push(makeStack('ottoman', 6));

      executeAssault(state, 'ottoman', { space: fort[0] }, helpers);
      expect(state.cpRemaining).toBeLessThan(10);
    }
  });

  it('successful assault changes controller', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (!fort) return;

    // Run many times to find a success
    let success = false;
    for (let i = 0; i < 50 && !success; i++) {
      const s = cpState();
      const h = createMockHelpers();
      s.spaces[fort[0]].besieged = true;
      s.spaces[fort[0]].besiegedBy = 'ottoman';
      // No defenders, lots of attackers — high success chance
      s.spaces[fort[0]].units = [makeStack('ottoman', 8)];
      s.spaces[fort[0]].controller = 'hapsburg';

      const r = executeAssault(s, 'ottoman', { space: fort[0] }, h);
      if (r.success) {
        expect(s.spaces[fort[0]].controller).toBe('ottoman');
        expect(s.spaces[fort[0]].besieged).toBe(false);
        success = true;
      }
    }
    expect(success).toBe(true);
  });

  it('uses half dice when defenders present', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].units = [
        makeStack('ottoman', 6),
        makeStack('hapsburg', 2)
      ];

      const result = executeAssault(state, 'ottoman', { space: fort[0] }, helpers);
      // 6 regulars / 2 = 3 dice (rounded up)
      expect(result.attackerDice).toBe(3);
    }
  });
});

describe('checkSiegeBreak', () => {
  it('breaks siege when besieger has fewer units', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].units = [
        makeStack('ottoman', 1),
        makeStack('hapsburg', 3)
      ];

      const broken = checkSiegeBreak(state, fort[0], helpers);
      expect(broken).toBe(true);
      expect(state.spaces[fort[0]].besieged).toBe(false);
    }
  });

  it('does not break siege when besieger has more units', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';
      state.spaces[fort[0]].units = [
        makeStack('ottoman', 5),
        makeStack('hapsburg', 2)
      ];

      const broken = checkSiegeBreak(state, fort[0], helpers);
      expect(broken).toBe(false);
      expect(state.spaces[fort[0]].besieged).toBe(true);
    }
  });
});

describe('checkRelief', () => {
  it('returns shouldBattle for besieged space', () => {
    const state = cpState();
    const fort = findFortress(state, 'hapsburg');
    if (fort) {
      state.spaces[fort[0]].besieged = true;
      state.spaces[fort[0]].besiegedBy = 'ottoman';

      const result = checkRelief(state, fort[0]);
      expect(result.shouldBattle).toBe(true);
      expect(result.besiegingPower).toBe('ottoman');
    }
  });

  it('returns false for non-besieged space', () => {
    const state = cpState();
    const result = checkRelief(state, 'Paris');
    expect(result.shouldBattle).toBe(false);
  });
});
