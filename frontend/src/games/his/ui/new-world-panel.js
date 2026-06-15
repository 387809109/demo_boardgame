/**
 * Here I Stand — New World Panel
 *
 * Sidebar tab displaying:
 * - Active conquests (Inca/Aztec/Maya) and who controls them
 * - Potosi Silver Mines status
 * - Active colonies per power
 * - Underway explorations / conquests / colonies
 * - Discoveries made
 * - New World Riches Table (color-coded reference grid)
 */

import { NEW_WORLD_RICHES_TABLE, CONQUESTS, COLONY_LIMITS } from '../constants.js';
import { POWER_COLORS, POWER_LABELS, contrastText } from './his-theme.js';

/** Chinese labels for riches results */
const RESULT_LABELS = {
  deplete: '耗竭',
  card: '摸牌',
  galleon: '大帆船',
  elim: '消灭',
};

/** Conquest Chinese labels */
const CONQUEST_LABELS = {
  inca: '印加',
  aztec: '阿兹特克',
  maya: '玛雅',
};

/** Discovery Chinese labels */
const DISCOVERY_LABELS = {
  st_lawrence: '圣劳伦斯河',
  great_lakes: '五大湖',
  mississippi: '密西西比河',
  amazon: '亚马逊河',
  pacific_strait: '太平洋海峡',
  circumnavigation: '环球航行',
};

const NEW_WORLD_POWERS = ['hapsburg', 'england', 'france'];

export class NewWorldPanel {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-newworld-panel';
    this._el.style.cssText = `
      padding: 8px;
      background: var(--bg-secondary, #f8fafc);
      border-radius: 6px;
      border: 1px solid var(--border-light, #e2e8f0);
      font-size: 11px;
      overflow-y: auto;
    `;
    return this._el;
  }

  /**
   * @param {Object} state
   */
  update(state) {
    if (!this._el || !state) return;
    this._el.innerHTML = '';

    this._renderConquests(state);
    this._renderColonies(state);
    this._renderDiscoveries(state);
    this._renderUnderway(state);
    this._renderRichesTable(state);
  }

  // ── Conquests ─────────────────────────────────────────────────

  _renderConquests(state) {
    const section = this._section('征服');
    const nw = state.newWorld || {};
    const conquests = nw.conquests || [];
    const claimedConquests = nw.claimedConquests || [];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:center;';

    for (const conquest of CONQUESTS) {
      if (!conquest) continue;
      const isClaimed = claimedConquests.includes(conquest.id);
      const owner = conquests.find(c => c.conquestId === conquest.id);
      const label = CONQUEST_LABELS[conquest.id] || conquest.name;

      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-weight:600;font-size:10px;';
      nameEl.textContent = `${label} (${conquest.vp}VP)`;

      const statusEl = document.createElement('span');
      statusEl.style.cssText = 'font-size:10px;';
      if (isClaimed && owner) {
        const color = POWER_COLORS[owner.power] || '#666';
        statusEl.innerHTML = `<span style="color:${color};font-weight:600;">${POWER_LABELS[owner.power] || owner.power}</span>`;
      } else {
        statusEl.style.color = '#94a3b8';
        statusEl.textContent = '未征服';
      }

      grid.appendChild(nameEl);
      grid.appendChild(statusEl);
    }

    // Potosi
    const potLabel = document.createElement('span');
    potLabel.style.cssText = 'font-weight:600;font-size:10px;';
    potLabel.textContent = 'Potosi 银矿';
    const potStatus = document.createElement('span');
    potStatus.style.cssText = 'font-size:10px;';
    // Potosi comes with Inca conquest, or via Potosi Silver Mines event
    const incaOwner = conquests.find(c => c.conquestId === 'inca');
    const potosi = state.potosi;
    if (potosi) {
      const color = POWER_COLORS[potosi] || '#666';
      potStatus.innerHTML = `<span style="color:${color};font-weight:600;">${POWER_LABELS[potosi] || potosi}</span>`;
    } else if (incaOwner) {
      const color = POWER_COLORS[incaOwner.power] || '#666';
      potStatus.innerHTML = `<span style="color:${color};font-weight:600;">${POWER_LABELS[incaOwner.power] || incaOwner.power} (随印加)</span>`;
    } else {
      potStatus.style.color = '#94a3b8';
      potStatus.textContent = '未开发';
    }
    grid.appendChild(potLabel);
    grid.appendChild(potStatus);

    section.appendChild(grid);
    this._el.appendChild(section);
  }

  // ── Colonies ──────────────────────────────────────────────────

  _renderColonies(state) {
    const section = this._section('殖民地');
    const nw = state.newWorld || {};
    const colonies = nw.colonies || [];

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:center;';

    for (const power of NEW_WORLD_POWERS) {
      const count = colonies.filter(c => c.power === power).length;
      const limit = COLONY_LIMITS[power] || 2;
      const color = POWER_COLORS[power] || '#666';

      const nameEl = document.createElement('span');
      nameEl.style.cssText = `font-weight:600;font-size:10px;color:${color};`;
      nameEl.textContent = POWER_LABELS[power] || power;

      const statusEl = document.createElement('span');
      statusEl.style.cssText = 'font-size:10px;display:flex;align-items:center;gap:4px;';

      // Colony pips
      const pips = document.createElement('span');
      pips.style.cssText = 'display:flex;gap:2px;';
      for (let i = 0; i < limit; i++) {
        const pip = document.createElement('span');
        pip.style.cssText = `
          width:10px;height:10px;border-radius:2px;
          display:inline-block;border:1px solid ${color};
          background:${i < count ? color : 'transparent'};
        `;
        pips.appendChild(pip);
      }
      statusEl.appendChild(pips);

      const countEl = document.createElement('span');
      countEl.style.cssText = 'font-size:9px;color:#64748b;';
      countEl.textContent = `${count}/${limit}`;
      statusEl.appendChild(countEl);

      // Galleons marker
      if (state.galleons?.[power]) {
        const gal = document.createElement('span');
        gal.style.cssText = 'font-size:8px;background:#fff3e0;padding:0 3px;border-radius:2px;color:#e65100;font-weight:600;';
        gal.textContent = 'Galleons';
        statusEl.appendChild(gal);
      }

      // Plantations marker
      if (state.plantations?.[power]) {
        const pl = document.createElement('span');
        pl.style.cssText = 'font-size:8px;background:#e8f5e9;padding:0 3px;border-radius:2px;color:#2e7d32;font-weight:600;';
        pl.textContent = 'Plantations';
        statusEl.appendChild(pl);
      }

      grid.appendChild(nameEl);
      grid.appendChild(statusEl);
    }

    section.appendChild(grid);
    this._el.appendChild(section);
  }

  // ── Discoveries ───────────────────────────────────────────────

  _renderDiscoveries(state) {
    const nw = state.newWorld || {};
    const claimed = nw.claimedDiscoveries || [];
    const placed = nw.placedExplorers || [];

    if (claimed.length === 0 && placed.length === 0) return;

    const section = this._section('探索发现');
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

    for (const disc of claimed) {
      const explorer = placed.find(p => p.discoveryId === disc);
      const chip = document.createElement('span');
      const power = explorer?.power;
      const color = power ? POWER_COLORS[power] : '#666';
      chip.style.cssText = `
        padding:2px 6px;border-radius:3px;font-size:9px;
        background:${color}18;border:1px solid ${color}44;
        color:${color};font-weight:600;
      `;
      chip.textContent = DISCOVERY_LABELS[disc] || disc;
      if (power) chip.title = POWER_LABELS[power] || power;
      list.appendChild(chip);
    }

    section.appendChild(list);
    this._el.appendChild(section);
  }

  // ── Underway ──────────────────────────────────────────────────

  _renderUnderway(state) {
    const nw = state.newWorld || {};
    const expl = nw.underwayExplorations || [];
    const conq = nw.underwayConquests || [];
    const col = nw.underwayColonies || [];

    if (expl.length === 0 && conq.length === 0 && col.length === 0) return;

    const section = this._section('航行中');
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

    for (const v of expl) {
      list.appendChild(this._underwayChip(v.power, '探索'));
    }
    for (const v of conq) {
      list.appendChild(this._underwayChip(v.power, '征服'));
    }
    for (const v of col) {
      list.appendChild(this._underwayChip(v.power, '殖民'));
    }

    section.appendChild(list);
    this._el.appendChild(section);
  }

  _underwayChip(power, label) {
    const color = POWER_COLORS[power] || '#666';
    const chip = document.createElement('span');
    chip.style.cssText = `
      padding:2px 6px;border-radius:3px;font-size:9px;
      background:#fff8e1;border:1px solid #ffe082;
      color:#f57f17;font-weight:600;
    `;
    chip.textContent = `${POWER_LABELS[power] || power} ${label}`;
    return chip;
  }

  // ── Riches Table ──────────────────────────────────────────────

  _renderRichesTable(state) {
    const section = this._section('新世界财富表');

    const table = document.createElement('table');
    table.style.cssText = `
      border-collapse: collapse;
      width: 100%;
      font-size: 9px;
      text-align: center;
    `;

    // Header row
    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');
    const headers = ['2d6', '印加', '阿兹特克', '玛雅', 'Potosi', '殖民地'];
    for (const h of headers) {
      const th = document.createElement('th');
      th.style.cssText = `
        padding: 3px 2px;
        border: 1px solid #c0c0c0;
        background: #37474f;
        color: #fff;
        font-weight: 700;
        font-size: 8px;
      `;
      th.textContent = h;
      headTr.appendChild(th);
    }
    thead.appendChild(headTr);
    table.appendChild(thead);

    // Data rows
    const tbody = document.createElement('tbody');
    const columns = ['inca', 'aztec', 'maya', 'potosi', 'colony'];

    for (let roll = 2; roll <= 12; roll++) {
      const row = NEW_WORLD_RICHES_TABLE[roll];
      const tr = document.createElement('tr');

      // Roll number cell
      const rollTd = document.createElement('td');
      rollTd.style.cssText = `
        padding: 2px 3px;
        border: 1px solid #c0c0c0;
        font-weight: 700;
        background: #eceff1;
        color: #37474f;
      `;
      rollTd.textContent = roll;
      tr.appendChild(rollTd);

      // Result cells
      for (const col of columns) {
        const val = row[col];
        const td = document.createElement('td');
        const { bg, fg, text } = this._richesStyle(val);
        td.style.cssText = `
          padding: 2px 1px;
          border: 1px solid #c0c0c0;
          background: ${bg};
          color: ${fg};
          font-weight: 600;
          font-size: 8px;
        `;
        td.textContent = text;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    section.appendChild(table);

    // Legend
    const legend = document.createElement('div');
    legend.style.cssText = 'margin-top:4px;font-size:8px;color:#64748b;line-height:1.4;';
    legend.innerHTML =
      '<b style="color:#b71c1c;">耗竭</b>=摸牌+征服移除 ' +
      '<b style="color:#1565c0;">大帆船</b>=有标记时摸牌 ' +
      '<b style="color:#f57f17;">摸牌</b>=摸牌+保留<br>' +
      '<b style="color:#c62828;">消灭</b>=殖民地移除 ' +
      '<b style="color:#9e9e9e;">NE</b>=无效果';
    section.appendChild(legend);

    this._el.appendChild(section);
  }

  /**
   * Get background color, text color, and label for a riches result.
   */
  _richesStyle(val) {
    switch (val) {
      case 'deplete':
        return { bg: '#ffcdd2', fg: '#b71c1c', text: '耗竭' };
      case 'galleon':
        return { bg: '#bbdefb', fg: '#0d47a1', text: '大帆船' };
      case 'card':
        return { bg: '#fff9c4', fg: '#f57f17', text: '摸牌' };
      case 'elim':
        return { bg: '#ef9a9a', fg: '#b71c1c', text: '消灭' };
      case 'ne':
        return { bg: '#f5f5f5', fg: '#9e9e9e', text: 'NE' };
      default:
        return { bg: '#f5f5f5', fg: '#bdbdbd', text: '—' };
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  _section(title) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:8px;';
    const h = document.createElement('div');
    h.style.cssText = `
      font-weight:600;font-size:11px;margin-bottom:3px;color:#37474f;
      border-bottom:1px solid #e0e0e0;padding-bottom:2px;
    `;
    h.textContent = title;
    section.appendChild(h);
    return section;
  }
}
