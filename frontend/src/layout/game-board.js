/**
 * Game Board Container Component
 * @module layout/game-board
 */

import { PlayerAvatar } from '../components/player-avatar.js';
import { getCardDisplayText, getColorName, CARD_TYPES } from '../games/uno/rules.js';

/**
 * Game Board - Generic container for game rendering
 */
export class GameBoard {
  /**
   * @param {Object} options
   * @param {Object} options.game - Game instance
   * @param {string} options.playerId - Current player ID
   * @param {Function} options.onAction - Called when player takes action
   * @param {Function} options.onLeave - Called when leaving game
   */
  constructor(options = {}) {
    this.options = options;
    this.element = null;
    this.game = options.game;
    this.playerId = options.playerId || '';
    this.state = null;
    this.gameUI = null;
    this.avatars = new Map();

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
      min-height: 100vh;
      background: var(--bg-secondary);
      display: flex;
      flex-direction: column;
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
        <button class="btn btn-secondary btn-sm leave-btn">退出游戏</button>
      </header>

      <div class="game-main" style="
        flex: 1;
        display: flex;
        overflow: hidden;
      ">
        <aside class="players-sidebar" style="
          width: 160px;
          background: var(--bg-primary);
          border-right: 1px solid var(--border-light);
          padding: var(--spacing-4);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
          overflow-y: auto;
        ">
          <h4 style="margin: 0; font-size: var(--text-sm); color: var(--text-secondary);">玩家</h4>
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

        <aside class="history-sidebar" style="
          width: 220px;
          background: var(--bg-primary);
          border-left: 1px solid var(--border-light);
          padding: var(--spacing-4);
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        ">
          <h4 style="margin: 0 0 var(--spacing-3) 0; font-size: var(--text-sm); color: var(--text-secondary); flex-shrink: 0;">历史记录</h4>
          <div class="history-list" style="
            flex: 1;
            overflow-y: auto;
            font-size: var(--text-sm);
            color: var(--text-secondary);
            min-height: 0;
          ">
            ${this._renderHistory()}
          </div>
        </aside>
      </div>
    `;

    this._renderPlayers(players, state?.currentPlayer);
    this._bindEvents();
  }

  /**
   * Render players list
   * @private
   */
  _renderPlayers(players, currentPlayerId) {
    const container = this.element.querySelector('.players-list');
    if (!container) return;

    container.innerHTML = '';
    this.avatars.forEach(a => a.destroy());
    this.avatars.clear();

    players.forEach(player => {
      const avatar = new PlayerAvatar(player);
      avatar.setCurrentTurn(player.id === currentPlayerId);
      this.avatars.set(player.id, avatar);
      container.appendChild(avatar.getElement());
    });
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
   * Render a history action with details
   * @private
   */
  _renderHistoryAction(entry) {
    const { actionType, actionData } = entry;

    switch (actionType) {
      case 'PLAY_CARD': {
        const card = actionData?.card || this._findCardById(actionData?.cardId);
        if (card) {
          return `
            <div style="display: flex; align-items: center; gap: var(--spacing-2);">
              <span>出牌</span>
              ${this._renderMiniCard(card)}
              ${actionData?.chosenColor ? `
                <span style="font-size: var(--text-xs);">→ ${getColorName(actionData.chosenColor)}</span>
              ` : ''}
            </div>
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
  }

  /**
   * Update game state
   * @param {Object} state - New game state
   */
  updateState(state) {
    this.state = state;

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

export default GameBoard;
