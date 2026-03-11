/**
 * Werewolf UI Night Panels
 * @module games/werewolf/ui-panels-night
 *
 * Main night panel entry point + shared components.
 * Role-specific panels are in ui-panels-roles.js and ui-panels-wolf.js.
 */

import { ACTION_TYPES, TEAMS } from './index.js';
import {
  escapeHtml,
  createInfoBox,
  createButton,
  roleHasNightAction,
  findPlayer,
  getDisplayName
} from './ui-helpers.js';
import {
  renderDoctorPanel,
  renderCupidPanel,
  renderBodyguardPanel,
  renderVigilantePanel,
  renderPiperPanel,
  renderWitchPanel
} from './ui-panels-roles.js';
import { renderWolfVotesPanel } from './ui-panels-wolf.js';

// Re-export for consumers that import from this module
export {
  renderDoctorPanel,
  renderCupidPanel,
  renderBodyguardPanel,
  renderVigilantePanel,
  renderPiperPanel,
  renderWitchPanel
} from './ui-panels-roles.js';
export { renderWolfVotesPanel } from './ui-panels-wolf.js';

/**
 * Render night action panel
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderNightPanel(ctx) {
  const { state, playerId, onAction, updateSelectionMode } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-night-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  `;

  // Show last day execution result at the top
  if (state.round > 1 || state.lastDayExecution !== undefined) {
    el.appendChild(renderLastDayResult(ctx));
  }

  const viewer = findPlayer(state.players, playerId);
  if (!viewer?.alive) {
    el.appendChild(createInfoBox('你已死亡，等待天亮...'));
    return el;
  }

  const role = state.myRole?.roleId;

  // Night phase position indicator (limited info based on role)
  const steps = state.nightSteps || [];
  const currentStep = state.currentNightStep ?? 0;
  if (steps.length > 0) {
    const myStepIndex = steps.findIndex(
      s => s.playerIds?.includes(playerId)
    );
    if (myStepIndex >= 0) {
      el.appendChild(renderNightPositionHint(myStepIndex, currentStep));
    }
  }
  const isMyStep = state.pendingNightRoles?.includes(playerId);

  // Show seer result if available
  const seerResult = (state.dayAnnouncements || [])
    .find(a => a.type === 'seer_result' && a.playerId === playerId);
  if (seerResult) {
    el.appendChild(renderSeerResult(ctx, seerResult));
  }

  // Check if player has already submitted their action this round
  const myAction = state.nightActions?.[playerId];
  const isWitchContinuingAction =
    role === 'witch' &&
    isMyStep &&
    myAction?.actionType === 'NIGHT_WITCH_COMBINED';
  if (myAction && !isWitchContinuingAction) {
    el.appendChild(renderMyNightAction(ctx, myAction));
    el.appendChild(createInfoBox('等待其他玩家行动...'));
    return el;
  }

  if (!isMyStep) {
    el.appendChild(createInfoBox('夜晚进行中，等待行动...'));
    return el;
  }

  // Enable selection mode for this role
  if (updateSelectionMode) updateSelectionMode();

  switch (role) {
    case 'werewolf':
      el.appendChild(createInfoBox('先选择目标后点击"拟投票"表达意向，与队友协商后点击"确认击杀"；也可以拟弃票或确认弃票'));
      el.appendChild(renderWolfVotesPanel(ctx));
      break;

    case 'seer':
      el.appendChild(createInfoBox('点击环形布局中的玩家头像选择要查验的玩家'));
      break;

    case 'doctor':
      el.appendChild(renderDoctorPanel(ctx));
      break;

    case 'bodyguard':
      el.appendChild(renderBodyguardPanel(ctx));
      break;

    case 'vigilante':
      el.appendChild(renderVigilantePanel(ctx));
      break;

    case 'piper':
      el.appendChild(renderPiperPanel(ctx));
      break;

    case 'cupid':
      el.appendChild(renderCupidPanel(ctx));
      break;

    case 'witch':
      el.appendChild(renderWitchPanel(ctx));
      break;

    case 'hunter':
    case 'villager':
    default:
      el.appendChild(createInfoBox('夜晚降临，请闭眼等待...'));
      break;
  }

  // Skip button for roles with night actions (except werewolves who have their own panel)
  if (roleHasNightAction(role) && role !== 'werewolf') {
    const skipText = role === 'witch' ? '结束女巫行动' : '跳过行动';
    const skipBtn = createButton(skipText, () => {
      onAction({
        actionType: ACTION_TYPES.NIGHT_SKIP,
        actionData: {}
      });
    }, false, 'secondary');
    el.appendChild(skipBtn);
  }

  return el;
}

/**
 * Render last day's execution result
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderLastDayResult(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  `;

  const executedId = state.lastDayExecution;
  const idiotRevealId = state.lastIdiotRevealId;
  if (idiotRevealId) {
    const idiotPlayer = findPlayer(state.players, idiotRevealId);
    const idiotName = getDisplayName(
      idiotPlayer, playerId, state.seerChecks, idiotRevealId
    );
    el.innerHTML = `
      <span style="color: var(--warning-600); font-weight: var(--font-medium);">
        ${escapeHtml(idiotName)} 翻牌亮出【白痴】身份，免于出局！
      </span>
    `;
  } else if (executedId) {
    const player = findPlayer(state.players, executedId);
    el.innerHTML = `
      <span style="color: var(--text-secondary);">上个白天出局: </span>
      <span style="color: var(--error-600); font-weight: var(--font-medium);">
        ${getDisplayName(player, playerId, state.seerChecks, executedId)}
      </span>
    `;
  } else {
    el.innerHTML = `
      <span style="color: var(--text-secondary);">上个白天: </span>
      <span style="color: var(--success-600);">无人出局</span>
    `;
  }

  return el;
}

/**
 * Render the action that was submitted by the player
 * @param {Object} ctx - Rendering context
 * @param {Object} action - The submitted action
 * @returns {HTMLElement}
 */
export function renderMyNightAction(ctx, action) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--success-500);
    margin-bottom: var(--spacing-3);
  `;

  const { actionType, actionData } = action;
  const targetId = actionData?.targetId || actionData?.poisonTargetId || null;
  const targetPlayer = targetId ? findPlayer(state.players, targetId) : null;
  const targetName = targetPlayer
    ? getDisplayName(targetPlayer, playerId, state.seerChecks, targetId)
    : '无';

  let actionLabel = '';
  let actionIcon = '✓';

  switch (actionType) {
    case 'NIGHT_WITCH_COMBINED': {
      const usedSave = Boolean(actionData?.usedSave);
      const usedPoison = Boolean(actionData?.usedPoison || actionData?.poisonTargetId);
      const parts = [];

      if (usedSave) parts.push('使用解药');
      if (usedPoison) {
        parts.push(targetId ? `使用毒药: ${escapeHtml(targetName)}` : '使用毒药');
      }

      actionLabel = parts.length > 0 ? parts.join('，') : '女巫行动已提交';
      actionIcon = '🧪';
      break;
    }
    case ACTION_TYPES.NIGHT_WOLF_KILL:
      actionLabel = '击杀目标';
      actionIcon = '🐺';
      break;
    case ACTION_TYPES.NIGHT_SEER_CHECK:
      actionLabel = '查验目标';
      actionIcon = '👁';
      break;
    case ACTION_TYPES.NIGHT_DOCTOR_PROTECT:
      actionLabel = '保护目标';
      actionIcon = '🛡';
      break;
    case ACTION_TYPES.NIGHT_VIGILANTE_KILL:
      actionLabel = '射杀目标';
      actionIcon = '🔫';
      break;
    case ACTION_TYPES.NIGHT_WITCH_SAVE:
      actionLabel = '使用解药';
      actionIcon = '💊';
      break;
    case ACTION_TYPES.NIGHT_WITCH_POISON:
      actionLabel = '使用毒药';
      actionIcon = '☠';
      break;
    case ACTION_TYPES.NIGHT_CUPID_LINK: {
      const lovers = actionData?.lovers || [];
      const loverNames = lovers.map(id => {
        const p = findPlayer(state.players, id);
        return getDisplayName(p, playerId, state.seerChecks, id);
      }).join(' 和 ');
      actionLabel = `连结恋人: ${loverNames}`;
      actionIcon = '💘';
      break;
    }
    case ACTION_TYPES.NIGHT_PIPER_CHARM: {
      const targetIds = Array.isArray(actionData?.targetIds) ? actionData.targetIds : [];
      const targetNames = targetIds.map(id => {
        const p = findPlayer(state.players, id);
        return getDisplayName(p, playerId, state.seerChecks, id);
      }).join('、');
      actionLabel = targetNames ? `魅惑目标: ${targetNames}` : '魅惑目标';
      actionIcon = '🎵';
      break;
    }
    case ACTION_TYPES.NIGHT_SKIP:
      actionLabel = '跳过行动';
      actionIcon = '⏭';
      break;
    default:
      actionLabel = '已行动';
  }

  el.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-1);">
      <span style="font-size: var(--text-lg);">${actionIcon}</span>
      <span style="font-weight: var(--font-semibold); color: var(--success-600);">行动已提交</span>
    </div>
    <div style="font-size: var(--text-sm); color: var(--text-primary);">
      ${actionLabel}${targetId ? `: <strong>${escapeHtml(targetName)}</strong>` : ''}
    </div>
  `;

  return el;
}

/**
 * Render a simple position hint for the player's night action.
 * Shows before/during/after without revealing other roles' steps.
 * @param {number} myStepIndex - Index of the player's step
 * @param {number} currentStep - Current step index
 * @returns {HTMLElement}
 */
export function renderNightPositionHint(myStepIndex, currentStep) {
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  `;

  let icon, text, color;
  if (currentStep < myStepIndex) {
    icon = '◯';
    text = '等待你的行动回合...';
    color = 'var(--text-tertiary)';
  } else if (currentStep === myStepIndex) {
    icon = '●';
    text = '你的行动回合';
    color = 'var(--primary-700)';
  } else {
    icon = '✓';
    text = '你的行动已完成';
    color = 'var(--success-600)';
  }

  el.innerHTML = `
    <span style="color: ${color};">${icon}</span>
    <span style="color: ${color}; font-weight: var(--font-medium);">${text}</span>
  `;
  return el;
}

/**
 * Render night step progress indicator (full view - for debugging/GM only)
 * @param {Array} steps - Night steps
 * @param {number} currentStep - Current step index
 * @returns {HTMLElement}
 */
export function renderNightProgress(steps, currentStep) {
  const el = document.createElement('div');
  el.className = 'ww-night-progress';
  el.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-1);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  `;

  steps.forEach((step, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.style.cssText = `
        color: var(--text-tertiary);
        font-size: var(--text-xs);
      `;
      arrow.textContent = '→';
      el.appendChild(arrow);
    }

    const isCompleted = i < currentStep;
    const isActive = i === currentStep;
    const icon = isCompleted ? '✓' : isActive ? '●' : '○';

    const badge = document.createElement('span');
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px var(--spacing-2);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      font-weight: ${isActive ? 'var(--font-semibold)' : 'var(--font-normal)'};
      color: ${isCompleted ? 'var(--text-tertiary)' : isActive ? 'var(--primary-700)' : 'var(--text-secondary)'};
      background: ${isActive ? 'var(--primary-50)' : 'transparent'};
      ${isCompleted ? 'text-decoration: line-through;' : ''}
    `;
    badge.textContent = `${icon} ${step.label}`;
    el.appendChild(badge);
  });

  return el;
}

/**
 * Render seer check result during night
 * @param {Object} ctx - Rendering context
 * @param {Object} result - Seer result object
 * @returns {HTMLElement}
 */
export function renderSeerResult(ctx, result) {
  const { state, playerId } = ctx;
  const target = findPlayer(state.players, result.targetId);
  const targetName = getDisplayName(target, playerId, state.seerChecks, result.targetId);
  const isWolf = result.result === TEAMS.WEREWOLF;
  const teamText = isWolf ? '狼人' : '好人';
  const teamColor = isWolf ? 'var(--error-500)' : 'var(--success-500)';

  const el = document.createElement('div');
  el.style.cssText = `
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid ${teamColor};
  `;
  el.innerHTML = `
    <div style="font-weight: var(--font-semibold); color: var(--text-primary);">
      查验结果
    </div>
    <div style="color: var(--text-primary); margin-top: var(--spacing-1);">
      <span style="font-weight: var(--font-medium);">
        ${targetName}
      </span>
      的身份是
      <span style="color: ${teamColor}; font-weight: var(--font-bold);">
        ${teamText}
      </span>
    </div>
  `;
  return el;
}

export default {
  renderNightPanel,
  renderLastDayResult,
  renderMyNightAction,
  renderNightPositionHint,
  renderNightProgress,
  renderSeerResult
};
