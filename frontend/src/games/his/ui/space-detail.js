/**
 * Here I Stand — Space Detail Panel
 *
 * Shows a floating panel when a space is clicked on the map,
 * displaying detailed info: controller, religion, units, attributes.
 */

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#c6873e', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#2c3e50'
};

const POWER_LABELS = {
  ottoman: '奥斯曼', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教'
};

const RELIGION_LABELS = {
  catholic: '天主教', protestant: '新教'
};

const ZONE_LABELS = {
  german: '德语区', french: '法语区', english: '英语区',
  italian: '意大利语区', spanish: '西班牙语区'
};

export class SpaceDetail {
  constructor() {
    this._el = null;
    this._visible = false;
    this._currentSpace = null;
  }

  /**
   * Create the detail panel element. Add inside map container.
   * @returns {HTMLElement}
   */
  createPanel() {
    this._el = document.createElement('div');
    this._el.className = 'his-space-detail';
    this._el.style.cssText = `
      display: none;
      position: absolute;
      top: 8px; left: 8px;
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0;
      font-size: 12px;
      z-index: 12;
      max-width: 240px;
      min-width: 180px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      overflow: hidden;
    `;
    return this._el;
  }

  /**
   * Show detail for a space.
   * @param {string} name - space name
   * @param {Object} state - game state
   */
  show(name, state) {
    if (!this._el || !state?.spaces?.[name]) return;
    this._currentSpace = name;
    this._visible = true;

    const sp = state.spaces[name];
    this._el.innerHTML = '';
    this._el.style.display = 'block';

    // Header with controller color
    const controllerColor = POWER_COLORS[sp.controller] || '#94a3b8';
    const header = document.createElement('div');
    header.style.cssText = `
      background: ${controllerColor};
      color: #fff; padding: 8px 12px;
    `;

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-weight:700;font-size:14px;';
    nameEl.textContent = name;
    header.appendChild(nameEl);

    const controllerEl = document.createElement('div');
    controllerEl.style.cssText = 'font-size:10px;opacity:0.9;margin-top:1px;';
    controllerEl.textContent = `控制: ${POWER_LABELS[sp.controller] || sp.controller || '无'}`;
    header.appendChild(controllerEl);

    this._el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.style.cssText = 'padding:8px 12px;';

    // Attributes row
    const attrs = [];
    if (sp.isKey) attrs.push(this._badge('关键', '#1565c0'));
    if (sp.isFortress) attrs.push(this._badge('要塞', '#795548'));
    if (sp.isPort) attrs.push(this._badge('港口', '#00838f'));
    if (sp.isElectorate) attrs.push(this._badge('选帝侯', '#f9a825'));
    if (sp.besieged) attrs.push(this._badge('围城中', '#c62828'));
    if (sp.unrest) attrs.push(this._badge('骚乱', '#e65100'));

    if (attrs.length > 0) {
      const attrRow = document.createElement('div');
      attrRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;';
      for (const a of attrs) attrRow.appendChild(a);
      body.appendChild(attrRow);
    }

    // Religion + Language zone
    const infoLines = [];
    if (sp.religion) {
      infoLines.push(`宗教: ${RELIGION_LABELS[sp.religion] || sp.religion}`);
    }
    if (sp.languageZone) {
      infoLines.push(`语言: ${ZONE_LABELS[sp.languageZone] || sp.languageZone}`);
    }
    if (sp.connectedSeaZones && sp.connectedSeaZones.length > 0) {
      infoLines.push(`海域: ${sp.connectedSeaZones.join(', ')}`);
    }

    for (const line of infoLines) {
      const p = document.createElement('div');
      p.style.cssText = 'color:#64748b;font-size:11px;line-height:1.5;';
      p.textContent = line;
      body.appendChild(p);
    }

    // Units
    if (sp.units && sp.units.length > 0) {
      const unitsHeader = document.createElement('div');
      unitsHeader.style.cssText = `
        font-weight:700;font-size:11px;color:#1e293b;
        margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;
      `;
      unitsHeader.textContent = '驻军';
      body.appendChild(unitsHeader);

      for (const stack of sp.units) {
        const total = (stack.regulars || 0) + (stack.mercenaries || 0) +
                      (stack.cavalry || 0) + (stack.squadrons || 0) +
                      (stack.corsairs || 0);
        const hasLeaders = stack.leaders && stack.leaders.length > 0;
        if (total === 0 && !hasLeaders) continue;

        const stackEl = document.createElement('div');
        const ownerColor = POWER_COLORS[stack.owner] || '#64748b';
        stackEl.style.cssText = `
          margin-top:4px;padding:4px 6px;border-radius:4px;
          border-left:3px solid ${ownerColor};
          background:${ownerColor}08;
        `;

        const ownerRow = document.createElement('div');
        ownerRow.style.cssText = `font-weight:600;font-size:11px;color:${ownerColor};`;
        ownerRow.textContent = POWER_LABELS[stack.owner] || stack.owner;
        stackEl.appendChild(ownerRow);

        const unitParts = [];
        if (stack.regulars > 0) unitParts.push(`${stack.regulars} 正规`);
        if (stack.mercenaries > 0) unitParts.push(`${stack.mercenaries} 雇佣`);
        if (stack.cavalry > 0) unitParts.push(`${stack.cavalry} 骑兵`);
        if (stack.squadrons > 0) unitParts.push(`${stack.squadrons} 舰队`);
        if (stack.corsairs > 0) unitParts.push(`${stack.corsairs} 海盗`);

        if (unitParts.length > 0) {
          const unitsLine = document.createElement('div');
          unitsLine.style.cssText = 'font-size:11px;color:#475569;margin-top:1px;';
          unitsLine.textContent = unitParts.join(' | ');
          stackEl.appendChild(unitsLine);
        }

        if (hasLeaders) {
          const leadersLine = document.createElement('div');
          leadersLine.style.cssText = 'font-size:10px;color:#f57f17;margin-top:2px;font-weight:600;';
          leadersLine.textContent = `将领: ${stack.leaders.join(', ')}`;
          stackEl.appendChild(leadersLine);
        }

        body.appendChild(stackEl);
      }
    }

    // Close button
    const closeRow = document.createElement('div');
    closeRow.style.cssText = 'text-align:right;margin-top:6px;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      border:none;background:none;cursor:pointer;
      font-size:16px;color:#94a3b8;padding:2px 4px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    closeRow.appendChild(closeBtn);
    body.appendChild(closeRow);

    this._el.appendChild(body);
  }

  hide() {
    if (this._el) this._el.style.display = 'none';
    this._visible = false;
    this._currentSpace = null;
  }

  get visible() { return this._visible; }
  get currentSpace() { return this._currentSpace; }

  _badge(text, color) {
    const b = document.createElement('span');
    b.style.cssText = `
      font-size:9px;font-weight:700;padding:1px 5px;
      border-radius:3px;color:#fff;background:${color};
    `;
    b.textContent = text;
    return b;
  }
}
