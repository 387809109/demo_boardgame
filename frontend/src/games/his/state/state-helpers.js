/**
 * Here I Stand — State Query Helpers
 *
 * Pure functions that query game state. No mutations.
 */

import {
  MAJOR_POWERS, IMPULSE_ORDER, RULERS,
  KEY_VP_TRACK, PROTESTANT_CARD_DRAW,
  CARD_TYPE, FORMATION, DEBATERS, RELIGION
} from '../constants.js';
import { CARDS, CARD_BY_NUMBER } from '../data/cards.js';
import {
  LAND_ADJACENCY, LAND_SPACES, SPACE_BY_NAME, PORTS_BY_SEA_ZONE
} from '../data/map-data.js';
import { ARMY_LEADERS } from '../data/leaders.js';
import { getReformerDiceBonus } from './reformer-helpers.js';

/**
 * Get the power assigned to a player.
 * @param {Object} state
 * @param {string} playerId
 * @returns {string|null} Power name or null
 */
export function getPowerForPlayer(state, playerId) {
  return state.powerByPlayer[playerId] || null;
}

/**
 * Get the player assigned to a power.
 * @param {Object} state
 * @param {string} power
 * @returns {string|null} Player ID or null
 */
export function getPlayerForPower(state, power) {
  return state.playerByPower[power] || null;
}

/**
 * Count key spaces controlled by a power.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function countKeysForPower(state, power) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.isKey && sp.controller === power) count++;
  }
  return count;
}

/**
 * Count electorates under a power's political control.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function countElectoratesForPower(state, power) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.isElectorate && sp.controller === power) count++;
  }
  return count;
}

/**
 * Get the active ruler object for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {Object} Ruler object with { id, name, battle, command, admin, cardBonus }
 */
export function getActiveRuler(state, power) {
  const rulerId = state.rulers[power];
  const rulers = RULERS[power];
  return rulers.find(r => r.id === rulerId) || rulers[0];
}

/**
 * Get the number of cards a power should draw.
 * Non-Protestant: from KEY_VP_TRACK based on key count + ruler cardBonus.
 * Protestant: fixed 4 or 5 based on electorate control.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function getCardDrawCount(state, power) {
  const ruler = getActiveRuler(state, power);

  if (power === 'protestant') {
    const electorates = countElectoratesForPower(state, 'protestant');
    const base = electorates >= PROTESTANT_CARD_DRAW.electorateThreshold
      ? PROTESTANT_CARD_DRAW.withElectorates
      : PROTESTANT_CARD_DRAW.base;
    return base + ruler.cardBonus;
  }

  const track = KEY_VP_TRACK[power];
  if (!track) return 1;

  const keys = countKeysForPower(state, power);
  const clampedKeys = Math.min(keys, track.cards.length - 1);
  const baseCards = Math.max(track.cards[clampedKeys], 1);
  return baseCards + ruler.cardBonus;
}

/**
 * Get VP from key control for a power.
 * @param {Object} state
 * @param {string} power
 * @returns {number}
 */
export function getKeyVp(state, power) {
  if (power === 'protestant') return 0; // Protestant VP from spaces track, not keys
  const track = KEY_VP_TRACK[power];
  if (!track) return 0;
  const keys = countKeysForPower(state, power);
  const clamped = Math.min(keys, track.vp.length - 1);
  return track.vp[clamped];
}

/**
 * Check whether a power can pass in the action phase.
 * Cannot pass if: home card in hand, mandatory event in hand, or hand size > admin rating.
 * @param {Object} state
 * @param {string} power
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canPass(state, power) {
  const hand = state.hands[power];
  if (!hand) return { allowed: true };

  // Check home cards
  for (const cardNum of hand) {
    const card = CARD_BY_NUMBER[cardNum];
    if (!card) continue;
    if (card.deck === 'home') {
      return { allowed: false, reason: 'Must play home card before passing' };
    }
  }

  // Check mandatory events
  for (const cardNum of hand) {
    const card = CARD_BY_NUMBER[cardNum];
    if (!card) continue;
    if (card.category === 'MANDATORY') {
      return { allowed: false, reason: 'Must play mandatory event before passing' };
    }
  }

  // Check hand size vs admin rating
  const ruler = getActiveRuler(state, power);
  if (hand.length > ruler.admin) {
    return {
      allowed: false,
      reason: `Hand size (${hand.length}) exceeds admin rating (${ruler.admin})`
    };
  }

  return { allowed: true };
}

/**
 * Get the next power in impulse order after the current one.
 * @param {Object} state
 * @returns {string} Next power
 */
export function getNextImpulsePower(state) {
  const nextIndex = (state.impulseIndex + 1) % IMPULSE_ORDER.length;
  return IMPULSE_ORDER[nextIndex];
}

/**
 * Check if a card number is in any tracked location (deck, hands, discard, removed).
 * @param {Object} state
 * @param {number} cardNumber
 * @returns {boolean}
 */
export function isCardInPlay(state, cardNumber) {
  if (state.deck.includes(cardNumber)) return true;
  if (state.discard.includes(cardNumber)) return true;
  if (state.removedCards.includes(cardNumber)) return true;
  for (const power of MAJOR_POWERS) {
    if (state.hands[power].includes(cardNumber)) return true;
  }
  return false;
}

// ── Phase 2: Map & Adjacency Helpers ──────────────────────────────

/**
 * Get adjacent spaces for a given space.
 * @param {string} spaceName
 * @returns {{ connections: string[], passes: string[] }}
 */
export function getAdjacentSpaces(spaceName) {
  return LAND_ADJACENCY[spaceName] || { connections: [], passes: [] };
}

/**
 * Get all adjacent space names (both connections and passes).
 * @param {string} spaceName
 * @returns {string[]}
 */
export function getAllAdjacentSpaces(spaceName) {
  const adj = getAdjacentSpaces(spaceName);
  return [...adj.connections, ...adj.passes];
}

/**
 * Check if two spaces are adjacent (connection or pass).
 * @param {string} a
 * @param {string} b
 * @returns {'connection'|'pass'|null}
 */
export function getConnectionType(a, b) {
  const adj = getAdjacentSpaces(a);
  if (adj.connections.includes(b)) return 'connection';
  if (adj.passes.includes(b)) return 'pass';
  return null;
}

// ── Phase 2: Unit Helpers ─────────────────────────────────────────

/**
 * Get unit stack for a power in a space.
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {Object|null} Unit stack or null
 */
export function getUnitsInSpace(state, spaceName, power) {
  const space = state.spaces[spaceName];
  if (!space) return null;
  return space.units.find(u => u.owner === power) || null;
}

/**
 * Check if a space has enemy units (units not belonging to the power).
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
export function hasEnemyUnits(state, spaceName, power) {
  const space = state.spaces[spaceName];
  if (!space) return false;
  return space.units.some(u => u.owner !== power && u.owner !== 'independent');
}

/**
 * Calculate the formation cap based on leaders present.
 * No leader: max 4. One leader: command rating. 2+: sum of top 2.
 * @param {string[]} leaderIds
 * @returns {number}
 */
export function getFormationCap(leaderIds) {
  if (!leaderIds || leaderIds.length === 0) {
    return FORMATION.noLeaderMax;
  }
  const commands = leaderIds
    .map(id => ARMY_LEADERS.find(l => l.id === id))
    .filter(l => l)
    .map(l => l.command)
    .sort((a, b) => b - a);
  if (commands.length === 0) return FORMATION.noLeaderMax;
  if (commands.length === 1) return commands[0];
  return commands[0] + commands[1];
}

/**
 * Count total land units in a stack.
 * @param {Object} unitStack - { regulars, mercenaries, cavalry }
 * @returns {number}
 */
export function countLandUnits(unitStack) {
  if (!unitStack) return 0;
  return (unitStack.regulars || 0) +
    (unitStack.mercenaries || 0) +
    (unitStack.cavalry || 0);
}

/**
 * Check if a space is a home space for a power.
 * @param {string} spaceName
 * @param {string} power
 * @returns {boolean}
 */
export function isHomeSpace(spaceName, power) {
  const mapSpace = SPACE_BY_NAME[spaceName];
  return mapSpace ? mapSpace.controller === power : false;
}

// ── Phase 2: Reformation Helpers ──────────────────────────────────

/**
 * Count adjacent spaces matching a religion (connections only, not passes).
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} religion
 * @returns {number}
 */
export function countAdjacentByReligion(state, spaceName, religion) {
  const adj = getAdjacentSpaces(spaceName);
  let count = 0;
  for (const name of adj.connections) {
    const sp = state.spaces[name];
    if (sp && sp.religion === religion) count++;
  }
  return count;
}

/**
 * Count adjacent stacks of a power's units (connections only).
 * @param {Object} state
 * @param {string} spaceName
 * @param {string} power
 * @returns {number}
 */
export function countAdjacentPowerStacks(state, spaceName, power) {
  const adj = getAdjacentSpaces(spaceName);
  let count = 0;
  for (const name of adj.connections) {
    if (getUnitsInSpace(state, name, power)) count++;
  }
  return count;
}

/**
 * Check if a space is a valid Reformation target.
 * Must be Catholic and either: adjacent to a Protestant space,
 * contains a reformer (future), or port-linked to Protestant port.
 * @param {Object} state
 * @param {string} spaceName
 * @returns {boolean}
 */
export function isValidReformationTarget(state, spaceName) {
  const space = state.spaces[spaceName];
  if (!space || space.religion !== RELIGION.CATHOLIC) return false;

  // Adjacent to a Protestant space (connections + passes)
  const allAdj = getAllAdjacentSpaces(spaceName);
  for (const name of allAdj) {
    const adj = state.spaces[name];
    if (adj && adj.religion === RELIGION.PROTESTANT) return true;
  }

  // TODO: Contains a reformer (Phase 7+)

  // Port-linked to a Protestant port
  if (space.isPort && space.connectedSeaZones) {
    for (const sz of space.connectedSeaZones) {
      const ports = PORTS_BY_SEA_ZONE[sz] || [];
      for (const portName of ports) {
        if (portName === spaceName) continue;
        const portSpace = state.spaces[portName];
        if (portSpace && portSpace.religion === RELIGION.PROTESTANT) return true;
      }
    }
  }

  return false;
}

/**
 * Check if a space is a valid Counter-Reformation target.
 * Must be Protestant and either: adjacent to a Catholic space,
 * contains a Jesuit university, or port-linked to Catholic port.
 * @param {Object} state
 * @param {string} spaceName
 * @returns {boolean}
 */
export function isValidCounterReformTarget(state, spaceName) {
  const space = state.spaces[spaceName];
  if (!space || space.religion !== RELIGION.PROTESTANT) return false;

  // Contains a Jesuit university
  if (state.jesuitUniversities.includes(spaceName)) return true;

  // Adjacent to a Catholic space (connections + passes)
  const allAdj = getAllAdjacentSpaces(spaceName);
  for (const name of allAdj) {
    const adj = state.spaces[name];
    if (adj && adj.religion === RELIGION.CATHOLIC) return true;
  }

  // Port-linked to a Catholic port
  if (space.isPort && space.connectedSeaZones) {
    for (const sz of space.connectedSeaZones) {
      const ports = PORTS_BY_SEA_ZONE[sz] || [];
      for (const portName of ports) {
        if (portName === spaceName) continue;
        const portSpace = state.spaces[portName];
        if (portSpace && portSpace.religion === RELIGION.CATHOLIC) return true;
      }
    }
  }

  return false;
}

/**
 * Calculate Reformation dice for an attempt.
 * Protestant attacking: adjacency + presence bonuses.
 * @param {Object} state
 * @param {string} targetSpace
 * @returns {{ protestant: number, papal: number }}
 */
export function calcReformationDice(state, targetSpace) {
  let protestant = 0;
  let papal = 0;
  const adj = getAdjacentSpaces(targetSpace);
  const target = state.spaces[targetSpace];

  // Protestant dice — connections only (not passes)
  for (const name of adj.connections) {
    const sp = state.spaces[name];
    if (!sp) continue;
    if (sp.religion === RELIGION.PROTESTANT) protestant++;
    if (getUnitsInSpace(state, name, 'protestant')) protestant++;
  }

  // Reformer bonuses (adjacent + in target)
  const reformerBonus = getReformerDiceBonus(state, targetSpace);
  protestant += reformerBonus.total;

  // Protestant stack in target
  if (getUnitsInSpace(state, targetSpace, 'protestant')) protestant += 2;

  // Printing press bonus
  if (state.printingPressActive) protestant++;

  // Papal dice — connections only
  for (const name of adj.connections) {
    const sp = state.spaces[name];
    if (!sp) continue;
    if (sp.religion === RELIGION.CATHOLIC) papal++;
    // Adjacent Jesuit university
    if (state.jesuitUniversities.includes(name)) papal++;
    // Adjacent Catholic stack (papacy or any Catholic power with units)
    if (getUnitsInSpace(state, name, 'papacy')) papal++;
  }

  // Jesuit university in target
  if (state.jesuitUniversities.includes(targetSpace)) papal += 2;
  // Catholic stack in target
  if (getUnitsInSpace(state, targetSpace, 'papacy')) papal += 2;

  return { protestant: Math.max(1, protestant), papal: Math.max(1, papal) };
}

/**
 * Calculate Counter-Reformation dice.
 * Papal attacking: adjacency + Jesuit bonuses.
 * @param {Object} state
 * @param {string} targetSpace
 * @returns {{ papal: number, protestant: number }}
 */
export function calcCounterReformationDice(state, targetSpace) {
  let papal = 0;
  let protestant = 0;
  const adj = getAdjacentSpaces(targetSpace);

  // Papal dice — connections only
  for (const name of adj.connections) {
    const sp = state.spaces[name];
    if (!sp) continue;
    if (sp.religion === RELIGION.CATHOLIC) papal++;
    if (state.jesuitUniversities.includes(name)) papal++;
    if (getUnitsInSpace(state, name, 'papacy')) papal++;
  }
  if (state.jesuitUniversities.includes(targetSpace)) papal += 2;
  if (getUnitsInSpace(state, targetSpace, 'papacy')) papal += 2;

  // Protestant defense dice — connections only
  for (const name of adj.connections) {
    const sp = state.spaces[name];
    if (!sp) continue;
    if (sp.religion === RELIGION.PROTESTANT) protestant++;
    if (getUnitsInSpace(state, name, 'protestant')) protestant++;
  }

  // Reformer bonuses for defense (adjacent + in target)
  const reformerBonus = getReformerDiceBonus(state, targetSpace);
  protestant += reformerBonus.total;

  if (getUnitsInSpace(state, targetSpace, 'protestant')) protestant += 2;

  return { papal: Math.max(1, papal), protestant: Math.max(1, protestant) };
}

// ── Phase 2: Debater Helpers ──────────────────────────────────────

/**
 * Get available debaters for a faction.
 * @param {Object} state
 * @param {'papal'|'protestant'} side
 * @param {string} [zone] - Language zone filter (for Protestant)
 * @param {boolean} [committedOnly] - Only committed debaters
 * @returns {Array<{ id: string, committed: boolean }>}
 */
export function getAvailableDebaters(state, side, zone, committedOnly) {
  const debaters = state.debaters[side] || [];
  return debaters.filter(d => {
    const def = DEBATERS.find(dd => dd.id === d.id);
    if (!def) return false;
    // Entry turn check
    if (def.entryTurn > state.turn) return false;
    // Conditional debaters (Cranmer, Coverdale, Latimer) require Edward/Elizabeth born
    if (def.conditional && !(state.edwardBorn || state.elizabethBorn)) return false;
    // Zone filter (Protestant debaters are zone-specific)
    if (zone && side === 'protestant' && def.zone !== zone) return false;
    // Committed filter
    if (committedOnly !== undefined) {
      if (committedOnly && !d.committed) return false;
      if (!committedOnly && d.committed) return false;
    }
    return true;
  });
}

/**
 * Get debater definition by ID.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getDebaterDef(id) {
  return DEBATERS.find(d => d.id === id);
}

/**
 * Update the Protestant spaces count by scanning all spaces.
 * @param {Object} state
 */
export function recountProtestantSpaces(state) {
  let count = 0;
  for (const sp of Object.values(state.spaces)) {
    if (sp.religion === RELIGION.PROTESTANT) count++;
  }
  state.protestantSpaces = count;
}

// ── Winter Phase Helpers ──────────────────────────────────────────

/**
 * BFS to find a friendly path between two land spaces.
 * All intermediate spaces must be friendly-controlled and unrest-free.
 * (Enemy units are ignored per Winter rules.)
 * @param {Object} state
 * @param {string} from
 * @param {string} to
 * @param {string} power
 * @param {string[]} [alliedPowers] - Powers treated as friendly
 * @returns {string[]|null} Path array (including from & to), or null
 */
export function findFriendlyPath(state, from, to, power, alliedPowers = []) {
  if (from === to) return [from];
  const friendly = new Set([power, ...alliedPowers]);

  const visited = new Set([from]);
  const queue = [[from]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];
    const neighbors = getAllAdjacentSpaces(current);

    for (const next of neighbors) {
      if (visited.has(next)) continue;
      visited.add(next);

      if (next === to) return [...path, next];

      // Intermediate spaces must be friendly-controlled and unrest-free
      const sp = state.spaces[next];
      if (!sp) continue;
      if (!friendly.has(sp.controller)) continue;
      if (sp.unrest) continue;

      queue.push([...path, next]);
    }
  }
  return null;
}

/**
 * Find the nearest fortified space controlled by the given power.
 * @param {Object} state
 * @param {string} from
 * @param {string} power
 * @param {string[]} [alliedPowers]
 * @returns {string|null}
 */
export function findNearestFortifiedSpace(state, from, power, alliedPowers = []) {
  const friendly = new Set([power, ...alliedPowers]);
  const visited = new Set([from]);
  const queue = [from];

  // Check 'from' itself
  const fromSp = state.spaces[from];
  if (fromSp && fromSp.isFortress && friendly.has(fromSp.controller)) {
    return from;
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = getAllAdjacentSpaces(current);

    for (const next of neighbors) {
      if (visited.has(next)) continue;
      visited.add(next);

      const sp = state.spaces[next];
      if (!sp) continue;

      if (sp.isFortress && friendly.has(sp.controller) && !sp.unrest) {
        return next;
      }

      // Can traverse friendly spaces
      if (friendly.has(sp.controller) && !sp.unrest) {
        queue.push(next);
      }
    }
  }
  return null;
}
