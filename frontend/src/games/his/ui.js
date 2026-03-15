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
 * - Action panel (ui/action-panel.js)
 * - Selection manager (ui/selection-manager.js)
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
import { ActionPanel } from './ui/action-panel.js';
import { SelectionManager } from './ui/selection-manager.js';
import { EventDisplay } from './ui/event-display.js';
import { CombatDisplay } from './ui/combat-display.js';
import { ReligiousDisplay } from './ui/religious-display.js';
import { NewWorldDisplay } from './ui/new-world-display.js';
import { GameLog } from './ui/game-log.js';
import { SpaceDetail } from './ui/space-detail.js';
import { CARD_BY_NUMBER } from './data/cards.js';
import { MAJOR_POWERS } from './constants.js';

// ── Power Colors & Labels ────────────────────────────────────────

const POWER_COLORS = {
  ottoman: '#2e7d32', hapsburg: '#f9a825', england: '#c62828',
  france: '#1565c0', papacy: '#7b1fa2', protestant: '#1a1a1a'
};
const POWER_LABELS = {
  ottoman: '奥斯曼', hapsburg: '哈布斯堡', england: '英格兰',
  france: '法兰西', papacy: '教廷', protestant: '新教'
};
const ZONE_LABELS = {
  german: '德语区', french: '法语区', english: '英语区',
  italian: '意大利语区', spanish: '西班牙语区'
};

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
    this._actionPanel = new ActionPanel();
    this._selectionManager = new SelectionManager();
    this._eventDisplay = new EventDisplay();
    this._combatDisplay = new CombatDisplay();
    this._religiousDisplay = new ReligiousDisplay();
    this._newWorldDisplay = new NewWorldDisplay();
    this._gameLog = new GameLog();
    this._spaceDetail = new SpaceDetail();

    // UI state
    this._selectedSpace = null;
    this._selectedCard = null;
    this._tooltipEl = null;
    this._promptBarEl = null;
    this._pickerOverlayEl = null;
    this._mapContainer = null;
    this._lastEventLogLength = 0;

    // Mount in game-ui-container (not ring center)
    this.mountInRingCenter = false;
    // Opt-in to incremental update path (preserves map zoom/pan state)
    this.supportsIncrementalUpdate = true;
  }

  setGameBoard(gameBoard) {
    this._gameBoard = gameBoard;
  }

  // ── Main Render ──────────────────────────────────────────────

  render(state, playerId, onAction) {
    this.state = state;
    this.playerId = playerId;
    this.onAction = onAction;
    this._playerPower = this._resolvePlayerPower(state, playerId);

    // Root container
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

    // 2a. Map container
    this._mapContainer = document.createElement('div');
    this._mapContainer.className = 'his-map-container';
    this._mapContainer.style.cssText = `
      flex: 1;
      min-height: 400px;
      max-height: 70vh;
      position: relative;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid var(--border-default, #cbd5e1);
    `;

    const svgEl = this._mapRenderer.render();
    this._mapContainer.appendChild(svgEl);

    // Set up overlay
    this._mapOverlay = new MapOverlay(this._mapRenderer.getOverlayGroup());
    this._mapOverlay.update(state);

    // Set up interaction (pan/zoom)
    this._mapInteraction = new MapInteraction(svgEl);

    // Map click handler — routes through selection manager
    this._mapRenderer.setOnSpaceClick((name, type) => {
      this._onSpaceClicked(name, type);
    });

    // Hover tooltip
    this._mapRenderer.setOnSpaceHover((name, enter) => {
      if (enter) {
        this._showTooltip(name, this._mapContainer);
      } else {
        this._hideTooltip();
      }
    });

    // Zoom controls
    const zoomControls = this._renderZoomControls();
    this._mapContainer.appendChild(zoomControls);

    // Selection prompt bar (hidden by default)
    this._promptBarEl = this._createPromptBar();
    this._mapContainer.appendChild(this._promptBarEl);

    // Picker overlay (hidden by default)
    this._pickerOverlayEl = this._createPickerOverlay();
    this._mapContainer.appendChild(this._pickerOverlayEl);

    // Event display banner (inside map container)
    const eventBanner = this._eventDisplay.createBanner();
    this._mapContainer.appendChild(eventBanner);

    // Space detail panel (inside map container)
    const spaceDetailPanel = this._spaceDetail.createPanel();
    this._mapContainer.appendChild(spaceDetailPanel);

    // Update space appearance from state
    this._mapRenderer.updateFromState(state);

    mainArea.appendChild(this._mapContainer);

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

    // Render all panels
    const powerEl = this._powerPanel.render();
    const diploEl = this._diplomacyPanel.render();
    const detailEl = this._powerDetailPanel.render();
    const rsEl = this._religiousStrugglePanel.render();
    const logEl = this._gameLog.render();

    this._sidebarPanels = {
      power: powerEl, diplomacy: diploEl,
      detail: detailEl, religious: rsEl, log: logEl,
    };
    const tabDefs = [
      { key: 'power', label: '势力' },
      { key: 'diplomacy', label: '外交' },
      { key: 'detail', label: '详情' },
      { key: 'religious', label: '宗教' },
      { key: 'log', label: '日志' },
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

    // Game log: clicking a card event entry opens the event modal
    this._gameLog.setOnCardClick((cardNumber, power) => {
      const eventLog = this.state?.eventLog || [];
      const effects = this._collectEventEffects(eventLog, cardNumber);
      this._eventDisplay.showCard(cardNumber, power, effects);
    });

    this._switchTab('power');

    mainArea.appendChild(sidebar);
    this._container.appendChild(mainArea);

    // 3. Hand panel
    const handEl = this._handPanel.render((action) => {
      if (action.type === 'SELECT_CARD') {
        this._selectedCard = action.data?.card?.number ?? null;
        return; // UI-only, don't propagate to game engine
      }
      if (action.type === 'PREVIEW_CARD' && action.data?.card) {
        this._eventDisplay.showCard(
          action.data.card.number,
          this._playerPower, []
        );
        return; // Don't propagate to game engine
      }
      if (this.onAction) this.onAction(action);
    });
    const hand = this._resolveHandCards(state);
    const canPlay = state.activePower === this._playerPower
      && state.phase === 'action';
    this._handPanel.update(hand, this._playerPower, canPlay);
    this._container.appendChild(handEl);

    // 4. Overlays (fixed position, hidden)
    this._container.appendChild(this._eventDisplay.createOverlay());
    this._container.appendChild(this._combatDisplay.createOverlay());
    this._container.appendChild(this._religiousDisplay.createOverlay());
    this._container.appendChild(this._newWorldDisplay.createOverlay());

    // 5. Initialize game log and event tracking
    this._gameLog.update(state.eventLog || []);
    this._lastEventLogLength = (state.eventLog || []).length;

    return this._container;
  }

  // ── State Update ─────────────────────────────────────────────

  updateState(state) {
    this.state = state;
    this._playerPower = this._resolvePlayerPower(state, this.playerId);

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

    // Update space detail if visible
    if (this._spaceDetail.visible && this._spaceDetail.currentSpace) {
      this._spaceDetail.show(this._spaceDetail.currentSpace, state);
    }

    // Update game log
    const eventLog = state.eventLog || [];
    this._gameLog.update(eventLog);

    // Detect new card events and show banner/modal
    this._detectNewEvents(eventLog);

    // If a selection flow was active but state changed, cancel it
    if (this._selectionManager.active) {
      this._selectionManager.cancel();
      this._updateSelectionUI();
    }
  }

  _switchTab(key) {
    this._activeTab = key;
    this._sidebarContent.innerHTML = '';
    const panel = this._sidebarPanels[key];
    if (panel) this._sidebarContent.appendChild(panel);

    if (this._sidebarTabs) {
      const tabs = this._sidebarTabs.children;
      const keys = ['power', 'diplomacy', 'detail', 'religious', 'log'];
      for (let i = 0; i < tabs.length; i++) {
        const isActive = keys[i] === key;
        tabs[i].style.borderBottomColor = isActive ? '#5c6bc0' : 'transparent';
        tabs[i].style.color = isActive ? '#5c6bc0' : '#64748b';
      }
    }
  }

  // ── Render Actions ───────────────────────────────────────────

  renderActions(state, playerId, onAction) {
    this.state = state;
    this.onAction = onAction;
    this._playerPower = this._resolvePlayerPower(state, playerId);

    const stateWithUI = { ...state, _uiSelectedCard: this._selectedCard };

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;gap:8px;align-items:flex-start;';

    // Action panel — passes startSelection callback
    const panelEl = this._actionPanel.render(
      stateWithUI,
      this._playerPower,
      (action) => {
        // Direct actions (PASS, PLAY_CARD_CP, etc.)
        if (action.actionType === 'PLAY_CARD_CP' || action.actionType === 'PLAY_CARD_EVENT') {
          this._selectedCard = null;
        }
        if (onAction) onAction(action);
      },
      (actionType) => {
        // Start a selection flow
        this._startSelectionFlow(actionType);
      }
    );
    wrapper.appendChild(panelEl);

    // Reset map button
    const resetBtn = this._actionBtn('重置地图', () => {
      if (this._mapInteraction) this._mapInteraction.resetView();
    }, true);
    resetBtn.style.alignSelf = 'flex-start';
    wrapper.appendChild(resetBtn);

    return wrapper;
  }

  // ── Selection Flow Integration ─────────────────────────────

  _startSelectionFlow(actionType) {
    this._selectionManager.startFlow(
      actionType,
      this.state,
      this._playerPower,
      // onComplete — emit the final action to the game engine
      (action) => {
        this._updateSelectionUI();
        if (this.onAction) this.onAction(action);
      },
      // onUpdate — refresh the prompt bar and highlights
      () => {
        this._updateSelectionUI();
      }
    );
    this._updateSelectionUI();
  }

  _updateSelectionUI() {
    const sm = this._selectionManager;

    if (!sm.active) {
      // Clear highlights and hide prompt
      this._mapRenderer.clearHighlights();
      this._hidePromptBar();
      this._hidePickerOverlay();
      return;
    }

    // Show prompt bar
    this._showPromptBar(sm.prompt, sm.actionType);

    // Highlight valid targets on map for 'space' steps
    if (sm.stepType === 'space' && sm.validTargets) {
      this._mapRenderer.highlightSpaces(sm.validTargets, '#ffeb3b');
    } else {
      this._mapRenderer.clearHighlights();
    }

    // Show picker overlay for 'zone' or 'power' steps
    if (sm.stepType === 'zone') {
      this._showZonePicker(sm.validTargets);
    } else if (sm.stepType === 'power') {
      this._showPowerPicker(sm.validTargets);
    } else if (sm.stepType === 'units') {
      this._showUnitSelector();
    } else {
      this._hidePickerOverlay();
    }
  }

  // ── Event Detection ────────────────────────────────────────

  _detectNewEvents(eventLog) {
    if (eventLog.length <= this._lastEventLogLength) {
      this._lastEventLogLength = eventLog.length;
      return;
    }

    // Find new entries since last check
    const newEntries = eventLog.slice(this._lastEventLogLength);
    this._lastEventLogLength = eventLog.length;

    // Process new entries for display
    for (const entry of newEntries) {
      if (entry.type === 'play_card_event' && entry.data) {
        const { cardNumber, power } = entry.data;
        const eventIdx = eventLog.indexOf(entry);
        const effects = [];
        for (let i = eventIdx + 1; i < eventLog.length; i++) {
          const e = eventLog[i];
          if (e.type === 'play_card_event' || e.type === 'play_card' ||
              e.type === 'action_phase_end' || e.type === 'pass') break;
          effects.push(e);
        }
        this._eventDisplay.showBanner(cardNumber, power, effects);
      }

      // Combat results
      if (entry.type === 'field_battle' && entry.data) {
        this._combatDisplay.showFieldBattle(entry.data);
      } else if (entry.type === 'assault' && entry.data) {
        this._combatDisplay.showAssault(entry.data);
      } else if (entry.type === 'naval_combat' && entry.data) {
        this._combatDisplay.showNavalCombat(entry.data);
      } else if (entry.type === 'interception_attempt' && entry.data) {
        this._combatDisplay.showInterception(entry.data);
      }

      // Debate results
      if (entry.type === 'debate_result' && entry.data) {
        this._religiousDisplay.showDebateResult(entry.data);
      }

      // Reformation results
      if ((entry.type === 'reformation_success' ||
           entry.type === 'reformation_failure') && entry.data) {
        this._religiousDisplay.showReformation(entry.data, false);
      }
      if ((entry.type === 'counter_reformation_success' ||
           entry.type === 'counter_reformation_failure') && entry.data) {
        this._religiousDisplay.showReformation(entry.data, true);
      }

      // Luther 95 reformation results
      if ((entry.type === 'luther_reform_success' ||
           entry.type === 'luther_reform_failure') && entry.data) {
        this._religiousDisplay.showReformation(entry.data, false);
      }

      // New World results
      if ((entry.type === 'discovery_made' || entry.type === 'no_discovery' ||
           entry.type === 'explorer_lost') && entry.data) {
        this._newWorldDisplay.showExploration({ ...entry.data, type: entry.type });
      }
      if ((entry.type === 'circumnavigation_success' ||
           entry.type === 'circumnavigation_failed') && entry.data) {
        this._newWorldDisplay.showCircumnavigation({ ...entry.data, type: entry.type });
      }
      if ((entry.type === 'conquest_made' ||
           entry.type === 'conquest_failed') && entry.data) {
        this._newWorldDisplay.showConquest({ ...entry.data, type: entry.type });
      }
    }
  }

  /**
   * Collect log entries that are effects of a specific card event.
   */
  _collectEventEffects(eventLog, cardNumber) {
    const effects = [];
    let found = false;
    for (let i = eventLog.length - 1; i >= 0; i--) {
      if (eventLog[i].type === 'play_card_event' &&
          eventLog[i].data?.cardNumber === cardNumber) {
        // Collect entries after this one
        for (let j = i + 1; j < eventLog.length; j++) {
          const e = eventLog[j];
          if (e.type === 'play_card_event' || e.type === 'play_card' ||
              e.type === 'action_phase_end' || e.type === 'pass') break;
          effects.push(e);
        }
        found = true;
        break;
      }
    }
    return effects;
  }

  // ── Space Click Handler ──────────────────────────────────────

  _onSpaceClicked(name, type) {
    // If selection manager is active, route click there first
    if (this._selectionManager.active) {
      const consumed = this._selectionManager.onSpaceClicked(
        name, this.state, this._playerPower
      );
      if (consumed) return;
    }

    // Default: show space detail panel
    this._selectedSpace = name;
    this._mapRenderer.selectSpace(name);

    // Toggle detail panel: clicking same space hides it
    if (this._spaceDetail.visible && this._spaceDetail.currentSpace === name) {
      this._spaceDetail.hide();
    } else {
      this._spaceDetail.show(name, this.state);
    }
  }

  // ── Prompt Bar ───────────────────────────────────────────────

  _createPromptBar() {
    const bar = document.createElement('div');
    bar.className = 'his-prompt-bar';
    bar.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0;
      background: rgba(92, 107, 192, 0.95);
      color: #fff;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 600;
      z-index: 15;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;
    return bar;
  }

  _showPromptBar(text, actionType) {
    if (!this._promptBarEl) return;
    this._promptBarEl.innerHTML = '';
    this._promptBarEl.style.display = 'flex';

    const label = document.createElement('span');
    label.textContent = text || '选择目标...';
    this._promptBarEl.appendChild(label);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.5);
      background: transparent; color: #fff; cursor: pointer;
      font-size: 11px; font-weight: 600;
    `;
    cancelBtn.addEventListener('click', () => {
      this._selectionManager.cancel();
      this._updateSelectionUI();
    });
    this._promptBarEl.appendChild(cancelBtn);
  }

  _hidePromptBar() {
    if (this._promptBarEl) {
      this._promptBarEl.style.display = 'none';
    }
  }

  // ── Picker Overlay (Zone / Power / Units) ────────────────────

  _createPickerOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'his-picker-overlay';
    overlay.style.cssText = `
      display: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.97);
      border: 2px solid #5c6bc0;
      border-radius: 10px;
      padding: 16px;
      z-index: 20;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      min-width: 200px;
      max-width: 320px;
    `;
    return overlay;
  }

  _showZonePicker(validZones) {
    if (!this._pickerOverlayEl) return;
    this._pickerOverlayEl.innerHTML = '';
    this._pickerOverlayEl.style.display = 'block';

    const title = document.createElement('div');
    title.textContent = '选择语言区';
    title.style.cssText = `
      font-weight: 700; font-size: 14px; margin-bottom: 10px;
      text-align: center; color: #1e293b;
    `;
    this._pickerOverlayEl.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

    const zones = validZones || ['german', 'french', 'english', 'italian', 'spanish'];
    const zoneColors = {
      german: '#b4a078', french: '#6490c8', english: '#c86464',
      italian: '#78b478', spanish: '#c8aa50'
    };

    for (const zone of zones) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding: 8px 16px; border-radius: 6px; cursor: pointer;
        font-size: 13px; font-weight: 600;
        border: 2px solid ${zoneColors[zone] || '#94a3b8'};
        background: ${zoneColors[zone] || '#e2e8f0'}22;
        color: #1e293b;
        transition: background 0.15s;
      `;
      btn.textContent = ZONE_LABELS[zone] || zone;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = (zoneColors[zone] || '#e2e8f0') + '44';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = (zoneColors[zone] || '#e2e8f0') + '22';
      });
      btn.addEventListener('click', () => {
        this._selectionManager.onZoneSelected(zone, this.state, this._playerPower);
      });
      grid.appendChild(btn);
    }

    this._pickerOverlayEl.appendChild(grid);
  }

  _showPowerPicker(validPowers) {
    if (!this._pickerOverlayEl) return;
    this._pickerOverlayEl.innerHTML = '';
    this._pickerOverlayEl.style.display = 'block';

    const title = document.createElement('div');
    title.textContent = '选择目标势力';
    title.style.cssText = `
      font-weight: 700; font-size: 14px; margin-bottom: 10px;
      text-align: center; color: #1e293b;
    `;
    this._pickerOverlayEl.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';

    const powers = validPowers || MAJOR_POWERS.filter(p => p !== this._playerPower);

    for (const power of powers) {
      const btn = document.createElement('button');
      const color = POWER_COLORS[power] || '#666';
      btn.style.cssText = `
        padding: 8px 14px; border-radius: 6px; cursor: pointer;
        font-size: 12px; font-weight: 700;
        border: 2px solid ${color};
        background: ${color}18;
        color: ${color};
        transition: background 0.15s;
      `;
      btn.textContent = POWER_LABELS[power] || power;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = color + '33';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = color + '18';
      });
      btn.addEventListener('click', () => {
        this._selectionManager.onPowerSelected(power, this.state, this._playerPower);
      });
      grid.appendChild(btn);
    }

    this._pickerOverlayEl.appendChild(grid);
  }

  _showUnitSelector() {
    if (!this._pickerOverlayEl) return;
    this._pickerOverlayEl.innerHTML = '';
    this._pickerOverlayEl.style.display = 'block';

    const sm = this._selectionManager;
    const collected = sm.collectedData;
    const fromSpace = collected.from;

    // Get available units in the source space
    let available = { regulars: 0, mercenaries: 0, cavalry: 0, leaders: [] };
    if (fromSpace && this.state?.spaces?.[fromSpace]) {
      const sp = this.state.spaces[fromSpace];
      const stack = sp.units?.find(u => u.owner === this._playerPower);
      if (stack) {
        available = {
          regulars: stack.regulars || 0,
          mercenaries: stack.mercenaries || 0,
          cavalry: stack.cavalry || 0,
          leaders: [...(stack.leaders || [])]
        };
      }
    }

    const title = document.createElement('div');
    title.textContent = '选择部队';
    title.style.cssText = `
      font-weight: 700; font-size: 14px; margin-bottom: 10px;
      text-align: center; color: #1e293b;
    `;
    this._pickerOverlayEl.appendChild(title);

    // Unit type spinners
    const unitTypes = [
      { key: 'regulars', label: '正规军', max: available.regulars },
      { key: 'mercenaries', label: '雇佣兵', max: available.mercenaries },
      { key: 'cavalry', label: '骑兵', max: available.cavalry }
    ];

    const values = { regulars: 0, mercenaries: 0, cavalry: 0, leaders: [] };
    const spinnerEls = {};

    for (const ut of unitTypes) {
      if (ut.max <= 0) continue;
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        margin: 4px 0; gap: 8px;
      `;

      const label = document.createElement('span');
      label.textContent = ut.label;
      label.style.cssText = 'font-size:12px;font-weight:600;min-width:60px;';

      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex;align-items:center;gap:4px;';

      const minusBtn = document.createElement('button');
      minusBtn.textContent = '-';
      minusBtn.style.cssText = this._spinnerBtnStyle();
      const countEl = document.createElement('span');
      countEl.textContent = '0';
      countEl.style.cssText = 'font-size:13px;font-weight:700;min-width:24px;text-align:center;';
      const plusBtn = document.createElement('button');
      plusBtn.textContent = '+';
      plusBtn.style.cssText = this._spinnerBtnStyle();

      const allBtn = document.createElement('button');
      allBtn.textContent = '全部';
      allBtn.style.cssText = `
        font-size:10px;padding:2px 6px;border-radius:3px;
        border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;
      `;

      spinnerEls[ut.key] = countEl;

      minusBtn.addEventListener('click', () => {
        if (values[ut.key] > 0) {
          values[ut.key]--;
          countEl.textContent = values[ut.key];
        }
      });
      plusBtn.addEventListener('click', () => {
        if (values[ut.key] < ut.max) {
          values[ut.key]++;
          countEl.textContent = values[ut.key];
        }
      });
      allBtn.addEventListener('click', () => {
        values[ut.key] = ut.max;
        countEl.textContent = values[ut.key];
      });

      controls.appendChild(minusBtn);
      controls.appendChild(countEl);
      controls.appendChild(plusBtn);
      controls.appendChild(allBtn);

      row.appendChild(label);
      row.appendChild(controls);
      this._pickerOverlayEl.appendChild(row);
    }

    // Leader checkboxes
    if (available.leaders.length > 0) {
      const leaderHeader = document.createElement('div');
      leaderHeader.textContent = '将领';
      leaderHeader.style.cssText = 'font-size:12px;font-weight:600;margin-top:8px;';
      this._pickerOverlayEl.appendChild(leaderHeader);

      for (const lid of available.leaders) {
        const row = document.createElement('label');
        row.style.cssText = `
          display:flex;align-items:center;gap:6px;margin:3px 0;
          font-size:12px;cursor:pointer;
        `;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        values.leaders.push(lid);

        cb.addEventListener('change', () => {
          if (cb.checked) {
            if (!values.leaders.includes(lid)) values.leaders.push(lid);
          } else {
            values.leaders = values.leaders.filter(l => l !== lid);
          }
        });

        row.appendChild(cb);
        row.appendChild(document.createTextNode(lid));
        this._pickerOverlayEl.appendChild(row);
      }
    }

    // Confirm button
    const confirmRow = document.createElement('div');
    confirmRow.style.cssText = 'margin-top:12px;text-align:center;';
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确认';
    confirmBtn.style.cssText = `
      padding:8px 24px;border-radius:6px;border:none;
      background:#5c6bc0;color:#fff;cursor:pointer;
      font-size:13px;font-weight:700;
    `;
    confirmBtn.addEventListener('click', () => {
      const total = values.regulars + values.mercenaries + values.cavalry
        + values.leaders.length;
      if (total === 0) return; // nothing selected

      this._selectionManager.onUnitsSelected(
        { ...values },
        this.state,
        this._playerPower
      );
    });
    confirmRow.appendChild(confirmBtn);
    this._pickerOverlayEl.appendChild(confirmRow);
  }

  _hidePickerOverlay() {
    if (this._pickerOverlayEl) {
      this._pickerOverlayEl.style.display = 'none';
    }
  }

  _spinnerBtnStyle() {
    return `
      width:24px;height:24px;border-radius:4px;border:1px solid #cbd5e1;
      background:#fff;cursor:pointer;font-size:14px;font-weight:700;
      display:flex;align-items:center;justify-content:center;padding:0;
    `;
  }

  // ── Private Helpers ──────────────────────────────────────────

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
