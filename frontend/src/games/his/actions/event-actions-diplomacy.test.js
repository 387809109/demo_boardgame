/**
 * Tests for diplomacy deck event card handlers (#201-219)
 */

import { describe, it, expect } from 'vitest';
import { EVENT_HANDLERS, executeEvent } from './event-actions.js';
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

describe('Diplomacy Event Handlers (#201-219)', () => {

  // ── #201 Andrea Doria (Diplomacy) ───────────────────────────────
  describe('#201 Andrea Doria', () => {
    it('activates Genoa for Papacy', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 201, {}, helpers);
      expect(state.minorPowers.genoa.ally).toBe('papacy');
    });

    it('activates Genoa as French ally for Protestant', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 201, {}, helpers);
      expect(state.minorPowers.genoa.ally).toBe('france');
    });
  });

  // ── #202 French Constable Invades ───────────────────────────────
  describe('#202 French Constable Invades', () => {
    it('declares France-Papacy war and places units', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 202,
        { targetSpace: 'Paris' }, helpers);
      expect(state.wars.some(w =>
        (w.a === 'france' && w.b === 'papacy') ||
        (w.a === 'papacy' && w.b === 'france')
      )).toBe(true);
      const stack = state.spaces['Paris'].units.find(
        u => u.owner === 'france');
      expect(stack.leaders).toContain('montmorency');
      expect(stack.regulars).toBeGreaterThanOrEqual(2);
    });
  });

  // ── #203 Corsair Raid ───────────────────────────────────────────
  describe('#203 Corsair Raid', () => {
    it('rolls 4 dice and counts hits', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 203,
        { die0: 5, die1: 6, die2: 3, die3: 1 }, helpers);
      const log = state.eventLog.find(
        e => e.type === 'event_diplo_corsair_raid');
      expect(log.data.hits).toBe(2);
    });
  });

  // ── #206 French Invasion ────────────────────────────────────────
  describe('#206 French Invasion', () => {
    it('places French ruler and 3+3 units', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 206,
        { targetSpace: 'Paris' }, helpers);
      const stack = state.spaces['Paris'].units.find(
        u => u.owner === 'france');
      expect(stack.regulars).toBeGreaterThanOrEqual(3);
      expect(stack.mercenaries).toBeGreaterThanOrEqual(3);
    });
  });

  // ── #207 Henry Petitions for Divorce ────────────────────────────
  describe('#207 Henry Petitions for Divorce', () => {
    it('refused: adds Hapsburg regulars', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 207, {
        choice: 'refused',
        placements: [{ space: 'Vienna', count: 3 }]
      }, helpers);
      const stack = state.spaces['Vienna'].units.find(
        u => u.owner === 'hapsburg');
      expect(stack.regulars).toBeGreaterThanOrEqual(3);
    });

    it('granted: sets up debate and card draw', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 207,
        { choice: 'granted' }, helpers);
      expect(state.pendingCardDraw.papacy).toBe(1);
      expect(state.pendingDebateCall.caller).toBe('papacy');
    });
  });

  // ── #211 Spanish Invasion ───────────────────────────────────────
  describe('#211 Spanish Invasion', () => {
    it('pre-SL: Hapsburg-Papacy war, Protestant controls', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 211,
        { targetSpace: 'Vienna' }, helpers);
      expect(state.wars.some(w =>
        (w.a === 'hapsburg' && w.b === 'papacy') ||
        (w.a === 'papacy' && w.b === 'hapsburg')
      )).toBe(true);
      expect(state.pendingCardDraw.protestant).toBe(1);
    });

    it('post-SL: Papacy controls', () => {
      const state = eventState({ schmalkaldicLeague: true });
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 211,
        { targetSpace: 'Vienna' }, helpers);
      expect(state.pendingCardDraw.papacy).toBe(1);
    });
  });

  // ── #213 Austrian Invasion ──────────────────────────────────────
  describe('#213 Austrian Invasion', () => {
    it('places Ferdinand and Hapsburg forces', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 213,
        { targetSpace: 'Vienna' }, helpers);
      const stack = state.spaces['Vienna'].units.find(
        u => u.owner === 'hapsburg');
      expect(stack.leaders).toContain('ferdinand');
      expect(stack.regulars).toBeGreaterThanOrEqual(2);
      expect(stack.mercenaries).toBeGreaterThanOrEqual(4);
    });
  });

  // ── #216 Ottoman Invasion ───────────────────────────────────────
  describe('#216 Ottoman Invasion', () => {
    it('declares Ottoman-Papacy war and places forces', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 216,
        { targetSpace: 'Istanbul' }, helpers);
      expect(state.wars.some(w =>
        (w.a === 'ottoman' && w.b === 'papacy') ||
        (w.a === 'papacy' && w.b === 'ottoman')
      )).toBe(true);
      const stack = state.spaces['Istanbul'].units.find(
        u => u.owner === 'ottoman');
      expect(stack.leaders).toContain('suleiman');
      expect(stack.regulars).toBeGreaterThanOrEqual(5);
    });
  });

  // ── #217 Secret Protestant Circle ───────────────────────────────
  describe('#217 Secret Protestant Circle', () => {
    it('flips Italian space on any roll', () => {
      const state = eventState();
      state.spaces['Genoa'].languageZone = 'italian';
      state.spaces['Genoa'].religion = 'catholic';
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 217, {
        dieRoll: 2, italianSpace: 'Genoa'
      }, helpers);
      expect(state.spaces['Genoa'].religion).toBe('protestant');
    });

    it('flips both Italian and Spanish on roll 4+', () => {
      const state = eventState();
      state.spaces['Genoa'].languageZone = 'italian';
      state.spaces['Genoa'].religion = 'catholic';
      state.spaces['Barcelona'] = {
        controller: 'hapsburg', units: [],
        languageZone: 'spanish', religion: 'catholic'
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 217, {
        dieRoll: 5, italianSpace: 'Genoa', spanishSpace: 'Barcelona'
      }, helpers);
      expect(state.spaces['Genoa'].religion).toBe('protestant');
      expect(state.spaces['Barcelona'].religion).toBe('protestant');
    });
  });

  // ── Verify all diplomacy handlers registered ────────────────────
  describe('handler registration', () => {
    const diploCards = [
      201, 202, 203, 204, 205, 206, 207, 208, 209, 210,
      211, 212, 213, 214, 215, 216, 217, 218, 219
    ];

    for (const num of diploCards) {
      it(`has handler for card #${num}`, () => {
        expect(EVENT_HANDLERS[num]).toBeDefined();
        expect(typeof EVENT_HANDLERS[num].execute).toBe('function');
      });
    }
  });
});
