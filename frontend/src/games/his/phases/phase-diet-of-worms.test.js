/**
 * Here I Stand — phase-diet-of-worms.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createStateAfterDraw, createMockHelpers } from '../test-helpers.js';
import {
  initDietOfWorms, validateDietCard, submitDietCard,
  isDietComplete, needsDietCard
} from './phase-diet-of-worms.js';
import { RELIGION } from '../constants.js';

function setupDiet() {
  const state = createStateAfterDraw();
  const helpers = createMockHelpers();
  initDietOfWorms(state, helpers);
  return { state, helpers };
}

describe('initDietOfWorms', () => {
  it('creates pending state', () => {
    const { state } = setupDiet();
    expect(state.pendingDietOfWorms).toBeDefined();
    expect(state.pendingDietOfWorms.cards).toEqual({});
  });
});

describe('validateDietCard', () => {
  it('rejects non-participating powers', () => {
    const { state } = setupDiet();
    const r = validateDietCard(state, 'ottoman', 99);
    expect(r.valid).toBe(false);
  });

  it('rejects card not in hand', () => {
    const { state } = setupDiet();
    const r = validateDietCard(state, 'protestant', 999);
    expect(r.valid).toBe(false);
  });

  it('accepts valid card from hand', () => {
    const { state } = setupDiet();
    const card = state.hands.protestant[0];
    const r = validateDietCard(state, 'protestant', card);
    expect(r.valid).toBe(true);
  });

  it('rejects duplicate submission', () => {
    const { state, helpers } = setupDiet();
    const card = state.hands.protestant[0];
    submitDietCard(state, 'protestant', card, helpers);
    // Try to submit again
    const card2 = state.hands.protestant[0];
    if (card2) {
      const r = validateDietCard(state, 'protestant', card2);
      expect(r.valid).toBe(false);
    }
  });
});

describe('submitDietCard', () => {
  it('removes card from hand', () => {
    const { state, helpers } = setupDiet();
    const card = state.hands.protestant[0];
    const handBefore = state.hands.protestant.length;
    submitDietCard(state, 'protestant', card, helpers);
    expect(state.hands.protestant.length).toBe(handBefore - 1);
    expect(state.hands.protestant).not.toContain(card);
  });

  it('does not resolve until all 3 submit', () => {
    const { state, helpers } = setupDiet();
    const r1 = submitDietCard(state, 'protestant', state.hands.protestant[0], helpers);
    expect(r1.resolved).toBe(false);

    const r2 = submitDietCard(state, 'hapsburg', state.hands.hapsburg[0], helpers);
    expect(r2.resolved).toBe(false);

    expect(isDietComplete(state)).toBe(false);
  });

  it('resolves when all 3 submit', () => {
    const { state, helpers } = setupDiet();
    submitDietCard(state, 'protestant', state.hands.protestant[0], helpers);
    submitDietCard(state, 'hapsburg', state.hands.hapsburg[0], helpers);
    const r = submitDietCard(state, 'papacy', state.hands.papacy[0], helpers);

    expect(r.resolved).toBe(true);
    expect(r.result).toHaveProperty('protestantHits');
    expect(r.result).toHaveProperty('catholicHits');
    expect(isDietComplete(state)).toBe(true);
  });

  it('logs resolution event', () => {
    const { state, helpers } = setupDiet();
    submitDietCard(state, 'protestant', state.hands.protestant[0], helpers);
    submitDietCard(state, 'hapsburg', state.hands.hapsburg[0], helpers);
    submitDietCard(state, 'papacy', state.hands.papacy[0], helpers);

    const log = state.eventLog.find(e => e.type === 'diet_of_worms_resolved');
    expect(log).toBeDefined();
    expect(log.data.winner).toMatch(/^(protestant|catholic|draw)$/);
  });
});

describe('resolution effects', () => {
  it('flips spaces in German zone on protestant victory (probabilistic)', () => {
    let protWins = 0;
    let totalFlipped = 0;

    for (let i = 0; i < 30; i++) {
      const { state, helpers } = setupDiet();
      submitDietCard(state, 'protestant', state.hands.protestant[0], helpers);
      submitDietCard(state, 'hapsburg', state.hands.hapsburg[0], helpers);
      const r = submitDietCard(state, 'papacy', state.hands.papacy[0], helpers);

      if (r.result.protestantHits > r.result.catholicHits) {
        protWins++;
        totalFlipped += r.result.spacesFlipped.length;
        // All flipped spaces should be German zone
        for (const name of r.result.spacesFlipped) {
          expect(state.spaces[name].languageZone).toBe('german');
        }
      }
    }
    // Protestant has CP+4 dice, should win sometimes
    expect(protWins).toBeGreaterThan(0);
  });

  it('sets dietOfWormsResolved flag', () => {
    const { state, helpers } = setupDiet();
    submitDietCard(state, 'protestant', state.hands.protestant[0], helpers);
    submitDietCard(state, 'hapsburg', state.hands.hapsburg[0], helpers);
    submitDietCard(state, 'papacy', state.hands.papacy[0], helpers);
    expect(state.dietOfWormsResolved).toBe(true);
  });
});

describe('needsDietCard', () => {
  it('true for participating powers that have not submitted', () => {
    const { state } = setupDiet();
    expect(needsDietCard(state, 'protestant')).toBe(true);
    expect(needsDietCard(state, 'hapsburg')).toBe(true);
    expect(needsDietCard(state, 'papacy')).toBe(true);
  });

  it('false for non-participating powers', () => {
    const { state } = setupDiet();
    expect(needsDietCard(state, 'ottoman')).toBe(false);
    expect(needsDietCard(state, 'france')).toBe(false);
    expect(needsDietCard(state, 'england')).toBe(false);
  });

  it('false after submitting', () => {
    const { state, helpers } = setupDiet();
    submitDietCard(state, 'protestant', state.hands.protestant[0], helpers);
    expect(needsDietCard(state, 'protestant')).toBe(false);
  });
});
