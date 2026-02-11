/**
 * ConnectionManager - Manages WebSocket connections and player bindings
 *
 * Data structures:
 * - connections: Map<connectionId, { ws, playerId, sessionId, connectedAt, lastActivity }>
 * - playerConnections: Map<playerId, connectionId>
 */

import { debug, info, warn } from './utils/logger.js';

export class ConnectionManager {
  constructor() {
    /** @type {Map<string, { ws: WebSocket, playerId: string|null, connectedAt: number }>} */
    this.connections = new Map();

    /** @type {Map<string, string>} playerId -> connectionId */
    this.playerConnections = new Map();

    this.connectionCounter = 0;
  }

  /**
   * Generate a unique connection ID
   * @returns {string} Connection ID
   */
  generateConnectionId() {
    return `conn-${Date.now()}-${++this.connectionCounter}`;
  }

  /**
   * Add a new connection
   * @param {WebSocket} ws - WebSocket instance
   * @returns {string} Connection ID
   */
  addConnection(ws) {
    const connId = this.generateConnectionId();
    const now = Date.now();
    this.connections.set(connId, {
      ws,
      playerId: null,
      sessionId: null,
      connectedAt: now,
      lastActivity: now
    });
    debug('Connection added', { connId });
    return connId;
  }

  /**
   * Update last activity time for a connection
   * @param {string} connId - Connection ID
   */
  updateActivity(connId) {
    const conn = this.connections.get(connId);
    if (conn) {
      conn.lastActivity = Date.now();
    }
  }

  /**
   * Get connections that have timed out
   * @param {number} timeout - Timeout in milliseconds
   * @returns {string[]} Array of connection IDs that have timed out
   */
  getTimedOutConnections(timeout) {
    const now = Date.now();
    const timedOut = [];

    for (const [connId, conn] of this.connections) {
      if (now - conn.lastActivity > timeout) {
        timedOut.push(connId);
      }
    }

    return timedOut;
  }

  /**
   * Remove a connection
   * @param {string} connId - Connection ID
   * @returns {string|null} Player ID if was bound
   */
  removeConnection(connId) {
    const conn = this.connections.get(connId);
    if (!conn) {
      warn('Connection not found for removal', { connId });
      return null;
    }

    const playerId = conn.playerId;

    // Remove player binding if exists
    if (playerId) {
      this.playerConnections.delete(playerId);
    }

    this.connections.delete(connId);
    info('Connection removed', { connId, playerId });
    return playerId;
  }

  /**
   * Bind a player to a connection
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @returns {boolean} Success
   */
  bindPlayer(connId, playerId) {
    const conn = this.connections.get(connId);
    if (!conn) {
      warn('Connection not found for player binding', { connId, playerId });
      return false;
    }

    // Check if player is already connected
    const existingConnId = this.playerConnections.get(playerId);
    if (existingConnId && existingConnId !== connId) {
      warn('Player already connected on different connection', { playerId, existingConnId });
      // Remove old binding
      const oldConn = this.connections.get(existingConnId);
      if (oldConn) {
        oldConn.playerId = null;
      }
    }

    conn.playerId = playerId;
    this.playerConnections.set(playerId, connId);
    debug('Player bound to connection', { connId, playerId });
    return true;
  }

  /**
   * Get WebSocket by player ID
   * @param {string} playerId - Player ID
   * @returns {WebSocket|null} WebSocket instance
   */
  getConnection(playerId) {
    const connId = this.playerConnections.get(playerId);
    if (!connId) {
      return null;
    }
    const conn = this.connections.get(connId);
    return conn ? conn.ws : null;
  }

  /**
   * Get WebSocket by connection ID
   * @param {string} connId - Connection ID
   * @returns {WebSocket|null} WebSocket instance
   */
  getWebSocket(connId) {
    const conn = this.connections.get(connId);
    return conn ? conn.ws : null;
  }

  /**
   * Get player ID by connection ID
   * @param {string} connId - Connection ID
   * @returns {string|null} Player ID
   */
  getPlayerId(connId) {
    const conn = this.connections.get(connId);
    return conn ? conn.playerId : null;
  }

  /**
   * Set session ID for a connection
   * @param {string} connId - Connection ID
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success
   */
  setSessionId(connId, sessionId) {
    const conn = this.connections.get(connId);
    if (!conn) {
      return false;
    }

    conn.sessionId = sessionId;
    return true;
  }

  /**
   * Get session ID by connection ID
   * @param {string} connId - Connection ID
   * @returns {string|null} Session ID
   */
  getSessionId(connId) {
    const conn = this.connections.get(connId);
    return conn ? conn.sessionId : null;
  }

  /**
   * Get active connection count
   * @returns {number} Number of active connections
   */
  getActiveConnections() {
    return this.connections.size;
  }

  /**
   * Get bound player count
   * @returns {number} Number of bound players
   */
  getBoundPlayers() {
    return this.playerConnections.size;
  }
}

export default ConnectionManager;
