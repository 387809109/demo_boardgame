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
  isDayPhase,
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
    if (gameOptions.roleCounts) {
      const enabled = new Set(gameOptions.enabledRoles || []);
      Object.keys(gameOptions.roleCounts).forEach(roleId => enabled.add(roleId));
      gameOptions.enabledRoles = Array.from(enabled);
    }

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
        bodyguardProtect: null,
        seerCheck: null,
        sheriffCheck: null,
        vigilanteKill: null,
        witchSave: false,
        witchPoison: null,
        piperCharm: null
      },
      nightActionsDone: {
        wolfKill: false,
        doctorProtect: false,
        bodyguardProtect: false,
        seerCheck: false,
        sheriffCheck: false,
        vigilanteKill: false,
        witchDone: false,
        piperCharm: false,
        cupidLink: false
      },
      votes: {},
      dayVoteResult: null,
      deaths: [],
      links: {
        lovers: []
      },
      charmed: [],
      roleStates: {
        witchSaveUsed: false,
        witchPoisonUsed: false,
        lastDoctorProtectTarget: null,
        lastBodyguardProtectTarget: null
      },
      seerResults: {},
      sheriffResults: {},
      pendingHunterShot: null,
      lastAction: null,
      winner: null,
      winReason: null,
      captainId: null,
      captainRevealed: false,
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

    if (actionType === WEREWOLF_ACTIONS.DAY_REVEAL_CAPTAIN) {
      if (!isDayPhase(state.phase)) {
        return { valid: false, error: '当前不在白天阶段' };
      }
      if (player.roleId !== 'captain') {
        return { valid: false, error: '非队长无法公开身份' };
      }
      if (state.captainRevealed) {
        return { valid: false, error: '队长身份已公开' };
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

    if (actionType === WEREWOLF_ACTIONS.NIGHT_CUPID_LINK) {
      if (!isNightPhase(state.phase)) {
        return { valid: false, error: '当前不是夜晚阶段' };
      }
      if (player.roleId !== 'cupid') {
        return { valid: false, error: '非丘比特无法连结' };
      }
      if (state.links?.lovers?.length) {
        return { valid: false, error: '丘比特已完成连结' };
      }
      if (state.round > 1) {
        return { valid: false, error: '丘比特仅首夜可行动' };
      }
      const targets = actionData?.targetIds || [];
      if (!Array.isArray(targets) || targets.length !== 2) {
        return { valid: false, error: '请选择两名目标' };
      }
      const [a, b] = targets;
      if (!a || !b || a === b) {
        return { valid: false, error: '目标不合法' };
      }
      if (!state.playerMap[a]?.alive || !state.playerMap[b]?.alive) {
        return { valid: false, error: '目标已死亡' };
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
      if (actionType === WEREWOLF_ACTIONS.NIGHT_BODYGUARD_PROTECT) {
        if (!state.options?.allowDoctorSelfProtect && targetId === playerId) {
          return { valid: false, error: '守卫不能自守' };
        }
        if (!state.options?.allowRepeatedProtect && state.roleStates.lastBodyguardProtectTarget === targetId) {
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
      case WEREWOLF_ACTIONS.NIGHT_BODYGUARD_PROTECT:
        newState.nightActions.bodyguardProtect = actionData?.targetId || null;
        newState.nightActionsDone.bodyguardProtect = true;
        newState.roleStates.lastBodyguardProtectTarget = actionData?.targetId || null;
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
      case WEREWOLF_ACTIONS.NIGHT_SHERIFF_CHECK: {
        const targetId = actionData?.targetId || null;
        if (targetId) {
          const target = newState.playerMap[targetId];
          newState.sheriffResults[playerId] = {
            targetId,
            suspicion: target?.team === TEAMS.WEREWOLF ? 'suspicious' : 'innocent'
          };
        }
        newState.nightActions.sheriffCheck = actionData?.targetId || null;
        newState.nightActionsDone.sheriffCheck = true;
        break;
      }
      case WEREWOLF_ACTIONS.NIGHT_VIGILANTE_KILL:
        newState.nightActions.vigilanteKill = actionData?.targetId || null;
        newState.nightActionsDone.vigilanteKill = true;
        break;
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
      case WEREWOLF_ACTIONS.NIGHT_PIPER_CHARM:
        newState.nightActions.piperCharm = actionData?.targetId || null;
        newState.nightActionsDone.piperCharm = true;
        break;
      case WEREWOLF_ACTIONS.NIGHT_CUPID_LINK:
        newState.links = newState.links || { lovers: [] };
        newState.links.lovers = [...(actionData?.targetIds || [])];
        newState.nightActionsDone.cupidLink = true;
        break;
      case WEREWOLF_ACTIONS.NIGHT_SKIP:
        this._markNightDone(newState, player);
        break;
      case WEREWOLF_ACTIONS.HUNTER_SHOOT:
        this._applyDeaths(newState, [actionData?.targetId], { [actionData?.targetId]: 'hunter' });
        newState.pendingHunterShot = null;
        break;
      case WEREWOLF_ACTIONS.DAY_REVEAL_CAPTAIN:
        newState.captainId = playerId;
        newState.captainRevealed = true;
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
    for (const [voterId, targetId] of Object.entries(state.votes)) {
      if (!targetId) continue;
      const weight = state.captainRevealed && voterId === state.captainId ? 2 : 1;
      tally[targetId] = (tally[targetId] || 0) + weight;
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
    const protectedTargets = new Set([state.nightActions.doctorProtect, state.nightActions.bodyguardProtect].filter(Boolean));
    const vigilanteTarget = state.nightActions.vigilanteKill;
    const poisonTarget = state.nightActions.witchPoison;
    const charmTarget = state.nightActions.piperCharm;

    const deaths = [];
    const causes = {};

    const isProtected = targetId => protectedTargets.has(targetId);
    if (killTarget && !isProtected(killTarget)) {
      deaths.push(killTarget);
      causes[killTarget] = 'wolf';
    }

    if (vigilanteTarget && !isProtected(vigilanteTarget)) {
      deaths.push(vigilanteTarget);
      causes[vigilanteTarget] = 'vigilante';
    }

    if (poisonTarget && !isProtected(poisonTarget)) {
      deaths.push(poisonTarget);
      causes[poisonTarget] = 'poison';
    }

    if (charmTarget && state.playerMap[charmTarget]?.alive) {
      const next = new Set(state.charmed || []);
      next.add(charmTarget);
      state.charmed = Array.from(next);
    }

    const uniqueDeaths = Array.from(new Set(deaths));
    this._applyDeaths(state, uniqueDeaths, causes);
    state.nightActions = {
      wolfKill: null,
      doctorProtect: null,
      bodyguardProtect: null,
      seerCheck: null,
      sheriffCheck: null,
      vigilanteKill: null,
      witchSave: false,
      witchPoison: null,
      piperCharm: null
    };
    state.nightActionsDone = {
      wolfKill: false,
      doctorProtect: false,
      bodyguardProtect: false,
      seerCheck: false,
      sheriffCheck: false,
      vigilanteKill: false,
      witchDone: false,
      piperCharm: false,
      cupidLink: state.links?.lovers?.length ? true : false
    };
    state.votes = {};
    state.dayVoteResult = null;
  }

  _resolveExecution(state) {
    const targetId = state.dayVoteResult?.targetId || null;
    if (targetId && state.playerMap[targetId]) {
      if (state.playerMap[targetId].roleId === 'idiot') {
        this._applyDeaths(state, [targetId], { [targetId]: 'vote' });
        state.status = 'ended';
        state.phase = PHASES.ENDED;
        state.winner = TEAMS.NEUTRAL;
        state.winReason = 'idiot_vote';
        return;
      }
      this._applyDeaths(state, [targetId], { [targetId]: 'vote' });
    } else {
      state.deaths = [];
    }
    state.votes = {};
    state.dayVoteResult = null;
  }

  _applyDeaths(state, deaths, causes = {}) {
    const expanded = new Set(deaths.filter(Boolean));
    const lovers = state.links?.lovers || [];
    if (lovers.length === 2) {
      const [a, b] = lovers;
      if (expanded.has(a) && !expanded.has(b)) expanded.add(b);
      if (expanded.has(b) && !expanded.has(a)) expanded.add(a);
    }
    const unique = Array.from(expanded);
    state.deaths = unique;
    for (const id of unique) {
      const target = state.playerMap[id];
      if (!target) continue;
      target.alive = false;
      if (state.captainId === id) {
        state.captainId = null;
        state.captainRevealed = false;
      }
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

    if (state.status === 'ended') return;

    const endCheck = this.checkGameEnd(state);
    if (endCheck.ended) {
      state.status = 'ended';
      state.phase = PHASES.ENDED;
      state.winner = endCheck.winner;
      state.winReason = endCheck.reason || null;
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
      case 'bodyguard':
        state.nightActionsDone.bodyguardProtect = true;
        break;
      case 'seer':
        state.nightActionsDone.seerCheck = true;
        break;
      case 'sheriff':
        state.nightActionsDone.sheriffCheck = true;
        break;
      case 'vigilante':
        state.nightActionsDone.vigilanteKill = true;
        break;
      case 'witch':
        state.nightActionsDone.witchDone = true;
        break;
      case 'piper':
        state.nightActionsDone.piperCharm = true;
        break;
      case 'cupid':
        state.nightActionsDone.cupidLink = true;
        break;
      default:
        break;
    }
  }

  _checkNightAutoAdvance(state) {
    const aliveRoles = state.players.filter(p => p.alive).map(p => p.roleId);
    const needsWolf = aliveRoles.includes('werewolf');
    const needsDoctor = aliveRoles.includes('doctor');
    const needsBodyguard = aliveRoles.includes('bodyguard');
    const needsSeer = aliveRoles.includes('seer');
    const needsSheriff = aliveRoles.includes('sheriff');
    const needsVigilante = aliveRoles.includes('vigilante');
    const needsWitch = aliveRoles.includes('witch');
    const needsPiper = aliveRoles.includes('piper');
    const needsCupid = aliveRoles.includes('cupid') && state.round === 1 && !(state.links?.lovers?.length);

    if (state.pendingHunterShot) return;

    if (needsWolf && !state.nightActionsDone.wolfKill) return;
    if (needsDoctor && !state.nightActionsDone.doctorProtect) return;
    if (needsBodyguard && !state.nightActionsDone.bodyguardProtect) return;
    if (needsSeer && !state.nightActionsDone.seerCheck) return;
    if (needsSheriff && !state.nightActionsDone.sheriffCheck) return;
    if (needsVigilante && !state.nightActionsDone.vigilanteKill) return;
    if (needsWitch && !state.nightActionsDone.witchDone) return;
    if (needsPiper && !state.nightActionsDone.piperCharm) return;
    if (needsCupid && !state.nightActionsDone.cupidLink) return;

    this._advancePhase(state);
  }

  checkGameEnd(state) {
    if (state.status === 'ended' && state.winner) {
      return { ended: true, winner: state.winner, reason: state.winReason || '' };
    }

    const lovers = state.links?.lovers || [];
    if (lovers.length === 2) {
      const aliveIds = Object.values(state.playerMap).filter(p => p.alive).map(p => p.id);
      if (aliveIds.length === 2 && lovers.every(id => aliveIds.includes(id))) {
        return { ended: true, winner: TEAMS.NEUTRAL, reason: 'lovers_last_alive' };
      }
    }

    const alivePlayers = Object.values(state.playerMap).filter(p => p.alive);
    const piperAlive = alivePlayers.some(p => p.roleId === 'piper');
    if (piperAlive) {
      const charmed = new Set(state.charmed || []);
      const allCharmed = alivePlayers
        .filter(p => p.roleId !== 'piper')
        .every(p => charmed.has(p.id));
      if (allCharmed) {
        return { ended: true, winner: TEAMS.NEUTRAL, reason: 'piper_charm' };
      }
    }

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
      seerResult: state.seerResults[playerId] || null,
      sheriffResult: state.sheriffResults[playerId] || null,
      charmedVisible: me?.roleId === 'piper' ? state.charmed : null
    };
  }
}

export default WerewolfGame;
