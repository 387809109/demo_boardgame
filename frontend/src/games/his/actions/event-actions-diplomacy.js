/**
 * Here I Stand — Diplomacy Deck Event Card Handlers (#201-219)
 */
import { areAllied } from '../state/war-helpers.js';

export const DIPLOMACY_EVENT_HANDLERS = {};

/**
 * #201 Andrea Doria (Diplomacy)
 * Papacy activates Genoa as Papal ally.
 * Protestant activates Genoa as French ally.
 * If already controlled, add 4 CP of Genoese units.
 */
DIPLOMACY_EVENT_HANDLERS[201] = {
  execute(state, power, actionData, helpers) {
    state.minorPowers = state.minorPowers || {};
    const allyPower = power === 'papacy' ? 'papacy' : 'france';
    if (state.minorPowers.genoa?.ally === allyPower) {
      // Already controlled — add units
      const targetSpace = actionData.targetSpace;
      if (targetSpace) {
        const sp = state.spaces[targetSpace];
        if (sp) {
          let stack = sp.units.find(u => u.owner === 'genoa');
          if (!stack) {
            stack = {
              owner: 'genoa', regulars: 0, mercenaries: 0,
              cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
            };
            sp.units.push(stack);
          }
          stack.regulars += 2;
          stack.squadrons += 1;
        }
      }
    } else {
      state.minorPowers.genoa = { ally: allyPower, active: true };
    }
    helpers.logEvent(state, 'event_diplo_andrea_doria', { power, allyPower });
  }
};

/**
 * #202 French Constable Invades
 * France and Papacy at war.
 * Protestant places French units + draws card.
 */
DIPLOMACY_EVENT_HANDLERS[202] = {
  execute(state, power, actionData, helpers) {
    if (!state.wars.some(w =>
      (w.a === 'france' && w.b === 'papacy') ||
      (w.a === 'papacy' && w.b === 'france')
    )) {
      state.wars.push({ a: 'france', b: 'papacy' });
    }
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        let stack = sp.units.find(u => u.owner === 'france');
        if (!stack) {
          stack = {
            owner: 'france', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        if (!stack.leaders.includes('montmorency')) {
          stack.leaders.push('montmorency');
        }
        stack.regulars += 2;
        stack.mercenaries += 2;
      }
    }
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.protestant =
      (state.pendingCardDraw.protestant || 0) + 1;
    helpers.logEvent(
      state, 'event_diplo_french_constable', { power, targetSpace }
    );
  }
};

/**
 * #203 Corsair Raid
 * Roll 4 dice, hits on 5/6.
 * Enemy discards cards or loses squadrons.
 */
DIPLOMACY_EVENT_HANDLERS[203] = {
  execute(state, power, actionData, helpers) {
    const rolls = [];
    for (let i = 0; i < 4; i++) {
      rolls.push(
        actionData[`die${i}`] ?? (Math.floor(Math.random() * 6) + 1)
      );
    }
    const hits = rolls.filter(r => r >= 5).length;
    helpers.logEvent(
      state, 'event_diplo_corsair_raid', { power, rolls, hits }
    );
  }
};

/**
 * #204 Diplomatic Marriage (Diplomacy)
 * Activate/deactivate minor.
 * Protestant can also activate Genoa/Venice as Hapsburg ally.
 */
DIPLOMACY_EVENT_HANDLERS[204] = {
  execute(state, power, actionData, helpers) {
    const minor = actionData.minorPower;
    const action = actionData.action || 'activate';
    state.minorPowers = state.minorPowers || {};
    if (action === 'activate') {
      const allyPower = actionData.allyPower || power;
      state.minorPowers[minor] = { ally: allyPower, active: true };
    } else {
      state.minorPowers[minor] = { ally: null, active: false };
    }
    helpers.logEvent(
      state, 'event_diplo_diplomatic_marriage', { power, minor, action }
    );
  }
};

/**
 * #205 Diplomatic Pressure
 * Review opponent's diplomatic cards.
 * Papacy picks which Protestant plays.
 * Protestant can swap or force discard.
 */
DIPLOMACY_EVENT_HANDLERS[205] = {
  execute(state, power, actionData, helpers) {
    state.pendingDiplomaticPressure = {
      reviewer: power,
      action: actionData.action || 'review'
    };
    helpers.logEvent(state, 'event_diplo_pressure', { power });
  }
};

/**
 * #206 French Invasion
 * France and Papacy at war.
 * Protestant places French forces + draws card.
 */
DIPLOMACY_EVENT_HANDLERS[206] = {
  execute(state, power, actionData, helpers) {
    if (!state.wars.some(w =>
      (w.a === 'france' && w.b === 'papacy') ||
      (w.a === 'papacy' && w.b === 'france')
    )) {
      state.wars.push({ a: 'france', b: 'papacy' });
    }
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        let stack = sp.units.find(u => u.owner === 'france');
        if (!stack) {
          stack = {
            owner: 'france', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        const ruler =
          state.rulers.france === 'francis_i' ? 'francis_i' : 'henry_ii';
        if (!stack.leaders.includes(ruler)) {
          stack.leaders.push(ruler);
        }
        stack.regulars += 3;
        stack.mercenaries += 3;
      }
    }
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.protestant =
      (state.pendingCardDraw.protestant || 0) + 1;
    helpers.logEvent(
      state, 'event_diplo_french_invasion', { power, targetSpace }
    );
  }
};

/**
 * #207 Henry Petitions for Divorce
 * Papacy chooses granted or refused.
 */
DIPLOMACY_EVENT_HANDLERS[207] = {
  execute(state, power, actionData, helpers) {
    const choice = actionData.choice || 'refused';
    if (choice === 'granted') {
      state.pendingCardDraw = state.pendingCardDraw || {};
      state.pendingCardDraw.papacy =
        (state.pendingCardDraw.papacy || 0) + 1;
      state.pendingDebateCall = { caller: 'papacy', zones: 'all' };
    } else {
      // Add 3 Hapsburg regulars
      const placements = actionData.placements || [];
      for (const p of placements) {
        const sp = state.spaces[p.space];
        if (!sp) continue;
        let stack = sp.units.find(u => u.owner === 'hapsburg');
        if (!stack) {
          stack = {
            owner: 'hapsburg', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        stack.regulars += (p.count || 1);
      }
    }
    helpers.logEvent(
      state, 'event_diplo_henry_divorce', { power, choice }
    );
  }
};

/**
 * #208 Knights of St. John (Diplomacy)
 * Draw card, CP to St. Peter's.
 */
DIPLOMACY_EVENT_HANDLERS[208] = {
  execute(state, power, actionData, helpers) {
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw[power] =
      (state.pendingCardDraw[power] || 0) + 1;
    // CP of drawn card goes to St. Peter's (resolved when card is drawn)
    state.pendingStPetersContribution = true;
    helpers.logEvent(state, 'event_diplo_knights', { power });
  }
};

/**
 * #209 Plague
 * Remove 3 units, draw random from opponent.
 */
DIPLOMACY_EVENT_HANDLERS[209] = {
  execute(state, power, actionData, helpers) {
    const removals = actionData.removals || [];
    for (const r of removals.slice(0, 3)) {
      const sp = state.spaces[r.space];
      if (!sp) continue;
      const stack = sp.units.find(u => u.owner === r.owner);
      if (!stack) continue;
      if (r.type === 'squadron' && stack.squadrons > 0) {
        stack.squadrons--;
      } else if (stack.regulars > 0) {
        stack.regulars--;
      } else if (stack.mercenaries > 0) {
        stack.mercenaries--;
      }
    }
    helpers.logEvent(
      state, 'event_diplo_plague',
      { power, removals: removals.slice(0, 3) }
    );
  }
};

/**
 * #210 Shipbuilding (Diplomacy)
 * Build up to 2 squadrons.
 */
DIPLOMACY_EVENT_HANDLERS[210] = {
  execute(state, power, actionData, helpers) {
    const placements = actionData.placements || [];
    for (const p of placements.slice(0, 2)) {
      const sp = state.spaces[p.space];
      if (!sp) continue;
      const owner = p.owner || power;
      let stack = sp.units.find(u => u.owner === owner);
      if (!stack) {
        stack = {
          owner, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(stack);
      }
      stack.squadrons += 1;
    }
    helpers.logEvent(state, 'event_diplo_shipbuilding', { power });
  }
};

/**
 * #211 Spanish Invasion
 * Hapsburgs and Papacy at war (or Papacy controls if post-SL).
 * Place Hapsburg forces.
 */
DIPLOMACY_EVENT_HANDLERS[211] = {
  execute(state, power, actionData, helpers) {
    const controller = state.schmalkaldicLeague ? 'papacy' : 'protestant';
    if (!state.schmalkaldicLeague) {
      if (!state.wars.some(w =>
        (w.a === 'hapsburg' && w.b === 'papacy') ||
        (w.a === 'papacy' && w.b === 'hapsburg')
      )) {
        state.wars.push({ a: 'hapsburg', b: 'papacy' });
      }
    }
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        let stack = sp.units.find(u => u.owner === 'hapsburg');
        if (!stack) {
          stack = {
            owner: 'hapsburg', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        if (!stack.leaders.includes('duke_of_alva')) {
          stack.leaders.push('duke_of_alva');
        }
        stack.regulars += 2;
        stack.mercenaries += 2;
      }
    }
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw[controller] =
      (state.pendingCardDraw[controller] || 0) + 1;
    helpers.logEvent(
      state, 'event_diplo_spanish_invasion',
      { power, controller, targetSpace }
    );
  }
};

/**
 * #212 Venetian Alliance (Diplomacy)
 * Activate/deactivate/reinforce Venice.
 */
DIPLOMACY_EVENT_HANDLERS[212] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'activate';
    state.minorPowers = state.minorPowers || {};
    if (mode === 'activate') {
      state.minorPowers.venice = { ally: 'papacy', active: true };
    } else if (mode === 'deactivate') {
      state.minorPowers.venice = { ally: null, active: false };
    } else if (mode === 'reinforce') {
      const targetSpace = actionData.targetSpace;
      if (targetSpace) {
        const sp = state.spaces[targetSpace];
        if (sp) {
          let stack = sp.units.find(u => u.owner === 'venice');
          if (!stack) {
            stack = {
              owner: 'venice', regulars: 0, mercenaries: 0,
              cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
            };
            sp.units.push(stack);
          }
          stack.regulars += 1;
          stack.squadrons += 2;
        }
      }
    }
    helpers.logEvent(
      state, 'event_diplo_venetian_alliance', { power, mode }
    );
  }
};

/**
 * #213 Austrian Invasion (post-SL)
 * Papacy places Ferdinand + Hapsburg forces.
 */
DIPLOMACY_EVENT_HANDLERS[213] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        let stack = sp.units.find(u => u.owner === 'hapsburg');
        if (!stack) {
          stack = {
            owner: 'hapsburg', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        if (!stack.leaders.includes('ferdinand')) {
          stack.leaders.push('ferdinand');
        }
        stack.regulars += 2;
        stack.mercenaries += 4;
      }
    }
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.papacy =
      (state.pendingCardDraw.papacy || 0) + 1;
    helpers.logEvent(
      state, 'event_diplo_austrian_invasion', { power, targetSpace }
    );
  }
};

/**
 * #214 Imperial Invasion (post-SL)
 * Papacy places Charles V + Hapsburg forces.
 */
DIPLOMACY_EVENT_HANDLERS[214] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        let stack = sp.units.find(u => u.owner === 'hapsburg');
        if (!stack) {
          stack = {
            owner: 'hapsburg', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        if (!stack.leaders.includes('charles_v')) {
          stack.leaders.push('charles_v');
        }
        stack.regulars += 3;
        stack.mercenaries += 5;
      }
    }
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.papacy =
      (state.pendingCardDraw.papacy || 0) + 1;
    helpers.logEvent(
      state, 'event_diplo_imperial_invasion', { power, targetSpace }
    );
  }
};

/**
 * #215 Machiavelli (post-SL)
 * Trailing VP player picks an invasion card to play.
 */
DIPLOMACY_EVENT_HANDLERS[215] = {
  execute(state, power, actionData, helpers) {
    state.pendingMachiavelliChoice = {
      chooser: power,
      targetCard: actionData.targetCard || null
    };
    helpers.logEvent(state, 'event_diplo_machiavelli', { power });
  }
};

/**
 * #216 Ottoman Invasion (post-SL)
 * Ottomans and Papacy at war.
 * Protestant places Ottoman forces.
 */
DIPLOMACY_EVENT_HANDLERS[216] = {
  execute(state, power, actionData, helpers) {
    if (!state.wars.some(w =>
      (w.a === 'ottoman' && w.b === 'papacy') ||
      (w.a === 'papacy' && w.b === 'ottoman')
    )) {
      state.wars.push({ a: 'ottoman', b: 'papacy' });
    }
    const targetSpace = actionData.targetSpace;
    if (targetSpace) {
      const sp = state.spaces[targetSpace];
      if (sp) {
        let stack = sp.units.find(u => u.owner === 'ottoman');
        if (!stack) {
          stack = {
            owner: 'ottoman', regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        if (!stack.leaders.includes('suleiman')) {
          stack.leaders.push('suleiman');
        }
        stack.regulars += 5;
        stack.squadrons += 4;
      }
    }
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.protestant =
      (state.pendingCardDraw.protestant || 0) + 1;
    helpers.logEvent(
      state, 'event_diplo_ottoman_invasion', { power, targetSpace }
    );
  }
};

/**
 * #217 Secret Protestant Circle (post-SL)
 * Roll die, flip spaces to Protestant.
 */
DIPLOMACY_EVENT_HANDLERS[217] = {
  execute(state, power, actionData, helpers) {
    const roll =
      actionData.dieRoll ?? (Math.floor(Math.random() * 6) + 1);
    const italianSpace = actionData.italianSpace;
    const spanishSpace = actionData.spanishSpace;
    if (italianSpace) {
      const sp = state.spaces[italianSpace];
      if (sp && sp.languageZone === 'italian') {
        sp.religion = 'protestant';
      }
    }
    if (roll >= 4 && spanishSpace) {
      const sp = state.spaces[spanishSpace];
      if (sp && sp.languageZone === 'spanish') {
        sp.religion = 'protestant';
      }
    }
    helpers.logEvent(
      state, 'event_diplo_secret_circle',
      { power, roll, italianSpace, spanishSpace }
    );
  }
};

/**
 * #218 Siege of Vienna (post-SL)
 * Remove 2 Hapsburg/Hungarian units near Vienna.
 * Restrict movement.
 */
DIPLOMACY_EVENT_HANDLERS[218] = {
  execute(state, power, actionData, helpers) {
    const removals = actionData.removals || [];
    let removed = 0;
    for (const r of removals.slice(0, 2)) {
      const sp = state.spaces[r.space];
      if (!sp) continue;
      const stack = sp.units.find(u => u.owner === r.owner);
      if (stack && stack.regulars > 0) {
        stack.regulars--;
        removed++;
      }
    }
    state.viennaMovementRestriction = true;
    helpers.logEvent(
      state, 'event_diplo_siege_vienna', { power, removed }
    );
  }
};

/**
 * #219 Spanish Inquisition (post-SL)
 * Papacy reviews Protestant diplomatic cards and forces discard.
 * Protestant reveals main deck hand.
 */
DIPLOMACY_EVENT_HANDLERS[219] = {
  execute(state, power, actionData, helpers) {
    if (power === 'papacy') {
      state.pendingDiplomaticPressure = {
        reviewer: 'papacy',
        targetPower: 'protestant',
        action: 'force_discard'
      };
    } else {
      state.pendingHandReveal = { power: 'protestant' };
    }
    helpers.logEvent(
      state, 'event_diplo_spanish_inquisition', { power }
    );
  }
};
