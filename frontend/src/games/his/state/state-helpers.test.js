/**
 * Here I Stand — state-helpers.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getPowerForPlayer, getPlayerForPower,
  countKeysForPower, countElectoratesForPower,
  getActiveRuler, getCardDrawCount, getKeyVp,
  canPass, getNextImpulsePower, isCardInPlay
} from './state-helpers.js';
import { MAJOR_POWERS, IMPULSE_ORDER } from '../constants.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { createTestState, createStateAfterDraw } from '../test-helpers.js';

describe('getPowerForPlayer', () => {
  const state = createTestState();

  it('returns correct power for player', () => {
    expect(getPowerForPlayer(state, 'p1')).toBe('ottoman');
    expect(getPowerForPlayer(state, 'p6')).toBe('protestant');
  });

  it('returns null for unknown player', () => {
    expect(getPowerForPlayer(state, 'unknown')).toBeNull();
  });
});

describe('getPlayerForPower', () => {
  const state = createTestState();

  it('returns correct player for power', () => {
    expect(getPlayerForPower(state, 'ottoman')).toBe('p1');
    expect(getPlayerForPower(state, 'protestant')).toBe('p6');
  });

  it('returns null for unknown power', () => {
    expect(getPlayerForPower(state, 'unknown')).toBeNull();
  });

  it('is consistent with getPowerForPlayer', () => {
    for (const power of MAJOR_POWERS) {
      const pid = getPlayerForPower(state, power);
      expect(getPowerForPlayer(state, pid)).toBe(power);
    }
  });
});

describe('countKeysForPower', () => {
  it('counts initial Ottoman keys', () => {
    const state = createTestState();
    const keys = countKeysForPower(state, 'ottoman');
    expect(keys).toBeGreaterThan(0);
  });

  it('returns 0 for power with no keys', () => {
    const state = createTestState();
    // Remove all ottoman control
    for (const sp of Object.values(state.spaces)) {
      if (sp.controller === 'ottoman') sp.controller = 'neutral';
    }
    expect(countKeysForPower(state, 'ottoman')).toBe(0);
  });

  it('changes when control changes', () => {
    const state = createTestState();
    const before = countKeysForPower(state, 'ottoman');
    // Give ottoman a hapsburg key
    const hapsburgKey = Object.entries(state.spaces)
      .find(([, sp]) => sp.isKey && sp.controller === 'hapsburg');
    if (hapsburgKey) {
      state.spaces[hapsburgKey[0]].controller = 'ottoman';
      expect(countKeysForPower(state, 'ottoman')).toBe(before + 1);
    }
  });
});

describe('countElectoratesForPower', () => {
  it('counts Protestant electorates', () => {
    const state = createTestState();
    const count = countElectoratesForPower(state, 'protestant');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('changes when control changes', () => {
    const state = createTestState();
    const before = countElectoratesForPower(state, 'protestant');
    // Find an electorate controlled by protestant
    const electorate = Object.entries(state.spaces)
      .find(([, sp]) => sp.isElectorate && sp.controller === 'protestant');
    if (electorate) {
      state.spaces[electorate[0]].controller = 'hapsburg';
      expect(countElectoratesForPower(state, 'protestant')).toBe(before - 1);
    }
  });
});

describe('getActiveRuler', () => {
  const state = createTestState();

  it('returns Ottoman ruler (suleiman)', () => {
    const ruler = getActiveRuler(state, 'ottoman');
    expect(ruler.id).toBe('suleiman');
  });

  it('ruler has cardBonus property', () => {
    const ruler = getActiveRuler(state, 'ottoman');
    expect(ruler).toHaveProperty('cardBonus');
    expect(typeof ruler.cardBonus).toBe('number');
  });

  it('ruler has admin property', () => {
    const ruler = getActiveRuler(state, 'ottoman');
    expect(ruler).toHaveProperty('admin');
    expect(typeof ruler.admin).toBe('number');
  });

  it('returns ruler for all powers', () => {
    for (const power of MAJOR_POWERS) {
      const ruler = getActiveRuler(state, power);
      expect(ruler).toBeDefined();
      expect(ruler.id).toBeTruthy();
    }
  });
});

describe('getCardDrawCount', () => {
  const state = createTestState();

  it('returns positive draw count for all powers', () => {
    for (const power of MAJOR_POWERS) {
      expect(getCardDrawCount(state, power)).toBeGreaterThan(0);
    }
  });

  it('Protestant uses special draw rule', () => {
    const count = getCardDrawCount(state, 'protestant');
    // Protestant draws 4 or 5 base + ruler bonus
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('changes with key count', () => {
    const s = createTestState();
    const before = getCardDrawCount(s, 'ottoman');
    // Remove all ottoman keys
    for (const sp of Object.values(s.spaces)) {
      if (sp.controller === 'ottoman') sp.controller = 'neutral';
    }
    const after = getCardDrawCount(s, 'ottoman');
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe('getKeyVp', () => {
  const state = createTestState();

  it('returns VP for ottoman', () => {
    const vp = getKeyVp(state, 'ottoman');
    expect(typeof vp).toBe('number');
  });

  it('returns 0 for protestant (uses spaces track)', () => {
    expect(getKeyVp(state, 'protestant')).toBe(0);
  });
});

describe('canPass', () => {
  it('cannot pass with home card in hand', () => {
    const state = createStateAfterDraw();
    // After draw, ottoman has home card #1
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('home card');
  });

  it('can pass after home/mandatory cards removed and hand trimmed', () => {
    const state = createStateAfterDraw();
    const ruler = getActiveRuler(state, 'ottoman');
    // Remove home and mandatory cards, then trim to admin size
    state.hands.ottoman = state.hands.ottoman
      .filter(c => {
        const card = CARD_BY_NUMBER[c];
        return card && card.deck !== 'home' && card.category !== 'MANDATORY';
      })
      .slice(0, ruler.admin);
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(true);
  });

  it('returns reason string when not allowed', () => {
    const state = createStateAfterDraw();
    const result = canPass(state, 'ottoman');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('allowed when hand is empty', () => {
    const state = createTestState();
    // Empty hand, no home card
    state.hands.ottoman = [];
    const result = canPass(state, 'ottoman');
    expect(result.allowed).toBe(true);
  });
});

describe('getNextImpulsePower', () => {
  it('cycles through IMPULSE_ORDER', () => {
    const state = createTestState();
    for (let i = 0; i < 6; i++) {
      state.impulseIndex = i;
      const next = getNextImpulsePower(state);
      expect(next).toBe(IMPULSE_ORDER[(i + 1) % 6]);
    }
  });
});

describe('isCardInPlay', () => {
  it('finds card in deck', () => {
    const state = createTestState();
    if (state.deck.length > 0) {
      expect(isCardInPlay(state, state.deck[0])).toBe(true);
    }
  });

  it('finds card in hand', () => {
    const state = createStateAfterDraw();
    const card = state.hands.ottoman[0];
    expect(isCardInPlay(state, card)).toBe(true);
  });

  it('finds card in discard', () => {
    const state = createTestState();
    state.discard.push(999);
    expect(isCardInPlay(state, 999)).toBe(true);
  });

  it('finds card in removedCards', () => {
    const state = createTestState();
    state.removedCards.push(888);
    expect(isCardInPlay(state, 888)).toBe(true);
  });

  it('returns false for missing card', () => {
    const state = createTestState();
    expect(isCardInPlay(state, 9999)).toBe(false);
  });
});
