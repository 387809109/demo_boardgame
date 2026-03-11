import { describe, it, expect } from 'vitest';
import { UnoUI } from './ui.js';
import { CARD_TYPES } from './rules.js';

describe('UnoUI stack draw interaction', () => {
  it('allows +2/+4 stacking cards to be clicked when drawPending > 0 and stacking enabled', () => {
    const ui = new UnoUI();
    const topCard = { id: 'top', type: CARD_TYPES.DRAW_TWO, color: 'red', value: null };
    ui.state = {
      drawPending: 2,
      currentColor: 'red',
      options: { stackDrawCards: true }
    };

    expect(
      ui._isCardPlayable(
        { id: 'draw-two', type: CARD_TYPES.DRAW_TWO, color: 'blue', value: null },
        true,
        topCard
      )
    ).toBe(true);
    expect(
      ui._isCardPlayable(
        { id: 'wild-four', type: CARD_TYPES.WILD_DRAW_FOUR, color: null, value: null },
        true,
        topCard
      )
    ).toBe(true);
    expect(
      ui._isCardPlayable(
        { id: 'skip', type: CARD_TYPES.SKIP, color: 'red', value: null },
        true,
        topCard
      )
    ).toBe(false);
  });

  it('disables all cards when drawPending > 0 and stacking is disabled', () => {
    const ui = new UnoUI();
    const topCard = { id: 'top', type: CARD_TYPES.DRAW_TWO, color: 'red', value: null };
    ui.state = {
      drawPending: 2,
      currentColor: 'red',
      options: { stackDrawCards: false }
    };

    expect(
      ui._isCardPlayable(
        { id: 'draw-two', type: CARD_TYPES.DRAW_TWO, color: 'blue', value: null },
        true,
        topCard
      )
    ).toBe(false);
    expect(
      ui._isCardPlayable(
        { id: 'wild-four', type: CARD_TYPES.WILD_DRAW_FOUR, color: null, value: null },
        true,
        topCard
      )
    ).toBe(false);
  });
});
