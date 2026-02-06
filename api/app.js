/**
 * Express application setup
 * Separated from index.js for testability
 * @module app
 */

import express from 'express';
import { createCorsMiddleware } from './middleware/cors.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';
import apiRouter from './routes/index.js';

const app = express();

// Body parsing
app.use(express.json());

// CORS
app.use(createCorsMiddleware());

// Rate limiting
app.use('/api', createRateLimiter());

// API routes
app.use('/api', apiRouter);

// 404 for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
});

// Error handling (must be last)
app.use(errorHandler);

export default app;
