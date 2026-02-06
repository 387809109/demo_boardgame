/**
 * Unified error handling middleware
 * @module middleware/error-handler
 */

import { ApiError } from '../utils/errors.js';
import { error as logError } from '../utils/logger.js';

/**
 * Express error handling middleware
 * @param {Error} err - Error object
 * @param {import('express').Request} req - Request
 * @param {import('express').Response} res - Response
 * @param {import('express').NextFunction} _next - Next function
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    const body = {
      error: {
        code: err.code,
        message: err.message
      }
    };
    if (err.details) {
      body.error.details = err.details;
    }
    return res.status(err.statusCode).json(body);
  }

  // Unexpected errors
  logError('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}
