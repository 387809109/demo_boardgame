/**
 * Here I Stand — Winter Phase
 *
 * Complete Winter phase implementation (§19).
 * 9 ordered sub-steps:
 *  1. Remove loan markers
 *  2. Remove renegade leader
 *  3. Return naval units to nearest friendly port
 *  4. Return land units to friendly fortified spaces (with attrition)
 *  5. Remove alliance markers
 *  6. Add replacements (+1 regular to friendly capitals)
 *  7. Remove piracy markers
 *  8. Uncommit debaters, clear pending state
 *  9. Trigger overdue mandatory events
 */

import { CAPITALS, MAJOR_POWERS } from '../constants.js';
import { CARD_BY_NUMBER } from '../data/cards.js';
import { PORTS_BY_SEA_ZONE, SEA_EDGES, SEA_ZONES } from '../data/map-data.js';
import { findNearestFortifiedSpace } from '../state/state-helpers.js';
import { LEADER_BY_ID } from '../data/leaders.js';

const SEA_ADJACENCY = (() => {
  const adj = {};
  for (const zone of SEA_ZONES) adj[zone] = [];
  for (const { a, b } of SEA_EDGES) {
    if (adj[a]) adj[a].push(b);
    if (adj[b]) adj[b].push(a);
  }
  return adj;
})();

/**
 * Execute the full Winter phase.
 * @param {Object} state
 * @param {Object} helpers
 */
export function executeWinter(state, helpers) {
  // Step 1: Remove loan markers
  removeLoanMarkers(state, helpers);

  // Step 2: Remove renegade leader
  removeRenegadeLeader(state, helpers);

  // Step 3: Return naval units to nearest friendly port
  returnNavalUnits(state, helpers);

  // Step 4: Return land units to fortified spaces (with attrition)
  returnLandUnits(state, helpers);

  // Step 5: Remove alliances (alliances last one turn)
  state.alliances = [];

  // Step 6: Add replacements
  addReplacements(state, helpers);

  // Step 7: Remove piracy markers
  state.piracyUsed = {};

  // Step 8: Uncommit debaters, clear pending state
  resetTurnState(state);

  // Step 9: Trigger overdue mandatory events
  triggerOverdueMandatoryEvents(state, helpers);

  // Return excommunicated reformers
  if (state.excommunicatedReformers.length > 0) {
    helpers.logEvent(state, 'reformers_returned', {
      reformers: [...state.excommunicatedReformers]
    });
    state.excommunicatedReformers = [];
  }

  helpers.logEvent(state, 'winter', { turn: state.turn });
}

// ── Step 1: Loan markers ────────────────────────────────────────────

function removeLoanMarkers(state, helpers) {
  if (!state.loanedSquadrons || state.loanedSquadrons.length === 0) return;

  // Return loaned squadrons to their lenders
  for (const loan of state.loanedSquadrons) {
    const { lender, borrower, port, count } = loan;
    const sp = state.spaces[port];
    if (!sp) continue;

    const borrowerStack = sp.units.find(u => u.owner === borrower);
    if (borrowerStack) {
      const toReturn = Math.min(borrowerStack.squadrons, count);
      borrowerStack.squadrons -= toReturn;

      let lenderStack = sp.units.find(u => u.owner === lender);
      if (!lenderStack) {
        lenderStack = {
          owner: lender, regulars: 0, mercenaries: 0,
          cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
        };
        sp.units.push(lenderStack);
      }
      lenderStack.squadrons += toReturn;
    }
  }

  helpers.logEvent(state, 'loans_returned', {
    count: state.loanedSquadrons.length
  });
  state.loanedSquadrons = [];
}

// ── Step 2: Renegade leader ─────────────────────────────────────────

function removeRenegadeLeader(state, helpers) {
  // Remove renegade leader from map if present
  for (const sp of Object.values(state.spaces)) {
    for (const stack of sp.units) {
      const idx = stack.leaders.indexOf('renegade');
      if (idx !== -1) {
        stack.leaders.splice(idx, 1);
        helpers.logEvent(state, 'renegade_removed', {});
        return;
      }
    }
  }
}

// ── Step 3: Return naval units ──────────────────────────────────────

function returnNavalUnits(state, helpers) {
  const candidates = [];
  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    for (const stack of sp.units || []) {
      if (!hasNavalAssets(stack)) continue;
      if (sp.isPort && sp.controller === stack.owner) continue;
      candidates.push({ from: spaceName, stack });
    }
  }

  for (const { from, stack } of candidates) {
    if (!hasNavalAssets(stack)) continue;

    const destination = findNearestControlledPort(state, from, stack.owner);
    if (!destination) {
      const removed = removeNavalAssets(stack);
      if (removed > 0) {
        helpers.logEvent(state, 'winter_naval_eliminated', {
          from,
          owner: stack.owner,
          removed
        });
      }
      continue;
    }

    if (destination === from) continue;
    moveNavalAssets(state, from, destination, stack);
    helpers.logEvent(state, 'winter_naval_return', {
      from,
      to: destination,
      owner: stack.owner
    });
  }
}

function hasNavalAssets(stack) {
  if ((stack.squadrons || 0) > 0 || (stack.corsairs || 0) > 0) return true;
  return (stack.leaders || []).some(lid => LEADER_BY_ID[lid]?.type === 'naval');
}

function isSeaZone(spaceName) {
  return SEA_ZONES.includes(spaceName);
}

function getConnectedSeaZonesForPort(state, portName) {
  const zones = new Set(state.spaces[portName]?.connectedSeaZones || []);
  for (const [seaZone, ports] of Object.entries(PORTS_BY_SEA_ZONE)) {
    if (ports.includes(portName)) zones.add(seaZone);
  }
  return [...zones];
}

function getNavalNeighbors(state, node) {
  if (isSeaZone(node)) {
    return [...(SEA_ADJACENCY[node] || []), ...(PORTS_BY_SEA_ZONE[node] || [])];
  }
  if (state.spaces[node]?.isPort) {
    return getConnectedSeaZonesForPort(state, node);
  }
  return [];
}

function findNearestControlledPort(state, from, owner) {
  const startSpace = state.spaces[from];
  if (startSpace?.isPort && startSpace.controller === owner) return from;

  const visited = new Set([from]);
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of getNavalNeighbors(state, current)) {
      if (visited.has(next)) continue;
      visited.add(next);

      const nextSpace = state.spaces[next];
      if (nextSpace?.isPort && nextSpace.controller === owner) {
        return next;
      }
      queue.push(next);
    }
  }
  return null;
}

function ensureStackInPort(state, portName, owner) {
  const sp = state.spaces[portName];
  if (!sp) return null;
  let stack = sp.units.find(u => u.owner === owner);
  if (!stack) {
    stack = {
      owner, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    sp.units.push(stack);
  }
  return stack;
}

function moveNavalAssets(state, from, to, sourceStack) {
  const destStack = ensureStackInPort(state, to, sourceStack.owner);
  if (!destStack) return;

  destStack.squadrons += sourceStack.squadrons || 0;
  destStack.corsairs += sourceStack.corsairs || 0;
  sourceStack.squadrons = 0;
  sourceStack.corsairs = 0;

  const navalLeaders = (sourceStack.leaders || [])
    .filter(lid => LEADER_BY_ID[lid]?.type === 'naval');
  sourceStack.leaders = (sourceStack.leaders || [])
    .filter(lid => LEADER_BY_ID[lid]?.type !== 'naval');
  destStack.leaders.push(...navalLeaders);

  if (
    sourceStack.regulars === 0 &&
    sourceStack.mercenaries === 0 &&
    sourceStack.cavalry === 0 &&
    sourceStack.squadrons === 0 &&
    sourceStack.corsairs === 0 &&
    sourceStack.leaders.length === 0
  ) {
    const fromSpace = state.spaces[from];
    fromSpace.units = fromSpace.units.filter(u => u !== sourceStack);
  }
}

function removeNavalAssets(stack) {
  const removed = (stack.squadrons || 0) + (stack.corsairs || 0);
  stack.squadrons = 0;
  stack.corsairs = 0;
  stack.leaders = (stack.leaders || [])
    .filter(lid => LEADER_BY_ID[lid]?.type !== 'naval');
  return removed;
}

// ── Step 4: Return land units ───────────────────────────────────────

function returnLandUnits(state, helpers) {
  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    if (!sp.units || sp.units.length === 0) continue;

    // Units in fortified spaces they control can stay (up to limit)
    if (sp.isFortress && !sp.besieged) continue;

    // Units in unfortified spaces must return
    for (const stack of sp.units) {
      if (!MAJOR_POWERS.includes(stack.owner)) continue;
      const totalLand = stack.regulars + stack.mercenaries + stack.cavalry;
      if (totalLand === 0) continue;

      const power = stack.owner;
      const capitals = CAPITALS[power] || [];

      // Try to find nearest friendly fortified space
      const nearest = findNearestFortifiedSpace(
        state, spaceName, power,
        getAlliedPowers(state, power)
      );

      if (nearest && capitals.includes(nearest)) {
        // Return to capital — no attrition
        moveUnitsToSpace(state, spaceName, nearest, stack, helpers);
      } else if (nearest) {
        // Return to nearest fortress — no attrition if path is friendly
        moveUnitsToSpace(state, spaceName, nearest, stack, helpers);
      } else if (capitals.length > 0) {
        // No friendly fortified space — attrition: lose half (round up)
        const cap = capitals[0];
        const capSp = state.spaces[cap];
        if (capSp && capSp.controller === power) {
          applyAttrition(state, stack, helpers, spaceName);
          moveUnitsToSpace(state, spaceName, cap, stack, helpers);
        } else {
          // Capital enemy-controlled — units eliminated
          eliminateStack(state, stack, helpers, spaceName);
        }
      }
    }
  }
}

function getAlliedPowers(state, power) {
  const allies = [];
  for (const alliance of state.alliances) {
    if (alliance.a === power) allies.push(alliance.b);
    else if (alliance.b === power) allies.push(alliance.a);
  }
  return allies;
}

function applyAttrition(state, stack, helpers, spaceName) {
  const total = stack.regulars + stack.mercenaries + stack.cavalry;
  const losses = Math.ceil(total / 2);
  let remaining = losses;

  // Lose mercenaries first, then regulars, then cavalry
  const mercLoss = Math.min(remaining, stack.mercenaries);
  stack.mercenaries -= mercLoss;
  remaining -= mercLoss;

  const regLoss = Math.min(remaining, stack.regulars);
  stack.regulars -= regLoss;
  remaining -= regLoss;

  const cavLoss = Math.min(remaining, stack.cavalry);
  stack.cavalry -= cavLoss;

  helpers.logEvent(state, 'winter_attrition', {
    space: spaceName, owner: stack.owner, losses
  });
}

function eliminateStack(state, stack, helpers, spaceName) {
  helpers.logEvent(state, 'winter_eliminated', {
    space: spaceName, owner: stack.owner,
    regulars: stack.regulars, mercenaries: stack.mercenaries
  });
  stack.regulars = 0;
  stack.mercenaries = 0;
  stack.cavalry = 0;
  stack.leaders = [];
}

function moveUnitsToSpace(state, from, to, stack, helpers) {
  if (from === to) return;
  const toSp = state.spaces[to];
  if (!toSp) return;

  // Find or create destination stack
  let destStack = toSp.units.find(u => u.owner === stack.owner);
  if (!destStack) {
    destStack = {
      owner: stack.owner, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    toSp.units.push(destStack);
  }

  destStack.regulars += stack.regulars;
  destStack.mercenaries += stack.mercenaries;
  destStack.cavalry += stack.cavalry;
  destStack.leaders.push(...stack.leaders);

  stack.regulars = 0;
  stack.mercenaries = 0;
  stack.cavalry = 0;
  stack.leaders = [];
}

// ── Step 6: Add replacements ────────────────────────────────────────

function addReplacements(state, helpers) {
  for (const [power, caps] of Object.entries(CAPITALS)) {
    for (const cap of caps) {
      const sp = state.spaces[cap];
      if (!sp) continue;
      if (sp.controller !== power) continue;
      if (sp.besieged) continue;
      if (sp.unrest) continue;

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
  }
}

// ── Step 8: Reset turn state ────────────────────────────────────────

function resetTurnState(state) {
  // Reset augsburg confession marker
  state.augsburgConfessionActive = false;

  // Uncommit all debaters
  for (const side of ['papal', 'protestant']) {
    if (state.debaters[side]) {
      for (const d of state.debaters[side]) {
        d.committed = false;
      }
    }
  }

  // Clear pending interactions
  state.pendingReformation = null;
  state.pendingDebate = null;
  state.pendingBattle = null;
  state.pendingInterception = null;
  state.cpRemaining = 0;
  state.activeCardNumber = null;
  state.impulseActions = [];

  // Reset diplomacy per-turn tracking
  state.peaceMadeThisTurn = [];
  state.alliancesFormedThisTurn = [];
  state.diplomacySegment = null;
  state.diplomacyActed = {};
  state.springDeploymentDone = {};
}

// ── Step 9: Overdue mandatory events ────────────────────────────────

function triggerOverdueMandatoryEvents(state, helpers) {
  // Check all hands for mandatory events that are past due
  for (const power of MAJOR_POWERS) {
    const hand = state.hands[power];
    if (!hand) continue;

    for (let i = hand.length - 1; i >= 0; i--) {
      const cardNumber = hand[i];
      const card = CARD_BY_NUMBER[cardNumber];
      if (!card) continue;
      if (card.category !== 'MANDATORY') continue;
      if (!card.dueByTurn) continue;
      if (state.turn < card.dueByTurn) continue;
      if (state.mandatoryEventsPlayed.includes(cardNumber)) continue;

      // Card is overdue — trigger it
      helpers.logEvent(state, 'mandatory_event_overdue', {
        power, cardNumber, title: card.title, turn: state.turn
      });

      // Remove from hand
      hand.splice(i, 1);

      // Handle card disposal
      if (card.removeAfterPlay) {
        state.removedCards.push(cardNumber);
      } else {
        state.discard.push(cardNumber);
      }

      state.mandatoryEventsPlayed.push(cardNumber);

      // Event execution will be handled by event-actions.js
      // For now, just mark it as played
    }
  }
}
