/**
 * UNO Game UI
 * @module games/uno/ui
 */

import { COLORS, CARD_TYPES, canPlayCard, getCardDisplayText, getColorName } from './rules.js';
import { UNO_ACTIONS } from './index.js';

/**
 * Card color CSS values
 */
const COLOR_CSS = {
  red: 'var(--uno-red)',
  blue: 'var(--uno-blue)',
  green: 'var(--uno-green)',
  yellow: 'var(--uno-yellow)',
  null: 'var(--uno-black)'
};

/**
 * UNO UI Component
 */
export class UnoUI {
  constructor() {
    this.state = null;
    this.playerId = null;
    this.onAction = null;
    this.selectedCard = null;
    this.showColorPicker = false;
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
    this.selectedCard = null;

    const container = document.createElement('div');
    container.className = 'uno-game';
    container.style.cssText = `
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-6);
      align-items: center;
    `;

    // Game info
    container.appendChild(this._renderGameInfo());

    // Discard pile and deck
    container.appendChild(this._renderTable());

    // Player's hand
    container.appendChild(this._renderHand());

    // Color picker (if needed)
    if (this.showColorPicker) {
      container.appendChild(this._renderColorPicker());
    }

    return container;
  }

  /**
   * Render game info bar
   * @private
   */
  _renderGameInfo() {
    const div = document.createElement('div');
    div.className = 'game-info';
    div.style.cssText = `
      display: flex;
      gap: var(--spacing-4);
      align-items: center;
      font-size: var(--text-sm);
    `;

    const currentColor = this.state.currentColor || 'none';
    div.innerHTML = `
      <span>当前颜色:</span>
      <span style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${COLOR_CSS[currentColor] || 'var(--neutral-300)'};
        display: inline-block;
        border: 2px solid rgba(0,0,0,0.1);
      "></span>
      <span>${getColorName(currentColor)}</span>
      ${this.state.drawPending > 0 ? `
        <span style="
          padding: var(--spacing-1) var(--spacing-2);
          background: var(--error-500);
          color: white;
          border-radius: var(--radius-sm);
        ">需要摸 ${this.state.drawPending} 张牌</span>
      ` : ''}
      ${this.state.direction === -1 ? `
        <span style="
          padding: var(--spacing-1) var(--spacing-2);
          background: var(--warning-500);
          color: white;
          border-radius: var(--radius-sm);
        ">逆时针</span>
      ` : ''}
    `;

    return div;
  }

  /**
   * Render table (deck and discard pile)
   * @private
   */
  _renderTable() {
    const div = document.createElement('div');
    div.className = 'game-table';
    div.style.cssText = `
      display: flex;
      gap: var(--spacing-8);
      align-items: center;
    `;

    // Deck
    const deck = document.createElement('div');
    deck.className = 'deck';
    deck.style.cssText = `
      width: 80px;
      height: 120px;
      background: var(--uno-black);
      border-radius: var(--radius-base);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: var(--text-2xl);
      cursor: ${this.state.currentPlayer === this.playerId ? 'pointer' : 'default'};
      box-shadow: var(--shadow-md);
      position: relative;
      transition: transform var(--transition-fast);
    `;
    deck.innerHTML = `
      <span>UNO</span>
      <span style="
        position: absolute;
        bottom: var(--spacing-2);
        font-size: var(--text-xs);
      ">${this.state.deckCount} 张</span>
    `;

    if (this.state.currentPlayer === this.playerId) {
      deck.addEventListener('mouseenter', () => deck.style.transform = 'scale(1.05)');
      deck.addEventListener('mouseleave', () => deck.style.transform = '');
      deck.addEventListener('click', () => this._drawCard());
    }

    // Discard pile
    const discard = document.createElement('div');
    discard.className = 'discard-pile';
    discard.style.cssText = `
      position: relative;
      width: 80px;
      height: 120px;
    `;

    if (this.state.topCard) {
      discard.appendChild(this._renderCard(this.state.topCard, { disabled: true, large: true }));
    }

    div.appendChild(deck);
    div.appendChild(discard);

    return div;
  }

  /**
   * Render player's hand
   * @private
   */
  _renderHand() {
    const div = document.createElement('div');
    div.className = 'player-hand';
    div.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
      justify-content: center;
      padding: var(--spacing-4);
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
      min-height: 150px;
      max-width: 100%;
    `;

    const hand = this.state.myHand || [];
    const isMyTurn = this.state.currentPlayer === this.playerId;
    const topCard = this.state.topCard;

    hand.forEach(card => {
      const playable = isMyTurn &&
                       this.state.drawPending === 0 &&
                       canPlayCard(card, topCard, this.state.currentColor);

      const cardEl = this._renderCard(card, {
        disabled: !playable,
        onClick: playable ? () => this._selectCard(card) : null,
        selected: this.selectedCard?.id === card.id
      });

      div.appendChild(cardEl);
    });

    if (hand.length === 0) {
      div.innerHTML = '<p style="color: var(--text-tertiary);">没有手牌</p>';
    }

    return div;
  }

  /**
   * Render a card
   * @private
   */
  _renderCard(card, options = {}) {
    const { disabled, onClick, selected, large } = options;

    const div = document.createElement('div');
    div.className = 'uno-card';
    div.style.cssText = `
      width: ${large ? '80px' : '60px'};
      height: ${large ? '120px' : '90px'};
      background: ${COLOR_CSS[card.color] || COLOR_CSS[null]};
      border-radius: var(--radius-base);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${large ? 'var(--text-2xl)' : 'var(--text-xl)'};
      font-weight: var(--font-bold);
      cursor: ${disabled ? 'default' : 'pointer'};
      box-shadow: ${selected ? '0 0 0 3px var(--primary-500)' : 'var(--shadow-sm)'};
      transition: all var(--transition-fast);
      opacity: ${disabled && !large ? '0.5' : '1'};
      position: relative;
      ${card.color === null ? `
        background: linear-gradient(135deg, var(--uno-red) 25%, var(--uno-blue) 25%, var(--uno-blue) 50%, var(--uno-green) 50%, var(--uno-green) 75%, var(--uno-yellow) 75%);
      ` : ''}
    `;

    // Card content
    const content = document.createElement('span');
    content.style.cssText = `
      background: rgba(255,255,255,0.9);
      color: ${COLOR_CSS[card.color] || 'black'};
      width: 70%;
      height: 70%;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    content.textContent = getCardDisplayText(card);
    div.appendChild(content);

    if (!disabled && onClick) {
      div.addEventListener('mouseenter', () => {
        div.style.transform = 'translateY(-8px)';
        div.style.boxShadow = 'var(--shadow-lg)';
      });
      div.addEventListener('mouseleave', () => {
        div.style.transform = '';
        div.style.boxShadow = selected ? '0 0 0 3px var(--primary-500)' : 'var(--shadow-sm)';
      });
      div.addEventListener('click', onClick);
    }

    return div;
  }

  /**
   * Render color picker
   * @private
   */
  _renderColorPicker() {
    const div = document.createElement('div');
    div.className = 'color-picker';
    div.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-primary);
      padding: var(--spacing-6);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      z-index: var(--z-modal);
    `;

    div.innerHTML = `
      <h3 style="margin: 0 0 var(--spacing-4) 0; text-align: center;">选择颜色</h3>
      <div style="display: flex; gap: var(--spacing-3);">
        ${COLORS.map(color => `
          <button class="color-btn" data-color="${color}" style="
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: ${COLOR_CSS[color]};
            cursor: pointer;
            transition: transform var(--transition-fast);
          "></button>
        `).join('')}
      </div>
    `;

    div.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
      btn.addEventListener('mouseleave', () => btn.style.transform = '');
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        this._playCard(this.selectedCard, color);
        this.showColorPicker = false;
      });
    });

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bg-overlay);
      z-index: calc(var(--z-modal) - 1);
    `;
    backdrop.addEventListener('click', () => {
      this.showColorPicker = false;
      this.selectedCard = null;
      this._rerender();
    });

    const container = document.createElement('div');
    container.appendChild(backdrop);
    container.appendChild(div);

    return container;
  }

  /**
   * Render action buttons
   * @param {Object} state
   * @param {string} playerId
   * @param {Function} onAction
   * @returns {HTMLElement}
   */
  renderActions(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;

    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: var(--spacing-3);';

    const isMyTurn = state.currentPlayer === playerId;
    const canSkip = state.lastAction?.type === 'drew' && state.lastAction?.playerId === playerId;
    const myHand = state.myHand || [];

    // Draw card button
    const drawBtn = document.createElement('button');
    drawBtn.className = 'btn btn-secondary';
    drawBtn.textContent = state.drawPending > 0 ? `摸 ${state.drawPending} 张牌` : '摸牌';
    drawBtn.disabled = !isMyTurn;
    drawBtn.addEventListener('click', () => this._drawCard());

    // Skip turn button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-secondary';
    skipBtn.textContent = '跳过';
    skipBtn.disabled = !canSkip;
    skipBtn.addEventListener('click', () => this._skipTurn());

    // UNO button
    const unoBtn = document.createElement('button');
    unoBtn.className = 'btn btn-primary';
    unoBtn.textContent = 'UNO!';
    unoBtn.disabled = myHand.length > 2;
    unoBtn.addEventListener('click', () => this._callUno());

    div.appendChild(drawBtn);
    div.appendChild(skipBtn);
    div.appendChild(unoBtn);

    return div;
  }

  /**
   * Update state
   * @param {Object} state
   */
  updateState(state) {
    this.state = state;
    this.selectedCard = null;
    this.showColorPicker = false;
  }

  /**
   * Select a card
   * @private
   */
  _selectCard(card) {
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      this.selectedCard = card;
      this.showColorPicker = true;
      this._rerender();
    } else {
      this._playCard(card);
    }
  }

  /**
   * Play a card
   * @private
   */
  _playCard(card, chosenColor = null) {
    this.onAction?.({
      actionType: UNO_ACTIONS.PLAY_CARD,
      actionData: {
        cardId: card.id,
        chosenColor
      }
    });
  }

  /**
   * Draw a card
   * @private
   */
  _drawCard() {
    this.onAction?.({
      actionType: UNO_ACTIONS.DRAW_CARD,
      actionData: {}
    });
  }

  /**
   * Skip turn
   * @private
   */
  _skipTurn() {
    this.onAction?.({
      actionType: UNO_ACTIONS.SKIP_TURN,
      actionData: {}
    });
  }

  /**
   * Call UNO
   * @private
   */
  _callUno() {
    this.onAction?.({
      actionType: UNO_ACTIONS.CALL_UNO,
      actionData: {}
    });
  }

  /**
   * Trigger rerender
   * @private
   */
  _rerender() {
    // This would trigger a rerender in the parent component
    // For now, we'll handle color picker visibility through state
  }
}

export default UnoUI;
