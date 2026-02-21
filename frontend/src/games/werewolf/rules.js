/**
 * Werewolf Game Rules - Validation
 * @module games/werewolf/rules
 *
 * Role assignment, action validation, and night role queries.
 * Resolution logic (resolveNightActions, calculateVoteResult, checkWinConditions)
 * is in rules-resolution.js.
 */

// Import + re-export resolution functions for backward compatibility
import {
  resolveNightActions,
  calculateVoteResult,
  checkWinConditions
} from './rules-resolution.js';
export { resolveNightActions, calculateVoteResult, checkWinConditions };

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} array
 * @returns {Array} New shuffled array
 */
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Assign roles to players based on roleCounts map
 * @param {Array<{id: string, nickname: string}>} players
 * @param {Object<string, number>} roleCounts - e.g. { werewolf: 2, seer: 1, villager: 3 }
 * @returns {Object<string, string>} Map of playerId -> roleId
 */
export function assignRoles(players, roleCounts) {
  const rolePool = [];
  for (const [roleId, count] of Object.entries(roleCounts)) {
    for (let i = 0; i < count; i++) {
      rolePool.push(roleId);
    }
  }

  // Fill remaining slots with villager
  while (rolePool.length < players.length) {
    rolePool.push('villager');
  }

  const shuffledRoles = shuffle(rolePool);
  const assignments = {};
  players.forEach((player, i) => {
    assignments[player.id] = shuffledRoles[i];
  });
  return assignments;
}

/**
 * Validate a night action
 * @param {Object} move - { playerId, actionType, actionData: { targetId } }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNightAction(move, state) {
  const { playerId, actionType, actionData } = move;
  const player = state.playerMap[playerId];

  if (!player) {
    return { valid: false, error: '玩家不存在' };
  }
  if (!player.alive) {
    return { valid: false, error: '你已死亡，无法行动' };
  }
  if (state.phase !== 'night') {
    return { valid: false, error: '当前不是夜晚阶段' };
  }

  // Check player belongs to current night step
  if (!state.pendingNightRoles?.includes(playerId)) {
    return { valid: false, error: '当前不是你的行动阶段' };
  }

  // Check role matches action
  const roleConfig = _findRoleConfig(player.roleId, state.roleDefinitions);
  if (!roleConfig) {
    return { valid: false, error: '角色配置不存在' };
  }

  // NIGHT_SKIP is always valid for roles with night actions
  if (actionType === 'NIGHT_SKIP') {
    return { valid: true };
  }

  // NIGHT_WOLF_TENTATIVE is a special action for werewolves (not in config actionTypes)
  if (actionType === 'NIGHT_WOLF_TENTATIVE') {
    if (player.roleId !== 'werewolf') {
      return { valid: false, error: '只有狼人可以执行此操作' };
    }
    // Tentative vote can be done anytime during wolf step, even after submitting
    return { valid: true };
  }

  // Check the role is allowed this action
  if (!roleConfig.actionTypes.includes(actionType)) {
    return { valid: false, error: '你的角色不能执行此操作' };
  }

  // Check duplicate submission
  const existingNightAction = state.nightActions[playerId];
  const isWitchAbilityAction =
    actionType === 'NIGHT_WITCH_SAVE' || actionType === 'NIGHT_WITCH_POISON';
  if (existingNightAction && !isWitchAbilityAction) {
    return { valid: false, error: '你已经提交了夜间行动' };
  }
  if (existingNightAction && isWitchAbilityAction) {
    const combinedAction = existingNightAction.actionType === 'NIGHT_WITCH_COMBINED'
      ? existingNightAction.actionData
      : null;
    const usedSave = combinedAction?.usedSave || existingNightAction.actionType === 'NIGHT_WITCH_SAVE';
    const usedPoison =
      combinedAction?.usedPoison ||
      existingNightAction.actionType === 'NIGHT_WITCH_POISON' ||
      Boolean(combinedAction?.poisonTargetId);

    if (actionType === 'NIGHT_WITCH_SAVE' && usedSave) {
      return { valid: false, error: '你已经提交了救人行动' };
    }

    if (actionType === 'NIGHT_WITCH_POISON' && usedPoison) {
      return { valid: false, error: '你已经提交了毒人行动' };
    }
  }

  const targetId = actionData?.targetId;

  // Validate target for actions that require one
  if (_actionRequiresTarget(actionType) && !targetId) {
    return { valid: false, error: '请选择目标' };
  }

  if (targetId) {
    const target = state.playerMap[targetId];
    if (!target) {
      return { valid: false, error: '目标不存在' };
    }
    if (!target.alive) {
      return { valid: false, error: '目标已死亡' };
    }
  }

  // Role-specific validation
  switch (actionType) {
    case 'NIGHT_WOLF_KILL': {
      if (player.roleId !== 'werewolf') {
        return { valid: false, error: '只有狼人可以执行此操作' };
      }
      break;
    }
    // NIGHT_WOLF_TENTATIVE is handled earlier (before actionTypes check)
    case 'NIGHT_DOCTOR_PROTECT': {
      if (!state.options.allowDoctorSelfProtect && targetId === playerId) {
        return { valid: false, error: '医生不能保护自己' };
      }
      if (!state.options.allowRepeatedProtect &&
          state.roleStates?.doctorLastProtect === targetId) {
        return { valid: false, error: '不能连续两晚保护同一人' };
      }
      break;
    }
    case 'NIGHT_BODYGUARD_PROTECT': {
      if (!state.options.allowDoctorSelfProtect && targetId === playerId) {
        return { valid: false, error: '守卫不能保护自己' };
      }
      if (!state.options.allowRepeatedProtect &&
          state.roleStates?.bodyguardLastProtect === targetId) {
        return { valid: false, error: '不能连续两晚保护同一人' };
      }
      break;
    }
    case 'NIGHT_VIGILANTE_KILL': {
      if (targetId === playerId) {
        return { valid: false, error: '义警不能射击自己' };
      }

      if (!state.options.vigilanteCanShootFirstNight && state.round === 1) {
        return { valid: false, error: '义警首夜不能开枪' };
      }

      if (state.roleStates?.vigilanteLocked) {
        return { valid: false, error: '义警已失去射杀能力' };
      }

      if (state.roleStates?.vigilantePendingSuicide) {
        return { valid: false, error: '义警将于今夜反噬死亡，无法执行射杀' };
      }

      const maxShots = state.options?.vigilanteMaxShots ?? 1;
      const shotsUsed = state.roleStates?.vigilanteShotsUsed ?? 0;
      if (shotsUsed >= maxShots) {
        return { valid: false, error: '义警射击次数已用完' };
      }
      break;
    }
    case 'NIGHT_WITCH_SAVE': {
      if (state.roleStates?.witchSaveUsed) {
        return { valid: false, error: '救人药水已用完' };
      }
      if (state.options.witchSaveFirstNightOnly && state.round > 1) {
        return { valid: false, error: '救人药水仅首夜可用' };
      }
      // Must have a wolf kill victim to save
      const wolfTarget = resolveWolfConsensus(state);
      if (!wolfTarget) {
        return { valid: false, error: '今晚无人被袭击，无法使用救人药水' };
      }
      if (!state.options.witchCanSaveSelf && wolfTarget === playerId) {
        return { valid: false, error: '女巫不能自救' };
      }
      break;
    }
    case 'NIGHT_WITCH_POISON': {
      if (state.roleStates?.witchPoisonUsed) {
        return { valid: false, error: '毒药已用完' };
      }
      break;
    }
    case 'NIGHT_SEER_CHECK': {
      if (targetId === playerId) {
        return { valid: false, error: '不能查验自己' };
      }
      break;
    }
    case 'NIGHT_CUPID_LINK': {
      // Cupid can only link on the first night
      if (state.round > 1) {
        return { valid: false, error: '丘比特只能在首夜连结恋人' };
      }
      // Check if already linked
      if (state.roleStates?.cupidLinked) {
        return { valid: false, error: '你已经连结过恋人了' };
      }
      // Must provide exactly 2 lovers
      const lovers = actionData?.lovers;
      if (!lovers || !Array.isArray(lovers) || lovers.length !== 2) {
        return { valid: false, error: '必须选择正好两名玩家成为恋人' };
      }
      // Check both targets exist and are alive
      const [lover1Id, lover2Id] = lovers;
      const lover1 = state.playerMap[lover1Id];
      const lover2 = state.playerMap[lover2Id];
      if (!lover1 || !lover2) {
        return { valid: false, error: '目标玩家不存在' };
      }
      if (!lover1.alive || !lover2.alive) {
        return { valid: false, error: '目标玩家已死亡' };
      }
      // Check no duplicates
      if (lover1Id === lover2Id) {
        return { valid: false, error: '不能选择同一名玩家两次' };
      }
      // Check self-love option
      if (!state.options.cupidCanSelfLove && (lover1Id === playerId || lover2Id === playerId)) {
        return { valid: false, error: '丘比特不能将自己选为恋人' };
      }
      break;
    }
    case 'NIGHT_PIPER_CHARM': {
      const targetIds = actionData?.targetIds;
      if (!Array.isArray(targetIds) || targetIds.length === 0) {
        return { valid: false, error: '必须选择目标玩家' };
      }

      const maxTargets = Math.max(1, state.options?.piperCharmTargetsPerNight ?? 2);
      if (targetIds.length > maxTargets) {
        return { valid: false, error: `每晚最多魅惑 ${maxTargets} 名玩家` };
      }

      const uniqueTargets = new Set(targetIds);
      if (uniqueTargets.size !== targetIds.length) {
        return { valid: false, error: '不能重复选择同一名玩家' };
      }

      const canCharmSelf = Boolean(state.options?.piperCanCharmSelf);
      const canRecharm = Boolean(state.options?.piperCanRecharm);
      const alreadyCharmed = new Set(state.roleStates?.piperCharmedIds || []);

      for (const targetId of targetIds) {
        const target = state.playerMap[targetId];
        if (!target) {
          return { valid: false, error: '目标玩家不存在' };
        }
        if (!target.alive) {
          return { valid: false, error: '目标玩家已死亡' };
        }
        if (!canCharmSelf && targetId === playerId) {
          return { valid: false, error: '魔笛手不能魅惑自己' };
        }
        if (!canRecharm && alreadyCharmed.has(targetId)) {
          return { valid: false, error: '目标已被魅惑' };
        }
      }
      break;
    }
  }

  return { valid: true };
}

/**
 * Check whether a player currently has day-vote rights.
 * @param {Object} state - Game state
 * @param {string} playerId - Player ID
 * @returns {boolean}
 */
export function canPlayerVote(state, playerId) {
  const player = state.playerMap?.[playerId];
  if (!player || !player.alive) {
    return false;
  }

  const revealedIdiots = state.roleStates?.idiotRevealedIds || [];
  return !(player.roleId === 'idiot' && revealedIdiots.includes(playerId));
}

/**
 * Validate a day vote
 * @param {Object} move - { playerId, actionType, actionData: { targetId } }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDayVote(move, state) {
  const { playerId, actionType, actionData } = move;
  const player = state.playerMap[playerId];

  if (!player || !player.alive) {
    return { valid: false, error: '你已死亡，无法投票' };
  }
  if (!canPlayerVote(state, playerId)) {
    return { valid: false, error: '你已失去投票权' };
  }
  if (state.phase !== 'day_vote') {
    return { valid: false, error: '当前不是投票阶段' };
  }
  if (state.currentVoter !== playerId) {
    return { valid: false, error: '还没轮到你投票' };
  }
  if (state.votes[playerId] !== undefined) {
    return { valid: false, error: '你已经投过票了' };
  }

  if (actionType === 'DAY_SKIP_VOTE') {
    return { valid: true };
  }

  const targetId = actionData?.targetId;
  if (!targetId) {
    return { valid: false, error: '请选择投票目标' };
  }

  const target = state.playerMap[targetId];
  if (!target || !target.alive) {
    return { valid: false, error: '目标无效或已死亡' };
  }
  if (targetId === playerId) {
    return { valid: false, error: '不能投票给自己' };
  }

  return { valid: true };
}

/**
 * Get the wolf kill target from consensus (for UI use, e.g. witch panel)
 * @param {Object} state - Game state
 * @returns {string|null} Target player ID or null
 */
export function getWolfTarget(state) {
  return resolveWolfConsensus(state);
}

/**
 * Get active night roles (alive players with night actions), sorted by priority
 * @param {Object} state - Game state
 * @returns {Array<{playerId: string, roleId: string, priority: number}>}
 */
export function getActiveNightRoles(state) {
  const nightPriority = state.nightActionPriority || [];
  const result = [];

  const alivePlayers = Object.values(state.playerMap).filter(p => p.alive);

  for (const player of alivePlayers) {
    const roleConfig = _findRoleConfig(player.roleId, state.roleDefinitions);
    if (!roleConfig || !roleConfig.actionTypes || roleConfig.actionTypes.length === 0) {
      continue;
    }

    // Hunter's HUNTER_SHOOT is passive, not a night action
    const hasNightAction = roleConfig.actionTypes.some(
      a => a.startsWith('NIGHT_')
    );
    if (!hasNightAction) continue;

    // Cupid only acts on first night (before linking)
    if (player.roleId === 'cupid' && state.roleStates?.cupidLinked) {
      continue;
    }

    // Find priority
    let priority = 99;
    for (const entry of nightPriority) {
      if (entry.roles.includes(player.roleId)) {
        priority = entry.priority;
        break;
      }
    }

    result.push({
      playerId: player.id,
      roleId: player.roleId,
      priority
    });
  }

  result.sort((a, b) => a.priority - b.priority);
  return result;
}

/**
 * Resolve wolf consensus from wolf votes
 * @param {Object} state
 * @returns {string|null} Target player ID or null (no consensus / tie)
 */
export function resolveWolfConsensus(state) {
  const wolfVotes = state.wolfVotes || {};
  const voteCounts = {};

  for (const [wolfId, targetId] of Object.entries(wolfVotes)) {
    if (targetId === null) continue; // abstain
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }

  const entries = Object.entries(voteCounts);
  if (entries.length === 0) return null;

  const maxVotes = Math.max(...entries.map(([, c]) => c));
  const topTargets = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);

  // Tie = no kill
  if (topTargets.length > 1) return null;

  return topTargets[0];
}

// ─── Captain Validation Functions ────────────────────────────────

/**
 * Validate captain register action
 * @param {Object} move - { playerId }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCaptainRegister(move, state) {
  const { playerId } = move;

  if (state.phase !== 'captain_register') {
    return { valid: false, error: '当前不是上警阶段' };
  }
  const player = state.playerMap?.[playerId];
  if (!player || !player.alive) {
    return { valid: false, error: '玩家不存在或已死亡' };
  }
  if (state.captainCandidates.includes(playerId)) {
    return { valid: false, error: '你已经上警了' };
  }
  return { valid: true };
}

/**
 * Validate captain withdraw action
 * @param {Object} move - { playerId }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCaptainWithdraw(move, state) {
  const { playerId } = move;

  if (state.phase !== 'captain_register' &&
      state.phase !== 'captain_speech') {
    return { valid: false, error: '当前不是竞选阶段' };
  }
  if (!state.captainCandidates.includes(playerId)) {
    return { valid: false, error: '你不是候选人' };
  }
  return { valid: true };
}

/**
 * Validate captain vote action
 * @param {Object} move - { playerId, actionData: { targetId } }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCaptainVote(move, state) {
  const { playerId, actionData } = move;

  if (state.phase !== 'captain_vote' &&
      state.phase !== 'captain_runoff_vote') {
    return { valid: false, error: '当前不是竞选投票阶段' };
  }
  const player = state.playerMap?.[playerId];
  if (!player || !player.alive) {
    return { valid: false, error: '玩家不存在或已死亡' };
  }
  if (playerId !== state.captainCurrentVoter) {
    return { valid: false, error: '还没轮到你投票' };
  }

  const targetId = actionData?.targetId;
  if (targetId !== undefined && targetId !== null) {
    const candidates = state.phase === 'captain_runoff_vote'
      ? state.captainRunoffCandidates
      : state.captainCandidates;
    if (!candidates.includes(targetId)) {
      return { valid: false, error: '目标不是候选人' };
    }
  }
  return { valid: true };
}

/**
 * Validate captain skip vote action
 * @param {Object} move - { playerId }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCaptainSkipVote(move, state) {
  const { playerId } = move;

  if (state.phase !== 'captain_vote' &&
      state.phase !== 'captain_runoff_vote') {
    return { valid: false, error: '当前不是竞选投票阶段' };
  }
  if (playerId !== state.captainCurrentVoter) {
    return { valid: false, error: '还没轮到你投票' };
  }
  return { valid: true };
}

/**
 * Validate captain transfer action
 * @param {Object} move - { playerId, actionData: { targetId } }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCaptainTransfer(move, state) {
  const { playerId, actionData } = move;

  if (state.phase !== 'captain_transfer') {
    return { valid: false, error: '当前不是警徽移交阶段' };
  }
  if (playerId !== state.captainPlayerId) {
    return { valid: false, error: '你不是警长' };
  }
  const targetId = actionData?.targetId;
  if (!targetId) {
    return { valid: false, error: '请选择继承人' };
  }
  const target = state.playerMap?.[targetId];
  if (!target || !target.alive) {
    return { valid: false, error: '目标不存在或已死亡' };
  }
  return { valid: true };
}

/**
 * Validate captain tear action
 * @param {Object} move - { playerId }
 * @param {Object} state - Game state
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCaptainTear(move, state) {
  const { playerId } = move;

  if (state.phase !== 'captain_transfer') {
    return { valid: false, error: '当前不是警徽移交阶段' };
  }
  if (playerId !== state.captainPlayerId) {
    return { valid: false, error: '你不是警长' };
  }
  return { valid: true };
}

/**
 * Check if an action type requires a target
 * @private
 */
function _actionRequiresTarget(actionType) {
  const noTargetActions = [
    'NIGHT_SKIP',
    'NIGHT_WITCH_SAVE',
    'NIGHT_CUPID_LINK',
    'NIGHT_PIPER_CHARM'
  ];
  return !noTargetActions.includes(actionType);
}

/**
 * Find role config across priority tiers
 * @private
 */
function _findRoleConfig(roleId, roleDefinitions) {
  if (!roleDefinitions) return null;
  for (const tier of ['p0', 'p1', 'p2', 'p3']) {
    if (roleDefinitions[tier]?.[roleId]) {
      return roleDefinitions[tier][roleId];
    }
  }
  return null;
}

export default {
  assignRoles,
  validateNightAction,
  canPlayerVote,
  validateDayVote,
  resolveNightActions,
  calculateVoteResult,
  checkWinConditions,
  getActiveNightRoles,
  getWolfTarget,
  resolveWolfConsensus,
  validateCaptainRegister,
  validateCaptainWithdraw,
  validateCaptainVote,
  validateCaptainSkipVote,
  validateCaptainTransfer,
  validateCaptainTear
};
