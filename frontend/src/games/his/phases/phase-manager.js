/**
 * Here I Stand — Phase Manager
 *
 * Controls the phase state machine: which phases run per turn,
 * transitions between phases, and turn advancement.
 */

import { IMPULSE_ORDER, MAJOR_POWERS, VICTORY } from '../constants.js';
import { executeCardDraw } from './phase-card-draw.js';
import { initDiplomacyPhase } from './phase-diplomacy.js';
import { initSpringDeployment } from './phase-spring-deployment.js';
import { initLuther95 } from './phase-luther95.js';
import { initDietOfWorms } from './phase-diet-of-worms.js';
import { resolveNewWorld } from './phase-new-world.js';
import { executeWinter } from './phase-winter.js';
import { checkImmediateVictory } from '../state/victory-checks.js';
import { LEADER_BY_ID } from '../data/leaders.js';
import { isHomeSpace } from '../state/state-helpers.js';

// ── Phase Constants ────────────────────────────────────────────────

export const PHASES = {
  LUTHER_95: 'luther_95',
  CARD_DRAW: 'card_draw',
  DIPLOMACY: 'diplomacy',
  DIET_OF_WORMS: 'diet_of_worms',
  SPRING_DEPLOYMENT: 'spring_deployment',
  ACTION: 'action',
  WINTER: 'winter',
  NEW_WORLD: 'new_world',
  VICTORY_DETERMINATION: 'victory_determination'
};

const PHASE_ORDER_TURN_1 = [
  PHASES.LUTHER_95,
  PHASES.CARD_DRAW,
  PHASES.DIPLOMACY,
  PHASES.DIET_OF_WORMS,
  PHASES.SPRING_DEPLOYMENT,
  PHASES.ACTION,
  PHASES.WINTER,
  PHASES.NEW_WORLD,
  PHASES.VICTORY_DETERMINATION
];

const PHASE_ORDER_NORMAL = [
  PHASES.CARD_DRAW,
  PHASES.DIPLOMACY,
  PHASES.SPRING_DEPLOYMENT,
  PHASES.ACTION,
  PHASES.WINTER,
  PHASES.NEW_WORLD,
  PHASES.VICTORY_DETERMINATION
];

/**
 * Get the ordered list of phases for a given turn.
 * @param {number} turn
 * @returns {string[]}
 */
export function getPhaseOrder(turn) {
  return turn === 1 ? PHASE_ORDER_TURN_1 : PHASE_ORDER_NORMAL;
}

/**
 * Get the next phase after the current one. Returns null if at end of turn.
 * @param {Object} state
 * @returns {string|null}
 */
export function getNextPhase(state) {
  const order = getPhaseOrder(state.turn);
  const idx = order.indexOf(state.phase);
  if (idx >= 0 && idx < order.length - 1) {
    return order[idx + 1];
  }
  return null; // End of turn
}

/**
 * Transition the game state to a new phase.
 * Runs phase-entry setup for phases that need it.
 * @param {Object} state - Game state (mutated)
 * @param {string} toPhase - Target phase
 * @param {Object} helpers - Phase helper functions
 */
export function transitionPhase(state, toPhase, helpers) {
  state.phase = toPhase;
  helpers.logEvent(state, 'phase_change', { phase: toPhase, turn: state.turn });

  switch (toPhase) {
    case PHASES.CARD_DRAW:
      executeCardDraw(state, helpers);
      break;

    case PHASES.ACTION:
      state.impulseIndex = 0;
      state.consecutivePasses = 0;
      state.activePower = IMPULSE_ORDER[0];
      break;

    case PHASES.WINTER:
      executeWinter(state, helpers);
      break;

    case PHASES.DIPLOMACY:
      initDiplomacyPhase(state, helpers);
      break;

    case PHASES.SPRING_DEPLOYMENT:
      initSpringDeployment(state, helpers);
      break;

    case PHASES.LUTHER_95:
      initLuther95(state, helpers);
      break;

    case PHASES.DIET_OF_WORMS:
      initDietOfWorms(state, helpers);
      break;

    case PHASES.NEW_WORLD:
      resolveNewWorld(state, helpers);
      break;

    case PHASES.VICTORY_DETERMINATION:
      resolveVictoryDetermination(state, helpers);
      break;

    default:
      break;
  }
}

/**
 * Advance to the next phase, or to the next turn if at end of turn.
 * @param {Object} state
 * @param {Object} helpers
 */
export function advancePhase(state, helpers) {
  if (state.status === 'ended') return;

  const next = getNextPhase(state);

  if (next) {
    transitionPhase(state, next, helpers);
  } else {
    // End of turn — advance to next turn
    advanceTurn(state, helpers);
  }
}

function ensureTurnTrack(state) {
  state.turnTrack = state.turnTrack || {};
  if (!Array.isArray(state.turnTrack.navalLeaders)) state.turnTrack.navalLeaders = [];
  if (!Array.isArray(state.turnTrack.navalUnits)) state.turnTrack.navalUnits = [];
  return state.turnTrack;
}

function ensurePowerStack(state, spaceName, power) {
  const sp = state.spaces[spaceName];
  if (!sp) return null;
  let stack = (sp.units || []).find(u => u.owner === power);
  if (!stack) {
    stack = {
      owner: power, regulars: 0, mercenaries: 0,
      cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
    };
    sp.units = sp.units || [];
    sp.units.push(stack);
  }
  return stack;
}

function isLeaderOnMap(state, leaderId) {
  for (const sp of Object.values(state.spaces)) {
    for (const stack of sp.units || []) {
      if ((stack.leaders || []).includes(leaderId)) return true;
    }
  }
  return false;
}

function getControlledPorts(state, power, homeOnly) {
  const ports = [];
  for (const [spaceName, sp] of Object.entries(state.spaces)) {
    if (!sp?.isPort) continue;
    if (sp.controller !== power) continue;
    if (homeOnly && !isHomeSpace(spaceName, power)) continue;
    ports.push(spaceName);
  }
  ports.sort();
  return ports;
}

function chooseNavalLeaderReturnPort(state, power, preferredSpace) {
  const preferred = state.spaces[preferredSpace];
  if (preferred?.isPort && preferred.controller === power) return preferredSpace;

  const controlledHomePorts = getControlledPorts(state, power, true);
  if (controlledHomePorts.length > 0) return controlledHomePorts[0];

  const controlledPorts = getControlledPorts(state, power, false);
  if (controlledPorts.length > 0) return controlledPorts[0];

  return null;
}

function resolveTurnTrack(state, helpers) {
  const turnTrack = ensureTurnTrack(state);

  const leaderRemaining = [];
  for (const entry of turnTrack.navalLeaders) {
    const dueTurn = entry?.returnTurn ?? Number.POSITIVE_INFINITY;
    if (dueTurn > state.turn) {
      leaderRemaining.push(entry);
      continue;
    }

    const leaderId = entry?.leaderId;
    const leader = LEADER_BY_ID[leaderId];
    const power = entry?.power || leader?.faction;
    if (!leaderId || leader?.type !== 'naval' || !power) {
      continue;
    }

    if (isLeaderOnMap(state, leaderId)) {
      continue;
    }

    const destination = chooseNavalLeaderReturnPort(state, power, entry.space);
    if (!destination) {
      leaderRemaining.push({ ...entry, returnTurn: state.turn + 1 });
      helpers.logEvent(state, 'turn_track_naval_leader_delayed', {
        power, leaderId, reason: 'no_controlled_port', turn: state.turn
      });
      continue;
    }

    const stack = ensurePowerStack(state, destination, power);
    if (!stack) {
      leaderRemaining.push({ ...entry, returnTurn: state.turn + 1 });
      continue;
    }
    if (!stack.leaders.includes(leaderId)) {
      stack.leaders.push(leaderId);
    }

    helpers.logEvent(state, 'turn_track_naval_leader_return', {
      power, leaderId, to: destination, turn: state.turn
    });
  }
  turnTrack.navalLeaders = leaderRemaining;

  const released = {};
  const unitRemaining = [];
  for (const entry of turnTrack.navalUnits) {
    const dueTurn = entry?.returnTurn ?? Number.POSITIVE_INFINITY;
    if (dueTurn > state.turn) {
      unitRemaining.push(entry);
      continue;
    }

    const power = entry?.power;
    const type = entry?.type;
    const count = Math.max(0, entry?.count || 0);
    if (!power || count <= 0 || (type !== 'squadron' && type !== 'corsair')) {
      continue;
    }

    if (!released[power]) released[power] = { squadron: 0, corsair: 0 };
    released[power][type] += count;
  }
  turnTrack.navalUnits = unitRemaining;

  if (Object.keys(released).length > 0) {
    helpers.logEvent(state, 'turn_track_naval_units_released', {
      turn: state.turn,
      released
    });
  }
}

/**
 * Resolve the Victory Determination phase.
 * Checks immediate victories, VP standard/domination wins, and time limit.
 * Sets state.status = 'ended' if someone wins.
 * @param {Object} state
 * @param {Object} helpers
 */
function resolveVictoryDetermination(state, helpers) {
  // 1. Check immediate victories (military auto-win, religious victory)
  const immediate = checkImmediateVictory(state);
  if (immediate.victory) {
    state.status = 'ended';
    state.winner = immediate.winner;
    state.winReason = immediate.type;
    helpers.logEvent(state, 'game_end', {
      winner: immediate.winner, reason: immediate.type
    });
    return;
  }

  // 2. Calculate VP totals
  const vpTotals = {};
  for (const power of MAJOR_POWERS) {
    vpTotals[power] = (state.vp[power] || 0) + (state.bonusVp?.[power] || 0);
  }
  const sorted = Object.entries(vpTotals).sort((a, b) => b[1] - a[1]);
  const [topPower, topVp] = sorted[0];

  // 3. Standard victory: 25+ VP
  if (topVp >= VICTORY.standardVp) {
    state.status = 'ended';
    state.winner = topPower;
    state.winReason = 'standard_victory';
    helpers.logEvent(state, 'game_end', {
      winner: topPower, reason: 'standard_victory', vp: topVp
    });
    return;
  }

  // 4. Domination victory: Turn 4+, gap >= 5
  if (state.turn >= VICTORY.dominationMinTurn) {
    const [, secondVp] = sorted[1];
    if (topVp - secondVp >= VICTORY.dominationGap) {
      state.status = 'ended';
      state.winner = topPower;
      state.winReason = 'domination_victory';
      helpers.logEvent(state, 'game_end', {
        winner: topPower, reason: 'domination_victory', vp: topVp, gap: topVp - secondVp
      });
      return;
    }
  }

  // 5. Time limit: after turn 9
  if (state.turn >= VICTORY.maxTurns) {
    state.status = 'ended';
    state.winner = topPower;
    state.winReason = 'time_limit';
    helpers.logEvent(state, 'game_end', {
      winner: topPower, reason: 'time_limit', vp: topVp
    });
    return;
  }

  helpers.logEvent(state, 'victory_determination_pass', {
    turn: state.turn, vpTotals
  });
}

/**
 * Advance to the next turn.
 * @param {Object} state
 * @param {Object} helpers
 */
function advanceTurn(state, helpers) {
  if (state.status === 'ended') return;

  state.turn++;
  helpers.logEvent(state, 'turn_advance', { turn: state.turn });

  if (state.turn > VICTORY.maxTurns) {
    // Game over after turn 9
    state.status = 'ended';
    return;
  }

  resolveTurnTrack(state, helpers);

  // Start new turn with card draw
  transitionPhase(state, PHASES.CARD_DRAW, helpers);
}

/**
 * Advance the impulse to the next power in order.
 * @param {Object} state
 */
export function advanceImpulse(state) {
  state.impulseIndex = (state.impulseIndex + 1) % IMPULSE_ORDER.length;
  state.activePower = IMPULSE_ORDER[state.impulseIndex];
}
