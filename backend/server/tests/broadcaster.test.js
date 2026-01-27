/**
 * Broadcaster Unit Tests
 * T-B100/T-B101/T-B102
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Broadcaster } from '../broadcaster.js';
import { RoomManager } from '../room-manager.js';
import { ConnectionManager } from '../connection-manager.js';

describe('Broadcaster', () => {
  let roomManager;
  let connectionManager;

  beforeEach(() => {
    roomManager = new RoomManager();
    connectionManager = new ConnectionManager();
  });

  function setupPlayer(roomId, playerId, nickname = 'Test') {
    const ws = { readyState: 1, send: jest.fn() };
    const connId = connectionManager.addConnection(ws);
    connectionManager.bindPlayer(connId, playerId);
    roomManager.joinRoom(roomId, playerId, nickname, 'uno');
    return ws;
  }

  it('should broadcast to all players in room', () => {
    const ws1 = setupPlayer('room-1', 'player-1', 'Alice');
    const ws2 = setupPlayer('room-1', 'player-2', 'Bob');

    const broadcaster = new Broadcaster(roomManager, connectionManager);
    broadcaster.broadcast('room-1', { type: 'TEST', data: {} });

    expect(ws1.send).toHaveBeenCalledTimes(1);
    expect(ws2.send).toHaveBeenCalledTimes(1);
  });

  it('should exclude specified player', () => {
    const ws1 = setupPlayer('room-1', 'player-1', 'Alice');
    const ws2 = setupPlayer('room-1', 'player-2', 'Bob');

    const broadcaster = new Broadcaster(roomManager, connectionManager);
    broadcaster.broadcast('room-1', { type: 'TEST', data: {} }, 'player-1');

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledTimes(1);
  });

  it('should batch messages when queueDelayMs is set', () => {
    jest.useFakeTimers();

    const ws1 = setupPlayer('room-1', 'player-1', 'Alice');
    const ws2 = setupPlayer('room-1', 'player-2', 'Bob');

    const broadcaster = new Broadcaster(roomManager, connectionManager, { queueDelayMs: 10 });
    broadcaster.broadcast('room-1', { type: 'TEST-1', data: {} });
    broadcaster.broadcast('room-1', { type: 'TEST-2', data: {} });

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10);

    expect(ws1.send).toHaveBeenCalledTimes(2);
    expect(ws2.send).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
