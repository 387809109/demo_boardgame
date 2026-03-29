/**
 * Here I Stand — Diplomacy Panel
 *
 * Displays the Diplomatic Status Display: war/alliance grid
 * between all major powers and minor powers.
 */

const MAJOR_POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
const MINOR_POWERS = ['genoa', 'hungary', 'scotland', 'venice'];

import { ALL_POWER_COLORS, ALL_LABELS, contrastText } from './his-theme.js';
const POWER_COLORS = ALL_POWER_COLORS;
const POWER_LABELS = { ...ALL_LABELS, hungary_bohemia: '匈牙利' };

/** DOW CP cost matrix (row declares on column) */
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
      overflow-x: auto;
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

    // Build grid table
    const table = document.createElement('table');
    table.style.cssText = `
      border-collapse: collapse;
      font-size: 10px;
      width: 100%;
    `;

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(this._th(''));
    for (const col of MAJOR_POWERS) {
      headerRow.appendChild(this._th(POWER_LABELS[col] || col, POWER_COLORS[col]));
    }
    // Minor powers header
    for (const col of MINOR_POWERS) {
      headerRow.appendChild(this._th(POWER_LABELS[col] || col, POWER_COLORS[col]));
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows — one per major power
    const tbody = document.createElement('tbody');
    for (const row of MAJOR_POWERS) {
      const tr = document.createElement('tr');
      // Row header
      const th = document.createElement('td');
      th.style.cssText = `
        font-weight: 700; padding: 3px 6px;
        background: ${POWER_COLORS[row]}; color: ${contrastText(POWER_COLORS[row])};
        border: 1px solid #ddd; white-space: nowrap;
      `;
      th.textContent = POWER_LABELS[row] || row;
      tr.appendChild(th);

      // Major power columns
      for (const col of MAJOR_POWERS) {
        const td = document.createElement('td');
        td.style.cssText = 'padding:2px 4px;text-align:center;border:1px solid #ddd;min-width:36px;';

        if (row === col) {
          td.style.background = '#eee';
          td.textContent = '—';
        } else {
          const isAtWar = wars.some(w =>
            (w.a === row && w.b === col) || (w.a === col && w.b === row)
          );
          const isAllied = alliances.some(a =>
            (a.a === row && a.b === col) || (a.a === col && a.b === row)
          );

          if (isAtWar) {
            td.style.background = '#c62828';
            td.style.color = '#fff';
            td.style.fontWeight = '700';
            td.textContent = '战争';
          } else if (isAllied) {
            td.style.background = '#2e7d32';
            td.style.color = '#fff';
            td.style.fontWeight = '700';
            td.textContent = '同盟';
          } else {
            // Show DOW cost
            const cost = DOW_COST[row]?.[col];
            if (cost === -1) {
              td.textContent = 'N/A';
              td.style.color = '#999';
            } else if (cost !== undefined) {
              td.textContent = `${cost}`;
            }
          }
        }
        tr.appendChild(td);
      }

      // Minor power columns
      for (const col of MINOR_POWERS) {
        const td = document.createElement('td');
        td.style.cssText = 'padding:2px 4px;text-align:center;border:1px solid #ddd;min-width:36px;';

        const minorKey = col === 'hungary' ? 'hungary_bohemia' : col;
        const isAtWar = wars.some(w =>
          (w.a === row && w.b === minorKey) || (w.a === minorKey && w.b === row)
        );
        const isAllied = alliances.some(a =>
          (a.a === row && a.b === minorKey) || (a.a === minorKey && a.b === row)
        );

        if (isAtWar) {
          td.style.background = '#c62828';
          td.style.color = '#fff';
          td.style.fontWeight = '700';
          td.textContent = '战争';
        } else if (isAllied) {
          td.style.background = '#2e7d32';
          td.style.color = '#fff';
          td.style.fontWeight = '700';
          td.textContent = '同盟';
        } else {
          td.textContent = '—';
          td.style.color = '#999';
        }
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this._el.appendChild(table);
  }

  _th(text, bgColor) {
    const th = document.createElement('th');
    th.style.cssText = `
      padding: 3px 4px; font-size: 9px; white-space: nowrap;
      border: 1px solid #ddd; writing-mode: horizontal-tb;
      ${bgColor ? `background: ${bgColor}; color: ${contrastText(bgColor)};` : ''}
    `;
    th.textContent = text;
    return th;
  }

}
