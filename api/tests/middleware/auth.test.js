/**
 * Auth middleware tests
 */

import request from 'supertest';
import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/error-handler.js';

// Create a test app with auth middleware
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/protected', requireAuth, (req, res) => {
    res.json({ data: { userId: req.user.id } });
  });

  app.use(errorHandler);
  return app;
}

describe('requireAuth middleware', () => {
  let app;

  beforeAll(() => {
    // Set required env vars for Supabase client creation
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    app = createTestApp();
  });

  it('should return 401 when no Authorization header', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Missing authorization token');
  });

  it('should return 401 when Authorization header has no Bearer', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Token abc123');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
