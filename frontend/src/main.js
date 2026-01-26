/**
 * Main Entry Point - Board Game Client
 * @module main
 */

import './theme/default.css';

import { registerGame, createGame, hasGame } from './game/registry.js';
import { NetworkClient } from './game/network.js';
import { loadConfig, saveSessionData, loadSessionData } from './utils/storage.js';

import { GameLobby } from './layout/game-lobby.js';
import { WaitingRoom } from './layout/waiting-room.js';
import { GameBoard } from './layout/game-board.js';
import { SettingsPanel } from './layout/settings-panel.js';
import { GameResult } from './layout/game-result.js';

import { getModal } from './components/modal.js';
import { showNotification, showToast } from './components/notification.js';
import { showLoading, hideLoading } from './components/loading.js';
import { GameSettingsModal } from './components/game-settings-modal.js';

import UnoGame from './games/uno/index.js';
import { UnoUI } from './games/uno/ui.js';
import unoConfig from './games/uno/config.json';
import { canPlayCard, COLORS, CARD_TYPES } from './games/uno/rules.js';

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

    /** @type {string} */
    this.playerId = '';

    /** @type {Object} */
    this.config = loadConfig();

    /** @type {Object|null} */
    this.currentRoom = null;

    this._init();
  }

  /**
   * Initialize the application
   * @private
   */
  _init() {
    // Register games
    registerGame('uno', UnoGame, unoConfig);

    // Generate or load player ID
    this.playerId = loadSessionData('playerId') || this._generatePlayerId();
    saveSessionData('playerId', this.playerId);

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
   * Clear current view
   * @private
   */
  _clearView() {
    if (this.currentView?.unmount) {
      this.currentView.unmount();
    }
    this.currentView = null;
    this.root.innerHTML = '';
  }

  /**
   * Show game lobby
   */
  showLobby() {
    this._clearView();

    this.currentView = new GameLobby({
      onSelectGame: (gameId, mode) => this._handleGameSelect(gameId, mode),
      onJoinRoom: () => this._showJoinRoomDialog(),
      onSettings: () => this._showSettings()
    });

    this.currentView.mount(this.root);
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

    // Show settings modal
    const settingsModal = new GameSettingsModal({
      gameConfig,
      mode,
      onConfirm: ({ settings, aiCount }) => {
        if (mode === 'offline') {
          this._startOfflineGame(gameId, settings, aiCount);
        } else {
          this._showCreateRoomDialog(gameId, settings, gameConfig.supportsAI !== false);
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
    // For now, we only have UNO
    if (gameId === 'uno') {
      return unoConfig;
    }
    return { id: gameId, name: gameId, minPlayers: 2, maxPlayers: 4 };
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

    // Get visible state for player
    const visibleState = game.getVisibleState
      ? game.getVisibleState(this.playerId)
      : game.getState();

    // Create game board
    this.currentView = new GameBoard({
      game,
      playerId: this.playerId,
      onAction: (action) => this._handleGameAction(action),
      onLeave: () => this._handleLeaveGame()
    });

    this.currentView.mount(this.root);
    this.currentView.updateState(visibleState);

    // Set up game-specific UI (store instance for reuse on state updates)
    let gameUI = null;
    if (gameType === 'uno') {
      gameUI = new UnoUI();
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
      this.network.sendGameAction(action.actionType, action.actionData);
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
      this.network.send('GAME_ACTION', {
        actionType,
        actionData,
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
        this.network.leaveRoom();
        this.network.disconnect();
      }

      this.showLobby();
    }
  }

  /**
   * Show game result
   * @private
   */
  _showGameResult(result) {
    const resultScreen = new GameResult({
      result,
      playerId: this.playerId,
      onPlayAgain: () => {
        // Start new game with same settings
        if (this.currentGame) {
          const gameType = this.currentGame.config.id;
          const players = this.currentGame.getState()?.players || [];
          const options = this._lastGameOptions || {};
          this._startGame(gameType, players, this.currentGame.mode, options);
        }
      },
      onBackToLobby: () => {
        this.currentGame = null;
        this.showLobby();
      }
    });

    resultScreen.show();
  }

  /**
   * Show create room dialog
   * @private
   */
  async _showCreateRoomDialog(gameType, settings = {}, supportsAI = true) {
    const modal = getModal();
    const content = document.createElement('div');

    content.innerHTML = `
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">服务器地址</label>
        <input type="text" class="input server-input" value="ws://localhost:7777" placeholder="ws://IP:端口">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">房间 ID</label>
        <input type="text" class="input room-input" value="room-${Date.now().toString(36)}" placeholder="房间ID">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">你的昵称</label>
        <input type="text" class="input nickname-input" value="${this.config.game.defaultNickname}" placeholder="昵称">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">玩家上限</label>
        <select class="input max-players-select">
          <option value="2">2 人</option>
          <option value="3">3 人</option>
          <option value="4" selected>4 人</option>
          <option value="5">5 人</option>
          <option value="6">6 人</option>
          <option value="8">8 人</option>
          <option value="10">10 人</option>
        </select>
      </div>
      <button class="btn btn-primary create-btn" style="width: 100%;">创建房间</button>
    `;

    modal.show(content, { title: '创建在线房间', width: '360px' });

    content.querySelector('.create-btn').addEventListener('click', async () => {
      const serverUrl = content.querySelector('.server-input').value.trim();
      const roomId = content.querySelector('.room-input').value.trim();
      const nickname = content.querySelector('.nickname-input').value.trim();
      const maxPlayers = parseInt(content.querySelector('.max-players-select').value, 10);

      if (!serverUrl || !roomId || !nickname) {
        showToast('请填写所有字段');
        return;
      }

      modal.hide();
      // Store settings for when game starts
      this._pendingGameSettings = settings;
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

    content.innerHTML = `
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">服务器地址</label>
        <input type="text" class="input server-input" value="ws://localhost:7777" placeholder="ws://IP:端口">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">房间 ID</label>
        <input type="text" class="input room-input" placeholder="输入房间ID">
      </div>
      <div class="input-group" style="margin-bottom: var(--spacing-4);">
        <label class="input-label">你的昵称</label>
        <input type="text" class="input nickname-input" value="${this.config.game.defaultNickname}" placeholder="昵称">
      </div>
      <button class="btn btn-primary join-btn" style="width: 100%;">加入房间</button>
    `;

    modal.show(content, { title: '加入在线房间', width: '360px' });

    content.querySelector('.join-btn').addEventListener('click', async () => {
      const serverUrl = content.querySelector('.server-input').value.trim();
      const roomId = content.querySelector('.room-input').value.trim();
      const nickname = content.querySelector('.nickname-input').value.trim();

      if (!serverUrl || !roomId || !nickname) {
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
      this.network = new NetworkClient(serverUrl);
      this.network.playerId = this.playerId;

      await this.network.connect();

      this._setupNetworkHandlers();

      this.network.joinRoom(roomId, nickname, gameType);

      this.currentRoom = {
        id: roomId,
        gameType,
        maxPlayers,
        supportsAI,
        players: [{ id: this.playerId, nickname, isHost: true }],
        aiPlayers: [] // AI players managed by host
      };

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
      this.network = new NetworkClient(serverUrl);
      this.network.playerId = this.playerId;

      await this.network.connect();

      this._setupNetworkHandlers();

      this.network.joinRoom(roomId, nickname, 'unknown');

      this.currentRoom = {
        id: roomId,
        gameType: 'unknown',
        players: []
      };

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
      this.currentRoom = {
        ...this.currentRoom,
        players: data.players
      };

      if (!this.currentView || !(this.currentView instanceof WaitingRoom)) {
        this._showWaitingRoom();
      } else {
        this.currentView.updatePlayers(data.players);
        this.currentView.addSystemMessage(`${data.nickname} 加入了房间`);
      }
    });

    net.onMessage('PLAYER_LEFT', (data) => {
      if (this.currentRoom) {
        this.currentRoom.players = data.players;
      }

      if (this.currentView instanceof WaitingRoom) {
        this.currentView.updatePlayers(data.players);
        this.currentView.addSystemMessage(`玩家离开了房间`);
      }
    });

    net.onMessage('GAME_STARTED', (data) => {
      showToast('游戏开始!');
      // Get players from initial state (includes AI players)
      const players = data.initialState?.players || this.currentRoom?.players || [];
      // Store AI players info for simulation
      this._aiPlayers = data.aiPlayers || [];
      const settings = this._pendingGameSettings || {};
      // Use initialState from host if provided
      this._startGame(data.gameType, players, 'online', settings, data.initialState);
    });

    net.onMessage('GAME_STATE_UPDATE', (data) => {
      if (this.currentGame && data.lastAction) {
        // Apply the action from another player (or AI)
        const action = data.lastAction;
        const isAI = this._isAIPlayer(action.playerId);
        // Execute if not from self (for human players) or not from local AI simulation
        if (action.playerId !== this.playerId && !isAI) {
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
      }
    });

    net.onMessage('ERROR', (data) => {
      showNotification(data.message, 'error');
    });

    net.on('disconnected', () => {
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

    this.currentView = new WaitingRoom({
      room: this.currentRoom,
      playerId: this.playerId,
      onStartGame: () => {
        if (this.network?.isConnected()) {
          // Host initializes the game and sends initial state to all players
          const gameType = this.currentRoom.gameType;
          // Combine human players and AI players
          const humanPlayers = this.currentRoom.players || [];
          const aiPlayers = this.currentRoom.aiPlayers || [];
          const allPlayers = [...humanPlayers, ...aiPlayers];
          const settings = this._pendingGameSettings || {};

          // Create temporary game to generate initial state
          const tempGame = createGame(gameType, 'online');
          tempGame.start({ players: allPlayers, gameType, options: settings });
          const initialState = tempGame.getState();

          // Send START_GAME with initial state and AI player info
          this.network.startGame(gameType, { initialState, aiPlayers });
        }
      },
      onLeave: () => {
        if (this.network) {
          this.network.leaveRoom();
          this.network.disconnect();
        }
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

        if (!this.currentRoom.aiPlayers) this.currentRoom.aiPlayers = [];
        this.currentRoom.aiPlayers.push(aiPlayer);

        if (this.currentView instanceof WaitingRoom) {
          this.currentView.addAIPlayer(aiPlayer);
          this.currentView.addSystemMessage(`AI 玩家 ${aiCount} 已加入`);
        }
      },
      onRemoveAI: () => {
        if (!this.currentRoom.aiPlayers || this.currentRoom.aiPlayers.length === 0) {
          showToast('没有 AI 玩家可移除');
          return;
        }

        const removed = this.currentRoom.aiPlayers.pop();

        if (this.currentView instanceof WaitingRoom) {
          this.currentView.removeLastAIPlayer();
          this.currentView.addSystemMessage(`${removed.nickname} 已移除`);
        }
      }
    });

    this.currentView.mount(this.root);
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
