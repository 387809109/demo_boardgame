/**
 * WebSocket Network Client
 * @module game/network
 */

import { EventEmitter } from '../utils/event-emitter.js';

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
  constructor(serverUrl) {
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

    try {
      this.ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('Failed to send message:', err);
      this.emit('error', err);
    }
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
   */
  joinRoom(roomId, nickname, gameType) {
    this.send('JOIN', { roomId, nickname, gameType });
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
   */
  sendGameAction(actionType, actionData) {
    this.send('GAME_ACTION', { actionType, actionData });
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

    // Handle PONG specially for latency calculation
    if (type === 'PONG') {
      this._handlePong(message);
      return;
    }

    // Handle ERROR messages
    if (type === 'ERROR') {
      this._handleError(message);
    }

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

    // Emit event for general listeners
    this.emit('message', message);
    this.emit(`message:${type}`, data, message);
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
}

export default NetworkClient;
