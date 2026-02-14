/**
 * Cloud Network Client — Supabase Realtime
 * @module cloud/cloud-network
 *
 * Implements the same interface as NetworkClient (game/network.js)
 * so that game logic can use either backend transparently.
 */

import { EventEmitter } from '../utils/event-emitter.js';

/** Grace period before a disconnected player is considered gone (ms) */
const CLOUD_RECONNECT_GRACE_MS = 60000;

/** Delay between reconnect attempts (ms) */
const CLOUD_RECONNECT_DELAY_MS = 3000;

/**
 * CloudNetworkClient — uses Supabase Realtime Channels
 * for message relay, Presence for room management.
 */
export class CloudNetworkClient extends EventEmitter {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
   */
  constructor(supabaseClient) {
    super();

    /** @type {import('@supabase/supabase-js').SupabaseClient} */
    this._supabase = supabaseClient;

    /** @type {import('@supabase/supabase-js').RealtimeChannel|null} */
    this._channel = null;

    /** @type {string} */
    this.playerId = '';

    /** @type {boolean} */
    this.connected = false;

    /** @type {number} */
    this.latency = 0;

    /** @type {string|null} */
    this._roomId = null;

    /** @type {string} */
    this._nickname = '';

    /** @type {Map<string, Set<Function>>} */
    this.messageHandlers = new Map();

    /** @type {Array<Object>} */
    this._players = [];

    /** @type {number} */
    this._joinedAt = 0;

    /** @type {Map<string, { nickname: string, timer: number }>} */
    this._disconnectedPlayers = new Map();

    /** @type {boolean} */
    this._gameActive = false;

    /** @type {string} */
    this._gameType = '';

    /** @type {string|null} */
    this._originalHostId = null;
  }

  /**
   * Connect — resolves the authenticated user
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) return;

    const { data: { user }, error } = await this._supabase.auth.getUser();
    if (error || !user) {
      const err = new Error(error?.message || 'Not authenticated');
      this.emit('error', err);
      throw err;
    }

    this.playerId = user.id;
    this.connected = true;
    this.emit('connected');
  }

  /**
   * Join a game room via Supabase Realtime Channel
   * @param {string} roomId
   * @param {string} nickname
   * @param {string} gameType
   */
  joinRoom(roomId, nickname, gameType) {
    if (this._channel) {
      this.leaveRoom();
    }

    this._roomId = roomId;
    this._nickname = nickname;
    this._joinedAt = Date.now();
    this._gameType = gameType;

    this._channel = this._supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } }
    });

    this._setupBroadcastListeners();
    this._setupPresenceListeners();

    this._channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this._channel.track({
          playerId: this.playerId,
          nickname,
          gameType,
          joinedAt: this._joinedAt,
          isHost: false // will be recalculated on sync
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (this._gameActive) {
          this.connected = false;
          this.emit('disconnected', { code: 1006, reason: `Channel ${status}` });
        } else {
          this.emit('error', new Error('Failed to join room channel'));
        }
      }
    });
  }

  /**
   * Leave the current room
   */
  leaveRoom() {
    // Clear all grace timers
    for (const entry of this._disconnectedPlayers.values()) {
      clearTimeout(entry.timer);
    }
    this._disconnectedPlayers.clear();
    this._gameActive = false;

    if (this._channel) {
      this._channel.untrack();
      this._channel.unsubscribe();
      this._channel = null;
    }
    this._roomId = null;
    this._players = [];
  }

  /**
   * Send a message to the room via broadcast
   * @param {string} type - Message type
   * @param {Object} [data={}] - Message data
   */
  send(type, data = {}) {
    if (!this._channel) {
      this.emit('error', new Error('Not in a room'));
      return;
    }

    this._channel.send({
      type: 'broadcast',
      event: type,
      payload: {
        type,
        timestamp: Date.now(),
        playerId: this.playerId,
        data
      }
    });
  }

  /**
   * Register a handler for a specific message type
   * @param {string} messageType
   * @param {Function} handler - (data, fullMessage) => void
   * @returns {Function} Unsubscribe function
   */
  onMessage(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType).add(handler);

    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) handlers.delete(handler);
    };
  }

  /**
   * Start the game (host only)
   * @param {string} gameType
   * @param {Object} gameConfig
   */
  startGame(gameType, gameConfig) {
    this.send('START_GAME', { gameType, gameConfig });
  }

  /**
   * Send a game action
   * @param {string} actionType
   * @param {Object} actionData
   */
  sendGameAction(actionType, actionData) {
    this.send('GAME_ACTION', { actionType, actionData });
  }

  /**
   * Send a chat message
   * @param {string} message
   * @param {boolean} [isPublic=true]
   */
  sendChat(message, isPublic = true) {
    // Dispatch locally so sender sees own message immediately
    this._dispatchMessage('CHAT_MESSAGE_BROADCAST', {
      nickname: this._nickname,
      message,
      isPublic,
      playerId: this.playerId
    });

    this.send('CHAT_MESSAGE', { message, isPublic });
  }

  /**
   * Disconnect from cloud
   */
  disconnect() {
    this.leaveRoom();
    this.connected = false;
    this._originalHostId = null;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Check connection status
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get current latency (not available via Supabase)
   * @returns {number}
   */
  getLatency() {
    return 0;
  }

  /**
   * Get reconnect delay for retry scheduling
   * @returns {number}
   */
  getReconnectDelay() {
    return CLOUD_RECONNECT_DELAY_MS;
  }

  /**
   * Set whether a game is actively in progress
   * @param {boolean} active
   */
  setGameActive(active) {
    this._gameActive = active;
  }

  /**
   * Request reconnection to a room after disconnect
   * @param {string} roomId
   * @returns {Promise<void>}
   */
  async requestReconnect(roomId) {
    this._roomId = roomId;

    this._channel = this._supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } }
    });

    this._setupBroadcastListeners();
    this._setupPresenceListeners();

    let settled = false;
    return new Promise((resolve, reject) => {
      this._channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (settled) return;
          settled = true;
          try {
            await this._channel.track({
              playerId: this.playerId,
              nickname: this._nickname,
              gameType: this._gameType,
              joinedAt: this._joinedAt,
              isHost: false
            });

            // Broadcast reconnect request to the acting host
            this.send('RECONNECT_REQUEST', {
              playerId: this.playerId,
              nickname: this._nickname
            });
            resolve();
          } catch (err) {
            reject(err);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!settled) {
            settled = true;
            reject(new Error(`Channel ${status}`));
          } else if (this._gameActive) {
            // Post-reconnect disconnection — trigger reconnect flow again
            this.connected = false;
            this.emit('disconnected', { code: 1006, reason: `Channel ${status}` });
          }
        }
      });
    });
  }

  /**
   * Notify the room that this player is returning to the waiting room
   */
  returnToRoom() {
    this.send('RETURN_TO_ROOM', {});
  }

  // ── Private: Broadcast ──────────────────────────────────

  /**
   * Set up broadcast message listeners
   * @private
   */
  _setupBroadcastListeners() {
    // Listen for all broadcast events
    const broadcastEvents = [
      'START_GAME', 'GAME_ACTION', 'GAME_STATE_UPDATE',
      'CHAT_MESSAGE', 'AI_PLAYER_UPDATE', 'GAME_SETTINGS_UPDATE',
      'GAME_ENDED',
      'RECONNECT_REQUEST', 'RECONNECT_ACCEPTED', 'RECONNECT_REJECTED',
      'GAME_SNAPSHOT', 'PLAYER_DISCONNECTED', 'PLAYER_RECONNECTED'
    ];

    for (const event of broadcastEvents) {
      this._channel.on('broadcast', { event }, ({ payload }) => {
        this._handleBroadcast(event, payload);
      });
    }
  }

  /**
   * Handle an incoming broadcast message
   * @private
   * @param {string} event
   * @param {Object} payload
   */
  _handleBroadcast(event, payload) {
    if (!payload) return;

    const { type, data, playerId } = payload;

    // GAME_ACTION from self: skip (already applied locally)
    if (type === 'GAME_ACTION' && playerId === this.playerId) return;

    // CHAT_MESSAGE from self: skip (already dispatched locally in sendChat)
    if (type === 'CHAT_MESSAGE' && playerId === this.playerId) return;

    // START_GAME: dispatch as GAME_STARTED (match protocol)
    if (type === 'START_GAME') {
      const gameConfig = data.gameConfig || {};
      this._dispatchMessage('GAME_STARTED', {
        gameType: data.gameType || gameConfig.gameType,
        initialState: gameConfig.initialState,
        aiPlayers: gameConfig.aiPlayers,
        gameSettings: gameConfig.gameSettings,
        ...data
      });
      return;
    }

    // GAME_ACTION from others: dispatch as GAME_STATE_UPDATE
    if (type === 'GAME_ACTION') {
      this._dispatchMessage('GAME_STATE_UPDATE', {
        lastAction: {
          playerId,
          actionType: data.actionType,
          actionData: data.actionData,
          ...(data.playerId ? { playerId: data.playerId } : {})
        }
      });
      return;
    }

    // CHAT_MESSAGE from others: dispatch as CHAT_MESSAGE_BROADCAST
    if (type === 'CHAT_MESSAGE') {
      // Look up sender nickname from player list
      const sender = this._players.find(p => p.id === playerId);
      this._dispatchMessage('CHAT_MESSAGE_BROADCAST', {
        nickname: sender?.nickname || 'Unknown',
        message: data.message,
        isPublic: data.isPublic !== false,
        playerId
      });
      return;
    }

    // RECONNECT_REQUEST: only acting host processes
    if (type === 'RECONNECT_REQUEST') {
      if (playerId !== this.playerId && this._isActingHost()) {
        this._handleReconnectRequest(payload);
      }
      return;
    }

    // Targeted reconnect messages: only intended recipient processes
    if (type === 'RECONNECT_ACCEPTED' || type === 'RECONNECT_REJECTED' || type === 'GAME_SNAPSHOT') {
      if (data?.targetPlayerId !== this.playerId) return;
      this._dispatchMessage(type, data);
      return;
    }

    // PLAYER_DISCONNECTED / PLAYER_RECONNECTED: dispatch as-is
    if (type === 'PLAYER_DISCONNECTED' || type === 'PLAYER_RECONNECTED') {
      this._dispatchMessage(type, data);
      return;
    }

    // All other messages: dispatch as-is
    this._dispatchMessage(type, data);
  }

  // ── Private: Presence ───────────────────────────────────

  /**
   * Set up presence listeners for room management
   * @private
   */
  _setupPresenceListeners() {
    this._channel.on('presence', { event: 'sync' }, () => {
      this._handlePresenceSync();
    });

    this._channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      const joined = newPresences?.[0];
      if (!joined) return;

      const joinedId = joined.playerId;

      // During active game, never dispatch PLAYER_JOINED —
      // reconnections are handled entirely by the RECONNECT_REQUEST protocol.
      // Only clear the grace timer (don't delete the entry so
      // _handleReconnectRequest can still find and verify it).
      if (this._gameActive) {
        const entry = this._disconnectedPlayers.get(joinedId);
        if (entry) {
          clearTimeout(entry.timer);
        }
        return;
      }

      const players = this._getPlayerList();
      this._dispatchMessage('PLAYER_JOINED', {
        nickname: joined.nickname || '',
        playerCount: players.length,
        players,
        aiPlayers: [],
        gameSettings: {}
      });
    });

    this._channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const left = leftPresences?.[0];
      if (!left) return;

      const leftPlayerId = left.playerId;
      const players = this._getPlayerList();

      // During an active game, use grace period before declaring the player gone
      if (this._gameActive && leftPlayerId !== this.playerId) {
        const nickname = left.nickname || leftPlayerId.slice(0, 8);
        const isOriginalHost = leftPlayerId === this._originalHostId;

        const timer = setTimeout(() => {
          this._disconnectedPlayers.delete(leftPlayerId);
          if (isOriginalHost) {
            this._dispatchMessage('ROOM_DESTROYED', {
              message: '房主断线超时，房间已解散'
            });
          } else {
            this._dispatchMessage('PLAYER_LEFT', {
              reason: 'timeout',
              playerCount: this._getPlayerList().length,
              players: this._getPlayerList()
            });
          }
        }, CLOUD_RECONNECT_GRACE_MS);

        this._disconnectedPlayers.set(leftPlayerId, { nickname, timer });
        this._dispatchMessage('PLAYER_DISCONNECTED', {
          playerId: leftPlayerId,
          nickname,
          reconnectWindowMs: CLOUD_RECONNECT_GRACE_MS
        });
        return;
      }

      // Not in active game — immediate leave / destroy
      const wasHost = this._isHostPlayer(left);
      if (wasHost && leftPlayerId !== this.playerId) {
        this._dispatchMessage('ROOM_DESTROYED', {
          message: '房主已离开，房间已解散'
        });
        return;
      }

      this._dispatchMessage('PLAYER_LEFT', {
        reason: 'disconnected',
        playerCount: players.length,
        players
      });
    });
  }

  /**
   * Handle presence sync — rebuild player list
   * @private
   */
  _handlePresenceSync() {
    this._players = this._getPlayerList();
    // Track the original host (first sync only)
    if (!this._originalHostId && this._players.length > 0) {
      this._originalHostId = this._players[0].id;
    }
  }

  /**
   * Build player list from presence state
   * @private
   * @returns {Array<{ id: string, nickname: string, isHost: boolean }>}
   */
  _getPlayerList() {
    if (!this._channel) return [];

    const state = this._channel.presenceState();
    const presences = [];

    // presenceState() returns { key: [presence, ...], ... }
    for (const key of Object.keys(state)) {
      const entries = state[key];
      if (entries?.length > 0) {
        presences.push(entries[0]);
      }
    }

    // Sort by joinedAt to determine host (earliest = host)
    presences.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    return presences.map((p, i) => ({
      id: p.playerId,
      nickname: p.nickname || '',
      isHost: i === 0
    }));
  }

  /**
   * Check if a presence entry represents the host
   * @private
   * @param {Object} presence
   * @returns {boolean}
   */
  _isHostPlayer(presence) {
    const players = this._getPlayerList();
    if (players.length === 0) return false;
    // The host was the first joiner; if they left,
    // they'd have the earliest joinedAt among all who were present
    return presence.playerId === players[0]?.id;
  }

  // ── Private: Reconnect Helpers ─────────────────────────

  /**
   * Whether this client is the acting host (earliest joinedAt among present members)
   * @private
   * @returns {boolean}
   */
  _isActingHost() {
    const players = this._getPlayerList();
    return players.length > 0 && players[0].id === this.playerId;
  }

  /**
   * Handle a reconnect request from a disconnected player (acting host only)
   * @private
   * @param {Object} payload - Full broadcast payload
   */
  _handleReconnectRequest(payload) {
    const requestingId = payload.data?.playerId || payload.playerId;
    if (!requestingId) return;

    // Verify the player was previously disconnected
    if (!this._disconnectedPlayers.has(requestingId)) {
      this.send('RECONNECT_REJECTED', {
        targetPlayerId: requestingId,
        reasonCode: 'NOT_IN_ROOM'
      });
      return;
    }

    // Clear grace timer
    const entry = this._disconnectedPlayers.get(requestingId);
    clearTimeout(entry.timer);
    this._disconnectedPlayers.delete(requestingId);

    // Accept the reconnection
    this.send('RECONNECT_ACCEPTED', {
      targetPlayerId: requestingId
    });

    // Dispatch RECONNECT_REQUEST to app layer so it can generate and send GAME_SNAPSHOT
    this._dispatchMessage('RECONNECT_REQUEST', {
      playerId: requestingId,
      nickname: entry.nickname
    });

    // Notify all clients that the player reconnected
    const players = this._getPlayerList();
    this.send('PLAYER_RECONNECTED', {
      playerId: requestingId,
      players
    });
  }

  // ── Private: Message Dispatch ───────────────────────────

  /**
   * Dispatch a message to registered handlers and event listeners
   * @private
   * @param {string} type
   * @param {Object} data
   */
  _dispatchMessage(type, data) {
    const message = {
      type,
      timestamp: Date.now(),
      playerId: 'cloud',
      data
    };

    // Call registered handlers
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data, message);
        } catch (err) {
          console.error(`Handler error for ${type}:`, err);
        }
      });
    }

    // Emit events
    this.emit('message', message);
    this.emit(`message:${type}`, data, message);
  }
}

export default CloudNetworkClient;
