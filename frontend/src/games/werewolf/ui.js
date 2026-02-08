/**
 * Werewolf Game UI
 * @module games/werewolf/ui
 *
 * Adapted for circular player ring layout - player selection now happens
 * through the PlayerRing component in GameBoard instead of a separate grid.
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
 * Now works with PlayerRing for player selection
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
    this._nightActionBtn = null;
    /** @type {HTMLElement|null} */
    this._container = null;
    /** @type {Object|null} */
    this._gameBoard = null;
    /** @type {string|null} - Track last phase for timer restart */
    this._lastPhase = null;
    /** @type {number|null} - Track last round for timer restart */
    this._lastRound = null;
    /** @type {string|null} - Track last speaker for discussion timer */
    this._lastSpeaker = null;
    /** @type {number|null} - Track last night step for timer restart */
    this._lastNightStep = null;
    /** @type {string|null} - Track last voter for vote timer restart */
    this._lastVoter = null;

    // Flag for GameBoard - mount below the ring
    this.mountInRingCenter = false;
  }

  /**
   * Set reference to GameBoard for player selection and timer
   * @param {Object} gameBoard - GameBoard instance
   */
  setGameBoard(gameBoard) {
    this._gameBoard = gameBoard;
    // Initialize timer on first set
    if (this.state) {
      this._updatePhaseTimer();
    }
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
    this._nightActionBtn = null;

    const container = document.createElement('div');
    container.className = 'ww-game';
    container.style.cssText = `
      width: 100%;
      max-width: 700px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
      align-items: stretch;
      padding: var(--spacing-4) 0;
    `;
    this._container = container;

    // 1. Role info bar
    container.appendChild(this._renderRoleInfo());

    // 2. Phase header
    container.appendChild(this._renderPhaseHeader());

    // 3. Phase content — switch by current phase
    if (state.hunterPendingShoot === playerId) {
      container.appendChild(this._renderHunterShoot());
      this._enableHunterSelection();
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
        const isMyStep = state.pendingNightRoles?.includes(playerId);
        const hasAction = this._roleHasNightAction(role);

        if (hasAction && isMyStep) {
          // Werewolves have buttons in the wolf panel, no action bar button needed
          if (role === 'werewolf') {
            bar.appendChild(this._createButton('请在上方选择目标', null, true));
          } else {
            const btn = this._createButton('确认行动', () => {
              this._submitNightAction();
            }, this._nightActionRequiresTarget(role) && !this._selectedTarget);
            this._nightActionBtn = btn;
            bar.appendChild(btn);
          }
        } else {
          const stepLabel = state.nightSteps?.[state.currentNightStep]?.label
            || '夜晚';
          bar.appendChild(this._createButton(
            `等待${stepLabel}...`, null, true
          ));
        }
        break;
      }
      case PHASES.DAY_ANNOUNCE: {
        // Check if viewer just died (has last words opportunity)
        const deaths = state.nightDeaths || [];
        const justDied = deaths.some(d => d.playerId === playerId);
        const buttonText = justDied ? '结束遗言' : '继续';

        bar.appendChild(this._createButton(buttonText, () => {
          onAction({ actionType: ACTION_TYPES.PHASE_ADVANCE });
        }));
        break;
      }
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
        if (state.currentVoter === playerId) {
          bar.appendChild(this._createButton('弃票', () => {
            onAction({ actionType: ACTION_TYPES.DAY_SKIP_VOTE });
          }));
        } else {
          bar.appendChild(this._createButton('等待投票...', null, true));
        }
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
    this._nightActionBtn = null;

    // Update selection mode based on current phase
    this._updateSelectionMode();

    // Update phase timer
    this._updatePhaseTimer();
  }

  /**
   * Update the phase timer based on current game phase
   * @private
   */
  _updatePhaseTimer() {
    if (!this._gameBoard) return;

    const phase = this.state.phase;
    const round = this.state.round || 1;
    const currentSpeaker = this.state.currentSpeaker;
    const currentNightStep = this.state.currentNightStep;
    const currentVoter = this.state.currentVoter;

    // Get timing config from state options (set during game creation)
    const timing = this.state.options || {};
    const nightActionTime = timing.nightActionTime || 30;
    const discussionTime = timing.discussionTime || 300;
    const voteTime = timing.voteTime || 30;
    const lastWordsTime = timing.lastWordsTime || 30;

    // Check if phase changed or round changed
    const phaseChanged = phase !== this._lastPhase || round !== this._lastRound;
    const speakerChanged = currentSpeaker !== this._lastSpeaker;
    const nightStepChanged = currentNightStep !== this._lastNightStep;
    const voterChanged = currentVoter !== this._lastVoter;

    if (phaseChanged) {
      // Stop any running timer first
      this._gameBoard.stopTimer();

      // Start new timer based on phase
      switch (phase) {
        case PHASES.NIGHT:
          this._gameBoard.startTimer(nightActionTime, '夜间行动');
          break;
        case PHASES.DAY_DISCUSSION:
          // Start timer for first speaker
          if (currentSpeaker) {
            this._gameBoard.startTimer(discussionTime, '讨论时间');
          }
          break;
        case PHASES.DAY_VOTE:
          this._gameBoard.startTimer(voteTime, '投票时间');
          break;
        case PHASES.ENDED:
          // No timer for ended phase
          break;
        // DAY_ANNOUNCE doesn't need a timer
      }
    } else if (phase === PHASES.NIGHT && nightStepChanged) {
      // Night step changed - restart timer for new step
      this._gameBoard.startTimer(nightActionTime, '夜间行动');
    } else if (phase === PHASES.DAY_DISCUSSION && speakerChanged && currentSpeaker) {
      // Speaker changed during discussion - restart timer
      this._gameBoard.startTimer(discussionTime, '讨论时间');
    } else if (phase === PHASES.DAY_VOTE && voterChanged && currentVoter) {
      // Voter changed during voting - restart timer
      this._gameBoard.startTimer(voteTime, '投票时间');
    }

    // Update tracking
    this._lastPhase = phase;
    this._lastRound = round;
    this._lastSpeaker = currentSpeaker;
    this._lastNightStep = currentNightStep;
    this._lastVoter = currentVoter;
  }

  /**
   * Get current selection config for GameBoard
   * Returns null if no selection needed
   * @returns {Object|null}
   */
  getSelectionConfig() {
    const viewer = this._getViewer();
    if (!viewer?.alive) return null;

    const state = this.state;

    // Hunter shoot
    if (state.hunterPendingShoot === this.playerId) {
      return {
        selectableIds: this._getAlivePlayerIds().filter(id => id !== this.playerId),
        disabledIds: [],
        onSelect: (targetId) => this._handleTargetSelect(targetId)
      };
    }

    // Night phase
    if (state.phase === PHASES.NIGHT) {
      const role = state.myRole?.roleId;
      const isMyStep = state.pendingNightRoles?.includes(this.playerId);

      if (isMyStep && this._roleHasNightAction(role)) {
        return this._getNightSelectionConfig(role);
      }
    }

    // Day vote - only when it's my turn
    if (state.phase === PHASES.DAY_VOTE && state.currentVoter === this.playerId) {
      const tiedCandidates = state.tiedCandidates;
      const voteRound = state.voteRound || 1;
      const filterIds = (voteRound === 2 && tiedCandidates?.length > 0)
        ? tiedCandidates : null;

      let selectableIds = this._getAlivePlayerIds().filter(id => id !== this.playerId);
      if (filterIds) {
        selectableIds = selectableIds.filter(id => filterIds.includes(id));
      }

      return {
        selectableIds,
        disabledIds: [],
        onSelect: (targetId) => {
          this.onAction?.({
            actionType: ACTION_TYPES.DAY_VOTE,
            actionData: { targetId }
          });
        }
      };
    }

    return null;
  }

  /**
   * Get night phase selection config based on role
   * @private
   */
  _getNightSelectionConfig(role) {
    let selectableIds = [];
    let excludeIds = [this.playerId];

    switch (role) {
      case 'werewolf':
        selectableIds = this._getAlivePlayerIds();
        break;
      case 'seer':
        selectableIds = this._getAlivePlayerIds().filter(id => id !== this.playerId);
        break;
      case 'doctor':
        if (this.state.options?.allowDoctorSelfProtect) {
          selectableIds = this._getAlivePlayerIds();
        } else {
          selectableIds = this._getAlivePlayerIds().filter(id => id !== this.playerId);
        }
        break;
      case 'witch':
        // Witch has special UI, but poison target selection uses ring
        const roleStates = this.state.roleStates || {};
        if (!roleStates.witchPoisonUsed) {
          selectableIds = this._getAlivePlayerIds().filter(id => id !== this.playerId);
        }
        break;
      default:
        return null;
    }

    return {
      selectableIds,
      disabledIds: [],
      onSelect: (targetId) => this._handleTargetSelect(targetId)
    };
  }

  /**
   * Handle target selection from player ring
   * @private
   */
  _handleTargetSelect(targetId) {
    this._selectedTarget = targetId;

    // Enable the confirm button if exists
    if (this._nightActionBtn) {
      this._nightActionBtn.disabled = false;
      this._nightActionBtn.style.cursor = 'pointer';
      this._nightActionBtn.style.opacity = '1';
    }

    // Re-render to show selection
    if (this._container) {
      // Just update visual feedback - the full re-render will happen on action
    }
  }

  /**
   * Update selection mode on GameBoard
   * @private
   */
  _updateSelectionMode() {
    if (!this._gameBoard) return;

    const config = this.getSelectionConfig();
    if (config) {
      this._gameBoard.enablePlayerSelection(config);
    } else {
      this._gameBoard.disablePlayerSelection();
    }
  }

  /**
   * Enable hunter shoot selection
   * @private
   */
  _enableHunterSelection() {
    if (!this._gameBoard) return;

    this._gameBoard.enablePlayerSelection({
      selectableIds: this._getAlivePlayerIds().filter(id => id !== this.playerId),
      disabledIds: [],
      onSelect: (targetId) => this._handleTargetSelect(targetId)
    });
  }

  /**
   * Get alive player IDs
   * @private
   */
  _getAlivePlayerIds() {
    return (this.state.players || [])
      .filter(p => p.alive !== false)
      .map(p => p.id);
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
   * Player selection happens through the ring, so no grid here
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

    // Night step progress bar
    const steps = this.state.nightSteps || [];
    const currentStep = this.state.currentNightStep ?? 0;
    if (steps.length > 0) {
      el.appendChild(this._renderNightProgress(steps, currentStep));
    }

    const role = this.state.myRole?.roleId;
    const isMyStep = this.state.pendingNightRoles?.includes(this.playerId);

    // Show seer result if available
    const seerResult = (this.state.dayAnnouncements || [])
      .find(a => a.type === 'seer_result' && a.playerId === this.playerId);
    if (seerResult) {
      el.appendChild(this._renderSeerResult(seerResult));
    }

    if (!isMyStep) {
      const label = steps[currentStep]?.label || '夜晚';
      el.appendChild(this._createInfoBox(`当前阶段: ${label}，等待行动中...`));
      return el;
    }

    // Enable selection mode for this role
    this._updateSelectionMode();

    switch (role) {
      case 'werewolf':
        el.appendChild(this._createInfoBox('先选择目标后点击"拟投票"表达意向，与队友协商后点击"确认击杀"'));
        el.appendChild(this._renderWolfVotesPanel());
        break;

      case 'seer':
        el.appendChild(this._createInfoBox('点击环形布局中的玩家头像选择要查验的玩家'));
        break;

      case 'doctor':
        el.appendChild(this._createInfoBox('点击环形布局中的玩家头像选择要保护的玩家'));
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

    // Skip button for roles with night actions (except werewolves who have their own panel)
    if (this._roleHasNightAction(role) && role !== 'werewolf') {
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

    // Find wolf target from announcements
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
      const targetName = this._displayName(targetPlayer, wolfTargetId);
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
        ">点击环形布局中的玩家头像选择毒杀目标</div>
      `;

      const poisonBtn = this._createButton('使用毒药', () => {
        if (this._selectedTarget) {
          this.onAction({
            actionType: ACTION_TYPES.NIGHT_WITCH_POISON,
            actionData: { targetId: this._selectedTarget }
          });
        }
      }, !this._selectedTarget, 'danger');
      poisonSection.appendChild(poisonBtn);
    }
    el.appendChild(poisonSection);

    return el;
  }

  /**
   * Render night step progress indicator
   * @private
   */
  _renderNightProgress(steps, currentStep) {
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
   * @private
   */
  _renderSeerResult(result) {
    const target = this._findPlayer(result.targetId);
    const targetName = this._displayName(target, result.targetId);
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
   * @private
   */
  _renderWolfVotesPanel() {
    const el = document.createElement('div');
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    const wolfVotes = this.state.wolfVotes || {};
    const tentativeVotes = this.state.wolfTentativeVotes || {};

    // My current selection/vote status
    const myTentative = tentativeVotes[this.playerId];
    const myActual = wolfVotes[this.playerId];
    const myTargetName = this._selectedTarget
      ? this._displayName(this._findPlayer(this._selectedTarget), this._selectedTarget)
      : (myTentative ? this._displayName(this._findPlayer(myTentative), myTentative) : '未选择');

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
        ${myActual
          ? `<span style="color: var(--success-500);">✓ 已确认:</span> ${this._displayName(this._findPlayer(myActual), myActual)}`
          : `<span style="color: var(--warning-500);">选中:</span> ${myTargetName}`
        }
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
    const tentativeBtn = this._createButton('拟投票', () => {
      if (this._selectedTarget) {
        this.onAction?.({
          actionType: ACTION_TYPES.NIGHT_WOLF_TENTATIVE,
          actionData: { targetId: this._selectedTarget }
        });
      }
    }, !this._selectedTarget, 'secondary');
    btnRow.appendChild(tentativeBtn);

    // Actual vote button
    const actualBtn = this._createButton('确认击杀', () => {
      if (this._selectedTarget) {
        this.onAction?.({
          actionType: ACTION_TYPES.NIGHT_WOLF_KILL,
          actionData: { targetId: this._selectedTarget }
        });
      }
    }, !this._selectedTarget || !!myActual, 'danger');
    btnRow.appendChild(actualBtn);

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
    const wolfIds = (this.state.wolfTeamIds || []).filter(id => id !== this.playerId);

    if (wolfIds.length === 0) {
      const noTeammate = document.createElement('div');
      noTeammate.style.cssText = `font-size: var(--text-sm); color: var(--text-tertiary);`;
      noTeammate.textContent = '无其他队友';
      teammatesBox.appendChild(noTeammate);
    } else {
      for (const wolfId of wolfIds) {
        const wolf = this._findPlayer(wolfId);
        const actualTarget = wolfVotes[wolfId];
        const tentativeTarget = tentativeVotes[wolfId];

        const row = document.createElement('div');
        row.style.cssText = `
          font-size: var(--text-sm);
          color: var(--text-primary);
          padding: 2px 0;
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        `;

        const wolfName = this._displayName(wolf, wolfId);
        let statusHtml;

        if (actualTarget) {
          const targetName = this._displayName(this._findPlayer(actualTarget), actualTarget);
          statusHtml = `<span style="color: var(--success-500);">✓</span> ${targetName}`;
        } else if (tentativeTarget) {
          const targetName = this._displayName(this._findPlayer(tentativeTarget), tentativeTarget);
          statusHtml = `<span style="color: var(--warning-500);">?</span> ${targetName} <span style="font-size: var(--text-xs); color: var(--text-tertiary);">(拟)</span>`;
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

  // ─── Day Announce Panel ─────────────────────────────────────

  /**
   * Render day announce panel
   * @private
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
            ${this._displayName(player, death.playerId)}
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
      el.appendChild(this._renderSeerResult(seerResult));
    }

    return el;
  }

  // ─── Discussion Panel ───────────────────────────────────────

  /**
   * Render discussion panel with speaker queue
   * @private
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
    const isTieSpeech = this.state.voteRound === 2 && this.state.tiedCandidates?.length > 0;

    // Tie speech header
    if (isTieSpeech) {
      const tieHeader = document.createElement('div');
      tieHeader.style.cssText = `
        padding: var(--spacing-2) var(--spacing-3);
        background: var(--warning-100);
        border-radius: var(--radius-md);
        color: var(--warning-700);
        font-weight: var(--font-semibold);
        text-align: center;
      `;
      tieHeader.textContent = '平票发言';
      el.appendChild(tieHeader);
    }

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

    const listTitle = isTieSpeech ? '平票候选人发言顺序' : '发言顺序';
    list.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">${listTitle}</div>
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
        ">${this._displayName(player, speakerId)}</span>
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
   * Render vote panel with sequential voting
   * Player selection happens through the ring
   * @private
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
    const currentVoter = this.state.currentVoter;
    const isMyTurn = currentVoter === this.playerId;
    const hasVoted = this.state.votes?.[this.playerId] !== undefined;

    // Info text based on state
    let infoText;
    if (isMyTurn) {
      infoText = voteRound === 2 && tiedCandidates?.length > 0
        ? '轮到你投票了，点击平票候选人的头像进行投票'
        : '轮到你投票了，点击环形布局中的玩家头像选择要放逐的玩家';
    } else if (hasVoted) {
      infoText = '你已投票，等待其他玩家...';
    } else {
      infoText = '等待其他玩家投票...';
    }

    el.appendChild(this._createInfoBox(infoText));

    // Enable selection mode for voting only when it's my turn
    if (isMyTurn) {
      this._updateSelectionMode();
    }

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
        .map(id => this._displayName(this._findPlayer(id), id))
        .join('、');
      tiedBox.textContent = `平票候选人：${names}`;
      el.appendChild(tiedBox);
    }

    // Voter queue list (similar to speaker queue)
    const voterQueue = this.state.voterQueue || [];
    if (voterQueue.length > 0) {
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
        ">投票顺序</div>
      `;

      const votes = this.state.votes || {};
      for (let i = 0; i < voterQueue.length; i++) {
        const voterId = voterQueue[i];
        const player = this._findPlayer(voterId);
        const isCurrent = voterId === currentVoter;
        const hasVotedAlready = votes[voterId] !== undefined;
        const voteTarget = votes[voterId];

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
          ${hasVotedAlready ? 'opacity: 0.7;' : ''}
        `;

        let statusText = '';
        if (isCurrent) {
          statusText = '<span style="color: var(--primary-500); font-size: var(--text-xs);">投票中</span>';
        } else if (hasVotedAlready) {
          const targetName = voteTarget
            ? this._displayName(this._findPlayer(voteTarget), voteTarget)
            : '弃票';
          statusText = `<span style="color: var(--text-tertiary); font-size: var(--text-xs);">→ ${targetName}</span>`;
        }

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
            flex: 1;
          ">${this._displayName(player, voterId)}</span>
          ${statusText}
        `;
        list.appendChild(row);
      }

      el.appendChild(list);
    }

    return el;
  }

  // ─── Ended Panel ────────────────────────────────────────────

  /**
   * Render ended panel with winner and role reveal
   * @private
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
        ">${this._displayName(player)}</span>
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
   * Selection happens through the ring
   * @private
   */
  _renderHunterShoot() {
    const el = document.createElement('div');
    el.className = 'ww-hunter-shoot';
    el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    el.appendChild(this._createInfoBox('你是猎人！点击环形布局中的玩家头像选择开枪目标'));

    return el;
  }

  // ─── Dead Chat ──────────────────────────────────────────────

  /**
   * Render dead chat box
   * @private
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
          ">${msg.playerId === this.playerId && msg.nickname
              ? `${msg.nickname}（我）` : msg.nickname}:</span>
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
   */
  _roleHasNightAction(roleId) {
    return ['werewolf', 'seer', 'doctor', 'witch'].includes(roleId);
  }

  /**
   * Check if a role's night action requires a target selection
   * @private
   */
  _nightActionRequiresTarget(roleId) {
    return ['werewolf', 'seer', 'doctor'].includes(roleId);
  }

  /**
   * Get the viewer player object from state
   * @private
   */
  _getViewer() {
    return (this.state.players || []).find(p => p.id === this.playerId) || null;
  }

  /**
   * Find a player by ID
   * @private
   */
  _findPlayer(playerId) {
    return (this.state.players || []).find(p => p.id === playerId) || null;
  }

  /**
   * Get display name, appending （我） for the current player
   * @private
   */
  _displayName(player, fallback = '') {
    const name = player?.nickname || fallback || '???';
    const id = player?.id || fallback;
    let display = id === this.playerId ? `${name}（我）` : name;

    if (id && id !== this.playerId) {
      if (player?.roleId) {
        const roleName = ROLE_NAMES[player.roleId] || player.roleId;
        display += `（${roleName}）`;
      } else {
        const seerChecks = this.state?.seerChecks || {};
        if (seerChecks[id]) {
          const teamLabel = seerChecks[id] === TEAMS.WEREWOLF ? '狼人' : '好人';
          display += `（${teamLabel}）`;
        }
      }
    }
    return display;
  }

  /**
   * Get death cause display text
   * @private
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

    if (onClick) {
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export default WerewolfUI;
