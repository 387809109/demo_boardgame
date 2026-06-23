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
import { ALL_POWER_COLORS as POWER_COLORS, contrastText } from '../ui/his-theme.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 1700 / 5100;

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

/**
 * Compact, render-relevant fingerprint of a space's unit stack. Two stacks with
 * the same signature render identically, so the overlay can skip rebuilding
 * unchanged spaces. Captures owner, every counter, leaders, and order (stacking
 * offset depends on order). Units that render nothing are dropped — matching the
 * skip in _buildUnitStack — so an all-zero stack yields ''.
 * @param {Array} units
 * @returns {string}
 */
function unitsSignature(units) {
  const parts = [];
  for (const u of units) {
    const land = (u.regulars || 0) + (u.mercenaries || 0) + (u.cavalry || 0);
    const naval = (u.squadrons || 0) + (u.corsairs || 0);
    const leaders = u.leaders || [];
    if (land === 0 && naval === 0 && leaders.length === 0) continue;
    parts.push(
      `${u.owner}:${u.regulars || 0}/${u.mercenaries || 0}/${u.cavalry || 0}` +
      `/${u.squadrons || 0}/${u.corsairs || 0}/${leaders.join(',')}`
    );
  }
  return parts.join('|');
}

export class MapOverlay {
  constructor(overlayGroup) {
    this._group = overlayGroup;
    this._unitNodes = {};  // spaceName -> stack <g> currently in the DOM
    this._unitSigs = {};   // spaceName -> last-rendered unitsSignature
  }

  /**
   * Update overlay elements from game state.
   *
   * Diff-based: a single action usually changes one or two spaces, so only
   * spaces whose unit signature changed are rebuilt; unchanged spaces keep their
   * existing DOM nodes, and spaces that emptied out have their stack removed.
   * (Previously every stack across all ~45 occupied spaces — ~180 SVG nodes —
   * was torn down and recreated on every update.)
   * @param {Object} state - Game state with spaces
   */
  update(state) {
    if (!state || !state.spaces) {
      for (const name of Object.keys(this._unitNodes)) {
        this._group.removeChild(this._unitNodes[name]);
      }
      this._unitNodes = {};
      this._unitSigs = {};
      return;
    }

    const seen = new Set();

    for (const [spaceName, spaceState] of Object.entries(state.spaces)) {
      const coord = SPACE_COORDINATES[spaceName];
      if (!coord) continue;

      const units = spaceState.units;
      if (!units || units.length === 0) continue;
      const sig = unitsSignature(units);
      if (sig === '') continue; // nothing renderable — cleanup loop drops any old node

      seen.add(spaceName);
      if (this._unitSigs[spaceName] === sig && this._unitNodes[spaceName]) {
        continue; // unchanged — keep the existing node
      }

      // Changed (or new): replace the old stack node with a freshly built one.
      if (this._unitNodes[spaceName]) {
        this._group.removeChild(this._unitNodes[spaceName]);
      }
      const node = this._buildUnitStack(coord.x * SCALE, coord.y * SCALE, spaceName, units);
      this._group.appendChild(node);
      this._unitNodes[spaceName] = node;
      this._unitSigs[spaceName] = sig;
    }

    // Remove stacks for spaces that are no longer occupied / renderable.
    for (const name of Object.keys(this._unitNodes)) {
      if (!seen.has(name)) {
        this._group.removeChild(this._unitNodes[name]);
        delete this._unitNodes[name];
        delete this._unitSigs[name];
      }
    }
  }

  /**
   * Build (and return) the unit-stack <g> for a space. Caller handles
   * insertion/caching.
   */
  _buildUnitStack(cx, cy, spaceName, units) {
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
          fill: contrastText(color),
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
          fill: contrastText(color),
          'font-weight': 'bold',
          'pointer-events': 'none',
        });
        leaderText.textContent = label;
        stackGroup.appendChild(leaderText);
        offsetY += badgeH + 1;
      }

      offsetY += 3;
    }

    return stackGroup;
  }
}
