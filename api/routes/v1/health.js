/**
 * Health check route
 * @module routes/v1/health
 */

import { Router } from 'express';

const router = Router();

/**
 * GET /api/v1/health
 * Returns service health status
 */
router.get('/', (req, res) => {
  res.json({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

export default router;
