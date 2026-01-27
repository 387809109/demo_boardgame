/**
 * Board Game WebSocket Server
 *
 * A message relay server that handles:
 * - Connection management
 * - Room management
 * - Message routing
 *
 * IMPORTANT: This server does NOT handle game logic.
 * All game rules and validation happen on the frontend.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { ConnectionManager } from './connection-manager.js';
import { RoomManager } from './room-manager.js';
import { MessageRouter } from './message-router.js';
import Metrics from './metrics.js';
import { setLogLevel, setLogFormat, setLogFile, info, warn, error } from './utils/logger.js';

export class GameServer {
  constructor(port = config.port) {
    this.port = port;
    this.wss = null;
    this.httpServer = null;
    this.heartbeatTimer = null;

    // Initialize managers
    this.metrics = new Metrics();
    this.connectionManager = new ConnectionManager();
    this.roomManager = new RoomManager();
    this.messageRouter = new MessageRouter(this.roomManager, this.connectionManager, this.metrics);

    // Set log level
    setLogLevel(config.logLevel);
    setLogFormat(config.logFormat);
    setLogFile(config.logFilePath);
  }

  /**
   * Start the WebSocket server
   */
  start() {
    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res));

    this.wss = new WebSocketServer({
      server: this.httpServer,
      maxPayload: config.maxMessageSize
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (err) => {
      error('WebSocket server error', { error: err.message });
    });

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    // Start heartbeat checker
    this.startHeartbeatChecker();

    this.httpServer.listen(this.port, () => {
      info(`WebSocket server started on port ${this.port}`);
      console.log(`\n🎮 Board Game Server running on ws://localhost:${this.port}\n`);
    });
  }

  /**
   * Start the heartbeat checker timer
   */
  startHeartbeatChecker() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, config.heartbeatCheckInterval);

    info('Heartbeat checker started', {
      checkInterval: config.heartbeatCheckInterval,
      timeout: config.heartbeatTimeout
    });
  }

  /**
   * Check for timed out connections and disconnect them
   */
  checkHeartbeats() {
    const timedOut = this.connectionManager.getTimedOutConnections(config.heartbeatTimeout);

    for (const connId of timedOut) {
      const ws = this.connectionManager.getWebSocket(connId);
      const playerId = this.connectionManager.getPlayerId(connId);

      warn('Connection timed out', { connId, playerId });

      // Handle room cleanup before closing
      this.messageRouter.handleDisconnect(connId);
      this.connectionManager.removeConnection(connId);

      // Close the WebSocket
      if (ws && ws.readyState === 1) {
        ws.close(4000, 'Heartbeat timeout');
      }
    }
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket instance
   * @param {http.IncomingMessage} req - HTTP request
   */
  handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    const connId = this.connectionManager.addConnection(ws);
    this.metrics.inc('connectionsTotal', 1);

    info('Client connected', { connId, ip: clientIp });

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(connId, data);
    });

    // Handle disconnect
    ws.on('close', (code, reason) => {
      this.handleDisconnect(connId, code, reason);
    });

    // Handle errors
    ws.on('error', (err) => {
      warn('WebSocket error', { connId, error: err.message });
    });
  }

  /**
   * Handle incoming message
   * @param {string} connId - Connection ID
   * @param {Buffer|string} data - Raw message data
   */
  handleMessage(connId, data) {
    // Update activity time on any message
    this.connectionManager.updateActivity(connId);

    let message;

    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      this.metrics.inc('errors', 1);
      const ws = this.connectionManager.getWebSocket(connId);
      if (ws && ws.readyState === 1) {
        const errorMsg = {
          type: 'ERROR',
          timestamp: Date.now(),
          playerId: 'unknown',
          data: {
            code: 'INVALID_MESSAGE_FORMAT',
            message: 'Invalid JSON format',
            severity: 'error'
          }
        };
        ws.send(JSON.stringify(errorMsg));
      }
      return;
    }

    this.messageRouter.route(connId, message);
  }

  /**
   * Handle connection disconnect
   * @param {string} connId - Connection ID
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  handleDisconnect(connId, code, reason) {
    info('Client disconnected', { connId, code, reason: reason?.toString() });

    // Handle room cleanup
    this.messageRouter.handleDisconnect(connId);

    // Remove connection
    this.connectionManager.removeConnection(connId);
  }

  /**
   * Handle HTTP requests (health/stats)
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleHttpRequest(req, res) {
    const url = req.url || '/';
    if (url === '/health') {
      this.writeJson(res, 200, {
        status: 'ok',
        timestamp: Date.now(),
        ...this.getStats()
      });
      return;
    }

    if (url === '/stats') {
      this.writeJson(res, 200, {
        status: 'ok',
        timestamp: Date.now(),
        ...this.getStats()
      });
      return;
    }

    this.writeJson(res, 404, { status: 'not_found' });
  }

  /**
   * Write JSON response
   * @param {http.ServerResponse} res
   * @param {number} status
   * @param {object} body
   */
  writeJson(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      info(`Received ${signal}, shutting down...`);
      this.stop();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      error('Uncaught exception', { error: err.message, stack: err.stack });
      this.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      error('Unhandled rejection', { reason: String(reason) });
    });
  }

  /**
   * Stop the server gracefully
   */
  stop() {
    // Stop heartbeat checker
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (!this.wss && !this.httpServer) {
      return;
    }

    info('Stopping server...');

    if (this.wss) {
      // Close all connections
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === 1) {
          ws.close(1001, 'Server shutting down');
        }
      });
      this.wss.close();
      this.wss = null;
    }

    if (this.httpServer) {
      this.httpServer.close((err) => {
        if (err) {
          error('Error closing server', { error: err.message });
        } else {
          info('Server stopped');
        }
        process.exit(0);
      });
      return;
    }

    info('Server stopped');
    process.exit(0);
  }

  /**
   * Get server statistics
   * @returns {object} Server stats
   */
  getStats() {
    return {
      connections: this.connectionManager.getActiveConnections(),
      players: this.connectionManager.getBoundPlayers(),
      rooms: this.roomManager.getRoomCount(),
      playersInRooms: this.roomManager.getTotalPlayers(),
      metrics: this.metrics.snapshot()
    };
  }
}

// Start server if run directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  const server = new GameServer();
  server.start();
}

export default GameServer;
