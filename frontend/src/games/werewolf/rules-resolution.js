/**
 * Werewolf Game Rules - Resolution & Calculations
 * @module games/werewolf/rules-resolution
 *
 * Night action resolution, vote calculation, and win condition checks.
 */

import { resolveWolfConsensus } from './rules.js';

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
 * Calculate vote result from collected votes
 * @param {Object<string, string|null>} votes - voterId -> targetId (null = abstain)
 * @param {Object} options - { dayVoteMajority: boolean }
 * @param {Object} [state] - Game state (optional, used for captain vote weight)
 * @returns {{ executed: string|null, tiedPlayers: string[], voteCounts: Object }}
 */
export function calculateVoteResult(votes, options = {}, state = null) {
  const voteCounts = {};
  let abstainCount = 0;

  for (const [voterId, targetId] of Object.entries(votes)) {
    if (targetId === null) {
      abstainCount++;
    } else {
      const weight = (state && voterId === state.captainPlayerId)
        ? (state.options?.captainVoteWeight ?? 1.5)
        : 1;
      voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
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
