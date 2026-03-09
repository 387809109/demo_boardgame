/**
 * Here I Stand — SVG Map Renderer
 *
 * Renders the game map as an interactive SVG element.
 * 134 land spaces + 15 sea zones positioned from VASSAL coordinates.
 */

import {
  LAND_SPACES, SEA_ZONES, LAND_EDGES, SEA_EDGES,
  SPACE_COORDINATES, SEA_ZONE_COORDINATES, SPACE_BY_NAME
} from '../data/map-data.js';
import { MAJOR_POWERS } from '../constants.js';

// ── Constants ──────────────────────────────────────────────────────

/** Original VASSAL map pixel dimensions */
const SOURCE_W = 5100;
const SOURCE_H = 3400;

/** Default SVG viewBox dimensions (scaled down for rendering) */
const VIEW_W = 1700;
const VIEW_H = 1133;

/** Scale factor from source coordinates to viewBox */
const SCALE = VIEW_W / SOURCE_W;

/** Space node radius */
const SPACE_R = 8;
const KEY_SPACE_R = 11;
const SEA_ZONE_R = 14;

/** Power colors */
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

/** Language zone fill colors (subtle backgrounds) */
const ZONE_COLORS = {
  german: 'rgba(255, 193, 7, 0.08)',
  english: 'rgba(244, 67, 54, 0.08)',
  french: 'rgba(33, 150, 243, 0.08)',
  spanish: 'rgba(255, 152, 0, 0.08)',
  italian: 'rgba(156, 39, 176, 0.08)',
};

// ── SVG Namespace ──────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// ── MapRenderer Class ──────────────────────────────────────────────

export class MapRenderer {
  constructor() {
    this._svg = null;
    this._spaceNodes = {};    // name -> SVG circle element
    this._seaZoneNodes = {};  // name -> SVG circle element
    this._edgeLines = [];
    this._overlayGroup = null;
    this._labelsGroup = null;
    this._onSpaceClick = null;
    this._onSpaceHover = null;
    this._selectedSpace = null;
    this._highlightedSpaces = new Set();
  }

  /**
   * Create the SVG map element
   * @returns {SVGElement}
   */
  render() {
    this._svg = svgEl('svg', {
      viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
      preserveAspectRatio: 'xMidYMid meet',
      class: 'his-map',
    });
    this._svg.style.cssText = `
      width: 100%;
      height: 100%;
      background: #e8e0d4;
      border-radius: 4px;
      cursor: grab;
    `;

    // Create layer groups (bottom to top)
    const edgesGroup = svgEl('g', { class: 'his-map-edges' });
    const seaGroup = svgEl('g', { class: 'his-map-sea-zones' });
    const spacesGroup = svgEl('g', { class: 'his-map-spaces' });
    this._labelsGroup = svgEl('g', { class: 'his-map-labels' });
    this._overlayGroup = svgEl('g', { class: 'his-map-overlay' });

    // Render edges
    this._renderEdges(edgesGroup);
    this._renderSeaEdges(edgesGroup);

    // Render sea zones
    this._renderSeaZones(seaGroup);

    // Render land spaces
    this._renderSpaces(spacesGroup);

    // Render labels
    this._renderLabels(this._labelsGroup);

    this._svg.appendChild(edgesGroup);
    this._svg.appendChild(seaGroup);
    this._svg.appendChild(spacesGroup);
    this._svg.appendChild(this._labelsGroup);
    this._svg.appendChild(this._overlayGroup);

    return this._svg;
  }

  /**
   * Get the overlay group for external layers (units, markers)
   * @returns {SVGGElement}
   */
  getOverlayGroup() {
    return this._overlayGroup;
  }

  /** Set click handler for spaces */
  setOnSpaceClick(fn) { this._onSpaceClick = fn; }

  /** Set hover handler for spaces */
  setOnSpaceHover(fn) { this._onSpaceHover = fn; }

  /**
   * Update space appearance based on game state
   * @param {Object} state - Game state
   */
  updateFromState(state) {
    if (!state || !state.spaces) return;

    for (const [name, spaceState] of Object.entries(state.spaces)) {
      const node = this._spaceNodes[name];
      if (!node) continue;

      // Update controller color
      const controller = spaceState.controller || 'independent';
      const color = POWER_COLORS[controller] || POWER_COLORS.independent;
      node.setAttribute('stroke', color);
      node.setAttribute('stroke-width', '2.5');

      // Update religion indicator (fill)
      if (spaceState.religion === 'protestant') {
        node.setAttribute('fill', '#1a1a1a');
      } else if (spaceState.religion === 'catholic') {
        node.setAttribute('fill', '#fff');
      } else {
        node.setAttribute('fill', '#e0d5c5');
      }
    }
  }

  /**
   * Highlight specific spaces (for move targets, etc.)
   * @param {string[]} spaceNames
   * @param {string} color - Highlight color
   */
  highlightSpaces(spaceNames, color = '#ffeb3b') {
    this.clearHighlights();
    for (const name of spaceNames) {
      const node = this._spaceNodes[name];
      if (node) {
        node.setAttribute('data-highlighted', 'true');
        node.style.filter = `drop-shadow(0 0 4px ${color})`;
        this._highlightedSpaces.add(name);
      }
    }
  }

  /** Clear all highlights */
  clearHighlights() {
    for (const name of this._highlightedSpaces) {
      const node = this._spaceNodes[name];
      if (node) {
        node.removeAttribute('data-highlighted');
        node.style.filter = '';
      }
    }
    this._highlightedSpaces.clear();
  }

  /**
   * Select a space (visual indicator)
   * @param {string|null} spaceName
   */
  selectSpace(spaceName) {
    // Deselect previous
    if (this._selectedSpace && this._spaceNodes[this._selectedSpace]) {
      this._spaceNodes[this._selectedSpace].classList.remove('his-space-selected');
    }
    this._selectedSpace = spaceName;
    if (spaceName && this._spaceNodes[spaceName]) {
      this._spaceNodes[spaceName].classList.add('his-space-selected');
    }
  }

  // ── Private Rendering Methods ──────────────────────────────────

  _toViewX(x) { return x * SCALE; }
  _toViewY(y) { return y * SCALE; }

  _renderEdges(group) {
    for (const edge of LAND_EDGES) {
      const a = SPACE_COORDINATES[edge.a];
      const b = SPACE_COORDINATES[edge.b];
      if (!a || !b) continue;

      const line = svgEl('line', {
        x1: this._toViewX(a.x),
        y1: this._toViewY(a.y),
        x2: this._toViewX(b.x),
        y2: this._toViewY(b.y),
        stroke: edge.type === 'pass' ? '#a0522d' : '#b0a89a',
        'stroke-width': edge.type === 'pass' ? '1.2' : '0.6',
        'stroke-dasharray': edge.type === 'pass' ? '3,2' : 'none',
        opacity: '0.5',
      });
      group.appendChild(line);
    }
  }

  _renderSeaEdges(group) {
    for (const edge of SEA_EDGES) {
      const a = SEA_ZONE_COORDINATES[edge.a];
      const b = SEA_ZONE_COORDINATES[edge.b];
      if (!a || !b) continue;

      const line = svgEl('line', {
        x1: this._toViewX(a.x),
        y1: this._toViewY(a.y),
        x2: this._toViewX(b.x),
        y2: this._toViewY(b.y),
        stroke: '#4a90d9',
        'stroke-width': '0.8',
        'stroke-dasharray': '4,3',
        opacity: '0.4',
      });
      group.appendChild(line);
    }
  }

  _renderSeaZones(group) {
    for (const szName of SEA_ZONES) {
      const coord = SEA_ZONE_COORDINATES[szName];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);

      // Sea zone background
      const circle = svgEl('circle', {
        cx, cy,
        r: SEA_ZONE_R,
        fill: 'rgba(74, 144, 217, 0.15)',
        stroke: '#4a90d9',
        'stroke-width': '1',
        class: 'his-sea-zone',
        'data-name': szName,
      });

      circle.addEventListener('click', () => {
        if (this._onSpaceClick) this._onSpaceClick(szName, 'sea');
      });

      group.appendChild(circle);
      this._seaZoneNodes[szName] = circle;

      // Label
      const label = svgEl('text', {
        x: cx, y: cy + 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': '4',
        fill: '#2c5f9e',
        class: 'his-sea-label',
        'pointer-events': 'none',
      });
      label.textContent = szName.replace(' Sea', '').replace(' Ocean', '');
      group.appendChild(label);
    }
  }

  _renderSpaces(group) {
    for (const space of LAND_SPACES) {
      const coord = SPACE_COORDINATES[space.name];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);
      const r = space.isKey ? KEY_SPACE_R : SPACE_R;

      // Fortress outer ring
      if (space.isFortress) {
        const fort = svgEl('circle', {
          cx, cy, r: r + 3,
          fill: 'none',
          stroke: '#5d4037',
          'stroke-width': '1.5',
          'stroke-dasharray': '2,1',
          'pointer-events': 'none',
        });
        group.appendChild(fort);
      }

      // Electorate diamond marker
      if (space.isElectorate) {
        const diamond = svgEl('rect', {
          x: cx - 3, y: cy - r - 6,
          width: 6, height: 6,
          fill: '#ffd700',
          stroke: '#b8860b',
          'stroke-width': '0.5',
          transform: `rotate(45 ${cx} ${cy - r - 3})`,
          'pointer-events': 'none',
        });
        group.appendChild(diamond);
      }

      // Main space circle
      const controller = space.controller || 'independent';
      const color = POWER_COLORS[controller] || POWER_COLORS.independent;
      const circle = svgEl('circle', {
        cx, cy, r,
        fill: '#fff',
        stroke: color,
        'stroke-width': space.isKey ? '2.5' : '1.8',
        class: `his-space ${space.isKey ? 'his-key-space' : ''} ${space.isPort ? 'his-port' : ''}`,
        'data-name': space.name,
        cursor: 'pointer',
      });

      // Port indicator (small anchor-like mark)
      if (space.isPort) {
        const portMark = svgEl('circle', {
          cx: cx + r - 2, cy: cy + r - 2, r: 2,
          fill: '#4a90d9',
          stroke: '#fff',
          'stroke-width': '0.5',
          'pointer-events': 'none',
        });
        group.appendChild(portMark);
      }

      // Events
      circle.addEventListener('click', () => {
        if (this._onSpaceClick) this._onSpaceClick(space.name, 'land');
      });
      circle.addEventListener('mouseenter', () => {
        if (this._onSpaceHover) this._onSpaceHover(space.name, true);
      });
      circle.addEventListener('mouseleave', () => {
        if (this._onSpaceHover) this._onSpaceHover(space.name, false);
      });

      group.appendChild(circle);
      this._spaceNodes[space.name] = circle;
    }
  }

  _renderLabels(group) {
    for (const space of LAND_SPACES) {
      const coord = SPACE_COORDINATES[space.name];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);
      const r = space.isKey ? KEY_SPACE_R : SPACE_R;

      const label = svgEl('text', {
        x: cx, y: cy + r + 7,
        'text-anchor': 'middle',
        'font-size': space.isKey ? '5' : '4',
        'font-weight': space.isKey ? 'bold' : 'normal',
        fill: '#3e2723',
        class: 'his-space-label',
        'pointer-events': 'none',
      });
      label.textContent = space.name;
      group.appendChild(label);
    }
  }
}
