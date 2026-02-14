/**
 * CloudNetworkClient Unit Tests
 *
 * Covers the cloud (Supabase Realtime) reconnect protocol including:
 *  - Channel lifecycle (joinRoom, leaveRoom, requestReconnect)
 *  - Stale channel callback guards (Bug 4)
 *  - Channel cleanup on requestReconnect (Bug 3)
 *  - Acting host calculation with exclusion (Bug 5)
 *  - Presence grace timers for disconnected players
 *  - Reconnect request handling by acting host
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudNetworkClient } from './cloud-network.js';

// ── Mock Supabase helpers ────────────────────────────────

/**
 * Create a mock Supabase Realtime channel with controllable callbacks.
 */
function createMockChannel(name) {
  const broadcastHandlers = new Map();
  const presenceHandlers = {};
  let presenceState = {};

  const channel = {
    _name: name,
    _subscribeCallback: null,

    on: vi.fn((type, filter, callback) => {
      if (type === 'broadcast') {
        broadcastHandlers.set(filter.event, callback);
      } else if (type === 'presence') {
        presenceHandlers[filter.event] = callback;
      }
      return channel;
    }),

    subscribe: vi.fn((callback) => {
      channel._subscribeCallback = callback;
      return channel;
    }),

    track: vi.fn(() => Promise.resolve()),
    untrack: vi.fn(() => Promise.resolve()),
    send: vi.fn(),

    presenceState: vi.fn(() => presenceState),

    // ── test helpers ──
    _broadcastHandlers: broadcastHandlers,
    _presenceHandlers: presenceHandlers,

    /** Fire the subscribe callback with the given status */
    _fireSubscribe(status) {
      if (channel._subscribeCallback) {
        return channel._subscribeCallback(status);
      }
    },

    /** Simulate a broadcast event arriving */
    _simulateBroadcast(event, payload) {
      const handler = broadcastHandlers.get(event);
      if (handler) handler({ payload });
    },

    _simulatePresenceSync() {
      presenceHandlers.sync?.();
    },

    _simulatePresenceJoin(presences) {
      presenceHandlers.join?.({ newPresences: presences });
    },

    _simulatePresenceLeave(presences) {
      presenceHandlers.leave?.({ leftPresences: presences });
    },

    _setPresenceState(state) {
      presenceState = state;
    }
  };

  return channel;
}

/**
 * Create a mock Supabase client.
 */
function createMockSupabase(userId = 'player-1') {
  const channels = [];

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null
      })
    },
    channel: vi.fn((name, _opts) => {
      const ch = createMockChannel(name);
      channels.push(ch);
      return ch;
    }),
    removeChannel: vi.fn()
  };

  return { supabase, channels };
}

/** Get the most recently created channel from the mock */
function latestChannel(channels) {
  return channels[channels.length - 1];
}

// ── Tests ────────────────────────────────────────────────

describe('CloudNetworkClient', () => {
  let client;
  let supabase;
  let channels;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    ({ supabase, channels } = createMockSupabase('player-1'));
    client = new CloudNetworkClient(supabase);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── connect ────────────────────────────────────────────

  describe('connect', () => {
    it('should set playerId and emit connected', async () => {
      const handler = vi.fn();
      client.on('connected', handler);

      await client.connect();

      expect(client.playerId).toBe('player-1');
      expect(client.connected).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should throw when not authenticated', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'not authenticated' }
      });

      await expect(client.connect()).rejects.toThrow('not authenticated');
      expect(client.connected).toBe(false);
    });

    it('should skip if already connected', async () => {
      await client.connect();
      await client.connect();

      expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    });
  });

  // ── joinRoom ───────────────────────────────────────────

  describe('joinRoom', () => {
    it('should create a channel and subscribe', () => {
      client.joinRoom('room-1', 'Alice', 'uno');

      expect(supabase.channel).toHaveBeenCalledWith('room:room-1', {
        config: { broadcast: { self: true } }
      });
      const ch = latestChannel(channels);
      expect(ch.subscribe).toHaveBeenCalled();
    });

    it('should track presence after SUBSCRIBED', async () => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);

      await ch._fireSubscribe('SUBSCRIBED');

      expect(ch.track).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          nickname: 'Alice',
          gameType: 'uno'
        })
      );
    });

    it('should leave existing room before joining a new one', () => {
      client.joinRoom('room-1', 'Alice', 'uno');
      const firstCh = latestChannel(channels);

      client.joinRoom('room-2', 'Alice', 'uno');

      expect(supabase.removeChannel).toHaveBeenCalledWith(firstCh);
    });

    it('should emit error on CHANNEL_ERROR when game not active', () => {
      const handler = vi.fn();
      client.on('error', handler);

      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);
      ch._fireSubscribe('CHANNEL_ERROR');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit disconnected on CHANNEL_ERROR when game is active', () => {
      const handler = vi.fn();
      client.on('disconnected', handler);

      client.joinRoom('room-1', 'Alice', 'uno');
      client.setGameActive(true);
      const ch = latestChannel(channels);
      ch._fireSubscribe('CHANNEL_ERROR');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(client.connected).toBe(false);
    });

    it('should ignore subscribe callback from a replaced channel (Bug 4)', () => {
      const errorHandler = vi.fn();
      const disconnHandler = vi.fn();
      client.on('error', errorHandler);
      client.on('disconnected', disconnHandler);

      client.joinRoom('room-1', 'Alice', 'uno');
      const oldCh = latestChannel(channels);

      // Replace the channel (simulates requestReconnect or re-join)
      client.joinRoom('room-2', 'Alice', 'uno');

      // Old channel fires CLOSED — should be ignored
      oldCh._fireSubscribe('CLOSED');

      expect(errorHandler).not.toHaveBeenCalled();
      expect(disconnHandler).not.toHaveBeenCalled();
    });
  });

  // ── leaveRoom ──────────────────────────────────────────

  describe('leaveRoom', () => {
    it('should call removeChannel (not just unsubscribe)', () => {
      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);

      client.leaveRoom();

      expect(ch.untrack).toHaveBeenCalled();
      expect(supabase.removeChannel).toHaveBeenCalledWith(ch);
    });

    it('should clear grace timers for disconnected players', () => {
      client.joinRoom('room-1', 'Alice', 'uno');
      client.setGameActive(true);

      // Manually set up a disconnected player with timer
      const timer = setTimeout(() => {}, 60000);
      client._disconnectedPlayers.set('player-2', { nickname: 'Bob', timer });

      client.leaveRoom();

      expect(client._disconnectedPlayers.size).toBe(0);
    });

    it('should reset _gameActive', () => {
      client.joinRoom('room-1', 'Alice', 'uno');
      client.setGameActive(true);
      expect(client._gameActive).toBe(true);

      client.leaveRoom();

      expect(client._gameActive).toBe(false);
    });
  });

  // ── disconnect ─────────────────────────────────────────

  describe('disconnect', () => {
    it('should reset _originalHostId', () => {
      client._originalHostId = 'player-1';
      client.disconnect();

      expect(client._originalHostId).toBeNull();
      expect(client.connected).toBe(false);
    });
  });

  // ── send ───────────────────────────────────────────────

  describe('send', () => {
    it('should broadcast a message with correct format', () => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);

      client.send('GAME_ACTION', { actionType: 'play', actionData: { card: 1 } });

      expect(ch.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'GAME_ACTION',
        payload: expect.objectContaining({
          type: 'GAME_ACTION',
          playerId: 'player-1',
          data: { actionType: 'play', actionData: { card: 1 } }
        })
      });
    });

    it('should emit error if not in a room', () => {
      const handler = vi.fn();
      client.on('error', handler);

      client.send('GAME_ACTION', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── requestReconnect ───────────────────────────────────

  describe('requestReconnect', () => {
    beforeEach(() => {
      client.playerId = 'player-1';
      client._nickname = 'Alice';
      client._gameType = 'uno';
      client._joinedAt = 1000;
    });

    it('should remove old channel before creating new one (Bug 3)', async () => {
      // Setup existing channel
      client.joinRoom('room-1', 'Alice', 'uno');
      const oldCh = latestChannel(channels);

      const promise = client.requestReconnect('room-1');
      const newCh = latestChannel(channels);
      await newCh._fireSubscribe('SUBSCRIBED');
      await promise;

      expect(supabase.removeChannel).toHaveBeenCalledWith(oldCh);
      expect(newCh).not.toBe(oldCh);
    });

    it('should set connected=true on SUBSCRIBED (Bug 4 fix)', async () => {
      client.connected = false;

      const promise = client.requestReconnect('room-1');
      const ch = latestChannel(channels);
      await ch._fireSubscribe('SUBSCRIBED');
      await promise;

      expect(client.connected).toBe(true);
    });

    it('should track presence and send RECONNECT_REQUEST', async () => {
      const promise = client.requestReconnect('room-1');
      const ch = latestChannel(channels);
      await ch._fireSubscribe('SUBSCRIBED');
      await promise;

      expect(ch.track).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          nickname: 'Alice',
          joinedAt: 1000
        })
      );
      expect(ch.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RECONNECT_REQUEST',
          payload: expect.objectContaining({
            data: expect.objectContaining({
              playerId: 'player-1'
            })
          })
        })
      );
    });

    it('should reject on CHANNEL_ERROR before SUBSCRIBED', async () => {
      const promise = client.requestReconnect('room-1');
      const ch = latestChannel(channels);
      ch._fireSubscribe('CHANNEL_ERROR');

      await expect(promise).rejects.toThrow('Channel CHANNEL_ERROR');
    });

    it('should reject on TIMED_OUT before SUBSCRIBED', async () => {
      const promise = client.requestReconnect('room-1');
      const ch = latestChannel(channels);
      ch._fireSubscribe('TIMED_OUT');

      await expect(promise).rejects.toThrow('Channel TIMED_OUT');
    });

    it('should emit disconnected on CLOSED after SUBSCRIBED when game active', async () => {
      client.setGameActive(true);
      const disconnHandler = vi.fn();
      client.on('disconnected', disconnHandler);

      const promise = client.requestReconnect('room-1');
      const ch = latestChannel(channels);
      await ch._fireSubscribe('SUBSCRIBED');
      await promise;

      // Now fire CLOSED after already subscribed
      ch._fireSubscribe('CLOSED');

      expect(disconnHandler).toHaveBeenCalledTimes(1);
      expect(client.connected).toBe(false);
    });

    it('should ignore stale channel callback after a second requestReconnect (Bug 4)', async () => {
      const disconnHandler = vi.fn();
      client.on('disconnected', disconnHandler);

      // First requestReconnect
      const promise1 = client.requestReconnect('room-1');
      const ch1 = latestChannel(channels);
      await ch1._fireSubscribe('SUBSCRIBED');
      await promise1;

      // Second requestReconnect replaces the channel
      const promise2 = client.requestReconnect('room-1');
      const ch2 = latestChannel(channels);
      await ch2._fireSubscribe('SUBSCRIBED');
      await promise2;

      // Old channel fires CLOSED — should be ignored
      ch1._fireSubscribe('CLOSED');

      expect(disconnHandler).not.toHaveBeenCalled();
      expect(client.connected).toBe(true);
    });

    it('should not resolve twice if SUBSCRIBED fires multiple times', async () => {
      const promise = client.requestReconnect('room-1');
      const ch = latestChannel(channels);

      await ch._fireSubscribe('SUBSCRIBED');
      await ch._fireSubscribe('SUBSCRIBED'); // second call
      await promise;

      // track should only be called once
      expect(ch.track).toHaveBeenCalledTimes(1);
    });
  });

  // ── Broadcast handling ─────────────────────────────────

  describe('broadcast handling', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      ch = latestChannel(channels);
    });

    it('should skip own GAME_ACTION', () => {
      const handler = vi.fn();
      client.onMessage('GAME_STATE_UPDATE', handler);

      ch._simulateBroadcast('GAME_ACTION', {
        type: 'GAME_ACTION',
        playerId: 'player-1',
        data: { actionType: 'play' }
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should dispatch GAME_ACTION from others as GAME_STATE_UPDATE', () => {
      const handler = vi.fn();
      client.onMessage('GAME_STATE_UPDATE', handler);

      ch._simulateBroadcast('GAME_ACTION', {
        type: 'GAME_ACTION',
        playerId: 'player-2',
        data: { actionType: 'play', actionData: { card: 5 } }
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          lastAction: expect.objectContaining({
            playerId: 'player-2',
            actionType: 'play'
          })
        }),
        expect.any(Object)
      );
    });

    it('should dispatch START_GAME as GAME_STARTED', () => {
      const handler = vi.fn();
      client.onMessage('GAME_STARTED', handler);

      ch._simulateBroadcast('START_GAME', {
        type: 'START_GAME',
        playerId: 'player-1',
        data: { gameType: 'uno', gameConfig: { initialState: {} } }
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter targeted RECONNECT_ACCEPTED by targetPlayerId', () => {
      const handler = vi.fn();
      client.onMessage('RECONNECT_ACCEPTED', handler);

      // Not for us
      ch._simulateBroadcast('RECONNECT_ACCEPTED', {
        type: 'RECONNECT_ACCEPTED',
        playerId: 'cloud',
        data: { targetPlayerId: 'player-2' }
      });
      expect(handler).not.toHaveBeenCalled();

      // For us
      ch._simulateBroadcast('RECONNECT_ACCEPTED', {
        type: 'RECONNECT_ACCEPTED',
        playerId: 'cloud',
        data: { targetPlayerId: 'player-1' }
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should filter targeted GAME_SNAPSHOT by targetPlayerId', () => {
      const handler = vi.fn();
      client.onMessage('GAME_SNAPSHOT', handler);

      ch._simulateBroadcast('GAME_SNAPSHOT', {
        type: 'GAME_SNAPSHOT',
        playerId: 'cloud',
        data: { targetPlayerId: 'player-2', gameState: {} }
      });
      expect(handler).not.toHaveBeenCalled();

      ch._simulateBroadcast('GAME_SNAPSHOT', {
        type: 'GAME_SNAPSHOT',
        playerId: 'cloud',
        data: { targetPlayerId: 'player-1', gameState: {} }
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should dispatch PLAYER_DISCONNECTED as-is', () => {
      const handler = vi.fn();
      client.onMessage('PLAYER_DISCONNECTED', handler);

      ch._simulateBroadcast('PLAYER_DISCONNECTED', {
        type: 'PLAYER_DISCONNECTED',
        playerId: 'cloud',
        data: { playerId: 'player-2', nickname: 'Bob' }
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'player-2', nickname: 'Bob' }),
        expect.any(Object)
      );
    });

    it('should dispatch PLAYER_RECONNECTED as-is', () => {
      const handler = vi.fn();
      client.onMessage('PLAYER_RECONNECTED', handler);

      ch._simulateBroadcast('PLAYER_RECONNECTED', {
        type: 'PLAYER_RECONNECTED',
        playerId: 'cloud',
        data: { playerId: 'player-2' }
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── RECONNECT_REQUEST handling (Bug 5) ─────────────────

  describe('RECONNECT_REQUEST handling', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-2'; // We are player-2
      client.joinRoom('room-1', 'Bob', 'uno');
      ch = latestChannel(channels);
      client.setGameActive(true);
    });

    it('should only be processed by acting host (excluding requester) (Bug 5)', () => {
      const handler = vi.fn();
      client.onMessage('RECONNECT_REQUEST', handler);

      // Set presence: player-1 (joinedAt=100, host), player-2 (joinedAt=200)
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100, nickname: 'Alice' }],
        key2: [{ playerId: 'player-2', joinedAt: 200, nickname: 'Bob' }]
      });

      // Add player-1 as disconnected so verification passes
      client._disconnectedPlayers.set('player-1', {
        nickname: 'Alice',
        timer: setTimeout(() => {}, 60000)
      });

      // Player-1 (the host) reconnects. They've already re-joined Presence
      // with earlier joinedAt. Without exclusion, _isActingHost would return
      // false for player-2 and nobody handles the request.
      ch._simulateBroadcast('RECONNECT_REQUEST', {
        type: 'RECONNECT_REQUEST',
        playerId: 'player-1',
        data: { playerId: 'player-1', nickname: 'Alice' }
      });

      // player-2 IS the acting host when excluding player-1
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'player-1' }),
        expect.any(Object)
      );
    });

    it('should not process own reconnect request', () => {
      const handler = vi.fn();
      client.onMessage('RECONNECT_REQUEST', handler);

      ch._simulateBroadcast('RECONNECT_REQUEST', {
        type: 'RECONNECT_REQUEST',
        playerId: 'player-2',
        data: { playerId: 'player-2' }
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should reject if player was not in disconnectedPlayers', () => {
      ch._setPresenceState({
        key2: [{ playerId: 'player-2', joinedAt: 200, nickname: 'Bob' }]
      });

      ch._simulateBroadcast('RECONNECT_REQUEST', {
        type: 'RECONNECT_REQUEST',
        playerId: 'player-3',
        data: { playerId: 'player-3', nickname: 'Charlie' }
      });

      // Should have sent RECONNECT_REJECTED
      expect(ch.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RECONNECT_REJECTED',
          payload: expect.objectContaining({
            data: expect.objectContaining({
              targetPlayerId: 'player-3',
              reasonCode: 'NOT_IN_ROOM'
            })
          })
        })
      );
    });

    it('should accept and dispatch if player was disconnected', () => {
      const handler = vi.fn();
      client.onMessage('RECONNECT_REQUEST', handler);

      ch._setPresenceState({
        key2: [{ playerId: 'player-2', joinedAt: 200, nickname: 'Bob' }],
        key3: [{ playerId: 'player-3', joinedAt: 100, nickname: 'Charlie' }]
      });

      // Mark player-3 as disconnected
      const timer = setTimeout(() => {}, 60000);
      client._disconnectedPlayers.set('player-3', { nickname: 'Charlie', timer });

      ch._simulateBroadcast('RECONNECT_REQUEST', {
        type: 'RECONNECT_REQUEST',
        playerId: 'player-3',
        data: { playerId: 'player-3', nickname: 'Charlie' }
      });

      // Should send RECONNECT_ACCEPTED
      expect(ch.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RECONNECT_ACCEPTED',
          payload: expect.objectContaining({
            data: expect.objectContaining({
              targetPlayerId: 'player-3'
            })
          })
        })
      );

      // Should dispatch RECONNECT_REQUEST to app layer for snapshot
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: 'player-3' }),
        expect.any(Object)
      );

      // Should clear from disconnectedPlayers
      expect(client._disconnectedPlayers.has('player-3')).toBe(false);

      // Should send PLAYER_RECONNECTED
      expect(ch.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'PLAYER_RECONNECTED',
          payload: expect.objectContaining({
            data: expect.objectContaining({
              playerId: 'player-3'
            })
          })
        })
      );
    });
  });

  // ── _isActingHostExcluding ─────────────────────────────

  describe('_isActingHostExcluding', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-2';
      client.joinRoom('room-1', 'Bob', 'uno');
      ch = latestChannel(channels);
    });

    it('should return true when this client is earliest after excluding', () => {
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100 }],
        key2: [{ playerId: 'player-2', joinedAt: 200 }]
      });

      // Exclude player-1: player-2 becomes the only one → acting host
      expect(client._isActingHostExcluding('player-1')).toBe(true);
    });

    it('should return false when another client is earlier after excluding', () => {
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100 }],
        key2: [{ playerId: 'player-2', joinedAt: 200 }],
        key3: [{ playerId: 'player-3', joinedAt: 150 }]
      });

      // Exclude player-1: player-3 (joinedAt=150) is earlier than player-2 (200)
      expect(client._isActingHostExcluding('player-1')).toBe(false);
    });

    it('should return false when no players remain', () => {
      ch._setPresenceState({
        key2: [{ playerId: 'player-2', joinedAt: 200 }]
      });

      expect(client._isActingHostExcluding('player-2')).toBe(false);
    });
  });

  // ── _isActingHost ──────────────────────────────────────

  describe('_isActingHost', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      ch = latestChannel(channels);
    });

    it('should return true when this client has earliest joinedAt', () => {
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100 }],
        key2: [{ playerId: 'player-2', joinedAt: 200 }]
      });

      expect(client._isActingHost()).toBe(true);
    });

    it('should return false when another client is earlier', () => {
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 200 }],
        key2: [{ playerId: 'player-2', joinedAt: 100 }]
      });

      expect(client._isActingHost()).toBe(false);
    });
  });

  // ── Presence: grace timers during active game ──────────

  describe('Presence leave during active game', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      ch = latestChannel(channels);
      client.setGameActive(true);
    });

    it('should dispatch PLAYER_DISCONNECTED and start grace timer', () => {
      const disconnHandler = vi.fn();
      client.onMessage('PLAYER_DISCONNECTED', disconnHandler);

      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100, nickname: 'Alice' }]
      });

      ch._simulatePresenceLeave([{
        playerId: 'player-2',
        joinedAt: 200,
        nickname: 'Bob'
      }]);

      expect(disconnHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-2',
          nickname: 'Bob',
          reconnectWindowMs: 60000
        }),
        expect.any(Object)
      );
      expect(client._disconnectedPlayers.has('player-2')).toBe(true);
    });

    it('should dispatch PLAYER_LEFT when grace timer expires (non-host)', () => {
      const leftHandler = vi.fn();
      client.onMessage('PLAYER_LEFT', leftHandler);

      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100, nickname: 'Alice' }]
      });
      client._originalHostId = 'player-1';

      ch._simulatePresenceLeave([{
        playerId: 'player-2',
        joinedAt: 200,
        nickname: 'Bob'
      }]);

      expect(leftHandler).not.toHaveBeenCalled();

      // Advance past grace period
      vi.advanceTimersByTime(60001);

      expect(leftHandler).toHaveBeenCalledTimes(1);
      expect(client._disconnectedPlayers.has('player-2')).toBe(false);
    });

    it('should dispatch ROOM_DESTROYED when original host grace timer expires', () => {
      const destroyHandler = vi.fn();
      client.onMessage('ROOM_DESTROYED', destroyHandler);

      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100, nickname: 'Alice' }]
      });
      // player-2 was the original host
      client._originalHostId = 'player-2';

      ch._simulatePresenceLeave([{
        playerId: 'player-2',
        joinedAt: 50,
        nickname: 'Bob'
      }]);

      vi.advanceTimersByTime(60001);

      expect(destroyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '房主断线超时，房间已解散'
        }),
        expect.any(Object)
      );
    });
  });

  describe('Presence join during active game', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      ch = latestChannel(channels);
      client.setGameActive(true);
    });

    it('should clear grace timer but not dispatch PLAYER_JOINED', () => {
      const joinHandler = vi.fn();
      const leftHandler = vi.fn();
      client.onMessage('PLAYER_JOINED', joinHandler);
      client.onMessage('PLAYER_LEFT', leftHandler);

      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100 }]
      });

      // Simulate player-2 leaving
      ch._simulatePresenceLeave([{
        playerId: 'player-2', joinedAt: 200, nickname: 'Bob'
      }]);
      expect(client._disconnectedPlayers.has('player-2')).toBe(true);

      // Simulate player-2 rejoining
      ch._simulatePresenceJoin([{
        playerId: 'player-2', joinedAt: 200, nickname: 'Bob'
      }]);

      // Grace timer should be cleared
      vi.advanceTimersByTime(60001);
      expect(leftHandler).not.toHaveBeenCalled();

      // PLAYER_JOINED should NOT be dispatched during active game
      expect(joinHandler).not.toHaveBeenCalled();
    });
  });

  describe('Presence leave when game not active', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      ch = latestChannel(channels);
      // gameActive is false by default
    });

    it('should dispatch PLAYER_LEFT immediately', () => {
      const leftHandler = vi.fn();
      client.onMessage('PLAYER_LEFT', leftHandler);

      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100 }]
      });

      ch._simulatePresenceLeave([{
        playerId: 'player-2', joinedAt: 200, nickname: 'Bob'
      }]);

      expect(leftHandler).toHaveBeenCalledTimes(1);
      expect(client._disconnectedPlayers.size).toBe(0);
    });

    it('should dispatch ROOM_DESTROYED when host leaves (not active game)', () => {
      const destroyHandler = vi.fn();
      client.onMessage('ROOM_DESTROYED', destroyHandler);

      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 200 }],
        key2: [{ playerId: 'player-2', joinedAt: 100 }]
      });

      ch._simulatePresenceLeave([{
        playerId: 'player-2', joinedAt: 100, nickname: 'Bob'
      }]);

      expect(destroyHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ── Presence sync ──────────────────────────────────────

  describe('_handlePresenceSync', () => {
    let ch;

    beforeEach(() => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      ch = latestChannel(channels);
    });

    it('should rebuild _players and set _originalHostId on first sync', () => {
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100, nickname: 'Alice' }],
        key2: [{ playerId: 'player-2', joinedAt: 200, nickname: 'Bob' }]
      });

      ch._simulatePresenceSync();

      expect(client._players).toHaveLength(2);
      expect(client._players[0].id).toBe('player-1');
      expect(client._players[0].isHost).toBe(true);
      expect(client._originalHostId).toBe('player-1');
    });

    it('should not overwrite _originalHostId on subsequent syncs', () => {
      ch._setPresenceState({
        key1: [{ playerId: 'player-1', joinedAt: 100 }]
      });
      ch._simulatePresenceSync();
      expect(client._originalHostId).toBe('player-1');

      // Second sync with different first player
      ch._setPresenceState({
        key2: [{ playerId: 'player-2', joinedAt: 50 }]
      });
      ch._simulatePresenceSync();

      // Should keep original
      expect(client._originalHostId).toBe('player-1');
    });
  });

  // ── onMessage / _dispatchMessage ───────────────────────

  describe('onMessage', () => {
    it('should register and call handlers', () => {
      const handler = vi.fn();
      client.onMessage('TEST_EVENT', handler);

      client._dispatchMessage('TEST_EVENT', { foo: 'bar' });

      expect(handler).toHaveBeenCalledWith(
        { foo: 'bar' },
        expect.objectContaining({ type: 'TEST_EVENT' })
      );
    });

    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsub = client.onMessage('TEST_EVENT', handler);

      unsub();
      client._dispatchMessage('TEST_EVENT', {});

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── setGameActive ──────────────────────────────────────

  describe('setGameActive', () => {
    it('should set _gameActive flag', () => {
      expect(client._gameActive).toBe(false);
      client.setGameActive(true);
      expect(client._gameActive).toBe(true);
      client.setGameActive(false);
      expect(client._gameActive).toBe(false);
    });
  });

  // ── getReconnectDelay ──────────────────────────────────

  describe('getReconnectDelay', () => {
    it('should return cloud reconnect delay constant', () => {
      expect(client.getReconnectDelay()).toBe(3000);
    });
  });

  // ── returnToRoom ───────────────────────────────────────

  describe('returnToRoom', () => {
    it('should send RETURN_TO_ROOM broadcast', () => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);

      client.returnToRoom();

      expect(ch.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'RETURN_TO_ROOM'
        })
      );
    });
  });

  // ── sendChat ───────────────────────────────────────────

  describe('sendChat', () => {
    it('should dispatch locally and send broadcast', () => {
      client.playerId = 'player-1';
      client._nickname = 'Alice';
      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);

      const handler = vi.fn();
      client.onMessage('CHAT_MESSAGE_BROADCAST', handler);

      client.sendChat('hello');

      // Local dispatch
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: 'Alice',
          message: 'hello',
          playerId: 'player-1'
        }),
        expect.any(Object)
      );

      // Also sent via broadcast
      expect(ch.send).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'CHAT_MESSAGE'
        })
      );
    });

    it('should skip remote CHAT_MESSAGE from self', () => {
      client.playerId = 'player-1';
      client.joinRoom('room-1', 'Alice', 'uno');
      const ch = latestChannel(channels);

      const handler = vi.fn();
      client.onMessage('CHAT_MESSAGE_BROADCAST', handler);

      // Simulate broadcast of own chat coming back
      ch._simulateBroadcast('CHAT_MESSAGE', {
        type: 'CHAT_MESSAGE',
        playerId: 'player-1',
        data: { message: 'hello', isPublic: true }
      });

      // Should not dispatch again (already dispatched locally)
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
