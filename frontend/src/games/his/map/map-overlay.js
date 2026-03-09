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
  genoa: '#d84315',
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
      const total = (unit.regulars || 0) + (unit.mercenaries || 0)
        + (unit.cavalry || 0);
      const leaders = unit.leaders || [];

      if (total === 0 && leaders.length === 0) continue;

      // Unit counter background
      const counterW = 18;
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

      // Unit count text
      let countText = '';
      if (unit.regulars > 0) countText += `${unit.regulars}R`;
      if (unit.mercenaries > 0) {
        countText += (countText ? '+' : '') + `${unit.mercenaries}M`;
      }
      if (unit.cavalry > 0) {
        countText += (countText ? '+' : '') + `${unit.cavalry}C`;
      }

      if (countText) {
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
      }

      // Leader badges (below counter)
      if (leaders.length > 0) {
        const leaderText = svgEl('text', {
          x: cx + 12,
          y: cy + offsetY + counterH + 5,
          'text-anchor': 'middle',
          'font-size': '3.5',
          fill: color,
          'font-weight': 'bold',
          'pointer-events': 'none',
        });
        leaderText.textContent = leaders.length === 1
          ? leaders[0].slice(0, 6)
          : `${leaders.length} ldrs`;
        stackGroup.appendChild(leaderText);
      }

      offsetY += counterH + (leaders.length > 0 ? 10 : 4);
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
