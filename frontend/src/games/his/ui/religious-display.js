/**
 * Here I Stand — Religious Display
 *
 * Shows modal overlays for theological debate and reformation results:
 *   - Debate rolls (per-round dice)
 *   - Debate final result (winner, loser fate, spaces to flip)
 *   - Reformation/counter-reformation attempt (dice vs dice)
 */

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#c6873e', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#2c3e50'
};

const HIT_THRESHOLD = 5;

export class ReligiousDisplay {
  constructor() {
    this._overlayEl = null;
    this._visible = false;
  }

  createOverlay() {
    this._overlayEl = document.createElement('div');
    this._overlayEl.className = 'his-religious-overlay';
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

  /**
   * Show debate result.
   * @param {Object} data - debate_result log entry data
   */
  showDebateResult(data) {
    this._show(this._buildDebateModal(data));
  }

  /**
   * Show reformation attempt result.
   * @param {Object} data - reformation_success/failure log entry data
   * @param {boolean} isCounter - true if counter-reformation
   */
  showReformation(data, isCounter) {
    this._show(this._buildReformationModal(data, isCounter));
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

  // ── Debate Result Modal ────────────────────────────────────────

  _buildDebateModal(data) {
    const isProtWin = data.winner === 'protestant';
    const winColor = isProtWin ? '#2c3e50' : '#7b1fa2';
    const loseColor = isProtWin ? '#7b1fa2' : '#2c3e50';

    const modal = this._modalShell();

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: ${winColor};
      color: #fff; padding: 12px 20px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    `;
    header.innerHTML = `
      <div style="font-size:16px;font-weight:700;">神学辩论结果</div>
      <div style="font-size:12px;opacity:0.8;margin-top:2px;">
        ${isProtWin ? '新教' : '天主教'} 胜利
      </div>
    `;
    modal.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 20px;';

    // Hits comparison
    const hitsRow = document.createElement('div');
    hitsRow.style.cssText = `
      display:flex;justify-content:center;align-items:center;gap:20px;
      margin-bottom:16px;
    `;

    hitsRow.appendChild(this._hitBox(
      '进攻方', data.attackerHits || 0,
      isProtWin ? winColor : loseColor
    ));

    const vs = document.createElement('span');
    vs.style.cssText = 'font-weight:800;font-size:18px;color:#cbd5e1;';
    vs.textContent = 'VS';
    hitsRow.appendChild(vs);

    hitsRow.appendChild(this._hitBox(
      '防守方', data.defenderHits || 0,
      isProtWin ? loseColor : winColor
    ));

    body.appendChild(hitsRow);

    // Spaces to flip
    if (data.spacesToFlip > 0) {
      const flipInfo = document.createElement('div');
      flipInfo.style.cssText = `
        text-align:center;font-size:13px;color:#1e293b;
        padding:8px;background:#f1f5f9;border-radius:6px;margin-bottom:8px;
      `;
      flipInfo.innerHTML = `
        <span style="font-weight:700;">${data.spacesToFlip}</span> 个空间将被翻转为
        <span style="font-weight:700;color:${winColor}">
          ${isProtWin ? '新教' : '天主教'}
        </span>
      `;
      body.appendChild(flipInfo);
    }

    // Loser fate
    if (data.loserFate && data.loserId) {
      const fateEl = document.createElement('div');
      const isBurned = data.loserFate === 'burned';
      fateEl.style.cssText = `
        text-align:center;font-size:12px;margin-top:8px;padding:6px;
        border-radius:6px;font-weight:600;
        background:${isBurned ? '#ffebee' : '#fff3e0'};
        color:${isBurned ? '#c62828' : '#e65100'};
      `;
      fateEl.textContent = isBurned
        ? `${data.loserId} 被烧死在火刑柱上!`
        : `${data.loserId} 蒙受耻辱`;
      body.appendChild(fateEl);
    }

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Reformation Attempt Modal ──────────────────────────────────

  _buildReformationModal(data, isCounter) {
    const success = data.protestantMax != null && data.papalMax != null
      ? (isCounter
        ? data.papalMax >= data.protestantMax
        : data.protestantMax > data.papalMax)
      : !isCounter; // fallback for autoSuccess

    // Check explicit success field if available
    const isSuccess = data.autoSuccess || success;
    const typeLabel = isCounter ? '反宗教改革' : '宗教改革';
    const headerColor = isSuccess
      ? (isCounter ? '#7b1fa2' : '#2c3e50')
      : '#ef5350';

    const modal = this._modalShell();

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: ${headerColor};
      color: #fff; padding: 12px 20px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    `;
    header.innerHTML = `
      <div style="font-size:16px;font-weight:700;">${typeLabel}</div>
      <div style="font-size:13px;opacity:0.9;margin-top:2px;">
        ${data.space || ''}
      </div>
    `;
    modal.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 20px;';

    if (data.autoSuccess) {
      // Auto-success (no dice needed)
      const autoBox = document.createElement('div');
      autoBox.style.cssText = `
        text-align:center;font-size:14px;font-weight:600;
        color:#2e7d32;margin:12px 0;
      `;
      autoBox.textContent = '自动成功 (无需掷骰)';
      body.appendChild(autoBox);
    } else {
      // Dice comparison
      const diceRow = document.createElement('div');
      diceRow.style.cssText = `
        display:flex;justify-content:center;align-items:center;gap:16px;
        margin:8px 0 12px;
      `;

      diceRow.appendChild(this._diceColumn(
        '新教', '#2c3e50',
        data.protestantDice || [],
        data.protestantMax || 0
      ));

      const vsEl = document.createElement('span');
      vsEl.style.cssText = 'font-weight:800;font-size:16px;color:#cbd5e1;';
      vsEl.textContent = 'VS';
      diceRow.appendChild(vsEl);

      diceRow.appendChild(this._diceColumn(
        '天主教', '#7b1fa2',
        data.papalDice || [],
        data.papalMax || 0
      ));

      body.appendChild(diceRow);
    }

    // Result banner
    const result = document.createElement('div');
    result.style.cssText = `
      text-align:center;padding:8px;border-radius:6px;
      font-weight:700;font-size:14px;
      background:${isSuccess ? '#e8f5e9' : '#ffebee'};
      color:${isSuccess ? '#2e7d32' : '#c62828'};
    `;
    result.textContent = isSuccess
      ? `${typeLabel}成功!`
      : `${typeLabel}失败`;
    body.appendChild(result);

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Shared ─────────────────────────────────────────────────────

  _modalShell() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff; border-radius: 12px;
      max-width: 380px; width: 90%;
      max-height: 80vh; overflow-y: auto;
      box-shadow: 0 12px 48px rgba(0,0,0,0.3);
    `;
    modal.addEventListener('click', (e) => e.stopPropagation());
    return modal;
  }

  _hitBox(label, hits, color) {
    const box = document.createElement('div');
    box.style.cssText = `
      text-align:center;padding:12px 20px;border-radius:8px;
      border:2px solid ${color}40;
    `;
    box.innerHTML = `
      <div style="font-size:10px;color:#94a3b8;font-weight:600;">${label}</div>
      <div style="font-size:32px;font-weight:800;color:${color};">${hits}</div>
      <div style="font-size:10px;color:#94a3b8;">命中</div>
    `;
    return box;
  }

  _diceColumn(label, color, rolls, maxValue) {
    const col = document.createElement('div');
    col.style.cssText = 'text-align:center;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
      font-size:11px;font-weight:700;color:${color};margin-bottom:6px;
    `;
    labelEl.textContent = label;
    col.appendChild(labelEl);

    // Dice
    const diceWrap = document.createElement('div');
    diceWrap.style.cssText = 'display:flex;gap:3px;justify-content:center;flex-wrap:wrap;';
    for (const roll of rolls) {
      const isMax = roll === maxValue;
      const d = document.createElement('div');
      d.style.cssText = `
        width:28px;height:28px;border-radius:4px;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;font-weight:700;
        ${isMax
          ? `background:${color};color:#fff;box-shadow:0 0 4px ${color}80;`
          : 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;'}
      `;
      d.textContent = roll;
      diceWrap.appendChild(d);
    }
    col.appendChild(diceWrap);

    // Max value
    const maxEl = document.createElement('div');
    maxEl.style.cssText = `
      font-size:11px;margin-top:4px;color:${color};font-weight:600;
    `;
    maxEl.textContent = `最高: ${maxValue}`;
    col.appendChild(maxEl);

    return col;
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
