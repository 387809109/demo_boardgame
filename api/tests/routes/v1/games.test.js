/**
 * Games route tests
 */

import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const mockGames = [
  {
    id: 'uno',
    name: 'UNO',
    description: 'Classic card game',
    min_players: 2,
    max_players: 10,
    category: 'card',
    tags: ['family', 'party'],
    metadata: {}
  }
];

const mockCategories = [
  { id: 'cat-1', game_id: 'uno', name: 'action', display_name: 'Action' }
];

// Create a chainable mock that returns itself for all query methods
function createMockQueryBuilder(finalResult) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(finalResult),
    single: jest.fn().mockResolvedValue(finalResult),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis()
  };
  // Make all methods return the builder itself for chaining
  Object.keys(builder).forEach(key => {
    if (key !== 'range' && key !== 'single') {
      builder[key].mockReturnValue(builder);
    }
  });
  return builder;
}

// Mock Supabase before any imports
jest.unstable_mockModule('../../../services/supabase.js', () => ({
  getSupabaseAdmin: jest.fn().mockReturnValue({
    from: jest.fn().mockImplementation((table) => {
      if (table === 'games') {
        return createMockQueryBuilder({
          data: mockGames[0],
          error: null,
          count: 1
        });
      }
      if (table === 'card_categories') {
        const builder = createMockQueryBuilder({
          data: mockCategories,
          error: null
        });
        // Override order to return final result directly for categories
        builder.order = jest.fn().mockResolvedValue({
          data: mockCategories,
          error: null
        });
        return builder;
      }
      return createMockQueryBuilder({ data: [], error: null, count: 0 });
    })
  }),
  getSupabaseClient: jest.fn()
}));

// Dynamic import after mocks
let app;

beforeAll(async () => {
  const appModule = await import('../../../app.js');
  app = appModule.default;
});

describe('Games routes', () => {
  describe('GET /api/v1/games', () => {
    it('should return game list with meta', async () => {
      const res = await request(app).get('/api/v1/games');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
    });

    it('should accept pagination params', async () => {
      const res = await request(app)
        .get('/api/v1/games?limit=5&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.offset).toBe(0);
    });
  });

  describe('GET /api/v1/games/:gameId', () => {
    it('should return a single game', async () => {
      const res = await request(app).get('/api/v1/games/uno');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/v1/games/:gameId/categories', () => {
    it('should return categories for a game', async () => {
      const res = await request(app)
        .get('/api/v1/games/uno/categories');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('POST /api/v1/games', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/v1/games')
        .send({ id: 'chess', name: 'Chess' });

      expect(res.status).toBe(401);
    });
  });
});
