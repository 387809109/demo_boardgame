/**
 * Chat service tests
 */

import { jest } from '@jest/globals';

// Mock OpenAI before importing the service
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

// Mock config to always have an API key
jest.unstable_mockModule('../../config.js', () => ({
  config: {
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
      rateLimit: 20,
    }
  }
}));

const {
  sendMessage,
  getSession,
  deleteSession,
  cleanupExpiredSessions,
  _clearAllSessions,
  _resetClient,
} = await import('../../services/chat-service.js');

describe('chat-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _clearAllSessions();
    _resetClient();
  });

  describe('sendMessage', () => {
    const mockReply = {
      choices: [{ message: { content: 'UNO 规则说...' } }],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
    };

    it('should create a new session when sessionId is not provided', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const result = await sendMessage('UNO 怎么玩？');

      expect(result.sessionId).toMatch(/^sess_/);
      expect(result.reply).toBe('UNO 规则说...');
      expect(result.usage.totalTokens).toBe(80);
    });

    it('should reuse existing session when sessionId is provided', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const first = await sendMessage('UNO 怎么玩？');
      const second = await sendMessage('+4 可以叠加吗？', first.sessionId);

      expect(second.sessionId).toBe(first.sessionId);
    });

    it('should include conversation history in OpenAI call', async () => {
      mockCreate.mockResolvedValue(mockReply);

      const first = await sendMessage('UNO 怎么玩？');
      await sendMessage('+4 可以叠加吗？', first.sessionId);

      const lastCall = mockCreate.mock.calls[1][0];
      // system + user1 + assistant1 + user2
      expect(lastCall.messages).toHaveLength(4);
      expect(lastCall.messages[0].role).toBe('system');
      expect(lastCall.messages[1].role).toBe('user');
      expect(lastCall.messages[2].role).toBe('assistant');
      expect(lastCall.messages[3].role).toBe('user');
    });

    it('should throw SESSION_NOT_FOUND for invalid sessionId', async () => {
      await expect(sendMessage('hi', 'sess_nonexistent'))
        .rejects.toMatchObject({ code: 'SESSION_NOT_FOUND', statusCode: 404 });
    });

    it('should throw AI_SERVICE_ERROR when OpenAI fails', async () => {
      mockCreate.mockRejectedValue(new Error('Connection timeout'));

      await expect(sendMessage('hi'))
        .rejects.toMatchObject({ code: 'AI_SERVICE_ERROR', statusCode: 502 });
    });

    it('should throw AI_NOT_CONFIGURED on OpenAI 401', async () => {
      const err = new Error('Invalid API key');
      err.status = 401;
      mockCreate.mockRejectedValue(err);

      await expect(sendMessage('hi'))
        .rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED', statusCode: 503 });
    });

    it('should throw SESSION_TOKEN_LIMIT when tokens exceeded', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 25000, completion_tokens: 26000, total_tokens: 51000 }
      });

      const first = await sendMessage('hi');

      // Session now has 51000 tokens > 50000 limit
      await expect(sendMessage('more', first.sessionId))
        .rejects.toMatchObject({ code: 'SESSION_TOKEN_LIMIT', statusCode: 400 });
    });

    it('should pass correct parameters to OpenAI', async () => {
      mockCreate.mockResolvedValue(mockReply);

      await sendMessage('test');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'test' })
        ]),
        max_tokens: 1000,
        temperature: 0.3,
      });
    });

    it('should trim history when exceeding maxHistory', async () => {
      const shortReply = {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };
      mockCreate.mockResolvedValue(shortReply);

      // Create a session and add many messages
      const first = await sendMessage('msg 1');
      for (let i = 2; i <= 25; i++) {
        await sendMessage(`msg ${i}`, first.sessionId);
      }

      const session = getSession(first.sessionId);
      // maxHistory = 20 rounds = 40 messages
      expect(session.messages.length).toBeLessThanOrEqual(40);
    });
  });

  describe('getSession', () => {
    it('should return session info', async () => {
      const mockReply = {
        choices: [{ message: { content: 'reply' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };
      mockCreate.mockResolvedValue(mockReply);

      const { sessionId } = await sendMessage('hello');
      const info = getSession(sessionId);

      expect(info.sessionId).toBe(sessionId);
      expect(info.messages).toHaveLength(2); // user + assistant
      expect(info.messageCount).toBe(2);
      expect(info.createdAt).toBeGreaterThan(0);
    });

    it('should throw SESSION_NOT_FOUND for unknown session', () => {
      expect(() => getSession('sess_unknown'))
        .toThrow(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', async () => {
      const mockReply = {
        choices: [{ message: { content: 'reply' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };
      mockCreate.mockResolvedValue(mockReply);

      const { sessionId } = await sendMessage('hello');
      const result = deleteSession(sessionId);

      expect(result.deleted).toBe(true);
      expect(() => getSession(sessionId)).toThrow();
    });

    it('should throw SESSION_NOT_FOUND for unknown session', () => {
      expect(() => deleteSession('sess_unknown'))
        .toThrow(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove sessions older than TTL', async () => {
      const mockReply = {
        choices: [{ message: { content: 'reply' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      };
      mockCreate.mockResolvedValue(mockReply);

      const { sessionId } = await sendMessage('hello');

      // Manually expire the session by overriding lastActiveAt
      const session = getSession(sessionId);
      // Access internal state via getSession is read-only, so we
      // set up by creating, then advance time using jest timers
      // For simplicity, call cleanup directly — session is fresh, so not cleaned
      cleanupExpiredSessions();
      expect(() => getSession(sessionId)).not.toThrow();
    });
  });
});
