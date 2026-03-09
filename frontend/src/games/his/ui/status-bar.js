/**
 * Here I Stand — Status Bar
 *
 * Displays turn number, phase, active power, and VP scores.
 */

const PHASE_LABELS = {
  card_draw: '抽牌阶段',
  diplomacy: '外交阶段',
  spring_deployment: '春季部署',
  action: '行动阶段',
  winter: '冬季阶段',
  luther95: '95条论纲',
  diet_of_worms: '沃尔姆斯议会',
  new_world: '新世界结算',
};

const POWER_LABELS = {
  ottoman: '奥斯曼',
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

export class StatusBar {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-status-bar';
    this._el.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      background: var(--bg-secondary, #f8fafc);
      border-radius: 6px;
      font-size: 13px;
      flex-wrap: wrap;
      border: 1px solid var(--border-light, #e2e8f0);
    `;
    return this._el;
  }

  update(state) {
    if (!this._el || !state) return;
    this._el.innerHTML = '';

    // Turn
    const turn = this._badge(`T${state.turn || 1}`, '#5c6bc0');
    this._el.appendChild(turn);

    // Phase
    const phaseLabel = PHASE_LABELS[state.phase] || state.phase || '—';
    const phase = this._badge(phaseLabel, '#78909c');
    this._el.appendChild(phase);

    // Active power
    if (state.activePower) {
      const color = POWER_COLORS[state.activePower] || '#666';
      const label = POWER_LABELS[state.activePower] || state.activePower;
      const power = this._badge(`▶ ${label}`, color);
      this._el.appendChild(power);
    }

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'flex: 1;';
    this._el.appendChild(sep);

    // VP scores
    if (state.vp) {
      for (const [power, score] of Object.entries(state.vp)) {
        const color = POWER_COLORS[power] || '#666';
        const vp = this._badge(`${score}VP`, color, true);
        vp.title = POWER_LABELS[power] || power;
        this._el.appendChild(vp);
      }
    }
  }

  _badge(text, color, small = false) {
    const el = document.createElement('span');
    el.style.cssText = `
      display: inline-flex;
      align-items: center;
      padding: ${small ? '1px 5px' : '2px 8px'};
      border-radius: 4px;
      background: ${color};
      color: ${this._contrastColor(color)};
      font-size: ${small ? '11px' : '12px'};
      font-weight: 600;
      white-space: nowrap;
    `;
    el.textContent = text;
    return el;
  }

  _contrastColor(hex) {
    if (!hex || hex[0] !== '#') return '#fff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000' : '#fff';
  }
}
