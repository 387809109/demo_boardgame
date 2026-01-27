/**
 * Werewolf Game UI
 * @module games/werewolf/ui
 */

import { ACTION_TYPES, PHASES, TEAMS } from './rules.js';
import { WEREWOLF_ACTIONS } from './index.js';

export class WerewolfUI {
  constructor() {
    this.state = null;
    this.playerId = null;
    this.onAction = null;
    this.selectedTarget = null;
    this._container = null;
  }

  render(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;
    this.selectedTarget = null;

    const container = document.createElement('div');
    container.className = 'werewolf-game';
    container.style.cssText = `
      width: 100%;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-6);
      align-items: stretch;
    `;
    this._container = container;

    container.appendChild(this._renderHeader());
    container.appendChild(this._renderPlayerList());
    container.appendChild(this._renderPhasePanel());

    return container;
  }

  renderActions(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;

    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: var(--spacing-3);';

    const isHost = state.players?.find(p => p.id === playerId)?.isHost;
    if (isHost) {
      const advanceBtn = document.createElement('button');
      advanceBtn.className = 'btn btn-primary';
      advanceBtn.textContent = '推进阶段';
      advanceBtn.addEventListener('click', () => {
        this.onAction?.({ actionType: WEREWOLF_ACTIONS.ADVANCE_PHASE, actionData: {} });
      });
      div.appendChild(advanceBtn);
    }

    return div;
  }

  updateState(state) {
    this.state = state;
    this.selectedTarget = null;
    if (this._container) {
      this._container.replaceWith(this.render(state, this.playerId, this.onAction));
    }
  }

  _renderHeader() {
    const div = document.createElement('div');
    div.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-4);
      background: var(--bg-primary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    `;

    const phaseLabel = this._getPhaseLabel(this.state.phase);
    const roleLabel = this.state.myRole?.roleId ? this._getRoleLabel(this.state.myRole.roleId) : '未知';
    const teamLabel = this.state.myRole?.team ? this._getTeamLabel(this.state.myRole.team) : '';

    div.innerHTML = `
      <div>
        <div style="font-size: var(--text-lg); font-weight: var(--font-semibold);">阶段：${phaseLabel}</div>
        <div style="font-size: var(--text-sm); color: var(--text-secondary);">天数：${this.state.round || 1}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: var(--text-sm); color: var(--text-secondary);">你的身份</div>
        <div style="font-size: var(--text-base); font-weight: var(--font-semibold);">${roleLabel}</div>
        <div style="font-size: var(--text-xs); color: var(--text-tertiary);">${teamLabel}</div>
      </div>
    `;

    return div;
  }

  _renderPlayerList() {
    const div = document.createElement('div');
    div.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--spacing-3);
    `;

    this.state.players.forEach(player => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: var(--spacing-3);
        border-radius: var(--radius-md);
        background: ${player.alive ? 'var(--bg-primary)' : 'var(--neutral-200)'};
        border: 1px solid var(--border-light);
        font-size: var(--text-sm);
      `;
      card.innerHTML = `
        <div style="font-weight: var(--font-semibold);">${player.nickname}</div>
        <div style="color: var(--text-tertiary); font-size: var(--text-xs);">
          ${player.alive ? '存活' : '死亡'}
        </div>
      `;
      div.appendChild(card);
    });

    return div;
  }

  _renderPhasePanel() {
    const div = document.createElement('div');
    div.style.cssText = `
      padding: var(--spacing-4);
      background: var(--bg-primary);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-light);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    if (this.state.phase === PHASES.NIGHT) {
      div.appendChild(this._renderNightPanel());
    } else if (this.state.phase === PHASES.DAY_ANNOUNCE) {
      div.appendChild(this._renderDayAnnounce());
    } else if (this.state.phase === PHASES.DAY_VOTE) {
      div.appendChild(this._renderVotePanel());
    } else {
      const text = document.createElement('div');
      text.textContent = '白天讨论中...';
      div.appendChild(text);
    }

    return div;
  }

  _renderNightPanel() {
    const container = document.createElement('div');
    const roleId = this.state.myRole?.roleId;

    const title = document.createElement('div');
    title.textContent = '夜晚行动';
    title.style.fontWeight = 'var(--font-semibold)';
    container.appendChild(title);

    const actions = this._getNightActionsForRole(roleId);
    if (actions.length === 0) {
      const msg = document.createElement('div');
      msg.textContent = '你没有夜晚行动';
      msg.style.color = 'var(--text-tertiary)';
      container.appendChild(msg);
      return container;
    }

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-wrap: wrap; gap: var(--spacing-2);';

    this._alivePlayers().forEach(player => {
      if (player.id === this.playerId) return;
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = player.nickname;
      btn.addEventListener('click', () => {
        this.selectedTarget = player.id;
        this._submitNightAction(roleId);
      });
      list.appendChild(btn);
    });

    container.appendChild(list);

    if (roleId === 'witch') {
      const actionsRow = document.createElement('div');
      actionsRow.style.cssText = 'display: flex; gap: var(--spacing-2); margin-top: var(--spacing-2);';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-secondary btn-sm';
      saveBtn.textContent = '使用解药';
      saveBtn.addEventListener('click', () => {
        this.onAction?.({ actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} });
      });

      actionsRow.appendChild(saveBtn);
      container.appendChild(actionsRow);
    }

    return container;
  }

  _renderDayAnnounce() {
    const div = document.createElement('div');
    const deaths = this.state.deaths || [];
    div.innerHTML = `
      <div style="font-weight: var(--font-semibold);">天亮了</div>
      <div style="color: var(--text-secondary);">
        ${deaths.length === 0 ? '昨夜无人死亡' : `昨夜死亡：${deaths.join(', ')}`}
      </div>
    `;
    return div;
  }

  _renderVotePanel() {
    const container = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = '投票放逐';
    title.style.fontWeight = 'var(--font-semibold)';
    container.appendChild(title);

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-wrap: wrap; gap: var(--spacing-2);';

    this._alivePlayers().forEach(player => {
      if (player.id === this.playerId) return;
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = player.nickname;
      btn.addEventListener('click', () => {
        this.onAction?.({
          actionType: ACTION_TYPES.DAY_VOTE,
          actionData: { targetId: player.id }
        });
      });
      list.appendChild(btn);
    });

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-ghost btn-sm';
    skipBtn.textContent = '弃票';
    skipBtn.addEventListener('click', () => {
      this.onAction?.({ actionType: ACTION_TYPES.DAY_SKIP_VOTE, actionData: {} });
    });
    list.appendChild(skipBtn);

    container.appendChild(list);
    return container;
  }

  _getNightActionsForRole(roleId) {
    switch (roleId) {
      case 'werewolf':
        return [ACTION_TYPES.NIGHT_WOLF_KILL];
      case 'seer':
        return [ACTION_TYPES.NIGHT_SEER_CHECK];
      case 'doctor':
        return [ACTION_TYPES.NIGHT_DOCTOR_PROTECT];
      case 'witch':
        return [ACTION_TYPES.NIGHT_WITCH_SAVE, ACTION_TYPES.NIGHT_WITCH_POISON];
      default:
        return [];
    }
  }

  _submitNightAction(roleId) {
    if (!this.selectedTarget) return;

    let actionType = null;
    switch (roleId) {
      case 'werewolf':
        actionType = ACTION_TYPES.NIGHT_WOLF_KILL;
        break;
      case 'seer':
        actionType = ACTION_TYPES.NIGHT_SEER_CHECK;
        break;
      case 'doctor':
        actionType = ACTION_TYPES.NIGHT_DOCTOR_PROTECT;
        break;
      case 'witch':
        actionType = ACTION_TYPES.NIGHT_WITCH_POISON;
        break;
      default:
        break;
    }

    if (!actionType) return;
    this.onAction?.({ actionType, actionData: { targetId: this.selectedTarget } });
  }

  _alivePlayers() {
    return this.state.players.filter(p => p.alive);
  }

  _getPhaseLabel(phase) {
    const labels = {
      [PHASES.NIGHT]: '夜晚',
      [PHASES.DAY_ANNOUNCE]: '白天公布',
      [PHASES.DAY_DISCUSSION]: '白天讨论',
      [PHASES.DAY_VOTE]: '白天投票',
      [PHASES.DAY_EXECUTION]: '执行',
      [PHASES.ENDED]: '已结束'
    };
    return labels[phase] || phase;
  }

  _getRoleLabel(roleId) {
    const labels = {
      villager: '村民',
      werewolf: '狼人',
      seer: '预言家',
      doctor: '医生',
      hunter: '猎人',
      witch: '女巫'
    };
    return labels[roleId] || roleId;
  }

  _getTeamLabel(team) {
    if (team === TEAMS.WEREWOLF) return '狼人阵营';
    if (team === TEAMS.VILLAGE) return '村民阵营';
    return '中立阵营';
  }
}

export default WerewolfUI;
