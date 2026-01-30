/**
 * Werewolf Game Implementation
 * @module games/werewolf
 */

import { GameEngine } from '../../game/engine.js';
import {
  assignRoles,
  validateNightAction,
  validateDayVote,
  resolveNightActions,
  calculateVoteResult,
  checkWinConditions,
  getActiveNightRoles
} from './rules.js';
import config from './config.json';

/** Game phases */
export const PHASES = {
  NIGHT: 'night',
  DAY_ANNOUNCE: 'day_announce',
  DAY_DISCUSSION: 'day_discussion',
  DAY_VOTE: 'day_vote',
  DAY_EXECUTION: 'day_execution',
  ENDED: 'ended'
};

/** Action types */
export const ACTION_TYPES = {
  NIGHT_WOLF_KILL: 'NIGHT_WOLF_KILL',
  NIGHT_SEER_CHECK: 'NIGHT_SEER_CHECK',
  NIGHT_DOCTOR_PROTECT: 'NIGHT_DOCTOR_PROTECT',
  NIGHT_WITCH_SAVE: 'NIGHT_WITCH_SAVE',
  NIGHT_WITCH_POISON: 'NIGHT_WITCH_POISON',
  HUNTER_SHOOT: 'HUNTER_SHOOT',
  DAY_VOTE: 'DAY_VOTE',
  DAY_SKIP_VOTE: 'DAY_SKIP_VOTE',
  LAST_WORDS: 'LAST_WORDS',
  NIGHT_SKIP: 'NIGHT_SKIP',
  PHASE_ADVANCE: 'PHASE_ADVANCE',
  SPEECH_DONE: 'SPEECH_DONE',
  DEAD_CHAT: 'DEAD_CHAT'
};

/** Team identifiers */
export const TEAMS = {
  VILLAGE: 'village',
  WEREWOLF: 'werewolf',
  NEUTRAL: 'neutral'
};

/**
 * Werewolf Game class
 */
export class WerewolfGame extends GameEngine {
  constructor(mode = 'offline') {
    super(mode);
    this.config = config;
  }

  /**
   * Initialize the game
   * @param {Object} gameConfig - { players, options }
   * @returns {Object} Initial game state
   */
  initialize(gameConfig) {
    const { players, options = {} } = gameConfig;

    // Merge config rules with custom options
    const gameOptions = {
      revealRolesOnDeath: options.revealRolesOnDeath ?? config.rules.revealRolesOnDeath,
      allowDoctorSelfProtect: options.allowDoctorSelfProtect ?? config.rules.allowDoctorSelfProtect,
      allowRepeatedProtect: options.allowRepeatedProtect ?? config.rules.allowRepeatedProtect,
      hunterShootOnPoison: options.hunterShootOnPoison ?? config.rules.hunterShootOnPoison,
      dayVoteMajority: options.dayVoteMajority ?? config.rules.dayVoteMajority,
      leaderEnabled: options.leaderEnabled ?? config.rules.leaderEnabled,
      lastWordsMode: options.lastWordsMode ?? config.rules.lastWordsMode,
      lastWordsScope: options.lastWordsScope ?? config.rules.lastWordsScope,
      witchCanSaveSelf: options.witchCanSaveSelf ?? config.rules.witchCanSaveSelf,
      witchSaveFirstNightOnly: options.witchSaveFirstNightOnly ?? config.rules.witchSaveFirstNightOnly,
      protectAgainstPoison: options.protectAgainstPoison ?? config.rules.protectAgainstPoison,
      protectAgainstVigilante: options.protectAgainstVigilante ?? config.rules.protectAgainstVigilante
    };

    // Determine role counts
    const roleCounts = options.roleCounts || this._getDefaultRoleCounts(players.length);

    // Assign roles
    const roleAssignments = assignRoles(players, roleCounts);

    // Build player map
    const playerMap = {};
    players.forEach(p => {
      const roleId = roleAssignments[p.id];
      const roleConfig = this._getRoleConfig(roleId);
      playerMap[p.id] = {
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost || false,
        roleId,
        team: roleConfig?.team || TEAMS.VILLAGE,
        alive: true,
        deathCause: null,
        deathRound: null
      };
    });

    // Count initial wolves for lastWords tracking
    const initialWolfCount = Object.values(playerMap)
      .filter(p => p.team === TEAMS.WEREWOLF).length;

    // Get pending night roles
    const stateForRoles = {
      playerMap,
      nightActionPriority: config.nightActionPriority,
      roleDefinitions: config.roles
    };
    const pendingNightRoles = getActiveNightRoles(stateForRoles)
      .map(r => r.playerId);

    const state = {
      players: players.map(p => ({
        ...p,
        roleId: roleAssignments[p.id]
      })),
      playerMap,
      phase: PHASES.NIGHT,
      round: 1,
      turnNumber: 1,
      currentPlayer: null,
      status: 'playing',
      options: gameOptions,

      // Night tracking
      nightActions: {},
      wolfVotes: {},
      pendingNightRoles,
      protectedLastNight: null,

      // Day tracking
      votes: {},
      voteRound: 1,
      tiedCandidates: null,
      speakerQueue: [],
      speakerIndex: -1,
      currentSpeaker: null,

      // Death & triggers
      nightDeaths: [],
      dayAnnouncements: [],
      hunterPendingShoot: null,
      lastWordsRemaining: initialWolfCount,

      // Role states
      roleStates: {
        witchSaveUsed: false,
        witchPoisonUsed: false,
        doctorLastProtect: null
      },
      links: {},

      // Dead player chat (visible only to dead players)
      deadChat: [],

      // Meta
      initialWolfCount,
      roleDefinitions: config.roles,
      nightActionPriority: config.nightActionPriority,
      eventLog: [],
      winner: null
    };

    return state;
  }

  /**
   * Validate a move
   * @param {Object} move - { playerId, actionType, actionData }
   * @param {Object} state
   * @returns {{ valid: boolean, error?: string }}
   */
  validateMove(move, state) {
    const { playerId, actionType } = move;

    if (state.status !== 'playing') {
      return { valid: false, error: '游戏未在进行中' };
    }

    const player = state.playerMap[playerId];
    if (!player) {
      return { valid: false, error: '玩家不存在' };
    }

    // LAST_WORDS, HUNTER_SHOOT, and DEAD_CHAT can come from dead players
    if (actionType !== ACTION_TYPES.LAST_WORDS &&
        actionType !== ACTION_TYPES.HUNTER_SHOOT &&
        actionType !== ACTION_TYPES.DEAD_CHAT &&
        !player.alive) {
      return { valid: false, error: '你已死亡' };
    }

    // PHASE_ADVANCE can happen in announce or discussion
    if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
      if (state.phase !== PHASES.DAY_ANNOUNCE &&
          state.phase !== PHASES.DAY_DISCUSSION) {
        return { valid: false, error: '当前阶段无法推进' };
      }
      return { valid: true };
    }

    // Night actions
    if (actionType.startsWith('NIGHT_')) {
      return validateNightAction(move, state);
    }

    // Day votes
    if (actionType === ACTION_TYPES.DAY_VOTE ||
        actionType === ACTION_TYPES.DAY_SKIP_VOTE) {
      return validateDayVote(move, state);
    }

    // Hunter shoot
    if (actionType === ACTION_TYPES.HUNTER_SHOOT) {
      if (state.hunterPendingShoot !== playerId) {
        return { valid: false, error: '你不能开枪' };
      }
      const targetId = move.actionData?.targetId;
      if (!targetId || !state.playerMap[targetId]?.alive) {
        return { valid: false, error: '目标无效' };
      }
      return { valid: true };
    }

    // Speech done
    if (actionType === ACTION_TYPES.SPEECH_DONE) {
      if (state.phase !== PHASES.DAY_DISCUSSION) {
        return { valid: false, error: '当前不是讨论阶段' };
      }
      if (state.currentSpeaker !== playerId) {
        return { valid: false, error: '当前不是你的发言回合' };
      }
      return { valid: true };
    }

    // Dead player chat
    if (actionType === ACTION_TYPES.DEAD_CHAT) {
      if (player.alive) {
        return { valid: false, error: '只有死亡玩家可以使用此聊天' };
      }
      if (!move.actionData?.message) {
        return { valid: false, error: '消息不能为空' };
      }
      return { valid: true };
    }

    // Last words
    if (actionType === ACTION_TYPES.LAST_WORDS) {
      return { valid: true };
    }

    return { valid: false, error: '未知操作' };
  }

  /**
   * Process a move and return new state
   * @param {Object} move
   * @param {Object} state
   * @returns {Object} New state
   */
  processMove(move, state) {
    const newState = JSON.parse(JSON.stringify(state));
    const { actionType, playerId, actionData } = move;

    switch (actionType) {
      case ACTION_TYPES.NIGHT_WOLF_KILL:
      case ACTION_TYPES.NIGHT_SEER_CHECK:
      case ACTION_TYPES.NIGHT_DOCTOR_PROTECT:
      case ACTION_TYPES.NIGHT_WITCH_SAVE:
      case ACTION_TYPES.NIGHT_WITCH_POISON:
      case ACTION_TYPES.NIGHT_SKIP:
        this._collectNightAction(newState, move);
        if (this._areAllNightActionsCollected(newState)) {
          this._resolveNight(newState);
          this._transitionPhase(newState, PHASES.DAY_ANNOUNCE);
        }
        break;

      case ACTION_TYPES.DAY_VOTE:
      case ACTION_TYPES.DAY_SKIP_VOTE:
        this._collectDayVote(newState, move);
        if (this._areAllDayVotesCollected(newState)) {
          this._resolveVotes(newState);
        }
        break;

      case ACTION_TYPES.HUNTER_SHOOT: {
        const targetId = actionData.targetId;
        this._markPlayerDead(newState, targetId, 'hunter_shoot');
        newState.hunterPendingShoot = null;
        this._logEvent(newState, 'hunter_shoot', {
          actorId: playerId,
          targetId
        });
        this._processDeathTriggers(newState, [targetId], 'hunter_shoot');
        // After triggers resolve, transition to night if no more pending
        if (!newState.hunterPendingShoot) {
          this._transitionPhase(newState, PHASES.NIGHT);
        }
        break;
      }

      case ACTION_TYPES.LAST_WORDS:
        this._logEvent(newState, 'last_words', {
          playerId,
          message: actionData?.message || ''
        });
        break;

      case ACTION_TYPES.DEAD_CHAT:
        newState.deadChat.push({
          playerId,
          nickname: newState.playerMap[playerId]?.nickname || playerId,
          message: actionData.message,
          timestamp: Date.now()
        });
        break;

      case ACTION_TYPES.SPEECH_DONE:
        this._advanceSpeaker(newState);
        break;

      case ACTION_TYPES.PHASE_ADVANCE:
        if (newState.phase === PHASES.DAY_ANNOUNCE) {
          this._transitionPhase(newState, PHASES.DAY_DISCUSSION);
        } else if (newState.phase === PHASES.DAY_DISCUSSION) {
          this._transitionPhase(newState, PHASES.DAY_VOTE);
        }
        break;

      default:
        // Generic night action handler for extensibility (P1-P3 roles)
        if (actionType.startsWith('NIGHT_')) {
          this._collectNightAction(newState, move);
          if (this._areAllNightActionsCollected(newState)) {
            this._resolveNight(newState);
            this._transitionPhase(newState, PHASES.DAY_ANNOUNCE);
          }
        }
        break;
    }

    newState.turnNumber++;
    return newState;
  }

  /**
   * Check if game has ended
   * @param {Object} state
   * @returns {{ ended: boolean, winner?: string, rankings?: Array }}
   */
  checkGameEnd(state) {
    const result = checkWinConditions(state);
    if (!result.ended) return { ended: false };

    state.phase = PHASES.ENDED;
    state.status = 'ended';
    state.winner = result.winner;

    const rankings = Object.values(state.playerMap).map(p => {
      const isWinner = p.team === result.winner;
      return {
        playerId: p.id,
        nickname: p.nickname,
        roleId: p.roleId,
        team: p.team,
        alive: p.alive,
        rank: isWinner ? 1 : 2,
        score: isWinner ? 1 : 0
      };
    });

    rankings.sort((a, b) => a.rank - b.rank);

    return {
      ended: true,
      winner: result.winner,
      reason: result.reason,
      rankings
    };
  }

  /**
   * Get visible state for a player (hides roles/actions of others)
   * @param {string} playerId
   * @returns {Object} Filtered state
   */
  getVisibleState(playerId) {
    const state = this.state;
    if (!state) return null;

    const viewer = state.playerMap[playerId];
    const isGameEnded = state.phase === PHASES.ENDED;

    // Build visible players list
    const visiblePlayers = state.players.map(p => {
      const full = state.playerMap[p.id];
      const showRole = this._canSeeRole(playerId, p.id, state);
      return {
        id: p.id,
        nickname: full.nickname,
        isHost: full.isHost,
        alive: full.alive,
        roleId: showRole ? full.roleId : null,
        team: showRole ? full.team : null,
        deathCause: full.deathCause,
        deathRound: full.deathRound
      };
    });

    // Viewer's own role is always visible
    const myRole = viewer ? {
      roleId: viewer.roleId,
      team: viewer.team
    } : null;

    // Wolves see each other
    let wolfTeamIds = null;
    if (viewer?.team === TEAMS.WEREWOLF || isGameEnded) {
      wolfTeamIds = Object.values(state.playerMap)
        .filter(p => p.team === TEAMS.WEREWOLF)
        .map(p => p.id);
    }

    // Night action feedback for seer etc.
    const myAnnouncements = (state.dayAnnouncements || [])
      .filter(a => a.playerId === playerId || !a.playerId);

    return {
      players: visiblePlayers,
      phase: state.phase,
      round: state.round,
      status: state.status,
      myRole,
      wolfTeamIds,
      votes: state.phase === PHASES.DAY_VOTE ? state.votes : {},
      nightDeaths: state.nightDeaths,
      dayAnnouncements: myAnnouncements,
      hunterPendingShoot: state.hunterPendingShoot,
      tiedCandidates: state.tiedCandidates,
      voteRound: state.voteRound,
      winner: state.winner,
      eventLog: isGameEnded ? state.eventLog : [],
      pendingNightRoles: state.pendingNightRoles,
      currentSpeaker: state.currentSpeaker,
      speakerQueue: state.speakerQueue,
      deadChat: (viewer && !viewer.alive) || isGameEnded ? state.deadChat : [],
      options: state.options,
      roleStates: playerId ? this._getVisibleRoleStates(playerId, state) : {}
    };
  }

  /**
   * Enrich move for history
   * @param {Object} move
   * @param {Object} state
   * @returns {Object}
   */
  enrichMoveForHistory(move, state) {
    const player = state.playerMap[move.playerId];
    return {
      ...move,
      playerName: player?.nickname || move.playerId,
      phase: state.phase,
      round: state.round
    };
  }

  // ─── Private Methods ────────────────────────────────────────

  /**
   * Transition to a new phase
   * @private
   */
  _transitionPhase(state, toPhase) {
    state.phase = toPhase;
    switch (toPhase) {
      case PHASES.NIGHT:
        this._startNight(state);
        break;
      case PHASES.DAY_ANNOUNCE:
        this._startDayAnnounce(state);
        break;
      case PHASES.DAY_DISCUSSION:
        this._startDayDiscussion(state);
        break;
      case PHASES.DAY_VOTE:
        this._startDayVote(state);
        break;
    }
  }

  /**
   * Start night phase
   * @private
   */
  _startNight(state) {
    state.nightActions = {};
    state.wolfVotes = {};
    state.nightDeaths = [];
    state.dayAnnouncements = [];
    state.tiedCandidates = null;
    state.voteRound = 1;
    state.speakerQueue = [];
    state.speakerIndex = -1;
    state.currentSpeaker = null;

    // Populate pending night roles
    const activeRoles = getActiveNightRoles(state);
    state.pendingNightRoles = activeRoles.map(r => r.playerId);

    this._logEvent(state, 'phase_change', {
      phase: PHASES.NIGHT,
      round: state.round
    });
  }

  /**
   * Start day announce phase
   * @private
   */
  _startDayAnnounce(state) {
    this._logEvent(state, 'phase_change', {
      phase: PHASES.DAY_ANNOUNCE,
      round: state.round,
      deaths: state.nightDeaths.map(d => d.playerId)
    });
  }

  /**
   * Start day discussion phase - builds speaker queue
   * @private
   */
  _startDayDiscussion(state) {
    state.votes = {};

    // Build speaker queue: counter-clockwise from victim
    const alive = state.players.filter(p => state.playerMap[p.id].alive);
    const victimIds = (state.nightDeaths || []).map(d => d.playerId);

    // Find starting index: first victim's seat position among alive players,
    // or index 0 if no deaths or victim not in alive list
    let startIdx = 0;
    if (victimIds.length > 0) {
      // Use the first victim's original seat to pick starting neighbor
      const victimSeat = state.players.findIndex(p => p.id === victimIds[0]);
      if (victimSeat !== -1) {
        // Counter-clockwise = decreasing index; find next alive player after victim seat
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

    // Build queue in counter-clockwise (reverse) order from startIdx
    const queue = [];
    for (let i = 0; i < alive.length; i++) {
      const idx = (startIdx + alive.length - i) % alive.length;
      queue.push(alive[idx].id);
    }

    state.speakerQueue = queue;
    state.speakerIndex = 0;
    state.currentSpeaker = queue.length > 0 ? queue[0] : null;

    this._logEvent(state, 'phase_change', {
      phase: PHASES.DAY_DISCUSSION,
      round: state.round,
      speakerQueue: queue
    });
  }

  /**
   * Advance to the next speaker; transition to vote when queue exhausted
   * @private
   */
  _advanceSpeaker(state) {
    state.speakerIndex++;
    if (state.speakerIndex >= state.speakerQueue.length) {
      // All speakers done
      state.currentSpeaker = null;
      this._transitionPhase(state, PHASES.DAY_VOTE);
    } else {
      state.currentSpeaker = state.speakerQueue[state.speakerIndex];
    }
  }

  /**
   * Start day vote phase
   * @private
   */
  _startDayVote(state) {
    state.votes = {};
    this._logEvent(state, 'phase_change', {
      phase: PHASES.DAY_VOTE,
      round: state.round,
      voteRound: state.voteRound
    });
  }

  /**
   * Collect a night action from a player
   * @private
   */
  _collectNightAction(state, move) {
    const { playerId, actionType, actionData } = move;

    state.nightActions[playerId] = { actionType, actionData };

    // Track wolf votes separately for consensus
    if (actionType === ACTION_TYPES.NIGHT_WOLF_KILL) {
      state.wolfVotes[playerId] = actionData?.targetId || null;
    }

    // Update role states for resource tracking
    if (actionType === ACTION_TYPES.NIGHT_WITCH_SAVE) {
      state.roleStates.witchSaveUsed = true;
    }
    if (actionType === ACTION_TYPES.NIGHT_WITCH_POISON) {
      state.roleStates.witchPoisonUsed = true;
    }
    if (actionType === ACTION_TYPES.NIGHT_DOCTOR_PROTECT) {
      state.roleStates.doctorLastProtect = actionData?.targetId || null;
    }

    // Remove from pending
    const idx = state.pendingNightRoles.indexOf(playerId);
    if (idx !== -1) {
      state.pendingNightRoles.splice(idx, 1);
    }
  }

  /**
   * Check if all night actions have been collected
   * @private
   */
  _areAllNightActionsCollected(state) {
    return state.pendingNightRoles.length === 0;
  }

  /**
   * Resolve all night actions
   * @private
   */
  _resolveNight(state) {
    const { deaths, announcements } = resolveNightActions(state);

    state.dayAnnouncements = announcements;
    state.nightDeaths = deaths;

    // Apply deaths and process triggers per-death (cause matters for hunter)
    for (const death of deaths) {
      this._markPlayerDead(state, death.playerId, death.cause);
      this._processDeathTriggers(state, [death.playerId], death.cause);
    }

    state.round++;
  }

  /**
   * Collect a day vote
   * @private
   */
  _collectDayVote(state, move) {
    const { playerId, actionType, actionData } = move;

    if (actionType === ACTION_TYPES.DAY_SKIP_VOTE) {
      state.votes[playerId] = null;
    } else {
      state.votes[playerId] = actionData.targetId;
    }
  }

  /**
   * Check if all day votes have been collected
   * @private
   */
  _areAllDayVotesCollected(state) {
    const alivePlayers = this._getAlivePlayers(state);
    return alivePlayers.every(p => state.votes[p.id] !== undefined);
  }

  /**
   * Resolve day votes
   * @private
   */
  _resolveVotes(state) {
    const result = calculateVoteResult(state.votes, state.options);

    this._logEvent(state, 'vote_result', {
      voteCounts: result.voteCounts,
      executed: result.executed,
      tiedPlayers: result.tiedPlayers,
      voteRound: state.voteRound
    });

    if (result.executed) {
      // Execution
      this._markPlayerDead(state, result.executed, 'execution');
      state.tiedCandidates = null;

      // Check last words eligibility
      if (state.options.lastWordsMode !== 'none' && state.lastWordsRemaining > 0) {
        state.lastWordsRemaining--;
      }

      // Process death triggers
      this._processDeathTriggers(state, [result.executed], 'execution');

      // If no pending triggers, go to night
      if (!state.hunterPendingShoot) {
        this._transitionPhase(state, PHASES.NIGHT);
      }
    } else if (result.tiedPlayers.length > 0 && state.voteRound === 1) {
      // Tie in first vote round -> second vote with tied candidates only
      state.tiedCandidates = result.tiedPlayers;
      state.voteRound = 2;
      state.votes = {};
      state.phase = PHASES.DAY_VOTE;
    } else {
      // No execution (second tie or no votes) -> go to night
      state.tiedCandidates = null;
      this._transitionPhase(state, PHASES.NIGHT);
    }
  }

  /**
   * Mark a player as dead
   * @private
   */
  _markPlayerDead(state, playerId, cause) {
    const player = state.playerMap[playerId];
    if (!player || !player.alive) return;

    player.alive = false;
    player.deathCause = cause;
    player.deathRound = state.round;

    this._logEvent(state, 'death', { playerId, cause, round: state.round });
  }

  /**
   * Process death triggers (hunter shoot, lover cascade, etc.)
   * @private
   */
  _processDeathTriggers(state, deadIds, cause) {
    for (const deadId of deadIds) {
      const deadPlayer = state.playerMap[deadId];
      if (!deadPlayer) continue;

      // Hunter shoot eligibility
      if (deadPlayer.roleId === 'hunter') {
        // Can't shoot if poisoned (unless option enabled)
        const canShoot = cause !== 'witch_poison' ||
                         state.options.hunterShootOnPoison;
        if (canShoot) {
          state.hunterPendingShoot = deadId;
        }
      }

      // Lover cascade (if links exist)
      if (state.links.lovers) {
        const [loverA, loverB] = state.links.lovers;
        let partner = null;
        if (deadId === loverA) partner = loverB;
        if (deadId === loverB) partner = loverA;

        if (partner && state.playerMap[partner]?.alive) {
          this._markPlayerDead(state, partner, 'lover_death');
          // Recursive trigger for partner death
          this._processDeathTriggers(state, [partner], 'lover_death');
        }
      }
    }
  }

  /**
   * Get alive players
   * @private
   */
  _getAlivePlayers(state) {
    return Object.values(state.playerMap).filter(p => p.alive);
  }

  /**
   * Check if viewer can see a target's role
   * @private
   */
  _canSeeRole(viewerId, targetId, state) {
    // Always see own role
    if (viewerId === targetId) return true;

    // Game ended: all revealed
    if (state.phase === PHASES.ENDED) return true;

    // Dead viewer sees all roles
    const viewer = state.playerMap[viewerId];
    if (viewer && !viewer.alive) return true;

    // Dead target + revealOnDeath option
    const target = state.playerMap[targetId];
    if (!target.alive && state.options.revealRolesOnDeath) return true;

    // Wolf sees wolf
    if (viewer?.team === TEAMS.WEREWOLF && target.team === TEAMS.WEREWOLF) {
      return true;
    }

    return false;
  }

  /**
   * Get visible role states for a specific player
   * @private
   */
  _getVisibleRoleStates(playerId, state) {
    const player = state.playerMap[playerId];
    if (!player) return {};

    const visible = {};

    // Witch sees potion status
    if (player.roleId === 'witch') {
      visible.witchSaveUsed = state.roleStates.witchSaveUsed;
      visible.witchPoisonUsed = state.roleStates.witchPoisonUsed;
    }

    return visible;
  }

  /**
   * Get team for a role ID
   * @private
   */
  _getRoleTeam(roleId) {
    const roleConfig = this._getRoleConfig(roleId);
    return roleConfig?.team || TEAMS.VILLAGE;
  }

  /**
   * Get role config from config.json roles across tiers
   * @private
   */
  _getRoleConfig(roleId) {
    for (const tier of ['p0', 'p1', 'p2', 'p3']) {
      if (config.roles[tier]?.[roleId]) {
        return config.roles[tier][roleId];
      }
    }
    return null;
  }

  /**
   * Get default role counts for a player count
   * @private
   */
  _getDefaultRoleCounts(playerCount) {
    const ranges = config.defaultRoleCounts;
    for (const [range, counts] of Object.entries(ranges)) {
      const [min, max] = range.split('-').map(Number);
      if (playerCount >= min && playerCount <= max) {
        return { ...counts };
      }
    }
    // Fallback to largest range
    return { ...Object.values(ranges).pop() };
  }

  /**
   * Log a game event
   * @private
   */
  _logEvent(state, type, data) {
    state.eventLog.push({
      type,
      timestamp: Date.now(),
      round: state.round,
      ...data
    });
  }
}

export default WerewolfGame;
