/**
 * Simple logger utility
 * Format: [LEVEL] ISO_TIME message [data]
 * @module utils/logger
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLevel = LOG_LEVELS.info;

/**
 * Set the logging level
 * @param {string} level - Log level (debug, info, warn, error)
 */
export function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLevel = LOG_LEVELS[level];
  }
}

/**
 * Format a log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data to log
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const levelStr = level.toUpperCase().padEnd(5);
  let output = `[${levelStr}] ${timestamp} ${message}`;
  if (data !== undefined) {
    output += ` ${JSON.stringify(data)}`;
  }
  return output;
}

/**
 * Log at debug level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function debug(message, data) {
  if (currentLevel <= LOG_LEVELS.debug) {
    console.log(formatMessage('debug', message, data));
  }
}

/**
 * Log at info level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function info(message, data) {
  if (currentLevel <= LOG_LEVELS.info) {
    console.log(formatMessage('info', message, data));
  }
}

/**
 * Log at warn level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function warn(message, data) {
  if (currentLevel <= LOG_LEVELS.warn) {
    console.warn(formatMessage('warn', message, data));
  }
}

/**
 * Log at error level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function error(message, data) {
  if (currentLevel <= LOG_LEVELS.error) {
    console.error(formatMessage('error', message, data));
  }
}

export default { setLogLevel, debug, info, warn, error };
