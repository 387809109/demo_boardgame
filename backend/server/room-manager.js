/**
 * RoomManager - Manages game rooms and player memberships
 *
 * Data structures:
 * - rooms: Map<roomId, Room>
 * - playerRooms: Map<playerId, roomId>
 *
 * Room {
 *   id, gameType, host, players[], createdAt, gameStarted, returnStatus, disconnectedPlayers
 * }
 *
 * Player {
 *   id, nickname, isHost, joinedAt
 * }
 */

import { config } from './config.js';
import { debug, info, warn } from './utils/logger.js';

export class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();

    /** @type {Map<string, string>} playerId -> roomId */
    this.playerRooms = new Map();
  }

  /**
   * Create a new room
   * @param {string} roomId - Room ID
   * @param {string} hostId - Host player ID
   * @param {string} gameType - Game type
   * @returns {{ success: boolean, error?: string }} Result
   */
  createRoom(roomId, hostId, gameType) {
    if (this.rooms.has(roomId)) {
      return { success: false, error: 'Room already exists' };
    }

    if (this.rooms.size >= config.maxRoomsPerServer) {
      return { success: false, error: 'Server room limit reached' };
    }

    const room = {
      id: roomId,
      gameType,
      host: hostId,
      players: [],
      aiPlayers: [],
      gameSettings: {},
      returnStatus: new Map(), // playerId -> hasReturnedToRoom
      disconnectedPlayers: new Set(), // playerId currently disconnected but recoverable
      reconnectSessions: new Map(), // playerId -> { sessionId, nickname, expiresAt }
      gameSnapshot: {
        gameState: null,
        lastAction: null,
        lastActionId: null
      },
      createdAt: Date.now(),
      gameStarted: false
    };

    this.rooms.set(roomId, room);
    info('Room created', { roomId, hostId, gameType });
    return { success: true };
  }

  /**
   * Join a room (creates room if it doesn't exist)
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {string} nickname - Player nickname
   * @param {string} [gameType] - Game type (for room creation)
   * @returns {{ success: boolean, error?: string, isNewRoom?: boolean }} Result
   */
  joinRoom(roomId, playerId, nickname, gameType) {
    // Check if player is already in a room
    const currentRoom = this.playerRooms.get(playerId);
    if (currentRoom && currentRoom !== roomId) {
      return { success: false, error: 'Player already in another room' };
    }

    let room = this.rooms.get(roomId);
    let isNewRoom = false;

    // Create room if it doesn't exist
    if (!room) {
      if (!gameType) {
        return { success: false, error: 'Game type required for new room' };
      }
      const createResult = this.createRoom(roomId, playerId, gameType);
      if (!createResult.success) {
        return createResult;
      }
      room = this.rooms.get(roomId);
      isNewRoom = true;
    }

    // Check if player is already in this room
    if (room.players.some(p => p.id === playerId)) {
      return { success: false, error: 'Player already in room' };
    }

    // Check room capacity
    if (room.players.length >= config.maxPlayersPerRoom) {
      return { success: false, error: 'Room is full' };
    }

    // Check if game already started
    if (room.gameStarted) {
      return { success: false, error: 'Game already started' };
    }

    // Add player to room
    const player = {
      id: playerId,
      nickname,
      isHost: playerId === room.host,
      joinedAt: Date.now()
    };

    room.players.push(player);
    this.playerRooms.set(playerId, roomId);
    room.disconnectedPlayers.delete(playerId);
    // Pre-game lobby players are implicitly "in room" state.
    if (!room.gameStarted) {
      room.returnStatus.set(playerId, true);
    }

    info('Player joined room', { roomId, playerId, nickname });
    return { success: true, isNewRoom };
  }

  /**
   * Remove a player from their room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @returns {{ success: boolean, wasHost?: boolean, newHost?: string, roomDeleted?: boolean }} Result
   */
  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false };
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false };
    }

    const wasHost = room.host === playerId;
    room.players.splice(playerIndex, 1);
    this.playerRooms.delete(playerId);
    room.returnStatus.delete(playerId);
    room.disconnectedPlayers.delete(playerId);

    info('Player removed from room', { roomId, playerId, wasHost });

    // Handle empty room
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      info('Room deleted (empty)', { roomId });
      return { success: true, wasHost, roomDeleted: true };
    }

    // Transfer host if needed
    let newHost = null;
    if (wasHost && room.players.length > 0) {
      newHost = room.players[0].id;
      room.host = newHost;
      room.players[0].isHost = true;
      info('Host transferred', { roomId, newHost });
    }

    if (room.gameStarted && this._areAllPlayersReturned(room)) {
      room.gameStarted = false;
    }

    return { success: true, wasHost, newHost, roomDeleted: false };
  }

  /**
   * Find which room a player is in
   * @param {string} playerId - Player ID
   * @returns {string|null} Room ID
   */
  findPlayerRoom(playerId) {
    return this.playerRooms.get(playerId) || null;
  }

  /**
   * Get room information
   * @param {string} roomId - Room ID
   * @returns {Room|null} Room object
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get players in a room
   * @param {string} roomId - Room ID
   * @returns {Player[]} Array of players
   */
  getPlayers(roomId) {
    const room = this.rooms.get(roomId);
    return room ? [...room.players] : [];
  }

  /**
   * Check if player is host of a room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @returns {boolean} Is host
   */
  isHost(roomId, playerId) {
    const room = this.rooms.get(roomId);
    return room ? room.host === playerId : false;
  }

  /**
   * Delete a room
   * @param {string} roomId - Room ID
   * @returns {boolean} Success
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // Remove all player mappings
    for (const player of room.players) {
      this.playerRooms.delete(player.id);
    }

    this.rooms.delete(roomId);
    info('Room deleted', { roomId });
    return true;
  }

  /**
   * Mark game as started in a room
   * @param {string} roomId - Room ID
   * @returns {boolean} Success
   */
  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    room.gameStarted = true;
    room.returnStatus = new Map(room.players.map(player => [player.id, false]));
    room.disconnectedPlayers = new Set();
    info('Game started in room', { roomId });
    return true;
  }

  /**
   * Mark a connected in-room player as temporarily disconnected (recoverable).
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @returns {{ success: boolean, error?: string }}
   */
  markPlayerDisconnected(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const playerInRoom = room.players.some(player => player.id === playerId);
    if (!playerInRoom) {
      return { success: false, error: 'Player not in room' };
    }

    if (!(room.disconnectedPlayers instanceof Set)) {
      room.disconnectedPlayers = new Set();
    }

    room.disconnectedPlayers.add(playerId);
    // A disconnected player is not considered "returned to room".
    room.returnStatus.set(playerId, false);
    return { success: true };
  }

  /**
   * Mark a player as returned to room after a finished round
   * When all in-room players returned, room becomes startable again.
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @returns {{ success: boolean, error?: string, allReturned?: boolean }}
   */
  markPlayerReturned(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const playerInRoom = room.players.some(player => player.id === playerId);
    if (!playerInRoom) {
      return { success: false, error: 'Player not in room' };
    }

    if (!room.returnStatus || !(room.returnStatus instanceof Map)) {
      room.returnStatus = new Map();
    }

    for (const player of room.players) {
      if (!room.returnStatus.has(player.id)) {
        room.returnStatus.set(player.id, false);
      }
    }

    room.returnStatus.set(playerId, true);
    const allReturned = this._areAllPlayersReturned(room);
    if (allReturned) {
      room.gameStarted = false;
    }

    return { success: true, allReturned };
  }

  /**
   * Get room return-to-room status payload
   * @param {string} roomId - Room ID
   * @returns {{ players: Array, allReturned: boolean, returnedCount: number, totalPlayers: number }|null}
   */
  getReturnToRoomStatus(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const players = room.players.map(player => ({
      id: player.id,
      nickname: player.nickname,
      isHost: player.isHost,
      returned: !!room.returnStatus.get(player.id),
      disconnected: room.disconnectedPlayers?.has(player.id) ?? false
    }));

    const returnedCount = players.filter(player => player.returned).length;
    const totalPlayers = players.length;

    return {
      players,
      allReturned: totalPlayers > 0 && returnedCount === totalPlayers,
      returnedCount,
      totalPlayers,
      isHostDisconnected: room.disconnectedPlayers?.has(room.host) ?? false
    };
  }

  /**
   * Check if the host of a room is currently disconnected
   * @param {string} roomId - Room ID
   * @returns {boolean}
   */
  isHostDisconnected(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    return room.disconnectedPlayers?.has(room.host) ?? false;
  }

  /**
   * Get total room count
   * @returns {number} Number of rooms
   */
  getRoomCount() {
    return this.rooms.size;
  }

  /**
   * Get total player count across all rooms
   * @returns {number} Number of players
   */
  getTotalPlayers() {
    return this.playerRooms.size;
  }

  /**
   * Get AI players in a room
   * @param {string} roomId - Room ID
   * @returns {Array} Array of AI players
   */
  getAIPlayers(roomId) {
    const room = this.rooms.get(roomId);
    return room ? [...room.aiPlayers] : [];
  }

  /**
   * Set AI players for a room
   * @param {string} roomId - Room ID
   * @param {Array} aiPlayers - AI players array
   * @returns {boolean} Success
   */
  setAIPlayers(roomId, aiPlayers) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    room.aiPlayers = aiPlayers || [];
    debug('AI players updated', { roomId, count: room.aiPlayers.length });
    return true;
  }

  /**
   * Get game settings for a room
   * @param {string} roomId - Room ID
   * @returns {Object} Game settings
   */
  getGameSettings(roomId) {
    const room = this.rooms.get(roomId);
    return room ? { ...room.gameSettings } : {};
  }

  /**
   * Set game settings for a room
   * @param {string} roomId - Room ID
   * @param {Object} gameSettings - Game settings object
   * @returns {boolean} Success
   */
  setGameSettings(roomId, gameSettings) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    room.gameSettings = gameSettings || {};
    debug('Game settings updated', { roomId });
    return true;
  }

  /**
   * Store/refresh reconnect session for a disconnected player
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {string} nickname - Player nickname
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success
   */
  createReconnectSession(roomId, playerId, nickname, sessionId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    this._pruneExpiredReconnectSessions(room);
    room.reconnectSessions.set(playerId, {
      sessionId,
      nickname,
      expiresAt: Date.now() + config.reconnectSessionTtlMs
    });
    debug('Reconnect session created', { roomId, playerId });
    return true;
  }

  /**
   * Reconnect a previously disconnected player to an in-progress room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {string} sessionId - Session ID
   * @returns {{ success: boolean, code?: string, error?: string }}
   */
  reconnectPlayer(roomId, playerId, sessionId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, code: 'GAME_NOT_FOUND', error: 'Room not found' };
    }

    this._pruneExpiredReconnectSessions(room);

    const reconnectSession = room.reconnectSessions.get(playerId);
    if (!reconnectSession) {
      return { success: false, code: 'RECONNECT_SESSION_EXPIRED', error: 'Reconnect session not found' };
    }

    if (reconnectSession.sessionId !== sessionId) {
      return { success: false, code: 'RECONNECT_IDENTITY_MISMATCH', error: 'Session identity mismatch' };
    }

    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      if (!room.disconnectedPlayers.has(playerId)) {
        return { success: false, code: 'INVALID_ACTION', error: 'Player already connected' };
      }

      room.disconnectedPlayers.delete(playerId);
      this.playerRooms.set(playerId, roomId);
      room.returnStatus.set(playerId, false);
      room.reconnectSessions.delete(playerId);

      info('Player reconnected to room', { roomId, playerId });
      return { success: true };
    }

    if (room.players.length >= config.maxPlayersPerRoom) {
      return { success: false, code: 'ROOM_FULL', error: 'Room is full' };
    }

    const player = {
      id: playerId,
      nickname: reconnectSession.nickname,
      isHost: playerId === room.host,
      joinedAt: Date.now()
    };

    room.players.push(player);
    this.playerRooms.set(playerId, roomId);
    room.disconnectedPlayers.delete(playerId);
    room.returnStatus.set(playerId, false);
    room.reconnectSessions.delete(playerId);

    info('Player reconnected to room', { roomId, playerId });
    return { success: true };
  }

  /**
   * Update room snapshot used for reconnect synchronization
   * @param {string} roomId - Room ID
   * @param {Object} snapshot - Partial snapshot data
   * @returns {boolean} Success
   */
  updateGameSnapshot(roomId, snapshot) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const nextSnapshot = snapshot || {};
    room.gameSnapshot = {
      ...room.gameSnapshot,
      ...nextSnapshot
    };
    return true;
  }

  /**
   * Get reconnect snapshot for a room
   * @param {string} roomId - Room ID
   * @returns {Object|null} Snapshot
   */
  getGameSnapshot(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      roomId,
      gameType: room.gameType,
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost
      })),
      gameSettings: { ...(room.gameSettings || {}) },
      gameState: room.gameSnapshot?.gameState || null,
      lastAction: room.gameSnapshot?.lastAction || null,
      lastActionId: room.gameSnapshot?.lastActionId || null
    };
  }

  /**
   * Remove expired reconnect sessions
   * @private
   * @param {Object} room - Room object
   */
  _pruneExpiredReconnectSessions(room) {
    const now = Date.now();
    for (const [playerId, session] of [...room.reconnectSessions.entries()]) {
      if (!session || session.expiresAt <= now) {
        room.reconnectSessions.delete(playerId);
        if (room.disconnectedPlayers?.has(playerId)) {
          room.disconnectedPlayers.delete(playerId);
          const playerIndex = room.players.findIndex(player => player.id === playerId);
          if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
          }
          room.returnStatus.delete(playerId);
          this.playerRooms.delete(playerId);
        }
      }
    }
  }

  /**
   * Prune expired reconnect sessions across all rooms.
   * Returns room IDs where the host's session expired (room should be destroyed).
   * @returns {string[]} Room IDs with expired host sessions
   */
  pruneAllExpiredSessions() {
    const expiredHostRooms = [];
    for (const [roomId, room] of this.rooms) {
      const hostId = room.host;
      const hadHostSession = room.reconnectSessions.has(hostId);
      this._pruneExpiredReconnectSessions(room);
      const hostSessionGone = hadHostSession && !room.reconnectSessions.has(hostId);
      if (hostSessionGone && !room.players.some(p => p.id === hostId)) {
        expiredHostRooms.push(roomId);
      }
    }
    return expiredHostRooms;
  }

  /**
   * Check whether all currently in-room players have returned
   * @private
   * @param {Object} room - Room object
   * @returns {boolean}
   */
  _areAllPlayersReturned(room) {
    if (!room.players.length) {
      return false;
    }
    return room.players.every((player) => {
      const returned = !!room.returnStatus.get(player.id);
      const connected = !room.disconnectedPlayers.has(player.id);
      return returned && connected;
    });
  }
}

export default RoomManager;
