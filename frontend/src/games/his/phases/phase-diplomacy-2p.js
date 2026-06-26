/**
 * Here I Stand — Two-Player Diplomacy Phase (§9)
 *
 * Replaces the standard 5-segment Diplomacy phase. Each turn both sides draw one
 * card from the Diplomatic Deck; from Turn 2 on, the Papacy then the Protestant
 * each play one card. Consumes the deck subsystem in state/diplomacy-deck.js.
 *
 * MVP boundary (see docs/games/his/TWO_PLAYER_PLAN.md): the deck is wired
 * structurally — draw / play → discard / SL-card addition. Played cards are
 * logged (title + invasion flag) but their *effects* are NOT executed yet; the
 * DIPLOMACY_EVENT_HANDLERS (#201–219) place invasion armies / set wars / pend
 * choices that need the Phase-2 invasion-control system. The religious struggle
 * is fully functional regardless. This module intentionally does not import
 * phase-manager (index.js drives advancePhase) to avoid a circular import.
 */

import {
  ensureDiplomacyDeck, drawDiplomacyCard, playDiplomacyCard,
  addSchmalkaldicDiplomacyCards, endDiplomacyTurn, isInvasionCard,
  DIPLOMACY_SIDES
} from '../state/diplomacy-deck.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { DIPLOMACY_EVENT_HANDLERS } from '../actions/event-actions-diplomacy.js';

/**
 * Drain `state.pendingCardDraw` accumulated by a diplomacy event by dealing
 * Main-Deck cards. In the two-player variant only the Papacy and Protestant are
 * ever dealt cards (§6.2), so draws for the non-player powers are dropped.
 * @param {Object} state
 * @param {Object} helpers
 */
function resolvePendingCardDraws(state, helpers) {
  const pending = state.pendingCardDraw;
  if (!pending) return;
  for (const side of DIPLOMACY_SIDES) {
    let count = pending[side] || 0;
    while (count > 0 && state.deck.length > 0) {
      state.hands[side].push(state.deck.shift());
      count--;
    }
    if ((pending[side] || 0) > 0) {
      helpers.logEvent(state, 'diplomacy_2p_card_draw', {
        side, drawn: (pending[side] || 0) - count
      });
    }
  }
  state.pendingCardDraw = null;
}

/**
 * Initialize the two-player Diplomacy phase: add post-SL cards if the
 * Schmalkaldic League formed since last turn, deal one card to each side, and
 * queue the play order (Papacy then Protestant) for Turn 2+.
 * @param {Object} state
 * @param {Object} helpers
 */
export function initDiplomacy2P(state, helpers) {
  ensureDiplomacyDeck(state);

  // First turn after the Schmalkaldic League: fold the post-SL cards in.
  if (state.schmalkaldicLeagueFormed && !state.diplomacySLAdded) {
    addSchmalkaldicDiplomacyCards(state);
    helpers.logEvent(state, 'diplomacy_2p_sl_cards_added', {
      deckSize: state.diplomacyDeck.length
    });
  }

  // Deal one card to each side.
  const dealt = {};
  for (const side of DIPLOMACY_SIDES) {
    dealt[side] = drawDiplomacyCard(state, side);
  }

  // Turn 1: draw only, no play (§9). Turn 2+: Papacy then Protestant each play 1.
  state.diplomacy2P = {
    pendingPlayers: state.turn >= 2
      ? DIPLOMACY_SIDES.filter((side) => (state.diplomacyHands[side] || []).length > 0)
      : []
  };

  helpers.logEvent(state, 'diplomacy_2p_start', {
    turn: state.turn, dealt, willPlay: state.diplomacy2P.pendingPlayers
  });
}

/**
 * Whether the two-player Diplomacy phase is waiting on a player to play a card.
 * @param {Object} state
 * @returns {boolean}
 */
export function diplomacy2PNeedsInput(state) {
  return (state.diplomacy2P?.pendingPlayers?.length || 0) > 0;
}

/**
 * The side whose turn it is to play a diplomatic card (or null).
 * @param {Object} state
 * @returns {string|null}
 */
export function getDiplomacy2PActor(state) {
  return state.diplomacy2P?.pendingPlayers?.[0] || null;
}

/**
 * Apply a player's diplomatic-card play. Validates the actor/order, moves the
 * card from hand to played-this-turn (deck subsystem), and logs it. When the
 * last queued player has played, finalizes the turn (played → discard).
 *
 * Phase 2 (military core): Invasion cards now dispatch their real effect
 * (`DIPLOMACY_EVENT_HANDLERS` — set the war + place the army at
 * `actionData.targetSpace`). The bespoke non-invasion cards remain log-only
 * no-ops until Phase 2b.
 *
 * @param {Object} state
 * @param {string} side - acting side ('papacy' | 'protestant')
 * @param {number|Object} played - card number, or `{ cardNumber, targetSpace, ... }`
 * @param {Object} helpers
 * @returns {{ ok: boolean, done: boolean, error?: string }}
 *   `done` is true once both queued plays are complete (caller advances phase).
 */
export function applyDiplomacy2PPlay(state, side, played, helpers) {
  const actionData = (played && typeof played === 'object') ? played : { cardNumber: played };
  const cardNumber = actionData.cardNumber;

  const queue = state.diplomacy2P?.pendingPlayers || [];
  if (queue[0] !== side) {
    return { ok: false, done: false, error: 'Not your diplomacy play' };
  }
  if (!playDiplomacyCard(state, side, cardNumber)) {
    return { ok: false, done: false, error: 'Card not in your diplomatic hand' };
  }

  const card = CARD_BY_NUMBER[cardNumber];
  const invasion = isInvasionCard(cardNumber);

  if (invasion && DIPLOMACY_EVENT_HANDLERS[cardNumber]) {
    DIPLOMACY_EVENT_HANDLERS[cardNumber].execute(state, side, actionData, helpers);
    resolvePendingCardDraws(state, helpers);
  }

  helpers.logEvent(state, 'diplomacy_2p_play', {
    side, cardNumber, title: card?.title,
    invasion,
    targetSpace: actionData.targetSpace,
    // Non-invasion card effects remain deferred to Phase 2b.
    effectDeferred: !invasion
  });

  queue.shift();
  if (queue.length > 0) {
    return { ok: true, done: false };
  }

  // Both sides have played — discard the turn's plays and clear the queue.
  endDiplomacyTurn(state);
  state.diplomacy2P = { pendingPlayers: [] };
  helpers.logEvent(state, 'diplomacy_2p_end', { turn: state.turn });
  return { ok: true, done: true };
}
