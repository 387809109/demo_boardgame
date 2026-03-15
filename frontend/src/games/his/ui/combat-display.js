/**
 * Here I Stand — Combat Display
 *
 * Shows a modal overlay with dice results when combat resolves:
 *   - Field Battle: attacker vs defender dice, hits, casualties, winner
 *   - Assault: attacker vs defender with fortress icon
 *   - Naval Combat: squadrons/corsairs, naval dice
 *   - Interception: 2d6 roll vs threshold
 */

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#c6873e', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#2c3e50'
};

const POWER_LABELS = {
  ottoman: '奥斯曼', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教'
};

const HIT_THRESHOLD = 5;

export class CombatDisplay {
  constructor() {
    this._overlayEl = null;
    this._visible = false;
    this._autoCloseTimer = null;
  }

  /**
   * Create the overlay (hidden by default). Add to game root.
   * @returns {HTMLElement}
   */
  createOverlay() {
    this._overlayEl = document.createElement('div');
    this._overlayEl.className = 'his-combat-overlay';
    this._overlayEl.style.cssText = `
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6);
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
   * Show field battle result.
   * @param {Object} data - field_battle log entry data
   */
  showFieldBattle(data) {
    this._show(this._buildFieldBattleModal(data));
  }

  /**
   * Show assault result.
   * @param {Object} data - assault log entry data
   */
  showAssault(data) {
    this._show(this._buildAssaultModal(data));
  }

  /**
   * Show naval combat result.
   * @param {Object} data - naval_combat log entry data
   */
  showNavalCombat(data) {
    this._show(this._buildNavalCombatModal(data));
  }

  /**
   * Show interception result.
   * @param {Object} data - interception_attempt log entry data
   */
  showInterception(data) {
    this._show(this._buildInterceptionModal(data));
  }

  hide() {
    if (this._overlayEl) this._overlayEl.style.display = 'none';
    this._visible = false;
    if (this._autoCloseTimer) {
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;
    }
  }

  get visible() { return this._visible; }

  // ── Private ────────────────────────────────────────────────────

  _show(modal) {
    if (!this._overlayEl) return;
    this._overlayEl.innerHTML = '';
    this._overlayEl.appendChild(modal);
    this._overlayEl.style.display = 'flex';
    this._visible = true;
  }

  // ── Field Battle Modal ─────────────────────────────────────────

  _buildFieldBattleModal(data) {
    const attackerColor = POWER_COLORS[data.attackerPower] || '#666';
    const defenderColor = POWER_COLORS[data.defenderPower] || '#666';
    const winnerIsAttacker = data.winner === 'attacker';

    const modal = this._modalShell();

    // Title
    modal.appendChild(this._header(
      `野战 — ${data.space || ''}`,
      winnerIsAttacker ? attackerColor : defenderColor
    ));

    const body = this._body();

    // Two-column dice display
    const cols = document.createElement('div');
    cols.style.cssText = 'display:flex;gap:16px;justify-content:center;';

    cols.appendChild(this._sideColumn(
      POWER_LABELS[data.attackerPower] || data.attackerPower,
      '进攻方',
      attackerColor,
      data.attackerRolls || [],
      data.attackerHits || 0,
      data.attackerCasualties || 0,
      winnerIsAttacker
    ));

    cols.appendChild(this._vsIcon());

    cols.appendChild(this._sideColumn(
      POWER_LABELS[data.defenderPower] || data.defenderPower,
      '防守方',
      defenderColor,
      data.defenderRolls || [],
      data.defenderHits || 0,
      data.defenderCasualties || 0,
      !winnerIsAttacker
    ));

    body.appendChild(cols);

    // Winner banner
    const winnerPower = data.winnerPower || (winnerIsAttacker ? data.attackerPower : data.defenderPower);
    body.appendChild(this._winnerBanner(winnerPower));

    // Captured leaders
    if (data.capturedLeaders && data.capturedLeaders.length > 0) {
      body.appendChild(this._capturedLeaders(data.capturedLeaders));
    }

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Assault Modal ──────────────────────────────────────────────

  _buildAssaultModal(data) {
    const attackerColor = POWER_COLORS[data.power] || '#666';
    const success = data.success;

    const modal = this._modalShell();
    modal.appendChild(this._header(
      `突击 — ${data.space || ''}`,
      success ? '#2e7d32' : '#c62828'
    ));

    const body = this._body();

    const cols = document.createElement('div');
    cols.style.cssText = 'display:flex;gap:16px;justify-content:center;';

    cols.appendChild(this._sideColumn(
      POWER_LABELS[data.power] || data.power,
      '进攻方',
      attackerColor,
      data.attackerRolls || [],
      data.attackerHits || 0,
      data.attackerCasualties || 0,
      success
    ));

    cols.appendChild(this._vsIcon());

    cols.appendChild(this._sideColumn(
      '守军',
      '防守方',
      '#78909c',
      data.defenderRolls || [],
      data.defenderHits || 0,
      data.defenderCasualties || 0,
      !success
    ));

    body.appendChild(cols);

    // Result banner
    const resultBanner = document.createElement('div');
    resultBanner.style.cssText = `
      text-align:center;margin-top:12px;padding:8px;border-radius:6px;
      font-weight:700;font-size:14px;
      background:${success ? '#e8f5e9' : '#ffebee'};
      color:${success ? '#2e7d32' : '#c62828'};
    `;
    resultBanner.textContent = success ? '突击成功!' : '突击失败';
    body.appendChild(resultBanner);

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Naval Combat Modal ─────────────────────────────────────────

  _buildNavalCombatModal(data) {
    const attackerColor = POWER_COLORS[data.attackerPower] || '#666';
    const defenderColor = POWER_COLORS[data.defenderPower] || '#666';
    const winnerIsAttacker = data.winner === 'attacker';

    const modal = this._modalShell();
    modal.appendChild(this._header(
      `海战 — ${data.space || ''}`,
      winnerIsAttacker ? attackerColor : defenderColor
    ));

    const body = this._body();

    const cols = document.createElement('div');
    cols.style.cssText = 'display:flex;gap:16px;justify-content:center;';

    cols.appendChild(this._sideColumn(
      POWER_LABELS[data.attackerPower] || data.attackerPower,
      '进攻方',
      attackerColor,
      data.attackerRolls || [],
      data.attackerHits || 0,
      0,
      winnerIsAttacker
    ));

    cols.appendChild(this._vsIcon());

    cols.appendChild(this._sideColumn(
      POWER_LABELS[data.defenderPower] || data.defenderPower,
      '防守方',
      defenderColor,
      data.defenderRolls || [],
      data.defenderHits || 0,
      0,
      !winnerIsAttacker
    ));

    body.appendChild(cols);

    // Naval losses detail
    const lossDetail = document.createElement('div');
    lossDetail.style.cssText = `
      display:flex;justify-content:center;gap:24px;margin-top:8px;
      font-size:11px;color:#64748b;
    `;
    if (data.attackerLosses) {
      lossDetail.innerHTML += `<span>进攻方损失: ${this._navalLossText(data.attackerLosses)}</span>`;
    }
    if (data.defenderLosses) {
      lossDetail.innerHTML += `<span>防守方损失: ${this._navalLossText(data.defenderLosses)}</span>`;
    }
    body.appendChild(lossDetail);

    const winnerPower = data.winnerPower || (winnerIsAttacker ? data.attackerPower : data.defenderPower);
    body.appendChild(this._winnerBanner(winnerPower));

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Interception Modal ─────────────────────────────────────────

  _buildInterceptionModal(data) {
    const success = data.success;
    const color = success ? '#2e7d32' : '#c62828';

    const modal = this._modalShell();
    modal.appendChild(this._header('拦截', color));

    const body = this._body();

    // Interceptor info
    const info = document.createElement('div');
    info.style.cssText = `
      text-align:center;font-size:13px;color:#475569;margin-bottom:12px;
    `;
    const interceptor = POWER_LABELS[data.interceptorPower] || data.interceptorPower;
    info.textContent = `${interceptor} 尝试拦截 (${data.interceptorSpace} → ${data.targetSpace})`;
    body.appendChild(info);

    // Roll display
    const rollBox = document.createElement('div');
    rollBox.style.cssText = `
      display:flex;justify-content:center;align-items:center;gap:12px;
      margin:16px 0;
    `;

    const rollValue = document.createElement('div');
    rollValue.style.cssText = `
      font-size:36px;font-weight:800;color:${color};
    `;
    rollValue.textContent = data.roll || '?';
    rollBox.appendChild(rollValue);

    const threshold = document.createElement('div');
    threshold.style.cssText = `
      font-size:14px;color:#94a3b8;
    `;
    threshold.innerHTML = `需要 <span style="font-weight:700;color:#1e293b;">≥ ${data.threshold || 9}</span>`;
    rollBox.appendChild(threshold);

    body.appendChild(rollBox);

    // Result
    const result = document.createElement('div');
    result.style.cssText = `
      text-align:center;padding:8px;border-radius:6px;
      font-weight:700;font-size:14px;
      background:${success ? '#e8f5e9' : '#ffebee'};
      color:${color};
    `;
    result.textContent = success ? '拦截成功!' : '拦截失败';
    body.appendChild(result);

    body.appendChild(this._closeBtn());
    modal.appendChild(body);
    return modal;
  }

  // ── Shared UI Builders ─────────────────────────────────────────

  _modalShell() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      border-radius: 12px;
      max-width: 440px;
      width: 92%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
    `;
    modal.addEventListener('click', (e) => e.stopPropagation());
    return modal;
  }

  _header(text, bgColor) {
    const h = document.createElement('div');
    h.style.cssText = `
      background: ${bgColor || '#5c6bc0'};
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px 12px 0 0;
      font-weight: 700;
      font-size: 16px;
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

  _sideColumn(name, role, color, rolls, hits, casualties, isWinner) {
    const col = document.createElement('div');
    col.style.cssText = `
      flex:1;display:flex;flex-direction:column;align-items:center;
      ${isWinner ? 'border:2px solid ' + color + ';border-radius:8px;padding:8px;' : 'padding:8px;'}
    `;

    // Power name
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      font-weight:700;font-size:13px;color:${color};margin-bottom:2px;
    `;
    nameEl.textContent = name;
    col.appendChild(nameEl);

    // Role label
    const roleEl = document.createElement('div');
    roleEl.style.cssText = 'font-size:10px;color:#94a3b8;margin-bottom:8px;';
    roleEl.textContent = role;
    col.appendChild(roleEl);

    // Dice grid
    const diceGrid = document.createElement('div');
    diceGrid.style.cssText = `
      display:flex;flex-wrap:wrap;gap:3px;justify-content:center;
      margin-bottom:8px;min-height:28px;
    `;
    for (const roll of rolls) {
      diceGrid.appendChild(this._die(roll, roll >= HIT_THRESHOLD));
    }
    if (rolls.length === 0) {
      const noDice = document.createElement('span');
      noDice.style.cssText = 'font-size:11px;color:#94a3b8;';
      noDice.textContent = '—';
      diceGrid.appendChild(noDice);
    }
    col.appendChild(diceGrid);

    // Hits count
    const hitsEl = document.createElement('div');
    hitsEl.style.cssText = `
      font-size:12px;font-weight:600;
      color:${hits > 0 ? '#c62828' : '#94a3b8'};
    `;
    hitsEl.textContent = `${hits} 命中`;
    col.appendChild(hitsEl);

    // Casualties
    if (casualties > 0) {
      const casEl = document.createElement('div');
      casEl.style.cssText = 'font-size:11px;color:#ef5350;margin-top:2px;';
      casEl.textContent = `损失 ${casualties} 单位`;
      col.appendChild(casEl);
    }

    // Winner crown
    if (isWinner) {
      const crown = document.createElement('div');
      crown.style.cssText = 'font-size:16px;margin-top:4px;';
      crown.textContent = '\u{1F3C6}';
      col.appendChild(crown);
    }

    return col;
  }

  _die(value, isHit) {
    const d = document.createElement('div');
    d.style.cssText = `
      width:26px;height:26px;border-radius:4px;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;font-weight:700;
      ${isHit
        ? 'background:#c62828;color:#fff;box-shadow:0 0 4px rgba(198,40,40,0.4);'
        : 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;'}
    `;
    d.textContent = value;
    return d;
  }

  _vsIcon() {
    const vs = document.createElement('div');
    vs.style.cssText = `
      display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:18px;color:#cbd5e1;
      align-self:center;
    `;
    vs.textContent = 'VS';
    return vs;
  }

  _winnerBanner(power) {
    const color = POWER_COLORS[power] || '#666';
    const banner = document.createElement('div');
    banner.style.cssText = `
      text-align:center;margin-top:12px;padding:8px;border-radius:6px;
      font-weight:700;font-size:14px;
      background:${color}15;color:${color};
      border:1px solid ${color}40;
    `;
    banner.textContent = `${POWER_LABELS[power] || power} 胜利`;
    return banner;
  }

  _capturedLeaders(leaders) {
    const el = document.createElement('div');
    el.style.cssText = `
      text-align:center;font-size:12px;color:#f57f17;
      margin-top:6px;font-weight:600;
    `;
    el.textContent = `将领被俘: ${leaders.join(', ')}`;
    return el;
  }

  _navalLossText(losses) {
    const parts = [];
    if (losses.squadrons > 0) parts.push(`${losses.squadrons}舰队`);
    if (losses.corsairs > 0) parts.push(`${losses.corsairs}海盗`);
    return parts.join(', ') || '无';
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
