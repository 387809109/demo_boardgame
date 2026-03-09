/**
 * Here I Stand — Event Card Handlers
 *
 * Dispatch table: EVENT_HANDLERS[cardNumber] = { execute, validate? }
 *
 * Handler execute() receives (state, power, actionData, helpers) and may return:
 *   { grantCp: N }  — caller should start CP spending instead of ending impulse
 *   undefined        — impulse ends normally after event resolves
 *
 * Context parameter in actionData.context:
 *   'action'  — played during Action Phase impulse (default)
 *   'winter'  — triggered by Winter overdue enforcement
 */

import { CARD_BY_NUMBER } from '../data/cards.js';
import {
  RULERS, CHATEAU_TABLE, CHATEAU_MODIFIERS,
  MARITAL_STATUS, PREGNANCY_TABLE
} from '../constants.js';
import { areAllied } from '../state/war-helpers.js';
import { EXTENDED_EVENT_HANDLERS } from './event-actions-extended.js';
import { DIPLOMACY_EVENT_HANDLERS } from './event-actions-diplomacy.js';

// ── Italian Keys (Master of Italy) ─────────────────────────────────

const ITALIAN_KEYS = ['Genoa', 'Milan', 'Venice', 'Florence', 'Naples'];

// ── Helper: Replace Ruler ──────────────────────────────────────────

/**
 * Replace a power's ruler with a new one.
 * @param {Object} state
 * @param {string} power
 * @param {string} oldRulerId
 * @param {string} newRulerId
 * @param {Object} helpers
 */
function replaceRuler(state, power, oldRulerId, newRulerId, helpers) {
  const ruler = RULERS[power]?.find(r => r.id === newRulerId);
  state.rulers[power] = newRulerId;

  // Remove old ruler leader from all spaces
  if (oldRulerId) {
    for (const sp of Object.values(state.spaces)) {
      for (const stack of sp.units) {
        if (stack.owner === power) {
          const idx = stack.leaders.indexOf(oldRulerId);
          if (idx !== -1) stack.leaders.splice(idx, 1);
        }
      }
    }
  }

  helpers.logEvent(state, 'ruler_replaced', {
    power, oldRuler: oldRulerId, newRuler: newRulerId,
    name: ruler?.name
  });
}

// ── Event Handlers ─────────────────────────────────────────────────

export const EVENT_HANDLERS = {};

// ── Card #2: Holy Roman Emperor (Hapsburg Home Card) ───────────────
// Move Charles V to a controlled Hapsburg home space, then 5 CP
EVENT_HANDLERS[2] = {
  validate(state, power, actionData) {
    if (power !== 'hapsburg') {
      return { valid: false, error: 'Only Hapsburg can play Holy Roman Emperor as event' };
    }
    // Charles V must not be captured or under siege
    if (state.capturedLeaders?.includes('charles_v')) {
      return { valid: false, error: 'Charles V is captured' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      // Move Charles V to target space
      for (const sp of Object.values(state.spaces)) {
        for (const stack of sp.units) {
          if (stack.owner === 'hapsburg') {
            const idx = stack.leaders.indexOf('charles_v');
            if (idx !== -1) {
              stack.leaders.splice(idx, 1);
              break;
            }
          }
        }
      }
      // Add to target
      const tgt = state.spaces[targetSpace];
      if (tgt) {
        let hapStack = tgt.units.find(u => u.owner === 'hapsburg');
        if (!hapStack) {
          hapStack = {
            owner: 'hapsburg', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          tgt.units.push(hapStack);
        }
        hapStack.leaders.push('charles_v');
      }
    }
    helpers.logEvent(state, 'event_holy_roman_emperor', {
      power, targetSpace
    });
    return { grantCp: 5 };
  }
};

// ── Card #4: Patron of the Arts (French Home Card) ─────────────────
// Roll on Chateau table for VP/cards
EVENT_HANDLERS[4] = {
  validate(state, power) {
    if (power !== 'france') {
      return { valid: false, error: 'Only France can play Patron of the Arts' };
    }
    if (state.rulers.france !== 'francis_i') {
      return { valid: false, error: 'Francis I must be ruler' };
    }
    if (state.capturedLeaders?.includes('francis_i')) {
      return { valid: false, error: 'Francis I is captured' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    // Compute modifier
    let modifier = 0;
    const milan = state.spaces['Milan'];
    if (milan && milan.controller === 'france') {
      modifier += CHATEAU_MODIFIERS.milanControlled;
    }
    const florence = state.spaces['Florence'];
    if (florence && florence.controller === 'france') {
      modifier += CHATEAU_MODIFIERS.florenceControlled;
    }

    // Roll (actionData.dieRoll provided by caller or random)
    const roll = (actionData.dieRoll ?? (Math.floor(Math.random() * 6) + 1)) + modifier;

    // Lookup result
    const result = CHATEAU_TABLE.find(r => roll >= r.minRoll && roll <= r.maxRoll);
    if (result && result.vp > 0) {
      state.vp.france = (state.vp.france || 0) + result.vp;
      state.chateauVp = (state.chateauVp || 0) + result.vp;
    }

    helpers.logEvent(state, 'event_patron_arts', {
      power, roll, modifier, vp: result?.vp || 0,
      drawCards: result?.drawCards || 0,
      discardCards: result?.discardCards || 0
    });
  }
};

// ── Card #5: Papal Bull (Papacy Home Card) ─────────────────────────
// Excommunicate a reformer OR excommunicate a ruler
EVENT_HANDLERS[5] = {
  validate(state, power) {
    if (power !== 'papacy') {
      return { valid: false, error: 'Only Papacy can play Papal Bull' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode; // 'reformer' or 'ruler'
    if (mode === 'reformer') {
      const reformerId = actionData.reformerId;
      if (reformerId && !state.excommunicatedReformers.includes(reformerId)) {
        state.excommunicatedReformers.push(reformerId);
      }
      helpers.logEvent(state, 'event_papal_bull_reformer', {
        reformerId
      });
    } else if (mode === 'ruler') {
      const targetPower = actionData.targetPower;
      if (targetPower) {
        state.excommunicatedRulers[targetPower] = true;
      }
      helpers.logEvent(state, 'event_papal_bull_ruler', {
        targetPower
      });
    }
  }
};

// ── Card #1: Janissaries (Ottoman Home Card) ──────────────────────
// Mode A: +5 dice field battle or +4 dice naval (response card)
// Mode B: Add 4 regulars to Ottoman home spaces
EVENT_HANDLERS[1] = {
  validate(state, power, actionData) {
    if (power !== 'ottoman') {
      return { valid: false, error: 'Only Ottoman can play Janissaries' };
    }
    const mode = actionData?.mode;
    if (mode === 'combat') {
      return { valid: true };
    }
    if (mode === 'recruit') {
      const placements = actionData.placements || [];
      const total = placements.reduce((s, p) => s + (p.count || 0), 0);
      if (total > 4) {
        return { valid: false, error: 'Cannot place more than 4 regulars' };
      }
      for (const p of placements) {
        const sp = state.spaces[p.space];
        if (!sp) return { valid: false, error: `Space "${p.space}" not found` };
        if (sp.controller !== 'ottoman') {
          return { valid: false, error: `"${p.space}" not Ottoman-controlled` };
        }
      }
      return { valid: true };
    }
    return { valid: false, error: 'Must specify mode: "combat" or "recruit"' };
  },
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode;

    if (mode === 'combat') {
      const combatType = actionData.combatType || 'field';
      const dice = combatType === 'naval' ? 4 : 5;
      state.janissariesBonus = { type: combatType, dice };
      helpers.logEvent(state, 'event_janissaries_combat', {
        power, combatType, dice
      });
      return;
    }

    if (mode === 'recruit') {
      const placements = actionData.placements || [];
      for (const p of placements) {
        const sp = state.spaces[p.space];
        let stack = sp.units.find(u => u.owner === 'ottoman');
        if (!stack) {
          stack = {
            owner: 'ottoman', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        stack.regulars += (p.count || 0);
      }
      helpers.logEvent(state, 'event_janissaries_recruit', {
        power, placements
      });
    }
  }
};

// ── Card #6: Leipzig Debate (Papal Home Card) ─────────────────────
// Call a debate with option to specify debater or block enemy debater
EVENT_HANDLERS[6] = {
  validate(state, power, actionData) {
    if (power !== 'papacy') {
      return { valid: false, error: 'Only Papacy can play Leipzig Debate' };
    }
    const { zone } = actionData;
    if (!zone) {
      return { valid: false, error: 'Must specify language zone' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const { zone, specifyDebater, blockDebater } = actionData;

    state.pendingLeipzigDebate = {
      zone,
      specifyDebater: specifyDebater || null,
      blockDebater: blockDebater || null
    };

    helpers.logEvent(state, 'event_leipzig_debate', {
      power, zone, specifyDebater, blockDebater
    });
  }
};

// ── Card #7: Here I Stand (Protestant Home Card) ──────────────────
// Mode A: Retrieve card from discard; Mode B: Substitute Luther in debate
EVENT_HANDLERS[7] = {
  validate(state, power, actionData) {
    if (power !== 'protestant') {
      return { valid: false, error: 'Only Protestant can play Here I Stand' };
    }
    // Luther must be alive (placed and not excommunicated to death)
    if (!state.lutherPlaced) {
      return { valid: false, error: 'Luther must be alive' };
    }
    const mode = actionData?.mode;
    if (mode === 'retrieve') {
      const cardNumber = actionData.cardNumber;
      if (!cardNumber) {
        return { valid: false, error: 'Must specify card to retrieve' };
      }
      if (!state.discard.includes(cardNumber)) {
        return { valid: false, error: 'Card not in discard pile' };
      }
      return { valid: true };
    }
    if (mode === 'substitute') {
      if (!state.pendingDebate) {
        return { valid: false, error: 'No pending debate for substitution' };
      }
      if (state.pendingDebate.zone !== 'german') {
        return { valid: false, error: 'Luther can only substitute in German zone' };
      }
      return { valid: true };
    }
    return { valid: false, error: 'Must specify mode: "retrieve" or "substitute"' };
  },
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode;

    if (mode === 'retrieve') {
      const cardNumber = actionData.cardNumber;
      const idx = state.discard.indexOf(cardNumber);
      if (idx !== -1) {
        state.discard.splice(idx, 1);
        state.hands.protestant.push(cardNumber);
      }
      helpers.logEvent(state, 'event_here_i_stand_retrieve', {
        power, cardNumber
      });
      return;
    }

    if (mode === 'substitute') {
      const debate = state.pendingDebate;
      const oldDebaterId = debate.attackerSide === 'protestant'
        ? debate.attackerId : debate.defenderId;

      // Replace with Luther
      if (debate.attackerSide === 'protestant') {
        debate.attackerId = 'luther';
      } else {
        debate.defenderId = 'luther';
      }

      // Old debater becomes committed
      const debaters = state.debaters.protestant || [];
      const old = debaters.find(d => d.id === oldDebaterId);
      if (old) old.committed = true;

      helpers.logEvent(state, 'event_here_i_stand_substitute', {
        power, replacedDebater: oldDebaterId
      });
    }
  }
};

// ── Card #3: Six Wives of Henry VIII (English Home Card) ───────────
// Mode A: Declare war + 5 CP; Mode B: Advance marital status + pregnancy
EVENT_HANDLERS[3] = {
  validate(state, power, actionData) {
    if (power !== 'england') {
      return { valid: false, error: 'Only England can play Six Wives' };
    }
    const mode = actionData?.mode;
    if (mode === 'war') {
      return { valid: true };
    }
    if (mode === 'marital') {
      if (state.turn < 2) {
        return { valid: false, error: 'Marital advancement requires Turn 2+' };
      }
      if (state.rulers.england !== 'henry_viii') {
        return { valid: false, error: 'Henry VIII must be ruler' };
      }
      if (state.capturedLeaders?.includes('henry_viii')) {
        return { valid: false, error: 'Henry VIII is captured' };
      }
      const idx = MARITAL_STATUS.indexOf(state.henryMaritalStatus);
      if (idx === -1 || idx >= MARITAL_STATUS.length - 1) {
        return { valid: false, error: 'Cannot advance marital status further' };
      }
      return { valid: true };
    }
    return { valid: false, error: 'Must specify mode: "war" or "marital"' };
  },
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode;

    if (mode === 'war') {
      // Declare war on target + grant 5 CP
      const target = actionData.targetPower;
      if (target && !state.wars.some(w =>
        (w.a === 'england' && w.b === target) ||
        (w.a === target && w.b === 'england')
      )) {
        state.wars.push({ a: 'england', b: target });
      }
      helpers.logEvent(state, 'event_six_wives_war', { power, target });
      return { grantCp: 5 };
    }

    if (mode === 'marital') {
      const oldIdx = MARITAL_STATUS.indexOf(state.henryMaritalStatus);
      const newStatus = MARITAL_STATUS[oldIdx + 1];
      state.henryMaritalStatus = newStatus;

      // Roll on pregnancy table
      const roll = actionData.dieRoll ?? (Math.floor(Math.random() * 6) + 1);
      const pregnancy = PREGNANCY_TABLE[roll];
      let childResult = pregnancy?.result || 'no_child';

      if (childResult === 'boy' || childResult === 'boy_and_girl') {
        state.edwardBorn = true;
      }
      if (childResult === 'girl' || childResult === 'boy_and_girl') {
        state.elizabethBorn = true;
      }

      helpers.logEvent(state, 'event_six_wives_marital', {
        power, oldStatus: MARITAL_STATUS[oldIdx],
        newStatus, roll, childResult
      });
    }
  }
};

// ── Card #9: Barbary Pirates ───────────────────────────────────────
// Algiers enters play with Ottoman units + Barbarossa
EVENT_HANDLERS[9] = {
  execute(state, power, actionData, helpers) {
    const algiers = state.spaces['Algiers'];
    if (algiers) {
      algiers.controller = 'ottoman';
      algiers.inPlay = true;
      let stack = algiers.units.find(u => u.owner === 'ottoman');
      if (!stack) {
        stack = {
          owner: 'ottoman', regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        algiers.units.push(stack);
      }
      stack.regulars += 2;
      stack.corsairs += 2;
      if (!stack.leaders.includes('barbarossa')) {
        stack.leaders.push('barbarossa');
      }
    }
    // Enable piracy for Ottomans
    state.piracyEnabled = true;
    helpers.logEvent(state, 'event_barbary_pirates', { power });
  }
};

// ── Card #10: Clement VII ──────────────────────────────────────────
// Leo X dies, Clement VII becomes papal ruler
EVENT_HANDLERS[10] = {
  execute(state, power, actionData, helpers) {
    replaceRuler(state, 'papacy', 'leo_x', 'clement_vii', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.papacy = 10;
    helpers.logEvent(state, 'event_clement_vii', { power });
  }
};

// ── Card #11: Defender of the Faith ────────────────────────────────
// Papacy makes 3 Counter-Reformation attempts (all zones)
EVENT_HANDLERS[11] = {
  execute(state, power, actionData, helpers) {
    // Set up pending counter-reformation attempts
    state.pendingCounterReformation = {
      attemptsRemaining: 3,
      zones: 'all',
      playedBy: power
    };
    helpers.logEvent(state, 'event_defender_faith', { power });
  }
};

// ── Card #12: Master of Italy ──────────────────────────────────────
// VP for controlling Italian keys
EVENT_HANDLERS[12] = {
  execute(state, power, actionData, helpers) {
    // Count Italian keys per power
    const keyCounts = {};
    for (const keyName of ITALIAN_KEYS) {
      const sp = state.spaces[keyName];
      if (sp && sp.controller) {
        keyCounts[sp.controller] = (keyCounts[sp.controller] || 0) + 1;
      }
    }

    const vpGains = {};
    const cardDraws = {};
    for (const [p, count] of Object.entries(keyCounts)) {
      if (count >= 3) {
        const vp = count >= 4 ? 2 : 1;
        state.vp[p] = (state.vp[p] || 0) + vp;
        vpGains[p] = vp;
      } else if (count === 2) {
        cardDraws[p] = 1;
      }
    }

    helpers.logEvent(state, 'event_master_of_italy', {
      power, keyCounts, vpGains, cardDraws
    });
  }
};

// ── Card #13: Schmalkaldic League ──────────────────────────────────
// Protestant defense league formed
EVENT_HANDLERS[13] = {
  validate(state, power, actionData) {
    const context = actionData?.context || 'action';
    if (context === 'winter') return { valid: true };
    // During action phase: Turn 2+ and 12+ protestant spaces
    if (state.turn < 2) {
      return { valid: false, error: 'Must be Turn 2 or later' };
    }
    let protSpaces = 0;
    for (const sp of Object.values(state.spaces)) {
      if (sp.religion === 'protestant') protSpaces++;
    }
    if (protSpaces < 12) {
      return { valid: false, error: 'Need 12+ Protestant spaces' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.schmalkaldicLeague = true;
    // Add Schmalkaldic League diplomacy cards to deck
    if (state.diplomacyDeck) {
      const slCards = [/* diplomacy_sl cards would be added here */];
      state.diplomacyDeck.push(...slCards);
    }
    helpers.logEvent(state, 'event_schmalkaldic_league', { power, turn: state.turn });
  }
};

// ── Card #14: Paul III ─────────────────────────────────────────────
// Clement VII dies, Paul III becomes papal ruler
EVENT_HANDLERS[14] = {
  execute(state, power, actionData, helpers) {
    // Remove Clement VII card from game
    const clementIdx = state.rulerCards?.papacy;
    if (clementIdx === 10) {
      state.removedCards.push(10);
    }
    replaceRuler(state, 'papacy', 'clement_vii', 'paul_iii', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.papacy = 14;
    // Papacy now wins ties during Counter-Reformation
    state.papacyWinsCounterReformTies = true;
    helpers.logEvent(state, 'event_paul_iii', { power });
  }
};

// ── Card #15: Society of Jesus ─────────────────────────────────────
// Place 2 Jesuit universities, enable Jesuit founding
EVENT_HANDLERS[15] = {
  execute(state, power, actionData, helpers) {
    // Place Jesuit universities at specified spaces
    const spaces = actionData.jesuitSpaces || [];
    for (const spaceName of spaces.slice(0, 2)) {
      const sp = state.spaces[spaceName];
      if (sp && sp.religion === 'catholic') {
        sp.jesuitUniversity = true;
      }
    }
    state.jesuitFoundingEnabled = true;
    helpers.logEvent(state, 'event_society_of_jesus', {
      power, spaces: spaces.slice(0, 2)
    });
  }
};

// ── Card #16: Calvin ───────────────────────────────────────────────
// Luther dies, Calvin becomes Protestant ruler
EVENT_HANDLERS[16] = {
  execute(state, power, actionData, helpers) {
    // Remove Luther reformer and debater
    state.debaters = state.debaters || {};
    if (state.debaters.luther) {
      state.debaters.luther.removed = true;
    }
    // Remove Luther from reformers on map
    for (const sp of Object.values(state.spaces)) {
      if (sp.reformer === 'luther') {
        sp.reformer = null;
      }
    }
    replaceRuler(state, 'protestant', 'luther', 'calvin', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.protestant = 16;
    helpers.logEvent(state, 'event_calvin', { power });
  }
};

// ── Card #17: Council of Trent ─────────────────────────────────────
// Papacy chooses 4 debaters, Protestant chooses 2, resolve mass debate
EVENT_HANDLERS[17] = {
  execute(state, power, actionData, helpers) {
    state.pendingCouncilOfTrent = {
      phase: 'papacy_choose',
      papacyDebaters: [],
      protestantDebaters: [],
      maxPapacy: 4,
      maxProtestant: 2
    };
    helpers.logEvent(state, 'event_council_of_trent', { power });
  }
};

// ── Card #18: Dragut ───────────────────────────────────────────────
// Barbarossa dies, Dragut replaces him
EVENT_HANDLERS[18] = {
  execute(state, power, actionData, helpers) {
    // Find Barbarossa's location
    let barbarossaLocation = null;
    for (const [spaceName, sp] of Object.entries(state.spaces)) {
      for (const stack of sp.units) {
        const idx = stack.leaders.indexOf('barbarossa');
        if (idx !== -1) {
          stack.leaders.splice(idx, 1);
          stack.leaders.push('dragut');
          barbarossaLocation = spaceName;
          break;
        }
      }
      if (barbarossaLocation) break;
    }
    // Check sea zones
    if (!barbarossaLocation && state.seaZones) {
      for (const [zoneName, zone] of Object.entries(state.seaZones)) {
        for (const fleet of (zone.fleets || [])) {
          const idx = fleet.leaders?.indexOf('barbarossa');
          if (idx !== -1 && idx !== undefined) {
            fleet.leaders.splice(idx, 1);
            fleet.leaders.push('dragut');
            barbarossaLocation = zoneName;
            break;
          }
        }
        if (barbarossaLocation) break;
      }
    }
    helpers.logEvent(state, 'event_dragut', {
      power, location: barbarossaLocation
    });
  }
};

// ── Card #19: Edward VI (English Succession) ──────────────────────
// Henry VIII dies, Edward VI becomes ruler, Dudley placed
EVENT_HANDLERS[19] = {
  execute(state, power, actionData, helpers) {
    replaceRuler(state, 'england', 'henry_viii', 'edward_vi', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.england = 19;

    // Remove Henry VIII home card (#3) from game
    if (!state.removedCards.includes(3)) {
      state.removedCards.push(3);
    }

    // Place Dudley leader if not already on map
    const dudleySpace = actionData.dudleySpace || 'London';
    const sp = state.spaces[dudleySpace];
    if (sp) {
      let stack = sp.units.find(u => u.owner === 'england');
      if (!stack) {
        stack = {
          owner: 'england', regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(stack);
      }
      if (!stack.leaders.includes('dudley')) {
        stack.leaders.push('dudley');
      }
    }

    // English armies become Protestant
    state.englandProtestant = true;

    helpers.logEvent(state, 'event_edward_vi', { power, dudleySpace });
  }
};

// ── Card #21: Mary I (English Succession) ─────────────────────────
// Edward VI dies, Mary I becomes ruler, English armies become Catholic
EVENT_HANDLERS[21] = {
  execute(state, power, actionData, helpers) {
    replaceRuler(state, 'england', 'edward_vi', 'mary_i', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.england = 21;

    // Remove Edward VI card (#19) from game
    if (!state.removedCards.includes(19)) {
      state.removedCards.push(19);
    }

    // English armies become Catholic again
    state.englandProtestant = false;

    helpers.logEvent(state, 'event_mary_i', { power });
  }
};

// ── Card #20: Henry II (French Succession) ────────────────────────
// Francis I dies, Henry II becomes ruler
EVENT_HANDLERS[20] = {
  execute(state, power, actionData, helpers) {
    replaceRuler(state, 'france', 'francis_i', 'henry_ii', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.france = 20;

    // Remove Francis I home card (#4) from game
    if (!state.removedCards.includes(4)) {
      state.removedCards.push(4);
    }

    helpers.logEvent(state, 'event_henry_ii', { power });
  }
};

// ── Card #22: Julius III (Papal Succession) ───────────────────────
// Paul III dies, Julius III becomes ruler
EVENT_HANDLERS[22] = {
  execute(state, power, actionData, helpers) {
    // Remove Paul III card (#14) from game
    if (!state.removedCards.includes(14)) {
      state.removedCards.push(14);
    }
    replaceRuler(state, 'papacy', 'paul_iii', 'julius_iii', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.papacy = 22;

    // Papacy continues to win ties during Counter-Reformation
    state.papacyWinsCounterReformTies = true;

    helpers.logEvent(state, 'event_julius_iii', { power });
  }
};

// ── Card #23: Elizabeth I (English Succession) ────────────────────
// Mary I dies, Elizabeth I becomes ruler
EVENT_HANDLERS[23] = {
  execute(state, power, actionData, helpers) {
    replaceRuler(state, 'england', 'mary_i', 'elizabeth_i', helpers);
    state.rulerCards = state.rulerCards || {};
    state.rulerCards.england = 23;

    // Remove Mary I card (#21) from game
    if (!state.removedCards.includes(21)) {
      state.removedCards.push(21);
    }

    // English armies become Protestant; no Papacy card interference
    state.englandProtestant = true;
    state.papacyCardInterference = false;

    helpers.logEvent(state, 'event_elizabeth_i', { power });
  }
};

// ── Card #97: Scots Raid (Conditional Mandatory) ──────────────────
// Ignored unless Scotland allied to France; Stirling → French, then CP
EVENT_HANDLERS[97] = {
  execute(state, power, actionData, helpers) {
    // Ignored if Scotland not allied to France
    if (!areAllied(state, 'scotland', 'france')) {
      helpers.logEvent(state, 'event_scots_raid_ignored', { power });
      return;
    }

    // Switch Stirling to French control if not already
    const stirling = state.spaces['Stirling'];
    if (stirling && stirling.controller !== 'france') {
      // Displace non-French/Scottish units
      stirling.units = stirling.units.filter(
        u => u.owner === 'france' || u.owner === 'scotland'
      );
      stirling.controller = 'france';
    }

    // Grant CP (6 normal, 3 if leader transferred)
    const leaderTransfer = actionData.leaderTransfer || false;
    const cp = leaderTransfer ? 3 : 6;

    helpers.logEvent(state, 'event_scots_raid', {
      power, leaderTransfer, cp
    });

    return { grantCp: cp };
  }
};

// ── Card #113: Imperial Coronation (Remove After Play) ────────────
// If Charles V in Italian zone → Hapsburgs + playing power draw 1 card
EVENT_HANDLERS[113] = {
  execute(state, power, actionData, helpers) {
    // Check if Charles V is in an Italian language zone space
    let charlesInItaly = false;
    for (const sp of Object.values(state.spaces)) {
      if (sp.languageZone === 'italian') {
        for (const stack of sp.units) {
          if (stack.owner === 'hapsburg' && stack.leaders.includes('charles_v')) {
            charlesInItaly = true;
            break;
          }
        }
      }
      if (charlesInItaly) break;
    }

    const cardDraws = {};
    if (charlesInItaly) {
      cardDraws.hapsburg = 1;
      if (power !== 'hapsburg') {
        cardDraws[power] = 1;
      }
    }

    helpers.logEvent(state, 'event_imperial_coronation', {
      power, charlesInItaly, cardDraws
    });
  }
};

// ── Card #114: La Forêt's Embassy in Istanbul (Remove After Play) ─
// If France and Ottoman allied → both draw 1 card
EVENT_HANDLERS[114] = {
  execute(state, power, actionData, helpers) {
    const allied = areAllied(state, 'france', 'ottoman');
    const cardDraws = {};

    if (allied) {
      cardDraws.france = 1;
      cardDraws.ottoman = 1;
    }

    helpers.logEvent(state, 'event_la_foret_embassy', {
      power, allied, cardDraws
    });
  }
};

// ── Combat Cards (#24-30) ─────────────────────────────────────────

// #24 Arquebusiers: +2 extra dice in field battle or naval combat
EVENT_HANDLERS[24] = {
  execute(state, power, actionData, helpers) {
    state.pendingCombatBonus = { card: 24, dice: 2, types: ['field', 'naval'] };
    helpers.logEvent(state, 'event_arquebusiers', { power });
  }
};

// #25 Field Artillery: +2 dice field battle (+3 for France/Ottoman)
EVENT_HANDLERS[25] = {
  execute(state, power, actionData, helpers) {
    const dice = (power === 'france' || power === 'ottoman') ? 3 : 2;
    state.pendingCombatBonus = { card: 25, dice, types: ['field'] };
    helpers.logEvent(state, 'event_field_artillery', { power, dice });
  }
};

// #26 Mercenaries Bribed: half opponent's mercs switch sides
EVENT_HANDLERS[26] = {
  validate(state, power) {
    if (power === 'ottoman') return { valid: false, error: 'Not playable by Ottomans' };
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    const targetPower = actionData.targetPower;
    if (!targetSpace || !targetPower || targetPower === 'ottoman') return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    const enemyStack = sp.units.find(u => u.owner === targetPower);
    if (!enemyStack) return;
    const switched = Math.ceil(enemyStack.mercenaries / 2);
    enemyStack.mercenaries -= switched;
    let myStack = sp.units.find(u => u.owner === power);
    if (!myStack) {
      myStack = {
        owner: power, regulars: 0, mercenaries: 0, cavalry: 0,
        squadrons: 0, corsairs: 0, leaders: []
      };
      sp.units.push(myStack);
    }
    myStack.mercenaries += switched;
    helpers.logEvent(state, 'event_mercenaries_bribed', {
      power, targetPower, targetSpace, switched
    });
  }
};

// #27 Mercenaries Grow Restless: remove all enemy mercs before assault
EVENT_HANDLERS[27] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    const targetPower = actionData.targetPower;
    if (!targetSpace || !targetPower) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    const enemyStack = sp.units.find(u => u.owner === targetPower);
    if (enemyStack) {
      const removed = enemyStack.mercenaries;
      enemyStack.mercenaries = 0;
      helpers.logEvent(state, 'event_mercenaries_restless', {
        power, targetPower, targetSpace, removed
      });
    }
  }
};

// #28 Siege Mining: +3 dice in assault (attacker)
EVENT_HANDLERS[28] = {
  execute(state, power, actionData, helpers) {
    state.pendingCombatBonus = { card: 28, dice: 3, types: ['assault'] };
    helpers.logEvent(state, 'event_siege_mining', { power });
  }
};

// #29 Surprise Attack: roll first in field battle
EVENT_HANDLERS[29] = {
  execute(state, power, actionData, helpers) {
    state.pendingCombatBonus = { card: 29, rollFirst: true, types: ['field'] };
    helpers.logEvent(state, 'event_surprise_attack', { power });
  }
};

// #30 Tercios: Hapsburg +3 dice (hit on 4+) or anti-Hapsburg -3 dice
EVENT_HANDLERS[30] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'hapsburg';
    if (mode === 'hapsburg') {
      state.pendingCombatBonus = {
        card: 30, dice: 3, hitOn4: true, types: ['field']
      };
    } else {
      state.pendingCombatBonus = {
        card: 30, reduceDice: 3, targetPower: 'hapsburg', types: ['field']
      };
    }
    helpers.logEvent(state, 'event_tercios', { power, mode });
  }
};

// ── Response Cards (#31-38) ───────────────────────────────────────

// #31 Foul Weather: -1 CP, restrict movement for impulse
EVENT_HANDLERS[31] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    state.pendingFoulWeather = {
      targetPower,
      maxMoveSpaces: 1,
      noAssault: true,
      noPiracy: true,
      noNavalMove: true
    };
    helpers.logEvent(state, 'event_foul_weather', { power, targetPower });
  }
};

// #32 Gout: stop leader from moving/assaulting this impulse
EVENT_HANDLERS[32] = {
  execute(state, power, actionData, helpers) {
    const targetLeader = actionData.targetLeader;
    state.pendingGout = { targetLeader };
    helpers.logEvent(state, 'event_gout', { power, targetLeader });
  }
};

// #33 Landsknechts: place mercs (4 Hapsburg, 2 others, Ottoman removes 2)
EVENT_HANDLERS[33] = {
  execute(state, power, actionData, helpers) {
    if (power === 'ottoman') {
      // Remove 2 mercenaries anywhere
      const targets = actionData.removals || [];
      for (const t of targets.slice(0, 2)) {
        const sp = state.spaces[t.space];
        if (!sp) continue;
        const stack = sp.units.find(u => u.owner === t.owner);
        if (stack && stack.mercenaries > 0) stack.mercenaries--;
      }
      helpers.logEvent(state, 'event_landsknechts_remove', {
        power, targets
      });
      return;
    }
    const count = power === 'hapsburg' ? 4 : 2;
    const placements = actionData.placements || [];
    let placed = 0;
    for (const p of placements) {
      if (placed >= count) break;
      const sp = state.spaces[p.space];
      if (!sp) continue;
      const stack = sp.units.find(u => u.owner === power);
      if (!stack) continue; // must have friendly units
      const toPlace = Math.min(p.count || 1, count - placed);
      stack.mercenaries += toPlace;
      placed += toPlace;
    }
    helpers.logEvent(state, 'event_landsknechts', { power, count, placed });
  }
};

// #34 Professional Rowers: modify naval roll ±2 or +3 dice naval
EVENT_HANDLERS[34] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'modify';
    if (mode === 'modify') {
      state.pendingNavalModifier = { modifier: actionData.modifier || 2 };
    } else {
      state.pendingCombatBonus = { card: 34, dice: 3, types: ['naval'] };
    }
    helpers.logEvent(state, 'event_professional_rowers', { power, mode });
  }
};

// #35 Siege Artillery: +2 dice in assault (hit on 3+), requires LOC
EVENT_HANDLERS[35] = {
  execute(state, power, actionData, helpers) {
    state.pendingCombatBonus = {
      card: 35, dice: 2, hitOn3: true, types: ['assault']
    };
    helpers.logEvent(state, 'event_siege_artillery', { power });
  }
};

// #36 Swiss Mercenaries: place mercs (4 French if France/Ottoman, 2 else)
EVENT_HANDLERS[36] = {
  execute(state, power, actionData, helpers) {
    const isFrenchBoosted = (power === 'france' || power === 'ottoman');
    const placePower = isFrenchBoosted ? 'france' : power;
    const count = isFrenchBoosted ? 4 : 2;
    const placements = actionData.placements || [];
    let placed = 0;
    for (const p of placements) {
      if (placed >= count) break;
      const sp = state.spaces[p.space];
      if (!sp) continue;
      const stack = sp.units.find(u => u.owner === placePower);
      if (!stack) continue;
      const toPlace = Math.min(p.count || 1, count - placed);
      stack.mercenaries += toPlace;
      placed += toPlace;
    }
    helpers.logEvent(state, 'event_swiss_mercenaries', {
      power, placePower, count, placed
    });
  }
};

// #37 The Wartburg: cancel event play (response)
EVENT_HANDLERS[37] = {
  validate(state, power) {
    if (power !== 'protestant') {
      return { valid: false, error: 'Only Protestant can play The Wartburg' };
    }
    if (!state.lutherPlaced) {
      return { valid: false, error: 'Luther must be alive' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingEventCancelled = true;
    state.protestantNoDebatesThisTurn = true;
    // Commit Luther
    const debaters = state.debaters?.protestant || [];
    const luther = debaters.find(d => d.id === 'luther');
    if (luther) luther.committed = true;
    helpers.logEvent(state, 'event_wartburg', { power });
  }
};

// #38 Halley's Comet: discard from hand OR force skip impulse
EVENT_HANDLERS[38] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'discard';
    if (mode === 'discard') {
      const targetPower = actionData.targetPower;
      if (targetPower && state.hands?.[targetPower]?.length > 0) {
        const idx = Math.floor(
          Math.random() * state.hands[targetPower].length
        );
        const discarded = state.hands[targetPower].splice(idx, 1)[0];
        state.discard.push(discarded);
        helpers.logEvent(state, 'event_halleys_comet_discard', {
          power, targetPower, discarded
        });
      }
    } else if (mode === 'skip') {
      const targetPower = actionData.targetPower;
      state.pendingSkipImpulse = state.pendingSkipImpulse || [];
      state.pendingSkipImpulse.push(targetPower);
      helpers.logEvent(state, 'event_halleys_comet_skip', {
        power, targetPower
      });
    }
  }
};

// ── Turn 3-4 Era Cards (#39-54) ──────────────────────────────────

// #39 Augsburg Confession: -1 papal counter-ref rolls, -1 die debates
EVENT_HANDLERS[39] = {
  validate(state, power) {
    // Melanchthon must be uncommitted
    const debaters = state.debaters?.protestant || [];
    const mel = debaters.find(d => d.id === 'melanchthon');
    if (mel && mel.committed) {
      return { valid: false, error: 'Melanchthon is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.augsburgConfessionActive = true;
    // Commit Melanchthon
    const debaters = state.debaters?.protestant || [];
    const mel = debaters.find(d => d.id === 'melanchthon');
    if (mel) mel.committed = true;
    helpers.logEvent(state, 'event_augsburg_confession', { power });
  }
};

// #40 Machiavelli: Declare war at no cost + 2 CP
EVENT_HANDLERS[40] = {
  execute(state, power, actionData, helpers) {
    const target = actionData.targetPower;
    if (target && !state.wars.some(w =>
      (w.a === power && w.b === target) ||
      (w.a === target && w.b === power)
    )) {
      state.wars.push({ a: power, b: target });
    }
    helpers.logEvent(state, 'event_machiavelli', { power, target });
    return { grantCp: 2 };
  }
};

// #41 Marburg Colloquy: commit debaters, make ref attempts
EVENT_HANDLERS[41] = {
  execute(state, power, actionData, helpers) {
    const committed = actionData.commitDebaters || [];
    const debaters = state.debaters?.protestant || [];
    let totalValue = 0;
    for (const id of committed) {
      const d = debaters.find(x => x.id === id);
      if (d) {
        d.committed = true;
        totalValue += d.value || 0;
      }
    }
    state.pendingReformation = {
      attemptsRemaining: totalValue,
      zones: 'all',
      playedBy: power
    };
    helpers.logEvent(state, 'event_marburg_colloquy', {
      power, committed, totalValue
    });
  }
};

// #42 Roxelana: free assault OR send Suleiman to Istanbul
EVENT_HANDLERS[42] = {
  execute(state, power, actionData, helpers) {
    if (power === 'ottoman') {
      state.pendingFreeAssault = {
        power: 'ottoman', requireLeader: 'suleiman'
      };
      helpers.logEvent(state, 'event_roxelana_assault', { power });
    } else {
      // Send Suleiman to Istanbul
      for (const sp of Object.values(state.spaces)) {
        for (const stack of sp.units) {
          if (stack.owner === 'ottoman') {
            const idx = stack.leaders.indexOf('suleiman');
            if (idx !== -1) {
              stack.leaders.splice(idx, 1);
            }
          }
        }
      }
      const istanbul = state.spaces['Istanbul'];
      if (istanbul) {
        let stack = istanbul.units.find(u => u.owner === 'ottoman');
        if (!stack) {
          stack = {
            owner: 'ottoman', regulars: 0, mercenaries: 0, cavalry: 0,
            squadrons: 0, corsairs: 0, leaders: []
          };
          istanbul.units.push(stack);
        }
        if (!stack.leaders.includes('suleiman')) {
          stack.leaders.push('suleiman');
        }
      }
      helpers.logEvent(state, 'event_roxelana_return', { power });
      return { grantCp: 2 };
    }
  }
};

// #43 Zwingli Dons Armor: kill 1 Catholic unit near Zurich, remove Zwingli
EVENT_HANDLERS[43] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        for (const stack of sp.units) {
          if (
            stack.owner === 'papacy' ||
            (stack.owner !== 'protestant' && stack.owner !== 'ottoman')
          ) {
            if (stack.regulars > 0) { stack.regulars--; break; }
            else if (stack.mercenaries > 0) { stack.mercenaries--; break; }
          }
        }
      }
    }
    // Remove Zwingli reformer and debater
    for (const sp of Object.values(state.spaces)) {
      if (sp.reformer === 'zwingli') sp.reformer = null;
    }
    const debaters = state.debaters?.protestant || [];
    const zwingli = debaters.find(d => d.id === 'zwingli');
    if (zwingli) zwingli.removed = true;
    helpers.logEvent(state, 'event_zwingli_dons_armor', {
      power, targetSpace
    });
  }
};

// #44 Affair of the Placards: 4 ref attempts French zone, commit Cop
EVENT_HANDLERS[44] = {
  validate(state) {
    const debaters = state.debaters?.protestant || [];
    const cop = debaters.find(d => d.id === 'cop');
    if (cop && cop.committed) {
      return { valid: false, error: 'Cop is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingReformation = {
      attemptsRemaining: 4,
      zones: 'french',
      playedBy: power
    };
    const debaters = state.debaters?.protestant || [];
    const cop = debaters.find(d => d.id === 'cop');
    if (cop) cop.committed = true;
    helpers.logEvent(state, 'event_affair_of_placards', { power });
  }
};

// #45 Calvin Expelled: remove Calvin for rest of turn
EVENT_HANDLERS[45] = {
  execute(state, power, actionData, helpers) {
    for (const sp of Object.values(state.spaces)) {
      if (sp.reformer === 'calvin') sp.reformer = null;
    }
    const debaters = state.debaters?.protestant || [];
    const calvin = debaters.find(d => d.id === 'calvin');
    if (calvin) {
      calvin.committed = true;
      calvin.expelledUntilNextTurn = true;
    }
    helpers.logEvent(state, 'event_calvin_expelled', { power });
  }
};

// #46 Calvin's Institutes: 5 ref French zone +1 modifier, commit Calvin
EVENT_HANDLERS[46] = {
  validate(state) {
    const debaters = state.debaters?.protestant || [];
    const calvin = debaters.find(d => d.id === 'calvin');
    if (calvin && calvin.committed) {
      return { valid: false, error: 'Calvin is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingReformation = {
      attemptsRemaining: 5,
      zones: 'french',
      modifier: 1,
      playedBy: power
    };
    const debaters = state.debaters?.protestant || [];
    const calvin = debaters.find(d => d.id === 'calvin');
    if (calvin) calvin.committed = true;
    helpers.logEvent(state, 'event_calvins_institutes', { power });
  }
};

// #47 Copernicus: VP based on Protestant influence
EVENT_HANDLERS[47] = {
  execute(state, power, actionData, helpers) {
    let protCount = 0;
    let totalHome = 0;
    for (const sp of Object.values(state.spaces)) {
      if (sp.homePower === power) {
        totalHome++;
        if (sp.religion === 'protestant') protCount++;
      }
    }
    const halfOrMore = protCount >= Math.ceil(totalHome / 2);
    if (halfOrMore) {
      state.vp[power] = (state.vp[power] || 0) + 2;
      helpers.logEvent(state, 'event_copernicus', {
        power, vp: 2, protCount, totalHome
      });
    } else {
      state.vp[power] = (state.vp[power] || 0) + 1;
      helpers.logEvent(state, 'event_copernicus', {
        power, vp: 1, protCount, totalHome, pendingChoice: true
      });
    }
  }
};

// #48 Galleons: place marker on power's colonies
EVENT_HANDLERS[48] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower || power;
    state.galleons = state.galleons || {};
    state.galleons[targetPower] = true;
    helpers.logEvent(state, 'event_galleons', { power, targetPower });
  }
};

// #49 Huguenot Raiders: add raider marker
EVENT_HANDLERS[49] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    state.raiders = state.raiders || {};
    state.raiders[targetPower] = true;
    helpers.logEvent(state, 'event_huguenot_raiders', {
      power, targetPower
    });
  }
};

// #50 Mercator's Map: free exploration voyage with +2
EVENT_HANDLERS[50] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower || power;
    state.pendingExploration = state.pendingExploration || {};
    state.pendingExploration[targetPower] = {
      modifier: 2, source: 'mercator'
    };
    helpers.logEvent(state, 'event_mercators_map', {
      power, targetPower
    });
  }
};

// #51 Michael Servetus: +1 VP, random discard from Protestant
EVENT_HANDLERS[51] = {
  execute(state, power, actionData, helpers) {
    state.vp[power] = (state.vp[power] || 0) + 1;
    if (state.hands?.protestant?.length > 0) {
      const idx = Math.floor(
        Math.random() * state.hands.protestant.length
      );
      const discarded = state.hands.protestant.splice(idx, 1)[0];
      state.discard.push(discarded);
      helpers.logEvent(state, 'event_michael_servetus', {
        power, vp: 1, discarded
      });
    } else {
      helpers.logEvent(state, 'event_michael_servetus', {
        power, vp: 1
      });
    }
  }
};

// #52 Michelangelo: roll 2 dice, add total to St. Peter's
EVENT_HANDLERS[52] = {
  execute(state, power, actionData, helpers) {
    const die1 = actionData.die1
      ?? (Math.floor(Math.random() * 6) + 1);
    const die2 = actionData.die2
      ?? (Math.floor(Math.random() * 6) + 1);
    const total = die1 + die2;
    state.stPetersFund = (state.stPetersFund || 0) + total;
    helpers.logEvent(state, 'event_michelangelo', {
      power, die1, die2, total
    });
  }
};

// #53 Plantations: +1 to colony rolls
EVENT_HANDLERS[53] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower || power;
    state.plantations = state.plantations || {};
    state.plantations[targetPower] =
      (state.plantations[targetPower] || 0) + 1;
    helpers.logEvent(state, 'event_plantations', {
      power, targetPower
    });
  }
};

// #54 Potosi Silver Mines: add Potosi to colony box
EVENT_HANDLERS[54] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower || power;
    state.potosi = state.potosi || {};
    state.potosi[targetPower] = true;
    helpers.logEvent(state, 'event_potosi', { power, targetPower });
  }
};

// ── Merge Extended & Diplomacy Handlers ──────────────────────────────

Object.assign(EVENT_HANDLERS, EXTENDED_EVENT_HANDLERS, DIPLOMACY_EVENT_HANDLERS);

// ── Utility: Execute Event ─────────────────────────────────────────

/**
 * Execute an event card.
 * @param {Object} state
 * @param {string} power - Power playing the card
 * @param {number} cardNumber
 * @param {Object} actionData - Additional data (targetSpace, mode, etc.)
 * @param {Object} helpers
 * @returns {{ grantCp?: number } | undefined}
 */
export function executeEvent(state, power, cardNumber, actionData, helpers) {
  const handler = EVENT_HANDLERS[cardNumber];
  if (!handler) {
    helpers.logEvent(state, 'event_unhandled', { power, cardNumber });
    return;
  }
  return handler.execute(state, power, actionData, helpers);
}

/**
 * Validate an event card play.
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @param {Object} actionData
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateEvent(state, power, cardNumber, actionData) {
  const handler = EVENT_HANDLERS[cardNumber];
  if (!handler) {
    return { valid: true }; // Unhandled events are allowed (stub)
  }
  if (handler.validate) {
    return handler.validate(state, power, actionData);
  }
  return { valid: true };
}
