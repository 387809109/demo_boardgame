/**
 * Server Integration Tests
 * T-B051
 *
 * End-to-end tests for the WebSocket server
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import { GameServer } from '../index.js';
import { config } from '../config.js';

const TEST_PORT = 7780;

describe('GameServer Integration', () => {
  let server;

  beforeAll(() => {
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    config.enableReconnect = true;
    server = new GameServer(TEST_PORT);
    // Disable heartbeat checker for tests
    server.startHeartbeatChecker = () => {};
    server.start();
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (server) {
      if (server.heartbeatTimer) {
        clearInterval(server.heartbeatTimer);
        server.heartbeatTimer = null;
      }

      if (server.wss) {
        for (const ws of server.wss.clients) {
          ws.terminate();
        }
        await new Promise((resolve) => {
          server.wss.close(resolve);
        });
      }
      server = null;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  /**
   * Helper to create a connected WebSocket client
   */
  function createClient() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  /**
   * Helper to send a message and wait for specific response type
   */
  function sendAndReceive(ws, message, expectedType, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, timeout);

      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      };

      ws.on('message', handler);
      ws.send(JSON.stringify(message));
    });
  }

  /**
   * Helper to wait for a specific message type
   */
  function waitForMessage(ws, expectedType, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, timeout);

      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      };

      ws.on('message', handler);
    });
  }

  describe('Connection', () => {
    it('should accept WebSocket connections', async () => {
      const client = await createClient();
      expect(client.readyState).toBe(WebSocket.OPEN);
      client.close();
    });

    it('should handle multiple simultaneous connections', async () => {
      const clients = await Promise.all([
        createClient(),
        createClient(),
        createClient()
      ]);

      expect(server.getStats().connections).toBe(3);
      clients.forEach(c => c.close());
    });
  });

  describe('PING/PONG', () => {
    it('should respond to PING with PONG', async () => {
      const client = await createClient();

      const response = await sendAndReceive(client, {
        type: 'PING',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: {}
      }, 'PONG');

      expect(response.type).toBe('PONG');
      expect(response.playerId).toBe('player-1');
      client.close();
    });
  });

  describe('Room Flow', () => {
    it('should allow player to create and join room', async () => {
      const client = await createClient();

      const response = await sendAndReceive(client, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          roomId: 'test-room',
          nickname: 'Host',
          gameType: 'uno'
        }
      }, 'PLAYER_JOINED');

      expect(response.type).toBe('PLAYER_JOINED');
      expect(response.data.playerCount).toBe(1);
      expect(response.data.players[0].isHost).toBe(true);
      client.close();
    });

    it('should broadcast when second player joins', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      // Host joins first
      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'test-room', nickname: 'Host', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      // Set up listener on host before player 2 joins
      const hostPromise = waitForMessage(client1, 'PLAYER_JOINED');

      // Player 2 joins
      const player2Response = await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId: 'test-room', nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      const hostReceived = await hostPromise;

      expect(player2Response.data.playerCount).toBe(2);
      expect(hostReceived.data.playerCount).toBe(2);

      client1.close();
      client2.close();
    });

    it('should allow host to start game', async () => {
      const client = await createClient();

      await sendAndReceive(client, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'test-room', nickname: 'Host', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      const response = await sendAndReceive(client, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: { test: true } }
      }, 'GAME_STARTED');

      expect(response.type).toBe('GAME_STARTED');
      expect(response.data.gameType).toBe('uno');
      client.close();
    });

    it('should reject non-host starting game', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      // Host joins
      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'test-room', nickname: 'Host', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      // Player 2 joins
      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId: 'test-room', nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      // Player 2 tries to start game
      const response = await sendAndReceive(client2, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {}
      }, 'ERROR');

      expect(response.type).toBe('ERROR');
      expect(response.data.code).toBe('PERMISSION_DENIED');

      client1.close();
      client2.close();
    });

    it('should allow host to start next round only after all players return to room', async () => {
      const host = await createClient();
      const player = await createClient();

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'test-room', nickname: 'Host', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId: 'test-room', nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      const playerHostReturnPromise = waitForMessage(player, 'RETURN_TO_ROOM_STATUS');
      const hostReturnStatus = await sendAndReceive(host, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'RETURN_TO_ROOM_STATUS');
      const playerHostReturnStatus = await playerHostReturnPromise;
      expect(hostReturnStatus.data.allReturned).toBe(false);
      expect(playerHostReturnStatus.data.allReturned).toBe(false);

      const blockedStart = await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'ERROR');
      expect(blockedStart.data.code).toBe('INVALID_ACTION');

      const hostAllReturnedPromise = waitForMessage(host, 'RETURN_TO_ROOM_STATUS');

      const playerReturnStatus = await sendAndReceive(player, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {}
      }, 'RETURN_TO_ROOM_STATUS');
      const hostAllReturnedStatus = await hostAllReturnedPromise;
      expect(playerReturnStatus.data.allReturned).toBe(true);
      expect(hostAllReturnedStatus.data.allReturned).toBe(true);

      const nextRound = await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');
      expect(nextRound.type).toBe('GAME_STARTED');

      host.close();
      player.close();
    });
  });

  describe('Game Actions', () => {
    it('should broadcast game actions to all players', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      // Setup room
      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'test-room', nickname: 'Host', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId: 'test-room', nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      // Start game
      await sendAndReceive(client1, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');

      // Wait for player 2 to receive GAME_STARTED
      await waitForMessage(client2, 'GAME_STARTED');

      // Set up listener for player 2
      const player2Promise = waitForMessage(client2, 'GAME_STATE_UPDATE');

      // Host sends action
      const hostResponse = await sendAndReceive(client1, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-1' }
        }
      }, 'GAME_STATE_UPDATE');

      const player2Received = await player2Promise;

      expect(hostResponse.data.lastAction.actionType).toBe('PLAY_CARD');
      expect(player2Received.data.lastAction.actionType).toBe('PLAY_CARD');

      client1.close();
      client2.close();
    });
  });

  describe('Chat', () => {
    it('should broadcast chat messages', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: { roomId: 'test-room', nickname: 'Alice', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId: 'test-room', nickname: 'Bob' }
      }, 'PLAYER_JOINED');

      // Set up listener for player 2
      const player2Promise = waitForMessage(client2, 'CHAT_MESSAGE_BROADCAST');

      // Player 1 sends chat
      const response = await sendAndReceive(client1, {
        type: 'CHAT_MESSAGE',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: { message: 'Hello!', isPublic: true }
      }, 'CHAT_MESSAGE_BROADCAST');

      const player2Received = await player2Promise;

      expect(response.data.message).toBe('Hello!');
      expect(response.data.nickname).toBe('Alice');
      expect(player2Received.data.message).toBe('Hello!');

      client1.close();
      client2.close();
    });
  });

  describe('Disconnection', () => {
    it('should broadcast PLAYER_LEFT when player disconnects', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId: 'test-room', nickname: 'Host', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId: 'test-room', nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      // Set up listener for host
      const hostPromise = waitForMessage(client1, 'PLAYER_LEFT');

      // Player 2 disconnects
      client2.close();

      const hostReceived = await hostPromise;

      expect(hostReceived.type).toBe('PLAYER_LEFT');
      expect(hostReceived.data.reason).toBe('disconnected');

      client1.close();
    });

    it('should create reconnect session (not destroy room) when host disconnects during game', async () => {
      const client1 = await createClient();
      const client2 = await createClient();
      const roomId = `host-dc-${Date.now().toString(36)}`;

      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: 'sess-host' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client1, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');

      await waitForMessage(client2, 'GAME_STARTED');

      // Listen for RETURN_TO_ROOM_STATUS (not ROOM_DESTROYED)
      const statusPromise = waitForMessage(client2, 'RETURN_TO_ROOM_STATUS');

      // Host disconnects
      client1.close();

      const status = await statusPromise;
      expect(status.type).toBe('RETURN_TO_ROOM_STATUS');
      expect(status.data.isHostDisconnected).toBe(true);

      // Room should still exist
      const room = server.roomManager.getRoom(roomId);
      expect(room).not.toBeNull();

      client2.close();
    });

    it('should freeze game actions while host is disconnected', async () => {
      const client1 = await createClient();
      const client2 = await createClient();
      const roomId = `host-freeze-${Date.now().toString(36)}`;

      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: 'sess-host' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client1, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');

      await waitForMessage(client2, 'GAME_STARTED');

      // Host disconnects
      const statusPromise = waitForMessage(client2, 'RETURN_TO_ROOM_STATUS');
      client1.close();
      await statusPromise;

      // Player 2 tries to send action - should get HOST_DISCONNECTED error
      const errorResponse = await sendAndReceive(client2, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { actionType: 'PLAY_CARD', actionData: { cardId: 'card-1' } }
      }, 'ERROR');

      expect(errorResponse.data.code).toBe('HOST_DISCONNECTED');

      client2.close();
    });

    it('should broadcast PLAYER_DISCONNECTED to other players when a player disconnects during game', async () => {
      const client1 = await createClient();
      const client2 = await createClient();
      const roomId = `pd-notif-${Date.now().toString(36)}`;

      await sendAndReceive(client1, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: 'sess-host' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client2, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2', sessionId: 'sess-p2' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(client1, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');

      await waitForMessage(client2, 'GAME_STARTED');

      // Listen for PLAYER_DISCONNECTED
      const disconnectPromise = waitForMessage(client1, 'PLAYER_DISCONNECTED');

      // Player 2 disconnects
      client2.close();

      const msg = await disconnectPromise;
      expect(msg.type).toBe('PLAYER_DISCONNECTED');
      expect(msg.playerId).toBe('server');
      expect(msg.data.playerId).toBe('player-2');
      expect(msg.data.nickname).toBe('Player2');
      expect(msg.data.reconnectWindowMs).toBe(60000);

      client1.close();
    });
  });

  describe('Reconnect Flow', () => {
    it('should allow disconnected non-host to reconnect and receive GAME_SNAPSHOT', async () => {
      const host = await createClient();
      const player = await createClient();
      const roomId = `reconnect-${Date.now().toString(36)}`;
      const hostSessionId = 'sess-host-1';
      const playerSessionId = 'sess-player-2';

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          roomId,
          nickname: 'Host',
          gameType: 'uno',
          sessionId: hostSessionId
        }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId,
          nickname: 'Player2',
          gameType: 'uno',
          sessionId: playerSessionId
        }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'GAME_SETTINGS_UPDATE',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          gameSettings: {
            ruleSet: 'house',
            _gameType: 'uno',
            _maxPlayers: 2
          }
        }
      }, 'GAME_SETTINGS_UPDATE');

      const initialState = {
        players: [
          { id: 'host-1', nickname: 'Host', isHost: true },
          { id: 'player-2', nickname: 'Player2', isHost: false }
        ],
        marker: 'initial'
      };

      const startResponse = await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: { initialState } }
      }, 'GAME_STARTED');
      expect(startResponse.data.gameSettings).toEqual(expect.objectContaining({ ruleSet: 'house' }));

      await waitForMessage(player, 'GAME_STARTED');

      const updatedState = {
        ...initialState,
        marker: 'after-action'
      };

      await sendAndReceive(host, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-1' },
          gameState: updatedState
        }
      }, 'GAME_STATE_UPDATE');

      await waitForMessage(player, 'GAME_STATE_UPDATE');

      const disconnectStatusPromise = waitForMessage(host, 'RETURN_TO_ROOM_STATUS');
      player.close();
      const disconnectStatus = await disconnectStatusPromise;
      expect(disconnectStatus.data.allReturned).toBe(false);

      const reconnectClient = await createClient();
      const reconnectAcceptedPromise = waitForMessage(reconnectClient, 'RECONNECT_ACCEPTED');
      const snapshotPromise = waitForMessage(reconnectClient, 'GAME_SNAPSHOT');
      const playerReconnectedPromise = waitForMessage(host, 'PLAYER_RECONNECTED');

      reconnectClient.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId,
          sessionId: playerSessionId
        }
      }));

      const reconnectAccepted = await reconnectAcceptedPromise;
      const snapshot = await snapshotPromise;
      const playerReconnected = await playerReconnectedPromise;

      expect(reconnectAccepted.type).toBe('RECONNECT_ACCEPTED');
      expect(reconnectAccepted.data.roomId).toBe(roomId);
      expect(snapshot.type).toBe('GAME_SNAPSHOT');
      expect(snapshot.data.gameState).toEqual(updatedState);
      expect(snapshot.data.gameSettings).toEqual(expect.objectContaining({ ruleSet: 'house' }));
      expect(playerReconnected.type).toBe('PLAYER_RECONNECTED');
      expect(playerReconnected.playerId).toBe('player-2');

      host.close();
      reconnectClient.close();
    });

    it('should keep room in return phase after disconnect and allow reconnect to finish return flow', async () => {
      const host = await createClient();
      const player = await createClient();
      const roomId = `return-phase-${Date.now().toString(36)}`;
      const hostSessionId = 'sess-host-return';
      const playerSessionId = 'sess-player-return';

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          roomId,
          nickname: 'Host',
          gameType: 'uno',
          sessionId: hostSessionId
        }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId,
          nickname: 'Player2',
          gameType: 'uno',
          sessionId: playerSessionId
        }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: { initialState: { players: [] } } }
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      const playerHostReturnPromise = waitForMessage(player, 'RETURN_TO_ROOM_STATUS');
      const hostReturnStatus = await sendAndReceive(host, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'RETURN_TO_ROOM_STATUS');
      const playerHostReturnStatus = await playerHostReturnPromise;
      expect(hostReturnStatus.data.allReturned).toBe(false);
      expect(playerHostReturnStatus.data.allReturned).toBe(false);

      const disconnectStatusPromise = waitForMessage(host, 'RETURN_TO_ROOM_STATUS');
      player.close();
      const disconnectStatus = await disconnectStatusPromise;
      expect(disconnectStatus.data.allReturned).toBe(false);
      expect(disconnectStatus.data.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'host-1', returned: true }),
        expect.objectContaining({ id: 'player-2', returned: false })
      ]));

      const blockedStart = await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'ERROR');
      expect(blockedStart.data.code).toBe('INVALID_ACTION');

      const reconnectClient = await createClient();
      const reconnectAcceptedPromise = waitForMessage(reconnectClient, 'RECONNECT_ACCEPTED');
      const snapshotPromise = waitForMessage(reconnectClient, 'GAME_SNAPSHOT');
      const reconnectStatusPromise = waitForMessage(reconnectClient, 'RETURN_TO_ROOM_STATUS');
      reconnectClient.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId,
          sessionId: playerSessionId
        }
      }));

      const reconnectAccepted = await reconnectAcceptedPromise;
      expect(reconnectAccepted.type).toBe('RECONNECT_ACCEPTED');
      await snapshotPromise;
      const reconnectStatus = await reconnectStatusPromise;
      expect(reconnectStatus.data.allReturned).toBe(false);
      expect(reconnectStatus.data.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'host-1', returned: true }),
        expect.objectContaining({ id: 'player-2', returned: false })
      ]));

      const hostAllReturnedPromise = waitForMessage(host, 'RETURN_TO_ROOM_STATUS');
      const playerReturnStatus = await sendAndReceive(reconnectClient, {
        type: 'RETURN_TO_ROOM',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {}
      }, 'RETURN_TO_ROOM_STATUS');
      const hostAllReturnedStatus = await hostAllReturnedPromise;
      expect(playerReturnStatus.data.allReturned).toBe(true);
      expect(hostAllReturnedStatus.data.allReturned).toBe(true);

      const nextRound = await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');
      expect(nextRound.type).toBe('GAME_STARTED');

      host.close();
      reconnectClient.close();
    });

    it('should allow host to reconnect and resume game', async () => {
      const host = await createClient();
      const player = await createClient();
      const roomId = `host-reconnect-${Date.now().toString(36)}`;
      const hostSessionId = 'sess-host-rc';

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: hostSessionId }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2', sessionId: 'sess-player-2' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: {} }
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      // Send a game action to populate snapshot
      await sendAndReceive(host, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-1' },
          gameState: { turn: 1, marker: 'test' }
        }
      }, 'GAME_STATE_UPDATE');
      await waitForMessage(player, 'GAME_STATE_UPDATE');

      // Host disconnects
      const statusPromise = waitForMessage(player, 'RETURN_TO_ROOM_STATUS');
      host.close();
      const disconnectStatus = await statusPromise;
      expect(disconnectStatus.data.isHostDisconnected).toBe(true);

      // Host reconnects
      const reconnectHost = await createClient();
      const acceptedPromise = waitForMessage(reconnectHost, 'RECONNECT_ACCEPTED');
      const snapshotPromise = waitForMessage(reconnectHost, 'GAME_SNAPSHOT');
      const playerReconnectedPromise = waitForMessage(player, 'PLAYER_RECONNECTED');

      reconnectHost.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, sessionId: hostSessionId }
      }));

      const accepted = await acceptedPromise;
      const snapshot = await snapshotPromise;
      const playerReconnected = await playerReconnectedPromise;

      expect(accepted.type).toBe('RECONNECT_ACCEPTED');
      expect(snapshot.type).toBe('GAME_SNAPSHOT');
      expect(snapshot.data.gameState).toEqual(expect.objectContaining({ turn: 1, marker: 'test' }));
      expect(playerReconnected.playerId).toBe('host-1');

      // Game should be unfrozen - player can send actions now
      const actionPromise = waitForMessage(reconnectHost, 'GAME_STATE_UPDATE');
      player.send(JSON.stringify({
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { actionType: 'PLAY_CARD', actionData: { cardId: 'card-2' } }
      }));

      const update = await actionPromise;
      expect(update.type).toBe('GAME_STATE_UPDATE');
      expect(update.data.lastAction.playerId).toBe('player-2');

      reconnectHost.close();
      player.close();
    });

    it('should reject reconnect when reconnect session is expired', async () => {
      const host = await createClient();
      const player = await createClient();
      const roomId = `reconnect-expired-${Date.now().toString(36)}`;
      const playerSessionId = 'sess-player-expired';

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          roomId,
          nickname: 'Host',
          gameType: 'uno',
          sessionId: 'sess-host-1'
        }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId,
          nickname: 'Player2',
          gameType: 'uno',
          sessionId: playerSessionId
        }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: { initialState: { players: [] } } }
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      const disconnectStatusPromise = waitForMessage(host, 'RETURN_TO_ROOM_STATUS');
      player.close();
      const disconnectStatus = await disconnectStatusPromise;
      expect(disconnectStatus.data.allReturned).toBe(false);

      // Force reconnect session expiry for deterministic integration test
      const room = server.roomManager.getRoom(roomId);
      const reconnectSession = room?.reconnectSessions?.get('player-2');
      expect(reconnectSession).toBeDefined();
      reconnectSession.expiresAt = Date.now() - 1;
      room.reconnectSessions.set('player-2', reconnectSession);

      const reconnectClient = await createClient();
      const rejectedPromise = waitForMessage(reconnectClient, 'RECONNECT_REJECTED');
      reconnectClient.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          roomId,
          sessionId: playerSessionId
        }
      }));

      const rejected = await rejectedPromise;
      expect(rejected.type).toBe('RECONNECT_REJECTED');
      expect(rejected.data.reasonCode).toBe('RECONNECT_SESSION_EXPIRED');

      host.close();
      reconnectClient.close();
    });

    it('should preserve snapshot when non-host action is rejected during host disconnect (Bug 7)', async () => {
      const host = await createClient();
      const player = await createClient();
      const roomId = `bug7-desync-${Date.now().toString(36)}`;
      const hostSessionId = 'sess-host-b7';

      // Join room
      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: hostSessionId }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2', sessionId: 'sess-p2-b7' }
      }, 'PLAYER_JOINED');

      // Start game with an initial state
      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          gameConfig: {
            initialState: { turn: 0, hands: { 'host-1': [1, 2], 'player-2': [3, 4] } }
          }
        }
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      // Player-2 plays a card (advances state)
      // Set up host listener before sending to avoid race condition
      const hostUpdatePromise = waitForMessage(host, 'GAME_STATE_UPDATE');
      await sendAndReceive(player, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-3' },
          gameState: { turn: 1, lastCard: 'card-3' }
        }
      }, 'GAME_STATE_UPDATE');
      await hostUpdatePromise;

      // Host disconnects — server freezes actions
      const disconnectPromise = waitForMessage(player, 'PLAYER_DISCONNECTED');
      host.close();
      await disconnectPromise;

      // Player-2 tries to play another card — should be rejected
      const errorResponse = await sendAndReceive(player, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-4' },
          gameState: { turn: 2, lastCard: 'card-4' }
        }
      }, 'ERROR');
      expect(errorResponse.data.code).toBe('HOST_DISCONNECTED');

      // Snapshot should NOT have advanced to turn 2
      const room = server.roomManager.getRoom(roomId);
      expect(room.gameSnapshot.gameState).toEqual(
        expect.objectContaining({ turn: 1, lastCard: 'card-3' })
      );

      // Host reconnects — gets the turn-1 snapshot (not turn-2)
      const reconnectHost = await createClient();
      const acceptedPromise = waitForMessage(reconnectHost, 'RECONNECT_ACCEPTED');
      const snapshotPromise = waitForMessage(reconnectHost, 'GAME_SNAPSHOT');
      const playerReconnectedPromise = waitForMessage(player, 'PLAYER_RECONNECTED');

      reconnectHost.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, sessionId: hostSessionId }
      }));

      await acceptedPromise;
      const snapshot = await snapshotPromise;
      await playerReconnectedPromise;

      // Verify the snapshot is at turn 1 (not turn 2 which was rejected)
      expect(snapshot.data.gameState).toEqual(
        expect.objectContaining({ turn: 1, lastCard: 'card-3' })
      );

      // After reconnection, game should be unfrozen — host can send actions
      const update = await sendAndReceive(reconnectHost, {
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'card-4' },
          gameState: { turn: 2, lastCard: 'card-4' }
        }
      }, 'GAME_STATE_UPDATE');

      expect(update.data.lastAction.actionData.cardId).toBe('card-4');

      reconnectHost.close();
      player.close();
    });

    it('should send RETURN_TO_ROOM_STATUS during reconnection (Bug 6 context)', async () => {
      const host = await createClient();
      const player = await createClient();
      const roomId = `bug6-rtr-${Date.now().toString(36)}`;
      const playerSessionId = 'sess-p-b6';

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: 'sess-h-b6' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2', sessionId: playerSessionId }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: { initialState: { turn: 0 } } }
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      // Player disconnects
      const disconnectPromise = waitForMessage(host, 'PLAYER_DISCONNECTED');
      player.close();
      await disconnectPromise;

      // Player reconnects — should receive RETURN_TO_ROOM_STATUS
      const reconnectPlayer = await createClient();
      const snapshotPromise = waitForMessage(reconnectPlayer, 'GAME_SNAPSHOT');
      const rtrStatusPromise = waitForMessage(reconnectPlayer, 'RETURN_TO_ROOM_STATUS');

      reconnectPlayer.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, sessionId: playerSessionId }
      }));

      const snapshot = await snapshotPromise;
      const rtrStatus = await rtrStatusPromise;

      // Server sends both snapshot and return-to-room status
      expect(snapshot.type).toBe('GAME_SNAPSHOT');
      expect(rtrStatus.type).toBe('RETURN_TO_ROOM_STATUS');
      // The frontend guards this with isRunning check (Bug 6 fix)

      host.close();
      reconnectPlayer.close();
    });

    it('should handle multiple reconnect-disconnect cycles for same player', async () => {
      const host = await createClient();
      let player = await createClient();
      const roomId = `multi-rc-${Date.now().toString(36)}`;
      const playerSessionId = 'sess-multi-p';

      await sendAndReceive(host, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { roomId, nickname: 'Host', gameType: 'uno', sessionId: 'sess-multi-h' }
      }, 'PLAYER_JOINED');

      await sendAndReceive(player, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, nickname: 'Player2', sessionId: playerSessionId }
      }, 'PLAYER_JOINED');

      await sendAndReceive(host, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: { gameConfig: { initialState: { turn: 0 } } }
      }, 'GAME_STARTED');
      await waitForMessage(player, 'GAME_STARTED');

      // -- First disconnect/reconnect cycle --
      let disconnectPromise = waitForMessage(host, 'PLAYER_DISCONNECTED');
      player.close();
      await disconnectPromise;

      player = await createClient();
      let acceptedPromise = waitForMessage(player, 'RECONNECT_ACCEPTED');
      let reconnectedPromise = waitForMessage(host, 'PLAYER_RECONNECTED');

      player.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, sessionId: playerSessionId }
      }));

      await acceptedPromise;
      await reconnectedPromise;

      // Verify game works after first reconnect
      const action1Promise = waitForMessage(host, 'GAME_STATE_UPDATE');
      player.send(JSON.stringify({
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          actionType: 'PLAY_CARD',
          actionData: { cardId: 'c1' },
          gameState: { turn: 1 }
        }
      }));
      const action1 = await action1Promise;
      expect(action1.data.lastAction.actionData.cardId).toBe('c1');

      // -- Second disconnect/reconnect cycle --
      disconnectPromise = waitForMessage(host, 'PLAYER_DISCONNECTED');
      player.close();
      await disconnectPromise;

      player = await createClient();
      acceptedPromise = waitForMessage(player, 'RECONNECT_ACCEPTED');
      reconnectedPromise = waitForMessage(host, 'PLAYER_RECONNECTED');

      player.send(JSON.stringify({
        type: 'RECONNECT_REQUEST',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: { roomId, sessionId: playerSessionId }
      }));

      await acceptedPromise;
      await reconnectedPromise;

      // Verify snapshot reflects state from first reconnect cycle
      const snapshotPromise = waitForMessage(player, 'GAME_SNAPSHOT');
      // Snapshot was already sent during reconnect — re-request won't resend,
      // but we can verify via the room state
      const room = server.roomManager.getRoom(roomId);
      expect(room.gameSnapshot.gameState).toEqual(
        expect.objectContaining({ turn: 1 })
      );

      // Verify game still works
      const action2Promise = waitForMessage(host, 'GAME_STATE_UPDATE');
      player.send(JSON.stringify({
        type: 'GAME_ACTION',
        timestamp: Date.now(),
        playerId: 'player-2',
        data: {
          actionType: 'DRAW_CARD',
          actionData: {},
          gameState: { turn: 2 }
        }
      }));
      const action2 = await action2Promise;
      expect(action2.data.lastAction.actionType).toBe('DRAW_CARD');

      host.close();
      player.close();
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid JSON', async () => {
      const client = await createClient();

      const errorPromise = waitForMessage(client, 'ERROR');
      client.send('not valid json');

      const msg = await errorPromise;
      expect(msg.type).toBe('ERROR');
      expect(msg.data.code).toBe('INVALID_MESSAGE_FORMAT');
      client.close();
    });

    it('should return error for missing required fields', async () => {
      const client = await createClient();

      const response = await sendAndReceive(client, {
        type: 'JOIN'
        // Missing timestamp and playerId
      }, 'ERROR');

      expect(response.type).toBe('ERROR');
      expect(response.data.code).toBe('INVALID_MESSAGE_FORMAT');
      client.close();
    });
  });

  describe('Server Stats', () => {
    it('should track connection and room stats', async () => {
      const client = await createClient();

      // Initially
      let stats = server.getStats();
      expect(stats.connections).toBe(1);
      expect(stats.rooms).toBe(0);

      // After joining room
      await sendAndReceive(client, {
        type: 'JOIN',
        timestamp: Date.now(),
        playerId: 'player-1',
        data: { roomId: 'test-room', nickname: 'Test', gameType: 'uno' }
      }, 'PLAYER_JOINED');

      stats = server.getStats();
      expect(stats.rooms).toBe(1);
      expect(stats.playersInRooms).toBe(1);

      client.close();
    });
  });
});
