/**
 * Server configuration
 */
export const config = {
  // Server settings
  port: parseInt(process.env.PORT, 10) || 7777,

  // Connection settings
  heartbeatInterval: 30000, // 30 seconds (client sends PING)
  heartbeatTimeout: 90000,  // 90 seconds (disconnect if no activity)
  heartbeatCheckInterval: 15000, // 15 seconds (check interval)

  // Room settings
  maxPlayersPerRoom: 10,
  maxRoomsPerServer: 100,

  // Message settings
  maxMessageSize: 64 * 1024, // 64 KB

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};
