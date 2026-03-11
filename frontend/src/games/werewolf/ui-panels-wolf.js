/**
 * Werewolf UI Wolf Panel
 * @module games/werewolf/ui-panels-wolf
 *
 * Wolf voting panel with tentative and actual vote tracking
 */

import { ACTION_TYPES } from './index.js';
import {
  createButton,
  findPlayer,
  getDisplayName
} from './ui-helpers.js';

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
