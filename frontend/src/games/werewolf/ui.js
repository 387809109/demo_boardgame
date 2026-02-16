/**
 * Werewolf Game UI
 * @module games/werewolf/ui
 *
 * Adapted for circular player ring layout - player selection now happens
 * through the PlayerRing component in GameBoard instead of a separate grid.
 */

import { ACTION_TYPES, PHASES } from './index.js';
import {
  roleHasNightAction,
  nightActionRequiresTarget,
  findPlayer,
  getAlivePlayerIds,
  createButton
} from './ui-helpers.js';
import {
  renderRoleInfo,
  renderPhaseHeader,
  renderNightPanel,
  renderAnnouncePanel,
  renderDiscussionPanel,
  renderVotePanel,
  renderEndedPanel,
  renderHunterShoot,
  renderDeadChat
} from './ui-panels.js';

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
    this._hunterShootBtn = null;
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
   * Get rendering context for panel functions
   * @private
   * @returns {Object}
   */
  _getRenderContext() {
    return {
      state: this.state,
      playerId: this.playerId,
      onAction: this.onAction,
      selectedTarget: this._selectedTarget,
      updateSelectionMode: () => this._updateSelectionMode()
    };
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
    this._hunterShootBtn = null;

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

    const ctx = this._getRenderContext();

    // 1. Role info bar
    container.appendChild(renderRoleInfo(ctx));

    // 2. Phase header
    container.appendChild(renderPhaseHeader(ctx));

    // 3. Phase content — switch by current phase
    if (state.hunterPendingShoot === playerId) {
      container.appendChild(renderHunterShoot(ctx));
      this._enableHunterSelection();
    } else {
      switch (state.phase) {
        case PHASES.NIGHT:
          container.appendChild(renderNightPanel(ctx));
          break;
        case PHASES.DAY_ANNOUNCE:
          container.appendChild(renderAnnouncePanel(ctx));
          break;
        case PHASES.DAY_DISCUSSION:
          container.appendChild(renderDiscussionPanel(ctx));
          break;
        case PHASES.DAY_VOTE:
          container.appendChild(renderVotePanel(ctx));
          break;
        case PHASES.ENDED:
          container.appendChild(renderEndedPanel(ctx));
          break;
      }
    }

    // 4. Dead chat — only when viewer is dead or game ended
    const viewer = this._getViewer();
    const canShowDeadChat = state.deadChatEnabled ?? (
      viewer && (!viewer.alive || state.phase === PHASES.ENDED)
    );
    if (canShowDeadChat) {
      container.appendChild(renderDeadChat(ctx));
    }

    // 5. Update selection mode after render
    this._updateSelectionMode();

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
      const btn = createButton('确认开枪', () => {
        if (this._selectedTarget) {
          onAction({
            actionType: ACTION_TYPES.HUNTER_SHOOT,
            actionData: { targetId: this._selectedTarget }
          });
        }
      }, !this._selectedTarget);
      this._hunterShootBtn = btn;
      bar.appendChild(btn);
      return bar;
    }

    const viewer = this._getViewer();

    switch (state.phase) {
      case PHASES.NIGHT: {
        if (!viewer?.alive) break;
        const role = state.myRole?.roleId;
        const isMyStep = state.pendingNightRoles?.includes(playerId);
        const hasAction = roleHasNightAction(role);

        if (hasAction && isMyStep) {
          // Werewolves have buttons in the wolf panel, no action bar button needed
          if (role === 'werewolf') {
            bar.appendChild(createButton('请在上方选择目标', null, true));
          } else {
            const btn = createButton('确认行动', () => {
              this._submitNightAction();
            }, nightActionRequiresTarget(role) && !this._selectedTarget);
            this._nightActionBtn = btn;
            bar.appendChild(btn);
          }
        } else {
          const stepLabel = state.nightSteps?.[state.currentNightStep]?.label
            || '夜晚';
          bar.appendChild(createButton(
            `等待${stepLabel}...`, null, true
          ));
        }
        break;
      }
      case PHASES.DAY_ANNOUNCE: {
        if (state.hunterPendingShoot) {
          bar.appendChild(createButton('等待猎人开枪...', null, true));
          break;
        }

        // Check who can click continue
        if (state.lastWordsPlayerId) {
          // Last words phase - only dying player can continue
          if (state.lastWordsPlayerId === playerId) {
            bar.appendChild(createButton('结束遗言', () => {
              onAction({ actionType: ACTION_TYPES.PHASE_ADVANCE });
            }));
          } else {
            bar.appendChild(createButton('等待遗言结束...', null, true));
          }
        } else if (state.awaitingFirstSpeaker) {
          // Waiting for first speaker to start
          if (state.firstSpeakerId === playerId) {
            bar.appendChild(createButton('开始发言', () => {
              onAction({ actionType: ACTION_TYPES.PHASE_ADVANCE });
            }));
          } else {
            bar.appendChild(createButton('等待发言开始...', null, true));
          }
        } else {
          // Fallback
          bar.appendChild(createButton('继续', () => {
            onAction({ actionType: ACTION_TYPES.PHASE_ADVANCE });
          }));
        }
        break;
      }
      case PHASES.DAY_DISCUSSION:
        if (state.currentSpeaker === playerId) {
          bar.appendChild(createButton('发言结束', () => {
            onAction({ actionType: ACTION_TYPES.SPEECH_DONE });
          }));
        } else {
          bar.appendChild(createButton('等待发言...', null, true));
        }
        break;
      case PHASES.DAY_VOTE:
        if ((state.roleStates?.idiotRevealedIds || []).includes(playerId)) {
          bar.appendChild(createButton('你已失去投票权', null, true));
        } else if (state.currentVoter === playerId) {
          bar.appendChild(createButton('弃票', () => {
            onAction({ actionType: ACTION_TYPES.DAY_SKIP_VOTE });
          }));
        } else {
          bar.appendChild(createButton('等待投票...', null, true));
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
    this._hunterShootBtn = null;

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

    // Get timing config from state options
    const timing = this.state.options || {};
    const nightActionTime = timing.nightActionTime || 30;
    const discussionTime = timing.discussionTime || 300;
    const voteTime = timing.voteTime || 30;

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
      }
    } else if (phase === PHASES.NIGHT && nightStepChanged) {
      this._gameBoard.startTimer(nightActionTime, '夜间行动');
    } else if (phase === PHASES.DAY_DISCUSSION && speakerChanged && currentSpeaker) {
      this._gameBoard.startTimer(discussionTime, '讨论时间');
    } else if (phase === PHASES.DAY_VOTE && voterChanged && currentVoter) {
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
   * @returns {Object|null}
   */
  getSelectionConfig() {
    const state = this.state;

    // Hunter shoot
    if (state.hunterPendingShoot === this.playerId) {
      return {
        selectableIds: getAlivePlayerIds(state).filter(id => id !== this.playerId),
        disabledIds: [],
        onSelect: (targetId) => this._handleTargetSelect(targetId)
      };
    }

    const viewer = this._getViewer();
    if (!viewer?.alive) return null;

    // Night phase
    if (state.phase === PHASES.NIGHT) {
      const role = state.myRole?.roleId;
      const isMyStep = state.pendingNightRoles?.includes(this.playerId);

      if (isMyStep && roleHasNightAction(role)) {
        return this._getNightSelectionConfig(role);
      }
    }

    // Day vote - only when it's my turn and player has vote rights
    const hasVoteRight = !((state.roleStates?.idiotRevealedIds || []).includes(this.playerId));
    if (state.phase === PHASES.DAY_VOTE && hasVoteRight && state.currentVoter === this.playerId) {
      const tiedCandidates = state.tiedCandidates;
      const voteRound = state.voteRound || 1;
      const filterIds = (voteRound === 2 && tiedCandidates?.length > 0)
        ? tiedCandidates : null;

      let selectableIds = getAlivePlayerIds(state).filter(id => id !== this.playerId);
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

    switch (role) {
      case 'werewolf':
        selectableIds = getAlivePlayerIds(this.state);
        break;
      case 'seer':
        selectableIds = getAlivePlayerIds(this.state).filter(id => id !== this.playerId);
        break;
      case 'doctor':
        if (this.state.options?.allowDoctorSelfProtect) {
          selectableIds = getAlivePlayerIds(this.state);
        } else {
          selectableIds = getAlivePlayerIds(this.state).filter(id => id !== this.playerId);
        }
        break;
      case 'witch':
        const roleStates = this.state.roleStates || {};
        if (!roleStates.witchPoisonUsed) {
          selectableIds = getAlivePlayerIds(this.state).filter(id => id !== this.playerId);
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

    // Refresh ring selection state so selected target is highlighted.
    this._updateSelectionMode();

    // Enable the confirm button if exists
    if (this._nightActionBtn) {
      this._nightActionBtn.disabled = false;
      this._nightActionBtn.style.cursor = 'pointer';
      this._nightActionBtn.style.opacity = '1';
    }

    if (this._hunterShootBtn) {
      this._hunterShootBtn.disabled = false;
      this._hunterShootBtn.style.cursor = 'pointer';
      this._hunterShootBtn.style.opacity = '1';
    }

    // Re-render night panel to update button states
    if (this._container && this.state?.phase === PHASES.NIGHT) {
      const nightPanel = this._container.querySelector('.ww-night-panel');
      if (nightPanel) {
        const ctx = this._getRenderContext();
        const newNightPanel = renderNightPanel(ctx);
        nightPanel.replaceWith(newNightPanel);
      }
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
      // Add selected target for highlight
      config.selectedId = this._selectedTarget;
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
      selectableIds: getAlivePlayerIds(this.state).filter(id => id !== this.playerId),
      disabledIds: [],
      onSelect: (targetId) => this._handleTargetSelect(targetId)
    });
  }

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
   * Get the viewer player object from state
   * @private
   */
  _getViewer() {
    return findPlayer(this.state?.players, this.playerId);
  }
}

export default WerewolfUI;
