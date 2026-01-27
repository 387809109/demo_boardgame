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
    this.selectedAction = null;
    this.selectedTargets = [];
    this._container = null;
  }

  render(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;
    this.selectedTarget = null;
    this.selectedAction = null;
    this.selectedTargets = [];

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
    this.selectedTargets = [];
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
      const visibleRole = this.state.rolesVisible?.[player.id];
      const roleText = visibleRole ? ` - ${this._getRoleLabel(visibleRole.roleId)}` : '';
      const captainTag = this.state.captainRevealed && this.state.captainId === player.id ? ' · 队长' : '';
      card.innerHTML = `
        <div style="font-weight: var(--font-semibold);">${player.nickname}</div>
        <div style="color: var(--text-tertiary); font-size: var(--text-xs);">
          ${player.alive ? '存活' : '死亡'}${roleText}${captainTag}
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
    } else if (this.state.pendingHunterShot === this.playerId) {
      div.appendChild(this._renderHunterShot());
    } else if (this.state.phase === PHASES.DAY_ANNOUNCE) {
      div.appendChild(this._renderDayAnnounce());
    } else if (this.state.phase === PHASES.DAY_VOTE) {
      div.appendChild(this._renderVotePanel());
    } else {
      div.appendChild(this._renderDayDiscussion());
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

    if (this.state.seerResult && roleId === 'seer') {
      const result = document.createElement('div');
      result.style.cssText = 'color: var(--text-secondary); font-size: var(--text-sm);';
      result.textContent = `查验结果：${this.state.seerResult.targetId} => ${this._getTeamLabel(this.state.seerResult.team)}`;
      container.appendChild(result);
    }

    if (this.state.sheriffResult && roleId === 'sheriff') {
      const result = document.createElement('div');
      result.style.cssText = 'color: var(--text-secondary); font-size: var(--text-sm);';
      result.textContent = `查验结果：${this.state.sheriffResult.targetId} => ${this.state.sheriffResult.suspicion === 'suspicious' ? '可疑' : '无辜'}`;
      container.appendChild(result);
    }

    if (roleId === 'piper') {
      const charmInfo = document.createElement('div');
      const total = this._alivePlayers().length - 1;
      const current = (this.state.charmedVisible || []).length;
      charmInfo.style.cssText = 'color: var(--text-secondary); font-size: var(--text-sm);';
      charmInfo.textContent = `已魅惑人数：${current}/${Math.max(0, total)}`;
      container.appendChild(charmInfo);
    }

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-wrap: wrap; gap: var(--spacing-2);';

    this._alivePlayers().forEach(player => {
      if (player.id === this.playerId) return;
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = player.nickname;
      btn.addEventListener('click', () => {
        if (roleId === 'cupid') {
          if (!this.selectedTargets.includes(player.id) && this.selectedTargets.length < 2) {
            this.selectedTargets.push(player.id);
          }
        } else {
          this.selectedTarget = player.id;
          this.selectedAction = roleId;
        }
        this._renderSelectionHint(container);
      });
      list.appendChild(btn);
    });

    container.appendChild(list);

    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display: flex; gap: var(--spacing-2); margin-top: var(--spacing-2);';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary btn-sm';
    confirmBtn.textContent = '确认行动';
    confirmBtn.addEventListener('click', () => {
      this._submitNightAction(roleId);
    });
    actionsRow.appendChild(confirmBtn);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-ghost btn-sm';
    skipBtn.textContent = '跳过行动';
    skipBtn.addEventListener('click', () => {
      this.onAction?.({ actionType: ACTION_TYPES.NIGHT_SKIP, actionData: {} });
    });
    actionsRow.appendChild(skipBtn);

    container.appendChild(actionsRow);

    if (roleId === 'witch') {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-secondary btn-sm';
      saveBtn.textContent = '使用解药';
      saveBtn.addEventListener('click', () => {
        this.onAction?.({ actionType: ACTION_TYPES.NIGHT_WITCH_SAVE, actionData: {} });
      });

      actionsRow.appendChild(saveBtn);
    }

    return container;
  }

  _renderDayDiscussion() {
    const container = document.createElement('div');
    const text = document.createElement('div');
    text.textContent = '白天讨论中...';
    container.appendChild(text);

    if (this.state.myRole?.roleId === 'captain' && !this.state.captainRevealed) {
      const reveal = document.createElement('button');
      reveal.className = 'btn btn-secondary btn-sm';
      reveal.textContent = '公开队长身份';
      reveal.style.marginTop = 'var(--spacing-2)';
      reveal.addEventListener('click', () => {
        this.onAction?.({ actionType: ACTION_TYPES.DAY_REVEAL_CAPTAIN, actionData: {} });
      });
      container.appendChild(reveal);
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

  _renderHunterShot() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="font-weight: var(--font-semibold);">猎人开枪</div>
      <div style="color: var(--text-secondary); font-size: var(--text-sm);">请选择一名目标</div>
    `;

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-wrap: wrap; gap: var(--spacing-2); margin-top: var(--spacing-2);';

    this._alivePlayers().forEach(player => {
      if (player.id === this.playerId) return;
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = player.nickname;
      btn.addEventListener('click', () => {
        this.selectedTarget = player.id;
        this._renderSelectionHint(container);
      });
      list.appendChild(btn);
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary btn-sm';
    confirmBtn.textContent = '确认开枪';
    confirmBtn.addEventListener('click', () => {
      if (!this.selectedTarget) return;
      this.onAction?.({
        actionType: ACTION_TYPES.HUNTER_SHOOT,
        actionData: { targetId: this.selectedTarget }
      });
    });

    container.appendChild(list);
    container.appendChild(confirmBtn);
    return container;
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
        this.selectedTarget = player.id;
        this._renderSelectionHint(container);
      });
      list.appendChild(btn);
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary btn-sm';
    confirmBtn.textContent = '确认投票';
    confirmBtn.addEventListener('click', () => {
      if (!this.selectedTarget) return;
      this.onAction?.({
        actionType: ACTION_TYPES.DAY_VOTE,
        actionData: { targetId: this.selectedTarget }
      });
    });
    list.appendChild(confirmBtn);

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
      case 'bodyguard':
        return [ACTION_TYPES.NIGHT_BODYGUARD_PROTECT];
      case 'sheriff':
        return [ACTION_TYPES.NIGHT_SHERIFF_CHECK];
      case 'vigilante':
        return [ACTION_TYPES.NIGHT_VIGILANTE_KILL];
      case 'piper':
        return [ACTION_TYPES.NIGHT_PIPER_CHARM];
      case 'cupid':
        return [ACTION_TYPES.NIGHT_CUPID_LINK];
      case 'witch':
        return [ACTION_TYPES.NIGHT_WITCH_SAVE, ACTION_TYPES.NIGHT_WITCH_POISON];
      default:
        return [];
    }
  }

  _submitNightAction(roleId) {
    let actionType = null;
    let actionData = null;
    switch (roleId) {
      case 'werewolf':
        actionType = ACTION_TYPES.NIGHT_WOLF_KILL;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'seer':
        actionType = ACTION_TYPES.NIGHT_SEER_CHECK;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'doctor':
        actionType = ACTION_TYPES.NIGHT_DOCTOR_PROTECT;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'bodyguard':
        actionType = ACTION_TYPES.NIGHT_BODYGUARD_PROTECT;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'sheriff':
        actionType = ACTION_TYPES.NIGHT_SHERIFF_CHECK;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'vigilante':
        actionType = ACTION_TYPES.NIGHT_VIGILANTE_KILL;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'piper':
        actionType = ACTION_TYPES.NIGHT_PIPER_CHARM;
        actionData = { targetId: this.selectedTarget };
        break;
      case 'cupid':
        if (this.selectedTargets.length !== 2) return;
        actionType = ACTION_TYPES.NIGHT_CUPID_LINK;
        actionData = { targetIds: [...this.selectedTargets] };
        break;
      case 'witch':
        actionType = ACTION_TYPES.NIGHT_WITCH_POISON;
        actionData = { targetId: this.selectedTarget };
        break;
      default:
        break;
    }

    if (!actionType) return;
    if (!actionData && !this.selectedTarget) return;
    if (actionData && Object.prototype.hasOwnProperty.call(actionData, 'targetId') && !actionData.targetId) return;
    this.onAction?.({ actionType, actionData: actionData || {} });
  }

  _renderSelectionHint(container) {
    const hintId = 'werewolf-selection-hint';
    const existing = container.querySelector(`#${hintId}`);
    const text = this.selectedTargets.length
      ? `已选择：${this.selectedTargets.map(id => this._getNickname(id)).join(', ')}`
      : `已选择：${this._getNickname(this.selectedTarget)}`;
    if (existing) {
      existing.textContent = text;
      return;
    }
    const hint = document.createElement('div');
    hint.id = hintId;
    hint.style.cssText = 'color: var(--text-secondary); font-size: var(--text-sm); margin-top: var(--spacing-2);';
    hint.textContent = text;
    container.appendChild(hint);
  }

  _alivePlayers() {
    return this.state.players.filter(p => p.alive);
  }

  _getNickname(playerId) {
    const player = this.state.players.find(p => p.id === playerId);
    return player ? player.nickname : playerId;
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
      witch: '女巫',
      bodyguard: '守卫',
      cupid: '丘比特',
      sheriff: '警长',
      vigilante: '私刑者',
      idiot: '白痴',
      piper: '魔笛手',
      captain: '队长'
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
