/**
 * Board Game API Server Entry Point
 *
 * Starts the Express server with graceful shutdown.
 */

import app from './app.js';
import { config } from './config.js';
import { setLogLevel, info, error } from './utils/logger.js';

setLogLevel(config.logLevel);

const server = app.listen(config.port, () => {
  info(`API server started on port ${config.port}`, {
    env: config.nodeEnv
  });
  console.log(
    `\n🎮 Board Game API running on http://localhost:${config.port}\n`
  );
});

// Graceful shutdown
function shutdown(signal) {
  info(`Received ${signal}, shutting down...`);
  server.close((err) => {
    if (err) {
      error('Error closing server', { error: err.message });
      process.exit(1);
    }
    info('Server stopped');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  error('Uncaught exception', {
    error: err.message,
    stack: err.stack
  });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  error('Unhandled rejection', { reason: String(reason) });
});

export default server;
