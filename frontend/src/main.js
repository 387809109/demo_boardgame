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
import registerAppReconnectMethods from './app/app-reconnect-methods.js';
import registerAppOnlineRoomMethods from './app/app-online-room-methods.js';

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
      if (this.network && typeof this.network.setGameActive === 'function') {
        this.network.setGameActive(false);
      }
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
  DEFAULT_LOCAL_SERVER_URL
});

// Start the app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
