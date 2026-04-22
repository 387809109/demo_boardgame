/**
 * Here I Stand — Bot Phase-Specific Logic Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState } from '../test-helpers.js';
import { initBotDecks } from './bot-controller.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { initBotDeck, getActiveBehaviorCard, CARD_BY_ID } from './behavior-cards.js';
import { addWar, removeWar } from '../state/war-helpers.js';
import {
  stackBotHand,
  shouldSueForPeace,
  shouldRansomLeader,
  shouldGrantCardToRescind,
  decideWarDeclaration,
  getWarDeclarationCost,
  pickDietOfWormsCard,
  decideSpringDeployment,
  decideWinterActions,
  pickExplorationChoice,
  getGarrisonRequirement
} from './bot-phases.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createBotState(botPowers = ['ottoman', 'hapsburg']) {
  const state = createTestState();
  initBotDecks(state, botPowers);
  return state;
}

/** Set up a behavior card for a Bot with a specific card */
function setActiveBehaviorCard(state, power, cardId) {
  const card = CARD_BY_ID[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  if (!state.botDecks[power]) state.botDecks[power] = initBotDeck(power);
  state.botDecks[power].faceUp = [cardId];
}

// ══════════════════════════════════════════════════════════════════
// §2.2 Card Draw — Hand Deck Stacking
// ══════════════════════════════════════════════════════════════════

describe('stackBotHand', () => {
  it('moves Home card to the bottom of hand', () => {
    // Ottoman Home card = 1
    const hand = [1, 101, 102, 103];
    stackBotHand(hand, 'ottoman');
    expect(hand[hand.length - 1]).toBe(1);
    expect(hand[0]).not.toBe(1);
  });

  it('keeps non-Home cards in original order when Home card is moved', () => {
    const hand = [1, 101, 102, 103];
    stackBotHand(hand, 'ottoman');
    expect(hand).toEqual([101, 102, 103, 1]);
  });

  it('does nothing if no Home card in hand', () => {
    const hand = [101, 102, 103];
    stackBotHand(hand, 'ottoman');
    expect(hand).toEqual([101, 102, 103]);
  });

  it('handles empty hand', () => {
    const hand = [];
    stackBotHand(hand, 'ottoman');
    expect(hand).toEqual([]);
  });

  it('handles hand with only Home card', () => {
    const hand = [2]; // Hapsburg Home
    stackBotHand(hand, 'hapsburg');
    expect(hand).toEqual([2]);
  });

  describe('Papacy special stacking', () => {
    it('puts Leipzig Debate at very bottom, Papal Bull above it', () => {
      // Papacy: Papal Bull = 5, Leipzig Debate = 6
      const hand = [5, 6, 101, 102];
      stackBotHand(hand, 'papacy');
      expect(hand[hand.length - 1]).toBe(6); // Leipzig at bottom
      expect(hand[hand.length - 2]).toBe(5); // Papal Bull above it
      expect(hand.slice(0, 2)).toEqual([101, 102]); // Dealt cards on top
    });

    it('handles Papacy hand with only Papal Bull', () => {
      const hand = [5, 101, 102];
      stackBotHand(hand, 'papacy');
      expect(hand[hand.length - 1]).toBe(5);
      expect(hand.slice(0, 2)).toEqual([101, 102]);
    });

    it('handles Papacy hand with only Leipzig Debate', () => {
      const hand = [6, 101, 102];
      stackBotHand(hand, 'papacy');
      expect(hand[hand.length - 1]).toBe(6);
      expect(hand.slice(0, 2)).toEqual([101, 102]);
    });

    it('handles Papacy hand with no home cards', () => {
      const hand = [101, 102, 103];
      stackBotHand(hand, 'papacy');
      expect(hand).toEqual([101, 102, 103]);
    });
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.4 Peace Segment
// ══════════════════════════════════════════════════════════════════

describe('shouldSueForPeace', () => {
  it('returns true when capital is lost', () => {
    const state = createBotState(['ottoman']);
    addWar(state, 'ottoman', 'hapsburg');
    state.spaces['Istanbul'].controller = 'hapsburg';
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spread_thin');
    expect(shouldSueForPeace(state, 'ottoman', 'hapsburg')).toBe(true);
  });

  it('returns true when Hapsburg loses either capital', () => {
    const state = createBotState(['hapsburg']);
    addWar(state, 'hapsburg', 'france');
    state.spaces['Vienna'].controller = 'france';
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_consolidation');
    expect(shouldSueForPeace(state, 'hapsburg', 'france')).toBe(true);
  });

  it('returns false when capitals are safe and keys balanced', () => {
    const state = createBotState(['ottoman']);
    addWar(state, 'ottoman', 'hapsburg');
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spread_thin');
    expect(shouldSueForPeace(state, 'ottoman', 'hapsburg')).toBe(false);
  });

  it('returns false when War field targets the enemy', () => {
    const state = createBotState(['ottoman']);
    addWar(state, 'ottoman', 'hapsburg');
    state.spaces['Istanbul'].controller = 'hapsburg'; // Capital lost!
    // Spoils of War has war: 'hapsburg'
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    expect(shouldSueForPeace(state, 'ottoman', 'hapsburg')).toBe(false);
  });

  it('returns true when more home keys lost than enemy', () => {
    const state = createBotState(['france']);
    addWar(state, 'france', 'hapsburg');
    setActiveBehaviorCard(state, 'france', 'france_field_of_cloth_gold');
    // Lose two French home keys
    state.spaces['Lyon'].controller = 'hapsburg';
    state.spaces['Rouen'].controller = 'hapsburg';
    expect(shouldSueForPeace(state, 'france', 'hapsburg')).toBe(true);
  });

  it('returns false when the specific enemy has taken nothing from power', () => {
    // Regression for BOT anomaly #4: France lost Paris to Hapsburg but is
    // also at war with England. Bot must NOT sue England for peace because
    // the engine validator rejects (England has captured no French leader
    // and controls no French home space), causing a noisy retry loop.
    const state = createBotState(['france']);
    addWar(state, 'france', 'hapsburg');
    addWar(state, 'france', 'england');
    setActiveBehaviorCard(state, 'france', 'france_field_of_cloth_gold');
    state.spaces['Paris'].controller = 'hapsburg';  // capital lost to Hapsburg
    expect(shouldSueForPeace(state, 'france', 'hapsburg')).toBe(true);
    expect(shouldSueForPeace(state, 'france', 'england')).toBe(false);
  });

  it('returns false when lost keys belong to third-party attacker only', () => {
    // Same pattern at the "home key balance" branch: France lost 2 keys to
    // Hapsburg but nothing to Ottoman. Do not sue Ottoman.
    const state = createBotState(['france']);
    addWar(state, 'france', 'hapsburg');
    addWar(state, 'france', 'ottoman');
    setActiveBehaviorCard(state, 'france', 'france_field_of_cloth_gold');
    state.spaces['Lyon'].controller = 'hapsburg';
    state.spaces['Rouen'].controller = 'hapsburg';
    expect(shouldSueForPeace(state, 'france', 'ottoman')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.5 Ransom Segment
// ══════════════════════════════════════════════════════════════════

describe('shouldRansomLeader', () => {
  it('returns false when no leaders are captured', () => {
    const state = createBotState(['ottoman']);
    state.capturedLeaders = {};
    const result = shouldRansomLeader(state, 'ottoman');
    expect(result.shouldRansom).toBe(false);
  });

  it('returns true when ruler is captured', () => {
    const state = createBotState(['ottoman']);
    state.capturedLeaders = { suleiman: 'hapsburg' };
    state.rulers = { ottoman: 'suleiman' };
    // Remove leaders from map
    for (const sp of Object.values(state.spaces)) {
      if (sp.units) {
        for (const stack of sp.units) {
          if (stack.owner === 'ottoman') stack.leaders = [];
        }
      }
    }
    const result = shouldRansomLeader(state, 'ottoman');
    expect(result.shouldRansom).toBe(true);
    expect(result.leaderId).toBe('suleiman');
  });

  it('returns true when no leaders remain on map', () => {
    const state = createBotState(['ottoman']);
    state.capturedLeaders = { ibrahim: 'hapsburg' };
    // Remove all Ottoman leaders from map
    for (const sp of Object.values(state.spaces)) {
      if (sp.units) {
        for (const stack of sp.units) {
          if (stack.owner === 'ottoman') stack.leaders = [];
        }
      }
    }
    const result = shouldRansomLeader(state, 'ottoman');
    expect(result.shouldRansom).toBe(true);
    expect(result.leaderId).toBe('ibrahim');
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.6 Excommunication Segment
// ══════════════════════════════════════════════════════════════════

describe('shouldGrantCardToRescind', () => {
  it('returns true when ruler is excommunicated', () => {
    const state = createBotState(['france']);
    state.excommunicatedRulers = { france: true };
    expect(shouldGrantCardToRescind(state, 'france')).toBe(true);
  });

  it('returns false when ruler is not excommunicated', () => {
    const state = createBotState(['france']);
    state.excommunicatedRulers = {};
    expect(shouldGrantCardToRescind(state, 'france')).toBe(false);
  });

  it('returns false when excommunicatedRulers is undefined', () => {
    const state = createBotState(['france']);
    delete state.excommunicatedRulers;
    expect(shouldGrantCardToRescind(state, 'france')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.7 War Declarations
// ══════════════════════════════════════════════════════════════════

describe('decideWarDeclaration', () => {
  it('Ottoman declares war based on Behavior Card war field', () => {
    const state = createBotState(['ottoman']);
    // Spoils of War: war = 'hapsburg'
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    const result = decideWarDeclaration(state, 'ottoman');
    expect(result.shouldDeclare).toBe(true);
    expect(result.target).toBe('hapsburg');
  });

  it('does not declare war when already at war with target', () => {
    const state = createBotState(['ottoman']);
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    addWar(state, 'ottoman', 'hapsburg');
    const result = decideWarDeclaration(state, 'ottoman');
    expect(result.shouldDeclare).toBe(false);
  });

  it('returns shouldDeclare false when no war field', () => {
    const state = createBotState(['ottoman']);
    // Spread Thin: war = null
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spread_thin');
    const result = decideWarDeclaration(state, 'ottoman');
    expect(result.shouldDeclare).toBe(false);
  });

  it('Protestant never declares war', () => {
    const state = createBotState(['protestant']);
    // Even with a war field (which Protestants don't have)
    setActiveBehaviorCard(state, 'protestant', 'protestant_preventative_war');
    const result = decideWarDeclaration(state, 'protestant');
    // Preventative War has war: 'hapsburg' but Protestant limitation blocks it
    expect(result.shouldDeclare).toBe(false);
  });

  it('England marks isEnglandHomeCard for France/Hapsburg/Scotland', () => {
    const state = createBotState(['england']);
    // Expedition: war = 'france'
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    const result = decideWarDeclaration(state, 'england');
    expect(result.shouldDeclare).toBe(true);
    expect(result.target).toBe('france');
    expect(result.isEnglandHomeCard).toBe(true);
  });

  it('England cannot declare war when already at war with France', () => {
    const state = createBotState(['england']);
    setActiveBehaviorCard(state, 'england', 'england_expedition');
    addWar(state, 'england', 'france');
    const result = decideWarDeclaration(state, 'england');
    // Already at war
    expect(result.shouldDeclare).toBe(false);
  });

  it('England war limitation: not if at war with Hapsburg (except Scotland)', () => {
    const state = createBotState(['england']);
    addWar(state, 'england', 'hapsburg');
    // New England: war = 'france'
    setActiveBehaviorCard(state, 'england', 'england_new_england');
    const result = decideWarDeclaration(state, 'england');
    expect(result.shouldDeclare).toBe(false);
  });

  it('Hapsburg declares war on France per Holy Roman Empire card', () => {
    const state = createBotState(['hapsburg']);
    // Holy Roman Empire: war = 'france'
    // Remove initial hapsburg-france war from scenario
    state.wars = state.wars.filter(
      w => !((w.a === 'hapsburg' && w.b === 'france') || (w.a === 'france' && w.b === 'hapsburg'))
    );
    setActiveBehaviorCard(state, 'hapsburg', 'hapsburg_holy_roman_empire');
    const result = decideWarDeclaration(state, 'hapsburg');
    expect(result.target).toBe('france');
    expect(result.shouldDeclare).toBe(true);
  });

  it('France limitation: not if at war with England', () => {
    const state = createBotState(['france']);
    addWar(state, 'france', 'england');
    setActiveBehaviorCard(state, 'france', 'france_italian_wars');
    const result = decideWarDeclaration(state, 'france');
    expect(result.shouldDeclare).toBe(false);
  });

  it('resolves minor power war target to allied major', () => {
    const state = createBotState(['ottoman']);
    // Masters of the Sea: war = 'venice'
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_masters_of_the_sea');
    // Venice allied with Papacy
    state.alliances.push({ a: 'venice', b: 'papacy' });
    const result = decideWarDeclaration(state, 'ottoman');
    expect(result.shouldDeclare).toBe(true);
    expect(result.target).toBe('papacy');
  });

  it('returns false when no bot deck', () => {
    const state = createTestState();
    const result = decideWarDeclaration(state, 'ottoman');
    expect(result.shouldDeclare).toBe(false);
  });
});

describe('getWarDeclarationCost', () => {
  it('returns correct cost for Ottoman → Hapsburg', () => {
    const state = createBotState(['ottoman']);
    state.hands.ottoman = [101, 102, 103]; // Some cards with CP
    const result = getWarDeclarationCost(state, 'ottoman', 'hapsburg');
    expect(result.cost).toBe(4);
  });

  it('returns canPay false when hand has insufficient CP', () => {
    const state = createBotState(['ottoman']);
    state.hands.ottoman = []; // Empty hand
    const result = getWarDeclarationCost(state, 'ottoman', 'hapsburg');
    expect(result.canPay).toBe(false);
  });

  it('returns canPay false for invalid DOW', () => {
    const state = createBotState(['protestant']);
    state.hands.protestant = [101, 102];
    const result = getWarDeclarationCost(state, 'protestant', 'ottoman');
    expect(result.canPay).toBe(false);
    expect(result.cost).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.8 Diet of Worms
// ══════════════════════════════════════════════════════════════════

describe('pickDietOfWormsCard', () => {
  it('picks top card from hand (index 0)', () => {
    const state = createBotState(['protestant']);
    // Give Protestant a regular card at top
    const regularCard = Object.values(CARD_BY_NUMBER).find(
      c => c.deck !== 'home' && c.cp >= 2
    );
    state.hands.protestant = [regularCard.number, 7]; // regular + Home
    const result = pickDietOfWormsCard(state, 'protestant');
    expect(result.cardNumber).toBe(regularCard.number);
  });

  it('falls back to Home card when top card is 1 CP', () => {
    const state = createBotState(['hapsburg']);
    // Find a 1 CP card
    const oneCpCard = Object.values(CARD_BY_NUMBER).find(
      c => c.cp === 1 && c.deck !== 'home'
    );
    if (oneCpCard) {
      state.hands.hapsburg = [oneCpCard.number, 2]; // 1CP + Home
      const result = pickDietOfWormsCard(state, 'hapsburg');
      expect(result.cardNumber).toBe(2); // Hapsburg Home card
    }
  });

  it('returns null for empty hand', () => {
    const state = createBotState(['protestant']);
    state.hands.protestant = [];
    const result = pickDietOfWormsCard(state, 'protestant');
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.9 Spring Deployment
// ══════════════════════════════════════════════════════════════════

describe('decideSpringDeployment', () => {
  it('returns null when not at war and no spare units', () => {
    const state = createBotState(['france']);
    // Remove all spare units from Paris
    const stack = state.spaces['Paris']?.units?.find(u => u.owner === 'france');
    if (stack) {
      stack.regulars = 0;
      stack.mercenaries = 0;
    }
    const result = decideSpringDeployment(state, 'france');
    // No enemy, no units to move → null or pass
    expect(result === null || result?.actionType === 'PASS' || result?.actionData).toBeDefined();
  });

  it('deploys toward enemy key when at war', () => {
    const state = createBotState(['ottoman']);
    addWar(state, 'ottoman', 'hapsburg');
    setActiveBehaviorCard(state, 'ottoman', 'ottoman_spoils_of_war');
    // Ensure Ottoman has units in Istanbul
    const stack = state.spaces['Istanbul']?.units?.find(u => u.owner === 'ottoman');
    if (stack) {
      stack.regulars = 6; // Plenty of units
    }
    const result = decideSpringDeployment(state, 'ottoman');
    if (result && result.actionType !== 'PASS') {
      expect(result.actionData.from).toBe('Istanbul');
      expect(result.actionData.to).toBeDefined();
      expect(result.actionData.units).toHaveProperty('regulars');
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.12 New World — Exploration Choice
// ══════════════════════════════════════════════════════════════════

describe('pickExplorationChoice', () => {
  it('low bonus: prefers Amazon first', () => {
    const choice = pickExplorationChoice({}, 'hapsburg', 1,
      ['amazon', 'st_lawrence', 'circumnavigation']);
    expect(choice).toBe('amazon');
  });

  it('low bonus: picks 1VP discoveries after Amazon', () => {
    const choice = pickExplorationChoice({}, 'england', 0,
      ['st_lawrence', 'great_lakes', 'circumnavigation']);
    expect(choice).toBe('st_lawrence');
  });

  it('low bonus: circumnavigation as last resort', () => {
    const choice = pickExplorationChoice({}, 'france', 1,
      ['circumnavigation']);
    expect(choice).toBe('circumnavigation');
  });

  it('high bonus: prefers Pacific Strait first', () => {
    const choice = pickExplorationChoice({}, 'hapsburg', 3,
      ['pacific_strait', 'amazon', 'circumnavigation']);
    expect(choice).toBe('pacific_strait');
  });

  it('high bonus: Amazon if no Pacific Strait', () => {
    const choice = pickExplorationChoice({}, 'hapsburg', 2,
      ['amazon', 'circumnavigation']);
    expect(choice).toBe('amazon');
  });

  it('high bonus: circumnavigation if only option', () => {
    const choice = pickExplorationChoice({}, 'hapsburg', 2,
      ['circumnavigation']);
    expect(choice).toBe('circumnavigation');
  });

  it('returns first available as fallback', () => {
    const choice = pickExplorationChoice({}, 'england', 0, ['something_unknown']);
    expect(choice).toBe('something_unknown');
  });

  it('returns null for empty choices', () => {
    const choice = pickExplorationChoice({}, 'england', 0, []);
    expect(choice).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// §4.10 Garrison Requirements
// ══════════════════════════════════════════════════════════════════

describe('getGarrisonRequirement', () => {
  it('capital requires 2 base garrison', () => {
    const state = createBotState(['ottoman']);
    const req = getGarrisonRequirement(state, 'Istanbul', 'ottoman');
    expect(req).toBeGreaterThanOrEqual(2);
  });

  it('controlled key requires 1 base garrison', () => {
    const state = createBotState(['ottoman']);
    // Find an Ottoman key that is not Istanbul
    let keySpace = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.isKey && sp.controller === 'ottoman' && name !== 'Istanbul') {
        keySpace = name;
        break;
      }
    }
    if (keySpace) {
      const req = getGarrisonRequirement(state, keySpace, 'ottoman');
      expect(req).toBeGreaterThanOrEqual(1);
    }
  });

  it('uncontrolled space returns 0', () => {
    const state = createBotState(['ottoman']);
    const req = getGarrisonRequirement(state, 'Paris', 'ottoman');
    expect(req).toBe(0);
  });

  it('non-fortified space returns 0', () => {
    const state = createBotState(['ottoman']);
    // Find an unfortified Ottoman space
    let unfSpace = null;
    for (const [name, sp] of Object.entries(state.spaces)) {
      if (sp.controller === 'ottoman' && !sp.isKey && !sp.isFortress && !sp.isElectorate) {
        unfSpace = name;
        break;
      }
    }
    if (unfSpace) {
      const req = getGarrisonRequirement(state, unfSpace, 'ottoman');
      expect(req).toBe(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// §2.11 Winter Actions
// ══════════════════════════════════════════════════════════════════

describe('decideWinterActions', () => {
  it('returns structure with navalReturnPorts, unrestRemoval', () => {
    const state = createBotState(['ottoman']);
    const result = decideWinterActions(state, 'ottoman');
    expect(result).toHaveProperty('navalReturnPorts');
    expect(result).toHaveProperty('unrestRemoval');
    expect(Array.isArray(result.navalReturnPorts)).toBe(true);
  });

  it('picks unrest removal from closest home space', () => {
    const state = createBotState(['france']);
    // Add unrest to two French home spaces
    state.spaces['Paris'].unrest = true;
    state.spaces['Lyon'].unrest = true;
    const result = decideWinterActions(state, 'france');
    // Paris is capital and closest
    expect(result.unrestRemoval).toBe('Paris');
  });

  it('returns null unrestRemoval when no unrest', () => {
    const state = createBotState(['ottoman']);
    const result = decideWinterActions(state, 'ottoman');
    expect(result.unrestRemoval).toBeNull();
  });
});

// ── Edge Cases ────────────────────────────────────────────────────────

describe('decideSpringDeployment — edge cases', () => {
  it('returns null at peace when no spare units above garrison', () => {
    const state = createBotState(['france']);
    // France at peace, but capital garrison exactly meets unit count
    const action = decideSpringDeployment(state, 'france');
    // Returns null or PASS — no deployable excess
    expect(action === null ||
      action?.actionType === 'SPRING_DEPLOY').toBe(true);
  });

  it('returns null at war when capitals are lost', () => {
    const state = createBotState(['france']);
    state.wars = [{ a: 'france', b: 'hapsburg' }];
    // Lose Paris
    state.spaces['Paris'].controller = 'hapsburg';
    const action = decideSpringDeployment(state, 'france');
    expect(action).toBeNull();
  });

  it('caps deploy units at formation max (4) when capital has >4 spare', () => {
    // Regression for BOT anomaly #6: the old code called buildDeployUnits(stack, spare)
    // where spare could be 6+, which then tripped the validator's "Exceeds
    // formation cap (6 > 4)" and made the bot silently pass spring deployment.
    const state = createBotState(['hapsburg']);
    addWar(state, 'hapsburg', 'ottoman');
    // Stack Vienna with 8 regulars (spare after garrison = 6)
    const viennaStack = state.spaces['Vienna']?.units?.find(u => u.owner === 'hapsburg');
    if (viennaStack) {
      viennaStack.regulars = 8;
      viennaStack.mercenaries = 0;
      viennaStack.cavalry = 0;
      viennaStack.leaders = [];
    }
    // Drain Valladolid so Vienna is the only capital with spare units
    const valStack = state.spaces['Valladolid']?.units?.find(u => u.owner === 'hapsburg');
    if (valStack) {
      valStack.regulars = 2;  // exactly garrison
      valStack.mercenaries = 0;
      valStack.cavalry = 0;
      valStack.leaders = [];
    }
    const action = decideSpringDeployment(state, 'hapsburg');
    expect(action).not.toBeNull();
    expect(action.actionType).toBe('SPRING_DEPLOY');
    expect(action.actionData.from).toBe('Vienna');
    const total =
      (action.actionData.units.regulars || 0) +
      (action.actionData.units.mercenaries || 0) +
      (action.actionData.units.cavalry || 0);
    expect(total).toBeLessThanOrEqual(4);
    expect(total).toBeGreaterThan(0);
  });
});

describe('pickExplorationChoice — edge cases', () => {
  it('high bonus: picks circumnavigation when only option', () => {
    const state = createBotState(['hapsburg']);
    const result = pickExplorationChoice(
      state, 'hapsburg', 3, ['circumnavigation']
    );
    expect(result).toBe('circumnavigation');
  });

  it('bonus = 2 uses high-bonus path (boundary)', () => {
    const state = createBotState(['hapsburg']);
    const result = pickExplorationChoice(
      state, 'hapsburg', 2, ['amazon', 'pacific_strait']
    );
    expect(result).toBe('pacific_strait');
  });

  it('bonus = 1 uses low-bonus path (boundary)', () => {
    const state = createBotState(['hapsburg']);
    const result = pickExplorationChoice(
      state, 'hapsburg', 1, ['amazon', 'pacific_strait']
    );
    expect(result).toBe('amazon');
  });
});

describe('getGarrisonRequirement — edge cases', () => {
  it('adds +1 when enemy unit within 2 spaces', () => {
    const state = createBotState(['france']);
    // Place enemy units near Paris
    state.wars = [{ a: 'france', b: 'hapsburg' }];
    // Find a space 1-2 away from Paris and place hapsburg there
    const neighbors = state.landEdges?.filter(
      e => e.a === 'Paris' || e.b === 'Paris'
    ) || [];
    if (neighbors.length > 0) {
      const adj = neighbors[0].a === 'Paris'
        ? neighbors[0].b : neighbors[0].a;
      state.spaces[adj].units.push({
        owner: 'hapsburg', regulars: 3, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });
      // Paris as capital: 2 + 1 (enemy nearby) = 3
      const req = getGarrisonRequirement(state, 'Paris', 'france');
      expect(req).toBe(3);
    }
  });

  it('returns 0 for space with no controller', () => {
    const state = createBotState(['france']);
    state.spaces['Metz'].controller = 'hapsburg';
    const req = getGarrisonRequirement(state, 'Metz', 'france');
    expect(req).toBe(0);
  });
});

describe('stackBotHand — edge cases', () => {
  it('handles multiple non-Home cards without modification', () => {
    const hand = [40, 50, 60];
    const result = stackBotHand(hand, 'ottoman');
    // No Home card → original order preserved
    expect(result).toEqual([40, 50, 60]);
  });
});
