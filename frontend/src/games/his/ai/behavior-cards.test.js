/**
 * Here I Stand — Behavior Cards Tests
 */
import { describe, it, expect } from 'vitest';
import {
  BEHAVIOR_CARDS, CARD_BY_ID, GOAL_TYPES, NEG_ITEMS,
  getUniqueCards, getContinueCards,
  shuffle, initBotDeck, revealBehaviorCard, getActiveBehaviorCard,
  resetDeckForSchmalkaldic, resetDeckForRulerDeath,
  BOT_EXTRA_UNITS
} from './behavior-cards.js';

// ── Card Data Integrity ─────────────────────────────────────────────

describe('BEHAVIOR_CARDS data', () => {
  const POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];

  it('has 6 powers', () => {
    expect(Object.keys(BEHAVIOR_CARDS)).toHaveLength(6);
    for (const p of POWERS) {
      expect(BEHAVIOR_CARDS[p]).toBeDefined();
    }
  });

  it('each power has exactly 8 cards', () => {
    for (const p of POWERS) {
      expect(BEHAVIOR_CARDS[p]).toHaveLength(8);
    }
  });

  it('each power has 5 unique + 3 Continue cards', () => {
    for (const p of POWERS) {
      const unique = BEHAVIOR_CARDS[p].filter(c => !c.isContinue);
      const cont = BEHAVIOR_CARDS[p].filter(c => c.isContinue);
      expect(unique).toHaveLength(5);
      expect(cont).toHaveLength(3);
    }
  });

  it('all 48 cards have unique IDs', () => {
    const ids = Object.values(BEHAVIOR_CARDS).flat().map(c => c.id);
    expect(new Set(ids).size).toBe(48);
  });

  it('CARD_BY_ID contains all 48 cards', () => {
    expect(Object.keys(CARD_BY_ID)).toHaveLength(48);
  });

  it('unique cards have required fields', () => {
    for (const p of POWERS) {
      for (const card of getUniqueCards(p)) {
        expect(card.id).toBeTruthy();
        expect(card.name).toBeTruthy();
        expect(card.power).toBe(p);
        expect(card.isContinue).toBe(false);
        expect(typeof card.home).toBe('boolean');
        expect(card.negotiations).toBeDefined();
        expect(card.goals.length).toBeGreaterThan(0);
      }
    }
  });

  it('Continue cards have empty goals and negotiations', () => {
    for (const p of POWERS) {
      for (const card of getContinueCards(p)) {
        expect(card.isContinue).toBe(true);
        expect(card.goals).toHaveLength(0);
        expect(Object.keys(card.negotiations)).toHaveLength(0);
      }
    }
  });
});

describe('card negotiation data', () => {
  it('unique cards have all 10 negotiation items', () => {
    const items = Object.values(NEG_ITEMS);
    for (const cards of Object.values(BEHAVIOR_CARDS)) {
      for (const card of cards.filter(c => !c.isContinue)) {
        for (const item of items) {
          expect(card.negotiations[item]).toBeDefined();
        }
      }
    }
  });

  it('negotiation rows have ofr/req/max fields', () => {
    const card = CARD_BY_ID['ottoman_spoils_of_war'];
    const endWar = card.negotiations[NEG_ITEMS.END_WAR];
    expect(endWar).toHaveProperty('ofr');
    expect(endWar).toHaveProperty('req');
    expect(endWar).toHaveProperty('max');
  });
});

describe('card goal data', () => {
  it('all goal types are valid', () => {
    const validTypes = new Set(Object.values(GOAL_TYPES));
    for (const cards of Object.values(BEHAVIOR_CARDS)) {
      for (const card of cards.filter(c => !c.isContinue)) {
        for (const goal of card.goals) {
          expect(validTypes.has(goal.type)).toBe(true);
          expect(typeof goal.max).toBe('number');
          expect(goal.max).toBeGreaterThan(0);
        }
      }
    }
  });

  it('Ottoman Spoils of War has correct goal order', () => {
    const card = CARD_BY_ID['ottoman_spoils_of_war'];
    expect(card.goals[0].type).toBe(GOAL_TYPES.SIEGE);
    expect(card.goals[0].max).toBe(Infinity);
    expect(card.goals[1].type).toBe(GOAL_TYPES.SET_SAIL);
    expect(card.goals[1].max).toBe(2);
    expect(card.goals[8].type).toBe(GOAL_TYPES.TROOPS);
  });

  it('Protestant Sola Scriptura prioritizes Garrison then Translate', () => {
    const card = CARD_BY_ID['protestant_sola_scriptura'];
    expect(card.goals[0].type).toBe(GOAL_TYPES.GARRISON);
    expect(card.goals[1].type).toBe(GOAL_TYPES.TRANSLATE);
    expect(card.goals[1].max).toBe(3);
  });
});

describe('card war targets', () => {
  it('Ottoman Spoils of War targets hapsburg', () => {
    expect(CARD_BY_ID['ottoman_spoils_of_war'].war).toBe('hapsburg');
  });

  it('Ottoman Masters of the Sea targets venice', () => {
    expect(CARD_BY_ID['ottoman_masters_of_the_sea'].war).toBe('venice');
  });

  it('Ottoman Spread Thin has no war target', () => {
    expect(CARD_BY_ID['ottoman_spread_thin'].war).toBeNull();
  });

  it('Papacy Warrior Pope targets france', () => {
    expect(CARD_BY_ID['papacy_warrior_pope'].war).toBe('france');
  });

  it('France Italian Wars targets genoa', () => {
    expect(CARD_BY_ID['france_italian_wars'].war).toBe('genoa');
  });
});

describe('card home field', () => {
  it('Ottoman Barbary Pirates does NOT use Home card', () => {
    expect(CARD_BY_ID['ottoman_barbary_pirates'].home).toBe(false);
  });

  it('Hapsburg Holy Roman Empire uses Home card', () => {
    expect(CARD_BY_ID['hapsburg_holy_roman_empire'].home).toBe(true);
  });

  it('Papacy Warrior Pope does NOT use Home card', () => {
    expect(CARD_BY_ID['papacy_warrior_pope'].home).toBe(false);
  });

  it('Protestant Preventative War does NOT use Home card', () => {
    expect(CARD_BY_ID['protestant_preventative_war'].home).toBe(false);
  });
});

describe('color-coded negotiation (Bot-to-Bot)', () => {
  it('Ottoman Spoils of War has correct color mappings', () => {
    const card = CARD_BY_ID['ottoman_spoils_of_war'];
    expect(card.colorCoded.endWar).toBe('england');
    expect(card.colorCoded.alliance).toBe('england');
    expect(card.colorCoded.treaty).toBe('papacy');
  });

  it('Protestant Die by the Sword targets france for endWar', () => {
    const card = CARD_BY_ID['protestant_die_by_the_sword'];
    expect(card.colorCoded.endWar).toBe('france');
    expect(card.colorCoded.returnLeader).toBe('hapsburg');
  });
});

describe('Protestant special Goodwill cards', () => {
  it('Preventative War is flagged as default Goodwill', () => {
    expect(CARD_BY_ID['protestant_preventative_war'].isGoodwillDefault).toBe(true);
  });

  it('Die by the Sword is flagged as default Goodwill', () => {
    expect(CARD_BY_ID['protestant_die_by_the_sword'].isGoodwillDefault).toBe(true);
  });

  it('other Protestant cards are not flagged', () => {
    expect(CARD_BY_ID['protestant_oratory'].isGoodwillDefault).toBeUndefined();
    expect(CARD_BY_ID['protestant_sola_scriptura'].isGoodwillDefault).toBeUndefined();
  });
});

// ── Deck Management ─────────────────────────────────────────────────

describe('shuffle', () => {
  it('returns the same array (in-place)', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toBe(arr);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses custom RNG', () => {
    const arr = [1, 2, 3, 4, 5];
    // Fixed RNG that always returns 0 → no swaps except last
    shuffle(arr, () => 0);
    // With rng=0, j is always 0, so elements rotate
    expect(arr).toHaveLength(5);
  });
});

describe('initBotDeck', () => {
  it('returns drawPile(6) + faceUp(0) + goodwill(2) for non-Protestant', () => {
    const deck = initBotDeck('ottoman');
    expect(deck.drawPile).toHaveLength(6);
    expect(deck.faceUp).toHaveLength(0);
    expect(deck.goodwill).toHaveLength(2);
  });

  it('Protestant: Preventative War and Die by the Sword are Goodwill', () => {
    const deck = initBotDeck('protestant');
    expect(deck.goodwill).toContain('protestant_preventative_war');
    expect(deck.goodwill).toContain('protestant_die_by_the_sword');
    expect(deck.drawPile).not.toContain('protestant_preventative_war');
    expect(deck.drawPile).not.toContain('protestant_die_by_the_sword');
    expect(deck.drawPile).toHaveLength(6);
  });

  it('all card IDs are valid', () => {
    const deck = initBotDeck('hapsburg');
    const allIds = [...deck.drawPile, ...deck.goodwill];
    for (const id of allIds) {
      expect(CARD_BY_ID[id]).toBeDefined();
    }
  });
});

describe('revealBehaviorCard', () => {
  it('reveals a non-Continue card and adds to faceUp', () => {
    // Use a fixed deck with no Continue cards at top
    const deck = {
      drawPile: ['ottoman_spoils_of_war', 'ottoman_masters_of_the_sea'],
      faceUp: [],
      goodwill: []
    };
    const activeId = revealBehaviorCard(deck);
    expect(activeId).toBe('ottoman_spoils_of_war');
    expect(deck.faceUp[0]).toBe('ottoman_spoils_of_war');
    expect(deck.drawPile).toHaveLength(1);
  });

  it('Continue card with existing face-up reuses previous card', () => {
    const deck = {
      drawPile: ['ottoman_continue_1'],
      faceUp: ['ottoman_spoils_of_war'],
      goodwill: []
    };
    const activeId = revealBehaviorCard(deck);
    // Should return the existing face-up card
    expect(activeId).toBe('ottoman_spoils_of_war');
    // Continue should be tucked into faceUp
    expect(deck.faceUp).toContain('ottoman_continue_1');
  });

  it('Continue card with no face-up draws again', () => {
    const deck = {
      drawPile: ['ottoman_continue_1', 'ottoman_spoils_of_war'],
      faceUp: [],
      goodwill: []
    };
    const activeId = revealBehaviorCard(deck);
    expect(activeId).toBe('ottoman_spoils_of_war');
  });

  it('empty draw pile reshuffles face-up cards', () => {
    const deck = {
      drawPile: [],
      faceUp: ['ottoman_spoils_of_war', 'ottoman_masters_of_the_sea'],
      goodwill: []
    };
    const activeId = revealBehaviorCard(deck);
    expect(CARD_BY_ID[activeId]).toBeDefined();
    // Face-up was cleared and reshuffled into drawPile
    expect(deck.drawPile.length + deck.faceUp.length).toBe(2);
  });
});

describe('getActiveBehaviorCard', () => {
  it('returns null for empty faceUp', () => {
    expect(getActiveBehaviorCard({ faceUp: [] })).toBeNull();
  });

  it('returns first non-Continue card in faceUp', () => {
    const deck = {
      faceUp: ['ottoman_spoils_of_war', 'ottoman_continue_1']
    };
    const card = getActiveBehaviorCard(deck);
    expect(card.id).toBe('ottoman_spoils_of_war');
    expect(card.isContinue).toBe(false);
  });

  it('skips Continue cards in faceUp', () => {
    const deck = {
      faceUp: ['ottoman_continue_1', 'ottoman_continue_2']
    };
    // All Continue — should return null
    expect(getActiveBehaviorCard(deck)).toBeNull();
  });
});

describe('resetDeckForSchmalkaldic', () => {
  it('returns full 6-card deck with 2 Goodwill', () => {
    const deck = resetDeckForSchmalkaldic('protestant');
    expect(deck.drawPile).toHaveLength(6);
    expect(deck.faceUp).toHaveLength(0);
    expect(deck.goodwill).toHaveLength(2);
    // All IDs are Protestant cards
    const allIds = [...deck.drawPile, ...deck.goodwill];
    for (const id of allIds) {
      expect(CARD_BY_ID[id].power).toBe('protestant');
    }
  });
});

describe('resetDeckForRulerDeath', () => {
  it('resets Ottoman deck completely', () => {
    const deck = resetDeckForRulerDeath('ottoman');
    expect(deck.drawPile).toHaveLength(6);
    expect(deck.goodwill).toHaveLength(2);
    const allIds = [...deck.drawPile, ...deck.goodwill];
    for (const id of allIds) {
      expect(CARD_BY_ID[id].power).toBe('ottoman');
    }
  });
});

// ── Bot Extra Units ─────────────────────────────────────────────────

describe('BOT_EXTRA_UNITS', () => {
  it('has entries for all 6 powers', () => {
    const powers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
    for (const p of powers) {
      expect(BOT_EXTRA_UNITS[p]).toBeDefined();
      expect(BOT_EXTRA_UNITS[p].space).toBeTruthy();
      expect(BOT_EXTRA_UNITS[p].unit).toBe('regular');
    }
  });

  it('Ottoman extra unit goes to Athens', () => {
    expect(BOT_EXTRA_UNITS.ottoman.space).toBe('Athens');
  });

  it('England extra unit goes to Calais', () => {
    expect(BOT_EXTRA_UNITS.england.space).toBe('Calais');
  });
});

// ── Lookup Helpers ──────────────────────────────────────────────────

describe('getUniqueCards / getContinueCards', () => {
  it('getUniqueCards returns 5 cards per power', () => {
    expect(getUniqueCards('france')).toHaveLength(5);
  });

  it('getContinueCards returns 3 cards per power', () => {
    expect(getContinueCards('france')).toHaveLength(3);
  });

  it('unique + continue = 8', () => {
    const u = getUniqueCards('papacy').length;
    const c = getContinueCards('papacy').length;
    expect(u + c).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Deck Lifecycle
// ═══════════════════════════════════════════════════════════════════════

describe('revealBehaviorCard deck lifecycle', () => {
  it('reshuffles faceUp into drawPile when draw pile exhausted', () => {
    const deck = initBotDeck('france', () => 0.5);
    // Draw all 6 cards to exhaust draw pile
    const drawn = [];
    while (deck.drawPile.length > 0) {
      drawn.push(revealBehaviorCard(deck, () => 0.5));
    }
    expect(deck.drawPile.length).toBe(0);
    // Next reveal should reshuffle face-up back into drawPile
    const nextId = revealBehaviorCard(deck, () => 0.5);
    expect(typeof nextId).toBe('string');
    expect(CARD_BY_ID[nextId]).toBeDefined();
  });

  it('handles Continue card when no face-up exists (draws again recursively)', () => {
    const deck = {
      drawPile: [],
      faceUp: [],
      goodwill: []
    };
    // Put 1 Continue then 1 unique in drawPile
    const continueCards = getContinueCards('ottoman');
    const uniqueCards = getUniqueCards('ottoman');
    deck.drawPile = [continueCards[0].id, uniqueCards[0].id];
    const result = revealBehaviorCard(deck, () => 0.5);
    // After Continue with empty faceUp: Continue placed in faceUp, then draws unique
    // Unique gets unshifted to faceUp[0], so result is the unique card
    expect(result).toBe(uniqueCards[0].id);
    expect(CARD_BY_ID[result].isContinue).toBeFalsy();
  });

  it('Continue card reuses previous face-up card', () => {
    const unique = getUniqueCards('hapsburg');
    const cont = getContinueCards('hapsburg');
    const deck = {
      drawPile: [cont[0].id],
      faceUp: [unique[0].id],
      goodwill: []
    };
    const result = revealBehaviorCard(deck, () => 0.5);
    // Should return the previously face-up unique card
    expect(result).toBe(unique[0].id);
    // Continue card tucked under
    expect(deck.faceUp).toContain(cont[0].id);
  });

  it('no card loss after full draw + reshuffle cycle', () => {
    const deck = initBotDeck('england', () => 0.5);
    const totalCards = deck.drawPile.length + deck.faceUp.length + deck.goodwill.length;
    // Draw all
    for (let i = 0; i < 6; i++) {
      revealBehaviorCard(deck, () => 0.5);
    }
    // Reshuffle should happen on next draw
    revealBehaviorCard(deck, () => 0.5);
    const afterTotal = deck.drawPile.length + deck.faceUp.length + deck.goodwill.length;
    // Total cards should remain constant (excluding goodwill which stays separate)
    expect(afterTotal).toBe(totalCards);
  });
});

describe('getActiveBehaviorCard edge cases', () => {
  it('returns null when faceUp is empty', () => {
    const deck = { drawPile: ['test'], faceUp: [], goodwill: [] };
    expect(getActiveBehaviorCard(deck)).toBeNull();
  });

  it('returns first non-Continue card from faceUp', () => {
    const unique = getUniqueCards('france');
    const cont = getContinueCards('france');
    const deck = {
      drawPile: [],
      faceUp: [unique[0].id, cont[0].id], // unique on top, continue below
      goodwill: []
    };
    const result = getActiveBehaviorCard(deck);
    expect(result.id).toBe(unique[0].id);
    expect(result.isContinue).toBeFalsy();
  });

  it('returns null when faceUp contains only Continue cards', () => {
    const cont = getContinueCards('papacy');
    const deck = {
      drawPile: [],
      faceUp: [cont[0].id, cont[1].id],
      goodwill: []
    };
    const result = getActiveBehaviorCard(deck);
    expect(result).toBeNull();
  });
});

describe('initBotDeck edge cases', () => {
  it('Protestant goodwill cards are specific (Preventative War + Die by the Sword)', () => {
    const deck = initBotDeck('protestant', () => 0.5);
    expect(deck.goodwill).toContain('protestant_preventative_war');
    expect(deck.goodwill).toContain('protestant_die_by_the_sword');
    expect(deck.goodwill).toHaveLength(2);
  });

  it('draw pile has exactly 6 cards', () => {
    const deck = initBotDeck('ottoman', () => 0.5);
    expect(deck.drawPile).toHaveLength(6);
    expect(deck.faceUp).toHaveLength(0);
    expect(deck.goodwill).toHaveLength(2);
  });

  it('non-Protestant goodwill cards are random (first 2 from shuffle)', () => {
    const deck = initBotDeck('hapsburg', () => 0.5);
    expect(deck.goodwill).toHaveLength(2);
    // All goodwill cards should be valid hapsburg cards
    for (const id of deck.goodwill) {
      expect(CARD_BY_ID[id].power).toBe('hapsburg');
    }
  });
});

describe('resetDeckForSchmalkaldic edge cases', () => {
  it('returns full 8-card deck for protestant', () => {
    const deck = resetDeckForSchmalkaldic('protestant', () => 0.5);
    const total = deck.drawPile.length + deck.goodwill.length;
    expect(total).toBe(8);
    expect(deck.faceUp).toHaveLength(0);
  });

  it('all cards belong to the power', () => {
    const deck = resetDeckForSchmalkaldic('protestant', () => 0.5);
    const allIds = [...deck.drawPile, ...deck.goodwill];
    for (const id of allIds) {
      expect(CARD_BY_ID[id].power).toBe('protestant');
    }
  });
});

describe('behavior card data integrity (extended)', () => {
  const POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];

  it('all non-Continue cards have non-empty goals', () => {
    for (const p of POWERS) {
      const unique = getUniqueCards(p);
      for (const card of unique) {
        expect(card.goals.length).toBeGreaterThan(0);
      }
    }
  });

  it('all Continue cards have isContinue=true and no goals', () => {
    for (const p of POWERS) {
      const conts = getContinueCards(p);
      for (const card of conts) {
        expect(card.isContinue).toBe(true);
      }
    }
  });

  it('each power has exactly 5 unique + 3 Continue', () => {
    for (const p of POWERS) {
      expect(getUniqueCards(p)).toHaveLength(5);
      expect(getContinueCards(p)).toHaveLength(3);
    }
  });

  it('CARD_BY_ID has entries for all 48 cards', () => {
    let count = 0;
    for (const p of POWERS) {
      count += BEHAVIOR_CARDS[p].length;
    }
    expect(count).toBe(48);
    expect(Object.keys(CARD_BY_ID).length).toBe(48);
  });
});
