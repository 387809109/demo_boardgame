/**
 * Broadcaster - Handles room broadcasts with optional batching
 */

import { error } from './utils/logger.js';

export class Broadcaster {
  /**
   * @param {import('./room-manager.js').RoomManager} roomManager
   * @param {import('./connection-manager.js').ConnectionManager} connectionManager
   * @param {{ queueDelayMs?: number, metrics?: import('./metrics.js').Metrics }} options
   */
  constructor(roomManager, connectionManager, options = {}) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;
    this.queueDelayMs = options.queueDelayMs ?? 0;
    this.metrics = options.metrics || null;

    /** @type {Map<string, { messages: Array<{ messageStr: string, excludePlayerId: string|null }>, scheduled: boolean }>} */
    this.queues = new Map();
  }

  /**
   * Broadcast a message to a room, optionally excluding a player
   * @param {string} roomId
   * @param {object} message
   * @param {string|null} [excludePlayerId]
   */
  broadcast(roomId, message, excludePlayerId = null) {
    this.metrics?.inc('broadcasts', 1);
    const entry = {
      messageStr: JSON.stringify(message),
      excludePlayerId
    };

    let queue = this.queues.get(roomId);
    if (!queue) {
      queue = { messages: [], scheduled: false };
      this.queues.set(roomId, queue);
    }

    queue.messages.push(entry);

    if (this.queueDelayMs === 0) {
      this.flush(roomId);
      return;
    }

    if (!queue.scheduled) {
      queue.scheduled = true;
      setTimeout(() => this.flush(roomId), this.queueDelayMs);
    }
  }

  /**
   * Flush queued messages for a room
   * @param {string} roomId
   */
  flush(roomId) {
    const queue = this.queues.get(roomId);
    if (!queue || queue.messages.length === 0) {
      if (queue) queue.scheduled = false;
      return;
    }

    queue.scheduled = false;
    const messages = queue.messages;
    queue.messages = [];

    const players = this.roomManager.getPlayers(roomId);
    if (players.length === 0) return;

    for (const player of players) {
      const ws = this.connectionManager.getConnection(player.id);
      if (!ws || ws.readyState !== 1) {
        continue;
      }

      for (const entry of messages) {
        if (entry.excludePlayerId && entry.excludePlayerId === player.id) {
          continue;
        }

        try {
          ws.send(entry.messageStr);
          this.metrics?.inc('messagesSent', 1);
        } catch (err) {
          error('Failed to send message to player', { playerId: player.id, error: err.message });
        }
      }
    }
  }
}

export default Broadcaster;
