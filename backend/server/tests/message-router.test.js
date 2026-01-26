/**
 * MessageRouter Unit Tests
 * T-B041
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { MessageRouter } from '../message-router.js';
import { RoomManager } from '../room-manager.js';
import { ConnectionManager } from '../connection-manager.js';

describe('MessageRouter', () => {
  let router;
  let roomManager;
  let connectionManager;
  let mockWs;
  let sentMessages;

  beforeEach(() => {
    roomManager = new RoomManager();
    connectionManager = new ConnectionManager();
    router = new MessageRouter(roomManager, connectionManager);

    sentMessages = [];
    mockWs = {
      readyState: 1, // WebSocket.OPEN
      send: jest.fn((msg) => sentMessages.push(JSON.parse(msg))),
      close: jest.fn()
    };
  });

  /**
   * Helper to setup a player connection
   */
  function setupPlayer(playerId, nickname = 'Test') {
    const connId = connectionManager.addConnection(mockWs);
    connectionManager.bindPlayer(connId, playerId);
    return connId;
  }

  /**
   * Helper to setup a player in a room
   */
  function setupPlayerInRoom(playerId, nickname, roomId, gameType = 'uno') {
    const connId = setupPlayer(playerId, nickname);
    roomManager.joinRoom(roomId, playerId, nickname, gameType);
    return connId;
  }

  describe('route', () => {
    it('should reject invalid message format', () => {
      const connId = connectionManager.addConnection(mockWs);

      router.route(connId, { type: 'PING' }); // Missing timestamp and playerId

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('INVALID_MESSAGE_FORMAT');
    });

    it('should bind player on first message', () => {
      const connId = connectionManager.addConnection(mockWs);

      router.route(connId, {
        type: 'PING',
        timestamp: Date.now(),
        playerId: 'player-1'
      });

      expect(connectionManager.getPlayerId(connId)).toBe('player-1');
    });

    it('should reject unknown message type', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'UNKNOWN',
        timestamp: Date.now(),
        playerId: 'player-1'
      });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('INVALID_MESSAGE_FORMAT');
    });
  });

  describe('handleJoin', () => {
    it('should allow player to join new room', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          roomId: 'room-1',
          nickname: 'Alice',
          gameType: 'uno'
        }
      });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('PLAYER_JOINED');
      expect(sentMessages[0].data.playerCount).toBe(1);
    });

    it('should broadcast to all players when new player joins', () => {
      // Setup host
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');

      router.route(connId2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId: 'room-1',
          nickname: 'Bob'
        }
      });

      // Both players should receive PLAYER_JOINED
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });

    it('should reject join with invalid room ID', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          roomId: '',
          nickname: 'Alice',
          gameType: 'uno'
        }
      });

      expect(sentMessages[0].type).toBe('ERROR');
    });

    it('should reject join with invalid nickname', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          roomId: 'room-1',
          nickname: '',
          gameType: 'uno'
        }
      });

      expect(sentMessages[0].type).toBe('ERROR');
    });
  });

  describe('handleLeave', () => {
    it('should allow player to leave room', () => {
      const connId = setupPlayerInRoom('player-1', 'Alice', 'room-1');

      router.route(connId, {
        type: 'LEAVE',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {}
      });

      expect(roomManager.findPlayerRoom('player-1')).toBeNull();
    });

    it('should error if player not in room', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'LEAVE',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {}
      });

      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('GAME_NOT_FOUND');
    });

    it('should broadcast PLAYER_LEFT to remaining players', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      router.route(connId2, {
        type: 'LEAVE',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {}
      });

      expect(mockWs1.send).toHaveBeenCalled();
      const msg = JSON.parse(mockWs1.send.mock.calls[0][0]);
      expect(msg.type).toBe('PLAYER_LEFT');
      expect(msg.data.reason).toBe('voluntary');
    });
  });

  describe('handleStartGame', () => {
    it('should allow host to start game', () => {
      const connId = setupPlayerInRoom('host-1', 'Host', 'room-1');

      router.route(connId, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          gameConfig: {}
        }
      });

      expect(sentMessages[0].type).toBe('GAME_STARTED');
      expect(roomManager.getRoom('room-1').gameStarted).toBe(true);
    });

    it('should reject non-host starting game', () => {
      setupPlayerInRoom('host-1', 'Host', 'room-1');

      const mockWs2 = { readyState: 1, send: jest.fn() };
      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      router.route(connId2, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {}
      });

      const msg = JSON.parse(mockWs2.send.mock.calls[0][0]);
      expect(msg.type).toBe('ERROR');
      expect(msg.data.code).toBe('PERMISSION_DENIED');
    });

    it('should reject starting already started game', () => {
      const connId = setupPlayerInRoom('host-1', 'Host', 'room-1');
      roomManager.startGame('room-1');

      router.route(connId, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      });

      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('INVALID_ACTION');
    });

    it('should error if player not in room', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {}
      });

      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('GAME_NOT_FOUND');
    });
  });

  describe('handleGameAction', () => {
    it('should forward game action to all players', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      router.route(connId1, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-1' }
        }
      });

      // Both should receive GAME_STATE_UPDATE
      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();

      const msg1 = JSON.parse(mockWs1.send.mock.calls[0][0]);
      expect(msg1.type).toBe('GAME_STATE_UPDATE');
      expect(msg1.data.lastAction.actionType).toBe('PLAY_CARD');
    });

    it('should error if game not started', () => {
      const connId = setupPlayerInRoom('host-1', 'Host', 'room-1');
      // Don't start game

      router.route(connId, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD'
        }
      });

      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('INVALID_ACTION');
    });

    it('should support AI player actions via host', () => {
      const connId = setupPlayerInRoom('host-1', 'Host', 'room-1');
      roomManager.startGame('room-1');

      router.route(connId, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          playerId: 'ai-player-1', // AI player ID
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-1' }
        }
      });

      expect(sentMessages[0].type).toBe('GAME_STATE_UPDATE');
      expect(sentMessages[0].data.lastAction.playerId).toBe('ai-player-1');
    });
  });

  describe('handleChatMessage', () => {
    it('should broadcast chat message to room', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'player-1');
      roomManager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      router.route(connId1, {
        type: 'CHAT_MESSAGE',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          message: 'Hello!',
          isPublic: true
        }
      });

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();

      const msg = JSON.parse(mockWs1.send.mock.calls[0][0]);
      expect(msg.type).toBe('CHAT_MESSAGE_BROADCAST');
      expect(msg.data.message).toBe('Hello!');
      expect(msg.data.nickname).toBe('Alice');
    });

    it('should truncate long messages', () => {
      const connId = setupPlayerInRoom('player-1', 'Alice', 'room-1');
      const longMessage = 'a'.repeat(600);

      router.route(connId, {
        type: 'CHAT_MESSAGE',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          message: longMessage,
          isPublic: true
        }
      });

      expect(sentMessages[0].data.message.length).toBe(500);
    });

    it('should ignore empty messages', () => {
      const connId = setupPlayerInRoom('player-1', 'Alice', 'room-1');

      router.route(connId, {
        type: 'CHAT_MESSAGE',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          message: '',
          isPublic: true
        }
      });

      expect(sentMessages.length).toBe(0);
    });
  });

  describe('handlePing', () => {
    it('should respond with PONG', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'PING',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {}
      });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('PONG');
      expect(sentMessages[0].playerId).toBe('player-1');
    });
  });

  describe('handleDisconnect', () => {
    it('should remove player from room on disconnect', () => {
      setupPlayerInRoom('player-1', 'Alice', 'room-1');
      const connId = connectionManager.addConnection(mockWs);
      connectionManager.bindPlayer(connId, 'player-1');

      router.handleDisconnect(connId);

      expect(roomManager.findPlayerRoom('player-1')).toBeNull();
    });

    it('should broadcast PLAYER_LEFT with disconnected reason', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      router.handleDisconnect(connId2);

      expect(mockWs1.send).toHaveBeenCalled();
      const msg = JSON.parse(mockWs1.send.mock.calls[0][0]);
      expect(msg.type).toBe('PLAYER_LEFT');
      expect(msg.data.reason).toBe('disconnected');
    });

    it('should end game when host disconnects during game', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      router.handleDisconnect(connId1);

      // Should receive PLAYER_LEFT and GAME_ENDED
      const calls = mockWs2.send.mock.calls;
      const messages = calls.map(c => JSON.parse(c[0]));

      expect(messages.some(m => m.type === 'PLAYER_LEFT')).toBe(true);
      expect(messages.some(m => m.type === 'GAME_ENDED')).toBe(true);

      const gameEnded = messages.find(m => m.type === 'GAME_ENDED');
      expect(gameEnded.data.reason).toBe('host_disconnected');
    });

    it('should do nothing for unbound connection', () => {
      const connId = connectionManager.addConnection(mockWs);

      expect(() => router.handleDisconnect(connId)).not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('should send to all players in room', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };
      const mockWs3 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'player-1');
      roomManager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      const connId3 = connectionManager.addConnection(mockWs3);
      connectionManager.bindPlayer(connId3, 'player-3');
      roomManager.joinRoom('room-2', 'player-3', 'Charlie', 'uno');

      router.broadcast('room-1', { type: 'TEST', data: {} });

      expect(mockWs1.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should exclude specified player', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'player-1');
      roomManager.joinRoom('room-1', 'player-1', 'Alice', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      router.broadcast('room-1', { type: 'TEST', data: {} }, 'player-1');

      expect(mockWs1.send).not.toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });
  });

  describe('sendError', () => {
    it('should send error message to connection', () => {
      const connId = connectionManager.addConnection(mockWs);

      router.sendError(connId, 'player-1', 'TEST_ERROR', 'Test message', 'error');

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('TEST_ERROR');
      expect(sentMessages[0].data.message).toBe('Test message');
      expect(sentMessages[0].data.severity).toBe('error');
    });
  });
});
