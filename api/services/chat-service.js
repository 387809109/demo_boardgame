/**
 * Chat service — manages AI conversation sessions
 * @module services/chat-service
 */

import OpenAI from 'openai';
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';
import * as logger from '../utils/logger.js';

const SYSTEM_PROMPT = `你是一个桌游规则助手，专门回答用户关于桌游规则的问题。

## 你的能力
- 解答游戏规则疑问（UNO、狼人杀等常见桌游）
- 解释特殊情况的处理方式
- 比较不同规则变体的区别
- 用通俗语言解释复杂规则

## 你的约束
- 只回答与桌游规则相关的问题，拒绝无关话题
- 如果不确定某条规则，如实告知而非编造
- 使用中文回答`;

/** @type {Map<string, ChatSession>} */
const sessions = new Map();

/** Session cleanup timer ID */
let cleanupTimer = null;

/**
 * @typedef {Object} ChatMessage
 * @property {string} role - 'user' | 'assistant'
 * @property {string} content - Message content
 * @property {number} timestamp - Unix ms
 */

/**
 * @typedef {Object} ChatSession
 * @property {string} sessionId
 * @property {ChatMessage[]} messages
 * @property {number} createdAt
 * @property {number} lastActiveAt
 * @property {number} totalTokens
 */

/**
 * Generate a unique session ID
 * @returns {string}
 */
function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `sess_${ts}${rand}`;
}

/**
 * Get or create OpenAI client (lazy init)
 * @returns {OpenAI}
 */
let openaiClient = null;

function getOpenAIClient() {
  if (!config.openai.apiKey) {
    throw new ApiError(
      'OpenAI API key is not configured',
      503,
      'AI_NOT_CONFIGURED'
    );
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/**
 * Build the messages array for OpenAI API call
 * @param {ChatSession} session
 * @param {string} userMessage
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessages(session, userMessage) {
  const msgs = [{ role: 'system', content: SYSTEM_PROMPT }];

  // Add history (only role + content, no timestamp)
  for (const msg of session.messages) {
    msgs.push({ role: msg.role, content: msg.content });
  }

  msgs.push({ role: 'user', content: userMessage });
  return msgs;
}

/**
 * Trim session history if it exceeds maxHistory rounds
 * A "round" = one user message + one assistant reply
 * @param {ChatSession} session
 */
function trimHistory(session) {
  const maxMessages = config.chat.maxHistory * 2;
  if (session.messages.length > maxMessages) {
    session.messages = session.messages.slice(-maxMessages);
  }
}

/**
 * Send a message and get AI reply
 * @param {string} message - User message (1~1000 chars)
 * @param {string} [sessionId] - Existing session ID, or omit to create new
 * @returns {Promise<{sessionId: string, reply: string, usage: object}>}
 */
export async function sendMessage(message, sessionId) {
  const client = getOpenAIClient();

  // Get or create session
  let session;
  if (sessionId) {
    session = sessions.get(sessionId);
    if (!session) {
      throw new ApiError(
        'Session not found or expired',
        404,
        'SESSION_NOT_FOUND'
      );
    }
  } else {
    sessionId = generateSessionId();
    session = {
      sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      totalTokens: 0,
    };
    sessions.set(sessionId, session);
  }

  // Check token limit
  if (session.totalTokens >= config.chat.maxSessionTokens) {
    throw new ApiError(
      'Session token limit exceeded. Please start a new conversation.',
      400,
      'SESSION_TOKEN_LIMIT'
    );
  }

  // Build messages and call OpenAI
  const apiMessages = buildMessages(session, message);

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: config.openai.model,
      messages: apiMessages,
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
    });
  } catch (err) {
    logger.error('OpenAI API error', {
      status: err.status,
      message: err.message,
      code: err.code,
    });

    if (err.status === 401) {
      throw new ApiError(
        'AI service authentication failed. Please check API key.',
        503,
        'AI_NOT_CONFIGURED'
      );
    }
    throw new ApiError(
      'AI service is temporarily unavailable. Please try again later.',
      502,
      'AI_SERVICE_ERROR'
    );
  }

  const reply = completion.choices[0]?.message?.content || '';
  const usage = completion.usage || {};

  // Update session
  const now = Date.now();
  session.messages.push(
    { role: 'user', content: message, timestamp: now },
    { role: 'assistant', content: reply, timestamp: Date.now() }
  );
  session.lastActiveAt = Date.now();
  session.totalTokens += usage.total_tokens || 0;

  // Trim if too long
  trimHistory(session);

  return {
    sessionId,
    reply,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    },
  };
}

/**
 * Get session info and message history
 * @param {string} sessionId
 * @returns {object}
 */
export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new ApiError(
      'Session not found or expired',
      404,
      'SESSION_NOT_FOUND'
    );
  }
  return {
    sessionId: session.sessionId,
    messages: session.messages,
    createdAt: session.createdAt,
    messageCount: session.messages.length,
  };
}

/**
 * Delete a session
 * @param {string} sessionId
 * @returns {{deleted: boolean}}
 */
export function deleteSession(sessionId) {
  const existed = sessions.delete(sessionId);
  if (!existed) {
    throw new ApiError(
      'Session not found or expired',
      404,
      'SESSION_NOT_FOUND'
    );
  }
  return { deleted: true };
}

/**
 * Remove expired sessions (called by cleanup timer)
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt > config.chat.sessionTtlMs) {
      sessions.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired chat session(s)`);
  }
}

/**
 * Start the periodic session cleanup timer
 */
export function startCleanupTimer() {
  if (cleanupTimer) return;
  // Run every 5 minutes
  cleanupTimer = setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
  // Don't prevent process exit
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Stop the cleanup timer (for testing / graceful shutdown)
 */
export function stopCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Clear all sessions (for testing)
 */
export function _clearAllSessions() {
  sessions.clear();
}

/**
 * Reset the OpenAI client (for testing)
 */
export function _resetClient() {
  openaiClient = null;
}
