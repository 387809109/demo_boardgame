/**
 * Game Lobby Component
 * @module layout/game-lobby
 */

import { getGameList } from '../game/registry.js';
import { loadConfig } from '../utils/storage.js';

/**
 * Game Lobby - Main menu for selecting and starting games
 */
export class GameLobby {
  /**
   * @param {Object} options
   * @param {Function} options.onSelectGame - Called when game is selected
   * @param {Function} options.onJoinRoom - Called when joining online room
   * @param {Function} options.onSettings - Called when settings is clicked
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.games = [];
    this.searchTerm = '';
    this.selectedTags = [];

    this._create();
  }

  /**
   * Create the lobby DOM
   * @private
   */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'game-lobby';
    this.element.style.cssText = `
      min-height: 100vh;
      background: var(--bg-secondary);
    `;

    this.games = getGameList();
    this._render();
  }

  /**
   * Render the lobby
   * @private
   */
  _render() {
    const config = loadConfig();
    const filteredGames = this._filterGames();

    this.element.innerHTML = `
      <header class="lobby-header" style="
        background: var(--gradient-primary);
        color: white;
        padding: var(--spacing-8) var(--spacing-6);
        text-align: center;
      ">
        <h1 style="margin: 0 0 var(--spacing-2) 0; font-size: var(--text-4xl);">桌游集成客户端</h1>
        <p style="margin: 0; opacity: 0.9;">选择游戏开始游玩</p>
      </header>

      <div class="lobby-content" style="
        max-width: 1200px;
        margin: 0 auto;
        padding: var(--spacing-6);
      ">
        <div class="lobby-actions" style="
          display: flex;
          gap: var(--spacing-4);
          margin-bottom: var(--spacing-6);
          flex-wrap: wrap;
        ">
          <div style="flex: 1; min-width: 200px;">
            <input type="text" class="input search-input" placeholder="搜索游戏..." value="${this.searchTerm}">
          </div>
          <button class="btn btn-secondary join-room-btn">
            <span>🌐</span> 加入房间
          </button>
          <button class="btn btn-secondary settings-btn">
            <span>⚙️</span> 设置
          </button>
        </div>

        <div class="game-grid" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--spacing-4);
        ">
          ${filteredGames.length > 0 ? filteredGames.map(game => this._renderGameCard(game)).join('') : `
            <div style="
              grid-column: 1 / -1;
              text-align: center;
              padding: var(--spacing-12);
              color: var(--text-secondary);
            ">
              <p style="font-size: var(--text-xl); margin-bottom: var(--spacing-2);">暂无游戏</p>
              <p>游戏模块正在开发中...</p>
            </div>
          `}
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * Render a game card
   * @private
   * @param {Object} game - Game config
   * @returns {string}
   */
  _renderGameCard(game) {
    const difficultyColors = {
      easy: 'var(--success-500)',
      medium: 'var(--warning-500)',
      hard: 'var(--error-500)'
    };

    const difficultyLabels = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    };

    return `
      <div class="game-card card" data-game-id="${game.id}" style="cursor: pointer; transition: all var(--transition-fast);">
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-3);">
            <h3 style="margin: 0; font-size: var(--text-xl);">${game.name || game.id}</h3>
            <span style="
              padding: var(--spacing-1) var(--spacing-2);
              background: ${difficultyColors[game.difficulty] || 'var(--neutral-400)'};
              color: white;
              border-radius: var(--radius-sm);
              font-size: var(--text-xs);
            ">${difficultyLabels[game.difficulty] || game.difficulty}</span>
          </div>

          <p style="color: var(--text-secondary); margin-bottom: var(--spacing-4); min-height: 40px;">
            ${game.description || '暂无描述'}
          </p>

          <div style="display: flex; gap: var(--spacing-4); color: var(--text-tertiary); font-size: var(--text-sm);">
            <span>👥 ${game.minPlayers}-${game.maxPlayers}人</span>
            <span>⏱️ ${game.estimatedTime || 30}分钟</span>
            ${game.supportsAI ? '<span title="支持 AI 对战">🤖 AI</span>' : ''}
          </div>

          ${game.tags ? `
            <div style="display: flex; gap: var(--spacing-2); margin-top: var(--spacing-3); flex-wrap: wrap;">
              ${game.tags.map(tag => `
                <span style="
                  padding: var(--spacing-1) var(--spacing-2);
                  background: var(--bg-tertiary);
                  border-radius: var(--radius-sm);
                  font-size: var(--text-xs);
                  color: var(--text-secondary);
                ">${tag}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="card-footer" style="display: flex; gap: var(--spacing-2);">
          <button class="btn btn-primary btn-sm play-offline-btn" style="flex: 1;" data-game-id="${game.id}">
            单机游戏
          </button>
          <button class="btn btn-secondary btn-sm create-room-btn" data-game-id="${game.id}">
            创建房间
          </button>
          <button class="btn btn-ghost btn-sm rules-btn" data-game-id="${game.id}" title="查看规则">
            📖
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Filter games based on search and tags
   * @private
   * @returns {Array}
   */
  _filterGames() {
    let filtered = this.games;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.name?.toLowerCase().includes(term) ||
        g.id.toLowerCase().includes(term) ||
        g.description?.toLowerCase().includes(term)
      );
    }

    if (this.selectedTags.length > 0) {
      filtered = filtered.filter(g =>
        g.tags?.some(t => this.selectedTags.includes(t))
      );
    }

    return filtered;
  }

  /**
   * Bind event handlers
   * @private
   */
  _bindEvents() {
    // Search
    const searchInput = this.element.querySelector('.search-input');
    searchInput?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value;
      this._render();
    });

    // Play offline
    this.element.querySelectorAll('.play-offline-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.dataset.gameId;
        this.options.onSelectGame?.(gameId, 'offline');
      });
    });

    // Create room
    this.element.querySelectorAll('.create-room-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.dataset.gameId;
        this.options.onSelectGame?.(gameId, 'online');
      });
    });

    // View rules
    this.element.querySelectorAll('.rules-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const gameId = btn.dataset.gameId;
        window.open(`/rules/${gameId}.html`, '_blank', 'width=900,height=700');
      });
    });

    // Card click
    this.element.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        const gameId = card.dataset.gameId;
        this.options.onSelectGame?.(gameId, 'offline');
      });

      // Hover effect
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = 'var(--shadow-lg)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
      });
    });

    // Join room
    this.element.querySelector('.join-room-btn')?.addEventListener('click', () => {
      this.options.onJoinRoom?.();
    });

    // Settings
    this.element.querySelector('.settings-btn')?.addEventListener('click', () => {
      this.options.onSettings?.();
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
   * Unmount from DOM
   */
  unmount() {
    this.element?.remove();
  }

  /**
   * Refresh game list
   */
  refresh() {
    this.games = getGameList();
    this._render();
  }

  /**
   * Get element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}

export default GameLobby;
