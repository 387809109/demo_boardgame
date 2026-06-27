/**
 * Here I Stand — Two-Player Variant: England Automation (§21.3)
 *
 * England is a NON-player power in the two-player variant, so its Reformation
 * trajectory must unfold automatically: Henry's marriage to Anne Boleyn opens
 * the English Reformation, the boy-king Edward turns England Protestant, Mary I
 * restores Catholicism (and lets the Papacy pressure the English zone), and
 * Elizabeth returns it to the Protestants.
 *
 * This module implements the §21.3 schedule + the Mary-I per-impulse procedure.
 * Every entry point is `isTwoPlayer`-gated and a no-op otherwise, so the
 * standard 3–6 player succession (driven by card play) is byte-unchanged.
 *
 * Reuses the existing succession handlers (`EVENT_HANDLERS[19/21]` →
 * `replaceRuler`), the conditional-debater gate (`getAvailableDebaters` keys the
 * English reformers on `henryMaritalStatus`), and the counter-reformation
 * pattern from `index.js#_isMaryIHijack`.
 */

import { isTwoPlayer, isCardInPlay, isHomeSpace } from '../state/state-helpers.js';
import { EVENT_HANDLERS } from '../actions/event-actions.js';
import { rollDice } from '../actions/religious-actions.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { MARITAL_STATUS } from '../constants.js';

const EDWARD_VI_CARD = 19;
const MARY_I_CARD = 21;
/** English reformers that enter when the English Reformation opens (§21.3, T5). */
const ENGLISH_REFORMERS = ['cranmer', 'coverdale', 'latimer'];

/** Whether every English home space is already Catholic (Mary-I skip guard). */
function allEnglishHomeCatholic(state) {
  const names = Object.keys(state.spaces).filter((name) => isHomeSpace(name, 'england'));
  return names.length > 0 && names.every((name) => state.spaces[name].religion === 'catholic');
}

/** Remove a card from the Main Deck and every power's hand (when forced). */
function consumeMainDeckCard(state, cardNumber) {
  state.deck = (state.deck || []).filter((c) => c !== cardNumber);
  for (const hand of Object.values(state.hands || {})) {
    if (Array.isArray(hand)) {
      const idx = hand.indexOf(cardNumber);
      if (idx >= 0) hand.splice(idx, 1);
    }
  }
}

/**
 * §21.3 schedule, run during the Card Draw phase (no-op outside the variant):
 *  - **T4** Henry marries Anne Boleyn — advance the marital track so the
 *    conditional English debaters become available (`getAvailableDebaters`).
 *  - **T5** Cranmer / Latimer / Coverdale enter the Protestant debater pool.
 *  - **T6** Edward VI (#19) enters the Main Deck (can then be drawn/played as a
 *    mandatory event; otherwise forced in Winter T7).
 * Idempotent: each step only fires once.
 * @param {Object} state
 * @param {Object} helpers
 */
export function scheduleEnglandSuccession2P(state, helpers) {
  if (!isTwoPlayer(state)) return;

  // T4 — the Anne Boleyn marriage opens the English Reformation.
  if (state.turn >= 4 &&
      MARITAL_STATUS.indexOf(state.henryMaritalStatus) < MARITAL_STATUS.indexOf('anne_boleyn')) {
    state.henryMaritalStatus = 'anne_boleyn';
    helpers.logEvent(state, 'england_2p_marriage', { status: 'anne_boleyn' });
  }

  // T5 — the English reformers enter play (gated, additionally, on the marriage
  // by getAvailableDebaters).
  if (state.turn >= 5 && state.debaters?.protestant) {
    const present = new Set(state.debaters.protestant.map((d) => d.id));
    const added = [];
    for (const id of ENGLISH_REFORMERS) {
      if (!present.has(id)) {
        state.debaters.protestant.push({ id, committed: false });
        added.push(id);
      }
    }
    if (added.length > 0) {
      helpers.logEvent(state, 'england_2p_reformers', { added });
    }
  }

  // T6 — Edward VI enters the Main Deck (only while Henry still rules).
  if (state.turn >= 6 && state.rulers?.england === 'henry_viii' &&
      !isCardInPlay(state, EDWARD_VI_CARD)) {
    state.deck.push(EDWARD_VI_CARD);
    helpers.logEvent(state, 'england_2p_edward_deck', { card: EDWARD_VI_CARD });
  }
}

/**
 * §21.3 forced succession, run during the Winter phase (no-op outside the
 * variant): the England succession cards are mandatory by a fixed turn even if
 * never drawn —
 *  - **Winter T7** Edward VI (#19) if Henry still rules → England goes Protestant.
 *  - **Winter T8** Mary I (#21) if Edward still rules → England goes Catholic.
 * Reuses the existing succession handlers; consumes the card from the deck/hands.
 * @param {Object} state
 * @param {Object} helpers
 */
export function forceEnglandSuccession2P(state, helpers) {
  if (!isTwoPlayer(state)) return;

  if (state.turn >= 7 && state.rulers?.england === 'henry_viii') {
    consumeMainDeckCard(state, EDWARD_VI_CARD);
    EVENT_HANDLERS[EDWARD_VI_CARD].execute(state, 'papacy', {}, helpers);
    helpers.logEvent(state, 'england_2p_force_succession', { card: EDWARD_VI_CARD });
  }

  if (state.turn >= 8 && state.rulers?.england === 'edward_vi') {
    consumeMainDeckCard(state, MARY_I_CARD);
    EVENT_HANDLERS[MARY_I_CARD].execute(state, 'papacy', {}, helpers);
    helpers.logEvent(state, 'england_2p_force_succession', { card: MARY_I_CARD });
  }
}

/**
 * §21.3 Mary-I procedure — runs after each Protestant impulse in the variant.
 * If England is ruled by Mary I (and not already fully Catholic), the Papal
 * player rolls d6: 1–4 continue to the Papal impulse normally; 5–6 the Papacy
 * draws a Main-Deck card and acts against the English zone with its CP (1–2 →
 * Burn Books; 3+ → Burn Books then a debate). Mirrors `index.js#_isMaryIHijack`.
 * @param {Object} state
 * @param {string} endingPower - the power whose impulse just ended
 * @param {Object} helpers
 * @param {{ die?: number }} [opts] - inject the d6 for deterministic tests
 * @returns {boolean} whether the Papacy acted against England
 */
export function maybeMaryIImpulse2P(state, endingPower, helpers, opts = {}) {
  if (!isTwoPlayer(state)) return false;
  if (endingPower !== 'protestant') return false;
  if (state.rulers?.england !== 'mary_i') return false;
  // Don't stomp an unresolved interaction, and skip once England is all-Catholic.
  if (state.pendingReformation) return false;
  if (allEnglishHomeCatholic(state)) return false;

  const die = opts.die ?? rollDice(1)[0];
  helpers.logEvent(state, 'mary_i_2p_check', { die });
  if (die <= 4) return false; // continue to the Papal impulse normally

  // 5–6: the Papacy draws a Main-Deck card and acts vs the English zone.
  const cardNumber = state.deck.shift();
  if (cardNumber == null) return false;
  state.discard.push(cardNumber);
  const cp = CARD_BY_NUMBER[cardNumber]?.cp || 0;
  if (cp >= 1) {
    const attempts = Math.min(cp, 2); // Burn Books = up to 2 attempts
    state.pendingReformation = {
      type: 'counter_reformation', zone: 'english',
      attemptsLeft: attempts, initiator: 'papacy'
    };
    helpers.logEvent(state, 'mary_i_2p_action', {
      action: cp >= 3 ? 'burn_books_and_debate' : 'burn_books',
      cp, drawnCard: cardNumber, attempts
    });
  }
  return true;
}
