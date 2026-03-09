/**
 * Here I Stand — Game UI
 *
 * Main UI component that integrates:
 * - SVG map renderer (map/map-renderer.js)
 * - Map overlay for units (map/map-overlay.js)
 * - Map interaction (pan/zoom) (map/map-interaction.js)
 * - Status bar (ui/status-bar.js)
 * - Hand panel (ui/hand-panel.js)
 * - Power panel (ui/power-panel.js)
 *
 * Follows the same interface as UnoUI / WerewolfUI:
 *   render(state, playerId, onAction) -> HTMLElement
 *   updateState(state)
 *   renderActions(state, playerId, onAction) -> HTMLElement
 *   setGameBoard(gameBoard)
 */

import { MapRenderer } from './map/map-renderer.js';
import { MapOverlay } from './map/map-overlay.js';
import { MapInteraction } from './map/map-interaction.js';
import { StatusBar } from './ui/status-bar.js';
import { HandPanel } from './ui/hand-panel.js';
import { PowerPanel } from './ui/power-panel.js';
import { DiplomacyPanel } from './ui/diplomacy-panel.js';
import { PowerDetailPanel } from './ui/power-detail-panel.js';
import { ReligiousStrugglePanel } from './ui/religious-struggle-panel.js';
import { CARD_BY_NUMBER } from './data/cards.js';

export class HisUI {
  constructor() {
    this.state = null;
    this.playerId = null;
    this.onAction = null;
    this._container = null;
    this._gameBoard = null;
    this._playerPower = null;

    // Sub-components
    this._mapRenderer = new MapRenderer();
    this._mapOverlay = null;
    this._mapInteraction = null;
    this._statusBar = new StatusBar();
    this._handPanel = new HandPanel();
    this._powerPanel = new PowerPanel();
    this._diplomacyPanel = new DiplomacyPanel();
    this._powerDetailPanel = new PowerDetailPanel();
    this._religiousStrugglePanel = new ReligiousStrugglePanel();

    // Selected space for info display
    this._selectedSpace = null;
    this._tooltipEl = null;

    // Mount in game-ui-container (not ring center)
    this.mountInRingCenter = false;
  }

  /**
   * Set reference to GameBoard for timer control
   * @param {Object} gameBoard
   */
  setGameBoard(gameBoard) {
    this._gameBoard = gameBoard;
  }

  /**
   * Render the full game UI
   * @param {Object} state
   * @param {string} playerId
   * @param {Function} onAction
   * @returns {HTMLElement}
   */
  render(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;
    this._playerPower = this._resolvePlayerPower(state, playerId);

    // Root container — full width, vertical layout
    this._container = document.createElement('div');
    this._container.className = 'his-game-ui';
    this._container.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      box-sizing: border-box;
    `;

    // 1. Status bar
    const statusEl = this._statusBar.render();
    this._statusBar.update(state);
    this._container.appendChild(statusEl);

    // 2. Main area: map + sidebar
    const mainArea = document.createElement('div');
    mainArea.style.cssText = `
      display: flex;
      gap: 8px;
      flex: 1;
      min-height: 0;
    `;

    // 2a. Map container (flex: 1)
    const mapContainer = document.createElement('div');
    mapContainer.className = 'his-map-container';
    mapContainer.style.cssText = `
      flex: 1;
      min-height: 400px;
      max-height: 70vh;
      position: relative;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--border-default, #cbd5e1);
    `;

    const svgEl = this._mapRenderer.render();
    mapContainer.appendChild(svgEl);

    // Set up overlay
    this._mapOverlay = new MapOverlay(this._mapRenderer.getOverlayGroup());
    this._mapOverlay.update(state);

    // Set up interaction (pan/zoom)
    this._mapInteraction = new MapInteraction(svgEl);

    // Map click handler
    this._mapRenderer.setOnSpaceClick((name, type) => {
      this._onSpaceClicked(name, type);
    });

    // Hover tooltip
    this._mapRenderer.setOnSpaceHover((name, enter) => {
      if (enter) {
        this._showTooltip(name, mapContainer);
      } else {
        this._hideTooltip();
      }
    });

    // Zoom controls
    const zoomControls = this._renderZoomControls();
    mapContainer.appendChild(zoomControls);

    // Update space appearance from state
    this._mapRenderer.updateFromState(state);

    mainArea.appendChild(mapContainer);

    // 2b. Sidebar with tabs
    const sidebar = document.createElement('div');
    sidebar.className = 'his-sidebar';
    sidebar.style.cssText = `
      display: flex; flex-direction: column; gap: 0;
      min-width: 220px; max-width: 280px;
    `;

    // Tab bar
    this._sidebarTabs = document.createElement('div');
    this._sidebarTabs.style.cssText = `
      display: flex; gap: 0; border-bottom: 2px solid #e2e8f0;
    `;
    this._sidebarContent = document.createElement('div');
    this._sidebarContent.style.cssText = `
      flex: 1; min-height: 0; overflow-y: auto;
    `;

    // Render all panels (hidden by default)
    const powerEl = this._powerPanel.render();
    const diploEl = this._diplomacyPanel.render();
    const detailEl = this._powerDetailPanel.render();
    const rsEl = this._religiousStrugglePanel.render();

    this._sidebarPanels = {
      power: powerEl, diplomacy: diploEl,
      detail: detailEl, religious: rsEl,
    };
    const tabDefs = [
      { key: 'power', label: '势力' },
      { key: 'diplomacy', label: '外交' },
      { key: 'detail', label: '详情' },
      { key: 'religious', label: '宗教' },
    ];
    this._activeTab = 'power';
    for (const def of tabDefs) {
      const tab = document.createElement('button');
      tab.style.cssText = `
        flex:1;padding:4px 2px;font-size:10px;font-weight:600;
        border:none;cursor:pointer;background:transparent;
        border-bottom:2px solid transparent;margin-bottom:-2px;
      `;
      tab.textContent = def.label;
      tab.addEventListener('click', () => this._switchTab(def.key));
      this._sidebarTabs.appendChild(tab);
    }

    sidebar.appendChild(this._sidebarTabs);
    sidebar.appendChild(this._sidebarContent);

    // Initialize panels
    this._powerPanel.update(state, this._playerPower);
    this._diplomacyPanel.update(state);
    this._powerDetailPanel.update(state, this._playerPower);
    this._religiousStrugglePanel.update(state);
    this._switchTab('power');

    mainArea.appendChild(sidebar);
    this._container.appendChild(mainArea);

    // 3. Hand panel
    const handEl = this._handPanel.render((action) => {
      if (this.onAction) this.onAction(action);
    });
    const hand = this._resolveHandCards(state);
    const canPlay = state.activePower === this._playerPower
      && state.phase === 'action';
    this._handPanel.update(hand, this._playerPower, canPlay);
    this._container.appendChild(handEl);

    return this._container;
  }

  /**
   * Update UI from new state
   * @param {Object} state
   */
  updateState(state) {
    this.state = state;
    this._playerPower = this._resolvePlayerPower(state, this.playerId);

    // Update sub-components
    this._statusBar.update(state);
    this._mapRenderer.updateFromState(state);
    if (this._mapOverlay) this._mapOverlay.update(state);

    this._powerPanel.update(state, this._playerPower);
    this._diplomacyPanel.update(state);
    this._powerDetailPanel.update(state, this._playerPower);
    this._religiousStrugglePanel.update(state);

    const hand = this._resolveHandCards(state);
    const canPlay = state.activePower === this._playerPower
      && state.phase === 'action';
    this._handPanel.update(hand, this._playerPower, canPlay);
  }

  _switchTab(key) {
    this._activeTab = key;
    this._sidebarContent.innerHTML = '';
    const panel = this._sidebarPanels[key];
    if (panel) this._sidebarContent.appendChild(panel);

    // Update tab styles
    if (this._sidebarTabs) {
      const tabs = this._sidebarTabs.children;
      const keys = ['power', 'diplomacy', 'detail', 'religious'];
      for (let i = 0; i < tabs.length; i++) {
        const isActive = keys[i] === key;
        tabs[i].style.borderBottomColor = isActive ? '#5c6bc0' : 'transparent';
        tabs[i].style.color = isActive ? '#5c6bc0' : '#64748b';
      }
    }
  }

  /**
   * Render action buttons
   * @returns {HTMLElement}
   */
  renderActions(state, playerId, onAction) {
    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    `;

    const isActive = state.activePower === this._playerPower;

    if (isActive && state.phase === 'action') {
      // Pass button
      const passBtn = this._actionBtn('跳过 (PASS)', () => {
        if (onAction) onAction({ type: 'PASS' });
      });
      bar.appendChild(passBtn);
    }

    // Reset map view
    const resetBtn = this._actionBtn('重置地图', () => {
      if (this._mapInteraction) this._mapInteraction.resetView();
    }, true);
    bar.appendChild(resetBtn);

    return bar;
  }

  // ── Private Helpers ──────────────────────────────────────────

  /**
   * Convert hand card numbers to card objects for display.
   * state.hands[power] stores card numbers; hand-panel expects objects.
   */
  _resolveHandCards(state) {
    const raw = state.hands?.[this._playerPower];
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(cardNum => {
      const card = CARD_BY_NUMBER[cardNum];
      if (!card) return { number: cardNum, cp: 0, name: `Card ${cardNum}`, type: '', associatedPower: '' };
      return {
        number: card.number,
        cp: card.cp,
        name: card.title || card.name || `Card ${card.number}`,
        type: card.category || card.deck || '',
        associatedPower: card.deck === 'home' ? this._playerPower : '',
        description: card.description || '',
        deck: card.deck || '',
        removeAfterPlay: card.removeAfterPlay || false
      };
    });
  }

  _resolvePlayerPower(state, playerId) {
    if (!state || !state.players) return 'ottoman';
    const player = state.players.find(p => p.id === playerId);
    return player?.power || 'ottoman';
  }

  _onSpaceClicked(name, type) {
    this._selectedSpace = name;
    this._mapRenderer.selectSpace(name);
    if (this.onAction) {
      this.onAction({
        type: 'SELECT_SPACE',
        data: { space: name, spaceType: type }
      });
    }
  }

  _showTooltip(spaceName, container) {
    this._hideTooltip();
    if (!this.state?.spaces?.[spaceName]) return;

    const sp = this.state.spaces[spaceName];
    this._tooltipEl = document.createElement('div');
    this._tooltipEl.className = 'his-tooltip';
    this._tooltipEl.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255,255,255,0.95);
      border: 1px solid var(--border-default, #cbd5e1);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      z-index: 10;
      pointer-events: none;
      max-width: 200px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    `;

    let html = `<b>${spaceName}</b><br>`;
    html += `控制: ${sp.controller || '—'}<br>`;
    if (sp.religion) html += `宗教: ${sp.religion}<br>`;
    if (sp.languageZone) html += `语言区: ${sp.languageZone}<br>`;
    if (sp.isKey) html += `🔑 关键城市<br>`;
    if (sp.isFortress) html += `🏰 要塞<br>`;
    if (sp.isPort) html += `⚓ 港口<br>`;
    if (sp.isElectorate) html += `👑 选帝侯<br>`;

    // Units
    if (sp.units && sp.units.length > 0) {
      for (const u of sp.units) {
        const parts = [];
        if (u.regulars > 0) parts.push(`${u.regulars}正规`);
        if (u.mercenaries > 0) parts.push(`${u.mercenaries}雇佣`);
        if (u.cavalry > 0) parts.push(`${u.cavalry}骑兵`);
        if (u.squadrons > 0) parts.push(`${u.squadrons}舰队`);
        if (u.corsairs > 0) parts.push(`${u.corsairs}海盗`);
        if (parts.length > 0) {
          html += `${u.owner}: ${parts.join(', ')}<br>`;
        }
        if (u.leaders && u.leaders.length > 0) {
          html += `将领: ${u.leaders.join(', ')}<br>`;
        }
      }
    }

    this._tooltipEl.innerHTML = html;
    container.appendChild(this._tooltipEl);
  }

  _hideTooltip() {
    if (this._tooltipEl && this._tooltipEl.parentNode) {
      this._tooltipEl.parentNode.removeChild(this._tooltipEl);
    }
    this._tooltipEl = null;
  }

  _renderZoomControls() {
    const controls = document.createElement('div');
    controls.style.cssText = `
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 5;
    `;

    const zoomIn = this._zoomBtn('+', () => {
      if (this._mapInteraction) {
        // Simulate zoom in at center
        const svg = this._mapRenderer._svg;
        const rect = svg.getBoundingClientRect();
        this._mapInteraction._zoom(0.8, rect.left + rect.width / 2,
          rect.top + rect.height / 2);
      }
    });
    const zoomOut = this._zoomBtn('−', () => {
      if (this._mapInteraction) {
        const svg = this._mapRenderer._svg;
        const rect = svg.getBoundingClientRect();
        this._mapInteraction._zoom(1.25, rect.left + rect.width / 2,
          rect.top + rect.height / 2);
      }
    });
    const reset = this._zoomBtn('⟳', () => {
      if (this._mapInteraction) this._mapInteraction.resetView();
    });

    controls.appendChild(zoomIn);
    controls.appendChild(zoomOut);
    controls.appendChild(reset);
    return controls;
  }

  _zoomBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      width: 28px; height: 28px;
      border: 1px solid var(--border-default, #cbd5e1);
      border-radius: 4px;
      background: rgba(255,255,255,0.9);
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: var(--text-primary, #1e293b);
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _actionBtn(text, onClick, secondary = false) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 6px 14px;
      border-radius: 6px;
      border: ${secondary ? '1px solid var(--border-default, #cbd5e1)' : 'none'};
      background: ${secondary ? 'var(--bg-primary, #fff)' : 'var(--primary-500, #667eea)'};
      color: ${secondary ? 'var(--text-primary, #1e293b)' : '#fff'};
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }
}
