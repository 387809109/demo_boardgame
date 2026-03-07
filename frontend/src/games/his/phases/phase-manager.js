/**
 * Here I Stand — Phase Manager
 *
 * Controls the phase state machine: which phases run per turn,
 * transitions between phases, and turn advancement.
 */

import { IMPULSE_ORDER, VICTORY, CAPITALS } from '../constants.js';
import { executeCardDraw } from './phase-card-draw.js';
import { initDiplomacyPhase } from './phase-diplomacy.js';
import { initSpringDeployment } from './phase-spring-deployment.js';
import { executeLuther95 } from './phase-luther95.js';
import { initDietOfWorms } from './phase-diet-of-worms.js';
import { resolveNewWorld } from './phase-new-world.js';
import { getUnitsInSpace } from '../state/state-helpers.js';

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
      executeLuther95(state, helpers);
      break;

    case PHASES.DIET_OF_WORMS:
      initDietOfWorms(state, helpers);
      break;

    case PHASES.NEW_WORLD:
      resolveNewWorld(state, helpers);
      break;

    case PHASES.VICTORY_DETERMINATION:
      // VP check happens in checkGameEnd, not here
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
  const next = getNextPhase(state);

  if (next) {
    transitionPhase(state, next, helpers);
  } else {
    // End of turn — advance to next turn
    advanceTurn(state, helpers);
  }
}

/**
 * Advance to the next turn.
 * @param {Object} state
 * @param {Object} helpers
 */
function advanceTurn(state, helpers) {
  state.turn++;
  helpers.logEvent(state, 'turn_advance', { turn: state.turn });

  if (state.turn > VICTORY.maxTurns) {
    // Game over after turn 9
    state.status = 'ended';
    return;
  }

  // Start new turn with card draw
  transitionPhase(state, PHASES.CARD_DRAW, helpers);
}

/**
 * Winter phase — resets per-turn state, removes alliances,
 * adds 1 regular to each power's friendly-controlled capital.
 */
function executeWinter(state, helpers) {
  // Reset augsburg confession marker
  state.augsburgConfessionActive = false;

  // Reset all debaters to uncommitted
  for (const side of ['papal', 'protestant']) {
    if (state.debaters[side]) {
      for (const d of state.debaters[side]) {
        d.committed = false;
      }
    }
  }

  // Clear any leftover pending interactions
  state.pendingReformation = null;
  state.pendingDebate = null;
  state.pendingBattle = null;
  state.pendingInterception = null;
  state.cpRemaining = 0;
  state.activeCardNumber = null;
  state.impulseActions = [];

  // Reset per-turn combat tracking
  state.piracyUsed = {};

  // Remove all alliances (alliances last one turn)
  state.alliances = [];

  // Reset diplomacy per-turn tracking
  state.peaceMadeThisTurn = [];
  state.alliancesFormedThisTurn = [];
  state.diplomacySegment = null;
  state.diplomacyActed = {};
  state.springDeploymentDone = {};

  // Add 1 regular to each power's friendly-controlled, non-besieged capital
  for (const [power, caps] of Object.entries(CAPITALS)) {
    for (const cap of caps) {
      const sp = state.spaces[cap];
      if (!sp) continue;
      if (sp.controller !== power) continue;
      if (sp.besieged) continue;
      if (sp.unrest) continue;

      let stack = null;
      for (const u of sp.units) {
        if (u.owner === power) { stack = u; break; }
      }
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

  helpers.logEvent(state, 'winter', { turn: state.turn });
}

/**
 * Advance the impulse to the next power in order.
 * @param {Object} state
 */
export function advanceImpulse(state) {
  state.impulseIndex = (state.impulseIndex + 1) % IMPULSE_ORDER.length;
  state.activePower = IMPULSE_ORDER[state.impulseIndex];
}
