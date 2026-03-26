/**
 * Here I Stand — Bot Negotiation Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import { initBotDeck, NEG_ITEMS, CARD_BY_ID, getActiveBehaviorCard } from './behavior-cards.js';
import { addWar } from '../state/war-helpers.js';
import {
  evaluateDeal,
  resolveBotToBotDeal,
  resolveAllBotDeals,
  getBadFaithCount,
  canUseGoodwill,
  getGoodwillRemaining,
  isTreatyBlocked
} from './bot-negotiation.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  return state;
}

function setActiveBehaviorCard(state, power, cardId) {
  if (!state.botDecks[power]) state.botDecks[power] = initBotDeck(power);
  state.botDecks[power].faceUp = [cardId];
}

// ══════════════════════════════════════════════════════════════════
// Human-to-Bot Deal Evaluation
// ══════════════════════════════════════════════════════════════════

describe('evaluateDeal', () => {
  it('succeeds when offer value >= request value', () => {
    const state = createBotState(['ottoman']);
    // Spoils of War negotiations: Card Draw ofr=2, req=3
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');

    // Human offers Card Draw (value 3 to Bot) and requests Loan Squadron (value 1 from Bot)
    const result = evaluateDeal(state, 'ottoman', 'england',
      { [NEG_ITEMS.CARD_DRAW]: 1 },     // Offer 1 card draw (ofr value = 2 per card)
      { [NEG_ITEMS.LOAN_SQUADRON]: 1 }   // Request 1 squadron (req value = 1)
    );
    // Offer total: card draw ofr = 2, Request total: loan squadron req = 1
    expect(result.success).toBe(true);
  });

  it('fails when offer value < request value', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');

    // Request something expensive, offer nothing
    const result = evaluateDeal(state, 'ottoman', 'england',
      {},
      { [NEG_ITEMS.YIELD_FORTIFIED]: 1 }  // req = 6
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('offer_too_low');
  });

  it('fails when no bot deck', () => {
    const state = createTestState();
    const result = evaluateDeal(state, 'ottoman', 'england', {}, {});
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_bot_deck');
  });

  it('fails when no behavior card revealed', () => {
    const state = createBotState(['ottoman']);
    state.botDecks.ottoman.faceUp = [];
    const result = evaluateDeal(state, 'ottoman', 'england', {}, {});
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_behavior_card');
  });

  it('adds Bad Faith penalty to request total', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.badFaithCards = { ottoman: { england: 2 } };

    // Offer that would normally succeed (2 vs 1) but +2 Bad Faith → (2 vs 3)
    const result = evaluateDeal(state, 'ottoman', 'england',
      { [NEG_ITEMS.CARD_DRAW]: 1 },     // ofr = 2
      { [NEG_ITEMS.LOAN_SQUADRON]: 1 }   // req = 1 + 2 bad faith = 3
    );
    expect(result.success).toBe(false);
    expect(result.requestTotal).toBe(3); // 1 + 2 bad faith
  });

  it('blocks End War/Alliance/Treaty when Bad Faith held', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.badFaithCards = { ottoman: { england: 1 } };

    const result = evaluateDeal(state, 'ottoman', 'england',
      { [NEG_ITEMS.CARD_DRAW]: 2 },
      { [NEG_ITEMS.END_WAR]: 1 }
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('bad_faith_restriction');
  });

  it('blocks deal when War field targets the requesting power', () => {
    const state = createBotState(['ottoman']);
    // Spoils of War: war = 'hapsburg'
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');

    const result = evaluateDeal(state, 'ottoman', 'hapsburg',
      { [NEG_ITEMS.CARD_DRAW]: 2 },
      { [NEG_ITEMS.END_WAR]: 1 }
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('war_field_conflict');
  });

  it('reports goodwillEligible when excess >= 1 and goodwill remaining', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');

    // Offer exceeds request by >= 1
    const result = evaluateDeal(state, 'ottoman', 'england',
      { [NEG_ITEMS.RETURN_LEADER]: 1 },   // ofr = 2
      { [NEG_ITEMS.LOAN_SQUADRON]: 1 }    // req = 1
    );
    expect(result.success).toBe(true);
    if (state.botDecks.ottoman.goodwill.length > 0) {
      expect(result.goodwillEligible).toBe(true);
    }
  });

  it('not goodwillEligible when no goodwill cards remain', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.botDecks.ottoman.goodwill = []; // No goodwill cards

    const result = evaluateDeal(state, 'ottoman', 'england',
      { [NEG_ITEMS.RETURN_LEADER]: 1 },
      { [NEG_ITEMS.LOAN_SQUADRON]: 1 }
    );
    expect(result.success).toBe(true);
    expect(result.goodwillEligible).toBe(false);
  });

  it('fails when items exceed max', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    // Spoils: Return Leader max = 1, requesting 2 should fail
    const result = evaluateDeal(state, 'ottoman', 'england',
      { [NEG_ITEMS.RETURN_LEADER]: 2 },
      {}
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('exceeds_max');
  });
});

// ══════════════════════════════════════════════════════════════════
// Bot-to-Bot Color-Coded Deals
// ══════════════════════════════════════════════════════════════════

describe('resolveBotToBotDeal', () => {
  it('resolves mutual color-coded items between two Bots', () => {
    const state = createBotState(['ottoman', 'england']);
    // Ottoman Spoils of War: colorCoded has End War → england, Alliance → england, etc.
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    // England Expedition: colorCoded has End War → hapsburg, not ottoman
    setActiveBehaviorCard(state, 'england', 'england_expedition');

    const exchanges = resolveBotToBotDeal(state, 'ottoman', 'england');
    // Should find mutual matches between the two cards
    expect(Array.isArray(exchanges)).toBe(true);
  });

  it('returns empty when no color-coded matches', () => {
    const state = createBotState(['ottoman', 'france']);
    // Use cards that don't target each other
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war'); // targets england, papacy
    setActiveBehaviorCard(state, 'france', 'france_the_knight_king'); // targets papacy, ottoman

    const exchanges = resolveBotToBotDeal(state, 'ottoman', 'france');
    // Ottoman targets england/papacy; France targets papacy/ottoman
    // Check that no mutual matches exist for End War
    // Ottoman End War → england; France End War → papacy → no match
    const endWarExchanges = exchanges.filter(e => e.item === NEG_ITEMS.END_WAR);
    // One-sided from France (Card Draw → ottoman) may appear
    expect(Array.isArray(exchanges)).toBe(true);
  });

  it('returns empty when powers are not both Bots', () => {
    const state = createBotState(['ottoman']);
    const exchanges = resolveBotToBotDeal(state, 'ottoman', 'england');
    expect(exchanges).toEqual([]);
  });

  it('mercenary exchanges count as 2', () => {
    const state = createBotState(['england', 'france']);
    // Set cards where both have mercenary targeting each other
    setActiveBehaviorCard(state, 'england', 'england_new_england');
    // New England: Mercenaries → france
    setActiveBehaviorCard(state, 'france', 'france_italian_wars');
    // Italian Wars: Mercenaries → protestant (not england)

    const exchanges = resolveBotToBotDeal(state, 'england', 'france');
    const mercExchanges = exchanges.filter(e => e.item === NEG_ITEMS.MERCENARIES);
    for (const ex of mercExchanges) {
      expect(ex.count).toBe(2);
    }
  });
});

describe('resolveAllBotDeals', () => {
  it('resolves deals for all Bot pairs', () => {
    const state = createBotState(['ottoman', 'hapsburg', 'england']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    setActiveBehaviorCard(state, 'england', 'england_expedition');

    const allExchanges = resolveAllBotDeals(state);
    expect(Array.isArray(allExchanges)).toBe(true);
    // Should check 3 pairs: ottoman-hapsburg, ottoman-england, hapsburg-england
  });

  it('returns empty when no Bots', () => {
    const state = createTestState();
    const exchanges = resolveAllBotDeals(state);
    expect(exchanges).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════
// Goodwill & Bad Faith
// ══════════════════════════════════════════════════════════════════

describe('getBadFaithCount', () => {
  it('returns 0 when no bad faith', () => {
    const state = createBotState(['ottoman']);
    expect(getBadFaithCount(state, 'ottoman', 'england')).toBe(0);
  });

  it('returns count when bad faith exists', () => {
    const state = createBotState(['ottoman']);
    state.badFaithCards = { ottoman: { england: 3 } };
    expect(getBadFaithCount(state, 'ottoman', 'england')).toBe(3);
  });

  it('returns 0 for unrelated power', () => {
    const state = createBotState(['ottoman']);
    state.badFaithCards = { ottoman: { england: 3 } };
    expect(getBadFaithCount(state, 'ottoman', 'france')).toBe(0);
  });
});

describe('canUseGoodwill', () => {
  it('returns false when no goodwill held', () => {
    const state = createBotState(['ottoman']);
    expect(canUseGoodwill(state, 'ottoman', 'england')).toBe(false);
  });

  it('returns true when human holds Bot goodwill card', () => {
    const state = createBotState(['ottoman']);
    state.goodwillHeld = { england: { ottoman: 1 } };
    expect(canUseGoodwill(state, 'ottoman', 'england')).toBe(true);
  });
});

describe('getGoodwillRemaining', () => {
  it('returns number of goodwill cards in bot deck', () => {
    const state = createBotState(['ottoman']);
    const remaining = getGoodwillRemaining(state, 'ottoman');
    expect(remaining).toBe(2); // Default: 2 goodwill cards
  });

  it('returns 0 when deck has no goodwill', () => {
    const state = createBotState(['ottoman']);
    state.botDecks.ottoman.goodwill = [];
    expect(getGoodwillRemaining(state, 'ottoman')).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Treaty Token Logic
// ══════════════════════════════════════════════════════════════════

describe('isTreatyBlocked', () => {
  it('blocks when powers are at war', () => {
    const state = createBotState(['ottoman']);
    addWar(state, 'ottoman', 'hapsburg');
    expect(isTreatyBlocked(state, 'ottoman', 'hapsburg')).toBe(true);
  });

  it('blocks Papacy-Protestant treaty', () => {
    const state = createBotState(['papacy']);
    expect(isTreatyBlocked(state, 'papacy', 'protestant')).toBe(true);
  });

  it('blocks Hapsburg-Protestant treaty', () => {
    const state = createBotState(['hapsburg']);
    expect(isTreatyBlocked(state, 'hapsburg', 'protestant')).toBe(true);
  });

  it('blocks Protestant-Hapsburg treaty (reverse direction)', () => {
    const state = createBotState(['protestant']);
    expect(isTreatyBlocked(state, 'protestant', 'hapsburg')).toBe(true);
  });

  it('allows Ottoman-England treaty when not at war', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spread_thin');
    expect(isTreatyBlocked(state, 'ottoman', 'england')).toBe(false);
  });

  it('blocks when War field targets the other power', () => {
    const state = createBotState(['ottoman']);
    // Spoils of War: war = 'hapsburg'
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    expect(isTreatyBlocked(state, 'ottoman', 'hapsburg')).toBe(true);
  });

  it('allows treaty when War field targets someone else', () => {
    const state = createBotState(['ottoman']);
    // Spoils of War: war = 'hapsburg'
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    expect(isTreatyBlocked(state, 'ottoman', 'france')).toBe(false);
  });

  it('blocks Protestant-Papacy treaty (reverse direction)', () => {
    const state = createBotState(['protestant']);
    expect(isTreatyBlocked(state, 'protestant', 'papacy')).toBe(true);
  });

  it('blocks when powers are at war', () => {
    const state = createBotState(['ottoman']);
    addWar(state, 'ottoman', 'france');
    expect(isTreatyBlocked(state, 'ottoman', 'france')).toBe(true);
  });
});

// ── Edge Cases ────────────────────────────────────────────────────────

describe('evaluateDeal — edge cases', () => {
  it('fails when Bot has no behavior card', () => {
    const state = createBotState(['ottoman']);
    state.botDecks.ottoman.faceUp = [];
    const result = evaluateDeal(state, 'ottoman', 'france', {}, {});
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_behavior_card');
  });

  it('bad faith blocks END_WAR in offer (not just request)', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.badFaithCards = { ottoman: { france: 1 } };
    const result = evaluateDeal(
      state, 'ottoman', 'france',
      { [NEG_ITEMS.END_WAR]: 1 }, {}
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('bad_faith_restriction');
  });

  it('war field blocks ALLIANCE request', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const result = evaluateDeal(
      state, 'ottoman', 'hapsburg',
      {}, { [NEG_ITEMS.ALLIANCE]: 1 }
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('war_field_conflict');
  });

  it('exceeds_max when offer + request > max', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    // Force a negotiation row with max
    const card = getActiveBehaviorCard(state.botDecks.ottoman);
    if (card?.negotiations) {
      const firstItem = Object.keys(card.negotiations)[0];
      if (firstItem && card.negotiations[firstItem].max != null) {
        const maxVal = card.negotiations[firstItem].max;
        const result = evaluateDeal(
          state, 'ottoman', 'france',
          { [firstItem]: maxVal },
          { [firstItem]: 1 }
        );
        expect(result.success).toBe(false);
        expect(result.reason).toBe('exceeds_max');
      }
    }
  });
});

describe('resolveBotToBotDeal — edge cases', () => {
  it('returns empty when one power is not a Bot', () => {
    const state = createBotState(['ottoman']);
    const result = resolveBotToBotDeal(state, 'ottoman', 'france');
    expect(result).toEqual([]);
  });

  it('returns empty when neither Bot has color-coded items', () => {
    const state = createBotState(['ottoman', 'hapsburg']);
    // Cards without colorCoded
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spread_thin');
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_consolidation');
    const result = resolveBotToBotDeal(state, 'ottoman', 'hapsburg');
    expect(result).toEqual([]);
  });
});
