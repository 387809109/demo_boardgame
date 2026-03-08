/**
 * Tests for reformer helpers
 */

import { describe, it, expect } from 'vitest';
import {
  placeReformer, removeReformer,
  getReformerInSpace, getReformerLocation,
  getAdjacentReformers, getReformerDiceBonus
} from './reformer-helpers.js';
import { createTestState } from '../test-helpers.js';

function reformerState(overrides = {}) {
  return createTestState(overrides);
}

describe('Reformer Helpers', () => {
  describe('placeReformer', () => {
    it('places a reformer on a space', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Wittenberg');
      expect(state.spaces['Wittenberg'].reformer).toBe('luther');
    });

    it('moves reformer from old space to new space', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Wittenberg');
      placeReformer(state, 'luther', 'Erfurt');
      expect(state.spaces['Wittenberg'].reformer).toBeNull();
      expect(state.spaces['Erfurt'].reformer).toBe('luther');
    });

    it('handles placing on non-existent space gracefully', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Nonexistent');
      // Should not throw
      expect(getReformerLocation(state, 'luther')).toBeNull();
    });
  });

  describe('removeReformer', () => {
    it('removes a reformer from map', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Wittenberg');
      removeReformer(state, 'luther');
      expect(state.spaces['Wittenberg'].reformer).toBeNull();
    });

    it('handles removing non-placed reformer gracefully', () => {
      const state = reformerState();
      removeReformer(state, 'luther'); // No-op
      expect(getReformerLocation(state, 'luther')).toBeNull();
    });
  });

  describe('getReformerInSpace', () => {
    it('returns reformer ID when present', () => {
      const state = reformerState();
      placeReformer(state, 'zwingli', 'Geneva');
      expect(getReformerInSpace(state, 'Geneva')).toBe('zwingli');
    });

    it('returns null when no reformer', () => {
      const state = reformerState();
      expect(getReformerInSpace(state, 'Wittenberg')).toBeNull();
    });
  });

  describe('getReformerLocation', () => {
    it('returns space name for placed reformer', () => {
      const state = reformerState();
      placeReformer(state, 'calvin', 'Geneva');
      expect(getReformerLocation(state, 'calvin')).toBe('Geneva');
    });

    it('returns null for unplaced reformer', () => {
      const state = reformerState();
      expect(getReformerLocation(state, 'calvin')).toBeNull();
    });
  });

  describe('getAdjacentReformers', () => {
    it('returns reformers in adjacent spaces', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Wittenberg');

      // Luther is IN Wittenberg, not adjacent to it
      const adj = getAdjacentReformers(state, 'Wittenberg');
      expect(adj).toHaveLength(0);

      // Leipzig is adjacent to Wittenberg
      placeReformer(state, 'bucer', 'Leipzig');
      const adjFromWitt = getAdjacentReformers(state, 'Wittenberg');
      expect(adjFromWitt).toContain('bucer');
    });

    it('returns empty array when no adjacent reformers', () => {
      const state = reformerState();
      const adj = getAdjacentReformers(state, 'Istanbul');
      expect(adj).toHaveLength(0);
    });
  });

  describe('getReformerDiceBonus', () => {
    it('returns +2 for reformer in target space', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Wittenberg');
      const bonus = getReformerDiceBonus(state, 'Wittenberg');
      expect(bonus.inSpaceBonus).toBe(2);
      expect(bonus.total).toBe(2);
    });

    it('returns +1 per adjacent reformer', () => {
      const state = reformerState();
      placeReformer(state, 'bucer', 'Leipzig');
      const bonus = getReformerDiceBonus(state, 'Wittenberg');
      expect(bonus.adjacentBonus).toBe(1);
    });

    it('combines in-space and adjacent bonuses', () => {
      const state = reformerState();
      placeReformer(state, 'luther', 'Wittenberg');
      placeReformer(state, 'bucer', 'Leipzig');
      const bonus = getReformerDiceBonus(state, 'Wittenberg');
      expect(bonus.inSpaceBonus).toBe(2);
      expect(bonus.adjacentBonus).toBe(1);
      expect(bonus.total).toBe(3);
    });

    it('returns zero when no reformers nearby', () => {
      const state = reformerState();
      const bonus = getReformerDiceBonus(state, 'Istanbul');
      expect(bonus.total).toBe(0);
    });
  });
});
