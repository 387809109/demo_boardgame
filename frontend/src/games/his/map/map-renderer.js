/**
 * Here I Stand — SVG Map Renderer
 *
 * Renders the game map as an interactive SVG element.
 * 134 land spaces + 15 sea zones + New World panel.
 *
 * Space shapes match the board game:
 *   - Key city: square
 *   - Fortress: 8-pointed star
 *   - Electorate: hexagon
 *   - Regular: circle
 */

import {
  LAND_SPACES, SEA_ZONES, LAND_EDGES, SEA_EDGES,
  SPACE_COORDINATES, SEA_ZONE_COORDINATES, SEA_ZONE_POLYGONS,
  SPACE_BY_NAME
} from '../data/map-data.js';
import {
  DISCOVERIES, CONQUESTS, AMAZON, PACIFIC_STRAIT, CIRCUMNAVIGATION
} from '../constants.js';

// ── Constants ──────────────────────────────────────────────────────

/** Original VASSAL map pixel dimensions */
const SOURCE_W = 5100;
const SOURCE_H = 3400;

/** Default SVG viewBox dimensions (scaled down for rendering) */
const VIEW_W = 1700;
const VIEW_H = 1133;

/** Scale factor from source coordinates to viewBox */
const SCALE = VIEW_W / SOURCE_W;

/** Space node sizes */
const SPACE_R = 11;
const KEY_SPACE_R = 14;
const SEA_ZONE_R = 18;

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

// ── SVG Namespace ──────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// ── Geometry Helpers ───────────────────────────────────────────────

/** Find closest point on a polygon boundary to a given point */
function closestPointOnPolygon(polygon, px, py) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const pt = closestPointOnSegment(a.x, a.y, b.x, b.y, px, py);
    const d = (pt.x - px) ** 2 + (pt.y - py) ** 2;
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
}

/** Closest point on line segment (ax,ay)-(bx,by) to point (px,py) */
function closestPointOnSegment(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy };
}

/** Find closest pair of boundary points between two polygons */
function closestBoundaryPair(polyA, polyB) {
  let best = null;
  let bestDist = Infinity;
  // Sample midpoints of each edge of polyA, find closest on polyB
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    const mid = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 };
    const ptB = closestPointOnPolygon(polyB, mid.x, mid.y);
    const d = (mid.x - ptB.x) ** 2 + (mid.y - ptB.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = { a: mid, b: ptB };
    }
  }
  return best;
}

/** Generate hexagon points string for SVG */
function hexagonPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

/** Generate 8-pointed star points string for SVG */
function starPoints(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const outerAngle = (Math.PI / 4) * i - Math.PI / 2;
    pts.push(`${cx + outerR * Math.cos(outerAngle)},${cy + outerR * Math.sin(outerAngle)}`);
    const innerAngle = outerAngle + Math.PI / 8;
    pts.push(`${cx + innerR * Math.cos(innerAngle)},${cy + innerR * Math.sin(innerAngle)}`);
  }
  return pts.join(' ');
}

// ── New World Layout ──────────────────────────────────────────────

/** New World locations with approximate positions (source coordinates)
 *  Positioned to align vertically with the Atlantic Ocean sea zone (~y 1950-3070) */
const NEW_WORLD_ITEMS = [
  { id: 'st_lawrence', name: 'St. Lawrence River', vp: 1, x: 420, y: 1940, type: 'discovery', color: '#4a90d9' },
  { id: 'great_lakes', name: 'Great Lakes', vp: 1, x: 270, y: 1880, type: 'discovery', color: '#4a90d9' },
  { id: 'mississippi', name: 'Mississippi River', vp: 1, x: 270, y: 2070, type: 'discovery', color: '#4a90d9' },
  { id: 'amazon', name: 'Amazon River', vp: 2, x: 470, y: 2460, type: 'discovery', color: '#4a90d9' },
  { id: 'pacific_strait', name: 'Pacific Strait', vp: 1, x: 310, y: 2980, type: 'discovery', color: '#4a90d9' },
  { id: 'circumnavigation', name: 'Circumnavigation', vp: 3, x: 120, y: 2650, type: 'special', color: '#78909c' },
  { id: 'aztec', name: 'Aztec Empire', vp: 2, x: 170, y: 2250, type: 'conquest', color: '#2e7d32' },
  { id: 'maya', name: 'Maya', vp: 1, x: 280, y: 2270, type: 'conquest', color: '#2e7d32' },
  { id: 'inca', name: 'Inca Empire', vp: 2, x: 350, y: 2620, type: 'conquest', color: '#2e7d32' },
];

// ── MapRenderer Class ──────────────────────────────────────────────

export class MapRenderer {
  constructor() {
    this._svg = null;
    this._spaceNodes = {};
    this._seaZoneNodes = {};
    this._newWorldNodes = {};
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
    const newWorldGroup = svgEl('g', { class: 'his-map-new-world' });
    const langZoneGroup = svgEl('g', { class: 'his-map-lang-zones' });
    const edgesGroup = svgEl('g', { class: 'his-map-edges' });
    const seaGroup = svgEl('g', { class: 'his-map-sea-zones' });
    const portLinesGroup = svgEl('g', { class: 'his-map-port-lines' });
    const spacesGroup = svgEl('g', { class: 'his-map-spaces' });
    this._labelsGroup = svgEl('g', { class: 'his-map-labels' });
    this._overlayGroup = svgEl('g', { class: 'his-map-overlay' });

    // Render New World panel (leftmost area)
    this._renderNewWorld(newWorldGroup);

    // Render language zone backgrounds
    this._renderLanguageZones(langZoneGroup);

    // Render sea zones first (background)
    this._renderSeaZones(seaGroup);

    // Render edges (land + sea boundary connections)
    this._renderEdges(edgesGroup);
    this._renderSeaEdges(edgesGroup);

    // Render port-to-sea connections
    this._renderPortConnections(portLinesGroup);

    // Render land spaces
    this._renderSpaces(spacesGroup);

    // Render labels
    this._renderLabels(this._labelsGroup);

    this._svg.appendChild(newWorldGroup);
    this._svg.appendChild(langZoneGroup);
    this._svg.appendChild(seaGroup);
    this._svg.appendChild(edgesGroup);
    this._svg.appendChild(portLinesGroup);
    this._svg.appendChild(spacesGroup);
    this._svg.appendChild(this._labelsGroup);
    this._svg.appendChild(this._overlayGroup);

    return this._svg;
  }

  getOverlayGroup() { return this._overlayGroup; }
  setOnSpaceClick(fn) { this._onSpaceClick = fn; }
  setOnSpaceHover(fn) { this._onSpaceHover = fn; }

  /**
   * Update space appearance based on game state
   */
  updateFromState(state) {
    if (!state || !state.spaces) return;

    for (const [name, spaceState] of Object.entries(state.spaces)) {
      const node = this._spaceNodes[name];
      if (!node) continue;

      const controller = spaceState.controller || 'independent';
      const color = POWER_COLORS[controller] || POWER_COLORS.independent;
      node.setAttribute('stroke', color);
      node.setAttribute('stroke-width', '2.5');

      if (spaceState.religion === 'protestant') {
        node.setAttribute('fill', '#1a1a1a');
      } else if (spaceState.religion === 'catholic') {
        node.setAttribute('fill', '#fff');
      } else {
        node.setAttribute('fill', '#e0d5c5');
      }
    }

    // Update New World
    if (state.newWorld) {
      this._updateNewWorld(state.newWorld);
    }
  }

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

  selectSpace(spaceName) {
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

  // ── Language Zone Backgrounds ──────────────────────────────────

  _renderLanguageZones(group) {
    const LANG_COLORS = {
      german: 'rgba(180, 160, 120, 0.18)',
      french: 'rgba(100, 140, 200, 0.14)',
      english: 'rgba(200, 100, 100, 0.14)',
      italian: 'rgba(120, 180, 120, 0.16)',
      spanish: 'rgba(200, 170, 80, 0.14)',
    };
    const LANG_R = 25; // radius of background blob per space

    for (const space of LAND_SPACES) {
      if (!space.languageZone || !LANG_COLORS[space.languageZone]) continue;
      const coord = SPACE_COORDINATES[space.name];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);
      const blob = svgEl('circle', {
        cx, cy, r: LANG_R,
        fill: LANG_COLORS[space.languageZone],
        'pointer-events': 'none',
      });
      group.appendChild(blob);
    }
  }

  // ── Land Edges ─────────────────────────────────────────────────

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

  // ── Sea Edges (boundary-to-boundary) ───────────────────────────

  _renderSeaEdges(group) {
    for (const edge of SEA_EDGES) {
      const polyA = SEA_ZONE_POLYGONS[edge.a];
      const polyB = SEA_ZONE_POLYGONS[edge.b];

      if (polyA && polyB) {
        // Connect via closest boundary points
        const pair = closestBoundaryPair(polyA, polyB);
        if (pair) {
          const line = svgEl('line', {
            x1: this._toViewX(pair.a.x),
            y1: this._toViewY(pair.a.y),
            x2: this._toViewX(pair.b.x),
            y2: this._toViewY(pair.b.y),
            stroke: '#4a90d9',
            'stroke-width': '1',
            'stroke-dasharray': '4,3',
            opacity: '0.5',
          });
          group.appendChild(line);
          continue;
        }
      }

      // Fallback: centroid-to-centroid
      const a = SEA_ZONE_COORDINATES[edge.a];
      const b = SEA_ZONE_COORDINATES[edge.b];
      if (!a || !b) continue;
      const line = svgEl('line', {
        x1: this._toViewX(a.x), y1: this._toViewY(a.y),
        x2: this._toViewX(b.x), y2: this._toViewY(b.y),
        stroke: '#4a90d9',
        'stroke-width': '0.8',
        'stroke-dasharray': '4,3',
        opacity: '0.4',
      });
      group.appendChild(line);
    }
  }

  // ── Port-to-Sea Connections (to boundary) ──────────────────────

  _renderPortConnections(group) {
    for (const space of LAND_SPACES) {
      if (!space.isPort || !space.connectedSeaZones.length) continue;
      const coord = SPACE_COORDINATES[space.name];
      if (!coord) continue;

      const px = coord.x;
      const py = coord.y;

      for (const szName of space.connectedSeaZones) {
        const polygon = SEA_ZONE_POLYGONS[szName];
        let tx, ty;

        if (polygon) {
          const pt = closestPointOnPolygon(polygon, px, py);
          tx = pt.x; ty = pt.y;
        } else {
          const c = SEA_ZONE_COORDINATES[szName];
          if (!c) continue;
          tx = c.x; ty = c.y;
        }

        const line = svgEl('line', {
          x1: this._toViewX(px), y1: this._toViewY(py),
          x2: this._toViewX(tx), y2: this._toViewY(ty),
          stroke: '#4a90d9',
          'stroke-width': '0.5',
          'stroke-dasharray': '2,2',
          opacity: '0.35',
        });
        group.appendChild(line);
      }
    }
  }

  // ── Sea Zones ──────────────────────────────────────────────────

  _renderSeaZones(group) {
    for (const szName of SEA_ZONES) {
      const coord = SEA_ZONE_COORDINATES[szName];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);
      const polygon = SEA_ZONE_POLYGONS[szName];

      let zoneEl;
      if (polygon) {
        const points = polygon
          .map(p => `${this._toViewX(p.x)},${this._toViewY(p.y)}`)
          .join(' ');
        zoneEl = svgEl('polygon', {
          points,
          fill: 'rgba(74, 144, 217, 0.12)',
          stroke: '#4a90d9',
          'stroke-width': '0.6',
          'stroke-dasharray': '3,2',
          class: 'his-sea-zone',
          'data-name': szName,
          cursor: 'pointer',
        });
      } else {
        zoneEl = svgEl('circle', {
          cx, cy, r: SEA_ZONE_R,
          fill: 'rgba(74, 144, 217, 0.15)',
          stroke: '#4a90d9',
          'stroke-width': '1',
          class: 'his-sea-zone',
          'data-name': szName,
          cursor: 'pointer',
        });
      }

      zoneEl.addEventListener('click', () => {
        if (this._onSpaceClick) this._onSpaceClick(szName, 'sea');
      });
      group.appendChild(zoneEl);
      this._seaZoneNodes[szName] = zoneEl;

      // Label
      const label = svgEl('text', {
        x: cx, y: cy + 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': '6.5',
        fill: '#2c5f9e',
        'font-weight': 'bold',
        class: 'his-sea-label',
        'pointer-events': 'none',
        opacity: '0.7',
      });
      label.textContent = szName.replace(' Sea', '').replace(' Ocean', '');
      group.appendChild(label);
    }
  }

  // ── Land Spaces (shape by type) ────────────────────────────────

  _renderSpaces(group) {
    for (const space of LAND_SPACES) {
      const coord = SPACE_COORDINATES[space.name];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);
      const controller = space.controller || 'independent';
      const color = POWER_COLORS[controller] || POWER_COLORS.independent;

      let shapeEl;

      if (space.isKey) {
        // Key city: square
        const s = KEY_SPACE_R * 1.6;
        shapeEl = svgEl('rect', {
          x: cx - s / 2, y: cy - s / 2,
          width: s, height: s,
          fill: '#fff',
          stroke: color,
          'stroke-width': '2.5',
          class: 'his-space his-key-space',
          'data-name': space.name,
          cursor: 'pointer',
        });
      } else if (space.isFortress) {
        // Fortress: 8-pointed star
        const pts = starPoints(cx, cy, SPACE_R + 3, SPACE_R);
        shapeEl = svgEl('polygon', {
          points: pts,
          fill: '#fff',
          stroke: color,
          'stroke-width': '1.8',
          class: 'his-space his-fortress',
          'data-name': space.name,
          cursor: 'pointer',
        });
      } else if (space.isElectorate) {
        // Electorate: hexagon
        const pts = hexagonPoints(cx, cy, SPACE_R + 1);
        shapeEl = svgEl('polygon', {
          points: pts,
          fill: '#fff',
          stroke: color,
          'stroke-width': '1.8',
          class: 'his-space his-electorate',
          'data-name': space.name,
          cursor: 'pointer',
        });
      } else {
        // Regular: circle
        shapeEl = svgEl('circle', {
          cx, cy, r: SPACE_R,
          fill: '#fff',
          stroke: color,
          'stroke-width': '1.8',
          class: `his-space ${space.isPort ? 'his-port' : ''}`,
          'data-name': space.name,
          cursor: 'pointer',
        });
      }

      // Port indicator (small blue dot)
      if (space.isPort) {
        const pr = space.isKey ? KEY_SPACE_R * 0.8 : SPACE_R;
        const portMark = svgEl('circle', {
          cx: cx + pr - 1, cy: cy + pr - 1, r: 2,
          fill: '#4a90d9',
          stroke: '#fff',
          'stroke-width': '0.5',
          'pointer-events': 'none',
        });
        group.appendChild(portMark);
      }

      // Events
      shapeEl.addEventListener('click', () => {
        if (this._onSpaceClick) this._onSpaceClick(space.name, 'land');
      });
      shapeEl.addEventListener('mouseenter', () => {
        if (this._onSpaceHover) this._onSpaceHover(space.name, true);
      });
      shapeEl.addEventListener('mouseleave', () => {
        if (this._onSpaceHover) this._onSpaceHover(space.name, false);
      });

      group.appendChild(shapeEl);
      this._spaceNodes[space.name] = shapeEl;
    }
  }

  // ── Labels ─────────────────────────────────────────────────────

  _renderLabels(group) {
    for (const space of LAND_SPACES) {
      const coord = SPACE_COORDINATES[space.name];
      if (!coord) continue;

      const cx = this._toViewX(coord.x);
      const cy = this._toViewY(coord.y);
      const r = space.isKey ? KEY_SPACE_R + 2 : SPACE_R + 1;

      const label = svgEl('text', {
        x: cx, y: cy + r + 7,
        'text-anchor': 'middle',
        'font-size': space.isKey ? '7' : '5.5',
        'font-weight': space.isKey ? 'bold' : 'normal',
        fill: '#3e2723',
        class: 'his-space-label',
        'pointer-events': 'none',
      });
      label.textContent = space.name;
      group.appendChild(label);
    }
  }

  // ── New World Panel ────────────────────────────────────────────

  _renderNewWorld(group) {
    // Background panel (left side, matching the original map)
    const panelX = 0;
    const panelW = this._toViewX(700);
    const panelH = VIEW_H;

    // Water background
    const bg = svgEl('rect', {
      x: panelX, y: 0,
      width: panelW, height: panelH,
      fill: '#c9b99a',
      opacity: '0.4',
    });
    group.appendChild(bg);

    // Continental outline (simplified Americas, shifted to align with Atlantic)
    const coastPts = [
      { x: 180, y: 1700 }, { x: 250, y: 1680 }, { x: 380, y: 1720 },
      { x: 480, y: 1800 }, { x: 500, y: 1950 }, { x: 430, y: 2100 },
      { x: 350, y: 2160 }, { x: 250, y: 2200 }, { x: 200, y: 2220 },
      { x: 300, y: 2280 }, { x: 380, y: 2300 }, { x: 500, y: 2380 },
      { x: 550, y: 2480 }, { x: 500, y: 2600 }, { x: 420, y: 2700 },
      { x: 350, y: 2800 }, { x: 320, y: 2950 }, { x: 280, y: 3040 },
      { x: 200, y: 2950 }, { x: 280, y: 2700 }, { x: 300, y: 2550 },
      { x: 250, y: 2400 }, { x: 170, y: 2300 }, { x: 130, y: 2200 },
      { x: 100, y: 2050 }, { x: 120, y: 1900 }, { x: 150, y: 1800 },
    ].map(p => `${this._toViewX(p.x)},${this._toViewY(p.y)}`).join(' ');

    const coast = svgEl('polygon', {
      points: coastPts,
      fill: '#d4c8a0',
      stroke: '#a0926e',
      'stroke-width': '0.8',
      opacity: '0.6',
    });
    group.appendChild(coast);

    // Title
    const title = svgEl('text', {
      x: this._toViewX(100), y: this._toViewY(1750),
      'font-size': '8',
      'font-weight': 'bold',
      fill: '#5d4037',
      opacity: '0.8',
    });
    title.textContent = 'The New World';
    group.appendChild(title);

    // Render each New World location
    for (const item of NEW_WORLD_ITEMS) {
      const cx = this._toViewX(item.x);
      const cy = this._toViewY(item.y);
      const isConquest = item.type === 'conquest';
      const isSpecial = item.type === 'special';
      const size = isConquest ? 10 : (isSpecial ? 8 : 8);

      // Background square/circle
      let marker;
      if (isConquest) {
        marker = svgEl('rect', {
          x: cx - size / 2, y: cy - size / 2,
          width: size, height: size,
          fill: item.color,
          stroke: '#fff',
          'stroke-width': '0.8',
          rx: 1,
          cursor: 'pointer',
          class: 'his-nw-marker',
          'data-id': item.id,
        });
      } else if (isSpecial) {
        marker = svgEl('rect', {
          x: cx - size / 2, y: cy - size / 2,
          width: size, height: size,
          fill: item.color,
          stroke: '#fff',
          'stroke-width': '0.8',
          rx: 1,
          cursor: 'pointer',
          class: 'his-nw-marker',
          'data-id': item.id,
        });
      } else {
        marker = svgEl('rect', {
          x: cx - size / 2, y: cy - size / 2,
          width: size, height: size,
          fill: item.color,
          stroke: '#fff',
          'stroke-width': '0.8',
          rx: 1,
          cursor: 'pointer',
          class: 'his-nw-marker',
          'data-id': item.id,
        });
      }

      marker.addEventListener('click', () => {
        if (this._onSpaceClick) this._onSpaceClick(item.id, 'new_world');
      });
      group.appendChild(marker);
      this._newWorldNodes[item.id] = marker;

      // VP badge
      const vpText = svgEl('text', {
        x: cx, y: cy + 1,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': '5',
        'font-weight': 'bold',
        fill: '#fff',
        'pointer-events': 'none',
      });
      vpText.textContent = `${item.vp} VP`;
      group.appendChild(vpText);

      // Name label
      const label = svgEl('text', {
        x: cx, y: cy + size / 2 + 7,
        'text-anchor': 'middle',
        'font-size': '4',
        fill: '#5d4037',
        'pointer-events': 'none',
      });
      label.textContent = item.name;
      group.appendChild(label);
    }

    // "Crossing Atlantic" arrow toward the sea zone
    const arrowX = this._toViewX(600);
    const arrowY = this._toViewY(2130);
    const arrow = svgEl('text', {
      x: arrowX, y: arrowY,
      'font-size': '6',
      fill: '#4a90d9',
      'font-weight': 'bold',
      opacity: '0.6',
    });
    arrow.textContent = 'Crossing →';
    group.appendChild(arrow);
    const arrowSub = svgEl('text', {
      x: arrowX, y: arrowY + 8,
      'font-size': '5',
      fill: '#4a90d9',
      opacity: '0.6',
    });
    arrowSub.textContent = 'Atlantic';
    group.appendChild(arrowSub);
  }

  /**
   * Update New World markers based on state
   */
  _updateNewWorld(nw) {
    // Mark discovered/conquered items
    for (const [id, node] of Object.entries(this._newWorldNodes)) {
      const discovered = nw.discoveries?.[id];
      const conquered = nw.conquests?.[id];
      if (discovered) {
        const color = POWER_COLORS[discovered] || '#4a90d9';
        node.setAttribute('fill', color);
        node.setAttribute('stroke', '#fff');
      }
      if (conquered) {
        const color = POWER_COLORS[conquered] || '#2e7d32';
        node.setAttribute('fill', color);
        node.setAttribute('stroke', '#ffd700');
        node.setAttribute('stroke-width', '1.2');
      }
    }
  }
}
