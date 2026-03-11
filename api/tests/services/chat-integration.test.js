/**
 * Chat + rules-loader integration tests
 * Tests that rule context is properly injected into OpenAI calls
 */

import { jest } from '@jest/globals';

// Mock OpenAI — capture the messages sent to the API
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

// Load rules-loader first (real, not mocked)
const rulesLoader = await import('../../services/rules-loader.js');

const {
  sendMessage,
  _clearAllSessions,
  _resetClient,
} = await import('../../services/chat-service.js');

const mockReply = {
  choices: [{ message: { content: 'AI response here' } }],
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
};

describe('chat-service + rules-loader integration', () => {
  beforeAll(() => {
    rulesLoader.loadAllRules();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    _clearAllSessions();
    _resetClient();
    mockCreate.mockResolvedValue(mockReply);
  });

  afterAll(() => {
    rulesLoader._resetIndex();
  });

  it('injects werewolf seer rules when querying about seer', async () => {
    await sendMessage('预言家怎么查验', undefined, 'werewolf');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const messages = mockCreate.mock.calls[0][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    expect(systemMsg.content).toContain('游戏规则参考资料');
    expect(systemMsg.content).toContain('预言家');
  });

  it('injects UNO rules when querying about UNO cards', async () => {
    await sendMessage('万能牌什么时候可以出', undefined, 'uno');

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    expect(systemMsg.content).toContain('游戏规则参考资料');
  });

  it('uses default system prompt without gameId', async () => {
    await sendMessage('UNO 怎么玩');

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    expect(systemMsg.content).not.toContain('游戏规则参考资料');
  });

  it('persists gameId across session messages', async () => {
    // First message with gameId
    const result1 = await sendMessage('预言家是什么', undefined, 'werewolf');
    const sessionId = result1.sessionId;

    // Second message without gameId — should still use werewolf
    await sendMessage('女巫的技能呢', sessionId);

    const messages = mockCreate.mock.calls[1][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    expect(systemMsg.content).toContain('游戏规则参考资料');
  });

  it('allows gameId override mid-session', async () => {
    // Start with werewolf
    const result1 = await sendMessage('狼人杀规则', undefined, 'werewolf');
    const sessionId = result1.sessionId;

    // Switch to UNO
    await sendMessage('UNO出牌规则', sessionId, 'uno');

    const messages = mockCreate.mock.calls[1][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    // Should contain UNO-related content now
    expect(systemMsg.content).toContain('游戏规则参考资料');
  });

  it('does not exceed token budget in system prompt', async () => {
    // Broad query that could match many werewolf chunks
    await sendMessage('狼人杀所有角色的规则', undefined, 'werewolf');

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    // System prompt should be reasonable size (not entire doc set)
    // 3500 token budget ≈ 7000 chars for Chinese
    // Add ~500 chars for base system prompt
    expect(systemMsg.content.length).toBeLessThan(10000);
  });

  it('handles unknown gameId gracefully (no rules injected)', async () => {
    await sendMessage('how to play', undefined, 'nonexistent_game');

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    expect(systemMsg.content).not.toContain('游戏规则参考资料');
  });

  it('includes cross-role chunks for interaction queries', async () => {
    await sendMessage('女巫能救被狼人杀的人吗', undefined, 'werewolf');

    const messages = mockCreate.mock.calls[0][0].messages;
    const systemMsg = messages.find(m => m.role === 'system');

    expect(systemMsg.content).toContain('游戏规则参考资料');
    // Should contain witch-related content
    const hasWitchContent = systemMsg.content.includes('女巫')
      || systemMsg.content.includes('witch');
    expect(hasWitchContent).toBe(true);
  });
});
