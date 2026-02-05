/**
 * Cloud Network Client — Supabase Realtime
 * @module cloud/cloud-network
 *
 * Implements the same interface as NetworkClient (game/network.js)
 * so that game logic can use either backend transparently.
 */

import { EventEmitter } from '../utils/event-emitter.js';

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
      } else if (status === 'CHANNEL_ERROR') {
        this.emit('error', new Error('Failed to join room channel'));
      }
    });
  }

  /**
   * Leave the current room
   */
  leaveRoom() {
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
      'GAME_ENDED'
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
      if (joined) {
        const players = this._getPlayerList();
        this._dispatchMessage('PLAYER_JOINED', {
          nickname: joined.nickname || '',
          playerCount: players.length,
          players,
          aiPlayers: [],
          gameSettings: {}
        });
      }
    });

    this._channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const left = leftPresences?.[0];
      if (!left) return;

      const players = this._getPlayerList();

      // If the host left, destroy the room
      const wasHost = this._isHostPlayer(left);
      if (wasHost && left.playerId !== this.playerId) {
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
