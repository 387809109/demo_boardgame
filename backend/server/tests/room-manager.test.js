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
