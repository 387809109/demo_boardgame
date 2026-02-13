/**
 * RoomManager Unit Tests
 * T-B031
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RoomManager } from '../room-manager.js';

describe('RoomManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  describe('createRoom', () => {
    it('should create a new room', () => {
      const result = manager.createRoom('room-1', 'host-1', 'uno');

      expect(result.success).toBe(true);
      expect(manager.getRoomCount()).toBe(1);
    });

    it('should not create duplicate room', () => {
      manager.createRoom('room-1', 'host-1', 'uno');
      const result = manager.createRoom('room-1', 'host-2', 'uno');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Room already exists');
    });

    it('should store room metadata correctly', () => {
      manager.createRoom('room-1', 'host-1', 'uno');
      const room = manager.getRoom('room-1');

      expect(room.id).toBe('room-1');
      expect(room.host).toBe('host-1');
      expect(room.gameType).toBe('uno');
      expect(room.gameStarted).toBe(false);
      expect(room.players).toEqual([]);
    });
  });

  describe('joinRoom', () => {
    it('should create room and join if room does not exist', () => {
      const result = manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      expect(result.success).toBe(true);
      expect(result.isNewRoom).toBe(true);
      expect(manager.getRoomCount()).toBe(1);
    });

    it('should join existing room', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      const result = manager.joinRoom('room-1', 'player-2', 'Bob');

      expect(result.success).toBe(true);
      expect(result.isNewRoom).toBeFalsy();
    });

    it('should add player to room players list', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const players = manager.getPlayers('room-1');

      expect(players.length).toBe(1);
      expect(players[0].id).toBe('player-1');
      expect(players[0].nickname).toBe('Alice');
      expect(players[0].isHost).toBe(true);
    });

    it('should not allow player to join if already in another room', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      const result = manager.joinRoom('room-2', 'player-1', 'Alice', 'uno');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player already in another room');
    });

    it('should not allow duplicate player in same room', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      const result = manager.joinRoom('room-1', 'player-1', 'Alice');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Player already in room');
    });

    it('should require gameType for new room', () => {
      const result = manager.joinRoom('room-1', 'player-1', 'Alice');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game type required for new room');
    });

    it('should not allow joining started game', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.startGame('room-1');

      const result = manager.joinRoom('room-1', 'player-2', 'Bob');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Game already started');
    });

    it('should track player room mapping', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      expect(manager.findPlayerRoom('player-1')).toBe('room-1');
    });
  });

  describe('removePlayer', () => {
    beforeEach(() => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
    });

    it('should remove player from room', () => {
      const result = manager.removePlayer('room-1', 'player-2');

      expect(result.success).toBe(true);
      expect(manager.getPlayers('room-1').length).toBe(1);
    });

    it('should indicate if removed player was host', () => {
      const result = manager.removePlayer('room-1', 'host-1');

      expect(result.wasHost).toBe(true);
    });

    it('should transfer host to next player when host leaves', () => {
      const result = manager.removePlayer('room-1', 'host-1');

      expect(result.newHost).toBe('player-2');
      expect(manager.isHost('room-1', 'player-2')).toBe(true);
    });

    it('should delete room when last player leaves', () => {
      manager.removePlayer('room-1', 'host-1');
      const result = manager.removePlayer('room-1', 'player-2');

      expect(result.roomDeleted).toBe(true);
      expect(manager.getRoomCount()).toBe(0);
    });

    it('should clean up player room mapping', () => {
      manager.removePlayer('room-1', 'player-2');

      expect(manager.findPlayerRoom('player-2')).toBeNull();
    });

    it('should return failure for non-existent room', () => {
      const result = manager.removePlayer('non-existent', 'player-1');

      expect(result.success).toBe(false);
    });

    it('should return failure for non-existent player', () => {
      const result = manager.removePlayer('room-1', 'non-existent');

      expect(result.success).toBe(false);
    });
  });

  describe('findPlayerRoom', () => {
    it('should return room ID for player in room', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      expect(manager.findPlayerRoom('player-1')).toBe('room-1');
    });

    it('should return null for player not in any room', () => {
      expect(manager.findPlayerRoom('player-1')).toBeNull();
    });
  });

  describe('getRoom', () => {
    it('should return room object', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const room = manager.getRoom('room-1');

      expect(room).toBeDefined();
      expect(room.id).toBe('room-1');
    });

    it('should return null for non-existent room', () => {
      expect(manager.getRoom('non-existent')).toBeNull();
    });
  });

  describe('getPlayers', () => {
    it('should return array of players in room', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');

      const players = manager.getPlayers('room-1');

      expect(players.length).toBe(2);
      expect(players.map(p => p.id)).toContain('player-1');
      expect(players.map(p => p.id)).toContain('player-2');
    });

    it('should return empty array for non-existent room', () => {
      expect(manager.getPlayers('non-existent')).toEqual([]);
    });

    it('should return a copy of players array', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const players1 = manager.getPlayers('room-1');
      const players2 = manager.getPlayers('room-1');

      expect(players1).not.toBe(players2);
    });
  });

  describe('isHost', () => {
    it('should return true for host', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      expect(manager.isHost('room-1', 'player-1')).toBe(true);
    });

    it('should return false for non-host', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');

      expect(manager.isHost('room-1', 'player-2')).toBe(false);
    });

    it('should return false for non-existent room', () => {
      expect(manager.isHost('non-existent', 'player-1')).toBe(false);
    });
  });

  describe('deleteRoom', () => {
    it('should delete existing room', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const result = manager.deleteRoom('room-1');

      expect(result).toBe(true);
      expect(manager.getRoomCount()).toBe(0);
    });

    it('should clean up all player mappings', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');

      manager.deleteRoom('room-1');

      expect(manager.findPlayerRoom('player-1')).toBeNull();
      expect(manager.findPlayerRoom('player-2')).toBeNull();
    });

    it('should return false for non-existent room', () => {
      expect(manager.deleteRoom('non-existent')).toBe(false);
    });
  });

  describe('startGame', () => {
    it('should mark game as started', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const result = manager.startGame('room-1');

      expect(result).toBe(true);
      expect(manager.getRoom('room-1').gameStarted).toBe(true);
    });

    it('should return false for non-existent room', () => {
      expect(manager.startGame('non-existent')).toBe(false);
    });

    it('should initialize return status as false for all players', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');

      manager.startGame('room-1');
      const status = manager.getReturnToRoomStatus('room-1');

      expect(status.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'host-1', returned: false }),
        expect.objectContaining({ id: 'player-2', returned: false })
      ]));
      expect(status.allReturned).toBe(false);
    });
  });

  describe('return to room status', () => {
    it('should mark player returned and reset room startability when all returned', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      const first = manager.markPlayerReturned('room-1', 'host-1');
      expect(first.success).toBe(true);
      expect(first.allReturned).toBe(false);
      expect(manager.getRoom('room-1').gameStarted).toBe(true);

      const second = manager.markPlayerReturned('room-1', 'player-2');
      expect(second.success).toBe(true);
      expect(second.allReturned).toBe(true);
      expect(manager.getRoom('room-1').gameStarted).toBe(false);
    });

    it('should return full return-status snapshot', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');
      manager.markPlayerReturned('room-1', 'host-1');

      const status = manager.getReturnToRoomStatus('room-1');
      expect(status.totalPlayers).toBe(2);
      expect(status.returnedCount).toBe(1);
      expect(status.allReturned).toBe(false);
      expect(status.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'host-1', returned: true }),
        expect.objectContaining({ id: 'player-2', returned: false })
      ]));
    });

    it('should keep allReturned false while a player is disconnected', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.markPlayerReturned('room-1', 'host-1');
      manager.markPlayerDisconnected('room-1', 'player-2');

      const second = manager.markPlayerReturned('room-1', 'player-2');
      expect(second.success).toBe(true);
      expect(second.allReturned).toBe(false);
      expect(manager.getRoom('room-1').gameStarted).toBe(true);
    });
  });

  describe('reconnect and snapshot', () => {
    it('should reconnect in place when disconnected player is still in room', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.createReconnectSession('room-1', 'player-2', 'Bob', 'sess-1');
      manager.markPlayerDisconnected('room-1', 'player-2');

      const result = manager.reconnectPlayer('room-1', 'player-2', 'sess-1');
      const room = manager.getRoom('room-1');

      expect(result.success).toBe(true);
      expect(room.players.filter(player => player.id === 'player-2')).toHaveLength(1);
      expect(room.disconnectedPlayers.has('player-2')).toBe(false);
      expect(room.returnStatus.get('player-2')).toBe(false);
    });

    it('should allow reconnecting a disconnected non-host player with valid session', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.removePlayer('room-1', 'player-2');
      manager.createReconnectSession('room-1', 'player-2', 'Bob', 'sess-1');

      const result = manager.reconnectPlayer('room-1', 'player-2', 'sess-1');

      expect(result.success).toBe(true);
      expect(manager.findPlayerRoom('player-2')).toBe('room-1');
      expect(manager.getPlayers('room-1').some(p => p.id === 'player-2')).toBe(true);
    });

    it('should reject reconnect when session ID does not match', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.removePlayer('room-1', 'player-2');
      manager.createReconnectSession('room-1', 'player-2', 'Bob', 'sess-1');

      const result = manager.reconnectPlayer('room-1', 'player-2', 'sess-2');

      expect(result.success).toBe(false);
      expect(result.code).toBe('RECONNECT_IDENTITY_MISMATCH');
    });

    it('should reject reconnect when session is expired', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.removePlayer('room-1', 'player-2');
      manager.createReconnectSession('room-1', 'player-2', 'Bob', 'sess-1');

      const room = manager.getRoom('room-1');
      const session = room.reconnectSessions.get('player-2');
      session.expiresAt = Date.now() - 1;
      room.reconnectSessions.set('player-2', session);

      const result = manager.reconnectPlayer('room-1', 'player-2', 'sess-1');
      expect(result.success).toBe(false);
      expect(result.code).toBe('RECONNECT_SESSION_EXPIRED');
    });

    it('should update and return game snapshot', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.startGame('room-1');

      manager.updateGameSnapshot('room-1', {
        gameState: { turn: 3 },
        lastAction: { actionType: 'PLAY_CARD' },
        lastActionId: 'act-3'
      });

      const snapshot = manager.getGameSnapshot('room-1');
      expect(snapshot.roomId).toBe('room-1');
      expect(snapshot.gameType).toBe('uno');
      expect(snapshot.gameState).toEqual({ turn: 3 });
      expect(snapshot.lastAction.actionType).toBe('PLAY_CARD');
      expect(snapshot.lastActionId).toBe('act-3');
    });
  });

  describe('isHostDisconnected', () => {
    it('should return false when host is connected', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      expect(manager.isHostDisconnected('room-1')).toBe(false);
    });

    it('should return true when host is in disconnectedPlayers', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.markPlayerDisconnected('room-1', 'host-1');

      expect(manager.isHostDisconnected('room-1')).toBe(true);
    });

    it('should return false after host reconnects', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.createReconnectSession('room-1', 'host-1', 'Host', 'sess-host');
      manager.markPlayerDisconnected('room-1', 'host-1');
      expect(manager.isHostDisconnected('room-1')).toBe(true);

      manager.reconnectPlayer('room-1', 'host-1', 'sess-host');
      expect(manager.isHostDisconnected('room-1')).toBe(false);
    });

    it('should return false for non-existent room', () => {
      expect(manager.isHostDisconnected('non-existent')).toBe(false);
    });
  });

  describe('getReturnToRoomStatus enriched fields', () => {
    it('should include disconnected field per player', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.markPlayerDisconnected('room-1', 'player-2');
      const status = manager.getReturnToRoomStatus('room-1');

      const host = status.players.find(p => p.id === 'host-1');
      const player = status.players.find(p => p.id === 'player-2');
      expect(host.disconnected).toBe(false);
      expect(player.disconnected).toBe(true);
    });

    it('should include isHostDisconnected at top level', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      expect(manager.getReturnToRoomStatus('room-1').isHostDisconnected).toBe(false);

      manager.markPlayerDisconnected('room-1', 'host-1');
      expect(manager.getReturnToRoomStatus('room-1').isHostDisconnected).toBe(true);
    });
  });

  describe('pruneAllExpiredSessions', () => {
    it('should return empty array when no expired sessions', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.startGame('room-1');

      expect(manager.pruneAllExpiredSessions()).toEqual([]);
    });

    it('should return room ID when host reconnect session expires', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.createReconnectSession('room-1', 'host-1', 'Host', 'sess-host');
      manager.markPlayerDisconnected('room-1', 'host-1');

      // Force expiry
      const room = manager.getRoom('room-1');
      room.reconnectSessions.get('host-1').expiresAt = Date.now() - 1;

      const expired = manager.pruneAllExpiredSessions();
      expect(expired).toContain('room-1');
    });

    it('should not return room ID when non-host session expires', () => {
      manager.joinRoom('room-1', 'host-1', 'Host', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');

      manager.createReconnectSession('room-1', 'player-2', 'Bob', 'sess-2');
      manager.markPlayerDisconnected('room-1', 'player-2');

      // Force expiry
      const room = manager.getRoom('room-1');
      room.reconnectSessions.get('player-2').expiresAt = Date.now() - 1;

      const expired = manager.pruneAllExpiredSessions();
      expect(expired).toEqual([]);
    });

    it('should prune across multiple rooms', () => {
      manager.joinRoom('room-1', 'host-1', 'Host1', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.startGame('room-1');
      manager.createReconnectSession('room-1', 'host-1', 'Host1', 'sess-1');
      manager.markPlayerDisconnected('room-1', 'host-1');

      manager.joinRoom('room-2', 'host-3', 'Host2', 'uno');
      manager.startGame('room-2');

      // Force expiry only for room-1 host
      const room1 = manager.getRoom('room-1');
      room1.reconnectSessions.get('host-1').expiresAt = Date.now() - 1;

      const expired = manager.pruneAllExpiredSessions();
      expect(expired).toEqual(['room-1']);
    });
  });

  describe('getRoomCount', () => {
    it('should return 0 initially', () => {
      expect(manager.getRoomCount()).toBe(0);
    });

    it('should return correct count', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      manager.joinRoom('room-2', 'player-2', 'Bob', 'uno');

      expect(manager.getRoomCount()).toBe(2);
    });
  });

  describe('getTotalPlayers', () => {
    it('should return 0 initially', () => {
      expect(manager.getTotalPlayers()).toBe(0);
    });

    it('should return correct count across all rooms', () => {
      manager.joinRoom('room-1', 'player-1', 'Alice', 'uno');
      manager.joinRoom('room-1', 'player-2', 'Bob');
      manager.joinRoom('room-2', 'player-3', 'Charlie', 'uno');

      expect(manager.getTotalPlayers()).toBe(3);
    });
  });
});
