/**
 * CORS middleware configuration
 * @module middleware/cors
 */

import cors from 'cors';
import { config } from '../config.js';

/**
 * Create CORS middleware with configured allowed origins
 * @returns {import('express').RequestHandler}
 */
export function createCorsMiddleware() {
  return cors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  });
}
