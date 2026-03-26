/**
 * Here I Stand — diplomacy-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import {
  validateDOW, executeDOW,
  validateSueForPeace, executeSueForPeace,
  validateNegotiate, executeNegotiate,
  validateRansom, executeRansom
} from './diplomacy-actions.js';
import { areAtWar, areAllied, addWar, addAlliance } from '../state/war-helpers.js';

function makeState(overrides = {}) {
  return createTestState(overrides);
}

// ── Declaration of War ─────────────────────────────────────────

describe('validateDOW', () => {
  it('rejects missing target', () => {
    const state = makeState();
    expect(validateDOW(state, 'ottoman', {}).valid).toBe(false);
  });

  it('rejects if already at war', () => {
    const state = makeState();
    // ottoman vs hungary_bohemia is in initial wars
    const r = validateDOW(state, 'ottoman', { target: 'hungary_bohemia' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Already at war');
  });

  it('rejects DOW on ally', () => {
    const state = makeState();
    addAlliance(state, 'ottoman', 'england');
    const r = validateDOW(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('ally');
  });

  it('rejects protestant DOW before Schmalkaldic League', () => {
    const state = makeState();
    state.schmalkaldicLeagueFormed = false;
    const r = validateDOW(state, 'hapsburg', { target: 'protestant' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Schmalkaldic');
  });

  it('rejects DOW on power you made peace with this turn', () => {
    const state = makeState();
    state.peaceMadeThisTurn = ['england|ottoman'];
    const r = validateDOW(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('peace');
  });

  it('does not reject DOW for unrelated peace pair', () => {
    const state = makeState();
    state.peaceMadeThisTurn = ['england|france'];
    const r = validateDOW(state, 'ottoman', { target: 'hapsburg' });
    expect(r.valid).toBe(true);
  });

  it('accepts valid major-on-major DOW with correct cost', () => {
    const state = makeState();
    const r = validateDOW(state, 'ottoman', { target: 'hapsburg' });
    expect(r.valid).toBe(true);
    expect(r.cost).toBe(4); // DOW_COSTS.ottoman.hapsburg = 4
  });

  it('accepts valid major-on-minor DOW with cost 1', () => {
    const state = makeState();
    // Remove existing ottoman-hungary war first
    state.wars = state.wars.filter(
      w => !(w.a === 'ottoman' && w.b === 'hungary_bohemia') &&
           !(w.a === 'hungary_bohemia' && w.b === 'ottoman')
    );
    const r = validateDOW(state, 'ottoman', { target: 'hungary_bohemia' });
    expect(r.valid).toBe(true);
    expect(r.cost).toBe(1);
  });

  it('rejects minor power declaring war', () => {
    const state = makeState();
    const r = validateDOW(state, 'scotland', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Minor');
  });

  it('rejects null DOW cost (protestant on anyone)', () => {
    const state = makeState();
    state.schmalkaldicLeagueFormed = true;
    const r = validateDOW(state, 'protestant', { target: 'hapsburg' });
    expect(r.valid).toBe(false);
    // DOW_COSTS.protestant.hapsburg is null
  });

  it('rejects DOW on active allied minor power', () => {
    const state = makeState();
    addAlliance(state, 'france', 'scotland');
    const r = validateDOW(state, 'england', { target: 'scotland' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('allied with france');
  });
});

describe('executeDOW', () => {
  it('adds war between powers', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    executeDOW(state, 'ottoman', { target: 'hapsburg' }, helpers);
    expect(areAtWar(state, 'ottoman', 'hapsburg')).toBe(true);
  });

  it('logs declare_war event', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    executeDOW(state, 'ottoman', { target: 'england' }, helpers);
    const log = state.eventLog.find(e => e.type === 'declare_war');
    expect(log).toBeDefined();
    expect(log.data.target).toBe('england');
  });

  it('returns intervention info for Scotland', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    const result = executeDOW(state, 'england', { target: 'scotland' }, helpers);
    expect(result.intervention).toBeDefined();
    expect(result.intervention.interventionPower).toBe('france');
    expect(result.intervention.cost).toBe(2);
  });

  it('returns intervention info for Venice', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    const result = executeDOW(state, 'ottoman', { target: 'venice' }, helpers);
    expect(result.intervention).toBeDefined();
    expect(result.intervention.interventionPower).toBe('papacy');
  });

  it('no intervention when declaring power is the intervention power', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    const result = executeDOW(state, 'france', { target: 'scotland' }, helpers);
    // France is the intervention power for Scotland, so no intervention
    expect(result.intervention).toBeUndefined();
  });
});

// ── Suing for Peace ────────────────────────────────────────────

describe('validateSueForPeace', () => {
  it('rejects if not at war', () => {
    const state = makeState();
    const r = validateSueForPeace(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
  });

  it('accepts when at war and has qualifying losses', () => {
    const state = makeState();
    addWar(state, 'ottoman', 'england');
    // England controls an Ottoman home space => qualifies to sue for peace
    state.spaces['Istanbul'].controller = 'england';
    const r = validateSueForPeace(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(true);
  });

  it('rejects when at war but has no qualifying losses', () => {
    const state = makeState();
    addWar(state, 'ottoman', 'england');
    const r = validateSueForPeace(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('captured leader or lost home space');
  });
});

describe('executeSueForPeace', () => {
  it('removes war and gives VP to winner', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    addWar(state, 'ottoman', 'england');
    state.spaces['Istanbul'].controller = 'england';
    const vpBefore = state.vp.england;

    executeSueForPeace(state, 'ottoman', { target: 'england' }, helpers);

    expect(areAtWar(state, 'ottoman', 'england')).toBe(false);
    expect(state.vp.england).toBe(vpBefore + 2);
  });

  it('tracks peace made this turn', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    addWar(state, 'ottoman', 'england');
    state.spaces['Istanbul'].controller = 'england';

    executeSueForPeace(state, 'ottoman', { target: 'england' }, helpers);

    expect(state.peaceMadeThisTurn).toContain('england|ottoman');
  });
});

// ── Negotiations ───────────────────────────────────────────────

describe('validateNegotiate', () => {
  it('rejects missing type', () => {
    const state = makeState();
    expect(validateNegotiate(state, 'ottoman', { target: 'england' }).valid).toBe(false);
  });

  it('rejects missing target', () => {
    const state = makeState();
    expect(validateNegotiate(state, 'ottoman', { type: 'end_war' }).valid).toBe(false);
  });

  // end_war
  it('end_war: rejects when not at war', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', { type: 'end_war', target: 'england' });
    expect(r.valid).toBe(false);
  });

  it('end_war: accepts when at war', () => {
    const state = makeState();
    // hapsburg vs france is initial war
    const r = validateNegotiate(state, 'hapsburg', { type: 'end_war', target: 'france' });
    expect(r.valid).toBe(true);
  });

  // form_alliance
  it('form_alliance: rejects when already allied', () => {
    const state = makeState();
    addAlliance(state, 'ottoman', 'france');
    const r = validateNegotiate(state, 'ottoman', { type: 'form_alliance', target: 'france' });
    expect(r.valid).toBe(false);
  });

  it('form_alliance: rejects when at war', () => {
    const state = makeState();
    // hapsburg vs france initial war
    const r = validateNegotiate(state, 'hapsburg', { type: 'form_alliance', target: 'france' });
    expect(r.valid).toBe(false);
  });

  it('form_alliance: accepts when valid', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', { type: 'form_alliance', target: 'england' });
    expect(r.valid).toBe(true);
  });

  // transfer_space
  it('transfer_space: rejects when not controlling space', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'transfer_space', target: 'england', space: 'London'
    });
    expect(r.valid).toBe(false);
  });

  it('transfer_space: accepts when controlling space', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'transfer_space', target: 'england', space: 'Istanbul'
    });
    expect(r.valid).toBe(true);
  });

  // gift_cards
  it('gift_cards: rejects exceeding limit', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 5
    });
    expect(r.valid).toBe(false);
  });

  it('gift_cards: accepts valid count', () => {
    const state = makeState();
    state.hands.ottoman = [11, 12, 1]; // 1 is Ottoman home card and excluded
    const r = validateNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 2
    });
    expect(r.valid).toBe(true);
  });

  // gift_mercenaries
  it('gift_mercenaries: rejects gifting to ottoman', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'england', {
      type: 'gift_mercenaries', target: 'ottoman', count: 1
    });
    expect(r.valid).toBe(false);
  });

  it('gift_mercenaries: rejects exceeding limit', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'gift_mercenaries', target: 'england', count: 10
    });
    expect(r.valid).toBe(false);
  });

  it('gift_mercenaries: accepts valid count', () => {
    const state = makeState();
    const stack = state.spaces['London'].units.find(u => u.owner === 'england');
    stack.mercenaries = 3;
    const r = validateNegotiate(state, 'england', {
      type: 'gift_mercenaries', target: 'france', count: 2
    });
    expect(r.valid).toBe(true);
  });

  // return_leader
  it('return_leader: rejects when leader not captured', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'return_leader', target: 'hapsburg', leaderId: 'charles_v'
    });
    expect(r.valid).toBe(false);
  });

  it('return_leader: accepts when leader is captured', () => {
    const state = makeState();
    state.capturedLeaders.ottoman = ['charles_v'];
    const r = validateNegotiate(state, 'ottoman', {
      type: 'return_leader', target: 'hapsburg', leaderId: 'charles_v'
    });
    expect(r.valid).toBe(true);
  });
});

describe('executeNegotiate', () => {
  it('end_war removes war and tracks peace', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    // hapsburg vs france initial war
    executeNegotiate(state, 'hapsburg', { type: 'end_war', target: 'france' }, helpers);
    expect(areAtWar(state, 'hapsburg', 'france')).toBe(false);
    expect(state.peaceMadeThisTurn).toContain('france|hapsburg');
  });

  it('form_alliance creates alliance', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    executeNegotiate(state, 'ottoman', { type: 'form_alliance', target: 'england' }, helpers);
    expect(areAllied(state, 'ottoman', 'england')).toBe(true);
    expect(state.alliancesFormedThisTurn).toHaveLength(1);
  });

  it('transfer_space changes controller', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    executeNegotiate(state, 'ottoman', {
      type: 'transfer_space', target: 'france', space: 'Istanbul'
    }, helpers);
    expect(state.spaces['Istanbul'].controller).toBe('france');
  });

  it('gift_cards draws cards for target', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.hands.ottoman = [11, 12, 1];
    const handSize = state.hands.england.length;
    const giverBefore = state.hands.ottoman.length;

    executeNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 2
    }, helpers);

    expect(state.hands.ottoman.length).toBe(giverBefore - 2);
    expect(state.hands.ottoman).toContain(1); // home card not giftable
    expect(state.hands.england.length).toBe(handSize + 2);
  });

  it('gift_mercenaries adds mercs to target space', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    const giver = state.spaces['London'].units.find(u => u.owner === 'england');
    giver.mercenaries = 3;
    const giverBefore = giver.mercenaries;

    executeNegotiate(state, 'england', {
      type: 'gift_mercenaries', target: 'france', count: 3, space: 'Paris'
    }, helpers);

    const stack = state.spaces['Paris'].units.find(u => u.owner === 'france');
    expect(stack).toBeDefined();
    expect(stack.mercenaries).toBeGreaterThanOrEqual(3);
    expect(giver.mercenaries).toBe(giverBefore - 3);
  });

  it('return_leader removes from captured list', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.capturedLeaders.ottoman = ['charles_v', 'ferdinand'];

    executeNegotiate(state, 'ottoman', {
      type: 'return_leader', target: 'hapsburg', leaderId: 'charles_v'
    }, helpers);

    expect(state.capturedLeaders.ottoman).not.toContain('charles_v');
    expect(state.capturedLeaders.ottoman).toContain('ferdinand');
  });
});

// ── Ransom ─────────────────────────────────────────────────────

describe('validateRansom', () => {
  it('rejects missing captor', () => {
    const state = makeState();
    expect(validateRansom(state, 'hapsburg', { leaderId: 'suleiman' }).valid).toBe(false);
  });

  it('rejects missing leaderId', () => {
    const state = makeState();
    expect(validateRansom(state, 'hapsburg', { captor: 'ottoman' }).valid).toBe(false);
  });

  it('rejects when leader not captured', () => {
    const state = makeState();
    const r = validateRansom(state, 'hapsburg', {
      captor: 'ottoman', leaderId: 'charles_v'
    });
    expect(r.valid).toBe(false);
  });

  it('accepts when leader is captured by captor', () => {
    const state = makeState();
    state.capturedLeaders.ottoman = ['charles_v'];
    const r = validateRansom(state, 'hapsburg', {
      captor: 'ottoman', leaderId: 'charles_v'
    });
    expect(r.valid).toBe(true);
  });
});

describe('executeRansom', () => {
  it('removes leader from captured list and captor draws a card (§9.4)', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.capturedLeaders.ottoman = ['charles_v'];
    // Give hapsburg (ransoming power) a card to draw from
    state.hands = state.hands || {};
    state.hands.hapsburg = [42];
    state.hands.ottoman = state.hands.ottoman || [];
    const ottHandBefore = state.hands.ottoman.length;

    const result = executeRansom(state, 'hapsburg', {
      captor: 'ottoman', leaderId: 'charles_v'
    }, helpers);

    expect(result.ransomed).toBe(true);
    expect(result.cardDrawn).toBe(true);
    expect(state.capturedLeaders.ottoman).not.toContain('charles_v');
    // Captor draws 1 card from ransoming power's hand
    expect(state.hands.ottoman.length).toBe(ottHandBefore + 1);
    expect(state.hands.hapsburg).toHaveLength(0);
  });

  it('logs ransom event', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.capturedLeaders.france = ['henry_viii'];

    executeRansom(state, 'england', {
      captor: 'france', leaderId: 'henry_viii'
    }, helpers);

    const log = state.eventLog.find(e => e.type === 'ransom_leader');
    expect(log).toBeDefined();
    expect(log.data.leaderId).toBe('henry_viii');
  });

  it('ransom with empty hand draws no card', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.capturedLeaders.ottoman = ['charles_v'];
    state.hands.hapsburg = []; // empty hand

    const result = executeRansom(state, 'hapsburg', {
      captor: 'ottoman', leaderId: 'charles_v'
    }, helpers);

    expect(result.ransomed).toBe(true);
    expect(result.cardDrawn).toBe(false);
    expect(state.capturedLeaders.ottoman).not.toContain('charles_v');
  });
});

// ══════════════════════════════════════════════════════════════════
// Batch 6 — Edge Case Tests
// ══════════════════════════════════════════════════════════════════

// ── validateDOW edge cases ──────────────────────────────────────

describe('validateDOW — edge cases', () => {
  it('rejects DOW on self', () => {
    const state = makeState();
    const r = validateDOW(state, 'ottoman', { target: 'ottoman' });
    // Self-DOW isn't explicitly blocked but cost lookup returns undefined
    expect(r.valid).toBe(false);
  });

  it('rejects alliance formed this turn', () => {
    const state = makeState();
    state.alliancesFormedThisTurn = [{ a: 'ottoman', b: 'england' }];
    const r = validateDOW(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('allied with this turn');
  });

  it('rejects England DOW on Venice', () => {
    const state = makeState();
    const r = validateDOW(state, 'england', { target: 'venice' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('England');
  });

  it('rejects DOW on Scotland by Ottoman', () => {
    const state = makeState();
    const r = validateDOW(state, 'ottoman', { target: 'scotland' });
    expect(r.valid).toBe(false);
  });

  it('rejects DOW on Scotland when allied with France', () => {
    const state = makeState();
    addAlliance(state, 'england', 'france');
    const r = validateDOW(state, 'england', { target: 'scotland' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('France');
  });

  it('rejects DOW on Venice when allied with Papacy', () => {
    const state = makeState();
    addAlliance(state, 'france', 'papacy');
    const r = validateDOW(state, 'france', { target: 'venice' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Papacy');
  });

  it('rejects DOW on Scotland after peacing with France', () => {
    const state = makeState();
    state.peaceMadeThisTurn = ['england|france'];
    const r = validateDOW(state, 'england', { target: 'scotland' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('France');
  });

  it('rejects DOW on Venice after peacing with Papacy', () => {
    const state = makeState();
    state.peaceMadeThisTurn = ['hapsburg|papacy'];
    const r = validateDOW(state, 'hapsburg', { target: 'venice' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Papacy');
  });

  it('rejects non-Ottoman DOW on Hungary', () => {
    const state = makeState();
    const r = validateDOW(state, 'france', { target: 'hungary_bohemia' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Ottoman');
  });

  it('rejects DOW on own minor ally (caught as ally)', () => {
    const state = makeState();
    addAlliance(state, 'france', 'scotland');
    const r = validateDOW(state, 'france', { target: 'scotland' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('ally');
  });
});

// ── validateSueForPeace edge cases ──────────────────────────────

describe('validateSueForPeace — edge cases', () => {
  it('rejects peace on final turn', () => {
    const state = makeState();
    state.turn = 9;
    addWar(state, 'ottoman', 'england');
    state.spaces['Istanbul'].controller = 'england';
    const r = validateSueForPeace(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('final turn');
  });

  it('rejects Protestant-Hapsburg peace', () => {
    const state = makeState();
    state.schmalkaldicLeagueFormed = true;
    addWar(state, 'protestant', 'hapsburg');
    const r = validateSueForPeace(state, 'protestant', { target: 'hapsburg' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Protestant');
  });

  it('rejects Protestant-Papacy peace', () => {
    const state = makeState();
    state.schmalkaldicLeagueFormed = true;
    addWar(state, 'protestant', 'papacy');
    const r = validateSueForPeace(state, 'protestant', { target: 'papacy' });
    expect(r.valid).toBe(false);
  });

  it('accepts peace when leader captured by target', () => {
    const state = makeState();
    addWar(state, 'france', 'england');
    state.capturedLeaders.england = ['francis_i'];
    const r = validateSueForPeace(state, 'france', { target: 'england' });
    expect(r.valid).toBe(true);
  });
});

// ── executeSueForPeace edge cases ───────────────────────────────

describe('executeSueForPeace — edge cases', () => {
  it('non-Ottoman war gives 1 VP', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    addWar(state, 'france', 'england');
    state.spaces['Paris'].controller = 'england';
    const vpBefore = state.vp.england;

    executeSueForPeace(state, 'france', { target: 'england' }, helpers);
    expect(state.vp.england).toBe(vpBefore + 1); // 1 VP, not 2
  });

  it('Ottoman war gives 2 VP to winner', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    addWar(state, 'ottoman', 'france');
    state.spaces['Istanbul'].controller = 'france';
    const vpBefore = state.vp.france;

    executeSueForPeace(state, 'ottoman', { target: 'france' }, helpers);
    expect(state.vp.france).toBe(vpBefore + 2);
  });
});

// ── validateNegotiate edge cases ────────────────────────────────

describe('validateNegotiate — edge cases', () => {
  it('rejects unknown negotiation type', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'bribe', target: 'england'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Unknown');
  });

  it('rejects Papacy-Ottoman alliance', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'papacy', {
      type: 'form_alliance', target: 'ottoman'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Papacy and Ottoman');
  });

  it('rejects Ottoman-Papacy alliance (reverse)', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'form_alliance', target: 'papacy'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Papacy and Ottoman');
  });

  it('transfer_space rejects missing space', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'transfer_space', target: 'england'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Missing space');
  });

  it('transfer_space rejects unknown space', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'transfer_space', target: 'england', space: 'Atlantis'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('gift_cards rejects zero count', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 0
    });
    expect(r.valid).toBe(false);
  });

  it('gift_cards rejects when only home cards in hand', () => {
    const state = makeState();
    state.hands.ottoman = [1]; // only home card
    const r = validateNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 1
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('non-home');
  });

  it('gift_mercenaries rejects zero count', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'france', {
      type: 'gift_mercenaries', target: 'england', count: 0
    });
    expect(r.valid).toBe(false);
  });

  it('gift_mercenaries rejects when not enough mercs', () => {
    const state = makeState();
    // No mercs anywhere
    const r = validateNegotiate(state, 'france', {
      type: 'gift_mercenaries', target: 'england', count: 3
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Not enough');
  });

  it('return_leader rejects missing leaderId', () => {
    const state = makeState();
    const r = validateNegotiate(state, 'ottoman', {
      type: 'return_leader', target: 'hapsburg'
    });
    expect(r.valid).toBe(false);
  });
});

// ── executeNegotiate edge cases ─────────────────────────────────

describe('executeNegotiate — edge cases', () => {
  it('gift_cards transfers only non-home cards', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.hands.ottoman = [1, 42, 43]; // #1 is home card

    executeNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 2
    }, helpers);

    // Home card #1 should still be in ottoman hand
    expect(state.hands.ottoman).toContain(1);
    expect(state.hands.ottoman).toHaveLength(1);
  });

  it('unknown negotiate type returns empty object', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    const result = executeNegotiate(state, 'ottoman', {
      type: 'unknown', target: 'england'
    }, helpers);
    expect(result).toEqual({});
  });
});
