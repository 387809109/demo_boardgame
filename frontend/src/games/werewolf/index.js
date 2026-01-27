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
      nightActionsDone: {
        wolfKill: false,
        doctorProtect: false,
        seerCheck: false,
        witchDone: false
      },
      votes: {},
      dayVoteResult: null,
      deaths: [],
      roleStates: {
        witchSaveUsed: false,
        witchPoisonUsed: false,
        lastDoctorProtectTarget: null
      },
      seerResults: {},
      pendingHunterShot: null,
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
      if (state.pendingHunterShot) {
        return { valid: false, error: '猎人需要开枪后才能推进阶段' };
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
      if (actionType === WEREWOLF_ACTIONS.NIGHT_WITCH_SAVE) {
        if (!state.nightActions.wolfKill) {
          return { valid: false, error: '当前没有需要拯救的目标' };
        }
        if (!state.options?.witchCanSaveSelf && state.nightActions.wolfKill === playerId) {
          return { valid: false, error: '女巫不能自救' };
        }
        if (state.options?.witchSaveFirstNightOnly && state.round > 1) {
          return { valid: false, error: '女巫仅首夜可救' };
        }
      }
      if (actionType === WEREWOLF_ACTIONS.NIGHT_WITCH_POISON) {
        const target = actionData?.targetId;
        if (!target || !state.playerMap[target]?.alive) {
          return { valid: false, error: '无效的目标' };
        }
      }
      return { valid: true };
    }

    if (actionType === WEREWOLF_ACTIONS.NIGHT_SKIP) {
      if (!isNightPhase(state.phase)) {
        return { valid: false, error: '当前不是夜晚阶段' };
      }
      return { valid: true };
    }

    if (actionType === WEREWOLF_ACTIONS.HUNTER_SHOOT) {
      if (state.pendingHunterShot !== playerId) {
        return { valid: false, error: '当前无法开枪' };
      }
      const targetId = actionData?.targetId;
      if (!targetId || !state.playerMap[targetId]?.alive) {
        return { valid: false, error: '无效的目标' };
      }
      return { valid: true };
    }

    if (actionType.startsWith('NIGHT_')) {
      if (!canRoleAct(player.roleId, actionType, state.phase)) {
        return { valid: false, error: '当前角色无法执行该行动' };
      }
      const targetId = actionData?.targetId;
      if (targetId && !state.playerMap[targetId]?.alive) {
        return { valid: false, error: '目标已死亡' };
      }
      if (actionType === WEREWOLF_ACTIONS.NIGHT_WOLF_KILL) {
        const target = state.playerMap[targetId];
        if (target?.team === TEAMS.WEREWOLF) {
          return { valid: false, error: '不能击杀狼人同伴' };
        }
      }
      if (actionType === WEREWOLF_ACTIONS.NIGHT_DOCTOR_PROTECT) {
        if (!state.options?.allowDoctorSelfProtect && targetId === playerId) {
          return { valid: false, error: '医生不能自救' };
        }
        if (!state.options?.allowRepeatedProtect && state.roleStates.lastDoctorProtectTarget === targetId) {
          return { valid: false, error: '不能连续守护同一人' };
        }
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
        newState.nightActionsDone.wolfKill = true;
        break;
      case WEREWOLF_ACTIONS.NIGHT_DOCTOR_PROTECT:
        newState.nightActions.doctorProtect = actionData?.targetId || null;
        newState.nightActionsDone.doctorProtect = true;
        newState.roleStates.lastDoctorProtectTarget = actionData?.targetId || null;
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
        newState.nightActionsDone.seerCheck = true;
        break;
      }
      case WEREWOLF_ACTIONS.NIGHT_WITCH_SAVE:
        newState.nightActions.witchSave = true;
        newState.roleStates.witchSaveUsed = true;
        newState.nightActionsDone.witchDone = true;
        break;
      case WEREWOLF_ACTIONS.NIGHT_WITCH_POISON:
        newState.nightActions.witchPoison = actionData?.targetId || null;
        newState.roleStates.witchPoisonUsed = true;
        newState.nightActionsDone.witchDone = true;
        break;
      case WEREWOLF_ACTIONS.NIGHT_SKIP:
        this._markNightDone(newState, player);
        break;
      case WEREWOLF_ACTIONS.HUNTER_SHOOT:
        this._applyDeaths(newState, [actionData?.targetId], { [actionData?.targetId]: 'hunter' });
        newState.pendingHunterShot = null;
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
    if (newState.phase === PHASES.NIGHT) {
      this._checkNightAutoAdvance(newState);
    }
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
    const causes = {};

    if (killTarget && killTarget !== protectedTarget) {
      deaths.push(killTarget);
      causes[killTarget] = 'wolf';
    }

    if (poisonTarget && poisonTarget !== protectedTarget) {
      deaths.push(poisonTarget);
      causes[poisonTarget] = 'poison';
    }

    const uniqueDeaths = Array.from(new Set(deaths));
    this._applyDeaths(state, uniqueDeaths, causes);
    state.nightActions = {
      wolfKill: null,
      doctorProtect: null,
      seerCheck: null,
      witchSave: false,
      witchPoison: null
    };
    state.nightActionsDone = {
      wolfKill: false,
      doctorProtect: false,
      seerCheck: false,
      witchDone: false
    };
    state.votes = {};
    state.dayVoteResult = null;
  }

  _resolveExecution(state) {
    const targetId = state.dayVoteResult?.targetId || null;
    if (targetId && state.playerMap[targetId]) {
      this._applyDeaths(state, [targetId], { [targetId]: 'vote' });
    } else {
      state.deaths = [];
    }
    state.votes = {};
    state.dayVoteResult = null;
  }

  _applyDeaths(state, deaths, causes = {}) {
    const unique = Array.from(new Set(deaths)).filter(Boolean);
    state.deaths = unique;
    for (const id of unique) {
      const target = state.playerMap[id];
      if (!target) continue;
      target.alive = false;
      if (target.roleId === 'hunter') {
        const cause = causes[id];
        if (cause === 'poison' && !state.options?.hunterShootOnPoison) {
          continue;
        }
        state.pendingHunterShot = id;
      }
    }
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

  _markNightDone(state, player) {
    if (!player) return;
    switch (player.roleId) {
      case 'werewolf':
        state.nightActionsDone.wolfKill = true;
        break;
      case 'doctor':
        state.nightActionsDone.doctorProtect = true;
        break;
      case 'seer':
        state.nightActionsDone.seerCheck = true;
        break;
      case 'witch':
        state.nightActionsDone.witchDone = true;
        break;
      default:
        break;
    }
  }

  _checkNightAutoAdvance(state) {
    const aliveRoles = state.players.filter(p => p.alive).map(p => p.roleId);
    const needsWolf = aliveRoles.includes('werewolf');
    const needsDoctor = aliveRoles.includes('doctor');
    const needsSeer = aliveRoles.includes('seer');
    const needsWitch = aliveRoles.includes('witch');

    if (state.pendingHunterShot) return;

    if (needsWolf && !state.nightActionsDone.wolfKill) return;
    if (needsDoctor && !state.nightActionsDone.doctorProtect) return;
    if (needsSeer && !state.nightActionsDone.seerCheck) return;
    if (needsWitch && !state.nightActionsDone.witchDone) return;

    this._advancePhase(state);
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

    const players = state.players.map(player => {
      const visibleRole = visibleRoles[player.id];
      if (visibleRole) {
        return { ...player };
      }
      const { roleId, team, ...rest } = player;
      return { ...rest };
    });

    return {
      ...state,
      players,
      playerMap: undefined,
      myRole: me ? { roleId: me.roleId, team: me.team } : null,
      rolesVisible: visibleRoles,
      seerResult: state.seerResults[playerId] || null
    };
  }
}

export default WerewolfGame;
