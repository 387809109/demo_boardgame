/**
 * Werewolf UI Night Panels
 * @module games/werewolf/ui-panels-night
 *
 * Night phase panel rendering functions
 */

import { ACTION_TYPES, TEAMS } from './index.js';
import {
  TEAM_COLORS,
  escapeHtml,
  createInfoBox,
  createButton,
  roleHasNightAction,
  findPlayer,
  getDisplayName
} from './ui-helpers.js';

/**
 * Render night action panel
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderNightPanel(ctx) {
  const { state, playerId, onAction, selectedTarget, updateSelectionMode } = ctx;
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

  // Night step progress bar
  const steps = state.nightSteps || [];
  const currentStep = state.currentNightStep ?? 0;
  if (steps.length > 0) {
    el.appendChild(renderNightProgress(steps, currentStep));
  }

  const role = state.myRole?.roleId;
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
    const label = steps[currentStep]?.label || '夜晚';
    el.appendChild(createInfoBox(`等待其他玩家行动... (${label})`));
    return el;
  }

  if (!isMyStep) {
    const label = steps[currentStep]?.label || '夜晚';
    el.appendChild(createInfoBox(`当前阶段: ${label}，等待行动中...`));
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
  if (executedId) {
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
 * Render doctor panel with last protection info
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderDoctorPanel(ctx) {
  const { state, playerId, selectedTarget } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  // Show last night's protection target
  const lastProtect = state.roleStates?.doctorLastProtect;
  if (lastProtect) {
    const lastPlayer = findPlayer(state.players, lastProtect);
    const infoBox = document.createElement('div');
    infoBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    `;
    infoBox.innerHTML = `
      <span style="color: var(--text-secondary);">昨晚保护: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${getDisplayName(lastPlayer, playerId, state.seerChecks, lastProtect)}
      </span>
      ${!state.options?.allowRepeatedProtect ? '<span style="color: var(--warning-600);"> (今晚不可再选)</span>' : ''}
    `;
    el.appendChild(infoBox);
  }

  // Show current selection
  if (selectedTarget) {
    const targetPlayer = findPlayer(state.players, selectedTarget);
    const selectBox = document.createElement('div');
    selectBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--primary-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--primary-500);
      font-size: var(--text-sm);
    `;
    selectBox.innerHTML = `
      <span style="color: var(--text-secondary);">已选择保护: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${getDisplayName(targetPlayer, playerId, state.seerChecks, selectedTarget)}
      </span>
    `;
    el.appendChild(selectBox);
  } else {
    el.appendChild(createInfoBox('点击环形布局中的玩家头像选择要保护的玩家'));
  }

  return el;
}

/**
 * Render bodyguard panel with last protection info
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderBodyguardPanel(ctx) {
  const { state, playerId, selectedTarget } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  // Show last night's protection target
  const lastProtect = state.roleStates?.bodyguardLastProtect;
  if (lastProtect) {
    const lastPlayer = findPlayer(state.players, lastProtect);
    const infoBox = document.createElement('div');
    infoBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    `;
    infoBox.innerHTML = `
      <span style="color: var(--text-secondary);">昨晚守护: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${getDisplayName(lastPlayer, playerId, state.seerChecks, lastProtect)}
      </span>
      ${!state.options?.allowRepeatedProtect ? '<span style="color: var(--warning-600);"> (今晚不可再选)</span>' : ''}
    `;
    el.appendChild(infoBox);
  }

  // Show current selection
  if (selectedTarget) {
    const targetPlayer = findPlayer(state.players, selectedTarget);
    const selectBox = document.createElement('div');
    selectBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--primary-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--primary-500);
      font-size: var(--text-sm);
    `;
    selectBox.innerHTML = `
      <span style="color: var(--text-secondary);">已选择守护: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${getDisplayName(targetPlayer, playerId, state.seerChecks, selectedTarget)}
      </span>
    `;
    el.appendChild(selectBox);
  } else {
    el.appendChild(createInfoBox('点击环形布局中的玩家头像选择要守护的玩家'));
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
    case ACTION_TYPES.NIGHT_WITCH_SAVE:
      actionLabel = '使用解药';
      actionIcon = '💊';
      break;
    case ACTION_TYPES.NIGHT_WITCH_POISON:
      actionLabel = '使用毒药';
      actionIcon = '☠';
      break;
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
 * Render witch night panel with save + poison options
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderWitchPanel(ctx) {
  const { state, playerId, onAction, selectedTarget } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-witch-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  `;

  const roleStates = state.roleStates || {};
  const saveUsed = roleStates.witchSaveUsed;
  const poisonUsed = roleStates.witchPoisonUsed;

  // Find wolf target from announcements
  const witchInfo = (state.dayAnnouncements || [])
    .find(a => a.type === 'witch_night_info');
  const wolfTargetId = witchInfo?.wolfTarget || null;

  // Save section
  const saveSection = document.createElement('div');
  saveSection.style.cssText = `
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--success-500);
  `;

  if (saveUsed) {
    saveSection.innerHTML = `
      <div style="color: var(--text-secondary); font-size: var(--text-sm);">
        救人药水已使用
      </div>
    `;
  } else if (!wolfTargetId) {
    saveSection.innerHTML = `
      <div style="color: var(--text-secondary); font-size: var(--text-sm);">
        今晚无人被袭击
      </div>
    `;
  } else {
    const targetPlayer = findPlayer(state.players, wolfTargetId);
    const targetName = getDisplayName(targetPlayer, playerId, state.seerChecks, wolfTargetId);
    saveSection.innerHTML = `
      <div style="margin-bottom: var(--spacing-2);">
        <span style="
          font-weight: var(--font-semibold);
          color: var(--text-primary);
        ">${targetName}</span>
        <span style="color: var(--text-secondary);">
          今晚被袭击，是否使用救人药水？
        </span>
      </div>
    `;

    const saveBtn = createButton('使用解药', () => {
      onAction({
        actionType: ACTION_TYPES.NIGHT_WITCH_SAVE,
        actionData: {}
      });
    });
    saveSection.appendChild(saveBtn);
  }
  el.appendChild(saveSection);

  // Poison section
  const poisonSection = document.createElement('div');
  poisonSection.style.cssText = `
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--error-500);
  `;

  if (poisonUsed) {
    poisonSection.innerHTML = `
      <div style="color: var(--text-secondary); font-size: var(--text-sm);">
        毒药已使用
      </div>
    `;
  } else {
    poisonSection.innerHTML = `
      <div style="
        margin-bottom: var(--spacing-2);
        font-weight: var(--font-semibold);
        color: var(--text-primary);
      ">点击环形布局中的玩家头像选择毒杀目标</div>
    `;

    const poisonBtn = createButton('使用毒药', () => {
      if (selectedTarget) {
        onAction({
          actionType: ACTION_TYPES.NIGHT_WITCH_POISON,
          actionData: { targetId: selectedTarget }
        });
      }
    }, !selectedTarget, 'danger');
    poisonSection.appendChild(poisonBtn);
  }
  el.appendChild(poisonSection);

  return el;
}

/**
 * Render night step progress indicator
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

/**
 * Render wolf voting panel with tentative and actual votes
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderWolfVotesPanel(ctx) {
  const { state, playerId, onAction, selectedTarget } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const wolfVotes = state.wolfVotes || {};
  const tentativeVotes = state.wolfTentativeVotes || {};
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  // My current selection/vote status
  const hasMyTentative = hasOwn(tentativeVotes, playerId);
  const hasMyActual = hasOwn(wolfVotes, playerId);
  const myTentative = hasMyTentative ? tentativeVotes[playerId] : undefined;
  const myActual = hasMyActual ? wolfVotes[playerId] : undefined;
  const getTargetName = (targetId) => getDisplayName(
    findPlayer(state.players, targetId),
    playerId,
    state.seerChecks,
    targetId
  );

  let myStatusHtml = '<span style="color: var(--warning-500);">选中:</span> 未选择';
  if (hasMyActual) {
    myStatusHtml = myActual === null
      ? '<span style="color: var(--success-500);">✓ 已确认:</span> 弃票'
      : `<span style="color: var(--success-500);">✓ 已确认:</span> ${getTargetName(myActual)}`;
  } else if (selectedTarget) {
    myStatusHtml = `<span style="color: var(--warning-500);">选中:</span> ${getTargetName(selectedTarget)}`;
  } else if (hasMyTentative) {
    myStatusHtml = myTentative === null
      ? '<span style="color: var(--warning-500);">? 已拟:</span> 弃票'
      : `<span style="color: var(--warning-500);">? 已拟:</span> ${getTargetName(myTentative)}`;
  }

  // My status box
  const myStatusBox = document.createElement('div');
  myStatusBox.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--primary-500);
  `;
  myStatusBox.innerHTML = `
    <div style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--spacing-1);">
      我的目标
    </div>
    <div style="font-size: var(--text-sm); color: var(--text-primary); font-weight: var(--font-medium);">
      ${myStatusHtml}
    </div>
  `;
  el.appendChild(myStatusBox);

  // Action buttons for tentative and actual vote
  const btnRow = document.createElement('div');
  btnRow.style.cssText = `
    display: flex;
    gap: var(--spacing-2);
    justify-content: center;
  `;

  // Tentative vote button
  const tentativeBtn = createButton('拟投票', () => {
    if (selectedTarget) {
      onAction?.({
        actionType: ACTION_TYPES.NIGHT_WOLF_TENTATIVE,
        actionData: { targetId: selectedTarget }
      });
    }
  }, !selectedTarget, 'secondary');
  btnRow.appendChild(tentativeBtn);

  const tentativeSkipBtn = createButton('拟弃票', () => {
    onAction?.({
      actionType: ACTION_TYPES.NIGHT_WOLF_TENTATIVE,
      actionData: { targetId: null }
    });
  }, hasMyActual, 'secondary');
  btnRow.appendChild(tentativeSkipBtn);

  // Actual vote button
  const actualBtn = createButton('确认击杀', () => {
    if (selectedTarget) {
      onAction?.({
        actionType: ACTION_TYPES.NIGHT_WOLF_KILL,
        actionData: { targetId: selectedTarget }
      });
    }
  }, !selectedTarget || hasMyActual, 'danger');
  btnRow.appendChild(actualBtn);

  const actualSkipBtn = createButton('确认弃票', () => {
    onAction?.({
      actionType: ACTION_TYPES.NIGHT_SKIP,
      actionData: {}
    });
  }, hasMyActual, 'secondary');
  btnRow.appendChild(actualSkipBtn);

  el.appendChild(btnRow);

  // Teammates' votes section
  const teammatesBox = document.createElement('div');
  teammatesBox.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--error-500);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    margin-bottom: var(--spacing-1);
  `;
  header.textContent = '队友投票状态:';
  teammatesBox.appendChild(header);

  // Get all wolf IDs
  const wolfIds = (state.wolfTeamIds || []).filter(id => id !== playerId);

  if (wolfIds.length === 0) {
    const noTeammate = document.createElement('div');
    noTeammate.style.cssText = `font-size: var(--text-sm); color: var(--text-tertiary);`;
    noTeammate.textContent = '无其他队友';
    teammatesBox.appendChild(noTeammate);
  } else {
    for (const wolfId of wolfIds) {
      const wolf = findPlayer(state.players, wolfId);
      const actualTarget = wolfVotes[wolfId];
      const tentativeTarget = tentativeVotes[wolfId];
      const hasActualVote = hasOwn(wolfVotes, wolfId);
      const hasTentativeVote = hasOwn(tentativeVotes, wolfId);

      const row = document.createElement('div');
      row.style.cssText = `
        font-size: var(--text-sm);
        color: var(--text-primary);
        padding: 2px 0;
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
      `;

      const wolfName = getDisplayName(wolf, playerId, state.seerChecks, wolfId);
      let statusHtml;

      if (hasActualVote) {
        if (actualTarget === null) {
          statusHtml = '<span style="color: var(--success-500);">✓</span> 弃票';
        } else {
          const targetName = getDisplayName(findPlayer(state.players, actualTarget), playerId, state.seerChecks, actualTarget);
          statusHtml = `<span style="color: var(--success-500);">✓</span> ${targetName}`;
        }
      } else if (hasTentativeVote) {
        if (tentativeTarget === null) {
          statusHtml = '<span style="color: var(--warning-500);">?</span> 弃票 <span style="font-size: var(--text-xs); color: var(--text-tertiary);">(拟)</span>';
        } else {
          const targetName = getDisplayName(findPlayer(state.players, tentativeTarget), playerId, state.seerChecks, tentativeTarget);
          statusHtml = `<span style="color: var(--warning-500);">?</span> ${targetName} <span style="font-size: var(--text-xs); color: var(--text-tertiary);">(拟)</span>`;
        }
      } else {
        statusHtml = `<span style="color: var(--text-tertiary);">—</span> 未选择`;
      }

      row.innerHTML = `
        <span style="flex: 1;">${wolfName}</span>
        <span>${statusHtml}</span>
      `;
      teammatesBox.appendChild(row);
    }
  }

  el.appendChild(teammatesBox);

  return el;
}

export default {
  renderNightPanel,
  renderLastDayResult,
  renderDoctorPanel,
  renderBodyguardPanel,
  renderMyNightAction,
  renderWitchPanel,
  renderNightProgress,
  renderSeerResult,
  renderWolfVotesPanel
};
