/**
 * Game Board Container Component
 * @module layout/game-board
 */

import { PlayerRing } from '../components/player-ring.js';
import { GameSidebar } from '../components/game-sidebar.js';
import { showQueryPanel } from '../components/query-panel.js';
import { PhaseTimer } from '../components/phase-timer.js';

/**
 * Game Board - Generic container for game rendering
 * Uses circular player ring layout with sidebar
 */
export class GameBoard {
  /**
   * @param {Object} options
   * @param {Object} options.game - Game instance
   * @param {string} options.playerId - Current player ID
   * @param {Object} options.gameConfig - Game configuration with settingsSchema
   * @param {Object} options.gameSettings - Current game settings
   * @param {Function} options.onAction - Called when player takes action
   * @param {Function} options.onLeave - Called when leaving game
   * @param {Function} options.onSendChat - Called when sending chat message
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.game = options.game;
    this.playerId = options.playerId || '';
    this.gameConfig = options.gameConfig || {};
    this.gameSettings = options.gameSettings || {};
    this.state = null;
    this.gameUI = null;
    this.playerRing = null;
    this.sidebar = null;
    this.phaseTimer = null;
    this._lastUnoCalledBy = null;
    this._lastSkippedPlayerId = null;
    this._lastCurrentPlayer = null;
    this._activeSkipBadgePlayerId = null;

    // Selection mode state
    this._selectionMode = false;
    this._selectionCallback = null;
    this._selectablePlayerIds = [];
    this._disabledPlayerIds = [];

    this._create();
  }

  /**
   * Create the board DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'game-board';
    this.element.style.cssText = `
      height: 100vh;
      background: var(--bg-secondary);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    this._render();
  }

  /**
   * Render the board
   * @private
   */
  _render() {
    const state = this.state || this.game?.getState();
    const isMyTurn = state?.currentPlayer === this.playerId;

    this.element.innerHTML = `
      <header class="game-header" style="
        background: var(--bg-primary);
        padding: var(--spacing-3) var(--spacing-6);
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: var(--shadow-sm);
        z-index: 10;
      ">
        <div style="display: flex; align-items: center; gap: var(--spacing-4);">
          <h2 style="margin: 0; font-size: var(--text-lg);">${this.game?.config?.name || '游戏'}</h2>
          ${state ? `
            <span class="turn-badge" style="
              padding: var(--spacing-1) var(--spacing-3);
              background: ${isMyTurn ? 'var(--success-500)' : 'var(--neutral-200)'};
              color: ${isMyTurn ? 'white' : 'var(--text-secondary)'};
              border-radius: var(--radius-full);
              font-size: var(--text-sm);
            ">
              ${isMyTurn ? '你的回合' : '等待对手'}
            </span>
            <span class="turn-number" style="color: var(--text-tertiary); font-size: var(--text-sm);">
              回合 ${state.turnNumber || 1}
            </span>
            <div class="phase-timer-container"></div>
          ` : ''}
        </div>
        <div style="display: flex; gap: var(--spacing-2);">
          <button class="btn btn-ghost btn-sm query-btn" title="游戏查询">🔍</button>
          <button class="btn btn-ghost btn-sm rules-btn" title="查看规则">📖 规则</button>
          <button class="btn btn-secondary btn-sm leave-btn">退出游戏</button>
        </div>
      </header>

      <div class="game-main" style="
        flex: 1;
        display: flex;
        overflow: hidden;
      ">
        <main class="game-area" style="
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <div class="game-content" style="
            flex: 1;
            padding: var(--spacing-4);
            display: flex;
            flex-direction: row;
            align-items: stretch;
            gap: var(--spacing-4);
            overflow: hidden;
          ">
            <!-- Player ring on the left -->
            <div class="player-ring-container" style="
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              min-width: 360px;
              max-width: 480px;
            "></div>
            <!-- Game UI content on the right -->
            <div class="game-ui-container" style="
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              overflow: auto;
              min-width: 0;
            "></div>
          </div>

          <div class="action-bar" style="
            background: var(--bg-primary);
            border-top: 1px solid var(--border-light);
            padding: var(--spacing-3) var(--spacing-6);
            display: flex;
            justify-content: center;
            gap: var(--spacing-3);
          ">
            <!-- Action buttons will be added by game UI -->
          </div>
        </main>

        <div class="sidebar-container"></div>
      </div>
    `;

    this._renderPlayerRing();
    this._renderSidebar();
    this._renderPhaseTimer();
    this._bindEvents();
  }

  /**
   * Render the phase timer
   * @private
   */
  _renderPhaseTimer() {
    const container = this.element.querySelector('.phase-timer-container');
    if (!container) return;

    // Create timer if not exists
    if (!this.phaseTimer) {
      this.phaseTimer = new PhaseTimer({
        onExpire: () => {
          // Timer expiry is just a reminder, no game effect
        }
      });
    }

    container.appendChild(this.phaseTimer.getElement());
  }

  /**
   * Render the player ring
   * @private
   */
  _renderPlayerRing() {
    const container = this.element.querySelector('.player-ring-container');
    if (!container) return;

    // Cleanup old ring
    if (this.playerRing) {
      this.playerRing.destroy();
      this.playerRing = null;
    }

    const state = this.state || this.game?.getState();
    const players = state?.players || [];
    if (players.length === 0) return;

    // Build badges for each player
    const badges = this._buildPlayerBadges(state, players);

    // Build dead player IDs
    const deadIds = players
      .filter(p => p.alive === false)
      .map(p => p.id);

    // Create player ring
    this.playerRing = new PlayerRing({
      players,
      selfPlayerId: this.playerId,
      currentPlayerId: state?.currentPlayer,
      direction: state?.direction ?? 1,
      selectableIds: this._selectionMode ? this._selectablePlayerIds : [],
      disabledIds: this._selectionMode ? this._disabledPlayerIds : [],
      deadIds,
      badges,
      onPlayerSelect: this._selectionMode ? (playerId) => {
        this._selectionCallback?.(playerId);
      } : null,
      minRadius: 140,
      maxRadius: 200
    });

    container.appendChild(this.playerRing.getElement());
  }

  /**
   * Build badges object for all players
   * @private
   */
  _buildPlayerBadges(state, players) {
    const badges = {};

    if (!state) return badges;

    // UNO badge
    if (state.unoCalledBy) {
      badges[state.unoCalledBy] = badges[state.unoCalledBy] || [];
      badges[state.unoCalledBy].push({ type: 'uno', text: 'UNO!' });
    }

    // Seer checks (Werewolf)
    const seerChecks = state.seerChecks || {};
    for (const [playerId, team] of Object.entries(seerChecks)) {
      badges[playerId] = badges[playerId] || [];
      const label = team === 'werewolf' ? '狼人' : '好人';
      badges[playerId].push({ type: 'seer', text: label });
    }

    // Wolf teammates (Werewolf - only for wolves)
    if (state.wolfTeamIds && state.myRole?.team === 'werewolf') {
      state.wolfTeamIds.forEach(wolfId => {
        if (wolfId !== this.playerId) {
          badges[wolfId] = badges[wolfId] || [];
          badges[wolfId].push({ type: 'wolf', text: '同伴' });
        }
      });
    }

    // Speaking badge (Werewolf - discussion phase)
    if (state.currentSpeaker && state.phase === 'day_discussion') {
      badges[state.currentSpeaker] = badges[state.currentSpeaker] || [];
      badges[state.currentSpeaker].push({ type: 'speaking', text: '发言中' });
    }

    // Last words badge (Werewolf - announce phase for dead players)
    if (state.phase === 'day_announce' && state.nightDeaths?.length > 0) {
      state.nightDeaths.forEach(death => {
        badges[death.playerId] = badges[death.playerId] || [];
        badges[death.playerId].push({ type: 'speaking', text: '遗言中' });
      });
    }

    // Voting badge (Werewolf - vote phase)
    if (state.currentVoter && state.phase === 'day_vote') {
      badges[state.currentVoter] = badges[state.currentVoter] || [];
      badges[state.currentVoter].push({ type: 'voting', text: '投票中' });
    }

    return badges;
  }

  /**
   * Render the sidebar
   * @private
   */
  _renderSidebar() {
    const container = this.element.querySelector('.sidebar-container');
    if (!container) return;

    // Cleanup old sidebar
    if (this.sidebar) {
      this.sidebar.destroy();
      this.sidebar = null;
    }

    // Create sidebar
    this.sidebar = new GameSidebar({
      playerId: this.playerId,
      gameConfig: this.gameConfig,
      gameSettings: this.gameSettings,
      getHistory: () => this.game?.getHistory() || [],
      getState: () => this.state || this.game?.getState(),
      onSendChat: (message) => this.options.onSendChat?.(message)
    });

    container.appendChild(this.sidebar.getElement());
  }

  /**
   * Bind events
   * @private
   */
  _bindEvents() {
    this.element.querySelector('.leave-btn')?.addEventListener('click', () => {
      this.options.onLeave?.();
    });

    this.element.querySelector('.query-btn')?.addEventListener('click', () => {
      showQueryPanel();
    });

    this.element.querySelector('.rules-btn')?.addEventListener('click', () => {
      const gameId = this.gameConfig?.id || this.game?.config?.id || 'uno';
      window.open(`/rules/${gameId}.html`, '_blank', 'width=900,height=700');
    });
  }

  /**
   * Update game state
   * @param {Object} state - New game state
   */
  updateState(state) {
    const prevUnoCalledBy = this._lastUnoCalledBy;
    const prevSkippedPlayerId = this._lastSkippedPlayerId;
    const prevCurrentPlayer = this._lastCurrentPlayer;
    this.state = state;

    // Check if someone just called UNO
    if (state.unoCalledBy && state.unoCalledBy !== prevUnoCalledBy) {
      const player = state.players?.find(p => p.id === state.unoCalledBy);
      const playerName = state.unoCalledBy === this.playerId ? '你' : (player?.nickname || '玩家');
      this._showUnoNotification(playerName);
    }
    this._lastUnoCalledBy = state.unoCalledBy;

    // Track skip badge state
    const skippedPlayerId = state.lastAction?.skippedPlayerId;
    if (skippedPlayerId && skippedPlayerId !== prevSkippedPlayerId) {
      this._activeSkipBadgePlayerId = skippedPlayerId;
    } else if (this._activeSkipBadgePlayerId && state.currentPlayer !== prevCurrentPlayer) {
      // Next player has acted, clear the skip badge tracking
      this._activeSkipBadgePlayerId = null;
    }
    this._lastSkippedPlayerId = skippedPlayerId;
    this._lastCurrentPlayer = state.currentPlayer;

    // Update player ring
    this._renderPlayerRing();

    // Show skip badge AFTER ring is re-rendered (so the new ring instance has it)
    if (this._activeSkipBadgePlayerId && this.playerRing) {
      this.playerRing.showSkipBadge(this._activeSkipBadgePlayerId, 0);
    }

    // Update turn indicator
    const isMyTurn = state.currentPlayer === this.playerId;
    const turnBadge = this.element.querySelector('.turn-badge');
    if (turnBadge) {
      turnBadge.style.background = isMyTurn ? 'var(--success-500)' : 'var(--neutral-200)';
      turnBadge.style.color = isMyTurn ? 'white' : 'var(--text-secondary)';
      turnBadge.textContent = isMyTurn ? '你的回合' : '等待对手';
    }

    // Update turn number
    const turnNum = this.element.querySelector('.turn-number');
    if (turnNum) {
      turnNum.textContent = `回合 ${state.turnNumber || 1}`;
    }

    // Update sidebar history
    if (this.sidebar) {
      this.sidebar.updateHistory();
    }

    // Update game-specific UI
    if (this.gameUI?.updateState) {
      this.gameUI.updateState(state);
    }
  }

  /**
   * Show prominent UNO notification in center of screen
   * @private
   */
  _showUnoNotification(playerName) {
    // Remove any existing UNO notification
    const existing = document.querySelector('.uno-center-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'uno-center-notification';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      z-index: var(--z-modal);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-2);
      animation: unoPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      pointer-events: none;
    `;

    notification.innerHTML = `
      <div style="
        font-size: 72px;
        font-weight: 900;
        color: white;
        text-shadow:
          0 0 20px var(--uno-red),
          0 0 40px var(--uno-red),
          0 4px 8px rgba(0,0,0,0.5);
        letter-spacing: 4px;
        animation: unoShake 0.5s ease-in-out;
      ">UNO!</div>
      <div style="
        font-size: var(--text-lg);
        color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        background: rgba(0,0,0,0.6);
        padding: var(--spacing-2) var(--spacing-4);
        border-radius: var(--radius-full);
      ">${playerName} 喊出了 UNO!</div>
    `;

    // Add backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'uno-notification-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(0,0,0,0.5) 100%);
      z-index: calc(var(--z-modal) - 1);
      animation: fadeIn 0.2s ease-out forwards;
      pointer-events: none;
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
      notification.style.animation = 'unoPopOut 0.3s ease-in forwards';
      backdrop.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => {
        notification.remove();
        backdrop.remove();
      }, 300);
    }, 1500);
  }

  /**
   * Enable player selection mode
   * For games like Werewolf that need to select targets from the ring
   * @param {Object} config
   * @param {Array<string>} config.selectableIds - IDs that can be selected
   * @param {Array<string>} [config.disabledIds] - IDs that are disabled
   * @param {Function} config.onSelect - Selection callback
   * @param {string} [config.selectedId] - Currently selected player ID (for highlight)
   */
  enablePlayerSelection(config) {
    this._selectionMode = true;
    this._selectablePlayerIds = config.selectableIds || [];
    this._disabledPlayerIds = config.disabledIds || [];
    this._selectionCallback = config.onSelect;
    this._selectedPlayerId = config.selectedId || null;

    if (this.playerRing) {
      this.playerRing.enableSelection({
        selectableIds: this._selectablePlayerIds,
        disabledIds: this._disabledPlayerIds,
        onSelect: this._selectionCallback,
        selectedId: this._selectedPlayerId
      });
    }
  }

  /**
   * Disable player selection mode
   */
  disablePlayerSelection() {
    this._selectionMode = false;
    this._selectablePlayerIds = [];
    this._disabledPlayerIds = [];
    this._selectionCallback = null;

    if (this.playerRing) {
      this.playerRing.disableSelection();
    }
  }

  /**
   * Get center content element from player ring
   * For games to mount their center UI (table, cards, etc.)
   * @returns {HTMLElement|null}
   */
  getRingCenterElement() {
    return this.playerRing?.getCenterElement() || null;
  }

  /**
   * Set game-specific UI
   * @param {Object} gameUI - Game UI component with render/updateState methods
   */
  setGameUI(gameUI) {
    this.gameUI = gameUI;

    // Pass gameBoard reference to gameUI if it supports it (for selection mode)
    if (gameUI.setGameBoard) {
      gameUI.setGameBoard(this);
    }

    const gameUIContainer = this.element.querySelector('.game-ui-container');
    const actionBar = this.element.querySelector('.action-bar');

    if (gameUIContainer && gameUI.render) {
      // Clear game UI container
      gameUIContainer.innerHTML = '';

      // Render game UI content
      const uiElement = gameUI.render(this.state, this.playerId, (action) => {
        this.options.onAction?.(action);
      });

      if (uiElement) {
        gameUIContainer.appendChild(uiElement);
      }
    }

    if (actionBar && gameUI.renderActions) {
      actionBar.innerHTML = '';
      const actionsElement = gameUI.renderActions(this.state, this.playerId, (action) => {
        this.options.onAction?.(action);
      });
      if (actionsElement) {
        actionBar.appendChild(actionsElement);
      }
    }
  }

  /**
   * Get game content container
   * @returns {HTMLElement|null}
   */
  getContentContainer() {
    return this.element.querySelector('.game-content');
  }

  /**
   * Get action bar container
   * @returns {HTMLElement|null}
   */
  getActionBar() {
    return this.element.querySelector('.action-bar');
  }

  /**
   * Mount to container
   * @param {HTMLElement} container
   */
  mount(container) {
    container.appendChild(this.element);
  }

  /**
   * Unmount
   */
  unmount() {
    if (this.playerRing) {
      this.playerRing.destroy();
      this.playerRing = null;
    }
    if (this.sidebar) {
      this.sidebar.destroy();
      this.sidebar = null;
    }
    if (this.phaseTimer) {
      this.phaseTimer.destroy();
      this.phaseTimer = null;
    }
    this.element?.remove();
  }

  /**
   * Start the phase timer
   * @param {number} seconds - Duration in seconds
   * @param {string} [label] - Phase label to display (e.g., "讨论时间", "投票时间")
   */
  startTimer(seconds, label = '') {
    if (this.phaseTimer && seconds > 0) {
      this.phaseTimer.start(seconds, label);
    }
  }

  /**
   * Stop the phase timer
   */
  stopTimer() {
    if (this.phaseTimer) {
      this.phaseTimer.stop();
    }
  }

  /**
   * Pause the phase timer
   */
  pauseTimer() {
    if (this.phaseTimer) {
      this.phaseTimer.pause();
    }
  }

  /**
   * Resume the phase timer
   */
  resumeTimer() {
    if (this.phaseTimer) {
      this.phaseTimer.resume();
    }
  }

  /**
   * Check if timer is running
   * @returns {boolean}
   */
  isTimerRunning() {
    return this.phaseTimer?.isRunning() || false;
  }

  /**
   * Get remaining timer seconds
   * @returns {number}
   */
  getTimerRemaining() {
    return this.phaseTimer?.getRemainingSeconds() || 0;
  }

  /**
   * Add a chat message
   * @param {Object} msg - Chat message with playerId, nickname, message
   */
  addChatMessage(msg) {
    if (this.sidebar) {
      this.sidebar.addChatMessage(msg);
    }
  }

  /**
   * Add a system message to chat
   * @param {string} message
   */
  addSystemMessage(message) {
    if (this.sidebar) {
      this.sidebar.addSystemMessage(message);
    }
  }

  /**
   * Get element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}

export default GameBoard;
