/**
 * Werewolf Game Rules (P0 Stub)
 * @module games/werewolf/rules
 */

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
 * Resolve all night actions and produce outcomes.
 * Resolution follows RULES.md section 10.4 protection priority:
 *   1. Collect kill events (wolf_kill, witch_poison)
 *   2. Collect protection events (doctor_protect)
 *   3. Resolve seer check
 *   4. Apply protections (doctor blocks wolf_kill)
 *   5. Witch save (cancels wolf_kill death)
 *   6. Witch poison (bypasses all protection)
 *   7. Compile final deaths + announcements
 * @param {Object} state - Game state with nightActions populated
 * @returns {{ deaths: Array<{playerId: string, cause: string}>, announcements: Array<Object> }}
 */
export function resolveNightActions(state) {
  const announcements = [];
  const kills = [];
  state.roleStates.piperLastCharmedIds = [];

  // ── Step 0: Resolve vigilante recoil from previous misfire ──
  if (state.roleStates?.vigilantePendingSuicide) {
    const aliveVigilantes = Object.values(state.playerMap).filter(
      player => player.alive && player.roleId === 'vigilante'
    );

    for (const vigilante of aliveVigilantes) {
      kills.push({
        targetId: vigilante.id,
        cause: 'vigilante_recoil',
        bypassesProtection: true
      });
      announcements.push({
        type: 'vigilante_recoil',
        playerId: vigilante.id,
        message: '义警因误杀反噬而死亡'
      });
    }
    // Consumed once per next-night settlement.
    state.roleStates.vigilantePendingSuicide = false;
  }

  // ── Step 1: Resolve wolf consensus ──
  const wolfTarget = resolveWolfConsensus(state);

  // ── Step 2: Collect all kill events ──
  if (wolfTarget) {
    kills.push({ targetId: wolfTarget, cause: 'wolf_kill', bypassesProtection: false });
  }

  // Vigilante kill
  for (const [, action] of Object.entries(state.nightActions)) {
    if (action.actionType === 'NIGHT_VIGILANTE_KILL' && action.actionData?.targetId) {
      kills.push({
        targetId: action.actionData.targetId,
        cause: 'vigilante_kill',
        bypassesProtection: !state.options.protectAgainstVigilante
      });
    }
  }

  // Witch poison — collected here, added to deaths in step 7
  let poisonTargetId = null;
  for (const [, action] of Object.entries(state.nightActions)) {
    if (action.actionType === 'NIGHT_WITCH_POISON' && action.actionData?.targetId) {
      poisonTargetId = action.actionData.targetId;
      kills.push({
        targetId: poisonTargetId,
        cause: 'witch_poison',
        bypassesProtection: true
      });
    }
    if (action.actionType === 'NIGHT_WITCH_COMBINED' && action.actionData?.poisonTargetId) {
      poisonTargetId = action.actionData.poisonTargetId;
      kills.push({
        targetId: poisonTargetId,
        cause: 'witch_poison',
        bypassesProtection: true
      });
    }
  }

  // ── Step 3: Collect protection events ──
  const protections = [];
  for (const [, action] of Object.entries(state.nightActions)) {
    if (action.actionType === 'NIGHT_DOCTOR_PROTECT' && action.actionData?.targetId) {
      protections.push({ targetId: action.actionData.targetId, type: 'doctor_protect' });
    }
    if (action.actionType === 'NIGHT_BODYGUARD_PROTECT' && action.actionData?.targetId) {
      protections.push({ targetId: action.actionData.targetId, type: 'bodyguard_protect' });
    }
  }

  // ── Step 4: Seer check ──
  // (seer_result is now added immediately in _collectNightAction;
  //  no duplicate generation here)

  // ── Step 5: Apply protections to kills ──
  // Doctor protection blocks non-bypassing kills
  const protectedIds = new Set(protections.map(p => p.targetId));
  for (const kill of kills) {
    if (!kill.bypassesProtection && protectedIds.has(kill.targetId)) {
      kill.cancelled = true;
      announcements.push({
        type: 'protection',
        targetId: kill.targetId,
        message: '保护成功'
      });
    }
  }

  // ── Step 6: Witch save — cancels wolf_kill death ──
  let witchUsedSave = false;
  for (const [, action] of Object.entries(state.nightActions)) {
    if (
      action.actionType === 'NIGHT_WITCH_SAVE' ||
      (action.actionType === 'NIGHT_WITCH_COMBINED' && action.actionData?.usedSave)
    ) {
      // Find wolf kill regardless of whether it's already cancelled (for guard-witch conflict detection)
      const wolfKill = kills.find(k => k.cause === 'wolf_kill');
      if (wolfKill) {
        wolfKill.cancelled = true;
        witchUsedSave = true;
        announcements.push({
          type: 'witch_save',
          message: '女巫救人成功'
        });
      }
    }
  }

  // ── Step 6.5: Guard-Witch Interaction (if conflict mode) ──
  // If guardWitchInteraction = "conflict", check if bodyguard + witch save both acted on wolf victim
  if (state.options.guardWitchInteraction === 'conflict' && witchUsedSave && wolfTarget) {
    const bodyguardProtectedWolfTarget = protections.some(
      p => p.type === 'bodyguard_protect' && p.targetId === wolfTarget
    );
    if (bodyguardProtectedWolfTarget) {
      // Both bodyguard and witch protected the wolf victim → conflict, target dies
      const wolfKill = kills.find(k => k.cause === 'wolf_kill');
      if (wolfKill && wolfKill.cancelled) {
        // Re-enable the wolf kill (cancel the protections)
        wolfKill.cancelled = false;
        announcements.push({
          type: 'guard_witch_conflict',
          targetId: wolfTarget,
          message: '守卫与女巫同时保护，目标死亡'
        });
      }
    }
  }

  // ── Step 7: Compile final deaths ──
  const deaths = kills
    .filter(k => !k.cancelled)
    .map(k => ({ playerId: k.targetId, cause: k.cause }));

  // ── Step 7.5: Apply piper charm after final deaths are determined ──
  const {
    charmedIds,
    lastCharmedIds,
    charmAnnouncements
  } = _resolvePiperCharm(state, deaths);
  state.roleStates.piperCharmedIds = charmedIds;
  state.roleStates.piperLastCharmedIds = lastCharmedIds;
  announcements.push(...charmAnnouncements);

  // ── Step 8: Apply vigilante misfire penalty ──
  const misfirePenalty = state.options?.vigilanteMisfirePenalty || 'suicide_next_night';
  if (misfirePenalty !== 'none') {
    for (const [actorId, action] of Object.entries(state.nightActions)) {
      if (action.actionType !== 'NIGHT_VIGILANTE_KILL' || !action.actionData?.targetId) {
        continue;
      }

      const targetId = action.actionData.targetId;
      const targetDiedFromVigilante = deaths.some(
        d => d.playerId === targetId && d.cause === 'vigilante_kill'
      );
      if (!targetDiedFromVigilante) {
        continue;
      }

      const targetPlayer = state.playerMap[targetId];
      if (!targetPlayer) {
        continue;
      }

      const targetRoleConfig = _findRoleConfig(targetPlayer.roleId, state.roleDefinitions);
      const targetRoleFaction = targetRoleConfig?.team || targetPlayer.team;
      if (targetRoleFaction !== 'village') {
        continue;
      }

      if (misfirePenalty === 'lose_ability') {
        state.roleStates.vigilanteLocked = true;
      } else if (misfirePenalty === 'suicide_next_night') {
        const actor = state.playerMap[actorId];
        if (actor?.alive) {
          state.roleStates.vigilantePendingSuicide = true;
        }
      }

      announcements.push({
        type: 'vigilante_misfire',
        playerId: actorId,
        targetId,
        penalty: misfirePenalty,
        message: '义警误杀好人，触发惩罚'
      });
    }
  }

  return { deaths, announcements };
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
 * Calculate vote result from collected votes
 * @param {Object<string, string|null>} votes - voterId -> targetId (null = abstain)
 * @param {Object} options - { dayVoteMajority: boolean }
 * @returns {{ executed: string|null, tiedPlayers: string[], voteCounts: Object }}
 */
export function calculateVoteResult(votes, options = {}) {
  const voteCounts = {};
  let abstainCount = 0;

  for (const [voterId, targetId] of Object.entries(votes)) {
    if (targetId === null) {
      abstainCount++;
    } else {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
  }

  // Find max votes
  const entries = Object.entries(voteCounts);
  if (entries.length === 0) {
    return { executed: null, tiedPlayers: [], voteCounts };
  }

  const maxVotes = Math.max(...entries.map(([, count]) => count));
  const topPlayers = entries
    .filter(([, count]) => count === maxVotes)
    .map(([playerId]) => playerId);

  // Majority rule check
  if (options.dayVoteMajority && maxVotes <= abstainCount) {
    return { executed: null, tiedPlayers: [], voteCounts };
  }

  // Tie
  if (topPlayers.length > 1) {
    return { executed: null, tiedPlayers: topPlayers, voteCounts };
  }

  return { executed: topPlayers[0], tiedPlayers: [], voteCounts };
}

/**
 * Check win conditions
 * @param {Object} state - Game state
 * @returns {{ ended: boolean, winner?: string, reason?: string }}
 */
export function checkWinConditions(state) {
  if (state.jesterWinnerId) {
    return {
      ended: true,
      winner: 'jester',
      reason: 'jester_executed',
      winnerPlayerIds: [state.jesterWinnerId]
    };
  }

  const alivePlayers = Object.values(state.playerMap).filter(p => p.alive);

  const allPipers = Object.values(state.playerMap).filter(p => p.roleId === 'piper');
  const piperNeedsAliveToWin = state.options?.piperNeedsAliveToWin ?? true;
  const winnerPipers = piperNeedsAliveToWin
    ? allPipers.filter(p => p.alive)
    : allPipers;

  if (winnerPipers.length > 0) {
    const winnerPiperIds = new Set(winnerPipers.map(p => p.id));
    const charmedIds = new Set(state.roleStates?.piperCharmedIds || []);
    const uncharmedAlive = alivePlayers.filter(
      p => !winnerPiperIds.has(p.id) && !charmedIds.has(p.id)
    );

    if (uncharmedAlive.length === 0) {
      return {
        ended: true,
        winner: 'piper',
        reason: 'all_alive_charmed',
        winnerPlayerIds: winnerPipers.map(p => p.id)
      };
    }
  }

  // Check for lovers team win condition
  if (state.links.lovers) {
    const [lover1Id, lover2Id] = state.links.lovers;
    const lover1 = state.playerMap[lover1Id];
    const lover2 = state.playerMap[lover2Id];

    // If both lovers are alive and they form a separate team
    if (lover1?.alive && lover2?.alive && (lover1.team === 'lovers' || lover2.team === 'lovers')) {
      // Lovers win if ONLY they remain alive
      if (alivePlayers.length === 2) {
        return { ended: true, winner: 'lovers', reason: 'only_lovers_remain' };
      }
    }
  }

  // Count by role faction, not current team (lovers may have changed team)
  let wolves = 0;
  let villagers = 0;

  for (const player of alivePlayers) {
    const roleConfig = _findRoleConfig(player.roleId, state.roleDefinitions);
    const roleFaction = roleConfig?.team || player.team; // Fallback to player.team if no config

    if (roleFaction === 'werewolf') {
      wolves++;
    } else if (roleFaction === 'village') {
      villagers++;
    }
  }

  if (wolves === 0) {
    return { ended: true, winner: 'village', reason: 'all_wolves_eliminated' };
  }

  if (wolves >= villagers) {
    return { ended: true, winner: 'werewolf', reason: 'parity_or_majority' };
  }

  return { ended: false };
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
 * @private
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

/**
 * Find the player ID for a given role
 * @private
 * @param {Object} state
 * @param {string} roleId
 * @returns {string|null}
 */
function _findPlayerByRole(state, roleId) {
  for (const player of Object.values(state.playerMap)) {
    if (player.roleId === roleId) return player.id;
  }
  return null;
}

/**
 * Resolve piper charm effects after deaths are finalized.
 * @private
 * @param {Object} state
 * @param {Array<{playerId: string, cause: string}>} deaths
 * @returns {{ charmedIds: string[], lastCharmedIds: string[], charmAnnouncements: Object[] }}
 */
function _resolvePiperCharm(state, deaths) {
  const deadIds = new Set((deaths || []).map(d => d.playerId));
  const canCharmSelf = Boolean(state.options?.piperCanCharmSelf);
  const canRecharm = Boolean(state.options?.piperCanRecharm);
  const charmedSet = new Set(state.roleStates?.piperCharmedIds || []);
  const lastNightSet = new Set();
  const charmAnnouncements = [];

  for (const [actorId, action] of Object.entries(state.nightActions || {})) {
    if (action.actionType !== 'NIGHT_PIPER_CHARM') continue;

    const actor = state.playerMap?.[actorId];
    if (!actor || !actor.alive || deadIds.has(actorId)) continue;

    const targetIds = Array.isArray(action.actionData?.targetIds)
      ? action.actionData.targetIds
      : [];
    const appliedForActor = [];

    for (const targetId of targetIds) {
      const target = state.playerMap?.[targetId];
      if (!target || !target.alive || deadIds.has(targetId)) continue;
      if (!canCharmSelf && targetId === actorId) continue;
      if (!canRecharm && charmedSet.has(targetId)) continue;

      if (!charmedSet.has(targetId)) {
        charmedSet.add(targetId);
        lastNightSet.add(targetId);
      }
      if (!appliedForActor.includes(targetId)) {
        appliedForActor.push(targetId);
      }
    }

    if (appliedForActor.length > 0) {
      charmAnnouncements.push({
        type: 'piper_charm_applied',
        playerId: actorId,
        targetIds: appliedForActor,
        message: '你的魅惑已生效'
      });
    }
  }

  return {
    charmedIds: [...charmedSet],
    lastCharmedIds: [...lastNightSet],
    charmAnnouncements
  };
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
  resolveWolfConsensus
};
