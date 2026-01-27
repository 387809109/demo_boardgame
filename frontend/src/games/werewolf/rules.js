/**
 * Werewolf Game Rules
 * @module games/werewolf/rules
 */

export const TEAMS = {
  VILLAGE: 'village',
  WEREWOLF: 'werewolf',
  NEUTRAL: 'neutral'
};

export const PHASES = {
  WAITING: 'waiting',
  NIGHT: 'night',
  DAY_ANNOUNCE: 'day_announce',
  DAY_DISCUSSION: 'day_discussion',
  DAY_VOTE: 'day_vote',
  DAY_EXECUTION: 'day_execution',
  ENDED: 'ended'
};

export const ACTION_TYPES = {
  NIGHT_WOLF_KILL: 'NIGHT_WOLF_KILL',
  NIGHT_VIGILANTE_KILL: 'NIGHT_VIGILANTE_KILL',
  NIGHT_SEER_CHECK: 'NIGHT_SEER_CHECK',
  NIGHT_SHERIFF_CHECK: 'NIGHT_SHERIFF_CHECK',
  NIGHT_DETECTIVE_COMPARE: 'NIGHT_DETECTIVE_COMPARE',
  NIGHT_TRACK: 'NIGHT_TRACK',
  NIGHT_WATCH: 'NIGHT_WATCH',
  NIGHT_LITTLE_GIRL_PEEK: 'NIGHT_LITTLE_GIRL_PEEK',
  NIGHT_DOCTOR_PROTECT: 'NIGHT_DOCTOR_PROTECT',
  NIGHT_BODYGUARD_PROTECT: 'NIGHT_BODYGUARD_PROTECT',
  NIGHT_GUARDIAN_ANGEL_PROTECT: 'NIGHT_GUARDIAN_ANGEL_PROTECT',
  NIGHT_WITCH_SAVE: 'NIGHT_WITCH_SAVE',
  NIGHT_WITCH_POISON: 'NIGHT_WITCH_POISON',
  NIGHT_JAILER_JAIL: 'NIGHT_JAILER_JAIL',
  NIGHT_ROLEBLOCK: 'NIGHT_ROLEBLOCK',
  NIGHT_BUS_DRIVER_SWAP: 'NIGHT_BUS_DRIVER_SWAP',
  NIGHT_CUPID_LINK: 'NIGHT_CUPID_LINK',
  NIGHT_THIEF_STEAL: 'NIGHT_THIEF_STEAL',
  NIGHT_PIPER_CHARM: 'NIGHT_PIPER_CHARM',
  NIGHT_ORACLE_FOCUS: 'NIGHT_ORACLE_FOCUS',
  NIGHT_RECRUIT: 'NIGHT_RECRUIT',
  NIGHT_SKIP: 'NIGHT_SKIP',
  DAY_REVEAL_CAPTAIN: 'DAY_REVEAL_CAPTAIN',
  DAY_NOMINATE: 'DAY_NOMINATE',
  DAY_VOTE: 'DAY_VOTE',
  DAY_SKIP_VOTE: 'DAY_SKIP_VOTE',
  HUNTER_SHOOT: 'HUNTER_SHOOT',
  LAST_WORDS: 'LAST_WORDS'
};

export const ROLE_DEFINITIONS = {
  villager: {
    id: 'villager',
    name: '村民',
    team: TEAMS.VILLAGE,
    priority: 'P0',
    actionTypes: []
  },
  werewolf: {
    id: 'werewolf',
    name: '狼人',
    team: TEAMS.WEREWOLF,
    priority: 'P0',
    actionTypes: [ACTION_TYPES.NIGHT_WOLF_KILL]
  },
  seer: {
    id: 'seer',
    name: '预言家',
    team: TEAMS.VILLAGE,
    priority: 'P0',
    actionTypes: [ACTION_TYPES.NIGHT_SEER_CHECK]
  },
  doctor: {
    id: 'doctor',
    name: '医生',
    team: TEAMS.VILLAGE,
    priority: 'P0',
    actionTypes: [ACTION_TYPES.NIGHT_DOCTOR_PROTECT]
  },
  hunter: {
    id: 'hunter',
    name: '猎人',
    team: TEAMS.VILLAGE,
    priority: 'P0',
    actionTypes: [ACTION_TYPES.HUNTER_SHOOT]
  },
  witch: {
    id: 'witch',
    name: '女巫',
    team: TEAMS.VILLAGE,
    priority: 'P0',
    actionTypes: [ACTION_TYPES.NIGHT_WITCH_SAVE, ACTION_TYPES.NIGHT_WITCH_POISON]
  }
};

export const ROLE_PRESETS = [
  { min: 6, max: 7, roles: ['seer', 'doctor'], wolves: 2, neutrals: [] },
  { min: 8, max: 9, roles: ['seer', 'doctor', 'witch'], wolves: 2, neutrals: [] },
  { min: 10, max: 11, roles: ['seer', 'doctor', 'witch'], wolves: 3, neutrals: ['thief'] },
  { min: 12, max: 14, roles: ['seer', 'doctor', 'witch', 'hunter'], wolves: 3, neutrals: ['thief', 'piper'] },
  { min: 15, max: 20, roles: ['seer', 'doctor', 'witch', 'hunter', 'bodyguard'], wolves: 4, neutrals: ['thief', 'piper', 'cupid'] }
];

export function getRoleDefinition(roleId) {
  return ROLE_DEFINITIONS[roleId] || null;
}

export function isNightPhase(phase) {
  return phase === PHASES.NIGHT;
}

export function isDayPhase(phase) {
  return phase === PHASES.DAY_DISCUSSION || phase === PHASES.DAY_VOTE || phase === PHASES.DAY_EXECUTION || phase === PHASES.DAY_ANNOUNCE;
}

export function canRoleAct(roleId, actionType, phase) {
  const role = getRoleDefinition(roleId);
  if (!role) return false;

  if (actionType.startsWith('NIGHT_')) {
    if (!isNightPhase(phase)) return false;
  }
  if (actionType.startsWith('DAY_')) {
    if (!isDayPhase(phase)) return false;
  }

  return role.actionTypes.includes(actionType);
}

export function buildDistribution(playerCount, options) {
  const preset = ROLE_PRESETS.find(p => playerCount >= p.min && playerCount <= p.max);
  if (!preset) {
    return { werewolf: Math.max(1, Math.floor(playerCount / 4)), villager: Math.max(0, playerCount - 1) };
  }

  const roleCounts = { werewolf: preset.wolves };
  for (const roleId of [...preset.roles, ...preset.neutrals]) {
    roleCounts[roleId] = 1;
  }

  const used = Object.values(roleCounts).reduce((sum, c) => sum + c, 0);
  roleCounts.villager = Math.max(playerCount - used, 0);

  if (options?.roleCounts) {
    return { ...roleCounts, ...options.roleCounts };
  }

  return roleCounts;
}

export function createRolePool(playerCount, options) {
  const enabledRoles = options?.enabledRoles || Object.keys(ROLE_DEFINITIONS);
  const distribution = buildDistribution(playerCount, options);
  const pool = [];

  for (const [roleId, count] of Object.entries(distribution)) {
    if (!enabledRoles.includes(roleId)) continue;
    for (let i = 0; i < count; i++) {
      pool.push(roleId);
    }
  }

  return pool;
}

export function isAlive(player) {
  return !!player?.alive;
}

export function getTeamCounts(players) {
  const alive = Object.values(players).filter(p => p.alive);
  return {
    werewolf: alive.filter(p => p.team === TEAMS.WEREWOLF).length,
    village: alive.filter(p => p.team === TEAMS.VILLAGE).length,
    neutral: alive.filter(p => p.team === TEAMS.NEUTRAL).length
  };
}

export default {
  TEAMS,
  PHASES,
  ACTION_TYPES,
  ROLE_DEFINITIONS,
  ROLE_PRESETS,
  getRoleDefinition,
  isNightPhase,
  isDayPhase,
  canRoleAct,
  buildDistribution,
  createRolePool,
  isAlive,
  getTeamCounts
};
