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
    this._tooltip = null;
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

    // Hover tooltip (always active)
    el.addEventListener('mouseenter', () => {
      if (canPlay && !isSelected) el.style.transform = 'translateY(-2px)';
      this._showTooltip(card, el);
    });
    el.addEventListener('mouseleave', () => {
      if (canPlay && !isSelected) el.style.transform = '';
      this._hideTooltip();
    });

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
    }

    // Right-click: preview card detail
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this._onAction) {
        this._onAction({
          type: 'PREVIEW_CARD',
          data: { card }
        });
      }
    });

    return el;
  }

  /** Clear card selection */
  clearSelection() {
    this._selectedIndex = -1;
  }

  _showTooltip(card, anchorEl) {
    this._hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'his-card-tooltip';
    tip.style.cssText = `
      position: fixed;
      z-index: 1000;
      background: rgba(255,255,255,0.97);
      border: 1px solid var(--border-default, #cbd5e1);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      max-width: 280px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      pointer-events: none;
      line-height: 1.4;
    `;

    let html = `<div style="font-weight:700;font-size:13px;margin-bottom:4px;">#${card.number} ${card.name}</div>`;
    html += `<div style="display:flex;gap:8px;margin-bottom:6px;">`;
    html += `<span style="background:#5c6bc0;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;">${card.cp || 0} CP</span>`;
    if (card.type) {
      const typeLabel = CARD_TYPE_LABELS[card.type] || card.type;
      html += `<span style="background:#e0e0e0;padding:1px 6px;border-radius:3px;font-size:10px;">${typeLabel}</span>`;
    }
    if (card.deck) {
      html += `<span style="background:#f5f5f5;padding:1px 6px;border-radius:3px;font-size:10px;color:#666;">${card.deck}</span>`;
    }
    if (card.removeAfterPlay) {
      html += `<span style="background:#ffcdd2;padding:1px 6px;border-radius:3px;font-size:10px;color:#c62828;">移除</span>`;
    }
    html += `</div>`;
    if (card.description) {
      html += `<div style="color:#475569;font-size:11px;">${card.description}</div>`;
    }

    tip.innerHTML = html;
    document.body.appendChild(tip);
    this._tooltip = tip;

    // Position above card
    const rect = anchorEl.getBoundingClientRect();
    tip.style.left = `${Math.max(4, rect.left)}px`;
    tip.style.bottom = `${window.innerHeight - rect.top + 6}px`;

    // Clamp to viewport
    requestAnimationFrame(() => {
      const tipRect = tip.getBoundingClientRect();
      if (tipRect.right > window.innerWidth - 4) {
        tip.style.left = `${window.innerWidth - tipRect.width - 4}px`;
      }
      if (tipRect.top < 4) {
        tip.style.bottom = 'auto';
        tip.style.top = `${rect.bottom + 6}px`;
      }
    });
  }

  _hideTooltip() {
    if (this._tooltip && this._tooltip.parentNode) {
      this._tooltip.parentNode.removeChild(this._tooltip);
    }
    this._tooltip = null;
  }
}
