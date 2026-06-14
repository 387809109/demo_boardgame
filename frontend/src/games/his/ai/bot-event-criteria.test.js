/**
 * Here I Stand — Bot Event Card Criteria Tests
 *
 * Tests for Phase C3: Event card decision table (~90 entries).
 * Verifies shouldPlayEvent, satisfiesTreaty, shouldPlayResponse.
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import { addWar } from '../state/war-helpers.js';
import {
  shouldPlayEvent, satisfiesTreaty, shouldPlayResponse,
  hasEventCriteria, hasResponseCriteria,
  EVENT_CRITERIA, RESPONSE_CRITERIA
} from './bot-event-criteria.js';

// ── Helpers ──────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  state.vp = state.vp || {};
  // Clear initial wars from 1517 scenario for clean test isolation
  state.wars = [];
  return state;
}

// ══════════════════════════════════════════════════════════════════
// Event Criteria Coverage
// ══════════════════════════════════════════════════════════════════

describe('shouldPlayEvent — power-specific always-play cards', () => {
  it('A Mighty Fortress (65): Protestant always plays', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'protestant', 65)).toBe(true);
    expect(shouldPlayEvent(state, 'hapsburg', 65)).toBe(false);
  });

  it('A Mighty Fortress (65) / Katherina Bora (85): not played when Luther committed', () => {
    const state = createBotState();
    state.debaters = { protestant: [{ id: 'luther', committed: true }] };
    expect(shouldPlayEvent(state, 'protestant', 65)).toBe(false);
    expect(shouldPlayEvent(state, 'protestant', 85)).toBe(false);
  });

  it('Copernicus (47): always played for VPs', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'ottoman', 47)).toBe(true);
    expect(shouldPlayEvent(state, 'france', 47)).toBe(true);
  });

  it('Michael Servetus (51): always for 1 VP', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'hapsburg', 51)).toBe(true);
  });

  it('Spanish Inquisition (58): Hapsburg/Papacy always', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'hapsburg', 58)).toBe(true);
    expect(shouldPlayEvent(state, 'papacy', 58)).toBe(true);
    expect(shouldPlayEvent(state, 'france', 58)).toBe(false);
  });

  it('Printing Press (90): Protestant always', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'protestant', 90)).toBe(true);
    expect(shouldPlayEvent(state, 'ottoman', 90)).toBe(false);
  });

  it('Papal Inquisition (56): Papacy only', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'papacy', 56)).toBe(true);
    expect(shouldPlayEvent(state, 'protestant', 56)).toBe(false);
  });

  it('Jesuit Education (55): Papacy always', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'papacy', 55)).toBe(true);
    expect(shouldPlayEvent(state, 'england', 55)).toBe(false);
  });
});

describe('shouldPlayEvent — war-conditional cards', () => {
  it('Fuggers (79): played if at war', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'england', 79)).toBe(false);
    addWar(state, 'england', 'france');
    expect(shouldPlayEvent(state, 'england', 79)).toBe(true);
  });

  it('Foreign Recruits (76): if at war', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'hapsburg', 76)).toBe(false);
    addWar(state, 'hapsburg', 'france');
    expect(shouldPlayEvent(state, 'hapsburg', 76)).toBe(true);
  });

  it('Gabelle Revolt (80): at war with France', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'england', 80)).toBe(false);
    addWar(state, 'england', 'france');
    expect(shouldPlayEvent(state, 'england', 80)).toBe(true);
  });

  it('War in Persia (110): at war with Ottoman', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'hapsburg', 110)).toBe(false);
    addWar(state, 'hapsburg', 'ottoman');
    expect(shouldPlayEvent(state, 'hapsburg', 110)).toBe(true);
  });

  it('Revolt in Egypt (92): at war with Ottoman', () => {
    const state = createBotState();
    addWar(state, 'france', 'ottoman');
    expect(shouldPlayEvent(state, 'france', 92)).toBe(true);
  });

  it('Revolt in Ireland (93): at war with England', () => {
    const state = createBotState();
    addWar(state, 'france', 'england');
    expect(shouldPlayEvent(state, 'france', 93)).toBe(true);
  });

  it('Trace Italienne (104): at war with major power', () => {
    const state = createBotState();
    addWar(state, 'france', 'hapsburg');
    expect(shouldPlayEvent(state, 'france', 104)).toBe(true);
  });

  it('Threat to Power (103): at war', () => {
    const state = createBotState();
    addWar(state, 'ottoman', 'hapsburg');
    expect(shouldPlayEvent(state, 'ottoman', 103)).toBe(true);
  });
});

describe('shouldPlayEvent — never-play cards', () => {
  it('Machiavelli: The Prince (40): never played as event', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'ottoman', 40)).toBe(false);
    expect(shouldPlayEvent(state, 'france', 40)).toBe(false);
  });

  it('Diplomatic Overture (74): never by Bots', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'hapsburg', 74)).toBe(false);
  });

  it('Spring Preparations (102): never by Bots', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'england', 102)).toBe(false);
  });

  it('Venetian Informant (109): never by Bots', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'france', 109)).toBe(false);
  });
});

describe('shouldPlayEvent — condition-dependent cards', () => {
  it('Erasmus (75): Protestant on T1-2, Papacy on T3+', () => {
    const state = createBotState();
    state.turn = 1;
    expect(shouldPlayEvent(state, 'protestant', 75)).toBe(true);
    expect(shouldPlayEvent(state, 'papacy', 75)).toBe(false);

    state.turn = 3;
    expect(shouldPlayEvent(state, 'protestant', 75)).toBe(false);
    expect(shouldPlayEvent(state, 'papacy', 75)).toBe(true);
  });

  it('Indulgence Vendor (81): Papacy if St. Peter\'s incomplete', () => {
    const state = createBotState();
    state.stPetersProgress = 3; // Incomplete
    expect(shouldPlayEvent(state, 'papacy', 81)).toBe(true);

    state.stPetersProgress = 5; // Complete
    expect(shouldPlayEvent(state, 'papacy', 81)).toBe(false);
  });

  it('Michelangelo (52): Papacy if St. Peter\'s incomplete', () => {
    const state = createBotState();
    state.stPetersProgress = 0;
    expect(shouldPlayEvent(state, 'papacy', 52)).toBe(true);
    state.stPetersProgress = 5;
    expect(shouldPlayEvent(state, 'papacy', 52)).toBe(false);
  });

  it('Treachery! (105): if has active siege', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'ottoman', 105)).toBe(false);
    state.spaces = state.spaces || {};
    state.spaces['Vienna'] = {
      controller: 'hapsburg',
      besieged: true, besiegedBy: 'ottoman'
    };
    expect(shouldPlayEvent(state, 'ottoman', 105)).toBe(true);
  });

  it('Sack of Rome (95): Protestant or at war with Papacy', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'protestant', 95)).toBe(true);
    expect(shouldPlayEvent(state, 'england', 95)).toBe(false);
    addWar(state, 'england', 'papacy');
    expect(shouldPlayEvent(state, 'england', 95)).toBe(true);
  });

  it('John Zapolya (83): controls Buda', () => {
    const state = createBotState();
    state.spaces = state.spaces || {};
    state.spaces['Buda'] = { controller: 'ottoman' };
    expect(shouldPlayEvent(state, 'ottoman', 83)).toBe(true);
    expect(shouldPlayEvent(state, 'hapsburg', 83)).toBe(false);
  });

  it('Julia Gonzaga (84): Ottoman with >= 2 corsairs (piracy enabled)', () => {
    const state = createBotState();
    state.piracyEnabled = true; // engine requires Barbary Pirates played first
    state.spaces = state.spaces || {};
    state.spaces['Algiers'] = {
      controller: 'ottoman',
      units: [{ owner: 'ottoman', corsairs: 3 }]
    };
    expect(shouldPlayEvent(state, 'ottoman', 84)).toBe(true);
    // Not playable before piracy is enabled
    state.piracyEnabled = false;
    expect(shouldPlayEvent(state, 'ottoman', 84)).toBe(false);
  });

  it('Lady Jane Grey (59): only when England changed rulers this turn (2026-06-14 fix #V)', () => {
    const state = createBotState();
    state.englandRulerChangedThisTurn = false;
    expect(shouldPlayEvent(state, 'protestant', 59)).toBe(false);
    expect(shouldPlayEvent(state, 'papacy', 59)).toBe(false);
    state.englandRulerChangedThisTurn = true;
    expect(shouldPlayEvent(state, 'protestant', 59)).toBe(true);
    expect(shouldPlayEvent(state, 'papacy', 59)).toBe(true);
  });

  it('Pirate Haven (89): Ottoman only after piracy enabled (2026-06-14 fix #R)', () => {
    const state = createBotState();
    state.piracyEnabled = false;
    expect(shouldPlayEvent(state, 'ottoman', 89)).toBe(false);
    state.piracyEnabled = true;
    expect(shouldPlayEvent(state, 'ottoman', 89)).toBe(true);
    expect(shouldPlayEvent(state, 'hapsburg', 89)).toBe(false);
  });

  it('Thomas Cromwell (115): Papacy plays immediately', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'papacy', 115)).toBe(true);
    expect(shouldPlayEvent(state, 'england', 115)).toBe(false);
  });

  it('Dissolution of Monasteries (63): England/Protestant always, never Papacy', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'england', 63)).toBe(true);
    expect(shouldPlayEvent(state, 'protestant', 63)).toBe(true);
    expect(shouldPlayEvent(state, 'papacy', 63)).toBe(false);
  });
});

describe('shouldPlayEvent — returns false for unlisted cards', () => {
  it('returns false for card not in criteria table', () => {
    const state = createBotState();
    // Card 113 (Imperial Coronation) — not listed
    expect(shouldPlayEvent(state, 'hapsburg', 113)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// Treaty Satisfaction
// ══════════════════════════════════════════════════════════════════

describe('satisfiesTreaty', () => {
  it('A Mighty Fortress (65): satisfies for Protestant token', () => {
    const state = createBotState();
    expect(satisfiesTreaty(state, 'ottoman', 65, 'protestant')).toBe(true);
    expect(satisfiesTreaty(state, 'ottoman', 65, 'france')).toBe(false);
  });

  it('Erasmus (75): Protestant token T1-2, Papacy token T3+', () => {
    const state = createBotState();
    state.turn = 1;
    expect(satisfiesTreaty(state, 'hapsburg', 75, 'protestant')).toBe(true);
    expect(satisfiesTreaty(state, 'hapsburg', 75, 'papacy')).toBe(false);

    state.turn = 4;
    expect(satisfiesTreaty(state, 'hapsburg', 75, 'papacy')).toBe(true);
    expect(satisfiesTreaty(state, 'hapsburg', 75, 'protestant')).toBe(false);
  });

  it('Gabelle Revolt (80): token power at war with France', () => {
    const state = createBotState();
    addWar(state, 'england', 'france');
    expect(satisfiesTreaty(state, 'ottoman', 80, 'england')).toBe(true);
    expect(satisfiesTreaty(state, 'ottoman', 80, 'papacy')).toBe(false);
  });

  it('returns false for cards with no treaty function', () => {
    const state = createBotState();
    // Machiavelli (40) — treaty is null
    expect(satisfiesTreaty(state, 'hapsburg', 40, 'france')).toBe(false);
  });

  it('Thomas Cromwell (115): treaty for England if Dissolution in discard', () => {
    const state = createBotState();
    state.discardPile = [63]; // Dissolution
    expect(satisfiesTreaty(state, 'papacy', 115, 'england')).toBe(true);
    state.discardPile = [];
    expect(satisfiesTreaty(state, 'papacy', 115, 'england')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// Response/Combat Card Criteria
// ══════════════════════════════════════════════════════════════════

describe('shouldPlayResponse', () => {
  it('Foul Weather (31): plays if at war', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'england', 31)).toBe(false);
    addWar(state, 'england', 'france');
    expect(shouldPlayResponse(state, 'england', 31)).toBe(true);
  });

  it('The Wartburg (37): Protestant only', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'protestant', 37)).toBe(true);
    expect(shouldPlayResponse(state, 'papacy', 37)).toBe(false);
  });

  it('Professional Rowers (34): not Protestant', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'ottoman', 34)).toBe(true);
    expect(shouldPlayResponse(state, 'protestant', 34)).toBe(false);
  });

  it('Thomas Cromwell (115): non-Papacy if not excommunicated', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'england', 115)).toBe(true);
    expect(shouldPlayResponse(state, 'papacy', 115)).toBe(false);

    state.excommunicated = { england: true };
    expect(shouldPlayResponse(state, 'england', 115)).toBe(false);
  });

  it('Siege Artillery (35): if has active siege', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'ottoman', 35)).toBe(false);
    state.spaces = state.spaces || {};
    state.spaces['Vienna'] = {
      controller: 'hapsburg',
      besieged: true, besiegedBy: 'ottoman'
    };
    expect(shouldPlayResponse(state, 'ottoman', 35)).toBe(true);
  });

  it('Mercenaries Bribed (26): always true (runtime check)', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'france', 26)).toBe(true);
  });

  it('returns false for unlisted card', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'ottoman', 65)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// Criteria Table Coverage
// ══════════════════════════════════════════════════════════════════

describe('hasEventCriteria / hasResponseCriteria', () => {
  it('identifies cards with event criteria', () => {
    expect(hasEventCriteria(65)).toBe(true);  // A Mighty Fortress
    expect(hasEventCriteria(47)).toBe(true);  // Copernicus
    expect(hasEventCriteria(999)).toBe(false); // Non-existent
  });

  it('identifies cards with response criteria', () => {
    expect(hasResponseCriteria(31)).toBe(true);  // Foul Weather
    expect(hasResponseCriteria(26)).toBe(true);  // Mercenaries Bribed
    expect(hasResponseCriteria(65)).toBe(false);  // A Mighty Fortress
  });

  it('event criteria table has reasonable coverage', () => {
    // Should have entries for the ~60+ non-mandatory, non-combat event cards
    const eventCount = Object.keys(EVENT_CRITERIA).length;
    expect(eventCount).toBeGreaterThanOrEqual(55);
  });

  it('response criteria table covers Combat/Response cards', () => {
    const responseCount = Object.keys(RESPONSE_CRITERIA).length;
    expect(responseCount).toBeGreaterThanOrEqual(8);
  });
});

// ══════════════════════════════════════════════════════════════════
// Edge Cases
// ══════════════════════════════════════════════════════════════════

describe('shouldPlayEvent — edge cases', () => {
  it('returns false for non-existent card number', () => {
    const state = createBotState();
    expect(shouldPlayEvent(state, 'ottoman', 999)).toBe(false);
  });

  it('returns false for card with no power-specific criteria', () => {
    const state = createBotState();
    // Card 65 (A Mighty Fortress) only returns true for Protestant
    expect(shouldPlayEvent(state, 'papacy', 65)).toBe(false);
    expect(shouldPlayEvent(state, 'ottoman', 65)).toBe(false);
  });
});

describe('satisfiesTreaty — edge cases', () => {
  it('returns false for card with no treaty function', () => {
    const state = createBotState();
    // Pick a card that doesn't have treaty criteria
    // Card 47 (Copernicus) — always play, no treaty logic
    const result = satisfiesTreaty(state, 'ottoman', 47, 'france');
    expect(result).toBe(false);
  });

  it('returns false for non-existent card', () => {
    const state = createBotState();
    expect(satisfiesTreaty(state, 'ottoman', 999, 'france')).toBe(false);
  });
});

describe('shouldPlayResponse — edge cases', () => {
  it('returns false for non-existent card', () => {
    const state = createBotState();
    expect(shouldPlayResponse(state, 'ottoman', 999)).toBe(false);
  });

  it('returns false for event card (not response)', () => {
    const state = createBotState();
    // Card 65 is an event, not response
    expect(shouldPlayResponse(state, 'protestant', 65)).toBe(false);
  });
});
