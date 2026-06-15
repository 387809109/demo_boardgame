/**
 * Tests for the seedable deck RNG and reproducible card draws.
 */

import { describe, it, expect } from 'vitest';
import { seedRng, rng } from './rng.js';
import { buildInitialState } from './state-init.js';
import { executeCardDraw } from '../phases/phase-card-draw.js';
import { TEST_PLAYERS, createMockHelpers } from '../test-helpers.js';

describe('seedable RNG', () => {
  it('same seed reproduces the same sequence', () => {
    seedRng(12345);
    const a = [rng(), rng(), rng(), rng(), rng()];
    seedRng(12345);
    const b = [rng(), rng(), rng(), rng(), rng()];
    expect(a).toEqual(b);
  });

  it('different seeds produce different sequences', () => {
    seedRng(1);
    const a = [rng(), rng(), rng()];
    seedRng(2);
    const b = [rng(), rng(), rng()];
    expect(a).not.toEqual(b);
  });

  it('values are in [0, 1)', () => {
    seedRng(99);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seedRng(null) restores Math.random (non-throwing)', () => {
    seedRng(null);
    const v = rng();
    expect(typeof v).toBe('number');
  });
});

describe('reproducible card draws via options.rngSeed', () => {
  function drawHands(seed) {
    const state = buildInitialState(TEST_PLAYERS, { rngSeed: seed });
    executeCardDraw(state, createMockHelpers());
    return state.hands;
  }

  it('same rngSeed → identical dealt hands', () => {
    expect(drawHands(777)).toEqual(drawHands(777));
  });

  it('different rngSeed → different dealt hands', () => {
    // Extremely unlikely to collide across the whole 6-power deal.
    expect(drawHands(777)).not.toEqual(drawHands(778));
  });

  it('stores the seed on state for reference', () => {
    const state = buildInitialState(TEST_PLAYERS, { rngSeed: 42 });
    expect(state.rngSeed).toBe(42);
  });
});
