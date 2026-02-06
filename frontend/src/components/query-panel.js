/**
 * Query Panel Component
 * Displays game data from API in a modal panel
 * @module components/query-panel
 */

import { fetchGames, isApiConfigured, ApiError } from '../utils/api-client.js';
import { createSpinner } from './loading.js';

/**
 * Query Panel for browsing game data from API
 */
export class QueryPanel {
  constructor() {
    this._backdrop = null;
    this._container = null;
    this._content = null;
    this._isOpen = false;
    this._games = [];
    this._loading = false;
    this._error = null;

    this._init();
  }

  /**
   * Initialize panel DOM
   * @private
   */
  _init() {
    // Create backdrop
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'query-panel-backdrop';
    this._backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-overlay);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      animation: fadeIn var(--transition-fast) forwards;
    `;

    // Create container
    this._container = document.createElement('div');
    this._container.className = 'query-panel-container';
    this._container.style.cssText = `
      background: var(--bg-primary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      width: 90vw;
      max-width: 800px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      animation: slideUp var(--transition-base) forwards;
    `;

    // Create header
    const header = document.createElement('div');
    header.className = 'query-panel-header';
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-6);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    `;

    const title = document.createElement('h3');
    title.textContent = '游戏数据查询';
    title.style.cssText = `
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: var(--text-2xl);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create content area
    this._content = document.createElement('div');
    this._content.className = 'query-panel-content';
    this._content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-4) var(--spacing-6);
    `;

    this._container.appendChild(header);
    this._container.appendChild(this._content);
    this._backdrop.appendChild(this._container);
    document.body.appendChild(this._backdrop);

    // Close on backdrop click
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) {
        this.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.hide();
      }
    });
  }

  /**
   * Show the panel and load data
   */
  async show() {
    this._backdrop.style.display = 'flex';
    this._isOpen = true;
    document.body.style.overflow = 'hidden';

    await this._loadGames();
  }

  /**
   * Hide the panel
   */
  hide() {
    this._backdrop.style.display = 'none';
    this._isOpen = false;
    document.body.style.overflow = '';
  }

  /**
   * Check if panel is open
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Load games from API
   * @private
   */
  async _loadGames() {
    if (!isApiConfigured()) {
      this._renderError('API 未配置。请在 .env 中设置 VITE_API_URL');
      return;
    }

    this._loading = true;
    this._renderLoading();

    try {
      const result = await fetchGames();
      this._games = result.data || [];
      this._error = null;
      this._renderGames();
    } catch (err) {
      this._error = err;
      if (err instanceof ApiError) {
        this._renderError(`加载失败: ${err.message}`);
      } else {
        this._renderError('网络错误，请检查连接');
      }
    } finally {
      this._loading = false;
    }
  }

  /**
   * Render loading state
   * @private
   */
  _renderLoading() {
    this._content.innerHTML = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-12);
      color: var(--text-secondary);
    `;

    loadingDiv.appendChild(createSpinner('32px'));

    const text = document.createElement('p');
    text.textContent = '加载中...';
    text.style.marginTop = 'var(--spacing-4)';
    loadingDiv.appendChild(text);

    this._content.appendChild(loadingDiv);
  }

  /**
   * Render error state
   * @param {string} message
   * @private
   */
  _renderError(message) {
    this._content.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      text-align: center;
      padding: var(--spacing-12);
      color: var(--error-500);
    `;

    const icon = document.createElement('div');
    icon.textContent = '⚠️';
    icon.style.fontSize = 'var(--text-4xl)';
    errorDiv.appendChild(icon);

    const text = document.createElement('p');
    text.textContent = message;
    text.style.marginTop = 'var(--spacing-4)';
    errorDiv.appendChild(text);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = '重试';
    retryBtn.style.marginTop = 'var(--spacing-4)';
    retryBtn.addEventListener('click', () => this._loadGames());
    errorDiv.appendChild(retryBtn);

    this._content.appendChild(errorDiv);
  }

  /**
   * Render games list
   * @private
   */
  _renderGames() {
    this._content.innerHTML = '';

    if (this._games.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = `
        text-align: center;
        padding: var(--spacing-12);
        color: var(--text-secondary);
      `;
      emptyDiv.textContent = '暂无游戏数据';
      this._content.appendChild(emptyDiv);
      return;
    }

    // Games grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--spacing-4);
    `;

    for (const game of this._games) {
      grid.appendChild(this._createGameCard(game));
    }

    this._content.appendChild(grid);
  }

  /**
   * Create a game card element
   * @param {Object} game
   * @returns {HTMLElement}
   * @private
   */
  _createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-query-card';
    card.style.cssText = `
      background: var(--bg-secondary);
      border-radius: var(--radius-base);
      padding: var(--spacing-4);
      border: 1px solid var(--border-light);
      transition: box-shadow var(--transition-fast), transform var(--transition-fast);
      cursor: default;
    `;

    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = 'var(--shadow-md)';
      card.style.transform = 'translateY(-2px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
      card.style.transform = 'none';
    });

    // Game name
    const name = document.createElement('h4');
    name.textContent = game.name || game.id;
    name.style.cssText = `
      margin: 0 0 var(--spacing-2) 0;
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--text-primary);
    `;
    card.appendChild(name);

    // Category badge
    if (game.category) {
      const badge = document.createElement('span');
      badge.textContent = this._getCategoryLabel(game.category);
      badge.style.cssText = `
        display: inline-block;
        padding: var(--spacing-1) var(--spacing-2);
        background: var(--primary-100);
        color: var(--primary-700);
        font-size: var(--text-xs);
        border-radius: var(--radius-sm);
        margin-bottom: var(--spacing-2);
      `;
      card.appendChild(badge);
    }

    // Description
    if (game.description) {
      const desc = document.createElement('p');
      desc.textContent = game.description;
      desc.style.cssText = `
        margin: 0 0 var(--spacing-3) 0;
        font-size: var(--text-sm);
        color: var(--text-secondary);
        line-height: 1.5;
      `;
      card.appendChild(desc);
    }

    // Player count
    const players = document.createElement('div');
    players.style.cssText = `
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      font-size: var(--text-sm);
      color: var(--text-tertiary);
    `;
    players.innerHTML = `
      <span style="font-size: var(--text-base);">👥</span>
      <span>${game.min_players || 2} - ${game.max_players || 4} 人</span>
    `;
    card.appendChild(players);

    // Tags
    if (game.tags && game.tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-1);
        margin-top: var(--spacing-3);
      `;

      for (const tag of game.tags.slice(0, 4)) {
        const tagEl = document.createElement('span');
        tagEl.textContent = tag;
        tagEl.style.cssText = `
          padding: 2px var(--spacing-2);
          background: var(--neutral-100);
          color: var(--text-tertiary);
          font-size: var(--text-xs);
          border-radius: var(--radius-sm);
        `;
        tagsDiv.appendChild(tagEl);
      }

      card.appendChild(tagsDiv);
    }

    return card;
  }

  /**
   * Get category display label
   * @param {string} category
   * @returns {string}
   * @private
   */
  _getCategoryLabel(category) {
    const labels = {
      'card': '卡牌游戏',
      'social_deduction': '社交推理',
      'strategy': '策略游戏',
      'party': '派对游戏',
      'puzzle': '益智游戏'
    };
    return labels[category] || category;
  }
}

// Singleton instance
let panelInstance = null;

/**
 * Get or create query panel instance
 * @returns {QueryPanel}
 */
export function getQueryPanel() {
  if (!panelInstance) {
    panelInstance = new QueryPanel();
  }
  return panelInstance;
}

/**
 * Show query panel
 */
export function showQueryPanel() {
  getQueryPanel().show();
}

/**
 * Hide query panel
 */
export function hideQueryPanel() {
  getQueryPanel().hide();
}

export default QueryPanel;
