/**
 * Here I Stand — Map Overlay
 *
 * Renders dynamic game elements on top of the map:
 * - Unit stacks (regulars, mercenaries, cavalry, leaders)
 * - Control flags
 * - Religion markers
 * - Fortification status
 */

import { SPACE_COORDINATES, SEA_ZONE_COORDINATES } from '../data/map-data.js';
import { LEADER_BY_ID } from '../data/leaders.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 1700 / 5100;

/** Power colors for unit tokens */
const POWER_COLORS = {
  ottoman: '#2e7d32',
  hapsburg: '#f9a825',
  england: '#c62828',
  france: '#1565c0',
  papacy: '#7b1fa2',
  protestant: '#1a1a1a',
  independent: '#9e9e9e',
  hungary: '#8d6e63',
  scotland: '#0d47a1',
  venice: '#00838f',
  genoa: '#e65100',
};

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

export class MapOverlay {
  constructor(overlayGroup) {
    this._group = overlayGroup;
    this._unitNodes = {};
  }

  /**
   * Update all overlay elements from game state
   * @param {Object} state - Game state with spaces
   */
  update(state) {
    // Clear existing overlay
    while (this._group.firstChild) {
      this._group.removeChild(this._group.firstChild);
    }
    this._unitNodes = {};

    if (!state || !state.spaces) return;

    for (const [spaceName, spaceState] of Object.entries(state.spaces)) {
      const coord = SPACE_COORDINATES[spaceName];
      if (!coord) continue;

      const cx = coord.x * SCALE;
      const cy = coord.y * SCALE;

      // Render units in this space
      if (spaceState.units && spaceState.units.length > 0) {
        this._renderUnitStack(cx, cy, spaceName, spaceState.units);
      }
    }
  }

  /**
   * Render a unit stack at a position
   */
  _renderUnitStack(cx, cy, spaceName, units) {
    const stackGroup = svgEl('g', {
      class: 'his-unit-stack',
      'data-space': spaceName,
    });

    let offsetY = -14;
    for (const unit of units) {
      const color = POWER_COLORS[unit.owner] || POWER_COLORS.independent;
      const landTotal = (unit.regulars || 0) + (unit.mercenaries || 0)
        + (unit.cavalry || 0);
      const navalTotal = (unit.squadrons || 0) + (unit.corsairs || 0);
      const leaders = unit.leaders || [];

      if (landTotal === 0 && navalTotal === 0 && leaders.length === 0) continue;

      // Land unit counter
      if (landTotal > 0) {
        const counterW = 20;
        const counterH = 10;
        const rect = svgEl('rect', {
          x: cx - counterW / 2 + 12,
          y: cy + offsetY,
          width: counterW,
          height: counterH,
          rx: 2,
          fill: color,
          stroke: '#fff',
          'stroke-width': '0.5',
          opacity: '0.9',
          class: 'his-unit-counter',
        });
        stackGroup.appendChild(rect);

        let countText = '';
        if (unit.regulars > 0) countText += `${unit.regulars}R`;
        if (unit.mercenaries > 0) {
          countText += (countText ? '+' : '') + `${unit.mercenaries}M`;
        }
        if (unit.cavalry > 0) {
          countText += (countText ? '+' : '') + `${unit.cavalry}C`;
        }

        const text = svgEl('text', {
          x: cx + 12,
          y: cy + offsetY + counterH / 2 + 1,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-size': '4',
          fill: this._contrastColor(color),
          'font-weight': 'bold',
          'pointer-events': 'none',
        });
        text.textContent = countText;
        stackGroup.appendChild(text);
        offsetY += counterH + 2;
      }

      // Naval unit counter (blue-tinted)
      if (navalTotal > 0) {
        const counterW = 20;
        const counterH = 10;
        const navalColor = '#1565c0';
        const rect = svgEl('rect', {
          x: cx - counterW / 2 + 12,
          y: cy + offsetY,
          width: counterW,
          height: counterH,
          rx: 2,
          fill: navalColor,
          stroke: color,
          'stroke-width': '0.8',
          opacity: '0.9',
          class: 'his-unit-counter his-naval-counter',
        });
        stackGroup.appendChild(rect);

        let navalText = '';
        if (unit.squadrons > 0) navalText += `${unit.squadrons}S`;
        if (unit.corsairs > 0) {
          navalText += (navalText ? '+' : '') + `${unit.corsairs}P`;
        }

        const text = svgEl('text', {
          x: cx + 12,
          y: cy + offsetY + counterH / 2 + 1,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-size': '4',
          fill: '#fff',
          'font-weight': 'bold',
          'pointer-events': 'none',
        });
        text.textContent = navalText;
        stackGroup.appendChild(text);
        offsetY += counterH + 2;
      }

      // Leader badges with attributes
      for (const leaderId of leaders) {
        const ldr = LEADER_BY_ID[leaderId];
        let label;
        if (ldr) {
          const shortName = ldr.name.length > 8
            ? ldr.name.slice(0, 7) + '…'
            : ldr.name;
          if (ldr.type === 'army') {
            label = `★${shortName} ${ldr.battle}/${ldr.command}`;
          } else if (ldr.type === 'naval') {
            label = `⚓${shortName} B${ldr.battle}`;
          } else {
            label = shortName;
          }
        } else {
          label = leaderId.slice(0, 8);
        }

        // Leader badge background
        const badgeW = 28;
        const badgeH = 7;
        const badgeRect = svgEl('rect', {
          x: cx - badgeW / 2 + 12,
          y: cy + offsetY,
          width: badgeW,
          height: badgeH,
          rx: 2,
          fill: color,
          stroke: '#fff',
          'stroke-width': '0.3',
          opacity: '0.85',
        });
        stackGroup.appendChild(badgeRect);

        const leaderText = svgEl('text', {
          x: cx + 12,
          y: cy + offsetY + badgeH / 2 + 1,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-size': '3.2',
          fill: this._contrastColor(color),
          'font-weight': 'bold',
          'pointer-events': 'none',
        });
        leaderText.textContent = label;
        stackGroup.appendChild(leaderText);
        offsetY += badgeH + 1;
      }

      offsetY += 3;
    }

    this._group.appendChild(stackGroup);
    this._unitNodes[spaceName] = stackGroup;
  }

  /**
   * Get contrasting text color for a background
   */
  _contrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.5 ? '#000' : '#fff';
  }
}
