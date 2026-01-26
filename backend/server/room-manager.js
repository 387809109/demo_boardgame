/**
 * RoomManager - Manages game rooms and player memberships
 *
 * Data structures:
 * - rooms: Map<roomId, Room>
 * - playerRooms: Map<playerId, roomId>
 *
 * Room {
 *   id, gameType, host, players[], createdAt, gameStarted
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
    info('Game started in room', { roomId });
    return true;
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
}

export default RoomManager;
