/**
 * Werewolf Game Implementation
 * @module games/werewolf
 */

import { GameEngine } from '../../game/engine.js';
import {
  ACTION_TYPES,
  PHASES,
  TEAMS,
  ROLE_DEFINITIONS,
  canRoleAct,
  createRolePool,
  getRoleDefinition,
  getTeamCounts,
  isNightPhase
} from './rules.js';
import config from './config.json';

export const WEREWOLF_ACTIONS = {
  ...ACTION_TYPES,
  ADVANCE_PHASE: 'ADVANCE_PHASE'
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class WerewolfGame extends GameEngine {
  constructor(mode = 'offline') {
    super(mode);
    this.config = config;
  }

  initialize(gameConfig) {
    const { players, options = {} } = gameConfig;
    const gameOptions = {
      ...config.rules,
      ...options
    };

    const rolePool = shuffle(createRolePool(players.length, gameOptions));
    const assignedPlayers = players.map((player, index) => {
      const roleId = rolePool[index] || 'villager';
      const role = ROLE_DEFINITIONS[roleId] || ROLE_DEFINITIONS.villager;
      return {
        ...player,
        roleId,
        team: role.team,
        alive: true,
        roleState: {}
      };
    });

    const playerMap = {};
    assignedPlayers.forEach(player => {
      playerMap[player.id] = player;
    });

    return {
      players: assignedPlayers,
      playerMap,
      phase: PHASES.NIGHT,
      round: 1,
      status: 'playing',
      nightActions: {
        wolfKill: null,
        doctorProtect: null,
        seerCheck: null,
        witchSave: false,
        witchPoison: null
      },
      votes: {},
      dayVoteResult: null,
      deaths: [],
      roleStates: {
        witchSaveUsed: false,
        witchPoisonUsed: false
      },
      seerResults: {},
      lastAction: null,
      winner: null,
      currentPlayer: players[0]?.id || null,
      turnNumber: 1,
      direction: 1,
      options: gameOptions
    };
  }

  validateMove(move, state) {
    const { actionType, actionData, playerId } = move;
    const player = state.playerMap[playerId];

    if (state.status !== 'playing') {
      return { valid: false, error: '游戏未在进行中' };
    }

    if (!player) {
      return { valid: false, error: '玩家不存在' };
    }

    if (!player.alive && actionType !== WEREWOLF_ACTIONS.HUNTER_SHOOT) {
      return { valid: false, error: '玩家已死亡' };
    }

    if (actionType === WEREWOLF_ACTIONS.ADVANCE_PHASE) {
      const isHost = state.players.find(p => p.id === playerId)?.isHost;
      if (!isHost) {
        return { valid: false, error: '只有房主可以推进阶段' };
      }
      return { valid: true };
    }

    if (actionType === WEREWOLF_ACTIONS.DAY_VOTE || actionType === WEREWOLF_ACTIONS.DAY_SKIP_VOTE) {
      if (state.phase !== PHASES.DAY_VOTE) {
        return { valid: false, error: '当前不在投票阶段' };
      }
      return { valid: true };
    }

    if (actionType === WEREWOLF_ACTIONS.NIGHT_WITCH_SAVE || actionType === WEREWOLF_ACTIONS.NIGHT_WITCH_POISON) {
      if (!isNightPhase(state.phase)) {
        return { valid: false, error: '当前不是夜晚阶段' };
      }
      if (player.roleId !== 'witch') {
        return { valid: false, error: '非女巫无法使用该技能' };
      }
      if (actionType === WEREWOLF_ACTIONS.NIGHT_WITCH_SAVE && state.roleStates.witchSaveUsed) {
        return { valid: false, error: '女巫解药已用完' };
      }
      if (actionType === WEREWOLF_ACTIONS.NIGHT_WITCH_POISON && state.roleStates.witchPoisonUsed) {
        return { valid: false, error: '女巫毒药已用完' };
      }
      return { valid: true };
    }

    if (actionType.startsWith('NIGHT_')) {
      if (!canRoleAct(player.roleId, actionType, state.phase)) {
        return { valid: false, error: '当前角色无法执行该行动' };
      }
    }

    return { valid: true };
  }

  processMove(move, state) {
    const { actionType, actionData, playerId } = move;
    const newState = clone(state);
    const player = newState.playerMap[playerId];

    if (actionType === WEREWOLF_ACTIONS.ADVANCE_PHASE) {
      this._advancePhase(newState);
      newState.lastAction = { type: 'advance', playerId };
      return newState;
    }

    switch (actionType) {
      case WEREWOLF_ACTIONS.NIGHT_WOLF_KILL:
        newState.nightActions.wolfKill = actionData?.targetId || null;
        break;
      case WEREWOLF_ACTIONS.NIGHT_DOCTOR_PROTECT:
        newState.nightActions.doctorProtect = actionData?.targetId || null;
        break;
      case WEREWOLF_ACTIONS.NIGHT_SEER_CHECK: {
        const targetId = actionData?.targetId || null;
        if (targetId) {
          const target = newState.playerMap[targetId];
          newState.seerResults[playerId] = {
            targetId,
            team: target?.team || TEAMS.VILLAGE
          };
        }
        newState.nightActions.seerCheck = actionData?.targetId || null;
        break;
      }
      case WEREWOLF_ACTIONS.NIGHT_WITCH_SAVE:
        newState.nightActions.witchSave = true;
        newState.roleStates.witchSaveUsed = true;
        break;
      case WEREWOLF_ACTIONS.NIGHT_WITCH_POISON:
        newState.nightActions.witchPoison = actionData?.targetId || null;
        newState.roleStates.witchPoisonUsed = true;
        break;
      case WEREWOLF_ACTIONS.DAY_VOTE:
        newState.votes[playerId] = actionData?.targetId || null;
        if (this._allAliveVoted(newState)) {
          newState.dayVoteResult = this._resolveVotes(newState);
        }
        break;
      case WEREWOLF_ACTIONS.DAY_SKIP_VOTE:
        newState.votes[playerId] = null;
        if (this._allAliveVoted(newState)) {
          newState.dayVoteResult = this._resolveVotes(newState);
        }
        break;
      default:
        break;
    }

    newState.lastAction = { type: actionType, playerId, actionData };
    return newState;
  }

  _allAliveVoted(state) {
    const alive = state.players.filter(p => p.alive);
    return alive.every(p => Object.prototype.hasOwnProperty.call(state.votes, p.id));
  }

  _resolveVotes(state) {
    const tally = {};
    for (const targetId of Object.values(state.votes)) {
      if (!targetId) continue;
      tally[targetId] = (tally[targetId] || 0) + 1;
    }
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return { targetId: null, tally };
    const [topId, topCount] = entries[0];
    const tied = entries.filter(([, count]) => count === topCount).length > 1;
    if (tied) return { targetId: null, tally };
    if (state.options?.dayVoteMajority) {
      const aliveCount = state.players.filter(p => p.alive).length;
      if (topCount <= Math.floor(aliveCount / 2)) {
        return { targetId: null, tally };
      }
    }
    return { targetId: topId, tally };
  }

  _resolveNight(state) {
    const killTarget = state.nightActions.wolfKill;
    const protectedTarget = state.nightActions.doctorProtect;
    const poisonTarget = state.nightActions.witchPoison;

    const deaths = [];

    if (killTarget && killTarget !== protectedTarget) {
      deaths.push(killTarget);
    }

    if (poisonTarget && poisonTarget !== protectedTarget) {
      deaths.push(poisonTarget);
    }

    for (const id of new Set(deaths)) {
      if (state.playerMap[id]) {
        state.playerMap[id].alive = false;
      }
    }

    state.deaths = Array.from(new Set(deaths));
    state.nightActions = {
      wolfKill: null,
      doctorProtect: null,
      seerCheck: null,
      witchSave: false,
      witchPoison: null
    };
    state.votes = {};
    state.dayVoteResult = null;
  }

  _resolveExecution(state) {
    const targetId = state.dayVoteResult?.targetId || null;
    if (targetId && state.playerMap[targetId]) {
      state.playerMap[targetId].alive = false;
      state.deaths = [targetId];
    } else {
      state.deaths = [];
    }
    state.votes = {};
    state.dayVoteResult = null;
  }

  _advancePhase(state) {
    switch (state.phase) {
      case PHASES.NIGHT:
        this._resolveNight(state);
        state.phase = PHASES.DAY_ANNOUNCE;
        break;
      case PHASES.DAY_ANNOUNCE:
        state.phase = PHASES.DAY_DISCUSSION;
        break;
      case PHASES.DAY_DISCUSSION:
        state.phase = PHASES.DAY_VOTE;
        break;
      case PHASES.DAY_VOTE:
        state.phase = PHASES.DAY_EXECUTION;
        break;
      case PHASES.DAY_EXECUTION:
        this._resolveExecution(state);
        state.round += 1;
        state.turnNumber = state.round;
        state.phase = PHASES.NIGHT;
        break;
      default:
        break;
    }

    const endCheck = this.checkGameEnd(state);
    if (endCheck.ended) {
      state.status = 'ended';
      state.phase = PHASES.ENDED;
      state.winner = endCheck.winner;
    }
  }

  checkGameEnd(state) {
    const counts = getTeamCounts(state.playerMap);
    if (counts.werewolf === 0) {
      return { ended: true, winner: TEAMS.VILLAGE };
    }
    if (counts.werewolf >= counts.village) {
      return { ended: true, winner: TEAMS.WEREWOLF };
    }
    return { ended: false, winner: null };
  }

  getVisibleState(playerId) {
    const state = this.state;
    if (!state) return null;

    const me = state.playerMap[playerId];
    const visibleRoles = {};
    if (me) {
      visibleRoles[playerId] = {
        roleId: me.roleId,
        team: me.team
      };
    }

    if (me?.team === TEAMS.WEREWOLF) {
      for (const player of state.players) {
        if (player.team === TEAMS.WEREWOLF) {
          visibleRoles[player.id] = { roleId: player.roleId, team: player.team };
        }
      }
    }

    return {
      ...state,
      playerMap: undefined,
      myRole: me ? { roleId: me.roleId, team: me.team } : null,
      rolesVisible: visibleRoles,
      seerResult: state.seerResults[playerId] || null
    };
  }
}

export default WerewolfGame;
