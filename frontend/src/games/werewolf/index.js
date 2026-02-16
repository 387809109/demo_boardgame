/**
 * Werewolf Game Implementation
 * @module games/werewolf
 */

import { GameEngine } from '../../game/engine.js';
import {
  assignRoles,
  validateNightAction,
  validateDayVote,
  checkWinConditions
} from './rules.js';
import {
  PHASES,
  transitionPhase,
  calculateFirstSpeaker,
  assignNightLastWords,
  advanceSpeaker,
  advanceNightStep,
  collectDayVote,
  areAllDayVotesCollected,
  resolveVotes,
  buildNightSteps
} from './game-phases.js';
import config from './config.json';

// Re-export PHASES for external use
export { PHASES };

/** Action types */
export const ACTION_TYPES = {
  NIGHT_WOLF_KILL: 'NIGHT_WOLF_KILL',
  NIGHT_WOLF_TENTATIVE: 'NIGHT_WOLF_TENTATIVE',
  NIGHT_SEER_CHECK: 'NIGHT_SEER_CHECK',
  NIGHT_DOCTOR_PROTECT: 'NIGHT_DOCTOR_PROTECT',
  NIGHT_BODYGUARD_PROTECT: 'NIGHT_BODYGUARD_PROTECT',
  NIGHT_CUPID_LINK: 'NIGHT_CUPID_LINK',
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
   * Get helper functions for phase management
   * @private
   */
  _getPhaseHelpers() {
    return {
      logEvent: (state, type, data) => this._logEvent(state, type, data),
      markPlayerDead: (state, playerId, cause) => this._markPlayerDead(state, playerId, cause),
      processDeathTriggers: (state, deadIds, cause) => this._processDeathTriggers(state, deadIds, cause)
    };
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
      lastWordsOrder: options.lastWordsOrder ?? config.rules.lastWordsOrder,
      witchCanSaveSelf: options.witchCanSaveSelf ?? config.rules.witchCanSaveSelf,
      witchSaveFirstNightOnly: options.witchSaveFirstNightOnly ?? config.rules.witchSaveFirstNightOnly,
      guardWitchInteraction: options.guardWitchInteraction ?? config.rules.guardWitchInteraction,
      protectAgainstPoison: options.protectAgainstPoison ?? config.rules.protectAgainstPoison,
      protectAgainstVigilante: options.protectAgainstVigilante ?? config.rules.protectAgainstVigilante,
      cupidCanSelfLove: options.cupidCanSelfLove ?? config.rules.cupidCanSelfLove,
      sameSideLoversSeparate: options.sameSideLoversSeparate ?? config.rules.sameSideLoversSeparate,
      loversNightChat: options.loversNightChat ?? config.rules.loversNightChat
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

    // Build night steps from active roles
    const stateForRoles = {
      playerMap,
      nightActionPriority: config.nightActionPriority,
      roleDefinitions: config.roles
    };

    const nightSteps = buildNightSteps(stateForRoles);
    const pendingNightRoles = nightSteps.length > 0
      ? [...nightSteps[0].playerIds] : [];

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
      wolfTentativeVotes: {},
      nightSteps,
      currentNightStep: 0,
      pendingNightRoles,
      protectedLastNight: null,

      // Day tracking
      votes: {},
      voteRound: 1,
      tiedCandidates: null,
      speakerQueue: [],
      speakerIndex: -1,
      currentSpeaker: null,
      finishedSpeakers: [],
      voterQueue: [],
      voterIndex: -1,
      currentVoter: null,
      baseSpeakerOrder: [],
      awaitingFirstSpeaker: false,
      firstSpeakerId: null,

      // Death & triggers
      nightDeaths: [],
      dayAnnouncements: [],
      hunterPendingShoot: null,
      lastWordsRemaining: initialWolfCount,
      lastWordsPlayerId: null,
      lastWordsQueue: [],
      lastDayExecution: null,

      // Role states
      roleStates: {
        witchSaveUsed: false,
        witchPoisonUsed: false,
        doctorLastProtect: null,
        bodyguardLastProtect: null,
        cupidLinked: false,
        idiotRevealedIds: []
      },
      links: {
        lovers: null
      },

      // Seer check results
      seerChecks: {},
      forcedRevealRoleIds: {},
      publicRevealRoleIds: {},

      // Dead player chat
      deadChat: [],

      // Meta
      initialWolfCount,
      jesterWinnerId: null,
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

    // Actions that dead players can do
    const canDeadPlayerDoAction =
      actionType === ACTION_TYPES.LAST_WORDS ||
      actionType === ACTION_TYPES.HUNTER_SHOOT ||
      actionType === ACTION_TYPES.DEAD_CHAT ||
      (actionType === ACTION_TYPES.PHASE_ADVANCE && state.phase === PHASES.DAY_ANNOUNCE);

    if (!canDeadPlayerDoAction && !player.alive) {
      return { valid: false, error: '你已死亡' };
    }

    // PHASE_ADVANCE validation
    if (actionType === ACTION_TYPES.PHASE_ADVANCE) {
      if (state.phase === PHASES.DAY_ANNOUNCE) {
        if (state.hunterPendingShoot) {
          return { valid: false, error: '等待猎人开枪' };
        }
        if (state.lastWordsPlayerId && playerId !== state.lastWordsPlayerId) {
          return { valid: false, error: '等待遗言玩家结束发言' };
        }
        if (state.awaitingFirstSpeaker && playerId !== state.firstSpeakerId) {
          return { valid: false, error: '等待第一位发言人开始' };
        }
        return { valid: true };
      }
      if (state.phase === PHASES.DAY_DISCUSSION) {
        if (state.currentSpeaker && playerId !== state.currentSpeaker) {
          return { valid: false, error: '等待当前发言人结束' };
        }
        return { valid: true };
      }
      return { valid: false, error: '当前阶段无法推进' };
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
      if (!this._canPlayerUseDeadChat(state, playerId)) {
        return { valid: false, error: '死亡结算未完成，暂不可使用亡者聊天' };
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
    const helpers = this._getPhaseHelpers();

    switch (actionType) {
      case ACTION_TYPES.NIGHT_WOLF_TENTATIVE:
        newState.wolfTentativeVotes[playerId] = actionData?.targetId ?? null;
        break;

      case ACTION_TYPES.NIGHT_WOLF_KILL:
      case ACTION_TYPES.NIGHT_SEER_CHECK:
      case ACTION_TYPES.NIGHT_DOCTOR_PROTECT:
      case ACTION_TYPES.NIGHT_WITCH_SAVE:
      case ACTION_TYPES.NIGHT_WITCH_POISON:
      case ACTION_TYPES.NIGHT_SKIP:
        this._collectNightAction(newState, move);
        if (newState.pendingNightRoles.length === 0) {
          advanceNightStep(newState, helpers);
        }
        break;

      case ACTION_TYPES.DAY_VOTE:
      case ACTION_TYPES.DAY_SKIP_VOTE:
        collectDayVote(newState, move);
        if (areAllDayVotesCollected(newState)) {
          resolveVotes(newState, helpers);
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
        if (newState.phase === PHASES.DAY_ANNOUNCE && !newState.hunterPendingShoot) {
          assignNightLastWords(newState);
          if (newState.lastWordsPlayerId) {
            newState.awaitingFirstSpeaker = false;
            newState.firstSpeakerId = null;
          } else {
            newState.awaitingFirstSpeaker = true;
            calculateFirstSpeaker(newState);
          }
        } else if (!newState.hunterPendingShoot) {
          transitionPhase(newState, PHASES.NIGHT, helpers);
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
        advanceSpeaker(newState, helpers);
        break;

      case ACTION_TYPES.PHASE_ADVANCE:
        if (newState.phase === PHASES.DAY_ANNOUNCE) {
          if (newState.lastWordsPlayerId) {
            const queue = newState.lastWordsQueue || [];
            if (queue.length > 0) {
              newState.lastWordsPlayerId = queue.shift();
              newState.lastWordsQueue = queue;
              newState.awaitingFirstSpeaker = false;
              newState.firstSpeakerId = null;
            } else {
              newState.lastWordsPlayerId = null;
              newState.awaitingFirstSpeaker = true;
              calculateFirstSpeaker(newState);
            }
          } else if (newState.awaitingFirstSpeaker) {
            newState.awaitingFirstSpeaker = false;
            transitionPhase(newState, PHASES.DAY_DISCUSSION, helpers);
          } else {
            transitionPhase(newState, PHASES.DAY_DISCUSSION, helpers);
          }
        } else if (newState.phase === PHASES.DAY_DISCUSSION) {
          transitionPhase(newState, PHASES.DAY_VOTE, helpers);
        }
        break;

      default:
        if (actionType.startsWith('NIGHT_')) {
          this._collectNightAction(newState, move);
          if (newState.pendingNightRoles.length === 0) {
            advanceNightStep(newState, helpers);
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

    const winnerIds = new Set(result.winnerPlayerIds || []);
    const rankings = Object.values(state.playerMap).map(p => {
      const isWinner = winnerIds.size > 0
        ? winnerIds.has(p.id)
        : p.team === result.winner;
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
   * Get visible state for a player
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

    // Viewer's own role
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

    // Night action feedback
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
      nightSteps: state.nightSteps || [],
      currentNightStep: state.currentNightStep ?? 0,
      wolfVotes: (viewer?.team === TEAMS.WEREWOLF && state.phase === PHASES.NIGHT)
        ? state.wolfVotes : {},
      wolfTentativeVotes: (viewer?.team === TEAMS.WEREWOLF && state.phase === PHASES.NIGHT)
        ? state.wolfTentativeVotes : {},
      currentSpeaker: state.currentSpeaker,
      speakerQueue: state.speakerQueue,
      finishedSpeakers: state.finishedSpeakers || [],
      currentVoter: state.currentVoter,
      voterQueue: state.voterQueue,
      deadChat: this._canPlayerUseDeadChat(state, playerId) || isGameEnded ? state.deadChat : [],
      deadChatEnabled: this._canPlayerUseDeadChat(state, playerId) || isGameEnded,
      options: state.options,
      roleStates: playerId ? this._getVisibleRoleStates(playerId, state) : {},
      seerChecks: viewer?.roleId === 'seer' ? (state.seerChecks || {}) : {},
      lastWordsPlayerId: state.lastWordsPlayerId,
      awaitingFirstSpeaker: state.awaitingFirstSpeaker,
      firstSpeakerId: state.firstSpeakerId,
      lastDayExecution: state.lastDayExecution,
      nightActions: state.nightActions
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
   * Collect a night action from a player
   * @private
   */
  _collectNightAction(state, move) {
    const { playerId, actionType, actionData } = move;
    const player = state.playerMap[playerId];
    const isWitch = player?.roleId === 'witch';
    const isWitchAbilityAction =
      actionType === ACTION_TYPES.NIGHT_WITCH_SAVE ||
      actionType === ACTION_TYPES.NIGHT_WITCH_POISON;

    // Witch can submit save + poison in the same night step.
    if (isWitch && isWitchAbilityAction) {
      const existing = state.nightActions[playerId];
      const combined = existing?.actionType === 'NIGHT_WITCH_COMBINED'
        ? { ...existing.actionData }
        : {
            usedSave: false,
            usedPoison: false,
            poisonTargetId: null
          };

      if (actionType === ACTION_TYPES.NIGHT_WITCH_SAVE) {
        combined.usedSave = true;
        state.roleStates.witchSaveUsed = true;
      }

      if (actionType === ACTION_TYPES.NIGHT_WITCH_POISON) {
        combined.usedPoison = true;
        combined.poisonTargetId = actionData?.targetId || null;
        state.roleStates.witchPoisonUsed = true;
      }

      state.nightActions[playerId] = {
        actionType: 'NIGHT_WITCH_COMBINED',
        actionData: combined
      };

      // Witch step ends only when player explicitly submits NIGHT_SKIP.
      return;
    } else {
      const existing = state.nightActions[playerId];
      const shouldKeepWitchCombinedAction =
        isWitch &&
        actionType === ACTION_TYPES.NIGHT_SKIP &&
        existing?.actionType === 'NIGHT_WITCH_COMBINED';

      if (!shouldKeepWitchCombinedAction) {
        state.nightActions[playerId] = { actionType, actionData };
      }
    }

    // Track wolf votes
    if (actionType === ACTION_TYPES.NIGHT_WOLF_KILL) {
      state.wolfVotes[playerId] = actionData?.targetId || null;
      delete state.wolfTentativeVotes[playerId];
    }

    // Wolf abstain should also be visible to teammates.
    if (actionType === ACTION_TYPES.NIGHT_SKIP && player?.roleId === 'werewolf') {
      state.wolfVotes[playerId] = null;
      delete state.wolfTentativeVotes[playerId];
    }

    // Seer check: immediately reveal
    if (actionType === ACTION_TYPES.NIGHT_SEER_CHECK && actionData?.targetId) {
      const target = state.playerMap[actionData.targetId];
      if (target) {
        state.dayAnnouncements.push({
          type: 'seer_result',
          playerId,
          targetId: actionData.targetId,
          result: target.team
        });
        state.seerChecks[actionData.targetId] = target.team;
      }
    }

    // Update role states
    if (actionType === ACTION_TYPES.NIGHT_DOCTOR_PROTECT) {
      state.roleStates.doctorLastProtect = actionData?.targetId || null;
    }
    if (actionType === ACTION_TYPES.NIGHT_BODYGUARD_PROTECT) {
      state.roleStates.bodyguardLastProtect = actionData?.targetId || null;
    }

    // Cupid link: create lovers
    if (actionType === ACTION_TYPES.NIGHT_CUPID_LINK && actionData?.lovers) {
      const [lover1Id, lover2Id] = actionData.lovers;
      state.links.lovers = [lover1Id, lover2Id];
      state.roleStates.cupidLinked = true;

      const lover1 = state.playerMap[lover1Id];
      const lover2 = state.playerMap[lover2Id];

      // Check if cross-faction lovers
      const isCrossFaction = lover1.team !== lover2.team;
      const sameFactionSeparate = state.options.sameSideLoversSeparate;

      if (isCrossFaction || sameFactionSeparate) {
        // Update teams to "lovers" (they leave their original factions)
        lover1.team = 'lovers';
        lover2.team = 'lovers';
      }

      // Notify both lovers
      state.dayAnnouncements.push({
        type: 'lovers_linked',
        lovers: [lover1Id, lover2Id],
        message: '恋人已连结'
      });
    }

    // Remove from pending
    const idx = state.pendingNightRoles.indexOf(playerId);
    if (idx !== -1) {
      state.pendingNightRoles.splice(idx, 1);
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
   * Process death triggers
   * @private
   */
  _processDeathTriggers(state, deadIds, cause) {
    for (const deadId of deadIds) {
      const deadPlayer = state.playerMap[deadId];
      if (!deadPlayer) continue;

      // Hunter shoot eligibility
      if (deadPlayer.roleId === 'hunter') {
        // Hunter cannot shoot if death is from lover martyrdom
        if (cause === 'lover_death') {
          // Martyrdom takes priority over hunter ability
          continue;
        }
        const canShoot = cause !== 'witch_poison' ||
                         state.options.hunterShootOnPoison;
        if (canShoot) {
          state.hunterPendingShoot = deadId;
          if (cause === 'wolf_kill' || cause === 'witch_poison') {
            state.forcedRevealRoleIds = state.forcedRevealRoleIds || {};
            state.forcedRevealRoleIds[deadId] = true;
          }
        }
      }

      // Lover cascade
      if (state.links.lovers) {
        const [loverA, loverB] = state.links.lovers;
        let partner = null;
        if (deadId === loverA) partner = loverB;
        if (deadId === loverB) partner = loverA;

        if (partner && state.playerMap[partner]?.alive) {
          this._markPlayerDead(state, partner, 'lover_death');
          this._processDeathTriggers(state, [partner], 'lover_death');
        }
      }
    }
  }

  /**
   * Check if viewer can see a target's role
   * @private
   */
  _canSeeRole(viewerId, targetId, state) {
    if (viewerId === targetId) return true;
    if (state.phase === PHASES.ENDED) return true;
    if (state.publicRevealRoleIds?.[targetId]) return true;

    const viewer = state.playerMap[viewerId];
    if (viewer && !viewer.alive) {
      // Dead players can only see all roles after their own death settlement completes.
      return this._canPlayerUseDeadChat(state, viewerId);
    }

    const target = state.playerMap[targetId];
    if (target?.alive === false && state.forcedRevealRoleIds?.[targetId]) return true;
    if (!target.alive && state.options.revealRolesOnDeath) return true;

    if (viewer?.team === TEAMS.WEREWOLF && target.team === TEAMS.WEREWOLF) {
      return true;
    }

    return false;
  }

  /**
   * Whether a dead player can use dead chat.
   * Dead chat unlocks only after that player's death settlement is complete.
   * @private
   */
  _canPlayerUseDeadChat(state, playerId) {
    const player = state.playerMap[playerId];
    if (!player || player.alive) return false;

    if (state.hunterPendingShoot === playerId) return false;
    if (state.lastWordsPlayerId === playerId) return false;
    if ((state.lastWordsQueue || []).includes(playerId)) return false;

    return true;
  }

  /**
   * Get visible role states for a player
   * @private
   */
  _getVisibleRoleStates(playerId, state) {
    const player = state.playerMap[playerId];
    if (!player) return {};

    const visible = {};

    if (player.roleId === 'witch') {
      visible.witchSaveUsed = state.roleStates.witchSaveUsed;
      visible.witchPoisonUsed = state.roleStates.witchPoisonUsed;
    }

    if (player.roleId === 'doctor') {
      visible.doctorLastProtect = state.roleStates.doctorLastProtect;
    }

    if (player.roleId === 'idiot') {
      const revealedIds = state.roleStates?.idiotRevealedIds || [];
      visible.idiotRevealed = revealedIds.includes(playerId);
    }

    return visible;
  }

  /**
   * Get role config
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
   * Get default role counts
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
