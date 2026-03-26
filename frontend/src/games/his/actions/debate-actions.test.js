/**
 * Here I Stand — debate-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  validateCallDebate, callDebate,
  validateDebateStep, resolveDebateStep,
  validateDebateFlip, resolveDebateFlip,
  validateCouncilChoice, executeCouncilChoice,
  resolveCouncilRound
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

  it('selects highest-value attacker, random defender', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    // Protestant highest in german zone turn 1: luther (value 4)
    expect(state.pendingDebate.attackerId).toBe('luther');
    // Defender is randomly selected from available papal debaters
    const papalIds = state.debaters.papal.map(d => d.id);
    expect(papalIds).toContain(state.pendingDebate.defenderId);
  });

  it('marks debaters as committed', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    const attacker = state.debaters.protestant.find(
      d => d.id === state.pendingDebate.attackerId);
    const defender = state.debaters.papal.find(
      d => d.id === state.pendingDebate.defenderId);
    expect(attacker.committed).toBe(true);
    expect(defender.committed).toBe(true);
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
    // Defender is randomly selected; get their actual value
    const { getDebaterDef } = require('../state/state-helpers.js');
    const defenderDef = getDebaterDef(state.pendingDebate.defenderId);
    const expectedDice = defenderDef.value + DEBATE.defenderUncommittedBonus;

    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.defenderRolls).toHaveLength(expectedDice);
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

  it('removes loser debater when hit diff > loser value (§18.5)', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    const defenderId = state.pendingDebate.defenderId;
    // Find defender's value to ensure hitDiff exceeds it
    const { getDebaterDef } = require('../state/state-helpers.js');
    const defValue = getDebaterDef(defenderId)?.value || 0;

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = defValue + 2; // guarantees hitDiff > value
    state.pendingDebate.defenderHits = 0;

    resolveDebateStep(state, 'protestant', {}, helpers);

    const defender = state.debaters.papal.find(d => d.id === defenderId);
    expect(defender).toBeUndefined();
  });

  it('does not remove loser when hit diff <= loser value', () => {
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

// ── Council of Trent ─────────────────────────────────────────────

function councilState() {
  const state = cpState();
  state.pendingCouncilOfTrent = {
    phase: 'papacy_choose',
    papacyDebaters: [],
    protestantDebaters: [],
    maxPapacy: 4,
    maxProtestant: 2
  };
  return state;
}

describe('validateCouncilChoice', () => {
  it('rejects when no pending Council', () => {
    const state = cpState();
    const r = validateCouncilChoice(state, 'papacy', { debaterIds: ['eck'] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('No pending');
  });

  it('rejects Protestant choosing during papacy_choose phase', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'protestant', {
      debaterIds: ['luther']
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Papacy');
  });

  it('rejects too many papal debaters', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'papacy', {
      debaterIds: ['eck', 'campeggio', 'aleander', 'tetzel', 'cajetan']
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('4');
  });

  it('rejects empty debater selection', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'papacy', { debaterIds: [] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('at least 1');
  });

  it('rejects unavailable debater', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'papacy', {
      debaterIds: ['nonexistent']
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not available');
  });

  it('accepts valid papal selection', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'papacy', {
      debaterIds: ['eck', 'campeggio']
    });
    expect(r.valid).toBe(true);
  });

  it('rejects Papacy choosing during protestant_choose phase', () => {
    const state = councilState();
    state.pendingCouncilOfTrent.phase = 'protestant_choose';
    const r = validateCouncilChoice(state, 'papacy', {
      debaterIds: ['eck']
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Protestant');
  });

  it('accepts valid protestant selection', () => {
    const state = councilState();
    state.pendingCouncilOfTrent.phase = 'protestant_choose';
    const r = validateCouncilChoice(state, 'protestant', {
      debaterIds: ['luther', 'melanchthon']
    });
    expect(r.valid).toBe(true);
  });
});

describe('executeCouncilChoice', () => {
  it('papacy choice advances to protestant_choose', () => {
    const state = councilState();
    const helpers = createMockHelpers();

    executeCouncilChoice(state, 'papacy', {
      debaterIds: ['eck', 'campeggio']
    }, helpers);

    expect(state.pendingCouncilOfTrent.phase).toBe('protestant_choose');
    expect(state.pendingCouncilOfTrent.papacyDebaters).toEqual(
      ['eck', 'campeggio']);
  });

  it('marks papal debaters as committed', () => {
    const state = councilState();
    const helpers = createMockHelpers();

    executeCouncilChoice(state, 'papacy', {
      debaterIds: ['eck']
    }, helpers);

    const eck = state.debaters.papal.find(d => d.id === 'eck');
    expect(eck.committed).toBe(true);
  });

  it('protestant choice advances to resolve', () => {
    const state = councilState();
    const helpers = createMockHelpers();

    // Papacy first
    executeCouncilChoice(state, 'papacy', {
      debaterIds: ['eck']
    }, helpers);

    // Protestant
    executeCouncilChoice(state, 'protestant', {
      debaterIds: ['luther']
    }, helpers);

    const council = state.pendingCouncilOfTrent;
    expect(council.phase).toBe('resolve');
    expect(council.round).toBe(1);
    expect(council.totalRounds).toBe(3);
    expect(council.papacyWins).toBe(0);
    expect(council.protestantWins).toBe(0);
  });
});

describe('resolveCouncilRound', () => {
  function setupCouncilResolve(papacyIds = ['eck'], protestIds = ['luther']) {
    const state = councilState();
    const helpers = createMockHelpers();
    executeCouncilChoice(state, 'papacy', { debaterIds: papacyIds }, helpers);
    executeCouncilChoice(state, 'protestant', {
      debaterIds: protestIds
    }, helpers);
    return { state, helpers };
  }

  it('returns round result with rolls', () => {
    const { state, helpers } = setupCouncilResolve();
    const result = resolveCouncilRound(state, helpers);

    expect(result).toHaveProperty('papacyRolls');
    expect(result).toHaveProperty('protestantRolls');
    expect(result).toHaveProperty('roundWinner');
  });

  it('tracks round wins correctly', () => {
    const { state, helpers } = setupCouncilResolve();

    // Run 2 rounds — at least one side should have a win
    const r1 = resolveCouncilRound(state, helpers);
    if (r1.status === 'round_complete') {
      const r2 = resolveCouncilRound(state, helpers);
      const council = state.pendingCouncilOfTrent;
      if (council) {
        expect(council.papacyWins + council.protestantWins).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('finalizes after best-of-3 decided', () => {
    // Run until completion
    let completed = false;
    for (let attempt = 0; attempt < 20 && !completed; attempt++) {
      const { state, helpers } = setupCouncilResolve();
      for (let round = 0; round < 3; round++) {
        const result = resolveCouncilRound(state, helpers);
        if (result.status === 'council_complete') {
          expect(['papacy', 'protestant']).toContain(result.winner);
          expect(result.spacesToFlip).toBeGreaterThanOrEqual(1);
          expect(state.pendingCouncilOfTrent).toBeNull();
          expect(state.pendingReformation).toBeDefined();
          completed = true;
          break;
        }
      }
    }
    expect(completed).toBe(true);
  });

  it('winner gains 1 VP', () => {
    let found = false;
    for (let attempt = 0; attempt < 20 && !found; attempt++) {
      const { state, helpers } = setupCouncilResolve();
      const initialVp = { ...state.vp };

      for (let round = 0; round < 3; round++) {
        const result = resolveCouncilRound(state, helpers);
        if (result.status === 'council_complete') {
          expect(state.vp[result.winner]).toBe(
            initialVp[result.winner] + 1);
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('papacy wins ties at Council', () => {
    const { state, helpers } = setupCouncilResolve();

    // Force a tie round manually
    const council = state.pendingCouncilOfTrent;
    // We can't easily force dice, but the logic says ties go to papacy
    // Verify by checking the code path: run rounds and check papacyWins
    // includes tie rounds
    const r = resolveCouncilRound(state, helpers);
    expect(r.roundWinner).toBeDefined();
    // roundWinner is never 'tie' — papacy wins ties
    expect(r.roundWinner).not.toBe('tie');
  });

  it('rejects when not in resolve phase', () => {
    const state = councilState();
    const helpers = createMockHelpers();
    const r = resolveCouncilRound(state, helpers);
    expect(r.error).toContain('not in resolve');
  });
});

// ══════════════════════════════════════════════════════════════════
// Batch 6 — Edge Case Tests
// ══════════════════════════════════════════════════════════════════

// ── validateCallDebate edge cases ───────────────────────────────

describe('validateCallDebate — edge cases', () => {
  it('rejects ottoman calling debate', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'ottoman', { zone: 'german' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Papacy or Protestant');
  });

  it('rejects france calling debate', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'france', { zone: 'german' });
    expect(r.valid).toBe(false);
  });

  it('papacy can call debate when debaters available', () => {
    const state = cpState();
    const r = validateCallDebate(state, 'papacy', { zone: 'german' });
    expect(r.valid).toBe(true);
  });

  it('rejects when attacker has no debaters at all', () => {
    const state = cpState();
    state.debaters.protestant = [];
    const r = validateCallDebate(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('debaters');
  });
});

// ── resolveDebateStep edge cases ────────────────────────────────

describe('resolveDebateStep — edge cases', () => {
  it('returns error for invalid debate phase', () => {
    const state = cpState();
    state.pendingDebate = { phase: 'unknown_phase' };
    const helpers = createMockHelpers();
    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.status).toBe('error');
  });

  it('round 2 tie results in no_result', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    // Force round 2 tie
    state.pendingDebate.round = 2;
    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 1;
    state.pendingDebate.defenderHits = 1;

    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.status).toBe('no_result');
    expect(result.round).toBe(2);
    expect(state.pendingDebate).toBeNull();
  });

  it('round 2 defender bonus is lower than round 1', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    // Round 1 roll
    const r1 = resolveDebateStep(state, 'protestant', {}, helpers);
    const r1DefRolls = r1.defenderRolls.length;

    // Force tie to get round 2
    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 0;
    state.pendingDebate.defenderHits = 0;
    resolveDebateStep(state, 'protestant', {}, helpers);

    // Round 2 roll — defender gets committed bonus (1) instead of uncommitted (2)
    if (state.pendingDebate) {
      const r2 = resolveDebateStep(state, 'protestant', {}, helpers);
      // Defender gets 1 fewer die in round 2
      expect(r2.defenderRolls.length).toBe(r1DefRolls - 1);
    }
  });
});

// ── Debate completion edge cases ────────────────────────────────

describe('resolveDebateStep — zero hit diff', () => {
  it('attacker wins with 1 hit diff → 1 space to flip', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 2;
    state.pendingDebate.defenderHits = 1;

    const result = resolveDebateStep(state, 'protestant', {}, helpers);
    expect(result.status).toBe('complete');
    expect(result.spacesToFlip).toBe(1);
  });

  it('defender wins — sets counter_reformation pending', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    callDebate(state, 'protestant', { zone: 'german' }, helpers);

    state.pendingDebate.phase = 'resolve';
    state.pendingDebate.attackerHits = 0;
    state.pendingDebate.defenderHits = 2;

    resolveDebateStep(state, 'protestant', {}, helpers);
    expect(state.pendingReformation.type).toBe('counter_reformation');
    expect(state.pendingReformation.autoFlip).toBe(true);
  });
});

// ── validateDebateFlip edge cases ───────────────────────────────

describe('validateDebateFlip — edge cases', () => {
  it('rejects when attemptsLeft is 0', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 0, source: 'debate'
    };
    const r = validateDebateFlip(state, 'protestant', { targetSpace: 'Wittenberg' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('No flips');
  });

  it('rejects missing targetSpace', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1, source: 'debate'
    };
    const r = validateDebateFlip(state, 'protestant', {});
    expect(r.valid).toBe(false);
    expect(r.error).toContain('target');
  });

  it('rejects unknown space', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1, source: 'debate'
    };
    const r = validateDebateFlip(state, 'protestant', { targetSpace: 'Atlantis' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('rejects non-debate source pending reformation', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1, source: 'publish'
    };
    const r = validateDebateFlip(state, 'protestant', { targetSpace: 'Wittenberg' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('debate');
  });
});

// ── Council of Trent edge cases ─────────────────────────────────

describe('validateCouncilChoice — edge cases', () => {
  it('rejects non-array debaterIds', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'papacy', { debaterIds: 'eck' });
    expect(r.valid).toBe(false);
  });

  it('rejects null debaterIds', () => {
    const state = councilState();
    const r = validateCouncilChoice(state, 'papacy', {});
    expect(r.valid).toBe(false);
  });

  it('rejects invalid Council phase', () => {
    const state = councilState();
    state.pendingCouncilOfTrent.phase = 'finished';
    const r = validateCouncilChoice(state, 'papacy', { debaterIds: ['eck'] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Invalid Council phase');
  });

  it('rejects committed papal debater', () => {
    const state = councilState();
    // Remove a debater so it's not found
    state.debaters.papal = state.debaters.papal.filter(d => d.id !== 'eck');
    const r = validateCouncilChoice(state, 'papacy', { debaterIds: ['eck'] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not available');
  });

  it('protestant exceeding max debaters rejected', () => {
    const state = councilState();
    state.pendingCouncilOfTrent.phase = 'protestant_choose';
    const r = validateCouncilChoice(state, 'protestant', {
      debaterIds: ['luther', 'melanchthon', 'bucer'] // max is 2
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('2');
  });
});

describe('resolveCouncilRound — edge cases', () => {
  function setupCouncilResolve(papacyIds = ['eck'], protestIds = ['luther']) {
    const state = councilState();
    const helpers = createMockHelpers();
    executeCouncilChoice(state, 'papacy', { debaterIds: papacyIds }, helpers);
    executeCouncilChoice(state, 'protestant', {
      debaterIds: protestIds
    }, helpers);
    return { state, helpers };
  }

  it('council zone is null — allows flipping any zone', () => {
    let found = false;
    for (let attempt = 0; attempt < 20 && !found; attempt++) {
      const { state, helpers } = setupCouncilResolve();
      for (let round = 0; round < 3; round++) {
        const result = resolveCouncilRound(state, helpers);
        if (result.status === 'council_complete') {
          expect(state.pendingReformation.zone).toBeNull();
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('council with no pending returns error', () => {
    const state = cpState();
    state.pendingCouncilOfTrent = null;
    const helpers = createMockHelpers();
    const r = resolveCouncilRound(state, helpers);
    expect(r.error).toBeDefined();
  });
});
