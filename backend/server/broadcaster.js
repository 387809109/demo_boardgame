/**
 * Broadcaster - queued WebSocket delivery helpers.
 *
 * Supports:
 * - Room-scoped broadcast with optional sender exclusion
 * - Single-player broadcast
 * - Global broadcast
 * - Bounded queue draining to reduce long blocking send loops
 */

import { debug, error } from './utils/logger.js';

const DEFAULT_DRAIN_BATCH_SIZE = 128;

export class Broadcaster {
  /**
   * @param {import('./connection-manager.js').ConnectionManager} connectionManager
   * @param {import('./room-manager.js').RoomManager} roomManager
   * @param {{ drainBatchSize?: number }} [options]
   */
  constructor(connectionManager, roomManager, options = {}) {
    this.connectionManager = connectionManager;
    this.roomManager = roomManager;

    /** @type {Array<{ ws: WebSocket, messageStr: string, meta: object }>} */
    this.queue = [];

    /** @type {boolean} */
    this._draining = false;

    /** @type {number} */
    this.drainBatchSize = Number.isFinite(options.drainBatchSize) && options.drainBatchSize > 0
      ? options.drainBatchSize
      : DEFAULT_DRAIN_BATCH_SIZE;
  }

  /**
   * Broadcast message to all players in a room.
   * @param {string} roomId
   * @param {object} message
   * @param {string|null} [excludePlayerId]
   * @returns {number} Enqueued recipient count
   */
  broadcastToRoom(roomId, message, excludePlayerId = null) {
    const players = this.roomManager.getPlayers(roomId);
    if (!players.length) {
      return 0;
    }

    const messageStr = JSON.stringify(message);
    let recipients = 0;

    for (const player of players) {
      if (excludePlayerId && player.id === excludePlayerId) {
        continue;
      }

      const ws = this.connectionManager.getConnection(player.id);
      if (!ws || ws.readyState !== 1) {
        continue;
      }

      recipients += this._enqueue(ws, messageStr, {
        scope: 'room',
        roomId,
        playerId: player.id
      });
    }

    return recipients;
  }

  /**
   * Broadcast message to one player.
   * @param {string} playerId
   * @param {object} message
   * @returns {boolean}
   */
  broadcastToPlayer(playerId, message) {
    const ws = this.connectionManager.getConnection(playerId);
    if (!ws || ws.readyState !== 1) {
      return false;
    }

    const messageStr = JSON.stringify(message);
    this._enqueue(ws, messageStr, { scope: 'player', playerId });
    return true;
  }

  /**
   * Broadcast message to all active connections.
   * @param {object} message
   * @returns {number} Enqueued recipient count
   */
  broadcastToAll(message) {
    const messageStr = JSON.stringify(message);
    let recipients = 0;

    for (const [connId, conn] of this.connectionManager.connections) {
      if (!conn?.ws || conn.ws.readyState !== 1) {
        continue;
      }

      recipients += this._enqueue(conn.ws, messageStr, {
        scope: 'all',
        connId,
        playerId: conn.playerId || null
      });
    }

    return recipients;
  }

  /**
   * Queue a send job and trigger drain.
   * @param {WebSocket} ws
   * @param {string} messageStr
   * @param {object} meta
   * @returns {number}
   * @private
   */
  _enqueue(ws, messageStr, meta) {
    this.queue.push({ ws, messageStr, meta });
    if (!this._draining) {
      this._drainQueue();
    }
    return 1;
  }

  /**
   * Drain queued send jobs in bounded batches.
   * @private
   */
  _drainQueue() {
    this._draining = true;

    let sent = 0;
    while (this.queue.length > 0 && sent < this.drainBatchSize) {
      const job = this.queue.shift();
      if (!job?.ws || job.ws.readyState !== 1) {
        continue;
      }

      try {
        job.ws.send(job.messageStr);
      } catch (err) {
        error('Failed to broadcast message', {
          ...job.meta,
          error: err.message
        });
      }
      sent += 1;
    }

    if (this.queue.length > 0) {
      setImmediate(() => this._drainQueue());
      return;
    }

    debug('Broadcast queue drained', { sent });
    this._draining = false;
  }
}

export default Broadcaster;
