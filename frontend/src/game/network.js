/**
 * WebSocket Network Client
 * @module game/network
 */

import { EventEmitter } from '../utils/event-emitter.js';
import {
  createBatchEnvelope,
  compressText,
  resolveBatchPayload,
  NETWORK_BATCH_INTERVAL_MS,
  NETWORK_BATCH_MAX_MESSAGES,
  NETWORK_BATCH_MESSAGE_TYPE,
  DEFAULT_BATCH_TYPES
} from '../utils/network-optimizer.js';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10000;  // 10 seconds to wait for pong
const RECONNECT_DELAY = 3000;     // 3 seconds before reconnect attempt

/**
 * WebSocket Network Client for game communication
 */
export class NetworkClient extends EventEmitter {
  /**
   * @param {string} serverUrl - WebSocket server URL (e.g., ws://192.168.1.100:7777)
   */
  constructor(serverUrl, options = {}) {
    super();

    /** @type {string} */
    this.serverUrl = serverUrl;

    /** @type {WebSocket|null} */
    this.ws = null;

    /** @type {string} */
    this.playerId = this._generatePlayerId();

    /** @type {Map<string, Function>} */
    this.messageHandlers = new Map();

    /** @type {boolean} */
    this.connected = false;

    /** @type {number|null} */
    this._heartbeatInterval = null;

    /** @type {number|null} */
    this._heartbeatTimeout = null;

    /** @type {number} */
    this.latency = 0;

    /** @type {number} */
    this._lastPingTime = 0;

    /** @type {number|null} */
    this._batchFlushTimer = null;

    /** @type {Array<Object>} */
    this._batchQueue = [];

    /** @type {boolean} */
    this._optimizeBatching = options.enableBatching === true;

    /** @type {Set<string>} */
    this._batchMessageTypes = new Set(
      options.batchMessageTypes || Array.from(DEFAULT_BATCH_TYPES)
    );

    /** @type {number} */
    this._batchIntervalMs = Number.isFinite(options.batchIntervalMs) && options.batchIntervalMs > 0
      ? options.batchIntervalMs
      : NETWORK_BATCH_INTERVAL_MS;

    /** @type {number} */
    this._batchMaxMessages = Number.isFinite(options.batchMaxMessages) && options.batchMaxMessages > 0
      ? options.batchMaxMessages
      : NETWORK_BATCH_MAX_MESSAGES;
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to game server');
          this.connected = true;
          this._startHeartbeat();
          this.emit('connected');
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('Disconnected from server', event.code, event.reason);
          this.connected = false;
          this._clearBatchQueue();
          this._stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
        };

        this.ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send a message to the server
   * @param {string} type - Message type
   * @param {Object} [data={}] - Message data
   */
  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: not connected');
      this.emit('error', new Error('Not connected to server'));
      return;
    }

    const message = {
      type,
      timestamp: Date.now(),
      playerId: this.playerId,
      data
    };

    if (this._shouldBatchMessage(type)) {
      this._enqueueBatchMessage(message);
      return;
    }

    this._sendRawMessage(message);
  }

  /**
   * Register a handler for a specific message type
   * @param {string} messageType - Message type to handle
   * @param {Function} handler - Handler function (data, fullMessage) => void
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
   * Disconnect from the server
   */
  disconnect() {
    this._stopHeartbeat();
    this._clearBatchQueue();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connected = false;
  }

  /**
   * Join a game room
   * @param {string} roomId - Room ID
   * @param {string} nickname - Player nickname
   * @param {string} gameType - Game type
   * @param {string|null} [sessionId=null] - Reconnect session ID
   */
  joinRoom(roomId, nickname, gameType, sessionId = null) {
    const payload = { roomId, nickname, gameType };
    if (sessionId) {
      payload.sessionId = sessionId;
    }
    this.send('JOIN', payload);
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    this.send('LEAVE', {});
  }

  /**
   * Start the game (host only)
   * @param {string} gameType - Game type
   * @param {Object} gameConfig - Game configuration
   */
  startGame(gameType, gameConfig) {
    this.send('START_GAME', { gameType, gameConfig });
  }

  /**
   * Send a game action
   * @param {string} actionType - Action type
   * @param {Object} actionData - Action data
   * @param {Object} [extraData={}] - Extra fields (e.g., playerId)
   */
  sendGameAction(actionType, actionData, extraData = {}) {
    this.send('GAME_ACTION', { actionType, actionData, ...extraData });
  }

  /**
   * Send a chat message
   * @param {string} message - Chat message
   * @param {boolean} [isPublic=true] - Whether message is public
   */
  sendChat(message, isPublic = true) {
    this.send('CHAT_MESSAGE', { message, isPublic });
  }

  /**
   * Request reconnect to an existing room session
   * @param {string} roomId - Room ID
   * @param {string} sessionId - Session ID
   */
  requestReconnect(roomId, sessionId) {
    this.send('RECONNECT_REQUEST', { roomId, sessionId });
  }

  /**
   * Respond to a snapshot request from server host authority.
   * @param {string} roomId - Room ID
   * @param {string} targetPlayerId - Reconnecting player ID
   * @param {Object} payload - Snapshot payload
   * @param {string} [payload.requestId] - Snapshot request ID
   * @param {Object} payload.gameState - Visibility-safe game state
   * @param {Object} [payload.gameSettings] - Effective game settings
   */
  sendSnapshotResponse(roomId, targetPlayerId, payload = {}) {
    this.send('SNAPSHOT_RESPONSE', {
      roomId,
      targetPlayerId,
      ...payload
    });
  }

  /**
   * Notify server that player has returned to waiting room after result screen
   */
  returnToRoom() {
    this.send('RETURN_TO_ROOM', {});
  }

  /**
   * Handle incoming message
   * @private
   */
  _handleMessage(rawData) {
    let message;

    try {
      message = JSON.parse(rawData);
    } catch (err) {
      console.error('Failed to parse message:', err);
      return;
    }

    const { type, data } = message;

    if (type === NETWORK_BATCH_MESSAGE_TYPE) {
      void this._handleBatchedMessage(data);
      return;
    }

    // Handle PONG specially for latency calculation
    if (type === 'PONG') {
      this._handlePong(message);
      return;
    }

    this._dispatchMessage(message);
  }

  /**
   * Decode and dispatch NETWORK_BATCH messages
   * @param {Object} data
   * @returns {Promise<void>}
   * @private
   */
  async _handleBatchedMessage(data) {
    const messages = await resolveBatchPayload(data);
    if (!Array.isArray(messages)) {
      return;
    }

    for (const message of messages) {
      if (!message || typeof message !== 'object') {
        continue;
      }

      this._dispatchMessage(message);
    }
  }

  /**
   * Determine whether a message type should be batched.
   * @param {string} type
   * @returns {boolean}
   * @private
   */
  _shouldBatchMessage(type) {
    return !!(
      this._optimizeBatching
      && this._batchMessageTypes.has(type)
      && typeof type === 'string'
    );
  }

  /**
   * Add message to batch queue and schedule flush.
   * @param {Object} message
   * @private
   */
  _enqueueBatchMessage(message) {
    this._batchQueue.push(message);

    if (this._batchQueue.length >= this._batchMaxMessages) {
      void this._flushBatch();
      return;
    }

    if (!this._batchFlushTimer) {
      this._batchFlushTimer = setTimeout(() => {
        void this._flushBatch();
      }, this._batchIntervalMs);
    }
  }

  /**
   * Flush queued batch messages with optional compression.
   * @returns {Promise<void>}
   * @private
   */
  async _flushBatch() {
    if (!this._batchQueue.length) {
      this._clearBatchTimer();
      return;
    }

    const messages = this._batchQueue.splice(0, this._batchQueue.length);
    const envelope = createBatchEnvelope(messages);
    let payload = envelope;

    try {
      const rawEnvelope = JSON.stringify(envelope);
      const compressed = await compressText(rawEnvelope);
      if (compressed) {
        payload = {
          ...envelope,
          data: {
            messageCount: envelope.data.messageCount,
            compressed: true,
            encoding: compressed.encoding,
            payload: compressed.payload,
            originalLength: compressed.originalLength
          }
        };
      }
      this._sendRawMessage(payload);
    } catch (err) {
      console.error('Failed to flush batch:', err);
      this._sendRawMessage(envelope);
    } finally {
      this._clearBatchTimer();
    }
  }

  /**
   * Send one message through websocket.
   * @param {Object} message
   * @private
   */
  _sendRawMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: not connected');
      this.emit('error', new Error('Not connected to server'));
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('Failed to send message:', err);
      this.emit('error', err);
    }
  }

  /**
   * Dispatch message to handlers and general events.
   * @param {Object} message
   * @private
   */
  _dispatchMessage(message) {
    const { type, data } = message;

    // Handle PONG specially for latency calculation
    if (type === 'PONG') {
      this._handlePong(message);
      return;
    }

    // Handle ERROR messages
    if (type === 'ERROR') {
      this._handleError(message);
    }

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

    this.emit('message', message);
    this.emit(`message:${type}`, data, message);
  }

  /**
   * Clear batch timers and queued messages.
   * @private
   */
  _clearBatchQueue() {
    this._clearBatchTimer();
    this._batchQueue = [];
  }

  /**
   * Clear current batch timer.
   * @private
   */
  _clearBatchTimer() {
    if (this._batchFlushTimer) {
      clearTimeout(this._batchFlushTimer);
      this._batchFlushTimer = null;
    }
  }

  /**
   * Handle PONG message
   * @private
   */
  _handlePong(message) {
    if (this._heartbeatTimeout) {
      clearTimeout(this._heartbeatTimeout);
      this._heartbeatTimeout = null;
    }

    this.latency = Date.now() - this._lastPingTime;
    this.emit('latency', this.latency);
  }

  /**
   * Handle ERROR message
   * @private
   */
  _handleError(message) {
    const { code, message: errorMsg, severity } = message.data;

    console.error(`[${code}] ${errorMsg} (${severity})`);
    this.emit('serverError', message.data);

    // Disconnect on fatal errors
    if (severity === 'fatal') {
      this.disconnect();
    }
  }

  /**
   * Start heartbeat mechanism
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();

    this._heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this._lastPingTime = Date.now();
        this.send('PING', {});

        // Set timeout for PONG response
        this._heartbeatTimeout = setTimeout(() => {
          console.warn('Heartbeat timeout, connection may be dead');
          this.emit('timeout');
          this.disconnect();
        }, HEARTBEAT_TIMEOUT);
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat mechanism
   * @private
   */
  _stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }

    if (this._heartbeatTimeout) {
      clearTimeout(this._heartbeatTimeout);
      this._heartbeatTimeout = null;
    }
  }

  /**
   * Generate a unique player ID
   * @private
   * @returns {string}
   */
  _generatePlayerId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `player-${timestamp}-${random}`;
  }

  /**
   * Get connection status
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current latency
   * @returns {number}
   */
  getLatency() {
    return this.latency;
  }

  /**
   * Update server URL
   * @param {string} url - New server URL
   */
  setServerUrl(url) {
    if (this.connected) {
      throw new Error('Cannot change URL while connected');
    }
    this.serverUrl = url;
  }

  /**
   * Get reconnect delay used by UI retry flow
   * @returns {number}
   */
  getReconnectDelay() {
    return RECONNECT_DELAY;
  }
}

export default NetworkClient;
