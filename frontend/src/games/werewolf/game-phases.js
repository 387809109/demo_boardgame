/**
 * Werewolf Game Phase Management
 * @module games/werewolf/game-phases
 *
 * Phase transition and step management functions
 */

import {
  resolveNightActions,
  calculateVoteResult,
  getActiveNightRoles,
  canPlayerVote,
  resolveWolfConsensus
} from './rules.js';
import config from './config.json';

export const PHASES = {
  NIGHT: 'night',
  DAY_ANNOUNCE: 'day_announce',
  DAY_DISCUSSION: 'day_discussion',
  DAY_VOTE: 'day_vote',
  DAY_EXECUTION: 'day_execution',
  ENDED: 'ended'
};

/**
 * Order last words candidates according to configured rule.
 * - `death_resolution`: keep night death settlement order
 * - `seating_order`: random one as first, then clockwise by seating
 * @param {Object} state - Game state
 * @param {string[]} candidateIds - Unique candidate player IDs
 * @returns {string[]}
 */
function orderLastWordsCandidates(state, candidateIds) {
  const orderMode = state.options?.lastWordsOrder ?? 'seating_order';
  if (orderMode !== 'seating_order' || candidateIds.length <= 1) {
    return [...candidateIds];
  }

  const seatOrder = (state.players || []).map(p => p.id);
  if (seatOrder.length <= 1) {
    return [...candidateIds];
  }

  const seatedCandidates = candidateIds.filter(id => seatOrder.includes(id));
  const unseatedCandidates = candidateIds.filter(id => !seatOrder.includes(id));
  if (seatedCandidates.length <= 1) {
    return [...seatedCandidates, ...unseatedCandidates];
  }

  // Deterministic "random" start so all clients derive the same order for the same day.
  const firstSpeakerId = seatedCandidates[getDeterministicStartIndex(state, seatedCandidates)];
  const firstSeatIndex = seatOrder.indexOf(firstSpeakerId);

  const remaining = new Set(seatedCandidates.filter(id => id !== firstSpeakerId));
  const ordered = [firstSpeakerId];
  for (let offset = 1; offset <= seatOrder.length && remaining.size > 0; offset++) {
    const seatId = seatOrder[(firstSeatIndex + offset) % seatOrder.length];
    if (remaining.has(seatId)) {
      ordered.push(seatId);
      remaining.delete(seatId);
    }
  }

  return [...ordered, ...unseatedCandidates];
}

/**
 * Pick a deterministic start index for seating-order last words.
 * Uses stable day-specific data so all clients compute the same result.
 * @param {Object} state - Game state
 * @param {string[]} seatedCandidates - Candidate IDs that exist in seat order
 * @returns {number}
 */
function getDeterministicStartIndex(state, seatedCandidates) {
  if (seatedCandidates.length <= 1) return 0;

  const deathSignature = (state.nightDeaths || [])
    .map(d => `${d.playerId}:${d.cause || ''}`)
    .join('|');
  const seedInput = [
    String(state.round ?? 0),
    deathSignature,
    seatedCandidates.join('|'),
    String(state.initialWolfCount ?? 0)
  ].join('#');

  // FNV-1a 32-bit hash
  let hash = 2166136261;
  for (let i = 0; i < seedInput.length; i++) {
    hash ^= seedInput.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash % seatedCandidates.length;
}

/**
 * Assign last words speakers from night deaths according to remaining quota.
 * Selected speakers are consumed from `lastWordsRemaining` only in
 * `limit_by_initial_wolves` mode.
 * @param {Object} state - Game state
 */
export function assignNightLastWords(state) {
  const mode = state.options?.lastWordsMode;
  if (mode === 'none') {
    state.lastWordsPlayerId = null;
    state.lastWordsQueue = [];
    return;
  }

  const deaths = (state.nightDeaths || [])
    .map(d => d.playerId)
    .filter(Boolean);
  const uniqueDeaths = [...new Set(deaths)];

  if (uniqueDeaths.length === 0) {
    state.lastWordsPlayerId = null;
    state.lastWordsQueue = [];
    return;
  }

  const orderedCandidates = orderLastWordsCandidates(state, uniqueDeaths);

  let selected = orderedCandidates;
  if (mode === 'limit_by_initial_wolves') {
    const remaining = Math.max(0, state.lastWordsRemaining || 0);
    selected = orderedCandidates.slice(0, remaining);
    state.lastWordsRemaining = Math.max(0, remaining - selected.length);
  }

  state.lastWordsPlayerId = selected[0] || null;
  state.lastWordsQueue = selected.slice(1);
}

/**
 * Transition to a new phase
 * @param {Object} state - Game state
 * @param {string} toPhase - Target phase
 * @param {Object} helpers - Helper functions
 */
export function transitionPhase(state, toPhase, helpers) {
  state.phase = toPhase;
  switch (toPhase) {
    case PHASES.NIGHT:
      startNight(state, helpers);
      break;
    case PHASES.DAY_ANNOUNCE:
      startDayAnnounce(state, helpers);
      break;
    case PHASES.DAY_DISCUSSION:
      startDayDiscussion(state, helpers);
      break;
    case PHASES.DAY_VOTE:
      startDayVote(state, helpers);
      break;
  }
}

/**
 * Start night phase
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function startNight(state, helpers) {
  state.nightActions = {};
  state.wolfVotes = {};
  state.wolfTentativeVotes = {};
  state.nightDeaths = [];
  state.dayAnnouncements = [];
  state.tiedCandidates = null;
  state.voteRound = 1;
  state.speakerQueue = [];
  state.speakerIndex = -1;
  state.currentSpeaker = null;
  state.lastWordsPlayerId = null;
  state.lastWordsQueue = [];

  // Build sequential night steps from active roles
  const steps = buildNightSteps(state);
  state.nightSteps = steps;
  state.currentNightStep = 0;
  state.pendingNightRoles = steps.length > 0
    ? [...steps[0].playerIds] : [];

  helpers.logEvent(state, 'phase_change', {
    phase: PHASES.NIGHT,
    round: state.round
  });
}

/**
 * Start day announce phase
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function startDayAnnounce(state, helpers) {
  // Determine who should give last words from night deaths.
  const deaths = state.nightDeaths || [];
  if (state.hunterPendingShoot) {
    // If hunter died at night and can shoot, hunter shot resolves before last words.
    state.lastWordsPlayerId = null;
    state.lastWordsQueue = [];
    state.awaitingFirstSpeaker = false;
    state.firstSpeakerId = null;
  } else {
    assignNightLastWords(state);
    if (state.lastWordsPlayerId) {
      state.awaitingFirstSpeaker = false;
      state.firstSpeakerId = null;
    } else {
      // Peaceful night - wait for first speaker to start discussion
      state.awaitingFirstSpeaker = true;
      // Pre-calculate first speaker
      const alive = state.players.filter(p => state.playerMap[p.id].alive);
      state.firstSpeakerId = alive.length > 0 ? alive[0].id : null;
    }
  }

  helpers.logEvent(state, 'phase_change', {
    phase: PHASES.DAY_ANNOUNCE,
    round: state.round,
    deaths: deaths.map(d => d.playerId)
  });
}

/**
 * Calculate first speaker based on victim position
 * @param {Object} state - Game state
 */
export function calculateFirstSpeaker(state) {
  const alive = state.players.filter(p => state.playerMap[p.id].alive);
  const victimIds = (state.nightDeaths || []).map(d => d.playerId);

  let startIdx = 0;
  if (victimIds.length > 0) {
    const victimSeat = state.players.findIndex(p => p.id === victimIds[0]);
    if (victimSeat !== -1) {
      for (let offset = 1; offset <= state.players.length; offset++) {
        const idx = (victimSeat + offset) % state.players.length;
        const candidate = state.players[idx];
        if (state.playerMap[candidate.id].alive) {
          startIdx = alive.findIndex(p => p.id === candidate.id);
          break;
        }
      }
    }
  }

  state.firstSpeakerId = alive.length > 0 ? alive[startIdx].id : null;
}

/**
 * Start day discussion phase - builds speaker queue
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function startDayDiscussion(state, helpers) {
  state.votes = {};

  // Build speaker queue: clockwise from victim
  const alive = state.players.filter(p => state.playerMap[p.id].alive);
  const victimIds = (state.nightDeaths || []).map(d => d.playerId);

  let startIdx = 0;
  if (victimIds.length > 0) {
    const victimSeat = state.players.findIndex(p => p.id === victimIds[0]);
    if (victimSeat !== -1) {
      for (let offset = 1; offset <= state.players.length; offset++) {
        const idx = (victimSeat + offset) % state.players.length;
        const candidate = state.players[idx];
        if (state.playerMap[candidate.id].alive) {
          startIdx = alive.findIndex(p => p.id === candidate.id);
          break;
        }
      }
    }
  }

  // Build queue in clockwise order from startIdx
  const queue = [];
  for (let i = 0; i < alive.length; i++) {
    const idx = (startIdx + i) % alive.length;
    queue.push(alive[idx].id);
  }

  state.speakerQueue = queue;
  state.speakerIndex = 0;
  state.currentSpeaker = queue.length > 0 ? queue[0] : null;
  state.finishedSpeakers = [];
  state.baseSpeakerOrder = [...queue];

  helpers.logEvent(state, 'phase_change', {
    phase: PHASES.DAY_DISCUSSION,
    round: state.round,
    speakerQueue: queue
  });
}

/**
 * Advance to the next speaker
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function advanceSpeaker(state, helpers) {
  if (state.currentSpeaker) {
    state.finishedSpeakers = [...(state.finishedSpeakers || []), state.currentSpeaker];
  }

  state.speakerIndex++;
  if (state.speakerIndex >= state.speakerQueue.length) {
    state.currentSpeaker = null;
    transitionPhase(state, PHASES.DAY_VOTE, helpers);
  } else {
    state.currentSpeaker = state.speakerQueue[state.speakerIndex];
  }
}

/**
 * Start tie speech phase - only tied candidates speak before second vote
 * @param {Object} state - Game state
 * @param {Array} tiedPlayerIds - Tied player IDs
 * @param {Object} helpers - Helper functions
 */
export function startTieSpeech(state, tiedPlayerIds, helpers) {
  const orderedTied = state.baseSpeakerOrder.filter(id => tiedPlayerIds.includes(id));

  state.phase = PHASES.DAY_DISCUSSION;
  state.speakerQueue = orderedTied;
  state.speakerIndex = 0;
  state.currentSpeaker = orderedTied.length > 0 ? orderedTied[0] : null;
  state.finishedSpeakers = [];

  helpers.logEvent(state, 'phase_change', {
    phase: PHASES.DAY_DISCUSSION,
    round: state.round,
    speakerQueue: orderedTied,
    isTieSpeech: true
  });
}

/**
 * Start day vote phase
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function startDayVote(state, helpers) {
  state.votes = {};
  state.finishedSpeakers = [];

  const aliveIds = state.players
    .filter(p => state.playerMap[p.id].alive)
    .map(p => p.id);
  const voterQueue = state.baseSpeakerOrder
    .filter(id => aliveIds.includes(id))
    .filter(id => canPlayerVote(state, id));

  state.voterQueue = voterQueue;
  state.voterIndex = 0;
  state.currentVoter = voterQueue.length > 0 ? voterQueue[0] : null;

  helpers.logEvent(state, 'phase_change', {
    phase: PHASES.DAY_VOTE,
    round: state.round,
    voteRound: state.voteRound,
    voterQueue
  });
}

/**
 * Build ordered night steps from active roles
 * @param {Object} state - Game state
 * @returns {Array}
 */
export function buildNightSteps(state) {
  const activeRoles = getActiveNightRoles(state);
  const steps = [];
  let prev = null;
  for (const role of activeRoles) {
    if (!prev || role.priority !== prev.priority) {
      steps.push({
        priority: role.priority,
        roleId: role.roleId,
        playerIds: [role.playerId],
        label: getNightStepLabel(role.priority)
      });
    } else {
      steps[steps.length - 1].playerIds.push(role.playerId);
    }
    prev = role;
  }
  return steps;
}

/**
 * Get display label for a night step priority
 * @param {number} priority - Priority number
 * @returns {string}
 */
export function getNightStepLabel(priority) {
  const labels = {
    5: '预言家查验', 7: '医生保护',
    8: '狼人行动', 9: '义警射杀', 10: '女巫行动',
    11: '魔笛手魅惑'
  };
  return labels[priority] || '夜间行动';
}

/**
 * Advance to the next night step
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function advanceNightStep(state, helpers) {
  state.currentNightStep++;

  if (state.currentNightStep >= state.nightSteps.length) {
    resolveNight(state, helpers);
    transitionPhase(state, PHASES.DAY_ANNOUNCE, helpers);
    return;
  }

  const nextStep = state.nightSteps[state.currentNightStep];
  state.pendingNightRoles = [...nextStep.playerIds];

  // When witch step begins, provide wolf target info
  if (nextStep.roleId === 'witch') {
    const wolfTarget = resolveWolfConsensus(state);
    state.dayAnnouncements.push({
      type: 'witch_night_info',
      playerId: nextStep.playerIds[0],
      wolfTarget: wolfTarget || null
    });
  }

  helpers.logEvent(state, 'night_step', {
    step: state.currentNightStep,
    label: nextStep.label
  });
}

/**
 * Resolve all night actions
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function resolveNight(state, helpers) {
  const { deaths, announcements } = resolveNightActions(state);

  state.dayAnnouncements = [...(state.dayAnnouncements || []), ...announcements];
  state.nightDeaths = deaths;

  for (const death of deaths) {
    helpers.markPlayerDead(state, death.playerId, death.cause);
    helpers.processDeathTriggers(state, [death.playerId], death.cause);
  }

  state.round++;
}

/**
 * Collect a day vote and advance to next voter
 * @param {Object} state - Game state
 * @param {Object} move - Vote move
 */
export function collectDayVote(state, move) {
  const { playerId, actionType, actionData } = move;

  if (actionType === 'DAY_SKIP_VOTE') {
    state.votes[playerId] = null;
  } else {
    state.votes[playerId] = actionData.targetId;
  }

  state.voterIndex++;
  if (state.voterIndex >= state.voterQueue.length) {
    state.currentVoter = null;
  } else {
    state.currentVoter = state.voterQueue[state.voterIndex];
  }
}

/**
 * Check if all day votes have been collected
 * @param {Object} state - Game state
 * @returns {boolean}
 */
export function areAllDayVotesCollected(state) {
  return state.currentVoter === null;
}

/**
 * Resolve day votes
 * @param {Object} state - Game state
 * @param {Object} helpers - Helper functions
 */
export function resolveVotes(state, helpers) {
  const result = calculateVoteResult(state.votes, state.options);

  helpers.logEvent(state, 'vote_result', {
    voteCounts: result.voteCounts,
    executed: result.executed,
    tiedPlayers: result.tiedPlayers,
    voteRound: state.voteRound
  });

  if (result.executed) {
    const executedId = result.executed;
    const executedPlayer = state.playerMap[executedId];
    const revealedIdiots = state.roleStates?.idiotRevealedIds || [];
    const isIdiotFirstReveal = executedPlayer?.roleId === 'idiot' &&
      !revealedIdiots.includes(executedId);

    state.tiedCandidates = null;

    if (isIdiotFirstReveal) {
      state.roleStates.idiotRevealedIds = [...revealedIdiots, executedId];
      state.publicRevealRoleIds = state.publicRevealRoleIds || {};
      state.publicRevealRoleIds[executedId] = true;
      state.lastDayExecution = null;

      helpers.logEvent(state, 'idiot_revealed', {
        playerId: executedId,
        voteRound: state.voteRound
      });

      transitionPhase(state, PHASES.NIGHT, helpers);
      return;
    }

    helpers.markPlayerDead(state, executedId, 'execution');
    state.lastDayExecution = executedId;

    if (executedPlayer?.roleId === 'jester') {
      state.jesterWinnerId = executedId;
    }

    if (state.options.lastWordsMode === 'limit_by_initial_wolves' && state.lastWordsRemaining > 0) {
      state.lastWordsRemaining--;
    }

    helpers.processDeathTriggers(state, [executedId], 'execution');

    if (!state.hunterPendingShoot) {
      transitionPhase(state, PHASES.NIGHT, helpers);
    }
  } else if (result.tiedPlayers.length > 0 && state.voteRound === 1) {
    state.tiedCandidates = result.tiedPlayers;
    state.voteRound = 2;
    state.votes = {};
    startTieSpeech(state, result.tiedPlayers, helpers);
  } else {
    state.tiedCandidates = null;
    state.lastDayExecution = null;
    transitionPhase(state, PHASES.NIGHT, helpers);
  }
}

export default {
  PHASES,
  transitionPhase,
  startNight,
  startDayAnnounce,
  calculateFirstSpeaker,
  startDayDiscussion,
  advanceSpeaker,
  startTieSpeech,
  startDayVote,
  buildNightSteps,
  getNightStepLabel,
  advanceNightStep,
  resolveNight,
  collectDayVote,
  areAllDayVotesCollected,
  resolveVotes
};
