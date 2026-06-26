/**
 * Main Entry Point - Board Game Client
 * @module main
 */

import './theme/default.css';

import { registerGame, createGame, hasGame } from './game/registry.js';
import { NetworkClient } from './game/network.js';
import {
  loadConfig,
  saveSessionData,
  loadSessionData,
  saveRoomCreatePreset,
  loadRoomCreatePreset,
  saveGameSlot,
  loadGameSlot,
  listGameSlots,
  deleteGameSlot,
  exportSaveFile,
  importSaveFile,
  autoSaveGame,
  loadAutoSave,
  clearAutoSave
} from './utils/storage.js';
import { initAnalytics, setAnalyticsConsent, trackEvent } from './utils/analytics.js';

import { GameLobby } from './layout/game-lobby.js';
import { WaitingRoom } from './layout/waiting-room.js';
import { GameBoard } from './layout/game-board.js';
import { SettingsPanel } from './layout/settings-panel.js';
import { GameResult } from './layout/game-result.js';
import { AuthPage } from './layout/auth-page.js';

import { getModal } from './components/modal.js';
import { showNotification, showToast } from './components/notification.js';
import { showLoading, hideLoading, updateLoadingMessage } from './components/loading.js';
import { GameSettingsModal } from './components/game-settings-modal.js';
import registerAppReconnectMethods from './app/app-reconnect-methods.js';
import registerAppOnlineRoomMethods from './app/app-online-room-methods.js';

import { isCloudAvailable, getSupabaseClient } from './cloud/supabase-client.js';
import { AuthService } from './cloud/auth.js';
import { CloudNetworkClient } from './cloud/cloud-network.js';

import unoConfig from './games/uno/config.json';
import werewolfConfig from './games/werewolf/config.json';
import hisConfig from './games/his/config.json';
import { scheduleBotAction, initBotDecks, botPlayerId } from './games/his/ai/bot-controller.js';

const GAME_REGISTRY = {
  uno: {
    config: unoConfig
  },
  werewolf: {
    config: werewolfConfig
  },
  his: {
    config: hisConfig
  }
};

const GAME_LOADERS = {
  uno: async () => {
    const [gameModule, uiModule, ruleModule] = await Promise.all([
      import('./games/uno/index.js'),
      import('./games/uno/ui.js'),
      import('./games/uno/rules.js')
    ]);

    return {
      GameClass: gameModule.default,
      GameUI: uiModule.UnoUI,
      rules: {
        canPlayCard: ruleModule.canPlayCard,
        COLORS: ruleModule.COLORS,
        CARD_TYPES: ruleModule.CARD_TYPES
      }
    };
  },
  werewolf: async () => {
    const [gameModule, uiModule] = await Promise.all([
      import('./games/werewolf/index.js'),
      import('./games/werewolf/ui.js')
    ]);

    return {
      GameClass: gameModule.default,
      GameUI: uiModule.WerewolfUI
    };
  },
  his: async () => {
    const [gameModule, uiModule] = await Promise.all([
      import('./games/his/index.js'),
      import('./games/his/ui.js')
    ]);

    return {
      GameClass: gameModule.default || gameModule.HISGame,
      GameUI: uiModule.HisUI
    };
  }
};

const RECONNECT_CONTEXT_KEY = 'reconnectContext';
const RECONNECT_RESPONSE_TIMEOUT_MS = 8000;
const DEFAULT_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_COUNTDOWN_STEP_MS = 1000;
const DEFAULT_LOCAL_SERVER_URL = 'ws://localhost:7777';
const COMMIT_HASH = String(
  import.meta.env.VITE_COMMIT_HASH || import.meta.env.VITE_GIT_COMMIT || ''
).trim();
const IDLE_PRELOAD_DELAY_MS = 500;

/**
 * Application class
 */
class App {
  constructor() {
    /** @type {HTMLElement} */
    this.root = document.getElementById('app');

    /** @type {NetworkClient|null} */
    this.network = null;

    /** @type {Object|null} */
    this.currentGame = null;

    /** @type {Object|null} */
    this.currentView = null;

    /** @type {GameResult|null} */
    this._resultScreen = null;

    /** @type {Object|null} */
    this._lastGameResult = null;

    /** @type {boolean} */
    this._returnToRoomPromptOpen = false;

    /** @type {string} */
    this.playerId = '';

    /** @type {Object} */
    this.config = loadConfig();
    if (!this.config.analytics || typeof this.config.analytics !== 'object') {
      this.config.analytics = { enabled: false };
    }
    setAnalyticsConsent(this.config.analytics.enabled === true);

    /** @type {Object|null} */
    this.currentRoom = null;

    /** @type {'local'|'cloud'} */
    this.mode = 'local';

    /** @type {AuthService|null} */
    this.authService = null;

    /** @type {string} */
    this.sessionId = '';

    /** @type {boolean} */
    this._manualDisconnect = false;

    /** @type {boolean} */
    this._isReconnecting = false;

    /** @type {number|null} */
    this._reconnectAttemptTimer = null;

    /** @type {number|null} */
    this._reconnectResponseTimer = null;

    /** @type {number|null} */
    this._reconnectCountdownTimer = null;

    /** @type {number} */
    this._reconnectAttempts = 0;

    /** @type {Object|null} */
    this._reconnectContext = null;

    /** @type {Object|null} */
    this._joinRoomPrefill = null;

    /** @type {number|null} */
    this._gameStartAt = null;

    /** @type {{ roomId: string, nickname: string }|null} */
    this._pendingJoinAnalytics = null;

    /** @type {HTMLElement|null} */
    this._commitBadge = null;

    /** @type {Map<string, Promise<Object>>} */
    this._gameLoadPromises = new Map();

    /** @type {Map<string, Object>} */
    this._gameBundles = new Map();

    /** @type {Map<string, Function>} */
    this._gameUIConstructors = new Map();

    /** @type {{ canPlayCard: Function, COLORS: Array<string>, CARD_TYPES: Array<string> }|null} */
    this._unoRules = null;

    /** @type {number|null} */
    this._lobbyPreloadTimer = null;

    /** @type {string|null} */
    this._activeGameType = null;

    this._init();
}

  /**
   * Initialize the application
   * @private
   */
  _init() {
    this._registerGamePlaceholders();

    // Generate or load player ID (used for local mode)
    this.playerId = loadSessionData('playerId') || this._generatePlayerId();
    saveSessionData('playerId', this.playerId);
    this.sessionId = loadSessionData('sessionId') || this._generateSessionId();
    saveSessionData('sessionId', this.sessionId);

    // Initialize cloud auth if available
    if (isCloudAvailable()) {
      this.authService = new AuthService(getSupabaseClient());
      this.authService.initialize();
    }

    initAnalytics();
    trackEvent('app_opened', {
      mode: this.mode
    });

    this._renderCommitBadge();
    // Show lobby, then offer to resume an interrupted game after a reload (e.g.
    // a Vite HMR full reload during dev, or a manual refresh). Online sessions
    // resume via the reconnect context; failing that, an in-progress offline
    // game resumes from its sessionStorage auto-save. Prompt renders over the
    // lobby; declining stays here.
    this.showLobby();
    if (!this._resumeSessionIfAvailable()) {
      this._resumeOfflineGameIfAvailable();
    }
  }

  /**
   * Most recent in-progress offline auto-save (sessionStorage), or null.
   * Auto-saves live in sessionStorage, so they only survive within the same tab
   * — exactly the reload / HMR case, not a fresh visit.
   * @private
   * @returns {Object|null}
   */
  _loadLatestOfflineAutoSave() {
    const PREFIX = 'boardgame_autosave_';
    let best = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const save = JSON.parse(sessionStorage.getItem(key));
        if (save?.gameId && save?.state &&
            (!best || (save.savedAt || 0) > (best.savedAt || 0))) {
          best = save;
        }
      } catch (_) { /* skip corrupt entries */ }
    }
    return best;
  }

  /**
   * After a reload, offer to resume an in-progress offline (single-player) game
   * from its auto-save. Returns whether a prompt was shown.
   * @private
   * @returns {boolean}
   */
  _resumeOfflineGameIfAvailable() {
    const save = this._loadLatestOfflineAutoSave();
    if (!save || !hasGame(save.gameId)) return false;

    const turn = save.metadata?.turn;
    const detail = turn ? `（第 ${turn} 回合）` : '';
    getModal().confirm(
      '继续对局',
      `检测到一局未完成的单机对局${detail}，是否继续？`,
      { confirmText: '继续', cancelText: '返回大厅' }
    ).then((resume) => {
      if (resume) {
        this._loadFromLobby(save);
      } else {
        clearAutoSave(save.gameId);
      }
    });
    return true;
  }

  /**
   * Register game placeholders so lobby can render immediately
   * while keeping heavy modules lazily loaded.
   * @private
   */
  _registerGamePlaceholders() {
    Object.entries(GAME_REGISTRY).forEach(([gameType, value]) => {
      registerGame(
        gameType,
        class {
          constructor() {
            throw new Error(`游戏 ${gameType} 尚未加载完成，请重试`);
          }
        },
        value.config
      );
    });
  }

  /**
   * Ensure game module bundle is loaded.
   * @private
   * @param {string} gameType
   * @returns {Promise<{GameClass:Function,GameUI:Function,rules?:Object}>}
   */
  _ensureGameBundleLoaded(gameType) {
    const cached = this._gameBundles.get(gameType);
    if (cached) {
      return Promise.resolve(cached);
    }

    const existing = this._gameLoadPromises.get(gameType);
    if (existing) {
      return existing;
    }

    const loader = GAME_LOADERS[gameType];
    if (!loader) {
      return Promise.reject(new Error(`游戏 ${gameType} 不支持懒加载`));
    }

    const loadPromise = (async () => {
      const bundle = await loader();
      if (typeof bundle?.GameClass !== 'function') {
        throw new Error(`游戏 ${gameType} 加载失败：缺少游戏构造器`);
      }
      if (bundle?.rules) {
        this._unoRules = bundle.rules;
      }
      if (bundle?.GameUI) {
        this._gameUIConstructors.set(gameType, bundle.GameUI);
      }
      registerGame(gameType, bundle.GameClass, GAME_REGISTRY[gameType]?.config || {});
      this._gameBundles.set(gameType, bundle);
      return bundle;
    })();

    this._gameLoadPromises.set(gameType, loadPromise);
    loadPromise.finally(() => {
      this._gameLoadPromises.delete(gameType);
    });

    return loadPromise;
  }

  /**
   * Preload game bundle when it might be needed soon.
   * @private
   * @param {string} gameType
   */
  _preloadGame(gameType) {
    this._ensureGameBundleLoaded(gameType).catch(() => {});
  }

  /**
   * Schedule idle preload for default game (currently UNO) after lobby is ready.
   * @private
   */
  _scheduleLobbyPreload() {
    if (typeof window === 'undefined') {
      return;
    }

    if (this._lobbyPreloadTimer) {
      window.clearTimeout(this._lobbyPreloadTimer);
    }

    this._lobbyPreloadTimer = window.setTimeout(() => {
      this._lobbyPreloadTimer = null;
      this._preloadGame('uno');
    }, IDLE_PRELOAD_DELAY_MS);
  }

  /**
   * Render a small commit hash indicator fixed at the top edge.
   * Uses VITE_COMMIT_HASH from env; fallback to 'dev'.
   * @private
   */
  _renderCommitBadge() {
    if (this._commitBadge) {
      return;
    }

    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: rgba(17, 24, 39, 0.9);
      color: #f9fafb;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.05em;
      padding: 2px 10px;
      border-bottom-left-radius: 6px;
      border-bottom-right-radius: 6px;
      pointer-events: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(2px);
    `;
    badge.textContent = `Commit: ${COMMIT_HASH || 'dev'}`;
    document.body.appendChild(badge);
    this._commitBadge = badge;
  }

  /**
   * Generate player ID
   * @private
   */
  _generatePlayerId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `player-${timestamp}-${random}`;
  }

  /**
   * Generate reconnect session ID
   * @private
   */
  _generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `sess-${timestamp}-${random}`;
  }

  /**
   * Rotate session ID when entering a new online room
   * @private
   */
  _refreshSessionId() {
    this.sessionId = this._generateSessionId();
    saveSessionData('sessionId', this.sessionId);
  }

  /**
   * Build room-create preset key by runtime mode and game type
   * @private
   * @param {string} gameType - Game ID
   * @returns {string}
   */
  _getRoomCreatePresetKey(gameType) {
    return `${this.mode}:${gameType}`;
  }

  /**
   * Load room-create preset and sanitize values for current game config
   * @private
   * @param {string} gameType - Game ID
   * @param {Object} gameConfig - Game config
   * @returns {Object|null}
   */
  _loadRoomCreatePreset(gameType, gameConfig = {}) {
    const preset = loadRoomCreatePreset(this._getRoomCreatePresetKey(gameType));
    if (!preset || typeof preset !== 'object') {
      return null;
    }

    const schema = gameConfig.settingsSchema || {};
    const settings = {};
    for (const key of Object.keys(schema)) {
      if (Object.prototype.hasOwnProperty.call(preset.settings || {}, key)) {
        settings[key] = preset.settings[key];
      }
    }

    if (gameConfig.defaultRoleCounts && preset.settings?.roleCounts) {
      settings.roleCounts = { ...preset.settings.roleCounts };
    }

    const minPlayers = gameConfig.minPlayers || 2;
    const maxPlayersLimit = gameConfig.maxPlayers || 10;
    const cachedMaxPlayers = Number.parseInt(preset.maxPlayers, 10);
    const maxPlayers = Number.isFinite(cachedMaxPlayers)
      ? Math.max(minPlayers, Math.min(maxPlayersLimit, cachedMaxPlayers))
      : minPlayers;

    const serverUrl = typeof preset.serverUrl === 'string' && preset.serverUrl.trim()
      ? preset.serverUrl.trim()
      : DEFAULT_LOCAL_SERVER_URL;

    return {
      settings,
      maxPlayers,
      serverUrl
    };
  }

  /**
   * Save room-create preset for future host sessions
   * @private
   * @param {string} gameType - Game ID
   * @param {Object} preset - Preset payload
   */
  _saveRoomCreatePreset(gameType, preset = {}) {
    const payload = {
      settings: { ...(preset.settings || {}) },
      maxPlayers: preset.maxPlayers
    };

    if (typeof preset.serverUrl === 'string') {
      payload.serverUrl = preset.serverUrl;
    }

    saveRoomCreatePreset(this._getRoomCreatePresetKey(gameType), payload);
  }

  /**
   * Clear current view
   * @private
   */
  _clearView() {
    this._closeResultScreen();
    if (this.currentView?.unmount) {
      this.currentView.unmount();
    }
    this.currentView = null;
    this.root.innerHTML = '';
  }

  /**
   * Close result overlay when leaving result state
   * @private
   * @param {boolean} [immediate=false] - Remove overlay immediately when true
   */
  _closeResultScreen(immediate = false) {
    if (!this._resultScreen) {
      return;
    }

    const resultScreen = this._resultScreen;
    this._resultScreen = null;

    const element = typeof resultScreen.getElement === 'function'
      ? resultScreen.getElement()
      : null;

    if (immediate && element?.remove) {
      element.remove();
      return;
    }

    if (typeof resultScreen.close === 'function') {
      resultScreen.close();
    }
  }

  /**
   * Show game lobby
   */
  showLobby() {
    this._lastGameResult = null;
    this._returnToRoomPromptOpen = false;
    this._clearView();
    trackEvent('lobby_viewed', { mode: this.mode });

    this.currentView = new GameLobby({
      onSelectGame: (gameId, mode) => this._handleGameSelect(gameId, mode),
      onPreloadGame: (gameId) => this._preloadGame(gameId),
      onLoadSave: () => this._showLobbyLoadDialog(),
      onJoinRoom: () => this._showJoinRoomDialog(),
      onSettings: () => this._showSettings(),
      cloudAvailable: isCloudAvailable(),
      serverMode: this.mode,
      authService: this.authService,
      onSwitchMode: (newMode) => this._handleSwitchMode(newMode),
      onLogin: () => this._showAuthPage(),
      onLogout: () => this._handleLogout()
    });

    this.currentView.mount(this.root);
    this._scheduleLobbyPreload();
  }

  /**
   * Show auth page (login/register)
   */
  showAuthPage() {
    this._showAuthPage();
  }

  /**
   * Show auth page
   * @private
   */
  _showAuthPage() {
    this._clearView();

    this.currentView = new AuthPage({
      authService: this.authService,
      onLoginSuccess: (user) => {
        this.playerId = user.id;
        this.mode = 'cloud';
        this.showLobby();
      },
      onBack: () => {
        this.mode = 'local';
        this.showLobby();
      }
    });

    this.currentView.mount(this.root);
  }

  /**
   * Handle mode switch (local/cloud)
   * @private
   * @param {'local'|'cloud'} newMode
   */
  _handleSwitchMode(newMode) {
    if (newMode === 'cloud') {
      if (!isCloudAvailable()) {
        showToast('云端未配置，请设置 Supabase 环境变量');
        return;
      }
      if (!this.authService?.isLoggedIn()) {
        this._showAuthPage();
        return;
      }
      this.playerId = this.authService.getCurrentUser().id;
    } else {
      // Switch back to local — restore local player ID
      this.playerId = loadSessionData('playerId') || this._generatePlayerId();
    }
    this.mode = newMode;
    trackEvent('mode_selected', { mode: newMode });
    this.showLobby();
  }

  /**
   * Handle logout
   * @private
   */
  async _handleLogout() {
    if (this.authService) {
      await this.authService.logout();
    }
    this.mode = 'local';
    this.playerId = loadSessionData('playerId') || this._generatePlayerId();
    this.showLobby();
  }

  /**
   * Handle game selection
   * @private
   */
  async _handleGameSelect(gameId, mode) {
    if (!hasGame(gameId)) {
      showNotification(`游戏 "${gameId}" 未注册`, 'error');
      return;
    }
    trackEvent('game_selected', {
      game_id: gameId,
      mode
    });
    this._preloadGame(gameId);

    // Get game config for settings
    const gameConfig = this._getGameConfig(gameId);
    const cachedRoomPreset = mode === 'online'
      ? this._loadRoomCreatePreset(gameId, gameConfig)
      : null;

    // Show settings modal
    const settingsModal = new GameSettingsModal({
      gameConfig,
      mode,
      initialSettings: cachedRoomPreset?.settings,
      onConfirm: ({ settings, aiCount }) => {
        if (mode === 'offline') {
          this._startOfflineGame(gameId, settings, aiCount);
        } else {
          this._showCreateRoomDialog(gameId, settings, gameConfig, cachedRoomPreset);
        }
      },
      onCancel: () => {
        // User cancelled, do nothing
      }
    });

    settingsModal.mount(document.body);
  }

  /**
   * Get game config by ID
   * @private
   */
  _getGameConfig(gameId) {
    const config = GAME_REGISTRY[gameId]?.config;
    return config || { id: gameId, name: gameId, minPlayers: 2, maxPlayers: 4 };
  }

  /**
   * Start offline game
   * @private
   */
  _startOfflineGame(gameType, settings = {}, aiCount = 1) {
    const nickname = this.config.game.defaultNickname || '玩家1';
    const gameConfig = this._getGameConfig(gameType);

    // HIS two-player variant: a single local hotseat seat controls both the
    // Papacy and the Protestant (the other four powers are non-player, driven
    // by the Diplomatic Deck). No bots; the engine cycles the two religious
    // powers and the player acts for whichever side is active.
    if (gameConfig.powers && settings.variant === 'two_player') {
      const players = [{ id: this.playerId, nickname, isHost: true }];
      const options = {
        ...settings,
        powerAssignment: [['papacy', 'protestant']]
      };
      delete options.selectedPower;
      this._startGame(gameType, players, 'offline', options);
      return;
    }

    // Power-based games (HIS): human selects one power, rest are bot-controlled
    if (gameConfig.powers && settings.selectedPower) {
      const allPowers = Object.keys(gameConfig.powers);
      const selectedPower = settings.selectedPower;
      const botPowers = allPowers.filter(p => p !== selectedPower);

      const players = [{ id: this.playerId, nickname, isHost: true }];
      const options = {
        ...settings,
        powerAssignment: [[selectedPower]],
        botPowers
      };
      delete options.selectedPower;

      this._startGame(gameType, players, 'offline', options);
      return;
    }

    // Generic AI players
    const players = [{ id: this.playerId, nickname, isHost: true }];
    for (let i = 1; i <= aiCount; i++) {
      players.push({
        id: `ai-${i}`,
        nickname: `AI 玩家 ${i}`,
        isHost: false
      });
    }

    this._startGame(gameType, players, 'offline', settings);
  }

  /**
   * Start game with players
   * @private
   */
  _startGame(gameType, players, mode, options = {}, initialState = null) {
    this._preloadGame(gameType);

    const startPayload = {
      gameType,
      players,
      mode,
      options,
      initialState
    };

    const showLoadingIndicator = !this._gameBundles.has(gameType);
    if (showLoadingIndicator) {
      showLoading('正在加载游戏资源...');
    }

    this._ensureGameBundleLoaded(gameType)
      .then(() => {
        this._startGameNow(startPayload);
      })
      .catch((error) => {
        console.error(error);
        showNotification(`游戏 ${gameType} 加载失败`, 'error');
      })
      .finally(() => {
        if (showLoadingIndicator) {
          hideLoading();
        }
      });
  }

  /**
   * Start game after module bundle is ready
   * @private
   */
  _startGameNow({
    gameType,
    players,
    mode,
    options = {},
    initialState = null
  }) {
    this._clearView();
    if (!this._isReconnecting) {
      this._lastGameResult = null;
    }
    this._gameStartAt = Date.now();
    this._activeGameType = gameType;
    trackEvent('game_started', {
      game_id: gameType,
      mode,
      player_count: Array.isArray(players) ? players.length : 0
    });

    // Create game instance
    const game = createGame(gameType, mode);

    // Store options for replay
    this._lastGameOptions = options;

    // Start game with options
    game.start({ players, gameType, options });

    // If initialState provided (from network), apply it instead of using generated state
    if (initialState) {
      game.applyStateUpdate(initialState);
    }

    this.currentGame = game;
    if (this.currentRoom) {
      this.currentRoom.gameType = gameType;
      const humanPlayers = (players || []).filter((player) => {
        if (!player?.id) return false;
        return !player.isAI && !String(player.id).startsWith('ai-');
      });
      if (humanPlayers.length > 0) {
        this.currentRoom.players = humanPlayers;
      }
      if (mode === 'online') {
        const nextReturnStatus = {};
        (this.currentRoom.players || []).forEach((player) => {
          nextReturnStatus[player.id] = false;
        });
        this.currentRoom.returnToRoomPhase = false;
        this.currentRoom.returnStatus = nextReturnStatus;
        this.currentRoom.allPlayersReturned = false;
      }
    }
    if (mode === 'online') {
      this._saveReconnectContext({ gameType });
      if (this.network && typeof this.network.setGameActive === 'function') {
        this.network.setGameActive(true);
      }
    }

    // Get visible state for player
    const visibleState = game.getVisibleState
      ? game.getVisibleState(this.playerId)
      : game.getState();

    // Create game board
    this.currentView = new GameBoard({
      game,
      playerId: this.playerId,
      gameConfig: this._getGameConfig(gameType),
      gameSettings: options,
      onAction: (action) => this._handleGameAction(action),
      onLeave: () => this._handleLeaveGame(),
      onShowResult: () => {
        this.gameBoard?.setResultButtonVisible(false);
        this._resultScreen?.reshow();
      },
      onSendChat: (message) => {
        if (this.network?.isConnected()) {
          this.network.sendChat(message);
        }
      }
    });
    this.gameBoard = this.currentView;

    this.currentView.mount(this.root);
    this.currentView.updateState(visibleState);

    // Set up game-specific UI (store instance for reuse on state updates)
    let gameUI = null;
    const gameUIFactory = this._gameUIConstructors.get(gameType);
    if (gameUIFactory) {
      gameUI = new gameUIFactory();
      this.currentView.setGameUI(gameUI);
    }

    // Listen for game events
    game.on('stateUpdated', (state) => {
      const visible = game.getVisibleState
        ? game.getVisibleState(this.playerId)
        : state;
      this.currentView.updateState(visible);

      // Update game UI: incremental path (preserves map zoom/pan) vs full re-render
      if (gameUI && gameUI.supportsIncrementalUpdate) {
        gameUI.updateState(visible);
        // Re-render action bar (lightweight, no map state to lose)
        const actionBar = this.currentView.getActionBar?.();
        if (actionBar && gameUI.renderActions) {
          actionBar.innerHTML = '';
          const actionsEl = gameUI.renderActions(visible, this.playerId, (action) => {
            this.currentView.options?.onAction?.(action);
          });
          if (actionsEl) actionBar.appendChild(actionsEl);
        }
      } else if (gameUI) {
        this.currentView.setGameUI(gameUI);
      }

      // Auto-draw when no playable cards (only for human player's turn)
      if (gameType === 'uno' && visible.currentPlayer === this.playerId) {
        this._checkAutoDraw(visible);
      }
    });

    game.on('gameEnded', (result) => {
      if (this.network && typeof this.network.setGameActive === 'function') {
        this.network.setGameActive(false);
      }
      const durationSec = this._gameStartAt
        ? Math.max(0, Math.round((Date.now() - this._gameStartAt) / 1000))
        : null;
      trackEvent('game_ended', {
        game_id: gameType,
        mode,
        duration_sec: durationSec,
        ended_reason: result?.reason || 'completed',
        result_type: result?.winner ? 'winner_declared' : 'ended'
      });
      this._showGameResult(result);
    });

    // Note: invalidMove errors are handled in _handleGameAction, no need for separate listener

    // Auto-save for offline games
    if (mode === 'offline') {
      game._autoSaveEnabled = true;
      game._performAutoSave = () => {
        autoSaveGame(gameType, game.exportSave());
      };
    }

    // Wire up save/load events from game UI
    if (gameUI) {
      gameUI.on?.('saveRequested', () => this._saveGame());
      gameUI.on?.('loadRequested', () => this._showLoadDialog());
      gameUI.on?.('exportRequested', () => this._exportGame());
      gameUI.on?.('importRequested', () => this._importGame());
    }

    // Start AI simulation if offline, or if online and host with AI players
    const shouldSimulateAI = mode === 'offline' ||
      (mode === 'online' && this._isHost() && this._aiPlayers?.length > 0);

    if (shouldSimulateAI) {
      setTimeout(() => this._simulateAITurn(), 500);
    }

    // HIS Bot: schedule first bot action if any bot powers exist
    if (gameType === 'his' && mode === 'offline') {
      this._scheduleHisBotAction();
    }
  }

  /**
   * Check if current player is the host
   * @private
   */
  _isHost() {
    return this.currentRoom?.players?.find(p => p.id === this.playerId)?.isHost || false;
  }

  // ── Save/Load Handlers ─────────────────────────────────────────

  /**
   * Save current game to next available slot.
   * @private
   */
  _saveGame() {
    if (!this.currentGame) return;
    const save = this.currentGame.exportSave();
    const slots = listGameSlots(save.gameId);
    // Use next slot index (cycle within MAX_SAVE_SLOTS)
    const maxSlots = 5;
    const slotIndex = slots.length < maxSlots
      ? slots.length
      : maxSlots - 1; // overwrite oldest (last in desc-sorted list)
    const slotKey = `${save.gameId}_slot_${slotIndex}`;
    saveGameSlot(slotKey, save);
    showToast(`存档成功：${save.label}`);
  }

  /**
   * Show save picker from the lobby (no active game required).
   * Scans all saves across all games, shows a modal, and starts+loads the chosen save.
   * @private
   */
  _showLobbyLoadDialog() {
    const SAVE_PREFIX = 'boardgame_save_';
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(SAVE_PREFIX)) continue;
      try {
        const save = JSON.parse(localStorage.getItem(key));
        saves.push({
          slotKey: key.slice(SAVE_PREFIX.length),
          gameId: save.gameId,
          label: save.label || key.slice(SAVE_PREFIX.length),
          savedAt: save.savedAt || 0,
          metadata: save.metadata || {},
          save
        });
      } catch (_) { /* skip corrupt entries */ }
    }
    saves.sort((a, b) => b.savedAt - a.savedAt);

    if (saves.length === 0) {
      showToast('没有可用的存档');
      return;
    }

    const modal = getModal();
    const rowsHtml = saves.map(s => {
      const date = s.savedAt ? new Date(s.savedAt).toLocaleString('zh-CN') : '—';
      const gameLabel = s.gameId || '未知游戏';
      const meta = s.metadata;
      const detail = meta.turn ? `第 ${meta.turn} 回合 · ${meta.phase || ''}` : '';
      return `
        <div class="save-slot-row" data-slot-key="${s.slotKey}" style="
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-3) var(--spacing-4);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-base);
          cursor: pointer;
          margin-bottom: var(--spacing-2);
          transition: background var(--transition-fast);
        ">
          <div>
            <div style="font-weight: var(--font-semibold); margin-bottom: 2px;">${s.label}</div>
            <div style="font-size: var(--text-xs); color: var(--text-secondary);">${gameLabel}${detail ? ' · ' + detail : ''} · ${date}</div>
          </div>
          <span style="color: var(--primary-500); font-size: var(--text-xl);">▶</span>
        </div>
      `;
    }).join('');

    modal.show(`<div>${rowsHtml}</div>`, { title: '选择存档', width: '500px' });

    modal._content.querySelectorAll('.save-slot-row').forEach(row => {
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-secondary)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => {
        const entry = saves.find(s => s.slotKey === row.dataset.slotKey);
        if (!entry) return;
        modal.hide();
        this._loadFromLobby(entry.save);
      });
    });
  }

  /**
   * Start a game and immediately load a save into it.
   * Used when loading a save from the lobby (no active game).
   * @param {Object} save - Save data
   * @private
   */
  async _loadFromLobby(save) {
    const gameId = save.gameId;
    if (!gameId || !hasGame(gameId)) {
      showToast(`未知游戏类型: ${gameId}`);
      return;
    }

    const gameConfig = this._getGameConfig(gameId);
    const state = save.state;

    // Detect the human player's power (non-bot entry in playerByPower)
    const savedPower = state?.playerByPower
      ? Object.entries(state.playerByPower).find(([, id]) => id && !id.startsWith('bot_'))?.[0]
      : null;

    // Ensure game bundle is loaded (dynamic import), then start synchronously
    await this._ensureGameBundleLoaded(gameId);

    const nickname = this.config.game?.defaultNickname || '玩家';
    const players = [{ id: this.playerId, nickname, isHost: true }];
    let options = {};
    if (gameConfig.powers && savedPower) {
      const botPowers = Object.keys(gameConfig.powers).filter(p => p !== savedPower);
      options = { powerAssignment: [[savedPower]], botPowers };
    }

    this._startGameNow({ gameType: gameId, players, mode: 'offline', options });
    await this._loadSave(save);
  }

  /**
   * Show load dialog with available saves.
   * @private
   */
  _showLoadDialog() {
    if (!this.currentGame) return;
    const gameId = this._activeGameType;
    const slots = listGameSlots(gameId);
    if (slots.length === 0) {
      showToast('没有可用的存档');
      return;
    }
    // Load most recent save
    const save = loadGameSlot(slots[0].slotKey);
    if (!save) {
      showToast('读取存档失败');
      return;
    }
    this._loadSave(save);
  }

  /**
   * Load a save into the current game.
   * @param {Object} save - Save data
   * @private
   */
  async _loadSave(save) {
    try {
      const { validateSaveData } = await import(
        './games/his/state/save-load.js'
      );
      const validation = validateSaveData(save);
      if (!validation.valid) {
        showToast(`存档无效：${validation.error}`);
        return;
      }
    } catch (_) {
      // Validation module not available — skip validation
    }
    // Remap saved human playerId → current session playerId
    this._remapSavePlayerId(save);
    this.currentGame.importSave(save);
    showToast(`读档成功：${save.label || '存档'}`);
    // Restart bot chain after loading save
    if (this._activeGameType === 'his') {
      this._scheduleHisBotAction();
    }
  }

  /**
   * Remap saved human playerId to current session playerId.
   * @param {Object} save - Save data (mutated in place)
   * @private
   */
  _remapSavePlayerId(save) {
    const st = save?.state;
    if (!st?.playerByPower || !this.playerId) return;
    // Find the old human playerId (any non-bot player)
    const oldHumanId = Object.values(st.playerByPower)
      .find(id => id && !id.startsWith('bot_'));
    if (!oldHumanId || oldHumanId === this.playerId) return;
    // Remap playerByPower
    for (const power of Object.keys(st.playerByPower)) {
      if (st.playerByPower[power] === oldHumanId) {
        st.playerByPower[power] = this.playerId;
      }
    }
    // Remap powersForPlayer
    if (st.powersForPlayer?.[oldHumanId]) {
      st.powersForPlayer[this.playerId] = st.powersForPlayer[oldHumanId];
      delete st.powersForPlayer[oldHumanId];
    }
    // Remap powerByPlayer (legacy/alias)
    if (st.powerByPlayer?.[oldHumanId]) {
      st.powerByPlayer[this.playerId] = st.powerByPlayer[oldHumanId];
      delete st.powerByPlayer[oldHumanId];
    }
    // Remap players array
    if (Array.isArray(st.players)) {
      for (const p of st.players) {
        if (p.id === oldHumanId) p.id = this.playerId;
      }
    }
  }

  /**
   * Export current game to a JSON file download.
   * @private
   */
  _exportGame() {
    if (!this.currentGame) return;
    const save = this.currentGame.exportSave();
    const filename = `his_save_turn${save.metadata?.turn || 0}.json`;
    exportSaveFile(save, filename);
  }

  /**
   * Import a save from a JSON file.
   * @private
   */
  _importGame() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const save = await importSaveFile(file);
        await this._loadSave(save);
      } catch (err) {
        showToast(`导入失败：${err.message}`);
      }
    };
    input.click();
  }

  /**
   * Check if a player is AI
   * @private
   */
  _isAIPlayer(playerId) {
    return playerId?.startsWith('ai-') || this._aiPlayers?.some(p => p.id === playerId);
  }

  /**
   * Handle game action
   * @private
   */
  _handleGameAction(action) {
    if (!this.currentGame) return;

    // Block actions while host is disconnected in local mode
    // (server freezes GAME_ACTION; executing locally would cause desync)
    if (this._hostDisconnectedPaused) {
      showToast('房主断线中，操作暂停');
      return;
    }

    const move = {
      ...action,
      playerId: this.playerId
    };

    const result = this.currentGame.executeMove(move);

    if (!result.success) {
      showToast(result.error);
      return;
    }

    // In online mode, send to server
    if (this.network?.isConnected()) {
      this.network.sendGameAction(action.actionType, action.actionData);
    }

    // Simulate AI moves for offline mode and host-side online mode with AI
    if (this.currentGame.mode === 'offline'
      || (this.currentGame.mode === 'online' && this._isHost() && this._aiPlayers?.length > 0)) {
      setTimeout(() => this._simulateAITurn(), 500);
    }

    // HIS Bot: schedule next bot action after human move
    if (this._activeGameType === 'his' && this.currentGame.mode === 'offline') {
      this._scheduleHisBotAction();
    }
  }

  /**
   * Check if player should auto-draw (no playable cards)
   * @private
   */
  _getUnoRules() {
    return this._activeGameType === 'uno' ? this._unoRules : null;
  }

  /**
   * Check if player should auto-draw (no playable cards)
   * @private
   */
  _checkAutoDraw(state) {
    // Don't auto-draw if there are pending draws (player must click to draw those)
    if (state.drawPending > 0) return;
    const rules = this._getUnoRules();
    if (!rules?.canPlayCard) {
      return;
    }

    // Don't auto-draw if player just drew (they might be able to play or skip)
    if (state.lastAction?.type === 'drew' && state.lastAction?.playerId === this.playerId) return;
    const { canPlayCard } = rules;

    // Check if player has any playable cards
    const myHand = state.myHand || [];
    const topCard = state.topCard;
    const hasPlayableCard = myHand.some(card =>
      canPlayCard(card, topCard, state.currentColor)
    );

    // Auto-draw if no playable cards
    if (!hasPlayableCard && myHand.length > 0) {
      // Small delay for better UX
      setTimeout(() => {
        if (this.currentGame?.isRunning && this.currentGame.getState()?.currentPlayer === this.playerId) {
          showToast('无牌可出，自动摸牌');
          this._handleGameAction({
            actionType: 'DRAW_CARD',
            actionData: {}
          });
        }
      }, 300);
    }
  }

  /**
   * Execute AI move (works for both offline and online modes)
   * @private
   */
  _executeAIMove(actionType, actionData, playerId) {
    const game = this.currentGame;
    if (!game || !game.isRunning) return;

    // Execute move locally
    game.executeMove({
      actionType,
      actionData,
      playerId
    });

    // In online mode, broadcast to other players
    if (this.currentGame?.mode === 'online' && this.network?.isConnected()) {
      this.network.sendGameAction(actionType, actionData, {
        playerId // Include AI player ID
      });
    }
  }

  /**
   * Simulate AI turn for offline/online mode
   * @private
   */
  _simulateAITurn() {
    const game = this.currentGame;
    if (!game || !game.isRunning) return;

    const state = game.getState();
    const currentPlayer = state.currentPlayer;
    const isUnoGame = this._activeGameType === 'uno' || game?.config?.gameType === 'uno';
    if (!isUnoGame) return;
    const rules = this._getUnoRules();
    if (!rules?.canPlayCard) return;

    // Skip if it's a human player's turn (not AI)
    const isAI = this._isAIPlayer(currentPlayer);
    const isHumanTurn = currentPlayer === this.playerId;

    // In offline mode: skip human turn
    // In online mode: only host simulates AI, skip if not AI player
    if (game.mode === 'offline') {
      if (isHumanTurn) return;
    } else {
      // Online mode - only host simulates AI turns
      if (!this._isHost() || !isAI) return;
    }

    // Delay AI move for better UX
    setTimeout(() => {
      if (!game.isRunning) return;

      const aiHand = state.hands[currentPlayer] || [];

      // Handle pending draws
      if (state.drawPending > 0) {
        // If stacking is enabled, check if AI can stack
        if (state.options?.stackDrawCards) {
          const topCard = state.discardPile[state.discardPile.length - 1];
          let stackCard = null;

          if (topCard.type === rules.CARD_TYPES.DRAW_TWO) {
            stackCard = aiHand.find(c => c.type === rules.CARD_TYPES.DRAW_TWO);
          } else if (topCard.type === rules.CARD_TYPES.WILD_DRAW_FOUR) {
            stackCard = aiHand.find(c => c.type === rules.CARD_TYPES.WILD_DRAW_FOUR);
          }

          if (stackCard) {
            // AI stacks the card
            const chosenColor = stackCard.color === null
              ? rules.COLORS[Math.floor(Math.random() * rules.COLORS.length)]
              : null;

            this._executeAIMove('PLAY_CARD', { cardId: stackCard.id, chosenColor }, currentPlayer);
            setTimeout(() => this._simulateAITurn(), 500);
            return;
          }
        }

        // No stacking possible, must draw
        this._executeAIMove('DRAW_CARD', {}, currentPlayer);
        setTimeout(() => this._simulateAITurn(), 500);
        return;
      }

      // Find a playable card
      const topCard = state.discardPile[state.discardPile.length - 1];
      const playableCards = aiHand.filter(card =>
        rules.canPlayCard(card, topCard, state.currentColor)
      );

      if (playableCards.length > 0) {
        const card = playableCards[Math.floor(Math.random() * playableCards.length)];
        const chosenColor = card.color === null
          ? rules.COLORS[Math.floor(Math.random() * rules.COLORS.length)]
          : null;

        this._executeAIMove('PLAY_CARD', { cardId: card.id, chosenColor }, currentPlayer);
      } else {
        // Draw a card
        this._executeAIMove('DRAW_CARD', {}, currentPlayer);

        // Check if can play after drawing
        const newState = game.getState();
        if (newState.currentPlayer === currentPlayer) {
          // Still current player's turn - skip
          setTimeout(() => {
            if (game.isRunning && newState.currentPlayer === currentPlayer) {
              this._executeAIMove('SKIP_TURN', {}, currentPlayer);
              setTimeout(() => this._simulateAITurn(), 500);
            }
          }, 300);
          return;
        }
      }

      setTimeout(() => this._simulateAITurn(), 500);
    }, 600);
  }

  /**
   * Schedule next HIS Bot action if active power is a Bot.
   * @private
   */
  _scheduleHisBotAction() {
    if (this._hisBotTimer) {
      clearTimeout(this._hisBotTimer);
      this._hisBotTimer = null;
    }

    const game = this.currentGame;
    if (!game || !game.isRunning) return;

    this._hisBotTimer = scheduleBotAction(game, (move) => {
      if (!game.isRunning) return { success: false };
      const result = game.executeMove(move);
      if (result.success) {
        // Chain: schedule next bot action after this one
        this._scheduleHisBotAction();
      }
      return result;
    });
  }

  /**
   * Convert a human-controlled power to a Bot for testing.
   * Call from browser console: window.app._addBotPower('protestant')
   *
   * This initialises the bot deck, remaps playerByPower to the bot ID,
   * runs processBotTurnStart so the bot has a valid behavior card for the
   * current turn, then kicks the bot action chain.
   *
   * @param {string} power - Power id to convert (e.g. 'protestant')
   * @returns {Promise<void>}
   */
  async _addBotPower(power) {
    const game = this.currentGame;
    if (!game) { console.error('[addBotPower] No active game'); return; }
    const state = game.getState();
    if (!state) { console.error('[addBotPower] No game state'); return; }

    // Mark as bot and initialize deck
    initBotDecks(state, [power]);

    // Remap player → bot in all three reverse-lookup maps
    const botId = botPlayerId(power);
    if (state.playerByPower?.[power] && !state.playerByPower[power].startsWith('bot_')) {
      const oldId = state.playerByPower[power];
      state.playerByPower[power] = botId;
      // powerByPlayer: bot_protestant → protestant
      if (state.powerByPlayer) {
        delete state.powerByPlayer[oldId];
        state.powerByPlayer[botId] = power;
      }
      // powersForPlayer: bot_protestant → ['protestant']
      if (state.powersForPlayer) {
        delete state.powersForPlayer[oldId];
        state.powersForPlayer[botId] = [power];
      }
    }

    // Run processBotTurnStart so behavior card is revealed for this turn
    try {
      const { processBotTurnStart } = await import('./games/his/ai/bot-rules.js');
      processBotTurnStart(state);
    } catch (e) {
      console.warn('[addBotPower] processBotTurnStart failed:', e.message);
    }

    // Apply the mutated state back through the engine
    game.state = state;
    game.emit?.('stateUpdated', state);

    console.log(`[addBotPower] ${power} is now a bot. Kicking action chain.`);
    this._scheduleHisBotAction();
  }

  /**
   * Start a new HIS game for testing.
   * If humanPower is given, the current user controls that power and the rest
   * are HISBOT. If omitted, all 6 powers are bots (spectator/watch mode).
   *
   * All bot powers go through the full initBotGame flow at initialize() time
   * (initBotDecks + placeBotExtraUnits), so no post-hoc patching is needed.
   *
   * Call from browser console:
   *   window.app._startHisGame()                                    // all 6 bots
   *   window.app._startHisGame('hapsburg')                          // you play Hapsburg
   *   window.app._startHisGame(null, { dominationVictoryEnabled: false }) // disable domination
   *
   * @param {string|null} [humanPower] - Power the human controls, or null for all-bot
   * @param {Object} [extraOptions] - Additional game settings (e.g. dominationVictoryEnabled)
   * @returns {Promise<void>}
   */
  async _startHisGame(humanPower = null, extraOptions = {}) {
    const allPowers = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];
    if (humanPower && !allPowers.includes(humanPower)) {
      console.error('[startHisGame] Unknown power:', humanPower);
      return;
    }
    await this._ensureGameBundleLoaded('his');
    const nickname = this.config.game?.defaultNickname || '玩家';
    const players = [{ id: this.playerId, nickname, isHost: true }];
    const botPowers = humanPower ? allPowers.filter(p => p !== humanPower) : allPowers;
    const powerAssignment = humanPower ? [[humanPower]] : [[]];
    const options = { powerAssignment, botPowers, ...extraOptions };
    this._startGameNow({ gameType: 'his', players, mode: 'offline', options });
    const desc = humanPower ? `You play ${humanPower}` : 'All 6 powers are HISBOT';
    console.log(`[startHisGame] ${desc}. Kicking action chain.`);
    this._scheduleHisBotAction();
  }

  /**
   * Dev/test harness: run N full-bot HIS games and report engine stability.
   * A clean run is 0 [BOT STUCK] and 0 [BOT CHAIN BROKEN]. Drives the REAL bot
   * loop, so it covers every action class (events, CP sub-actions, responses,
   * spring deployment) — the full-coverage complement to the deterministic
   * unit sweeps (bot-event-coverage.test.js).
   *
   * Each game is seeded (deck via rngSeed + dice/shuffles via a temporary
   * Math.random override) so failures are reproducible: re-run the printed seed.
   * setTimeout delays are clamped during the batch to compress ~40-min games to
   * ~1-3 min; all globals are restored afterwards.
   *
   * Console:
   *   await window.app._runHisBotBatch()                          // 6 random-seed games
   *   await window.app._runHisBotBatch({ games: 8, seed: 1000 })  // seeds 1000..1007
   *   await window.app._runHisBotBatch({ games: 1, seed: 42 })    // reproduce seed 42
   *
   * @param {{ games?: number, seed?: number|null, maxMsPerGame?: number }} [opts]
   * @returns {Promise<{ games: Array, totals: Object }>}
   */
  async _runHisBotBatch({ games = 6, seed = null, maxMsPerGame = 160000 } = {}) {
    const mulberry32 = (a) => () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const origRandom = Math.random;
    const origSetTimeout = window.setTimeout;
    const realST = origSetTimeout.bind(window);
    const origWarn = console.warn;
    const origError = console.error;
    const cap = { stuck: [], chainBroken: [] };

    // Speed up bot scheduling; capture stuck/chain-broken signatures.
    window.setTimeout = (fn, d, ...rest) =>
      realST(fn, (typeof d === 'number' && d > 40) ? 40 : d, ...rest);
    console.warn = (...a) => {
      const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
      if (s.includes('[BOT STUCK]')) cap.stuck.push(s.slice(0, 220));
      return origWarn.apply(console, a);
    };
    console.error = (...a) => {
      const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
      if (s.includes('[BOT CHAIN BROKEN]')) cap.chainBroken.push(s.slice(0, 220));
      return origError.apply(console, a);
    };

    const results = [];
    try {
      for (let i = 0; i < games; i++) {
        const gameSeed = (seed != null) ? (seed + i) : Math.floor(origRandom() * 1e9);
        Math.random = mulberry32(gameSeed);  // deterministic dice / random discards
        const sB = cap.stuck.length, cB = cap.chainBroken.length;
        await this._startHisGame(null, { dominationVictoryEnabled: false, rngSeed: gameSeed });
        const start = Date.now();
        let st = null;
        while (Date.now() - start < maxMsPerGame) {
          await new Promise(f => realST(f, 250));
          st = this.currentGame?.getState ? this.currentGame.getState() : null;
          if (st?.status && st.status !== 'playing') break;
        }
        // Per-power VP breakdown by source + winner (balance analysis, #Y).
        let winner = null, src = null;
        const game = this.currentGame;
        if (game?.getScoreBreakdown && st?.status && st.status !== 'playing') {
          src = game.getScoreBreakdown();
          let best = -Infinity;
          for (const p of Object.keys(src)) {
            if (src[p].total > best) { best = src[p].total; winner = p; }
          }
        }
        const r = {
          seed: gameSeed, status: st?.status ?? 'timeout', turn: st?.turn ?? null,
          stuck: cap.stuck.length - sB, chainBroken: cap.chainBroken.length - cB,
          winner, src
        };
        results.push(r);
        origWarn.call(console, `[bot-batch] ${i + 1}/${games} seed=${gameSeed} → ` +
          `${r.status} T${r.turn} win=${winner} stuck=${r.stuck} chainBroken=${r.chainBroken}`);
      }
    } finally {
      Math.random = origRandom;
      window.setTimeout = origSetTimeout;
      console.warn = origWarn;
      console.error = origError;
    }

    const totals = {
      games: results.length,
      stuck: cap.stuck.length,
      chainBroken: cap.chainBroken.length,
      clean: cap.stuck.length === 0 && cap.chainBroken.length === 0,
      failedSeeds: results.filter(r => r.stuck || r.chainBroken).map(r => r.seed)
    };
    console.log('[bot-batch] DONE', JSON.stringify(totals));
    return { games: results, totals };
  }

  /**
   * Convert a Bot-controlled power to the current human player.
   * Reverse of _addBotPower(). Use after loading a save to switch which
   * power you control.
   *
   * Call from browser console: window.app._takeOverPower('ottoman')
   *
   * @param {string} power - Power id to take over (e.g. 'ottoman')
   */
  _takeOverPower(power) {
    const game = this.currentGame;
    if (!game) { console.error('[takeOverPower] No active game'); return; }
    const state = game.getState();
    if (!state) { console.error('[takeOverPower] No game state'); return; }

    if (!state.botPowers?.[power]) {
      console.warn(`[takeOverPower] ${power} is not a bot — nothing to do`);
      return;
    }

    const botId = botPlayerId(power);
    const humanId = this.playerId;

    // Remove from bot registry
    delete state.botPowers[power];

    // Remap all three player↔power lookups
    state.playerByPower[power] = humanId;
    if (state.powerByPlayer) {
      delete state.powerByPlayer[botId];
      state.powerByPlayer[humanId] = power;
    }
    if (state.powersForPlayer) {
      delete state.powersForPlayer[botId];
      state.powersForPlayer[humanId] = [power];
    }

    game.state = state;
    game.emit?.('stateUpdated', state);
    console.log(`[takeOverPower] You now control ${power}. Bot chain will skip this power.`);
    // Re-kick bot chain so remaining bots keep moving
    this._scheduleHisBotAction();
  }

  /**
   * Handle leaving game
   * @private
   */
  async _handleLeaveGame() {
    const modal = getModal();
    const confirm = await modal.confirm('离开游戏', '确定要离开当前游戏吗？');

    if (confirm) {
      if (this.currentGame) {
        this.currentGame.end();
        this.currentGame = null;
        this._gameStartAt = null;
      }

      if (this.network) {
        if (typeof this.network.setGameActive === 'function') {
          this.network.setGameActive(false);
        }
        if (this.network.isConnected()) {
          this._manualDisconnect = true;
          this.network.leaveRoom();
          this.network.disconnect();
        }
      }

      this._cancelReconnectTimers();
      this._clearReconnectContext();
      this.currentRoom = null;
      this.gameBoard = null;
      this.showLobby();
    }
  }

  /**
   * Return from result screen to waiting room in online mode
   * @private
   */
  _returnToRoomFromResult() {
    this._returnToRoomPromptOpen = false;

    if (!this.currentRoom) {
      this.currentGame = null;
      this._gameStartAt = null;
      this.showLobby();
      return;
    }

    const players = this.currentRoom.players || [];
    const nextStatus = {};
    const prevStatus = this.currentRoom.returnStatus || {};
    players.forEach((player) => {
      nextStatus[player.id] = !!prevStatus[player.id];
    });
    nextStatus[this.playerId] = true;

    this.currentRoom.returnToRoomPhase = true;
    this.currentRoom.returnStatus = nextStatus;
    this.currentRoom.allPlayersReturned = players.length > 0
      && players.every(player => !!nextStatus[player.id]);

    this.currentGame = null;
    this._showWaitingRoom();

    if (this.network?.isConnected()) {
      if (typeof this.network.returnToRoom === 'function') {
        this.network.returnToRoom();
      } else {
        this.network.send('RETURN_TO_ROOM', {});
      }
    }
  }

  /**
   * Recover a "return to room" entry point when client is in return phase but no result dialog is visible.
   * @private
   */
  _promptReturnToRoomIfNeeded() {
    if (!this.currentRoom?.returnToRoomPhase) {
      return;
    }

    if (this.currentRoom?.returnStatus?.[this.playerId]) {
      return;
    }

    if (this.currentView instanceof WaitingRoom) {
      return;
    }

    if (this._resultScreen) {
      return;
    }

    if (this._lastGameResult) {
      this._showGameResult(this._lastGameResult);
      return;
    }

    if (this._returnToRoomPromptOpen) {
      return;
    }
    this._returnToRoomPromptOpen = true;

    const modal = getModal();
    modal.confirm(
      '对局已结束',
      '是否回到房间？',
      { confirmText: '回到房间', cancelText: '稍后' }
    ).then((shouldReturn) => {
      this._returnToRoomPromptOpen = false;
      if (
        shouldReturn
        && this.currentRoom?.returnToRoomPhase
        && !this.currentRoom?.returnStatus?.[this.playerId]
      ) {
        this._returnToRoomFromResult();
      }
    });
  }

  /**
   * Show game result
   * @private
   */
  _showGameResult(result) {
    this._closeResultScreen(true);
    this._lastGameResult = result || null;

    // The game is over: clear the in-progress markers so a later reload offers
    // the lobby rather than trying to resume a finished game — the online
    // reconnect context (no-op offline) and the offline auto-save.
    this._saveReconnectContext?.({ gameStarted: false });
    if (this.currentGame?.mode === 'offline' && this._activeGameType) {
      clearAutoSave(this._activeGameType);
    }

    const isOnlineRound = this.currentGame?.mode === 'online'
      && !!this.currentRoom
      && this.network?.isConnected();

    const resultScreen = new GameResult({
      result,
      playerId: this.playerId,
      playAgainLabel: isOnlineRound ? '回到房间' : '再来一局',
      onPlayAgain: () => {
        this._resultScreen = null;
        this.gameBoard?.setResultButtonVisible(false);
        if (isOnlineRound) {
          this._returnToRoomFromResult();
          return;
        }

        // Start new game with same settings
        if (this.currentGame) {
          // Note: config.gameType is used because start() overwrites config with runtime config
          const gameType = this.currentGame.config.gameType;
          const players = this.currentGame.getState()?.players || [];
          const options = this._lastGameOptions || {};
          this._startGame(gameType, players, this.currentGame.mode, options);
        }
      },
      onBackToLobby: () => {
        this._resultScreen = null;
        this.gameBoard?.setResultButtonVisible(false);
        this.currentGame = null;
        this._gameStartAt = null;
        this.showLobby();
      },
      onHide: () => {
        this.gameBoard?.setResultButtonVisible(true);
      }
    });

    this._resultScreen = resultScreen;
    this.gameBoard?.setResultButtonVisible(false);
    resultScreen.show();
  }

  /**
   * Show settings panel
   * @private
   */
  _showSettings() {
    const settings = new SettingsPanel({
      onClose: () => {},
      onSave: (config) => {
        this.config = config;
        if (!this.config.analytics || typeof this.config.analytics !== 'object') {
          this.config.analytics = { enabled: false };
        }
        setAnalyticsConsent(this.config.analytics.enabled === true);
        initAnalytics();
        showToast('设置已保存');
      }
    });

    settings.show();
  }
}

registerAppReconnectMethods(App, {
  NetworkClient,
  CloudNetworkClient,
  getSupabaseClient,
  hasGame,
  saveSessionData,
  loadSessionData,
  getModal,
  showLoading,
  hideLoading,
  updateLoadingMessage,
  showNotification,
  showToast,
  trackEvent,
  RECONNECT_CONTEXT_KEY,
  RECONNECT_RESPONSE_TIMEOUT_MS,
  DEFAULT_RECONNECT_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_COUNTDOWN_STEP_MS
});

registerAppOnlineRoomMethods(App, {
  NetworkClient,
  CloudNetworkClient,
  getSupabaseClient,
  createGame,
  WaitingRoom,
  GameBoard,
  getModal,
  showLoading,
  hideLoading,
  showNotification,
  showToast,
  trackEvent,
  DEFAULT_LOCAL_SERVER_URL
});

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
