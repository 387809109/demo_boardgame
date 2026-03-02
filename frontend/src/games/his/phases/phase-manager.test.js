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
  it('turn 1 has 8 phases', () => {
    expect(getPhaseOrder(1)).toHaveLength(8);
  });

  it('turn 1 includes diet_of_worms', () => {
    expect(getPhaseOrder(1)).toContain('diet_of_worms');
  });

  it('turn 2 has 7 phases', () => {
    expect(getPhaseOrder(2)).toHaveLength(7);
  });

  it('turn 2 does not include diet_of_worms', () => {
    expect(getPhaseOrder(2)).not.toContain('diet_of_worms');
  });

  it('first phase is always card_draw', () => {
    expect(getPhaseOrder(1)[0]).toBe('card_draw');
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
