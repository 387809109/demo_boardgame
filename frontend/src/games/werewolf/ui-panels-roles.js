/**
 * Werewolf UI Role Panels
 * @module games/werewolf/ui-panels-roles
 *
 * Night phase panels for individual roles:
 * doctor, bodyguard, vigilante, witch, piper, cupid
 */

import { ACTION_TYPES } from './index.js';
import {
  escapeHtml,
  createInfoBox,
  createButton,
  findPlayer,
  getDisplayName
} from './ui-helpers.js';

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
 * Render cupid panel for linking lovers
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderCupidPanel(ctx) {
  const { state, playerId, onAction } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  // Check if cupid has already linked lovers
  if (state.roleStates?.cupidLinked) {
    const loversInfo = document.createElement('div');
    loversInfo.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    `;
    loversInfo.innerHTML = `
      <span style="color: var(--text-secondary);">你已连结恋人，变为普通村民</span>
    `;
    el.appendChild(loversInfo);
    return el;
  }

  // Show instructions
  el.appendChild(createInfoBox('点击左侧玩家头像选择两名恋人'));

  // Read selection from shared state
  const selected = window._cupidSelectedLovers || new Set();
  const selectionCount = selected.size;

  // Show selected lovers
  const selectedNames = [...selected].map(id => {
    const p = state.players.find(pl => pl.id === id);
    return p ? getDisplayName(p, playerId, state.seerChecks, id) : id;
  });

  const countBox = document.createElement('div');
  countBox.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: ${selectionCount === 2 ? 'var(--success-50)' : 'var(--warning-50)'};
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-align: center;
  `;
  countBox.innerHTML = selectionCount > 0
    ? `已选择: <strong>${selectedNames.join(' 和 ')}</strong> (${selectionCount}/2)`
    : '已选择 0 / 2 名玩家';
  el.appendChild(countBox);

  // Confirm button (only enabled when 2 players are selected)
  const confirmBtn = createButton('确认连结', () => {
    const lovers = [...selected];
    onAction({
      actionType: ACTION_TYPES.NIGHT_CUPID_LINK,
      actionData: { lovers }
    });
    selected.clear();
  }, selectionCount !== 2, 'primary');
  el.appendChild(confirmBtn);

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
 * Render vigilante panel with shot status
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderVigilantePanel(ctx) {
  const { state, playerId, selectedTarget } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const roleStates = state.roleStates || {};
  const maxShots = state.options?.vigilanteMaxShots ?? 1;
  const shotsUsed = roleStates.vigilanteShotsUsed ?? 0;
  const remainingShots = Math.max(0, maxShots - shotsUsed);
  const lastTarget = roleStates.vigilanteLastTarget;
  const isLocked = Boolean(roleStates.vigilanteLocked);
  const pendingSuicide = Boolean(roleStates.vigilantePendingSuicide);

  const statusBox = document.createElement('div');
  statusBox.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  `;
  statusBox.innerHTML = `
    <div>
      <span style="color: var(--text-secondary);">剩余射击: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${remainingShots} / ${maxShots}
      </span>
    </div>
  `;
  el.appendChild(statusBox);

  if (lastTarget) {
    const lastTargetPlayer = findPlayer(state.players, lastTarget);
    const lastTargetBox = document.createElement('div');
    lastTargetBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    `;
    lastTargetBox.innerHTML = `
      <span style="color: var(--text-secondary);">上次射击: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${getDisplayName(lastTargetPlayer, playerId, state.seerChecks, lastTarget)}
      </span>
    `;
    el.appendChild(lastTargetBox);
  }

  if (isLocked || pendingSuicide) {
    const lockReason = pendingSuicide
      ? '你将于今夜反噬死亡，无法执行射杀。'
      : '你已失去射杀能力，今晚只能跳过行动。';
    const lockedBox = document.createElement('div');
    lockedBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--warning-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--warning-500);
      font-size: var(--text-sm);
      color: var(--warning-700);
    `;
    lockedBox.textContent = lockReason;
    el.appendChild(lockedBox);
  } else if (remainingShots <= 0) {
    const noShotBox = document.createElement('div');
    noShotBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--warning-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--warning-500);
      font-size: var(--text-sm);
      color: var(--warning-700);
    `;
    noShotBox.textContent = '射击次数已用完，今晚只能跳过行动。';
    el.appendChild(noShotBox);
  }

  if (selectedTarget && !isLocked && !pendingSuicide && remainingShots > 0) {
    const targetPlayer = findPlayer(state.players, selectedTarget);
    const selectBox = document.createElement('div');
    selectBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--error-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--error-500);
      font-size: var(--text-sm);
    `;
    selectBox.innerHTML = `
      <span style="color: var(--text-secondary);">已选择射击: </span>
      <span style="color: var(--error-700); font-weight: var(--font-medium);">
        ${getDisplayName(targetPlayer, playerId, state.seerChecks, selectedTarget)}
      </span>
    `;
    el.appendChild(selectBox);
  } else if (!isLocked && !pendingSuicide && remainingShots > 0) {
    el.appendChild(createInfoBox('点击环形布局中的玩家头像选择要射击的玩家'));
  }

  return el;
}

/**
 * Render piper panel - selection via ring, status + confirm here.
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderPiperPanel(ctx) {
  const { state, playerId, onAction } = ctx;
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const roleStates = state.roleStates || {};
  const maxTargets = Math.max(1, state.options?.piperCharmTargetsPerNight ?? 2);
  const alreadyCharmed = new Set(roleStates.piperCharmedIds || []);
  const lastCharmedIds = roleStates.piperLastCharmedIds || [];

  // Already charmed count
  const statusBox = document.createElement('div');
  statusBox.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  `;
  statusBox.innerHTML = `
    <div>
      <span style="color: var(--text-secondary);">已魅惑玩家: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${alreadyCharmed.size}
      </span>
    </div>
  `;
  el.appendChild(statusBox);

  // Last night's charmed
  if (lastCharmedIds.length > 0) {
    const lastBox = document.createElement('div');
    const lastNames = lastCharmedIds.map(id => {
      const player = findPlayer(state.players, id);
      return getDisplayName(player, playerId, state.seerChecks, id);
    }).join('、');
    lastBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    `;
    lastBox.innerHTML = `
      <span style="color: var(--text-secondary);">上一夜新增魅惑: </span>
      <span style="color: var(--primary-600); font-weight: var(--font-medium);">
        ${escapeHtml(lastNames)}
      </span>
    `;
    el.appendChild(lastBox);
  }

  // Instructions
  el.appendChild(createInfoBox(
    `点击左侧玩家头像选择 1-${maxTargets} 名魅惑目标`
  ));

  // Read selection from shared state
  const selected = window._piperSelectedTargets || new Set();
  const selectionCount = selected.size;

  // Show selected targets
  const selectedNames = [...selected].map(id => {
    const p = state.players.find(pl => pl.id === id);
    return p ? getDisplayName(p, playerId, state.seerChecks, id) : id;
  });

  const countBox = document.createElement('div');
  countBox.style.cssText = `
    padding: var(--spacing-2) var(--spacing-3);
    background: ${selectionCount > 0 ? 'var(--success-50)' : 'var(--warning-50)'};
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    text-align: center;
  `;
  countBox.innerHTML = selectionCount > 0
    ? `已选择: <strong>${selectedNames.join('、')}</strong> (${selectionCount}/${maxTargets})`
    : `已选择 0 / ${maxTargets} 名玩家`;
  el.appendChild(countBox);

  // Action buttons
  const actionRow = document.createElement('div');
  actionRow.style.cssText = `
    display: flex;
    gap: var(--spacing-2);
    justify-content: center;
  `;

  const confirmBtn = createButton('确认魅惑', () => {
    const targetIds = [...selected];
    if (targetIds.length === 0) return;
    onAction({
      actionType: ACTION_TYPES.NIGHT_PIPER_CHARM,
      actionData: { targetIds }
    });
    selected.clear();
  }, selectionCount === 0, 'primary');

  const skipBtn = createButton('跳过行动', () => {
    onAction({
      actionType: ACTION_TYPES.NIGHT_SKIP,
      actionData: {}
    });
  }, false, 'secondary');

  actionRow.appendChild(confirmBtn);
  actionRow.appendChild(skipBtn);
  el.appendChild(actionRow);

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
