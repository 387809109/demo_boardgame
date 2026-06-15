import { describe, it, expect } from 'vitest';
import { displayTurnNumber } from './turn-display.js';

describe('displayTurnNumber', () => {
  it('prefers state.turn when present (HIS: turnNumber is an impulse counter)', () => {
    // UI-1 regression: HIS turn=2 while turnNumber has climbed with each action.
    expect(displayTurnNumber({ turn: 2, turnNumber: 11 })).toBe(2);
  });

  it('falls back to turnNumber when turn is absent (UNO / Werewolf)', () => {
    expect(displayTurnNumber({ turnNumber: 5 })).toBe(5);
  });

  it('respects turn 0 (does not treat it as missing)', () => {
    expect(displayTurnNumber({ turn: 0, turnNumber: 9 })).toBe(0);
  });

  it('defaults to 1 when nothing is set or state is nullish', () => {
    expect(displayTurnNumber({})).toBe(1);
    expect(displayTurnNumber(null)).toBe(1);
    expect(displayTurnNumber(undefined)).toBe(1);
  });
});
