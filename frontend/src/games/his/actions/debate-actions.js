/**
 * Here I Stand — Theological Debate Actions
 *
 * Call Debate, Resolve Debate Steps (attack roll, defense roll, resolve).
 */

import {
  ACTION_COSTS, DEBATE, RELIGION
} from '../constants.js';
import { spendCp } from './cp-manager.js';
import { rollDice } from './religious-actions.js';
import {
  getAvailableDebaters, getDebaterDef,
  isValidReformationTarget, isValidCounterReformTarget,
  recountProtestantSpaces
} from '../state/state-helpers.js';

// ── Call Debate ──────────────────────────────────────────────────

/**
 * Validate Call Debate action.
 */
export function validateCallDebate(state, power, actionData) {
  const { zone } = actionData;
  if (!zone) return { valid: false, error: 'Must specify language zone' };

  if (power !== 'papacy' && power !== 'protestant') {
    return { valid: false, error: 'Only Papacy or Protestant can call debate' };
  }

  const cost = ACTION_COSTS[power]?.call_debate;
  if (cost === null || cost === undefined) {
    return { valid: false, error: `${power} cannot call debate` };
  }
  if (state.cpRemaining < cost) {
    return { valid: false, error: `Not enough CP (need ${cost})` };
  }

  // Check attacker has available debaters in the zone
  const attackerSide = power === 'papacy' ? 'papal' : 'protestant';
  const available = getAvailableDebaters(state, attackerSide, zone);
  if (available.length === 0) {
    return { valid: false, error: 'No available debaters in this zone' };
  }

  // Check defender has available debaters
  const defenderSide = power === 'papacy' ? 'protestant' : 'papal';
  const defAvailable = getAvailableDebaters(state, defenderSide, zone);
  if (defAvailable.length === 0) {
    return { valid: false, error: 'Defender has no available debaters' };
  }

  return { valid: true };
}

/**
 * Execute Call Debate — selects debaters and sets up pending debate.
 */
export function callDebate(state, power, actionData, helpers) {
  const cost = ACTION_COSTS[power].call_debate;
  spendCp(state, cost);

  const { zone } = actionData;
  const attackerSide = power === 'papacy' ? 'papal' : 'protestant';
  const defenderSide = power === 'papacy' ? 'protestant' : 'papal';

  // Select highest-value available debater for each side
  const attackerDebaters = getAvailableDebaters(state, attackerSide, zone);
  const defenderDebaters = getAvailableDebaters(state, defenderSide, zone);

  const attacker = selectBestDebater(attackerDebaters);
  const defender = selectBestDebater(defenderDebaters);

  // Mark both as committed
  markCommitted(state, attackerSide, attacker.id);
  markCommitted(state, defenderSide, defender.id);

  state.pendingDebate = {
    zone,
    initiator: power,
    attackerSide,
    defenderSide,
    attackerId: attacker.id,
    defenderId: defender.id,
    round: 1,
    phase: 'roll', // 'roll' → 'resolve' → done or 'round2'
    attackerHits: 0,
    defenderHits: 0
  };

  state.impulseActions.push({ type: 'call_debate', zone });
  helpers.logEvent(state, 'call_debate', {
    power, zone,
    attacker: attacker.id,
    defender: defender.id
  });
}

// ── Resolve Debate Step ─────────────────────────────────────────

/**
 * Validate a debate resolution step.
 */
export function validateDebateStep(state) {
  if (!state.pendingDebate) {
    return { valid: false, error: 'No pending debate' };
  }
  return { valid: true };
}

/**
 * Resolve one step of a theological debate.
 * Returns the debate result when complete, or status update otherwise.
 */
export function resolveDebateStep(state, power, actionData, helpers) {
  const debate = state.pendingDebate;

  if (debate.phase === 'roll') {
    return resolveDebateRoll(state, debate, helpers);
  } else if (debate.phase === 'resolve') {
    return resolveDebateOutcome(state, debate, helpers);
  }

  return { status: 'error', error: 'Invalid debate phase' };
}

/**
 * Roll dice for both sides in the current debate round.
 */
function resolveDebateRoll(state, debate, helpers) {
  const attackerDef = getDebaterDef(debate.attackerId);
  const defenderDef = getDebaterDef(debate.defenderId);

  // Attacker dice: debater value + attacker bonus (3)
  const attackerDice = attackerDef.value + DEBATE.attackerBaseBonus;

  // Defender dice: debater value + uncommitted/committed bonus
  const defenderDebaterState = findDebaterState(state, debate.defenderSide,
    debate.defenderId);
  // In round 1 the defender was just committed, but for dice purposes
  // we check if they were committed BEFORE this debate
  // Simplified: round 1 = uncommitted bonus, round 2 = committed bonus
  const defBonus = debate.round === 1
    ? DEBATE.defenderUncommittedBonus
    : DEBATE.defenderCommittedBonus;
  const defenderDice = defenderDef.value + defBonus;

  const attackerRolls = rollDice(attackerDice);
  const defenderRolls = rollDice(defenderDice);

  // Count hits (≥ threshold)
  const attackerHits = attackerRolls.filter(
    d => d >= DEBATE.hitThreshold).length;
  const defenderHits = defenderRolls.filter(
    d => d >= DEBATE.hitThreshold).length;

  debate.attackerHits = attackerHits;
  debate.defenderHits = defenderHits;
  debate.attackerRolls = attackerRolls;
  debate.defenderRolls = defenderRolls;
  debate.phase = 'resolve';

  helpers.logEvent(state, 'debate_roll', {
    round: debate.round,
    attackerRolls, defenderRolls,
    attackerHits, defenderHits
  });

  return {
    status: 'rolled',
    round: debate.round,
    attackerRolls, defenderRolls,
    attackerHits, defenderHits
  };
}

/**
 * Resolve the debate outcome after dice are rolled.
 */
function resolveDebateOutcome(state, debate, helpers) {
  const { attackerHits, defenderHits } = debate;

  if (attackerHits > defenderHits) {
    // Attacker wins
    return finishDebate(state, debate, 'attacker', helpers);
  } else if (defenderHits > attackerHits) {
    // Defender wins
    return finishDebate(state, debate, 'defender', helpers);
  } else {
    // Tie — round 2 if round 1, otherwise attacker wins ties in round 2
    if (debate.round === 1) {
      debate.round = 2;
      debate.phase = 'roll';
      debate.attackerHits = 0;
      debate.defenderHits = 0;

      helpers.logEvent(state, 'debate_tie', { round: 1 });
      return { status: 'tie', round: 1, nextRound: 2 };
    } else {
      // Round 2 tie: attacker wins
      return finishDebate(state, debate, 'attacker', helpers);
    }
  }
}

/**
 * Finalize debate: flip spaces, handle disgrace/burn.
 */
function finishDebate(state, debate, winner, helpers) {
  const { attackerHits, defenderHits, zone } = debate;
  const hitDiff = Math.abs(attackerHits - defenderHits);

  const winnerSide = winner === 'attacker' ? debate.attackerSide : debate.defenderSide;
  const loserSide = winner === 'attacker' ? debate.defenderSide : debate.attackerSide;
  const loserId = winner === 'attacker' ? debate.defenderId : debate.attackerId;

  // Determine spaces to flip (hitDiff, minimum 1 if winner)
  const spacesToFlip = Math.max(hitDiff, 1);

  // Set up pending reformation/counter-reformation for the winner
  const isProtestantWin = winnerSide === 'protestant';
  state.pendingReformation = {
    type: isProtestantWin ? 'reformation' : 'counter_reformation',
    zone,
    attemptsLeft: spacesToFlip,
    initiator: debate.initiator,
    source: 'debate',
    autoFlip: true // debate flips don't require dice — just pick spaces
  };

  // Handle loser: disgrace (removed from game if diff >= 2) or burn
  let loserFate = 'disgraced';
  if (hitDiff >= 2) {
    // Loser is burned/disgraced — removed from game
    loserFate = isProtestantWin ? 'burned' : 'disgraced';
    removeDebater(state, loserSide, loserId);
  }

  const result = {
    status: 'complete',
    winner: winnerSide,
    spacesToFlip,
    loserFate,
    loserId
  };

  helpers.logEvent(state, 'debate_result', {
    winner: winnerSide,
    attackerHits: debate.attackerHits,
    defenderHits: debate.defenderHits,
    spacesToFlip,
    loserFate,
    loserId
  });

  state.pendingDebate = null;
  return result;
}

// ── Resolve Debate Space Flip ───────────────────────────────────

/**
 * Validate a debate space flip (autoFlip reformation attempt).
 */
export function validateDebateFlip(state, power, actionData) {
  const pending = state.pendingReformation;
  if (!pending || pending.source !== 'debate') {
    return { valid: false, error: 'No pending debate flip' };
  }
  if (pending.attemptsLeft <= 0) {
    return { valid: false, error: 'No flips remaining' };
  }

  const { targetSpace } = actionData;
  if (!targetSpace) return { valid: false, error: 'Must specify target space' };
  if (!state.spaces[targetSpace]) {
    return { valid: false, error: `Space "${targetSpace}" not found` };
  }

  const sp = state.spaces[targetSpace];
  if (pending.zone && sp.languageZone !== pending.zone) {
    return { valid: false, error: `Target must be in ${pending.zone} zone` };
  }

  // Check religion matches what we're flipping FROM
  if (pending.type === 'reformation') {
    if (!isValidReformationTarget(state, targetSpace)) {
      return { valid: false, error: 'Invalid reformation target' };
    }
  } else {
    if (!isValidCounterReformTarget(state, targetSpace)) {
      return { valid: false, error: 'Invalid counter-reformation target' };
    }
  }

  return { valid: true };
}

/**
 * Execute a debate space flip (no dice needed).
 */
export function resolveDebateFlip(state, power, actionData, helpers) {
  const pending = state.pendingReformation;
  const { targetSpace } = actionData;

  const sp = state.spaces[targetSpace];
  const newReligion = pending.type === 'reformation'
    ? RELIGION.PROTESTANT : RELIGION.CATHOLIC;
  sp.religion = newReligion;
  recountProtestantSpaces(state);

  pending.attemptsLeft--;

  helpers.logEvent(state, 'debate_flip', {
    space: targetSpace,
    religion: newReligion
  });

  if (pending.attemptsLeft <= 0) {
    state.pendingReformation = null;
  }

  return { flipped: targetSpace, religion: newReligion };
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Select the highest-value debater from a list.
 */
function selectBestDebater(debaterStates) {
  let best = null;
  let bestValue = -1;
  for (const d of debaterStates) {
    const def = getDebaterDef(d.id);
    if (def && def.value > bestValue) {
      bestValue = def.value;
      best = d;
    }
  }
  return best;
}

/**
 * Mark a debater as committed.
 */
function markCommitted(state, side, debaterId) {
  const debaters = state.debaters[side] || [];
  const d = debaters.find(dd => dd.id === debaterId);
  if (d) d.committed = true;
}

/**
 * Find a debater's state object.
 */
function findDebaterState(state, side, debaterId) {
  const debaters = state.debaters[side] || [];
  return debaters.find(d => d.id === debaterId) || null;
}

/**
 * Remove a debater from the game (burned/disgraced).
 */
function removeDebater(state, side, debaterId) {
  const debaters = state.debaters[side] || [];
  const idx = debaters.findIndex(d => d.id === debaterId);
  if (idx !== -1) debaters.splice(idx, 1);
}
