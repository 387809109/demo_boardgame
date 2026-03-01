/**
 * Here I Stand — state-visible.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { getVisibleState } from './state-visible.js';
import { MAJOR_POWERS } from '../constants.js';
import { createStateAfterDraw } from '../test-helpers.js';

describe('getVisibleState', () => {
  const fullState = createStateAfterDraw();

  it('shows own hand as array', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(Array.isArray(visible.hands.ottoman)).toBe(true);
  });

  it('shows other hands as numbers', () => {
    const visible = getVisibleState(fullState, 'p1');
    for (const power of MAJOR_POWERS) {
      if (power === 'ottoman') continue;
      expect(typeof visible.hands[power]).toBe('number');
    }
  });

  it('other hand counts match original lengths', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(visible.hands.hapsburg).toBe(fullState.hands.hapsburg.length);
  });

  it('deck is a number (count)', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(typeof visible.deck).toBe('number');
    expect(visible.deck).toBe(fullState.deck.length);
  });

  it('discard is a number (count)', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(typeof visible.discard).toBe('number');
  });

  it('does not mutate original state', () => {
    const deckBefore = [...fullState.deck];
    const handBefore = [...fullState.hands.ottoman];
    getVisibleState(fullState, 'p1');
    expect(fullState.deck).toEqual(deckBefore);
    expect(fullState.hands.ottoman).toEqual(handBefore);
  });

  it('unknown player sees all hands as numbers', () => {
    const visible = getVisibleState(fullState, 'spectator');
    for (const power of MAJOR_POWERS) {
      expect(typeof visible.hands[power]).toBe('number');
    }
  });

  it('preserves public information', () => {
    const visible = getVisibleState(fullState, 'p1');
    expect(visible.vp).toEqual(fullState.vp);
    expect(visible.turn).toBe(fullState.turn);
    expect(visible.phase).toBe(fullState.phase);
    expect(Object.keys(visible.spaces)).toHaveLength(
      Object.keys(fullState.spaces).length
    );
  });

  it('each player sees their own hand', () => {
    for (let i = 0; i < 6; i++) {
      const pid = `p${i + 1}`;
      const power = MAJOR_POWERS[i];
      const visible = getVisibleState(fullState, pid);
      expect(Array.isArray(visible.hands[power])).toBe(true);
    }
  });
});
