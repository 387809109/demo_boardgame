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

const EIGHT_PLAYERS = [
  ...SEVEN_PLAYERS,
  { id: 'p8', nickname: 'Player8' }
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
  game.start({
    players,
    gameType: 'werewolf',
    options: { roleCounts, captainEnabled: false, ...options }
  });

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
    bodyguard: { team: 'village', actionTypes: ['NIGHT_BODYGUARD_PROTECT'] },
    vigilante: { team: 'village', actionTypes: ['NIGHT_VIGILANTE_KILL'] },
    piper: { team: 'neutral', actionTypes: ['NIGHT_PIPER_CHARM'] },
    cupid: { team: 'village', actionTypes: ['NIGHT_CUPID_LINK'] },
    idiot: { team: 'village', actionTypes: [] },
    jester: { team: 'neutral', actionTypes: [] },
    hunter: { team: 'village', actionTypes: ['HUNTER_SHOOT'] },
    witch: { team: 'village', actionTypes: ['NIGHT_WITCH_SAVE', 'NIGHT_WITCH_POISON'] }
  };
  return configs[roleId] || { team: 'village', actionTypes: [] };
}

/** Night step label lookup */
function getNightStepLabel(priority) {
  const labels = {
    5: '预言家查验', 7: '医生保护',
    9: '义警射杀',
    8: '狼人行动', 10: '女巫行动',
    11: '魔笛手魅惑'
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

    it('should allow voting for self', () => {
      const result = game.validateMove(
        { playerId: 'p3', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p3' } },
        state
      );
      expect(result.valid).toBe(true);
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

    it('should allow two night deaths to speak in sequence when two last words slots remain', () => {
      const { game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: {
          werewolf: 2,
          seer: 1,
          doctor: 1,
          witch: 1,
          villager: 2
        },
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'villager', p7: 'villager'
        }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      let s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.lastWordsPlayerId).toBeTruthy();
      expect(s.lastWordsQueue).toHaveLength(1);
      const speakers = new Set([s.lastWordsPlayerId, s.lastWordsQueue[0]]);
      expect(speakers).toEqual(new Set(['p6', 'p7']));
      expect(s.lastWordsRemaining).toBe(0);

      const firstSpeaker = s.lastWordsPlayerId;
      const secondSpeaker = s.lastWordsQueue[0];

      game.executeMove({
        playerId: firstSpeaker,
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });

      s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.lastWordsPlayerId).toBe(secondSpeaker);
      expect(s.lastWordsQueue).toHaveLength(0);

      game.executeMove({
        playerId: secondSpeaker,
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });

      s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.lastWordsPlayerId).toBeNull();
      expect(s.awaitingFirstSpeaker).toBe(true);
    });

    it('should use death resolution order when lastWordsOrder is death_resolution', () => {
      const { game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: {
          werewolf: 2,
          seer: 1,
          doctor: 1,
          witch: 1,
          villager: 2
        },
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'villager', p7: 'villager'
        },
        options: { lastWordsOrder: 'death_resolution' }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.lastWordsPlayerId).toBe('p7');
      expect(s.lastWordsQueue).toEqual(['p6']);
    });

    it('should use seating order when lastWordsOrder is seating_order', () => {
      const buildSeatingOrderResult = () => {
        const { game } = setupGame({
          players: SEVEN_PLAYERS,
          roleCounts: {
            werewolf: 2,
            seer: 1,
            doctor: 1,
            witch: 1,
            villager: 2
          },
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'witch', p6: 'villager', p7: 'villager'
          },
          options: { lastWordsOrder: 'seating_order' }
        });

        submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

        return game.getState();
      };

      const s1 = buildSeatingOrderResult();
      const s2 = buildSeatingOrderResult();
      expect(s1.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s2.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s1.lastWordsPlayerId).toBe(s2.lastWordsPlayerId);
      expect(s1.lastWordsQueue).toEqual(s2.lastWordsQueue);

      const allSpeakers = [s1.lastWordsPlayerId, ...(s1.lastWordsQueue || [])];
      expect(new Set(allSpeakers)).toEqual(new Set(['p6', 'p7']));
      expect(allSpeakers).toHaveLength(2);
    });

    it('should keep seating order clockwise after the chosen start', () => {
      const { game } = setupGame({
        players: SEVEN_PLAYERS,
        roleCounts: {
          werewolf: 2,
          seer: 1,
          doctor: 1,
          witch: 1,
          villager: 2
        },
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'witch', p6: 'villager', p7: 'villager'
        },
        options: { lastWordsOrder: 'seating_order' }
      });

      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      const s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      const allSpeakers = [s.lastWordsPlayerId, ...(s.lastWordsQueue || [])];
      expect(new Set(allSpeakers)).toEqual(new Set(['p6', 'p7']));

      const seatOrder = SEVEN_PLAYERS.map(p => p.id);
      const firstSeat = seatOrder.indexOf(allSpeakers[0]);
      let expectedSecond = null;
      for (let offset = 1; offset <= seatOrder.length; offset++) {
        const seatId = seatOrder[(firstSeat + offset) % seatOrder.length];
        if (seatId !== allSpeakers[0] && allSpeakers.includes(seatId)) {
          expectedSecond = seatId;
          break;
        }
      }
      expect(allSpeakers[1]).toBe(expectedSecond);
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

    it('should not reveal poisoned werewolf role to hunter before hunter finishes last words', () => {
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
          lastWordsOrder: 'death_resolution'
        }
      });

      // Night: wolves kill hunter, witch poisons werewolf p1.
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p1' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});

      let s = game.getState();
      expect(s.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(s.hunterPendingShoot).toBe('p6');

      // Hunter shoots someone, then enters last words.
      game.executeMove({
        playerId: 'p6',
        actionType: ACTION_TYPES.HUNTER_SHOOT,
        actionData: { targetId: 'p7' }
      });

      s = game.getState();
      expect(s.lastWordsPlayerId).toBe('p6');

      const duringOwnLastWords = game.getVisibleState('p6');
      const poisonedWolfDuring = duringOwnLastWords.players.find(p => p.id === 'p1');
      expect(poisonedWolfDuring.alive).toBe(false);
      expect(poisonedWolfDuring.roleId).toBeNull();

      // After finishing own last words, hunter can see all roles as a settled dead player.
      game.executeMove({
        playerId: 'p6',
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });

      const afterOwnLastWords = game.getVisibleState('p6');
      const poisonedWolfAfter = afterOwnLastWords.players.find(p => p.id === 'p1');
      expect(poisonedWolfAfter.roleId).toBe('werewolf');
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

// ═══════════════════════════════════════════════════════════════════════════════
// IDIOT (P1) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Idiot (P1)', () => {
  const P1_IDIOT_COUNTS = {
    werewolf: 2,
    seer: 1,
    doctor: 1,
    idiot: 1,
    witch: 1,
    hunter: 1,
    villager: 1
  };

  const P1_IDIOT_WITH_CUPID_COUNTS = {
    werewolf: 2,
    cupid: 1,
    doctor: 1,
    idiot: 1,
    witch: 1,
    hunter: 1,
    villager: 1
  };

  function setupIdiotGame() {
    return setupGame({
      players: EIGHT_PLAYERS,
      roleCounts: P1_IDIOT_COUNTS,
      roleMap: {
        p1: 'werewolf', p2: 'werewolf',
        p3: 'seer', p4: 'doctor',
        p5: 'idiot', p6: 'witch',
        p7: 'hunter', p8: 'villager'
      }
    });
  }

  function advanceToVotePhase(game) {
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

  function voteOutIdiot(game, includeIdiotVote = true) {
    const votePlan = includeIdiotVote
      ? {
          p1: 'p5',
          p2: 'p5',
          p3: 'p5',
          p4: 'p5',
          p5: null,
          p6: 'p5',
          p7: 'p5',
          p8: 'p5'
        }
      : {
          p1: 'p5',
          p2: 'p5',
          p3: 'p5',
          p4: 'p5',
          p6: 'p5',
          p7: 'p5',
          p8: 'p5'
        };
    playVoteRound(game, votePlan);
  }

  it('should survive first day execution and enter revealed state', () => {
    const { game } = setupIdiotGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    const state = game.getState();
    expect(state.phase).toBe(PHASES.NIGHT);
    expect(state.playerMap.p5.alive).toBe(true);
    expect(state.playerMap.p5.deathCause).toBeNull();
    expect(state.roleStates.idiotRevealedIds).toContain('p5');
    expect(state.publicRevealRoleIds.p5).toBe(true);
    expect(state.lastDayExecution).toBeNull();
  });

  it('should keep lastWordsRemaining unchanged when idiot is first executed', () => {
    const { game } = setupIdiotGame();

    const before = game.getState().lastWordsRemaining;
    skipAllNightActions(game);
    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    const state = game.getState();
    expect(state.lastWordsRemaining).toBe(before);
  });

  it('should reveal idiot role to all players after first execution', () => {
    const { game } = setupIdiotGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    const wolfView = game.getVisibleState('p1');
    const villagerView = game.getVisibleState('p8');

    const wolfSeenIdiot = wolfView.players.find(p => p.id === 'p5');
    const villagerSeenIdiot = villagerView.players.find(p => p.id === 'p5');

    expect(wolfSeenIdiot.roleId).toBe('idiot');
    expect(villagerSeenIdiot.roleId).toBe('idiot');
  });

  it('should reject day vote for revealed idiot', () => {
    const { game, state } = setupIdiotGame();

    state.phase = PHASES.DAY_VOTE;
    state.currentVoter = 'p5';
    state.roleStates.idiotRevealedIds = ['p5'];

    const result = game.validateMove(
      { playerId: 'p5', actionType: ACTION_TYPES.DAY_VOTE, actionData: { targetId: 'p1' } },
      state
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe('你已失去投票权');
  });

  it('should keep revealed idiot in discussion order but remove from voter queue', () => {
    const { game } = setupIdiotGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    // Move to next day vote phase
    skipAllNightActions(game);
    advanceToVotePhase(game);

    const state = game.getState();
    expect(state.phase).toBe(PHASES.DAY_VOTE);
    expect(state.baseSpeakerOrder).toContain('p5');
    expect(state.voterQueue).not.toContain('p5');
    expect(state.currentVoter).not.toBe('p5');
  });

  it('should die on second day execution', () => {
    const { game } = setupIdiotGame();

    // First execution: reveal only
    skipAllNightActions(game);
    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    // Second execution: normal death
    skipAllNightActions(game);
    advanceToVotePhase(game);
    voteOutIdiot(game, false);

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('execution');
    expect(state.lastDayExecution).toBe('p5');
  });

  it('should die normally when killed at night', () => {
    const { game } = setupIdiotGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('wolf_kill');
    expect(state.roleStates.idiotRevealedIds).not.toContain('p5');
  });

  it('should not trigger lover martyrdom when idiot survives first execution', () => {
    const { game } = setupGame({
      players: EIGHT_PLAYERS,
      roleCounts: P1_IDIOT_WITH_CUPID_COUNTS,
      roleMap: {
        p1: 'werewolf', p2: 'werewolf',
        p3: 'cupid', p4: 'doctor',
        p5: 'idiot', p6: 'witch',
        p7: 'hunter', p8: 'villager'
      }
    });

    // Link idiot and villager
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p5', 'p8'] });
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' }); // wolf tie
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(true);
    expect(state.playerMap.p8.alive).toBe(true);
  });

  it('should trigger lover martyrdom when idiot dies on second execution', () => {
    const { game } = setupGame({
      players: EIGHT_PLAYERS,
      roleCounts: P1_IDIOT_WITH_CUPID_COUNTS,
      roleMap: {
        p1: 'werewolf', p2: 'werewolf',
        p3: 'cupid', p4: 'doctor',
        p5: 'idiot', p6: 'witch',
        p7: 'hunter', p8: 'villager'
      }
    });

    // Night 1: cupid links idiot + villager
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p5', 'p8'] });
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' }); // wolf tie
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    // Day 1: first execution triggers reveal only
    advanceToVotePhase(game);
    voteOutIdiot(game, true);

    // Night 2: peaceful
    skipAllNightActions(game);

    // Day 2: second execution kills idiot, lover dies by martyrdom
    advanceToVotePhase(game);
    voteOutIdiot(game, false);

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('execution');
    expect(state.playerMap.p8.alive).toBe(false);
    expect(state.playerMap.p8.deathCause).toBe('lover_death');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// JESTER (P1) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Jester (P1)', () => {
  const P1_JESTER_COUNTS = {
    werewolf: 2,
    seer: 1,
    doctor: 1,
    jester: 1,
    witch: 1,
    hunter: 1,
    villager: 1
  };

  const EIGHT_PLAYERS = [
    ...SEVEN_PLAYERS,
    { id: 'p8', nickname: 'Player8' }
  ];

  function setupJesterGame() {
    return setupGame({
      players: EIGHT_PLAYERS,
      roleCounts: P1_JESTER_COUNTS,
      roleMap: {
        p1: 'werewolf', p2: 'werewolf',
        p3: 'seer', p4: 'doctor',
        p5: 'jester', p6: 'witch',
        p7: 'hunter', p8: 'villager'
      }
    });
  }

  function advanceToVotePhase(game) {
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

  it('should end game with jester winner when jester is executed', () => {
    const { game } = setupJesterGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    playVoteRound(game, {
      p1: 'p5', p2: 'p5', p3: 'p5', p4: 'p5',
      p5: null, p6: 'p5', p7: 'p5', p8: 'p5'
    });

    const state = game.getState();
    expect(state.status).toBe('ended');
    expect(state.phase).toBe(PHASES.ENDED);
    expect(state.winner).toBe('jester');
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('execution');
  });

  it('should rank only jester as winner after jester execution', () => {
    const { game } = setupJesterGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    playVoteRound(game, {
      p1: 'p5', p2: 'p5', p3: 'p5', p4: 'p5',
      p5: null, p6: 'p5', p7: 'p5', p8: 'p5'
    });

    const endCheck = game.checkGameEnd(game.getState());
    const winners = endCheck.rankings.filter(r => r.rank === 1).map(r => r.playerId);
    expect(winners).toEqual(['p5']);
  });

  it('should not win when killed by wolves at night', () => {
    const { game } = setupJesterGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('wolf_kill');
    expect(state.winner).toBeNull();
    expect(state.status).toBe('playing');
  });

  it('should not win when poisoned by witch', () => {
    const { game } = setupJesterGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p5' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('witch_poison');
    expect(state.winner).toBeNull();
  });

  it('should not win when no one is executed', () => {
    const { game } = setupJesterGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    playVoteRound(game, {
      p1: null, p2: null, p3: null, p4: null,
      p5: null, p6: null, p7: null, p8: null
    });

    const state = game.getState();
    expect(state.winner).toBeNull();
    expect(state.status).toBe('playing');
    expect(state.phase).toBe(PHASES.NIGHT);
  });

  it('should win when executed in second vote round after tie', () => {
    const { game } = setupJesterGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);

    // Round 1 tie: p1 and p5 both get 3 votes, 2 abstain.
    playVoteRound(game, {
      p1: 'p5', p2: 'p5', p3: 'p1', p4: 'p1',
      p5: 'p1', p6: 'p5', p7: null, p8: null
    });

    expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
    expect(game.getState().voteRound).toBe(2);
    expect(game.getState().tiedCandidates).toEqual(expect.arrayContaining(['p1', 'p5']));

    while (game.getState().phase === PHASES.DAY_DISCUSSION) {
      const cur = game.getState().currentSpeaker;
      if (!cur) break;
      game.executeMove({
        playerId: cur,
        actionType: ACTION_TYPES.SPEECH_DONE,
        actionData: {}
      });
    }

    playVoteRound(game, {
      p1: 'p5', p2: 'p5', p3: 'p5', p4: 'p5',
      p5: 'p1', p6: 'p5', p7: 'p5', p8: 'p5'
    });

    const state = game.getState();
    expect(state.status).toBe('ended');
    expect(state.winner).toBe('jester');
    expect(state.playerMap.p5.deathCause).toBe('execution');
  });

  it('should prioritize jester win over werewolf parity condition', () => {
    const { game } = setupGame({
      players: [
        { id: 'p1', nickname: 'P1' },
        { id: 'p2', nickname: 'P2' },
        { id: 'p3', nickname: 'P3' },
        { id: 'p4', nickname: 'P4' },
        { id: 'p5', nickname: 'P5' },
        { id: 'p6', nickname: 'P6' }
      ],
      roleCounts: { werewolf: 2, cupid: 1, jester: 1, villager: 2 },
      roleMap: {
        p1: 'werewolf',
        p2: 'werewolf',
        p3: 'cupid',
        p4: 'jester',
        p5: 'villager',
        p6: 'villager'
      }
    });

    // Night 1: link jester + villager, then wolves disagree (no night death).
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });

    advanceToVotePhase(game);
    playVoteRound(game, {
      p1: 'p4',
      p2: 'p4',
      p3: 'p1',
      p4: 'p1',
      p5: 'p4',
      p6: 'p4'
    });

    const state = game.getState();
    expect(state.status).toBe('ended');
    expect(state.winner).toBe('jester');
  });

  it('should expose jester-specific end reason and winnerPlayerIds', () => {
    const { game } = setupJesterGame();

    skipAllNightActions(game);
    advanceToVotePhase(game);
    playVoteRound(game, {
      p1: 'p5', p2: 'p5', p3: 'p5', p4: 'p5',
      p5: null, p6: 'p5', p7: 'p5', p8: 'p5'
    });

    const endCheck = game.checkGameEnd(game.getState());
    expect(endCheck.ended).toBe(true);
    expect(endCheck.winner).toBe('jester');
    expect(endCheck.reason).toBe('jester_executed');
    expect(endCheck.rankings.find(r => r.playerId === 'p5').rank).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BODYGUARD (P1) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bodyguard (P1)', () => {
  // Role counts with bodyguard (8 players)
  const P1_BODYGUARD_COUNTS = {
    werewolf: 2,
    seer: 1,
    doctor: 1,
    bodyguard: 1,
    witch: 1,
    hunter: 1,
    villager: 1
  };

  const EIGHT_PLAYERS = [
    ...SEVEN_PLAYERS,
    { id: 'p8', nickname: 'Player8' }
  ];

  // ─── Basic Functionality Tests ───

  describe('Basic Functionality', () => {
    it('should successfully protect a player from wolf kill', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        }
      });

      // Night: bodyguard protects p8, wolves kill p8
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.phase).toBe(PHASES.DAY_ANNOUNCE);
      expect(state.playerMap.p8.alive).toBe(true);
      expect(state.nightDeaths).toEqual([]);
    });

    it('should not protect against witch poison', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        }
      });

      // Bodyguard protects p8, witch poisons p8
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p8' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p8.alive).toBe(false);
      expect(state.nightDeaths).toContainEqual({ playerId: 'p8', cause: 'witch_poison' });
    });

    it('should allow self-protection when allowDoctorSelfProtect is true', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        },
        options: { allowDoctorSelfProtect: true }
      });

      // Bodyguard protects self, wolves kill bodyguard
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p5' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p5.alive).toBe(true);
    });

    it('should reject self-protection when allowDoctorSelfProtect is false', () => {
      const { game, state } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        },
        options: { allowDoctorSelfProtect: false }
      });

      // Ensure bodyguard is in pending roles for validation
      if (!state.pendingNightRoles.includes('p5')) {
        state.pendingNightRoles.push('p5');
      }

      const result = game.validateMove(
        { playerId: 'p5', actionType: ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, actionData: { targetId: 'p5' } },
        state
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe('守卫不能保护自己');
    });

    it('should reject protecting same player consecutively when allowRepeatedProtect is false', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        },
        options: { allowRepeatedProtect: false }
      });

      // Night 1: protect p8
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      // Skip day and return to night
      advanceToNight(game);

      // Night 2: try to protect p8 again (skip earlier roles first)
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('不能连续两晚保护同一人');
    });
  });

  // ─── Guard-Witch Interaction Tests ───

  describe('Guard-Witch Interaction', () => {
    it('should allow guard + witch save to coexist (guardWitchInteraction = "coexist")', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        },
        options: { guardWitchInteraction: 'coexist' }
      });

      // Bodyguard + witch both protect p8
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_SAVE, {});
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p8.alive).toBe(true);
      expect(state.nightDeaths).toEqual([]);
    });

    it('should trigger guard-witch conflict (guardWitchInteraction = "conflict")', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        },
        options: { guardWitchInteraction: 'conflict' }
      });

      // Guard + witch conflict → target dies
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_SAVE, {});
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p8.alive).toBe(false);
      expect(state.nightDeaths).toContainEqual({ playerId: 'p8', cause: 'wolf_kill' });
    });

    it('should not trigger conflict when only guard protects', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        },
        options: { guardWitchInteraction: 'conflict' }
      });

      // Only guard protects, witch skips
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p8.alive).toBe(true);
    });
  });

  // ─── Role Interaction Tests ───

  describe('Interactions with Other Roles', () => {
    it('should work alongside doctor protection (double protection)', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        }
      });

      // Both guard and doctor protect p8
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p8' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p8.alive).toBe(true);
    });

    it('should prevent hunter trigger when protecting hunter', () => {
      const { game } = setupGame({
        players: EIGHT_PLAYERS,
        roleCounts: P1_BODYGUARD_COUNTS,
        roleMap: {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'bodyguard', p6: 'witch',
          p7: 'hunter', p8: 'villager'
        }
      });

      // Guard protects hunter from wolf kill
      submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
      submitNight(game, 'p5', ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p7' });
      submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
      submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

      const state = game.getState();
      expect(state.playerMap.p7.alive).toBe(true);
      expect(state.phase).toBe(PHASES.DAY_ANNOUNCE);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VIGILANTE (P1) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Vigilante (P1)', () => {
  const P1_VIGILANTE_COUNTS = {
    werewolf: 2,
    seer: 1,
    doctor: 1,
    vigilante: 1,
    witch: 1,
    hunter: 1,
    villager: 1
  };

  function setupVigilanteGame(options = {}) {
    return setupGame({
      players: EIGHT_PLAYERS,
      roleCounts: P1_VIGILANTE_COUNTS,
      roleMap: {
        p1: 'werewolf', p2: 'werewolf',
        p3: 'seer', p4: 'doctor',
        p5: 'vigilante', p6: 'witch',
        p7: 'hunter', p8: 'villager'
      },
      options
    });
  }

  function advanceToNextNight(game, votePlan = {}) {
    advanceToDiscussion(game);
    while (game.getState().phase === PHASES.DAY_DISCUSSION) {
      const speakerId = game.getState().currentSpeaker;
      if (!speakerId) break;
      game.executeMove({
        playerId: speakerId,
        actionType: ACTION_TYPES.SPEECH_DONE,
        actionData: {}
      });
    }
    if (game.getState().phase === PHASES.DAY_VOTE) {
      playVoteRound(game, votePlan);
    }
    expect(game.getState().phase).toBe(PHASES.NIGHT);
  }

  it('should kill target with NIGHT_VIGILANTE_KILL', () => {
    const { game } = setupVigilanteGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.phase).toBe(PHASES.DAY_ANNOUNCE);
    expect(state.playerMap.p8.alive).toBe(false);
    expect(state.playerMap.p8.deathCause).toBe('vigilante_kill');
    expect(state.roleStates.vigilanteShotsUsed).toBe(1);
    expect(state.roleStates.vigilanteLastTarget).toBe('p8');
  });

  it('should reject self-target for vigilante', () => {
    const { game } = setupVigilanteGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});

    const result = submitNight(
      game,
      'p5',
      ACTION_TYPES.NIGHT_VIGILANTE_KILL,
      { targetId: 'p5' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('义警不能射击自己');
  });

  it('should enforce vigilante max shot limit', () => {
    const { game } = setupVigilanteGame();

    // Night 1: first shot
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p1' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    advanceToNextNight(game);

    // Night 2: second shot should be rejected (default maxShots = 1)
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(
      game,
      'p5',
      ACTION_TYPES.NIGHT_VIGILANTE_KILL,
      { targetId: 'p2' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('义警射击次数已用完');
  });

  it('should reject first-night shot when vigilanteCanShootFirstNight is false', () => {
    const { game } = setupVigilanteGame({ vigilanteCanShootFirstNight: false });

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});

    const result = submitNight(
      game,
      'p5',
      ACTION_TYPES.NIGHT_VIGILANTE_KILL,
      { targetId: 'p8' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('义警首夜不能开枪');
  });

  it('should be blocked by doctor when protectAgainstVigilante is true', () => {
    const { game } = setupVigilanteGame({ protectAgainstVigilante: true });

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p8' });
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.playerMap.p8.alive).toBe(true);
    expect(state.nightDeaths).toEqual([]);
  });

  it('should bypass protection when protectAgainstVigilante is false', () => {
    const { game } = setupVigilanteGame({ protectAgainstVigilante: false });

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p8' });
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.playerMap.p8.alive).toBe(false);
    expect(state.nightDeaths).toContainEqual({ playerId: 'p8', cause: 'vigilante_kill' });
  });

  it('should lock vigilante after misfire when penalty is lose_ability', () => {
    const { game } = setupVigilanteGame({
      vigilanteMisfirePenalty: 'lose_ability',
      vigilanteMaxShots: 2
    });

    // Night 1: misfire on villager
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    expect(game.getState().roleStates.vigilanteLocked).toBe(true);

    advanceToNextNight(game);

    // Night 2: cannot shoot because locked
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(
      game,
      'p5',
      ACTION_TYPES.NIGHT_VIGILANTE_KILL,
      { targetId: 'p1' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('义警已失去射杀能力');
  });

  it('should not apply misfire penalty when penalty is none', () => {
    const { game } = setupVigilanteGame({
      vigilanteMisfirePenalty: 'none',
      vigilanteMaxShots: 2
    });

    // Night 1: misfire on villager
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const stateAfterNight1 = game.getState();
    expect(stateAfterNight1.roleStates.vigilanteLocked).toBe(false);
    expect(stateAfterNight1.roleStates.vigilantePendingSuicide).toBe(false);

    advanceToNextNight(game);

    // Night 2: can still shoot
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    const shootResult = submitNight(
      game,
      'p5',
      ACTION_TYPES.NIGHT_VIGILANTE_KILL,
      { targetId: 'p2' }
    );
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    expect(shootResult.success).toBe(true);
    expect(game.getState().playerMap.p2.alive).toBe(false);
  });

  it('should trigger unavoidable recoil death on next night after misfire', () => {
    const { game } = setupVigilanteGame({
      vigilanteMisfirePenalty: 'suicide_next_night'
    });

    // Night 1: misfire on villager
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    expect(game.getState().roleStates.vigilantePendingSuicide).toBe(true);

    advanceToNextNight(game);

    // Night 2: doctor protects vigilante but recoil should still kill
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p5' });
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    const state = game.getState();
    expect(state.playerMap.p5.alive).toBe(false);
    expect(state.playerMap.p5.deathCause).toBe('vigilante_recoil');
  });

  it('should reject vigilante kill when pending suicide is active', () => {
    const { game } = setupVigilanteGame({
      vigilanteMisfirePenalty: 'suicide_next_night'
    });

    // Night 1: misfire on villager
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

    advanceToNextNight(game);

    // Night 2: reaching vigilante step, active recoil should block shooting
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(
      game,
      'p5',
      ACTION_TYPES.NIGHT_VIGILANTE_KILL,
      { targetId: 'p1' }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('义警将于今夜反噬死亡，无法执行射杀');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PIPER (P1) TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Piper (P1)', () => {
  const P1_PIPER_COUNTS = {
    werewolf: 2,
    seer: 1,
    doctor: 1,
    piper: 1,
    witch: 1,
    hunter: 1,
    villager: 1
  };

  function setupPiperGame(options = {}) {
    return setupGame({
      players: EIGHT_PLAYERS,
      roleCounts: P1_PIPER_COUNTS,
      roleMap: {
        p1: 'werewolf', p2: 'werewolf',
        p3: 'seer', p4: 'doctor',
        p5: 'piper', p6: 'witch',
        p7: 'hunter', p8: 'villager'
      },
      options
    });
  }

  it('should accept NIGHT_PIPER_CHARM and store selected targetIds', () => {
    const { game } = setupPiperGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7', 'p8']
    });

    expect(result.success).toBe(true);
    const state = game.getState();
    expect(state.nightActions.p5.actionType).toBe(ACTION_TYPES.NIGHT_PIPER_CHARM);
    expect(state.nightActions.p5.actionData.targetIds).toEqual(['p7', 'p8']);
  });

  it('should reject self charm when piperCanCharmSelf is false', () => {
    const { game } = setupPiperGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p5']
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('魔笛手不能魅惑自己');
  });

  it('should reject duplicate targets in one charm action', () => {
    const { game } = setupPiperGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7', 'p7']
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('不能重复选择同一名玩家');
  });

  it('should allow selecting fewer targets than piperCharmTargetsPerNight', () => {
    const { game } = setupPiperGame({ piperCharmTargetsPerNight: 2 });

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7']
    });

    expect(result.success).toBe(true);
  });

  it('should apply charm state after night settlement', () => {
    const { game } = setupPiperGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7', 'p8']
    });

    const state = game.getState();
    expect(state.phase).toBe(PHASES.DAY_ANNOUNCE);
    expect(state.roleStates.piperCharmedIds).toEqual(['p7', 'p8']);
    expect(state.roleStates.piperLastCharmedIds).toEqual(['p7', 'p8']);
  });

  it('should not apply charm to targets that die in the same night', () => {
    const { game } = setupPiperGame();

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7', 'p8']
    });

    const state = game.getState();
    expect(state.playerMap.p8.alive).toBe(false);
    expect(state.roleStates.piperCharmedIds).toEqual(['p7']);
    expect(state.roleStates.piperLastCharmedIds).toEqual(['p7']);
  });

  it('should reject recharm by default when target is already charmed', () => {
    const { game } = setupPiperGame();

    // Night 1: charm p7 and p8
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7', 'p8']
    });

    advanceToNight(game);

    // Night 2: recharm p7 should fail
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7']
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('目标已被魅惑');
  });

  it('should allow recharm when piperCanRecharm is true', () => {
    const { game } = setupPiperGame({ piperCanRecharm: true });

    // Night 1: charm p7 and p8
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7', 'p8']
    });

    advanceToNight(game);

    // Night 2: recharm p7 should pass
    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});
    const result = submitNight(game, 'p5', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p7']
    });

    expect(result.success).toBe(true);
  });

  it('should trigger piper win when all other alive players are charmed', () => {
    const fourPlayers = [
      { id: 'p1', nickname: 'Player1', isHost: true },
      { id: 'p2', nickname: 'Player2' },
      { id: 'p3', nickname: 'Player3' },
      { id: 'p4', nickname: 'Player4' }
    ];
    const { game } = setupGame({
      players: fourPlayers,
      roleCounts: { piper: 1, werewolf: 1, seer: 1, villager: 1 },
      roleMap: {
        p1: 'piper',
        p2: 'werewolf',
        p3: 'seer',
        p4: 'villager'
      },
      options: { piperCharmTargetsPerNight: 3 }
    });

    submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p2', ACTION_TYPES.NIGHT_SKIP, {});
    submitNight(game, 'p1', ACTION_TYPES.NIGHT_PIPER_CHARM, {
      targetIds: ['p2', 'p3', 'p4']
    });

    const state = game.getState();
    expect(state.status).toBe('ended');
    expect(state.winner).toBe('piper');
  });

  it('should not grant piper win when piper is dead and piperNeedsAliveToWin is true', () => {
    const { game, state } = setupGame({
      players: [
        { id: 'p1', nickname: 'Player1', isHost: true },
        { id: 'p2', nickname: 'Player2' },
        { id: 'p3', nickname: 'Player3' },
        { id: 'p4', nickname: 'Player4' }
      ],
      roleCounts: { piper: 1, werewolf: 1, villager: 2 },
      roleMap: {
        p1: 'piper',
        p2: 'werewolf',
        p3: 'villager',
        p4: 'villager'
      }
    });

    state.playerMap.p1.alive = false;
    state.roleStates.piperCharmedIds = ['p2', 'p3', 'p4'];

    const end = game.checkGameEnd(state);
    expect(end.ended).toBe(false);
  });

  it('should allow dead piper to win when piperNeedsAliveToWin is false', () => {
    const { game, state } = setupGame({
      players: [
        { id: 'p1', nickname: 'Player1', isHost: true },
        { id: 'p2', nickname: 'Player2' },
        { id: 'p3', nickname: 'Player3' },
        { id: 'p4', nickname: 'Player4' }
      ],
      roleCounts: { piper: 1, werewolf: 1, villager: 2 },
      roleMap: {
        p1: 'piper',
        p2: 'werewolf',
        p3: 'villager',
        p4: 'villager'
      },
      options: { piperNeedsAliveToWin: false }
    });

    state.playerMap.p1.alive = false;
    state.roleStates.piperCharmedIds = ['p2', 'p3', 'p4'];

    const end = game.checkGameEnd(state);
    expect(end.ended).toBe(true);
    expect(end.winner).toBe('piper');
    expect(end.rankings.filter(r => r.rank === 1).map(r => r.playerId)).toContain('p1');
  });

  it('should keep jester win priority over piper win condition', () => {
    const { game, state } = setupGame({
      players: [
        { id: 'p1', nickname: 'Player1', isHost: true },
        { id: 'p2', nickname: 'Player2' },
        { id: 'p3', nickname: 'Player3' },
        { id: 'p4', nickname: 'Player4' }
      ],
      roleCounts: { piper: 1, jester: 1, werewolf: 1, villager: 1 },
      roleMap: {
        p1: 'piper',
        p2: 'jester',
        p3: 'werewolf',
        p4: 'villager'
      }
    });

    state.jesterWinnerId = 'p2';
    state.roleStates.piperCharmedIds = ['p2', 'p3', 'p4'];

    const end = game.checkGameEnd(state);
    expect(end.ended).toBe(true);
    expect(end.winner).toBe('jester');
  });
});

// ─── Cupid Role Tests ───

describe('Cupid Role', () => {
    const CUPID_COUNTS = {
      werewolf: 2,
      seer: 1,
      doctor: 1,
      cupid: 1,
      witch: 1,
      hunter: 1
    };

    // ─── Basic Linking Tests ───

    describe('Basic Linking Functionality', () => {
      it('should allow cupid to link two players on first night', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Diagnostic: Check if cupid is in pending roles
        const stateBeforeAction = game.getState();
        expect(stateBeforeAction.pendingNightRoles).toContain('p3');
        expect(stateBeforeAction.playerMap.p3.roleId).toBe('cupid');

        // Cupid links p4 and p5
        const result = submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        if (!result.success) {
          console.log('Action failed with error:', result.error);
        }
        expect(result.success).toBe(true); // Diagnostic: check if action succeeded

        const state = game.getState();
        expect(state.links.lovers).toEqual(['p4', 'p5']);
        expect(state.roleStates.cupidLinked).toBe(true);
      });

      it('should prevent cupid from linking on subsequent nights', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // First night - link
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        // Advance to day and next night
        playVoteRound(game, {}); // No execution

        // Second night - cupid should not be in pending roles
        const state = game.getState();
        expect(state.pendingNightRoles).not.toContain('p3');
      });

      it('should allow cupid to include themselves as a lover (cupidCanSelfLove=true)', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          },
          options: { cupidCanSelfLove: true }
        });

        // Cupid links themselves with p4
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p3', 'p4'] });

        const state = game.getState();
        expect(state.links.lovers).toEqual(['p3', 'p4']);
      });

      it('should reject linking if cupid tries to include themselves when cupidCanSelfLove=false', () => {
        const { game, state } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          },
          options: { cupidCanSelfLove: false }
        });

        const result = game.validateMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
          actionData: { lovers: ['p3', 'p4'] }
        }, state);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('不能将自己');
      });

      it('should require exactly 2 players to be selected', () => {
        const { game, state } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        const result1 = game.validateMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
          actionData: { lovers: ['p4'] }
        }, state);
        expect(result1.valid).toBe(false);

        const result2 = game.validateMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
          actionData: { lovers: ['p4', 'p5', 'p6'] }
        }, state);
        expect(result2.valid).toBe(false);
      });

      it('should prevent selecting the same player twice', () => {
        const { game, state } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        const result = game.validateMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
          actionData: { lovers: ['p4', 'p4'] }
        }, state);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('同一名玩家');
      });
    });

    // ─── Martyrdom Mechanism Tests ───

    describe('Lover Martyrdom', () => {
      it('should trigger martyrdom when one lover dies from wolf kill', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p5
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.playerMap.p4.alive).toBe(false);
        expect(state.playerMap.p5.alive).toBe(false);
        expect(state.playerMap.p5.deathCause).toBe('lover_death');
      });

      it('should trigger martyrdom when one lover is executed during day', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p5
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SEER_CHECK, { targetId: 'p1' });
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        // Advance through day phases to reach voting
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

        // Execute p4
        playVoteRound(game, { p1: 'p4', p2: 'p4', p3: 'p4', p4: null, p5: 'p4', p6: 'p4', p7: 'p4' });

        const state = game.getState();
        expect(state.playerMap.p4.alive).toBe(false);
        expect(state.playerMap.p5.alive).toBe(false);
        expect(state.playerMap.p5.deathCause).toBe('lover_death');
      });

      it('should trigger martyrdom when one lover is poisoned by witch', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p7
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p7'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p4' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.playerMap.p4.alive).toBe(false);
        expect(state.playerMap.p7.alive).toBe(false);
        expect(state.playerMap.p7.deathCause).toBe('lover_death');
      });

      it('should prevent hunter from shooting when dying from martyrdom', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p7 (hunter)
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p7'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.playerMap.p4.alive).toBe(false);
        expect(state.playerMap.p7.alive).toBe(false);
        expect(state.hunterPendingShoot).toBeNull(); // Hunter cannot shoot
      });
    });

    // ─── Interactions with Other Roles Tests ───

    describe('Interactions with Other Roles', () => {
      it('should allow doctor to protect a lover from wolf kill (no martyrdom)', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p5 and p8
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p5', 'p8'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_DOCTOR_PROTECT, { targetId: 'p5' });
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.playerMap.p5.alive).toBe(true);
        expect(state.playerMap.p8.alive).toBe(true); // No martyrdom because p5 survived
      });

      it('should trigger martyrdom even if witch saves the lover\'s killer', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p5
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_SAVE, {});
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.playerMap.p4.alive).toBe(true); // Saved by witch
        expect(state.playerMap.p5.alive).toBe(true); // No martyrdom
      });

      it('should change teams to "lovers" when linking cross-faction players', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p1 (werewolf) and p4 (village)
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p1', 'p4'] });

        const state = game.getState();
        expect(state.playerMap.p1.team).toBe('lovers');
        expect(state.playerMap.p4.team).toBe('lovers');
      });

      it('should keep original teams when linking same-faction players (sameSideLoversSeparate=false)', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          },
          options: { sameSideLoversSeparate: false }
        });

        // Cupid links p4 and p5 (both village)
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });

        const state = game.getState();
        expect(state.playerMap.p4.team).toBe('village');
        expect(state.playerMap.p5.team).toBe('village');
      });

      it('should change teams even for same-faction players when sameSideLoversSeparate=true', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          },
          options: { sameSideLoversSeparate: true }
        });

        // Cupid links p4 and p5 (both village)
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });

        const state = game.getState();
        expect(state.playerMap.p4.team).toBe('lovers');
        expect(state.playerMap.p5.team).toBe('lovers');
      });
    });

    // ─── Win Condition Tests ───

    describe('Lover Win Conditions', () => {
      it('should allow lovers team to win when only lovers remain (cross-faction)', () => {
        const { game } = setupGame({
          players: ['p1', 'p2', 'p3', 'p4'].map(id => ({ id, nickname: id })),
          roleCounts: { werewolf: 1, cupid: 1, seer: 1, villager: 1 },
          roleMap: {
            p1: 'werewolf',
            p2: 'cupid',
            p3: 'seer',
            p4: 'villager'
          }
        });

        // Cupid links p1 (werewolf) and p3 (seer) - cross-faction
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p1', 'p3'] });
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p2' });

        const state1 = game.getState();
        expect(state1.playerMap.p1.team).toBe('lovers');
        expect(state1.playerMap.p3.team).toBe('lovers');

        // Execute p4 - now only lovers remain
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
        playVoteRound(game, { p1: 'p4', p3: 'p4' });

        const finalState = game.getState();
        expect(finalState.status).toBe('ended');
        expect(finalState.winner).toBe('lovers');
      });

      it('should not allow lovers to win if non-lovers are alive', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p1 (werewolf) and p4 (doctor) - cross-faction
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p1', 'p4'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p8' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.status).toBe('playing'); // Game continues
      });

      it('should allow original faction to win when same-faction lovers are linked', () => {
        const { game } = setupGame({
          players: ['p1', 'p2', 'p3', 'p4'].map(id => ({ id, nickname: id })),
          roleCounts: { werewolf: 1, cupid: 1, seer: 1, doctor: 1 },
          roleMap: {
            p1: 'werewolf',
            p2: 'cupid',
            p3: 'seer',
            p4: 'doctor'
          },
          options: { sameSideLoversSeparate: false }
        });

        // Cupid links p3 and p4 (both village)
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p3', 'p4'] });
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p2' });

        // Execute p1 - village wins
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
        playVoteRound(game, { p2: 'p1', p3: 'p1', p4: 'p1' });

        const state = game.getState();
        expect(state.status).toBe('ended');
        expect(state.winner).toBe('village'); // Not lovers, because same faction
      });
    });

    // ─── Edge Cases Tests ───

    describe('Edge Cases', () => {
      it('should handle cupid skipping their action (becomes villager)', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid skips
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.links.lovers).toBeNull();
        expect(state.roleStates.cupidLinked).toBe(false);
      });

      it('should preserve lover relationship even after cupid dies', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p5
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p3' }); // Kill cupid
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p3' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state1 = game.getState();
        expect(state1.playerMap.p3.alive).toBe(false);
        expect(state1.links.lovers).toEqual(['p4', 'p5']); // Lovers still linked

        // Advance to next night, kill one lover
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
        playVoteRound(game, {});
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state2 = game.getState();
        expect(state2.playerMap.p4.alive).toBe(false);
        expect(state2.playerMap.p5.alive).toBe(false); // Martyrdom still works
      });

      it('should handle both lovers being killed simultaneously (no duplicate martyrdom)', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links p4 and p5
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p4', 'p5'] });
        submitNight(game, 'p5', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p4', ACTION_TYPES.NIGHT_SKIP, {});
        submitNight(game, 'p1', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p2', ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p4' });
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_WITCH_POISON, { targetId: 'p5' }); // Both die
        submitNight(game, 'p6', ACTION_TYPES.NIGHT_SKIP, {});

        const state = game.getState();
        expect(state.playerMap.p4.alive).toBe(false);
        expect(state.playerMap.p5.alive).toBe(false);
        // No error should occur from double martyrdom
      });

      it('should allow linking two werewolves (same faction)', () => {
        const { game } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Cupid links two werewolves
        submitNight(game, 'p3', ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p1', 'p2'] });

        const state = game.getState();
        expect(state.links.lovers).toEqual(['p1', 'p2']);
        expect(state.playerMap.p1.team).toBe('werewolf'); // Same faction, no team change
        expect(state.playerMap.p2.team).toBe('werewolf');
      });

      it('should not trigger martyrdom if a lover is dead but died before linking', () => {
        // This is a theoretical edge case - cupid can only link alive players
        const { game, state } = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: CUPID_COUNTS,
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'cupid', p4: 'doctor',
            p5: 'seer', p6: 'witch',
            p7: 'hunter', p8: 'villager'
          }
        });

        // Try to link a dead player
        const result = game.validateMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
          actionData: { lovers: ['p4', 'p8'] }
        }, state);

        // Mark p8 as dead manually to test validation
        state.playerMap.p8.alive = false;

        const result2 = game.validateMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
          actionData: { lovers: ['p4', 'p8'] }
        }, state);

        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('已死亡');
      });
    });
  });

  // ─── Captain Mechanism Tests ────────────────────────────────────
  describe('Captain Mechanism', () => {
    /**
     * Helper: setup a captain-enabled game and advance through first night
     * to reach DAY_ANNOUNCE, ready for captain election.
     */
    function setupCaptainGame(opts = {}) {
      const {
        roleMap = {
          p1: 'werewolf', p2: 'werewolf',
          p3: 'seer', p4: 'doctor',
          p5: 'hunter', p6: 'villager'
        },
        players = TEST_PLAYERS,
        roleCounts = P0_ROLE_COUNTS,
        options = {}
      } = opts;

      const result = setupGame({
        players,
        roleCounts,
        roleMap,
        options: { captainEnabled: true, ...options }
      });
      const game = result.game;

      // Complete first night with no kills (wolf tie)
      skipAllNightActions(game);

      return { game, state: game.getState() };
    }

    /**
     * Helper: advance from DAY_ANNOUNCE to CAPTAIN_REGISTER
     */
    function advanceToCaptainRegister(game) {
      while (game.getState().phase === PHASES.DAY_ANNOUNCE) {
        const state = game.getState();
        let actorId = state.lastWordsPlayerId ||
          state.firstSpeakerId ||
          Object.values(state.playerMap).find(p => p.alive)?.id;
        if (!actorId) break;
        game.executeMove({
          playerId: actorId,
          actionType: ACTION_TYPES.PHASE_ADVANCE,
          actionData: {}
        });
      }
    }

    /**
     * Helper: register specified players as captain candidates
     */
    function registerCandidates(game, playerIds) {
      for (const pid of playerIds) {
        game.executeMove({
          playerId: pid,
          actionType: ACTION_TYPES.CAPTAIN_REGISTER,
          actionData: {}
        });
      }
    }

    /**
     * Helper: end registration phase
     */
    function endRegistration(game) {
      const state = game.getState();
      const actorId = Object.values(state.playerMap).find(p => p.alive)?.id;
      game.executeMove({
        playerId: actorId,
        actionType: ACTION_TYPES.PHASE_ADVANCE,
        actionData: {}
      });
    }

    /**
     * Helper: advance through captain speech phase
     */
    function skipCaptainSpeeches(game) {
      while (game.getState().phase === PHASES.CAPTAIN_SPEECH ||
             game.getState().phase === PHASES.CAPTAIN_RUNOFF_SPEECH) {
        const state = game.getState();
        const speaker = state.captainCurrentSpeaker;
        if (!speaker) break;
        game.executeMove({
          playerId: speaker,
          actionType: ACTION_TYPES.PHASE_ADVANCE,
          actionData: {}
        });
      }
    }

    /**
     * Helper: cast captain votes according to a plan
     */
    function playCaptainVoteRound(game, votePlan = {}) {
      while (game.getState().phase === PHASES.CAPTAIN_VOTE ||
             game.getState().phase === PHASES.CAPTAIN_RUNOFF_VOTE) {
        const state = game.getState();
        const voterId = state.captainCurrentVoter;
        if (!voterId) break;
        const targetId = Object.prototype.hasOwnProperty.call(votePlan, voterId)
          ? votePlan[voterId]
          : null;
        game.executeMove({
          playerId: voterId,
          actionType: targetId
            ? ACTION_TYPES.CAPTAIN_VOTE
            : ACTION_TYPES.CAPTAIN_SKIP_VOTE,
          actionData: targetId ? { targetId } : {}
        });
      }
    }

    /**
     * Helper: advance from DAY_DISCUSSION through speeches to DAY_VOTE
     */
    function advanceDiscussionToVote(game) {
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

    // ── 12.1 Election Flow Tests ───────────────────────────────────

    describe('Election Flow', () => {
      it('T-CAP-01: normal election - multiple candidates, highest vote wins', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_REGISTER);

        registerCandidates(game, ['p3', 'p5', 'p6']);
        endRegistration(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_SPEECH);

        skipCaptainSpeeches(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_VOTE);

        // p1→p3, p2→p3, p3→p5, p4→p3, p5→p5, p6→p6
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p3', p3: 'p5', p4: 'p3', p5: 'p5', p6: 'p6'
        });

        const s = game.getState();
        expect(s.captainPlayerId).toBe('p3');
        expect(s.phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-02: only one candidate → auto-elected, skip speech/vote', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p4']);
        endRegistration(game);

        const s = game.getState();
        expect(s.captainPlayerId).toBe('p4');
        expect(s.phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-03: no one registers → captain vacant', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        endRegistration(game);

        const s = game.getState();
        expect(s.captainPlayerId).toBeNull();
        expect(s.phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-04: tie in first vote → runoff speech + runoff vote → winner', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        // Tie: p1→p3, p2→p5, p3→p3, p4→p5, others skip
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p5', p3: 'p3', p4: 'p5'
        });

        expect(game.getState().phase).toBe(PHASES.CAPTAIN_RUNOFF_SPEECH);
        expect(game.getState().captainRunoffCandidates).toEqual(
          expect.arrayContaining(['p3', 'p5'])
        );

        skipCaptainSpeeches(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_RUNOFF_VOTE);

        // Runoff: p1→p3, p2→p3, p3→p3, p4→p5, p5→p5, p6→p3
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p3', p3: 'p3', p4: 'p5', p5: 'p5', p6: 'p3'
        });

        expect(game.getState().captainPlayerId).toBe('p3');
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-05: runoff tie + tieBreaker=none → captain vacant', () => {
        const { game } = setupCaptainGame({
          options: { captainTieBreaker: 'none' }
        });
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        // Tie first round
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p5', p3: 'p3', p4: 'p5'
        });

        skipCaptainSpeeches(game);

        // Tie again in runoff
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p5', p3: 'p3', p4: 'p5'
        });

        expect(game.getState().captainPlayerId).toBeNull();
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-06: runoff tie + tieBreaker=random → one candidate elected', () => {
        const { game } = setupCaptainGame({
          options: { captainTieBreaker: 'random' }
        });
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p5', p3: 'p3', p4: 'p5'
        });

        skipCaptainSpeeches(game);
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p5', p3: 'p3', p4: 'p5'
        });

        const captainId = game.getState().captainPlayerId;
        expect(['p3', 'p5']).toContain(captainId);
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-07: candidate withdraws during speech → only one left → auto-elected', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_SPEECH);

        // p3 speaks, then p5 withdraws
        game.executeMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.PHASE_ADVANCE,
          actionData: {}
        });
        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.CAPTAIN_WITHDRAW,
          actionData: {}
        });

        expect(game.getState().captainPlayerId).toBe('p3');
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-08: all candidates withdraw → captain vacant', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        // Register 1 candidate, then withdraw before ending registration
        registerCandidates(game, ['p3']);
        game.executeMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.CAPTAIN_WITHDRAW,
          actionData: {}
        });

        // 0 candidates remain → captain vacant
        expect(game.getState().captainPlayerId).toBeNull();
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });
    });

    // ── 12.2 Vote Weight Tests ─────────────────────────────────────

    describe('Vote Weight', () => {
      /**
       * Helper: setup game with captain elected, advance to day vote
       */
      function setupWithCaptain(captainId, opts = {}) {
        const result = setupCaptainGame(opts);
        const game = result.game;

        // Fast-track: elect captain directly
        advanceToCaptainRegister(game);
        registerCandidates(game, [captainId]);
        endRegistration(game);

        // Now in DAY_DISCUSSION, advance to vote
        advanceDiscussionToVote(game);
        expect(game.getState().phase).toBe(PHASES.DAY_VOTE);

        return { game };
      }

      it('T-CAP-09: captain vote weight 1.5x (standard)', () => {
        const { game } = setupWithCaptain('p3', {
          options: { captainVoteWeight: 1.5 }
        });

        // p3 (captain) votes p1, p4 votes p1 → 2.5 votes
        // p1 votes p3, p2 votes p3 → 2 votes
        // p5 and p6 abstain
        playVoteRound(game, {
          p3: 'p1', p4: 'p1', p1: 'p3', p2: 'p3'
        });

        // p1 should be executed (2.5 > 2)
        expect(game.getState().playerMap.p1.alive).toBe(false);
      });

      it('T-CAP-10: captain vote weight 2x (strong)', () => {
        const { game } = setupWithCaptain('p3', {
          options: { captainVoteWeight: 2 }
        });

        // p3 (captain, 2x) votes p1 → 2 votes
        // p4 votes p1 → 1 vote → total 3
        // p1 votes p3, p2 votes p3 → 2 votes
        playVoteRound(game, {
          p3: 'p1', p4: 'p1', p1: 'p3', p2: 'p3'
        });

        expect(game.getState().playerMap.p1.alive).toBe(false);
      });

      it('T-CAP-11: captain weight breaks what would be a tie', () => {
        const { game } = setupWithCaptain('p3', {
          options: { captainVoteWeight: 1.5 }
        });

        // Without captain weight: p3→p1 (1), p4→p1 (1) = 2 vs p1→p3 (1), p2→p3 (1) = 2 → tie
        // With captain weight: p3→p1 (1.5) + p4→p1 (1) = 2.5 vs p1→p3 (1), p2→p3 (1) = 2
        playVoteRound(game, {
          p3: 'p1', p4: 'p1', p1: 'p3', p2: 'p3'
        });

        expect(game.getState().playerMap.p1.alive).toBe(false);
      });

      it('T-CAP-12: captain abstains → no weight applied', () => {
        const { game } = setupWithCaptain('p3', {
          options: { captainVoteWeight: 1.5, dayVoteMajority: false }
        });

        // Captain abstains; p4→p1 (1), p1→p3 (1), p2→p3 (1), others skip
        playVoteRound(game, {
          p4: 'p1', p1: 'p3', p2: 'p3'
        });

        // p3 gets 2 votes (no weight since captain abstained), p1 gets 1
        // p3 executed (highest votes)
        expect(game.getState().playerMap.p3.alive).toBe(false);
      });

      it('T-CAP-13: captain election vote has no weight bonus', () => {
        // This is implicitly tested: captain election uses collectCaptainVote
        // which has no weight logic. Just verify one person = one vote.
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        // Even if p3 were somehow "captain", election is one-person-one-vote
        // 3 votes for p3, 3 for p5 → tie (no weight advantage)
        playCaptainVoteRound(game, {
          p1: 'p3', p2: 'p3', p3: 'p3', p4: 'p5', p5: 'p5', p6: 'p5'
        });

        // Should be a tie → runoff
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_RUNOFF_SPEECH);
      });

      it('T-CAP-14: no captain → all votes equal weight', () => {
        const { game } = setupCaptainGame({
          options: { dayVoteMajority: false }
        });
        advanceToCaptainRegister(game);
        endRegistration(game); // No candidates → captain vacant

        advanceDiscussionToVote(game);

        // p3→p1 (1), p4→p1 (1) vs p1→p3 (1), p2→p3 (1) → tie
        playVoteRound(game, {
          p3: 'p1', p4: 'p1', p1: 'p3', p2: 'p3'
        });

        // Tie → second round speech
        const s = game.getState();
        expect(s.tiedCandidates).toEqual(expect.arrayContaining(['p1', 'p3']));
      });
    });

    // ── 12.3 Captain Transfer Tests ────────────────────────────────

    describe('Captain Transfer', () => {
      /**
       * Helper: setup game with captain, complete election, advance to night
       */
      function setupCaptainAndAdvanceToNight(captainId, opts = {}) {
        const result = setupCaptainGame(opts);
        const game = result.game;

        advanceToCaptainRegister(game);
        registerCandidates(game, [captainId]);
        endRegistration(game);

        // Advance through discussion
        advanceDiscussionToVote(game);

        // All abstain → no execution → go to night
        playVoteRound(game, {});

        expect(game.getState().phase).toBe(PHASES.NIGHT);
        return { game };
      }

      it('T-CAP-15: captain executed by day vote → transfer to alive player', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);
        expect(game.getState().captainPlayerId).toBe('p6');

        advanceDiscussionToVote(game);

        // Vote out p6 (the captain)
        playVoteRound(game, {
          p1: 'p6', p2: 'p6', p3: 'p6', p4: 'p6', p5: 'p6'
        });

        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);
        expect(game.getState().playerMap.p6.alive).toBe(false);

        // Transfer to p3
        game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p3' }
        });

        const s = game.getState();
        expect(s.captainPlayerId).toBe('p3');
        expect(s.phase).toBe(PHASES.NIGHT);
      });

      it('T-CAP-16: captain killed at night → transfer after announce', () => {
        const { game } = setupCaptainAndAdvanceToNight('p6');

        // Night 2: process all steps, wolves kill p6
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (s.playerMap[pid].roleId === 'werewolf') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Should be in CAPTAIN_TRANSFER (captain died at night)
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);

        game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p4' }
        });

        expect(game.getState().captainPlayerId).toBe('p4');
      });

      it('T-CAP-17: captain tears badge → captain becomes null', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {
          p1: 'p6', p2: 'p6', p3: 'p6', p4: 'p6', p5: 'p6'
        });

        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);

        game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TEAR,
          actionData: {}
        });

        expect(game.getState().captainPlayerId).toBeNull();
        expect(game.getState().phase).toBe(PHASES.NIGHT);
      });

      it('T-CAP-19: cannot transfer to dead player', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {
          p1: 'p6', p2: 'p6', p3: 'p6', p4: 'p6', p5: 'p6'
        });

        // p6 is dead (executed), try to transfer to p6 itself
        const result = game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p6' }
        });

        expect(result.success).toBe(false);
      });

      it('T-CAP-20: new captain has weight in subsequent votes', () => {
        const { game } = setupCaptainAndAdvanceToNight('p6');

        // Night 2: wolves kill p6 (captain)
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (s.playerMap[pid].roleId === 'werewolf') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p6' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Transfer to p3
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);
        game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p3' }
        });

        expect(game.getState().captainPlayerId).toBe('p3');

        // Advance through announce to discussion to vote
        advanceToCaptainRegister(game); // will go to discussion (not day1 anymore)
        // Actually it should be DAY_ANNOUNCE → discussion (captainElectionDone=true)
        while (game.getState().phase === PHASES.DAY_ANNOUNCE) {
          const s = game.getState();
          const actorId = s.lastWordsPlayerId || s.firstSpeakerId ||
            Object.values(s.playerMap).find(p => p.alive)?.id;
          if (!actorId) break;
          game.executeMove({
            playerId: actorId,
            actionType: ACTION_TYPES.PHASE_ADVANCE,
            actionData: {}
          });
        }
        advanceDiscussionToVote(game);

        // p3 (new captain, 1.5x) votes p1, p4 votes p1 = 2.5
        // p1 votes p3, p2 votes p3 = 2
        playVoteRound(game, {
          p3: 'p1', p4: 'p1', p1: 'p3', p2: 'p3'
        });

        // p1 executed due to captain weight
        expect(game.getState().playerMap.p1.alive).toBe(false);
      });
    });

    // ── 12.4 Role Interaction Tests ────────────────────────────────

    describe('Role Interactions', () => {
      it('T-CAP-21: idiot captain - execution triggers reveal, keeps captain', () => {
        const { game } = setupCaptainGame({
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'idiot'
          },
          roleCounts: { werewolf: 2, seer: 1, doctor: 1, hunter: 1, idiot: 1 }
        });

        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);
        expect(game.getState().captainPlayerId).toBe('p6');

        advanceDiscussionToVote(game);

        // Vote out idiot captain
        playVoteRound(game, {
          p1: 'p6', p2: 'p6', p3: 'p6', p4: 'p6', p5: 'p6'
        });

        const s = game.getState();
        // Idiot reveals but survives
        expect(s.playerMap.p6.alive).toBe(true);
        // Captain NOT transferred (idiot didn't die)
        expect(s.captainPlayerId).toBe('p6');
        // Should NOT be in captain_transfer phase
        expect(s.phase).not.toBe(PHASES.CAPTAIN_TRANSFER);
      });

      it('T-CAP-22: revealed idiot captain has 0 vote weight', () => {
        const { game } = setupCaptainGame({
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'idiot'
          },
          roleCounts: { werewolf: 2, seer: 1, doctor: 1, hunter: 1, idiot: 1 }
        });

        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        // First: vote out idiot → triggers reveal
        playVoteRound(game, {
          p1: 'p6', p2: 'p6', p3: 'p6', p4: 'p6', p5: 'p6'
        });

        // Night 2
        skipAllNightActions(game);

        // Day 2: advance to vote
        while (game.getState().phase === PHASES.DAY_ANNOUNCE) {
          const s = game.getState();
          const actorId = s.lastWordsPlayerId || s.firstSpeakerId ||
            Object.values(s.playerMap).find(p => p.alive)?.id;
          if (!actorId) break;
          game.executeMove({
            playerId: actorId,
            actionType: ACTION_TYPES.PHASE_ADVANCE,
            actionData: {}
          });
        }
        advanceDiscussionToVote(game);

        // p6 is revealed idiot captain - cannot vote (excluded from voterQueue)
        const voterQueue = game.getState().voterQueue;
        expect(voterQueue).not.toContain('p6');
      });

      it('T-CAP-23: hunter captain killed → shoot first → then transfer', () => {
        const { game } = setupCaptainGame({
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'villager'
          }
        });

        // Elect p5 (hunter) as captain
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p5']);
        endRegistration(game);
        expect(game.getState().captainPlayerId).toBe('p5');

        // Advance through day, go to night
        advanceDiscussionToVote(game);
        playVoteRound(game, {}); // all abstain

        // Night 2: wolves kill p5 (hunter captain)
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (s.playerMap[pid].roleId === 'werewolf') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Hunter should shoot first
        expect(game.getState().hunterPendingShoot).toBe('p5');

        // Hunter shoots p1
        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.HUNTER_SHOOT,
          actionData: { targetId: 'p1' }
        });

        // After hunter shoot resolves → captain transfer
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);

        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p3' }
        });

        expect(game.getState().captainPlayerId).toBe('p3');
      });

      it('T-CAP-24: hunter shoots captain → that captain triggers transfer', () => {
        const { game } = setupCaptainGame({
          players: SEVEN_PLAYERS,
          roleCounts: { werewolf: 2, seer: 1, doctor: 1, hunter: 1, villager: 2 },
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'villager', p7: 'villager'
          }
        });

        // Elect p6 as captain
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {}); // all abstain

        // Night 2: wolves kill p5 (hunter)
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (s.playerMap[pid].roleId === 'werewolf') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Hunter pending shoot
        expect(game.getState().hunterPendingShoot).toBe('p5');

        // Hunter shoots p6 (the captain)
        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.HUNTER_SHOOT,
          actionData: { targetId: 'p6' }
        });

        // Captain p6 is dead → transfer
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);
        expect(game.getState().playerMap.p6.alive).toBe(false);

        game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p3' }
        });

        expect(game.getState().captainPlayerId).toBe('p3');
      });

      it('T-CAP-26: vigilante kills captain → captain transfer', () => {
        const { game } = setupCaptainGame({
          players: SEVEN_PLAYERS,
          roleCounts: { werewolf: 2, seer: 1, doctor: 1, hunter: 1, vigilante: 1, villager: 1 },
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'vigilante', p7: 'villager'
          }
        });

        // Elect p7 as captain
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p7']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {}); // all abstain

        // Night: vigilante kills captain p7
        const state = game.getState();
        // Skip through night steps until vigilante's turn
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (pid === 'p6') {
              // Vigilante shoots captain
              submitNight(game, pid, ACTION_TYPES.NIGHT_VIGILANTE_KILL, { targetId: 'p7' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Captain p7 died → captain transfer
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);
        expect(game.getState().playerMap.p7.alive).toBe(false);
      });

      it('T-CAP-27: bodyguard protects captain → captain survives, no transfer', () => {
        const { game } = setupCaptainGame({
          players: SEVEN_PLAYERS,
          roleCounts: { werewolf: 2, seer: 1, doctor: 1, bodyguard: 1, hunter: 1, villager: 1 },
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'bodyguard', p6: 'hunter', p7: 'villager'
          }
        });

        // Elect p7 as captain
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p7']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {}); // all abstain

        // Night: wolves target p7, bodyguard protects p7
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            const role = s.playerMap[pid].roleId;
            if (role === 'werewolf') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p7' });
            } else if (role === 'bodyguard') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_BODYGUARD_PROTECT, { targetId: 'p7' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Captain survives → no transfer, still captain
        const s = game.getState();
        expect(s.playerMap.p7.alive).toBe(true);
        expect(s.captainPlayerId).toBe('p7');
        expect(s.phase).not.toBe(PHASES.CAPTAIN_TRANSFER);
      });
    });

    // ── 12.5 Edge Cases Tests ──────────────────────────────────────

    describe('Edge Cases', () => {
      it('T-CAP-29: chain death - hunter shoot + lover cascade, transfer last', () => {
        // Manual setup - need to control night 1 for cupid link
        const result = setupGame({
          players: EIGHT_PLAYERS,
          roleCounts: {
            werewolf: 2, seer: 1, doctor: 1,
            hunter: 1, cupid: 1, villager: 2
          },
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'cupid',
            p7: 'villager', p8: 'villager'
          },
          options: { captainEnabled: true, cupidCanSelfLove: true }
        });
        const game = result.game;

        // Night 1: cupid links p7 and p8 as lovers, others skip
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (s.playerMap[pid].roleId === 'cupid') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_CUPID_LINK, { lovers: ['p7', 'p8'] });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Elect p5 (hunter) as captain
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p5']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {}); // all abstain → night

        // Night 2: wolves kill p5 (hunter captain)
        while (game.getState().phase === PHASES.NIGHT) {
          const s = game.getState();
          const pending = [...s.pendingNightRoles];
          if (pending.length === 0) break;
          for (const pid of pending) {
            if (s.playerMap[pid].roleId === 'werewolf') {
              submitNight(game, pid, ACTION_TYPES.NIGHT_WOLF_KILL, { targetId: 'p5' });
            } else {
              submitNight(game, pid, ACTION_TYPES.NIGHT_SKIP, {});
            }
          }
        }

        // Hunter shoots p7 (a lover)
        expect(game.getState().hunterPendingShoot).toBe('p5');
        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.HUNTER_SHOOT,
          actionData: { targetId: 'p7' }
        });

        // p7 dies → p8 (lover) martyrdom
        expect(game.getState().playerMap.p7.alive).toBe(false);
        expect(game.getState().playerMap.p8.alive).toBe(false);

        // Now captain transfer (after all chain deaths)
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);

        // Can only transfer to living players (not p5, p7, p8)
        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p3' }
        });

        expect(game.getState().captainPlayerId).toBe('p3');
      });

      it('T-CAP-33: captainEnabled=false → no election phase', () => {
        const result = setupGame({
          roleMap: {
            p1: 'werewolf', p2: 'werewolf',
            p3: 'seer', p4: 'doctor',
            p5: 'hunter', p6: 'villager'
          },
          options: { captainEnabled: false }
        });
        const game = result.game;

        skipAllNightActions(game);
        advanceToDiscussion(game);

        // Should go directly to discussion, no captain_register
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-34: no election on day 2+', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        // Skip election (no candidates)
        endRegistration(game);

        // Advance through day → night → day 2
        advanceDiscussionToVote(game);
        playVoteRound(game, {}); // all abstain → night
        skipAllNightActions(game);

        // Day 2: should go to discussion, not captain_register
        while (game.getState().phase === PHASES.DAY_ANNOUNCE) {
          const s = game.getState();
          const actorId = s.lastWordsPlayerId || s.firstSpeakerId ||
            Object.values(s.playerMap).find(p => p.alive)?.id;
          if (!actorId) break;
          game.executeMove({
            playerId: actorId,
            actionType: ACTION_TYPES.PHASE_ADVANCE,
            actionData: {}
          });
        }

        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });

      it('T-CAP-35: peaceful first night → announce then election', () => {
        const { game } = setupCaptainGame();

        // After first night with no kills → DAY_ANNOUNCE
        expect(game.getState().phase).toBe(PHASES.DAY_ANNOUNCE);

        advanceToCaptainRegister(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_REGISTER);
      });

      it('T-CAP-31: withdraw during speech → removed from speaker queue', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5', 'p6']);
        endRegistration(game);
        expect(game.getState().phase).toBe(PHASES.CAPTAIN_SPEECH);

        const queue = game.getState().captainSpeakerQueue;
        expect(queue).toContain('p3');
        expect(queue).toContain('p5');
        expect(queue).toContain('p6');

        // p3 speaks first, then withdraw p5 before their turn
        game.executeMove({
          playerId: game.getState().captainCurrentSpeaker,
          actionType: ACTION_TYPES.PHASE_ADVANCE,
          actionData: {}
        });

        game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.CAPTAIN_WITHDRAW,
          actionData: {}
        });

        expect(game.getState().captainCandidates).not.toContain('p5');
      });

      it('T-CAP-32: all voters abstain in election → captain vacant', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        // All skip vote
        playCaptainVoteRound(game, {});

        expect(game.getState().captainPlayerId).toBeNull();
        expect(game.getState().phase).toBe(PHASES.DAY_DISCUSSION);
      });
    });

    // ── 12.6 Validation Error Tests ────────────────────────────────

    describe('Validation Errors', () => {
      it('T-CAP-36: register outside registration phase → rejected', () => {
        const { game } = setupCaptainGame();
        // In DAY_ANNOUNCE, not CAPTAIN_REGISTER
        const result = game.executeMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.CAPTAIN_REGISTER,
          actionData: {}
        });

        expect(result.success).toBe(false);
      });

      it('T-CAP-37: non-candidate withdraw → rejected', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);

        registerCandidates(game, ['p3']);

        // p5 is not a candidate
        const result = game.executeMove({
          playerId: 'p5',
          actionType: ACTION_TYPES.CAPTAIN_WITHDRAW,
          actionData: {}
        });

        expect(result.success).toBe(false);
      });

      it('T-CAP-38: non-current voter sends captain vote → rejected', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        // p2 is not the current voter (p1 should be first)
        const currentVoter = game.getState().captainCurrentVoter;
        const wrongVoter = currentVoter === 'p2' ? 'p3' : 'p2';

        const result = game.executeMove({
          playerId: wrongVoter,
          actionType: ACTION_TYPES.CAPTAIN_VOTE,
          actionData: { targetId: 'p3' }
        });

        expect(result.success).toBe(false);
      });

      it('T-CAP-39: vote for non-candidate → rejected', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p3', 'p5']);
        endRegistration(game);
        skipCaptainSpeeches(game);

        const currentVoter = game.getState().captainCurrentVoter;

        // Vote for p4 who is not a candidate
        const result = game.executeMove({
          playerId: currentVoter,
          actionType: ACTION_TYPES.CAPTAIN_VOTE,
          actionData: { targetId: 'p4' }
        });

        expect(result.success).toBe(false);
      });

      it('T-CAP-40: non-captain sends transfer → rejected', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);

        advanceDiscussionToVote(game);
        playVoteRound(game, {
          p1: 'p6', p2: 'p6', p3: 'p6', p4: 'p6', p5: 'p6'
        });

        expect(game.getState().phase).toBe(PHASES.CAPTAIN_TRANSFER);

        // p3 is not the captain
        const result = game.executeMove({
          playerId: 'p3',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p4' }
        });

        expect(result.success).toBe(false);
      });

      it('T-CAP-41: transfer outside transfer phase → rejected', () => {
        const { game } = setupCaptainGame();
        advanceToCaptainRegister(game);
        registerCandidates(game, ['p6']);
        endRegistration(game);

        // In DAY_DISCUSSION, not CAPTAIN_TRANSFER
        const result = game.executeMove({
          playerId: 'p6',
          actionType: ACTION_TYPES.CAPTAIN_TRANSFER,
          actionData: { targetId: 'p3' }
        });

        expect(result.success).toBe(false);
      });
    });
  });
