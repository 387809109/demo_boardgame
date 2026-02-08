/**
 * Werewolf Game P0 Role Unit Tests (T-F074)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { WerewolfGame, PHASES, ACTION_TYPES, TEAMS } from './index.js';

// ─── Test Helpers ─────────────────────────────────────────────

const TEST_PLAYERS = [
  { id: 'p1', nickname: 'Player1', isHost: true },
  { id: 'p2', nickname: 'Player2' },
  { id: 'p3', nickname: 'Player3' },
  { id: 'p4', nickname: 'Player4' },
  { id: 'p5', nickname: 'Player5' },
  { id: 'p6', nickname: 'Player6' }
];

/** Fixed role counts: 2 wolves, 1 seer, 1 doctor, 1 hunter, 1 villager */
const P0_ROLE_COUNTS = {
  werewolf: 2,
  seer: 1,
  doctor: 1,
  hunter: 1,
  villager: 1
};

/** Role counts with witch: 2 wolves, 1 seer, 1 doctor, 1 witch, 1 hunter, 1 villager (7p) */
const P0_ROLE_COUNTS_WITH_WITCH = {
  werewolf: 2,
  seer: 1,
  doctor: 1,
  witch: 1,
  hunter: 1,
  villager: 1
};

const SEVEN_PLAYERS = [
  ...TEST_PLAYERS,
  { id: 'p7', nickname: 'Player7' }
];

/**
 * Initialize a game and patch playerMap so roles are deterministic.
 * @param {Object} [opts]
 * @param {Object} [opts.roleCounts] - Role counts override
 * @param {Object} [opts.roleMap] - Explicit playerId→roleId assignments
 * @param {Array}  [opts.players] - Player list override
 * @param {Object} [opts.options] - Game options override
 * @returns {{ game: WerewolfGame, state: Object }}
 */
function setupGame(opts = {}) {
  const {
    roleCounts = P0_ROLE_COUNTS,
    roleMap,
    players = TEST_PLAYERS,
    options = {}
  } = opts;

  const game = new WerewolfGame('offline');
  game.start({ players, gameType: 'werewolf', options: { roleCounts, ...options } });

  // If explicit roleMap provided, patch state for deterministic tests
  if (roleMap) {
    const state = game.getState();
    for (const [pid, roleId] of Object.entries(roleMap)) {
      const roleConfig = findRoleConfig(roleId);
      state.playerMap[pid].roleId = roleId;
      state.playerMap[pid].team = roleConfig.team;
      // Also update the players array
      const playerEntry = state.players.find(p => p.id === pid);
      if (playerEntry) playerEntry.roleId = roleId;
    }
    // Rebuild pendingNightRoles since roles changed
    rebuildPendingNightRoles(state);
  }

  return { game, state: game.getState() };
}

/** Minimal role config lookup */
function findRoleConfig(roleId) {
  const configs = {
    villager: { team: 'village', actionTypes: [] },
    werewolf: { team: 'werewolf', actionTypes: ['NIGHT_WOLF_KILL'] },
    seer: { team: 'village', actionTypes: ['NIGHT_SEER_CHECK'] },
    doctor: { team: 'village', actionTypes: ['NIGHT_DOCTOR_PROTECT'] },
    hunter: { team: 'village', actionTypes: ['HUNTER_SHOOT'] },
    witch: { team: 'village', actionTypes: ['NIGHT_WITCH_SAVE', 'NIGHT_WITCH_POISON'] }
  };
  return configs[roleId] || { team: 'village', actionTypes: [] };
}

/** Night step label lookup */
function getNightStepLabel(priority) {
  const labels = {
    5: '预言家查验', 7: '医生保护',
    8: '狼人行动', 10: '女巫行动'
  };
  return labels[priority] || '夜间行动';
}

/** Rebuild pendingNightRoles and nightSteps after patching roleMap */
function rebuildPendingNightRoles(state) {
  const nightPriority = state.nightActionPriority || [];
  const nightRoles = [];

  for (const player of Object.values(state.playerMap)) {
    if (!player.alive) continue;
    const cfg = findRoleConfig(player.roleId);
    if (!cfg.actionTypes.some(a => a.startsWith('NIGHT_'))) continue;

    let priority = 99;
    for (const entry of nightPriority) {
      if (entry.roles.includes(player.roleId)) {
        priority = entry.priority;
        break;
      }
    }
    nightRoles.push({ playerId: player.id, roleId: player.roleId, priority });
  }

  nightRoles.sort((a, b) => a.priority - b.priority);

  // Group by priority into steps
  const steps = [];
  let prev = null;
  for (const role of nightRoles) {
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

  state.nightSteps = steps;
  state.currentNightStep = 0;
  state.pendingNightRoles = steps.length > 0
    ? [...steps[0].playerIds] : [];
}

/** Find player IDs by role in a state */
function findByRole(state, roleId) {
  return Object.values(state.playerMap)
    .filter(p => p.roleId === roleId)
    .map(p => p.id);
}

/** Submit a night action via game.executeMove */
function submitNight(game, playerId, actionType, actionData = {}) {
  return game.executeMove({ playerId, actionType, actionData });
}

/** Advance from day_announce to day_discussion using current gating rules */
function advanceToDiscussion(game) {
  while (game.getState().phase === PHASES.DAY_ANNOUNCE) {
    const state = game.getState();
    let actorId = null;

    if (state.lastWordsPlayerId) {
      actorId = state.lastWordsPlayerId;
    } else if (state.awaitingFirstSpeaker) {
      actorId = state.firstSpeakerId;
    } else {
      const anyAlive = Object.values(state.playerMap).find(p => p.alive);
      actorId = anyAlive?.id;
    }

    if (!actorId) break;

    game.executeMove({
      playerId: actorId,
      actionType: ACTION_TYPES.PHASE_ADVANCE,
      actionData: {}
    });
  }
}

/** Cast one full vote round following currentVoter order */
function playVoteRound(game, votePlan = {}) {
  while (game.getState().phase === PHASES.DAY_VOTE) {
    const state = game.getState();
    const voterId = state.currentVoter;
    if (!voterId) break;

    const targetId = Object.prototype.hasOwnProperty.call(votePlan, voterId)
      ? votePlan[voterId]
      : null;

    game.executeMove({
      playerId: voterId,
      actionType: targetId ? ACTION_TYPES.DAY_VOTE : ACTION_TYPES.DAY_SKIP_VOTE,
      actionData: targetId ? { targetId } : {}
    });
  }
}

/** Submit all night skips for pending roles across all steps */
function skipAllNightActions(game) {
  while (game.getState().phase === PHASES.NIGHT) {
    const state = game.getState();
    const pending = [...state.pendingNightRoles];
    if (pending.length === 0) break;
    for (const pid of pending) {
      game.executeMove({
        playerId: pid,
        actionType: ACTION_TYPES.NIGHT_SKIP,
        actionData: {}
      });
    }
  }
}

/** Advance through announce + discussion + vote phases to night */
function advanceToNight(game) {
  const state = game.getState();
  // If in DAY_ANNOUNCE, advance
  if (state.phase === PHASES.DAY_ANNOUNCE) {
    const anyAlive = Object.values(state.playerMap).find(p => p.alive);
    game.executeMove({
      playerId: anyAlive.id,
      actionType: ACTION_TYPES.PHASE_ADVANCE,
      actionData: {}
    });
  }
  // Now in DAY_DISCUSSION — advance all speakers
  const stateAfterAnnounce = game.getState();
  if (stateAfterAnnounce.phase === PHASES.DAY_DISCUSSION) {
    while (game.getState().phase === PHASES.DAY_DISCUSSION) {
      const cur = game.getState().currentSpeaker;
      if (!cur) break;
      game.executeMove({
        playerId: cur,
        actionType: ACTION_TYPES.SPEECH_DONE,
        actionData: {}
      });
    }
  }
  // Now in DAY_VOTE — all skip vote
  const stateVote = game.getState();
  if (stateVote.phase === PHASES.DAY_VOTE) {
    const alive = Object.values(stateVote.playerMap).filter(p => p.alive);
    for (const p of alive) {
      game.executeMove({
        playerId: p.id,
        actionType: ACTION_TYPES.DAY_SKIP_VOTE,
        actionData: {}
      });
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────

describe('WerewolfGame', () => {
  describe('initialize', () => {
    it('should create a game with correct number of players', () => {
      const { state } = setupGame();
      expect(state.players).toHaveLength(6);
      expect(state.status).toBe('playing');
    });

    it('should start in night phase', () => {
      const { state } = setupGame();
      expect(state.phase).toBe(PHASES.NIGHT);
    });

    it('should assign all roles from roleCounts', () => {
      const { state } = setupGame();
      const roles = Object.values(state.playerMap).map(p => p.roleId);
      const wolves = roles.filter(r => r === 'werewolf');
      expect(wolves).toHaveLength(2);
    });

    it('should fill remaining slots with villager', () => {
      const { state } = setupGame({
        roleCounts: { werewolf: 2, seer: 1 }
      });
      const villagers = Object.values(state.playerMap).filter(
        p => p.roleId === 'villager'
      );
      expect(villagers).toHaveLength(3);
    });

    it('should set all players as alive', () => {
      const { state } = setupGame();
      const allAlive = Object.values(state.playerMap).every(p => p.alive);
      expect(allAlive).toBe(true);
    });

    it('should initialize nightActions as empty', () => {
      const { state } = setupGame();
      expect(state.nightActions).toEqual({});
    });

    it('should populate pendingNightRoles', () => {
      const { state } = setupGame();
      expect(state.pendingNightRoles.length).toBeGreaterThan(0);
    });

    it('should set round to 1', () => {
      const { state } = setupGame();
      expect(state.round).toBe(1);
    });

    it('should initialize roleStates', () => {
      const { state } = setupGame();
      expect(state.roleStates.witchSaveUsed).toBe(false);
      expect(state.roleStates.witchPoisonUsed).toBe(false);
      expect(state.roleStates.doctorLastProtect).toBeNull();
    });

    it('should set team correctly for each role', () => {
      const { state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });
      expect(state.playerMap.p1.team).toBe(TEAMS.WEREWOLF);
      expect(state.playerMap.p3.team).toBe(TEAMS.VILLAGE);
    });
  });

  // ─── Night Action Validation ──────────────────────────────

  describe('validateMove — night actions', () => {
    let game, state;

    beforeEach(() => {
      ({ game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      }));
      // Include all night-active players for role-specific validation tests
      state.pendingNightRoles = ['p1', 'p2', 'p3', 'p4'];
    });

    it('should accept wolf kill targeting non-wolf', () => {
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should allow wolf kill targeting a fellow wolf', () => {
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p2' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should accept seer check on another player', () => {
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.NIGHT_SEER_CHECK, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject seer checking self', () => {
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.NIGHT_SEER_CHECK, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should accept doctor protect', () => {
      const result = game.validateMove(
        { playerId: 'p4', actionType: ACTION_TYPES.NIGHT_DOCTOR_PROTECT, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject doctor self-protect when option disabled', () => {
      state.options.allowDoctorSelfProtect = false;
      const result = game.validateMove(
        { playerId: 'p4', actionType: ACTION_TYPES.NIGHT_DOCTOR_PROTECT, actionData: { targetId: 'p4' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should accept doctor self-protect when option enabled', () => {
      state.options.allowDoctorSelfProtect = true;
      const result = game.validateMove(
        { playerId: 'p4', actionType: ACTION_TYPES.NIGHT_DOCTOR_PROTECT, actionData: { targetId: 'p4' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject repeated doctor protect on same target', () => {
      state.options.allowRepeatedProtect = false;
      state.roleStates.doctorLastProtect = 'p3';
      const result = game.validateMove(
        { playerId: 'p4', actionType: ACTION_TYPES.NIGHT_DOCTOR_PROTECT, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should accept NIGHT_SKIP for any night-active role', () => {
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_SKIP, actionData: {} },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should accept NIGHT_WOLF_TENTATIVE with null target as tentative abstain', () => {
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_TENTATIVE, actionData: { targetId: null } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject dead player night action', () => {
      state.playerMap.p1.alive = false;
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject night action outside night phase', () => {
      state.phase = PHASES.DAY_VOTE;
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject duplicate submission', () => {
      state.nightActions.p1 = {
        actionType: ACTION_TYPES.NIGHT_WOLF_KILL,
        actionData: { targetId: 'p3' }
      };
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p4' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject action from wrong role', () => {
      // Villager trying wolf kill
      const result = game.validateMove(
        { playerId: 'p6', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(false);
    });
  });

  // ─── Witch Validation ─────────────────────────────────────

  describe('validateMove — witch', () => {
    let game, state;

    beforeEach(() => {
      ({ game, state } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        }
      }));
      // For witch validation tests, put witch in pendingNightRoles
      state.pendingNightRoles = ['p5'];
    });

    it('should accept witch save when save not used and wolf target exists', () => {
      // Simulate wolves voting for p3
      state.wolfVotes = { p1: 'p3', p2: 'p3' };
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject witch save when save already used', () => {
      state.roleStates.witchSaveUsed = true;
      state.wolfVotes = { p1: 'p3', p2: 'p3' };
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject witch save when no wolf target exists', () => {
      // No wolf votes → no wolf target
      state.wolfVotes = {};
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should accept witch poison on another player', () => {
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_POISON, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should allow witch poison after save in the same night step', () => {
      state.wolfVotes = { p1: 'p3', p2: 'p3' };
      state.nightActions.p5 = {
        actionType: 'NIGHT_WITCH_COMBINED',
        actionData: { usedSave: true, usedPoison: false, poisonTargetId: null }
      };
      state.roleStates.witchSaveUsed = true;

      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_POISON, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should allow witch save after poison in the same night step', () => {
      state.wolfVotes = { p1: 'p3', p2: 'p3' };
      state.nightActions.p5 = {
        actionType: 'NIGHT_WITCH_COMBINED',
        actionData: { usedSave: false, usedPoison: true, poisonTargetId: 'p1' }
      };
      state.roleStates.witchPoisonUsed = true;

      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject witch poison when already used', () => {
      state.roleStates.witchPoisonUsed = true;
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_POISON, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject witch save first-night-only in round 2', () => {
      state.options.witchSaveFirstNightOnly = true;
      state.round = 2;
      state.wolfVotes = { p1: 'p3', p2: 'p3' };
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} },
        state
      );
      expect(result.valid).toBe(false);
    });
  });

  // ─── Day Vote Validation ──────────────────────────────────

  describe('validateMove — day vote', () => {
    let game, state;

    beforeEach(() => {
      ({ game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      }));
      state.phase = PHASES.DAY_VOTE;
      state.currentVoter = 'p3';
    });

    it('should accept vote for alive player', () => {
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject voting for self', () => {
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject duplicate vote', () => {
      state.votes.p3 = 'p1';
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p2' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should accept skip vote', () => {
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_SKIP_VOTE, actionData: {} },
        state
      );
      expect(result.valid).toBe(true);
    });

    it('should reject dead player voting', () => {
      state.playerMap.p3.alive = false;
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(false);
    });

    it('should reject voting for dead player', () => {
      state.playerMap.p1.alive = false;
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p1' } },
        state
      );
      expect(result.valid).toBe(false);
    });
  });

  // ─── processMove — Night Resolution ───────────────────────

  describe('processMove — night actions', () => {
    let game;

    beforeEach(() => {
      ({ game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      }));
    });

    it('should collect night action and remove from pending', () => {
      // Seer is step 0 — submit seer action first
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
      const s = game.getState();
      expect(s.nightActions.p3).toBeDefined();
      expect(s.pendingNightRoles).not.toContain('p3');
    });

    it('should transition to day_announce when all night actions collected', () => {
      // Submit in priority order: seer → doctor → wolves
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p3' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
    });

    it('should kill wolf target when unprotected', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const s = game.getState();
      expect(s.nightDeaths).toHaveLength(1);
      expect(s.nightDeaths[0].playerId).toBe('p6');
      expect(s.nightDeaths[0].cause).toBe('wolf_kill');
      expect(s.playerMap.p6.alive).toBe(false);
    });

    it('should protect wolf target when doctor protects', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p6' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const s = game.getState();
      expect(s.nightDeaths).toHaveLength(0);
      expect(s.playerMap.p6.alive).toBe(true);
    });

    it('should produce seer result announcement', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const s = game.getState();
      const seerResult = s.dayAnnouncements.find(a => a.type === 'seer_result');
      expect(seerResult).toBeDefined();
      expect(seerResult.playerId).toBe('p3');
      expect(seerResult.targetId).toBe('p1');
      expect(seerResult.result).toBe(TEAMS.WEREWOLF);
    });

    it('should result in no death when wolves disagree (tie)', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p3' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const s = game.getState();
      expect(s.nightDeaths).toHaveLength(0);
    });

    it('should track wolf votes separately', () => {
      // Advance to wolf step first
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      const s = game.getState();
      expect(s.wolfVotes.p1).toBe('p6');
    });

    it('should track wolf tentative abstain as null without consuming action', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});

      game.executeMove({
        playerId: 'p1',
        actionType: ACTION_TYPES.NIGHT_WOLF_TENTATIVE,
        actionData: { targetId: null }
      });

      const s = game.getState();
      expect(Object.prototype.hasOwnProperty.call(s.wolfTentativeVotes, 'p1')).toBe(true);
      expect(s.wolfTentativeVotes.p1).toBeNull();
      expect(s.pendingNightRoles).toContain('p1');
      expect(s.nightActions.p1).toBeUndefined();
    });

    it('should allow wolf NIGHT_SKIP and record explicit abstain vote', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});

      submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      expect(s.nightActions.p1.actionType).toBe(ACTION_TYPES.NIGHT_SKIP);
      expect(Object.prototype.hasOwnProperty.call(s.wolfVotes, 'p1')).toBe(true);
      expect(s.wolfVotes.p1).toBeNull();
      expect(s.pendingNightRoles).not.toContain('p1');
    });
  });

  // ─── Witch Night Resolution ───────────────────────────────

  describe('processMove — witch actions', () => {
    let game;

    beforeEach(() => {
      ({ game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        }
      }));
    });

    it('should save wolf target when witch uses save', () => {
      // Priority order: seer → doctor → wolves → witch
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_SAVE, {});

      let s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.pendingNightRoles).toContain('p5');

      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
      s = game.getState();
      expect(s.nightDeaths).toHaveLength(0);
      expect(s.playerMap.p7.alive).toBe(true);
      expect(s.roleStates.witchSaveUsed).toBe(true);
    });

    it('should kill witch poison target bypassing protection', () => {
      // Doctor protects p1 (a wolf), witch poisons p1
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p1' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p1' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      // p7 dies from wolf, p1 dies from poison (bypasses doctor)
      const poisonDeath = s.nightDeaths.find(d => d.cause === 'witch_poison');
      expect(poisonDeath).toBeDefined();
      expect(poisonDeath.playerId).toBe('p1');
      expect(s.playerMap.p1.alive).toBe(false);
    });

    it('should mark witchPoisonUsed after poisoning', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p1' });

      const s = game.getState();
      expect(s.roleStates.witchPoisonUsed).toBe(true);
    });

    it('should produce witch_night_info announcement when witch step begins', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      const witchInfo = s.dayAnnouncements.find(a => a.type === 'witch_night_info');
      expect(witchInfo).toBeDefined();
      expect(witchInfo.playerId).toBe('p5');
      expect(witchInfo.wolfTarget).toBe('p7');
    });

    it('should allow witch to save then poison before night ends', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });

      const saveResult = submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_SAVE, {});
      expect(saveResult.success).toBe(true);

      let s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.pendingNightRoles).toContain('p5');

      const poisonResult = submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p1' });
      expect(poisonResult.success).toBe(true);

      s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.pendingNightRoles).toContain('p5');

      const endResult = submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
      expect(endResult.success).toBe(true);

      s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.playerMap.p7.alive).toBe(true);
      expect(s.playerMap.p1.alive).toBe(false);
      expect(s.roleStates.witchSaveUsed).toBe(true);
      expect(s.roleStates.witchPoisonUsed).toBe(true);
    });

    it('should allow witch to poison then save before manually ending step', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });

      const poisonResult = submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p1' });
      expect(poisonResult.success).toBe(true);

      let s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.pendingNightRoles).toContain('p5');
      expect(s.playerMap.p1.alive).toBe(true);

      const saveResult = submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_SAVE, {});
      expect(saveResult.success).toBe(true);

      s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.pendingNightRoles).toContain('p5');

      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
      s = game.getState();

      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.playerMap.p1.alive).toBe(false);
      expect(s.playerMap.p7.alive).toBe(true);
      expect(s.roleStates.witchSaveUsed).toBe(true);
      expect(s.roleStates.witchPoisonUsed).toBe(true);
    });
  });

  // ─── Day Phase Flow ───────────────────────────────────────

  describe('processMove — day phases', () => {
    let game;

    beforeEach(() => {
      ({ game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      }));
      // Complete night with a kill (priority order: seer → doctor → wolves)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
    });

    it('should be in day_announce after night resolves', () => {
      expect(game.getState().phase).toBe(PHASES.DAY_ANNOUNCE);
    });

    it('should transition to day_discussion on PHASE_ADVANCE', () => {
      advanceToDiscussion(game);

      expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
    });

    it('should build speaker queue in discussion phase', () => {
      advanceToDiscussion(game);

      const s = game.getState();
      expect(s.speakerQueue.length).toBeGreaterThan(0);
      expect(s.currentSpeaker).toBeDefined();
    });

    it('should advance speakers on SPEECH_DONE', () => {
      advanceToDiscussion(game);

      const firstSpeaker = game.getState().currentSpeaker;
      game.executeMove({
        playerId: firstSpeaker,
        actionType: ACTION_TYPES.SPEECH_DONE,
        actionData: {}
      });

      const s = game.getState();
      // Should have advanced (either next speaker or vote phase)
      expect(
        s.currentSpeaker !== firstSpeaker || s.phase === PHASES.DAY_VOTE
      ).toBe(true);
    });

    it('should transition to day_vote after all speakers done', () => {
      advanceToDiscussion(game);

      // Exhaust all speakers
      while (game.getState().phase === PHASES.DAY_DISCUSSION) {
        const cur = game.getState().currentSpeaker;
        if (!cur) break;
        game.executeMove({
          playerId: cur,
          actionType: ACTION_TYPES.SPEECH_DONE,
          actionData: {}
        });
      }

      const s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_VOTE);
      expect(s.finishedSpeakers).toEqual([]);
    });
  });

  // ─── Day Vote Resolution ──────────────────────────────────

  describe('processMove — voting', () => {
    let game;

    function setupVotePhase(opts = {}) {
      const result = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        },
        ...opts
      });
      game = result.game;

      // Complete night (no kill via tie, priority order)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p3' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      // Advance to vote phase
      advanceToDiscussion(game);
      while (game.getState().phase === PHASES.DAY_DISCUSSION) {
        const cur = game.getState().currentSpeaker;
        if (!cur) break;
        game.executeMove({
          playerId: cur,
          actionType: ACTION_TYPES.SPEECH_DONE,
          actionData: {}
        });
      }
    }

    it('should execute player with majority votes', () => {
      setupVotePhase();
      expect(game.getState().phase).toBe(PHASES.DAY_VOTE);

      // Vote for p1: p3, p4, p5, p6 vote p1; p1, p2 abstain
      playVoteRound(game, {
        p1: null,
        p2: null,
        p3: 'p1',
        p4: 'p1',
        p5: 'p1',
        p6: 'p1'
      });

      const s = game.getState();
      expect(s.playerMap.p1.alive).toBe(false);
      expect(s.playerMap.p1.deathCause).toBe('execution');
    });

    it('should trigger second vote on tie', () => {
      setupVotePhase();

      // 3 vote p1, 3 vote p3
      playVoteRound(game, {
        p1: 'p3',
        p2: 'p3',
        p3: 'p1',
        p4: 'p1',
        p5: 'p1',
        p6: 'p3'
      });

      const s = game.getState();
      expect(s.voteRound).toBe(2);
      expect(s.tiedCandidates).toContain('p1');
      expect(s.tiedCandidates).toContain('p3');
      expect(s.phase).toBe(PHASES.DAY_DISCUSSION);
      expect(s.finishedSpeakers).toEqual([]);
    });

    it('should go to night after all abstain', () => {
      setupVotePhase();

      // All skip in turn order
      playVoteRound(game, {
        p1: null,
        p2: null,
        p3: null,
        p4: null,
        p5: null,
        p6: null
      });

      const s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
    });
  });

  // ─── Hunter Shoot ─────────────────────────────────────────

  describe('processMove — hunter', () => {
    it('should require hunter shot before day announce can advance', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      const s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.hunterPendingShoot).toBe('p5');
      expect(s.lastWordsPlayerId).toBeNull();

      const advanceResult = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.PHASE_ADVANCE, actionData: {} },
        s
      );
      expect(advanceResult.valid).toBe(false);
      expect(advanceResult.error).toContain('猎人');
    });

    it('should trigger hunterPendingShoot when hunter dies to wolf kill', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      // Kill hunter (priority order)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      const s = game.getState();
      expect(s.hunterPendingShoot).toBe('p5');
    });

    it('should allow hunter to shoot after death', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      // Validate hunter can shoot
      const s = game.getState();
      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.HUNTER_SHOOT, actionData: { targetId: 'p1' } },
        s
      );
      expect(result.valid).toBe(true);
    });

    it('should kill hunter shoot target', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      // Hunter shoots wolf
      game.executeMove({
        playerId: 'p5',
        actionType: ACTION_TYPES.HUNTER_SHOOT,
        actionData: { targetId: 'p1' }
      });

      const s = game.getState();
      expect(s.playerMap.p1.alive).toBe(false);
      expect(s.playerMap.p1.deathCause).toBe('hunter_shoot');
      expect(s.hunterPendingShoot).toBeNull();
    });

    it('should resolve hunter shot before last words, then continue normal announce flow', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      game.executeMove({
        playerId: 'p5',
        actionType: ACTION_TYPES.HUNTER_SHOOT,
        actionData: { targetId: 'p1' }
      });

      let s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.hunterPendingShoot).toBeNull();
      expect(s.lastWordsPlayerId).toBe('p5');
      expect(s.lastWordsPlayerId).not.toBe('p1');

      game.executeMove({
        playerId: 'p5',
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });

      s = game.getState();
      expect(s.awaitingFirstSpeaker).toBe(true);
      expect(s.firstSpeakerId).toBeTruthy();

      game.executeMove({
        playerId: s.firstSpeakerId,
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });

      expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
    });

    it('should not trigger hunter shoot when poisoned (default option)', () => {
      const { game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        },
        options: { hunterShootOnPoison: false }
      });

      // Wolves kill p7, witch poisons p6 (hunter) — priority order
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      expect(s.playerMap.p6.alive).toBe(false);
      // Hunter was poisoned — should NOT be able to shoot
      expect(s.hunterPendingShoot).toBeNull();
    });

    it('should reveal hunter role on night death with pending shoot even when revealRolesOnDeath is false', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        },
        options: { revealRolesOnDeath: false }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      const visible = game.getVisibleState('p6');
      const hunter = visible.players.find(p => p.id === 'p5');
      expect(hunter.alive).toBe(false);
      expect(hunter.roleId).toBe('hunter');
    });

    it('should not reveal poisoned hunter role when hunter cannot shoot and revealRolesOnDeath is false', () => {
      const { game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        },
        options: {
          revealRolesOnDeath: false,
          hunterShootOnPoison: false
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const visible = game.getVisibleState('p1');
      const hunter = visible.players.find(p => p.id === 'p6');
      expect(hunter.alive).toBe(false);
      expect(hunter.roleId).toBeNull();
    });

    it('should reveal poisoned hunter role when hunter can shoot and revealRolesOnDeath is false', () => {
      const { game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        },
        options: {
          revealRolesOnDeath: false,
          hunterShootOnPoison: true
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      expect(s.hunterPendingShoot).toBe('p6');

      const visible = game.getVisibleState('p1');
      const hunter = visible.players.find(p => p.id === 'p6');
      expect(hunter.alive).toBe(false);
      expect(hunter.roleId).toBe('hunter');
    });
  });

  // ─── Dead Chat ────────────────────────────────────────────

  describe('processMove — dead chat', () => {
    it('should allow dead player to send dead chat', () => {
      const { game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      // Kill p6 (priority order)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      let current = game.getState();
      expect(current.lastWordsPlayerId).toBe('p6');

      const blocked = game.validateMove(
        { playerId: 'p6', actionType: ACTION_TYPES.DEAD_CHAT, actionData: { message: 'blocked' } },
        current
      );
      expect(blocked.valid).toBe(false);

      game.executeMove({
        playerId: 'p6',
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });

      // Dead player sends chat
      game.executeMove({
        playerId: 'p6',
        actionType: ACTION_TYPES.DEAD_CHAT,
        actionData: { message: '我是村民!' }
      });

      const s = game.getState();
      expect(s.deadChat).toHaveLength(1);
      expect(s.deadChat[0].playerId).toBe('p6');
      expect(s.deadChat[0].message).toBe('我是村民!');
    });

    it('should reject dead chat while hunter shoot is pending', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

      const s = game.getState();
      expect(s.hunterPendingShoot).toBe('p5');

      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.DEAD_CHAT, actionData: { message: 'test' } },
        s
      );
      expect(result.valid).toBe(false);
    });

    it('should reject dead chat from alive player', () => {
      const { game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DEAD_CHAT, actionData: { message: 'test' } },
        state
      );
      expect(result.valid).toBe(false);
    });
  });

  // ─── checkGameEnd ─────────────────────────────────────────

  describe('checkGameEnd', () => {
    it('should not end when both teams alive and balanced', () => {
      const { game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(false);
    });

    it('should end with village win when all wolves dead', () => {
      const { game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      state.playerMap.p1.alive = false;
      state.playerMap.p2.alive = false;

      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.winner).toBe(TEAMS.VILLAGE);
      expect(result.reason).toBe('all_wolves_eliminated');
    });

    it('should end with werewolf win when wolves >= village', () => {
      const { game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      // Kill 3 villagers, leaving 2 wolves vs 1 village
      state.playerMap.p3.alive = false;
      state.playerMap.p5.alive = false;
      state.playerMap.p6.alive = false;

      const result = game.checkGameEnd(state);
      expect(result.ended).toBe(true);
      expect(result.winner).toBe(TEAMS.WEREWOLF);
    });

    it('should include rankings when game ends', () => {
      const { game, state } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      state.playerMap.p1.alive = false;
      state.playerMap.p2.alive = false;

      const result = game.checkGameEnd(state);
      expect(result.rankings).toBeDefined();
      expect(result.rankings).toHaveLength(6);

      const villageRank = result.rankings.find(r => r.playerId === 'p3');
      expect(villageRank.rank).toBe(1); // Winners

      const wolfRank = result.rankings.find(r => r.playerId === 'p1');
      expect(wolfRank.rank).toBe(2); // Losers
    });
  });

  // ─── getVisibleState ──────────────────────────────────────

  describe('getVisibleState', () => {
    let game;

    beforeEach(() => {
      ({ game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      }));
    });

    it('should show own role', () => {
      const visible = game.getVisibleState('p3');
      expect(visible.myRole).toBeDefined();
      expect(visible.myRole.roleId).toBe('seer');
      expect(visible.myRole.team).toBe(TEAMS.VILLAGE);
    });

    it('should hide other player roles during game', () => {
      const visible = game.getVisibleState('p3');
      const otherPlayer = visible.players.find(p => p.id === 'p1');
      expect(otherPlayer.roleId).toBeNull();
      expect(otherPlayer.team).toBeNull();
    });

    it('should show wolf teammates to wolf', () => {
      const visible = game.getVisibleState('p1');
      expect(visible.wolfTeamIds).toContain('p1');
      expect(visible.wolfTeamIds).toContain('p2');
      expect(visible.wolfTeamIds).toHaveLength(2);
    });

    it('should not show wolfTeamIds to non-wolves', () => {
      const visible = game.getVisibleState('p3');
      expect(visible.wolfTeamIds).toBeNull();
    });

    it('should show dead chat only to dead players', () => {
      const s = game.getState();
      s.deadChat.push({ playerId: 'p6', nickname: 'Player6', message: 'test', timestamp: 1 });
      s.playerMap.p6.alive = false;

      const deadView = game.getVisibleState('p6');
      expect(deadView.deadChat).toHaveLength(1);

      const aliveView = game.getVisibleState('p3');
      expect(aliveView.deadChat).toHaveLength(0);
    });

    it('should lock dead chat while own last words are pending', () => {
      const s = game.getState();
      s.deadChat.push({ playerId: 'p6', nickname: 'Player6', message: 'test', timestamp: 1 });
      s.playerMap.p6.alive = false;
      s.lastWordsPlayerId = 'p6';

      const duringSettlement = game.getVisibleState('p6');
      expect(duringSettlement.deadChatEnabled).toBe(false);
      expect(duringSettlement.deadChat).toHaveLength(0);

      s.lastWordsPlayerId = null;
      const afterSettlement = game.getVisibleState('p6');
      expect(afterSettlement.deadChatEnabled).toBe(true);
      expect(afterSettlement.deadChat).toHaveLength(1);
    });

    it('should reveal all roles when game ends', () => {
      const s = game.getState();
      s.phase = PHASES.ENDED;

      const visible = game.getVisibleState('p3');
      for (const player of visible.players) {
        expect(player.roleId).not.toBeNull();
      }
    });

    it('should show seer result only to seer', () => {
      // Complete night with seer checking p1 (priority order)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const seerView = game.getVisibleState('p3');
      const seerAnnouncement = seerView.dayAnnouncements.find(
        a => a.type === 'seer_result'
      );
      expect(seerAnnouncement).toBeDefined();

      // Non-seer should NOT see seer result
      const wolfView = game.getVisibleState('p1');
      const wolfSeerAnnouncement = wolfView.dayAnnouncements.find(
        a => a.type === 'seer_result'
      );
      expect(wolfSeerAnnouncement).toBeUndefined();
    });

    it('should show witch roleStates only to witch', () => {
      const { game: g2 } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        }
      });

      const witchView = g2.getVisibleState('p5');
      expect(witchView.roleStates.witchSaveUsed).toBeDefined();
      expect(witchView.roleStates.witchPoisonUsed).toBeDefined();

      const seerView = g2.getVisibleState('p3');
      expect(seerView.roleStates.witchSaveUsed).toBeUndefined();
    });
  });

  // ─── Integration: Full Game Flow ──────────────────────────

  describe('integration — full game flow', () => {
    it('should play a complete game to village win', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      // === Night 1: wolves kill p6, doctor protects p3 (priority order) ===
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p3' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      let s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.playerMap.p6.alive).toBe(false);

      // === Day 1: advance through announce → discussion → vote ===
      advanceToDiscussion(game);

      // Advance through all speakers
      while (game.getState().phase === PHASES.DAY_DISCUSSION) {
        const cur = game.getState().currentSpeaker;
        if (!cur) break;
        game.executeMove({ playerId: cur, actionType: ACTION_TYPES.SPEECH_DONE, actionData: {} });
      }

      // Vote to execute p1 (a wolf)
      playVoteRound(game, {
        p1: null,
        p2: null,
        p3: 'p1',
        p4: 'p1',
        p5: 'p1'
      });

      s = game.getState();
      expect(s.playerMap.p1.alive).toBe(false);
      // Should transition to night
      expect(s.phase).toBe(PHASES.NIGHT);

      // === Night 2: wolves kill p3, doctor protects p4 (priority order) ===
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p2' });
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p4' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p3' });

      s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.playerMap.p3.alive).toBe(false);

      // === Day 2: vote to execute p2 (last wolf) ===
      advanceToDiscussion(game);
      while (game.getState().phase === PHASES.DAY_DISCUSSION) {
        const cur = game.getState().currentSpeaker;
        if (!cur) break;
        game.executeMove({ playerId: cur, actionType: ACTION_TYPES.SPEECH_DONE, actionData: {} });
      }

      playVoteRound(game, {
        p2: null,
        p4: 'p2',
        p5: 'p2'
      });

      s = game.getState();
      expect(s.playerMap.p2.alive).toBe(false);
      // Village should win — all wolves dead
      expect(s.phase).toBe(PHASES.ENDED);
      expect(s.winner).toBe(TEAMS.VILLAGE);
    });

    it('should end with werewolf win when wolves reach parity', () => {
      const { game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      });

      // Night 1: wolves kill doctor (p4), no protection (priority order)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });

      // Day 1: execute seer (bad outcome)
      advanceToDiscussion(game);
      while (game.getState().phase === PHASES.DAY_DISCUSSION) {
        const cur = game.getState().currentSpeaker;
        if (!cur) break;
        game.executeMove({ playerId: cur, actionType: ACTION_TYPES.SPEECH_DONE, actionData: {} });
      }
      // Wolves and villager vote seer
      playVoteRound(game, {
        p1: 'p3',
        p2: 'p3',
        p3: null,
        p5: null,
        p6: 'p3'
      });

      let s = game.getState();
      expect(s.playerMap.p3.alive).toBe(false);
      // Night 2: wolves kill villager p6
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      s = game.getState();
      // 2 wolves vs 1 village (p5 hunter) → wolves win
      expect(s.phase).toBe(PHASES.ENDED);
      expect(s.winner).toBe(TEAMS.WEREWOLF);
    });
  });

  // ─── Sequential Night Steps ──────────────────────────────

  describe('sequential night steps', () => {
    let game;

    beforeEach(() => {
      ({ game } = setupGame({
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        }
      }));
    });

    it('should build nightSteps in priority order', () => {
      const s = game.getState();
      expect(s.nightSteps).toHaveLength(3); // seer, doctor, wolves
      expect(s.nightSteps[0].roleId).toBe('seer');
      expect(s.nightSteps[0].priority).toBe(5);
      expect(s.nightSteps[1].roleId).toBe('doctor');
      expect(s.nightSteps[1].priority).toBe(7);
      expect(s.nightSteps[2].roleId).toBe('werewolf');
      expect(s.nightSteps[2].priority).toBe(8);
    });

    it('should start with only step 0 players in pendingNightRoles', () => {
      const s = game.getState();
      expect(s.currentNightStep).toBe(0);
      expect(s.pendingNightRoles).toEqual(['p3']); // only seer
    });

    it('should advance to next step after current step completes', () => {
      // Complete seer step
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
      const s = game.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.currentNightStep).toBe(1);
      expect(s.pendingNightRoles).toEqual(['p4']); // doctor
    });

    it('should group multiple wolves into one step', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      const s = game.getState();
      expect(s.currentNightStep).toBe(2);
      expect(s.pendingNightRoles).toContain('p1');
      expect(s.pendingNightRoles).toContain('p2');
    });

    it('should reject action from player not in current step', () => {
      // p1 (wolf) tries to act during seer step
      const s = game.getState();
      const result = game.validateMove(
        { playerId: 'p1', actionType: ACTION_TYPES.NIGHT_WOLF_KILL, actionData: { targetId: 'p3' } },
        s
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('行动阶段');
    });

    it('should include wolf votes in visible state for wolves during night', () => {
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });

      const wolfView = game.getVisibleState('p2');
      expect(wolfView.wolfVotes.p1).toBe('p6');

      // Non-wolf should not see wolf votes
      const seerView = game.getVisibleState('p3');
      expect(seerView.wolfVotes).toEqual({});
    });

    it('should include nightSteps and currentNightStep in visible state', () => {
      const visible = game.getVisibleState('p3');
      expect(visible.nightSteps).toHaveLength(3);
      expect(visible.currentNightStep).toBe(0);
    });

    it('should add witch_night_info when witch step begins', () => {
      const { game: g2 } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: P0_ROLE_COUNTS_WITH_WITCH,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'hunter', p7: 'villager'
        }
      });

      // Advance to witch step
      submitNight(g2, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(g2, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(g2, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(g2, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });

      // Now in witch step — check state
      const s = g2.getState();
      expect(s.phase).toBe(PHASES.NIGHT);
      expect(s.pendingNightRoles).toEqual(['p5']);
      const witchInfo = s.dayAnnouncements.find(a => a.type === 'witch_night_info');
      expect(witchInfo).toBeDefined();
      expect(witchInfo.wolfTarget).toBe('p7');
    });
  });
});
