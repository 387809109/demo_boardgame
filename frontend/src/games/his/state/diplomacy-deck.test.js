/**
 * Here I Stand — Diplomacy Deck Subsystem tests
 *
 * The diplomacy deck is a two-player-game component (the 3–6 player engine never
 * deals it). These tests exercise the self-contained subsystem directly: deck
 * composition, deal/play/discard/swap/reshuffle, the Schmalkaldic-League card
 * add, and the trailing-VP chooser used by Machiavelli (#215).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { seedRng } from './rng.js';
import {
  BASE_DIPLOMACY_CARDS, SL_DIPLOMACY_CARDS, DIPLOMACY_SIDES,
  diplomacyOpponent, isInvasionCard, isDiplomacyDeckActive,
  initDiplomacyDeck, ensureDiplomacyDeck, shuffleDiplomacyDeck,
  addSchmalkaldicDiplomacyCards, reshuffleDiplomacyDeck, drawDiplomacyCard,
  playDiplomacyCard, discardDiplomacyCard, swapDiplomacyCards, endDiplomacyTurn,
  trailingDiplomacySide, removeFromDiplomacyPiles
} from './diplomacy-deck.js';

// Keep the deck RNG deterministic across tests that shuffle.
beforeEach(() => seedRng(12345));

function freshState() {
  return initDiplomacyDeck({ vp: { papacy: 0, protestant: 0 } });
}

describe('diplomacy-deck — card pools', () => {
  it('base deck is the 12 diplomacy cards #201-212', () => {
    expect(BASE_DIPLOMACY_CARDS).toHaveLength(12);
    expect(Math.min(...BASE_DIPLOMACY_CARDS)).toBe(201);
    expect(Math.max(...BASE_DIPLOMACY_CARDS)).toBe(212);
  });

  it('SL deck is the 7 diplomacy_sl cards #213-219', () => {
    expect(SL_DIPLOMACY_CARDS).toHaveLength(7);
    expect([...SL_DIPLOMACY_CARDS].sort((a, b) => a - b))
      .toEqual([213, 214, 215, 216, 217, 218, 219]);
  });

  it('the six Invasion cards are recognized', () => {
    const invasions = [202, 206, 211, 213, 214, 216];
    for (const n of invasions) expect(isInvasionCard(n)).toBe(true);
    for (const n of [201, 205, 215, 219]) expect(isInvasionCard(n)).toBe(false);
  });

  it('diplomacyOpponent flips the side', () => {
    expect(diplomacyOpponent('papacy')).toBe('protestant');
    expect(diplomacyOpponent('protestant')).toBe('papacy');
    expect(DIPLOMACY_SIDES).toEqual(['papacy', 'protestant']);
  });
});

describe('diplomacy-deck — init & activity', () => {
  it('init builds a shuffled base deck and empty hands/discard/played', () => {
    const s = freshState();
    expect([...s.diplomacyDeck].sort((a, b) => a - b))
      .toEqual([...BASE_DIPLOMACY_CARDS].sort((a, b) => a - b));
    expect(s.diplomacyHands).toEqual({ papacy: [], protestant: [] });
    expect(s.diplomacyDiscard).toEqual([]);
    expect(s.diplomacyPlayedThisTurn).toEqual([]);
    expect(s.diplomacySLAdded).toBe(false);
  });

  it('isDiplomacyDeckActive reflects whether the subsystem is initialized', () => {
    expect(isDiplomacyDeckActive({})).toBe(false);
    expect(isDiplomacyDeckActive(freshState())).toBe(true);
  });

  it('ensureDiplomacyDeck initializes only when absent', () => {
    const s = freshState();
    s.diplomacyDeck = [201];      // pre-existing custom state
    ensureDiplomacyDeck(s);
    expect(s.diplomacyDeck).toEqual([201]); // not overwritten
    const blank = { vp: {} };
    ensureDiplomacyDeck(blank);
    expect(isDiplomacyDeckActive(blank)).toBe(true);
  });

  it('shuffle is deterministic for a given seed', () => {
    seedRng(777);
    const a = initDiplomacyDeck({ vp: {} }).diplomacyDeck.slice();
    seedRng(777);
    const b = initDiplomacyDeck({ vp: {} }).diplomacyDeck.slice();
    expect(a).toEqual(b);
  });
});

describe('diplomacy-deck — Schmalkaldic League cards', () => {
  it('adds the 7 SL cards once and is idempotent', () => {
    const s = freshState();
    addSchmalkaldicDiplomacyCards(s);
    expect(s.diplomacyDeck).toHaveLength(12 + 7);
    for (const n of SL_DIPLOMACY_CARDS) expect(s.diplomacyDeck).toContain(n);
    expect(s.diplomacySLAdded).toBe(true);
    // Second call is a no-op.
    addSchmalkaldicDiplomacyCards(s);
    expect(s.diplomacyDeck).toHaveLength(12 + 7);
  });

  it('does not duplicate an SL card already present elsewhere', () => {
    const s = freshState();
    s.diplomacyHands.papacy.push(215); // 215 already in a hand
    addSchmalkaldicDiplomacyCards(s);
    const count = s.diplomacyDeck.filter(c => c === 215).length;
    expect(count).toBe(0); // not re-added to the deck
  });

  it('is a no-op when the subsystem is not active', () => {
    const s = { vp: {} };
    addSchmalkaldicDiplomacyCards(s);
    expect(isDiplomacyDeckActive(s)).toBe(false);
    expect(s.diplomacyDeck).toBeUndefined();
  });
});

describe('diplomacy-deck — draw / play / discard', () => {
  it('draw moves the top card into the side hand', () => {
    const s = freshState();
    s.diplomacyDeck = [203, 204, 205];
    const card = drawDiplomacyCard(s, 'papacy');
    expect(card).toBe(203);
    expect(s.diplomacyHands.papacy).toEqual([203]);
    expect(s.diplomacyDeck).toEqual([204, 205]);
  });

  it('draw reshuffles the discard pile when the deck is empty', () => {
    const s = freshState();
    s.diplomacyDeck = [];
    s.diplomacyDiscard = [209];
    const card = drawDiplomacyCard(s, 'protestant');
    expect(card).toBe(209);
    expect(s.diplomacyDiscard).toEqual([]);
    expect(s.diplomacyHands.protestant).toEqual([209]);
  });

  it('draw returns null when deck and discard are both empty', () => {
    const s = freshState();
    s.diplomacyDeck = [];
    s.diplomacyDiscard = [];
    expect(drawDiplomacyCard(s, 'papacy')).toBeNull();
  });

  it('play moves a card from hand to played-this-turn', () => {
    const s = freshState();
    s.diplomacyHands.papacy = [201, 210];
    expect(playDiplomacyCard(s, 'papacy', 210)).toBe(true);
    expect(s.diplomacyHands.papacy).toEqual([201]);
    expect(s.diplomacyPlayedThisTurn).toEqual([210]);
  });

  it('play returns false when the card is not in hand', () => {
    const s = freshState();
    s.diplomacyHands.papacy = [201];
    expect(playDiplomacyCard(s, 'papacy', 999)).toBe(false);
  });

  it('play clears a satisfied forced-play constraint', () => {
    const s = freshState();
    s.diplomacyHands.protestant = [212];
    s.diplomacyForcedPlay = { side: 'protestant', card: 212 };
    playDiplomacyCard(s, 'protestant', 212);
    expect(s.diplomacyForcedPlay).toBeNull();
  });

  it('discard moves a card from hand to the discard pile', () => {
    const s = freshState();
    s.diplomacyHands.papacy = [201, 204];
    expect(discardDiplomacyCard(s, 'papacy', 204)).toBe(true);
    expect(s.diplomacyHands.papacy).toEqual([201]);
    expect(s.diplomacyDiscard).toEqual([204]);
  });

  it('swap exchanges one card between the two hands', () => {
    const s = freshState();
    s.diplomacyHands = { papacy: [201], protestant: [205] };
    swapDiplomacyCards(s, 'papacy', 201, 'protestant', 205);
    expect(s.diplomacyHands.papacy).toEqual([205]);
    expect(s.diplomacyHands.protestant).toEqual([201]);
  });
});

describe('diplomacy-deck — reshuffle & turn cleanup', () => {
  it('reshuffle returns the discard pile to the deck', () => {
    const s = freshState();
    s.diplomacyDeck = [201];
    s.diplomacyDiscard = [202, 203];
    reshuffleDiplomacyDeck(s);
    expect(s.diplomacyDiscard).toEqual([]);
    expect([...s.diplomacyDeck].sort((a, b) => a - b)).toEqual([201, 202, 203]);
  });

  it('reshuffle can optionally fold in played-this-turn cards', () => {
    const s = freshState();
    s.diplomacyDeck = [];
    s.diplomacyDiscard = [202];
    s.diplomacyPlayedThisTurn = [204];
    reshuffleDiplomacyDeck(s, { includePlayed: true });
    expect(s.diplomacyPlayedThisTurn).toEqual([]);
    expect([...s.diplomacyDeck].sort((a, b) => a - b)).toEqual([202, 204]);
  });

  it('endDiplomacyTurn moves played cards to discard and clears forced play', () => {
    const s = freshState();
    s.diplomacyPlayedThisTurn = [201, 205];
    s.diplomacyForcedPlay = { side: 'protestant', card: 212 };
    endDiplomacyTurn(s);
    expect(s.diplomacyPlayedThisTurn).toEqual([]);
    expect(s.diplomacyDiscard).toEqual([201, 205]);
    expect(s.diplomacyForcedPlay).toBeNull();
  });

  it('removeFromDiplomacyPiles strips a card from every pile', () => {
    const s = freshState();
    s.diplomacyDeck = [201, 215];
    s.diplomacyDiscard = [215];
    s.diplomacyHands.papacy = [215];
    const found = removeFromDiplomacyPiles(s, 215);
    expect(found).toBe(true);
    expect(s.diplomacyDeck).toEqual([201]);
    expect(s.diplomacyDiscard).toEqual([]);
    expect(s.diplomacyHands.papacy).toEqual([]);
  });
});

describe('diplomacy-deck — trailing-VP chooser (#215)', () => {
  it('returns the side with lower VP', () => {
    expect(trailingDiplomacySide({ vp: { papacy: 3, protestant: 9 } }, 'papacy'))
      .toBe('papacy');
    expect(trailingDiplomacySide({ vp: { papacy: 9, protestant: 3 } }, 'papacy'))
      .toBe('protestant');
  });

  it('breaks ties with the supplied side', () => {
    expect(trailingDiplomacySide({ vp: { papacy: 5, protestant: 5 } }, 'protestant'))
      .toBe('protestant');
  });

  it('defaults the tiebreak to papacy when given a non-side', () => {
    expect(trailingDiplomacySide({ vp: { papacy: 5, protestant: 5 } }, 'france'))
      .toBe('papacy');
  });
});
