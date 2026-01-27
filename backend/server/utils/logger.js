/**
 * Logger utility with optional JSON output and file sink
 */

import fs from 'fs';
import path from 'path';

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLevel = LOG_LEVELS.info;
let currentFormat = 'json';
let logFileStream = null;

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
 * Set log output format
 * @param {'pretty'|'json'} format - Log format
 */
export function setLogFormat(format) {
  if (format === 'pretty' || format === 'json') {
    currentFormat = format;
  }
}

/**
 * Set log file output path
 * @param {string|null} filePath - Log file path
 */
export function setLogFile(filePath) {
  if (logFileStream) {
    logFileStream.end();
    logFileStream = null;
  }

  if (!filePath) {
    return;
  }

  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  logFileStream = fs.createWriteStream(filePath, { flags: 'a' });
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
  if (currentFormat === 'json') {
    const payload = {
      level,
      timestamp,
      message
    };
    if (data !== undefined) {
      payload.data = data;
    }
    return JSON.stringify(payload);
  }

  const levelStr = level.toUpperCase().padEnd(5);
  let output = `[${levelStr}] ${timestamp} ${message}`;
  if (data !== undefined) {
    output += ` ${JSON.stringify(data)}`;
  }
  return output;
}

/**
 * Write a log message to console and optional file
 * @param {string} level
 * @param {string} message
 * @param {*} [data]
 * @param {Function} consoleFn
 */
function writeLog(level, message, data, consoleFn) {
  const line = formatMessage(level, message, data);
  consoleFn(line);
  if (logFileStream) {
    logFileStream.write(line + '\n');
  }
}

/**
 * Log at debug level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function debug(message, data) {
  if (currentLevel <= LOG_LEVELS.debug) {
    writeLog('debug', message, data, console.log);
  }
}

/**
 * Log at info level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function info(message, data) {
  if (currentLevel <= LOG_LEVELS.info) {
    writeLog('info', message, data, console.log);
  }
}

/**
 * Log at warn level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function warn(message, data) {
  if (currentLevel <= LOG_LEVELS.warn) {
    writeLog('warn', message, data, console.warn);
  }
}

/**
 * Log at error level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data
 */
export function error(message, data) {
  if (currentLevel <= LOG_LEVELS.error) {
    writeLog('error', message, data, console.error);
  }
}

export default {
  setLogLevel,
  setLogFormat,
  setLogFile,
  debug,
  info,
  warn,
  error
};
