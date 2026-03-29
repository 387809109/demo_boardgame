/**
 * Query Panel Component
 * Queries static game data from Supabase tables
 * @module components/query-panel
 */

import {
  fetchCards, fetchGameTables, isApiConfigured, ApiError
} from '../utils/api-client.js';
import { createSpinner } from './loading.js';
import { trackEvent } from '../utils/analytics.js';

/**
 * Available games and their queryable data tables.
 * Each game lists the Supabase tables/endpoints that hold its static data.
 */
const QUERYABLE_GAMES = [
  {
    gameId: 'his',
    gameName: 'Here I Stand',
    tables: [
      { key: 'cards',     label: '卡牌',     endpoint: 'cards' },
      { key: 'leaders',   label: '将领',     endpoint: 'leaders' },
      { key: 'debaters',  label: '辩论家',   endpoint: 'debaters' },
      { key: 'explorers', label: '探险家',   endpoint: 'explorers' },
    ]
  },
  {
    gameId: 'uno',
    gameName: 'UNO',
    tables: [
      { key: 'cards', label: '卡牌', endpoint: 'cards' },
    ]
  },
];

/**
 * Query Panel for browsing static game data from Supabase
 */
export class QueryPanel {
  constructor() {
    this._backdrop = null;
    this._container = null;
    this._content = null;
    this._isOpen = false;
    this._loading = false;
    this._error = null;

    /** @type {string|null} Currently selected game */
    this._selectedGameId = null;
    /** @type {string|null} Currently selected table key */
    this._selectedTable = null;
    /** @type {object[]} Current query results */
    this._results = [];
    /** @type {number} Total results count */
    this._total = 0;
    /** @type {number} Current page offset */
    this._offset = 0;
    /** @type {number} Page size */
    this._limit = 20;
    /** @type {string} Search text */
    this._search = '';

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
      max-width: 900px;
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

    const titleArea = document.createElement('div');
    titleArea.style.cssText = `
      display: flex; align-items: center; gap: var(--spacing-3);
      flex-wrap: wrap;
    `;

    const title = document.createElement('h3');
    title.textContent = '游戏数据查询';
    title.style.cssText = `
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
    `;
    titleArea.appendChild(title);

    // Game selector
    this._gameSelect = document.createElement('select');
    this._gameSelect.className = 'input';
    this._gameSelect.style.cssText = `
      font-size: var(--text-xs);
      padding: var(--spacing-1) var(--spacing-2);
      max-width: 160px;
      border-radius: var(--radius-sm);
    `;
    const defaultGameOpt = document.createElement('option');
    defaultGameOpt.value = '';
    defaultGameOpt.textContent = '选择游戏...';
    this._gameSelect.appendChild(defaultGameOpt);
    for (const game of QUERYABLE_GAMES) {
      const opt = document.createElement('option');
      opt.value = game.gameId;
      opt.textContent = game.gameName;
      this._gameSelect.appendChild(opt);
    }
    this._gameSelect.addEventListener('change', () => {
      this._selectedGameId = this._gameSelect.value || null;
      this._selectedTable = null;
      this._results = [];
      this._offset = 0;
      this._search = '';
      this._renderTableSelector();
    });
    titleArea.appendChild(this._gameSelect);

    // Table selector (populated on game change)
    this._tableSelect = document.createElement('select');
    this._tableSelect.className = 'input';
    this._tableSelect.style.cssText = `
      font-size: var(--text-xs);
      padding: var(--spacing-1) var(--spacing-2);
      max-width: 120px;
      border-radius: var(--radius-sm);
      display: none;
    `;
    this._tableSelect.addEventListener('change', () => {
      this._selectedTable = this._tableSelect.value || null;
      this._results = [];
      this._offset = 0;
      this._search = '';
      if (this._selectedTable) {
        this._loadData();
      } else {
        this._renderEmpty('请选择数据表');
      }
    });
    titleArea.appendChild(this._tableSelect);

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

    header.appendChild(titleArea);
    header.appendChild(closeBtn);

    // Create toolbar (search + pagination)
    this._toolbar = document.createElement('div');
    this._toolbar.style.cssText = `
      display: none;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-2) var(--spacing-6);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    `;

    this._searchInput = document.createElement('input');
    this._searchInput.type = 'text';
    this._searchInput.className = 'input';
    this._searchInput.placeholder = '搜索...';
    this._searchInput.style.cssText = 'flex: 1; font-size: var(--text-sm);';
    this._searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._search = this._searchInput.value.trim();
        this._offset = 0;
        this._loadData();
      }
    });

    const searchBtn = document.createElement('button');
    searchBtn.className = 'btn btn-primary btn-sm';
    searchBtn.textContent = '搜索';
    searchBtn.addEventListener('click', () => {
      this._search = this._searchInput.value.trim();
      this._offset = 0;
      this._loadData();
    });

    this._pageInfo = document.createElement('span');
    this._pageInfo.style.cssText = `
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      white-space: nowrap;
    `;

    this._prevBtn = document.createElement('button');
    this._prevBtn.className = 'btn btn-ghost btn-sm';
    this._prevBtn.textContent = '上一页';
    this._prevBtn.addEventListener('click', () => {
      if (this._offset > 0) {
        this._offset = Math.max(0, this._offset - this._limit);
        this._loadData();
      }
    });

    this._nextBtn = document.createElement('button');
    this._nextBtn.className = 'btn btn-ghost btn-sm';
    this._nextBtn.textContent = '下一页';
    this._nextBtn.addEventListener('click', () => {
      if (this._offset + this._limit < this._total) {
        this._offset += this._limit;
        this._loadData();
      }
    });

    this._toolbar.appendChild(this._searchInput);
    this._toolbar.appendChild(searchBtn);
    this._toolbar.appendChild(this._pageInfo);
    this._toolbar.appendChild(this._prevBtn);
    this._toolbar.appendChild(this._nextBtn);

    // Create content area
    this._content = document.createElement('div');
    this._content.className = 'query-panel-content';
    this._content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-4) var(--spacing-6);
    `;

    this._container.appendChild(header);
    this._container.appendChild(this._toolbar);
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
   * Show the panel
   */
  show() {
    this._backdrop.style.display = 'flex';
    this._isOpen = true;
    document.body.style.overflow = 'hidden';
    trackEvent('query_panel_opened');

    if (!this._selectedGameId) {
      this._renderEmpty('请选择游戏和数据表');
    }
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
   * Update table selector dropdown when game changes
   * @private
   */
  _renderTableSelector() {
    // Clear old options
    this._tableSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '选择数据表...';
    this._tableSelect.appendChild(defaultOpt);

    const game = QUERYABLE_GAMES.find(g => g.gameId === this._selectedGameId);
    if (game) {
      for (const table of game.tables) {
        const opt = document.createElement('option');
        opt.value = table.key;
        opt.textContent = table.label;
        this._tableSelect.appendChild(opt);
      }
      this._tableSelect.style.display = '';
      this._renderEmpty('请选择数据表');
    } else {
      this._tableSelect.style.display = 'none';
      this._renderEmpty('请选择游戏和数据表');
    }

    this._toolbar.style.display = 'none';
  }

  /**
   * Load data from API
   * @private
   */
  async _loadData() {
    if (!isApiConfigured()) {
      this._renderError('API 未配置。请在 .env 中设置 VITE_API_URL');
      return;
    }

    if (!this._selectedGameId || !this._selectedTable) return;

    this._loading = true;
    this._renderLoading();

    const game = QUERYABLE_GAMES.find(g => g.gameId === this._selectedGameId);
    const table = game?.tables.find(t => t.key === this._selectedTable);
    if (!table) return;

    try {
      const result = await fetchGameTables(
        this._selectedGameId,
        table.endpoint,
        {
          search: this._search || undefined,
          limit: this._limit,
          offset: this._offset,
        }
      );
      this._results = result.data || [];
      this._total = result.meta?.total ?? this._results.length;
      this._error = null;
      this._renderResults(table.label);
      trackEvent('query_data_loaded', {
        game_id: this._selectedGameId,
        table: this._selectedTable,
        total: this._total
      });
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
    this._toolbar.style.display = 'none';
    this._content.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      text-align: center;
      padding: var(--spacing-12);
      color: var(--error-500);
    `;

    const icon = document.createElement('div');
    icon.textContent = '!';
    icon.style.cssText = `
      font-size: var(--text-4xl);
      font-weight: bold;
    `;
    errorDiv.appendChild(icon);

    const text = document.createElement('p');
    text.textContent = message;
    text.style.marginTop = 'var(--spacing-4)';
    errorDiv.appendChild(text);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = '重试';
    retryBtn.style.marginTop = 'var(--spacing-4)';
    retryBtn.addEventListener('click', () => this._loadData());
    errorDiv.appendChild(retryBtn);

    this._content.appendChild(errorDiv);
  }

  /**
   * Render empty/placeholder state
   * @param {string} message
   * @private
   */
  _renderEmpty(message) {
    this._toolbar.style.display = 'none';
    this._content.innerHTML = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = `
      text-align: center;
      padding: var(--spacing-12);
      color: var(--text-secondary);
    `;
    emptyDiv.textContent = message;
    this._content.appendChild(emptyDiv);
  }

  /**
   * Render query results as a data table
   * @param {string} tableLabel
   * @private
   */
  _renderResults(tableLabel) {
    this._content.innerHTML = '';

    // Show toolbar
    this._toolbar.style.display = 'flex';
    this._searchInput.value = this._search;
    this._updatePagination();

    if (this._results.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = `
        text-align: center;
        padding: var(--spacing-12);
        color: var(--text-secondary);
      `;
      emptyDiv.textContent = this._search
        ? `未找到匹配 "${this._search}" 的${tableLabel}数据`
        : `暂无${tableLabel}数据`;
      this._content.appendChild(emptyDiv);
      return;
    }

    // Build table from result columns
    const columns = this._getDisplayColumns(this._results[0]);
    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-size: var(--text-sm);
    `;

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of columns) {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.style.cssText = `
        text-align: left;
        padding: var(--spacing-2) var(--spacing-3);
        border-bottom: 2px solid var(--border-light);
        font-weight: var(--font-semibold);
        color: var(--text-secondary);
        white-space: nowrap;
      `;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    for (const row of this._results) {
      const tr = document.createElement('tr');
      tr.style.cssText = `
        border-bottom: 1px solid var(--border-light);
        transition: background var(--transition-fast);
      `;
      tr.addEventListener('mouseenter', () => {
        tr.style.background = 'var(--bg-secondary)';
      });
      tr.addEventListener('mouseleave', () => {
        tr.style.background = '';
      });

      for (const col of columns) {
        const td = document.createElement('td');
        td.style.cssText = `
          padding: var(--spacing-2) var(--spacing-3);
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        `;
        const val = row[col.key];
        if (val === null || val === undefined) {
          td.textContent = '-';
          td.style.color = 'var(--text-tertiary)';
        } else if (typeof val === 'object') {
          td.textContent = JSON.stringify(val);
          td.style.fontSize = 'var(--text-xs)';
          td.style.fontFamily = 'monospace';
        } else {
          td.textContent = String(val);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    this._content.appendChild(table);
  }

  /**
   * Determine display columns from a data row, excluding internal fields
   * @param {object} sampleRow
   * @returns {{ key: string, label: string }[]}
   * @private
   */
  _getDisplayColumns(sampleRow) {
    const HIDDEN = new Set([
      'id', 'game_id', 'category_id', 'created_at', 'updated_at',
      'card_categories'
    ]);
    const LABELS = {
      name: '名称',
      display_name: '显示名',
      description: '描述',
      effects: '效果',
      attributes: '属性',
      image_url: '图片',
      cp: 'CP',
      number: '编号',
      title: '标题',
      faction: '势力',
      type: '类型',
      deck: '牌组',
      category: '分类',
      battle: '战斗',
      command: '指挥',
      piracy: '海盗',
      conquest: '征服',
      exploration: '探索',
      value: '数值',
      entry_turn: '登场回合',
      zone: '区域',
      sort_order: '排序',
    };

    return Object.keys(sampleRow)
      .filter(k => !HIDDEN.has(k))
      .map(k => ({ key: k, label: LABELS[k] || k }));
  }

  /**
   * Update pagination controls
   * @private
   */
  _updatePagination() {
    const start = this._total === 0 ? 0 : this._offset + 1;
    const end = Math.min(this._offset + this._limit, this._total);
    this._pageInfo.textContent = `${start}-${end} / ${this._total}`;
    this._prevBtn.disabled = this._offset === 0;
    this._nextBtn.disabled = this._offset + this._limit >= this._total;
    this._prevBtn.style.opacity = this._prevBtn.disabled ? '0.4' : '1';
    this._nextBtn.style.opacity = this._nextBtn.disabled ? '0.4' : '1';
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
