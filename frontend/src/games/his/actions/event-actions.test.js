/**
 * Tests for event card handlers
 */

import { describe, it, expect } from 'vitest';
import { EVENT_HANDLERS, executeEvent, validateEvent } from './event-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function eventState(overrides = {}) {
  return createTestState({
    turn: 2,
    capturedLeaders: [],
    excommunicatedReformers: [],
    excommunicatedRulers: {},
    mandatoryEventsPlayed: [],
    piracyEnabled: false,
    schmalkaldicLeague: false,
    papacyWinsCounterReformTies: false,
    jesuitFoundingEnabled: false,
    rulerCards: {},
    chateauVp: 0,
    ...overrides
  });
}

describe('EVENT_HANDLERS', () => {
  // ── Card #2: Holy Roman Emperor ────────────────────────────────

  describe('#2 Holy Roman Emperor', () => {
    it('validates only hapsburg can play', () => {
      const state = eventState();
      const result = validateEvent(state, 'france', 2, {});
      expect(result.valid).toBe(false);
    });

    it('validates Charles V not captured', () => {
      const state = eventState({ capturedLeaders: ['charles_v'] });
      const result = validateEvent(state, 'hapsburg', 2, {});
      expect(result.valid).toBe(false);
    });

    it('moves Charles V and grants 5 CP', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      // Ensure Charles V is in some space
      const vienna = state.spaces['Vienna'];
      const hapStack = vienna.units.find(u => u.owner === 'hapsburg');
      if (hapStack && !hapStack.leaders.includes('charles_v')) {
        hapStack.leaders.push('charles_v');
      }

      const result = executeEvent(state, 'hapsburg', 2,
        { targetSpace: 'Brussels' }, helpers);

      expect(result).toEqual({ grantCp: 5 });

      // Charles V should be in Brussels
      const brussels = state.spaces['Brussels'];
      const bStack = brussels.units.find(u => u.owner === 'hapsburg');
      expect(bStack.leaders).toContain('charles_v');

      // Not in Vienna anymore
      const vStack = vienna.units.find(u => u.owner === 'hapsburg');
      expect(vStack.leaders).not.toContain('charles_v');
    });
  });

  // ── Card #4: Patron of the Arts ────────────────────────────────

  describe('#4 Patron of the Arts', () => {
    it('validates only france with Francis I ruler', () => {
      const state = eventState();
      expect(validateEvent(state, 'england', 4, {}).valid).toBe(false);

      state.rulers.france = 'henry_ii';
      expect(validateEvent(state, 'france', 4, {}).valid).toBe(false);
    });

    it('awards VP on good roll', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      // Roll 5 => range 5-7 => 1 VP
      executeEvent(state, 'france', 4, { dieRoll: 5 }, helpers);
      expect(state.vp.france).toBeGreaterThan(0);
    });

    it('adds Milan modifier', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Milan'].controller = 'france';
      // Roll 3 + 2 (Milan) = 5 => 1 VP
      executeEvent(state, 'france', 4, { dieRoll: 3 }, helpers);
      const log = state.eventLog.find(e => e.type === 'event_patron_arts');
      expect(log.data.modifier).toBe(2);
    });
  });

  // ── Card #5: Papal Bull ────────────────────────────────────────

  describe('#5 Papal Bull', () => {
    it('excommunicates a reformer', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 5,
        { mode: 'reformer', reformerId: 'luther' }, helpers);
      expect(state.excommunicatedReformers).toContain('luther');
    });

    it('excommunicates a ruler', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 5,
        { mode: 'ruler', targetPower: 'england' }, helpers);
      expect(state.excommunicatedRulers.england).toBe(true);
    });
  });

  // ── Card #3: Six Wives of Henry VIII ──────────────────────────

  describe('#3 Six Wives of Henry VIII', () => {
    it('validates only england can play', () => {
      const state = eventState();
      const result = validateEvent(state, 'france', 3, { mode: 'war' });
      expect(result.valid).toBe(false);
    });

    it('validates mode is required', () => {
      const state = eventState();
      const result = validateEvent(state, 'england', 3, {});
      expect(result.valid).toBe(false);
    });

    it('war mode declares war and grants 5 CP', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      const result = executeEvent(state, 'england', 3,
        { mode: 'war', targetPower: 'france' }, helpers);

      expect(result).toEqual({ grantCp: 5 });
      expect(state.wars.some(w =>
        (w.a === 'england' && w.b === 'france') ||
        (w.a === 'france' && w.b === 'england')
      )).toBe(true);
    });

    it('marital mode validates Turn 2+ and Henry alive', () => {
      const state = eventState({ turn: 1 });
      const result = validateEvent(state, 'england', 3, { mode: 'marital' });
      expect(result.valid).toBe(false);
    });

    it('marital mode advances status and rolls pregnancy', () => {
      const state = eventState({
        henryMaritalStatus: 'catherine_of_aragon'
      });
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 3,
        { mode: 'marital', dieRoll: 3 }, helpers);

      expect(state.henryMaritalStatus).toBe('ask_divorce');
      expect(state.edwardBorn).toBe(true); // roll 3 = boy
    });

    it('pregnancy roll 4 births Elizabeth', () => {
      const state = eventState({
        henryMaritalStatus: 'ask_divorce'
      });
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 3,
        { mode: 'marital', dieRoll: 4 }, helpers);

      expect(state.henryMaritalStatus).toBe('anne_boleyn');
      expect(state.elizabethBorn).toBe(true);
    });

    it('pregnancy roll 6 births both', () => {
      const state = eventState({
        henryMaritalStatus: 'anne_boleyn'
      });
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 3,
        { mode: 'marital', dieRoll: 6 }, helpers);

      expect(state.edwardBorn).toBe(true);
      expect(state.elizabethBorn).toBe(true);
    });

    it('rejects marital if at last status', () => {
      const state = eventState({
        henryMaritalStatus: 'katherine_parr'
      });
      const result = validateEvent(state, 'england', 3, { mode: 'marital' });
      expect(result.valid).toBe(false);
    });
  });

  // ── Card #9: Barbary Pirates ───────────────────────────────────

  describe('#9 Barbary Pirates', () => {
    it('sets up Algiers with Ottoman units', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'ottoman', 9, {}, helpers);

      const algiers = state.spaces['Algiers'];
      expect(algiers.controller).toBe('ottoman');
      const stack = algiers.units.find(u => u.owner === 'ottoman');
      expect(stack.regulars).toBe(2);
      expect(stack.corsairs).toBe(2);
      expect(stack.leaders).toContain('barbarossa');
      expect(state.piracyEnabled).toBe(true);
    });
  });

  // ── Card #10: Clement VII ─────────────────────────────────────

  describe('#10 Clement VII', () => {
    it('replaces Leo X with Clement VII', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 10, {}, helpers);

      expect(state.rulers.papacy).toBe('clement_vii');
      expect(state.rulerCards.papacy).toBe(10);
    });
  });

  // ── Card #11: Defender of the Faith ────────────────────────────

  describe('#11 Defender of the Faith', () => {
    it('sets up 3 counter-reformation attempts', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 11, {}, helpers);

      expect(state.pendingCounterReformation).toEqual({
        attemptsRemaining: 3,
        zones: 'all',
        playedBy: 'papacy'
      });
    });
  });

  // ── Card #12: Master of Italy ─────────────────────────────────

  describe('#12 Master of Italy', () => {
    it('awards VP for 3+ Italian keys', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      // Give france 3 Italian keys
      state.spaces['Genoa'].controller = 'france';
      state.spaces['Milan'].controller = 'france';
      state.spaces['Florence'].controller = 'france';

      const vpBefore = state.vp.france || 0;
      executeEvent(state, 'ottoman', 12, {}, helpers);

      expect(state.vp.france).toBe(vpBefore + 1);
    });

    it('awards 2 VP for 4+ Italian keys', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      state.spaces['Genoa'].controller = 'hapsburg';
      state.spaces['Milan'].controller = 'hapsburg';
      state.spaces['Florence'].controller = 'hapsburg';
      state.spaces['Naples'].controller = 'hapsburg';

      const vpBefore = state.vp.hapsburg || 0;
      executeEvent(state, 'ottoman', 12, {}, helpers);

      expect(state.vp.hapsburg).toBe(vpBefore + 2);
    });

    it('logs card draws for exactly 2 keys', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      state.spaces['Genoa'].controller = 'france';
      state.spaces['Milan'].controller = 'france';

      executeEvent(state, 'ottoman', 12, {}, helpers);

      const log = state.eventLog.find(e => e.type === 'event_master_of_italy');
      expect(log.data.cardDraws.france).toBe(1);
    });
  });

  // ── Card #13: Schmalkaldic League ──────────────────────────────

  describe('#13 Schmalkaldic League', () => {
    it('validates Turn 2+ with 12 protestant spaces', () => {
      const state = eventState({ turn: 1 });
      expect(validateEvent(state, 'protestant', 13, {}).valid).toBe(false);
    });

    it('sets schmalkaldicLeague flag', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'protestant', 13, {}, helpers);

      expect(state.schmalkaldicLeague).toBe(true);
    });

    it('allows winter context without protestant space check', () => {
      const state = eventState({ turn: 4 });
      const result = validateEvent(state, 'protestant', 13,
        { context: 'winter' });
      expect(result.valid).toBe(true);
    });
  });

  // ── Card #14: Paul III ─────────────────────────────────────────

  describe('#14 Paul III', () => {
    it('replaces Clement VII and enables counter-reform ties', () => {
      const state = eventState();
      state.rulers.papacy = 'clement_vii';
      state.rulerCards = { papacy: 10 };
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 14, {}, helpers);

      expect(state.rulers.papacy).toBe('paul_iii');
      expect(state.papacyWinsCounterReformTies).toBe(true);
      expect(state.removedCards).toContain(10);
    });
  });

  // ── Card #15: Society of Jesus ─────────────────────────────────

  describe('#15 Society of Jesus', () => {
    it('places Jesuit universities and enables founding', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      // Ensure target spaces are catholic
      state.spaces['Rome'].religion = 'catholic';
      state.spaces['Vienna'].religion = 'catholic';

      executeEvent(state, 'papacy', 15,
        { jesuitSpaces: ['Rome', 'Vienna'] }, helpers);

      expect(state.spaces['Rome'].jesuitUniversity).toBe(true);
      expect(state.spaces['Vienna'].jesuitUniversity).toBe(true);
      expect(state.jesuitFoundingEnabled).toBe(true);
    });

    it('limits to 2 spaces', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      state.spaces['Rome'].religion = 'catholic';
      state.spaces['Vienna'].religion = 'catholic';
      state.spaces['Paris'].religion = 'catholic';

      executeEvent(state, 'papacy', 15,
        { jesuitSpaces: ['Rome', 'Vienna', 'Paris'] }, helpers);

      expect(state.spaces['Paris'].jesuitUniversity).toBeFalsy();
    });
  });

  // ── Card #16: Calvin ───────────────────────────────────────────

  describe('#16 Calvin', () => {
    it('replaces Luther with Calvin', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'protestant', 16, {}, helpers);

      expect(state.rulers.protestant).toBe('calvin');
      expect(state.rulerCards.protestant).toBe(16);
    });
  });

  // ── Card #17: Council of Trent ─────────────────────────────────

  describe('#17 Council of Trent', () => {
    it('sets up pending council of trent', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 17, {}, helpers);

      expect(state.pendingCouncilOfTrent).toBeDefined();
      expect(state.pendingCouncilOfTrent.phase).toBe('papacy_choose');
      expect(state.pendingCouncilOfTrent.maxPapacy).toBe(4);
    });
  });

  // ── Card #18: Dragut ───────────────────────────────────────────

  describe('#18 Dragut', () => {
    it('replaces Barbarossa with Dragut', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      // Place Barbarossa somewhere
      const algiers = state.spaces['Algiers'];
      algiers.units.push({
        owner: 'ottoman', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 2,
        leaders: ['barbarossa']
      });

      executeEvent(state, 'ottoman', 18, {}, helpers);

      const stack = algiers.units.find(u => u.owner === 'ottoman');
      expect(stack.leaders).toContain('dragut');
      expect(stack.leaders).not.toContain('barbarossa');
    });
  });

  // ── Card #19: Edward VI ───────────────────────────────────────

  describe('#19 Edward VI', () => {
    it('replaces Henry VIII with Edward VI', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 19, {}, helpers);

      expect(state.rulers.england).toBe('edward_vi');
      expect(state.rulerCards.england).toBe(19);
    });

    it('removes Card #3 from game', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 19, {}, helpers);

      expect(state.removedCards).toContain(3);
    });

    it('places Dudley leader', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 19,
        { dudleySpace: 'London' }, helpers);

      const london = state.spaces['London'];
      const stack = london.units.find(u => u.owner === 'england');
      expect(stack.leaders).toContain('dudley');
    });

    it('sets England to Protestant', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 19, {}, helpers);

      expect(state.englandProtestant).toBe(true);
    });
  });

  // ── Card #21: Mary I ────────────────────────────────────────────

  describe('#21 Mary I', () => {
    it('replaces Edward VI with Mary I', () => {
      const state = eventState();
      state.rulers.england = 'edward_vi';
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 21, {}, helpers);

      expect(state.rulers.england).toBe('mary_i');
      expect(state.rulerCards.england).toBe(21);
    });

    it('removes Card #19 from game', () => {
      const state = eventState();
      state.rulers.england = 'edward_vi';
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 21, {}, helpers);

      expect(state.removedCards).toContain(19);
    });

    it('sets England back to Catholic', () => {
      const state = eventState();
      state.rulers.england = 'edward_vi';
      state.englandProtestant = true;
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 21, {}, helpers);

      expect(state.englandProtestant).toBe(false);
    });
  });

  // ── Card #20: Henry II ────────────────────────────────────────

  describe('#20 Henry II', () => {
    it('replaces Francis I with Henry II', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 20, {}, helpers);

      expect(state.rulers.france).toBe('henry_ii');
      expect(state.rulerCards.france).toBe(20);
    });

    it('removes Card #4 from game', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 20, {}, helpers);

      expect(state.removedCards).toContain(4);
    });
  });

  // ── Card #22: Julius III ────────────────────────────────────────

  describe('#22 Julius III', () => {
    it('replaces Paul III with Julius III', () => {
      const state = eventState();
      state.rulers.papacy = 'paul_iii';
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 22, {}, helpers);

      expect(state.rulers.papacy).toBe('julius_iii');
      expect(state.rulerCards.papacy).toBe(22);
    });

    it('removes Card #14 from game', () => {
      const state = eventState();
      state.rulers.papacy = 'paul_iii';
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 22, {}, helpers);

      expect(state.removedCards).toContain(14);
    });

    it('maintains papacy counter-reform ties', () => {
      const state = eventState();
      state.rulers.papacy = 'paul_iii';
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 22, {}, helpers);

      expect(state.papacyWinsCounterReformTies).toBe(true);
    });
  });

  // ── Card #23: Elizabeth I ───────────────────────────────────────

  describe('#23 Elizabeth I', () => {
    it('replaces Mary I with Elizabeth I', () => {
      const state = eventState();
      state.rulers.england = 'mary_i';
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 23, {}, helpers);

      expect(state.rulers.england).toBe('elizabeth_i');
      expect(state.rulerCards.england).toBe(23);
    });

    it('removes Card #21 from game', () => {
      const state = eventState();
      state.rulers.england = 'mary_i';
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 23, {}, helpers);

      expect(state.removedCards).toContain(21);
    });

    it('sets England to Protestant', () => {
      const state = eventState();
      state.rulers.england = 'mary_i';
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 23, {}, helpers);

      expect(state.englandProtestant).toBe(true);
    });
  });

  // ── Card #97: Scots Raid ────────────────────────────────────────

  describe('#97 Scots Raid', () => {
    it('is ignored if Scotland not allied to France', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      const result = executeEvent(state, 'france', 97, {}, helpers);

      expect(result).toBeUndefined();
      const log = state.eventLog.find(e => e.type === 'event_scots_raid_ignored');
      expect(log).toBeDefined();
    });

    it('switches Stirling to French control when allied', () => {
      const state = eventState();
      state.alliances.push({ a: 'scotland', b: 'france' });
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 97, {}, helpers);

      expect(state.spaces['Stirling'].controller).toBe('france');
    });

    it('displaces non-French/Scottish units from Stirling', () => {
      const state = eventState();
      state.alliances.push({ a: 'scotland', b: 'france' });
      state.spaces['Stirling'].units.push({
        owner: 'england', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 97, {}, helpers);

      const engStack = state.spaces['Stirling'].units.find(u => u.owner === 'england');
      expect(engStack).toBeUndefined();
    });

    it('grants 6 CP normally', () => {
      const state = eventState();
      state.alliances.push({ a: 'scotland', b: 'france' });
      const helpers = createMockHelpers();

      const result = executeEvent(state, 'france', 97, {}, helpers);

      expect(result).toEqual({ grantCp: 6 });
    });

    it('grants 3 CP with leader transfer', () => {
      const state = eventState();
      state.alliances.push({ a: 'scotland', b: 'france' });
      const helpers = createMockHelpers();

      const result = executeEvent(state, 'france', 97,
        { leaderTransfer: true }, helpers);

      expect(result).toEqual({ grantCp: 3 });
    });
  });

  // ── Card #113: Imperial Coronation ──────────────────────────────

  describe('#113 Imperial Coronation', () => {
    it('grants card draws when Charles V is in Italy', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      // Place Charles V in an Italian space
      const genoa = state.spaces['Genoa'];
      let hapStack = genoa.units.find(u => u.owner === 'hapsburg');
      if (!hapStack) {
        hapStack = {
          owner: 'hapsburg', regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        genoa.units.push(hapStack);
      }
      hapStack.leaders.push('charles_v');

      executeEvent(state, 'france', 113, {}, helpers);

      const log = state.eventLog.find(e => e.type === 'event_imperial_coronation');
      expect(log.data.charlesInItaly).toBe(true);
      expect(log.data.cardDraws.hapsburg).toBe(1);
      expect(log.data.cardDraws.france).toBe(1);
    });

    it('no card draws when Charles V not in Italy', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 113, {}, helpers);

      const log = state.eventLog.find(e => e.type === 'event_imperial_coronation');
      expect(log.data.charlesInItaly).toBe(false);
      expect(Object.keys(log.data.cardDraws)).toHaveLength(0);
    });
  });

  // ── Card #114: La Forêt's Embassy ───────────────────────────────

  describe('#114 La Forêt\'s Embassy', () => {
    it('grants card draws when France and Ottoman allied', () => {
      const state = eventState();
      state.alliances.push({ a: 'france', b: 'ottoman' });
      const helpers = createMockHelpers();

      executeEvent(state, 'ottoman', 114, {}, helpers);

      const log = state.eventLog.find(e => e.type === 'event_la_foret_embassy');
      expect(log.data.allied).toBe(true);
      expect(log.data.cardDraws.france).toBe(1);
      expect(log.data.cardDraws.ottoman).toBe(1);
    });

    it('no card draws when not allied', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'ottoman', 114, {}, helpers);

      const log = state.eventLog.find(e => e.type === 'event_la_foret_embassy');
      expect(log.data.allied).toBe(false);
    });
  });

  // ── Utility Functions ──────────────────────────────────────────

  describe('executeEvent', () => {
    it('logs unhandled event', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'ottoman', 999, {}, helpers);

      const log = state.eventLog.find(e => e.type === 'event_unhandled');
      expect(log).toBeDefined();
      expect(log.data.cardNumber).toBe(999);
    });
  });

  describe('validateEvent', () => {
    it('returns valid for unhandled events', () => {
      const state = eventState();
      expect(validateEvent(state, 'ottoman', 999, {}).valid).toBe(true);
    });

    it('returns valid for events without validate', () => {
      const state = eventState();
      // Card #9 has no validate
      expect(validateEvent(state, 'ottoman', 9, {}).valid).toBe(true);
    });
  });
});
