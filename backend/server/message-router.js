/**
 * MessageRouter - Routes and handles WebSocket messages
 *
 * This is a MESSAGE RELAY ONLY - no game logic validation.
 * All game logic lives in the frontend.
 */

import { validateMessage, validateRoomId, validateNickname } from './utils/validator.js';
import { debug, info, warn, error } from './utils/logger.js';

export class MessageRouter {
  /**
   * @param {import('./room-manager.js').RoomManager} roomManager
   * @param {import('./connection-manager.js').ConnectionManager} connectionManager
   */
  constructor(roomManager, connectionManager) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;
  }

  /**
   * Route incoming message to appropriate handler
   * @param {string} connId - Connection ID
   * @param {object} message - Parsed message object
   */
  route(connId, message) {
    // Validate message format
    const validation = validateMessage(message);
    if (!validation.valid) {
      this.sendError(connId, message.playerId || 'unknown', 'INVALID_MESSAGE_FORMAT', validation.error, 'error');
      return;
    }

    const { type, playerId, data } = message;

    // Bind player to connection on first message
    this.connectionManager.bindPlayer(connId, playerId);

    debug('Routing message', { type, playerId, connId });

    switch (type) {
      case 'JOIN':
        this.handleJoin(connId, playerId, data);
        break;
      case 'LEAVE':
        this.handleLeave(connId, playerId, data);
        break;
      case 'START_GAME':
        this.handleStartGame(connId, playerId, data);
        break;
      case 'GAME_ACTION':
        this.handleGameAction(connId, playerId, data);
        break;
      case 'CHAT_MESSAGE':
        this.handleChatMessage(connId, playerId, data);
        break;
      case 'AI_PLAYER_UPDATE':
        this.handleAIPlayerUpdate(connId, playerId, data);
        break;
      case 'GAME_SETTINGS_UPDATE':
        this.handleGameSettingsUpdate(connId, playerId, data);
        break;
      case 'PING':
        this.handlePing(connId, playerId);
        break;
      default:
        warn('Unknown message type', { type, playerId });
        this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', `Unknown message type: ${type}`, 'error');
    }
  }

  /**
   * Handle JOIN message
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleJoin(connId, playerId, data) {
    const { roomId, nickname, gameType } = data || {};

    // Validate room ID
    const roomValidation = validateRoomId(roomId);
    if (!roomValidation.valid) {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', roomValidation.error, 'error');
      return;
    }

    // Validate nickname
    const nicknameValidation = validateNickname(nickname);
    if (!nicknameValidation.valid) {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', nicknameValidation.error, 'error');
      return;
    }

    // Join room
    const result = this.roomManager.joinRoom(roomId, playerId, nickname, gameType);
    if (!result.success) {
      const errorCode = result.error === 'Room is full' ? 'ROOM_FULL' : 'INVALID_ACTION';
      this.sendError(connId, playerId, errorCode, result.error, 'error');
      return;
    }

    info('Player joined room', { playerId, roomId, nickname });

    // Broadcast PLAYER_JOINED to all players in room
    const players = this.roomManager.getPlayers(roomId);
    const aiPlayers = this.roomManager.getAIPlayers(roomId);
    const gameSettings = this.roomManager.getGameSettings(roomId);
    this.broadcast(roomId, {
      type: 'PLAYER_JOINED',
      timestamp: Date.now(),
      playerId,
      data: {
        nickname,
        playerCount: players.length,
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost
        })),
        aiPlayers,
        gameSettings
      }
    });
  }

  /**
   * Handle LEAVE message
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleLeave(connId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'warning');
      return;
    }

    this.removePlayerFromRoom(roomId, playerId, 'voluntary');
  }

  /**
   * Handle START_GAME message
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleStartGame(connId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'error');
      return;
    }

    // Check if player is host
    if (!this.roomManager.isHost(roomId, playerId)) {
      this.sendError(connId, playerId, 'PERMISSION_DENIED', 'Only host can start the game', 'error');
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (room.gameStarted) {
      this.sendError(connId, playerId, 'INVALID_ACTION', 'Game already started', 'warning');
      return;
    }

    // Mark game as started
    this.roomManager.startGame(roomId);

    info('Game started', { roomId, playerId });

    // Broadcast GAME_STARTED with initial state from host
    const players = this.roomManager.getPlayers(roomId);
    this.broadcast(roomId, {
      type: 'GAME_STARTED',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        gameType: room.gameType,
        gameConfig: data?.gameConfig || {},
        initialState: data?.gameConfig?.initialState || null,
        aiPlayers: data?.gameConfig?.aiPlayers || [],
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost
        }))
      }
    });
  }

  /**
   * Handle GAME_ACTION message
   * IMPORTANT: Only forwards, does NOT validate game logic
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleGameAction(connId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'error');
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room.gameStarted) {
      this.sendError(connId, playerId, 'INVALID_ACTION', 'Game not started', 'warning');
      return;
    }

    // Use data.playerId for AI players (host sends on behalf of AI)
    // Otherwise use the message sender's playerId
    const actionPlayerId = data?.playerId || playerId;

    debug('Forwarding game action', { roomId, playerId: actionPlayerId, actionType: data?.actionType });

    // Forward GAME_STATE_UPDATE to ALL players (including sender)
    // Frontend handles state reconciliation
    this.broadcast(roomId, {
      type: 'GAME_STATE_UPDATE',
      timestamp: Date.now(),
      playerId: actionPlayerId,
      data: {
        lastAction: {
          playerId: actionPlayerId,
          actionType: data?.actionType,
          actionData: data?.actionData
        },
        // Pass through any game state from the sender
        gameState: data?.gameState
      }
    });
  }

  /**
   * Handle AI_PLAYER_UPDATE message
   * Only host can update AI players
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleAIPlayerUpdate(connId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'warning');
      return;
    }

    // Only host can update AI players
    if (!this.roomManager.isHost(roomId, playerId)) {
      this.sendError(connId, playerId, 'PERMISSION_DENIED', 'Only host can manage AI players', 'error');
      return;
    }

    const { aiPlayers } = data || {};
    if (!Array.isArray(aiPlayers)) {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', 'aiPlayers must be an array', 'error');
      return;
    }

    // Update AI players in room
    this.roomManager.setAIPlayers(roomId, aiPlayers);

    info('AI players updated', { roomId, playerId, count: aiPlayers.length });

    // Broadcast to all players in room (including sender for confirmation)
    this.broadcast(roomId, {
      type: 'AI_PLAYER_UPDATE',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        aiPlayers
      }
    });
  }

  /**
   * Handle GAME_SETTINGS_UPDATE message
   * Only host can update game settings
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleGameSettingsUpdate(connId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'warning');
      return;
    }

    // Only host can update game settings
    if (!this.roomManager.isHost(roomId, playerId)) {
      this.sendError(connId, playerId, 'PERMISSION_DENIED', 'Only host can change game settings', 'error');
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (room.gameStarted) {
      this.sendError(connId, playerId, 'INVALID_ACTION', 'Cannot change settings after game started', 'warning');
      return;
    }

    const { gameSettings } = data || {};
    if (!gameSettings || typeof gameSettings !== 'object') {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', 'gameSettings must be an object', 'error');
      return;
    }

    // Update game settings in room
    this.roomManager.setGameSettings(roomId, gameSettings);

    info('Game settings updated', { roomId, playerId });

    // Broadcast to all players in room (including sender for confirmation)
    this.broadcast(roomId, {
      type: 'GAME_SETTINGS_UPDATE',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        gameSettings
      }
    });
  }

  /**
   * Handle CHAT_MESSAGE
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleChatMessage(connId, playerId, data) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'warning');
      return;
    }

    const { message, isPublic = true } = data || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return; // Silently ignore empty messages
    }

    // Get player nickname
    const players = this.roomManager.getPlayers(roomId);
    const player = players.find(p => p.id === playerId);
    const nickname = player?.nickname || 'Unknown';

    // Broadcast chat message
    this.broadcast(roomId, {
      type: 'CHAT_MESSAGE_BROADCAST',
      timestamp: Date.now(),
      playerId,
      data: {
        nickname,
        message: message.substring(0, 500), // Limit message length
        isPublic
      }
    });
  }

  /**
   * Handle PING message
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   */
  handlePing(connId, playerId) {
    const ws = this.connectionManager.getWebSocket(connId);
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      const pong = {
        type: 'PONG',
        timestamp: Date.now(),
        playerId,
        data: {}
      };
      ws.send(JSON.stringify(pong));
    }
  }

  /**
   * Handle player disconnection
   * @param {string} connId - Connection ID
   */
  handleDisconnect(connId) {
    const playerId = this.connectionManager.getPlayerId(connId);
    if (!playerId) {
      return;
    }

    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (roomId) {
      this.removePlayerFromRoom(roomId, playerId, 'disconnected');
    }
  }

  /**
   * Remove player from room and broadcast
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @param {string} reason - Reason for leaving
   */
  removePlayerFromRoom(roomId, playerId, reason) {
    const room = this.roomManager.getRoom(roomId);
    const wasGameStarted = room?.gameStarted;

    const result = this.roomManager.removePlayer(roomId, playerId);
    if (!result.success) {
      return;
    }

    info('Player left room', { roomId, playerId, reason, wasHost: result.wasHost });

    // Room was deleted (empty)
    if (result.roomDeleted) {
      return;
    }

    // If host left, destroy the room and kick everyone
    if (result.wasHost) {
      const players = this.roomManager.getPlayers(roomId);

      // Broadcast ROOM_DESTROYED to all remaining players
      this.broadcast(roomId, {
        type: 'ROOM_DESTROYED',
        timestamp: Date.now(),
        playerId: 'server',
        data: {
          reason: 'host_left',
          message: '房主已离开，房间已解散'
        }
      });

      // Remove all remaining players and delete the room
      for (const player of players) {
        this.roomManager.removePlayer(roomId, player.id);
      }

      info('Room destroyed due to host leaving', { roomId });
      return;
    }

    // Get remaining players
    const players = this.roomManager.getPlayers(roomId);

    // Broadcast PLAYER_LEFT (for non-host players leaving)
    this.broadcast(roomId, {
      type: 'PLAYER_LEFT',
      timestamp: Date.now(),
      playerId,
      data: {
        reason,
        playerCount: players.length,
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost
        }))
      }
    });
  }

  /**
   * Broadcast message to all players in a room
   * @param {string} roomId - Room ID
   * @param {object} message - Message to send
   * @param {string} [excludePlayerId] - Player to exclude
   */
  broadcast(roomId, message, excludePlayerId = null) {
    const players = this.roomManager.getPlayers(roomId);
    const messageStr = JSON.stringify(message);

    for (const player of players) {
      if (player.id === excludePlayerId) {
        continue;
      }

      const ws = this.connectionManager.getConnection(player.id);
      if (ws && ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(messageStr);
        } catch (err) {
          error('Failed to send message to player', { playerId: player.id, error: err.message });
        }
      }
    }
  }

  /**
   * Send message to specific player
   * @param {string} playerId - Player ID
   * @param {object} message - Message to send
   */
  sendToPlayer(playerId, message) {
    const ws = this.connectionManager.getConnection(playerId);
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(message));
      } catch (err) {
        error('Failed to send message to player', { playerId, error: err.message });
      }
    }
  }

  /**
   * Send error message to connection
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {string} severity - Error severity
   */
  sendError(connId, playerId, code, message, severity = 'error') {
    const ws = this.connectionManager.getWebSocket(connId);
    if (ws && ws.readyState === 1) {
      const errorMessage = {
        type: 'ERROR',
        timestamp: Date.now(),
        playerId,
        data: {
          code,
          message,
          severity
        }
      };
      try {
        ws.send(JSON.stringify(errorMessage));
      } catch (err) {
        error('Failed to send error message', { connId, error: err.message });
      }
    }
  }
}

export default MessageRouter;
