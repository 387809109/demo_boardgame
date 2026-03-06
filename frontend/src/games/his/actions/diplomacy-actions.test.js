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
    state.peaceMadeThisTurn = ['england'];
    const r = validateDOW(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('peace');
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

  it('accepts when at war', () => {
    const state = makeState();
    addWar(state, 'ottoman', 'england');
    const r = validateSueForPeace(state, 'ottoman', { target: 'england' });
    expect(r.valid).toBe(true);
  });
});

describe('executeSueForPeace', () => {
  it('removes war and gives VP to winner', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    addWar(state, 'ottoman', 'england');
    const vpBefore = state.vp.england;

    executeSueForPeace(state, 'ottoman', { target: 'england' }, helpers);

    expect(areAtWar(state, 'ottoman', 'england')).toBe(false);
    expect(state.vp.england).toBe(vpBefore + 1);
  });

  it('tracks peace made this turn', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    addWar(state, 'ottoman', 'england');

    executeSueForPeace(state, 'ottoman', { target: 'england' }, helpers);

    expect(state.peaceMadeThisTurn).toContain('england');
    expect(state.peaceMadeThisTurn).toContain('ottoman');
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
    const r = validateNegotiate(state, 'ottoman', {
      type: 'gift_mercenaries', target: 'england', count: 2
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
    expect(state.peaceMadeThisTurn).toContain('france');
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
    const deckSize = state.deck.length;
    const handSize = state.hands.england.length;

    executeNegotiate(state, 'ottoman', {
      type: 'gift_cards', target: 'england', count: 2
    }, helpers);

    expect(state.deck.length).toBe(deckSize - 2);
    expect(state.hands.england.length).toBe(handSize + 2);
  });

  it('gift_mercenaries adds mercs to target space', () => {
    const state = makeState();
    const helpers = createMockHelpers();

    executeNegotiate(state, 'ottoman', {
      type: 'gift_mercenaries', target: 'england', count: 3, space: 'London'
    }, helpers);

    const stack = state.spaces['London'].units.find(u => u.owner === 'england');
    expect(stack).toBeDefined();
    // Mercs added (may already have some from setup)
    expect(stack.mercenaries).toBeGreaterThanOrEqual(3);
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
  it('removes leader from captured list and gives VP to captor', () => {
    const state = makeState();
    const helpers = createMockHelpers();
    state.capturedLeaders.ottoman = ['charles_v'];
    const vpBefore = state.vp.ottoman;

    const result = executeRansom(state, 'hapsburg', {
      captor: 'ottoman', leaderId: 'charles_v'
    }, helpers);

    expect(result.ransomed).toBe(true);
    expect(result.vp).toBe(1);
    expect(state.capturedLeaders.ottoman).not.toContain('charles_v');
    expect(state.vp.ottoman).toBe(vpBefore + 1);
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
});
