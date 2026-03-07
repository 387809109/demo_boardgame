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
import { RULERS, CHATEAU_TABLE, CHATEAU_MODIFIERS } from '../constants.js';

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
