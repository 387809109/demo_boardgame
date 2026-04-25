/**
 * Here I Stand — Bot Event Card Criteria
 *
 * HISBOT §5: Decision table for ~90 event cards.
 * Each entry determines whether a Bot power plays a card for its
 * event effect rather than CPs. Also indicates Treaty conditions
 * (when playing on behalf of another power satisfies a Treaty).
 *
 * Each criterion function receives (state, power) and returns boolean.
 * Treaty functions receive (state, power, tokenPower) where tokenPower
 * is the power whose Treaty token the Bot holds.
 *
 * Card numbers reference CARDS[] in data/cards.js.
 */

import { areAtWar, areAllied, getWarsOf, getAlliesOf } from '../state/war-helpers.js';
import {
  getActiveRuler, isHomeSpace, getUnitsInSpace, countLandUnits
} from '../state/state-helpers.js';
import { isBotPower } from './bot-controller.js';

// ── Helpers ──────────────────────────────────────────────────────

function controls(state, power, spaceName) {
  return state.spaces?.[spaceName]?.controller === power;
}

function hasColonies(state, power) {
  return ((state.colonies?.[power] || []).length +
          (state.conquests?.[power] || []).length) > 0;
}

function getCorsairCount(state, power) {
  let n = 0;
  for (const sp of Object.values(state.spaces || {})) {
    for (const u of sp.units || []) {
      if (u.owner === power) n += u.corsairs || 0;
    }
  }
  return n;
}

function countMercenaries(state, power) {
  let n = 0;
  for (const sp of Object.values(state.spaces || {})) {
    for (const u of sp.units || []) {
      if (u.owner === power) n += u.mercenaries || 0;
    }
  }
  return n;
}

function isStPetersIncomplete(state) {
  return (state.stPetersProgress || 0) < 5;
}

function isAtWarWithAny(state, power) {
  return getWarsOf(state, power).length > 0;
}

function atWarWith(state, power, target) {
  return areAtWar(state, power, target);
}

function powerWithMostMercs(state, power, threshold) {
  const enemies = getWarsOf(state, power);
  let best = null, bestN = 0;
  for (const e of enemies) {
    const n = countMercenaries(state, e);
    if (n >= threshold && n > bestN) { bestN = n; best = e; }
  }
  return best;
}

function isSchmalkaldic(state) { return !!state.schmalkaldic; }
function currentTurn(state) { return state.turn || 1; }

function isGenoaAlly(state, power) {
  return getAlliesOf(state, power).includes('genoa');
}

function isScotlandAlly(state, power) {
  return getAlliesOf(state, power).includes('scotland');
}

function isVeniceAlly(state, power) {
  return getAlliesOf(state, power).includes('venice');
}

function isInDiscard(state, cardNumber) {
  return (state.discardPile || []).includes(cardNumber);
}

function isExcommunicated(state, power) {
  return !!(state.excommunicated || {})[power];
}

function isMaryRuling(state) {
  return getActiveRuler(state, 'england')?.id === 'mary_i';
}

function hasExplorationUnderway(state, power) {
  return !!(state.explorations?.[power]);
}

function hasCircumnavigation(state, power) {
  return !!(state.circumnavigation?.[power]);
}

function hasCapturedLeader(state, power) {
  return (state.capturedLeaders?.[power] || []).length > 0;
}

function hasActiveSiege(state, power) {
  for (const sp of Object.values(state.spaces || {})) {
    if (sp.besieged && sp.besiegedBy === power) return true;
  }
  return false;
}

function hasCapturedKey(state, power) {
  for (const [name, sp] of Object.entries(state.spaces || {})) {
    if (sp.is_key_space && isHomeSpace(state, name, power) &&
        sp.controller !== power) return true;
  }
  return false;
}

function countConvertibleProtestantSpaces(state) {
  let n = 0;
  for (const [name, sp] of Object.entries(state.spaces || {})) {
    if (sp.religion === 'protestant' && !sp.is_electorate) {
      const units = sp.units || [];
      const occupied = units.some(u => u.owner && countLandUnits(u) > 0);
      if (!occupied) n++;
    }
  }
  return n;
}

// ── Event Card Criteria Table (§5) ───────────────────────────────
// Key = card number from data/cards.js
// shouldPlay(state, power) → play event?
// treaty(state, power, tokenPower) → satisfies Treaty?

/**
 * @type {Object<number, {title:string, shouldPlay:Function|null, treaty:Function|null}>}
 */
export const EVENT_CRITERIA = {
  // 38: Halley's Comet — play option (a) against enemy
  38: {
    title: "Halley's Comet",
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    score: (s, p) => isAtWarWithAny(s, p) ? 0.9 : 0,
    treaty: (s, p, tp) => tp === p
  },
  // 39: Augsburg Confession — Protestant always
  39: {
    title: 'Augsburg Confession',
    shouldPlay: (s, p) => p === 'protestant',
    score: (s, p) => p === 'protestant' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 40: Machiavelli: The Prince — never
  40: {
    title: 'Machiavelli: The Prince',
    shouldPlay: () => false,
    score: () => 0,
    treaty: null
  },
  // 41: Marburg Colloquy — Protestant
  41: {
    title: 'Marburg Colloquy',
    shouldPlay: (s, p) => p === 'protestant',
    score: (s, p) => p === 'protestant' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 42: Roxelana — Ottoman
  42: {
    title: 'Roxelana',
    shouldPlay: (s, p) => p === 'ottoman',
    score: (s, p) => p === 'ottoman' ? 1.0 : 0,
    treaty: (s, p, tp) => atWarWith(s, tp, 'ottoman')
  },
  // 43: Zwingli Dons Armor — Papacy/Hapsburg
  43: {
    title: 'Zwingli Dons Armor',
    shouldPlay: (s, p) => p === 'papacy' || p === 'hapsburg',
    score: (s, p) => (p === 'papacy' || p === 'hapsburg') ? 0.9 : 0,
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 44: Affair of the Placards — Protestant
  44: {
    title: 'Affair of the Placards',
    shouldPlay: (s, p) => p === 'protestant',
    score: (s, p) => p === 'protestant' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 45: Calvin Expelled — Papacy
  45: {
    title: 'Calvin Expelled',
    shouldPlay: (s, p) => p === 'papacy',
    score: (s, p) => p === 'papacy' ? 0.9 : 0,
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 46: Calvin's Institutes — Protestant
  46: {
    title: "Calvin's Institutes",
    shouldPlay: (s, p) => p === 'protestant',
    score: (s, p) => p === 'protestant' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 47: Copernicus — always for VPs
  47: {
    title: 'Copernicus',
    shouldPlay: () => true,
    score: () => 1.0,
    treaty: null
  },
  // 48: Galleons — England/France/Hapsburg with colonies
  48: {
    title: 'Galleons',
    shouldPlay: (s, p) =>
      ['england', 'france', 'hapsburg'].includes(p) && hasColonies(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 49: Huguenot Raiders — not Hapsburg, if Hapsburg has colonies
  49: {
    title: 'Huguenot Raiders',
    shouldPlay: (s, p) => {
      if (p === 'hapsburg') return false;
      return ['england', 'france', 'protestant'].includes(p) &&
             hasColonies(s, 'hapsburg');
    },
    treaty: (s, p, tp) =>
      ['england', 'france', 'protestant'].includes(tp) &&
      hasColonies(s, 'hapsburg')
  },
  // 50: Mercator's Map — explore if not already exploring
  50: {
    title: "Mercator's Map",
    shouldPlay: (s, p) =>
      ['hapsburg', 'england', 'france'].includes(p) &&
      !hasExplorationUnderway(s, p),
    treaty: (s, p, tp) =>
      ['hapsburg', 'england', 'france'].includes(tp) &&
      !hasExplorationUnderway(s, tp)
  },
  // 51: Michael Servetus — always for 1 VP
  51: {
    title: 'Michael Servetus',
    shouldPlay: () => true,
    score: () => 1.0,
    treaty: null
  },
  // 52: Michelangelo — Papacy if St. Peter's incomplete
  52: {
    title: 'Michelangelo',
    shouldPlay: (s, p) => p === 'papacy' && isStPetersIncomplete(s),
    score: (s, p) => {
      if (p !== 'papacy') return 0;
      return isStPetersIncomplete(s) ? 1.0 : 0.2;  // residual utility even post-completion
    },
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 53: Plantations — with colonies
  53: {
    title: 'Plantations',
    shouldPlay: (s, p) =>
      ['england', 'france', 'hapsburg'].includes(p) && hasColonies(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 54: Potosi Silver Mines
  54: {
    title: 'Potosi Silver Mines',
    shouldPlay: (s, p) => ['england', 'france', 'hapsburg'].includes(p),
    treaty: (s, p, tp) => tp === p
  },
  // 55: Jesuit Education — Papacy always
  55: {
    title: 'Jesuit Education',
    shouldPlay: (s, p) => p === 'papacy',
    score: (s, p) => p === 'papacy' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 56: Papal Inquisition — Papacy
  56: {
    title: 'Papal Inquisition',
    shouldPlay: (s, p) => p === 'papacy',
    score: (s, p) => p === 'papacy' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 57: Philip of Hesse's Bigamy — at war with Protestant
  57: {
    title: "Philip of Hesse's Bigamy",
    shouldPlay: (s, p) => atWarWith(s, p, 'protestant'),
    treaty: (s, p, tp) => tp === p
  },
  // 58: Spanish Inquisition — Hapsburg/Papacy always
  58: {
    title: 'Spanish Inquisition',
    shouldPlay: (s, p) => p === 'hapsburg' || p === 'papacy',
    score: (s, p) => (p === 'hapsburg' || p === 'papacy') ? 0.9 : 0,
    treaty: (s, p, tp) => tp === 'hapsburg' || tp === 'papacy'
  },
  // 59: Lady Jane Grey — Papacy/Protestant
  59: {
    title: 'Lady Jane Grey',
    shouldPlay: (s, p) => p === 'papacy' || p === 'protestant',
    treaty: (s, p, tp) => tp === 'papacy' || tp === 'protestant'
  },
  // 60: Maurice of Saxony — Hapsburg/Protestant
  60: {
    title: 'Maurice of Saxony',
    shouldPlay: (s, p) => p === 'hapsburg' || p === 'protestant',
    treaty: (s, p, tp) => tp === p
  },
  // 61: Mary Defies Council — Papacy always
  61: {
    title: 'Mary Defies Council',
    shouldPlay: (s, p) => p === 'papacy',
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 62: Book of Common Prayer — Protestant
  62: {
    title: 'Book of Common Prayer',
    shouldPlay: (s, p) => p === 'protestant',
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 63: Dissolution of the Monasteries — English/Protestant always, never Papacy
  63: {
    title: 'Dissolution of the Monasteries',
    shouldPlay: (s, p) => {
      if (p === 'papacy') return false;
      return p === 'england' || p === 'protestant';
    },
    score: (s, p) => {
      if (p === 'papacy') return 0;
      return (p === 'england' || p === 'protestant') ? 1.0 : 0;
    },
    treaty: (s, p, tp) => tp === 'england' || tp === 'protestant'
  },
  // 64: Pilgrimage of Grace — Papacy if !Mary, or at war with England
  64: {
    title: 'Pilgrimage of Grace',
    shouldPlay: (s, p) => {
      if (p === 'papacy' && !isMaryRuling(s)) return true;
      return atWarWith(s, p, 'england');
    },
    treaty: (s, p, tp) => atWarWith(s, tp, 'england')
  },
  // 65: A Mighty Fortress — Protestant always
  65: {
    title: 'A Mighty Fortress',
    shouldPlay: (s, p) => p === 'protestant',
    score: (s, p) => p === 'protestant' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 66: Akinji Raiders — Ottoman
  66: {
    title: 'Akinji Raiders',
    shouldPlay: (s, p) => p === 'ottoman',
    score: (s, p) => p === 'ottoman' ? 1.0 : 0,
    treaty: (s, p, tp) => tp === 'ottoman'
  },
  // 67: Anabaptists — Papacy if >= 2 convertible spaces
  67: {
    title: 'Anabaptists',
    shouldPlay: (s, p) =>
      p === 'papacy' && countConvertibleProtestantSpaces(s) >= 2,
    treaty: (s, p, tp) => tp === p
  },
  // 68: Andrea Doria — activate/deactivate Genoa
  68: {
    title: 'Andrea Doria',
    shouldPlay: (s, p) => {
      if (p === 'france' && !isGenoaAlly(s, 'france')) return true;
      if ((p === 'hapsburg' || p === 'papacy') &&
          !isGenoaAlly(s, 'hapsburg') && !isGenoaAlly(s, 'papacy')) return true;
      return false;
    },
    treaty: null
  },
  // 69: Auld Alliance — France always, England if Scotland allied w/ France
  69: {
    title: 'Auld Alliance',
    shouldPlay: (s, p) => {
      if (p === 'france') return true;
      if (p === 'england' && isScotlandAlly(s, 'france') &&
          atWarWith(s, 'england', 'france')) return true;
      return false;
    },
    score: (s, p) => {
      if (p === 'france') return 1.0;
      if (p === 'england' && isScotlandAlly(s, 'france') &&
          atWarWith(s, 'england', 'france')) return 0.9;
      return 0;
    },
    treaty: null
  },
  // 70: Charles Bourbon — at war with France or any
  70: {
    title: 'Charles Bourbon',
    shouldPlay: (s, p) =>
      atWarWith(s, p, 'france') || isAtWarWithAny(s, p),
    treaty: null
  },
  // 71: City State Rebels — has captured key
  71: {
    title: 'City State Rebels',
    shouldPlay: (s, p) => hasCapturedKey(s, p),
    treaty: null
  },
  // 72: Cloth Prices Fluctuate
  72: {
    title: 'Cloth Prices Fluctuate',
    shouldPlay: (s, p) => {
      if ((p === 'england' || p === 'hapsburg') &&
          controls(s, 'england', 'Calais') &&
          controls(s, 'hapsburg', 'Antwerp') &&
          !atWarWith(s, 'england', 'hapsburg')) return true;
      const ac = s.spaces?.['Antwerp']?.controller;
      if (ac && atWarWith(s, p, ac)) return true;
      return false;
    },
    treaty: null
  },
  // 73: Diplomatic Marriage — not Ottoman/Protestant
  73: {
    title: 'Diplomatic Marriage',
    shouldPlay: (s, p) =>
      p !== 'ottoman' && p !== 'protestant',
    treaty: () => true
  },
  // 74: Diplomatic Overture — never by Bots
  74: {
    title: 'Diplomatic Overture',
    shouldPlay: () => false,
    treaty: () => true
  },
  // 75: Erasmus — Protestant T1-2, Papacy T3+
  75: {
    title: 'Erasmus',
    shouldPlay: (s, p) => {
      const t = currentTurn(s);
      if (t <= 2 && p === 'protestant') return true;
      if (t >= 3 && p === 'papacy') return true;
      return false;
    },
    treaty: (s, p, tp) => {
      const t = currentTurn(s);
      return t <= 2 ? tp === 'protestant' : tp === 'papacy';
    }
  },
  // 76: Foreign Recruits — if at war
  76: {
    title: 'Foreign Recruits',
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    score: (s, p) => isAtWarWithAny(s, p) ? 0.9 : 0,
    treaty: null
  },
  // 78: Frederick the Wise — Protestant if conversion possible + Wartburg in discard
  78: {
    title: 'Frederick the Wise',
    shouldPlay: (s, p) => p === 'protestant' && isInDiscard(s, 37),
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 79: Fuggers — if at war
  79: {
    title: 'Fuggers',
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    treaty: null
  },
  // 80: Gabelle Revolt — at war with France
  80: {
    title: 'Gabelle Revolt',
    shouldPlay: (s, p) => atWarWith(s, p, 'france'),
    treaty: (s, p, tp) => atWarWith(s, tp, 'france')
  },
  // 81: Indulgence Vendor — Papacy if St. Peter's incomplete
  81: {
    title: 'Indulgence Vendor',
    shouldPlay: (s, p) => p === 'papacy' && isStPetersIncomplete(s),
    treaty: (s, p, tp) => tp === 'papacy' && isStPetersIncomplete(s)
  },
  // 82: Janissaries Rebel — at war with Ottoman
  82: {
    title: 'Janissaries Rebel',
    shouldPlay: (s, p) => atWarWith(s, p, 'ottoman'),
    treaty: (s, p, tp) => tp === p
  },
  // 83: John Zapolya — controls Buda
  83: {
    title: 'John Zapolya',
    shouldPlay: (s, p) => controls(s, p, 'Buda'),
    treaty: (s, p, tp) => controls(s, tp, 'Buda')
  },
  // 84: Julia Gonzaga — Ottoman with >= 2 corsairs
  84: {
    title: 'Julia Gonzaga',
    shouldPlay: (s, p) => p === 'ottoman' && getCorsairCount(s, 'ottoman') >= 2,
    treaty: (s, p, tp) => tp === p
  },
  // 85: Katherina Bora — Protestant
  85: {
    title: 'Katherina Bora',
    shouldPlay: (s, p) => p === 'protestant',
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 86: Knights of St. John — Papacy (St. Peter's), Hapsburg, never Ottoman
  86: {
    title: 'Knights of St. John',
    shouldPlay: (s, p) => {
      if (p === 'ottoman') return false;
      if (p === 'papacy' && isStPetersIncomplete(s)) return true;
      if (p === 'hapsburg') return true;
      return false;
    },
    treaty: (s, p, tp) => tp === 'papacy' || tp === 'hapsburg'
  },
  // 87: Mercenaries Demand Pay — enemy with most mercs >= 3
  87: {
    title: 'Mercenaries Demand Pay',
    shouldPlay: (s, p) => !!powerWithMostMercs(s, p, 3),
    treaty: (s, p, tp) => tp === p
  },
  // 88: Peasants' War — unrest in >= 3 enemy home spaces
  88: {
    title: "Peasants' War",
    shouldPlay: (s, p) => {
      const enemies = getWarsOf(s, p);
      let n = 0;
      for (const e of enemies) {
        for (const [name, sp] of Object.entries(s.spaces || {})) {
          if (isHomeSpace(s, name, e) && sp.controller === e && !sp.unrest) {
            const units = getUnitsInSpace(s, name);
            if (!units.some(u => u.owner === e && countLandUnits(u) > 0)) n++;
          }
        }
      }
      return n >= 3;
    },
    treaty: (s, p, tp) => tp === p
  },
  // 89: Pirate Haven — Ottoman
  89: {
    title: 'Pirate Haven',
    shouldPlay: (s, p) => p === 'ottoman',
    treaty: (s, p, tp) => tp === 'ottoman'
  },
  // 90: Printing Press — Protestant always
  90: {
    title: 'Printing Press',
    shouldPlay: (s, p) => p === 'protestant',
    treaty: (s, p, tp) => tp === 'protestant'
  },
  // 91: Ransom — has captured leader
  91: {
    title: 'Ransom',
    shouldPlay: (s, p) => hasCapturedLeader(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 92: Revolt in Egypt — at war with Ottoman
  92: {
    title: 'Revolt in Egypt',
    shouldPlay: (s, p) => atWarWith(s, p, 'ottoman'),
    treaty: (s, p, tp) => tp === p
  },
  // 93: Revolt in Ireland — at war with England
  93: {
    title: 'Revolt in Ireland',
    shouldPlay: (s, p) => atWarWith(s, p, 'england'),
    treaty: (s, p, tp) => atWarWith(s, tp, 'england')
  },
  // 94: Revolt of the Communeros — unrest in >= 2 enemy home spaces
  94: {
    title: 'Revolt of the Communeros',
    shouldPlay: (s, p) => {
      const enemies = getWarsOf(s, p);
      let n = 0;
      for (const e of enemies) {
        for (const [name, sp] of Object.entries(s.spaces || {})) {
          if (isHomeSpace(s, name, e)) n++;
        }
      }
      return n >= 2;
    },
    treaty: (s, p, tp) => tp === p
  },
  // 95: Sack of Rome — Protestant or at war with Papacy
  95: {
    title: 'Sack of Rome',
    shouldPlay: (s, p) => p === 'protestant' || atWarWith(s, p, 'papacy'),
    treaty: (s, p, tp) => tp === 'protestant' || atWarWith(s, tp, 'papacy')
  },
  // 96: Sale of Moluccas — has circumnavigation
  96: {
    title: 'Sale of Moluccas',
    shouldPlay: (s, p) => hasCircumnavigation(s, p),
    treaty: (s, p, tp) => hasCircumnavigation(s, tp)
  },
  // 97: Scots Raid — France
  97: {
    title: 'Scots Raid',
    shouldPlay: (s, p) => p === 'france',
    treaty: null
  },
  // 98: Search for Cibola — cancel enemy exploration
  98: {
    title: 'Search for Cibola',
    shouldPlay: (s, p) => {
      const enemies = getWarsOf(s, p);
      return enemies.some(e => hasExplorationUnderway(s, e));
    },
    treaty: (s, p, tp) => tp === p
  },
  // 99: Sebastian Cabot — England/France/Hapsburg
  99: {
    title: 'Sebastian Cabot',
    shouldPlay: (s, p) => ['hapsburg', 'england', 'france'].includes(p),
    treaty: null
  },
  // 100: Shipbuilding — always
  100: {
    title: 'Shipbuilding',
    shouldPlay: () => true,
    treaty: null
  },
  // 101: Smallpox — always
  101: {
    title: 'Smallpox',
    shouldPlay: () => true,
    treaty: null
  },
  // 102: Spring Preparations — never by Bots
  102: {
    title: 'Spring Preparations',
    shouldPlay: () => false,
    treaty: null
  },
  // 103: Threat to Power — at war
  103: {
    title: 'Threat to Power',
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 104: Trace Italienne — at war with major power
  104: {
    title: 'Trace Italienne',
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 105: Treachery! — has active siege
  105: {
    title: 'Treachery!',
    shouldPlay: (s, p) => hasActiveSiege(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 106: Unpaid Mercenaries — enemy with most mercs >= 3
  106: {
    title: 'Unpaid Mercenaries',
    shouldPlay: (s, p) => !!powerWithMostMercs(s, p, 3),
    treaty: (s, p, tp) => tp === p
  },
  // 107: Unsanitary Camp — if would remove enemy units
  107: {
    title: 'Unsanitary Camp',
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 108: Venetian Alliance — Papacy activate, or deactivate enemy Venice
  108: {
    title: 'Venetian Alliance',
    shouldPlay: (s, p) => {
      if (p === 'papacy' && !isVeniceAlly(s, 'papacy')) return true;
      if (p === 'papacy' || p === 'ottoman') {
        const enemies = getWarsOf(s, p);
        if (enemies.some(e => isVeniceAlly(s, e))) return true;
      }
      return false;
    },
    treaty: (s, p, tp) => {
      if (tp === 'papacy' || tp === 'ottoman') {
        const enemies = getWarsOf(s, tp);
        return enemies.some(e => isVeniceAlly(s, e));
      }
      return false;
    }
  },
  // 109: Venetian Informant — never by Bots
  109: {
    title: 'Venetian Informant',
    shouldPlay: () => false,
    treaty: null
  },
  // 110: War in Persia — at war with Ottoman
  110: {
    title: 'War in Persia',
    shouldPlay: (s, p) => atWarWith(s, p, 'ottoman'),
    treaty: (s, p, tp) => tp === p
  },
  // 111: Colonial Governor/Native Uprising — has colony or enemy has colony
  111: {
    title: 'Colonial Governor/Native Uprising',
    shouldPlay: (s, p) => {
      if (hasColonies(s, p)) return true;
      return getWarsOf(s, p).some(e => hasColonies(s, e));
    },
    treaty: (s, p, tp) => tp === p
  },
  // 112: Thomas More — Papacy
  112: {
    title: 'Thomas More',
    shouldPlay: (s, p) => p === 'papacy',
    treaty: (s, p, tp) => tp === 'papacy'
  },
  // 115: Thomas Cromwell — Papacy plays immediately; others save as response
  115: {
    title: 'Thomas Cromwell',
    shouldPlay: (s, p) => p === 'papacy',
    treaty: (s, p, tp) =>
      tp === 'england' && isInDiscard(s, 63) // Dissolution = card 63
  },
  // 116: Rough Wooing — England (requires Edward VI born + Scotland allied to France)
  116: {
    title: 'Rough Wooing',
    shouldPlay: (s, p) =>
      p === 'england' && !!s.edwardBorn && areAllied(s, 'scotland', 'france'),
    treaty: (s, p, tp) => tp === 'england'
  }
};

// ── Response/Combat Card Criteria ────────────────────────────────
// Cards set aside face-up and played when conditions arise.

/**
 * @type {Object<number, {title:string, shouldPlay:Function, treaty:Function|null}>}
 */
export const RESPONSE_CRITERIA = {
  // 26: Mercenaries Bribed (COMBAT)
  26: {
    title: 'Mercenaries Bribed',
    shouldPlay: () => true, // Evaluated at combat time
    treaty: null
  },
  // 27: Mercenaries Grow Restless (COMBAT)
  27: {
    title: 'Mercenaries Grow Restless',
    shouldPlay: () => true,
    treaty: null
  },
  // 30: Tercios (COMBAT)
  30: {
    title: 'Tercios',
    shouldPlay: () => true,
    treaty: null
  },
  // 31: Foul Weather (RESPONSE)
  31: {
    title: 'Foul Weather',
    shouldPlay: (s, p) => isAtWarWithAny(s, p),
    treaty: (s, p, tp) => tp === p
  },
  // 32: Gout (RESPONSE)
  32: {
    title: 'Gout',
    shouldPlay: () => true, // Evaluated at response time
    treaty: (s, p, tp) => tp === p
  },
  // 33: Landsknechts (RESPONSE) — Hapsburg always, others if at war
  33: {
    title: 'Landsknechts',
    shouldPlay: (s, p) => p === 'hapsburg' || isAtWarWithAny(s, p),
    treaty: null
  },
  // 34: Professional Rowers (RESPONSE) — not Protestant
  34: {
    title: 'Professional Rowers',
    shouldPlay: (s, p) => p !== 'protestant',
    treaty: null
  },
  // 35: Siege Artillery (RESPONSE)
  35: {
    title: 'Siege Artillery',
    shouldPlay: (s, p) => hasActiveSiege(s, p),
    treaty: (s, p, tp) => hasActiveSiege(s, tp)
  },
  // 36: Swiss Mercenaries (RESPONSE) — not Protestant pre-SL, not Ottoman
  36: {
    title: 'Swiss Mercenaries',
    shouldPlay: (s, p) => {
      if (p === 'protestant' && !isSchmalkaldic(s)) return false;
      if (p === 'ottoman') return false;
      return true;
    },
    treaty: (s, p, tp) => p === 'ottoman' && tp === 'france'
  },
  // 37: The Wartburg (RESPONSE) — Protestant saves to cancel Papal Bull/Leipzig
  37: {
    title: 'The Wartburg',
    shouldPlay: (s, p) => p === 'protestant',
    treaty: null
  },
  // 77: Fountain of Youth (RESPONSE)
  77: {
    title: 'Fountain of Youth',
    shouldPlay: (s, p) => {
      const enemies = getWarsOf(s, p);
      return enemies.some(e => hasExplorationUnderway(s, e));
    },
    treaty: (s, p, tp) => tp === p
  },
  // 115: Thomas Cromwell (RESPONSE) — non-Papacy save to cancel excommunication
  115: {
    title: 'Thomas Cromwell',
    shouldPlay: (s, p) => p !== 'papacy' && !isExcommunicated(s, p),
    treaty: null
  }
};

// ── Public API ───────────────────────────────────────────────────

/**
 * Check if a Bot should play a card for its event effect.
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function shouldPlayEvent(state, power, cardNumber) {
  const c = EVENT_CRITERIA[cardNumber];
  return c?.shouldPlay ? c.shouldPlay(state, power) : false;
}

/**
 * Continuous event-utility score in [0, 1] for the event-vs-CP decision.
 *
 * Phase G transitions the criteria table from a boolean `shouldPlay` to a
 * continuous `score(state, power) => 0..1`. During the migration window both
 * fields may coexist per entry; this helper picks whichever is defined.
 *
 * Fallback mapping (no `score` defined):
 *   shouldPlay === true  → 0.8  (strong canonical play signal)
 *   shouldPlay === false → 0.0  (never per HISBOT rule table)
 *   no entry at all      → 0.0
 *
 * See docs/games/his/BOT_EVENT_SCORING_PLAN.md (Phase G1).
 *
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @returns {number} Score in [0, 1]
 */
export function eventScore(state, power, cardNumber) {
  const c = EVENT_CRITERIA[cardNumber];
  if (!c) return 0;
  if (typeof c.score === 'function') {
    const raw = c.score(state, power);
    if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
    return Math.max(0, Math.min(1, raw));
  }
  if (typeof c.shouldPlay === 'function') {
    return c.shouldPlay(state, power) ? 0.8 : 0;
  }
  return 0;
}

/**
 * Whether a criterion entry has an explicit Phase G `score` function
 * (as opposed to the legacy `shouldPlay` boolean). Used by
 * `routeEventCard` to gate the scoring-path comparison: only migrated
 * cards run through the event-vs-CP score comparison; unmigrated cards
 * keep the legacy boolean-routing behavior unchanged.
 *
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function hasEventScore(cardNumber) {
  const c = EVENT_CRITERIA[cardNumber];
  return typeof c?.score === 'function';
}

/**
 * Check if playing a card satisfies a Treaty obligation for tokenPower.
 * @param {Object} state
 * @param {string} power - Bot power playing the card
 * @param {number} cardNumber
 * @param {string} tokenPower - Power whose Treaty token the Bot holds
 * @returns {boolean}
 */
export function satisfiesTreaty(state, power, cardNumber, tokenPower) {
  const c = EVENT_CRITERIA[cardNumber];
  return c?.treaty ? c.treaty(state, power, tokenPower) : false;
}

/**
 * Check if a response/combat card should be played when conditions arise.
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function shouldPlayResponse(state, power, cardNumber) {
  const c = RESPONSE_CRITERIA[cardNumber];
  return c?.shouldPlay ? c.shouldPlay(state, power) : false;
}

/**
 * Check if a card has event criteria defined.
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function hasEventCriteria(cardNumber) {
  return !!EVENT_CRITERIA[cardNumber];
}

/**
 * Check if a card has response criteria defined.
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function hasResponseCriteria(cardNumber) {
  return !!RESPONSE_CRITERIA[cardNumber];
}

/**
 * Check if a response/combat card satisfies a Treaty obligation.
 * @param {Object} state
 * @param {string} power
 * @param {number} cardNumber
 * @param {string} tokenPower
 * @returns {boolean}
 */
export function satisfiesResponseTreaty(state, power, cardNumber, tokenPower) {
  const c = RESPONSE_CRITERIA[cardNumber];
  return c?.treaty ? c.treaty(state, power, tokenPower) : false;
}
