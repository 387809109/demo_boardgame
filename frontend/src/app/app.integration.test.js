import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from 'vitest';
import registerAppOnlineRoomMethods from './app-online-room-methods.js';
import registerAppReconnectMethods from './app-reconnect-methods.js';
import { saveSessionData, loadSessionData } from '../utils/storage.js';

function createMockStorage() {
  const data = new Map();
  return {
    getItem: (key) => {
      if (!data.has(key)) {
        return null;
      }
      return data.get(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    }
  };
}

class MockNetwork {
  constructor() {
    this._messageHandlers = new Map();
    this._eventHandlers = new Map();
    this.serverUrl = 'ws://localhost:7777';
    this.connected = false;
    this.playerId = '';
    this.connect = vi.fn(async () => {
      this.connected = true;
    });
    this.disconnect = vi.fn(() => {
      this.connected = false;
    });
    this.isConnected = vi.fn(() => this.connected);
    this.joinRoom = vi.fn();
    this.startGame = vi.fn();
    this.send = vi.fn();
    this.sendGameAction = vi.fn();
    this.sendSnapshotResponse = vi.fn();
    this.sendChat = vi.fn();
    this.leaveRoom = vi.fn();
    this.requestReconnect = vi.fn(async () => {});
    this.getReconnectDelay = vi.fn(() => 3000);
  }

  onMessage(type, handler) {
    const handlers = this._messageHandlers.get(type) || [];
    handlers.push(handler);
    this._messageHandlers.set(type, handlers);
    return () => {
      this._messageHandlers.set(
        type,
        (this._messageHandlers.get(type) || []).filter((h) => h !== handler)
      );
    };
  }

  on(type, handler) {
    const handlers = this._eventHandlers.get(type) || [];
    handlers.push(handler);
    this._eventHandlers.set(type, handlers);
    return () => {
      this._eventHandlers.set(
        type,
        (this._eventHandlers.get(type) || []).filter((h) => h !== handler)
      );
    };
  }

  emitMessage(type, data = {}) {
    const message = {
      type,
      data,
      timestamp: Date.now(),
      playerId: data.playerId || 'server'
    };
    const handlers = this._messageHandlers.get(type) || [];
    handlers.forEach((handler) => handler(data, message));
  }

  emitEvent(type, payload = {}) {
    const handlers = this._eventHandlers.get(type) || [];
    handlers.forEach((handler) => handler(payload));
  }
}

class NetworkClientMock extends MockNetwork {}
class CloudNetworkClientMock extends MockNetwork {}

function createWaitingRoomFactory() {
  let instance;
  class WaitingRoomFactory {
    constructor(opts) {
      instance = this;
      this.opts = opts;
      this.mount = vi.fn();
      this.updatePlayers = vi.fn();
      this.updateAIPlayers = vi.fn();
      this.updateGameSettings = vi.fn();
      this.updateReturnStatus = vi.fn();
      this.addSystemMessage = vi.fn();
      this.addChatMessage = vi.fn();
      this.addAIPlayer = vi.fn((aiPlayer) => {
        if (this.opts?.room?.aiPlayers) {
          this.opts.room.aiPlayers.push(aiPlayer);
        }
      });
      this.removeLastAIPlayer = vi.fn(() => {
        if (!Array.isArray(this.opts?.room?.aiPlayers) || this.opts.room.aiPlayers.length === 0) {
          return null;
        }
        return this.opts.room.aiPlayers.pop();
      });
      this.getGameSettings = vi.fn(() => ({
        initialCards: 7,
        forcePlay: true
      }));
    }
  }
  return { Factory: WaitingRoomFactory, getInstance: () => instance };
}

function createGameMock() {
  return vi.fn((gameType, _mode) => {
    const state = {
      players: [],
      options: {}
    };
    return {
      start: (payload) => {
        state.players = payload?.players || [];
        state.options = payload?.options || {};
      },
      getState: () => ({
        players: [...state.players],
        options: { ...state.options }
      })
    };
  });
}

function buildAppClass(deps) {
  class TestApp {
    constructor() {
      this.root = { appendChild: vi.fn() };
      this.network = null;
      this.currentGame = null;
      this.currentRoom = null;
      this.currentView = null;
      this._startGameSpy = vi.fn();
      this._pendingGameSettings = {};
      this._pendingGameConfig = null;
      this._pendingJoinAnalytics = null;
      this._aiPlayers = [];
      this._currentGameSettings = {};
      this._isReconnecting = false;
      this._reconnectAttempts = 0;
      this._reconnectContext = null;
      this._reconnectAttemptTimer = null;
      this._reconnectResponseTimer = null;
      this._reconnectCountdownTimer = null;
      this.playerId = 'player-host';
      this.sessionId = 'sess-local';
      this.mode = 'local';
      this.config = {
        game: { defaultNickname: 'Host' },
        analytics: { enabled: false }
      };
    }

    _getGameConfig(gameType) {
      if (gameType === 'uno') {
        return {
          id: 'uno',
          maxPlayers: 8,
          minPlayers: 2,
          supportsAI: true,
          settingsSchema: {}
        };
      }
      return {
        id: gameType,
        maxPlayers: 8,
        minPlayers: 2,
        supportsAI: false,
        settingsSchema: {}
      };
    }

    showLobby() {}
    _clearView() {}
    _closeResultScreen() {}

    _startGame(...args) {
      this._startGameSpy(...args);
    }

    _isHost() {
      return !!(this.currentRoom?.players || []).find(
        (p) => p.id === this.playerId && p.isHost
      );
    }

    _simulateAITurn() {}

    _refreshSessionId() {
      this.sessionId = `sess-${Date.now().toString(36)}`;
      saveSessionData('sessionId', this.sessionId);
    }
  }

  registerAppOnlineRoomMethods(TestApp, deps);
  registerAppReconnectMethods(TestApp, deps);
  return TestApp;
}

describe('App integration flows', () => {
  let AppClass;
  let deps;
  let waitingRoomFactory;
  let showNotification;
  let showToast;
  let showLoading;
  let hideLoading;
  let updateLoadingMessage;
  let trackEvent;

  beforeEach(() => {
    globalThis.localStorage = createMockStorage();
    globalThis.sessionStorage = createMockStorage();

    waitingRoomFactory = createWaitingRoomFactory();
    const gameMock = createGameMock();

    showNotification = vi.fn();
    showToast = vi.fn();
    showLoading = vi.fn();
    hideLoading = vi.fn();
    updateLoadingMessage = vi.fn();
    trackEvent = vi.fn();
    const gameBoardMock = vi.fn(() => ({
      mount: vi.fn(),
      addChatMessage: vi.fn()
    }));

    deps = {
      NetworkClient: NetworkClientMock,
      CloudNetworkClient: CloudNetworkClientMock,
      getSupabaseClient: vi.fn(),
      createGame: gameMock,
      WaitingRoom: waitingRoomFactory.Factory,
      GameBoard: gameBoardMock,
      getModal: vi.fn(() => ({
        confirm: vi.fn(() => Promise.resolve(false)),
        show: vi.fn(),
        hide: vi.fn()
      })),
      showLoading,
      hideLoading,
      updateLoadingMessage,
      showNotification,
      showToast,
      trackEvent,
      hasGame: (gameId) => gameId === 'uno' || gameId === 'werewolf',
      saveSessionData,
      loadSessionData,
      RECONNECT_CONTEXT_KEY: 'reconnectContext',
      RECONNECT_RESPONSE_TIMEOUT_MS: 8000,
      DEFAULT_RECONNECT_DELAY_MS: 3000,
      MAX_RECONNECT_ATTEMPTS: 3,
      RECONNECT_COUNTDOWN_STEP_MS: 1000,
      DEFAULT_LOCAL_SERVER_URL: 'ws://localhost:7777'
    };

    AppClass = buildAppClass(deps);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (globalThis.localStorage?.clear) {
      globalThis.localStorage.clear();
    }
    if (globalThis.sessionStorage?.clear) {
      globalThis.sessionStorage.clear();
    }
  });

  it('creates a local room and opens waiting room with host settings sync', async () => {
    const app = new AppClass();
    app._pendingGameSettings = { forcePlay: false };

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 4, true);

    expect(app.network).toBeInstanceOf(NetworkClientMock);
    expect(app.network.connect).toHaveBeenCalled();
    expect(app.network.joinRoom).toHaveBeenCalledWith('room-1', 'Host', 'uno', app.sessionId);
    expect(app.currentRoom).toEqual(expect.objectContaining({
      id: 'room-1',
      gameType: 'uno',
      maxPlayers: 4,
      gameSettings: { forcePlay: false }
    }));
    expect(app.currentView).toBe(waitingRoomFactory.getInstance());
    expect(app.network.send).toHaveBeenCalledWith(
      'GAME_SETTINGS_UPDATE',
      expect.objectContaining({
        gameSettings: expect.objectContaining({
          _gameType: 'uno',
          _maxPlayers: 4
        })
      })
    );
  });

  it('starts online game when host triggers waiting-room start callback', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    app.currentRoom.aiPlayers = [
      { id: 'ai-1', nickname: 'AI 1', isHost: false, isAI: true },
      { id: 'ai-2', nickname: 'AI 2', isHost: false, isAI: true }
    ];

    waitingRoomFactory.getInstance().opts.onStartGame();

    expect(app.network.startGame).toHaveBeenCalledWith(
      'uno',
      expect.objectContaining({
        aiPlayers: expect.arrayContaining([
          expect.objectContaining({ isAI: true, id: 'ai-1' }),
          expect.objectContaining({ isAI: true, id: 'ai-2' })
        ]),
        gameSettings: {
          initialCards: 7,
          forcePlay: true
        },
        initialState: expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({ id: 'player-host', isHost: true }),
            expect.objectContaining({ isAI: true, id: 'ai-1' }),
            expect.objectContaining({ isAI: true, id: 'ai-2' })
          ]),
          options: {
            initialCards: 7,
            forcePlay: true
          }
        })
      })
    );
  });

  it('blocks host start when room player count is below required number', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 4, true);

    waitingRoomFactory.getInstance().opts.onStartGame();

    expect(app.network.startGame).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('需要 4 名玩家才能开始（当前 1 人）');
  });

  it('updates waiting room state when another player joins', async () => {
    const app = new AppClass();
    app._pendingGameSettings = { forcePlay: false };

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    const waitingRoom = waitingRoomFactory.getInstance();
    const initialSendCalls = app.network.send.mock.calls.length;
    const joinPayload = {
      players: [
        { id: 'player-host', nickname: 'Host', isHost: true },
        { id: 'player-2', nickname: 'Guest', isHost: false }
      ],
      gameSettings: { custom: true },
      nickname: 'Guest'
    };

    app.network.emitMessage('PLAYER_JOINED', joinPayload);

    expect(waitingRoom.updatePlayers).toHaveBeenCalledWith(joinPayload.players);
    expect(app.currentRoom.players).toEqual(joinPayload.players);
    expect(waitingRoom.addSystemMessage).toHaveBeenCalledWith('Guest 加入了房间');
    expect(app.network.send.mock.calls).toHaveLength(initialSendCalls + 1);
    expect(app.network.send).toHaveBeenLastCalledWith(
      'GAME_SETTINGS_UPDATE',
      expect.objectContaining({
        gameSettings: {
          forcePlay: false,
          _gameType: 'uno',
          _maxPlayers: 3
        }
      })
    );
  });

  it('joins an existing room and applies server-provided game settings', async () => {
    const app = new AppClass();
    app.playerId = 'player-guest';
    app._pendingJoinAnalytics = {
      roomId: 'room-1',
      nickname: 'Guest'
    };

    await app._connectAndJoinRoom('ws://localhost:7777', 'room-1', 'Guest');

    const joinPayload = {
      players: [
        { id: 'player-host', nickname: 'Host', isHost: true },
        { id: 'player-guest', nickname: 'Guest', isHost: false }
      ],
      gameSettings: {
        gameType: 'uno',
        initialCards: 11,
        forcePlay: true
      },
      nickname: 'Guest'
    };

    app.network.emitMessage('PLAYER_JOINED', joinPayload);
    expect(app.currentRoom).toEqual(expect.objectContaining({
      gameSettings: joinPayload.gameSettings,
      gameType: 'unknown'
    }));
    expect(app.currentRoom.players).toEqual(joinPayload.players);
    expect(app.currentView).toBe(waitingRoomFactory.getInstance());
    expect(trackEvent).toHaveBeenCalledWith('room_join_succeeded', {
      mode: 'local',
      game_id: 'unknown'
    });

    app.currentRoom.gameSettings = {};
    app.network.emitMessage('PLAYER_JOINED', joinPayload);

    expect(waitingRoomFactory.getInstance().updatePlayers).toHaveBeenCalledWith(joinPayload.players);
    expect(waitingRoomFactory.getInstance().updateGameSettings).toHaveBeenCalledWith(joinPayload.gameSettings);
    expect(app.currentRoom.gameSettings).toEqual(joinPayload.gameSettings);
  });

  it('replays remote actions and triggers AI simulation on host with AI players', async () => {
    vi.useFakeTimers();
    const app = new AppClass();
    app._simulateAITurn = vi.fn();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    app.currentGame = {
      executeMove: vi.fn()
    };
    app._aiPlayers = [{ id: 'ai-1' }];

    app.network.emitMessage('GAME_STATE_UPDATE', {
      lastAction: { playerId: 'player-2', actionType: 'play' }
    });

    expect(app.currentGame.executeMove).toHaveBeenCalledWith({
      playerId: 'player-2',
      actionType: 'play'
    });

    vi.advanceTimersByTime(500);
    expect(app._simulateAITurn).toHaveBeenCalledTimes(1);
  });

  it('updates AI players when server broadcasts ai updates', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    const waitingRoom = waitingRoomFactory.getInstance();
    const aiPlayers = [
      { id: 'ai-1', nickname: 'AI 1', isHost: false, isAI: true }
    ];

    app.network.emitMessage('AI_PLAYER_UPDATE', { aiPlayers });

    expect(app.currentRoom.aiPlayers).toEqual(aiPlayers);
    expect(waitingRoom.updateAIPlayers).toHaveBeenCalledWith(aiPlayers);
  });

  it('updates player list when someone leaves', async () => {
    const app = new AppClass();
    app.currentRoom = {
      id: 'room-1',
      players: [
        { id: 'player-host', nickname: 'Host', isHost: true },
        { id: 'player-2', nickname: 'Player 2', isHost: false }
      ],
      returnToRoomPhase: false
    };
    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    const waitingRoom = waitingRoomFactory.getInstance();

    app.network.emitMessage('PLAYER_LEFT', {
      players: [
        { id: 'player-host', nickname: 'Host', isHost: true }
      ]
    });

    expect(waitingRoom.updatePlayers).toHaveBeenCalledWith([
      { id: 'player-host', nickname: 'Host', isHost: true }
    ]);
    expect(waitingRoom.addSystemMessage).toHaveBeenCalledWith('玩家离开了房间');
    expect(app.currentRoom.players).toEqual([
      { id: 'player-host', nickname: 'Host', isHost: true }
    ]);
  });

  it('returns lobby when disconnect happens and reconnect is not possible', async () => {
    const app = new AppClass();
    app.network = new NetworkClientMock();
    app.currentRoom = {
      id: 'room-1'
    };
    app.currentGame = null;
    const showLobbySpy = vi.fn();
    app.showLobby = showLobbySpy;
    app._setupNetworkHandlers();

    app.network.emitEvent('disconnected', { reason: 'server-close' });

    expect(showNotification).toHaveBeenCalledWith('与服务器断开连接', 'warning');
    expect(app.network.disconnect).not.toHaveBeenCalled();
    expect(app.currentRoom).toBeNull();
    expect(app.currentGame).toBeNull();
    expect(showLobbySpy).toHaveBeenCalled();
  });

  it('handles reconnect rejected signal and offers retry', async () => {
    vi.useFakeTimers();
    const app = new AppClass();
    app._isReconnecting = true;
    app.currentRoom = { id: 'room-1' };
    app.currentGame = {};
    app.network = new NetworkClientMock();

    const confirmMock = vi.fn(() => Promise.resolve(false));
    deps.getModal = vi.fn(() => ({ confirm: confirmMock }));
    AppClass = buildAppClass(deps);
    const nextApp = new AppClass();
    nextApp._isReconnecting = true;
    nextApp.currentRoom = { id: 'room-1' };
    nextApp.currentGame = {};
    nextApp.playerId = app.playerId;
    nextApp.network = new NetworkClientMock();
    nextApp.network.emitMessage = app.network.emitMessage;

    saveSessionData('reconnectContext', {
      mode: 'local',
      roomId: 'room-1',
      playerId: app.playerId,
      serverUrl: 'ws://localhost:7777',
      sessionId: app.sessionId
    });

    nextApp._retryReconnectFromContext({
      mode: 'local',
      roomId: 'room-1',
      playerId: app.playerId,
      serverUrl: 'ws://localhost:7777',
      sessionId: app.sessionId
    });

    vi.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();

    nextApp.network.emitMessage('RECONNECT_REJECTED', {
      message: 'Session expired'
    });
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(showNotification).toHaveBeenCalledWith('重连失败: Session expired', 'error');
    expect(confirmMock).toHaveBeenCalled();
  });

  it('reacts to GAME_STARTED and builds an online game instance', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);

    app.network.emitMessage('GAME_STARTED', {
      gameType: 'uno',
      gameConfig: {
        gameSettings: {
          initialCards: 5,
          forcePlay: true
        }
      },
      initialState: {
        players: [
          { id: 'player-host', isHost: true, nickname: 'Host' },
          { id: 'player-2', isHost: false, nickname: 'Guest' }
        ],
        options: {
          initialCards: 5
        }
      },
      aiPlayers: []
    });

    expect(app._startGameSpy).toHaveBeenCalledWith(
      'uno',
      [
        { id: 'player-host', isHost: true, nickname: 'Host' },
        { id: 'player-2', isHost: false, nickname: 'Guest' }
      ],
      'online',
      { initialCards: 5, forcePlay: true },
      {
        players: [
          { id: 'player-host', isHost: true, nickname: 'Host' },
          { id: 'player-2', isHost: false, nickname: 'Guest' }
        ],
        options: { initialCards: 5 }
      }
    );
    expect(app.currentRoom.gameSettings).toEqual({ initialCards: 5, forcePlay: true });
  });

  it('replays incoming network actions from other players only', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    app.currentGame = {
      executeMove: vi.fn()
    };

    app.network.emitMessage('GAME_STATE_UPDATE', {
      lastAction: { playerId: 'player-2', actionType: 'play' }
    });

    app.network.emitMessage('GAME_STATE_UPDATE', {
      lastAction: { playerId: app.playerId, actionType: 'draw' }
    });

    expect(app.currentGame.executeMove).toHaveBeenCalledTimes(1);
    expect(app.currentGame.executeMove).toHaveBeenCalledWith({
      playerId: 'player-2',
      actionType: 'play'
    });
  });

  it('responds to SNAPSHOT_REQUEST as local host with visible state', () => {
    const app = new AppClass();
    app.mode = 'local';
    app.network = new NetworkClientMock();
    app.currentRoom = {
      id: 'room-1',
      players: [{ id: app.playerId, nickname: 'Host', isHost: true }],
      gameSettings: { mode: 'house' }
    };
    app.currentGame = {
      getVisibleState: vi.fn(() => ({ turn: 3 })),
      getState: vi.fn(() => ({ turn: 999 }))
    };
    app._setupNetworkHandlers();

    app.network.emitMessage('SNAPSHOT_REQUEST', {
      roomId: 'room-1',
      targetPlayerId: 'player-2',
      requestId: 'snap-1'
    });

    expect(app.currentGame.getVisibleState).toHaveBeenCalledWith('player-2');
    expect(app.network.sendSnapshotResponse).toHaveBeenCalledWith('room-1', 'player-2', {
      requestId: 'snap-1',
      gameState: { turn: 3 },
      gameSettings: { mode: 'house' }
    });
  });

  it('persists reconnect context for local mode and excludes server URL for cloud', () => {
    const localApp = new AppClass();
    localApp.mode = 'local';
    localApp.network = new NetworkClientMock();
    localApp.currentRoom = {
      id: 'room-local',
      gameType: 'uno',
      maxPlayers: 4,
      players: [{ id: localApp.playerId, nickname: 'Host', isHost: true }]
    };

    localApp._saveReconnectContext();
    const localCtx = loadSessionData('reconnectContext');
    expect(localCtx).toMatchObject({
      mode: 'local',
      roomId: 'room-local',
      gameType: 'uno',
      serverUrl: 'ws://localhost:7777',
      sessionId: localApp.sessionId
    });

    const cloudApp = new AppClass();
    cloudApp.mode = 'cloud';
    cloudApp.network = new CloudNetworkClientMock();
    cloudApp.currentRoom = {
      id: 'room-cloud',
      gameType: 'uno',
      maxPlayers: 4,
      players: [{ id: cloudApp.playerId, nickname: 'Host', isHost: true }]
    };

    cloudApp._saveReconnectContext();
    const cloudCtx = loadSessionData('reconnectContext');
    expect(cloudCtx).toMatchObject({
      mode: 'cloud',
      roomId: 'room-cloud',
      gameType: 'uno'
    });
    expect(cloudCtx.serverUrl).toBeUndefined();
  });

  it('restores snapshot state after reconnect', () => {
    const app = new AppClass();
    app.currentRoom = {
      id: 'room-1',
      gameType: 'uno',
      maxPlayers: 4,
      gameConfig: app._getGameConfig('uno'),
      players: [{ id: 'player-old', nickname: 'Old' }],
      gameSettings: { old: true }
    };

    app.currentRoom.gameSettings = { old: true };
    const snapshot = {
      players: [
        { id: 'player-host', isHost: true, nickname: 'Host' },
        { id: 'player-2', isHost: false, nickname: 'Guest' }
      ],
      options: {
        forcePlay: false,
        _maxPlayers: 2
      },
      status: 'playing'
    };

    app._handleGameSnapshot({
      gameState: snapshot,
      gameSettings: {
        forcePlay: false,
        _maxPlayers: 2
      }
    });

    expect(app._startGameSpy).toHaveBeenCalledWith(
      'uno',
      snapshot.players,
      'online',
      expect.objectContaining({ forcePlay: false, _maxPlayers: 2 }),
      snapshot
    );
    expect(app.currentRoom.maxPlayers).toBe(2);
  });

  it('sends reconnect request with sessionId in local reconnect flow', async () => {
    vi.useFakeTimers();

    const app = new AppClass();
    app.currentGame = {};
    app.currentRoom = {
      id: 'room-1',
      gameType: 'uno',
      maxPlayers: 4
    };
    app.network = new NetworkClientMock();
    app.mode = 'local';
    app.network.connect = vi.fn(async () => {});
    app.network.requestReconnect = vi.fn(async () => {});

    saveSessionData('reconnectContext', {
      mode: 'local',
      roomId: 'room-1',
      playerId: app.playerId,
      sessionId: 'sess-local',
      serverUrl: 'ws://localhost:7777',
      gameType: 'uno',
      maxPlayers: 4,
      nickname: 'Host'
    });

    app._attemptReconnect();
    vi.advanceTimersByTime(3000);

    await Promise.resolve();
    await Promise.resolve();

    expect(app.network.requestReconnect).toHaveBeenCalledWith('room-1', 'sess-local');
  });

  it('prepares cloud reconnect flow from saved context', async () => {
    vi.useFakeTimers();

    const app = new AppClass();
    const ctx = {
      mode: 'cloud',
      roomId: 'room-cloud',
      playerId: app.playerId,
      gameType: 'uno',
      maxPlayers: 4,
      nickname: 'Host'
    };

    app._retryReconnectFromContext(ctx);

    expect(app.mode).toBe('cloud');
    expect(app.network).toBeInstanceOf(CloudNetworkClientMock);
    expect(app.currentRoom).toEqual(expect.objectContaining({
      id: 'room-cloud',
      gameType: 'uno',
      maxPlayers: 4
    }));

    vi.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(app.network.connect).toHaveBeenCalled();
    expect(showLoading).toHaveBeenCalledWith('连接中，正在恢复对局...');
  });

  it('shows reconnect-failure notification when context is missing', () => {
    const app = new AppClass();
    app.currentGame = {};
    app.currentRoom = { id: 'room-1' };
    app.network = new NetworkClientMock();

    app._attemptReconnect();

    expect(showNotification).toHaveBeenCalledWith('重连失败: 缺少重连上下文', 'error');
  });

  it('forwards chat broadcasts to waiting room', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);

    const messagePayload = {
      playerId: 'player-2',
      nickname: 'Guest',
      message: 'hello'
    };
    app.network.emitMessage('CHAT_MESSAGE_BROADCAST', messagePayload);

    expect(waitingRoomFactory.getInstance().addChatMessage).toHaveBeenCalledWith(messagePayload);
  });

  it('forwards room leave command to lobby and cleans up state', async () => {
    const app = new AppClass();
    const showLobbySpy = vi.fn();
    app.showLobby = showLobbySpy;

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);

    waitingRoomFactory.getInstance().opts.onLeave();

    expect(app._manualDisconnect).toBe(true);
    expect(app.network.leaveRoom).toHaveBeenCalled();
    expect(app.network.disconnect).toHaveBeenCalled();
    expect(app.currentRoom).toBeNull();
    expect(showLobbySpy).toHaveBeenCalled();
  });

  it('forwards local chat to network when waiting-room sends message', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);

    waitingRoomFactory.getInstance().opts.onSendChat('测试消息');

    expect(app.network.sendChat).toHaveBeenCalledWith('测试消息');
  });

  it('adds and removes AI players through waiting-room callbacks', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 4, true);
    const waitingRoom = waitingRoomFactory.getInstance();
    const startSendCount = app.network.send.mock.calls.length;

    waitingRoom.opts.onAddAI();

    expect(waitingRoom.addAIPlayer).toHaveBeenCalled();
    expect(app.currentRoom.aiPlayers).toHaveLength(1);
    expect(app.network.send).toHaveBeenCalledWith(
      'AI_PLAYER_UPDATE',
      expect.objectContaining({
        aiPlayers: app.currentRoom.aiPlayers
      })
    );
    expect(app.network.send.mock.calls.length).toBe(startSendCount + 1);
    expect(waitingRoom.addSystemMessage).toHaveBeenCalledWith('AI 玩家 1 已加入');

    waitingRoom.opts.onRemoveAI();

    expect(waitingRoom.removeLastAIPlayer).toHaveBeenCalled();
    expect(waitingRoom.addSystemMessage).toHaveBeenCalledWith(expect.stringContaining('AI 玩家'));
  });

  it('blocks settings updates while return-to-room phase is incomplete', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    const waitingRoom = waitingRoomFactory.getInstance();
    const sendCountBefore = app.network.send.mock.calls.length;
    app.currentRoom.returnToRoomPhase = true;
    app.currentRoom.allPlayersReturned = false;

    waitingRoom.opts.onSettingsChange({ forcePlay: false });

    expect(app.currentRoom.gameSettings).toEqual({ forcePlay: false });
    expect(showToast).toHaveBeenCalledWith('请等待所有玩家返回房间后再修改设置');
    expect(app.network.send.mock.calls.length).toBe(sendCountBefore);
  });

  it('syncs updated waiting-room settings when in editable state', async () => {
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    const waitingRoom = waitingRoomFactory.getInstance();
    const sendCountBefore = app.network.send.mock.calls.length;
    waitingRoom.opts.onSettingsChange({ forcePlay: false });

    expect(app.currentRoom.gameSettings).toEqual({ forcePlay: false });
    expect(app.network.send.mock.calls.length).toBe(sendCountBefore + 1);
    expect(app.network.send).toHaveBeenLastCalledWith(
      'GAME_SETTINGS_UPDATE',
      {
        gameSettings: {
          forcePlay: false,
          _gameType: 'uno',
          _maxPlayers: 3
        }
      }
    );
  });

  it('handles room destroyed event by returning lobby and clearing room state', async () => {
    const app = new AppClass();
    const showLobbySpy = vi.fn();
    app.showLobby = showLobbySpy;

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);
    app.currentGame = {};

    app.network.emitMessage('ROOM_DESTROYED', { message: '房间已解散' });

    expect(showToast).toHaveBeenCalledWith('房间已解散', 'warning');
    expect(app.currentRoom).toBeNull();
    expect(app.currentGame).toBeNull();
    expect(showLobbySpy).toHaveBeenCalled();
    expect(app.network.disconnect).toHaveBeenCalled();
  });

  it('updates room metadata from game-settings sync when joining with unknown room type', async () => {
    const app = new AppClass();
    app.playerId = 'player-guest';

    await app._connectAndJoinRoom('ws://localhost:7777', 'room-1', 'Guest');
    app.network.emitMessage('GAME_SETTINGS_UPDATE', {
      gameSettings: {
        _gameType: 'uno',
        _maxPlayers: 4,
        forcePlay: true
      }
    });

    expect(app.currentRoom.gameType).toBe('uno');
    expect(app.currentRoom.maxPlayers).toBe(4);
    expect(app.currentRoom.supportsAI).toBe(true);
    expect(app.currentRoom.gameConfig).toEqual(app._getGameConfig('uno'));
    expect(loadSessionData('reconnectContext')?.gameType).toBe('uno');
  });

  it('shows error and keeps offline state when create room connection fails', async () => {
    class FailingNetwork extends NetworkClientMock {
      constructor() {
        super();
        this.connect = vi.fn(async () => {
          throw new Error('connect failed');
        });
      }
    }

    deps.NetworkClient = FailingNetwork;
    AppClass = buildAppClass(deps);
    const app = new AppClass();

    await app._connectAndCreateRoom('ws://localhost:7777', 'room-1', 'Host', 'uno', 3, true);

    expect(showNotification).toHaveBeenCalledWith('连接失败: connect failed', 'error');
    expect(app.currentRoom).toBeNull();
  });

  it('shows error and keeps offline state when join room connection fails', async () => {
    class FailingNetwork extends NetworkClientMock {
      constructor() {
        super();
        this.connect = vi.fn(async () => {
          throw new Error('join failed');
        });
      }
    }

    deps.NetworkClient = FailingNetwork;
    AppClass = buildAppClass(deps);
    const app = new AppClass();

    await app._connectAndJoinRoom('ws://localhost:7777', 'room-1', 'Guest');

    expect(showNotification).toHaveBeenCalledWith('连接失败: join failed', 'error');
    expect(app.currentRoom).toBeNull();
  });
});
