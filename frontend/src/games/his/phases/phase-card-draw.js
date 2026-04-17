/**
 * Here I Stand — Card Draw Phase
 *
 * Handles: add turn-gated cards, merge discard, shuffle, deal to each power.
 */

import { MAJOR_POWERS, NEW_WORLD_RICHES_TABLE, RICHES_RESULTS } from '../constants.js';
import { CARDS } from '../data/cards.js';
import { getCardDrawCount, isCardInPlay } from '../state/state-helpers.js';
import { rollDice } from '../actions/religious-actions.js';

/** Home card numbers per power */
const HOME_CARDS = {
  ottoman: [1],
  hapsburg: [2],
  england: [3],
  france: [4],
  papacy: [5, 6],
  protestant: [7]
};

/** All home card numbers (flat set for quick lookup) */
const HOME_CARD_SET = new Set(Object.values(HOME_CARDS).flat());

/**
 * Execute the full card draw phase.
 * Mutates state in place.
 * @param {Object} state
 * @param {Object} helpers
 */
export function executeCardDraw(state, helpers) {
  // 1. Add turn-gated cards that are now available
  addTurnGatedCards(state);

  // 2. Merge discard pile back into deck
  state.deck.push(...state.discard);
  state.discard = [];

  // 3. Shuffle deck
  shuffleDeck(state.deck);

  // 4. Deal cards to each power (in impulse order)
  for (const power of MAJOR_POWERS) {
    const drawCount = getCardDrawCount(state, power);
    const dealt = state.deck.splice(0, drawCount);
    state.hands[power].push(...dealt);
  }

  // 5. Add home cards to each power's hand
  for (const power of MAJOR_POWERS) {
    for (const cardNum of HOME_CARDS[power]) {
      if (!state.hands[power].includes(cardNum)) {
        state.hands[power].push(cardNum);
      }
    }
    state.homeCardPlayed[power] = false;
  }

  helpers.logEvent(state, 'cards_dealt', {
    turn: state.turn,
    counts: Object.fromEntries(
      MAJOR_POWERS.map(p => [p, state.hands[p].length])
    )
  });

  // 6. Roll for New World Riches (§20.4)
  resolveNewWorldRiches(state, helpers);
}

/**
 * Add turn-gated cards that become available this turn.
 * Cards with availableTurn <= current turn that aren't already tracked anywhere.
 * Excludes home cards, diplomacy cards, and special-timing cards.
 */
function addTurnGatedCards(state) {
  const EXCLUDED_DECKS = new Set(['home', 'special', 'diplomacy', 'diplomacy_sl']);

  for (const card of CARDS) {
    // Skip excluded deck types
    if (EXCLUDED_DECKS.has(card.deck)) continue;

    // Skip home cards
    if (HOME_CARD_SET.has(card.number)) continue;

    // Skip if not yet available
    if (card.availableTurn === null || card.availableTurn > state.turn) continue;

    // Skip if already in play somewhere
    if (isCardInPlay(state, card.number)) continue;

    // Add to deck
    state.deck.push(card.number);
  }
}

/**
 * Fisher-Yates shuffle (in place).
 * @param {Array} arr
 */
function shuffleDeck(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── New World Riches (§20.4) ─────────────────────────────────────

/**
 * Resolve New World Riches for all powers with conquests/colonies.
 * Roll 2d6 per conquest and colony, consult table, apply results.
 * Plantations modifier: +1 to Potosi and Colony column rolls.
 * @param {Object} state
 * @param {Object} helpers
 */
function resolveNewWorldRiches(state, helpers) {
  const nw = state.newWorld;
  if (!nw) return;

  const conquests = nw.conquests || [];
  const colonies = nw.colonies || [];
  if (conquests.length === 0 && colonies.length === 0) return;

  const richesLog = [];

  // Roll for each conquest
  for (let i = conquests.length - 1; i >= 0; i--) {
    const cq = conquests[i];
    const col = cq.conquestId; // 'inca', 'aztec', 'maya'
    const dice = rollDice(2);
    let roll = dice[0] + dice[1];

    const row = NEW_WORLD_RICHES_TABLE[Math.min(Math.max(roll, 2), 12)];
    if (!row) continue;
    const result = row[col] || 'ne';

    const entry = { power: cq.power, type: 'conquest', id: col, dice, roll, result };
    applyRichesResult(state, cq.power, result, entry, helpers);

    // Deplete: remove conquest from active, keep VP
    if (result === RICHES_RESULTS.DEPLETE) {
      conquests.splice(i, 1);
      entry.depleted = true;
    }
    richesLog.push(entry);
  }

  // Roll for Potosi (per power that has it)
  if (state.potosi) {
    for (const [power, hasPotosi] of Object.entries(state.potosi)) {
      if (!hasPotosi) continue;
      const dice = rollDice(2);
      let roll = dice[0] + dice[1];
      // Plantations modifier applies to Potosi
      if (state.plantations?.[power]) roll += state.plantations[power];

      const row = NEW_WORLD_RICHES_TABLE[Math.min(Math.max(roll, 2), 12)];
      if (!row) continue;
      const result = row.potosi || 'ne';

      const entry = { power, type: 'potosi', id: 'potosi', dice, roll, result };
      applyRichesResult(state, power, result, entry, helpers);

      // Elim: remove Potosi
      if (result === RICHES_RESULTS.ELIMINATED) {
        state.potosi[power] = false;
        entry.eliminated = true;
      }
      richesLog.push(entry);
    }
  }

  // Roll for each colony
  for (let i = colonies.length - 1; i >= 0; i--) {
    const colony = colonies[i];
    const dice = rollDice(2);
    let roll = dice[0] + dice[1];
    // Plantations modifier applies to Colony column
    if (state.plantations?.[colony.power]) roll += state.plantations[colony.power];

    const row = NEW_WORLD_RICHES_TABLE[Math.min(Math.max(roll, 2), 12)];
    if (!row) continue;
    const result = row.colony || 'ne';

    const entry = { power: colony.power, type: 'colony', id: `colony_${i}`, dice, roll, result };
    applyRichesResult(state, colony.power, result, entry, helpers);

    // Elim: remove colony
    if (result === RICHES_RESULTS.ELIMINATED) {
      colonies.splice(i, 1);
      entry.eliminated = true;
    }
    richesLog.push(entry);
  }

  if (richesLog.length > 0) {
    helpers.logEvent(state, 'new_world_riches', { results: richesLog });
  }

  // §20.4 Raider interception of Hapsburg riches cards
  resolveRaiders(state, richesLog, helpers);
}

/**
 * Apply a single riches result: draw card for 'card', 'deplete', or 'galleon' (if marker).
 */
function applyRichesResult(state, power, result, entry, helpers) {
  let drawCard = false;

  if (result === RICHES_RESULTS.CARD || result === RICHES_RESULTS.DEPLETE) {
    drawCard = true;
  } else if (result === RICHES_RESULTS.GALLEON) {
    // Only draw if power has Galleons marker
    if (state.galleons?.[power]) {
      drawCard = true;
      entry.galleonUsed = true;
    }
  }

  if (drawCard && state.deck.length > 0) {
    const drawn = state.deck.splice(0, 1)[0];
    state.hands[power].push(drawn);
    entry.cardDrawn = drawn;
  }
}

// ── Raiders (§20.4) ─────────────────────────────────────────────

/** Raider roll order per rules: France → England → Protestant */
const RAIDER_ORDER = ['france', 'england', 'protestant'];

/**
 * Resolve raider interception of Hapsburg riches cards.
 * Only applies if Hapsburg drew cards AND raiders exist.
 * @param {Object} state
 * @param {Array} richesLog - log entries from riches resolution
 * @param {Object} helpers
 */
function resolveRaiders(state, richesLog, helpers) {
  // Collect Hapsburg cards drawn from riches
  const hapsburgCards = richesLog
    .filter(e => e.power === 'hapsburg' && e.cardDrawn != null)
    .map(e => e.cardDrawn);
  if (hapsburgCards.length === 0) return;

  const raiders = state.raiders || {};
  const activeRaiders = RAIDER_ORDER.filter(p => raiders[p]);
  if (activeRaiders.length === 0) return;

  const raiderLog = [];

  // Each raider rolls for each Hapsburg card drawn, in order
  for (const card of hapsburgCards) {
    // Check if card is still in Hapsburg hand (not already stolen)
    if (!state.hands.hapsburg.includes(card)) continue;

    for (const raiderPower of activeRaiders) {
      // If raider was removed by a previous roll, skip
      if (!state.raiders[raiderPower]) continue;

      const die = rollDice(1)[0];
      const entry = { raiderPower, card, die };

      if (die === 1) {
        // Raider removed, card stays with Hapsburg
        state.raiders[raiderPower] = false;
        entry.result = 'raider_removed';
      } else if (die === 2) {
        // If Hapsburg has Galleons, raider removed; otherwise no effect
        if (state.galleons?.hapsburg) {
          state.raiders[raiderPower] = false;
          entry.result = 'raider_removed_galleons';
        } else {
          entry.result = 'no_effect';
        }
      } else if (die <= 4) {
        // No effect
        entry.result = 'no_effect';
      } else if (die === 5) {
        // Card stolen, raider removed
        const idx = state.hands.hapsburg.indexOf(card);
        if (idx >= 0) {
          state.hands.hapsburg.splice(idx, 1);
          state.hands[raiderPower].push(card);
        }
        state.raiders[raiderPower] = false;
        entry.result = 'stolen_raider_removed';
        raiderLog.push(entry);
        break; // Card is gone, no more raiders roll for it
      } else {
        // die === 6: Card stolen, raider stays
        const idx = state.hands.hapsburg.indexOf(card);
        if (idx >= 0) {
          state.hands.hapsburg.splice(idx, 1);
          state.hands[raiderPower].push(card);
        }
        entry.result = 'stolen_raider_stays';
        raiderLog.push(entry);
        break; // Card is gone, no more raiders roll for it
      }
      raiderLog.push(entry);
    }
  }

  if (raiderLog.length > 0) {
    helpers.logEvent(state, 'raider_interception', { results: raiderLog });
  }
}
