/**
 * Health check route tests
 */

import request from 'supertest';
import app from '../../../app.js';

describe('GET /api/v1/health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('1.0.0');
    expect(res.body.data.timestamp).toBeDefined();
  });
});
