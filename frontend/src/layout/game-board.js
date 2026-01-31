/**
 * Game Board Container Component
 * @module layout/game-board
 */

import { PlayerAvatar } from '../components/player-avatar.js';
import { GameSettingsPanel } from '../components/game-settings-panel.js';
import { RoleSetupPanel } from '../components/role-setup-panel.js';
import { getCardDisplayText, getColorName, CARD_TYPES } from '../games/uno/rules.js';

/**
 * Game Board - Generic container for game rendering
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
    this.avatars = new Map();
    this._lastUnoCalledBy = null; // Track UNO call changes
    this.chatMessages = [];
    this.activeTab = 'history'; // 'history', 'chat', or 'settings'
    this.settingsPanel = null;
    this.roleSetupPanel = null;

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
    const players = state?.players || [];
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
            <span style="
              padding: var(--spacing-1) var(--spacing-3);
              background: ${isMyTurn ? 'var(--success-500)' : 'var(--neutral-200)'};
              color: ${isMyTurn ? 'white' : 'var(--text-secondary)'};
              border-radius: var(--radius-full);
              font-size: var(--text-sm);
            ">
              ${isMyTurn ? '你的回合' : '等待对手'}
            </span>
            <span style="color: var(--text-tertiary); font-size: var(--text-sm);">
              回合 ${state.turnNumber || 1}
            </span>
          ` : ''}
        </div>
        <div style="display: flex; gap: var(--spacing-2);">
          <button class="btn btn-ghost btn-sm rules-btn" title="查看规则">📖 规则</button>
          <button class="btn btn-secondary btn-sm leave-btn">退出游戏</button>
        </div>
      </header>

      <div class="game-main" style="
        flex: 1;
        display: flex;
        overflow: hidden;
      ">
        <aside class="players-sidebar" style="
          width: 180px;
          background: var(--bg-primary);
          border-right: 1px solid var(--border-light);
          padding: var(--spacing-4);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
          overflow-y: auto;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: var(--text-sm); color: var(--text-secondary);">玩家</h4>
            <span class="direction-indicator" style="
              font-size: var(--text-xs);
              color: var(--text-tertiary);
              display: flex;
              align-items: center;
              gap: 2px;
            "></span>
          </div>
          <div class="players-list" style="display: flex; flex-direction: column; gap: var(--spacing-3);"></div>
        </aside>

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
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: auto;
          ">
            <!-- Game-specific UI will be mounted here -->
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

        <aside class="right-sidebar" style="
          width: 240px;
          background: var(--bg-primary);
          border-left: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <div class="sidebar-tabs" style="
            display: flex;
            border-bottom: 1px solid var(--border-light);
            flex-shrink: 0;
          ">
            <button class="sidebar-tab ${this.activeTab === 'history' ? 'active' : ''}" data-tab="history" style="
              flex: 1;
              padding: var(--spacing-3);
              border: none;
              background: ${this.activeTab === 'history' ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
              color: ${this.activeTab === 'history' ? 'var(--primary-500)' : 'var(--text-secondary)'};
              font-size: var(--text-sm);
              font-weight: var(--font-medium);
              cursor: pointer;
              border-bottom: 2px solid ${this.activeTab === 'history' ? 'var(--primary-500)' : 'transparent'};
              transition: all 0.2s;
            ">历史</button>
            <button class="sidebar-tab ${this.activeTab === 'chat' ? 'active' : ''}" data-tab="chat" style="
              flex: 1;
              padding: var(--spacing-3);
              border: none;
              background: ${this.activeTab === 'chat' ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
              color: ${this.activeTab === 'chat' ? 'var(--primary-500)' : 'var(--text-secondary)'};
              font-size: var(--text-sm);
              font-weight: var(--font-medium);
              cursor: pointer;
              border-bottom: 2px solid ${this.activeTab === 'chat' ? 'var(--primary-500)' : 'transparent'};
              transition: all 0.2s;
            ">聊天</button>
            <button class="sidebar-tab ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings" style="
              flex: 1;
              padding: var(--spacing-3);
              border: none;
              background: ${this.activeTab === 'settings' ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
              color: ${this.activeTab === 'settings' ? 'var(--primary-500)' : 'var(--text-secondary)'};
              font-size: var(--text-sm);
              font-weight: var(--font-medium);
              cursor: pointer;
              border-bottom: 2px solid ${this.activeTab === 'settings' ? 'var(--primary-500)' : 'transparent'};
              transition: all 0.2s;
            ">设置</button>
          </div>

          <div class="tab-content history-panel" style="
            flex: 1;
            display: ${this.activeTab === 'history' ? 'flex' : 'none'};
            flex-direction: column;
            overflow: hidden;
            padding: var(--spacing-3);
          ">
            <div class="history-list" style="
              flex: 1;
              overflow-y: auto;
              overflow-x: hidden;
              font-size: var(--text-sm);
              color: var(--text-secondary);
              min-height: 0;
            ">
              ${this._renderHistory()}
            </div>
          </div>

          <div class="tab-content chat-panel" style="
            flex: 1;
            display: ${this.activeTab === 'chat' ? 'flex' : 'none'};
            flex-direction: column;
            overflow: hidden;
          ">
            <div class="chat-messages" style="
              flex: 1;
              overflow-y: auto;
              padding: var(--spacing-3);
              display: flex;
              flex-direction: column;
              gap: var(--spacing-2);
              min-height: 0;
            ">
              ${this._renderChatMessages()}
            </div>
            <div class="chat-input-area" style="
              padding: var(--spacing-3);
              border-top: 1px solid var(--border-light);
              display: flex;
              gap: var(--spacing-2);
              flex-shrink: 0;
            ">
              <input type="text" class="input chat-input" placeholder="发送消息..." style="flex: 1; font-size: var(--text-sm);">
              <button class="btn btn-primary btn-sm send-chat-btn">发送</button>
            </div>
          </div>

          <div class="tab-content settings-panel" style="
            flex: 1;
            display: ${this.activeTab === 'settings' ? 'flex' : 'none'};
            flex-direction: column;
            overflow: hidden;
            padding: var(--spacing-3);
          ">
            <div class="settings-container" style="
              flex: 1;
              overflow-y: auto;
              min-height: 0;
            ">
              <!-- Settings panel will be mounted here -->
            </div>
          </div>
        </aside>
      </div>
    `;

    this._renderPlayers(players, state?.currentPlayer);
    this._renderSettingsPanel();
    this._bindEvents();
  }

  /**
   * Render players list in turn order
   * @private
   */
  _renderPlayers(players, currentPlayerId) {
    const container = this.element.querySelector('.players-list');
    if (!container) return;

    container.innerHTML = '';
    this.avatars.forEach(a => a.destroy());
    this.avatars.clear();

    const state = this.state || this.game?.getState();
    const direction = state?.direction ?? 1;
    const currentIndex = state?.currentPlayerIndex ?? 0;

    // Sort players in turn order starting from current player
    const orderedPlayers = this._getPlayersInTurnOrder(players, currentIndex, direction);

    // Update direction indicator
    this._updateDirectionIndicator(direction);

    const unoCalledBy = state?.unoCalledBy;

    orderedPlayers.forEach((player, index) => {
      const displayPlayer = player.id === this.playerId
        ? { ...player, nickname: `${player.nickname}（我）` }
        : player;
      const avatar = new PlayerAvatar(displayPlayer);
      avatar.setCurrentTurn(player.id === currentPlayerId);

      // Add turn order number
      const element = avatar.getElement();
      const orderBadge = document.createElement('span');
      orderBadge.style.cssText = `
        position: absolute;
        top: -4px;
        right: -4px;
        width: 16px;
        height: 16px;
        background: ${index === 0 ? 'var(--primary-500)' : 'var(--neutral-300)'};
        color: ${index === 0 ? 'white' : 'var(--text-secondary)'};
        border-radius: 50%;
        font-size: 10px;
        font-weight: var(--font-bold);
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      orderBadge.textContent = String(index + 1);
      element.style.position = 'relative';
      element.appendChild(orderBadge);

      // Add UNO badge if player called UNO
      if (player.id === unoCalledBy) {
        const unoBadge = document.createElement('span');
        unoBadge.className = 'uno-badge';
        unoBadge.style.cssText = `
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 6px;
          background: linear-gradient(135deg, var(--uno-red) 0%, var(--error-600) 100%);
          color: white;
          border-radius: var(--radius-sm);
          font-size: 9px;
          font-weight: var(--font-bold);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          animation: unoPulse 1s ease-in-out infinite;
        `;
        unoBadge.textContent = 'UNO!';
        element.appendChild(unoBadge);
      }

      this.avatars.set(player.id, avatar);
      container.appendChild(element);
    });
  }

  /**
   * Get players ordered by turn sequence
   * @private
   */
  _getPlayersInTurnOrder(players, currentIndex, direction) {
    if (!players || players.length === 0) return [];

    const count = players.length;
    const ordered = [];

    for (let i = 0; i < count; i++) {
      const index = ((currentIndex + i * direction) % count + count) % count;
      ordered.push(players[index]);
    }

    return ordered;
  }

  /**
   * Update direction indicator
   * @private
   */
  _updateDirectionIndicator(direction) {
    const indicator = this.element.querySelector('.direction-indicator');
    if (!indicator) return;

    const isClockwise = direction === 1;
    indicator.innerHTML = `
      <span style="font-size: 14px;">${isClockwise ? '↓' : '↑'}</span>
      <span>${isClockwise ? '顺时针' : '逆时针'}</span>
    `;
    indicator.title = isClockwise ? '行动顺序：从上到下' : '行动顺序：从下到上';
  }

  /**
   * Render history
   * @private
   */
  _renderHistory() {
    const history = this.game?.getHistory() || [];

    if (history.length === 0) {
      return '<p style="color: var(--text-tertiary);">暂无历史记录</p>';
    }

    return history.slice(-50).reverse().map(entry => {
      const playerName = this._getPlayerName(entry.playerId);
      return `
        <div style="
          padding: var(--spacing-2);
          border-bottom: 1px solid var(--border-light);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <span style="font-weight: var(--font-medium); color: var(--text-primary); font-size: var(--text-xs);">
              ${playerName}
            </span>
            <span style="color: var(--text-tertiary); font-size: 10px;">
              ${new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          ${this._renderHistoryAction(entry)}
        </div>
      `;
    }).join('');
  }

  /**
   * Get player name by ID
   * @private
   */
  _getPlayerName(playerId) {
    if (playerId === this.playerId) return '你';
    const state = this.state || this.game?.getState();
    const player = state?.players?.find(p => p.id === playerId);
    return player?.nickname || playerId.substring(0, 8);
  }

  /**
   * Render chat messages
   * @private
   */
  _renderChatMessages() {
    if (this.chatMessages.length === 0) {
      return '<p style="color: var(--text-tertiary); text-align: center; font-size: var(--text-sm);">暂无消息</p>';
    }

    return this.chatMessages.map(msg => this._renderChatMessage(msg)).join('');
  }

  /**
   * Render a single chat message
   * @private
   */
  _renderChatMessage(msg) {
    const isSystem = msg.playerId === 'system';
    const isSelf = msg.playerId === this.playerId;

    if (isSystem) {
      return `
        <div style="text-align: center; color: var(--text-tertiary); font-size: var(--text-xs);">
          ${this._escapeHtml(msg.message)}
        </div>
      `;
    }

    return `
      <div style="${isSelf ? 'text-align: right;' : ''}">
        <span style="font-size: var(--text-xs); color: var(--text-secondary);">
          ${msg.nickname || this._getPlayerName(msg.playerId)}
        </span>
        <div style="
          display: inline-block;
          padding: var(--spacing-2) var(--spacing-3);
          background: ${isSelf ? 'var(--primary-500)' : 'var(--bg-tertiary)'};
          color: ${isSelf ? 'white' : 'var(--text-primary)'};
          border-radius: var(--radius-base);
          max-width: 180px;
          word-break: break-word;
          font-size: var(--text-sm);
        ">${this._escapeHtml(msg.message)}</div>
      </div>
    `;
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

  /**
   * Scroll chat to bottom
   * @private
   */
  _scrollChatToBottom() {
    const container = this.element.querySelector('.chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Render settings panel
   * @private
   */
  _renderSettingsPanel() {
    const container = this.element.querySelector('.settings-container');
    if (!container) return;

    // Clean up old panels
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = null;
    }
    if (this.roleSetupPanel) {
      this.roleSetupPanel.destroy();
      this.roleSetupPanel = null;
    }

    // Mount role setup panel if applicable
    if (this.gameConfig.defaultRoleCounts && this.gameSettings.roleCounts) {
      const roleHeader = document.createElement('h4');
      roleHeader.style.cssText = 'margin: 0 0 var(--spacing-2) 0; font-size: var(--text-sm); color: var(--text-secondary);';
      roleHeader.textContent = '角色配置';
      container.appendChild(roleHeader);

      this.roleSetupPanel = new RoleSetupPanel({
        roles: this.gameConfig.roles,
        defaultRoleCounts: this.gameConfig.defaultRoleCounts,
        roleCounts: this.gameSettings.roleCounts,
        minPlayers: this.gameConfig.minPlayers || 2,
        maxPlayers: this.gameConfig.maxPlayers || 20,
        editable: false,
        compact: true
      });
      container.appendChild(this.roleSetupPanel.getElement());

      // Add separator
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top: 1px solid var(--border-light); margin: var(--spacing-3) 0;';
      container.appendChild(sep);
    }

    // Mount game settings panel
    this.settingsPanel = new GameSettingsPanel({
      gameConfig: this.gameConfig,
      settings: this.gameSettings,
      editable: false, // Always read-only in game
      compact: true
    });

    container.appendChild(this.settingsPanel.getElement());
  }

  /**
   * Render a history action with details
   * @private
   */
  _renderHistoryAction(entry) {
    const { actionType, actionData } = entry;

    switch (actionType) {
      case 'PLAY_CARD': {
        const card = actionData?.card || this._findCardById(actionData?.cardId);
        if (card) {
          const skippedName = actionData?.skippedPlayerId
            ? this._getPlayerName(actionData.skippedPlayerId)
            : null;
          return `
            <div style="display: flex; align-items: center; gap: var(--spacing-2);">
              <span>出牌</span>
              ${this._renderMiniCard(card)}
              ${actionData?.chosenColor ? `
                <span style="font-size: var(--text-xs);">→ ${getColorName(actionData.chosenColor)}</span>
              ` : ''}
            </div>
            ${skippedName ? `
              <div style="color: var(--warning-600); font-size: var(--text-xs); margin-top: 2px;">
                跳过 ${skippedName}
              </div>
            ` : ''}
          `;
        }
        return '<div>出牌</div>';
      }

      case 'DRAW_CARD': {
        const count = actionData?.count || 1;
        return `<div style="color: var(--warning-600);">摸了 ${count} 张牌</div>`;
      }

      case 'SKIP_TURN':
        return '<div style="color: var(--text-tertiary);">跳过回合</div>';

      case 'CALL_UNO':
        return '<div style="color: var(--error-500); font-weight: var(--font-bold);">UNO!</div>';

      case 'NIGHT_WOLF_KILL':
      case 'NIGHT_SEER_CHECK':
      case 'NIGHT_DOCTOR_PROTECT':
      case 'NIGHT_WITCH_SAVE':
      case 'NIGHT_WITCH_POISON':
      case 'NIGHT_SKIP':
        return '<div style="color: var(--text-tertiary);">提交了夜间行动</div>';

      case 'DAY_VOTE': {
        const target = actionData?.targetId
          ? this._getPlayerName(actionData.targetId) : '弃票';
        return `<div>投票: ${target}</div>`;
      }

      case 'DAY_SKIP_VOTE':
        return '<div style="color: var(--text-tertiary);">弃票</div>';

      case 'PHASE_ADVANCE':
        return '<div style="color: var(--text-tertiary);">确认继续</div>';

      case 'SPEECH_DONE':
        return '<div>发言结束</div>';

      case 'LAST_WORDS':
        return '<div>发表了遗言</div>';

      default:
        return `<div>${actionType}</div>`;
    }
  }

  /**
   * Find card by ID from game state
   * @private
   */
  _findCardById(cardId) {
    if (!cardId) return null;
    const state = this.game?.getState();
    if (!state) return null;

    // Check discard pile
    const discardCard = state.discardPile?.find(c => c.id === cardId);
    if (discardCard) return discardCard;

    // Check all hands
    for (const hand of Object.values(state.hands || {})) {
      const card = hand.find(c => c.id === cardId);
      if (card) return card;
    }

    return null;
  }

  /**
   * Render a mini card for history
   * @private
   */
  _renderMiniCard(card) {
    const colorMap = {
      red: 'var(--uno-red)',
      blue: 'var(--uno-blue)',
      green: 'var(--uno-green)',
      yellow: 'var(--uno-yellow)',
      null: 'var(--uno-black)'
    };

    const bgColor = colorMap[card.color] || colorMap[null];
    const isWild = card.color === null;
    const displayText = getCardDisplayText(card);

    return `
      <span style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 20px;
        padding: 0 4px;
        background: ${isWild ? 'linear-gradient(135deg, var(--uno-red) 25%, var(--uno-blue) 25%, var(--uno-blue) 50%, var(--uno-green) 50%, var(--uno-green) 75%, var(--uno-yellow) 75%)' : bgColor};
        color: white;
        border-radius: 3px;
        font-size: 11px;
        font-weight: var(--font-bold);
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      ">${displayText}</span>
    `;
  }

  /**
   * Bind events
   * @private
   */
  _bindEvents() {
    this.element.querySelector('.leave-btn')?.addEventListener('click', () => {
      this.options.onLeave?.();
    });

    this.element.querySelector('.rules-btn')?.addEventListener('click', () => {
      const gameId = this.gameConfig?.id || this.game?.config?.id || 'uno';
      window.open(`/rules/${gameId}.html`, '_blank', 'width=900,height=700');
    });

    // Tab switching
    this.element.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        if (tabName && tabName !== this.activeTab) {
          this.activeTab = tabName;
          this._updateTabs();
        }
      });
    });

    // Chat input
    const chatInput = this.element.querySelector('.chat-input');
    const sendBtn = this.element.querySelector('.send-chat-btn');

    const sendMessage = () => {
      const message = chatInput?.value.trim();
      if (message) {
        this.options.onSendChat?.(message);
        chatInput.value = '';
      }
    };

    sendBtn?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  /**
   * Update tab UI without full re-render
   * @private
   */
  _updateTabs() {
    // Update tab buttons
    this.element.querySelectorAll('.sidebar-tab').forEach(tab => {
      const isActive = tab.dataset.tab === this.activeTab;
      tab.style.background = isActive ? 'var(--bg-primary)' : 'var(--bg-secondary)';
      tab.style.color = isActive ? 'var(--primary-500)' : 'var(--text-secondary)';
      tab.style.borderBottom = `2px solid ${isActive ? 'var(--primary-500)' : 'transparent'}`;
    });

    // Show/hide panels
    const historyPanel = this.element.querySelector('.history-panel');
    const chatPanel = this.element.querySelector('.chat-panel');
    const settingsPanel = this.element.querySelector('.settings-panel');
    if (historyPanel) historyPanel.style.display = this.activeTab === 'history' ? 'flex' : 'none';
    if (chatPanel) chatPanel.style.display = this.activeTab === 'chat' ? 'flex' : 'none';
    if (settingsPanel) settingsPanel.style.display = this.activeTab === 'settings' ? 'flex' : 'none';

    // Scroll chat to bottom when switching to chat tab
    if (this.activeTab === 'chat') {
      this._scrollChatToBottom();
    }
  }

  /**
   * Update game state
   * @param {Object} state - New game state
   */
  updateState(state) {
    const prevUnoCalledBy = this._lastUnoCalledBy;
    this.state = state;

    // Check if someone just called UNO
    if (state.unoCalledBy && state.unoCalledBy !== prevUnoCalledBy) {
      const player = state.players?.find(p => p.id === state.unoCalledBy);
      const playerName = state.unoCalledBy === this.playerId ? '你' : (player?.nickname || '玩家');
      this._showUnoNotification(playerName);
    }
    this._lastUnoCalledBy = state.unoCalledBy;

    // Update players
    this._renderPlayers(state.players || [], state.currentPlayer);

    // Update turn indicator
    const isMyTurn = state.currentPlayer === this.playerId;
    const turnBadge = this.element.querySelector('.game-header span');
    if (turnBadge) {
      turnBadge.style.background = isMyTurn ? 'var(--success-500)' : 'var(--neutral-200)';
      turnBadge.style.color = isMyTurn ? 'white' : 'var(--text-secondary)';
      turnBadge.textContent = isMyTurn ? '你的回合' : '等待对手';
    }

    // Update turn number
    const turnNum = this.element.querySelector('.game-header span:last-of-type');
    if (turnNum) {
      turnNum.textContent = `回合 ${state.turnNumber || 1}`;
    }

    // Update history
    const historyEl = this.element.querySelector('.history-list');
    if (historyEl) {
      historyEl.innerHTML = this._renderHistory();
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
   * Set game-specific UI
   * @param {Object} gameUI - Game UI component with render/updateState methods
   */
  setGameUI(gameUI) {
    this.gameUI = gameUI;

    const content = this.element.querySelector('.game-content');
    const actionBar = this.element.querySelector('.action-bar');

    if (content && gameUI.render) {
      content.innerHTML = '';
      const uiElement = gameUI.render(this.state, this.playerId, (action) => {
        this.options.onAction?.(action);
      });
      if (uiElement) {
        content.appendChild(uiElement);
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
    this.avatars.forEach(a => a.destroy());
    this.avatars.clear();
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = null;
    }
    if (this.roleSetupPanel) {
      this.roleSetupPanel.destroy();
      this.roleSetupPanel = null;
    }
    this.element?.remove();
  }

  /**
   * Add a chat message
   * @param {Object} msg - Chat message with playerId, nickname, message
   */
  addChatMessage(msg) {
    this.chatMessages.push(msg);

    const container = this.element.querySelector('.chat-messages');
    if (container) {
      // Remove "no messages" placeholder if exists
      if (this.chatMessages.length === 1) {
        container.innerHTML = '';
      }
      container.insertAdjacentHTML('beforeend', this._renderChatMessage(msg));
      this._scrollChatToBottom();
    }
  }

  /**
   * Add a system message to chat
   * @param {string} message
   */
  addSystemMessage(message) {
    this.addChatMessage({
      playerId: 'system',
      message,
      timestamp: Date.now()
    });
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
