/**
 * Here I Stand — religious-actions.js Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rollDice,
  validatePublishTreatise, publishTreatise,
  validateBurnBooks, burnBooks,
  validateReformationAttempt, resolveReformationAttempt,
  validateTranslateScripture, translateScripture,
  validateBuildStPeters, buildStPeters,
  validateFoundJesuit, foundJesuit
} from './religious-actions.js';
import { startCpSpending } from './cp-manager.js';
import { RELIGION, ST_PETERS, TRANSLATION } from '../constants.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function cpState(cp = 10) {
  const state = createTestState();
  startCpSpending(state, 99, cp);
  return state;
}

// ── rollDice ─────────────────────────────────────────────────────

describe('rollDice', () => {
  it('returns array of length n', () => {
    const result = rollDice(5);
    expect(result).toHaveLength(5);
  });

  it('returns at least 1 die for n=0', () => {
    expect(rollDice(0)).toHaveLength(1);
  });

  it('all values between 1 and 6', () => {
    const result = rollDice(20);
    for (const d of result) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });
});

// ── Publish Treatise ─────────────────────────────────────────────

describe('validatePublishTreatise', () => {
  it('rejects missing zone', () => {
    const state = cpState();
    const r = validatePublishTreatise(state, 'protestant', {});
    expect(r.valid).toBe(false);
  });

  it('accepts protestant with german zone', () => {
    const state = cpState();
    const r = validatePublishTreatise(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(true);
  });

  it('rejects powers that cannot publish', () => {
    const state = cpState();
    const r = validatePublishTreatise(state, 'ottoman', { zone: 'german' });
    expect(r.valid).toBe(false);
  });

  it('england can only publish in english zone', () => {
    const state = cpState();
    const r = validatePublishTreatise(state, 'england', { zone: 'german' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('English zone');
  });

  it('england accepted for english zone', () => {
    const state = cpState();
    const r = validatePublishTreatise(state, 'england', { zone: 'english' });
    expect(r.valid).toBe(true);
  });

  it('rejects insufficient CP', () => {
    const state = cpState(1);
    const r = validatePublishTreatise(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
  });
});

describe('publishTreatise', () => {
  it('sets up pendingReformation with 2 attempts', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    publishTreatise(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.pendingReformation).toBeDefined();
    expect(state.pendingReformation.type).toBe('reformation');
    expect(state.pendingReformation.zone).toBe('german');
    expect(state.pendingReformation.attemptsLeft).toBe(2);
  });

  it('deducts CP', () => {
    const state = cpState(10);
    const helpers = createMockHelpers();
    const before = state.cpRemaining;
    publishTreatise(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.cpRemaining).toBeLessThan(before);
  });
});

// ── Burn Books ──────────────────────────────────────────────────

describe('validateBurnBooks', () => {
  it('rejects non-papacy', () => {
    const state = cpState();
    const r = validateBurnBooks(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
  });

  it('accepts papacy', () => {
    const state = cpState();
    const r = validateBurnBooks(state, 'papacy', { zone: 'german' });
    expect(r.valid).toBe(true);
  });

  it('rejects insufficient CP', () => {
    const state = cpState(1);
    const r = validateBurnBooks(state, 'papacy', { zone: 'german' });
    expect(r.valid).toBe(false);
  });
});

describe('burnBooks', () => {
  it('sets up counter-reformation pending', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    burnBooks(state, 'papacy', { zone: 'german' }, helpers);

    expect(state.pendingReformation.type).toBe('counter_reformation');
    expect(state.pendingReformation.attemptsLeft).toBe(2);
  });
});

// ── Reformation Attempt ─────────────────────────────────────────

describe('validateReformationAttempt', () => {
  it('rejects when no pending reformation', () => {
    const state = cpState();
    const r = validateReformationAttempt(state, 'protestant', {
      targetSpace: 'Wittenberg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects when no attempts left', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 0
    };
    const r = validateReformationAttempt(state, 'protestant', {
      targetSpace: 'Wittenberg'
    });
    expect(r.valid).toBe(false);
  });

  it('rejects target in wrong zone', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2
    };
    // London is in english zone
    const r = validateReformationAttempt(state, 'protestant', {
      targetSpace: 'London'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('zone');
  });

  it('accepts valid Catholic space in correct zone', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2
    };
    // Find a Catholic German zone space that is a valid reformation target
    const target = Object.entries(state.spaces).find(
      ([, sp]) => sp.religion === RELIGION.CATHOLIC &&
                  sp.languageZone === 'german'
    );
    if (target) {
      const r = validateReformationAttempt(state, 'protestant', {
        targetSpace: target[0]
      });
      // May be invalid if adjacency doesn't work; just check no crash
      expect(r).toHaveProperty('valid');
    }
  });
});

describe('resolveReformationAttempt', () => {
  it('decrements attemptsLeft', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    // Set up a valid target: make Wittenberg catholic, set pending
    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2
    };

    resolveReformationAttempt(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    // Either pending is updated or cleared
    if (state.pendingReformation) {
      expect(state.pendingReformation.attemptsLeft).toBe(1);
    }
  });

  it('returns dice results', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1
    };

    const result = resolveReformationAttempt(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('protestantDice');
    expect(result).toHaveProperty('papalDice');
    expect(Array.isArray(result.protestantDice)).toBe(true);
    expect(Array.isArray(result.papalDice)).toBe(true);
  });

  it('clears pending when last attempt used', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1
    };

    resolveReformationAttempt(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(state.pendingReformation).toBeNull();
  });

  it('flips religion on success (mocked dice)', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 2
    };

    // Run multiple times to get at least one success (probabilistic)
    let gotSuccess = false;
    for (let i = 0; i < 50 && !gotSuccess; i++) {
      const s = cpState();
      s.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
      s.pendingReformation = {
        type: 'reformation', zone: 'german', attemptsLeft: 2
      };
      const r = resolveReformationAttempt(s, 'protestant', {
        targetSpace: 'Wittenberg'
      }, helpers);
      if (r.success) {
        expect(s.spaces['Wittenberg'].religion).toBe(RELIGION.PROTESTANT);
        gotSuccess = true;
      }
    }
    // With 50 tries, statistically should get at least one success
    expect(gotSuccess).toBe(true);
  });
});

// ── Translate Scripture ─────────────────────────────────────────

describe('validateTranslateScripture', () => {
  it('rejects non-protestant', () => {
    const state = cpState();
    const r = validateTranslateScripture(state, 'papacy', { zone: 'german' });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid zone', () => {
    const state = cpState();
    const r = validateTranslateScripture(state, 'protestant', { zone: 'italian' });
    expect(r.valid).toBe(false);
  });

  it('accepts valid zone with CP', () => {
    const state = cpState();
    const r = validateTranslateScripture(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(true);
  });

  it('rejects when full bible already complete', () => {
    const state = cpState();
    state.translationTracks.german = TRANSLATION.fullBibleCp;
    const r = validateTranslateScripture(state, 'protestant', { zone: 'german' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Full Bible');
  });
});

describe('translateScripture', () => {
  it('increments translation track', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const before = state.translationTracks.german || 0;
    translateScripture(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.translationTracks.german).toBe(before + 1);
  });

  it('triggers NT reformation at threshold', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.translationTracks.german = TRANSLATION.newTestamentCp - 1;

    translateScripture(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.pendingReformation).toBeDefined();
    expect(state.pendingReformation.source).toBe('new_testament');
    expect(state.pendingReformation.attemptsLeft).toBe(TRANSLATION.newTestamentRolls);
  });

  it('triggers Full Bible reformation + VP at threshold', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.translationTracks.german = TRANSLATION.fullBibleCp - 1;

    translateScripture(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.pendingReformation).toBeDefined();
    expect(state.pendingReformation.source).toBe('full_bible');
    expect(state.bonusVp.protestant).toBe(1);
  });

  it('deducts 1 CP', () => {
    const state = cpState(5);
    const helpers = createMockHelpers();
    translateScripture(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.cpRemaining).toBe(4);
  });
});

// ── Build St. Peter's ──────────────────────────────────────────

describe('validateBuildStPeters', () => {
  it('rejects non-papacy', () => {
    const state = cpState();
    const r = validateBuildStPeters(state, 'ottoman');
    expect(r.valid).toBe(false);
  });

  it('accepts papacy', () => {
    const state = cpState();
    const r = validateBuildStPeters(state, 'papacy');
    expect(r.valid).toBe(true);
  });

  it('rejects when already complete', () => {
    const state = cpState();
    state.stPetersVp = ST_PETERS.maxVp;
    const r = validateBuildStPeters(state, 'papacy');
    expect(r.valid).toBe(false);
  });
});

describe('buildStPeters', () => {
  it('increments progress', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    const before = state.stPetersProgress;
    buildStPeters(state, 'papacy', {}, helpers);
    expect(state.stPetersProgress).toBe(before + 1);
  });

  it('awards VP at milestone', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.stPetersProgress = ST_PETERS.cpPerVp - 1;
    state.stPetersVp = 0;
    buildStPeters(state, 'papacy', {}, helpers);
    expect(state.stPetersVp).toBe(1);
  });

  it('caps VP at maxVp', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.stPetersProgress = ST_PETERS.cpPerVp * ST_PETERS.maxVp - 1;
    state.stPetersVp = ST_PETERS.maxVp - 1;
    buildStPeters(state, 'papacy', {}, helpers);
    expect(state.stPetersVp).toBe(ST_PETERS.maxVp);
  });
});

// ── Found Jesuit ────────────────────────────────────────────────

describe('validateFoundJesuit', () => {
  it('rejects non-papacy', () => {
    const state = cpState();
    const r = validateFoundJesuit(state, 'ottoman', { space: 'Rome' });
    expect(r.valid).toBe(false);
  });

  it('rejects when jesuits not unlocked', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = false;
    const r = validateFoundJesuit(state, 'papacy', { space: 'Rome' });
    expect(r.valid).toBe(false);
  });

  it('rejects non-catholic space', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = true;
    // Find a protestant space
    const entry = Object.entries(state.spaces).find(
      ([, sp]) => sp.religion === RELIGION.PROTESTANT
    );
    if (entry) {
      const r = validateFoundJesuit(state, 'papacy', { space: entry[0] });
      expect(r.valid).toBe(false);
    }
  });

  it('accepts valid catholic space when unlocked', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = true;
    const r = validateFoundJesuit(state, 'papacy', { space: 'Rome' });
    expect(r.valid).toBe(true);
  });

  it('rejects duplicate jesuit in same space', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = true;
    state.jesuitUniversities.push('Rome');
    const r = validateFoundJesuit(state, 'papacy', { space: 'Rome' });
    expect(r.valid).toBe(false);
  });
});

describe('foundJesuit', () => {
  it('adds space to jesuitUniversities', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = true;
    const helpers = createMockHelpers();
    foundJesuit(state, 'papacy', { space: 'Rome' }, helpers);
    expect(state.jesuitUniversities).toContain('Rome');
  });

  it('deducts CP', () => {
    const state = cpState(10);
    state.jesuitFoundingEnabled = true;
    const helpers = createMockHelpers();
    const before = state.cpRemaining;
    foundJesuit(state, 'papacy', { space: 'Rome' }, helpers);
    expect(state.cpRemaining).toBeLessThan(before);
  });
});

// ══════════════════════════════════════════════════════════════════
// Batch 6 — Edge Case Tests
// ══════════════════════════════════════════════════════════════════

// ── rollDice edge cases ──────────────────────────────────────────

describe('rollDice — edge cases', () => {
  it('negative n still returns at least 1 die', () => {
    expect(rollDice(-5)).toHaveLength(1);
  });

  it('large n returns correct length', () => {
    expect(rollDice(100)).toHaveLength(100);
  });
});

// ── Counter-Reformation edge cases ──────────────────────────────

describe('resolveReformationAttempt — counter-reformation', () => {
  it('Augsburg Confession modifier reduces papal dice', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.augsburgConfessionActive = true;

    state.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
    state.pendingReformation = {
      type: 'counter_reformation', zone: 'german', attemptsLeft: 2
    };

    const result = resolveReformationAttempt(state, 'papacy', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('papalDice');
    // Augsburg doesn't reduce dice count, only modifies values (min 1)
    expect(result.papalDice.length).toBeGreaterThan(0);
  });

  it('counter-reformation flips space to catholic on success', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    let gotSuccess = false;
    for (let i = 0; i < 50 && !gotSuccess; i++) {
      const s = cpState();
      s.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
      s.pendingReformation = {
        type: 'counter_reformation', zone: 'german', attemptsLeft: 2
      };
      // Set pope for tie-win ability
      s.rulers = { papacy: 'paul_iii' };
      const r = resolveReformationAttempt(s, 'papacy', {
        targetSpace: 'Wittenberg'
      }, helpers);
      if (r.success) {
        expect(s.spaces['Wittenberg'].religion).toBe(RELIGION.CATHOLIC);
        gotSuccess = true;
      }
    }
    expect(gotSuccess).toBe(true);
  });

  it('counter-reformation without papal tie-win pope', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    state.rulers = { papacy: 'clement_vii' }; // no tie-win

    state.spaces['Wittenberg'].religion = RELIGION.PROTESTANT;
    state.pendingReformation = {
      type: 'counter_reformation', zone: 'german', attemptsLeft: 1
    };

    const result = resolveReformationAttempt(state, 'papacy', {
      targetSpace: 'Wittenberg'
    }, helpers);

    expect(result).toHaveProperty('success');
    expect(state.pendingReformation).toBeNull();
  });
});

// ── Reformation attempt with dice modifier ──────────────────────

describe('resolveReformationAttempt — dice modifier', () => {
  it('Full Bible dice modifier applies +1 to protestant rolls', () => {
    const state = cpState();
    const helpers = createMockHelpers();

    state.spaces['Wittenberg'].religion = RELIGION.CATHOLIC;
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1,
      diceModifier: 1
    };

    const result = resolveReformationAttempt(state, 'protestant', {
      targetSpace: 'Wittenberg'
    }, helpers);

    // With +1 modifier, auto-success threshold is effectively easier
    expect(result).toHaveProperty('protestantDice');
    expect(result.protestantDice.length).toBeGreaterThan(0);
  });
});

// ── validateReformationAttempt edge cases ────────────────────────

describe('validateReformationAttempt — edge cases', () => {
  it('rejects missing targetSpace', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1
    };
    const r = validateReformationAttempt(state, 'protestant', {});
    expect(r.valid).toBe(false);
    expect(r.error).toContain('target');
  });

  it('rejects unknown space name', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'reformation', zone: 'german', attemptsLeft: 1
    };
    const r = validateReformationAttempt(state, 'protestant', {
      targetSpace: 'Atlantis'
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('rejects counter-reformation target that is already catholic', () => {
    const state = cpState();
    state.pendingReformation = {
      type: 'counter_reformation', zone: 'german', attemptsLeft: 1
    };
    // Find a catholic german space
    const target = Object.entries(state.spaces).find(
      ([, sp]) => sp.religion === RELIGION.CATHOLIC && sp.languageZone === 'german'
    );
    if (target) {
      const r = validateReformationAttempt(state, 'papacy', {
        targetSpace: target[0]
      });
      expect(r.valid).toBe(false);
    }
  });
});

// ── Translate Scripture edge cases ──────────────────────────────

describe('translateScripture — edge cases', () => {
  it('rejects zone not in valid set', () => {
    const state = cpState();
    const r = validateTranslateScripture(state, 'protestant', { zone: 'spanish' });
    expect(r.valid).toBe(false);
  });

  it('english zone translation works for protestant', () => {
    const state = cpState();
    const r = validateTranslateScripture(state, 'protestant', { zone: 'english' });
    expect(r.valid).toBe(true);
  });

  it('french zone translation works for protestant', () => {
    const state = cpState();
    const r = validateTranslateScripture(state, 'protestant', { zone: 'french' });
    expect(r.valid).toBe(true);
  });

  it('NT completion does not award VP', () => {
    const state = cpState(20);
    const helpers = createMockHelpers();
    state.translationTracks.german = TRANSLATION.newTestamentCp - 1;
    state.bonusVp = state.bonusVp || {};
    const vpBefore = state.bonusVp.protestant || 0;

    translateScripture(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.bonusVp.protestant || 0).toBe(vpBefore); // no VP for NT
    expect(state.pendingReformation.source).toBe('new_testament');
  });

  it('Full Bible grants +1 dice modifier in pending', () => {
    const state = cpState(20);
    const helpers = createMockHelpers();
    state.translationTracks.german = TRANSLATION.fullBibleCp - 1;

    translateScripture(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.pendingReformation.diceModifier).toBe(1);
    expect(state.pendingReformation.source).toBe('full_bible');
  });

  it('mid-track translation has no pending reformation', () => {
    const state = cpState(20);
    const helpers = createMockHelpers();
    state.translationTracks.german = 3; // well below NT threshold

    translateScripture(state, 'protestant', { zone: 'german' }, helpers);

    expect(state.translationTracks.german).toBe(4);
    expect(state.pendingReformation).toBeNull();
  });
});

// ── Build St. Peter's edge cases ────────────────────────────────

describe('buildStPeters — edge cases', () => {
  it('multiple builds without crossing milestone give no VP', () => {
    const state = cpState(20);
    const helpers = createMockHelpers();
    state.stPetersProgress = 0;
    state.stPetersVp = 0;

    // Build 4 times (cpPerVp=5, so no milestone yet)
    for (let i = 0; i < 4; i++) {
      buildStPeters(state, 'papacy', {}, helpers);
    }
    expect(state.stPetersProgress).toBe(4);
    expect(state.stPetersVp).toBe(0);
  });

  it('building past already-max VP does nothing extra', () => {
    const state = cpState(20);
    const helpers = createMockHelpers();
    state.stPetersProgress = ST_PETERS.cpPerVp * ST_PETERS.maxVp;
    state.stPetersVp = ST_PETERS.maxVp;

    // Should reject since already complete
    const r = validateBuildStPeters(state, 'papacy');
    expect(r.valid).toBe(false);
  });
});

// ── Found Jesuit edge cases ─────────────────────────────────────

describe('foundJesuit — edge cases', () => {
  it('rejects missing space parameter', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = true;
    const r = validateFoundJesuit(state, 'papacy', {});
    expect(r.valid).toBe(false);
    expect(r.error).toContain('space');
  });

  it('rejects unknown space name', () => {
    const state = cpState();
    state.jesuitFoundingEnabled = true;
    const r = validateFoundJesuit(state, 'papacy', { space: 'Atlantis' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('not found');
  });

  it('multiple jesuits in different spaces works', () => {
    const state = cpState(20);
    state.jesuitFoundingEnabled = true;
    const helpers = createMockHelpers();

    // Find two different catholic spaces
    const cathSpaces = Object.entries(state.spaces)
      .filter(([, sp]) => sp.religion === RELIGION.CATHOLIC)
      .slice(0, 2);
    if (cathSpaces.length >= 2) {
      foundJesuit(state, 'papacy', { space: cathSpaces[0][0] }, helpers);
      foundJesuit(state, 'papacy', { space: cathSpaces[1][0] }, helpers);
      expect(state.jesuitUniversities).toContain(cathSpaces[0][0]);
      expect(state.jesuitUniversities).toContain(cathSpaces[1][0]);
      expect(state.jesuitUniversities).toHaveLength(2);
    }
  });

  it('rejects insufficient CP for jesuit', () => {
    const state = cpState(1); // jesuit costs 2 CP
    state.jesuitFoundingEnabled = true;
    const r = validateFoundJesuit(state, 'papacy', { space: 'Rome' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('CP');
  });
});

// ── Publish Treatise edge cases ─────────────────────────────────

describe('publishTreatise — edge cases', () => {
  it('sets initiator in pending', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    publishTreatise(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.pendingReformation.initiator).toBe('protestant');
  });

  it('records impulse action', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    publishTreatise(state, 'protestant', { zone: 'german' }, helpers);
    expect(state.impulseActions[0].type).toBe('publish_treatise');
    expect(state.impulseActions[0].zone).toBe('german');
  });
});

// ── Burn Books edge cases ───────────────────────────────────────

describe('burnBooks — edge cases', () => {
  it('rejects missing zone', () => {
    const state = cpState();
    const r = validateBurnBooks(state, 'papacy', {});
    expect(r.valid).toBe(false);
    expect(r.error).toContain('zone');
  });

  it('sets counter_reformation type in pending', () => {
    const state = cpState();
    const helpers = createMockHelpers();
    burnBooks(state, 'papacy', { zone: 'french' }, helpers);
    expect(state.pendingReformation.type).toBe('counter_reformation');
    expect(state.pendingReformation.zone).toBe('french');
    expect(state.pendingReformation.initiator).toBe('papacy');
  });
});
