/**
 * Network Client Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NetworkClient } from './network.js';

// Mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onerror = null;
    this.onclose = null;
    this.onmessage = null;
    this.lastSent = null;
    this.sentMessages = [];
  }

  send(data) {
    this.lastSent = data;
    this.sentMessages.push(data);
  }

  close(code, reason) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  simulateClose(code, reason) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

describe('NetworkClient', () => {
  let client;
  let mockWs;
  let originalWebSocket;

  beforeEach(() => {
    // Save original and mock WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket constructor with static properties
    const MockWebSocketConstructor = vi.fn((url) => {
      mockWs = new MockWebSocket(url);
      return mockWs;
    });

    // Add static properties to the mock constructor
    MockWebSocketConstructor.CONNECTING = MockWebSocket.CONNECTING;
    MockWebSocketConstructor.OPEN = MockWebSocket.OPEN;
    MockWebSocketConstructor.CLOSING = MockWebSocket.CLOSING;
    MockWebSocketConstructor.CLOSED = MockWebSocket.CLOSED;

    globalThis.WebSocket = MockWebSocketConstructor;

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    client = new NetworkClient('ws://localhost:7777');
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with server URL', () => {
      expect(client.serverUrl).toBe('ws://localhost:7777');
    });

    it('should initialize with null WebSocket', () => {
      expect(client.ws).toBeNull();
    });

    it('should generate a unique player ID', () => {
      expect(client.playerId).toMatch(/^player-[a-z0-9]+-[a-z0-9]+$/);
    });

    it('should generate different player IDs for different instances', () => {
      const client2 = new NetworkClient('ws://localhost:7777');
      expect(client.playerId).not.toBe(client2.playerId);
    });

    it('should initialize as not connected', () => {
      expect(client.connected).toBe(false);
    });

    it('should initialize with zero latency', () => {
      expect(client.latency).toBe(0);
    });

    it('should initialize empty message handlers', () => {
      expect(client.messageHandlers.size).toBe(0);
    });
  });

  describe('connect', () => {
    it('should create WebSocket with server URL', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      expect(globalThis.WebSocket).toHaveBeenCalledWith('ws://localhost:7777');
    });

    it('should resolve promise on successful connection', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();

      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('should set connected to true on success', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      expect(client.connected).toBe(true);
    });

    it('should emit connected event', async () => {
      const handler = vi.fn();
      client.on('connected', handler);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should reject promise on error', async () => {
      const connectPromise = client.connect();
      const error = new Error('Connection failed');
      mockWs.simulateError(error);

      await expect(connectPromise).rejects.toBe(error);
    });

    it('should emit error event on connection failure', async () => {
      const handler = vi.fn();
      client.on('error', handler);

      const connectPromise = client.connect();
      const error = new Error('Connection failed');
      mockWs.simulateError(error);

      try {
        await connectPromise;
      } catch (e) {
        // Expected
      }

      expect(handler).toHaveBeenCalledWith(error);
    });

    it('should resolve immediately if already connected', async () => {
      const connectPromise1 = client.connect();
      mockWs.simulateOpen();
      await connectPromise1;

      // Store the current mock
      const firstMock = mockWs;

      // Second connect should not create new WebSocket
      await client.connect();

      // Should still be the same mock (no new WebSocket created)
      expect(client.ws).toBe(firstMock);
    });

    it('should handle close event', async () => {
      const handler = vi.fn();
      client.on('disconnected', handler);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      mockWs.simulateClose(1000, 'Normal closure');

      expect(handler).toHaveBeenCalledWith({ code: 1000, reason: 'Normal closure' });
      expect(client.connected).toBe(false);
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it('should close WebSocket', () => {
      const closeSpy = vi.spyOn(mockWs, 'close');
      client.disconnect();

      expect(closeSpy).toHaveBeenCalledWith(1000, 'Client disconnect');
    });

    it('should set ws to null', () => {
      client.disconnect();
      expect(client.ws).toBeNull();
    });

    it('should set connected to false', () => {
      client.disconnect();
      expect(client.connected).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      client.ws = null;
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it('should send formatted message', () => {
      const beforeTime = Date.now();
      client.send('TEST_TYPE', { key: 'value' });
      const afterTime = Date.now();

      const sent = JSON.parse(mockWs.lastSent);
      expect(sent.type).toBe('TEST_TYPE');
      expect(sent.playerId).toBe(client.playerId);
      expect(sent.data).toEqual({ key: 'value' });
      expect(sent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(sent.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should send message with empty data by default', () => {
      client.send('TEST_TYPE');

      const sent = JSON.parse(mockWs.lastSent);
      expect(sent.data).toEqual({});
    });

    it('should emit error when not connected', () => {
      const handler = vi.fn();
      client.on('error', handler);

      client.ws = null;
      client.send('TEST_TYPE', {});

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].message).toBe('Not connected to server');
    });

    it('should emit error when WebSocket not open', () => {
      const handler = vi.fn();
      client.on('error', handler);

      mockWs.readyState = MockWebSocket.CONNECTING;
      client.send('TEST_TYPE', {});

      expect(handler).toHaveBeenCalled();
    });

    it('should catch and emit send errors', () => {
      const handler = vi.fn();
      client.on('error', handler);

      const error = new Error('Send failed');
      mockWs.send = () => { throw error; };

      client.send('TEST_TYPE', {});

      expect(handler).toHaveBeenCalledWith(error);
    });
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      client.onMessage('TEST_TYPE', handler);

      expect(client.messageHandlers.has('TEST_TYPE')).toBe(true);
    });

    it('should call handler when message received', async () => {
      const handler = vi.fn();
      client.onMessage('PLAYER_JOINED', handler);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      mockWs.simulateMessage({
        type: 'PLAYER_JOINED',
        data: { playerId: 'p1', nickname: 'Test' },
        timestamp: Date.now()
      });

      expect(handler).toHaveBeenCalledWith(
        { playerId: 'p1', nickname: 'Test' },
        expect.objectContaining({ type: 'PLAYER_JOINED' })
      );
    });

    it('should support multiple handlers for same message type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.onMessage('TEST', handler1);
      client.onMessage('TEST', handler2);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      mockWs.simulateMessage({ type: 'TEST', data: {}, timestamp: Date.now() });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = client.onMessage('TEST', handler);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      unsubscribe();
      mockWs.simulateMessage({ type: 'TEST', data: {}, timestamp: Date.now() });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should catch errors in handlers', async () => {
      const handler = vi.fn(() => { throw new Error('Handler error'); });
      client.onMessage('TEST', handler);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      // Should not throw
      expect(() => {
        mockWs.simulateMessage({ type: 'TEST', data: {}, timestamp: Date.now() });
      }).not.toThrow();
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it('should emit general message event', () => {
      const handler = vi.fn();
      client.on('message', handler);

      mockWs.simulateMessage({ type: 'ANY', data: {}, timestamp: Date.now() });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit typed message event', () => {
      const handler = vi.fn();
      client.on('message:GAME_STATE_UPDATE', handler);

      mockWs.simulateMessage({
        type: 'GAME_STATE_UPDATE',
        data: { state: 'test' },
        timestamp: Date.now()
      });

      expect(handler).toHaveBeenCalledWith({ state: 'test' }, expect.any(Object));
    });

    it('should handle malformed JSON gracefully', () => {
      mockWs.onmessage({ data: 'not valid json' });
      // Should not throw, just log error
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('PONG handling', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it('should calculate latency from PONG', () => {
      client._lastPingTime = Date.now() - 50;
      mockWs.simulateMessage({ type: 'PONG', data: {}, timestamp: Date.now() });

      expect(client.latency).toBeGreaterThanOrEqual(50);
    });

    it('should emit latency event on PONG', () => {
      const handler = vi.fn();
      client.on('latency', handler);

      client._lastPingTime = Date.now() - 100;
      mockWs.simulateMessage({ type: 'PONG', data: {}, timestamp: Date.now() });

      expect(handler).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should clear heartbeat timeout on PONG', () => {
      client._heartbeatTimeout = setTimeout(() => {}, 10000);
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

      mockWs.simulateMessage({ type: 'PONG', data: {}, timestamp: Date.now() });

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('ERROR handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    it('should emit serverError event', () => {
      const handler = vi.fn();
      client.on('serverError', handler);

      mockWs.simulateMessage({
        type: 'ERROR',
        data: { code: 'ROOM_FULL', message: 'Room is full', severity: 'warning' },
        timestamp: Date.now()
      });

      expect(handler).toHaveBeenCalledWith({
        code: 'ROOM_FULL',
        message: 'Room is full',
        severity: 'warning'
      });
    });

    it('should disconnect on fatal error', () => {
      const disconnectSpy = vi.spyOn(client, 'disconnect');

      mockWs.simulateMessage({
        type: 'ERROR',
        data: { code: 'INVALID_TOKEN', message: 'Auth failed', severity: 'fatal' },
        timestamp: Date.now()
      });

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should not disconnect on non-fatal error', () => {
      const disconnectSpy = vi.spyOn(client, 'disconnect');

      mockWs.simulateMessage({
        type: 'ERROR',
        data: { code: 'INVALID_MOVE', message: 'Invalid move', severity: 'warning' },
        timestamp: Date.now()
      });

      expect(disconnectSpy).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should start heartbeat on connect', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(30000);

      // Should have sent PING
      const sentMessages = mockWs.sentMessages.map(m => JSON.parse(m));
      expect(sentMessages.some(m => m.type === 'PING')).toBe(true);
    });

    it('should send PING every 30 seconds', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      vi.advanceTimersByTime(30000);
      expect(mockWs.sentMessages.filter(m => JSON.parse(m).type === 'PING')).toHaveLength(1);

      // Respond with PONG to prevent timeout
      mockWs.simulateMessage({ type: 'PONG', data: {}, timestamp: Date.now() });

      vi.advanceTimersByTime(30000);
      expect(mockWs.sentMessages.filter(m => JSON.parse(m).type === 'PING')).toHaveLength(2);
    });

    it('should disconnect after heartbeat timeout', async () => {
      const timeoutHandler = vi.fn();
      client.on('timeout', timeoutHandler);

      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      // Trigger PING
      vi.advanceTimersByTime(30000);

      // Don't respond with PONG, wait for timeout (10 seconds)
      vi.advanceTimersByTime(10000);

      expect(timeoutHandler).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });

    it('should stop heartbeat on disconnect', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      client.disconnect();

      // Advance time - should not throw or cause issues
      vi.advanceTimersByTime(60000);
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;
    });

    describe('joinRoom', () => {
      it('should send JOIN message with correct data', () => {
        client.joinRoom('room123', 'TestPlayer', 'uno');

        const sent = JSON.parse(mockWs.lastSent);
        expect(sent.type).toBe('JOIN');
        expect(sent.data).toEqual({
          roomId: 'room123',
          nickname: 'TestPlayer',
          gameType: 'uno'
        });
      });
    });

    describe('leaveRoom', () => {
      it('should send LEAVE message', () => {
        client.leaveRoom();

        const sent = JSON.parse(mockWs.lastSent);
        expect(sent.type).toBe('LEAVE');
        expect(sent.data).toEqual({});
      });
    });

    describe('startGame', () => {
      it('should send START_GAME message with config', () => {
        const config = { maxPlayers: 4, options: { test: true } };
        client.startGame('uno', config);

        const sent = JSON.parse(mockWs.lastSent);
        expect(sent.type).toBe('START_GAME');
        expect(sent.data).toEqual({
          gameType: 'uno',
          gameConfig: config
        });
      });
    });

    describe('sendGameAction', () => {
      it('should send GAME_ACTION message', () => {
        client.sendGameAction('playCard', { cardId: 'card-1' });

        const sent = JSON.parse(mockWs.lastSent);
        expect(sent.type).toBe('GAME_ACTION');
        expect(sent.data).toEqual({
          actionType: 'playCard',
          actionData: { cardId: 'card-1' }
        });
      });
    });

    describe('sendChat', () => {
      it('should send CHAT_MESSAGE with default public flag', () => {
        client.sendChat('Hello!');

        const sent = JSON.parse(mockWs.lastSent);
        expect(sent.type).toBe('CHAT_MESSAGE');
        expect(sent.data).toEqual({
          message: 'Hello!',
          isPublic: true
        });
      });

      it('should send private chat message', () => {
        client.sendChat('Secret', false);

        const sent = JSON.parse(mockWs.lastSent);
        expect(sent.data.isPublic).toBe(false);
      });
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected and WebSocket is open', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false when connected flag is true but WebSocket not open', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      mockWs.readyState = MockWebSocket.CLOSING;
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('getLatency', () => {
    it('should return current latency', () => {
      client.latency = 150;
      expect(client.getLatency()).toBe(150);
    });
  });

  describe('setServerUrl', () => {
    it('should update server URL when not connected', () => {
      client.setServerUrl('ws://newserver:8080');
      expect(client.serverUrl).toBe('ws://newserver:8080');
    });

    it('should throw error when connected', async () => {
      const connectPromise = client.connect();
      mockWs.simulateOpen();
      await connectPromise;

      expect(() => client.setServerUrl('ws://newserver:8080'))
        .toThrow('Cannot change URL while connected');
    });
  });

  describe('player ID generation', () => {
    it('should generate IDs with correct format', () => {
      // Create several clients and verify ID format
      for (let i = 0; i < 10; i++) {
        const c = new NetworkClient('ws://test');
        expect(c.playerId).toMatch(/^player-[a-z0-9]+-[a-z0-9]+$/);
      }
    });
  });
});
