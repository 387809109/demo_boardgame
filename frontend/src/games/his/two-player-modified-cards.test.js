/**
 * Here I Stand — Two-Player Variant, Phase 3-C (Modified Cards)
 *
 * Six cards resolve differently in the variant (Scenarios.pdf "Modified Cards").
 * Each is an isTwoPlayer-gated delta on the existing handler; standard 3–6p play
 * is unchanged. Covers #5 Papal Bull, #13 Schmalkaldic League (Rome/Ravenna
 * lock), #63 Dissolution, #70 Charles Bourbon, #71 City State Rebels, #95 Sack
 * of Rome.
 */

import { describe, it, expect } from 'vitest';
import { buildInitialState } from './state/state-init.js';
import { executeEvent, validateEvent } from './actions/event-actions.js';
import { validateControlUnfortified } from './actions/military-actions.js';
import { SPACE_BY_NAME } from './data/map-data.js';

const PLAYERS = [{ id: 'p1', nickname: 'Host', isHost: true }];
const OPTS = {
  variant: 'two_player', powerAssignment: [['papacy', 'protestant']], rngSeed: 5
};
const make2pState = () => buildInitialState(PLAYERS, { ...OPTS });
const logHelpers = () => ({ logEvent: (s, type, data) => (s.eventLog = s.eventLog || []).push({ type, data }) });
const spaceInZone = (zone) => Object.keys(SPACE_BY_NAME).find((n) => SPACE_BY_NAME[n].languageZone === zone);

describe('#5 Papal Bull — event disabled in 2P', () => {
  it('rejects the standard event play in the variant', () => {
    const st = make2pState();
    const res = validateEvent(st, 'papacy', 5, { mode: 'reformer' });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Diplomacy-Phase|§9/);
  });

  it('does not apply the block outside the variant', () => {
    const st = make2pState();
    st.variant = undefined; // standard 3–6p
    const res = validateEvent(st, 'papacy', 5, { mode: 'reformer' });
    // May be valid or fail for a real reason, but NOT the 2P block.
    expect(res.error || '').not.toMatch(/Diplomacy-Phase/);
  });
});

describe('#63 Dissolution of the Monasteries — 2P', () => {
  it('discards a random Papal card and sets the English reformation', () => {
    const st = make2pState();
    st.hands.papacy = [33, 36, 40];
    st.discard = [];
    executeEvent(st, 'protestant', 63, {}, logHelpers());

    expect(st.hands.papacy).toHaveLength(2); // one removed
    expect(st.discard).toHaveLength(1);
    expect(st.pendingReformation).toMatchObject({ attemptsRemaining: 3, zones: 'english' });
    expect(st.pendingCardDraw?.england).toBeFalsy(); // no English card draw in 2P
  });
});

describe('#70 Charles Bourbon — 2P German/Italian placement', () => {
  it('accepts a German/Italian target and rejects others', () => {
    const st = make2pState();
    const german = spaceInZone('german');
    const french = spaceInZone('french');
    expect(validateEvent(st, 'france', 70, { targetSpace: german }).valid).toBe(true);
    expect(validateEvent(st, 'france', 70, { targetSpace: french }).valid).toBe(false);
  });

  it('does not place outside the German/Italian zones', () => {
    const st = make2pState();
    const french = spaceInZone('french');
    executeEvent(st, 'france', 70, { targetSpace: french }, logHelpers());
    const stack = (st.spaces[french].units || []).find((u) => u.owner === 'france');
    expect(stack?.leaders || []).not.toContain('charles_bourbon');
  });
});

describe('#95 Sack of Rome — 2P non-player merc owner gets no Papal card', () => {
  it('discards both drawn cards when the sacker is Hapsburg', () => {
    const st = make2pState();
    st.spaces.Rome.units = [{
      owner: 'papacy', regulars: 0, mercenaries: 0, cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];
    const italian = spaceInZone('italian');
    st.spaces[italian].units = [{
      owner: 'hapsburg', regulars: 0, mercenaries: 3, cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    }];
    st.hands.papacy = [33, 36, 40]; // 3 cards so the base draw loop yields 2
    st.hands.hapsburg = [];
    st.discard = [];

    // Force a Papal loss (attacker 2 hits, defender 0).
    executeEvent(st, 'hapsburg', 95, {
      fromSpace: italian, attackerDice: [5, 5], defenderDice: [1]
    }, logHelpers());

    // The Hapsburg (non-player) sacker receives NO Papal card; both drawn cards
    // go to the discard instead.
    expect(st.hands.hapsburg).toHaveLength(0);
    expect(st.hands.papacy).toHaveLength(1); // 2 of the 3 were taken
    expect(st.discard).toHaveLength(2);
  });
});

describe('#13 Schmalkaldic League — Rome/Ravenna lock (2P)', () => {
  it('records the lock and blocks re-controlling a locked space', () => {
    const st = make2pState();
    st.spaces.Rome.controller = 'hapsburg';
    executeEvent(st, 'papacy', 13, {}, logHelpers());

    expect(st.lockedHapsburgControl).toContain('Rome');
    const res = validateControlUnfortified(st, 'papacy', { space: 'Rome' });
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Hapsburg/);
  });
});

describe('#71 City State Rebels — 2P Hapsburg electorate target', () => {
  it('flags a Hapsburg-controlled electorate target after the League', () => {
    const st = make2pState();
    st.schmalkaldicLeagueFormed = true;
    const electorate = Object.keys(SPACE_BY_NAME).find((n) => SPACE_BY_NAME[n].isElectorate);
    st.spaces[electorate].controller = 'hapsburg';

    const h = logHelpers();
    executeEvent(st, 'protestant', 71, {
      targetSpace: electorate, die0: 1, die1: 1, die2: 1, die3: 1, die4: 1
    }, h);
    const log = st.eventLog.find((e) => e.type === 'event_city_state_rebels');
    expect(log.data.hapsburgElectorate).toBe(true);
  });
});
