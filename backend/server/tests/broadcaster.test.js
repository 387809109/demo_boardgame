/**
 * Broadcaster Unit Tests
 * T-B100 / T-B101 / T-B102
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Broadcaster } from '../broadcaster.js';
import { ConnectionManager } from '../connection-manager.js';
import { RoomManager } from '../room-manager.js';

function createMockWs() {
  return {
    readyState: 1, // WebSocket.OPEN
    send: jest.fn()
  };
}

describe('Broadcaster', () => {
  let broadcaster;
  let connectionManager;
  let roomManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    roomManager = new RoomManager();
    broadcaster = new Broadcaster(connectionManager, roomManager);
  });

  function setupPlayerInRoom(playerId, nickname, roomId, ws, gameType = 'uno') {
    const connId = connectionManager.addConnection(ws);
    connectionManager.bindPlayer(connId, playerId);
    roomManager.joinRoom(roomId, playerId, nickname, gameType);
    return connId;
  }

  describe('broadcastToRoom', () => {
    it('should broadcast to all players in room', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const ws3 = createMockWs();

      setupPlayerInRoom('player-1', 'Alice', 'room-1', ws1);
      setupPlayerInRoom('player-2', 'Bob', 'room-1', ws2);
      setupPlayerInRoom('player-3', 'Charlie', 'room-2', ws3);

      const message = { type: 'TEST', data: { value: 1 } };
      const recipients = broadcaster.broadcastToRoom('room-1', message);

      expect(recipients).toBe(2);
      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws3.send).not.toHaveBeenCalled();
    });

    it('should support excludePlayerId', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      setupPlayerInRoom('player-1', 'Alice', 'room-1', ws1);
      setupPlayerInRoom('player-2', 'Bob', 'room-1', ws2);

      const message = { type: 'TEST', data: {} };
      const recipients = broadcaster.broadcastToRoom('room-1', message, 'player-1');

      expect(recipients).toBe(1);
      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('broadcastToPlayer', () => {
    it('should send message to target player', () => {
      const ws1 = createMockWs();
      setupPlayerInRoom('player-1', 'Alice', 'room-1', ws1);

      const message = { type: 'PRIVATE', data: { ok: true } };
      const result = broadcaster.broadcastToPlayer('player-1', message);

      expect(result).toBe(true);
      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should return false when player is not connected', () => {
      const result = broadcaster.broadcastToPlayer('missing-player', { type: 'TEST' });
      expect(result).toBe(false);
    });
  });

  describe('broadcastToAll', () => {
    it('should send message to all active connections', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      setupPlayerInRoom('player-1', 'Alice', 'room-1', ws1);
      setupPlayerInRoom('player-2', 'Bob', 'room-2', ws2);

      const message = { type: 'ANNOUNCEMENT', data: { text: 'hi' } };
      const recipients = broadcaster.broadcastToAll(message);

      expect(recipients).toBe(2);
      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('queue draining', () => {
    it('should drain queued messages in batches', async () => {
      broadcaster = new Broadcaster(connectionManager, roomManager, {
        drainBatchSize: 1
      });

      const ws1 = createMockWs();
      const ws2 = createMockWs();
      setupPlayerInRoom('player-1', 'Alice', 'room-1', ws1);
      setupPlayerInRoom('player-2', 'Bob', 'room-1', ws2);

      const message = { type: 'BATCH', data: { value: 1 } };
      broadcaster.broadcastToRoom('room-1', message);

      // First batch is sent immediately; remaining queue is drained next tick.
      await new Promise((resolve) => setImmediate(resolve));

      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(broadcaster.queue).toHaveLength(0);
      expect(broadcaster._draining).toBe(false);
    });
  });
});
