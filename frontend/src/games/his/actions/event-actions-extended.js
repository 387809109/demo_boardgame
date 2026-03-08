/**
 * Here I Stand — Extended Event Card Handlers (#55-116)
 * Excludes #97, #113, #114 which exist in event-actions.js
 */
import { RULERS } from '../constants.js';
import { areAllied } from '../state/war-helpers.js';

export const EXTENDED_EVENT_HANDLERS = {};

// #55 Jesuit Education
EXTENDED_EVENT_HANDLERS[55] = {
  validate(state) {
    if (!state.jesuitFoundingEnabled) {
      return { valid: false, error: 'Society of Jesus must be played first' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const spaces = actionData.jesuitSpaces || [];
    for (const name of spaces.slice(0, 2)) {
      const sp = state.spaces[name];
      if (sp && sp.religion === 'catholic') sp.jesuitUniversity = true;
    }
    helpers.logEvent(
      state, 'event_jesuit_education',
      { power, spaces: spaces.slice(0, 2) }
    );
  }
};

// #56 Papal Inquisition
EXTENDED_EVENT_HANDLERS[56] = {
  validate(state) {
    const debaters = state.debaters?.papacy || [];
    const caraffa = debaters.find(d => d.id === 'caraffa');
    if (caraffa && caraffa.committed) {
      return { valid: false, error: 'Caraffa is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const convertSpaces = actionData.convertSpaces || [];
    for (const name of convertSpaces.slice(0, 2)) {
      const sp = state.spaces[name];
      if (
        sp && sp.religion === 'protestant' &&
        sp.languageZone === 'italian'
      ) {
        sp.religion = 'catholic';
      }
    }
    const debaters = state.debaters?.papacy || [];
    const caraffa = debaters.find(d => d.id === 'caraffa');
    if (caraffa) caraffa.committed = true;
    state.pendingHandReview = {
      reviewer: power,
      targetPower: actionData.targetPower || 'protestant',
      choices: ['draw_random', 'retrieve_discard', 'debate_bonus']
    };
    helpers.logEvent(
      state, 'event_papal_inquisition',
      { power, convertSpaces: convertSpaces.slice(0, 2) }
    );
  }
};

// #57 Philip of Hesse's Bigamy
EXTENDED_EVENT_HANDLERS[57] = {
  execute(state, power, actionData, helpers) {
    const choice = actionData.choice || 'remove_leader';
    if (choice === 'remove_leader') {
      for (const sp of Object.values(state.spaces)) {
        for (const stack of sp.units) {
          const idx = stack.leaders.indexOf('philip_of_hesse');
          if (idx !== -1) {
            stack.leaders.splice(idx, 1);
            break;
          }
        }
      }
      state.removedLeaders = state.removedLeaders || [];
      state.removedLeaders.push('philip_of_hesse');
    } else if (choice === 'discard' && state.hands?.protestant?.length > 0) {
      const idx = Math.floor(
        Math.random() * state.hands.protestant.length
      );
      const discarded = state.hands.protestant.splice(idx, 1)[0];
      state.discard.push(discarded);
    }
    helpers.logEvent(state, 'event_philip_bigamy', { power, choice });
  }
};

// #58 Spanish Inquisition
EXTENDED_EVENT_HANDLERS[58] = {
  execute(state, power, actionData, helpers) {
    const convertSpaces = actionData.convertSpaces || [];
    for (const name of convertSpaces.slice(0, 2)) {
      const sp = state.spaces[name];
      if (
        sp && sp.religion === 'protestant' &&
        sp.languageZone === 'spanish'
      ) {
        sp.religion = 'catholic';
      }
    }
    state.pendingHandReview = {
      reviewer: 'hapsburg',
      targetPowers: ['england', 'protestant'],
      action: 'discard_one'
    };
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.hapsburg =
      (state.pendingCardDraw.hapsburg || 0) + 1;
    state.pendingDebateCall = { caller: 'papacy', zones: 'all' };
    helpers.logEvent(
      state, 'event_spanish_inquisition',
      { power, convertSpaces: convertSpaces.slice(0, 2) }
    );
  }
};

// #59 Lady Jane Grey
EXTENDED_EVENT_HANDLERS[59] = {
  validate(state) {
    if (!state.englandRulerChangedThisTurn) {
      return {
        valid: false,
        error: 'England has not changed rulers this turn'
      };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingLadyJaneGrey = {
      drawFromEngland: true,
      drawFromDeck: true,
      giveTo: ['protestant', 'papacy']
    };
    helpers.logEvent(state, 'event_lady_jane_grey', { power });
  }
};

// #60 Maurice of Saxony
EXTENDED_EVENT_HANDLERS[60] = {
  execute(state, power, actionData, helpers) {
    const currentOwner = actionData.currentOwner || 'protestant';
    const newOwner =
      currentOwner === 'protestant' ? 'hapsburg' : 'protestant';
    for (const [spaceName, sp] of Object.entries(state.spaces)) {
      for (const stack of sp.units) {
        const idx = stack.leaders.indexOf('maurice_of_saxony');
        if (idx !== -1 && stack.owner === currentOwner) {
          stack.leaders.splice(idx, 1);
          const switchedMercs = stack.mercenaries;
          stack.mercenaries = 0;
          const targetSpace = actionData.targetSpace || spaceName;
          const tgt = state.spaces[targetSpace];
          if (tgt) {
            let newStack = tgt.units.find(u => u.owner === newOwner);
            if (!newStack) {
              newStack = {
                owner: newOwner, regulars: 0, mercenaries: 0,
                cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
              };
              tgt.units.push(newStack);
            }
            newStack.leaders.push('maurice_of_saxony');
            newStack.mercenaries += switchedMercs;
          }
          helpers.logEvent(state, 'event_maurice_of_saxony', {
            power, currentOwner, newOwner, targetSpace
          });
          return;
        }
      }
    }
    helpers.logEvent(state, 'event_maurice_of_saxony', {
      power, currentOwner, newOwner: currentOwner === 'protestant'
        ? 'hapsburg' : 'protestant', notFound: true
    });
  }
};

// #61 Mary Defies Council
EXTENDED_EVENT_HANDLERS[61] = {
  execute(state, power, actionData, helpers) {
    state.pendingCounterReformation = {
      attemptsRemaining: 3,
      zones: 'english',
      playedBy: power
    };
    helpers.logEvent(state, 'event_mary_defies_council', { power });
  }
};

// #62 Book of Common Prayer
EXTENDED_EVENT_HANDLERS[62] = {
  validate(state) {
    const debaters = state.debaters?.protestant || [];
    const cranmer = debaters.find(d => d.id === 'cranmer');
    if (cranmer && cranmer.committed) {
      return { valid: false, error: 'Cranmer is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingReformation = {
      attemptsRemaining: 4,
      zones: 'english',
      playedBy: power
    };
    const debaters = state.debaters?.protestant || [];
    const cranmer = debaters.find(d => d.id === 'cranmer');
    if (cranmer) cranmer.committed = true;
    const unrestRoll = actionData.unrestRoll ??
      (Math.floor(Math.random() * 6) + 1);
    let unrestCount = 0;
    if (unrestRoll >= 3 && unrestRoll <= 4) unrestCount = 1;
    else if (unrestRoll === 5) unrestCount = 2;
    else if (unrestRoll === 6) unrestCount = 99;
    state.pendingUnrest = { zone: 'english', count: unrestCount };
    helpers.logEvent(state, 'event_book_of_common_prayer', {
      power, unrestRoll, unrestCount
    });
  }
};

// #63 Dissolution of Monasteries
EXTENDED_EVENT_HANDLERS[63] = {
  execute(state, power, actionData, helpers) {
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw.england =
      (state.pendingCardDraw.england || 0) + 2;
    state.pendingReformation = {
      attemptsRemaining: 3,
      zones: 'english',
      playedBy: 'protestant'
    };
    helpers.logEvent(state, 'event_dissolution_monasteries', { power });
  }
};

// #64 Pilgrimage of Grace
EXTENDED_EVENT_HANDLERS[64] = {
  execute(state, power, actionData, helpers) {
    const targets = actionData.targetSpaces || [];
    let placed = 0;
    for (const name of targets.slice(0, 5)) {
      const sp = state.spaces[name];
      if (sp && sp.homePower === 'england' && !sp.unrest) {
        const hasUnits = sp.units.some(
          s => s.regulars + s.mercenaries + s.cavalry > 0
        );
        if (!hasUnits) {
          sp.unrest = true;
          placed++;
        }
      }
    }
    helpers.logEvent(
      state, 'event_pilgrimage_of_grace', { power, placed }
    );
  }
};

// #65 A Mighty Fortress
EXTENDED_EVENT_HANDLERS[65] = {
  validate(state) {
    const debaters = state.debaters?.protestant || [];
    const luther = debaters.find(d => d.id === 'luther');
    if (luther && luther.committed) {
      return { valid: false, error: 'Luther is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingReformation = {
      attemptsRemaining: 6,
      zones: 'german',
      playedBy: power
    };
    const debaters = state.debaters?.protestant || [];
    const luther = debaters.find(d => d.id === 'luther');
    if (luther) luther.committed = true;
    helpers.logEvent(state, 'event_mighty_fortress', { power });
  }
};

// #66 Akinji Raiders
EXTENDED_EVENT_HANDLERS[66] = {
  validate(state, power) {
    if (power !== 'ottoman') {
      return { valid: false, error: 'Only Ottoman can play Akinji Raiders' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    if (targetPower && state.hands?.[targetPower]?.length > 0) {
      const idx = Math.floor(
        Math.random() * state.hands[targetPower].length
      );
      const stolen = state.hands[targetPower].splice(idx, 1)[0];
      state.hands.ottoman = state.hands.ottoman || [];
      state.hands.ottoman.push(stolen);
      helpers.logEvent(
        state, 'event_akinji_raiders', { power, targetPower, stolen }
      );
    } else {
      helpers.logEvent(
        state, 'event_akinji_raiders', { power, targetPower, noCards: true }
      );
    }
  }
};

// #67 Anabaptists
EXTENDED_EVENT_HANDLERS[67] = {
  execute(state, power, actionData, helpers) {
    const targets = actionData.targetSpaces || [];
    let converted = 0;
    for (const name of targets.slice(0, 2)) {
      const sp = state.spaces[name];
      if (sp && sp.religion === 'protestant' && !sp.isElectorate) {
        const hasUnits = sp.units.some(
          s => s.regulars + s.mercenaries + s.cavalry > 0
        );
        if (!hasUnits) {
          sp.religion = 'catholic';
          converted++;
        }
      }
    }
    helpers.logEvent(state, 'event_anabaptists', { power, converted });
  }
};

// #68 Andrea Doria
EXTENDED_EVENT_HANDLERS[68] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'activate';
    if (mode === 'activate') {
      state.minorPowers = state.minorPowers || {};
      state.minorPowers.genoa = { ally: power, active: true };
      helpers.logEvent(
        state, 'event_andrea_doria_activate', { power }
      );
    } else if (mode === 'piracy') {
      const rolls = [
        actionData.die1 ?? (Math.floor(Math.random() * 6) + 1),
        actionData.die2 ?? (Math.floor(Math.random() * 6) + 1),
        actionData.die3 ?? (Math.floor(Math.random() * 6) + 1)
      ];
      const hits = rolls.filter(r => r >= 5).length;
      state.vp.ottoman = Math.max(
        0, (state.vp.ottoman || 0) - hits
      );
      helpers.logEvent(
        state, 'event_andrea_doria_piracy', { power, rolls, hits }
      );
    }
  }
};

// #69 Auld Alliance
EXTENDED_EVENT_HANDLERS[69] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'activate';
    state.minorPowers = state.minorPowers || {};
    if (mode === 'activate' && power === 'france') {
      state.minorPowers.scotland = { ally: 'france', active: true };
      if (!state.alliances.some(a =>
        (a.a === 'scotland' && a.b === 'france') ||
        (a.a === 'france' && a.b === 'scotland')
      )) {
        state.alliances.push({ a: 'scotland', b: 'france' });
      }
    } else if (mode === 'deactivate') {
      state.minorPowers.scotland = { ally: null, active: false };
      state.alliances = state.alliances.filter(a => !(
        (a.a === 'scotland' && a.b === 'france') ||
        (a.a === 'france' && a.b === 'scotland') ||
        (a.a === 'scotland' && a.b === 'england') ||
        (a.a === 'england' && a.b === 'scotland')
      ));
    } else if (mode === 'reinforce') {
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
          stack.regulars += Math.min(actionData.count || 3, 3);
        }
      }
    }
    helpers.logEvent(state, 'event_auld_alliance', { power, mode });
  }
};

// #70 Charles Bourbon
EXTENDED_EVENT_HANDLERS[70] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (!targetSpace) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    let stack = sp.units.find(u => u.owner === power);
    if (!stack) {
      stack = {
        owner: power, regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      sp.units.push(stack);
    }
    if (!stack.leaders.includes('charles_bourbon')) {
      stack.leaders.push('charles_bourbon');
    }
    if (power === 'ottoman') {
      stack.cavalry += 3;
    } else {
      stack.mercenaries += 3;
    }
    state.temporaryLeaders = state.temporaryLeaders || [];
    state.temporaryLeaders.push({
      id: 'charles_bourbon', removeEndOfTurn: true
    });
    helpers.logEvent(
      state, 'event_charles_bourbon', { power, targetSpace }
    );
  }
};

// #71 City State Rebels
EXTENDED_EVENT_HANDLERS[71] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (!targetSpace) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    const rolls = [];
    for (let i = 0; i < 5; i++) {
      rolls.push(
        actionData[`die${i}`] ??
        (Math.floor(Math.random() * 6) + 1)
      );
    }
    const hits = rolls.filter(r => r >= 5).length;
    helpers.logEvent(
      state, 'event_city_state_rebels',
      { power, targetSpace, rolls, hits }
    );
  }
};

// #72 Cloth Prices Fluctuate
EXTENDED_EVENT_HANDLERS[72] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'trade';
    if (mode === 'trade') {
      const calais = state.spaces['Calais'];
      const antwerp = state.spaces['Antwerp'];
      const engControls = calais && calais.controller === 'england';
      const hapControls =
        antwerp && antwerp.controller === 'hapsburg';
      const cardDraws = {};
      if (engControls && hapControls) {
        cardDraws.england = 1;
        cardDraws.hapsburg = 1;
      }
      helpers.logEvent(
        state, 'event_cloth_prices_trade', { power, cardDraws }
      );
    } else if (mode === 'revolt') {
      const targets = actionData.targetSpaces || [];
      for (const name of targets.slice(0, 2)) {
        const sp = state.spaces[name];
        if (sp && !sp.unrest) {
          const hasUnits = sp.units.some(
            s => s.regulars + s.mercenaries + s.cavalry > 0
          );
          if (!hasUnits) sp.unrest = true;
        }
      }
      helpers.logEvent(
        state, 'event_cloth_prices_revolt', { power }
      );
    }
  }
};

// #73 Diplomatic Marriage
EXTENDED_EVENT_HANDLERS[73] = {
  validate(state, power) {
    if (power === 'ottoman' || power === 'protestant') {
      return {
        valid: false,
        error: 'Not playable by Ottoman or Protestant'
      };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'diplomacy';
    if (mode === 'diplomacy') {
      const minor = actionData.minorPower;
      const action = actionData.action || 'activate';
      state.minorPowers = state.minorPowers || {};
      if (action === 'activate') {
        state.minorPowers[minor] = { ally: power, active: true };
      } else {
        state.minorPowers[minor] = { ally: null, active: false };
      }
    } else if (mode === 'peace') {
      state.pendingPeaceRestore = {
        power, targetPower: actionData.targetPower
      };
    }
    helpers.logEvent(
      state, 'event_diplomatic_marriage', { power, mode }
    );
  }
};

// #74 Diplomatic Overture
EXTENDED_EVENT_HANDLERS[74] = {
  execute(state, power, actionData, helpers) {
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw[power] =
      (state.pendingCardDraw[power] || 0) + 2;
    state.pendingGiveCard = {
      from: power, to: actionData.targetPower
    };
    helpers.logEvent(state, 'event_diplomatic_overture', { power });
  }
};

// #75 Erasmus
EXTENDED_EVENT_HANDLERS[75] = {
  execute(state, power, actionData, helpers) {
    if (state.turn <= 2) {
      state.pendingReformation = {
        attemptsRemaining: 4, zones: 'all', playedBy: power
      };
      helpers.logEvent(state, 'event_erasmus_reformation', { power });
    } else {
      state.pendingCounterReformation = {
        attemptsRemaining: 4, zones: 'all', playedBy: power
      };
      helpers.logEvent(
        state, 'event_erasmus_counter_reformation', { power }
      );
    }
  }
};

// #76 Foreign Recruits
EXTENDED_EVENT_HANDLERS[76] = {
  execute(state, power, actionData, helpers) {
    state.pendingForeignRecruits = { power, cp: 4 };
    helpers.logEvent(state, 'event_foreign_recruits', { power });
    return { grantCp: 4 };
  }
};

// #77 Fountain of Youth
EXTENDED_EVENT_HANDLERS[77] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    if (targetPower && state.pendingExploration?.[targetPower]) {
      delete state.pendingExploration[targetPower];
    }
    state.explorationCancelled = state.explorationCancelled || {};
    state.explorationCancelled[targetPower] = true;
    const roll = actionData.dieRoll ??
      (Math.floor(Math.random() * 6) + 1);
    let explorerRemoved = false;
    if (roll >= 4) explorerRemoved = true;
    helpers.logEvent(state, 'event_fountain_of_youth', {
      power, targetPower, roll, explorerRemoved
    });
  }
};

// #78 Frederick the Wise
EXTENDED_EVENT_HANDLERS[78] = {
  execute(state, power, actionData, helpers) {
    const targets = actionData.targetSpaces || [];
    for (const name of targets.slice(0, 2)) {
      const sp = state.spaces[name];
      if (
        sp && sp.religion === 'catholic' &&
        sp.languageZone === 'german'
      ) {
        sp.religion = 'protestant';
      }
    }
    if (state.discard.includes(37)) {
      const idx = state.discard.indexOf(37);
      state.discard.splice(idx, 1);
      state.hands.protestant = state.hands.protestant || [];
      state.hands.protestant.push(37);
    }
    helpers.logEvent(state, 'event_frederick_the_wise', {
      power, targets: targets.slice(0, 2)
    });
  }
};

// #79 Fuggers
EXTENDED_EVENT_HANDLERS[79] = {
  execute(state, power, actionData, helpers) {
    state.pendingCardDraw = state.pendingCardDraw || {};
    state.pendingCardDraw[power] =
      (state.pendingCardDraw[power] || 0) + 2;
    state.cardModifiers = state.cardModifiers || {};
    state.cardModifiers[power] =
      (state.cardModifiers[power] || 0) - 1;
    helpers.logEvent(state, 'event_fuggers', { power });
  }
};

// #80 Gabelle Revolt
EXTENDED_EVENT_HANDLERS[80] = {
  execute(state, power, actionData, helpers) {
    const targets = actionData.targetSpaces || [];
    let placed = 0;
    for (const name of targets.slice(0, 2)) {
      const sp = state.spaces[name];
      if (sp && sp.homePower === 'france' && !sp.unrest) {
        const hasUnits = sp.units.some(
          s => s.regulars + s.mercenaries + s.cavalry > 0
        );
        if (!hasUnits) { sp.unrest = true; placed++; }
      }
    }
    helpers.logEvent(
      state, 'event_gabelle_revolt', { power, placed }
    );
  }
};

// #81 Indulgence Vendor
EXTENDED_EVENT_HANDLERS[81] = {
  execute(state, power, actionData, helpers) {
    if (state.hands?.protestant?.length > 0) {
      const idx = Math.floor(
        Math.random() * state.hands.protestant.length
      );
      const drawn = state.hands.protestant.splice(idx, 1)[0];
      const cp = actionData.drawnCardCp || 0;
      state.stPetersFund = (state.stPetersFund || 0) + cp;
      state.discard.push(drawn);
      helpers.logEvent(
        state, 'event_indulgence_vendor', { power, drawn, cp }
      );
    } else {
      helpers.logEvent(
        state, 'event_indulgence_vendor', { power, noCards: true }
      );
    }
  }
};

// #82 Janissaries Rebel
EXTENDED_EVENT_HANDLERS[82] = {
  execute(state, power, actionData, helpers) {
    const atWar = state.wars.some(
      w => w.a === 'ottoman' || w.b === 'ottoman'
    );
    const maxUnrest = atWar ? 2 : 4;
    const targets = actionData.targetSpaces || [];
    let placed = 0;
    for (const name of targets.slice(0, maxUnrest)) {
      const sp = state.spaces[name];
      if (sp && sp.homePower === 'ottoman' && !sp.unrest) {
        const hasUnits = sp.units.some(
          s => s.regulars + s.mercenaries + s.cavalry > 0
        );
        if (!hasUnits) { sp.unrest = true; placed++; }
      }
    }
    helpers.logEvent(
      state, 'event_janissaries_rebel', { power, placed, maxUnrest }
    );
  }
};

// #83 John Zapolya
EXTENDED_EVENT_HANDLERS[83] = {
  execute(state, power, actionData, helpers) {
    const buda = state.spaces['Buda'];
    if (!buda) return;
    const controller = buda.controller || 'independent';
    let stack = buda.units.find(u => u.owner === controller);
    if (!stack) {
      stack = {
        owner: controller, regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      buda.units.push(stack);
    }
    stack.regulars += 4;
    helpers.logEvent(
      state, 'event_john_zapolya', { power, controller }
    );
  }
};

// #84 Julia Gonzaga
EXTENDED_EVENT_HANDLERS[84] = {
  validate(state) {
    if (!state.piracyEnabled) {
      return {
        valid: false,
        error: 'Barbary Pirates must be played first'
      };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.juliaGonzagaActive = true;
    helpers.logEvent(state, 'event_julia_gonzaga', { power });
  }
};

// #85 Katherina Bora
EXTENDED_EVENT_HANDLERS[85] = {
  validate(state) {
    const debaters = state.debaters?.protestant || [];
    const luther = debaters.find(d => d.id === 'luther');
    if (luther && luther.committed) {
      return { valid: false, error: 'Luther is committed' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    state.pendingReformation = {
      attemptsRemaining: 5, zones: 'all', playedBy: power
    };
    const debaters = state.debaters?.protestant || [];
    const luther = debaters.find(d => d.id === 'luther');
    if (luther) luther.committed = true;
    helpers.logEvent(state, 'event_katherina_bora', { power });
  }
};

// #86 Knights of St. John
EXTENDED_EVENT_HANDLERS[86] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'raid';
    if (mode === 'raid') {
      if (state.hands?.ottoman?.length > 0) {
        const idx = Math.floor(
          Math.random() * state.hands.ottoman.length
        );
        const drawn = state.hands.ottoman.splice(idx, 1)[0];
        const cp = actionData.drawnCardCp || 0;
        state.stPetersFund = (state.stPetersFund || 0) + cp;
        state.discard.push(drawn);
        helpers.logEvent(
          state, 'event_knights_raid', { power, drawn, cp }
        );
      }
    } else if (mode === 'place') {
      const targetSpace = actionData.targetSpace;
      if (targetSpace) {
        const sp = state.spaces[targetSpace];
        if (sp) {
          sp.controller = 'independent';
          sp.isFortress = true;
          state.knightsOfStJohn = {
            space: targetSpace, active: true
          };
        }
      }
      helpers.logEvent(
        state, 'event_knights_place', { power, targetSpace }
      );
    }
  }
};

// #87 Mercenaries Demand Pay
EXTENDED_EVENT_HANDLERS[87] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    const discardCard = actionData.discardCard;
    if (
      discardCard !== undefined && state.hands?.[targetPower]
    ) {
      const idx = state.hands[targetPower].indexOf(discardCard);
      if (idx !== -1) {
        state.hands[targetPower].splice(idx, 1);
        state.discard.push(discardCard);
        const keptCount = actionData.keptCount || 0;
        helpers.logEvent(
          state, 'event_mercs_demand_pay_discard',
          { power, targetPower, discardCard, keptCount }
        );
        return;
      }
    }
    for (const sp of Object.values(state.spaces)) {
      for (const stack of sp.units) {
        if (stack.owner === targetPower) stack.mercenaries = 0;
      }
    }
    helpers.logEvent(
      state, 'event_mercs_demand_pay_lost',
      { power, targetPower }
    );
  }
};

// #88 Peasants' War
EXTENDED_EVENT_HANDLERS[88] = {
  execute(state, power, actionData, helpers) {
    const targets = actionData.targetSpaces || [];
    let placed = 0;
    for (const name of targets.slice(0, 5)) {
      const sp = state.spaces[name];
      if (sp && sp.languageZone === 'german' && !sp.unrest) {
        const hasUnits = sp.units.some(
          s => s.regulars + s.mercenaries + s.cavalry > 0
        );
        if (!hasUnits) { sp.unrest = true; placed++; }
      }
    }
    helpers.logEvent(
      state, 'event_peasants_war', { power, placed }
    );
  }
};

// #89 Pirate Haven
EXTENDED_EVENT_HANDLERS[89] = {
  validate(state) {
    if (!state.piracyEnabled) {
      return {
        valid: false,
        error: 'Barbary Pirates must be played first'
      };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (!targetSpace) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    sp.controller = 'ottoman';
    let stack = sp.units.find(u => u.owner === 'ottoman');
    if (!stack) {
      stack = {
        owner: 'ottoman', regulars: 0, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      };
      sp.units.push(stack);
    }
    stack.regulars += 1;
    stack.corsairs += 2;
    sp.pirateHaven = true;
    helpers.logEvent(
      state, 'event_pirate_haven', { power, targetSpace }
    );
  }
};

// #90 Printing Press
EXTENDED_EVENT_HANDLERS[90] = {
  execute(state, power, actionData, helpers) {
    state.printingPressActive = true;
    state.pendingReformation = {
      attemptsRemaining: 3, zones: 'all', playedBy: power
    };
    helpers.logEvent(state, 'event_printing_press', { power });
  }
};

// #91 Ransom
EXTENDED_EVENT_HANDLERS[91] = {
  execute(state, power, actionData, helpers) {
    const leaderId = actionData.leaderId;
    const targetSpace = actionData.targetSpace;
    if (!leaderId || !targetSpace) return;
    state.capturedLeaders = state.capturedLeaders || [];
    const idx = state.capturedLeaders.indexOf(leaderId);
    if (idx !== -1) {
      state.capturedLeaders.splice(idx, 1);
      const sp = state.spaces[targetSpace];
      if (sp) {
        const leaderPower = actionData.leaderPower || power;
        let stack = sp.units.find(u => u.owner === leaderPower);
        if (!stack) {
          stack = {
            owner: leaderPower, regulars: 0, mercenaries: 0,
            cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
          };
          sp.units.push(stack);
        }
        stack.leaders.push(leaderId);
      }
    }
    helpers.logEvent(
      state, 'event_ransom', { power, leaderId, targetSpace }
    );
  }
};

// #92 Revolt in Egypt
EXTENDED_EVENT_HANDLERS[92] = {
  execute(state, power, actionData, helpers) {
    state.foreignWars = state.foreignWars || {};
    state.foreignWars.egypt = {
      targetPower: 'ottoman',
      requiredUnits: 3,
      enemyUnits: 3,
      active: true
    };
    state.cardModifiers = state.cardModifiers || {};
    state.cardModifiers.ottoman =
      (state.cardModifiers.ottoman || 0) - 1;
    helpers.logEvent(state, 'event_revolt_in_egypt', { power });
  }
};

// #93 Revolt in Ireland
EXTENDED_EVENT_HANDLERS[93] = {
  execute(state, power, actionData, helpers) {
    state.foreignWars = state.foreignWars || {};
    const irishUnits =
      (power === 'france' || power === 'hapsburg') ? 4 : 3;
    state.foreignWars.ireland = {
      targetPower: 'england',
      requiredUnits: 4,
      enemyUnits: irishUnits,
      active: true
    };
    state.cardModifiers = state.cardModifiers || {};
    state.cardModifiers.england =
      (state.cardModifiers.england || 0) - 1;
    helpers.logEvent(
      state, 'event_revolt_in_ireland', { power, irishUnits }
    );
  }
};

// #94 Revolt of Communeros
EXTENDED_EVENT_HANDLERS[94] = {
  execute(state, power, actionData, helpers) {
    const targets = actionData.targetSpaces || [];
    let placed = 0;
    for (const name of targets.slice(0, 3)) {
      const sp = state.spaces[name];
      if (sp && sp.languageZone === 'spanish' && !sp.unrest) {
        const hasUnits = sp.units.some(
          s => s.regulars + s.mercenaries + s.cavalry > 0
        );
        if (!hasUnits) { sp.unrest = true; placed++; }
      }
    }
    helpers.logEvent(
      state, 'event_communeros', { power, placed }
    );
  }
};

// #95 Sack of Rome
EXTENDED_EVENT_HANDLERS[95] = {
  execute(state, power, actionData, helpers) {
    const rome = state.spaces['Rome'];
    const papalRegs =
      rome?.units.find(u => u.owner === 'papacy')?.regulars || 0;
    state.pendingSackOfRome = {
      papalRegulars: papalRegs,
      triggered: true
    };
    helpers.logEvent(
      state, 'event_sack_of_rome', { power, papalRegs }
    );
  }
};

// #96 Sale of Moluccas
EXTENDED_EVENT_HANDLERS[96] = {
  execute(state, power, actionData, helpers) {
    const circumnavigator = state.circumnavigation?.completedBy;
    if (circumnavigator) {
      state.pendingCardDraw = state.pendingCardDraw || {};
      state.pendingCardDraw[circumnavigator] =
        (state.pendingCardDraw[circumnavigator] || 0) + 2;
    }
    helpers.logEvent(
      state, 'event_sale_of_moluccas', { power, circumnavigator }
    );
  }
};

// #98 Search for Cibola
EXTENDED_EVENT_HANDLERS[98] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    state.explorationCancelled = state.explorationCancelled || {};
    state.explorationCancelled[targetPower] = true;
    helpers.logEvent(
      state, 'event_search_for_cibola', { power, targetPower }
    );
  }
};

// #99 Sebastian Cabot
EXTENDED_EVENT_HANDLERS[99] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower || power;
    state.pendingExploration = state.pendingExploration || {};
    state.pendingExploration[targetPower] = {
      explorer: 'cabot', value: 1, source: 'sebastian_cabot'
    };
    helpers.logEvent(
      state, 'event_sebastian_cabot', { power, targetPower }
    );
  }
};

// #100 Shipbuilding
EXTENDED_EVENT_HANDLERS[100] = {
  validate(state, power) {
    if (power === 'protestant') {
      return { valid: false, error: 'Not playable by Protestant' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const placements = actionData.placements || [];
    let placed = 0;
    for (const p of placements) {
      if (placed >= 2) break;
      const sp = state.spaces[p.space];
      if (!sp) continue;
      let stack = sp.units.find(u => u.owner === power);
      if (!stack) {
        stack = {
          owner: power, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(stack);
      }
      const toPlace = Math.min(p.count || 1, 2 - placed);
      if (power === 'ottoman' && actionData.useCorsairs) {
        stack.corsairs += toPlace * 2;
        placed += toPlace;
      } else {
        stack.squadrons += toPlace;
        placed += toPlace;
      }
    }
    helpers.logEvent(
      state, 'event_shipbuilding', { power, placed }
    );
  }
};

// #101 Smallpox
EXTENDED_EVENT_HANDLERS[101] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower || power;
    state.pendingConquest = state.pendingConquest || {};
    state.pendingConquest[targetPower] = {
      modifier: 2, source: 'smallpox'
    };
    helpers.logEvent(
      state, 'event_smallpox', { power, targetPower }
    );
  }
};

// #102 Spring Preparations
EXTENDED_EVENT_HANDLERS[102] = {
  validate(state, power) {
    if (power === 'protestant') {
      return { valid: false, error: 'Not playable by Protestant' };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const capitals = power === 'hapsburg'
      ? ['Vienna', 'Brussels']
      : [actionData.capital || 'Paris'];
    for (const capName of capitals) {
      const sp = state.spaces[capName];
      if (!sp) continue;
      let stack = sp.units.find(u => u.owner === power);
      if (!stack) {
        stack = {
          owner: power, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(stack);
      }
      stack.regulars += 1;
    }
    state.enhancedSpringDeployment = power;
    helpers.logEvent(
      state, 'event_spring_preparations', { power, capitals }
    );
  }
};

// #103 Threat to Power
EXTENDED_EVENT_HANDLERS[103] = {
  execute(state, power, actionData, helpers) {
    const targetLeader = actionData.targetLeader;
    if (!targetLeader) return;
    const roll = actionData.dieRoll ??
      (Math.floor(Math.random() * 6) + 1);
    const permanent = roll >= 4;
    for (const sp of Object.values(state.spaces)) {
      for (const stack of sp.units) {
        const idx = stack.leaders.indexOf(targetLeader);
        if (idx !== -1) {
          stack.leaders.splice(idx, 1);
          break;
        }
      }
    }
    if (permanent) {
      state.removedLeaders = state.removedLeaders || [];
      state.removedLeaders.push(targetLeader);
    } else {
      state.temporaryRemovedLeaders =
        state.temporaryRemovedLeaders || [];
      state.temporaryRemovedLeaders.push(targetLeader);
    }
    helpers.logEvent(state, 'event_threat_to_power', {
      power, targetLeader, roll, permanent
    });
  }
};

// #104 Trace Italienne
EXTENDED_EVENT_HANDLERS[104] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    if (!targetSpace) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    sp.isFortress = true;
    if (
      sp.controller && !sp.unrest &&
      sp.controller !== 'independent'
    ) {
      let stack = sp.units.find(u => u.owner === sp.controller);
      if (!stack) {
        stack = {
          owner: sp.controller, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(stack);
      }
      stack.regulars += 1;
    }
    helpers.logEvent(
      state, 'event_trace_italienne', { power, targetSpace }
    );
  }
};

// #105 Treachery
EXTENDED_EVENT_HANDLERS[105] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    state.pendingTreacheryAssault = {
      targetSpace, initiatedBy: power
    };
    helpers.logEvent(
      state, 'event_treachery', { power, targetSpace }
    );
  }
};

// #106 Unpaid Mercenaries
EXTENDED_EVENT_HANDLERS[106] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    const targetPower = actionData.targetPower;
    if (!targetSpace || !targetPower) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    const stack = sp.units.find(u => u.owner === targetPower);
    if (stack) {
      const removed = stack.mercenaries;
      stack.mercenaries = 0;
      helpers.logEvent(state, 'event_unpaid_mercenaries', {
        power, targetSpace, targetPower, removed
      });
    }
  }
};

// #107 Unsanitary Camp
EXTENDED_EVENT_HANDLERS[107] = {
  execute(state, power, actionData, helpers) {
    const targetSpace = actionData.targetSpace;
    const targetPower = actionData.targetPower;
    if (!targetSpace || !targetPower) return;
    const sp = state.spaces[targetSpace];
    if (!sp) return;
    const stack = sp.units.find(u => u.owner === targetPower);
    if (!stack) return;
    const totalUnits =
      stack.regulars + stack.mercenaries + stack.cavalry;
    const toRemove = Math.ceil(totalUnits / 3);
    const regLoss = Math.min(
      Math.ceil(toRemove / 2), stack.regulars
    );
    stack.regulars -= regLoss;
    let remaining = toRemove - regLoss;
    const mercLoss = Math.min(remaining, stack.mercenaries);
    stack.mercenaries -= mercLoss;
    remaining -= mercLoss;
    if (remaining > 0) {
      stack.cavalry = Math.max(0, stack.cavalry - remaining);
    }
    helpers.logEvent(state, 'event_unsanitary_camp', {
      power, targetSpace, targetPower, toRemove
    });
  }
};

// #108 Venetian Alliance
EXTENDED_EVENT_HANDLERS[108] = {
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
      state, 'event_venetian_alliance', { power, mode }
    );
  }
};

// #109 Venetian Informant
EXTENDED_EVENT_HANDLERS[109] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    state.pendingHandReview = {
      reviewer: power,
      targetPower,
      readOnly: true
    };
    helpers.logEvent(
      state, 'event_venetian_informant', { power, targetPower }
    );
  }
};

// #110 War in Persia
EXTENDED_EVENT_HANDLERS[110] = {
  execute(state, power, actionData, helpers) {
    state.foreignWars = state.foreignWars || {};
    state.foreignWars.persia = {
      targetPower: 'ottoman',
      requiredUnits: 5,
      enemyUnits: 4,
      active: true
    };
    state.cardModifiers = state.cardModifiers || {};
    state.cardModifiers.ottoman =
      (state.cardModifiers.ottoman || 0) - 1;
    helpers.logEvent(state, 'event_war_in_persia', { power });
  }
};

// #111 Colonial Governor/Native Uprising
EXTENDED_EVENT_HANDLERS[111] = {
  execute(state, power, actionData, helpers) {
    const targetPower = actionData.targetPower;
    const side = actionData.side || 'governor';
    state.colonialMarkers = state.colonialMarkers || {};
    state.colonialMarkers[targetPower] = side;
    helpers.logEvent(
      state, 'event_colonial_governor',
      { power, targetPower, side }
    );
  }
};

// #112 Thomas More
EXTENDED_EVENT_HANDLERS[112] = {
  execute(state, power, actionData, helpers) {
    if (power === 'england' || power === 'protestant') {
      state.thomasMoreExecuted = true;
      state.noDebatesInEnglandThisTurn = true;
      state.pendingCardDraw = state.pendingCardDraw || {};
      state.pendingCardDraw.england =
        (state.pendingCardDraw.england || 0) + 1;
      state.pendingDiscardChoice = { power: 'england' };
      helpers.logEvent(
        state, 'event_thomas_more_executed', { power }
      );
    } else {
      state.pendingDebateCall = {
        caller: 'papacy', zones: 'all',
        extraDice: 1, extraDiceEngland: 3
      };
      helpers.logEvent(
        state, 'event_thomas_more_debate', { power }
      );
    }
  }
};

// #115 Thomas Cromwell
EXTENDED_EVENT_HANDLERS[115] = {
  execute(state, power, actionData, helpers) {
    const mode = actionData.mode || 'cancel';
    if (mode === 'cancel') {
      state.pendingEventCancelled = true;
      helpers.logEvent(
        state, 'event_thomas_cromwell_cancel', { power }
      );
    } else if (mode === 'retrieve') {
      if (state.discard.includes(63)) {
        const idx = state.discard.indexOf(63);
        state.discard.splice(idx, 1);
        state.hands.england = state.hands.england || [];
        state.hands.england.push(63);
      }
      helpers.logEvent(
        state, 'event_thomas_cromwell_retrieve', { power }
      );
    } else if (mode === 'treatise') {
      state.treatiseCostModifier = state.treatiseCostModifier || {};
      state.treatiseCostModifier.england = -1;
      helpers.logEvent(
        state, 'event_thomas_cromwell_treatise', { power }
      );
    }
  }
};

// #116 Rough Wooing
EXTENDED_EVENT_HANDLERS[116] = {
  validate(state) {
    if (!state.edwardBorn) {
      return { valid: false, error: 'Edward VI must have been born' };
    }
    if (!areAllied(state, 'scotland', 'france')) {
      return {
        valid: false,
        error: 'Scotland must be allied with France'
      };
    }
    return { valid: true };
  },
  execute(state, power, actionData, helpers) {
    const engRoll = actionData.engRoll ??
      (Math.floor(Math.random() * 6) + 1);
    const fraRoll = actionData.fraRoll ??
      (Math.floor(Math.random() * 6) + 1);
    let engUnits = 0;
    let fraUnits = 0;
    for (const sp of Object.values(state.spaces)) {
      if (sp.homePower === 'scotland') {
        for (const stack of sp.units) {
          const count = stack.regulars + stack.mercenaries +
            stack.cavalry + stack.squadrons;
          if (stack.owner === 'england') engUnits += count;
          if (stack.owner === 'france') fraUnits += count;
        }
      }
    }
    const engTotal = engRoll + engUnits;
    const fraTotal = fraRoll + fraUnits;
    const success = engTotal >= fraTotal + 2;
    if (success) {
      state.alliances = state.alliances.filter(a => !(
        (a.a === 'scotland' && a.b === 'france') ||
        (a.a === 'france' && a.b === 'scotland')
      ));
      state.alliances.push({ a: 'scotland', b: 'england' });
      state.minorPowers = state.minorPowers || {};
      state.minorPowers.scotland = {
        ally: 'england', active: true
      };
      for (const sp of Object.values(state.spaces)) {
        if (sp.homePower === 'scotland') {
          sp.controller = 'england';
          sp.units = sp.units.filter(
            u => u.owner === 'england' || u.owner === 'scotland'
          );
        }
      }
    }
    helpers.logEvent(state, 'event_rough_wooing', {
      power, engRoll, fraRoll, engUnits, fraUnits,
      engTotal, fraTotal, success
    });
  }
};
