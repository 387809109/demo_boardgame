/**
 * Here I Stand — Religious Struggle Panel
 *
 * Displays debaters (Papal vs Protestant) with their status and attributes,
 * Protestant spaces track, and active debate info.
 */

import { DEBATERS } from '../constants.js';

const FACTION_COLORS = {
  papal: '#7b1fa2',
  lutheran: '#795548',
  calvinist: '#1565c0',
  anglican: '#c62828',
};

const FACTION_LABELS = {
  papal: '教廷',
  lutheran: '路德宗',
  calvinist: '加尔文宗',
  anglican: '圣公宗',
};

/** Protestant spaces → VP lookup (simplified) */
const PROT_SPACES_VP = [
  { min: 0, max: 0, vp: 0 }, { min: 1, max: 2, vp: 1 }, { min: 3, max: 5, vp: 2 },
  { min: 6, max: 8, vp: 3 }, { min: 9, max: 11, vp: 4 }, { min: 12, max: 14, vp: 5 },
  { min: 15, max: 17, vp: 6 }, { min: 18, max: 20, vp: 7 }, { min: 21, max: 23, vp: 8 },
  { min: 24, max: 26, vp: 9 }, { min: 27, max: 29, vp: 10 }, { min: 30, max: 32, vp: 11 },
  { min: 33, max: 35, vp: 12 }, { min: 36, max: 38, vp: 13 }, { min: 39, max: 41, vp: 14 },
  { min: 42, max: 99, vp: 15 },
];

export class ReligiousStrugglePanel {
  constructor() {
    this._el = null;
  }

  render() {
    this._el = document.createElement('div');
    this._el.className = 'his-religious-struggle';
    this._el.style.cssText = `
      padding: 8px;
      background: var(--bg-secondary, #f8fafc);
      border-radius: 6px;
      border: 1px solid var(--border-light, #e2e8f0);
      font-size: 11px;
      overflow-y: auto;
      max-height: 350px;
    `;
    return this._el;
  }

  /**
   * @param {Object} state
   */
  update(state) {
    if (!this._el) return;
    this._el.innerHTML = '';

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;font-size:13px;margin-bottom:6px;';
    title.textContent = '宗教斗争 (Religious Struggle)';
    this._el.appendChild(title);

    // Protestant Spaces Track
    this._renderProtSpacesTrack(state);

    // Active debate
    if (state?.pendingDebate) {
      this._renderActiveDebate(state.pendingDebate);
    }

    // Debater columns
    this._renderDebaters(state);
  }

  _renderProtSpacesTrack(state) {
    const protSpaces = state?.protestantSpaces || 0;
    const vpEntry = PROT_SPACES_VP.find(e => protSpaces >= e.min && protSpaces <= e.max)
      || PROT_SPACES_VP[0];

    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;align-items:center;gap:8px;padding:4px 8px;
      background:#f5f5f5;border-radius:4px;margin-bottom:8px;
    `;
    const label = document.createElement('span');
    label.style.cssText = 'font-size:10px;color:#666;';
    label.textContent = '新教地点:';
    const count = document.createElement('span');
    count.style.cssText = 'font-weight:700;font-size:14px;';
    count.textContent = protSpaces;
    const vpLabel = document.createElement('span');
    vpLabel.style.cssText = 'font-size:10px;color:#7b1fa2;font-weight:600;';
    vpLabel.textContent = `→ ${vpEntry.vp} VP (教廷) / -${vpEntry.vp} VP (新教)`;
    row.appendChild(label);
    row.appendChild(count);
    row.appendChild(vpLabel);
    this._el.appendChild(row);
  }

  _renderActiveDebate(debate) {
    const section = document.createElement('div');
    section.style.cssText = `
      padding:6px 8px;background:#fff3e0;border-radius:4px;
      margin-bottom:8px;border:1px solid #ffe0b2;
    `;
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;font-size:11px;color:#e65100;margin-bottom:4px;';
    h.textContent = '⚡ 辩论进行中';
    section.appendChild(h);

    if (debate.space) {
      const loc = document.createElement('div');
      loc.style.cssText = 'font-size:10px;';
      loc.textContent = `地点: ${debate.space}`;
      section.appendChild(loc);
    }

    this._el.appendChild(section);
  }

  _renderDebaters(state) {
    const debaterStates = state?.debaters || { papal: [], protestant: [] };
    const currentTurn = state?.turn || 1;

    // Group by faction
    const factions = { papal: [], lutheran: [], calvinist: [], anglican: [] };
    for (const d of DEBATERS) {
      if (factions[d.faction]) {
        factions[d.faction].push(d);
      }
    }

    // Papal section
    this._renderFactionSection('papal', factions.papal, debaterStates.papal, currentTurn);

    // Protestant sections
    for (const faction of ['lutheran', 'calvinist', 'anglican']) {
      this._renderFactionSection(faction, factions[faction], debaterStates.protestant, currentTurn);
    }
  }

  _renderFactionSection(faction, debaters, stateDebaters, currentTurn) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:6px;';

    const color = FACTION_COLORS[faction] || '#666';
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight:600;font-size:10px;padding:2px 6px;
      background:${color};color:#fff;border-radius:3px;margin-bottom:3px;
    `;
    header.textContent = FACTION_LABELS[faction] || faction;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;';

    for (const d of debaters) {
      const stateEntry = stateDebaters?.find(s => s.id === d.id);
      const isAvailable = d.entryTurn <= currentTurn;
      const isCommitted = stateEntry?.committed || false;
      const isInPlay = !!stateEntry;
      const isBurned = stateEntry?.burned || false;

      const chip = document.createElement('div');
      chip.style.cssText = `
        padding:2px 5px;border-radius:3px;font-size:9px;
        border:1px solid ${color};display:inline-flex;align-items:center;gap:3px;
        ${!isAvailable ? 'opacity:0.35;' : ''}
        ${isBurned ? 'text-decoration:line-through;background:#ffcdd2;' : ''}
        ${isCommitted ? 'background:#fff3e0;' : 'background:#fff;'}
      `;

      // Value badge
      const val = document.createElement('span');
      val.style.cssText = `
        width:14px;height:14px;border-radius:50%;
        background:${color};color:#fff;font-weight:700;font-size:8px;
        display:inline-flex;align-items:center;justify-content:center;
      `;
      val.textContent = d.value;
      chip.appendChild(val);

      // Name
      const name = document.createElement('span');
      name.style.cssText = 'font-weight:600;';
      name.textContent = d.name;
      chip.appendChild(name);

      // Status indicator
      if (isCommitted) {
        const st = document.createElement('span');
        st.style.cssText = 'font-size:8px;color:#e65100;';
        st.textContent = '已用';
        chip.appendChild(st);
      }
      if (!isAvailable) {
        const st = document.createElement('span');
        st.style.cssText = 'font-size:8px;color:#999;';
        st.textContent = `T${d.entryTurn}+`;
        chip.appendChild(st);
      }

      // Tooltip
      chip.title = `${d.name} (辩论值${d.value}) — ${d.zone || '全区域'}, T${d.entryTurn}进场`;

      grid.appendChild(chip);
    }

    section.appendChild(grid);
    this._el.appendChild(section);
  }
}
