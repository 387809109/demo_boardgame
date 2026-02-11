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
  loadRoomCreatePreset
} from './utils/storage.js';

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

import { isCloudAvailable, getSupabaseClient } from './cloud/supabase-client.js';
import { AuthService } from './cloud/auth.js';
import { CloudNetworkClient } from './cloud/cloud-network.js';

import UnoGame from './games/uno/index.js';
import { UnoUI } from './games/uno/ui.js';
import unoConfig from './games/uno/config.json';
import { canPlayCard, COLORS, CARD_TYPES } from './games/uno/rules.js';

import WerewolfGame from './games/werewolf/index.js';
import werewolfConfig from './games/werewolf/config.json';
import { WerewolfUI } from './games/werewolf/ui.js';

const RECONNECT_CONTEXT_KEY = 'reconnectContext';
const RECONNECT_RESPONSE_TIMEOUT_MS = 8000;
const DEFAULT_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_COUNTDOWN_STEP_MS = 1000;
const DEFAULT_LOCAL_SERVER_URL = 'ws://localhost:7777';

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

    this._init();
  }

  /**
   * Initialize the application
   * @private
   */
  _init() {
    // Register games
    registerGame('uno', UnoGame, unoConfig);
    registerGame('werewolf', WerewolfGame, werewolfConfig);

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

    // Show lobby
    this.showLobby();
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
   * Save reconnect context to session storage
   * @private
   */
  _saveReconnectContext(overrides = {}) {
    if (this.mode !== 'local' || !this.currentRoom?.id || !(this.network instanceof NetworkClient)) {
      return;
    }

    const self = this.currentRoom.players?.find(p => p.id === this.playerId);
    const context = {
      roomId: this.currentRoom.id,
      playerId: this.playerId,
      sessionId: this.sessionId,
      serverUrl: this.network.serverUrl,
      gameType: this.currentRoom.gameType || 'unknown',
      nickname: self?.nickname || this.currentRoom.nickname || this.config.game.defaultNickname,
      updatedAt: Date.now(),
      ...overrides
    };

    saveSessionData(RECONNECT_CONTEXT_KEY, context);
  }

  /**
   * Load reconnect context from session storage
   * @private
   */
  _loadReconnectContext() {
    return loadSessionData(RECONNECT_CONTEXT_KEY);
  }

  /**
   * Clear reconnect context and running reconnect timers
   * @private
   */
  _clearReconnectContext() {
    saveSessionData(RECONNECT_CONTEXT_KEY, null);
  }

  /**
   * Cancel pending reconnect timers
   * @private
   */
  _clearReconnectPendingTimers() {
    if (this._reconnectAttemptTimer) {
      clearTimeout(this._reconnectAttemptTimer);
      this._reconnectAttemptTimer = null;
    }
    if (this._reconnectResponseTimer) {
      clearTimeout(this._reconnectResponseTimer);
      this._reconnectResponseTimer = null;
    }
    if (this._reconnectCountdownTimer) {
      clearInterval(this._reconnectCountdownTimer);
      this._reconnectCountdownTimer = null;
    }
  }

  /**
   * Cancel pending reconnect timers and reset reconnect state
   * @private
   */
  _cancelReconnectTimers() {
    this._clearReconnectPendingTimers();
    this._isReconnecting = false;
    this._reconnectAttempts = 0;
    this._reconnectContext = null;
  }

  /**
   * Update reconnect loading text
   * @private
   */
  _updateReconnectLoadingMessage(nextAttempt, secondsLeft) {
    const base = `重连中（第 ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS} 次）`;
    if (secondsLeft > 0) {
      updateLoadingMessage(`${base}，${secondsLeft}s 后重试...`);
    } else {
      updateLoadingMessage(`${base}，正在连接...`);
    }
  }

  /**
   * Schedule the next reconnect attempt with countdown
   * @private
   */
  _scheduleReconnectAttempt(delayMs) {
    if (!this._isReconnecting) return;

    const nextAttempt = this._reconnectAttempts + 1;
    let secondsLeft = Math.max(0, Math.ceil(delayMs / 1000));
    this._updateReconnectLoadingMessage(nextAttempt, secondsLeft);

    if (secondsLeft > 0) {
      this._reconnectCountdownTimer = setInterval(() => {
        if (!this._isReconnecting) return;
        secondsLeft = Math.max(0, secondsLeft - 1);
        this._updateReconnectLoadingMessage(nextAttempt, secondsLeft);
      }, RECONNECT_COUNTDOWN_STEP_MS);
    }

    this._reconnectAttemptTimer = setTimeout(() => {
      this._runReconnectAttempt();
    }, delayMs);
  }

  /**
   * Execute one reconnect attempt
   * @private
   */
  async _runReconnectAttempt() {
    if (!this._isReconnecting || !this._reconnectContext || !(this.network instanceof NetworkClient)) {
      return;
    }

    this._clearReconnectPendingTimers();
    this._reconnectAttempts += 1;
    updateLoadingMessage(`重连中（第 ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 次），正在连接...`);

    try {
      await this.network.connect();
      this.network.requestReconnect(this._reconnectContext.roomId, this._reconnectContext.sessionId);
      this._reconnectResponseTimer = setTimeout(() => {
        this._handleReconnectTransientFailure('重连请求超时');
      }, RECONNECT_RESPONSE_TIMEOUT_MS);
    } catch (err) {
      this._handleReconnectTransientFailure(err?.message || '连接失败');
    }
  }

  /**
   * Handle retryable reconnect failures
   * @private
   */
  _handleReconnectTransientFailure(reason) {
    if (!this._isReconnecting) return;

    this._clearReconnectPendingTimers();

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this._handleReconnectFailure(reason);
      return;
    }

    const reconnectDelay = this.network?.getReconnectDelay?.() ?? DEFAULT_RECONNECT_DELAY_MS;
    showNotification(`重连失败（${reason}），准备重试`, 'warning', 2000);
    this._scheduleReconnectAttempt(reconnectDelay);
  }

  /**
   * Start reconnect flow from a known reconnect context
   * @private
   * @param {Object} ctx - Reconnect context
   * @param {number} [initialDelayMs=DEFAULT_RECONNECT_DELAY_MS] - Delay before first attempt
   */
  _startReconnectFlow(ctx, initialDelayMs = DEFAULT_RECONNECT_DELAY_MS) {
    if (!(this.network instanceof NetworkClient)) {
      return;
    }

    this._closeResultScreen(true);
    this._clearReconnectPendingTimers();
    this._isReconnecting = true;
    this._reconnectAttempts = 0;
    this._reconnectContext = ctx;
    showLoading('连接中，正在恢复对局...');
    this._scheduleReconnectAttempt(initialDelayMs);
  }

  /**
   * Manual retry reconnect after max attempts
   * @private
   * @param {Object} ctx - Reconnect context
   */
  _retryReconnectFromContext(ctx) {
    if (!ctx?.serverUrl || !ctx?.roomId || !ctx?.sessionId) {
      showNotification('重连上下文缺失，请手动加入房间', 'warning');
      return;
    }

    this.mode = 'local';
    this.sessionId = ctx.sessionId;
    saveSessionData('sessionId', this.sessionId);
    saveSessionData(RECONNECT_CONTEXT_KEY, ctx);

    this.currentRoom = {
      id: ctx.roomId,
      gameType: ctx.gameType || 'unknown',
      nickname: ctx.nickname || this.config.game.defaultNickname,
      players: []
    };

    this.network = new NetworkClient(ctx.serverUrl);
    this.network.playerId = this.playerId;
    this._setupNetworkHandlers();
    this._startReconnectFlow(ctx, 0);
  }

  /**
   * Whether current runtime state can attempt reconnect
   * @private
   */
  _canAttemptReconnect() {
    return this.mode === 'local'
      && this.network instanceof NetworkClient
      && !!this.currentGame
      && !!this.currentRoom?.id;
  }

  /**
   * Attempt reconnect and restore game state snapshot
   * @private
   */
  _attemptReconnect() {
    if (this._isReconnecting || !(this.network instanceof NetworkClient)) {
      return;
    }

    const ctx = this._loadReconnectContext();
    if (
      !ctx
      || ctx.playerId !== this.playerId
      || !ctx.roomId
      || !ctx.sessionId
      || !ctx.serverUrl
    ) {
      this._handleReconnectFailure('缺少重连上下文');
      return;
    }

    const reconnectDelay = this.network.getReconnectDelay?.() ?? DEFAULT_RECONNECT_DELAY_MS;
    this._startReconnectFlow(ctx, reconnectDelay);
  }

  /**
   * Handle reconnect accepted signal
   * @private
   */
  _handleReconnectAccepted() {
    if (!this._isReconnecting) return;

    this._clearReconnectPendingTimers();
    updateLoadingMessage('重连已通过，正在同步对局快照...');

    // Snapshot is expected next; this fallback prevents indefinite loading.
    if (this._reconnectResponseTimer) {
      clearTimeout(this._reconnectResponseTimer);
    }

    this._reconnectResponseTimer = setTimeout(() => {
      this._cancelReconnectTimers();
      hideLoading();
      showToast('重连成功');
    }, 2000);

    showToast('重连成功，正在同步状态...');
  }

  /**
   * Handle snapshot after reconnect
   * @private
   */
  _handleGameSnapshot(data) {
    const snapshotState = data?.gameState;
    if (!snapshotState || typeof snapshotState !== 'object') {
      if (this._isReconnecting) {
        this._handleReconnectFailure('快照数据无效');
      }
      return;
    }

    const gameType = this.currentRoom?.gameType;
    if (!gameType || !hasGame(gameType)) {
      this._handleReconnectFailure('无法识别游戏类型');
      return;
    }

    const snapshotSettings = data?.gameSettings && typeof data.gameSettings === 'object'
      ? data.gameSettings
      : null;
    const players = snapshotState.players || this.currentRoom?.players || [];
    const settings = snapshotSettings || this.currentRoom?.gameSettings || this._currentGameSettings || {};

    if (this.currentRoom) {
      this.currentRoom.players = players;
      this.currentRoom.gameType = gameType;
      if (snapshotSettings) {
        this.currentRoom.gameSettings = snapshotSettings;
      }
    }
    this._currentGameSettings = settings;

    this._startGame(gameType, players, 'online', settings, snapshotState);
    this._cancelReconnectTimers();
    hideLoading();
    showToast('已恢复到最新对局状态');
  }

  /**
   * Handle reconnect rejected/failed
   * @private
   */
  _handleReconnectFailure(reason = '重连失败') {
    const lastContext = this._reconnectContext || this._loadReconnectContext();
    this._cancelReconnectTimers();
    this._closeResultScreen(true);
    hideLoading();

    const prefill = lastContext && lastContext.roomId && lastContext.serverUrl
      ? {
          serverUrl: lastContext.serverUrl,
          roomId: lastContext.roomId,
          nickname: lastContext.nickname || this.config.game.defaultNickname
        }
      : null;

    this._clearReconnectContext();
    this.currentRoom = null;
    this.currentGame = null;
    this.showLobby();

    if (prefill && this.mode === 'local') {
      this._joinRoomPrefill = prefill;
      showNotification(`重连失败: ${reason}`, 'error');
      const modal = getModal();
      modal.confirm(
        '重连失败',
        '是否继续使用上次会话恢复对局？',
        { confirmText: '继续重连', cancelText: '稍后' }
      ).then((shouldJoin) => {
        if (shouldJoin) {
          this._retryReconnectFromContext(lastContext);
        }
      });
      return;
    }

    showNotification(`重连失败: ${reason}`, 'error');
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

    this.currentView = new GameLobby({
      onSelectGame: (gameId, mode) => this._handleGameSelect(gameId, mode),
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
    const configs = { uno: unoConfig, werewolf: werewolfConfig };
    return configs[gameId] || { id: gameId, name: gameId, minPlayers: 2, maxPlayers: 4 };
  }

  /**
   * Start offline game
   * @private
   */
  _startOfflineGame(gameType, settings = {}, aiCount = 1) {
    const nickname = this.config.game.defaultNickname || '玩家1';

    // Create player list with human and AI players
    const players = [
      { id: this.playerId, nickname, isHost: true }
    ];

    // Add AI players based on count
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
    this._clearView();
    if (!this._isReconnecting) {
      this._lastGameResult = null;
    }

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
    if (mode === 'online' && this.mode === 'local') {
      this._saveReconnectContext({ gameType });
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
      onSendChat: (message) => {
        if (this.network?.isConnected()) {
          this.network.sendChat(message);
        }
      }
    });

    this.currentView.mount(this.root);
    this.currentView.updateState(visibleState);

    // Set up game-specific UI (store instance for reuse on state updates)
    let gameUI = null;
    if (gameType === 'uno') {
      gameUI = new UnoUI();
      this.currentView.setGameUI(gameUI);
    } else if (gameType === 'werewolf') {
      gameUI = new WerewolfUI();
      this.currentView.setGameUI(gameUI);
    }

    // Listen for game events
    game.on('stateUpdated', (state) => {
      const visible = game.getVisibleState
        ? game.getVisibleState(this.playerId)
        : state;
      this.currentView.updateState(visible);

      // Re-render game UI (reuse existing instance)
      if (gameUI) {
        this.currentView.setGameUI(gameUI);
      }

      // Auto-draw when no playable cards (only for human player's turn)
      if (gameType === 'uno' && visible.currentPlayer === this.playerId) {
        this._checkAutoDraw(visible);
      }
    });

    game.on('gameEnded', (result) => {
      this._showGameResult(result);
    });

    // Note: invalidMove errors are handled in _handleGameAction, no need for separate listener

    // Start AI simulation if offline, or if online and host with AI players
    const shouldSimulateAI = mode === 'offline' ||
      (mode === 'online' && this._isHost() && this._aiPlayers?.length > 0);

    if (shouldSimulateAI) {
      setTimeout(() => this._simulateAITurn(), 500);
    }
  }

  /**
   * Check if current player is the host
   * @private
   */
  _isHost() {
    return this.currentRoom?.players?.find(p => p.id === this.playerId)?.isHost || false;
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
      this.network.sendGameAction(action.actionType, action.actionData, {
        gameState: this.currentGame.getState()
      });
    }

    // Simulate AI moves for offline mode
    if (this.currentGame.mode === 'offline') {
      setTimeout(() => this._simulateAITurn(), 500);
    }
  }

  /**
   * Check if player should auto-draw (no playable cards)
   * @private
   */
  _checkAutoDraw(state) {
    // Don't auto-draw if there are pending draws (player must click to draw those)
    if (state.drawPending > 0) return;

    // Don't auto-draw if player just drew (they might be able to play or skip)
    if (state.lastAction?.type === 'drew' && state.lastAction?.playerId === this.playerId) return;

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
        playerId, // Include AI player ID
        gameState: this.currentGame.getState()
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

          if (topCard.type === CARD_TYPES.DRAW_TWO) {
            stackCard = aiHand.find(c => c.type === CARD_TYPES.DRAW_TWO);
          } else if (topCard.type === CARD_TYPES.WILD_DRAW_FOUR) {
            stackCard = aiHand.find(c => c.type === CARD_TYPES.WILD_DRAW_FOUR);
          }

          if (stackCard) {
            // AI stacks the card
            const chosenColor = stackCard.color === null
              ? COLORS[Math.floor(Math.random() * COLORS.length)]
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
        canPlayCard(card, topCard, state.currentColor)
      );

      if (playableCards.length > 0) {
        const card = playableCards[Math.floor(Math.random() * playableCards.length)];
        const chosenColor = card.color === null
          ? COLORS[Math.floor(Math.random() * COLORS.length)]
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
      }

      if (this.network?.isConnected()) {
        this._manualDisconnect = true;
        this.network.leaveRoom();
        this.network.disconnect();
      }

      this._cancelReconnectTimers();
      this._clearReconnectContext();
      this.currentRoom = null;
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

    const isOnlineRound = this.currentGame?.mode === 'online'
      && !!this.currentRoom
      && this.network?.isConnected();

    const resultScreen = new GameResult({
      result,
      playerId: this.playerId,
      playAgainLabel: isOnlineRound ? '回到房间' : '再来一局',
      onPlayAgain: () => {
        this._resultScreen = null;
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
        this.currentGame = null;
        this.showLobby();
      }
    });

    this._resultScreen = resultScreen;
    resultScreen.show();
  }

  /**
   * Show create room dialog
   * @private
   */
  async _showCreateRoomDialog(gameType, settings = {}, gameConfig = {}, cachedPreset = null) {
    const modal = getModal();
    const content = document.createElement('div');

    const minP = gameConfig.minPlayers || 2;
    const maxP = gameConfig.maxPlayers || 10;
    const hasRoleSetup = !!gameConfig.defaultRoleCounts;

    // For role-setup games, compute maxPlayers from roleCounts sum
    let roleTotal = 0;
    if (hasRoleSetup && settings.roleCounts) {
      roleTotal = Object.values(settings.roleCounts).reduce((s, v) => s + v, 0);
    }

    const playerCountHtml = hasRoleSetup
      ? `<div class="input" style="background: var(--bg-tertiary); cursor: default;">
           ${roleTotal || minP} 人（由角色配置决定）
         </div>`
      : (() => {
          const defaultMaxPlayers = Number.isFinite(cachedPreset?.maxPlayers)
            ? Math.max(minP, Math.min(maxP, cachedPreset.maxPlayers))
            : minP;
          const playerOptions = Array.from(
            { length: maxP - minP + 1 },
            (_, i) => {
              const n = minP + i;
              return `<option value="${n}" ${n === defaultMaxPlayers ? 'selected' : ''}>${n} 人</option>`;
            }
          ).join('');
          return `<select class="input max-players-select">${playerOptions}</select>`;
        })();

    const isCloud = this.mode === 'cloud';
    const cloudNickname = isCloud
      ? (this.authService?.getCurrentUser()?.nickname || '')
      : '';
    const defaultNickname = isCloud
      ? cloudNickname
      : this.config.game.defaultNickname;
    const defaultServerUrl = (!isCloud && cachedPreset?.serverUrl)
      ? cachedPreset.serverUrl
      : DEFAULT_LOCAL_SERVER_URL;

    content.innerHTML = `
      ${!isCloud ? `
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">服务器地址</label>
          <input type="text" class="input server-input" value="${defaultServerUrl}" placeholder="ws://IP:端口">
        </div>
      ` : ''}
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">房间 ID</label>
        <input type="text" class="input room-input" value="room-${Date.now().toString(36)}" placeholder="房间ID">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">你的昵称</label>
        <input type="text" class="input nickname-input" value="${defaultNickname}" placeholder="昵称">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">玩家人数</label>
        ${playerCountHtml}
      </div>
      <button class="btn btn-primary create-btn" style="width: 100%;">创建房间</button>
    `;

    const title = isCloud ? '创建云端房间' : '创建在线房间';
    modal.show(content, { title, width: '360px' });

    content.querySelector('.create-btn').addEventListener('click', async () => {
      const serverUrl = isCloud
        ? ''
        : content.querySelector('.server-input')?.value.trim();
      const roomId = content.querySelector('.room-input').value.trim();
      const nickname = content.querySelector('.nickname-input').value.trim();

      let maxPlayers;
      if (hasRoleSetup && settings.roleCounts) {
        maxPlayers = Object.values(settings.roleCounts).reduce((s, v) => s + v, 0);
      } else {
        maxPlayers = parseInt(content.querySelector('.max-players-select')?.value || minP, 10);
      }

      if ((!isCloud && !serverUrl) || !roomId || !nickname) {
        showToast('请填写所有字段');
        return;
      }

      this._saveRoomCreatePreset(gameType, {
        settings,
        maxPlayers,
        serverUrl: isCloud ? '' : serverUrl
      });

      modal.hide();
      // Store settings and config for when game starts
      this._pendingGameSettings = settings;
      this._pendingGameConfig = gameConfig;
      const supportsAI = gameConfig.supportsAI !== false;
      await this._connectAndCreateRoom(serverUrl, roomId, nickname, gameType, maxPlayers, supportsAI);
    });
  }

  /**
   * Show join room dialog
   * @private
   */
  async _showJoinRoomDialog() {
    const modal = getModal();
    const content = document.createElement('div');
    const prefill = this._joinRoomPrefill;
    this._joinRoomPrefill = null;

    const isCloud = this.mode === 'cloud';
    const defaultServerUrl = prefill?.serverUrl || 'ws://localhost:7777';
    const defaultRoomId = prefill?.roomId || '';
    const defaultNickname = isCloud
      ? (this.authService?.getCurrentUser()?.nickname || '')
      : (prefill?.nickname || this.config.game.defaultNickname);

    content.innerHTML = `
      ${!isCloud ? `
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">服务器地址</label>
          <input type="text" class="input server-input" value="${defaultServerUrl}" placeholder="ws://IP:端口">
        </div>
      ` : ''}
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">房间 ID</label>
        <input type="text" class="input room-input" value="${defaultRoomId}" placeholder="输入房间ID">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">你的昵称</label>
        <input type="text" class="input nickname-input" value="${defaultNickname}" placeholder="昵称">
      </div>
      <button class="btn btn-primary join-btn" style="width: 100%;">加入房间</button>
    `;

    const title = isCloud ? '加入云端房间' : '加入在线房间';
    modal.show(content, { title, width: '360px' });

    content.querySelector('.join-btn').addEventListener('click', async () => {
      const serverUrl = isCloud
        ? ''
        : content.querySelector('.server-input')?.value.trim();
      const roomId = content.querySelector('.room-input').value.trim();
      const nickname = content.querySelector('.nickname-input').value.trim();

      if ((!isCloud && !serverUrl) || !roomId || !nickname) {
        showToast('请填写所有字段');
        return;
      }

      modal.hide();
      await this._connectAndJoinRoom(serverUrl, roomId, nickname);
    });
  }

  /**
   * Connect and create room
   * @private
   */
  async _connectAndCreateRoom(serverUrl, roomId, nickname, gameType, maxPlayers = 4, supportsAI = true) {
    showLoading('连接服务器...');

    try {
      if (this.mode === 'local') {
        this._refreshSessionId();
      }
      if (this.mode === 'cloud') {
        this.network = new CloudNetworkClient(getSupabaseClient());
      } else {
        this.network = new NetworkClient(serverUrl);
      }
      this.network.playerId = this.playerId;

      await this.network.connect();

      this._setupNetworkHandlers();

      const reconnectSessionId = this.mode === 'local' ? this.sessionId : null;
      this.network.joinRoom(roomId, nickname, gameType, reconnectSessionId);

      this.currentRoom = {
        id: roomId,
        gameType,
        maxPlayers,
        supportsAI,
        nickname,
        players: [{ id: this.playerId, nickname, isHost: true }],
        aiPlayers: [], // AI players managed by host
        gameConfig: this._pendingGameConfig || this._getGameConfig(gameType),
        gameSettings: this._pendingGameSettings || {},
        returnToRoomPhase: false,
        returnStatus: { [this.playerId]: true },
        allPlayersReturned: true
      };
      this._saveReconnectContext();

      hideLoading();
      this._showWaitingRoom();

    } catch (err) {
      hideLoading();
      showNotification('连接失败: ' + err.message, 'error');
    }
  }

  /**
   * Connect and join room
   * @private
   */
  async _connectAndJoinRoom(serverUrl, roomId, nickname) {
    showLoading('连接服务器...');

    try {
      if (this.mode === 'local') {
        this._refreshSessionId();
      }
      if (this.mode === 'cloud') {
        this.network = new CloudNetworkClient(getSupabaseClient());
      } else {
        this.network = new NetworkClient(serverUrl);
      }
      this.network.playerId = this.playerId;

      await this.network.connect();

      this._setupNetworkHandlers();

      const reconnectSessionId = this.mode === 'local' ? this.sessionId : null;
      this.network.joinRoom(roomId, nickname, 'unknown', reconnectSessionId);

      this.currentRoom = {
        id: roomId,
        gameType: 'unknown',
        nickname,
        players: [],
        returnToRoomPhase: false,
        returnStatus: {},
        allPlayersReturned: true
      };
      this._saveReconnectContext();

      hideLoading();
      // Waiting room will be shown when PLAYER_JOINED is received

    } catch (err) {
      hideLoading();
      showNotification('连接失败: ' + err.message, 'error');
    }
  }

  /**
   * Setup network event handlers
   * @private
   */
  _setupNetworkHandlers() {
    const net = this.network;

    net.onMessage('PLAYER_JOINED', (data) => {
      // Preserve existing gameSettings (host is source of truth);
      // only accept server settings when we have none yet (non-host joining)
      const existingSettings = this.currentRoom?.gameSettings;
      const hasLocalSettings = existingSettings
        && Object.keys(existingSettings).length > 0;
      const gameSettings = hasLocalSettings
        ? existingSettings
        : (data.gameSettings || {});
      const wasReturnToRoomPhase = !!this.currentRoom?.returnToRoomPhase;
      const previousReturnStatus = this.currentRoom?.returnStatus || {};
      const nextReturnStatus = {};
      (data.players || []).forEach((player) => {
        if (Object.prototype.hasOwnProperty.call(previousReturnStatus, player.id)) {
          nextReturnStatus[player.id] = !!previousReturnStatus[player.id];
          return;
        }
        // New players in non-started room are considered already back in room.
        nextReturnStatus[player.id] = true;
      });
      const allPlayersReturned = wasReturnToRoomPhase
        ? (data.players || []).length > 0
          && (data.players || []).every(player => !!nextReturnStatus[player.id])
        : true;

      this.currentRoom = {
        ...this.currentRoom,
        players: data.players,
        aiPlayers: data.aiPlayers || this.currentRoom?.aiPlayers || [],
        gameSettings,
        returnToRoomPhase: wasReturnToRoomPhase,
        returnStatus: nextReturnStatus,
        allPlayersReturned
      };
      this._saveReconnectContext();

      if (!this.currentView || !(this.currentView instanceof WaitingRoom)) {
        this._showWaitingRoom();
      } else {
        this.currentView.updatePlayers(data.players);
        if (this.currentRoom.returnToRoomPhase) {
          this.currentView.updateReturnStatus(
            this.currentRoom.returnStatus || {},
            this.currentRoom.allPlayersReturned
          );
        }
        // Sync AI players if provided
        if (data.aiPlayers) {
          this.currentView.updateAIPlayers(data.aiPlayers);
        }
        // Only sync game settings for non-host (who doesn't have settings yet)
        if (data.gameSettings && !hasLocalSettings) {
          this.currentView.updateGameSettings(data.gameSettings);
        }
        this.currentView.addSystemMessage(`${data.nickname} 加入了房间`);

        // Host re-sends settings so new player receives full room info
        if (this._isHost() && this.network?.isConnected()) {
          const settings = this.currentRoom.gameSettings || {};
          this.network.send('GAME_SETTINGS_UPDATE', {
            gameSettings: {
              ...settings,
              _gameType: this.currentRoom.gameType,
              _maxPlayers: this.currentRoom.maxPlayers
            }
          });
        }
      }
    });

    net.onMessage('PLAYER_LEFT', (data) => {
      if (this.currentRoom) {
        this.currentRoom.players = data.players;
        if (this.currentRoom.returnToRoomPhase) {
          const nextReturnStatus = {};
          const previousReturnStatus = this.currentRoom.returnStatus || {};
          (data.players || []).forEach((player) => {
            nextReturnStatus[player.id] = !!previousReturnStatus[player.id];
          });
          this.currentRoom.returnStatus = nextReturnStatus;
          this.currentRoom.allPlayersReturned = (data.players || []).length > 0
            && (data.players || []).every(player => !!nextReturnStatus[player.id]);
        }
      }

      if (this.currentView instanceof WaitingRoom) {
        this.currentView.updatePlayers(data.players);
        if (this.currentRoom?.returnToRoomPhase) {
          this.currentView.updateReturnStatus(
            this.currentRoom.returnStatus || {},
            this.currentRoom.allPlayersReturned
          );
        }
        this.currentView.addSystemMessage(`玩家离开了房间`);
      }
    });

    net.onMessage('ROOM_DESTROYED', (data) => {
      const message = data.message || '房间已解散';
      showToast(message, 'warning');

      // Disconnect and return to lobby
      if (this.network) {
        this._manualDisconnect = true;
        this.network.disconnect();
      }
      this._cancelReconnectTimers();
      this._clearReconnectContext();
      this.currentRoom = null;
      this.currentGame = null;
      this.showLobby();
    });

    net.onMessage('AI_PLAYER_UPDATE', (data) => {
      const aiPlayers = data.aiPlayers || [];
      if (this.currentRoom) {
        this.currentRoom.aiPlayers = aiPlayers;
      }

      if (this.currentView instanceof WaitingRoom) {
        this.currentView.updateAIPlayers(aiPlayers);
      }
    });

    net.onMessage('GAME_SETTINGS_UPDATE', (data) => {
      const gameSettings = data.gameSettings || {};
      const metaGameType = gameSettings._gameType;
      const metaMaxPlayers = gameSettings._maxPlayers;

      if (this.currentRoom) {
        this.currentRoom.gameSettings = gameSettings;

        // Non-host: upgrade room info from metadata when gameType is unknown
        if (metaGameType && this.currentRoom.gameType === 'unknown') {
          this.currentRoom.gameType = metaGameType;
          this.currentRoom.gameConfig = this._getGameConfig(metaGameType);
          this.currentRoom.maxPlayers = metaMaxPlayers
            || this.currentRoom.gameConfig.maxPlayers;
          this.currentRoom.supportsAI =
            !!this.currentRoom.gameConfig.supportsAI;

          // Re-create waiting room with full data
          if (this.currentView instanceof WaitingRoom) {
            this._showWaitingRoom();
            return;
          }
        }

        // Update maxPlayers from metadata (host may have changed role counts)
        if (metaMaxPlayers) {
          this.currentRoom.maxPlayers = metaMaxPlayers;
        }
      }
      this._saveReconnectContext({ gameType: this.currentRoom?.gameType || 'unknown' });

      if (this.currentView instanceof WaitingRoom) {
        this.currentView.updateGameSettings(gameSettings);
      }
    });

    net.onMessage('GAME_STARTED', (data) => {
      showToast('游戏开始!');
      // Get players from initial state (includes AI players)
      const players = data.initialState?.players || this.currentRoom?.players || [];
      // Store AI players info for simulation
      this._aiPlayers = data.aiPlayers || [];
      // Use gameSettings from host if provided, otherwise use local pending settings
      const settings = data.gameSettings || this._pendingGameSettings || {};
      // Store for display in GameBoard
      this._currentGameSettings = settings;
      this._saveReconnectContext({ gameType: data.gameType });
      // Use initialState from host if provided
      this._startGame(data.gameType, players, 'online', settings, data.initialState);
    });

    net.onMessage('RETURN_TO_ROOM_STATUS', (data) => {
      if (!this.currentRoom) {
        return;
      }

      const statusPlayers = Array.isArray(data?.players) ? data.players : [];
      const roomPlayers = statusPlayers.map(player => ({
        id: player.id,
        nickname: player.nickname,
        isHost: player.isHost
      }));
      const statusByPlayer = {};
      roomPlayers.forEach((player, index) => {
        statusByPlayer[player.id] = !!statusPlayers[index]?.returned;
      });

      this.currentRoom.players = roomPlayers;
      this.currentRoom.returnToRoomPhase = true;
      this.currentRoom.returnStatus = statusByPlayer;
      this.currentRoom.allPlayersReturned = typeof data?.allReturned === 'boolean'
        ? data.allReturned
        : roomPlayers.length > 0 && roomPlayers.every(player => !!statusByPlayer[player.id]);

      if (this.currentView instanceof WaitingRoom) {
        this.currentView.updatePlayers(roomPlayers);
        this.currentView.updateReturnStatus(statusByPlayer, this.currentRoom.allPlayersReturned);
      }

      this._promptReturnToRoomIfNeeded();
    });

    net.onMessage('GAME_STATE_UPDATE', (data) => {
      if (this.currentGame && data.lastAction) {
        // Apply the action from another player (or AI controlled by host)
        const action = data.lastAction;
        // Skip only if the action is from ourselves (already applied locally).
        // AI actions sent by the host must be applied by non-host clients.
        if (action.playerId !== this.playerId) {
          this.currentGame.executeMove(action);
        }
        // Trigger AI simulation if host and game has AI players
        if (this._isHost() && this._aiPlayers?.length > 0) {
          setTimeout(() => this._simulateAITurn(), 500);
        }
      }
    });

    net.onMessage('CHAT_MESSAGE_BROADCAST', (data) => {
      if (this.currentView instanceof WaitingRoom) {
        this.currentView.addChatMessage(data);
      } else if (this.currentView instanceof GameBoard) {
        this.currentView.addChatMessage(data);
      }
    });

    net.onMessage('ERROR', (data) => {
      showNotification(data.message, 'error');
    });

    net.onMessage('RECONNECT_ACCEPTED', () => {
      this._handleReconnectAccepted();
    });

    net.onMessage('RECONNECT_REJECTED', (data) => {
      if (!this._isReconnecting) return;
      this._handleReconnectFailure(data?.message || data?.reasonCode || '服务器拒绝重连');
    });

    net.onMessage('GAME_SNAPSHOT', (data) => {
      this._handleGameSnapshot(data);
    });

    net.onMessage('PLAYER_RECONNECTED', (data, message) => {
      if (this.currentRoom && Array.isArray(data?.players)) {
        this.currentRoom.players = data.players;
      }
      if (message?.playerId && message.playerId !== this.playerId) {
        showToast(`玩家 ${message.playerId.slice(0, 8)} 已重连`);
      }
    });

    net.on('disconnected', () => {
      if (this._manualDisconnect) {
        this._manualDisconnect = false;
        return;
      }

      if (this._canAttemptReconnect()) {
        showNotification('与服务器断开连接，正在尝试重连', 'warning');
        this._attemptReconnect();
        return;
      }

      this._cancelReconnectTimers();
      this._clearReconnectContext();
      this.currentRoom = null;
      this.currentGame = null;
      showNotification('与服务器断开连接', 'warning');
      this.showLobby();
    });

    net.on('serverError', (data) => {
      showNotification(data.message, data.severity === 'fatal' ? 'error' : 'warning');
    });
  }

  /**
   * Show waiting room
   * @private
   */
  _showWaitingRoom() {
    this._clearView();
    const canSyncRoomSettings = () => {
      if (!this.currentRoom?.returnToRoomPhase) {
        return true;
      }
      return !!this.currentRoom?.allPlayersReturned;
    };

    this.currentView = new WaitingRoom({
      room: this.currentRoom,
      playerId: this.playerId,
      onStartGame: () => {
        if (this.network?.isConnected()) {
          // Verify player count matches required number
          const humanPlayers = this.currentRoom.players || [];
          const aiPlayers = this.currentRoom.aiPlayers || [];
          const totalPlayers = humanPlayers.length + aiPlayers.length;
          const requiredPlayers = this.currentRoom.maxPlayers || totalPlayers;

          if (totalPlayers !== requiredPlayers) {
            showToast(`需要 ${requiredPlayers} 名玩家才能开始（当前 ${totalPlayers} 人）`);
            return;
          }

          const returnStatus = this.currentRoom.returnStatus || {};
          const allPlayersReturned = !this.currentRoom.returnToRoomPhase
            || humanPlayers.every(player => !!returnStatus[player.id]);
          if (this.currentRoom.returnToRoomPhase && !allPlayersReturned) {
            showToast('等待所有玩家返回房间后可开始新一局');
            return;
          }

          // Host initializes the game and sends initial state to all players
          const gameType = this.currentRoom.gameType;
          // Combine human players and AI players
          const allPlayers = [...humanPlayers, ...aiPlayers];
          // Get settings from WaitingRoom (includes any edits made)
          const settings = this.currentView.getGameSettings();

          // Create temporary game to generate initial state
          const tempGame = createGame(gameType, 'online');
          tempGame.start({ players: allPlayers, gameType, options: settings });
          const initialState = tempGame.getState();

          // Send START_GAME with initial state, AI players, and game settings
          this.network.startGame(gameType, { initialState, aiPlayers, gameSettings: settings });
        }
      },
      onLeave: () => {
        if (this.network) {
          this._manualDisconnect = true;
          this.network.leaveRoom();
          this.network.disconnect();
        }
        this._cancelReconnectTimers();
        this._clearReconnectContext();
        this.currentRoom = null;
        this.showLobby();
      },
      onSendChat: (message) => {
        if (this.network?.isConnected()) {
          this.network.sendChat(message);
        }
      },
      onAddAI: () => {
        const totalPlayers = (this.currentRoom.players?.length || 0) + (this.currentRoom.aiPlayers?.length || 0);
        const maxPlayers = this.currentRoom.maxPlayers || 10;

        if (totalPlayers >= maxPlayers) {
          showToast('已达到人数上限');
          return;
        }

        const aiCount = (this.currentRoom.aiPlayers?.length || 0) + 1;
        const aiPlayer = {
          id: `ai-${Date.now()}-${aiCount}`,
          nickname: `AI 玩家 ${aiCount}`,
          isHost: false,
          isAI: true
        };

        // WaitingRoom.addAIPlayer handles adding to the room's aiPlayers array
        // (room object is shared by reference)
        if (this.currentView instanceof WaitingRoom) {
          this.currentView.addAIPlayer(aiPlayer);
          this.currentView.addSystemMessage(`AI 玩家 ${aiCount} 已加入`);
        } else {
          // Fallback for non-WaitingRoom contexts
          if (!this.currentRoom.aiPlayers) this.currentRoom.aiPlayers = [];
          this.currentRoom.aiPlayers.push(aiPlayer);
        }

        // Sync AI players to server for other players
        if (this.network?.isConnected()) {
          this.network.send('AI_PLAYER_UPDATE', {
            aiPlayers: this.currentRoom.aiPlayers || []
          });
        }
      },
      onRemoveAI: () => {
        if (!this.currentRoom.aiPlayers || this.currentRoom.aiPlayers.length === 0) {
          showToast('没有 AI 玩家可移除');
          return;
        }

        // WaitingRoom.removeLastAIPlayer handles removing from the room's aiPlayers array
        // (room object is shared by reference)
        if (this.currentView instanceof WaitingRoom) {
          const removed = this.currentView.removeLastAIPlayer();
          if (removed) {
            this.currentView.addSystemMessage(`${removed.nickname} 已移除`);
          }
        } else {
          // Fallback for non-WaitingRoom contexts
          this.currentRoom.aiPlayers.pop();
        }

        // Sync AI players to server for other players
        if (this.network?.isConnected()) {
          this.network.send('AI_PLAYER_UPDATE', {
            aiPlayers: this.currentRoom.aiPlayers || []
          });
        }
      },
      onSettingsChange: (settings) => {
        // Update local room settings
        this.currentRoom.gameSettings = settings;
        if (!canSyncRoomSettings()) {
          showToast('请等待所有玩家返回房间后再修改设置');
          return;
        }
        // Sync to server for other players (include room metadata)
        if (this.network?.isConnected()) {
          this.network.send('GAME_SETTINGS_UPDATE', {
            gameSettings: {
              ...settings,
              _gameType: this.currentRoom.gameType,
              _maxPlayers: this.currentRoom.maxPlayers
            }
          });
        }
      }
    });

    this.currentView.mount(this.root);

    // Host sends initial GAME_SETTINGS_UPDATE so server persists settings
    // and late-joining players receive them
    if (this._isHost() && this.network?.isConnected() && canSyncRoomSettings()) {
      const settings = this.currentRoom.gameSettings || {};
      this.network.send('GAME_SETTINGS_UPDATE', {
        gameSettings: {
          ...settings,
          _gameType: this.currentRoom.gameType,
          _maxPlayers: this.currentRoom.maxPlayers
        }
      });
    }
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
        showToast('设置已保存');
      }
    });

    settings.show();
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
