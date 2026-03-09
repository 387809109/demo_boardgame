/**
 * Here I Stand — Hand Panel
 *
 * Displays the player's card hand with play/discard actions.
 */

const CARD_TYPE_LABELS = {
  home: '本势力',
  mandatory_event: '强制事件',
  event: '事件',
  combat: '战斗',
  response: '响应',
};

const POWER_COLORS = {
  ottoman: '#2e7d32',
  hapsburg: '#f9a825',
  england: '#c62828',
  france: '#1565c0',
  papacy: '#7b1fa2',
  protestant: '#1a1a1a',
};

export class HandPanel {
  constructor() {
    this._el = null;
    this._onAction = null;
    this._selectedIndex = -1;
  }

  /**
   * @param {Function} onAction - Callback for card actions
   */
  render(onAction) {
    this._onAction = onAction;
    this._el = document.createElement('div');
    this._el.className = 'his-hand-panel';
    this._el.style.cssText = `
      display: flex;
      gap: 6px;
      padding: 8px;
      overflow-x: auto;
      background: var(--bg-tertiary, #f1f5f9);
      border-radius: 6px;
      min-height: 80px;
      align-items: stretch;
      border: 1px solid var(--border-light, #e2e8f0);
    `;
    return this._el;
  }

  /**
   * Update hand display
   * @param {Object[]} cards - Array of card objects in hand
   * @param {string} playerPower - The player's power
   * @param {boolean} canPlay - Whether the player can play cards right now
   */
  update(cards, playerPower, canPlay = false) {
    if (!this._el) return;
    this._el.innerHTML = '';

    if (!cards || cards.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        color: var(--text-tertiary, #94a3b8);
        font-style: italic;
        display: flex;
        align-items: center;
        padding: 0 12px;
      `;
      empty.textContent = '手牌为空';
      this._el.appendChild(empty);
      return;
    }

    cards.forEach((card, index) => {
      const cardEl = this._renderCard(card, index, playerPower, canPlay);
      this._el.appendChild(cardEl);
    });
  }

  _renderCard(card, index, playerPower, canPlay) {
    const el = document.createElement('div');
    const isSelected = index === this._selectedIndex;
    const associatedPower = card.associatedPower || '';
    const borderColor = POWER_COLORS[associatedPower] || '#94a3b8';

    el.className = 'his-card';
    el.style.cssText = `
      min-width: 100px;
      max-width: 120px;
      padding: 6px 8px;
      border: 2px solid ${isSelected ? '#2196f3' : borderColor};
      border-radius: 6px;
      background: ${isSelected ? '#e3f2fd' : '#fff'};
      cursor: ${canPlay ? 'pointer' : 'default'};
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 11px;
      transition: transform 0.15s, box-shadow 0.15s;
      flex-shrink: 0;
      ${isSelected ? 'transform: translateY(-4px); box-shadow: 0 4px 12px rgba(33,150,243,0.3);' : ''}
    `;

    // Card number + CP
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
    `;
    const numSpan = document.createElement('span');
    numSpan.textContent = `#${card.number}`;
    numSpan.style.color = borderColor;
    const cpSpan = document.createElement('span');
    cpSpan.textContent = `${card.cp || 0}CP`;
    cpSpan.style.cssText = `
      background: #e0e0e0;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 10px;
    `;
    header.appendChild(numSpan);
    header.appendChild(cpSpan);
    el.appendChild(header);

    // Card name
    const name = document.createElement('div');
    name.style.cssText = `
      font-weight: 600;
      font-size: 10px;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    `;
    name.textContent = card.name || `Card ${card.number}`;
    el.appendChild(name);

    // Card type badge
    const type = document.createElement('div');
    type.style.cssText = `
      font-size: 9px;
      color: var(--text-tertiary, #94a3b8);
      margin-top: auto;
    `;
    type.textContent = CARD_TYPE_LABELS[card.type] || card.type || '';
    el.appendChild(type);

    // Click handler
    if (canPlay) {
      el.addEventListener('click', () => {
        this._selectedIndex = isSelected ? -1 : index;
        if (this._onAction) {
          this._onAction({
            type: 'SELECT_CARD',
            data: { index: this._selectedIndex, card }
          });
        }
      });
      el.addEventListener('mouseenter', () => {
        if (!isSelected) el.style.transform = 'translateY(-2px)';
      });
      el.addEventListener('mouseleave', () => {
        if (!isSelected) el.style.transform = '';
      });
    }

    return el;
  }

  /** Clear card selection */
  clearSelection() {
    this._selectedIndex = -1;
  }
}
