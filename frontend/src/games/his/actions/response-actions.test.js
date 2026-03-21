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
  getNextCombatWindow
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
