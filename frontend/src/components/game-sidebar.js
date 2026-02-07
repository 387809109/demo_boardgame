/**
 * Game Sidebar Component - History, Chat, Settings tabs
 * @module components/game-sidebar
 */

import { GameSettingsPanel } from './game-settings-panel.js';
import { RoleSetupPanel } from './role-setup-panel.js';
import { getCardDisplayText, getColorName } from '../games/uno/rules.js';

/**
 * Game Sidebar with tabbed panels
 */
export class GameSidebar {
  /**
   * @param {Object} options
   * @param {string} options.playerId - Current player ID
   * @param {Object} options.gameConfig - Game configuration
   * @param {Object} options.gameSettings - Current game settings
   * @param {Function} options.getHistory - Function to get game history
   * @param {Function} options.getState - Function to get current game state
   * @param {Function} options.onSendChat - Called when sending chat message
   */
  constructor(options = {}) {
    this.options = options;
    this.playerId = options.playerId || '';
    this.gameConfig = options.gameConfig || {};
    this.gameSettings = options.gameSettings || {};
    this.element = null;
    this.chatMessages = [];
    this.activeTab = 'history';
    this.settingsPanel = null;
    this.roleSetupPanel = null;

    this._create();
  }

  /**
   * Create the sidebar DOM
   * @private
   */
  _create() {
    this.element = document.createElement('aside');
    this.element.className = 'game-sidebar right-sidebar';
    this.element.style.cssText = `
      width: 240px;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-light);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    this._render();
  }

  /**
   * Render the sidebar
   * @private
   */
  _render() {
    this.element.innerHTML = `
      <div class="sidebar-tabs" style="
        display: flex;
        border-bottom: 1px solid var(--border-light);
        flex-shrink: 0;
      ">
        ${this._renderTab('history', '历史')}
        ${this._renderTab('chat', '聊天')}
        ${this._renderTab('settings', '设置')}
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
    `;

    this._renderSettingsPanel();
    this._bindEvents();
  }

  /**
   * Render a tab button
   * @private
   */
  _renderTab(name, label) {
    const isActive = this.activeTab === name;
    return `
      <button class="sidebar-tab ${isActive ? 'active' : ''}" data-tab="${name}" style="
        flex: 1;
        padding: var(--spacing-3);
        border: none;
        background: ${isActive ? 'var(--bg-primary)' : 'var(--bg-secondary)'};
        color: ${isActive ? 'var(--primary-500)' : 'var(--text-secondary)'};
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        border-bottom: 2px solid ${isActive ? 'var(--primary-500)' : 'transparent'};
        transition: all 0.2s;
      ">${label}</button>
    `;
  }

  /**
   * Render history
   * @private
   */
  _renderHistory() {
    const history = this.options.getHistory?.() || [];

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
    const state = this.options.getState?.();
    const player = state?.players?.find(p => p.id === playerId);
    return player?.nickname || playerId.substring(0, 8);
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
    const state = this.options.getState?.();
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
      editable: false,
      compact: true
    });

    container.appendChild(this.settingsPanel.getElement());
  }

  /**
   * Bind events
   * @private
   */
  _bindEvents() {
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
   * Update history display
   */
  updateHistory() {
    const historyEl = this.element.querySelector('.history-list');
    if (historyEl) {
      historyEl.innerHTML = this._renderHistory();
    }
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
   * Get the element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = null;
    }
    if (this.roleSetupPanel) {
      this.roleSetupPanel.destroy();
      this.roleSetupPanel = null;
    }
    this.element?.remove();
    this.element = null;
  }
}

export default GameSidebar;
