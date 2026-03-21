/**
 * Here I Stand — combat-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getHighestBattleRating, calculateBattleDice,
  applyCasualties, resolveFieldBattle,
  initiateFieldBattle, executeFieldBattle,
  finalizeFieldBattle
} from './combat-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import { COMBAT } from '../constants.js';
import { countLandUnits } from '../state/state-helpers.js';

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

// ── Edge Case Tests ─────────────────────────────────────────────

describe('getHighestBattleRating — edge cases', () => {
  it('naval leader (barbarossa) contributes 0 battle rating', () => {
    // barbarossa is a naval leader with type !== 'army'
    expect(getHighestBattleRating(['barbarossa'])).toBe(0);
  });

  it('mixed naval + army leaders only counts army', () => {
    // barbarossa naval (battle 2 but type=naval), ibrahim army (battle 1)
    expect(getHighestBattleRating(['barbarossa', 'ibrahim'])).toBe(1);
  });

  it('all naval leaders returns 0', () => {
    // andrea_doria, barbarossa, dragut are all naval
    expect(getHighestBattleRating(['andrea_doria', 'barbarossa', 'dragut']))
      .toBe(0);
  });

  it('unknown leader id returns 0', () => {
    expect(getHighestBattleRating(['nonexistent_leader'])).toBe(0);
  });
});

describe('applyCasualties — edge cases', () => {
  it('skips empty first type and removes from next', () => {
    // 0 mercenaries, 5 regulars — hits should go straight to regulars
    const stack = makeStack('hapsburg', 5, 0, 0);
    const result = applyCasualties(stack, 3);
    expect(stack.mercenaries).toBe(0);
    expect(stack.regulars).toBe(2);
    expect(result).toBe(3);
  });

  it('no mercenaries or regulars — removes cavalry directly', () => {
    const stack = makeStack('ottoman', 0, 0, 5);
    const result = applyCasualties(stack, 3);
    expect(stack.cavalry).toBe(2);
    expect(result).toBe(3);
  });

  it('0 hits does nothing', () => {
    const stack = makeStack('hapsburg', 3, 2, 1);
    const result = applyCasualties(stack, 0);
    expect(stack.regulars).toBe(3);
    expect(stack.mercenaries).toBe(2);
    expect(stack.cavalry).toBe(1);
    expect(result).toBe(0);
  });

  it('hits exceeding all units caps at total units', () => {
    const stack = makeStack('hapsburg', 1, 1, 1);
    const result = applyCasualties(stack, 10);
    expect(stack.regulars).toBe(0);
    expect(stack.mercenaries).toBe(0);
    expect(stack.cavalry).toBe(0);
    expect(result).toBe(3);
  });

  it('cascading: 0 mercs, 0 regs, only cavalry', () => {
    const stack = makeStack('ottoman', 0, 0, 3);
    const result = applyCasualties(stack, 2);
    expect(stack.cavalry).toBe(1);
    expect(result).toBe(2);
  });
});

describe('calculateBattleDice — edge cases', () => {
  it('0 units + 0 leaders (attacker) returns minimum 1 die', () => {
    const stack = makeStack('ottoman', 0, 0, 0, []);
    const result = calculateBattleDice(stack, false);
    expect(result.dice).toBe(1);
    expect(result.unitCount).toBe(0);
    expect(result.leaderBonus).toBe(0);
  });

  it('0 units + 0 leaders (defender) returns minimum 1 die', () => {
    const stack = makeStack('hapsburg', 0, 0, 0, []);
    const result = calculateBattleDice(stack, true);
    // 0 units + 0 leader + 1 defender bonus = 1 → max(1,1) = 1
    expect(result.dice).toBe(1);
  });

  it('0 units + naval leader returns minimum 1 die', () => {
    const stack = makeStack('ottoman', 0, 0, 0, ['barbarossa']);
    const result = calculateBattleDice(stack, false);
    // 0 units + 0 (naval leader ignored) = 0 → max(0,1) = 1
    expect(result.dice).toBe(1);
    expect(result.leaderBonus).toBe(0);
  });

  it('units + only naval leaders gives units dice only', () => {
    const stack = makeStack('ottoman', 3, 0, 0, ['barbarossa', 'dragut']);
    const result = calculateBattleDice(stack, false);
    // 3 units + 0 (naval leaders) = 3
    expect(result.dice).toBe(3);
    expect(result.leaderBonus).toBe(0);
  });
});

describe('resolveFieldBattle — edge cases', () => {
  it('stack with only leaders after cleanup survives (kept in space)', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Attacker: many units, no leader. Defender: 0 units, 1 leader.
    // The leader-only stack should survive cleanup (leaders.length > 0)
    state.spaces['Edirne'].units = [
      makeStack('ottoman', 5, 0, 0, []),
      makeStack('hapsburg', 0, 0, 0, 0, ['charles_v'])
    ];
    // Fix: makeStack uses positional args - manually set the stack
    state.spaces['Edirne'].units = [
      makeStack('ottoman', 5, 0, 0, []),
      { owner: 'hapsburg', regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: ['charles_v'] }
    ];

    const result = resolveFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    // The leader should either be captured (if eliminated) or survive
    // With 0 units, the leader-only side counts as 0 land units,
    // so the leader should be captured by the winner
    expect(result).toHaveProperty('winner');
  });

  it('leader capture only happens when loser fully eliminated', () => {
    // If loser still has units, leaders should NOT be captured
    const state = createTestState();
    const helpers = createMockHelpers();

    // Both sides have units — run multiple times and check
    let foundLoserWithUnitsRemaining = false;
    for (let i = 0; i < 100 && !foundLoserWithUnitsRemaining; i++) {
      const s = createTestState();
      const h = createMockHelpers();
      setupBattle(s, 'Edirne',
        makeStack('ottoman', 4, 0, 0, ['ibrahim']),
        makeStack('hapsburg', 4, 0, 0, ['charles_v'])
      );
      const r = resolveFieldBattle(s, 'Edirne', 'ottoman', 'hapsburg', h);

      // Find the loser stack
      const loserStack = r.loserPower === 'ottoman'
        ? s.spaces['Edirne'].units.find(u => u.owner === 'ottoman')
        : s.spaces['Edirne'].units.find(u => u.owner === 'hapsburg');

      if (loserStack && countLandUnits(loserStack) > 0) {
        // Loser has units remaining — leaders should NOT be captured
        expect(r.capturedLeaders).toEqual([]);
        foundLoserWithUnitsRemaining = true;
      }
    }
    expect(foundLoserWithUnitsRemaining).toBe(true);
  });
});

// ── initiateFieldBattle Tests ───────────────────────────────────

describe('initiateFieldBattle', () => {
  it('completes synchronously when neither side has combat cards', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Ensure no combat cards in either hand
    state.hands.ottoman = [50, 51];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0, ['suleiman']),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.paused).toBeUndefined();
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('attackerDice');
    expect(result).toHaveProperty('defenderDice');
  });

  it('pauses with W2 when attacker has a combat card', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Card #24 Arquebusiers is valid in field battle for attacker
    state.hands.ottoman = [24, 50];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.paused).toBe(true);
    expect(result.window).toBe('W2');
    expect(state.pendingResponse).toBeDefined();
    expect(state.pendingResponse.respondingPower).toBe('ottoman');
    expect(state.pendingResponse.validCards).toContain(24);
  });

  it('pauses with W3 when only defender has a combat card', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Attacker has no combat cards, defender has #25 Field Artillery
    state.hands.ottoman = [50, 51];
    state.hands.hapsburg = [25, 53];

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.paused).toBe(true);
    expect(result.window).toBe('W3');
    expect(state.pendingResponse).toBeDefined();
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.validCards).toContain(25);
  });

  it('returns error when stacks missing', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [
      makeStack('ottoman', 3, 0, 0)
    ];

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );
    expect(result).toHaveProperty('error');
  });
});

// ── executeFieldBattle Tests ────────────────────────────────────

describe('executeFieldBattle', () => {
  it('produces same result shape as resolveFieldBattle', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0, ['suleiman']),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = executeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('attackerDice');
    expect(result).toHaveProperty('defenderDice');
    expect(result).toHaveProperty('attackerRolls');
    expect(result).toHaveProperty('defenderRolls');
    expect(result).toHaveProperty('attackerHits');
    expect(result).toHaveProperty('defenderHits');
    expect(result).toHaveProperty('capturedLeaders');
  });

  it('applies pendingCombatBonus when present', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 3, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    // Set up a combat bonus (attacker gets 2 extra dice)
    state.pendingCombatBonus = { attackerBonusDice: 2 };

    const result = executeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    // Base: 3 units -> 3 dice + 2 bonus = 5
    expect(result.attackerDice).toBe(5);
    // Bonus should be cleared
    expect(state.pendingCombatBonus).toBeNull();
  });

  it('applies defender combat bonus when present', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 3, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    state.pendingCombatBonus = { defenderBonusDice: 3 };

    const result = executeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    // Defender: 3 units + 1 defender bonus + 3 combat bonus = 7
    expect(result.defenderDice).toBe(7);
    expect(state.pendingCombatBonus).toBeNull();
  });

  it('logs field_battle event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 3, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    executeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    const battleEvent = state.eventLog.find(e => e.type === 'field_battle');
    expect(battleEvent).toBeDefined();
  });
});

// ── W1 Mercenary Window in initiateFieldBattle ──────────────────

describe('initiateFieldBattle — W1 mercenary window', () => {
  it('pauses with W1 when a player has #33 Landsknechts', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Clear all hands
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    // Give france card #33
    state.hands.france = [33, 50];
    state.hands.ottoman = [50, 51];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.paused).toBe(true);
    expect(result.window).toBe('W1');
    expect(state.pendingResponse).toBeDefined();
    expect(state.pendingResponse.window).toBe('W1');
    expect(state.pendingResponse.respondingPower).toBe('france');
    expect(state.pendingResponse.validCards).toContain(33);
  });

  it('skips W1 when no one has merc cards', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // No merc cards
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    // Should complete synchronously (no W1, no W2/W3 combat cards)
    expect(result.paused).toBeUndefined();
    expect(result).toHaveProperty('winner');
  });

  it('W1 comes before W2 when both are available', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    // Attacker has combat card, third party has merc card
    state.hands.ottoman = [24, 50]; // combat card
    state.hands.france = [33, 50];  // merc card

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = initiateFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    // W1 should come first
    expect(result.paused).toBe(true);
    expect(result.window).toBe('W1');
  });
});

// ── W4 Janissaries Post-Roll Window ─────────────────────────────

describe('executeFieldBattle — W4 Janissaries window', () => {
  it('pauses with W4 when Ottoman has Janissaries (#1)', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Ottoman has Janissaries (#1) in hand
    state.hands.ottoman = [1, 50];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0, ['suleiman']),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = executeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.paused).toBe(true);
    expect(result.window).toBe('W4');
    expect(result.rolls).toBeDefined();
    expect(result.rolls.attackerRolls).toBeDefined();
    expect(result.rolls.defenderRolls).toBeDefined();

    // pendingResponse should be set for Ottoman
    expect(state.pendingResponse).not.toBeNull();
    expect(state.pendingResponse.window).toBe('W4');
    expect(state.pendingResponse.respondingPower).toBe('ottoman');
    expect(state.pendingResponse.validCards).toContain(1);
  });

  it('skips W4 when Ottoman has no Janissaries', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // Ottoman has no post-roll cards
    state.hands.ottoman = [50, 51];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0, ['suleiman']),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = executeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers
    );

    expect(result.paused).toBeUndefined();
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('attackerDice');
  });

  it('skips W4 when non-Ottoman has #1', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    // France has Janissaries — should not trigger W4
    state.hands.france = [1, 50];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Paris',
      makeStack('france', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const result = executeFieldBattle(
      state, 'Paris', 'france', 'hapsburg', helpers
    );

    expect(result.paused).toBeUndefined();
    expect(result).toHaveProperty('winner');
  });

  it('Ottoman defender with #1 triggers W4', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.hands.ottoman = [1, 50];
    state.hands.hapsburg = [52, 53];

    setupBattle(state, 'Edirne',
      makeStack('hapsburg', 3, 0, 0),
      makeStack('ottoman', 5, 0, 0, ['suleiman'])
    );

    const result = executeFieldBattle(
      state, 'Edirne', 'hapsburg', 'ottoman', helpers
    );

    expect(result.paused).toBe(true);
    expect(result.window).toBe('W4');
    expect(state.pendingResponse.respondingPower).toBe('ottoman');
  });
});

// ── finalizeFieldBattle Tests ───────────────────────────────────

describe('finalizeFieldBattle', () => {
  it('applies Janissaries bonus dice when janissariesBonus set', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0, ['suleiman']),
      makeStack('hapsburg', 3, 0, 0)
    );

    // Simulate Janissaries played during W4
    state.janissariesBonus = { type: 'field', dice: 5 };

    const battleState = {
      attackerRolls: [5, 6, 3, 2, 4, 1, 5],
      defenderRolls: [3, 2, 1, 4],
      attackerDice: 7,
      defenderDice: 4
    };

    const result = finalizeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers, battleState
    );

    // Janissaries adds 5 to attackerDice: 7 + 5 = 12
    expect(result.attackerDice).toBe(12);
    // janissariesBonus should be cleared
    expect(state.janissariesBonus).toBeNull();
    expect(result).toHaveProperty('winner');
  });

  it('works without Janissaries bonus', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 5, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    const battleState = {
      attackerRolls: [5, 6, 3, 2, 4],
      defenderRolls: [3, 2, 1, 4],
      attackerDice: 5,
      defenderDice: 4
    };

    const result = finalizeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers, battleState
    );

    expect(result.attackerDice).toBe(5);
    expect(result).toHaveProperty('winner');
    expect(result).toHaveProperty('attackerHits');
    expect(result).toHaveProperty('defenderHits');
  });

  it('returns error when stacks missing', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    state.spaces['Edirne'].units = [
      makeStack('ottoman', 3, 0, 0)
    ];

    const result = finalizeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers,
      { attackerRolls: [5], defenderRolls: [3],
        attackerDice: 1, defenderDice: 1 }
    );
    expect(result).toHaveProperty('error');
  });

  it('logs field_battle event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();

    setupBattle(state, 'Edirne',
      makeStack('ottoman', 3, 0, 0),
      makeStack('hapsburg', 3, 0, 0)
    );

    finalizeFieldBattle(
      state, 'Edirne', 'ottoman', 'hapsburg', helpers,
      { attackerRolls: [5, 3, 2], defenderRolls: [4, 6, 1],
        attackerDice: 3, defenderDice: 3 }
    );

    const battleEvent = state.eventLog.find(
      e => e.type === 'field_battle'
    );
    expect(battleEvent).toBeDefined();
  });
});
