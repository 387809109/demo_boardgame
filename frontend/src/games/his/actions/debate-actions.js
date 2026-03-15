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

  // Attacker chooses their debater; defender is drawn randomly (§18.5)
  const attackerDebaters = getAvailableDebaters(state, attackerSide, zone);
  const defenderDebaters = getAvailableDebaters(state, defenderSide, zone);

  const attacker = selectBestDebater(attackerDebaters);
  const defender = selectRandomDebater(defenderDebaters);

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
      // §18.5: Round 2 tie — debate ends with no result
      helpers.logEvent(state, 'debate_tie', { round: 2 });
      state.pendingDebate = null;
      return { status: 'no_result', round: 2 };
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

  // Spaces to flip = hitDiff (no minimum — exact difference)
  const spacesToFlip = hitDiff;

  // Set up pending reformation/counter-reformation for the winner
  const isProtestantWin = winnerSide === 'protestant';
  if (spacesToFlip > 0) {
    state.pendingReformation = {
      type: isProtestantWin ? 'reformation' : 'counter_reformation',
      zone,
      attemptsLeft: spacesToFlip,
      initiator: debate.initiator,
      source: 'debate',
      autoFlip: true // debate flips don't require dice — just pick spaces
    };
  }

  // §18.5: Loser removed if hitDiff > loser's debate value
  const loserDef = getDebaterDef(loserId);
  const loserValue = loserDef ? loserDef.value : 0;
  let loserFate = 'disgraced';
  if (hitDiff > loserValue) {
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
 * Select the highest-value debater from a list (attacker chooses).
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
 * Select a random debater from a list (§18.5: defender drawn randomly).
 */
function selectRandomDebater(debaterStates) {
  if (debaterStates.length === 0) return null;
  const idx = Math.floor(Math.random() * debaterStates.length);
  return debaterStates[idx];
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

// ── Council of Trent ────────────────────────────────────────────

/**
 * Validate debater selection for Council of Trent.
 * @param {Object} state
 * @param {string} power - 'papacy' or 'protestant'
 * @param {Object} actionData - { debaterIds: string[] }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCouncilChoice(state, power, actionData) {
  const council = state.pendingCouncilOfTrent;
  if (!council) return { valid: false, error: 'No pending Council of Trent' };

  const { debaterIds } = actionData;
  if (!debaterIds || !Array.isArray(debaterIds)) {
    return { valid: false, error: 'Must specify debaterIds array' };
  }

  if (council.phase === 'papacy_choose') {
    if (power !== 'papacy') {
      return { valid: false, error: 'Papacy must choose debaters first' };
    }
    if (debaterIds.length > council.maxPapacy) {
      return { valid: false, error: `Cannot select more than ${council.maxPapacy} debaters` };
    }
    if (debaterIds.length === 0) {
      return { valid: false, error: 'Must select at least 1 debater' };
    }
    // Verify all are available papal debaters
    for (const id of debaterIds) {
      const d = (state.debaters.papal || []).find(dd => dd.id === id);
      if (!d) return { valid: false, error: `Debater "${id}" not available` };
    }
    return { valid: true };
  }

  if (council.phase === 'protestant_choose') {
    if (power !== 'protestant') {
      return { valid: false, error: 'Protestant must choose debaters now' };
    }
    if (debaterIds.length > council.maxProtestant) {
      return { valid: false, error: `Cannot select more than ${council.maxProtestant} debaters` };
    }
    if (debaterIds.length === 0) {
      return { valid: false, error: 'Must select at least 1 debater' };
    }
    for (const id of debaterIds) {
      const d = (state.debaters.protestant || []).find(dd => dd.id === id);
      if (!d) return { valid: false, error: `Debater "${id}" not available` };
    }
    return { valid: true };
  }

  return { valid: false, error: `Invalid Council phase: ${council.phase}` };
}

/**
 * Execute debater selection for Council of Trent.
 */
export function executeCouncilChoice(state, power, actionData, helpers) {
  const council = state.pendingCouncilOfTrent;
  const { debaterIds } = actionData;

  if (council.phase === 'papacy_choose') {
    council.papacyDebaters = debaterIds;
    // Mark as committed
    for (const id of debaterIds) {
      markCommitted(state, 'papal', id);
    }
    council.phase = 'protestant_choose';
    helpers.logEvent(state, 'council_papacy_choose', { debaterIds });
    return;
  }

  if (council.phase === 'protestant_choose') {
    council.protestantDebaters = debaterIds;
    for (const id of debaterIds) {
      markCommitted(state, 'protestant', id);
    }
    council.phase = 'resolve';
    council.round = 1;
    council.papacyWins = 0;
    council.protestantWins = 0;
    council.totalRounds = 3;
    helpers.logEvent(state, 'council_protestant_choose', { debaterIds });
    return;
  }
}

/**
 * Resolve one round of the Council of Trent debate.
 * Each side rolls dice = sum of debater values. Hits on 5+.
 * Side with more hits wins the round.
 * @param {Object} state
 * @param {Object} helpers
 * @returns {Object} Round result
 */
export function resolveCouncilRound(state, helpers) {
  const council = state.pendingCouncilOfTrent;
  if (!council || council.phase !== 'resolve') {
    return { error: 'Council not in resolve phase' };
  }

  // Calculate dice for each side
  let papacyDice = 0;
  for (const id of council.papacyDebaters) {
    const def = getDebaterDef(id);
    if (def) papacyDice += def.value;
  }

  let protestantDice = 0;
  for (const id of council.protestantDebaters) {
    const def = getDebaterDef(id);
    if (def) protestantDice += def.value;
  }

  papacyDice = Math.max(papacyDice, 1);
  protestantDice = Math.max(protestantDice, 1);

  const papacyRolls = rollDice(papacyDice);
  const protestantRolls = rollDice(protestantDice);

  const papacyHits = papacyRolls.filter(d => d >= DEBATE.hitThreshold).length;
  const protestantHits = protestantRolls.filter(
    d => d >= DEBATE.hitThreshold).length;

  let roundWinner = 'tie';
  if (papacyHits > protestantHits) {
    roundWinner = 'papacy';
    council.papacyWins++;
  } else if (protestantHits > papacyHits) {
    roundWinner = 'protestant';
    council.protestantWins++;
  } else {
    // Tie: papacy wins ties at Council of Trent
    roundWinner = 'papacy';
    council.papacyWins++;
  }

  const result = {
    round: council.round,
    papacyRolls, protestantRolls,
    papacyHits, protestantHits,
    roundWinner
  };

  helpers.logEvent(state, 'council_round', result);

  council.round++;

  // Check if Council is decided (best of 3 = first to 2 wins)
  if (council.papacyWins >= 2 || council.protestantWins >= 2 ||
      council.round > council.totalRounds) {
    return finalizeCouncil(state, helpers, result);
  }

  return { status: 'round_complete', ...result };
}

/**
 * Finalize Council of Trent — apply results and clear state.
 */
function finalizeCouncil(state, helpers, lastRoundResult) {
  const council = state.pendingCouncilOfTrent;
  const winner = council.papacyWins >= council.protestantWins
    ? 'papacy' : 'protestant';

  // Winner gains 1 VP
  if (state.vp[winner] !== undefined) {
    state.vp[winner]++;
  }

  // Winner gets to flip spaces (hit difference from final tally)
  const spacesToFlip = Math.max(
    Math.abs(council.papacyWins - council.protestantWins), 1);

  const isProtestantWin = winner === 'protestant';
  state.pendingReformation = {
    type: isProtestantWin ? 'reformation' : 'counter_reformation',
    zone: null, // Council can flip any zone
    attemptsLeft: spacesToFlip,
    initiator: winner,
    source: 'council',
    autoFlip: true
  };

  const finalResult = {
    status: 'council_complete',
    winner,
    papacyWins: council.papacyWins,
    protestantWins: council.protestantWins,
    spacesToFlip,
    ...lastRoundResult
  };

  helpers.logEvent(state, 'council_complete', finalResult);
  state.pendingCouncilOfTrent = null;

  return finalResult;
}
