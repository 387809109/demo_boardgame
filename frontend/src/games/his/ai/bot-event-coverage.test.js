/**
 * Here I Stand — Bot Event Coverage (gate-parity invariant)
 *
 * Deterministic, exhaustive sweep over every card the bot has event criteria
 * for. Invariant: if the bot would route a card to PLAY_CARD_EVENT, the
 * engine's validateEvent must accept it — otherwise the bot routes an event the
 * engine rejects → [BOT STUCK] (the #R/#Z/#P/#Q anomaly class).
 *
 * This is the dynamic, full-coverage form of the static gate-parity audit
 * (docs/games/his/bot_anomalies/2026-06-14_gate-parity-audit.md): O(profiles ×
 * cards × powers) read-only checks rather than relying on random full-bot games
 * to surface each card by luck.
 *
 * Two state profiles widen coverage:
 *  - baseline: fresh turn-1 scenario (preconditions mostly unmet — catches
 *    cards whose criteria ignore an unmet engine precondition).
 *  - unlocked: mid-turn with the unlock flags set and broad wars (exercises the
 *    precondition-MET / eligible path for flag- and war-gated cards).
 */

import { describe, it, expect } from 'vitest';
import { buildInitialState } from '../state/state-init.js';
import { TEST_PLAYERS } from '../test-helpers.js';
import { addWar } from '../state/war-helpers.js';
import { initBotDecks } from './bot-controller.js';
import {
  EVENT_CRITERIA, shouldPlayEvent, eventScore, hasEventScore
} from './bot-event-criteria.js';
import { buildEventActionData } from './bot-card-play.js';
import { validateEvent } from '../actions/event-actions.js';

const POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];

/** Mirror routeEventCard's gate: scored cards on eventScore>0, else shouldPlayEvent. */
function botWantsEvent(state, power, cardNumber) {
  return hasEventScore(cardNumber)
    ? eventScore(state, power, cardNumber) > 0
    : shouldPlayEvent(state, power, cardNumber);
}

function baselineState() {
  const state = buildInitialState(TEST_PLAYERS, {});
  initBotDecks(state, POWERS);
  return state;
}

/** Mid-turn state with unlock flags set and broad wars. */
function unlockedState() {
  const state = baselineState();
  state.turn = 6;
  state.turnNumber = 6;
  Object.assign(state, {
    piracyEnabled: true,
    jesuitFoundingEnabled: true,
    schmalkaldicLeagueFormed: true,
    englandRulerChangedThisTurn: true,
    edwardBorn: true,
    lutherPlaced: true
  });
  // Broad war web so war-conditional criteria become eligible.
  addWar(state, 'ottoman', 'hapsburg');
  addWar(state, 'hapsburg', 'france');
  addWar(state, 'france', 'england');
  addWar(state, 'papacy', 'protestant');
  addWar(state, 'hapsburg', 'protestant');
  return state;
}

describe('event coverage — bot-wants-event ⟹ engine-validates', () => {
  for (const [profile, build] of [['baseline', baselineState], ['unlocked', unlockedState]]) {
    it(`no card routed to event that validateEvent rejects (${profile})`, () => {
      // botWantsEvent / validateEvent are read-only → one shared state per power.
      const states = {};
      for (const p of POWERS) states[p] = build();

      const violations = [];
      for (const key of Object.keys(EVENT_CRITERIA)) {
        const cardNumber = Number(key);
        for (const power of POWERS) {
          const state = states[power];
          if (!botWantsEvent(state, power, cardNumber)) continue;
          const actionData = buildEventActionData(state, cardNumber);
          const r = validateEvent(state, power, cardNumber, actionData);
          if (!r.valid) violations.push(`card ${cardNumber} / ${power}: ${r.error}`);
        }
      }
      expect(violations).toEqual([]);
    });
  }
});
