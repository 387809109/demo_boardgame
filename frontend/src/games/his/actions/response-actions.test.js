/**
 * Here I Stand — response-actions.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getValidCombatCards,
  canAnyPowerRespondCombat,
  createCombatCardWindow,
  handlePlayResponseCard,
  handleDeclineResponse,
  getNextCombatWindow,
  getValidMercenaryCards,
  canAnyPowerRespondMercenary,
  createMercenaryWindow,
  advanceMercenaryWindow,
  getValidPostRollCards,
  canAnyPowerRespondPostRoll,
  createPostRollWindow,
  getNextPostRollWindow,
  getValidInterruptCards,
  canAnyPowerInterrupt,
  createInterruptWindow,
  advanceInterruptWindow
} from './response-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Create a state with specific cards in a power's hand and
 * set up pendingResponse context for combat card checks.
 */
function stateWithHand(power, cards, opts = {}) {
  const state = createTestState();
  state.hands[power] = [...cards];
  if (opts.context) {
    state.pendingResponse = {
      context: opts.context,
      respondingPower: opts.respondingPower || power,
      validCards: opts.validCards || cards,
      window: opts.window || 'W2',
      responses: opts.responses || {},
      battleState: opts.battleState || {}
    };
  }
  return state;
}

// ── getValidCombatCards ──────────────────────────────────────────

describe('getValidCombatCards', () => {
  it('returns empty when hand has no combat cards', () => {
    const state = stateWithHand('hapsburg', [39, 40, 41], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    const result = getValidCombatCards(state, 'hapsburg', 'field', 'attacker');
    expect(result).toEqual([]);
  });

  it('returns Arquebusiers (#24) for field battle', () => {
    const state = stateWithHand('hapsburg', [24, 39], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    const result = getValidCombatCards(
      state, 'hapsburg', 'field', 'attacker'
    );
    expect(result).toContain(24);
  });

  it('returns Arquebusiers (#24) for naval battle', () => {
    const state = stateWithHand('france', [24], {
      context: {
        type: 'naval',
        attackerPower: 'france',
        defenderPower: 'hapsburg'
      }
    });
    const result = getValidCombatCards(
      state, 'france', 'naval', 'attacker'
    );
    expect(result).toContain(24);
  });

  it('excludes Arquebusiers (#24) for assault', () => {
    const state = stateWithHand('hapsburg', [24], {
      context: {
        type: 'assault',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    const result = getValidCombatCards(
      state, 'hapsburg', 'assault', 'attacker'
    );
    expect(result).not.toContain(24);
  });

  it('Field Artillery (#25) only in field battles', () => {
    const state = stateWithHand('france', [25], {
      context: {
        type: 'field',
        attackerPower: 'france',
        defenderPower: 'hapsburg'
      }
    });
    expect(getValidCombatCards(
      state, 'france', 'field', 'attacker'
    )).toContain(25);

    state.pendingResponse.context.type = 'naval';
    expect(getValidCombatCards(
      state, 'france', 'naval', 'attacker'
    )).not.toContain(25);
  });

  it('Mercenaries Bribed (#26) not playable by Ottoman', () => {
    const state = stateWithHand('ottoman', [26], {
      context: {
        type: 'field',
        attackerPower: 'ottoman',
        defenderPower: 'hapsburg'
      }
    });
    const result = getValidCombatCards(
      state, 'ottoman', 'field', 'attacker'
    );
    expect(result).not.toContain(26);
  });

  it('Mercenaries Bribed (#26) not playable against Ottoman', () => {
    const state = stateWithHand('hapsburg', [26], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'ottoman'
      }
    });
    const result = getValidCombatCards(
      state, 'hapsburg', 'field', 'attacker'
    );
    expect(result).not.toContain(26);
  });

  it('Mercenaries Bribed (#26) playable in non-Ottoman field battle', () => {
    const state = stateWithHand('france', [26], {
      context: {
        type: 'field',
        attackerPower: 'france',
        defenderPower: 'hapsburg'
      }
    });
    const result = getValidCombatCards(
      state, 'france', 'field', 'attacker'
    );
    expect(result).toContain(26);
  });

  it('Mercenaries Grow Restless (#27) assault defender only', () => {
    const state = stateWithHand('france', [27], {
      context: {
        type: 'assault',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    // Defender can play it
    expect(getValidCombatCards(
      state, 'france', 'assault', 'defender'
    )).toContain(27);

    // Attacker cannot
    state.hands['hapsburg'] = [27];
    expect(getValidCombatCards(
      state, 'hapsburg', 'assault', 'attacker'
    )).not.toContain(27);

    // Not in field battle
    expect(getValidCombatCards(
      state, 'france', 'field', 'defender'
    )).not.toContain(27);
  });

  it('Siege Mining (#28) assault attacker only', () => {
    const state = stateWithHand('hapsburg', [28], {
      context: {
        type: 'assault',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    // Attacker can play it
    expect(getValidCombatCards(
      state, 'hapsburg', 'assault', 'attacker'
    )).toContain(28);

    // Defender cannot
    state.hands['france'] = [28];
    expect(getValidCombatCards(
      state, 'france', 'assault', 'defender'
    )).not.toContain(28);
  });

  it('Surprise Attack (#29) field only', () => {
    const state = stateWithHand('hapsburg', [29], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    expect(getValidCombatCards(
      state, 'hapsburg', 'field', 'attacker'
    )).toContain(29);

    expect(getValidCombatCards(
      state, 'hapsburg', 'naval', 'attacker'
    )).not.toContain(29);
  });

  it('Tercios (#30) field only', () => {
    const state = stateWithHand('hapsburg', [30], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    expect(getValidCombatCards(
      state, 'hapsburg', 'field', 'attacker'
    )).toContain(30);

    expect(getValidCombatCards(
      state, 'hapsburg', 'assault', 'attacker'
    )).not.toContain(30);
  });

  it('returns multiple valid cards', () => {
    const state = stateWithHand('hapsburg', [24, 25, 29, 30], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    const result = getValidCombatCards(
      state, 'hapsburg', 'field', 'attacker'
    );
    expect(result).toEqual([24, 25, 29, 30]);
  });

  it('returns empty when hand is empty', () => {
    const state = stateWithHand('hapsburg', [], {
      context: {
        type: 'field',
        attackerPower: 'hapsburg',
        defenderPower: 'france'
      }
    });
    const result = getValidCombatCards(
      state, 'hapsburg', 'field', 'attacker'
    );
    expect(result).toEqual([]);
  });
});

// ── canAnyPowerRespondCombat ─────────────────────────────────────

describe('canAnyPowerRespondCombat', () => {
  it('both can respond when both have combat cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [24, 39];
    state.hands['france'] = [25, 40];
    const result = canAnyPowerRespondCombat(
      state, 'field', 'hapsburg', 'france'
    );
    expect(result.attackerCanRespond).toBe(true);
    expect(result.defenderCanRespond).toBe(true);
  });

  it('neither can respond when no combat cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [39, 40];
    state.hands['france'] = [41, 42];
    const result = canAnyPowerRespondCombat(
      state, 'field', 'hapsburg', 'france'
    );
    expect(result.attackerCanRespond).toBe(false);
    expect(result.defenderCanRespond).toBe(false);
  });

  it('only attacker can respond', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [28];
    state.hands['france'] = [39];
    const result = canAnyPowerRespondCombat(
      state, 'assault', 'hapsburg', 'france'
    );
    expect(result.attackerCanRespond).toBe(true);
    expect(result.defenderCanRespond).toBe(false);
  });

  it('only defender can respond (assault with #27)', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [39];
    state.hands['france'] = [27];
    const result = canAnyPowerRespondCombat(
      state, 'assault', 'hapsburg', 'france'
    );
    expect(result.attackerCanRespond).toBe(false);
    expect(result.defenderCanRespond).toBe(true);
  });

  it('restores pendingResponse after check', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [24];
    state.hands['france'] = [25];
    state.pendingResponse = null;
    canAnyPowerRespondCombat(state, 'field', 'hapsburg', 'france');
    expect(state.pendingResponse).toBeNull();
  });
});

// ── createCombatCardWindow ───────────────────────────────────────

describe('createCombatCardWindow', () => {
  it('creates W2 window for attacker', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [24, 25];
    const created = createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(created).toBe(true);
    expect(state.pendingResponse).not.toBeNull();
    expect(state.pendingResponse.window).toBe('W2');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.validCards).toContain(24);
    expect(state.pendingResponse.validCards).toContain(25);
    expect(state.pendingResponse.context.space).toBe('Paris');
    expect(state.pendingResponse.context.type).toBe('field');
  });

  it('creates W3 window for defender', () => {
    const state = createTestState();
    state.hands['france'] = [24, 29];
    const created = createCombatCardWindow(
      state, 'W3', 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(created).toBe(true);
    expect(state.pendingResponse.window).toBe('W3');
    expect(state.pendingResponse.respondingPower).toBe('france');
  });

  it('returns false when no valid cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [39, 40];
    const created = createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(created).toBe(false);
    expect(state.pendingResponse).toBeNull();
  });

  it('preserves battleState responses', () => {
    const state = createTestState();
    state.hands['france'] = [24];
    const battleState = {
      responses: { W2: { power: 'hapsburg', cardNumber: 25 } },
      attackerDice: 5
    };
    const created = createCombatCardWindow(
      state, 'W3', 'Paris', 'hapsburg', 'france', 'field', battleState
    );
    expect(created).toBe(true);
    expect(state.pendingResponse.responses.W2).toBeDefined();
    expect(state.pendingResponse.responses.W2.cardNumber).toBe(25);
    expect(state.pendingResponse.battleState.attackerDice).toBe(5);
  });

  it('does not create assault W2 for defender-only cards', () => {
    const state = createTestState();
    // #27 is defender-only in assault
    state.hands['hapsburg'] = [27];
    const created = createCombatCardWindow(
      state, 'W2', 'Vienna', 'hapsburg', 'france', 'assault'
    );
    expect(created).toBe(false);
  });

  it('creates assault W3 for #27 (defender)', () => {
    const state = createTestState();
    state.hands['france'] = [27];
    const created = createCombatCardWindow(
      state, 'W3', 'Vienna', 'hapsburg', 'france', 'assault'
    );
    expect(created).toBe(true);
    expect(state.pendingResponse.validCards).toContain(27);
  });
});

// ── handlePlayResponseCard ───────────────────────────────────────

describe('handlePlayResponseCard', () => {
  it('plays a valid combat card', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24, 39];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    const result = handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 24 }, helpers
    );

    expect(result.success).toBe(true);
    expect(result.cardNumber).toBe(24);
    expect(result.window).toBe('W2');
    expect(state.hands['hapsburg']).not.toContain(24);
    expect(state.hands['hapsburg']).toContain(39);
    expect(state.discard).toContain(24);
    expect(state.pendingResponse).toBeNull();
  });

  it('sets pendingCombatBonus via EVENT_HANDLERS', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 24 }, helpers
    );

    // #24 Arquebusiers sets pendingCombatBonus
    expect(state.pendingCombatBonus).toBeDefined();
    expect(state.pendingCombatBonus.card).toBe(24);
    expect(state.pendingCombatBonus.dice).toBe(2);
  });

  it('rejects when no pending response', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.pendingResponse = null;

    const result = handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 24 }, helpers
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('No pending');
  });

  it('rejects wrong power', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    const result = handlePlayResponseCard(
      state, 'france', { cardNumber: 24 }, helpers
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('france');
  });

  it('rejects card not in validCards', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24, 28];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    // #28 Siege Mining is field-invalid, but force it into hand
    // validCards should not include 28 for field battle

    const result = handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 28 }, helpers
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a valid');
  });

  it('rejects card not in hand', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    // Remove from hand after window creation
    state.hands['hapsburg'] = [];

    const result = handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 24 }, helpers
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not in hand');
  });

  it('logs play_response_card event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 24 }, helpers
    );

    const logEntry = state.eventLog.find(
      e => e.type === 'play_response_card'
    );
    expect(logEntry).toBeDefined();
    expect(logEntry.data.power).toBe('hapsburg');
    expect(logEntry.data.cardNumber).toBe(24);
    expect(logEntry.data.window).toBe('W2');
  });

  it('records response in returned responses', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [25];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    const result = handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 25 }, helpers
    );
    expect(result.responses.W2).toBeDefined();
    expect(result.responses.W2.cardNumber).toBe(25);
    expect(result.responses.W2.power).toBe('hapsburg');
  });

  it('removes card with removeAfterPlay to removedCards', () => {
    // We need a combat card with removeAfterPlay = true.
    // None of #24-30 have removeAfterPlay. Let's verify the normal
    // path (removeAfterPlay=false) goes to discard.
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 24 }, helpers
    );

    expect(state.discard).toContain(24);
    expect(state.removedCards).not.toContain(24);
  });
});

// ── handleDeclineResponse ────────────────────────────────────────

describe('handleDeclineResponse', () => {
  it('declines successfully', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    const result = handleDeclineResponse(state, 'hapsburg', helpers);

    expect(result.success).toBe(true);
    expect(result.window).toBe('W2');
    expect(state.pendingResponse).toBeNull();
    // Card stays in hand
    expect(state.hands['hapsburg']).toContain(24);
  });

  it('rejects when no pending response', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.pendingResponse = null;

    const result = handleDeclineResponse(state, 'hapsburg', helpers);
    expect(result.success).toBe(false);
  });

  it('rejects wrong power', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    const result = handleDeclineResponse(state, 'france', helpers);
    expect(result.success).toBe(false);
    expect(result.error).toContain('france');
  });

  it('logs decline_response event', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );

    handleDeclineResponse(state, 'hapsburg', helpers);

    const logEntry = state.eventLog.find(
      e => e.type === 'decline_response'
    );
    expect(logEntry).toBeDefined();
    expect(logEntry.data.power).toBe('hapsburg');
    expect(logEntry.data.window).toBe('W2');
  });
});

// ── getNextCombatWindow ──────────────────────────────────────────

describe('getNextCombatWindow', () => {
  it('returns W3 after W2 when defender has cards', () => {
    const state = createTestState();
    state.hands['france'] = [24];
    const next = getNextCombatWindow(
      'W2', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBe('W3');
  });

  it('returns null after W2 when defender has no cards', () => {
    const state = createTestState();
    state.hands['france'] = [39, 40];
    const next = getNextCombatWindow(
      'W2', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBeNull();
  });

  it('returns null after W3 (proceed to dice)', () => {
    const state = createTestState();
    const next = getNextCombatWindow(
      'W3', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBeNull();
  });

  it('returns W3 for assault when defender has #27', () => {
    const state = createTestState();
    state.hands['france'] = [27];
    const next = getNextCombatWindow(
      'W2', state, 'Vienna', 'hapsburg', 'france', 'assault'
    );
    expect(next).toBe('W3');
  });

  it('returns null after W2 assault when defender lacks cards', () => {
    const state = createTestState();
    state.hands['france'] = [28]; // attacker-only card
    const next = getNextCombatWindow(
      'W2', state, 'Vienna', 'hapsburg', 'france', 'assault'
    );
    expect(next).toBeNull();
  });
});

// ── Integration: full W2 → W3 flow ──────────────────────────────

describe('full combat card flow', () => {
  it('attacker plays W2, then defender plays W3', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [25]; // Field Artillery
    state.hands['france'] = [29];   // Surprise Attack

    // W2: attacker window
    const w2Created = createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(w2Created).toBe(true);

    const w2Result = handlePlayResponseCard(
      state, 'hapsburg', { cardNumber: 25 }, helpers
    );
    expect(w2Result.success).toBe(true);

    // Check next window
    const next = getNextCombatWindow(
      'W2', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBe('W3');

    // W3: defender window
    const w3Created = createCombatCardWindow(
      state, 'W3', 'Paris', 'hapsburg', 'france', 'field',
      { responses: w2Result.responses }
    );
    expect(w3Created).toBe(true);
    expect(state.pendingResponse.respondingPower).toBe('france');

    const w3Result = handlePlayResponseCard(
      state, 'france', { cardNumber: 29 }, helpers
    );
    expect(w3Result.success).toBe(true);

    // After W3, no more windows
    const afterW3 = getNextCombatWindow(
      'W3', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(afterW3).toBeNull();
  });

  it('attacker declines W2, defender plays W3', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    state.hands['france'] = [24];

    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    handleDeclineResponse(state, 'hapsburg', helpers);

    const next = getNextCombatWindow(
      'W2', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBe('W3');

    createCombatCardWindow(
      state, 'W3', 'Paris', 'hapsburg', 'france', 'field'
    );
    const result = handlePlayResponseCard(
      state, 'france', { cardNumber: 24 }, helpers
    );
    expect(result.success).toBe(true);
  });

  it('both decline — no response cards played', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.hands['hapsburg'] = [24];
    state.hands['france'] = [25];

    createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    handleDeclineResponse(state, 'hapsburg', helpers);

    createCombatCardWindow(
      state, 'W3', 'Paris', 'hapsburg', 'france', 'field'
    );
    handleDeclineResponse(state, 'france', helpers);

    // Cards remain in hand
    expect(state.hands['hapsburg']).toContain(24);
    expect(state.hands['france']).toContain(25);
    expect(state.pendingResponse).toBeNull();
  });

  it('skip both windows when neither side has cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [39];
    state.hands['france'] = [40];

    const w2 = createCombatCardWindow(
      state, 'W2', 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(w2).toBe(false);

    const next = getNextCombatWindow(
      'W2', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBeNull();
  });
});

// ── W1 Mercenary Card Tests ──────────────────────────────────────

describe('getValidMercenaryCards', () => {
  it('returns #33 Landsknechts from hand', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [33, 50];
    const result = getValidMercenaryCards(state, 'hapsburg');
    expect(result).toEqual([33]);
  });

  it('returns #36 Swiss Mercenaries from hand', () => {
    const state = createTestState();
    state.hands['france'] = [36, 50];
    const result = getValidMercenaryCards(state, 'france');
    expect(result).toEqual([36]);
  });

  it('returns both #33 and #36 when in hand', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [33, 36, 50];
    const result = getValidMercenaryCards(state, 'hapsburg');
    expect(result).toEqual([33, 36]);
  });

  it('excludes Ottoman from #36 Swiss Mercenaries', () => {
    const state = createTestState();
    state.hands['ottoman'] = [36, 50];
    const result = getValidMercenaryCards(state, 'ottoman');
    expect(result).toEqual([]);
  });

  it('allows Ottoman to play #33 Landsknechts', () => {
    const state = createTestState();
    state.hands['ottoman'] = [33, 50];
    const result = getValidMercenaryCards(state, 'ottoman');
    expect(result).toEqual([33]);
  });

  it('returns empty when hand has no mercenary cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [39, 40, 41];
    const result = getValidMercenaryCards(state, 'hapsburg');
    expect(result).toEqual([]);
  });

  it('returns empty when hand is empty', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [];
    const result = getValidMercenaryCards(state, 'hapsburg');
    expect(result).toEqual([]);
  });

  it('returns empty when hand is undefined', () => {
    const state = createTestState();
    state.hands['hapsburg'] = undefined;
    const result = getValidMercenaryCards(state, 'hapsburg');
    expect(result).toEqual([]);
  });
});

describe('canAnyPowerRespondMercenary', () => {
  it('returns powers in impulse order', () => {
    const state = createTestState();
    // Clear all hands first
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['france'] = [33];
    state.hands['hapsburg'] = [36];
    const result = canAnyPowerRespondMercenary(state);
    // impulse order: ottoman, hapsburg, england, france, papacy, protestant
    expect(result.powers).toEqual(['hapsburg', 'france']);
  });

  it('returns empty when no one has merc cards', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    const result = canAnyPowerRespondMercenary(state);
    expect(result.powers).toEqual([]);
  });

  it('includes all powers who hold #33 or #36', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['ottoman'] = [33];
    state.hands['england'] = [36];
    state.hands['papacy'] = [33];
    const result = canAnyPowerRespondMercenary(state);
    expect(result.powers).toEqual(['ottoman', 'england', 'papacy']);
  });

  it('excludes Ottoman from #36 in powers list', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['ottoman'] = [36]; // Ottoman can't play #36
    const result = canAnyPowerRespondMercenary(state);
    expect(result.powers).toEqual([]);
  });
});

describe('createMercenaryWindow', () => {
  it('creates W1 pendingResponse with correct structure', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['hapsburg'] = [33, 50];

    const created = createMercenaryWindow(
      state, 'Paris', 'hapsburg', 'france'
    );

    expect(created).toBe(true);
    expect(state.pendingResponse).not.toBeNull();
    expect(state.pendingResponse.window).toBe('W1');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.validCards).toContain(33);
    expect(state.pendingResponse.respondingPowers).toEqual(['hapsburg']);
    expect(state.pendingResponse.currentResponderIndex).toBe(0);
    expect(state.pendingResponse.context.space).toBe('Paris');
    expect(state.pendingResponse.context.attackerPower).toBe('hapsburg');
    expect(state.pendingResponse.context.defenderPower).toBe('france');
  });

  it('returns false when no power has merc cards', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }

    const created = createMercenaryWindow(
      state, 'Paris', 'hapsburg', 'france'
    );

    expect(created).toBe(false);
  });

  it('sets first power in impulse order as responder', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['france'] = [33];
    state.hands['papacy'] = [36];

    const created = createMercenaryWindow(
      state, 'Paris', 'hapsburg', 'france'
    );

    expect(created).toBe(true);
    // france comes before papacy in impulse order
    expect(state.pendingResponse.respondingPower).toBe('france');
    expect(state.pendingResponse.respondingPowers).toEqual(
      ['france', 'papacy']
    );
  });

  it('preserves battleState', () => {
    const state = createTestState();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['hapsburg'] = [33];

    const battleState = {
      attackerCalc: { dice: 5 },
      responses: { prev: 'data' }
    };

    const created = createMercenaryWindow(
      state, 'Paris', 'hapsburg', 'france', battleState
    );

    expect(created).toBe(true);
    expect(state.pendingResponse.responses.prev).toBe('data');
    expect(state.pendingResponse.battleState.attackerCalc.dice).toBe(5);
  });
});

describe('advanceMercenaryWindow', () => {
  it('advances to next responder', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['hapsburg'] = [33];
    state.hands['france'] = [36];

    createMercenaryWindow(state, 'Paris', 'hapsburg', 'france');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');

    const next = advanceMercenaryWindow(state, helpers);
    expect(next).toBe('W1');
    expect(state.pendingResponse.respondingPower).toBe('france');
    expect(state.pendingResponse.validCards).toContain(36);
  });

  it('returns null when all have responded', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['hapsburg'] = [33];

    createMercenaryWindow(state, 'Paris', 'hapsburg', 'france');

    const next = advanceMercenaryWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('iterates through multiple responders', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['ottoman'] = [33];
    state.hands['england'] = [33];
    state.hands['papacy'] = [36];

    createMercenaryWindow(state, 'Paris', 'hapsburg', 'france');
    expect(state.pendingResponse.respondingPower).toBe('ottoman');

    let next = advanceMercenaryWindow(state, helpers);
    expect(next).toBe('W1');
    expect(state.pendingResponse.respondingPower).toBe('england');

    next = advanceMercenaryWindow(state, helpers);
    expect(next).toBe('W1');
    expect(state.pendingResponse.respondingPower).toBe('papacy');

    next = advanceMercenaryWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('returns null when no pendingResponse', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.pendingResponse = null;
    const next = advanceMercenaryWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('returns null when window is not W1', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.pendingResponse = { window: 'W2' };
    const next = advanceMercenaryWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('skips power that lost merc card after window creation', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [];
    }
    state.hands['hapsburg'] = [33];
    state.hands['france'] = [36];
    state.hands['papacy'] = [33];

    createMercenaryWindow(state, 'Paris', 'hapsburg', 'france');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');

    // Simulate france losing their card before their turn
    state.hands['france'] = [];

    const next = advanceMercenaryWindow(state, helpers);
    expect(next).toBe('W1');
    // Should skip france and go to papacy
    expect(state.pendingResponse.respondingPower).toBe('papacy');
  });
});

// ── getNextCombatWindow with W1 ─────────────────────────────────

describe('getNextCombatWindow after W1', () => {
  it('returns W2 when attacker has combat cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [24]; // combat card
    state.hands['france'] = [50];
    const next = getNextCombatWindow(
      'W1', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBe('W2');
  });

  it('returns W3 when only defender has combat cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [50];
    state.hands['france'] = [25]; // combat card
    const next = getNextCombatWindow(
      'W1', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBe('W3');
  });

  it('returns null when neither has combat cards', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [50];
    state.hands['france'] = [51];
    const next = getNextCombatWindow(
      'W1', state, 'Paris', 'hapsburg', 'france', 'field'
    );
    expect(next).toBeNull();
  });
});

// ── Post-Roll Card Tests (W4/W5/W6) ─────────────────────────────

describe('getValidPostRollCards', () => {
  it('Ottoman with #1 returns it for field battle', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1, 50];
    const result = getValidPostRollCards(state, 'ottoman', 'field');
    expect(result).toContain(1);
  });

  it('Ottoman with #1 returns empty for assault', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1, 50];
    const result = getValidPostRollCards(state, 'ottoman', 'assault');
    expect(result).toEqual([]);
  });

  it('Ottoman with #1 returns empty for naval', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1, 50];
    const result = getValidPostRollCards(state, 'ottoman', 'naval');
    expect(result).toEqual([]);
  });

  it('non-Ottoman with #1 returns empty for field', () => {
    const state = createTestState();
    state.hands['france'] = [1, 50];
    const result = getValidPostRollCards(state, 'france', 'field');
    expect(result).toEqual([]);
  });

  it('any power with #35 returns it for assault', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [35, 50];
    const result = getValidPostRollCards(state, 'hapsburg', 'assault');
    expect(result).toContain(35);
  });

  it('#35 returns empty for field', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [35, 50];
    const result = getValidPostRollCards(state, 'hapsburg', 'field');
    expect(result).toEqual([]);
  });

  it('#35 returns empty for naval', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [35, 50];
    const result = getValidPostRollCards(state, 'hapsburg', 'naval');
    expect(result).toEqual([]);
  });

  it('any power with #34 returns it for naval', () => {
    const state = createTestState();
    state.hands['france'] = [34, 50];
    const result = getValidPostRollCards(state, 'france', 'naval');
    expect(result).toContain(34);
  });

  it('#34 returns empty for field', () => {
    const state = createTestState();
    state.hands['france'] = [34, 50];
    const result = getValidPostRollCards(state, 'france', 'field');
    expect(result).toEqual([]);
  });

  it('#34 returns empty for assault', () => {
    const state = createTestState();
    state.hands['france'] = [34, 50];
    const result = getValidPostRollCards(state, 'france', 'assault');
    expect(result).toEqual([]);
  });

  it('returns empty when hand is empty', () => {
    const state = createTestState();
    state.hands['ottoman'] = [];
    const result = getValidPostRollCards(state, 'ottoman', 'field');
    expect(result).toEqual([]);
  });

  it('returns empty when hand has no post-roll cards', () => {
    const state = createTestState();
    state.hands['ottoman'] = [50, 51, 52];
    const result = getValidPostRollCards(state, 'ottoman', 'field');
    expect(result).toEqual([]);
  });
});

describe('canAnyPowerRespondPostRoll', () => {
  it('Ottoman can respond for field when holding #1', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1];
    state.hands['hapsburg'] = [50];
    const result = canAnyPowerRespondPostRoll(
      state, 'field', 'ottoman', 'hapsburg'
    );
    expect(result.canRespond).toBe(true);
    expect(result.respondingPower).toBe('ottoman');
    expect(result.windowType).toBe('W4');
  });

  it('Ottoman can respond as defender for field when holding #1', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1];
    state.hands['hapsburg'] = [50];
    const result = canAnyPowerRespondPostRoll(
      state, 'field', 'hapsburg', 'ottoman'
    );
    expect(result.canRespond).toBe(true);
    expect(result.respondingPower).toBe('ottoman');
    expect(result.windowType).toBe('W4');
  });

  it('non-Ottoman cannot respond for W4 even with #1', () => {
    const state = createTestState();
    state.hands['france'] = [1];
    state.hands['hapsburg'] = [50];
    const result = canAnyPowerRespondPostRoll(
      state, 'field', 'france', 'hapsburg'
    );
    expect(result.canRespond).toBe(false);
  });

  it('no response when neither has post-roll cards', () => {
    const state = createTestState();
    state.hands['ottoman'] = [50];
    state.hands['hapsburg'] = [51];
    const result = canAnyPowerRespondPostRoll(
      state, 'field', 'ottoman', 'hapsburg'
    );
    expect(result.canRespond).toBe(false);
  });

  it('attacker can respond with #35 for assault', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [35];
    state.hands['france'] = [50];
    const result = canAnyPowerRespondPostRoll(
      state, 'assault', 'hapsburg', 'france'
    );
    expect(result.canRespond).toBe(true);
    expect(result.respondingPower).toBe('hapsburg');
    expect(result.windowType).toBe('W5');
  });

  it('defender can respond with #35 for assault', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [50];
    state.hands['france'] = [35];
    const result = canAnyPowerRespondPostRoll(
      state, 'assault', 'hapsburg', 'france'
    );
    expect(result.canRespond).toBe(true);
    expect(result.respondingPower).toBe('france');
    expect(result.windowType).toBe('W5');
  });

  it('attacker can respond with #34 for naval', () => {
    const state = createTestState();
    state.hands['ottoman'] = [34];
    state.hands['hapsburg'] = [50];
    const result = canAnyPowerRespondPostRoll(
      state, 'naval', 'ottoman', 'hapsburg'
    );
    expect(result.canRespond).toBe(true);
    expect(result.respondingPower).toBe('ottoman');
    expect(result.windowType).toBe('W6');
  });

  it('W4 not triggered for assault battle type', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1];
    state.hands['hapsburg'] = [50];
    const result = canAnyPowerRespondPostRoll(
      state, 'assault', 'ottoman', 'hapsburg'
    );
    expect(result.canRespond).toBe(false);
  });
});

describe('createPostRollWindow', () => {
  it('creates W4 window for Ottoman with Janissaries', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1, 50];
    const created = createPostRollWindow(
      state, 'W4', 'Edirne', 'ottoman', 'hapsburg', 'field'
    );
    expect(created).toBe(true);
    expect(state.pendingResponse).not.toBeNull();
    expect(state.pendingResponse.window).toBe('W4');
    expect(state.pendingResponse.respondingPower).toBe('ottoman');
    expect(state.pendingResponse.validCards).toContain(1);
  });

  it('creates W5 window for attacker with Siege Artillery', () => {
    const state = createTestState();
    state.hands['hapsburg'] = [35, 50];
    const created = createPostRollWindow(
      state, 'W5', 'Paris', 'hapsburg', 'france', 'assault'
    );
    expect(created).toBe(true);
    expect(state.pendingResponse.window).toBe('W5');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.validCards).toContain(35);
  });

  it('creates W6 window for defender with Professional Rowers', () => {
    const state = createTestState();
    state.hands['ottoman'] = [50];
    state.hands['hapsburg'] = [34, 51];
    const created = createPostRollWindow(
      state, 'W6', 'Adriatic Sea', 'ottoman', 'hapsburg', 'naval'
    );
    expect(created).toBe(true);
    expect(state.pendingResponse.window).toBe('W6');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.validCards).toContain(34);
  });

  it('returns false when W4 requested but Ottoman lacks #1', () => {
    const state = createTestState();
    state.hands['ottoman'] = [50];
    const created = createPostRollWindow(
      state, 'W4', 'Edirne', 'ottoman', 'hapsburg', 'field'
    );
    expect(created).toBe(false);
  });

  it('returns false when non-Ottoman tries W4', () => {
    const state = createTestState();
    state.hands['france'] = [1]; // France has card but restriction
    state.hands['hapsburg'] = [50];
    const created = createPostRollWindow(
      state, 'W4', 'Paris', 'france', 'hapsburg', 'field'
    );
    expect(created).toBe(false);
  });

  it('preserves battleState when creating window', () => {
    const state = createTestState();
    state.hands['ottoman'] = [1];
    const bs = {
      attackerRolls: [5, 3, 6],
      defenderRolls: [2, 4, 5],
      attackerDice: 3,
      defenderDice: 3
    };
    const created = createPostRollWindow(
      state, 'W4', 'Edirne', 'ottoman', 'hapsburg', 'field', bs
    );
    expect(created).toBe(true);
    expect(state.pendingResponse.battleState.attackerRolls)
      .toEqual([5, 3, 6]);
    expect(state.pendingResponse.battleState.defenderRolls)
      .toEqual([2, 4, 5]);
  });
});

describe('getNextPostRollWindow', () => {
  it('returns null after W4', () => {
    expect(getNextPostRollWindow('W4')).toBeNull();
  });

  it('returns null after W5', () => {
    expect(getNextPostRollWindow('W5')).toBeNull();
  });

  it('returns null after W6', () => {
    expect(getNextPostRollWindow('W6')).toBeNull();
  });
});

// ── W7 Impulse Interrupt Card Tests ─────────────────────────────

describe('getValidInterruptCards', () => {
  it('returns #31 Foul Weather for non-active power at impulse_start', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = [31, 50];
    const result = getValidInterruptCards(state, 'hapsburg', 'impulse_start');
    expect(result).toContain(31);
  });

  it('does not return #31 for active power', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['ottoman'] = [31, 50];
    const result = getValidInterruptCards(state, 'ottoman', 'impulse_start');
    expect(result).not.toContain(31);
  });

  it('returns #32 Gout for non-active power at impulse_start', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['france'] = [32, 50];
    const result = getValidInterruptCards(state, 'france', 'impulse_start');
    expect(result).toContain(32);
  });

  it('does not return #32 for active power', () => {
    const state = createTestState();
    state.activePower = 'france';
    state.hands['france'] = [32, 50];
    const result = getValidInterruptCards(state, 'france', 'impulse_start');
    expect(result).not.toContain(32);
  });

  it('returns #37 Wartburg for Protestant at event_play when Luther alive',
    () => {
      const state = createTestState();
      state.activePower = 'ottoman';
      state.lutherPlaced = true;
      state.hands['protestant'] = [37, 50];
      const result = getValidInterruptCards(
        state, 'protestant', 'event_play'
      );
      expect(result).toContain(37);
    });

  it('does not return #37 when Luther is not alive', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = false;
    state.hands['protestant'] = [37, 50];
    const result = getValidInterruptCards(
      state, 'protestant', 'event_play'
    );
    expect(result).not.toContain(37);
  });

  it('does not return #37 for non-Protestant power', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = true;
    state.hands['hapsburg'] = [37, 50];
    const result = getValidInterruptCards(
      state, 'hapsburg', 'event_play'
    );
    expect(result).not.toContain(37);
  });

  it('does not return #37 when Protestant is active power', () => {
    const state = createTestState();
    state.activePower = 'protestant';
    state.lutherPlaced = true;
    state.hands['protestant'] = [37, 50];
    const result = getValidInterruptCards(
      state, 'protestant', 'event_play'
    );
    expect(result).not.toContain(37);
  });

  it('does not return #37 for impulse_start trigger', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = true;
    state.hands['protestant'] = [37, 50];
    const result = getValidInterruptCards(
      state, 'protestant', 'impulse_start'
    );
    expect(result).not.toContain(37);
  });

  it('returns #38 Halley\'s Comet for non-active power at impulse_start',
    () => {
      const state = createTestState();
      state.activePower = 'ottoman';
      state.hands['england'] = [38, 50];
      const result = getValidInterruptCards(
        state, 'england', 'impulse_start'
      );
      expect(result).toContain(38);
    });

  it('does not return #38 for active power', () => {
    const state = createTestState();
    state.activePower = 'england';
    state.hands['england'] = [38, 50];
    const result = getValidInterruptCards(
      state, 'england', 'impulse_start'
    );
    expect(result).not.toContain(38);
  });

  it('does not return #38 for event_play trigger', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['england'] = [38, 50];
    const result = getValidInterruptCards(
      state, 'england', 'event_play'
    );
    expect(result).not.toContain(38);
  });

  it('returns multiple interrupt cards from hand', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['france'] = [31, 32, 38, 50];
    const result = getValidInterruptCards(
      state, 'france', 'impulse_start'
    );
    expect(result).toEqual([31, 32, 38]);
  });

  it('returns empty when hand is empty', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = [];
    const result = getValidInterruptCards(
      state, 'hapsburg', 'impulse_start'
    );
    expect(result).toEqual([]);
  });

  it('returns empty when hand is undefined', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = undefined;
    const result = getValidInterruptCards(
      state, 'hapsburg', 'impulse_start'
    );
    expect(result).toEqual([]);
  });

  it('returns empty when no interrupt cards in hand', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = [50, 51, 52];
    const result = getValidInterruptCards(
      state, 'hapsburg', 'impulse_start'
    );
    expect(result).toEqual([]);
  });

  it('returns all matching cards without triggerType filter', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = true;
    state.hands['protestant'] = [31, 37, 38, 50];
    // No triggerType — all cards checked
    const result = getValidInterruptCards(state, 'protestant');
    expect(result).toEqual([31, 37, 38]);
  });
});

describe('canAnyPowerInterrupt', () => {
  it('returns powers holding event_play interrupt cards', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = true;
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['protestant'] = [37, 50];
    const result = canAnyPowerInterrupt(state, 'event_play');
    expect(result.powers).toEqual(['protestant']);
    expect(result.cards.get('protestant')).toContain(37);
  });

  it('returns powers holding impulse_start interrupt cards', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50];
    state.hands['france'] = [38, 50];
    const result = canAnyPowerInterrupt(state, 'impulse_start');
    expect(result.powers).toEqual(['hapsburg', 'france']);
    expect(result.cards.get('hapsburg')).toContain(31);
    expect(result.cards.get('france')).toContain(38);
  });

  it('excludes active power', () => {
    const state = createTestState();
    state.activePower = 'hapsburg';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50]; // active power
    const result = canAnyPowerInterrupt(state, 'impulse_start');
    expect(result.powers).toEqual([]);
  });

  it('returns empty when no powers have interrupt cards', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    const result = canAnyPowerInterrupt(state, 'impulse_start');
    expect(result.powers).toEqual([]);
  });

  it('returns powers in impulse order', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['papacy'] = [32, 50];
    state.hands['hapsburg'] = [31, 50];
    const result = canAnyPowerInterrupt(state, 'impulse_start');
    // impulse order: ottoman, hapsburg, england, france, papacy, protestant
    expect(result.powers).toEqual(['hapsburg', 'papacy']);
  });

  it('does not return Protestant for event_play when Luther dead', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = false;
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['protestant'] = [37, 50];
    const result = canAnyPowerInterrupt(state, 'event_play');
    expect(result.powers).toEqual([]);
  });
});

describe('createInterruptWindow', () => {
  it('creates W7 pendingResponse with correct structure', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50];

    const created = createInterruptWindow(
      state, 'impulse_start', { cardNumber: 50, power: 'ottoman' }
    );

    expect(created).toBe(true);
    expect(state.pendingResponse).not.toBeNull();
    expect(state.pendingResponse.window).toBe('W7');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.respondingPowers).toEqual(['hapsburg']);
    expect(state.pendingResponse.currentResponderIndex).toBe(0);
    expect(state.pendingResponse.validCards).toContain(31);
    expect(state.pendingResponse.context.type).toBe('impulse_start');
  });

  it('returns false when no power can interrupt', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }

    const created = createInterruptWindow(state, 'impulse_start');
    expect(created).toBe(false);
  });

  it('sets first power in impulse order as responder', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['france'] = [32, 50];
    state.hands['hapsburg'] = [31, 50];

    const created = createInterruptWindow(state, 'impulse_start');

    expect(created).toBe(true);
    // hapsburg before france in impulse order
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');
    expect(state.pendingResponse.respondingPowers).toEqual(
      ['hapsburg', 'france']
    );
  });

  it('stores triggerData in battleState and context', () => {
    const state = createTestState();
    state.activePower = 'ottoman';
    state.lutherPlaced = true;
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['protestant'] = [37, 50];

    const triggerData = { cardNumber: 42, power: 'ottoman' };
    const created = createInterruptWindow(
      state, 'event_play', triggerData
    );

    expect(created).toBe(true);
    expect(state.pendingResponse.context.triggerData).toEqual(triggerData);
    expect(state.pendingResponse.battleState).toEqual(triggerData);
  });

  it('creates window for event_play with Wartburg', () => {
    const state = createTestState();
    state.activePower = 'hapsburg';
    state.lutherPlaced = true;
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['protestant'] = [37, 50];

    const created = createInterruptWindow(state, 'event_play', {
      cardNumber: 42, power: 'hapsburg'
    });

    expect(created).toBe(true);
    expect(state.pendingResponse.respondingPower).toBe('protestant');
    expect(state.pendingResponse.validCards).toContain(37);
  });
});

describe('advanceInterruptWindow', () => {
  it('advances to next responder', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50];
    state.hands['france'] = [32, 50];

    createInterruptWindow(state, 'impulse_start');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');

    const next = advanceInterruptWindow(state, helpers);
    expect(next).toBe('W7');
    expect(state.pendingResponse.respondingPower).toBe('france');
    expect(state.pendingResponse.validCards).toContain(32);
  });

  it('returns null when all have responded', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50];

    createInterruptWindow(state, 'impulse_start');

    const next = advanceInterruptWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('iterates through multiple responders', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50];
    state.hands['england'] = [38, 50];
    state.hands['papacy'] = [32, 50];

    createInterruptWindow(state, 'impulse_start');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');

    let next = advanceInterruptWindow(state, helpers);
    expect(next).toBe('W7');
    expect(state.pendingResponse.respondingPower).toBe('england');

    next = advanceInterruptWindow(state, helpers);
    expect(next).toBe('W7');
    expect(state.pendingResponse.respondingPower).toBe('papacy');

    next = advanceInterruptWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('returns null when no pendingResponse', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.pendingResponse = null;
    const next = advanceInterruptWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('returns null when window is not W7', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.pendingResponse = { window: 'W2' };
    const next = advanceInterruptWindow(state, helpers);
    expect(next).toBeNull();
  });

  it('skips power that lost interrupt card after window creation', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    for (const p of Object.keys(state.hands)) {
      state.hands[p] = [50];
    }
    state.hands['hapsburg'] = [31, 50];
    state.hands['france'] = [32, 50];
    state.hands['papacy'] = [38, 50];

    createInterruptWindow(state, 'impulse_start');
    expect(state.pendingResponse.respondingPower).toBe('hapsburg');

    // Simulate france losing their card
    state.hands['france'] = [50];

    const next = advanceInterruptWindow(state, helpers);
    expect(next).toBe('W7');
    // Should skip france and go to papacy
    expect(state.pendingResponse.respondingPower).toBe('papacy');
  });
});

// ── W7 handlePlayResponseCard / handleDeclineResponse ────────────

describe('W7 response card handling', () => {
  it('plays Wartburg (#37) in W7 window', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    state.lutherPlaced = true;
    state.hands['protestant'] = [37, 50];

    createInterruptWindow(state, 'event_play', {
      cardNumber: 42, power: 'ottoman'
    });

    const result = handlePlayResponseCard(
      state, 'protestant', { cardNumber: 37 }, helpers
    );

    expect(result.success).toBe(true);
    expect(result.cardNumber).toBe(37);
    expect(result.window).toBe('W7');
    expect(state.hands['protestant']).not.toContain(37);
    // Wartburg handler sets pendingEventCancelled
    expect(state.pendingEventCancelled).toBe(true);
  });

  it('plays Foul Weather (#31) in W7 window', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = [31, 50];

    createInterruptWindow(state, 'impulse_start');

    const result = handlePlayResponseCard(
      state, 'hapsburg', {
        cardNumber: 31,
        targetPower: 'ottoman'
      }, helpers
    );

    expect(result.success).toBe(true);
    expect(result.cardNumber).toBe(31);
    expect(state.hands['hapsburg']).not.toContain(31);
    // Foul Weather handler sets pendingFoulWeather
    expect(state.pendingFoulWeather).toBeDefined();
  });

  it('declines W7 interrupt', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = [31, 50];

    createInterruptWindow(state, 'impulse_start');

    const result = handleDeclineResponse(state, 'hapsburg', helpers);

    expect(result.success).toBe(true);
    expect(result.window).toBe('W7');
    // Card stays in hand
    expect(state.hands['hapsburg']).toContain(31);
  });

  it('rejects wrong power for W7', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    state.activePower = 'ottoman';
    state.hands['hapsburg'] = [31, 50];

    createInterruptWindow(state, 'impulse_start');

    const result = handlePlayResponseCard(
      state, 'france', { cardNumber: 31 }, helpers
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('france');
  });
});
