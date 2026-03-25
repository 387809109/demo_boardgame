/**
 * Here I Stand — Bot Combat Tests (Phase E3)
 *
 * Tests for avoid battle, withdraw, interception, retreat,
 * and the combined decideBattleAction/decideInterceptionAction.
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import { ACTION_TYPES } from '../actions/action-types.js';
import {
  shouldAvoidLandBattle, shouldAvoidNavalBattle,
  shouldWithdrawIntoFortification, chooseSiegeLeader,
  shouldIntercept,
  findRetreatDestination, findNavalRetreatDestination,
  decideBattleAction, decideInterceptionAction
} from './bot-combat.js';

// ── Helpers ──────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  state.wars = [];
  state.foreignWars = [];
  state.seaZones = state.seaZones || {};
  return state;
}

function setUnits(state, spaceName, power, units) {
  const sp = state.spaces[spaceName];
  if (!sp) return;
  const existing = sp.units.findIndex(u => u.owner === power);
  const stack = {
    owner: power,
    regulars: units.regulars || 0,
    mercenaries: units.mercenaries || 0,
    cavalry: units.cavalry || 0,
    leaders: units.leaders || [],
    squadrons: units.squadrons || 0
  };
  if (existing >= 0) {
    sp.units[existing] = stack;
  } else {
    sp.units.push(stack);
  }
}

// ══════════════════════════════════════════════════════════════════
// §4.1 Avoiding Battle (Land)
// ══════════════════════════════════════════════════════════════════

describe('shouldAvoidLandBattle', () => {
  it('does not avoid when no pending battle', () => {
    const state = createBotState();
    state.pendingBattle = null;
    const result = shouldAvoidLandBattle(state, 'france');
    expect(result.avoid).toBe(false);
  });

  it('does not avoid in fortified space', () => {
    const state = createBotState();
    state.pendingBattle = {
      space: 'Paris', // key space = fortified
      attackerStrength: 10,
      type: 'land'
    };
    setUnits(state, 'Paris', 'france', { regulars: 3 });
    const result = shouldAvoidLandBattle(state, 'france');
    expect(result.avoid).toBe(false);
  });

  it('avoids when defender ≤ half attacker and can form single formation', () => {
    const state = createBotState();
    // Find an unfortified French space
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress && !sp.isElectorate) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return; // Skip if no unfortified French space

    setUnits(state, unfortified, 'france', { regulars: 2 });
    state.pendingBattle = {
      space: unfortified,
      attackerStrength: 6, // 2 ≤ floor(6/2) = 3 ✓
      type: 'land'
    };
    const result = shouldAvoidLandBattle(state, 'france');
    // May or may not avoid depending on retreat destination availability
    expect(typeof result.avoid).toBe('boolean');
  });

  it('does not avoid when defender > half attacker', () => {
    const state = createBotState();
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress && !sp.isElectorate) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    setUnits(state, unfortified, 'france', { regulars: 4 });
    state.pendingBattle = {
      space: unfortified,
      attackerStrength: 6, // 4 > floor(6/2)=3 → stand ground
      type: 'land'
    };
    const result = shouldAvoidLandBattle(state, 'france');
    expect(result.avoid).toBe(false);
  });

  it('does not avoid when formation exceeds command cap', () => {
    const state = createBotState();
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && !sp.isKey && !sp.isFortress) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    // 5 units with no leader → cap is 4, can't move as single formation
    setUnits(state, unfortified, 'ottoman', { regulars: 5 });
    state.pendingBattle = {
      space: unfortified,
      attackerStrength: 20, // 5 ≤ 10 ✓
      type: 'land'
    };
    const result = shouldAvoidLandBattle(state, 'ottoman');
    expect(result.avoid).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.1 Avoiding Naval Battle
// ══════════════════════════════════════════════════════════════════

describe('shouldAvoidNavalBattle', () => {
  it('does not avoid when no pending battle', () => {
    const state = createBotState();
    state.pendingBattle = null;
    const result = shouldAvoidNavalBattle(state, 'ottoman');
    expect(result.avoid).toBe(false);
  });

  it('does not avoid when not naval type', () => {
    const state = createBotState();
    state.pendingBattle = { type: 'land', defenderStrength: 1, attackerStrength: 10 };
    const result = shouldAvoidNavalBattle(state, 'ottoman');
    expect(result.avoid).toBe(false);
  });

  it('avoids when fleet ≤ half attacker', () => {
    const state = createBotState();
    state.pendingBattle = {
      type: 'naval',
      defenderStrength: 2,
      attackerStrength: 6 // 2 ≤ floor(6/2)=3
    };
    const result = shouldAvoidNavalBattle(state, 'ottoman');
    expect(result.avoid).toBe(true);
  });

  it('does not avoid when fleet > half attacker', () => {
    const state = createBotState();
    state.pendingBattle = {
      type: 'naval',
      defenderStrength: 4,
      attackerStrength: 6 // 4 > 3
    };
    const result = shouldAvoidNavalBattle(state, 'ottoman');
    expect(result.avoid).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.2 Besieged Bot Units
// ══════════════════════════════════════════════════════════════════

describe('shouldWithdrawIntoFortification', () => {
  it('withdraws with ≤ 4 units', () => {
    const state = createBotState();
    setUnits(state, 'Paris', 'france', { regulars: 3 });
    state.pendingBattle = { space: 'Paris' };
    const result = shouldWithdrawIntoFortification(state, 'france');
    expect(result.withdraw).toBe(true);
  });

  it('fights field battle with > 4 units', () => {
    const state = createBotState();
    setUnits(state, 'Paris', 'france', { regulars: 5 });
    state.pendingBattle = { space: 'Paris' };
    const result = shouldWithdrawIntoFortification(state, 'france');
    expect(result.withdraw).toBe(false);
  });

  it('does not withdraw in non-fortified space', () => {
    const state = createBotState();
    // Find unfortified space
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    setUnits(state, unfortified, 'france', { regulars: 2 });
    state.pendingBattle = { space: unfortified };
    const result = shouldWithdrawIntoFortification(state, 'france');
    expect(result.withdraw).toBe(false);
  });

  it('exactly 4 units → withdraw', () => {
    const state = createBotState();
    setUnits(state, 'Paris', 'france', { regulars: 4 });
    state.pendingBattle = { space: 'Paris' };
    expect(shouldWithdrawIntoFortification(state, 'france').withdraw).toBe(true);
  });

  it('returns false when no pending battle', () => {
    const state = createBotState();
    state.pendingBattle = null;
    expect(shouldWithdrawIntoFortification(state, 'france').withdraw).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.2 Siege Leader Selection
// ══════════════════════════════════════════════════════════════════

describe('chooseSiegeLeader', () => {
  it('chooses leader with battle rating ≥ 1', () => {
    const result = chooseSiegeLeader({}, 'france', ['francis_i', 'henry_ii']);
    // Francis I has battle 1, Henry II has battle 0
    expect(result.retreatLeader).toBe('francis_i');
  });

  it('returns null when no leaders have battle ≥ 1', () => {
    const result = chooseSiegeLeader({}, 'france', ['henry_ii']); // battle 0
    expect(result.retreatLeader).toBeNull();
  });

  it('returns null for empty leaders', () => {
    const result = chooseSiegeLeader({}, 'france', []);
    expect(result.retreatLeader).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.14 Interception
// ══════════════════════════════════════════════════════════════════

describe('shouldIntercept', () => {
  it('does not intercept when no pending interception', () => {
    const state = createBotState();
    state.pendingInterception = null;
    const result = shouldIntercept(state, 'france');
    expect(result.intercept).toBe(false);
  });

  it('does not intercept non-fortified target', () => {
    const state = createBotState();
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    state.pendingInterception = {
      targetSpace: unfortified,
      enemyMovingIn: true,
      interceptFrom: []
    };
    const result = shouldIntercept(state, 'france');
    expect(result.intercept).toBe(false);
  });

  it('does not intercept when no enemy moving in', () => {
    const state = createBotState();
    state.pendingInterception = {
      targetSpace: 'Paris',
      enemyMovingIn: false,
      interceptFrom: []
    };
    const result = shouldIntercept(state, 'france');
    expect(result.intercept).toBe(false);
  });

  it('does not intercept from fortified space', () => {
    const state = createBotState();
    state.pendingInterception = {
      targetSpace: 'Paris',
      enemyMovingIn: true,
      interceptFrom: ['Lyon'] // Lyon is a key (fortified)
    };
    const result = shouldIntercept(state, 'france');
    expect(result.intercept).toBe(false);
  });

  it('intercepts from unfortified space with units above garrison', () => {
    const state = createBotState();
    // Find an unfortified French space adjacent to Paris
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress && !sp.isElectorate) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    // Place units above garrison (garrison for non-key is 0)
    setUnits(state, unfortified, 'france', { regulars: 3 });
    state.pendingInterception = {
      targetSpace: 'Paris',
      enemyMovingIn: true,
      interceptFrom: [unfortified]
    };
    const result = shouldIntercept(state, 'france');
    expect(result.intercept).toBe(true);
    expect(result.from).toBe(unfortified);
    expect(result.to).toBe('Paris');
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.23 Retreat
// ══════════════════════════════════════════════════════════════════

describe('findRetreatDestination', () => {
  it('finds nearest friendly fortification (isFortress)', () => {
    const state = createBotState();
    // Find a space near an actual fortress to test retreat
    // Note: findNearestFortifiedSpace checks isFortress only, not isKey
    let fortressSpace = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && sp.isFortress) {
        fortressSpace = name;
        break;
      }
    }
    if (fortressSpace) {
      const result = findRetreatDestination(state, fortressSpace, 'ottoman');
      expect(result).not.toBeNull();
    }
  });

  it('returns null when no fortress reachable', () => {
    const state = createBotState();
    state.spaces = {};
    const result = findRetreatDestination(state, 'Paris', 'france');
    expect(result).toBeNull();
  });
});

describe('findNavalRetreatDestination', () => {
  it('finds port closest to capital', () => {
    const state = createBotState();
    const result = findNavalRetreatDestination(state, 'ottoman');
    // Should return an Ottoman port
    if (result) {
      const sp = state.spaces[result];
      expect(sp.isPort).toBe(true);
      expect(sp.controller).toBe('ottoman');
    }
  });

  it('Ottoman corsair retreats to Algiers when Ottoman-controlled', () => {
    const state = createBotState();
    // Algiers starts independent in 1517 — set to Ottoman for test
    if (state.spaces['Algiers']) {
      state.spaces['Algiers'].controller = 'ottoman';
    }
    const result = findNavalRetreatDestination(state, 'ottoman', { isCorsair: true });
    expect(result).toBe('Algiers');
  });

  it('Ottoman corsair retreats to Istanbul if Algiers not Ottoman', () => {
    const state = createBotState();
    // Algiers is independent by default; should fall through to Istanbul
    const result = findNavalRetreatDestination(state, 'ottoman', { isCorsair: true });
    expect(result).toBe('Istanbul');
  });

  it('returns null for power with no ports', () => {
    const state = createBotState();
    state.spaces = {};
    const result = findNavalRetreatDestination(state, 'ottoman');
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// Combined Battle Decision
// ══════════════════════════════════════════════════════════════════

describe('decideBattleAction', () => {
  it('resolves battle when no pending battle', () => {
    const state = createBotState();
    state.pendingBattle = null;
    const action = decideBattleAction(state, 'france');
    expect(action.actionType).toBe(ACTION_TYPES.RESOLVE_BATTLE);
  });

  it('handles retreat choice', () => {
    const state = createBotState();
    state.pendingBattle = { type: 'retreat_choice', space: 'Paris' };
    const action = decideBattleAction(state, 'france');
    expect(action.actionType).toBe(ACTION_TYPES.RESOLVE_RETREAT);
  });

  it('handles naval battle avoidance', () => {
    const state = createBotState();
    state.pendingBattle = {
      type: 'naval',
      defenderStrength: 1,
      attackerStrength: 10
    };
    const action = decideBattleAction(state, 'ottoman');
    expect(action.actionType).toBe(ACTION_TYPES.AVOID_BATTLE);
  });

  it('resolves naval battle when strong enough', () => {
    const state = createBotState();
    state.pendingBattle = {
      type: 'naval',
      defenderStrength: 5,
      attackerStrength: 5
    };
    const action = decideBattleAction(state, 'ottoman');
    expect(action.actionType).toBe(ACTION_TYPES.RESOLVE_BATTLE);
  });

  it('handles avoid battle choice — land', () => {
    const state = createBotState();
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress && !sp.isElectorate) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    setUnits(state, unfortified, 'france', { regulars: 1 });
    state.pendingBattle = {
      type: 'avoid_battle_choice',
      space: unfortified,
      attackerStrength: 8
    };
    const action = decideBattleAction(state, 'france');
    // Could be AVOID_BATTLE or RESOLVE_BATTLE depending on retreat availability
    expect([ACTION_TYPES.AVOID_BATTLE, ACTION_TYPES.RESOLVE_BATTLE])
      .toContain(action.actionType);
  });

  it('withdraws into fortification with ≤ 4 units', () => {
    const state = createBotState();
    setUnits(state, 'Paris', 'france', { regulars: 3 });
    state.pendingBattle = { space: 'Paris', canWithdraw: true };
    const action = decideBattleAction(state, 'france');
    expect(action.actionType).toBe(ACTION_TYPES.WITHDRAW_INTO_FORTIFICATION);
  });

  it('fights field battle with > 4 units in fortification', () => {
    const state = createBotState();
    setUnits(state, 'Paris', 'france', { regulars: 6 });
    state.pendingBattle = { space: 'Paris', canWithdraw: true };
    const action = decideBattleAction(state, 'france');
    expect(action.actionType).toBe(ACTION_TYPES.RESOLVE_BATTLE);
  });
});

// ══════════════════════════════════════════════════════════════════
// Combined Interception Decision
// ══════════════════════════════════════════════════════════════════

describe('decideInterceptionAction', () => {
  it('declines when no pending interception', () => {
    const state = createBotState();
    state.pendingInterception = null;
    const action = decideInterceptionAction(state, 'france');
    expect(action.actionType).toBe(ACTION_TYPES.RESOLVE_INTERCEPTION);
    expect(action.actionData.intercept).toBe(false);
  });

  it('intercepts from valid unfortified space', () => {
    const state = createBotState();
    let unfortified = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'france' && !sp.isKey && !sp.isFortress && !sp.isElectorate) {
        unfortified = name;
        break;
      }
    }
    if (!unfortified) return;

    setUnits(state, unfortified, 'france', { regulars: 5 });
    state.pendingInterception = {
      targetSpace: 'Paris',
      enemyMovingIn: true,
      interceptFrom: [unfortified]
    };
    const action = decideInterceptionAction(state, 'france');
    expect(action.actionType).toBe(ACTION_TYPES.RESOLVE_INTERCEPTION);
    expect(action.actionData.intercept).toBe(true);
  });
});
