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

  // ── #201 Andrea Doria — already-controlled Genoa adds units ─────
  describe('#201 Andrea Doria edge cases', () => {
    it('adds units when Genoa already controlled by Papacy', () => {
      const state = eventState();
      state.minorPowers = { genoa: { ally: 'papacy', active: true } };
      // Clear existing units for a clean test
      state.spaces['Genoa'].units = [];
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 201, { targetSpace: 'Genoa' }, helpers);
      const stack = state.spaces['Genoa'].units.find(u => u.owner === 'genoa');
      expect(stack.regulars).toBe(2);
      expect(stack.squadrons).toBe(1);
    });

    it('no-ops when already controlled but no targetSpace given', () => {
      const state = eventState();
      state.minorPowers = { genoa: { ally: 'papacy', active: true } };
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 201, {}, helpers);
      // Should not throw, genoa stays as-is
      expect(state.minorPowers.genoa.ally).toBe('papacy');
    });
  });

  // ── #202 French Constable — war already exists ─────────────────
  describe('#202 French Constable edge cases', () => {
    it('does not duplicate war if France-Papacy war already exists', () => {
      const state = eventState();
      state.wars.push({ a: 'france', b: 'papacy' });
      const warsBefore = state.wars.length;
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 202,
        { targetSpace: 'Paris' }, helpers);
      expect(state.wars.length).toBe(warsBefore);
    });

    it('does not duplicate montmorency leader', () => {
      const state = eventState();
      const stack = state.spaces['Paris'].units.find(u => u.owner === 'france')
        || { owner: 'france', regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: ['montmorency'] };
      state.spaces['Paris'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 202,
        { targetSpace: 'Paris' }, helpers);
      expect(stack.leaders.filter(l => l === 'montmorency')).toHaveLength(1);
    });
  });

  // ── #203 Corsair Raid — boundary rolls ─────────────────────────
  describe('#203 Corsair Raid edge cases', () => {
    it('reports 0 hits when all dice miss', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 203,
        { die0: 1, die1: 2, die2: 3, die3: 4 }, helpers);
      const log = state.eventLog.find(
        e => e.type === 'event_diplo_corsair_raid');
      expect(log.data.hits).toBe(0);
    });

    it('reports 4 hits when all dice hit', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 203,
        { die0: 5, die1: 6, die2: 5, die3: 6 }, helpers);
      const log = state.eventLog.find(
        e => e.type === 'event_diplo_corsair_raid');
      expect(log.data.hits).toBe(4);
    });
  });

  // ── #204 Diplomatic Marriage ───────────────────────────────────
  describe('#204 Diplomatic Marriage', () => {
    it('activates a minor power', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 204, {
        minorPower: 'scotland', action: 'activate', allyPower: 'hapsburg'
      }, helpers);
      expect(state.minorPowers.scotland.ally).toBe('hapsburg');
      expect(state.minorPowers.scotland.active).toBe(true);
    });

    it('deactivates a minor power', () => {
      const state = eventState();
      state.minorPowers = { scotland: { ally: 'france', active: true } };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 204, {
        minorPower: 'scotland', action: 'deactivate'
      }, helpers);
      expect(state.minorPowers.scotland.ally).toBeNull();
      expect(state.minorPowers.scotland.active).toBe(false);
    });
  });

  // ── #205 Diplomatic Pressure ───────────────────────────────────
  describe('#205 Diplomatic Pressure', () => {
    it('sets pending diplomatic pressure state', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 205, { action: 'review' }, helpers);
      expect(state.pendingDiplomaticPressure.reviewer).toBe('papacy');
    });
  });

  // ── #206 French Invasion edge cases ────────────────────────────
  describe('#206 French Invasion edge cases', () => {
    it('uses henry_ii when ruler is not francis_i', () => {
      const state = eventState();
      state.rulers = { france: 'henry_ii' };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 206,
        { targetSpace: 'Paris' }, helpers);
      const stack = state.spaces['Paris'].units.find(
        u => u.owner === 'france');
      expect(stack.leaders).toContain('henry_ii');
    });

    it('does not duplicate war if already at war', () => {
      const state = eventState();
      state.wars.push({ a: 'papacy', b: 'france' });
      const warsBefore = state.wars.length;
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 206,
        { targetSpace: 'Paris' }, helpers);
      expect(state.wars.length).toBe(warsBefore);
    });

    it('grants Protestant a card draw', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 206,
        { targetSpace: 'Paris' }, helpers);
      expect(state.pendingCardDraw.protestant).toBe(1);
    });
  });

  // ── #207 Henry Divorce — refused edge cases ────────────────────
  describe('#207 Henry Divorce edge cases', () => {
    it('refused with empty placements does nothing', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 207, {
        choice: 'refused', placements: []
      }, helpers);
      // Should not throw
      const log = state.eventLog.find(
        e => e.type === 'event_diplo_henry_divorce');
      expect(log.data.choice).toBe('refused');
    });

    it('refused with invalid space skips gracefully', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 207, {
        choice: 'refused',
        placements: [{ space: 'Nonexistent', count: 2 }]
      }, helpers);
      // Should not throw
      expect(state.eventLog.length).toBeGreaterThan(0);
    });
  });

  // ── #208 Knights of St. John ───────────────────────────────────
  describe('#208 Knights of St. John', () => {
    it('sets card draw and St. Peters flag', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 208, {}, helpers);
      expect(state.pendingCardDraw.papacy).toBe(1);
      expect(state.pendingStPetersContribution).toBe(true);
    });
  });

  // ── #209 Plague ────────────────────────────────────────────────
  describe('#209 Plague', () => {
    it('removes up to 3 regulars', () => {
      const state = eventState();
      const stack = {
        owner: 'ottoman', regulars: 5, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      state.spaces['Istanbul'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 209, {
        removals: [
          { space: 'Istanbul', owner: 'ottoman' },
          { space: 'Istanbul', owner: 'ottoman' },
          { space: 'Istanbul', owner: 'ottoman' }
        ]
      }, helpers);
      expect(stack.regulars).toBe(2);
    });

    it('removes squadrons when specified', () => {
      const state = eventState();
      const stack = {
        owner: 'ottoman', regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 3, corsairs: 0, leaders: []
      };
      state.spaces['Istanbul'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 209, {
        removals: [{ space: 'Istanbul', owner: 'ottoman', type: 'squadron' }]
      }, helpers);
      expect(stack.squadrons).toBe(2);
    });

    it('limits to 3 removals even if more provided', () => {
      const state = eventState();
      const stack = {
        owner: 'ottoman', regulars: 10, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      state.spaces['Istanbul'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 209, {
        removals: [
          { space: 'Istanbul', owner: 'ottoman' },
          { space: 'Istanbul', owner: 'ottoman' },
          { space: 'Istanbul', owner: 'ottoman' },
          { space: 'Istanbul', owner: 'ottoman' },
          { space: 'Istanbul', owner: 'ottoman' }
        ]
      }, helpers);
      expect(stack.regulars).toBe(7); // only 3 removed
    });

    it('falls back to mercenaries when no regulars left', () => {
      const state = eventState();
      const stack = {
        owner: 'ottoman', regulars: 0, mercenaries: 2,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      state.spaces['Istanbul'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 209, {
        removals: [{ space: 'Istanbul', owner: 'ottoman' }]
      }, helpers);
      expect(stack.mercenaries).toBe(1);
    });
  });

  // ── #210 Shipbuilding ──────────────────────────────────────────
  describe('#210 Shipbuilding', () => {
    it('places up to 2 squadrons', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'england', 210, {
        placements: [
          { space: 'London', owner: 'england' },
          { space: 'London', owner: 'england' }
        ]
      }, helpers);
      const stack = state.spaces['London'].units.find(
        u => u.owner === 'england');
      expect(stack.squadrons).toBeGreaterThanOrEqual(2);
    });

    it('limits to 2 even if more placements provided', () => {
      const state = eventState();
      const stack = {
        owner: 'england', regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      state.spaces['London'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'england', 210, {
        placements: [
          { space: 'London' }, { space: 'London' }, { space: 'London' }
        ]
      }, helpers);
      expect(stack.squadrons).toBe(2);
    });
  });

  // ── #211 Spanish Invasion — post-SL no war ─────────────────────
  describe('#211 Spanish Invasion edge cases', () => {
    it('post-SL: does not declare Hapsburg-Papacy war', () => {
      const state = eventState({ schmalkaldicLeague: true });
      const warsBefore = state.wars.length;
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 211,
        { targetSpace: 'Vienna' }, helpers);
      expect(state.wars.length).toBe(warsBefore);
    });

    it('places duke_of_alva leader', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 211,
        { targetSpace: 'Vienna' }, helpers);
      const stack = state.spaces['Vienna'].units.find(
        u => u.owner === 'hapsburg');
      expect(stack.leaders).toContain('duke_of_alva');
    });
  });

  // ── #212 Venetian Alliance ─────────────────────────────────────
  describe('#212 Venetian Alliance', () => {
    it('activates Venice as Papal ally', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 212,
        { mode: 'activate' }, helpers);
      expect(state.minorPowers.venice.ally).toBe('papacy');
      expect(state.minorPowers.venice.active).toBe(true);
    });

    it('deactivates Venice', () => {
      const state = eventState();
      state.minorPowers = { venice: { ally: 'papacy', active: true } };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 212,
        { mode: 'deactivate' }, helpers);
      expect(state.minorPowers.venice.active).toBe(false);
    });

    it('reinforces Venice with regulars and squadrons', () => {
      const state = eventState();
      state.spaces['Venice'] = {
        controller: 'venice', units: [], religion: 'catholic',
        languageZone: 'italian'
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 212, {
        mode: 'reinforce', targetSpace: 'Venice'
      }, helpers);
      const stack = state.spaces['Venice'].units.find(
        u => u.owner === 'venice');
      expect(stack.regulars).toBe(1);
      expect(stack.squadrons).toBe(2);
    });
  });

  // ── #214 Imperial Invasion ─────────────────────────────────────
  describe('#214 Imperial Invasion', () => {
    it('places Charles V and forces', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 214,
        { targetSpace: 'Vienna' }, helpers);
      const stack = state.spaces['Vienna'].units.find(
        u => u.owner === 'hapsburg');
      expect(stack.leaders).toContain('charles_v');
      expect(stack.regulars).toBeGreaterThanOrEqual(3);
      expect(stack.mercenaries).toBeGreaterThanOrEqual(5);
    });

    it('grants Papacy a card draw', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 214,
        { targetSpace: 'Vienna' }, helpers);
      expect(state.pendingCardDraw.papacy).toBe(1);
    });
  });

  // ── #215 Machiavelli ───────────────────────────────────────────
  describe('#215 Machiavelli', () => {
    it('sets pending choice state', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 215, { targetCard: 211 }, helpers);
      expect(state.pendingMachiavelliChoice.chooser).toBe('france');
      expect(state.pendingMachiavelliChoice.targetCard).toBe(211);
    });
  });

  // ── #218 Siege of Vienna ───────────────────────────────────────
  describe('#218 Siege of Vienna', () => {
    it('removes regulars and sets movement restriction', () => {
      const state = eventState();
      const stack = {
        owner: 'hapsburg', regulars: 4, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      state.spaces['Vienna'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 218, {
        removals: [
          { space: 'Vienna', owner: 'hapsburg' },
          { space: 'Vienna', owner: 'hapsburg' }
        ]
      }, helpers);
      expect(stack.regulars).toBe(2);
      expect(state.viennaMovementRestriction).toBe(true);
    });

    it('limits removal to 2 even if more given', () => {
      const state = eventState();
      const stack = {
        owner: 'hapsburg', regulars: 5, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      state.spaces['Vienna'].units = [stack];
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 218, {
        removals: [
          { space: 'Vienna', owner: 'hapsburg' },
          { space: 'Vienna', owner: 'hapsburg' },
          { space: 'Vienna', owner: 'hapsburg' }
        ]
      }, helpers);
      expect(stack.regulars).toBe(3); // only 2 removed
    });
  });

  // ── #219 Spanish Inquisition ───────────────────────────────────
  describe('#219 Spanish Inquisition', () => {
    it('Papacy path: sets force discard pressure', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 219, {}, helpers);
      expect(state.pendingDiplomaticPressure.reviewer).toBe('papacy');
      expect(state.pendingDiplomaticPressure.action).toBe('force_discard');
    });

    it('non-Papacy path: sets hand reveal', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 219, {}, helpers);
      expect(state.pendingHandReveal.power).toBe('protestant');
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
