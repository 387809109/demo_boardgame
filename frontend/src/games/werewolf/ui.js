/**
 * Werewolf Game UI
 * @module games/werewolf/ui
 */

import { ACTION_TYPES, PHASES, TEAMS } from './index.js';

/** Team color CSS values */
const TEAM_COLORS = {
  [TEAMS.WEREWOLF]: 'var(--error-500)',
  [TEAMS.VILLAGE]: 'var(--success-500)',
  [TEAMS.NEUTRAL]: 'var(--warning-500)'
};

/** Role display names (Chinese) */
const ROLE_NAMES = {
  villager: '村民',
  werewolf: '狼人',
  seer: '预言家',
  doctor: '医生',
  hunter: '猎人',
  witch: '女巫'
};

/** Role descriptions */
const ROLE_DESCRIPTIONS = {
  villager: '普通村民，没有特殊能力。通过白天讨论和投票消灭狼人。',
  werewolf: '狼人阵营，每晚可以选择一名玩家击杀。',
  seer: '每晚可以查验一名玩家的阵营身份。',
  doctor: '每晚可以保护一名玩家免受狼人袭击。',
  hunter: '死亡时可以开枪带走一名玩家。',
  witch: '拥有一瓶救人药水和一瓶毒药，每种只能使用一次。'
};

/** Phase display names */
const PHASE_NAMES = {
  [PHASES.NIGHT]: '夜晚',
  [PHASES.DAY_ANNOUNCE]: '天亮了',
  [PHASES.DAY_DISCUSSION]: '自由讨论',
  [PHASES.DAY_VOTE]: '投票放逐',
  [PHASES.ENDED]: '游戏结束'
};

/**
 * Werewolf UI Component
 */
export class WerewolfUI {
  constructor() {
    /** @type {Object|null} */
    this.state = null;
    /** @type {string|null} */
    this.playerId = null;
    /** @type {Function|null} */
    this.onAction = null;
    /** @type {string|null} */
    this._selectedTarget = null;
    /** @type {HTMLElement|null} */
    this._container = null;
  }

  /**
   * Render the game UI
   * @param {Object} state - Visible game state
   * @param {string} playerId - Current player ID
   * @param {Function} onAction - Action callback
   * @returns {HTMLElement}
   */
  render(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;
    this._selectedTarget = null;

    const container = document.createElement('div');
    container.className = 'ww-game';
    container.style.cssText = `
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
      align-items: stretch;
    `;
    this._container = container;

    // 1. Role info bar
    container.appendChild(this._renderRoleInfo());

    // 2. Phase header
    container.appendChild(this._renderPhaseHeader());

    // 3. Phase content — switch by current phase
    if (state.hunterPendingShoot === playerId) {
      container.appendChild(this._renderHunterShoot());
    } else {
      switch (state.phase) {
        case PHASES.NIGHT:
          container.appendChild(this._renderNightPanel());
          break;
        case PHASES.DAY_ANNOUNCE:
          container.appendChild(this._renderAnnouncePanel());
          break;
        case PHASES.DAY_DISCUSSION:
          container.appendChild(this._renderDiscussionPanel());
          break;
        case PHASES.DAY_VOTE:
          container.appendChild(this._renderVotePanel());
          break;
        case PHASES.ENDED:
          container.appendChild(this._renderEndedPanel());
          break;
      }
    }

    // 4. Dead chat — only when viewer is dead or game ended
    const viewer = this._getViewer();
    if (viewer && (!viewer.alive || state.phase === PHASES.ENDED)) {
      container.appendChild(this._renderDeadChat());
    }

    return container;
  }

  /**
   * Render action bar buttons
   * @param {Object} state - Visible game state
   * @param {string} playerId - Current player ID
   * @param {Function} onAction - Action callback
   * @returns {HTMLElement}
   */
  renderActions(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;

    const bar = document.createElement('div');
    bar.className = 'ww-actions';
    bar.style.cssText = `
      display: flex;
      gap: var(--spacing-3);
      justify-content: center;
      flex-wrap: wrap;
    `;

    // Hunter shoot overrides everything
    if (state.hunterPendingShoot === playerId) {
      bar.appendChild(this._createButton('确认开枪', () => {
        if (this._selectedTarget) {
          onAction({
            actionType: ACTION_TYPES.HUNTER_SHOOT,
            actionData: { targetId: this._selectedTarget }
          });
        }
      }, !this._selectedTarget));
      return bar;
    }

    const viewer = this._getViewer();

    switch (state.phase) {
      case PHASES.NIGHT: {
        if (!viewer?.alive) break;
        const role = state.myRole?.roleId;
        const hasAction = this._roleHasNightAction(role);
        if (hasAction) {
          bar.appendChild(this._createButton('确认行动', () => {
            this._submitNightAction();
          }, !this._selectedTarget && this._nightActionRequiresTarget(role)));
        } else {
          bar.appendChild(this._createButton('等待其他玩家...', null, true));
        }
        break;
      }
      case PHASES.DAY_ANNOUNCE:
        bar.appendChild(this._createButton('继续', () => {
          onAction({ actionType: ACTION_TYPES.PHASE_ADVANCE });
        }));
        break;
      case PHASES.DAY_DISCUSSION:
        if (state.currentSpeaker === playerId) {
          bar.appendChild(this._createButton('发言结束', () => {
            onAction({ actionType: ACTION_TYPES.SPEECH_DONE });
          }));
        } else {
          bar.appendChild(this._createButton('等待发言...', null, true));
        }
        break;
      case PHASES.DAY_VOTE:
        bar.appendChild(this._createButton('弃票', () => {
          onAction({ actionType: ACTION_TYPES.DAY_SKIP_VOTE });
        }));
        break;
      case PHASES.ENDED:
        // No actions
        break;
    }

    return bar;
  }

  /**
   * Update state (called on each state change)
   * @param {Object} state
   */
  updateState(state) {
    this.state = state;
    this._selectedTarget = null;
  }

  // ─── Role Info ──────────────────────────────────────────────

  /**
   * Render role info bar
   * @private
   * @returns {HTMLElement}
   */
  _renderRoleInfo() {
    const el = document.createElement('div');
    el.className = 'ww-role-info';

    const roleId = this.state.myRole?.roleId;
    const team = this.state.myRole?.team;
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
      <div style="
        font-size: var(--text-sm);
        color: var(--text-secondary);
        flex: 1;
      ">${desc}</div>
    `;

    return el;
  }

  // ─── Phase Header ───────────────────────────────────────────

  /**
   * Render phase header
   * @private
   * @returns {HTMLElement}
   */
  _renderPhaseHeader() {
    const el = document.createElement('div');
    el.className = 'ww-phase-header';

    const phaseName = PHASE_NAMES[this.state.phase] || this.state.phase;
    const round = this.state.round || 1;

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

  // ─── Night Panel ────────────────────────────────────────────

  /**
   * Render night action panel
   * @private
   * @returns {HTMLElement}
   */
  _renderNightPanel() {
    const el = document.createElement('div');
    el.className = 'ww-night-panel';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
    `;

    const viewer = this._getViewer();
    if (!viewer?.alive) {
      el.appendChild(this._createInfoBox('你已死亡，等待天亮...'));
      return el;
    }

    const role = this.state.myRole?.roleId;

    switch (role) {
      case 'werewolf':
        el.appendChild(this._createInfoBox('选择今晚要击杀的目标'));
        el.appendChild(this._renderPlayerGrid({
          selectable: true,
          excludeTeam: TEAMS.WEREWOLF,
          onSelect: (targetId) => { this._selectedTarget = targetId; }
        }));
        break;

      case 'seer':
        el.appendChild(this._createInfoBox('选择要查验的玩家'));
        el.appendChild(this._renderPlayerGrid({
          selectable: true,
          excludeIds: [this.playerId],
          onSelect: (targetId) => { this._selectedTarget = targetId; }
        }));
        break;

      case 'doctor':
        el.appendChild(this._createInfoBox('选择要保护的玩家'));
        el.appendChild(this._renderPlayerGrid({
          selectable: true,
          excludeIds: this.state.options?.allowDoctorSelfProtect
            ? [] : [this.playerId],
          onSelect: (targetId) => { this._selectedTarget = targetId; }
        }));
        break;

      case 'witch':
        el.appendChild(this._renderWitchPanel());
        break;

      case 'hunter':
      case 'villager':
      default:
        el.appendChild(this._createInfoBox('夜晚降临，请闭眼等待...'));
        break;
    }

    // Skip button for roles with night actions
    if (this._roleHasNightAction(role)) {
      const skipBtn = this._createButton('跳过行动', () => {
        this.onAction({
          actionType: ACTION_TYPES.NIGHT_SKIP,
          actionData: {}
        });
      }, false, 'secondary');
      el.appendChild(skipBtn);
    }

    return el;
  }

  /**
   * Render witch night panel with save + poison options
   * @private
   * @returns {HTMLElement}
   */
  _renderWitchPanel() {
    const el = document.createElement('div');
    el.className = 'ww-witch-panel';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
    `;

    const roleStates = this.state.roleStates || {};
    const saveUsed = roleStates.witchSaveUsed;
    const poisonUsed = roleStates.witchPoisonUsed;

    // Find wolf target from announcements (witch_night_info)
    const witchInfo = (this.state.dayAnnouncements || [])
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
      const targetPlayer = this._findPlayer(wolfTargetId);
      const targetName = targetPlayer?.nickname || wolfTargetId;
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

      const saveBtn = this._createButton('使用解药', () => {
        this.onAction({
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
        ">选择毒杀目标</div>
      `;

      poisonSection.appendChild(this._renderPlayerGrid({
        selectable: true,
        excludeIds: [this.playerId],
        onSelect: (targetId) => {
          this._selectedTarget = targetId;
          this._witchAction = 'poison';
        }
      }));

      const poisonBtn = this._createButton('使用毒药', () => {
        if (this._selectedTarget) {
          this.onAction({
            actionType: ACTION_TYPES.NIGHT_WITCH_POISON,
            actionData: { targetId: this._selectedTarget }
          });
        }
      }, false, 'danger');
      poisonSection.appendChild(poisonBtn);
    }
    el.appendChild(poisonSection);

    return el;
  }

  // ─── Day Announce Panel ─────────────────────────────────────

  /**
   * Render day announce panel
   * @private
   * @returns {HTMLElement}
   */
  _renderAnnouncePanel() {
    const el = document.createElement('div');
    el.className = 'ww-announce-panel';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    const deaths = this.state.nightDeaths || [];
    const announcements = this.state.dayAnnouncements || [];

    if (deaths.length === 0) {
      el.appendChild(this._createInfoBox('昨晚是平安夜，没有人死亡'));
    } else {
      const deathBox = document.createElement('div');
      deathBox.style.cssText = `
        padding: var(--spacing-3);
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
      `;

      deathBox.innerHTML = `
        <div style="
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin-bottom: var(--spacing-2);
        ">昨晚死亡的玩家：</div>
      `;

      for (const death of deaths) {
        const player = this._findPlayer(death.playerId);
        const causeText = this._getDeathCauseText(death.cause);
        const row = document.createElement('div');
        row.style.cssText = `
          padding: var(--spacing-1) 0;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        `;
        row.innerHTML = `
          <span style="color: var(--error-500);">✕</span>
          <span style="font-weight: var(--font-medium);">
            ${player?.nickname || death.playerId}
          </span>
          <span style="color: var(--text-tertiary); font-size: var(--text-sm);">
            (${causeText})
          </span>
        `;
        deathBox.appendChild(row);
      }

      el.appendChild(deathBox);
    }

    // Private seer result
    const seerResult = announcements.find(
      a => a.type === 'seer_result' && a.playerId === this.playerId
    );
    if (seerResult) {
      const target = this._findPlayer(seerResult.targetId);
      const teamText = seerResult.result === TEAMS.WEREWOLF ? '狼人' : '好人';
      const teamColor = seerResult.result === TEAMS.WEREWOLF
        ? 'var(--error-500)' : 'var(--success-500)';

      const seerBox = document.createElement('div');
      seerBox.style.cssText = `
        padding: var(--spacing-3);
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
        border-left: 3px solid ${teamColor};
      `;
      seerBox.innerHTML = `
        <div style="font-weight: var(--font-semibold); color: var(--text-primary);">
          查验结果
        </div>
        <div style="color: var(--text-primary); margin-top: var(--spacing-1);">
          <span style="font-weight: var(--font-medium);">
            ${target?.nickname || seerResult.targetId}
          </span>
          的身份是
          <span style="color: ${teamColor}; font-weight: var(--font-bold);">
            ${teamText}
          </span>
        </div>
      `;
      el.appendChild(seerBox);
    }

    return el;
  }

  // ─── Discussion Panel ───────────────────────────────────────

  /**
   * Render discussion panel with speaker queue
   * @private
   * @returns {HTMLElement}
   */
  _renderDiscussionPanel() {
    const el = document.createElement('div');
    el.className = 'ww-discussion-panel';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    const queue = this.state.speakerQueue || [];
    const currentSpeaker = this.state.currentSpeaker;

    el.appendChild(this._createInfoBox(
      currentSpeaker === this.playerId
        ? '轮到你发言了，完成后点击"发言结束"'
        : '等待其他玩家发言...'
    ));

    // Speaker queue list
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;

    list.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">发言顺序</div>
    `;

    for (let i = 0; i < queue.length; i++) {
      const speakerId = queue[i];
      const player = this._findPlayer(speakerId);
      const isCurrent = speakerId === currentSpeaker;
      const isDone = i < (this.state.speakerQueue.indexOf(currentSpeaker));

      const row = document.createElement('div');
      row.style.cssText = `
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        ${isCurrent
          ? 'background: var(--primary-100); border-left: 3px solid var(--primary-500);'
          : ''}
        ${isDone ? 'opacity: 0.5;' : ''}
      `;
      row.innerHTML = `
        <span style="
          width: 20px;
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">${i + 1}</span>
        <span style="
          color: ${isCurrent ? 'var(--primary-700)' : 'var(--text-primary)'};
          font-weight: ${isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)'};
        ">${player?.nickname || speakerId}</span>
        ${isCurrent ? '<span style="color: var(--primary-500); font-size: var(--text-xs);">发言中</span>' : ''}
        ${isDone ? '<span style="color: var(--text-tertiary); font-size: var(--text-xs);">已发言</span>' : ''}
      `;
      list.appendChild(row);
    }

    el.appendChild(list);
    return el;
  }

  // ─── Vote Panel ─────────────────────────────────────────────

  /**
   * Render vote panel
   * @private
   * @returns {HTMLElement}
   */
  _renderVotePanel() {
    const el = document.createElement('div');
    el.className = 'ww-vote-panel';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    const voteRound = this.state.voteRound || 1;
    const tiedCandidates = this.state.tiedCandidates;
    const hasVoted = this.state.votes?.[this.playerId] !== undefined;

    let infoText = '选择要放逐的玩家';
    if (voteRound === 2 && tiedCandidates?.length > 0) {
      infoText = '平票重投！仅可选择以下候选人';
    }
    if (hasVoted) {
      infoText = '你已投票，等待其他玩家...';
    }

    el.appendChild(this._createInfoBox(infoText));

    // Show tied candidates indicator
    if (voteRound === 2 && tiedCandidates?.length > 0) {
      const tiedBox = document.createElement('div');
      tiedBox.style.cssText = `
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--warning-100);
        border-radius: var(--radius-md);
        color: var(--warning-700);
        font-size: var(--text-sm);
      `;
      const names = tiedCandidates
        .map(id => this._findPlayer(id)?.nickname || id)
        .join('、');
      tiedBox.textContent = `平票候选人：${names}`;
      el.appendChild(tiedBox);
    }

    // Player grid for voting
    if (!hasVoted) {
      const filterIds = (voteRound === 2 && tiedCandidates?.length > 0)
        ? tiedCandidates : null;

      el.appendChild(this._renderPlayerGrid({
        selectable: true,
        excludeIds: [this.playerId],
        onlyIds: filterIds,
        onSelect: (targetId) => {
          this.onAction({
            actionType: ACTION_TYPES.DAY_VOTE,
            actionData: { targetId }
          });
        }
      }));
    }

    // Show current votes
    const votes = this.state.votes || {};
    const voteEntries = Object.entries(votes);
    if (voteEntries.length > 0) {
      const voteBox = document.createElement('div');
      voteBox.style.cssText = `
        padding: var(--spacing-3);
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
      `;
      voteBox.innerHTML = `
        <div style="
          font-weight: var(--font-semibold);
          color: var(--text-primary);
          margin-bottom: var(--spacing-2);
          font-size: var(--text-sm);
        ">已投票 (${voteEntries.length})</div>
      `;
      for (const [voterId, targetId] of voteEntries) {
        const voter = this._findPlayer(voterId);
        const target = targetId ? this._findPlayer(targetId) : null;
        const row = document.createElement('div');
        row.style.cssText = `
          font-size: var(--text-sm);
          color: var(--text-secondary);
          padding: 2px 0;
        `;
        row.textContent = target
          ? `${voter?.nickname || voterId} → ${target?.nickname || targetId}`
          : `${voter?.nickname || voterId} → 弃票`;
        voteBox.appendChild(row);
      }
      el.appendChild(voteBox);
    }

    return el;
  }

  // ─── Ended Panel ────────────────────────────────────────────

  /**
   * Render ended panel with winner and role reveal
   * @private
   * @returns {HTMLElement}
   */
  _renderEndedPanel() {
    const el = document.createElement('div');
    el.className = 'ww-ended-panel';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
      align-items: center;
    `;

    // Winner banner
    const winner = this.state.winner;
    const winnerLabel = winner === TEAMS.WEREWOLF ? '狼人阵营获胜'
      : winner === TEAMS.VILLAGE ? '好人阵营获胜' : '游戏结束';
    const winnerColor = TEAM_COLORS[winner] || 'var(--text-primary)';

    const banner = document.createElement('div');
    banner.style.cssText = `
      padding: var(--spacing-4) var(--spacing-6);
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
      text-align: center;
      border: 2px solid ${winnerColor};
      width: 100%;
    `;
    banner.innerHTML = `
      <div style="
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: ${winnerColor};
      ">${winnerLabel}</div>
    `;
    el.appendChild(banner);

    // Full role reveal table
    const table = document.createElement('div');
    table.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;

    table.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">玩家身份揭示</div>
    `;

    const players = this.state.players || [];
    for (const player of players) {
      const roleName = ROLE_NAMES[player.roleId] || player.roleId || '?';
      const teamColor = TEAM_COLORS[player.team] || 'var(--text-secondary)';
      const isAlive = player.alive;

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        ${!isAlive ? 'opacity: 0.6;' : ''}
      `;
      row.innerHTML = `
        <span style="
          width: 8px; height: 8px;
          border-radius: var(--radius-full);
          background: ${isAlive ? 'var(--success-500)' : 'var(--error-500)'};
          display: inline-block;
          flex-shrink: 0;
        "></span>
        <span style="
          flex: 1;
          color: var(--text-primary);
        ">${player.nickname}</span>
        <span style="
          color: ${teamColor};
          font-weight: var(--font-medium);
          font-size: var(--text-sm);
        ">${roleName}</span>
        <span style="
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        ">${isAlive ? '存活' : '死亡'}</span>
      `;
      table.appendChild(row);
    }

    el.appendChild(table);
    return el;
  }

  // ─── Hunter Shoot ───────────────────────────────────────────

  /**
   * Render hunter shoot panel (override for any phase)
   * @private
   * @returns {HTMLElement}
   */
  _renderHunterShoot() {
    const el = document.createElement('div');
    el.className = 'ww-hunter-shoot';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    el.appendChild(this._createInfoBox('你是猎人！死亡时可以开枪带走一名玩家'));

    el.appendChild(this._renderPlayerGrid({
      selectable: true,
      excludeIds: [this.playerId],
      onSelect: (targetId) => { this._selectedTarget = targetId; }
    }));

    return el;
  }

  // ─── Dead Chat ──────────────────────────────────────────────

  /**
   * Render dead chat box
   * @private
   * @returns {HTMLElement}
   */
  _renderDeadChat() {
    const el = document.createElement('div');
    el.className = 'ww-dead-chat';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      border-top: 2px solid var(--neutral-300);
    `;

    // Header
    const header = document.createElement('h4');
    header.style.cssText = `
      margin: 0;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      font-weight: var(--font-semibold);
    `;
    header.textContent = '亡者聊天';
    el.appendChild(header);

    // Messages container
    const messages = document.createElement('div');
    messages.className = 'ww-dead-chat__messages';
    messages.style.cssText = `
      max-height: 150px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    `;

    const chatMessages = this.state.deadChat || [];
    if (chatMessages.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        color: var(--text-tertiary);
        font-size: var(--text-sm);
        text-align: center;
        padding: var(--spacing-2);
      `;
      empty.textContent = '暂无消息';
      messages.appendChild(empty);
    } else {
      for (const msg of chatMessages) {
        const msgEl = document.createElement('div');
        msgEl.className = 'ww-dead-chat__msg';
        msgEl.style.cssText = `
          font-size: var(--text-sm);
          display: flex;
          gap: var(--spacing-1);
        `;
        msgEl.innerHTML = `
          <span class="ww-dead-chat__name" style="
            color: var(--primary-500);
            font-weight: var(--font-medium);
            flex-shrink: 0;
          ">${msg.nickname}:</span>
          <span class="ww-dead-chat__text" style="
            color: var(--text-primary);
            word-break: break-all;
          ">${this._escapeHtml(msg.message)}</span>
        `;
        messages.appendChild(msgEl);
      }
    }

    el.appendChild(messages);

    // Input area (only for dead viewers, not in ended phase)
    const viewer = this._getViewer();
    if (viewer && !viewer.alive && this.state.phase !== PHASES.ENDED) {
      const inputRow = document.createElement('div');
      inputRow.className = 'ww-dead-chat__input';
      inputRow.style.cssText = `
        display: flex;
        gap: var(--spacing-2);
      `;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '发送消息...';
      input.style.cssText = `
        flex: 1;
        padding: var(--spacing-1) var(--spacing-2);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
        font-size: var(--text-sm);
        background: var(--bg-primary);
        color: var(--text-primary);
        outline: none;
      `;

      const sendBtn = document.createElement('button');
      sendBtn.textContent = '发送';
      sendBtn.style.cssText = `
        padding: var(--spacing-1) var(--spacing-3);
        background: var(--primary-500);
        color: var(--text-inverse);
        border: none;
        border-radius: var(--radius-sm);
        font-size: var(--text-sm);
        cursor: pointer;
      `;

      const sendMessage = () => {
        const message = input.value.trim();
        if (message && this.onAction) {
          this.onAction({
            actionType: ACTION_TYPES.DEAD_CHAT,
            actionData: { message }
          });
          input.value = '';
        }
      };

      sendBtn.addEventListener('click', sendMessage);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
      });

      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      el.appendChild(inputRow);
    }

    // Auto-scroll to bottom
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });

    return el;
  }

  // ─── Reusable Player Grid ──────────────────────────────────

  /**
   * Render a reusable player grid for target selection
   * @private
   * @param {Object} opts
   * @param {boolean} opts.selectable - Whether cards are clickable
   * @param {Function} [opts.onSelect] - Callback when a player is selected
   * @param {string[]} [opts.excludeIds] - Player IDs to exclude
   * @param {string} [opts.excludeTeam] - Team to exclude
   * @param {string[]} [opts.onlyIds] - If set, only show these player IDs
   * @returns {HTMLElement}
   */
  _renderPlayerGrid(opts = {}) {
    const {
      selectable = false,
      onSelect,
      excludeIds = [],
      excludeTeam,
      onlyIds
    } = opts;

    const grid = document.createElement('div');
    grid.className = 'ww-player-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: var(--spacing-2);
    `;

    const players = this.state.players || [];

    for (const player of players) {
      // Filters
      if (excludeIds.includes(player.id)) continue;
      if (!player.alive) continue;
      if (excludeTeam && player.team === excludeTeam) continue;
      if (onlyIds && !onlyIds.includes(player.id)) continue;

      const isWolfTeammate = this.state.wolfTeamIds?.includes(player.id)
        && this.state.myRole?.team === TEAMS.WEREWOLF
        && player.id !== this.playerId;
      const isSelected = this._selectedTarget === player.id;

      const card = document.createElement('div');
      card.className = 'ww-player-card';
      card.style.cssText = `
        padding: var(--spacing-2);
        background: ${isSelected ? 'var(--primary-100)' : 'var(--bg-primary)'};
        border: 2px solid ${isSelected ? 'var(--primary-500)' : 'var(--border-light)'};
        border-radius: var(--radius-md);
        text-align: center;
        cursor: ${selectable ? 'pointer' : 'default'};
        transition: var(--transition-fast);
        ${isWolfTeammate ? `border-color: ${TEAM_COLORS[TEAMS.WEREWOLF]};` : ''}
      `;

      card.innerHTML = `
        <div style="
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">${player.nickname}</div>
        ${isWolfTeammate
          ? `<div style="
              font-size: var(--text-xs);
              color: ${TEAM_COLORS[TEAMS.WEREWOLF]};
            ">狼人同伴</div>`
          : ''}
      `;

      if (selectable && onSelect) {
        card.addEventListener('click', () => {
          // Update visual selection
          grid.querySelectorAll('.ww-player-card').forEach(c => {
            c.style.background = 'var(--bg-primary)';
            c.style.borderColor = 'var(--border-light)';
          });
          card.style.background = 'var(--primary-100)';
          card.style.borderColor = 'var(--primary-500)';
          this._selectedTarget = player.id;
          onSelect(player.id);
        });
      }

      grid.appendChild(card);
    }

    return grid;
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Submit the appropriate night action based on role
   * @private
   */
  _submitNightAction() {
    if (!this._selectedTarget || !this.onAction) return;

    const role = this.state.myRole?.roleId;
    let actionType;

    switch (role) {
      case 'werewolf':
        actionType = ACTION_TYPES.NIGHT_WOLF_KILL;
        break;
      case 'seer':
        actionType = ACTION_TYPES.NIGHT_SEER_CHECK;
        break;
      case 'doctor':
        actionType = ACTION_TYPES.NIGHT_DOCTOR_PROTECT;
        break;
      default:
        return;
    }

    this.onAction({
      actionType,
      actionData: { targetId: this._selectedTarget }
    });
  }

  /**
   * Check if a role has a night action
   * @private
   * @param {string} roleId
   * @returns {boolean}
   */
  _roleHasNightAction(roleId) {
    return ['werewolf', 'seer', 'doctor', 'witch'].includes(roleId);
  }

  /**
   * Check if a role's night action requires a target selection
   * @private
   * @param {string} roleId
   * @returns {boolean}
   */
  _nightActionRequiresTarget(roleId) {
    return ['werewolf', 'seer', 'doctor'].includes(roleId);
  }

  /**
   * Get the viewer player object from state
   * @private
   * @returns {Object|null}
   */
  _getViewer() {
    return (this.state.players || []).find(p => p.id === this.playerId) || null;
  }

  /**
   * Find a player by ID
   * @private
   * @param {string} playerId
   * @returns {Object|null}
   */
  _findPlayer(playerId) {
    return (this.state.players || []).find(p => p.id === playerId) || null;
  }

  /**
   * Get death cause display text
   * @private
   * @param {string} cause
   * @returns {string}
   */
  _getDeathCauseText(cause) {
    const texts = {
      wolf_kill: '被狼人袭击',
      witch_poison: '被毒杀',
      execution: '被放逐',
      hunter_shoot: '被猎人射杀',
      lover_death: '殉情'
    };
    return texts[cause] || cause;
  }

  /**
   * Create a styled info box
   * @private
   * @param {string} text
   * @returns {HTMLElement}
   */
  _createInfoBox(text) {
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
   * Create a styled button
   * @private
   * @param {string} text
   * @param {Function|null} onClick
   * @param {boolean} [disabled=false]
   * @param {string} [variant='primary']
   * @returns {HTMLElement}
   */
  _createButton(text, onClick, disabled = false, variant = 'primary') {
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

    if (onClick && !disabled) {
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export default WerewolfUI;
