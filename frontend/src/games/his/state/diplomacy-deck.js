/**
 * Here I Stand — Diplomacy Deck Subsystem
 *
 * SCOPE NOTE — this is a TWO-PLAYER-GAME component. In the HIS two-player game
 * the absent major powers (France, Hapsburg, Ottoman, …) are simulated by a
 * special Diplomatic Deck that the two sides — Papacy and Protestant — draw from
 * and play. In the 3–6 player game this project ships, those powers are real
 * players, so the diplomacy cards (#201-219) are NOT used and this deck is NOT
 * dealt during the normal turn flow (see config.json minPlayers:3 and
 * docs/games/his/SCENARIO_1517_SETUP.md: "Extract if/when 2-player variant is
 * implemented").
 *
 * This module implements the deck as a self-contained subsystem — state +
 * deal/play/discard/reshuffle helpers + the #205/#215 card mechanics that
 * manipulate it — so the two-player variant can consume it later, and so cards
 * #205 Diplomatic Pressure and #215 Machiavelli are backed by real mechanics
 * instead of dead `pending*` markers. It is intentionally not invoked from the
 * 3–6 player engine; a future two-player setup calls `initDiplomacyDeck`.
 *
 * Mechanics are faithful to the project's own two-player sequence reference
 * (his_ref/img/_vmod_docs/sequence_twoplayer.html): the SL cards (213-219) join
 * the deck when the Schmalkaldic League forms; each side draws 1 card per turn;
 * from Turn 2 each side plays 1 card.
 */

import { CARDS, CARD_BY_NUMBER } from '../data/cards.js';
import { rng } from './rng.js';

/** The two sides that hold diplomacy hands (the two-player coalitions). */
export const DIPLOMACY_SIDES = ['papacy', 'protestant'];

/** Base diplomacy cards, available from the start (deck: 'diplomacy'). */
export const BASE_DIPLOMACY_CARDS = CARDS
  .filter(c => c.deck === 'diplomacy')
  .map(c => c.number);

/** Post-Schmalkaldic-League diplomacy cards (deck: 'diplomacy_sl'). */
export const SL_DIPLOMACY_CARDS = CARDS
  .filter(c => c.deck === 'diplomacy_sl')
  .map(c => c.number);

/**
 * @param {string} side - 'papacy' | 'protestant'
 * @returns {string} the opposing diplomacy side
 */
export function diplomacyOpponent(side) {
  return side === 'papacy' ? 'protestant' : 'papacy';
}

/**
 * @param {number} cardNumber
 * @returns {boolean} whether the card is an Invasion diplomacy card (#215 target)
 */
export function isInvasionCard(cardNumber) {
  return CARD_BY_NUMBER[cardNumber]?.category === 'Invasion';
}

/**
 * Whether the diplomacy-deck subsystem is active on this state. The 3–6 player
 * engine never initializes it; only a two-player setup (or a test) does.
 * @param {Object} state
 * @returns {boolean}
 */
export function isDiplomacyDeckActive(state) {
  return !!(state && state.diplomacyHands && state.diplomacyDeck);
}

/**
 * Initialize the subsystem on a state: shuffled base deck, empty hands / discard
 * / played-this-turn. Call this from a two-player game setup. Overwrites.
 * @param {Object} state
 * @returns {Object} state
 */
export function initDiplomacyDeck(state) {
  state.diplomacyDeck = shuffle([...BASE_DIPLOMACY_CARDS]);
  state.diplomacyHands = { papacy: [], protestant: [] };
  state.diplomacyDiscard = [];
  state.diplomacyPlayedThisTurn = [];
  state.diplomacySLAdded = false;
  state.diplomacyForcedPlay = null;
  return state;
}

/**
 * Initialize the subsystem only if it has not been initialized yet. Used by the
 * #205/#215 handlers so they are self-sufficient when reached (in a two-player
 * game the deck already exists; in a test it may not).
 * @param {Object} state
 * @returns {Object} state
 */
export function ensureDiplomacyDeck(state) {
  if (!state.diplomacyHands || !state.diplomacyDeck) initDiplomacyDeck(state);
  return state;
}

/** Fisher-Yates shuffle in place using the seedable deck RNG (rng.js). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffle the draw deck in place.
 * @param {Object} state
 * @returns {Object} state
 */
export function shuffleDiplomacyDeck(state) {
  if (state.diplomacyDeck) shuffle(state.diplomacyDeck);
  return state;
}

/** Remove the first occurrence of value from arr (in place). @returns {boolean} */
function removeFrom(arr, value) {
  if (!Array.isArray(arr)) return false;
  const idx = arr.indexOf(value);
  if (idx < 0) return false;
  arr.splice(idx, 1);
  return true;
}

/**
 * Remove a card from every diplomacy pile (deck, discard, played-this-turn, both
 * hands). Used when relocating a specific card (e.g. Machiavelli #215).
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {boolean} whether the card was found somewhere
 */
export function removeFromDiplomacyPiles(state, cardNumber) {
  let found = false;
  found = removeFrom(state.diplomacyDeck, cardNumber) || found;
  found = removeFrom(state.diplomacyDiscard, cardNumber) || found;
  found = removeFrom(state.diplomacyPlayedThisTurn, cardNumber) || found;
  found = removeFrom(state.diplomacyHands?.papacy, cardNumber) || found;
  found = removeFrom(state.diplomacyHands?.protestant, cardNumber) || found;
  return found;
}

/**
 * Add the post-SL diplomacy cards (213-219) to the deck and shuffle them in.
 * No-op unless the subsystem is active, and idempotent (only adds once). Skips
 * any SL card already present anywhere.
 * @param {Object} state
 * @returns {Object} state
 */
export function addSchmalkaldicDiplomacyCards(state) {
  if (!isDiplomacyDeckActive(state)) return state;
  if (state.diplomacySLAdded) return state;

  const present = new Set([
    ...state.diplomacyDeck,
    ...state.diplomacyDiscard,
    ...state.diplomacyPlayedThisTurn,
    ...state.diplomacyHands.papacy,
    ...state.diplomacyHands.protestant
  ]);
  for (const c of SL_DIPLOMACY_CARDS) {
    if (!present.has(c)) state.diplomacyDeck.push(c);
  }
  shuffle(state.diplomacyDeck);
  state.diplomacySLAdded = true;
  return state;
}

/**
 * Reshuffle the discard pile back into the deck (when the deck empties).
 * Played-this-turn cards stay out unless `includePlayed`.
 * @param {Object} state
 * @param {{ includePlayed?: boolean }} [opts]
 * @returns {Object} state
 */
export function reshuffleDiplomacyDeck(state, { includePlayed = false } = {}) {
  ensureDiplomacyDeck(state);
  state.diplomacyDeck.push(...state.diplomacyDiscard);
  state.diplomacyDiscard = [];
  if (includePlayed) {
    state.diplomacyDeck.push(...state.diplomacyPlayedThisTurn);
    state.diplomacyPlayedThisTurn = [];
  }
  shuffle(state.diplomacyDeck);
  return state;
}

/**
 * Draw one card from the deck into a side's hand. Reshuffles the discard pile in
 * if the deck is empty.
 * @param {Object} state
 * @param {string} side - 'papacy' | 'protestant'
 * @returns {number|null} the drawn card number, or null if none available
 */
export function drawDiplomacyCard(state, side) {
  ensureDiplomacyDeck(state);
  if (state.diplomacyDeck.length === 0) reshuffleDiplomacyDeck(state);
  if (state.diplomacyDeck.length === 0) return null;
  const card = state.diplomacyDeck.shift();
  state.diplomacyHands[side].push(card);
  return card;
}

/**
 * Play a card from a side's hand: move it to played-this-turn. The card's event
 * effect is resolved separately by the caller. Honors a #205 forced-play
 * constraint if one targets this side.
 * @param {Object} state
 * @param {string} side
 * @param {number} cardNumber
 * @returns {boolean} whether the card was in hand and played
 */
export function playDiplomacyCard(state, side, cardNumber) {
  const hand = state.diplomacyHands?.[side];
  if (!hand) return false;
  const idx = hand.indexOf(cardNumber);
  if (idx < 0) return false;
  hand.splice(idx, 1);
  state.diplomacyPlayedThisTurn.push(cardNumber);
  // Clear a satisfied forced-play constraint (#205 Papacy dictates a play).
  if (state.diplomacyForcedPlay?.side === side &&
      state.diplomacyForcedPlay?.card === cardNumber) {
    state.diplomacyForcedPlay = null;
  }
  return true;
}

/**
 * Discard a card directly from a side's hand (e.g. #205 force-discard).
 * @param {Object} state
 * @param {string} side
 * @param {number} cardNumber
 * @returns {boolean} whether the card was removed
 */
export function discardDiplomacyCard(state, side, cardNumber) {
  const hand = state.diplomacyHands?.[side];
  if (!hand) return false;
  const idx = hand.indexOf(cardNumber);
  if (idx < 0) return false;
  hand.splice(idx, 1);
  state.diplomacyDiscard.push(cardNumber);
  return true;
}

/**
 * Swap one card between the two sides' hands (#205 Protestant swap option).
 * Missing cards are tolerated (a one-sided move still happens for whatever is
 * present), mirroring how the other diplomacy helpers degrade gracefully.
 * @param {Object} state
 * @param {string} sideA
 * @param {number} cardA - card to move from A to B
 * @param {string} sideB
 * @param {number} cardB - card to move from B to A
 * @returns {Object} state
 */
export function swapDiplomacyCards(state, sideA, cardA, sideB, cardB) {
  const handA = state.diplomacyHands?.[sideA];
  const handB = state.diplomacyHands?.[sideB];
  if (!handA || !handB) return state;
  const hadA = removeFrom(handA, cardA);
  const hadB = removeFrom(handB, cardB);
  if (hadA && cardA != null) handB.push(cardA);
  if (hadB && cardB != null) handA.push(cardB);
  return state;
}

/**
 * End-of-turn cleanup: move played-this-turn cards to the discard pile and clear
 * any leftover forced-play constraint.
 * @param {Object} state
 * @returns {Object} state
 */
export function endDiplomacyTurn(state) {
  if (!state.diplomacyPlayedThisTurn) return state;
  state.diplomacyDiscard.push(...state.diplomacyPlayedThisTurn);
  state.diplomacyPlayedThisTurn = [];
  state.diplomacyForcedPlay = null;
  return state;
}

/**
 * The diplomacy side trailing in VP (lower VP makes the choice); ties go to
 * `tieBreakSide`. Used by Machiavelli #215.
 * @param {Object} state
 * @param {string} tieBreakSide
 * @returns {string} 'papacy' | 'protestant'
 */
export function trailingDiplomacySide(state, tieBreakSide) {
  const pv = state.vp?.papacy ?? 0;
  const tv = state.vp?.protestant ?? 0;
  if (pv < tv) return 'papacy';
  if (tv < pv) return 'protestant';
  return DIPLOMACY_SIDES.includes(tieBreakSide) ? tieBreakSide : 'papacy';
}
