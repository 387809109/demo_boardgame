/**
 * Waiting Room Component
 * @module layout/waiting-room
 */

import { PlayerAvatar } from '../components/player-avatar.js';
import { GameSettingsPanel } from '../components/game-settings-panel.js';
import { RoleSetupPanel } from '../components/role-setup-panel.js';
import { showQueryPanel } from '../components/query-panel.js';

/**
 * Waiting Room - Pre-game lobby for multiplayer
 */
export class WaitingRoom {
  /**
   * @param {Object} options
   * @param {Object} options.room - Room info
   * @param {string} options.room.id - Room ID
   * @param {string} options.room.gameType - Game type
   * @param {Array} options.room.players - Player list
   * @param {number} options.room.maxPlayers - Max players allowed
   * @param {Array} options.room.aiPlayers - AI players list
   * @param {boolean} options.room.supportsAI - Whether game supports AI players
   * @param {Object} options.room.gameConfig - Game configuration with settingsSchema
   * @param {Object} options.room.gameSettings - Current game settings
   * @param {string} options.playerId - Current player ID
   * @param {Function} options.onStartGame - Called when starting game
   * @param {Function} options.onLeave - Called when leaving room
   * @param {Function} options.onSendChat - Called when sending chat
   * @param {Function} options.onAddAI - Called when adding AI player
   * @param {Function} options.onRemoveAI - Called when removing AI player
   * @param {Function} options.onSettingsChange - Called when settings change (host only)
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.room = options.room || { id: '', gameType: '', players: [], maxPlayers: 4, aiPlayers: [] };
    this.playerId = options.playerId || '';
    this.chatMessages = [];
    this.avatars = new Map();
    this.settingsPanel = null;
    this.roleSetupPanel = null;
    this.collapsedSections = {
      roleSetup: false,
      gameSettings: false
    };

    this._create();
  }

  /**
   * Create the waiting room DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'waiting-room';
    this.element.style.cssText = `
      min-height: 100vh;
      background: var(--bg-secondary);
      display: flex;
      flex-direction: column;
    `;

    this._render();
  }

  /**
   * Check if current player is host
   * @returns {boolean}
   */
  isHost() {
    return this.room.players.find(p => p.id === this.playerId)?.isHost || false;
  }

  /**
   * Get total player count (human + AI)
   * @returns {number}
   */
  getTotalPlayerCount() {
    return this.room.players.length + (this.room.aiPlayers?.length || 0);
  }

  /**
   * Render the room
   * @private
   */
  _render() {
    const isHost = this.isHost();
    const totalPlayers = this.getTotalPlayerCount();
    const maxPlayers = this.room.maxPlayers || 10;
    const supportsAI = this.room.supportsAI !== false;
    const canAddAI = isHost && supportsAI && totalPlayers < maxPlayers;
    const canRemoveAI = isHost && supportsAI && (this.room.aiPlayers?.length || 0) > 0;

    this.element.innerHTML = `
      <header style="
        background: var(--gradient-primary);
        color: white;
        padding: var(--spacing-4) var(--spacing-6);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>
          <h2 style="margin: 0; font-size: var(--text-xl);">等待大厅</h2>
          <p style="margin: var(--spacing-1) 0 0 0; opacity: 0.9; font-size: var(--text-sm);">
            房间 ID: ${this.room.id} | 游戏: ${this.room.gameType} | 目标人数: ${maxPlayers}
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: var(--spacing-3);">
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: var(--spacing-1);">
            ${isHost ? `
              <button class="btn btn-primary start-game-btn" ${totalPlayers !== maxPlayers ? 'disabled' : ''}>
                开始游戏
              </button>
              <p class="start-game-hint" style="
                margin: 0;
                font-size: var(--text-xs);
                opacity: 0.9;
                color: rgba(255, 255, 255, 0.95);
                ${totalPlayers === maxPlayers ? 'display: none;' : ''}
              ">
                需要 ${maxPlayers} 名玩家才能开始（当前 ${totalPlayers} 人）
              </p>
            ` : `
              <p class="start-game-hint" style="
                margin: 0;
                font-size: var(--text-sm);
                opacity: 0.95;
                color: rgba(255, 255, 255, 0.95);
              ">
                等待房主开始游戏...
              </p>
            `}
          </div>
          <button class="btn btn-secondary query-btn" title="游戏查询">🔍</button>
          <button class="btn btn-secondary leave-btn">离开房间</button>
        </div>
      </header>

      <div style="
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: var(--spacing-4);
        padding: var(--spacing-4);
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
      ">
        <div class="room-main">
          <div class="card" style="margin-bottom: var(--spacing-4);">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0;">玩家列表 (${totalPlayers}/${maxPlayers})</h3>
              ${isHost && supportsAI ? `
                <div style="display: flex; gap: var(--spacing-2);">
                  <button class="btn btn-secondary btn-sm add-ai-btn" ${!canAddAI ? 'disabled' : ''} title="添加 AI 玩家">
                    ➕ AI
                  </button>
                  <button class="btn btn-secondary btn-sm remove-ai-btn" ${!canRemoveAI ? 'disabled' : ''} title="移除 AI 玩家">
                    ➖ AI
                  </button>
                </div>
              ` : ''}
              ${isHost && !supportsAI ? `
                <span style="font-size: var(--text-xs); color: var(--text-tertiary);" title="此游戏暂不支持 AI">
                  🤖 ❌
                </span>
              ` : ''}
            </div>
            <div class="card-body players-grid" style="
              display: flex;
              flex-wrap: wrap;
              gap: var(--spacing-4);
              justify-content: center;
              min-height: 120px;
            ">
            </div>
          </div>

          ${this.room.gameConfig?.defaultRoleCounts ? `
            <div class="card" style="margin-bottom: var(--spacing-4);">
              <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">角色配置</h3>
                <div style="display: flex; align-items: center; gap: var(--spacing-3);">
                  ${!isHost ? `
                    <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
                      仅房主可修改
                    </span>
                  ` : ''}
                  <button class="btn btn-secondary btn-sm toggle-role-setup-btn" type="button">
                    ${this.collapsedSections.roleSetup ? '展开' : '收起'}
                  </button>
                </div>
              </div>
              <div class="card-body role-setup-container" style="${this.collapsedSections.roleSetup ? 'display: none;' : ''}">
                <!-- Role setup panel will be mounted here -->
              </div>
            </div>
          ` : ''}

          <div class="card" style="margin-bottom: var(--spacing-4);">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0;">游戏设置</h3>
              <div style="display: flex; align-items: center; gap: var(--spacing-3);">
                ${!isHost ? `
                  <span style="font-size: var(--text-xs); color: var(--text-tertiary);">
                    仅房主可修改
                  </span>
                ` : ''}
                <button class="btn btn-secondary btn-sm toggle-game-settings-btn" type="button">
                  ${this.collapsedSections.gameSettings ? '展开' : '收起'}
                </button>
              </div>
            </div>
            <div class="card-body settings-container" style="${this.collapsedSections.gameSettings ? 'display: none;' : ''}">
              <!-- Settings panel will be mounted here -->
            </div>
          </div>
        </div>

        <div class="chat-panel card" style="display: flex; flex-direction: column; height: 400px;">
          <div class="card-header">
            <h3 style="margin: 0;">聊天</h3>
          </div>
          <div class="chat-messages" style="
            flex: 1;
            overflow-y: auto;
            padding: var(--spacing-3);
            display: flex;
            flex-direction: column;
            gap: var(--spacing-2);
          ">
            ${this.chatMessages.map(msg => this._renderChatMessage(msg)).join('')}
          </div>
          <div style="padding: var(--spacing-3); border-top: 1px solid var(--border-light); display: flex; gap: var(--spacing-2);">
            <input type="text" class="input chat-input" placeholder="发送消息..." style="flex: 1;">
            <button class="btn btn-primary btn-sm send-chat-btn">发送</button>
          </div>
        </div>
      </div>
    `;

    this._renderPlayers();
    this._renderSettings();
    this._renderRoleSetup();
    this._bindEvents();
    this._scrollChatToBottom();
  }

  /**
   * Render game settings panel
   * @private
   */
  _renderSettings() {
    const container = this.element.querySelector('.settings-container');
    if (!container) return;

    // Clean up old panel
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = null;
    }

    const gameConfig = this.room.gameConfig;
    const gameSettings = this.room.gameSettings || {};
    const isHost = this.isHost();

    this.settingsPanel = new GameSettingsPanel({
      gameConfig,
      settings: gameSettings,
      editable: isHost,
      compact: true,
      onChange: (key, value, allSettings) => {
        // Update local room settings
        this.room.gameSettings = allSettings;
        // Notify parent
        this.options.onSettingsChange?.(allSettings);
      }
    });

    container.appendChild(this.settingsPanel.getElement());
  }

  /**
   * Render role setup panel
   * @private
   */
  _renderRoleSetup() {
    const gameConfig = this.room.gameConfig;
    if (!gameConfig?.defaultRoleCounts) return;

    const container = this.element.querySelector('.role-setup-container');
    if (!container) return;

    if (this.roleSetupPanel) {
      this.roleSetupPanel.destroy();
      this.roleSetupPanel = null;
    }

    const isHost = this.isHost();

    this.roleSetupPanel = new RoleSetupPanel({
      roles: gameConfig.roles,
      defaultRoleCounts: gameConfig.defaultRoleCounts,
      roleCounts: this.room.gameSettings?.roleCounts || null,
      minPlayers: gameConfig.minPlayers || 2,
      maxPlayers: gameConfig.maxPlayers || 20,
      minTotal: this.room.players.length,
      editable: isHost,
      onChange: (roleCounts, total) => {
        if (!this.room.gameSettings) this.room.gameSettings = {};
        this.room.gameSettings.roleCounts = roleCounts;
        this.room.maxPlayers = total;
        this._updateStartButton();
        this._updateHeaderCounts();
        this.options.onSettingsChange?.(this.room.gameSettings);
      }
    });

    container.appendChild(this.roleSetupPanel.getElement());
  }

  /**
   * Update start button state without full re-render
   * @private
   */
  _updateStartButton() {
    const startBtn = this.element.querySelector('.start-game-btn');
    if (!startBtn) return;

    const totalPlayers = this.getTotalPlayerCount();
    const maxPlayers = this.room.maxPlayers || 10;
    const canStart = totalPlayers === maxPlayers;

    startBtn.disabled = !canStart;

    const hint = this.element.querySelector('.start-game-hint');
    if (hint) {
      if (!canStart) {
        hint.textContent = `需要 ${maxPlayers} 名玩家才能开始（当前 ${totalPlayers} 人）`;
        hint.style.display = '';
      } else {
        hint.style.display = 'none';
      }
    }
  }

  /**
   * Update header counts and player list heading without full re-render
   * @private
   */
  _updateHeaderCounts() {
    const maxPlayers = this.room.maxPlayers || 10;
    const totalPlayers = this.getTotalPlayerCount();

    // Update header subtitle
    const headerP = this.element.querySelector('header p');
    if (headerP) {
      headerP.textContent = `房间 ID: ${this.room.id} | 游戏: ${this.room.gameType} | 目标人数: ${maxPlayers}`;
    }

    // Update player list heading
    const playerHeading = this.element.querySelector('.card-header h3');
    if (playerHeading && playerHeading.textContent.includes('玩家列表')) {
      playerHeading.textContent = `玩家列表 (${totalPlayers}/${maxPlayers})`;
    }
  }

  /**
   * Render players with avatars
   * @private
   */
  _renderPlayers() {
    const grid = this.element.querySelector('.players-grid');
    if (!grid) return;

    grid.innerHTML = '';
    this.avatars.clear();

    // Render human players
    this.room.players.forEach(player => {
      const avatar = new PlayerAvatar(player);
      this.avatars.set(player.id, avatar);
      grid.appendChild(avatar.getElement());
    });

    // Render AI players
    (this.room.aiPlayers || []).forEach(player => {
      const avatar = new PlayerAvatar({ ...player, isAI: true });
      this.avatars.set(player.id, avatar);
      grid.appendChild(avatar.getElement());
    });
  }

  /**
   * Render a chat message
   * @private
   * @param {Object} msg
   * @returns {string}
   */
  _renderChatMessage(msg) {
    const isSystem = msg.playerId === 'system';
    const isSelf = msg.playerId === this.playerId;

    return `
      <div style="
        ${isSystem ? 'text-align: center; color: var(--text-tertiary); font-size: var(--text-sm);' : ''}
        ${isSelf ? 'text-align: right;' : ''}
      ">
        ${!isSystem ? `
          <span style="font-size: var(--text-xs); color: var(--text-secondary);">
            ${msg.nickname || '未知'}
          </span>
        ` : ''}
        <div style="
          ${!isSystem ? `
            display: inline-block;
            padding: var(--spacing-2) var(--spacing-3);
            background: ${isSelf ? 'var(--primary-500)' : 'var(--bg-tertiary)'};
            color: ${isSelf ? 'white' : 'var(--text-primary)'};
            border-radius: var(--radius-base);
            max-width: 200px;
            word-break: break-word;
          ` : ''}
        ">${this._escapeHtml(msg.message)}</div>
      </div>
    `;
  }

  /**
   * Escape HTML
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
   * Bind events
   * @private
   */
  _bindEvents() {
    // Query button
    this.element.querySelector('.query-btn')?.addEventListener('click', () => {
      showQueryPanel();
    });

    // Leave button
    this.element.querySelector('.leave-btn')?.addEventListener('click', () => {
      this.options.onLeave?.();
    });

    // Start game button
    this.element.querySelector('.start-game-btn')?.addEventListener('click', () => {
      this.options.onStartGame?.();
    });

    // Collapse role setup
    this.element.querySelector('.toggle-role-setup-btn')?.addEventListener('click', () => {
      this.collapsedSections.roleSetup = !this.collapsedSections.roleSetup;
      this._render();
    });

    // Collapse game settings
    this.element.querySelector('.toggle-game-settings-btn')?.addEventListener('click', () => {
      this.collapsedSections.gameSettings = !this.collapsedSections.gameSettings;
      this._render();
    });

    // Add AI button
    this.element.querySelector('.add-ai-btn')?.addEventListener('click', () => {
      this.options.onAddAI?.();
    });

    // Remove AI button
    this.element.querySelector('.remove-ai-btn')?.addEventListener('click', () => {
      this.options.onRemoveAI?.();
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
   * Update room data
   * @param {Object} room - New room data
   */
  updateRoom(room) {
    this.room = room;
    this._render();
  }

  /**
   * Update player list
   * @param {Array} players - New player list
   */
  updatePlayers(players) {
    this.room.players = players;
    this._render();
    if (this.roleSetupPanel) {
      this.roleSetupPanel.setMinTotal(players.length);
    }
  }

  /**
   * Update AI players
   * @param {Array} aiPlayers - AI player list
   */
  updateAIPlayers(aiPlayers) {
    this.room.aiPlayers = aiPlayers;
    this._render();
  }

  /**
   * Update game settings (merges with existing to avoid losing keys like roleCounts)
   * @param {Object} settings - New game settings
   */
  updateGameSettings(settings) {
    this.room.gameSettings = { ...this.room.gameSettings, ...settings };
    if (this.settingsPanel) {
      this.settingsPanel.updateSettings(this.room.gameSettings);
    }
    if (this.room.gameSettings.roleCounts && this.roleSetupPanel) {
      this.roleSetupPanel.updateRoleCounts(this.room.gameSettings.roleCounts);
      const total = this.roleSetupPanel.getTotal();
      this.room.maxPlayers = total;
      this._updateStartButton();
      this._updateHeaderCounts();
    }
  }

  /**
   * Get current game settings
   * @returns {Object}
   */
  getGameSettings() {
    const base = this.settingsPanel?.getSettings()
      || { ...this.room.gameSettings } || {};
    if (this.roleSetupPanel) {
      base.roleCounts = this.roleSetupPanel.getRoleCounts();
    }
    // Strip internal metadata keys
    delete base._gameType;
    delete base._maxPlayers;
    return base;
  }

  /**
   * Add an AI player
   * @param {Object} aiPlayer - AI player info
   */
  addAIPlayer(aiPlayer) {
    if (!this.room.aiPlayers) this.room.aiPlayers = [];
    this.room.aiPlayers.push(aiPlayer);
    this._render();
  }

  /**
   * Remove last AI player
   * @returns {Object|null} Removed AI player
   */
  removeLastAIPlayer() {
    if (!this.room.aiPlayers || this.room.aiPlayers.length === 0) return null;
    const removed = this.room.aiPlayers.pop();
    this._render();
    return removed;
  }

  /**
   * Add chat message
   * @param {Object} msg - Chat message
   */
  addChatMessage(msg) {
    this.chatMessages.push(msg);

    const container = this.element.querySelector('.chat-messages');
    if (container) {
      container.insertAdjacentHTML('beforeend', this._renderChatMessage(msg));
      this._scrollChatToBottom();
    }
  }

  /**
   * Add system message
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
    this.avatars.forEach(avatar => avatar.destroy());
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
   * Get element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}

export default WaitingRoom;
