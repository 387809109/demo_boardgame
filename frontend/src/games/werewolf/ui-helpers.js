/**
 * Werewolf UI Helpers
 * @module games/werewolf/ui-helpers
 *
 * Constants and helper functions for Werewolf UI rendering
 */

import { PHASES, TEAMS } from './index.js';

/** Team color CSS values */
export const TEAM_COLORS = {
  [TEAMS.WEREWOLF]: 'var(--error-500)',
  [TEAMS.VILLAGE]: 'var(--success-500)',
  [TEAMS.NEUTRAL]: 'var(--warning-500)',
  jester: 'var(--warning-500)'
};

/** Role display names (Chinese) */
export const ROLE_NAMES = {
  villager: '村民',
  werewolf: '狼人',
  seer: '预言家',
  doctor: '医生',
  vigilante: '义警',
  piper: '魔笛手',
  idiot: '白痴',
  jester: '小丑',
  hunter: '猎人',
  witch: '女巫',
  cupid: '丘比特',
  bodyguard: '守卫'
};

/** Role descriptions */
export const ROLE_DESCRIPTIONS = {
  villager: '普通村民，没有特殊能力。通过白天讨论和投票消灭狼人。',
  werewolf: '狼人阵营，每晚可以选择一名玩家击杀。',
  seer: '每晚可以查验一名玩家的阵营身份。',
  doctor: '每晚可以保护一名玩家免受狼人袭击。',
  vigilante: '主动进攻角色，每晚可射杀一名玩家，误杀好人会触发惩罚。',
  piper: '第三方控制角色，每晚魅惑玩家，魅惑所有存活玩家后获胜。',
  idiot: '白天首次被投票放逐时翻牌免死，但会永久失去投票权。',
  jester: '第三方角色，被白天投票放逐时立即单独获胜。',
  hunter: '死亡时可以开枪带走一名玩家。',
  witch: '拥有一瓶救人药水和一瓶毒药，每种只能使用一次。',
  cupid: '第一晚选择两名玩家成为恋人，一方死亡另一方殉情。',
  bodyguard: '每晚可以守护一名玩家，不能连续两晚守护同一人。'
};

/** Phase display names */
export const PHASE_NAMES = {
  [PHASES.NIGHT]: '夜晚',
  [PHASES.DAY_ANNOUNCE]: '天亮了',
  [PHASES.CAPTAIN_REGISTER]: '警长竞选 · 上警',
  [PHASES.CAPTAIN_SPEECH]: '警长竞选 · 发言',
  [PHASES.CAPTAIN_VOTE]: '警长竞选 · 投票',
  [PHASES.CAPTAIN_RUNOFF_SPEECH]: '警长竞选 · 平票发言',
  [PHASES.CAPTAIN_RUNOFF_VOTE]: '警长竞选 · 平票投票',
  [PHASES.CAPTAIN_TRANSFER]: '警徽移交',
  [PHASES.DAY_DISCUSSION]: '自由讨论',
  [PHASES.DAY_VOTE]: '投票放逐',
  [PHASES.ENDED]: '游戏结束'
};

/** Death cause display texts */
export const DEATH_CAUSE_TEXTS = {
  wolf_kill: '被狼人袭击',
  vigilante_kill: '被义警射杀',
  vigilante_recoil: '因误杀反噬死亡',
  witch_poison: '被毒杀',
  execution: '被放逐',
  hunter_shoot: '被猎人射杀',
  lover_death: '殉情'
};

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create a styled info box element
 * @param {string} text - The info text
 * @returns {HTMLElement}
 */
export function createInfoBox(text) {
  const el = document.createElement('div');
  el.className = 'ww-info-box';
  el.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--primary-50);
    border-radius: var(--radius-md);
    color: var(--primary-700);
    font-size: var(--text-sm);
    text-align: center;
  `;
  el.textContent = text;
  return el;
}

/**
 * Create a styled button element
 * @param {string} text - Button text
 * @param {Function|null} onClick - Click handler
 * @param {boolean} disabled - Disabled state
 * @param {string} variant - Button variant (primary, secondary, danger)
 * @returns {HTMLElement}
 */
export function createButton(text, onClick, disabled = false, variant = 'primary') {
  const btn = document.createElement('button');
  btn.className = `btn btn-${variant}`;
  btn.textContent = text;
  btn.disabled = disabled;
  btn.style.cssText = `
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--text-sm);
    border-radius: var(--radius-md);
    border: none;
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    opacity: ${disabled ? '0.5' : '1'};
    font-weight: var(--font-medium);
    ${variant === 'primary'
      ? 'background: var(--primary-500); color: var(--text-inverse);'
      : variant === 'danger'
        ? 'background: var(--error-500); color: var(--text-inverse);'
        : 'background: var(--bg-tertiary); color: var(--text-primary);'}
  `;

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}

/**
 * Get death cause display text
 * @param {string} cause - Death cause key
 * @returns {string}
 */
export function getDeathCauseText(cause) {
  return DEATH_CAUSE_TEXTS[cause] || cause;
}

/**
 * Check if a role has a night action
 * @param {string} roleId - Role identifier
 * @returns {boolean}
 */
export function roleHasNightAction(roleId) {
  return ['werewolf', 'seer', 'doctor', 'bodyguard', 'vigilante', 'witch'].includes(roleId);
}

/**
 * Check if a role's night action requires a target selection
 * @param {string} roleId - Role identifier
 * @returns {boolean}
 */
export function nightActionRequiresTarget(roleId) {
  return ['werewolf', 'seer', 'doctor', 'bodyguard', 'vigilante'].includes(roleId);
}

/**
 * Find a player by ID in the players array
 * @param {Array} players - Players array
 * @param {string} playerId - Player ID to find
 * @returns {Object|null}
 */
export function findPlayer(players, playerId) {
  return (players || []).find(p => p.id === playerId) || null;
}

/**
 * Get alive player IDs from state
 * @param {Object} state - Game state
 * @returns {Array<string>}
 */
export function getAlivePlayerIds(state) {
  return (state.players || [])
    .filter(p => p.alive !== false)
    .map(p => p.id);
}

/**
 * Get display name for a player
 * @param {Object} player - Player object
 * @param {string} viewerId - Current viewer's ID
 * @param {Object} seerChecks - Seer check results
 * @param {string} fallback - Fallback name if player not found
 * @returns {string}
 */
export function getDisplayName(player, viewerId, seerChecks = {}, fallback = '') {
  const name = player?.nickname || fallback || '???';
  const id = player?.id || fallback;
  let display = id === viewerId ? `${name}（我）` : name;

  if (id && id !== viewerId) {
    if (player?.roleId) {
      const roleName = ROLE_NAMES[player.roleId] || player.roleId;
      display += `（${roleName}）`;
    } else if (seerChecks[id]) {
      const teamLabel = seerChecks[id] === TEAMS.WEREWOLF ? '狼人' : '好人';
      display += `（${teamLabel}）`;
    }
  }
  return display;
}

export default {
  TEAM_COLORS,
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  PHASE_NAMES,
  DEATH_CAUSE_TEXTS,
  escapeHtml,
  createInfoBox,
  createButton,
  getDeathCauseText,
  roleHasNightAction,
  nightActionRequiresTarget,
  findPlayer,
  getAlivePlayerIds,
  getDisplayName
};
