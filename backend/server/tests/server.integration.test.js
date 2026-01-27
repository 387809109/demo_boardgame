/**
 * Server Integration Tests
 * T-B051
 *
 * End-to-end tests for the WebSocket server
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import { GameServer } from '../index.js';

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
      if (server.httpServer) {
        await new Promise((resolve) => {
          server.httpServer.close(resolve);
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

    it('should broadcast GAME_ENDED when host disconnects during game', async () => {
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

      // Start game
      await sendAndReceive(client1, {
        type: 'START_GAME',
        timestamp: Date.now(),
        playerId: 'host-1',
        data: {}
      }, 'GAME_STARTED');

      await waitForMessage(client2, 'GAME_STARTED');

      // Set up listener for player 2
      const gameEndedPromise = waitForMessage(client2, 'GAME_ENDED');

      // Host disconnects
      client1.close();

      const gameEnded = await gameEndedPromise;

      expect(gameEnded.type).toBe('GAME_ENDED');
      expect(gameEnded.data.reason).toBe('host_disconnected');

      client2.close();
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

  describe('Health Endpoints', () => {
    it('should return ok from /health', async () => {
      const res = await fetch(`http://localhost:${TEST_PORT}/health`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.metrics).toBeDefined();
    });

    it('should return stats from /stats', async () => {
      const res = await fetch(`http://localhost:${TEST_PORT}/stats`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.metrics).toBeDefined();
      expect(body.metrics.counters).toBeDefined();
    });
  });
});
