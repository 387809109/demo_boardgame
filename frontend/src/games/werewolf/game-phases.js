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
  // Determine who should give last words (first night death)
  const deaths = state.nightDeaths || [];
  if (state.hunterPendingShoot) {
    // If hunter died at night and can shoot, hunter shot resolves before last words.
    state.lastWordsPlayerId = null;
    state.awaitingFirstSpeaker = false;
    state.firstSpeakerId = null;
  } else if (deaths.length > 0) {
    state.lastWordsPlayerId = deaths[0].playerId;
    state.awaitingFirstSpeaker = false;
  } else {
    // Peaceful night - wait for first speaker to start discussion
    state.lastWordsPlayerId = null;
    state.awaitingFirstSpeaker = true;
    // Pre-calculate first speaker
    const alive = state.players.filter(p => state.playerMap[p.id].alive);
    state.firstSpeakerId = alive.length > 0 ? alive[0].id : null;
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
  const voterQueue = state.baseSpeakerOrder.filter(id => aliveIds.includes(id));

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
    8: '狼人行动', 10: '女巫行动'
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
    helpers.markPlayerDead(state, result.executed, 'execution');
    state.tiedCandidates = null;
    state.lastDayExecution = result.executed;

    if (state.options.lastWordsMode !== 'none' && state.lastWordsRemaining > 0) {
      state.lastWordsRemaining--;
    }

    helpers.processDeathTriggers(state, [result.executed], 'execution');

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
