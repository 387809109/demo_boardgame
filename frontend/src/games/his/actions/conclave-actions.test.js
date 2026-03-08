/**
 * Here I Stand — conclave-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  triggerConclave, shouldTriggerConclave
} from './conclave-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function conclaveState(pope = 'leo_x') {
  const state = createTestState();
  state.rulers.papacy = pope;
  return state;
}

describe('shouldTriggerConclave', () => {
  it('returns true when current pope matches dead pope', () => {
    const state = conclaveState('leo_x');
    expect(shouldTriggerConclave(state, 'leo_x')).toBe(true);
  });

  it('returns false when dead pope is not current', () => {
    const state = conclaveState('clement_vii');
    expect(shouldTriggerConclave(state, 'leo_x')).toBe(false);
  });

  it('returns false for last pope in succession', () => {
    const state = conclaveState('paul_iv');
    expect(shouldTriggerConclave(state, 'paul_iv')).toBe(false);
  });

  it('returns false for unknown pope', () => {
    const state = conclaveState('leo_x');
    expect(shouldTriggerConclave(state, 'fake_pope')).toBe(false);
  });
});

describe('triggerConclave', () => {
  it('installs next pope in succession', () => {
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.status).toBe('conclave_complete');
    expect(result.previousPope).toBe('leo_x');
    expect(result.newPope).toBe('clement_vii');
    expect(state.rulers.papacy).toBe('clement_vii');
  });

  it('returns no_successor for last pope', () => {
    const state = conclaveState('paul_iv');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.status).toBe('no_successor');
  });

  it('rolls dice for each major power', () => {
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.votes).toHaveProperty('ottoman');
    expect(result.votes).toHaveProperty('hapsburg');
    expect(result.votes).toHaveProperty('england');
    expect(result.votes).toHaveProperty('france');
    expect(result.votes).toHaveProperty('papacy');
  });

  it('each vote has roll, bonus, and total', () => {
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    for (const vote of Object.values(result.votes)) {
      expect(vote).toHaveProperty('roll');
      expect(vote).toHaveProperty('bonus');
      expect(vote).toHaveProperty('total');
      expect(vote.total).toBe(vote.roll + vote.bonus);
    }
  });

  it('papacy always gets +1 bonus', () => {
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.votes.papacy.bonus).toBe(1);
  });

  it('winner gains 1 VP', () => {
    const state = conclaveState('clement_vii');
    const helpers = createMockHelpers();
    const initialVp = { ...state.vp };

    const result = triggerConclave(state, helpers);

    expect(state.vp[result.winner]).toBe(
      initialVp[result.winner] + 1);
  });

  it('determines a winner', () => {
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.winner).toBeDefined();
    expect(['ottoman', 'hapsburg', 'england', 'france', 'papacy'])
      .toContain(result.winner);
  });

  it('advances through succession chain', () => {
    const state = conclaveState('paul_iii');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.newPope).toBe('julius_iii');
    expect(state.rulers.papacy).toBe('julius_iii');
  });

  it('grants card draw reward', () => {
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.reward).toEqual({ vp: 1, cardDraw: 1 });
  });
});
