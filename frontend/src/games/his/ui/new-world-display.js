/**
 * Here I Stand — New World Display
 *
 * Shows modal overlays for New World exploration and conquest results:
 *   - Exploration: dice roll, discovery result, VP gained
 *   - Circumnavigation: attempt and success/failure
 *   - Conquest: dice roll, conquistador, VP gained
 *   - Colony: placement notification
 */

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#c6873e', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#2c3e50'
};

const POWER_LABELS = {
  ottoman: '奥斯曼', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教'
};

export class NewWorldDisplay {
  constructor() {
    this._overlayEl = null;
    this._visible = false;
  }

  createOverlay() {
    this._overlayEl = document.createElement('div');
    this._overlayEl.className = 'his-newworld-overlay';
    this._overlayEl.style.cssText = `
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 110;
      justify-content: center;
      align-items: center;
    `;
    this._overlayEl.addEventListener('click', (e) => {
      if (e.target === this._overlayEl) this.hide();
    });
    return this._overlayEl;
  }

  /** Show exploration result (discovery, no discovery, explorer lost) */
  showExploration(data) {
    this._show(this._buildExplorationModal(data));
  }

  /** Show circumnavigation result */
  showCircumnavigation(data) {
    this._show(this._buildCircumnavigationModal(data));
  }

  /** Show conquest result */
  showConquest(data) {
    this._show(this._buildConquestModal(data));
  }

  hide() {
    if (this._overlayEl) this._overlayEl.style.display = 'none';
    this._visible = false;
  }

  get visible() { return this._visible; }

  _show(modal) {
    if (!this._overlayEl) return;
    this._overlayEl.innerHTML = '';
    this._overlayEl.appendChild(modal);
    this._overlayEl.style.display = 'flex';
    this._visible = true;
  }

  // ── Exploration Modal ──────────────────────────────────────────

  _buildExplorationModal(data) {
    const { power, explorer, dice, roll, discovery, vp, reason } = data;
    const color = POWER_COLORS[power] || '#666';
    const isSuccess = !!discovery;
    const isLost = data.type === 'explorer_lost';

    const modal = this._modalShell();
    modal.appendChild(this._header(
      '新世界探索',
      isLost ? '#c62828' : (isSuccess ? '#2e7d32' : '#f57f17')
    ));

    const body = this._body();

    // Explorer & Power info
    body.appendChild(this._infoRow(
      `${POWER_LABELS[power] || power}`,
      explorer ? `探险家: ${explorer}` : ''
    ));

    // Dice display
    if (dice) {
      body.appendChild(this._diceRow(dice, roll));
    }

    // Result
    const result = document.createElement('div');
    result.style.cssText = `
      text-align:center;padding:10px;border-radius:6px;margin-top:12px;
      font-weight:700;font-size:14px;
    `;

    if (isLost) {
      result.style.background = '#ffebee';
      result.style.color = '#c62828';
      result.textContent = `探险家 ${explorer} 失踪!`;
    } else if (isSuccess) {
      result.style.background = '#e8f5e9';
      result.style.color = '#2e7d32';
      result.textContent = `发现 ${discovery}! +${vp} VP`;
    } else {
      result.style.background = '#fff8e1';
      result.style.color = '#f57f17';
      result.textContent = reason === 'all_claimed'
        ? '所有发现均已被占领'
        : '未有发现';
    }
    body.appendChild(result);

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Circumnavigation Modal ─────────────────────────────────────

  _buildCircumnavigationModal(data) {
    const { power, explorer, dice, roll, vp, bonusCard } = data;
    const isSuccess = data.type === 'circumnavigation_success';

    const modal = this._modalShell();
    modal.appendChild(this._header(
      '环球航行',
      isSuccess ? '#1565c0' : '#c62828'
    ));

    const body = this._body();

    body.appendChild(this._infoRow(
      `${POWER_LABELS[power] || power}`,
      `探险家: ${explorer}`
    ));

    if (dice) {
      body.appendChild(this._diceRow(dice, roll));
    }

    const result = document.createElement('div');
    result.style.cssText = `
      text-align:center;padding:10px;border-radius:6px;margin-top:12px;
      font-weight:700;font-size:14px;
    `;

    if (isSuccess) {
      result.style.background = '#e3f2fd';
      result.style.color = '#1565c0';
      let text = `环球航行成功! +${vp} VP`;
      if (bonusCard) text += ' + 抽1张牌';
      result.textContent = text;
    } else {
      result.style.background = '#ffebee';
      result.style.color = '#c62828';
      result.textContent = `环球航行失败! 探险家 ${explorer} 遇难`;
      if (data.pacificStraitVp) {
        const vpNote = document.createElement('div');
        vpNote.style.cssText = 'font-size:11px;color:#f57f17;margin-top:4px;font-weight:600;';
        vpNote.textContent = `已获得太平洋海峡 +${data.pacificStraitVp} VP`;
        result.appendChild(vpNote);
      }
    }
    body.appendChild(result);

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Conquest Modal ─────────────────────────────────────────────

  _buildConquestModal(data) {
    const { power, conquistador, dice, roll } = data;
    const isSuccess = data.type === 'conquest_made';
    const isKilled = data.result === 'killed';

    const modal = this._modalShell();
    modal.appendChild(this._header(
      '新世界征服',
      isKilled ? '#c62828' : (isSuccess ? '#2e7d32' : '#f57f17')
    ));

    const body = this._body();

    body.appendChild(this._infoRow(
      `${POWER_LABELS[power] || power}`,
      conquistador ? `征服者: ${conquistador}` : ''
    ));

    if (dice) {
      body.appendChild(this._diceRow(dice, roll));
    }

    const result = document.createElement('div');
    result.style.cssText = `
      text-align:center;padding:10px;border-radius:6px;margin-top:12px;
      font-weight:700;font-size:14px;
    `;

    if (isSuccess) {
      result.style.background = '#e8f5e9';
      result.style.color = '#2e7d32';
      result.textContent = `征服 ${data.conquest}! +${data.vp} VP`;
    } else if (isKilled) {
      result.style.background = '#ffebee';
      result.style.color = '#c62828';
      result.textContent = conquistador
        ? `征服者 ${conquistador} 阵亡!`
        : '征服失败 — 部队被消灭';
    } else {
      result.style.background = '#fff8e1';
      result.style.color = '#f57f17';
      result.textContent = data.result === 'all_claimed'
        ? '所有征服目标均已被占领'
        : '征服失败';
    }
    body.appendChild(result);

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Shared Helpers ─────────────────────────────────────────────

  _modalShell() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 12px;
      max-width: 360px; width: 90%;
      max-height: 80vh; overflow-y: auto;
      box-shadow: 0 12px 48px rgba(0,0,0,0.3);
    `;
    modal.addEventListener('click', (e) => e.stopPropagation());
    return modal;
  }

  _header(text, bgColor) {
    const h = document.createElement('div');
    h.style.cssText = `
      background: ${bgColor || '#5c6bc0'};
      color: #fff; padding: 12px 20px;
      border-radius: 12px 12px 0 0;
      font-weight: 700; font-size: 16px;
      text-align: center;
    `;
    h.textContent = text;
    return h;
  }

  _body() {
    const b = document.createElement('div');
    b.style.cssText = 'padding: 16px 20px;';
    return b;
  }

  _infoRow(left, right) {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      font-size:13px;color:#475569;
    `;
    row.innerHTML = `
      <span style="font-weight:600;">${left}</span>
      <span style="color:#94a3b8;">${right}</span>
    `;
    return row;
  }

  _diceRow(dice, total) {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;justify-content:center;align-items:center;gap:8px;
      margin:12px 0;
    `;

    for (const d of dice) {
      const die = document.createElement('div');
      die.style.cssText = `
        width:36px;height:36px;border-radius:6px;
        display:flex;align-items:center;justify-content:center;
        font-size:20px;font-weight:700;
        background:#f1f5f9;color:#1e293b;
        border:2px solid #e2e8f0;
      `;
      die.textContent = d;
      row.appendChild(die);
    }

    if (dice.length >= 2) {
      const plus = document.createElement('span');
      plus.style.cssText = 'font-size:14px;color:#94a3b8;font-weight:600;';
      plus.textContent = '+ mod =';
      row.appendChild(plus);

      const totalEl = document.createElement('div');
      totalEl.style.cssText = `
        font-size:24px;font-weight:800;color:#1e293b;
      `;
      totalEl.textContent = total;
      row.appendChild(totalEl);
    }

    return row;
  }

  _closeBtn() {
    const row = document.createElement('div');
    row.style.cssText = 'text-align:center;margin-top:16px;';
    const btn = document.createElement('button');
    btn.textContent = '关闭';
    btn.style.cssText = `
      padding:8px 32px;border-radius:6px;border:1px solid #cbd5e1;
      background:#fff;color:#64748b;cursor:pointer;
      font-size:13px;font-weight:600;
    `;
    btn.addEventListener('click', () => this.hide());
    row.appendChild(btn);
    return row;
  }
}
