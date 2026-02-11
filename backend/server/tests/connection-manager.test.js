/**
 * ConnectionManager Unit Tests
 * T-B021
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ConnectionManager } from '../connection-manager.js';

describe('ConnectionManager', () => {
  let manager;
  let mockWs;

  beforeEach(() => {
    manager = new ConnectionManager();
    mockWs = {
      readyState: 1,
      send: jest.fn(),
      close: jest.fn()
    };
  });

  describe('addConnection', () => {
    it('should add a new connection and return connection ID', () => {
      const connId = manager.addConnection(mockWs);

      expect(connId).toBeDefined();
      expect(connId).toMatch(/^conn-\d+-\d+$/);
      expect(manager.getActiveConnections()).toBe(1);
    });

    it('should generate unique connection IDs', () => {
      const connId1 = manager.addConnection(mockWs);
      const connId2 = manager.addConnection({ ...mockWs });

      expect(connId1).not.toBe(connId2);
      expect(manager.getActiveConnections()).toBe(2);
    });

    it('should store connection with null playerId initially', () => {
      const connId = manager.addConnection(mockWs);
      const playerId = manager.getPlayerId(connId);

      expect(playerId).toBeNull();
    });
  });

  describe('removeConnection', () => {
    it('should remove an existing connection', () => {
      const connId = manager.addConnection(mockWs);
      expect(manager.getActiveConnections()).toBe(1);

      const playerId = manager.removeConnection(connId);

      expect(playerId).toBeNull();
      expect(manager.getActiveConnections()).toBe(0);
    });

    it('should return playerId if connection was bound', () => {
      const connId = manager.addConnection(mockWs);
      manager.bindPlayer(connId, 'player-1');

      const playerId = manager.removeConnection(connId);

      expect(playerId).toBe('player-1');
      expect(manager.getBoundPlayers()).toBe(0);
    });

    it('should return null for non-existent connection', () => {
      const playerId = manager.removeConnection('non-existent');

      expect(playerId).toBeNull();
    });

    it('should clean up player binding when removing connection', () => {
      const connId = manager.addConnection(mockWs);
      manager.bindPlayer(connId, 'player-1');

      manager.removeConnection(connId);

      expect(manager.getConnection('player-1')).toBeNull();
    });
  });

  describe('bindPlayer', () => {
    it('should bind player to connection', () => {
      const connId = manager.addConnection(mockWs);

      const result = manager.bindPlayer(connId, 'player-1');

      expect(result).toBe(true);
      expect(manager.getPlayerId(connId)).toBe('player-1');
      expect(manager.getBoundPlayers()).toBe(1);
    });

    it('should return false for non-existent connection', () => {
      const result = manager.bindPlayer('non-existent', 'player-1');

      expect(result).toBe(false);
    });

    it('should handle player reconnection on different connection', () => {
      const connId1 = manager.addConnection(mockWs);
      const connId2 = manager.addConnection({ ...mockWs });

      manager.bindPlayer(connId1, 'player-1');
      manager.bindPlayer(connId2, 'player-1');

      // Old connection should be unbound
      expect(manager.getPlayerId(connId1)).toBeNull();
      // New connection should be bound
      expect(manager.getPlayerId(connId2)).toBe('player-1');
      // Only one player binding should exist
      expect(manager.getBoundPlayers()).toBe(1);
    });

    it('should allow rebinding same player to same connection', () => {
      const connId = manager.addConnection(mockWs);

      manager.bindPlayer(connId, 'player-1');
      manager.bindPlayer(connId, 'player-1');

      expect(manager.getPlayerId(connId)).toBe('player-1');
      expect(manager.getBoundPlayers()).toBe(1);
    });
  });

  describe('getConnection', () => {
    it('should return WebSocket for bound player', () => {
      const connId = manager.addConnection(mockWs);
      manager.bindPlayer(connId, 'player-1');

      const ws = manager.getConnection('player-1');

      expect(ws).toBe(mockWs);
    });

    it('should return null for unbound player', () => {
      const ws = manager.getConnection('player-1');

      expect(ws).toBeNull();
    });
  });

  describe('getWebSocket', () => {
    it('should return WebSocket by connection ID', () => {
      const connId = manager.addConnection(mockWs);

      const ws = manager.getWebSocket(connId);

      expect(ws).toBe(mockWs);
    });

    it('should return null for non-existent connection ID', () => {
      const ws = manager.getWebSocket('non-existent');

      expect(ws).toBeNull();
    });
  });

  describe('getPlayerId', () => {
    it('should return playerId for bound connection', () => {
      const connId = manager.addConnection(mockWs);
      manager.bindPlayer(connId, 'player-1');

      const playerId = manager.getPlayerId(connId);

      expect(playerId).toBe('player-1');
    });

    it('should return null for unbound connection', () => {
      const connId = manager.addConnection(mockWs);

      const playerId = manager.getPlayerId(connId);

      expect(playerId).toBeNull();
    });

    it('should return null for non-existent connection', () => {
      const playerId = manager.getPlayerId('non-existent');

      expect(playerId).toBeNull();
    });
  });

  describe('sessionId', () => {
    it('should set and get sessionId for an existing connection', () => {
      const connId = manager.addConnection(mockWs);

      const setResult = manager.setSessionId(connId, 'sess-1');
      const sessionId = manager.getSessionId(connId);

      expect(setResult).toBe(true);
      expect(sessionId).toBe('sess-1');
    });

    it('should return false when setting sessionId for non-existent connection', () => {
      const setResult = manager.setSessionId('non-existent', 'sess-1');
      expect(setResult).toBe(false);
    });

    it('should return null when getting sessionId for non-existent connection', () => {
      const sessionId = manager.getSessionId('non-existent');
      expect(sessionId).toBeNull();
    });
  });

  describe('getActiveConnections', () => {
    it('should return 0 initially', () => {
      expect(manager.getActiveConnections()).toBe(0);
    });

    it('should return correct count after adding connections', () => {
      manager.addConnection(mockWs);
      manager.addConnection({ ...mockWs });
      manager.addConnection({ ...mockWs });

      expect(manager.getActiveConnections()).toBe(3);
    });

    it('should return correct count after removing connections', () => {
      const connId1 = manager.addConnection(mockWs);
      manager.addConnection({ ...mockWs });

      manager.removeConnection(connId1);

      expect(manager.getActiveConnections()).toBe(1);
    });
  });

  describe('getBoundPlayers', () => {
    it('should return 0 initially', () => {
      expect(manager.getBoundPlayers()).toBe(0);
    });

    it('should return correct count after binding players', () => {
      const connId1 = manager.addConnection(mockWs);
      const connId2 = manager.addConnection({ ...mockWs });

      manager.bindPlayer(connId1, 'player-1');
      manager.bindPlayer(connId2, 'player-2');

      expect(manager.getBoundPlayers()).toBe(2);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivity timestamp', async () => {
      const connId = manager.addConnection(mockWs);
      const conn = manager.connections.get(connId);
      const initialActivity = conn.lastActivity;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      manager.updateActivity(connId);

      expect(conn.lastActivity).toBeGreaterThan(initialActivity);
    });

    it('should do nothing for non-existent connection', () => {
      expect(() => manager.updateActivity('non-existent')).not.toThrow();
    });
  });

  describe('getTimedOutConnections', () => {
    it('should return empty array when no connections timed out', () => {
      manager.addConnection(mockWs);

      const timedOut = manager.getTimedOutConnections(1000);

      expect(timedOut).toEqual([]);
    });

    it('should return timed out connections', async () => {
      const connId = manager.addConnection(mockWs);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const timedOut = manager.getTimedOutConnections(10); // 10ms timeout

      expect(timedOut).toContain(connId);
    });

    it('should not return recently active connections', async () => {
      const connId = manager.addConnection(mockWs);

      // Wait then update activity
      await new Promise(resolve => setTimeout(resolve, 30));
      manager.updateActivity(connId);

      const timedOut = manager.getTimedOutConnections(50); // 50ms timeout

      expect(timedOut).not.toContain(connId);
    });
  });
});
