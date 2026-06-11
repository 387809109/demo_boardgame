/**
 * Here I Stand — Bot Card Play Tests
 *
 * Tests for Phase C: Card type routing, Home card criteria,
 * Treaty token logic, Combat/Response handling, and card saving.
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks, isBotPower } from './bot-controller.js';
import { initBotDeck, getActiveBehaviorCard, CARD_BY_ID } from './behavior-cards.js';
import { addWar } from '../state/war-helpers.js';
import {
  classifyCard, isHomeCardFor, evaluateHomeCard, evaluateLeipzigDebate,
  decideCardPlay, decideResponsePlay, shouldSaveCards,
  checkTreatyObligation, getGangingUpTargets, shouldPlayEventGangingUp,
  getFinalAutumnAssaults,
  eventScore, cpUtility, computeGoalSaturation,
  shouldRouteToEvent
} from './bot-card-play.js';

// ── Helpers ──────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  state.hands = state.hands || {};
  state.botSetAside = state.botSetAside || {};
  state.vp = state.vp || {};
  state.treatyTokens = state.treatyTokens || {};
  state.treatySatisfied = state.treatySatisfied || {};
  // Clear initial wars from 1517 scenario for clean test isolation
  state.wars = [];
  return state;
}

function setActiveBehaviorCard(state, power, cardId) {
  const card = CARD_BY_ID[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  if (!state.botDecks[power]) state.botDecks[power] = initBotDeck(power);
  state.botDecks[power].faceUp = [cardId];
}

// ══════════════════════════════════════════════════════════════════
// Card Classification
// ══════════════════════════════════════════════════════════════════

describe('classifyCard', () => {
  it('classifies Home cards as "home"', () => {
    expect(classifyCard(1)).toBe('home');  // Janissaries (Ottoman Home)
    expect(classifyCard(2)).toBe('home');  // Holy Roman Emperor
    expect(classifyCard(5)).toBe('home');  // Papal Bull
    expect(classifyCard(7)).toBe('home');  // Here I Stand
  });

  it('classifies Mandatory cards as "mandatory"', () => {
    expect(classifyCard(9)).toBe('mandatory');  // Barbary Pirates
    expect(classifyCard(13)).toBe('mandatory'); // Schmalkaldic League
    expect(classifyCard(14)).toBe('mandatory'); // Paul III
  });

  it('classifies Combat cards as "combat"', () => {
    expect(classifyCard(24)).toBe('combat'); // Arquebusiers
    expect(classifyCard(25)).toBe('combat'); // Field Artillery
    expect(classifyCard(26)).toBe('combat'); // Mercenaries Bribed
  });

  it('classifies Response cards as "response"', () => {
    expect(classifyCard(31)).toBe('response'); // Foul Weather
    expect(classifyCard(32)).toBe('response'); // Gout
    expect(classifyCard(37)).toBe('response'); // The Wartburg
  });

  it('classifies regular Event cards as "event"', () => {
    expect(classifyCard(65)).toBe('event'); // A Mighty Fortress
    expect(classifyCard(75)).toBe('event'); // Erasmus
    expect(classifyCard(95)).toBe('event'); // Sack of Rome
  });
});

describe('isHomeCardFor', () => {
  it('identifies each power\'s Home card', () => {
    expect(isHomeCardFor(1, 'ottoman')).toBe(true);
    expect(isHomeCardFor(2, 'hapsburg')).toBe(true);
    expect(isHomeCardFor(3, 'england')).toBe(true);
    expect(isHomeCardFor(4, 'france')).toBe(true);
    expect(isHomeCardFor(5, 'papacy')).toBe(true);
    expect(isHomeCardFor(7, 'protestant')).toBe(true);
  });

  it('Papacy also has Leipzig Debate (6) as Home card', () => {
    expect(isHomeCardFor(6, 'papacy')).toBe(true);
  });

  it('returns false for wrong power', () => {
    expect(isHomeCardFor(1, 'hapsburg')).toBe(false);
    expect(isHomeCardFor(3, 'france')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §6 Home Card Criteria
// ══════════════════════════════════════════════════════════════════

describe('evaluateHomeCard', () => {
  it('Ottoman: plays if < 12 land units in Istanbul (Home=Yes)', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war'); // Home: Yes
    // Ensure Istanbul exists with some units (< 12)
    state.spaces = state.spaces || {};
    state.spaces['Istanbul'] = {
      controller: 'ottoman',
      units: [{ owner: 'ottoman', regulars: 4, mercenaries: 0, cavalry: 0, leaders: [] }]
    };
    const result = evaluateHomeCard(state, 'ottoman');
    expect(result).not.toBeNull();
    expect(result.actionData.mode).toBe('recruit');
  });

  it('Ottoman: returns null if behavior card Home=No', () => {
    const state = createBotState(['ottoman']);
    // Barbary Pirates has home: false
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_barbary_pirates');
    const result = evaluateHomeCard(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('Hapsburg: plays to move Charles if at war and not in German zone', () => {
    const state = createBotState(['hapsburg']);
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    addWar(state, 'hapsburg', 'ottoman');
    // Put Charles V in Valladolid (not German zone)
    state.spaces = state.spaces || {};
    state.spaces['Valladolid'] = {
      controller: 'hapsburg', language_zone: 'spanish',
      units: [{ owner: 'hapsburg', regulars: 2, leaders: ['charles_v'] }]
    };
    const result = evaluateHomeCard(state, 'hapsburg');
    expect(result).not.toBeNull();
    expect(result.actionData.homeEffect).toBe('move_charles');
  });

  it('Hapsburg: includes a German/Hungary-home targetSpace with ≥2 Hapsburg units', () => {
    // Engine EVENT_HANDLERS[2] uses actionData.targetSpace to resolve
    // the Charles V move; omitting it results in the 5CP fallback with
    // no movement. The 1517 setup seeds Vienna with 4 Hapsburg regulars.
    const state = createBotState(['hapsburg']);
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    addWar(state, 'hapsburg', 'ottoman');
    state.spaces = state.spaces || {};
    state.spaces['Valladolid'] = {
      controller: 'hapsburg', languageZone: 'spanish',
      units: [{ owner: 'hapsburg', regulars: 2, leaders: ['charles_v'] }]
    };
    const result = evaluateHomeCard(state, 'hapsburg');
    expect(result).not.toBeNull();
    expect(result.actionData.targetSpace).toBeTruthy();
    const target = result.actionData.targetSpace;
    const targetSpace = state.spaces[target];
    const inScope =
      targetSpace?.languageZone === 'german' ||
      ['Agram','Belgrade','Breslau','Brunn','Buda','Mohacs','Prague','Pressburg','Szegedin'].includes(target);
    expect(inScope).toBe(true);
  });

  it('Hapsburg: returns null if no viable Charles V target (no ally-controlled stack ≥2)', () => {
    const state = createBotState(['hapsburg']);
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    addWar(state, 'hapsburg', 'ottoman');
    // Wipe Hapsburg/ally units from every German/Hungary-home space
    for (const [name, sp] of Object.entries(state.spaces || {})) {
      const inScope =
        sp?.languageZone === 'german' ||
        ['Agram','Belgrade','Breslau','Brunn','Buda','Mohacs','Prague','Pressburg','Szegedin'].includes(name);
      if (!inScope) continue;
      sp.units = (sp.units || []).filter(
        u => u.owner !== 'hapsburg' && u.owner !== 'hungary_bohemia' && u.owner !== 'genoa'
      );
    }
    state.spaces['Valladolid'] = {
      controller: 'hapsburg', languageZone: 'spanish',
      units: [{ owner: 'hapsburg', regulars: 2, leaders: ['charles_v'] }]
    };
    const result = evaluateHomeCard(state, 'hapsburg');
    expect(result).toBeNull();
  });

  it('Hapsburg: returns null if not at war with Ottoman/Protestant', () => {
    const state = createBotState(['hapsburg']);
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    // Remove default wars for clean test
    state.wars = [];
    const result = evaluateHomeCard(state, 'hapsburg');
    expect(result).toBeNull();
  });

  it('England: plays to declare war if englandHomeCardWar is set', () => {
    const state = createBotState(['england']);
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    state.englandHomeCardWar = 'france';
    const result = evaluateHomeCard(state, 'england');
    expect(result).not.toBeNull();
    expect(result.actionData.mode).toBe('war');
    expect(result.actionData.targetPower).toBe('france');
  });

  it('England: advances marital status if Turn >= 2 and Henry alive', () => {
    const state = createBotState(['england']);
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    state.turn = 2;
    state.rulers = state.rulers || {};
    state.rulers.england = { id: 'henry_viii', name: 'Henry VIII', admin: 1 };
    const result = evaluateHomeCard(state, 'england');
    expect(result).not.toBeNull();
    expect(result.actionData.mode).toBe('marital');
  });

  it('England: skips marital mode when Henry VIII is captured', () => {
    // Engine validator rejects Marital when Henry is captured; Bot must
    // not keep re-submitting the same card every impulse.
    const state = createBotState(['england']);
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    state.turn = 3;
    state.rulers = state.rulers || {};
    state.rulers.england = { id: 'henry_viii', name: 'Henry VIII', admin: 1 };
    state.capturedLeaders = { france: ['henry_viii'] };
    const result = evaluateHomeCard(state, 'england');
    expect(result).toBeNull();
  });

  it('France: plays Chateau roll if modifier > -3', () => {
    const state = createBotState(['france']);
    setActiveBehaviorCard(state, 'france', 'france_the_knight_king');
    state.rulers = state.rulers || {};
    state.rulers.france = { id: 'francis_i', name: 'Francis I', admin: 1 };
    const result = evaluateHomeCard(state, 'france');
    expect(result).not.toBeNull();
    expect(result.actionData.homeEffect).toBe('chateau_roll');
  });

  it('Protestant: always returns null (response-only)', () => {
    const state = createBotState(['protestant']);
    setActiveBehaviorCard(state, 'protestant', 'protestant_sola_scriptura');
    const result = evaluateHomeCard(state, 'protestant');
    expect(result).toBeNull();
  });
});

describe('evaluateLeipzigDebate', () => {
  it('plays if >= 2 uncommitted papal debaters with value >= 2', () => {
    const state = createBotState(['papacy']);
    state.debaters = {
      papal: [
        { id: 'eck', value: 3, committed: false },
        { id: 'campeggio', value: 2, committed: false },
        { id: 'tetzel', value: 1, committed: false }
      ]
    };
    const result = evaluateLeipzigDebate(state);
    expect(result).not.toBeNull();
    expect(result.actionData.cardNumber).toBe(6);
  });

  it('returns null if < 2 eligible debaters', () => {
    const state = createBotState(['papacy']);
    state.debaters = {
      papal: [
        { id: 'eck', value: 3, committed: true },
        { id: 'tetzel', value: 1, committed: false }
      ]
    };
    const result = evaluateLeipzigDebate(state);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// Card Play Routing
// ══════════════════════════════════════════════════════════════════

describe('decideCardPlay', () => {
  it('routes Home card through evaluateHomeCard', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.hands = { ottoman: [1, 65, 75] }; // Home card first
    // Ensure Istanbul exists
    state.spaces = state.spaces || {};
    state.spaces['Istanbul'] = {
      controller: 'ottoman',
      units: [{ owner: 'ottoman', regulars: 4, mercenaries: 0, cavalry: 0, leaders: [] }]
    };
    const result = decideCardPlay(state, 'ottoman');
    // Ottoman Home card with Home=Yes should try to build regulars
    expect(result).not.toBeNull();
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
    expect(result.actionData.mode).toBe('recruit');
  });

  it('routes Mandatory event: always play event', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [9] }; // Barbary Pirates (mandatory)
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
    expect(result.actionData.mandatory).toBe(true);
  });

  it('routes Combat card: set aside if no immediate criteria', () => {
    const state = createBotState(['england']);
    state.hands = { england: [24] }; // Arquebusiers (combat)
    state.wars = [];
    const result = decideCardPlay(state, 'england');
    expect(result.actionType).toBe('SET_ASIDE_CARD');
  });

  it('routes Event card for CPs if §5 criteria not met', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.hands = { ottoman: [75] }; // Erasmus — Ottoman doesn't play
    state.wars = [];
    state.turn = 1;
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_CP');
  });

  it('routes Event card for event if §5 criteria met', () => {
    const state = createBotState(['protestant']);
    setActiveBehaviorCard(state, 'protestant', 'protestant_sola_scriptura');
    state.hands = { protestant: [65] }; // A Mighty Fortress — Protestant always plays
    const result = decideCardPlay(state, 'protestant');
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
  });

  it('returns PASS when hand is empty and no set-aside', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [] };
    state.botSetAside = { ottoman: [] };
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PASS');
  });

  it('uses set-aside cards for CPs when hand empty', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [] };
    state.botSetAside = { ottoman: [24, 25] }; // Arquebusiers, Field Artillery
    state.rulers = { ottoman: { id: 'suleiman', admin: 2 } };
    // Admin = 2, set-aside = 2 → could save, but let's set VP threshold high
    state.vp = { france: 25 }; // Someone at 25 VP → no saving
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_CP');
    expect(result.actionData.fromSetAside).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════
// Treaty Token Logic (§2.10.1)
// ══════════════════════════════════════════════════════════════════

describe('checkTreatyObligation', () => {
  it('returns false if no treaty tokens held', () => {
    const state = createBotState(['ottoman']);
    state.treatyTokens = { ottoman: [] };
    const result = checkTreatyObligation(state, 'ottoman', 65);
    expect(result.shouldPlayForTreaty).toBe(false);
  });

  it('returns true if card satisfies treaty for held token', () => {
    const state = createBotState(['ottoman']);
    // Ottoman holds Protestant's treaty token
    state.treatyTokens = { ottoman: ['protestant'] };
    // A Mighty Fortress (65) — treaty: token power is Protestant
    const result = checkTreatyObligation(state, 'ottoman', 65);
    expect(result.shouldPlayForTreaty).toBe(true);
    expect(result.tokenPower).toBe('protestant');
  });

  it('returns false if treaty already satisfied this turn', () => {
    const state = createBotState(['ottoman']);
    state.treatyTokens = { ottoman: ['protestant'] };
    state.treatySatisfied = { ottoman: true };
    const result = checkTreatyObligation(state, 'ottoman', 65);
    expect(result.shouldPlayForTreaty).toBe(false);
  });

  it('returns false if card does not satisfy treaty', () => {
    const state = createBotState(['ottoman']);
    state.treatyTokens = { ottoman: ['france'] };
    // A Mighty Fortress (65) — treaty is for Protestant only
    const result = checkTreatyObligation(state, 'ottoman', 65);
    expect(result.shouldPlayForTreaty).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// Ganging Up (§2.10.2)
// ══════════════════════════════════════════════════════════════════

describe('getGangingUpTargets', () => {
  it('returns powers at >= 21 VP and higher than Bot', () => {
    const state = createBotState(['ottoman']);
    // Track VP: ottoman=8, france=12, hapsburg=9, england=9
    // Total = track + bonus. Set bonus so:
    // ottoman total=10, france total=22, hapsburg total=19, england total=21
    state.vp = { ottoman: 2, france: 10, hapsburg: 10, england: 12 };
    const targets = getGangingUpTargets(state, 'ottoman');
    expect(targets).toContain('france');
    expect(targets).toContain('england');
    expect(targets).not.toContain('hapsburg');
  });

  it('uses 20 VP threshold in tournament mode', () => {
    const state = createBotState(['ottoman']);
    state.tournament = true;
    // Track VP: ottoman=8, france=12, hapsburg=9
    // Total: ottoman=10, france=20, hapsburg=19
    state.vp = { ottoman: 2, france: 8, hapsburg: 10 };
    const targets = getGangingUpTargets(state, 'ottoman');
    expect(targets).toContain('france');
    expect(targets).not.toContain('hapsburg');
  });

  it('returns empty if no powers meet threshold', () => {
    const state = createBotState(['ottoman']);
    // Track VP: ottoman=8, france=12, hapsburg=9
    // Total: ottoman=10, france=15, hapsburg=18
    state.vp = { ottoman: 2, france: 3, hapsburg: 9 };
    expect(getGangingUpTargets(state, 'ottoman')).toEqual([]);
  });
});

describe('shouldPlayEventGangingUp', () => {
  it('re-evaluates event criteria assuming at war with targets', () => {
    const state = createBotState(['hapsburg']);
    state.wars = []; // Not at war with anyone
    // Gabelle Revolt (80) — play if at war with France
    const result = shouldPlayEventGangingUp(state, 'hapsburg', 80, ['france']);
    expect(result).toBe(true);
  });

  it('returns false if no gang targets', () => {
    const result = shouldPlayEventGangingUp({}, 'hapsburg', 80, []);
    expect(result).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.25 Saving Cards
// ══════════════════════════════════════════════════════════════════

describe('shouldSaveCards', () => {
  it('saves if set-aside cards <= admin rating', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [24] }; // 1 card
    state.rulers = { ottoman: { id: 'suleiman', admin: 2 } };
    state.vp = {};
    expect(shouldSaveCards(state, 'ottoman')).toBe(true);
  });

  it('does not save if set-aside cards > admin rating', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [24, 25, 26] }; // 3 cards
    state.rulers = { ottoman: { id: 'suleiman', admin: 2 } };
    state.vp = {};
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });

  it('does not save if any power >= 25 VP', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [24] };
    state.rulers = { ottoman: { id: 'suleiman', admin: 2 } };
    state.vp = { france: 25 };
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });

  it('uses 23 VP threshold in tournament', () => {
    const state = createBotState(['ottoman']);
    state.tournament = true;
    state.botSetAside = { ottoman: [24] };
    state.rulers = { ottoman: { id: 'suleiman', admin: 2 } };
    state.vp = { france: 23 };
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });

  it('returns false if no set-aside cards', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [] };
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.10.3 Final Autumn Assaults
// ══════════════════════════════════════════════════════════════════

/**
 * Set Ottoman-controlled bridge keys so validateAssault's LOC check
 * (mirrored by the bot in getFinalAutumnAssaults) can trace from
 * Istanbul (capital) up through the Balkans to Vienna/Prague.
 * Default 1517 controllers leave Belgrade/Mohacs/Buda/Pressburg as
 * Hungary, breaking LOC for tests that besiege further-north keys.
 */
function setupOttomanBalkanLoc(state) {
  for (const bridge of ['Belgrade', 'Mohacs', 'Buda', 'Pressburg', 'Brunn']) {
    if (state.spaces[bridge]) {
      state.spaces[bridge].controller = 'ottoman';
      state.spaces[bridge].units = [];
      state.spaces[bridge].unrest = false;
    }
  }
}

describe('getFinalAutumnAssaults', () => {
  it('returns assault for each active siege', () => {
    const state = createBotState(['ottoman']);
    setupOttomanBalkanLoc(state);
    state.spaces['Vienna'] = {
      controller: 'hapsburg',
      besieged: true, besiegedBy: 'ottoman', defenders: 3
    };
    state.spaces['Buda'] = {
      controller: 'ottoman',
      besieged: true, besiegedBy: 'ottoman', defenders: 1
    };
    const assaults = getFinalAutumnAssaults(state, 'ottoman');
    expect(assaults.length).toBe(2);
    expect(assaults[0].actionData.free).toBe(true);
    expect(assaults.some(a => a.actionData.target === 'Vienna')).toBe(true);
    expect(assaults.some(a => a.actionData.target === 'Buda')).toBe(true);
  });

  it('skips siege when besieger has no LOC to a friendly fortification', () => {
    const state = createBotState(['ottoman']);
    // No Balkan LOC setup — Vienna unreachable from Istanbul through
    // Hungary-controlled bridges. Mirror engine's validateAssault.
    state.spaces['Vienna'] = {
      controller: 'hapsburg',
      besieged: true, besiegedBy: 'ottoman', defenders: 3
    };
    expect(getFinalAutumnAssaults(state, 'ottoman')).toEqual([]);
  });

  it('includes foreign war assaults when units >= enemy', () => {
    const state = createBotState(['ottoman']);
    state.spaces = {};
    state.activeForeignWars = {
      ottoman: [
        { id: 'fw_hungary', friendlyUnits: 4, enemyUnits: 3 }
      ]
    };
    const assaults = getFinalAutumnAssaults(state, 'ottoman');
    expect(assaults.length).toBe(1);
    expect(assaults[0].actionData.foreignWar).toBe(true);
  });

  it('returns empty array if no sieges or foreign wars', () => {
    const state = createBotState(['ottoman']);
    state.spaces = {};
    state.activeForeignWars = {};
    expect(getFinalAutumnAssaults(state, 'ottoman')).toEqual([]);
  });

  it('skips siege when besieger has no units in space', () => {
    // Stale siege: besieged flag was set but attacker units were wiped
    // earlier in the same turn (retreat/death). Defensive guard.
    const state = createBotState(['ottoman']);
    setupOttomanBalkanLoc(state);
    state.spaces['Vienna'] = {
      controller: 'hapsburg',
      besieged: true, besiegedBy: 'ottoman', defenders: 3,
      units: []  // Attacker units gone
    };
    state.spaces['Buda'] = {
      controller: 'ottoman',
      besieged: true, besiegedBy: 'ottoman', defenders: 1,
      units: [
        { owner: 'ottoman', regulars: 2, mercenaries: 0, cavalry: 0,
          squadrons: 0, corsairs: 0, leaders: [] }
      ]
    };
    const assaults = getFinalAutumnAssaults(state, 'ottoman');
    expect(assaults.length).toBe(1);
    expect(assaults[0].actionData.target).toBe('Buda');
  });

  it('skips siege when besieger stack has zero land units', () => {
    // Naval-only besieger stack (edge case): squadrons without land units
    // cannot assault a fortress.
    const state = createBotState(['ottoman']);
    state.spaces = state.spaces || {};
    state.spaces['Rhodes'] = {
      controller: 'hapsburg',
      besieged: true, besiegedBy: 'ottoman', defenders: 2,
      units: [
        { owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
          squadrons: 2, corsairs: 0, leaders: [] }
      ]
    };
    const assaults = getFinalAutumnAssaults(state, 'ottoman');
    expect(assaults.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Response Window Decision
// ══════════════════════════════════════════════════════════════════

describe('decideResponsePlay', () => {
  it('plays response card if criteria met from set-aside', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [31] }; // Foul Weather
    addWar(state, 'ottoman', 'hapsburg');
    const result = decideResponsePlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_RESPONSE_CARD');
    expect(result.actionData.cardNumber).toBe(31);
  });

  it('declines response if no set-aside cards', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [] };
    const result = decideResponsePlay(state, 'ottoman');
    expect(result.actionType).toBe('DECLINE_RESPONSE');
  });

  it('plays response for treaty if criteria met', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [35] }; // Siege Artillery
    state.treatyTokens = { ottoman: ['hapsburg'] };
    // Hapsburg has active siege
    state.spaces = state.spaces || {};
    state.spaces['Metz'] = {
      controller: 'france',
      besieged: true, besiegedBy: 'hapsburg', defenders: 2
    };
    const result = decideResponsePlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_RESPONSE_CARD');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — classifyCard
// ═══════════════════════════════════════════════════════════════════════

describe('classifyCard edge cases', () => {
  it('unknown card number returns "event"', () => {
    expect(classifyCard(9999)).toBe('event');
    expect(classifyCard(-1)).toBe('event');
  });

  it('card #6 (Leipzig Debate) is classified as home', () => {
    expect(classifyCard(6)).toBe('home');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — isHomeCardFor
// ═══════════════════════════════════════════════════════════════════════

describe('isHomeCardFor edge cases', () => {
  it('non-home card returns false for all powers', () => {
    const powers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
    for (const p of powers) {
      expect(isHomeCardFor(50, p)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — evaluateHomeCard
// ═══════════════════════════════════════════════════════════════════════

describe('evaluateHomeCard edge cases', () => {
  it('Ottoman returns null when >= 12 units in Istanbul', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.spaces['Istanbul'] = {
      ...state.spaces['Istanbul'],
      units: [{ owner: 'ottoman', regulars: 12, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = evaluateHomeCard(state, 'ottoman');
    expect(result).toBeNull();
  });

  it('Ottoman plays event when < 12 units in Istanbul', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.spaces['Istanbul'] = {
      ...state.spaces['Istanbul'],
      units: [{ owner: 'ottoman', regulars: 5, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: [] }]
    };
    const result = evaluateHomeCard(state, 'ottoman');
    expect(result).not.toBeNull();
    expect(result.actionData.cardNumber).toBe(1);
  });

  it('Hapsburg returns null when not at war', () => {
    const state = createBotState(['hapsburg']);
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    // No wars
    state.wars = [];
    const result = evaluateHomeCard(state, 'hapsburg');
    expect(result).toBeNull();
  });

  it('England plays marital status when Henry VIII alive and turn >= 2', () => {
    const state = createBotState(['england']);
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    state.turn = 2;
    state.rulers = state.rulers || {};
    state.rulers.england = { id: 'henry_viii', admin: 3 };
    state.englandHomeCardWar = null;
    const result = evaluateHomeCard(state, 'england');
    // Should play marital status or null depending on behavior card home flag
    if (result) {
      expect(result.actionData.mode).toBe('marital');
    }
  });

  it('Protestant always returns null (response-only Home)', () => {
    const state = createBotState(['protestant']);
    setActiveBehaviorCard(state, 'protestant', 'protestant_oratory');
    const result = evaluateHomeCard(state, 'protestant');
    expect(result).toBeNull();
  });

  it('returns null when no behavior card active (home=false)', () => {
    const state = createBotState(['ottoman']);
    // Empty faceUp → getActiveBehaviorCard returns null
    state.botDecks.ottoman.faceUp = [];
    const result = evaluateHomeCard(state, 'ottoman');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — evaluateLeipzigDebate
// ═══════════════════════════════════════════════════════════════════════

describe('evaluateLeipzigDebate edge cases', () => {
  it('returns null when < 2 uncommitted debaters with value >= 2', () => {
    const state = createBotState(['papacy']);
    state.debaters = {
      papal: [
        { id: 'cajetan', committed: true, value: 3 },
        { id: 'tetzel', committed: false, value: 1 }
      ]
    };
    expect(evaluateLeipzigDebate(state)).toBeNull();
  });

  it('returns action when >= 2 qualifying debaters', () => {
    const state = createBotState(['papacy']);
    state.debaters = {
      papal: [
        { id: 'cajetan', committed: false, value: 3 },
        { id: 'eck', committed: false, value: 3 }
      ]
    };
    const result = evaluateLeipzigDebate(state);
    expect(result).not.toBeNull();
    expect(result.actionData.cardNumber).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — Treaty & Ganging Up
// ═══════════════════════════════════════════════════════════════════════

describe('checkTreatyObligation edge cases', () => {
  it('returns false when no treaty tokens', () => {
    const state = createBotState(['ottoman']);
    state.treatyTokens = {};
    const result = checkTreatyObligation(state, 'ottoman', 50);
    expect(result.shouldPlayForTreaty).toBe(false);
  });

  it('returns false when treaty already satisfied this turn', () => {
    const state = createBotState(['ottoman']);
    state.treatyTokens = { ottoman: ['hapsburg'] };
    state.treatySatisfied = { ottoman: true };
    const result = checkTreatyObligation(state, 'ottoman', 50);
    expect(result.shouldPlayForTreaty).toBe(false);
  });
});

describe('getGangingUpTargets edge cases', () => {
  it('returns empty when no power >= 21 VP', () => {
    const state = createBotState(['ottoman']);
    // Track VP: ottoman=8, hapsburg=9, england=9
    // Set bonus so totals: ottoman=10, hapsburg=15, england=12
    state.vp = { ottoman: 2, hapsburg: 6, england: 3 };
    expect(getGangingUpTargets(state, 'ottoman')).toEqual([]);
  });

  it('returns powers at >= 21 VP above Bot VP', () => {
    const state = createBotState(['ottoman']);
    // Track VP: ottoman=8, hapsburg=9, england=9, france=12
    // Totals: ottoman=10, hapsburg=22, england=12, france=21
    state.vp = { ottoman: 2, hapsburg: 13, england: 3, france: 9 };
    const targets = getGangingUpTargets(state, 'ottoman');
    expect(targets).toContain('hapsburg');
    expect(targets).toContain('france');
    expect(targets).not.toContain('england');
  });

  it('does not include self or lower-VP powers', () => {
    const state = createBotState(['hapsburg']);
    // Track VP: hapsburg=9, ottoman=8
    // Totals: hapsburg=23, ottoman=21
    state.vp = { hapsburg: 14, ottoman: 13 };
    const targets = getGangingUpTargets(state, 'hapsburg');
    expect(targets).not.toContain('hapsburg');
    expect(targets).not.toContain('ottoman');
  });

  it('tournament mode uses threshold 20', () => {
    const state = createBotState(['ottoman']);
    state.tournament = true;
    // Track VP: ottoman=8, hapsburg=9 → totals: ottoman=10, hapsburg=20
    state.vp = { ottoman: 2, hapsburg: 11 };
    expect(getGangingUpTargets(state, 'ottoman')).toContain('hapsburg');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — shouldSaveCards
// ═══════════════════════════════════════════════════════════════════════

describe('shouldSaveCards edge cases', () => {
  it('returns false when set-aside is empty', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [] };
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });

  it('returns false when any power >= 25 VP (endgame)', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [24, 25] };
    state.vp = { hapsburg: 25 };
    state.rulers = { ottoman: { id: 'suleiman', admin: 4 } };
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });

  it('returns true when set-aside count <= admin rating', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [24] }; // 1 card
    state.vp = {};
    state.rulers = { ottoman: { id: 'suleiman', admin: 3 } };
    expect(shouldSaveCards(state, 'ottoman')).toBe(true);
  });

  it('tournament uses threshold 23', () => {
    const state = createBotState(['ottoman']);
    state.botSetAside = { ottoman: [24] };
    state.tournament = true;
    state.vp = { hapsburg: 23 };
    state.rulers = { ottoman: { id: 'suleiman', admin: 3 } };
    expect(shouldSaveCards(state, 'ottoman')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  11.4 Edge Cases — decideCardPlay routing
// ═══════════════════════════════════════════════════════════════════════

describe('decideCardPlay routing edge cases', () => {
  it('empty hand with no set-aside passes', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [] };
    state.botSetAside = { ottoman: [] };
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PASS');
  });

  it('empty hand with set-aside plays for CPs', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [] };
    state.botSetAside = { ottoman: [24] }; // Arquebusiers
    state.vp = { hapsburg: 25 }; // prevent saving
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_CP');
    expect(result.actionData.fromSetAside).toBe(true);
  });

  it('empty hand with saving criteria passes', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [] };
    state.botSetAside = { ottoman: [24] };
    state.vp = {};
    state.rulers = { ottoman: { id: 'suleiman', admin: 3 } };
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PASS');
    expect(result.actionData.saving).toBe(true);
  });

  it('mandatory card always plays as event', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [9] }; // Barbary Pirates (mandatory)
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
    expect(result.actionData.mandatory).toBe(true);
  });

  it('mandatory card 13 (Schmalkaldic League): held (set aside) on Turn 1', () => {
    const state = createBotState(['protestant']);
    state.turn = 1;
    state.hands = { protestant: [13] };
    const result = decideCardPlay(state, 'protestant');
    expect(result.actionType).toBe('SET_ASIDE_CARD');
  });

  it('mandatory card 13: held when Turn 2+ but < 12 Protestant spaces', () => {
    const state = createBotState(['protestant']);
    state.turn = 3;
    state.hands = { protestant: [13] };
    const result = decideCardPlay(state, 'protestant');
    expect(result.actionType).toBe('SET_ASIDE_CARD');
  });

  it('mandatory card 13: plays as event once Turn 2+ and 12+ Protestant spaces', () => {
    const state = createBotState(['protestant']);
    state.turn = 2;
    state.hands = { protestant: [13] };
    for (let i = 0; i < 12; i++) {
      state.spaces['SchmalkTest' + i] = { religion: 'protestant' };
    }
    const result = decideCardPlay(state, 'protestant');
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
    expect(result.actionData.mandatory).toBe(true);
  });

  it('unknown card in hand falls back to PASS', () => {
    const state = createBotState(['ottoman']);
    state.hands = { ottoman: [99999] };
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PASS');
  });
});

// ══════════════════════════════════════════════════════════════════
// Phase G1 — Event Scoring (eventScore / cpUtility / goalSaturation)
// ══════════════════════════════════════════════════════════════════

describe('Phase G2 — routeEventCard gating', () => {
  it('legacy shouldPlay=true routes to PLAY_CARD_EVENT (unchanged baseline)', () => {
    const state = createBotState(['protestant']);
    setActiveBehaviorCard(state, 'protestant', 'protestant_sola_scriptura');
    state.hands = { protestant: [65] };
    const result = decideCardPlay(state, 'protestant');
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
  });

  it('legacy shouldPlay=false with no treaty/gang → PLAY_CARD_CP (unchanged)', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.hands = { ottoman: [40] }; // Machiavelli: shouldPlay=() => false
    state.treatyTokens = { ottoman: [] };
    state.vp = { ottoman: 0, hapsburg: 0, france: 0, england: 0, papacy: 0, protestant: 0 };
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_CP');
  });

  it('hasEventScore: true for all G3/G4-migrated EVENT_CRITERIA entries', async () => {
    const { EVENT_CRITERIA, hasEventScore } = await import('./bot-event-criteria.js');
    for (const cardNumber of Object.keys(EVENT_CRITERIA)) {
      expect(hasEventScore(Number(cardNumber))).toBe(true);
    }
  });

  it('hasEventScore: false for non-EVENT_CRITERIA cards', async () => {
    const { hasEventScore } = await import('./bot-event-criteria.js');
    expect(hasEventScore(99999)).toBe(false);   // No criteria entry
    expect(hasEventScore(31)).toBe(false);      // Card 31 lives in RESPONSE_CRITERIA
  });
});

describe('eventScore (Phase G1)', () => {
  it('returns 0 for card with no criteria entry', () => {
    const state = createBotState(['ottoman']);
    expect(eventScore(state, 'ottoman', 99999)).toBe(0);
  });

  it('returns 0 for RESPONSE_CRITERIA-only card (not in EVENT_CRITERIA)', () => {
    const state = createBotState(['ottoman']);
    // Card 31 Foul Weather lives in RESPONSE_CRITERIA, not EVENT_CRITERIA
    expect(eventScore(state, 'ottoman', 31)).toBe(0);
  });

  it('explicit score function: Copernicus → 1.0 (always-play)', () => {
    const state = createBotState(['papacy']);
    expect(eventScore(state, 'papacy', 47)).toBeCloseTo(1.0, 5);
  });

  it('owner-strict: Augsburg Confession → 1.0 for Protestant, 0 otherwise', () => {
    const state = createBotState(['protestant']);
    expect(eventScore(state, 'protestant', 39)).toBeCloseTo(1.0, 5);
    expect(eventScore(state, 'ottoman', 39)).toBe(0);
  });

  it('conditional: Halley\'s Comet → 0.9 only when at war', () => {
    const state = createBotState(['ottoman']);
    state.wars = [];
    expect(eventScore(state, 'ottoman', 38)).toBe(0);
    state.wars = [{ a: 'ottoman', b: 'hapsburg' }];
    expect(eventScore(state, 'ottoman', 38)).toBeCloseTo(0.9, 5);
  });

  it('clamps score output to [0, 1]', () => {
    const state = createBotState(['protestant']);
    const s = eventScore(state, 'protestant', 39);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });

  describe('Inquisition tiered scoring (G4 follow-up)', () => {
    function setProtestantInZone(state, zone, count) {
      // Mark the first `count` matching spaces as protestant
      let n = 0;
      for (const sp of Object.values(state.spaces || {})) {
        if (n >= count) break;
        if (sp.languageZone === zone && sp.religion !== 'protestant') {
          sp.religion = 'protestant';
          n++;
        }
      }
    }

    it('Papal Inquisition (56): full score when ≥2 italian protestant spaces', () => {
      const state = createBotState(['papacy']);
      setProtestantInZone(state, 'italian', 2);
      expect(eventScore(state, 'papacy', 56)).toBeCloseTo(1.0, 5);
    });

    it('Papal Inquisition (56): mid score with exactly 1 italian protestant', () => {
      const state = createBotState(['papacy']);
      // Reset all italian spaces to non-protestant first to control the count
      for (const sp of Object.values(state.spaces || {})) {
        if (sp.languageZone === 'italian') sp.religion = 'catholic';
      }
      setProtestantInZone(state, 'italian', 1);
      expect(eventScore(state, 'papacy', 56)).toBeCloseTo(0.7, 5);
    });

    it('Papal Inquisition (56): floor 0.3 when no italian protestant spaces', () => {
      const state = createBotState(['papacy']);
      for (const sp of Object.values(state.spaces || {})) {
        if (sp.languageZone === 'italian') sp.religion = 'catholic';
      }
      expect(eventScore(state, 'papacy', 56)).toBeCloseTo(0.3, 5);
    });

    it('Papal Inquisition (56): 0 for non-Papacy', () => {
      const state = createBotState(['hapsburg']);
      expect(eventScore(state, 'hapsburg', 56)).toBe(0);
    });

    it('Spanish Inquisition (58): full score when ≥2 spanish protestant spaces', () => {
      const state = createBotState(['hapsburg']);
      setProtestantInZone(state, 'spanish', 2);
      expect(eventScore(state, 'hapsburg', 58)).toBeCloseTo(0.95, 5);
    });

    it('Spanish Inquisition (58): floor 0.3 when no spanish protestant spaces', () => {
      const state = createBotState(['hapsburg']);
      for (const sp of Object.values(state.spaces || {})) {
        if (sp.languageZone === 'spanish') sp.religion = 'catholic';
      }
      expect(eventScore(state, 'hapsburg', 58)).toBeCloseTo(0.3, 5);
    });

    it('Spanish Inquisition (58): 0 for non-Hapsburg/Papacy', () => {
      const state = createBotState(['ottoman']);
      expect(eventScore(state, 'ottoman', 58)).toBe(0);
    });
  });

  describe('Owner & precondition gating (2026-04-26 fixes)', () => {
    it('Shipbuilding (100): 0 for Protestant (engine rejects)', () => {
      const state = createBotState(['protestant']);
      expect(eventScore(state, 'protestant', 100)).toBe(0);
    });

    it('Shipbuilding (100): 0.85 for non-Protestant powers', () => {
      const state = createBotState(['ottoman']);
      expect(eventScore(state, 'ottoman', 100)).toBeCloseTo(0.85, 5);
    });

    it('Sack of Rome (95): 0 when no qualifying italian source stack', () => {
      const state = createBotState(['protestant']);
      // Default createBotState has no merc-heavy non-Papacy italian stacks
      expect(eventScore(state, 'protestant', 95)).toBe(0);
    });

    it('Sack of Rome (95): 0.9 when qualifying italian stack exists', () => {
      const state = createBotState(['france']);
      addWar(state, 'france', 'papacy');
      // Make Florence (italian zone) hold a French stack with mercs > 0
      // and Rome's Papal regs = 0 → French mercs > Papal regs
      state.spaces['Florence'] = state.spaces['Florence'] || {
        controller: 'france', languageZone: 'italian', units: []
      };
      state.spaces['Florence'].languageZone = 'italian';
      state.spaces['Florence'].units = [{
        owner: 'france', regulars: 0, mercenaries: 3, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: []
      }];
      state.spaces['Rome'] = state.spaces['Rome'] || { units: [] };
      state.spaces['Rome'].units = [];
      expect(eventScore(state, 'france', 95)).toBeCloseTo(0.9, 5);
    });
  });

  describe('Luther-committed gating (2026-06-11 fix #P)', () => {
    it('A Mighty Fortress (65): 1.0 for Protestant when Luther uncommitted', () => {
      const state = createBotState(['protestant']);
      state.debaters = { protestant: [{ id: 'luther', committed: false }] };
      expect(eventScore(state, 'protestant', 65)).toBeCloseTo(1.0, 5);
    });

    it('A Mighty Fortress (65): 0 for Protestant when Luther committed', () => {
      const state = createBotState(['protestant']);
      state.debaters = { protestant: [{ id: 'luther', committed: true }] };
      expect(eventScore(state, 'protestant', 65)).toBe(0);
    });

    it('Katherina Bora (85): 0 for Protestant when Luther committed', () => {
      const state = createBotState(['protestant']);
      state.debaters = { protestant: [{ id: 'luther', committed: true }] };
      expect(eventScore(state, 'protestant', 85)).toBe(0);
    });
  });
});

describe('computeGoalSaturation (Phase G1)', () => {
  it('returns 0 when no behavior card active', () => {
    const state = createBotState(['ottoman']);
    // Clear the deck so getActiveBehaviorCard returns null
    state.botDecks.ottoman.faceUp = [];
    expect(computeGoalSaturation(state, 'ottoman')).toBe(0);
  });

  it('returns 0 when no goals executed yet', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.botGoalCounts = { ottoman: {} };
    const sat = computeGoalSaturation(state, 'ottoman');
    expect(sat).toBe(0);
  });

  it('returns ~1 when all finite-max goals fully used', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const card = getActiveBehaviorCard(state.botDecks.ottoman);
    // Fully consume each finite-max goal
    state.botGoalCounts = { ottoman: {} };
    for (const g of card.goals) {
      if (Number.isFinite(g.max) && g.max > 0) {
        state.botGoalCounts.ottoman[g.type] = g.max;
      }
    }
    expect(computeGoalSaturation(state, 'ottoman')).toBeCloseTo(1, 5);
  });

  it('ignores INF-max goals in capacity tally', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const card = getActiveBehaviorCard(state.botDecks.ottoman);
    // Only burn INF goals — capacity should remain untouched → saturation 0
    state.botGoalCounts = { ottoman: {} };
    for (const g of card.goals) {
      if (!Number.isFinite(g.max)) {
        state.botGoalCounts.ottoman[g.type] = 10;
      }
    }
    expect(computeGoalSaturation(state, 'ottoman')).toBe(0);
  });

  it('clamps counts above max (defensive)', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const card = getActiveBehaviorCard(state.botDecks.ottoman);
    state.botGoalCounts = { ottoman: {} };
    for (const g of card.goals) {
      if (Number.isFinite(g.max) && g.max > 0) {
        state.botGoalCounts.ottoman[g.type] = g.max * 100;
      }
    }
    expect(computeGoalSaturation(state, 'ottoman')).toBeCloseTo(1, 5);
  });
});

describe('cpUtility (Phase G1)', () => {
  it('returns 0 for unknown card', () => {
    const state = createBotState(['ottoman']);
    expect(cpUtility(state, 'ottoman', 99999)).toBe(0);
  });

  it('peace time: 5 CP card with untouched goals is ~0.625', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.botGoalCounts = { ottoman: {} };
    state.wars = []; // No wars
    // Card 41 Marburg Colloquy is a 5-CP event card
    const u = cpUtility(state, 'ottoman', 41);
    // baseCpValue = min(5/8, 0.7) = 0.625; no saturation; no war
    expect(u).toBeCloseTo(0.625, 3);
  });

  it('wartime adds +0.10 bonus', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.botGoalCounts = { ottoman: {} };
    // Compare same card with/without war
    const peace = cpUtility({ ...state, wars: [] }, 'ottoman', 40);
    addWar(state, 'ottoman', 'hapsburg');
    const war = cpUtility(state, 'ottoman', 40);
    expect(war - peace).toBeCloseTo(0.10, 2);
  });

  it('drops as behavior-card goals saturate', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.wars = [];
    const card = getActiveBehaviorCard(state.botDecks.ottoman);

    state.botGoalCounts = { ottoman: {} };
    const fresh = cpUtility(state, 'ottoman', 40);

    // Fully consume finite-max goals → saturation → lower utility
    for (const g of card.goals) {
      if (Number.isFinite(g.max) && g.max > 0) {
        state.botGoalCounts.ottoman[g.type] = g.max;
      }
    }
    const saturated = cpUtility(state, 'ottoman', 40);
    expect(fresh).toBeGreaterThan(saturated);
  });

  it('clamps output to [0, 1]', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.botGoalCounts = { ottoman: {} };
    addWar(state, 'ottoman', 'hapsburg');
    // High CP + war bonus could theoretically push above 1 — verify clamp
    for (let n = 1; n <= 20; n++) {
      const u = cpUtility(state, 'ottoman', n);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Phase H2 — shouldRouteToEvent (threshold-jitter randomness)
// ══════════════════════════════════════════════════════════════════

/**
 * mulberry32 — small deterministic PRNG for reproducible sampling tests.
 * https://stackoverflow.com/a/47593316
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('shouldRouteToEvent (Phase H2)', () => {
  describe('r=0 deterministic mode (Phase G compatibility)', () => {
    it('event when es > cs + 0.05', () => {
      const { chose, threshold } = shouldRouteToEvent(0.7, 0.5, 0);
      expect(chose).toBe('event');
      expect(threshold).toBeCloseTo(0.05, 5);
    });

    it('cp when es <= cs + 0.05', () => {
      expect(shouldRouteToEvent(0.55, 0.5, 0).chose).toBe('cp');
    });

    it('cp on exact tie at the threshold (strict >)', () => {
      // 0.55 > 0.50 + 0.05 = 0.55 is FALSE; treat as CP
      expect(shouldRouteToEvent(0.55, 0.50, 0).chose).toBe('cp');
    });

    it('returns identical results across calls (RNG never invoked)', () => {
      let rngCalls = 0;
      const rng = () => { rngCalls++; return 0.5; };
      shouldRouteToEvent(0.7, 0.5, 0, rng);
      shouldRouteToEvent(0.7, 0.5, 0, rng);
      expect(rngCalls).toBe(0);
    });
  });

  describe('r=0.1 randomized mode', () => {
    it('clear-cut event (gap >> 2*r) always picks event', () => {
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(1.0, 0.2, 0.1, rng).chose === 'event') events++;
      }
      expect(events).toBe(1000);
    });

    it('clear-cut CP (gap << -2*r) always picks CP', () => {
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(0.2, 1.0, 0.1, rng).chose === 'event') events++;
      }
      expect(events).toBe(0);
    });

    it('boundary case (es = cs + 0.05) flips ~50/50', () => {
      // At es=0.55, cs=0.5, deterministic boundary is exactly 0.05.
      // jitter ∈ [-0.1, +0.1], so threshold ∈ [-0.05, 0.15]; condition
      // 0.55 > 0.5 + threshold ⇔ threshold < 0.05 ⇔ jitter < 0 → 50%.
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(0.55, 0.5, 0.1, rng).chose === 'event') events++;
      }
      expect(events).toBeGreaterThan(400);
      expect(events).toBeLessThan(600);
    });

    it('half-way below boundary (es = cs + 0.025) skews ~37.5% event', () => {
      // event iff threshold < 0.025 ⇔ jitter < -0.025
      //   ⇔ (rng - 0.5) * 0.2 < -0.025 ⇔ rng < 0.375
      // P = 37.5%. Allow ±5pp.
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(0.525, 0.5, 0.1, rng).chose === 'event') events++;
      }
      expect(events).toBeGreaterThan(325);
      expect(events).toBeLessThan(425);
    });

    it('above boundary (es = cs + 0.075) skews ~62.5% event', () => {
      // event iff threshold < 0.075 ⇔ jitter < 0.025 ⇔ rng < 0.625
      // P = 62.5%. Allow ±5pp.
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(0.575, 0.5, 0.1, rng).chose === 'event') events++;
      }
      expect(events).toBeGreaterThan(575);
      expect(events).toBeLessThan(675);
    });

    it('produces reproducible results with the same seed', () => {
      const rng1 = mulberry32(123);
      const rng2 = mulberry32(123);
      const seq1 = [];
      const seq2 = [];
      for (let i = 0; i < 50; i++) {
        seq1.push(shouldRouteToEvent(0.55, 0.5, 0.1, rng1).chose);
        seq2.push(shouldRouteToEvent(0.55, 0.5, 0.1, rng2).chose);
      }
      expect(seq1).toEqual(seq2);
    });
  });

  describe('r=0.3 max randomness', () => {
    it('still preserves clear-cut CP picks (es much less than cs)', () => {
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(0.1, 0.9, 0.3, rng).chose === 'event') events++;
      }
      // gap = -0.8; jitter ∈ [-0.3, 0.3] → threshold ∈ [-0.25, 0.35]
      // event iff 0.1 > 0.9 + threshold = > [0.65, 1.25] — never
      expect(events).toBe(0);
    });

    it('still preserves clear-cut event picks (es much greater than cs)', () => {
      const rng = mulberry32(42);
      let events = 0;
      for (let i = 0; i < 1000; i++) {
        if (shouldRouteToEvent(1.0, 0.1, 0.3, rng).chose === 'event') events++;
      }
      // gap = 0.9; jitter ∈ [-0.3, 0.3] → threshold ∈ [-0.25, 0.35]
      // event iff 1.0 > 0.1 + threshold = > [-0.15, 0.45] — always
      expect(events).toBe(1000);
    });
  });

  describe('robustness against bad randomness inputs', () => {
    it('treats negative randomness as 0 (no jitter)', () => {
      let rngCalls = 0;
      const rng = () => { rngCalls++; return 0.99; };
      const a = shouldRouteToEvent(0.7, 0.5, -0.5, rng);
      const b = shouldRouteToEvent(0.7, 0.5, 0, rng);
      expect(a).toEqual(b);
      expect(rngCalls).toBe(0);
    });

    it('NaN randomness treated as 0', () => {
      let rngCalls = 0;
      const rng = () => { rngCalls++; return 0.99; };
      const a = shouldRouteToEvent(0.7, 0.5, NaN, rng);
      expect(a.threshold).toBeCloseTo(0.05, 5);
      expect(rngCalls).toBe(0);
    });
  });
});

// ══════════════════════════════════════════════════════════════════
// Phase H2 — routeEventCard end-to-end with state.botEventRandomness
// ══════════════════════════════════════════════════════════════════

describe('routeEventCard with botEventRandomness (Phase H2)', () => {
  it('r=0: identical to Phase G baseline (Roxelana → event for Ottoman)', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.hands = { ottoman: [42] }; // Roxelana: score=1.0 for ottoman
    state.botEventRandomness = 0;
    const result = decideCardPlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_CARD_EVENT');
  });

  it('r>0: clear-cut event still routes to event regardless of jitter', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    state.hands = { ottoman: [42] };
    state.botEventRandomness = 0.3;
    // Run multiple times — Roxelana gap is 1.0 vs ~0.625 → always event
    for (let i = 0; i < 30; i++) {
      const result = decideCardPlay(state, 'ottoman');
      expect(result.actionType).toBe('PLAY_CARD_EVENT');
    }
  });
});
