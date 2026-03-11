/**
 * Werewolf UI Panels
 * @module games/werewolf/ui-panels
 *
 * Re-exports all panel rendering functions from split modules
 */

import { TEAMS } from './index.js';
import {
  TEAM_COLORS,
  ROLE_NAMES,
  ROLE_DESCRIPTIONS,
  PHASE_NAMES
} from './ui-helpers.js';

// Re-export night panels
export {
  renderNightPanel,
  renderLastDayResult,
  renderDoctorPanel,
  renderMyNightAction,
  renderWitchPanel,
  renderNightProgress,
  renderSeerResult,
  renderWolfVotesPanel
} from './ui-panels-night.js';

// Re-export day panels
export {
  renderAnnouncePanel,
  renderDiscussionPanel,
  renderVotePanel,
  renderEndedPanel,
  renderHunterShoot,
  renderDeadChat,
  renderCaptainRegisterPanel,
  renderCaptainSpeechPanel,
  renderCaptainVotePanel,
  renderCaptainTransferPanel
} from './ui-panels-day.js';

/**
 * Render role info bar
 * @param {Object} ctx - Rendering context (state, playerId, etc.)
 * @returns {HTMLElement}
 */
export function renderRoleInfo(ctx) {
  const { state } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-role-info';

  const roleId = state.myRole?.roleId;
  const team = state.myRole?.team;
  const roleName = ROLE_NAMES[roleId] || roleId || '未知';
  const desc = ROLE_DESCRIPTIONS[roleId] || '';
  const teamColor = TEAM_COLORS[team] || 'var(--text-secondary)';
  const teamLabel = team === TEAMS.WEREWOLF ? '狼人阵营'
    : team === TEAMS.VILLAGE ? '好人阵营' : '中立阵营';

  el.style.cssText = `
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3) var(--spacing-4);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    border-left: 4px solid ${teamColor};
  `;

  const isCaptain = state.captainPlayerId === ctx.playerId;
  const captainBadge = isCaptain
    ? `<div style="
        font-size: var(--text-xs);
        padding: 2px var(--spacing-2);
        border-radius: var(--radius-full);
        background: var(--warning-500);
        color: var(--text-inverse);
        font-weight: var(--font-medium);
      ">警长</div>`
    : '';

  el.innerHTML = `
    <div style="
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--text-primary);
    ">${roleName}</div>
    <div style="
      font-size: var(--text-xs);
      padding: 2px var(--spacing-2);
      border-radius: var(--radius-full);
      background: ${teamColor};
      color: var(--text-inverse);
      font-weight: var(--font-medium);
    ">${teamLabel}</div>
    ${captainBadge}
    <div style="
      font-size: var(--text-sm);
      color: var(--text-secondary);
      flex: 1;
    ">${desc}</div>
  `;

  return el;
}

/**
 * Render phase header
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderPhaseHeader(ctx) {
  const { state } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-phase-header';

  const phaseName = PHASE_NAMES[state.phase] || state.phase;
  const round = state.round || 1;

  el.style.cssText = `
    text-align: center;
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  `;

  el.innerHTML = `
    <div style="
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--text-primary);
    ">第 ${round} 轮 · ${phaseName}</div>
  `;

  return el;
}

export default {
  renderRoleInfo,
  renderPhaseHeader
};
