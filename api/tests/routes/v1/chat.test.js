/**
 * Chat route integration tests
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import request from 'supertest';

// Mock OpenAI
const mockCreate = jest.fn();

jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }))
}));

// Mock config
jest.unstable_mockModule('../../../config.js', () => ({
  config: {
    port: 3001,
    nodeEnv: 'test',
    logLevel: 'error',
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceRoleKey: '',
    allowedOrigins: ['http://localhost:5173'],
    rateLimit: { windowMs: 15 * 60 * 1000, max: 1000 },
    pagination: { defaultLimit: 20, maxLimit: 100 },
    openai: {
      apiKey: 'test-key-12345',
      model: 'gpt-4o-mini',
      maxTokens: 1000,
      temperature: 0.3,
    },
    chat: {
      sessionTtlMs: 30 * 60 * 1000,
      maxHistory: 20,
      maxSessionTokens: 50000,
      rateLimit: 1000, // high limit for tests
    }
  }
}));

// Mock supabase (required by other routes loaded in app.js)
jest.unstable_mockModule('../../../services/supabase.js', () => ({
  getSupabaseAdmin: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  }),
  getSupabaseClient: jest.fn()
}));

let app;
let chatService;

beforeAll(async () => {
  const appModule = await import('../../../app.js');
  app = appModule.default;
  chatService = await import('../../../services/chat-service.js');
});

const mockReply = {
  choices: [{ message: { content: 'UNO 标准规则中...' } }],
  usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
};

describe('Chat routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chatService._clearAllSessions();
    chatService._resetClient();
  });

  describe('POST /api/v1/chat', () => {
    it('should create a new session and return reply', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'UNO 怎么玩？' });

      expect(res.status).toBe(200);
      expect(res.body.data.sessionId).toMatch(/^sess_/);
      expect(res.body.data.reply).toBe('UNO 标准规则中...');
      expect(res.body.data.usage).toBeDefined();
      expect(res.body.data.usage.totalTokens).toBe(80);
    });

    it('should continue conversation with existing sessionId', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const first = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'UNO 怎么玩？' });

      const sessionId = first.body.data.sessionId;

      const second = await request(app)
        .post('/api/v1/chat')
        .send({ message: '+4 可以叠加吗？', sessionId });

      expect(second.status).toBe(200);
      expect(second.body.data.sessionId).toBe(sessionId);
    });

    it('should return 400 for empty message', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MESSAGE');
    });

    it('should return 400 for missing message', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MESSAGE');
    });

    it('should return 400 for non-string message', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 123 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MESSAGE');
    });

    it('should return 400 for message exceeding 1000 chars', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'a'.repeat(1001) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_MESSAGE');
    });

    it('should return 404 for non-existent sessionId', async () => {
      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'hi', sessionId: 'sess_nonexistent' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 502 when OpenAI fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const res = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'test' });

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('AI_SERVICE_ERROR');
    });
  });

  describe('GET /api/v1/chat/:sessionId', () => {
    it('should return session history', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const created = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'hello' });

      const sessionId = created.body.data.sessionId;

      const res = await request(app)
        .get(`/api/v1/chat/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.sessionId).toBe(sessionId);
      expect(res.body.data.messages).toHaveLength(2);
      expect(res.body.data.messageCount).toBe(2);
    });

    it('should return 404 for unknown session', async () => {
      const res = await request(app)
        .get('/api/v1/chat/sess_unknown');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/chat/:sessionId', () => {
    it('should delete an existing session', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const created = await request(app)
        .post('/api/v1/chat')
        .send({ message: 'hello' });

      const sessionId = created.body.data.sessionId;

      const res = await request(app)
        .delete(`/api/v1/chat/${sessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      // Verify session is gone
      const check = await request(app)
        .get(`/api/v1/chat/${sessionId}`);
      expect(check.status).toBe(404);
    });

    it('should return 404 for unknown session', async () => {
      const res = await request(app)
        .delete('/api/v1/chat/sess_unknown');

      expect(res.status).toBe(404);
    });
  });
});
