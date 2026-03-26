/**
 * Here I Stand — phase-manager.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  PHASES, getPhaseOrder, getNextPhase,
  transitionPhase, advancePhase, advanceImpulse
} from './phase-manager.js';
import { IMPULSE_ORDER } from '../constants.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

describe('getPhaseOrder', () => {
  it('turn 1 has 9 phases (includes luther_95 and diet_of_worms)', () => {
    expect(getPhaseOrder(1)).toHaveLength(9);
  });

  it('turn 1 includes diet_of_worms', () => {
    expect(getPhaseOrder(1)).toContain('diet_of_worms');
  });

  it('turn 1 starts with luther_95', () => {
    expect(getPhaseOrder(1)[0]).toBe('luther_95');
  });

  it('turn 2 has 7 phases', () => {
    expect(getPhaseOrder(2)).toHaveLength(7);
  });

  it('turn 2 does not include diet_of_worms', () => {
    expect(getPhaseOrder(2)).not.toContain('diet_of_worms');
  });

  it('first phase is card_draw for non-turn-1', () => {
    expect(getPhaseOrder(2)[0]).toBe('card_draw');
    expect(getPhaseOrder(5)[0]).toBe('card_draw');
  });

  it('last phase is always victory_determination', () => {
    const t1 = getPhaseOrder(1);
    const t2 = getPhaseOrder(2);
    expect(t1[t1.length - 1]).toBe('victory_determination');
    expect(t2[t2.length - 1]).toBe('victory_determination');
  });
});

describe('getNextPhase', () => {
  it('card_draw → diplomacy', () => {
    const state = createTestState({ phase: 'card_draw', turn: 1 });
    expect(getNextPhase(state)).toBe('diplomacy');
  });

  it('diplomacy → diet_of_worms on turn 1', () => {
    const state = createTestState({ phase: 'diplomacy', turn: 1 });
    expect(getNextPhase(state)).toBe('diet_of_worms');
  });

  it('diplomacy → spring_deployment on turn 2', () => {
    const state = createTestState({ phase: 'diplomacy', turn: 2 });
    expect(getNextPhase(state)).toBe('spring_deployment');
  });

  it('action → winter', () => {
    const state = createTestState({ phase: 'action', turn: 2 });
    expect(getNextPhase(state)).toBe('winter');
  });

  it('victory_determination → null (end of turn)', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    expect(getNextPhase(state)).toBeNull();
  });
});

describe('transitionPhase', () => {
  it('sets state.phase', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    transitionPhase(state, PHASES.DIPLOMACY, helpers);
    expect(state.phase).toBe('diplomacy');
  });

  it('logs phase_change event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    transitionPhase(state, PHASES.DIPLOMACY, helpers);
    const event = state.eventLog.find(e => e.type === 'phase_change');
    expect(event).toBeDefined();
    expect(event.data.phase).toBe('diplomacy');
  });

  it('action phase initializes impulse state', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.impulseIndex = 3;
    state.consecutivePasses = 5;
    transitionPhase(state, PHASES.ACTION, helpers);
    expect(state.impulseIndex).toBe(0);
    expect(state.consecutivePasses).toBe(0);
    expect(state.activePower).toBe(IMPULSE_ORDER[0]);
  });
});

describe('advanceImpulse', () => {
  it('increments impulseIndex', () => {
    const state = createTestState({ impulseIndex: 0 });
    advanceImpulse(state);
    expect(state.impulseIndex).toBe(1);
  });

  it('sets activePower to match IMPULSE_ORDER', () => {
    const state = createTestState({ impulseIndex: 0 });
    advanceImpulse(state);
    expect(state.activePower).toBe(IMPULSE_ORDER[1]);
  });

  it('wraps around after 6 impulses', () => {
    const state = createTestState({ impulseIndex: 5 });
    advanceImpulse(state);
    expect(state.impulseIndex).toBe(0);
    expect(state.activePower).toBe(IMPULSE_ORDER[0]);
  });

  it('full cycle returns to start', () => {
    const state = createTestState({ impulseIndex: 0 });
    for (let i = 0; i < 6; i++) {
      advanceImpulse(state);
    }
    expect(state.impulseIndex).toBe(0);
    expect(state.activePower).toBe(IMPULSE_ORDER[0]);
  });
});

describe('advancePhase', () => {
  it('moves to next phase in order', () => {
    const state = createTestState({ phase: 'diplomacy', turn: 2 });
    const helpers = createMockHelpers();
    advancePhase(state, helpers);
    expect(state.phase).toBe('spring_deployment');
  });

  it('advances turn when at end of phases', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();
    advancePhase(state, helpers);
    expect(state.turn).toBe(2);
    expect(state.phase).toBe('card_draw');
  });

  it('ends game after turn 9', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 9 });
    const helpers = createMockHelpers();
    advancePhase(state, helpers);
    expect(state.turn).toBe(10);
    expect(state.status).toBe('ended');
  });

  it('returns due naval leaders from turnTrack on turn advance', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();
    state.turnTrack.navalLeaders.push({
      power: 'ottoman',
      leaderId: 'dragut',
      returnTurn: 2,
      source: 'naval_combat_elimination',
      space: 'Ionian Sea'
    });

    advancePhase(state, helpers);

    expect(state.turn).toBe(2);
    const hasDragut = Object.values(state.spaces).some(sp =>
      (sp.units || []).some(stack => (stack.leaders || []).includes('dragut'))
    );
    expect(hasDragut).toBe(true);
    expect(state.turnTrack.navalLeaders).toHaveLength(0);
    const ev = state.eventLog.find(e => e.type === 'turn_track_naval_leader_return');
    expect(ev).toBeDefined();
  });

  it('releases due naval unit entries from turnTrack on turn advance', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();
    state.turnTrack.navalUnits.push({
      power: 'ottoman',
      type: 'squadron',
      count: 2,
      returnTurn: 2,
      source: 'naval_combat_casualties',
      space: 'Ionian Sea'
    });

    advancePhase(state, helpers);

    expect(state.turn).toBe(2);
    expect(state.turnTrack.navalUnits).toHaveLength(0);
    const ev = state.eventLog.find(e => e.type === 'turn_track_naval_units_released');
    expect(ev).toBeDefined();
    expect(ev.data.released.ottoman.squadron).toBe(2);
  });
});

describe('winter phase — debater/CP reset', () => {
  it('resets all debaters to uncommitted', () => {
    const state = createTestState({ phase: 'action', turn: 1 });
    const helpers = createMockHelpers();
    // Mark some debaters as committed
    state.debaters.papal[0].committed = true;
    state.debaters.protestant[0].committed = true;

    transitionPhase(state, 'winter', helpers);

    for (const d of state.debaters.papal) {
      expect(d.committed).toBe(false);
    }
    for (const d of state.debaters.protestant) {
      expect(d.committed).toBe(false);
    }
  });

  it('clears pending interactions', () => {
    const state = createTestState({ phase: 'action', turn: 1 });
    const helpers = createMockHelpers();
    state.pendingReformation = { type: 'reformation', attemptsLeft: 1 };
    state.pendingDebate = { phase: 'roll' };
    state.cpRemaining = 5;
    state.activeCardNumber = 42;

    transitionPhase(state, 'winter', helpers);

    expect(state.pendingReformation).toBeNull();
    expect(state.pendingDebate).toBeNull();
    expect(state.cpRemaining).toBe(0);
    expect(state.activeCardNumber).toBeNull();
    expect(state.impulseActions).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════
// Batch 6 — Edge Case Tests
// ══════════════════════════════════════════════════════════════════

// ── getPhaseOrder edge cases ────────────────────────────────────

describe('getPhaseOrder — edge cases', () => {
  it('turn 9 has same phases as turn 2', () => {
    expect(getPhaseOrder(9)).toEqual(getPhaseOrder(2));
  });

  it('new_world phase is before victory_determination', () => {
    const order = getPhaseOrder(2);
    const nwIdx = order.indexOf('new_world');
    const vdIdx = order.indexOf('victory_determination');
    expect(nwIdx).toBeLessThan(vdIdx);
    expect(nwIdx).toBeGreaterThan(-1);
  });

  it('action phase is after spring_deployment', () => {
    const order = getPhaseOrder(2);
    const sdIdx = order.indexOf('spring_deployment');
    const actIdx = order.indexOf('action');
    expect(actIdx).toBe(sdIdx + 1);
  });
});

// ── getNextPhase edge cases ─────────────────────────────────────

describe('getNextPhase — edge cases', () => {
  it('luther_95 → card_draw on turn 1', () => {
    const state = createTestState({ phase: 'luther_95', turn: 1 });
    expect(getNextPhase(state)).toBe('card_draw');
  });

  it('winter → new_world', () => {
    const state = createTestState({ phase: 'winter', turn: 2 });
    expect(getNextPhase(state)).toBe('new_world');
  });

  it('new_world → victory_determination', () => {
    const state = createTestState({ phase: 'new_world', turn: 2 });
    expect(getNextPhase(state)).toBe('victory_determination');
  });

  it('spring_deployment → action', () => {
    const state = createTestState({ phase: 'spring_deployment', turn: 3 });
    expect(getNextPhase(state)).toBe('action');
  });

  it('unknown phase returns null', () => {
    const state = createTestState({ phase: 'unknown_phase', turn: 2 });
    expect(getNextPhase(state)).toBeNull();
  });
});

// ── advancePhase edge cases ─────────────────────────────────────

describe('advancePhase — edge cases', () => {
  it('no-op when game already ended', () => {
    const state = createTestState({ phase: 'action', turn: 2 });
    const helpers = createMockHelpers();
    state.status = 'ended';
    advancePhase(state, helpers);
    expect(state.phase).toBe('action'); // unchanged
  });

  it('turn 8 victory_determination advances to turn 9', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 8 });
    const helpers = createMockHelpers();
    advancePhase(state, helpers);
    expect(state.turn).toBe(9);
    expect(state.phase).toBe('card_draw');
    expect(state.status).not.toBe('ended');
  });

  it('action phase initializes consecutivePasses to 0', () => {
    const state = createTestState({ phase: 'spring_deployment', turn: 2 });
    const helpers = createMockHelpers();
    state.consecutivePasses = 99;
    transitionPhase(state, PHASES.ACTION, helpers);
    expect(state.consecutivePasses).toBe(0);
    expect(state.impulseIndex).toBe(0);
  });
});

// ── advanceImpulse edge cases ───────────────────────────────────

describe('advanceImpulse — edge cases', () => {
  it('impulseIndex 4 → 5 (last power)', () => {
    const state = createTestState({ impulseIndex: 4 });
    advanceImpulse(state);
    expect(state.impulseIndex).toBe(5);
    expect(state.activePower).toBe(IMPULSE_ORDER[5]);
  });

  it('two full cycles return to start', () => {
    const state = createTestState({ impulseIndex: 0 });
    for (let i = 0; i < 12; i++) {
      advanceImpulse(state);
    }
    expect(state.impulseIndex).toBe(0);
    expect(state.activePower).toBe(IMPULSE_ORDER[0]);
  });
});

// ── Turn track naval leader edge cases ──────────────────────────

describe('advancePhase — naval leader return edge cases', () => {
  it('leader already on map is not duplicated', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();

    // Put dragut on map already
    const istanbulUnits = state.spaces['Istanbul'].units || [];
    let ottStack = istanbulUnits.find(u => u.owner === 'ottoman');
    if (!ottStack) {
      ottStack = { owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] };
      state.spaces['Istanbul'].units = state.spaces['Istanbul'].units || [];
      state.spaces['Istanbul'].units.push(ottStack);
    }
    ottStack.leaders.push('dragut');

    state.turnTrack = {
      navalLeaders: [{
        power: 'ottoman', leaderId: 'dragut', returnTurn: 2,
        source: 'test', space: 'Istanbul'
      }],
      navalUnits: []
    };

    advancePhase(state, helpers);

    // Should not duplicate
    let dragutCount = 0;
    for (const sp of Object.values(state.spaces)) {
      for (const stack of sp.units || []) {
        dragutCount += (stack.leaders || []).filter(l => l === 'dragut').length;
      }
    }
    expect(dragutCount).toBe(1);
  });

  it('leader delayed when no controlled port', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();

    // Remove dragut from map first (initial setup places him)
    for (const sp of Object.values(state.spaces)) {
      for (const stack of sp.units || []) {
        stack.leaders = (stack.leaders || []).filter(l => l !== 'dragut');
      }
    }

    // Set all ottoman-controlled spaces to enemy control (not just ports)
    for (const [, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman') {
        sp.controller = 'hapsburg';
      }
    }

    state.turnTrack = {
      navalLeaders: [{
        power: 'ottoman', leaderId: 'dragut', returnTurn: 2,
        source: 'test', space: 'Istanbul'
      }],
      navalUnits: []
    };

    advancePhase(state, helpers);

    // Leader should be delayed to next turn
    expect(state.turnTrack.navalLeaders).toHaveLength(1);
    expect(state.turnTrack.navalLeaders[0].returnTurn).toBe(3);
  });

  it('naval units with zero count are skipped', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();

    state.turnTrack = {
      navalLeaders: [],
      navalUnits: [{
        power: 'ottoman', type: 'squadron', count: 0,
        returnTurn: 2, source: 'test', space: 'Istanbul'
      }]
    };

    advancePhase(state, helpers);

    // Zero-count entry should be silently dropped
    expect(state.turnTrack.navalUnits).toHaveLength(0);
  });

  it('future naval leader not returned early', () => {
    const state = createTestState({ phase: 'victory_determination', turn: 1 });
    const helpers = createMockHelpers();

    state.turnTrack = {
      navalLeaders: [{
        power: 'ottoman', leaderId: 'dragut', returnTurn: 5,
        source: 'test', space: 'Istanbul'
      }],
      navalUnits: []
    };

    advancePhase(state, helpers);

    // Leader should remain on turn track
    expect(state.turnTrack.navalLeaders).toHaveLength(1);
    expect(state.turnTrack.navalLeaders[0].returnTurn).toBe(5);
  });
});
