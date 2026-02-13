/**
 * MessageRouter Unit Tests
 * T-B041
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { MessageRouter } from '../message-router.js';
import { RoomManager } from '../room-manager.js';
import { ConnectionManager } from '../connection-manager.js';
import { config } from '../config.js';

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

    it('should reject game action with HOST_DISCONNECTED when host is offline', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      connectionManager.setSessionId(hostConnId, 'sess-host');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      // Disconnect host
      router.handleDisconnect(hostConnId);

      // Player 2 tries to send action
      playerWs.send.mockClear();
      router.route(playerConnId, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { actionType: 'PLAY_CARD', actionData: { cardId: 'card-1' } }
      });

      const msgs = playerWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(msgs.some(m => m.type === 'ERROR' && m.data.code === 'HOST_DISCONNECTED')).toBe(true);
    });

    it('should allow game action after host reconnects', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      connectionManager.setSessionId(hostConnId, 'sess-host');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      // Disconnect host
      router.handleDisconnect(hostConnId);

      // Reconnect host
      const reconnectWs = { readyState: 1, send: jest.fn() };
      const reconnectConnId = connectionManager.addConnection(reconnectWs);
      connectionManager.bindPlayer(reconnectConnId, 'host-1');

      router.route(reconnectConnId, {
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'room-1', sessionId: 'sess-host' }
      });

      // Now player 2 should be able to send action
      playerWs.send.mockClear();
      router.route(playerConnId, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { actionType: 'PLAY_CARD', actionData: { cardId: 'card-1' } }
      });

      const msgs = playerWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(msgs.some(m => m.type === 'GAME_STATE_UPDATE')).toBe(true);
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

  describe('handleReturnToRoom', () => {
    it('should broadcast return status and unlock next start when all players returned', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      router.route(hostConnId, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      });

      const hostFirst = JSON.parse(hostWs.send.mock.calls[0][0]);
      const playerFirst = JSON.parse(playerWs.send.mock.calls[0][0]);
      expect(hostFirst.type).toBe('RETURN_TO_ROOM_STATUS');
      expect(playerFirst.type).toBe('RETURN_TO_ROOM_STATUS');
      expect(hostFirst.data.allReturned).toBe(false);
      expect(roomManager.getRoom('room-1').gameStarted).toBe(true);

      router.route(playerConnId, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {}
      });

      const hostSecond = JSON.parse(hostWs.send.mock.calls[1][0]);
      expect(hostSecond.type).toBe('RETURN_TO_ROOM_STATUS');
      expect(hostSecond.data.allReturned).toBe(true);
      expect(roomManager.getRoom('room-1').gameStarted).toBe(false);
    });

    it('should error when player is not in any room', () => {
      const connId = setupPlayer('player-1');

      router.route(connId, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {}
      });

      expect(sentMessages[0].type).toBe('ERROR');
      expect(sentMessages[0].data.code).toBe('GAME_NOT_FOUND');
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

  describe('handleReconnectRequest', () => {
    it('should accept reconnect and send GAME_SNAPSHOT for valid reconnect session', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      connectionManager.setSessionId(playerConnId, 'sess-1');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');
      roomManager.setGameSettings('room-1', { mode: 'fast', rounds: 5 });
      roomManager.startGame('room-1');

      router.route(hostConnId, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'red-7' },
          gameState: { turn: 1 }
        }
      });

      router.handleDisconnect(playerConnId);

      const reconnectWs = { readyState: 1, send: jest.fn() };
      const reconnectConnId = connectionManager.addConnection(reconnectWs);

      router.route(reconnectConnId, {
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId: 'room-1',
          sessionId: 'sess-1'
        }
      });

      const reconnectMessages = reconnectWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(reconnectMessages.some(m => m.type === 'RECONNECT_ACCEPTED')).toBe(true);
      expect(reconnectMessages.some(m => m.type === 'GAME_SNAPSHOT')).toBe(true);
      expect(reconnectMessages.some(m => m.type === 'RETURN_TO_ROOM_STATUS')).toBe(true);
      const snapshot = reconnectMessages.find(m => m.type === 'GAME_SNAPSHOT');
      expect(snapshot?.data?.gameSettings).toEqual(expect.objectContaining({ mode: 'fast', rounds: 5 }));

      const hostMessages = hostWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(hostMessages.some(m => m.type === 'PLAYER_RECONNECTED')).toBe(true);
    });

    it('should reject reconnect with mismatched sessionId', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      connectionManager.setSessionId(playerConnId, 'sess-1');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');
      roomManager.startGame('room-1');

      router.handleDisconnect(playerConnId);

      const reconnectWs = { readyState: 1, send: jest.fn() };
      const reconnectConnId = connectionManager.addConnection(reconnectWs);

      router.route(reconnectConnId, {
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId: 'room-1',
          sessionId: 'wrong-sess'
        }
      });

      const msg = JSON.parse(reconnectWs.send.mock.calls[0][0]);
      expect(msg.type).toBe('RECONNECT_REJECTED');
      expect(msg.data.reasonCode).toBe('RECONNECT_IDENTITY_MISMATCH');
    });

    it('should reject reconnect when reconnect is disabled', () => {
      const original = config.enableReconnect;
      config.enableReconnect = false;

      const connId = connectionManager.addConnection(mockWs);
      router.route(connId, {
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {
          roomId: 'room-1',
          sessionId: 'sess-1'
        }
      });

      expect(sentMessages[0].type).toBe('RECONNECT_REJECTED');
      expect(sentMessages[0].data.reasonCode).toBe('RECONNECT_NOT_SUPPORTED');

      config.enableReconnect = original;
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

    it('should keep non-host in room during started game and broadcast return status', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      connectionManager.setSessionId(playerConnId, 'sess-1');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');
      roomManager.markPlayerReturned('room-1', 'host-1');

      router.handleDisconnect(playerConnId);

      expect(roomManager.findPlayerRoom('player-2')).toBe('room-1');
      const room = roomManager.getRoom('room-1');
      expect(room.disconnectedPlayers.has('player-2')).toBe(true);
      expect(room.returnStatus.get('player-2')).toBe(false);

      const hostMessages = hostWs.send.mock.calls.map((call) => JSON.parse(call[0]));
      expect(hostMessages.some(msg => msg.type === 'PLAYER_LEFT')).toBe(false);
      const returnStatus = hostMessages.find(msg => msg.type === 'RETURN_TO_ROOM_STATUS');
      expect(returnStatus).toBeDefined();
      expect(returnStatus.data.allReturned).toBe(false);
      expect(returnStatus.data.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'host-1', returned: true }),
        expect.objectContaining({ id: 'player-2', returned: false })
      ]));
    });

    it('should create reconnect session when host disconnects during game (not destroy room)', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      connectionManager.setSessionId(connId1, 'sess-host');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      router.handleDisconnect(connId1);

      // Room should still exist
      const room = roomManager.getRoom('room-1');
      expect(room).not.toBeNull();
      expect(room.disconnectedPlayers.has('host-1')).toBe(true);

      // Player 2 should NOT receive ROOM_DESTROYED
      const calls = mockWs2.send.mock.calls;
      const messages = calls.map(c => JSON.parse(c[0]));
      expect(messages.some(m => m.type === 'ROOM_DESTROYED')).toBe(false);

      // Player 2 should receive RETURN_TO_ROOM_STATUS
      expect(messages.some(m => m.type === 'RETURN_TO_ROOM_STATUS')).toBe(true);
      const status = messages.find(m => m.type === 'RETURN_TO_ROOM_STATUS');
      expect(status.data.isHostDisconnected).toBe(true);
    });

    it('should broadcast PLAYER_DISCONNECTED when non-host disconnects during started game', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      connectionManager.setSessionId(playerConnId, 'sess-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      router.handleDisconnect(playerConnId);

      const hostMessages = hostWs.send.mock.calls.map(c => JSON.parse(c[0]));
      const disconnectMsg = hostMessages.find(m => m.type === 'PLAYER_DISCONNECTED');
      expect(disconnectMsg).toBeDefined();
      expect(disconnectMsg.playerId).toBe('server');
      expect(disconnectMsg.data.playerId).toBe('player-2');
      expect(disconnectMsg.data.nickname).toBe('Bob');
      expect(disconnectMsg.data.reconnectWindowMs).toBe(60000);
    });

    it('should broadcast PLAYER_DISCONNECTED when host disconnects during started game', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      connectionManager.setSessionId(hostConnId, 'sess-host');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      router.handleDisconnect(hostConnId);

      const playerMessages = playerWs.send.mock.calls.map(c => JSON.parse(c[0]));
      const disconnectMsg = playerMessages.find(m => m.type === 'PLAYER_DISCONNECTED');
      expect(disconnectMsg).toBeDefined();
      expect(disconnectMsg.data.playerId).toBe('host-1');
      expect(disconnectMsg.data.nickname).toBe('Host');
      expect(disconnectMsg.data.reconnectWindowMs).toBe(60000);
    });

    it('should not broadcast PLAYER_DISCONNECTED when game has not started', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      // Game NOT started
      router.handleDisconnect(connId2);

      const hostMessages = hostWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(hostMessages.some(m => m.type === 'PLAYER_DISCONNECTED')).toBe(false);
    });

    it('should still destroy room when host disconnects before game starts', () => {
      const mockWs1 = { readyState: 1, send: jest.fn() };
      const mockWs2 = { readyState: 1, send: jest.fn() };

      const connId1 = connectionManager.addConnection(mockWs1);
      connectionManager.bindPlayer(connId1, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const connId2 = connectionManager.addConnection(mockWs2);
      connectionManager.bindPlayer(connId2, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      // Game NOT started
      router.handleDisconnect(connId1);

      const calls = mockWs2.send.mock.calls;
      const messages = calls.map(c => JSON.parse(c[0]));
      expect(messages.some(m => m.type === 'ROOM_DESTROYED')).toBe(true);
    });

    it('should do nothing for unbound connection', () => {
      const connId = connectionManager.addConnection(mockWs);

      expect(() => router.handleDisconnect(connId)).not.toThrow();
    });
  });

  describe('pruneExpiredSessions', () => {
    it('should destroy room when host reconnect session expires', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      connectionManager.setSessionId(hostConnId, 'sess-host');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      // Disconnect host (creates reconnect session)
      router.handleDisconnect(hostConnId);
      expect(roomManager.getRoom('room-1')).not.toBeNull();

      // Force host session expiry
      const room = roomManager.getRoom('room-1');
      room.reconnectSessions.get('host-1').expiresAt = Date.now() - 1;

      // Prune
      playerWs.send.mockClear();
      router.pruneExpiredSessions();

      // Player 2 should receive ROOM_DESTROYED
      const msgs = playerWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(msgs.some(m => m.type === 'ROOM_DESTROYED')).toBe(true);
      const destroyed = msgs.find(m => m.type === 'ROOM_DESTROYED');
      expect(destroyed.data.reason).toBe('host_reconnect_timeout');
    });

    it('should not destroy room when non-host session expires', () => {
      const hostWs = { readyState: 1, send: jest.fn() };
      const playerWs = { readyState: 1, send: jest.fn() };

      const hostConnId = connectionManager.addConnection(hostWs);
      connectionManager.bindPlayer(hostConnId, 'host-1');
      roomManager.joinRoom('room-1', 'host-1', 'Host', 'uno');

      const playerConnId = connectionManager.addConnection(playerWs);
      connectionManager.bindPlayer(playerConnId, 'player-2');
      connectionManager.setSessionId(playerConnId, 'sess-2');
      roomManager.joinRoom('room-1', 'player-2', 'Bob');

      roomManager.startGame('room-1');

      // Disconnect non-host
      router.handleDisconnect(playerConnId);

      // Force session expiry
      const room = roomManager.getRoom('room-1');
      room.reconnectSessions.get('player-2').expiresAt = Date.now() - 1;

      // Prune
      hostWs.send.mockClear();
      router.pruneExpiredSessions();

      // Room should still exist, no ROOM_DESTROYED
      expect(roomManager.getRoom('room-1')).not.toBeNull();
      const msgs = hostWs.send.mock.calls.map(c => JSON.parse(c[0]));
      expect(msgs.some(m => m.type === 'ROOM_DESTROYED')).toBe(false);
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
