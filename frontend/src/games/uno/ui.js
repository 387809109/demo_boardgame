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
 * Color sort order for hand sorting
 */
const COLOR_SORT_ORDER = {
  red: 0,
  yellow: 1,
  green: 2,
  blue: 3,
  null: 4 // Wild cards at the end
};

/**
 * Card type sort order (within same color)
 */
const TYPE_SORT_ORDER = {
  number: 0,
  skip: 1,
  reverse: 2,
  draw_two: 3,
  wild: 0,
  wild_draw_four: 1
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
    this.sortHand = false; // Whether to display sorted hand
    this._container = null; // Reference to rendered container for re-rendering
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
    this._container = container;

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
    const container = document.createElement('div');
    container.className = 'player-hand-container';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2);
      align-items: center;
      width: 100%;
    `;

    // Sort toggle button
    const sortBtn = document.createElement('button');
    sortBtn.className = 'btn btn-ghost btn-sm';
    sortBtn.style.cssText = `
      font-size: var(--text-xs);
      padding: var(--spacing-1) var(--spacing-2);
    `;
    sortBtn.textContent = this.sortHand ? '恢复原顺序' : '整理手牌';
    sortBtn.addEventListener('click', () => {
      this.sortHand = !this.sortHand;
      this._rerender();
    });
    container.appendChild(sortBtn);

    const div = document.createElement('div');
    div.className = 'player-hand';
    div.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
      justify-content: center;
      padding: var(--spacing-4);
      padding-top: var(--spacing-6);
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
      min-height: 150px;
      max-width: 100%;
    `;

    const hand = this.state.myHand || [];
    const isMyTurn = this.state.currentPlayer === this.playerId;
    const topCard = this.state.topCard;

    // Get display order (either original or sorted)
    const displayOrder = this._getHandDisplayOrder(hand);

    displayOrder.forEach(({ card }) => {
      const playable = isMyTurn &&
                       this.state.drawPending === 0 &&
                       canPlayCard(card, topCard, this.state.currentColor);

      const cardEl = this._renderCard(card, {
        disabled: !playable,
        playable, // Pass playable state for elevation
        onClick: playable ? () => this._selectCard(card) : null,
        selected: this.selectedCard?.id === card.id
      });

      div.appendChild(cardEl);
    });

    if (hand.length === 0) {
      div.innerHTML = '<p style="color: var(--text-tertiary);">没有手牌</p>';
    }

    container.appendChild(div);
    return container;
  }

  /**
   * Get hand display order (visual only, preserves original array)
   * @private
   * @param {Array} hand - Original hand array
   * @returns {Array} Array of { card, originalIndex } in display order
   */
  _getHandDisplayOrder(hand) {
    // Create indexed array
    const indexed = hand.map((card, index) => ({ card, originalIndex: index }));

    if (!this.sortHand) {
      return indexed;
    }

    // Sort by color, then by type/value
    return indexed.slice().sort((a, b) => {
      const cardA = a.card;
      const cardB = b.card;

      // First sort by color
      const colorA = COLOR_SORT_ORDER[cardA.color] ?? 99;
      const colorB = COLOR_SORT_ORDER[cardB.color] ?? 99;
      if (colorA !== colorB) {
        return colorA - colorB;
      }

      // Then by type
      const typeA = TYPE_SORT_ORDER[cardA.type] ?? 99;
      const typeB = TYPE_SORT_ORDER[cardB.type] ?? 99;
      if (typeA !== typeB) {
        return typeA - typeB;
      }

      // Finally by value (for number cards)
      const valueA = cardA.value ?? 99;
      const valueB = cardB.value ?? 99;
      return valueA - valueB;
    });
  }

  /**
   * Render a card
   * @private
   */
  _renderCard(card, options = {}) {
    const { disabled, playable, onClick, selected, large } = options;

    // Playable cards are elevated by default to distinguish from unplayable ones
    const defaultElevation = playable && !large ? 'translateY(-6px)' : '';

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
      box-shadow: ${selected ? '0 0 0 3px var(--primary-500)' : playable ? 'var(--shadow-md)' : 'var(--shadow-sm)'};
      transition: all var(--transition-fast);
      opacity: ${disabled && !large ? '0.5' : '1'};
      position: relative;
      transform: ${defaultElevation};
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
        div.style.transform = 'translateY(-12px)'; // Further elevation on hover
        div.style.boxShadow = 'var(--shadow-lg)';
      });
      div.addEventListener('mouseleave', () => {
        div.style.transform = defaultElevation;
        div.style.boxShadow = selected ? '0 0 0 3px var(--primary-500)' : playable ? 'var(--shadow-md)' : 'var(--shadow-sm)';
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
   * Trigger rerender of the UI
   * @private
   */
  _rerender() {
    if (!this._container) return;

    // Clear and re-render the container
    this._container.innerHTML = '';

    // Game info
    this._container.appendChild(this._renderGameInfo());

    // Discard pile and deck
    this._container.appendChild(this._renderTable());

    // Player's hand
    this._container.appendChild(this._renderHand());

    // Color picker (if needed)
    if (this.showColorPicker) {
      this._container.appendChild(this._renderColorPicker());
    }
  }
}

export default UnoUI;
