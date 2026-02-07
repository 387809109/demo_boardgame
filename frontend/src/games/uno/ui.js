/**
 * UNO Game UI
 * @module games/uno/ui
 */

import { COLORS, CARD_TYPES, canPlayCard, getCardDisplayText, getColorName } from './rules.js';
import { UNO_ACTIONS } from './index.js';
import { scheduleRender } from '../../utils/render-scheduler.js';

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
 * Adapted for circular player ring layout - game table renders in the center
 */
export class UnoUI {
  constructor() {
    this.state = null;
    this.playerId = null;
    this.onAction = null;
    this.selectedCard = null;
    this.showColorPicker = false;
    this.sortHand = false;
    this._container = null;
    this._cardDataMap = new Map();
    this._handContainer = null;
    this._gameInfoEl = null;
    this._tableEl = null;
    this._colorPickerEl = null;
    this._boundHandleCardClick = this._handleCardClick.bind(this);
    this._gameBoard = null;
    this._lastCurrentPlayer = null;

    // Flag for GameBoard - mount game UI below the ring, not in center
    // The ring center shows direction indicator; game content below
    this.mountInRingCenter = false;
  }

  /**
   * Set reference to GameBoard for timer control
   * @param {Object} gameBoard - GameBoard instance
   */
  setGameBoard(gameBoard) {
    this._gameBoard = gameBoard;
    // Initialize timer if state is already set
    if (this.state) {
      this._updateTurnTimer();
    }
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
    this._cardDataMap.clear();

    const container = document.createElement('div');
    container.className = 'uno-game';
    container.style.cssText = `
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-4);
      align-items: center;
      padding: var(--spacing-4) 0;
    `;
    this._container = container;

    // Game info bar (current color, draw pending, etc.)
    this._gameInfoEl = this._renderGameInfo();
    container.appendChild(this._gameInfoEl);

    // Discard pile and deck (centered table area)
    this._tableEl = this._renderTable();
    container.appendChild(this._tableEl);

    // Player's hand
    const handWrapper = this._renderHand();
    container.appendChild(handWrapper);

    // Color picker (if needed)
    if (this.showColorPicker) {
      this._colorPickerEl = this._renderColorPicker();
      container.appendChild(this._colorPickerEl);
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
      padding: var(--spacing-2) var(--spacing-4);
      background: var(--bg-tertiary);
      border-radius: var(--radius-lg);
    `;

    this._updateGameInfoContent(div);
    return div;
  }

  /**
   * Update game info content without recreating the element
   * Direction indicator is now in the player ring center, so removed from here
   * @private
   */
  _updateGameInfoContent(el) {
    const currentColor = this.state.currentColor || 'none';
    el.innerHTML = `
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
    `;
  }

  /**
   * Render table (deck and discard pile)
   * Compact layout for center of player ring
   * @private
   */
  _renderTable() {
    const div = document.createElement('div');
    div.className = 'game-table';
    div.style.cssText = `
      display: flex;
      gap: var(--spacing-6);
      align-items: center;
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-lg);
    `;

    // Deck
    const deck = document.createElement('div');
    deck.className = 'deck';
    deck.style.cssText = `
      width: 70px;
      height: 100px;
      background: var(--uno-black);
      border-radius: var(--radius-base);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: var(--text-lg);
      cursor: ${this.state.currentPlayer === this.playerId ? 'pointer' : 'default'};
      box-shadow: var(--shadow-md);
      position: relative;
      transition: transform var(--transition-fast);
    `;
    deck.innerHTML = `
      <span style="font-weight: var(--font-bold);">UNO</span>
      <span style="
        font-size: var(--text-xs);
        margin-top: var(--spacing-1);
        opacity: 0.8;
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
      width: 70px;
      height: 100px;
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
      this._scheduleUpdate('hand');
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
      min-height: 130px;
      max-width: 100%;
    `;
    this._handContainer = div;

    // Event delegation for card clicks
    div.addEventListener('click', this._boundHandleCardClick);

    this._updateHandContent();

    container.appendChild(div);
    return container;
  }

  /**
   * Handle delegated card click events
   * @private
   */
  _handleCardClick(e) {
    const cardEl = e.target.closest('.uno-card[data-card-id]');
    if (!cardEl) return;

    const cardId = cardEl.dataset.cardId;
    const isPlayable = cardEl.dataset.playable === 'true';

    if (!isPlayable) return;

    const card = this._cardDataMap.get(cardId);
    if (card) {
      this._selectCard(card);
    }
  }

  /**
   * Update hand content without recreating the container
   * @private
   */
  _updateHandContent() {
    if (!this._handContainer) return;

    const hand = this.state.myHand || [];
    const isMyTurn = this.state.currentPlayer === this.playerId;
    const topCard = this.state.topCard;

    this._cardDataMap.clear();
    this._handContainer.innerHTML = '';

    if (hand.length === 0) {
      this._handContainer.innerHTML = '<p style="color: var(--text-tertiary);">没有手牌</p>';
      return;
    }

    // Get display order (either original or sorted)
    const displayOrder = this._getHandDisplayOrder(hand);

    const fragment = document.createDocumentFragment();

    displayOrder.forEach(({ card }) => {
      const playable = isMyTurn &&
                       this.state.drawPending === 0 &&
                       canPlayCard(card, topCard, this.state.currentColor);

      // Store card data for event delegation
      this._cardDataMap.set(card.id, card);

      const cardEl = this._renderCard(card, {
        disabled: !playable,
        playable,
        selected: this.selectedCard?.id === card.id
      });

      fragment.appendChild(cardEl);
    });

    this._handContainer.appendChild(fragment);
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
   * Render a card using CSS classes
   * @private
   */
  _renderCard(card, options = {}) {
    const { disabled, playable, selected, large } = options;

    const div = document.createElement('div');

    // Build class list
    const classes = ['uno-card'];

    // Color class
    if (card.color === null) {
      classes.push('uno-card--wild');
    } else if (card.color) {
      classes.push(`uno-card--${card.color}`);
    }

    // State classes
    if (large) {
      classes.push('uno-card--large');
    } else if (playable) {
      classes.push('uno-card--playable');
    } else if (disabled) {
      classes.push('uno-card--disabled');
    }

    if (selected) {
      classes.push('uno-card--selected');
    }

    div.className = classes.join(' ');

    // Adjust size for the compact table layout
    if (large) {
      div.style.cssText = `
        width: 70px;
        height: 100px;
        font-size: var(--text-xl);
      `;
    }

    // Data attributes for event delegation (only for hand cards)
    if (!large) {
      div.dataset.cardId = card.id;
      div.dataset.playable = String(!!playable);
    }

    // Card content
    const content = document.createElement('span');
    content.className = 'uno-card__content';
    content.textContent = getCardDisplayText(card);
    div.appendChild(content);

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
      this._scheduleUpdate('colorPicker');
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

    // Update turn timer
    this._updateTurnTimer();
  }

  /**
   * Update turn timer based on current player
   * @private
   */
  _updateTurnTimer() {
    if (!this._gameBoard) return;

    const currentPlayer = this.state?.currentPlayer;
    const actionTime = this.state?.options?.actionTime || 0;

    // Check if turn changed
    if (currentPlayer !== this._lastCurrentPlayer) {
      this._lastCurrentPlayer = currentPlayer;

      // Stop any existing timer
      this._gameBoard.stopTimer();

      // Start new timer if actionTime is configured
      if (actionTime > 0 && currentPlayer) {
        const isMyTurn = currentPlayer === this.playerId;
        const label = isMyTurn ? '你的回合' : '回合时间';
        this._gameBoard.startTimer(actionTime, label);
      }
    }
  }

  /**
   * Select a card
   * @private
   */
  _selectCard(card) {
    if (card.type === CARD_TYPES.WILD || card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      this.selectedCard = card;
      this.showColorPicker = true;
      this._scheduleUpdate('all');
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
   * Schedule a targeted update using requestAnimationFrame
   * @private
   * @param {string} section - Section to update: 'gameInfo', 'table', 'hand', 'colorPicker', 'all'
   */
  _scheduleUpdate(section) {
    scheduleRender(() => this._performUpdate(section), `uno-${section}`);
  }

  /**
   * Perform targeted update
   * @private
   */
  _performUpdate(section) {
    if (!this._container) return;

    switch (section) {
      case 'gameInfo':
        if (this._gameInfoEl) {
          this._updateGameInfoContent(this._gameInfoEl);
        }
        break;

      case 'table':
        if (this._tableEl) {
          const newTable = this._renderTable();
          this._tableEl.replaceWith(newTable);
          this._tableEl = newTable;
        }
        break;

      case 'hand':
        this._updateHandContent();
        // Update sort button text
        const sortBtn = this._container.querySelector('.player-hand-container .btn');
        if (sortBtn) {
          sortBtn.textContent = this.sortHand ? '恢复原顺序' : '整理手牌';
        }
        break;

      case 'colorPicker':
        // Remove existing color picker if present
        if (this._colorPickerEl) {
          this._colorPickerEl.remove();
          this._colorPickerEl = null;
        }
        // Add new one if needed
        if (this.showColorPicker) {
          this._colorPickerEl = this._renderColorPicker();
          this._container.appendChild(this._colorPickerEl);
        }
        break;

      case 'all':
      default:
        this._rerender();
        break;
    }
  }

  /**
   * Trigger full rerender of the UI
   * @private
   */
  _rerender() {
    if (!this._container) return;

    // Clear and re-render the container
    this._container.innerHTML = '';
    this._cardDataMap.clear();

    // Game info
    this._gameInfoEl = this._renderGameInfo();
    this._container.appendChild(this._gameInfoEl);

    // Discard pile and deck
    this._tableEl = this._renderTable();
    this._container.appendChild(this._tableEl);

    // Player's hand
    const handWrapper = this._renderHand();
    this._container.appendChild(handWrapper);

    // Color picker (if needed)
    if (this.showColorPicker) {
      this._colorPickerEl = this._renderColorPicker();
      this._container.appendChild(this._colorPickerEl);
    }
  }
}

export default UnoUI;
