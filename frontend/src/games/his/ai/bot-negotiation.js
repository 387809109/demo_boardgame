/**
 * Here I Stand — Bot Negotiation Logic
 *
 * Implements HISBOT v1.1 negotiation rules:
 *   §2.3  Human-to-Bot deal evaluation
 *   §2.3  Bot-to-Bot color-coded deals
 *   §2.3  Goodwill Cards
 *   §2.3  Bad Faith Cards
 *
 * All functions are pure — they read state and return results
 * without mutating state.
 */

import { NEG_ITEMS, CARD_BY_ID, getActiveBehaviorCard } from './behavior-cards.js';
import { areAtWar, getWarsOf, isMinorPower, getMinorAlly } from '../state/war-helpers.js';
import { isBotPower } from './bot-controller.js';

// ── Negotiation Item Keys (matching behavior-cards.js NEG_ITEMS) ─

// Already exported from behavior-cards.js:
// END_WAR, ALLIANCE, LOAN_SQUADRON, RETURN_LEADER, YIELD_FORTIFIED,
// CARD_DRAW, MERCENARIES, GRANT_DIVORCE, RESCIND_EXCOMM, TREATY

// ── Human-to-Bot Deal Evaluation ──────────────────────────────────

/**
 * Evaluate a human player's proposed deal with a Bot power.
 *
 * HISBOT §2.3 evaluation:
 *   1. If any items exceed max → fail
 *   2. If Bot doesn't have enough of requested items → fail
 *   3. Sum offer values vs request values
 *   4. If total offer < total request → fail
 *   5. If offer ≥ request → success
 *   6. If offer exceeds request by ≥1 AND Bot has Goodwill → human may take one
 *
 * Bad Faith: +1 to request per Bad Faith Card held by Bot from this human.
 * Bad Faith holders: no End War, Alliance, or Treaty.
 *
 * @param {Object} state - Game state
 * @param {string} botPower - Bot power being proposed to
 * @param {string} humanPower - Human power proposing
 * @param {Object} offer - { [NEG_ITEM]: count } items human offers
 * @param {Object} request - { [NEG_ITEM]: count } items human requests
 * @returns {{ success: boolean, reason: string|null, goodwillEligible: boolean, offerTotal: number, requestTotal: number }}
 */
export function evaluateDeal(state, botPower, humanPower, offer, request) {
  const deck = state.botDecks?.[botPower];
  if (!deck) {
    return { success: false, reason: 'no_bot_deck', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
  }

  const activeCard = getActiveBehaviorCard(deck);
  if (!activeCard) {
    return { success: false, reason: 'no_behavior_card', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
  }

  const neg = activeCard.negotiations;
  if (!neg) {
    return { success: false, reason: 'no_negotiations', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
  }

  // Bad Faith check: refuse End War, Alliance, Treaty if Bad Faith held
  const badFaithCount = getBadFaithCount(state, botPower, humanPower);
  if (badFaithCount > 0) {
    const restricted = [NEG_ITEMS.END_WAR, NEG_ITEMS.ALLIANCE, NEG_ITEMS.TREATY];
    for (const item of restricted) {
      if ((offer[item] || 0) > 0 || (request[item] || 0) > 0) {
        return { success: false, reason: 'bad_faith_restriction', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
      }
    }
  }

  // War field check: if Bot's War field lists the human power → fail for End War/Alliance
  if (activeCard.war) {
    const warTarget = resolveWarTarget(state, activeCard.war);
    if (warTarget === humanPower) {
      if ((request[NEG_ITEMS.END_WAR] || 0) > 0) {
        return { success: false, reason: 'war_field_conflict', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
      }
      if ((request[NEG_ITEMS.ALLIANCE] || 0) > 0) {
        return { success: false, reason: 'war_field_conflict', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
      }
    }
  }

  // 1. Check maximums
  for (const item of Object.keys(offer)) {
    const row = neg[item];
    if (row && row.max != null) {
      if ((offer[item] || 0) + (request[item] || 0) > row.max) {
        return { success: false, reason: 'exceeds_max', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
      }
    }
  }
  for (const item of Object.keys(request)) {
    const row = neg[item];
    if (row && row.max != null) {
      if ((offer[item] || 0) + (request[item] || 0) > row.max) {
        return { success: false, reason: 'exceeds_max', goodwillEligible: false, offerTotal: 0, requestTotal: 0 };
      }
    }
  }

  // 3. Sum values
  let offerTotal = 0;
  let requestTotal = 0;

  for (const [item, count] of Object.entries(offer)) {
    const row = neg[item];
    if (!row || row.ofr == null) continue;
    offerTotal += row.ofr * count;
  }

  for (const [item, count] of Object.entries(request)) {
    const row = neg[item];
    if (!row || row.req == null) continue;
    requestTotal += row.req * count;
  }

  // Add Bad Faith penalty to request
  requestTotal += badFaithCount;

  // 4-5. Compare
  if (offerTotal < requestTotal) {
    return { success: false, reason: 'offer_too_low', goodwillEligible: false, offerTotal, requestTotal };
  }

  // 6. Goodwill eligible?
  const goodwillRemaining = (deck.goodwill || []).length;
  const goodwillEligible = (offerTotal - requestTotal) >= 1 && goodwillRemaining > 0;

  return { success: true, reason: null, goodwillEligible, offerTotal, requestTotal };
}

// ── Bot-to-Bot Color-Coded Deals ──────────────────────────────────

/**
 * Resolve automatic Bot-to-Bot deals using color-coded items.
 *
 * HISBOT §2.3 Bot-to-Bot:
 * If a Bot's color-coded item targets another Bot, and that Bot has a
 * matching color-coded item targeting the first Bot → confirmed deal.
 * Each item exchanged once (except mercenaries → 2).
 * Deals don't fail because exchanges can't be made.
 * Not constrained by maximums.
 * Don't count toward human deal maximums.
 *
 * @param {Object} state
 * @param {string} powerA - First Bot power
 * @param {string} powerB - Second Bot power
 * @returns {Object[]} Array of { from, to, item, count } exchanges
 */
export function resolveBotToBotDeal(state, powerA, powerB) {
  if (!isBotPower(state, powerA) || !isBotPower(state, powerB)) return [];

  const deckA = state.botDecks?.[powerA];
  const deckB = state.botDecks?.[powerB];
  if (!deckA || !deckB) return [];

  const cardA = getActiveBehaviorCard(deckA);
  const cardB = getActiveBehaviorCard(deckB);
  if (!cardA || !cardB) return [];

  const exchanges = [];

  // Check each color-coded item on cardA targeting powerB
  if (cardA.colorCoded) {
    for (const [item, targetPower] of Object.entries(cardA.colorCoded)) {
      if (targetPower !== powerB) continue;

      // Check if powerB has a matching color-coded item targeting powerA
      if (cardB.colorCoded?.[item] === powerA) {
        // Mutual match → confirmed exchange
        const count = item === NEG_ITEMS.MERCENARIES ? 2 : 1;
        exchanges.push({ from: powerA, to: powerB, item, count });
        exchanges.push({ from: powerB, to: powerA, item, count });
      }
    }
  }

  // Also check cardB targeting powerA for items not already matched
  if (cardB.colorCoded) {
    for (const [item, targetPower] of Object.entries(cardB.colorCoded)) {
      if (targetPower !== powerA) continue;
      // Skip if already matched from cardA side
      if (cardA.colorCoded?.[item] === powerB) continue;

      // One-sided color code — Bot gives item to the targeted Bot
      const count = item === NEG_ITEMS.MERCENARIES ? 2 : 1;
      exchanges.push({ from: powerB, to: powerA, item, count });
    }
  }

  return exchanges;
}

/**
 * Find all Bot-to-Bot deals for the current turn.
 * @param {Object} state
 * @returns {Object[]} All exchanges across all Bot pairs
 */
export function resolveAllBotDeals(state) {
  const bots = Object.keys(state.botPowers || {}).filter(p => state.botPowers[p]);
  const allExchanges = [];

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const exchanges = resolveBotToBotDeal(state, bots[i], bots[j]);
      allExchanges.push(...exchanges);
    }
  }

  return allExchanges;
}

// ── Goodwill & Bad Faith ──────────────────────────────────────────

/**
 * Get number of Bad Faith Cards a Bot holds from a specific human.
 * @param {Object} state
 * @param {string} botPower
 * @param {string} humanPower
 * @returns {number}
 */
export function getBadFaithCount(state, botPower, humanPower) {
  return state.badFaithCards?.[botPower]?.[humanPower] || 0;
}

/**
 * Check if a Goodwill Card can be applied to a deal.
 * Human can spend Goodwill Card from a Bot to add +1 to offer value.
 * Only one per deal, only after behavior card revealed.
 *
 * @param {Object} state
 * @param {string} botPower
 * @param {string} humanPower
 * @returns {boolean}
 */
export function canUseGoodwill(state, botPower, humanPower) {
  const held = state.goodwillHeld?.[humanPower]?.[botPower] || 0;
  return held > 0;
}

/**
 * Check how many Goodwill Cards a Bot still has available.
 * @param {Object} state
 * @param {string} botPower
 * @returns {number}
 */
export function getGoodwillRemaining(state, botPower) {
  return (state.botDecks?.[botPower]?.goodwill || []).length;
}

// ── Treaty Token Logic ────────────────────────────────────────────

/**
 * Check if two powers should NOT exchange treaty tokens.
 *
 * HISBOT §2.3: Papacy and Hapsburg Bots never exchange tokens with Protestant.
 * Powers at war don't exchange. Bot won't exchange if War field targets that power.
 *
 * @param {Object} state
 * @param {string} botPower
 * @param {string} otherPower
 * @returns {boolean} true if treaty exchange is blocked
 */
export function isTreatyBlocked(state, botPower, otherPower) {
  // Powers at war
  if (areAtWar(state, botPower, otherPower)) return true;

  // Papacy/Hapsburg never exchange with Protestant
  if ((botPower === 'papacy' || botPower === 'hapsburg') && otherPower === 'protestant') return true;
  if ((otherPower === 'papacy' || otherPower === 'hapsburg') && botPower === 'protestant') return true;

  // War field check
  const deck = state.botDecks?.[botPower];
  if (deck) {
    const card = getActiveBehaviorCard(deck);
    if (card?.war) {
      const warTarget = resolveWarTarget(state, card.war);
      if (warTarget === otherPower) return true;
    }
  }

  return false;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Resolve war target (minor → allied major if active).
 * @param {Object} state
 * @param {string} target
 * @returns {string}
 */
function resolveWarTarget(state, target) {
  if (isMinorPower(target)) {
    const ally = getMinorAlly(state, target);
    if (ally) return ally;
  }
  return target;
}
