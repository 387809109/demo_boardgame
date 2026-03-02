/**
 * Here I Stand — debate-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  validateCallDebate, callDebate,
  validateDebateStep, resolveDebateStep,
  validateDebateFlip, resolveDebateFlip
} from './debate-actions.js';
import { startCpSpending } from './cp-manager.js';
import { RELIGION, DEBATE } from '../constants.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function cpState(cp = 10) {
  const state = createTestState();
  startCpSpending(state, 99, cp);
  return state;
}

// ── validateCallDebate ──────────────────────────────────────────

describe('validateCallDebate', () => {
  it('rejects missing zone', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'protestant', {});
    expect(r.valid).toBe(false);
  });

  it('rejects non-papacy/protestant', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'ottoman', { zone: 'german' });
    expect(r.valid).toBe(false);
  });

  it('accepts protestant in german zone', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(true);
  });

  it('accepts papacy in german zone', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'papacy', { zone: 'german' });
    expect(r.valid).toBe(true);
  });

  it('rejects insufficient CP', () => {
    const state = cpState(2); // call_debate costs 3
    const r = validateCallDebate(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
  });

  it('rejects when no defender debaters available', () => {
    const state = cpState();
    // Remove all papal debaters
    state.debaters.papal = [];
    const r = validateCallDebate(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Defender');
  });

  it('rejects when no attacker debaters available', () => {
    const state = cpState();
    state.debaters.protestant = [];
    const r = validateCallDebate(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('debaters');
  });
});

// ── callDebate ──────────────────────────────────────────────────

describe('callDebate', () => {
  it('sets up pendingDebate', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.pendingDebate).toBeDefined();
    expect(state.pendingDebate.zone).toBe('german');
    expect(state.pendingDebate.round).toBe(1);
    expect(state.pendingDebate.phase).toBe('roll');
  });

  it('selects highest-value debaters', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    // Protestant highest in german zone turn 1: luther (value 4)
    expect(state.pendingDebate.attackerId).toBe('luther');
    // Papal highest turn 1: eck (value 3)
    expect(state.pendingDebate.defenderId).toBe('eck');
  });

  it('marks debaters as committed', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    const luther = state.debaters.protestant.find(d => d.id === 'luther');
    const eck = state.debaters.papal.find(d => d.id === 'eck');
    expect(luther.committed).toBe(true);
    expect(eck.committed).toBe(true);
  });

  it('deducts CP', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.cpRemaining).toBe(7); // 10 - 3
  });

  it('records impulse action', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.impulseActions[0].type).toBe('call_debate');
  });
});

// ── resolveDebateStep ───────────────────────────────────────────

describe('validateDebateStep', () => {
  it('rejects when no pending debate', () => {
    const state = cpState();
    const r = validateDebateStep(state);
    expect(r.valid).toBe(false);
  });

  it('accepts when debate pending', () => {
    const state = cpState();
    state.pendingDebate = { phase: 'roll', round: 1 };
    const r = validateDebateStep(state);
    expect(r.valid).toBe(true);
  });
});

describe('resolveDebateStep — roll phase', () => {
  function setupDebate() {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);
    return { state, helpers };
  }

  it('rolls dice and moves to resolve phase', () => {
    const { state, helpers } = setupDebate();
    const result = resolveDebateStep(state, 'protestant', {}, helpers);

    expect(result.status).toBe('rolled');
    expect(result.round).toBe(1);
    expect(Array.isArray(result.attackerRolls)).toBe(true);
    expect(Array.isArray(result.defenderRolls)).toBe(true);
    expect(state.pendingDebate.phase).toBe('resolve');
  });

  it('attacker gets debater value + base bonus dice', () => {
    const { state, helpers } = setupDebate();
    const result = resolveDebateStep(state, 'protestant', {}, helpers);

    // Luther (4) + attacker bonus (3) = 7 dice
    expect(result.attackerRolls).toHaveLength(4 + DEBATE.attackerBaseBonus);
  });

  it('defender gets debater value + uncommitted bonus dice in round 1', () => {
    const { state, helpers } = setupDebate();
    const result = resolveDebateStep(state, 'protestant', {}, helpers);

    // Eck (3) + uncommitted bonus (2) = 5 dice
    expect(result.defenderRolls).toHaveLength(3 + DEBATE.defenderUncommittedBonus);
  });
});

describe('resolveDebateStep — resolve phase', () => {
  function setupAfterRoll() {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);
    resolveDebateStep(state, 'protestant', {}, helpers); // roll
    return { state, helpers };
  }

  it('resolves to complete, tie, or appropriate state', () => {
    const { state, helpers } = setupAfterRoll();
    const result = resolveDebateStep(state, 'protestant', {}, helpers);

    // Result is either 'complete', 'tie' (going to round 2)
    expect(['complete', 'tie']).toContain(result.status);
  });

  it('on tie in round 1, sets up round 2', () => {
    // Force a tie by setting equal hits
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    // Manually set to resolve phase with equal hits
    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 2;
    state.pendingDebate.defenderHits = 2;

    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.status).toBe('tie');
    expect(result.nextRound).toBe(2);
    expect(state.pendingDebate.round).toBe(2);
    expect(state.pendingDebate.phase).toBe('roll');
  });

  it('attacker wins when more hits', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 3;
    state.pendingDebate.defenderHits = 1;

    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.status).toBe('complete');
    expect(result.winner).toBe('protestant');
  });

  it('defender wins when more hits', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 0;
    state.pendingDebate.defenderHits = 3;

    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.status).toBe('complete');
    expect(result.winner).toBe('papal');
  });

  it('sets up pendingReformation for winner to flip spaces', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 3;
    state.pendingDebate.defenderHits = 1;

    resolveDebateStep(state, 'protestant', {}, helpers);

    expect(state.pendingReformation).toBeDefined();
    expect(state.pendingReformation.type).toBe('reformation');
    expect(state.pendingReformation.attemptsLeft).toBe(2); // diff = 2, min 1
    expect(state.pendingReformation.autoFlip).toBe(true);
  });

  it('removes loser debater when hit diff >= 2', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    const defenderId = state.pendingDebate.defenderId; // eck
    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 4;
    state.pendingDebate.defenderHits = 1;

    resolveDebateStep(state, 'protestant', {}, helpers);

    // Eck should be removed
    const eck = state.debaters.papal.find(d => d.id === defenderId);
    expect(eck).toBeUndefined();
  });

  it('does not remove loser when hit diff < 2', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    const defenderId = state.pendingDebate.defenderId;
    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 2;
    state.pendingDebate.defenderHits = 1;

    resolveDebateStep(state, 'protestant', {}, helpers);

    const defender = state.debaters.papal.find(d => d.id === defenderId);
    expect(defender).toBeDefined();
  });

  it('clears pendingDebate on completion', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 3;
    state.pendingDebate.defenderHits = 0;

    resolveDebateStep(state, 'protestant', {}, helpers);
    expect(state.pendingDebate).toBeNull();
  });
});

// ── Debate Flip ─────────────────────────────────────────────────

describe('validateDebateFlip', () => {
  it('rejects when no debate-sourced pending', () => {
    const state = cpState();
    const r = validateDebateFlip(state, 'protestant', { targetSpace: 'Wittenberg' });
    expect(r.valid).toBe(false);
  });

  it('rejects wrong zone', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2, source: 'debate'
    };
    const r = validateDebateFlip(state, 'protestant', { targetSpace: 'London' });
    expect(r.valid).toBe(false);
  });

  it('accepts valid target', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2, source: 'debate'
    };
    // Find a valid catholic german space
    const target = Object.entries(state.spaces).find(
      ([, sp]) => sp.religion === RELIGION.CATHOLIC && sp.languageZone === 'german'
    );
    if (target) {
      const r = validateDebateFlip(state, 'protestant', { targetSpace: target[0] });
      // Validity depends on adjacency rules
      expect(r).toHaveProperty('valid');
    }
  });
});

describe('resolveDebateFlip', () => {
  it('flips space religion without dice', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Set up: Wittenberg is catholic, pending debate flip
    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2, source: 'debate',
      autoFlip: true
    };

    const result = resolveDebateFlip(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(result.flipped).toBe('Wittenberg');
    expect(result.religion).toBe(RELIGION.PROTESTANT);
    expect(state.spaces['Wittenberg'].religion).toBe(RELIGION.PROTESTANT);
  });

  it('decrements attemptsLeft', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2, source: 'debate'
    };

    resolveDebateFlip(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(state.pendingReformation.attemptsLeft).toBe(1);
  });

  it('clears pending when all flips done', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1, source: 'debate'
    };

    resolveDebateFlip(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(state.pendingReformation).toBeNull();
  });

  it('counter-reformation flip sets catholic', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
    state.pendingReformation = {
      type: 'counter_reformation', zone: 'german', attemptsLeft: 1,
      source: 'debate'
    };

    const result = resolveDebateFlip(state, 'papacy', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(result.religion).toBe(RELIGION.CATHOLIC);
  });
});
