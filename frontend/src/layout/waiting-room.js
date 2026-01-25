/**
 * Waiting Room Component
 * @module layout/waiting-room
 */

import { PlayerAvatar } from '../components/player-avatar.js';

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
   * @param {string} options.playerId - Current player ID
   * @param {Function} options.onStartGame - Called when starting game
   * @param {Function} options.onLeave - Called when leaving room
   * @param {Function} options.onSendChat - Called when sending chat
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.room = options.room || { id: '', gameType: '', players: [] };
    this.playerId = options.playerId || '';
    this.chatMessages = [];
    this.avatars = new Map();

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
   * Render the room
   * @private
   */
  _render() {
    const isHost = this.isHost();

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
            房间 ID: ${this.room.id} | 游戏: ${this.room.gameType}
          </p>
        </div>
        <button class="btn btn-secondary leave-btn">离开房间</button>
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
            <div class="card-header">
              <h3 style="margin: 0;">玩家列表 (${this.room.players.length})</h3>
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

          ${isHost ? `
            <button class="btn btn-primary btn-lg start-game-btn" style="width: 100%;" ${this.room.players.length < 2 ? 'disabled' : ''}>
              开始游戏
            </button>
            ${this.room.players.length < 2 ? `
              <p style="text-align: center; color: var(--text-secondary); margin-top: var(--spacing-2);">
                需要至少 2 名玩家才能开始
              </p>
            ` : ''}
          ` : `
            <div style="
              text-align: center;
              padding: var(--spacing-4);
              background: var(--bg-tertiary);
              border-radius: var(--radius-base);
            ">
              <p style="margin: 0; color: var(--text-secondary);">等待房主开始游戏...</p>
            </div>
          `}
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
    this._bindEvents();
    this._scrollChatToBottom();
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

    this.room.players.forEach(player => {
      const avatar = new PlayerAvatar(player);
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
    // Leave button
    this.element.querySelector('.leave-btn')?.addEventListener('click', () => {
      this.options.onLeave?.();
    });

    // Start game button
    this.element.querySelector('.start-game-btn')?.addEventListener('click', () => {
      this.options.onStartGame?.();
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
    this._renderPlayers();

    // Update start button state
    const startBtn = this.element.querySelector('.start-game-btn');
    if (startBtn && this.isHost()) {
      startBtn.disabled = players.length < 2;
    }
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
