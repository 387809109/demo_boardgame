/**
 * Here I Stand — Power Panel
 *
 * Sidebar showing the player's power status:
 * - VP track
 * - Hand size
 * - Wars & alliances
 * - Key cities controlled
 * - Special status (excommunicated, etc.)
 */

const POWER_LABELS = {
  ottoman: '奥斯曼帝国',
  hapsburg: '哈布斯堡',
  england: '英格兰',
  france: '法兰西',
  papacy: '教廷',
  protestant: '新教',
};

const POWER_COLORS = {
  ottoman: '#2e7d32',
  hapsburg: '#f9a825',
  england: '#c62828',
  france: '#1565c0',
  papacy: '#7b1fa2',
  protestant: '#1a1a1a',
};

export class PowerPanel {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-power-panel';
    this._el.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      background: var(--bg-secondary, #f8fafc);
      border-radius: 6px;
      font-size: 12px;
      border: 1px solid var(--border-light, #e2e8f0);
      min-width: 180px;
    `;
    return this._el;
  }

  /**
   * @param {Object} state - Game state
   * @param {string} playerPower - The power this player controls
   */
  update(state, playerPower) {
    if (!this._el || !state) return;
    this._el.innerHTML = '';

    // Power header
    const color = POWER_COLORS[playerPower] || '#666';
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${color};
      margin-bottom: 2px;
    `;
    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 12px; height: 12px;
      border-radius: 50%;
      background: ${color};
      flex-shrink: 0;
    `;
    const label = document.createElement('span');
    label.style.cssText = 'font-weight: 700; font-size: 14px;';
    label.textContent = POWER_LABELS[playerPower] || playerPower;
    header.appendChild(dot);
    header.appendChild(label);
    this._el.appendChild(header);

    // VP
    const vp = state.vp ? (state.vp[playerPower] || 0) : 0;
    this._addRow('胜利点', `${vp} VP`, '#5c6bc0');

    // Hand size
    const hand = state.hands?.[playerPower];
    const handSize = Array.isArray(hand) ? hand.length : (hand || 0);
    this._addRow('手牌', `${handSize} 张`);

    // Cards in deck
    if (state.deckSize !== undefined) {
      this._addRow('牌堆', `${state.deckSize} 张`);
    }

    // Wars
    if (state.wars && state.wars.length > 0) {
      const myWars = state.wars.filter(w =>
        w.a === playerPower || w.b === playerPower
      );
      if (myWars.length > 0) {
        const enemies = myWars.map(w =>
          w.a === playerPower ? w.b : w.a
        ).map(p => POWER_LABELS[p] || p);
        this._addRow('战争', enemies.join(', '), '#c62828');
      }
    }

    // Alliances
    if (state.alliances) {
      const myAlliances = state.alliances.filter(a =>
        a.a === playerPower || a.b === playerPower
      );
      if (myAlliances.length > 0) {
        const allies = myAlliances.map(a =>
          a.a === playerPower ? a.b : a.a
        ).map(p => POWER_LABELS[p] || p);
        this._addRow('同盟', allies.join(', '), '#2e7d32');
      }
    }

    // Key cities controlled
    if (state.spaces) {
      let keyCount = 0;
      for (const sp of Object.values(state.spaces)) {
        if (sp.controller === playerPower && sp.isKey) keyCount++;
      }
      if (keyCount > 0) {
        this._addRow('关键城市', `${keyCount} 个`);
      }
    }

    // Protestant-specific: reformation spaces
    if (playerPower === 'protestant' && state.protestantSpaces !== undefined) {
      this._addRow('新教空间', `${state.protestantSpaces}`);
    }

    // Excommunication status
    if (state.excommunicatedRulers?.[playerPower]) {
      this._addRow('状态', '被绝罚', '#c62828');
    }

    // Schmalkaldic League
    if (state.schmalkaldicLeague) {
      this._addRow('施马尔卡尔登', '已成立', '#2e7d32');
    }
  }

  _addRow(label, value, valueColor) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
    `;
    const labelEl = document.createElement('span');
    labelEl.style.color = 'var(--text-secondary, #64748b)';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.style.cssText = `font-weight: 600; ${valueColor ? `color: ${valueColor};` : ''}`;
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    this._el.appendChild(row);
  }
}
