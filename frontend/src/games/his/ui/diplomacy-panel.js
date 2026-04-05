/**
 * Here I Stand — Diplomacy Panel
 *
 * Transposed triangular Diplomatic Status Display.
 * Columns: 6 major powers (as declaring powers).
 * Rows: 6 major + 4 minor powers (as targets).
 * Lower-left triangle for major×major; upper-right empty.
 * Major power labels on the diagonal (no header row).
 * Minor power labels on the right side.
 */

import { ALL_POWER_COLORS, ALL_LABELS, contrastText } from './his-theme.js';

const MAJOR_POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
const MINOR_POWERS = ['genoa', 'hungary', 'scotland', 'venice'];

const POWER_COLORS = ALL_POWER_COLORS;
const POWER_LABELS = { ...ALL_LABELS, hungary_bohemia: '匈牙利' };

/** DOW CP cost: DOW_COST[declaring][target] */
const DOW_COST = {
  ottoman:    { hapsburg: 2, england: 2, france: 2, papacy: 2, protestant: 2 },
  hapsburg:   { ottoman: 3, england: 1, france: -1, papacy: 4, protestant: -1 },
  england:    { ottoman: 3, hapsburg: 3, france: 2, papacy: 1, protestant: -1 },
  france:     { ottoman: -1, hapsburg: -1, england: 2, papacy: 1, protestant: -1 },
  papacy:     { ottoman: -1, hapsburg: -1, england: -1, france: -1, protestant: -1 },
  protestant: { ottoman: -1, hapsburg: -1, england: -1, france: -1, papacy: -1 },
};

export class DiplomacyPanel {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-diplomacy-panel';
    this._el.style.cssText = `
      padding: 8px;
      background: var(--bg-secondary, #f8fafc);
      border-radius: 6px;
      border: 1px solid var(--border-light, #e2e8f0);
      font-size: 11px;
    `;
    return this._el;
  }

  /**
   * @param {Object} state - Game state with wars, alliances
   */
  update(state) {
    if (!this._el || !state) return;
    this._el.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;font-size:13px;margin-bottom:6px;';
    title.textContent = '外交状态';
    this._el.appendChild(title);

    const wars = state.wars || [];
    const alliances = state.alliances || [];

    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;font-size:10px;';

    const tbody = document.createElement('tbody');
    const allRows = [...MAJOR_POWERS, ...MINOR_POWERS];

    for (let ri = 0; ri < allRows.length; ri++) {
      const rowPower = allRows[ri];
      const isMajor = ri < MAJOR_POWERS.length;
      const tr = document.createElement('tr');

      // 6 data columns
      for (let ci = 0; ci < MAJOR_POWERS.length; ci++) {
        const colPower = MAJOR_POWERS[ci];
        const td = document.createElement('td');

        if (isMajor && ci === ri) {
          // ── Diagonal: major power label ──
          const color = POWER_COLORS[rowPower] || '#888';
          td.style.cssText = `
            padding:2px 4px; text-align:center; font-weight:700; font-size:9px;
            background:${color}; color:${contrastText(color)};
            border:1px solid #aaa; white-space:nowrap;
          `;
          td.textContent = POWER_LABELS[rowPower] || rowPower;
        } else if (isMajor && ci > ri) {
          // ── Upper-right: empty ──
          td.style.cssText = 'padding:0;border:none;';
        } else {
          // ── Data cell ──
          this._fillDataCell(td, colPower, rowPower, isMajor, wars, alliances);
        }
        tr.appendChild(td);
      }

      // Right-side label for minor powers
      if (!isMajor) {
        tr.appendChild(this._minorLabel(rowPower));
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    this._el.appendChild(table);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  _fillDataCell(td, colPower, rowPower, isMajorRow, wars, alliances) {
    td.style.cssText = `
      padding:2px 3px; text-align:center; border:1px solid #ccc;
      min-width:26px; font-size:10px;
    `;

    const actualRow = rowPower === 'hungary' ? 'hungary_bohemia' : rowPower;

    const atWar = wars.some(w =>
      (w.a === colPower && w.b === actualRow) || (w.a === actualRow && w.b === colPower)
    );
    const allied = alliances.some(a =>
      (a.a === colPower && a.b === actualRow) || (a.a === actualRow && a.b === colPower)
    );

    if (atWar) {
      td.style.background = '#c62828';
      td.style.color = '#fff';
      td.style.fontWeight = '700';
      td.textContent = '战争';
    } else if (allied) {
      td.style.background = '#2e7d32';
      td.style.color = '#fff';
      td.style.fontWeight = '700';
      td.textContent = '同盟';
    } else if (isMajorRow) {
      const cost = DOW_COST[colPower]?.[rowPower];
      if (cost === -1 || cost === undefined) {
        td.textContent = '—';
        td.style.color = '#999';
      } else {
        td.textContent = `${cost}`;
        td.style.fontWeight = '600';
      }
    } else {
      td.textContent = '—';
      td.style.color = '#999';
    }
  }

  _minorLabel(power) {
    const td = document.createElement('td');
    const color = POWER_COLORS[power] || '#888';
    td.style.cssText = `
      font-weight:700; padding:2px 4px; white-space:nowrap; font-size:9px;
      background:${color}; color:${contrastText(color)};
      border:1px solid #aaa;
    `;
    td.textContent = POWER_LABELS[power] || power;
    return td;
  }
}
