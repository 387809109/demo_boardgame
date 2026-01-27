import { describe, it, expect } from 'vitest';
import { UnoUI } from './ui.js';
import { CARD_TYPES } from './rules.js';

function createCard(type, color = null, value = null, id = null) {
  return {
    id: id || `test-${type}-${color}-${value}-${Math.random()}`,
    type,
    color,
    value
  };
}

describe('UnoUI _isCardPlayable', () => {
  it('allows +4 on +2 when drawPending and stacking enabled', () => {
    const ui = new UnoUI();
    ui.state = {
      drawPending: 2,
      currentColor: 'yellow',
      options: { stackDrawCards: true }
    };

    const topCard = createCard(CARD_TYPES.DRAW_TWO, 'yellow', null, 'top-draw2');
    const wild4 = createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'wild4');

    expect(ui._isCardPlayable(wild4, true, topCard)).toBe(true);
  });

  it('blocks stacking when drawPending and stacking disabled', () => {
    const ui = new UnoUI();
    ui.state = {
      drawPending: 2,
      currentColor: 'yellow',
      options: { stackDrawCards: false }
    };

    const topCard = createCard(CARD_TYPES.DRAW_TWO, 'yellow', null, 'top-draw2');
    const wild4 = createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'wild4');

    expect(ui._isCardPlayable(wild4, true, topCard)).toBe(false);
  });

  it('only allows +4 on +4 when drawPending from +4', () => {
    const ui = new UnoUI();
    ui.state = {
      drawPending: 4,
      currentColor: 'blue',
      options: { stackDrawCards: true }
    };

    const topCard = createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'top-wild4');
    const wild4 = createCard(CARD_TYPES.WILD_DRAW_FOUR, null, null, 'wild4');
    const draw2 = createCard(CARD_TYPES.DRAW_TWO, 'red', null, 'draw2');

    expect(ui._isCardPlayable(wild4, true, topCard)).toBe(true);
    expect(ui._isCardPlayable(draw2, true, topCard)).toBe(false);
  });
});
