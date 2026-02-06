/**
 * Rate limiting middleware
 * @module middleware/rate-limiter
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/**
 * Create rate limiter middleware
 * @param {object} [options] - Override default options
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    }
  });
}
