/**
 * MessageRouter - Routes and handles WebSocket messages
 *
 * This is a MESSAGE RELAY ONLY - no game logic validation.
 * All game logic lives in the frontend.
 */

import { validateMessage, validateRoomId, validateNickname } from './utils/validator.js';
import { config } from './config.js';
import { debug, info, warn, error } from './utils/logger.js';
import { inflateSync, gunzipSync } from 'zlib';
import { Broadcaster } from './broadcaster.js';

const NETWORK_BATCH_MESSAGE_TYPE = 'NETWORK_BATCH';
const NETWORK_BATCH_MAX_MESSAGES = 64;

export class MessageRouter {
  /**
   * @param {import('./room-manager.js').RoomManager} roomManager
   * @param {import('./connection-manager.js').ConnectionManager} connectionManager
   */
  constructor(roomManager, connectionManager) {
    this.roomManager = roomManager;
    this.connectionManager = connectionManager;
    this.broadcaster = new Broadcaster(connectionManager, roomManager);
  }

  /**
   * Decode and normalize batch messages from client
   * @param {Object} message
   * @param {string} connId
   * @returns {Array<Object>}
   * @private
   */
  _resolveBatchMessages(message) {
    const payload = message?.data;
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    let messages = payload.messages;
    if (!Array.isArray(messages) && payload.compressed) {
      messages = this._decompressBatchPayload(payload);
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }
    if (messages.length > NETWORK_BATCH_MAX_MESSAGES) {
      return [];
    }

    const parentPlayerId = message.playerId || 'unknown';
    const normalized = [];
    for (const item of messages) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      if (item.type === NETWORK_BATCH_MESSAGE_TYPE) {
        continue;
      }

      normalized.push({
        ...item,
        playerId: item.playerId || parentPlayerId,
        timestamp: item.timestamp || Date.now()
      });
    }

    return normalized;
  }

  /**
   * Decompress compressed batch payload.
   * @param {Object} payload
   * @returns {Array<Object>|null}
   * @private
   */
  _decompressBatchPayload(payload) {
    try {
      const encoding = payload.encoding || 'gzip';
      if (encoding !== 'gzip' && encoding !== 'deflate') {
        return null;
      }
      const compressedPayload = payload.payload;
      if (!compressedPayload || typeof compressedPayload !== 'string') {
        return null;
      }

      const buffer = Buffer.from(compressedPayload, 'base64');
      const decoded = encoding === 'gzip'
        ? gunzipSync(buffer)
        : inflateSync(buffer);
      const decodedText = decoded.toString();
      const parsed = JSON.parse(decodedText);
      if (Array.isArray(parsed?.data?.messages)) {
        return parsed.data.messages;
      }
      return Array.isArray(parsed?.messages) ? parsed.messages : null;
    } catch (err) {
      error('Failed to decompress NETWORK_BATCH payload', { error: err.message });
      return null;
    }
  }

  /**
   * Route incoming message to appropriate handler
   * @param {string} connId - Connection ID
   * @param {object} message - Parsed message object
   */
  route(connId, message) {
    if (!message || typeof message !== 'object') {
      this.sendError(connId, 'unknown', 'INVALID_MESSAGE_FORMAT', 'Message must be an object', 'error');
      return;
    }

    if (message.type === NETWORK_BATCH_MESSAGE_TYPE) {
      const queued = this._resolveBatchMessages(message);
      if (!queued.length) {
        this.sendError(
          connId,
          message.playerId || 'unknown',
          'INVALID_MESSAGE_FORMAT',
          'Invalid network batch payload',
          'error'
        );
        return;
      }

      queued.forEach((queuedMessage) => this.route(connId, queuedMessage));
      return;
    }

    // Validate message format
    const validation = validateMessage(message);
    if (!validation.valid) {
      this.sendError(connId, message.playerId || 'unknown', 'INVALID_MESSAGE_FORMAT', validation.error, 'error');
      return;
    }

    const { type, playerId, data } = message;

    // Bind player to connection on first message
    this.connectionManager.bindPlayer(connId, playerId);
    if (data?.sessionId && typeof data.sessionId === 'string') {
      this.connectionManager.setSessionId(connId, data.sessionId);
    }

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
      case 'RETURN_TO_ROOM':
        this.handleReturnToRoom(connId, playerId, data);
        break;
      case 'RECONNECT_REQUEST':
        this.handleReconnectRequest(connId, playerId, data);
        break;
      case 'SNAPSHOT_RESPONSE':
        this.handleSnapshotResponse(connId, playerId, data);
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

    const startPayload = data?.gameConfig || {};
    const payloadGameSettings = startPayload.gameSettings && typeof startPayload.gameSettings === 'object'
      ? startPayload.gameSettings
      : null;
    const roomGameSettings = this.roomManager.getGameSettings(roomId);
    const gameSettings = payloadGameSettings || roomGameSettings || {};
    if (Object.keys(gameSettings).length > 0) {
      this.roomManager.setGameSettings(roomId, gameSettings);
    }

    // Broadcast GAME_STARTED with initial state from host
    const players = this.roomManager.getPlayers(roomId);
    this.broadcast(roomId, {
      type: 'GAME_STARTED',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        gameType: room.gameType,
        gameConfig: startPayload,
        initialState: startPayload.initialState || null,
        aiPlayers: startPayload.aiPlayers || [],
        gameSettings,
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

    // Freeze game actions while host is disconnected
    if (this.roomManager.isHostDisconnected(roomId)) {
      this.sendError(connId, playerId, 'HOST_DISCONNECTED',
        'Host is disconnected, game actions are frozen', 'warning');
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
        }
      }
    });
  }

  /**
   * Handle RECONNECT_REQUEST message
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {object} data - Message data
   */
  handleReconnectRequest(connId, playerId, data) {
    if (!config.enableReconnect) {
      this._sendReconnectRejected(connId, playerId, 'RECONNECT_NOT_SUPPORTED', 'Reconnect is not enabled');
      return;
    }

    const { roomId, sessionId } = data || {};

    const roomValidation = validateRoomId(roomId);
    if (!roomValidation.valid) {
      this._sendReconnectRejected(connId, playerId, 'INVALID_MESSAGE_FORMAT', roomValidation.error);
      return;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      this._sendReconnectRejected(connId, playerId, 'INVALID_MESSAGE_FORMAT', 'sessionId is required');
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this._sendReconnectRejected(connId, playerId, 'GAME_NOT_FOUND', 'Room not found');
      return;
    }

    if (!room.gameStarted) {
      this._sendReconnectRejected(connId, playerId, 'INVALID_ACTION', 'Game not started');
      return;
    }

    // Non-host reconnect requires an online host to provide on-demand snapshot.
    if (room.host !== playerId) {
      const hostSocket = this.connectionManager.getConnection(room.host);
      if (!hostSocket || hostSocket.readyState !== 1) {
        this._sendReconnectRejected(connId, playerId, 'HOST_DISCONNECTED', 'Host is disconnected, snapshot unavailable');
        return;
      }
    }

    const reconnectResult = this.roomManager.reconnectPlayer(roomId, playerId, sessionId);
    if (!reconnectResult.success) {
      this._sendReconnectRejected(
        connId,
        playerId,
        reconnectResult.code || 'RECONNECT_SESSION_EXPIRED',
        reconnectResult.error || 'Reconnect rejected'
      );
      return;
    }

    this._sendToConnection(connId, {
      type: 'RECONNECT_ACCEPTED',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        roomId,
        snapshotRequired: true
      }
    });

    const snapshotRequest = this.roomManager.createSnapshotRequest(roomId, playerId, room.host);
    if (snapshotRequest) {
      this.sendToPlayer(room.host, {
        type: 'SNAPSHOT_REQUEST',
        timestamp: Date.now(),
        playerId: 'server',
        data: {
          roomId,
          targetPlayerId: playerId,
          requestId: snapshotRequest.requestId
        }
      });
    }

    const players = this.roomManager.getPlayers(roomId);
    this.broadcast(roomId, {
      type: 'PLAYER_RECONNECTED',
      timestamp: Date.now(),
      playerId,
      data: {
        playerCount: players.length,
        players: players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost
        }))
      }
    });

    const returnStatus = this.roomManager.getReturnToRoomStatus(roomId);
    if (returnStatus) {
      this._sendToConnection(connId, {
        type: 'RETURN_TO_ROOM_STATUS',
        timestamp: Date.now(),
        playerId: 'server',
        data: returnStatus
      });
    }
  }

  /**
   * Handle SNAPSHOT_RESPONSE from host and forward to reconnect target.
   * @param {string} connId - Connection ID
   * @param {string} playerId - Sender player ID
   * @param {object} data - Message data
   */
  handleSnapshotResponse(connId, playerId, data) {
    const { roomId, targetPlayerId, requestId, gameState, gameSettings } = data || {};

    const roomValidation = validateRoomId(roomId);
    if (!roomValidation.valid) {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', roomValidation.error, 'error');
      return;
    }

    if (!targetPlayerId || typeof targetPlayerId !== 'string') {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', 'targetPlayerId is required', 'error');
      return;
    }

    if (!gameState || typeof gameState !== 'object') {
      this.sendError(connId, playerId, 'INVALID_MESSAGE_FORMAT', 'gameState is required', 'error');
      return;
    }

    const senderRoomId = this.roomManager.findPlayerRoom(playerId);
    if (senderRoomId !== roomId) {
      this.sendError(connId, playerId, 'PERMISSION_DENIED', 'Snapshot sender is not in target room', 'error');
      return;
    }

    if (!this.roomManager.isHost(roomId, playerId)) {
      this.sendError(connId, playerId, 'PERMISSION_DENIED', 'Only host can send snapshot response', 'error');
      return;
    }

    const pendingRequest = this.roomManager.consumeSnapshotRequest(roomId, targetPlayerId, requestId || null);
    if (!pendingRequest) {
      this.sendError(connId, playerId, 'INVALID_ACTION', 'No pending snapshot request for target player', 'warning');
      return;
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Room not found', 'warning');
      return;
    }

    const outboundSettings = gameSettings && typeof gameSettings === 'object'
      ? gameSettings
      : this.roomManager.getGameSettings(roomId);
    this.sendToPlayer(targetPlayerId, {
      type: 'GAME_SNAPSHOT',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        roomId,
        gameType: room.gameType,
        players: room.players.map(p => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost
        })),
        gameSettings: outboundSettings,
        gameState
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
   * Handle RETURN_TO_ROOM message
   * Player indicates they have left result screen and returned to waiting room.
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   */
  handleReturnToRoom(connId, playerId) {
    const roomId = this.roomManager.findPlayerRoom(playerId);
    if (!roomId) {
      this.sendError(connId, playerId, 'GAME_NOT_FOUND', 'Player not in any room', 'warning');
      return;
    }

    const result = this.roomManager.markPlayerReturned(roomId, playerId);
    if (!result.success) {
      this.sendError(connId, playerId, 'INVALID_ACTION', result.error || 'Cannot return to room', 'warning');
      return;
    }

    const status = this.roomManager.getReturnToRoomStatus(roomId);
    this.broadcast(roomId, {
      type: 'RETURN_TO_ROOM_STATUS',
      timestamp: Date.now(),
      playerId: 'server',
      data: status
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
      const room = this.roomManager.getRoom(roomId);
      const disconnectedPlayer = room?.players?.find(p => p.id === playerId);
      const disconnectedSessionId = this.connectionManager.getSessionId(connId) || `legacy-${playerId}`;

      if (
        config.enableReconnect
        && room?.gameStarted
        && disconnectedPlayer
      ) {
        this.roomManager.createReconnectSession(
          roomId,
          playerId,
          disconnectedPlayer.nickname,
          disconnectedSessionId
        );

        const markResult = this.roomManager.markPlayerDisconnected(roomId, playerId);
        if (markResult.success) {
          this.broadcast(roomId, {
            type: 'PLAYER_DISCONNECTED',
            timestamp: Date.now(),
            playerId: 'server',
            data: {
              playerId,
              nickname: disconnectedPlayer.nickname,
              reconnectWindowMs: config.reconnectSessionTtlMs
            }
          });

          const status = this.roomManager.getReturnToRoomStatus(roomId);
          if (status) {
            this.broadcast(roomId, {
              type: 'RETURN_TO_ROOM_STATUS',
              timestamp: Date.now(),
              playerId: 'server',
              data: status
            });
          }
          info('Player disconnected with reconnect session retained', { roomId, playerId });
          return;
        }
      }

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
   * Prune expired reconnect sessions across all rooms.
   * Destroys rooms where the host's reconnect session has expired.
   */
  pruneExpiredSessions() {
    const expiredHostRooms = this.roomManager.pruneAllExpiredSessions();
    for (const roomId of expiredHostRooms) {
      this.broadcast(roomId, {
        type: 'ROOM_DESTROYED',
        timestamp: Date.now(),
        playerId: 'server',
        data: {
          reason: 'host_reconnect_timeout',
          message: '房主重连超时，房间已解散'
        }
      });

      const players = this.roomManager.getPlayers(roomId);
      for (const player of players) {
        this.roomManager.removePlayer(roomId, player.id);
      }

      info('Room destroyed due to host reconnect timeout', { roomId });
    }
  }

  /**
   * Broadcast message to all players in a room
   * @param {string} roomId - Room ID
   * @param {object} message - Message to send
   * @param {string} [excludePlayerId] - Player to exclude
   */
  broadcast(roomId, message, excludePlayerId = null) {
    this.broadcaster.broadcastToRoom(roomId, message, excludePlayerId);
  }

  /**
   * Send message to specific player
   * @param {string} playerId - Player ID
   * @param {object} message - Message to send
   */
  sendToPlayer(playerId, message) {
    this.broadcaster.broadcastToPlayer(playerId, message);
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

  /**
   * Send a protocol message to a specific connection
   * @private
   * @param {string} connId - Connection ID
   * @param {object} message - Protocol message
   */
  _sendToConnection(connId, message) {
    const ws = this.connectionManager.getWebSocket(connId);
    if (!ws || ws.readyState !== 1) {
      return;
    }

    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      error('Failed to send message to connection', { connId, error: err.message });
    }
  }

  /**
   * Send RECONNECT_REJECTED response
   * @private
   * @param {string} connId - Connection ID
   * @param {string} playerId - Player ID
   * @param {string} reasonCode - Reject reason code
   * @param {string} message - Human-readable reason
   */
  _sendReconnectRejected(connId, playerId, reasonCode, message) {
    this._sendToConnection(connId, {
      type: 'RECONNECT_REJECTED',
      timestamp: Date.now(),
      playerId: 'server',
      data: {
        reasonCode,
        message
      }
    });
  }
}

export default MessageRouter;
