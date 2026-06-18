/**
 * Tests for extended event card handlers (#55-116)
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

describe('Extended Event Handlers (#55-116)', () => {

  // ── #55 Jesuit Education ─────────────────────────────────────────
  describe('#55 Jesuit Education', () => {
    it('rejects if Society of Jesus not played', () => {
      const state = eventState();
      const r = validateEvent(state, 'papacy', 55, {});
      expect(r.valid).toBe(false);
    });

    it('places 2 Jesuit universities', () => {
      const state = eventState({ jesuitFoundingEnabled: true });
      state.spaces['Rome'].religion = 'catholic';
      state.spaces['Vienna'].religion = 'catholic';
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 55,
        { jesuitSpaces: ['Rome', 'Vienna'] }, helpers);
      expect(state.spaces['Rome'].jesuitUniversity).toBe(true);
      expect(state.spaces['Vienna'].jesuitUniversity).toBe(true);
    });
  });

  // ── #56 Papal Inquisition ────────────────────────────────────────
  describe('#56 Papal Inquisition', () => {
    it('converts Italian Protestant spaces and commits Caraffa', () => {
      const state = eventState();
      state.debaters = { papacy: [{ id: 'caraffa', committed: false }] };
      state.spaces['Genoa'].religion = 'protestant';
      state.spaces['Genoa'].languageZone = 'italian';
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 56,
        { convertSpaces: ['Genoa'] }, helpers);
      expect(state.spaces['Genoa'].religion).toBe('catholic');
      expect(state.debaters.papacy[0].committed).toBe(true);
    });

    it('rejects when Caraffa committed', () => {
      const state = eventState();
      state.debaters = { papacy: [{ id: 'caraffa', committed: true }] };
      const r = validateEvent(state, 'papacy', 56, {});
      expect(r.valid).toBe(false);
    });
  });

  // ── #57 Philip of Hesse's Bigamy ─────────────────────────────────
  describe('#57 Philip of Hesse Bigamy', () => {
    it('removes Philip of Hesse leader', () => {
      const state = eventState();
      state.spaces['Wittenberg'].units.push({
        owner: 'protestant', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0,
        leaders: ['philip_of_hesse']
      });
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 57,
        { choice: 'remove_leader' }, helpers);
      const stack = state.spaces['Wittenberg'].units.find(
        u => u.owner === 'protestant');
      expect(stack.leaders).not.toContain('philip_of_hesse');
      expect(state.removedLeaders).toContain('philip_of_hesse');
    });
  });

  // ── #58 Spanish Inquisition ──────────────────────────────────────
  describe('#58 Spanish Inquisition', () => {
    it('converts Spanish Protestant spaces', () => {
      const state = eventState();
      state.spaces['Barcelona'] = {
        controller: 'hapsburg', units: [], religion: 'protestant',
        languageZone: 'spanish', homePower: 'hapsburg'
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 58,
        { convertSpaces: ['Barcelona'] }, helpers);
      expect(state.spaces['Barcelona'].religion).toBe('catholic');
    });
  });

  // ── #59 Lady Jane Grey ───────────────────────────────────────────
  describe('#59 Lady Jane Grey', () => {
    it('rejects if England has not changed rulers', () => {
      const state = eventState();
      const r = validateEvent(state, 'protestant', 59, {});
      expect(r.valid).toBe(false);
    });

    it('accepts if England changed rulers', () => {
      const state = eventState({ englandRulerChangedThisTurn: true });
      const r = validateEvent(state, 'protestant', 59, {});
      expect(r.valid).toBe(true);
    });
  });

  // ── #60 Maurice of Saxony ───────────────────────────────────────
  describe('#60 Maurice of Saxony', () => {
    it('switches leader from Protestant to Hapsburg', () => {
      const state = eventState();
      state.spaces['Wittenberg'].units.push({
        owner: 'protestant', regulars: 0, mercenaries: 3,
        cavalry: 0, squadrons: 0, corsairs: 0,
        leaders: ['maurice_of_saxony']
      });
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 60, {
        currentOwner: 'protestant',
        targetSpace: 'Vienna'
      }, helpers);
      const wStack = state.spaces['Wittenberg'].units.find(
        u => u.owner === 'protestant');
      expect(wStack.leaders).not.toContain('maurice_of_saxony');
      expect(wStack.mercenaries).toBe(0);
      const vStack = state.spaces['Vienna'].units.find(
        u => u.owner === 'hapsburg');
      expect(vStack.leaders).toContain('maurice_of_saxony');
      expect(vStack.mercenaries).toBe(3);
    });
  });

  // ── #61 Mary Defies Council ──────────────────────────────────────
  describe('#61 Mary Defies Council', () => {
    it('grants 3 counter-reformation attempts in the English zone via pendingReformation', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 61, {}, helpers);
      // Must land on the consumed field (pendingReformation), as a
      // counter-reformation; the old pendingCounterReformation was never read.
      expect(state.pendingCounterReformation).toBeUndefined();
      expect(state.pendingReformation).toMatchObject({
        type: 'counter_reformation',
        zone: 'english',
        attemptsLeft: 3
      });
    });
  });

  // ── #62 Book of Common Prayer ────────────────────────────────────
  describe('#62 Book of Common Prayer', () => {
    it('sets 4 ref attempts English zone and commits Cranmer', () => {
      const state = eventState();
      state.debaters = {
        protestant: [{ id: 'cranmer', committed: false }]
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 62,
        { unrestRoll: 2 }, helpers);
      expect(state.pendingReformation.attemptsRemaining).toBe(4);
      expect(state.pendingReformation.zones).toBe('english');
      expect(state.debaters.protestant[0].committed).toBe(true);
    });

    it('rejects when Cranmer committed', () => {
      const state = eventState();
      state.debaters = {
        protestant: [{ id: 'cranmer', committed: true }]
      };
      const r = validateEvent(state, 'protestant', 62, {});
      expect(r.valid).toBe(false);
    });
  });

  // ── #63 Dissolution of Monasteries ───────────────────────────────
  describe('#63 Dissolution of Monasteries', () => {
    it('sets draw 2 for England and 3 ref English', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'england', 63, {}, helpers);
      expect(state.pendingCardDraw.england).toBe(2);
      expect(state.pendingReformation.attemptsRemaining).toBe(3);
    });
  });

  // ── #64 Pilgrimage of Grace ──────────────────────────────────────
  describe('#64 Pilgrimage of Grace', () => {
    it('places unrest on unoccupied English home spaces', () => {
      const state = eventState();
      state.spaces['York'] = {
        controller: 'england', units: [], homePower: 'england',
        unrest: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 64,
        { targetSpaces: ['York'] }, helpers);
      expect(state.spaces['York'].unrest).toBe(true);
    });
  });

  // ── #65 A Mighty Fortress ────────────────────────────────────────
  describe('#65 A Mighty Fortress', () => {
    it('sets 6 ref attempts German zone and commits Luther', () => {
      const state = eventState();
      state.debaters = {
        protestant: [{ id: 'luther', committed: false }]
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 65, {}, helpers);
      expect(state.pendingReformation.attemptsRemaining).toBe(6);
      expect(state.pendingReformation.zones).toBe('german');
      expect(state.debaters.protestant[0].committed).toBe(true);
    });

    it('rejects when Luther committed', () => {
      const state = eventState();
      state.debaters = {
        protestant: [{ id: 'luther', committed: true }]
      };
      const r = validateEvent(state, 'protestant', 65, {});
      expect(r.valid).toBe(false);
    });
  });

  // ── #66 Akinji Raiders ──────────────────────────────────────────
  describe('#66 Akinji Raiders', () => {
    it('rejects non-Ottoman', () => {
      const state = eventState();
      const r = validateEvent(state, 'france', 66, {});
      expect(r.valid).toBe(false);
    });

    it('steals card from target', () => {
      const state = eventState();
      state.hands = { ottoman: [], france: [50, 60] };
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 66,
        { targetPower: 'france' }, helpers);
      expect(state.hands.ottoman.length).toBe(1);
      expect(state.hands.france.length).toBe(1);
    });
  });

  // ── #67 Anabaptists ─────────────────────────────────────────────
  describe('#67 Anabaptists', () => {
    it('converts 2 Protestant spaces to Catholic', () => {
      const state = eventState();
      state.spaces['Wittenberg'].religion = 'protestant';
      state.spaces['Wittenberg'].isElectorate = false;
      state.spaces['Wittenberg'].units = [];
      state.spaces['Erfurt'] = {
        controller: 'protestant', units: [],
        religion: 'protestant', isElectorate: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 67,
        { targetSpaces: ['Wittenberg', 'Erfurt'] }, helpers);
      expect(state.spaces['Wittenberg'].religion).toBe('catholic');
      expect(state.spaces['Erfurt'].religion).toBe('catholic');
    });
  });

  // ── #68 Andrea Doria ────────────────────────────────────────────
  describe('#68 Andrea Doria', () => {
    it('activates Genoa', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 68,
        { mode: 'activate' }, helpers);
      expect(state.minorPowers.genoa.ally).toBe('france');
    });

    it('piracy mode reduces Ottoman VP', () => {
      const state = eventState();
      state.vp.ottoman = 5;
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 68,
        { mode: 'piracy', die1: 5, die2: 6, die3: 2 }, helpers);
      expect(state.vp.ottoman).toBe(3);
    });
  });

  // ── #70 Charles Bourbon ─────────────────────────────────────────
  describe('#70 Charles Bourbon', () => {
    it('places leader and 3 mercs', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 70,
        { targetSpace: 'Paris' }, helpers);
      const stack = state.spaces['Paris'].units.find(
        u => u.owner === 'france');
      expect(stack.leaders).toContain('charles_bourbon');
      expect(stack.mercenaries).toBeGreaterThanOrEqual(3);
    });

    it('places cavalry for Ottoman', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 70,
        { targetSpace: 'Istanbul' }, helpers);
      const stack = state.spaces['Istanbul'].units.find(
        u => u.owner === 'ottoman');
      expect(stack.cavalry).toBeGreaterThanOrEqual(3);
    });
  });

  // ── #73 Diplomatic Marriage ─────────────────────────────────────
  describe('#73 Diplomatic Marriage', () => {
    it('rejects Ottoman and Protestant', () => {
      const state = eventState();
      expect(validateEvent(state, 'ottoman', 73, {}).valid).toBe(false);
      expect(validateEvent(state, 'protestant', 73, {}).valid).toBe(false);
    });
  });

  // ── #74 Diplomatic Overture ─────────────────────────────────────
  describe('#74 Diplomatic Overture', () => {
    it('sets up draw 2 and give card', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 74,
        { targetPower: 'england' }, helpers);
      expect(state.pendingCardDraw.france).toBe(2);
      expect(state.pendingGiveCard.from).toBe('france');
    });
  });

  // ── #75 Erasmus ─────────────────────────────────────────────────
  describe('#75 Erasmus', () => {
    it('sets reformation on Turn 1-2', () => {
      const state = eventState({ turn: 1 });
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 75, {}, helpers);
      expect(state.pendingReformation.attemptsRemaining).toBe(4);
    });

    it('sets counter-reformation on Turn 3+', () => {
      const state = eventState({ turn: 3 });
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 75, {}, helpers);
      expect(state.pendingCounterReformation.attemptsRemaining).toBe(4);
    });
  });

  // ── #76 Foreign Recruits ────────────────────────────────────────
  describe('#76 Foreign Recruits', () => {
    it('grants 4 CP', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      const result = executeEvent(state, 'france', 76, {}, helpers);
      expect(result).toEqual({ grantCp: 4 });
    });
  });

  // ── #78 Frederick the Wise ──────────────────────────────────────
  describe('#78 Frederick the Wise', () => {
    it('converts German Catholic spaces and retrieves Wartburg', () => {
      const state = eventState();
      state.spaces['Erfurt'] = {
        controller: 'independent', units: [],
        religion: 'catholic', languageZone: 'german'
      };
      state.discard = [37, 50];
      state.hands = { protestant: [] };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 78,
        { targetSpaces: ['Erfurt'] }, helpers);
      expect(state.spaces['Erfurt'].religion).toBe('protestant');
      expect(state.discard).not.toContain(37);
      expect(state.hands.protestant).toContain(37);
    });
  });

  // ── #79 Fuggers ─────────────────────────────────────────────────
  describe('#79 Fuggers', () => {
    it('draws 2 cards and sets -1 modifier', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 79, {}, helpers);
      expect(state.pendingCardDraw.hapsburg).toBe(2);
      expect(state.cardModifiers.hapsburg).toBe(-1);
    });
  });

  // ── #80 Gabelle Revolt ──────────────────────────────────────────
  describe('#80 Gabelle Revolt', () => {
    it('places unrest on French home spaces', () => {
      const state = eventState();
      state.spaces['Lyon'] = {
        controller: 'france', units: [], homePower: 'france',
        unrest: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 80,
        { targetSpaces: ['Lyon'] }, helpers);
      expect(state.spaces['Lyon'].unrest).toBe(true);
    });
  });

  // ── #82 Janissaries Rebel ───────────────────────────────────────
  describe('#82 Janissaries Rebel', () => {
    it('allows 4 unrest when Ottoman not at war', () => {
      const state = eventState({ wars: [] }); // No wars
      // Use unoccupied Ottoman home spaces
      state.spaces['OttHome1'] = {
        controller: 'ottoman', units: [], homePower: 'ottoman',
        unrest: false
      };
      state.spaces['OttHome2'] = {
        controller: 'ottoman', units: [], homePower: 'ottoman',
        unrest: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 82, {
        targetSpaces: ['OttHome1', 'OttHome2']
      }, helpers);
      const log = state.eventLog.find(
        e => e.type === 'event_janissaries_rebel');
      expect(log.data.maxUnrest).toBe(4);
    });

    it('limits to 2 unrest when Ottoman at war', () => {
      const state = eventState();
      state.wars.push({ a: 'ottoman', b: 'hapsburg' });
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 82, {
        targetSpaces: ['Istanbul']
      }, helpers);
      const log = state.eventLog.find(
        e => e.type === 'event_janissaries_rebel');
      expect(log.data.maxUnrest).toBe(2);
    });
  });

  // ── #83 John Zapolya ────────────────────────────────────────────
  describe('#83 John Zapolya', () => {
    it('adds 4 regulars to Buda', () => {
      const state = eventState();
      state.spaces['Buda'] = {
        controller: 'hapsburg',
        units: [{
          owner: 'hapsburg', regulars: 1, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        }]
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 83, {}, helpers);
      const stack = state.spaces['Buda'].units.find(
        u => u.owner === 'hapsburg');
      expect(stack.regulars).toBe(5);
    });
  });

  // ── #84 Julia Gonzaga ───────────────────────────────────────────
  describe('#84 Julia Gonzaga', () => {
    it('rejects if piracy not enabled', () => {
      const state = eventState();
      const r = validateEvent(state, 'ottoman', 84, {});
      expect(r.valid).toBe(false);
    });

    it('sets juliaGonzagaActive', () => {
      const state = eventState({ piracyEnabled: true });
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 84, {}, helpers);
      expect(state.juliaGonzagaActive).toBe(true);
    });
  });

  // ── #85 Katherina Bora ──────────────────────────────────────────
  describe('#85 Katherina Bora', () => {
    it('sets 5 ref attempts all zones and commits Luther', () => {
      const state = eventState();
      state.debaters = {
        protestant: [{ id: 'luther', committed: false }]
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 85, {}, helpers);
      expect(state.pendingReformation.attemptsRemaining).toBe(5);
      expect(state.pendingReformation.zones).toBe('all');
      expect(state.debaters.protestant[0].committed).toBe(true);
    });
  });

  // ── #88 Peasants' War ───────────────────────────────────────────
  describe('#88 Peasants War', () => {
    it('places unrest on German-speaking spaces', () => {
      const state = eventState();
      state.spaces['Erfurt'] = {
        controller: 'independent', units: [],
        languageZone: 'german', unrest: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 88,
        { targetSpaces: ['Erfurt'] }, helpers);
      expect(state.spaces['Erfurt'].unrest).toBe(true);
    });
  });

  // ── #89 Pirate Haven ────────────────────────────────────────────
  describe('#89 Pirate Haven', () => {
    it('rejects without Barbary Pirates', () => {
      const state = eventState();
      const r = validateEvent(state, 'ottoman', 89, {});
      expect(r.valid).toBe(false);
    });

    it('sets up pirate haven', () => {
      const state = eventState({ piracyEnabled: true });
      state.spaces['Tripoli'] = {
        controller: 'independent', units: []
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 89,
        { targetSpace: 'Tripoli' }, helpers);
      expect(state.spaces['Tripoli'].controller).toBe('ottoman');
      expect(state.spaces['Tripoli'].pirateHaven).toBe(true);
      const stack = state.spaces['Tripoli'].units.find(
        u => u.owner === 'ottoman');
      expect(stack.regulars).toBe(1);
      expect(stack.corsairs).toBe(2);
    });
  });

  // ── #90 Printing Press ──────────────────────────────────────────
  describe('#90 Printing Press', () => {
    it('activates printing press and sets 3 ref attempts', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'protestant', 90, {}, helpers);
      expect(state.printingPressActive).toBe(true);
      expect(state.pendingReformation.attemptsRemaining).toBe(3);
    });
  });

  // ── #91 Ransom ──────────────────────────────────────────────────
  describe('#91 Ransom', () => {
    it('returns captured leader', () => {
      const state = eventState({
        capturedLeaders: ['charles_v']
      });
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 91, {
        leaderId: 'charles_v',
        targetSpace: 'Vienna',
        leaderPower: 'hapsburg'
      }, helpers);
      expect(state.capturedLeaders).not.toContain('charles_v');
      const stack = state.spaces['Vienna'].units.find(
        u => u.owner === 'hapsburg');
      expect(stack.leaders).toContain('charles_v');
    });
  });

  // ── #92 Revolt in Egypt ─────────────────────────────────────────
  describe('#92 Revolt in Egypt', () => {
    it('creates foreign war for Ottoman', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 92, {}, helpers);
      expect(state.foreignWars.egypt.targetPower).toBe('ottoman');
      expect(state.foreignWars.egypt.requiredUnits).toBe(3);
    });
  });

  // ── #93 Revolt in Ireland ───────────────────────────────────────
  describe('#93 Revolt in Ireland', () => {
    it('creates foreign war for England', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 93, {}, helpers);
      expect(state.foreignWars.ireland.targetPower).toBe('england');
      expect(state.foreignWars.ireland.requiredUnits).toBe(4);
    });

    it('gives Irish 4 units when played by France/Hapsburg', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 93, {}, helpers);
      expect(state.foreignWars.ireland.enemyUnits).toBe(4);
    });
  });

  // ── #94 Revolt of Communeros ────────────────────────────────────
  describe('#94 Revolt of Communeros', () => {
    it('places unrest on Spanish spaces', () => {
      const state = eventState();
      state.spaces['Barcelona'] = {
        controller: 'hapsburg', units: [],
        languageZone: 'spanish', unrest: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 94,
        { targetSpaces: ['Barcelona'] }, helpers);
      expect(state.spaces['Barcelona'].unrest).toBe(true);
    });
  });

  // ── #100 Shipbuilding ───────────────────────────────────────────
  describe('#100 Shipbuilding', () => {
    it('rejects Protestant', () => {
      const state = eventState();
      const r = validateEvent(state, 'protestant', 100, {});
      expect(r.valid).toBe(false);
    });

    it('places squadrons', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 100, {
        placements: [{ space: 'Marseille', count: 2 }]
      }, helpers);
      const stack = state.spaces['Marseille'].units.find(
        u => u.owner === 'france');
      expect(stack.squadrons).toBeGreaterThanOrEqual(2);
    });
  });

  // ── #102 Spring Preparations ────────────────────────────────────
  describe('#102 Spring Preparations', () => {
    it('rejects Protestant', () => {
      const state = eventState();
      const r = validateEvent(state, 'protestant', 102, {});
      expect(r.valid).toBe(false);
    });

    it('adds regular to capital', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      const regsBefore = state.spaces['Paris'].units.find(
        u => u.owner === 'france')?.regulars || 0;
      executeEvent(state, 'france', 102,
        { capital: 'Paris' }, helpers);
      const regsAfter = state.spaces['Paris'].units.find(
        u => u.owner === 'france')?.regulars || 0;
      expect(regsAfter).toBe(regsBefore + 1);
    });
  });

  // ── #103 Threat to Power ────────────────────────────────────────
  describe('#103 Threat to Power', () => {
    it('removes leader permanently on roll 4+', () => {
      const state = eventState();
      state.spaces['London'].units.push({
        owner: 'england', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0,
        leaders: ['charles_brandon']
      });
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 103, {
        targetLeader: 'charles_brandon', dieRoll: 5
      }, helpers);
      const stack = state.spaces['London'].units.find(
        u => u.owner === 'england');
      expect(stack.leaders).not.toContain('charles_brandon');
      expect(state.removedLeaders).toContain('charles_brandon');
    });

    it('removes leader temporarily on roll 1-3', () => {
      const state = eventState();
      state.spaces['Istanbul'].units.push({
        owner: 'ottoman', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0,
        leaders: ['ibrahim_pasha']
      });
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 103, {
        targetLeader: 'ibrahim_pasha', dieRoll: 2
      }, helpers);
      expect(state.temporaryRemovedLeaders).toContain('ibrahim_pasha');
    });
  });

  // ── #104 Trace Italienne ────────────────────────────────────────
  describe('#104 Trace Italienne', () => {
    it('adds fortress and regular', () => {
      const state = eventState();
      state.spaces['Lyon'] = {
        controller: 'france', units: [{
          owner: 'france', regulars: 1, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        }],
        isFortress: false, unrest: false
      };
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 104,
        { targetSpace: 'Lyon' }, helpers);
      expect(state.spaces['Lyon'].isFortress).toBe(true);
      expect(state.spaces['Lyon'].units[0].regulars).toBe(2);
    });
  });

  // ── #106 Unpaid Mercenaries ─────────────────────────────────────
  describe('#106 Unpaid Mercenaries', () => {
    it('removes all mercs from target space/power', () => {
      const state = eventState();
      state.spaces['Paris'].units.push({
        owner: 'france', regulars: 2, mercenaries: 4,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
      const helpers = createMockHelpers();
      executeEvent(state, 'hapsburg', 106, {
        targetSpace: 'Paris', targetPower: 'france'
      }, helpers);
      const stack = state.spaces['Paris'].units.find(
        u => u.owner === 'france');
      expect(stack.mercenaries).toBe(0);
    });
  });

  // ── #107 Unsanitary Camp ────────────────────────────────────────
  describe('#107 Unsanitary Camp', () => {
    it('removes 1/3 of units', () => {
      const state = eventState();
      state.spaces['Vienna'].units = [{
        owner: 'hapsburg', regulars: 6, mercenaries: 3,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];
      const helpers = createMockHelpers();
      executeEvent(state, 'ottoman', 107, {
        targetSpace: 'Vienna', targetPower: 'hapsburg'
      }, helpers);
      const stack = state.spaces['Vienna'].units[0];
      const total = stack.regulars + stack.mercenaries + stack.cavalry;
      expect(total).toBe(6); // 9 - 3 = 6
    });
  });

  // ── #108 Venetian Alliance ──────────────────────────────────────
  describe('#108 Venetian Alliance', () => {
    it('activates Venice as Papal ally', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 108,
        { mode: 'activate' }, helpers);
      expect(state.minorPowers.venice.ally).toBe('papacy');
    });
  });

  // ── #110 War in Persia ──────────────────────────────────────────
  describe('#110 War in Persia', () => {
    it('creates foreign war for Ottoman', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'france', 110, {}, helpers);
      expect(state.foreignWars.persia.targetPower).toBe('ottoman');
      expect(state.foreignWars.persia.requiredUnits).toBe(5);
      expect(state.cardModifiers.ottoman).toBe(-1);
    });
  });

  // ── #112 Thomas More ────────────────────────────────────────────
  describe('#112 Thomas More', () => {
    it('executed by England: no debates, draw card', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'england', 112, {}, helpers);
      expect(state.thomasMoreExecuted).toBe(true);
      expect(state.noDebatesInEnglandThisTurn).toBe(true);
      expect(state.pendingCardDraw.england).toBe(1);
    });

    it('played by Papacy: debate with extra dice', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      executeEvent(state, 'papacy', 112, {}, helpers);
      expect(state.pendingDebateCall.caller).toBe('papacy');
      expect(state.pendingDebateCall.extraDice).toBe(1);
    });
  });

  // ── #116 Rough Wooing ───────────────────────────────────────────
  describe('#116 Rough Wooing', () => {
    it('rejects if Edward not born', () => {
      const state = eventState();
      const r = validateEvent(state, 'england', 116, {});
      expect(r.valid).toBe(false);
    });

    it('transfers Scotland on English success', () => {
      const state = eventState({ edwardBorn: true });
      state.alliances.push({ a: 'scotland', b: 'france' });
      const helpers = createMockHelpers();
      executeEvent(state, 'england', 116, {
        engRoll: 6, fraRoll: 1
      }, helpers);
      expect(state.alliances.some(a =>
        (a.a === 'scotland' && a.b === 'england') ||
        (a.a === 'england' && a.b === 'scotland')
      )).toBe(true);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  describe('#57 Philip of Hesse — edge cases', () => {
    it('discard branch removes random card from protestant hand', () => {
      const state = eventState();
      state.hands = { protestant: [40, 50] };
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 57,
        { choice: 'discard' }, helpers);

      expect(state.hands.protestant.length).toBe(1);
      expect(state.discard.length).toBeGreaterThan(0);
    });

    it('discard branch no-ops with empty protestant hand', () => {
      const state = eventState();
      state.hands = { protestant: [] };
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 57,
        { choice: 'discard' }, helpers);

      expect(state.discard.length).toBe(0);
    });
  });

  describe('#64 Pilgrimage — edge cases', () => {
    it('skips occupied English home spaces', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      // Find an English home space and give it units
      const engHome = Object.entries(state.spaces).find(
        ([, sp]) => sp.homePower === 'england' && !sp.unrest
      );
      if (engHome) {
        engHome[1].units = [{
          owner: 'england', regulars: 2, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        }];

        executeEvent(state, 'papacy', 64,
          { targetSpaces: [engHome[0]] }, helpers);

        expect(engHome[1].unrest).toBeFalsy();
      }
    });

    it('skips spaces with existing unrest', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      const engHome = Object.entries(state.spaces).find(
        ([, sp]) => sp.homePower === 'england'
      );
      if (engHome) {
        engHome[1].unrest = true;
        engHome[1].units = [];

        executeEvent(state, 'papacy', 64,
          { targetSpaces: [engHome[0]] }, helpers);

        const log = state.eventLog.find(
          e => e.type === 'event_pilgrimage_of_grace');
        expect(log.data.placed).toBe(0);
      }
    });
  });

  describe('#67 Anabaptists — edge cases', () => {
    it('skips electorate spaces', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Wittenberg'].religion = 'protestant';
      state.spaces['Wittenberg'].isElectorate = true;
      state.spaces['Wittenberg'].units = [];

      executeEvent(state, 'papacy', 67,
        { targetSpaces: ['Wittenberg'] }, helpers);

      expect(state.spaces['Wittenberg'].religion).toBe('protestant');
    });

    it('skips occupied spaces', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Wittenberg'].religion = 'protestant';
      state.spaces['Wittenberg'].isElectorate = false;
      state.spaces['Wittenberg'].units = [{
        owner: 'protestant', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];

      executeEvent(state, 'papacy', 67,
        { targetSpaces: ['Wittenberg'] }, helpers);

      expect(state.spaces['Wittenberg'].religion).toBe('protestant');
    });
  });

  describe('#69 Auld Alliance — edge cases', () => {
    it('deactivate removes Scotland alliances', () => {
      const state = eventState();
      state.minorPowers = { scotland: { ally: 'france', active: true } };
      state.alliances.push({ a: 'scotland', b: 'france' });
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 69,
        { mode: 'deactivate' }, helpers);

      expect(state.minorPowers.scotland.active).toBe(false);
      expect(state.alliances.some(a =>
        a.a === 'scotland' || a.b === 'scotland'
      )).toBe(false);
    });

    it('reinforce places up to 3 French regulars', () => {
      const state = eventState();
      state.spaces['Edinburgh'].units = [];
      const helpers = createMockHelpers();

      executeEvent(state, 'france', 69, {
        mode: 'reinforce',
        targetSpace: 'Edinburgh',
        count: 5 // should cap at 3
      }, helpers);

      const fStack = state.spaces['Edinburgh'].units.find(
        u => u.owner === 'france');
      expect(fStack).toBeDefined();
      expect(fStack.regulars).toBe(3);
    });
  });

  describe('#78 Frederick the Wise — edge cases', () => {
    it('skips Wartburg retrieval if card #37 not in discard', () => {
      const state = eventState();
      state.discard = [50, 60]; // no 37
      state.hands = { protestant: [] };
      const helpers = createMockHelpers();

      executeEvent(state, 'protestant', 78,
        { targetSpaces: [] }, helpers);

      expect(state.hands.protestant).not.toContain(37);
    });
  });

  describe('#80 Gabelle Revolt — edge cases', () => {
    it('skips non-French home spaces', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 80,
        { targetSpaces: ['Vienna'] }, helpers);

      expect(state.spaces['Vienna'].unrest).toBeFalsy();
    });
  });

  describe('#87 Mercenaries Demand Pay — edge cases', () => {
    it('removes all mercs when no card discarded', () => {
      const state = eventState();
      state.spaces['Paris'].units = [{
        owner: 'france', regulars: 3, mercenaries: 4,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];
      const helpers = createMockHelpers();

      executeEvent(state, 'hapsburg', 87, {
        targetPower: 'france'
      }, helpers);

      // All French mercs gone
      for (const sp of Object.values(state.spaces)) {
        for (const stack of sp.units) {
          if (stack.owner === 'france') {
            expect(stack.mercenaries).toBe(0);
          }
        }
      }
    });

    it('keeps mercs when card is discarded', () => {
      const state = eventState();
      state.hands = { france: [40, 50] };
      state.spaces['Paris'].units = [{
        owner: 'france', regulars: 3, mercenaries: 4,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];
      const helpers = createMockHelpers();

      executeEvent(state, 'hapsburg', 87, {
        targetPower: 'france', discardCard: 40
      }, helpers);

      expect(state.hands.france).not.toContain(40);
      expect(state.discard).toContain(40);
      // Mercs still intact
      expect(state.spaces['Paris'].units[0].mercenaries).toBe(4);
    });
  });

  describe('#100 Shipbuilding — edge cases', () => {
    it('Ottoman corsairs mode places 2 corsairs per squadron', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Algiers'].units = [{
        owner: 'ottoman', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];

      executeEvent(state, 'ottoman', 100, {
        placements: [{ space: 'Algiers', count: 2 }],
        useCorsairs: true
      }, helpers);

      const stack = state.spaces['Algiers'].units.find(
        u => u.owner === 'ottoman');
      expect(stack.corsairs).toBe(4); // 2 * 2
      expect(stack.squadrons).toBe(0);
    });
  });

  describe('#104 Trace Italienne — edge cases', () => {
    it('skips reinforcement for independent controller', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Metz'].controller = 'independent';
      state.spaces['Metz'].units = [];

      executeEvent(state, 'france', 104,
        { targetSpace: 'Metz' }, helpers);

      expect(state.spaces['Metz'].isFortress).toBe(true);
      // No units added for independent
      expect(state.spaces['Metz'].units.length).toBe(0);
    });

    it('skips reinforcement when space has unrest', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Paris'].unrest = true;

      executeEvent(state, 'france', 104,
        { targetSpace: 'Paris' }, helpers);

      expect(state.spaces['Paris'].isFortress).toBe(true);
      // No additional regular added due to unrest
    });
  });

  describe('#107 Unsanitary Camp — edge cases', () => {
    it('cavalry absorbs overflow when regulars+mercs insufficient', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      // 0 regulars, 0 mercs, 6 cavalry → remove ceil(6/3)=2
      // regLoss = min(ceil(2/2), 0) = 0, mercLoss = min(2, 0) = 0
      // remaining = 2 → cavalry -= 2
      state.spaces['Paris'].units = [{
        owner: 'france', regulars: 0, mercenaries: 0,
        cavalry: 6, squadrons: 0, corsairs: 0, leaders: []
      }];

      executeEvent(state, 'hapsburg', 107, {
        targetSpace: 'Paris', targetPower: 'france'
      }, helpers);

      expect(state.spaces['Paris'].units[0].cavalry).toBe(4);
    });

    it('no-ops when target has no units', () => {
      const state = eventState();
      const helpers = createMockHelpers();
      state.spaces['Paris'].units = [{
        owner: 'france', regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      }];

      executeEvent(state, 'hapsburg', 107, {
        targetSpace: 'Paris', targetPower: 'france'
      }, helpers);

      // ceil(0/3) = 0, no units removed
      const stack = state.spaces['Paris'].units[0];
      expect(stack.regulars + stack.mercenaries + stack.cavalry).toBe(0);
    });
  });

  describe('#108 Venetian Alliance — edge cases', () => {
    it('deactivate mode', () => {
      const state = eventState();
      state.minorPowers = { venice: { ally: 'papacy', active: true } };
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 108,
        { mode: 'deactivate' }, helpers);

      expect(state.minorPowers.venice.active).toBe(false);
    });

    it('reinforce mode places venetian units', () => {
      const state = eventState();
      state.spaces['Venice'].units = [];
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 108, {
        mode: 'reinforce', targetSpace: 'Venice'
      }, helpers);

      const vStack = state.spaces['Venice'].units.find(
        u => u.owner === 'venice');
      expect(vStack).toBeDefined();
      expect(vStack.regulars).toBe(1);
      expect(vStack.squadrons).toBe(2);
    });
  });

  describe('#60 Maurice of Saxony — edge cases', () => {
    it('logs notFound when leader not on map', () => {
      const state = eventState();
      const helpers = createMockHelpers();

      executeEvent(state, 'hapsburg', 60,
        { currentOwner: 'protestant' }, helpers);

      const log = state.eventLog.find(
        e => e.type === 'event_maurice_of_saxony');
      expect(log.data.notFound).toBe(true);
    });
  });

  describe('#116 Rough Wooing — edge cases', () => {
    it('Scotland stays French when England fails', () => {
      const state = eventState({ edwardBorn: true });
      state.alliances.push({ a: 'scotland', b: 'france' });
      const helpers = createMockHelpers();

      // England needs engTotal >= fraTotal + 2, so 3 vs 3 fails
      executeEvent(state, 'england', 116, {
        engRoll: 3, fraRoll: 3
      }, helpers);

      expect(state.alliances.some(a =>
        (a.a === 'scotland' && a.b === 'france') ||
        (a.a === 'france' && a.b === 'scotland')
      )).toBe(true);
      // No England alliance
      expect(state.alliances.some(a =>
        (a.a === 'scotland' && a.b === 'england') ||
        (a.a === 'england' && a.b === 'scotland')
      )).toBe(false);
    });
  });

  describe('#75 Erasmus — edge cases', () => {
    it('turn 2 boundary: reformation (not counter)', () => {
      const state = eventState({ turn: 2 });
      const helpers = createMockHelpers();

      executeEvent(state, 'protestant', 75, {}, helpers);

      expect(state.pendingReformation).toBeDefined();
      expect(state.pendingCounterReformation).toBeUndefined();
    });

    it('turn 3 boundary: counter-reformation', () => {
      const state = eventState({ turn: 3 });
      const helpers = createMockHelpers();

      executeEvent(state, 'papacy', 75, {}, helpers);

      expect(state.pendingCounterReformation).toBeDefined();
    });
  });

  describe('#115 Thomas Cromwell — edge cases', () => {
    it('retrieve mode gets Dissolution from discard', () => {
      const state = eventState();
      state.discard = [63, 80];
      state.hands = { england: [] };
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 115,
        { mode: 'retrieve' }, helpers);

      expect(state.hands.england).toContain(63);
      expect(state.discard).not.toContain(63);
    });

    it('retrieve no-ops if card #63 not in discard', () => {
      const state = eventState();
      state.discard = [80];
      state.hands = { england: [] };
      const helpers = createMockHelpers();

      executeEvent(state, 'england', 115,
        { mode: 'retrieve' }, helpers);

      expect(state.hands.england).not.toContain(63);
    });
  });

  // ── Verify all extended handlers registered ─────────────────────
  describe('handler registration', () => {
    const extendedCards = [
      55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84,
      85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 98, 99, 100,
      101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
      115, 116
    ];

    for (const num of extendedCards) {
      it(`has handler for card #${num}`, () => {
        expect(EVENT_HANDLERS[num]).toBeDefined();
        expect(typeof EVENT_HANDLERS[num].execute).toBe('function');
      });
    }
  });
});
