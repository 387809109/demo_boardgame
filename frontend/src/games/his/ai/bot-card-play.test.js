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
  getFinalAutumnAssaults
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
    expect(result.actionData.homeEffect).toBe('build_regulars');
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
    expect(result.actionData.homeEffect).toBe('declare_war');
    expect(result.actionData.target).toBe('france');
  });

  it('England: advances marital status if Turn >= 2 and Henry alive', () => {
    const state = createBotState(['england']);
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    state.turn = 2;
    state.rulers = state.rulers || {};
    state.rulers.england = { id: 'henry_viii', name: 'Henry VIII', admin: 1 };
    const result = evaluateHomeCard(state, 'england');
    expect(result).not.toBeNull();
    expect(result.actionData.homeEffect).toBe('marital_status');
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
    expect(result.actionData.homeEffect).toBe('build_regulars');
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
    state.vp = { ottoman: 10, france: 22, hapsburg: 15, england: 21 };
    const targets = getGangingUpTargets(state, 'ottoman');
    expect(targets).toContain('france');
    expect(targets).toContain('england');
    expect(targets).not.toContain('hapsburg');
  });

  it('uses 20 VP threshold in tournament mode', () => {
    const state = createBotState(['ottoman']);
    state.tournament = true;
    state.vp = { ottoman: 10, france: 20, hapsburg: 19 };
    const targets = getGangingUpTargets(state, 'ottoman');
    expect(targets).toContain('france');
    expect(targets).not.toContain('hapsburg');
  });

  it('returns empty if no powers meet threshold', () => {
    const state = createBotState(['ottoman']);
    state.vp = { ottoman: 10, france: 15, hapsburg: 18 };
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

describe('getFinalAutumnAssaults', () => {
  it('returns assault for each active siege', () => {
    const state = createBotState(['ottoman']);
    state.spaces = state.spaces || {};
    state.spaces['Vienna'] = {
      controller: 'hapsburg',
      siege: { besieger: 'ottoman', defenders: 3 }
    };
    state.spaces['Buda'] = {
      controller: 'ottoman',
      siege: { besieger: 'ottoman', defenders: 1 }
    };
    const assaults = getFinalAutumnAssaults(state, 'ottoman');
    expect(assaults.length).toBe(2);
    expect(assaults[0].actionData.free).toBe(true);
    expect(assaults.some(a => a.actionData.target === 'Vienna')).toBe(true);
    expect(assaults.some(a => a.actionData.target === 'Buda')).toBe(true);
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
      siege: { besieger: 'hapsburg', defenders: 2 }
    };
    const result = decideResponsePlay(state, 'ottoman');
    expect(result.actionType).toBe('PLAY_RESPONSE_CARD');
  });
});
