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
import { areAtWar, removeWar, getWarsOf } from '../state/war-helpers.js';
import { isRulerExcommunicated } from '../actions/excommunication-actions.js';

/** Non-player majors the Papacy may end an invasion war with (§9). */
const SUE_FOR_PEACE_POWERS = ['ottoman', 'hapsburg', 'england', 'france'];

// ── Remove-At-War (§9) ────────────────────────────────────────────

/**
 * Powers the Papacy may excommunicate with Papal Bull to end a war: France or
 * Hapsburg, at war with the Papacy, ruler not yet excommunicated — and only if
 * the Papal Bull has not already been used this turn.
 * @param {Object} state
 * @returns {string[]}
 */
export function papalBullTargets(state) {
  if (state.papalBullUsedThisTurn) return [];
  return ['france', 'hapsburg'].filter(
    (p) => areAtWar(state, 'papacy', p) && !isRulerExcommunicated(state, p)
  );
}

/**
 * Powers the Papacy may sue for peace with: any non-player major at war with the
 * Papacy (never the Protestant — no peace after the Schmalkaldic League).
 * @param {Object} state
 * @returns {string[]}
 */
export function sueForPeaceTargets(state) {
  return getWarsOf(state, 'papacy').filter(
    (p) => p !== 'protestant' && SUE_FOR_PEACE_POWERS.includes(p)
  );
}

/**
 * Apply Papal Bull (§9): excommunicate the target ruler, end the war, mark the
 * Bull used this turn, then take the benefit — draw an extra Main-Deck card
 * (default) or regain one Papal home space the target controls.
 * @param {Object} state
 * @param {{ targetPower: string, benefit?: 'draw'|'regain', regainSpace?: string }} actionData
 * @param {Object} helpers
 */
export function applyPapalBull(state, actionData, helpers) {
  const { targetPower, benefit = 'draw', regainSpace } = actionData || {};
  state.excommunicatedRulers = state.excommunicatedRulers || {};
  state.excommunicatedRulers[targetPower] = true;
  removeWar(state, 'papacy', targetPower);
  state.papalBullUsedThisTurn = true;

  if (benefit === 'regain' && regainSpace && state.spaces[regainSpace]) {
    state.spaces[regainSpace].controller = 'papacy';
  } else {
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.papacy = (state.pendingCardDraw.papacy || 0) + 1;
  }
  helpers.logEvent(state, 'diplomacy_2p_papal_bull', { targetPower, benefit });
}

/**
 * Apply Sue for Peace (§9): end the war, award the Protestant 1 War-Winner VP
 * (plus 1 per reclaimed space), remove up to 2 Papal units of the Papacy's
 * choice, and optionally reclaim Papal home spaces.
 * @param {Object} state
 * @param {{ targetPower: string, removeUnits?: Array, reclaimSpaces?: string[] }} actionData
 * @param {Object} helpers
 */
export function applySueForPeace2P(state, actionData, helpers) {
  const { targetPower, reclaimSpaces = [] } = actionData || {};
  // Accept either an explicit removeUnits array or unit1/unit2 space keys from
  // the selection flow.
  const removeUnits = actionData?.removeUnits?.length
    ? actionData.removeUnits
    : [actionData?.unit1, actionData?.unit2].filter(Boolean).map((space) => ({ space }));
  removeWar(state, 'papacy', targetPower);
  state.bonusVp = state.bonusVp || {};
  state.bonusVp.protestant = (state.bonusVp.protestant || 0) + 1 + reclaimSpaces.length;

  let removed = 0;
  for (const entry of removeUnits.slice(0, 2)) {
    const space = state.spaces[entry?.space ?? entry];
    const stack = (space?.units || []).find((u) => u.owner === 'papacy');
    if (!stack) continue;
    if (stack.regulars > 0) { stack.regulars--; removed++; }
    else if (stack.mercenaries > 0) { stack.mercenaries--; removed++; }
    else if (stack.squadrons > 0) { stack.squadrons--; removed++; }
  }
  for (const s of reclaimSpaces) {
    if (state.spaces[s]) state.spaces[s].controller = 'papacy';
  }
  helpers.logEvent(state, 'diplomacy_2p_sue_for_peace', {
    targetPower, unitsRemoved: removed, reclaimed: reclaimSpaces.length
  });
}

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
  state.papalBullUsedThisTurn = false; // resets each Diplomacy phase

  // First turn after the Schmalkaldic League: fold the post-SL cards in.
  if (state.schmalkaldicLeagueFormed && !state.diplomacySLAdded) {
    addSchmalkaldicDiplomacyCards(state);
    helpers.logEvent(state, 'diplomacy_2p_sl_cards_added', {
      deckSize: state.diplomacyDeck.length
    });
  }

  // §9: the Papacy may end a war (Papal Bull / sue for peace) BEFORE the deal.
  // Only enter that step when a removable war exists; otherwise deal straight away.
  if (papalBullTargets(state).length > 0 || sueForPeaceTargets(state).length > 0) {
    state.diplomacy2P = { stage: 'remove_war', pendingPlayers: [] };
    helpers.logEvent(state, 'diplomacy_2p_remove_war_start', {
      papalBull: papalBullTargets(state), sue: sueForPeaceTargets(state)
    });
    return;
  }

  dealDiplomacy2P(state, helpers);
}

/**
 * Deal one card to each side and queue the play order (Papacy then Protestant)
 * for Turn 2+. Sets stage to 'play'.
 * @param {Object} state
 * @param {Object} helpers
 */
function dealDiplomacy2P(state, helpers) {
  const dealt = {};
  for (const side of DIPLOMACY_SIDES) {
    dealt[side] = drawDiplomacyCard(state, side);
  }
  // Turn 1: draw only, no play (§9). Turn 2+: Papacy then Protestant each play 1.
  state.diplomacy2P = {
    stage: 'play',
    pendingPlayers: state.turn >= 2
      ? DIPLOMACY_SIDES.filter((side) => (state.diplomacyHands[side] || []).length > 0)
      : []
  };
  helpers.logEvent(state, 'diplomacy_2p_start', {
    turn: state.turn, dealt, willPlay: state.diplomacy2P.pendingPlayers
  });
}

/**
 * Whether the two-player Diplomacy phase is waiting on player input — either the
 * Papacy's Remove-At-War step or a queued card play.
 * @param {Object} state
 * @returns {boolean}
 */
export function diplomacy2PNeedsInput(state) {
  const d = state.diplomacy2P;
  return d?.stage === 'remove_war' || (d?.pendingPlayers?.length || 0) > 0;
}

/**
 * The side that must act next: the Papacy during Remove-At-War, otherwise the
 * head of the play queue (or null).
 * @param {Object} state
 * @returns {string|null}
 */
export function getDiplomacy2PActor(state) {
  if (state.diplomacy2P?.stage === 'remove_war') return 'papacy';
  return state.diplomacy2P?.pendingPlayers?.[0] || null;
}

/**
 * Apply a Papacy Remove-At-War action (§9). `kind` is 'papal_bull' |
 * 'sue_for_peace' | 'done'. After 'done' (or skip) the cards are dealt and the
 * phase moves to the play stage.
 * @param {Object} state
 * @param {string} kind
 * @param {Object} actionData
 * @param {Object} helpers
 * @returns {{ ok: boolean, done: boolean, error?: string }}
 *   `done` is true when the phase can advance (e.g. Turn 1 deal with no plays).
 */
export function applyRemoveAtWarAction(state, kind, actionData, helpers) {
  if (state.diplomacy2P?.stage !== 'remove_war') {
    return { ok: false, done: false, error: 'Not in the Remove-At-War step' };
  }

  if (kind === 'papal_bull') {
    if (!papalBullTargets(state).includes(actionData?.targetPower)) {
      return { ok: false, done: false, error: 'Invalid Papal Bull target' };
    }
    applyPapalBull(state, actionData, helpers);
    resolvePendingCardDraws(state, helpers); // the 'draw' benefit
    return { ok: true, done: false };
  }

  if (kind === 'sue_for_peace') {
    if (!sueForPeaceTargets(state).includes(actionData?.targetPower)) {
      return { ok: false, done: false, error: 'Invalid sue-for-peace target' };
    }
    applySueForPeace2P(state, actionData, helpers);
    return { ok: true, done: false };
  }

  if (kind === 'done') {
    dealDiplomacy2P(state, helpers);
    return { ok: true, done: !diplomacy2PNeedsInput(state) };
  }

  return { ok: false, done: false, error: 'Unknown Remove-At-War action' };
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
