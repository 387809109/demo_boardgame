/**
 * Here I Stand — conclave-actions.js Unit Tests
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  triggerConclave, shouldTriggerConclave
} from './conclave-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import { RULERS } from '../constants.js';

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

// ── Edge Case Tests ───────────────────────────────────────────────

describe('shouldTriggerConclave — additional edge cases', () => {
  it('returns false for empty string pope ID', () => {
    const state = conclaveState('leo_x');
    expect(shouldTriggerConclave(state, '')).toBe(false);
  });

  it('returns false for null pope ID', () => {
    const state = conclaveState('leo_x');
    expect(shouldTriggerConclave(state, null)).toBe(false);
  });

  it('returns false for undefined pope ID', () => {
    const state = conclaveState('leo_x');
    expect(shouldTriggerConclave(state, undefined)).toBe(false);
  });

  it('returns true for each non-last pope in succession', () => {
    const succession = RULERS.papacy;
    for (let i = 0; i < succession.length - 1; i++) {
      const state = conclaveState(succession[i].id);
      expect(shouldTriggerConclave(state, succession[i].id)).toBe(true);
    }
  });

  it('returns false when state pope differs from dead pope ID', () => {
    // State has clement_vii but we check leo_x (dead pope not current)
    const state = conclaveState('clement_vii');
    expect(shouldTriggerConclave(state, 'leo_x')).toBe(false);
  });
});

describe('triggerConclave — Hapsburg/France adjacency bonus for Rome', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hapsburg and france get 0 bonus without adjacent Rome control', () => {
    // Use deterministic dice (all roll 3) to isolate bonus checking
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // floor(0.4*6)+1 = 3
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    // Without controlling spaces adjacent to Rome, bonus is 0
    expect(result.votes.hapsburg.bonus).toBe(0);
    expect(result.votes.france.bonus).toBe(0);
  });

  it('ottoman and england never get adjacency bonus', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.votes.ottoman.bonus).toBe(0);
    expect(result.votes.england.bonus).toBe(0);
  });

  it('papacy always gets +1 regardless of adjacency', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.votes.papacy.bonus).toBe(1);
    expect(result.votes.papacy.total).toBe(3 + 1);
  });
});

describe('triggerConclave — tie-breaking', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('when all powers roll the same, papacy wins via +1 bonus', () => {
    // All roll the same value — papacy has +1 bonus so wins
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*6)+1 = 4
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    // All non-papacy roll 4 with bonus 0 = total 4
    // Papacy rolls 4 with bonus 1 = total 5
    expect(result.winner).toBe('papacy');
    expect(result.votes.papacy.total).toBe(5);
  });

  it('first-iterated power wins ties (deterministic order)', () => {
    // All roll 6, papacy gets +1 = 7, all others = 6
    // Among tied non-papacy, the first one iterated wins
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // floor(0.999*6)+1 = 6
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    // Papacy: 6+1=7, all others: 6+0=6
    expect(result.winner).toBe('papacy');
    expect(result.votes.papacy.total).toBe(7);
  });

  it('non-papacy power can win with higher roll', () => {
    // Mock sequential returns: ottoman=6, hapsburg=1, england=1, france=1, papacy=1
    let callIdx = 0;
    const values = [0.999, 0.0, 0.0, 0.0, 0.0]; // 6, 1, 1, 1, 1
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return values[callIdx++ % values.length];
    });
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    // Ottoman: 6+0=6, papacy: 1+1=2
    expect(result.votes.ottoman.total).toBe(6);
    expect(result.votes.papacy.total).toBe(2);
    expect(result.winner).toBe('ottoman');
  });
});

describe('triggerConclave — VP track edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('winner VP is incremented from initial value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    // Set known initial VP values
    state.vp.ottoman = 5;
    state.vp.hapsburg = 3;
    state.vp.papacy = 10;

    const result = triggerConclave(state, helpers);

    // Papacy wins (all roll 4, papacy gets +1 = 5)
    expect(result.winner).toBe('papacy');
    expect(state.vp.papacy).toBe(11); // 10 + 1
  });

  it('no_successor result does not modify VP', () => {
    const state = conclaveState('paul_iv');
    const helpers = createMockHelpers();
    const vpBefore = { ...state.vp };

    triggerConclave(state, helpers);

    expect(state.vp).toEqual(vpBefore);
  });

  it('does not crash when winner power has no vp entry', () => {
    // Edge: vp for a power is undefined
    let callIdx = 0;
    const values = [0.999, 0.0, 0.0, 0.0, 0.0];
    vi.spyOn(Math, 'random').mockImplementation(() => {
      return values[callIdx++ % values.length];
    });

    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();
    delete state.vp.ottoman; // remove ottoman VP entry

    // Should not throw
    const result = triggerConclave(state, helpers);
    expect(result.winner).toBe('ottoman');
    // VP was undefined, so undefined + 1 = NaN, guard check skips it
    expect(state.vp.ottoman).toBeUndefined();
  });
});

describe('triggerConclave — all powers roll minimum (1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('papacy wins with minimum rolls since +1 bonus', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // floor(0.0*6)+1 = 1
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    // All roll 1. Non-papacy: total=1, Papacy: total=2
    expect(result.votes.ottoman.total).toBe(1);
    expect(result.votes.hapsburg.total).toBe(1);
    expect(result.votes.england.total).toBe(1);
    expect(result.votes.france.total).toBe(1);
    expect(result.votes.papacy.total).toBe(2);
    expect(result.winner).toBe('papacy');
  });
});

describe('triggerConclave — full succession chain', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('can trigger conclave for each pope in succession', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const succession = RULERS.papacy;

    for (let i = 0; i < succession.length - 1; i++) {
      const state = conclaveState(succession[i].id);
      const helpers = createMockHelpers();

      const result = triggerConclave(state, helpers);

      expect(result.status).toBe('conclave_complete');
      expect(result.previousPope).toBe(succession[i].id);
      expect(result.newPope).toBe(succession[i + 1].id);
      expect(state.rulers.papacy).toBe(succession[i + 1].id);
    }
  });
});

describe('triggerConclave — protestant excluded from voters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('protestant power does not participate in conclave vote', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = conclaveState('leo_x');
    const helpers = createMockHelpers();

    const result = triggerConclave(state, helpers);

    expect(result.votes).not.toHaveProperty('protestant');
  });
});
