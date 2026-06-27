/**
 * Here I Stand — Two-Player Variant, Phase 3 (England Automation §21.3)
 *
 * England is a non-player power, so its Reformation trajectory unfolds
 * automatically: the §21.3 schedule (Anne Boleyn marriage, English reformers,
 * Edward VI entering the deck, forced succession at Winter T7/T8) plus the
 * Mary-I per-impulse procedure where the Papacy pressures the English zone.
 */

import { describe, it, expect } from 'vitest';
import { HISGame } from './index.js';
import { buildInitialState } from './state/state-init.js';
import { isHomeSpace } from './state/state-helpers.js';
import {
  scheduleEnglandSuccession2P, forceEnglandSuccession2P, maybeMaryIImpulse2P
} from './phases/england-succession-2p.js';

const PLAYERS = [{ id: 'p1', nickname: 'Host', isHost: true }];
const OPTS = {
  variant: 'two_player', powerAssignment: [['papacy', 'protestant']], rngSeed: 9
};
const helpers = { logEvent: () => {} };
const make2pState = () => buildInitialState(PLAYERS, { ...OPTS });
const englishHomeNames = (st) => Object.keys(st.spaces).filter((n) => isHomeSpace(n, 'england'));
const englishHome = (st) => {
  const name = englishHomeNames(st)[0];
  return name ? st.spaces[name] : undefined;
};

describe('England succession schedule (§21.3, Card Draw)', () => {
  it('T4 marries Anne Boleyn (opens the English Reformation)', () => {
    const st = make2pState();
    st.turn = 4;
    scheduleEnglandSuccession2P(st, helpers);
    expect(st.henryMaritalStatus).toBe('anne_boleyn');
  });

  it('T5 brings Cranmer/Latimer/Coverdale into the Protestant debater pool', () => {
    const st = make2pState();
    st.turn = 5;
    scheduleEnglandSuccession2P(st, helpers);
    const ids = st.debaters.protestant.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['cranmer', 'coverdale', 'latimer']));
  });

  it('T6 adds Edward VI (#19) to the Main Deck exactly once', () => {
    const st = make2pState();
    st.turn = 6;
    scheduleEnglandSuccession2P(st, helpers);
    scheduleEnglandSuccession2P(st, helpers); // idempotent
    expect(st.deck.filter((c) => c === 19)).toHaveLength(1);
  });

  it('is a no-op in a standard (non-variant) game', () => {
    const st = make2pState();
    st.variant = undefined; // standard 3–6p
    st.turn = 6;
    const deckBefore = st.deck.length;
    scheduleEnglandSuccession2P(st, helpers);
    expect(st.henryMaritalStatus).toBe('catherine_of_aragon');
    expect(st.deck.length).toBe(deckBefore);
  });
});

describe('Forced England succession (§21.3, Winter)', () => {
  it('Winter T7 fires Edward VI → England turns Protestant', () => {
    const st = make2pState();
    st.turn = 7;
    expect(st.rulers.england).toBe('henry_viii');
    forceEnglandSuccession2P(st, helpers);
    expect(st.rulers.england).toBe('edward_vi');
    expect(st.englandProtestant).toBe(true);
    expect(st.deck).not.toContain(19); // the card is consumed
  });

  it('Winter T8 fires Mary I → England turns Catholic', () => {
    const st = make2pState();
    st.turn = 8;
    st.rulers.england = 'edward_vi'; // Edward already succeeded
    forceEnglandSuccession2P(st, helpers);
    expect(st.rulers.england).toBe('mary_i');
    expect(st.englandProtestant).toBe(false);
  });

  it('does not skip Henry or double-fire (T7 with Edward already ruling)', () => {
    const st = make2pState();
    st.turn = 7;
    st.rulers.england = 'edward_vi';
    forceEnglandSuccession2P(st, helpers);
    expect(st.rulers.england).toBe('edward_vi'); // no Mary I until T8
  });
});

describe('Mary-I per-impulse procedure (§21.3)', () => {
  function maryState() {
    const st = make2pState();
    st.rulers.england = 'mary_i';
    st.pendingReformation = null;
    const eng = englishHome(st);
    expect(eng).toBeTruthy();
    eng.religion = 'protestant'; // not all-Catholic
    return st;
  }

  it('die 5–6: the Papacy draws a card and sets up an English counter-reformation', () => {
    const st = maryState();
    const deckBefore = st.deck.length;
    const acted = maybeMaryIImpulse2P(st, 'protestant', helpers, { die: 6 });
    expect(acted).toBe(true);
    expect(st.pendingReformation).toMatchObject({
      type: 'counter_reformation', zone: 'english', initiator: 'papacy'
    });
    expect(st.deck.length).toBe(deckBefore - 1);
  });

  it('die 1–4: no Papal action (continue to the Papal impulse)', () => {
    const st = maryState();
    expect(maybeMaryIImpulse2P(st, 'protestant', helpers, { die: 3 })).toBe(false);
    expect(st.pendingReformation).toBeNull();
  });

  it('only runs after a Protestant impulse', () => {
    const st = maryState();
    expect(maybeMaryIImpulse2P(st, 'papacy', helpers, { die: 6 })).toBe(false);
  });

  it('skips once every English home space is Catholic', () => {
    const st = maryState();
    for (const name of englishHomeNames(st)) st.spaces[name].religion = 'catholic';
    expect(maybeMaryIImpulse2P(st, 'protestant', helpers, { die: 6 })).toBe(false);
  });

  it('does not fire under any other English ruler', () => {
    const st = maryState();
    st.rulers.england = 'edward_vi';
    expect(maybeMaryIImpulse2P(st, 'protestant', helpers, { die: 6 })).toBe(false);
  });
});

describe('Mary-I impulse hook wiring (index.js)', () => {
  it('_handleEndImpulse runs the Mary-I check after a Protestant impulse', () => {
    const game = new HISGame('offline');
    game.start({ players: PLAYERS, gameType: 'his', options: { ...OPTS } });
    const s = game.getState();
    s.rulers.england = 'mary_i';
    s.pendingReformation = null;
    englishHome(s).religion = 'protestant';
    const h = { logEvent: (st, type, data) => (st.eventLog = st.eventLog || []).push({ type, data }) };

    game._handleEndImpulse(s, 'protestant', h);
    expect(s.eventLog.some((e) => e.type === 'mary_i_2p_check')).toBe(true);
  });
});
