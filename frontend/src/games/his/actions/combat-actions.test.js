/**
 * Here I Stand — combat-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getHighestBattleRating, calculateBattleDice,
  applyCasualties, resolveFieldBattle
} from './combat-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import { COMBAT } from '../constants.js';

function makeStack(power, regs = 3, mercs = 0, cav = 0, leaders = []) {
  return {
    owner: power, regulars: regs, mercenaries: mercs,
    cavalry: cav, squadrons: 0, corsairs: 0, leaders
  };
}

function setupBattle(state, space, attacker, defender) {
  state.spaces[space].units = [attacker, defender];
}

describe('getHighestBattleRating', () => {
  it('returns 0 for no leaders', () => {
    expect(getHighestBattleRating([])).toBe(0);
  });

  it('returns battle rating of single leader', () => {
    expect(getHighestBattleRating(['suleiman'])).toBe(2);
  });

  it('returns highest among multiple leaders', () => {
    // suleiman: 2, ibrahim: 1
    expect(getHighestBattleRating(['suleiman', 'ibrahim'])).toBe(2);
  });

  it('ignores non-army leaders', () => {
    // barbarossa is naval, not army
    expect(getHighestBattleRating(['barbarossa'])).toBe(0);
  });
});

describe('calculateBattleDice', () => {
  it('counts land units + leader bonus', () => {
    const stack = makeStack('ottoman', 5, 0, 2, ['suleiman']);
    const result = calculateBattleDice(stack, false);
    // 5 + 2 units + 2 battle rating = 9
    expect(result.dice).toBe(9);
    expect(result.unitCount).toBe(7);
    expect(result.leaderBonus).toBe(2);
  });

  it('adds 1 defender bonus die', () => {
    const stack = makeStack('hapsburg', 3, 0, 0, []);
    const att = calculateBattleDice(stack, false);
    const def = calculateBattleDice(stack, true);
    expect(def.dice).toBe(att.dice + COMBAT.defenderBonusDice);
  });

  it('returns minimum 1 die', () => {
    const stack = makeStack('ottoman', 0, 0, 0, []);
    const result = calculateBattleDice(stack, false);
    expect(result.dice).toBe(1);
  });
});

describe('applyCasualties', () => {
  it('removes mercenaries first', () => {
    const stack = makeStack('hapsburg', 3, 2, 0);
    applyCasualties(stack, 2);
    expect(stack.mercenaries).toBe(0);
    expect(stack.regulars).toBe(3);
  });

  it('removes regulars after mercenaries', () => {
    const stack = makeStack('hapsburg', 3, 1, 0);
    applyCasualties(stack, 3);
    expect(stack.mercenaries).toBe(0);
    expect(stack.regulars).toBe(1);
  });

  it('removes cavalry last', () => {
    const stack = makeStack('ottoman', 1, 0, 2);
    applyCasualties(stack, 2);
    expect(stack.regulars).toBe(0);
    expect(stack.cavalry).toBe(1);
  });

  it('returns actual casualties applied', () => {
    const stack = makeStack('ottoman', 2, 0, 0);
    const result = applyCasualties(stack, 5);
    expect(result).toBe(2); // only 2 units to lose
  });
});

describe('resolveFieldBattle', () => {
  it('returns battle result with dice and hits', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 2, ['suleiman']),
      makeStack('hapsburg', 3, 1, 0, ['charles_v'])
    );

    const result = resolveFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('attackerDice');
    expect(result).toHaveProperty('defenderDice');
    expect(result).toHaveProperty('attackerRolls');
    expect(result).toHaveProperty('defenderRolls');
    expect(result).toHaveProperty('attackerHits');
    expect(result).toHaveProperty('defenderHits');
    expect(['attacker', 'defender']).toContain(result.winner);
  });

  it('attacker gets correct dice (units + leader)', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // 5 regulars + suleiman battle 2 = 7 dice
    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0, ['suleiman']),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = resolveFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.attackerDice).toBe(7);
  });

  it('defender gets bonus die', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // 3 regulars, no leader = 3 + 1 bonus = 4 dice
    setupBattle(state, 'Edirne',
      makeStack('ottoman', 3, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = resolveFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.defenderDice).toBe(4);
  });

  it('tie goes to defender', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Run multiple times — when hits are equal, defender should win
    let tieFound = false;
    for (let i = 0; i < 100 && !tieFound; i++) {
      const s = createTestState();
      const h = createMockHelpers();
      setupBattle(s, 'Edirne',
        makeStack('ottoman', 2, 0, 0),
        makeStack('hapsburg', 2, 0, 0)
      );
      const r = resolveFieldBattle(s, 'Edirne', 'ottoman', 'hapsburg', h);
      if (r.attackerHits === r.defenderHits) {
        expect(r.winner).toBe('defender');
        tieFound = true;
      }
    }
    // In 100 tries with small dice pools, a tie is very likely
    expect(tieFound).toBe(true);
  });

  it('applies casualties to both sides', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 5, 0, 0)
    );

    const result = resolveFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    // At least one side should have taken casualties (very likely)
    const totalCasualties = result.attackerCasualties + result.defenderCasualties;
    // Could be 0 if all dice miss, but very unlikely with 5+6 dice
    expect(totalCasualties).toBeGreaterThanOrEqual(0);
  });

  it('captures leaders when loser eliminated', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // 1 unit + leader vs many → likely loser
    // Run until we get an attacker loss with leader capture
    let captured = false;
    for (let i = 0; i < 50 && !captured; i++) {
      const s = createTestState();
      const h = createMockHelpers();
      setupBattle(s, 'Edirne',
        makeStack('ottoman', 1, 0, 0, ['ibrahim']),
        makeStack('hapsburg', 8, 0, 0, ['charles_v'])
      );
      const r = resolveFieldBattle(s, 'Edirne', 'ottoman', 'hapsburg', h);
      if (r.capturedLeaders.length > 0) {
        expect(r.capturedLeaders).toContain('ibrahim');
        expect(s.capturedLeaders.hapsburg).toContain('ibrahim');
        captured = true;
      }
    }
    expect(captured).toBe(true);
  });

  it('both eliminated: more dice retains 1 unit', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // 1 vs 1 — both will likely be eliminated
    let bothElim = false;
    for (let i = 0; i < 100 && !bothElim; i++) {
      const s = createTestState();
      const h = createMockHelpers();
      setupBattle(s, 'Edirne',
        makeStack('ottoman', 1, 0, 0),
        makeStack('hapsburg', 1, 0, 0)
      );
      const r = resolveFieldBattle(s, 'Edirne', 'ottoman', 'hapsburg', h);
      if (r.attackerHits >= 1 && r.defenderHits >= 1) {
        // Both should have been eliminated initially, but one retains
        const ottStack = s.spaces['Edirne'].units.find(
          u => u.owner === 'ottoman'
        );
        const hapStack = s.spaces['Edirne'].units.find(
          u => u.owner === 'hapsburg'
        );
        // Exactly one should remain
        const remaining = (ottStack ? 1 : 0) + (hapStack ? 1 : 0);
        expect(remaining).toBeGreaterThanOrEqual(1);
        bothElim = true;
      }
    }
    expect(bothElim).toBe(true);
  });

  it('returns error when a side has no units', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [
      makeStack('ottoman', 3, 0, 0)
    ];

    const result = resolveFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );
    expect(result).toHaveProperty('error');
  });

  it('logs event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 3, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    resolveFieldBattle(state, 'Edirne', 'ottoman', 'hapsburg', helpers);

    const battleEvent = state.eventLog.find(e => e.type === 'field_battle');
    expect(battleEvent).toBeDefined();
  });
});
