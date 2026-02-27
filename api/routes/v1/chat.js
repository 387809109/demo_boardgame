/**
 * Chat routes — AI rule Q&A conversations
 * @module routes/v1/chat
 */

import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rate-limiter.js';
import * as chatService from '../../services/chat-service.js';
import { getLoadedGames } from '../../services/rules-loader.js';
import { BadRequestError } from '../../utils/errors.js';
import { config } from '../../config.js';

const router = Router();

/** Rate limiter for POST /chat (independent from global) */
const chatPostLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: config.chat.rateLimit,
});

/** Rate limiter for GET /chat/* */
const chatGetLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

/**
 * POST /api/v1/chat
 * Send a message and get AI reply
 */
router.post('/', chatPostLimiter, async (req, res, next) => {
  try {
    const { message, sessionId, gameId } = req.body;

    // Validate message
    if (!message || typeof message !== 'string') {
      throw new BadRequestError(
        'Message is required and must be a string',
        'INVALID_MESSAGE'
      );
    }

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 1000) {
      throw new BadRequestError(
        'Message must be between 1 and 1000 characters',
        'INVALID_MESSAGE'
      );
    }

    // Validate gameId (optional)
    if (gameId !== undefined && gameId !== null) {
      if (typeof gameId !== 'string' || gameId.length > 50) {
        throw new BadRequestError(
          'gameId must be a string (max 50 chars)',
          'INVALID_GAME_ID'
        );
      }
    }

    const result = await chatService.sendMessage(
      trimmed, sessionId, gameId || undefined
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/chat/games
 * Get list of games with loaded rule documents
 */
router.get('/games', chatGetLimiter, (req, res) => {
  const games = getLoadedGames();
  res.json({ data: games });
});

/**
 * GET /api/v1/chat/:sessionId
 * Get conversation history
 */
router.get('/:sessionId', chatGetLimiter, async (req, res, next) => {
  try {
    const data = chatService.getSession(req.params.sessionId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/chat/:sessionId
 * Delete a conversation session
 */
router.delete('/:sessionId', async (req, res, next) => {
  try {
    const data = chatService.deleteSession(req.params.sessionId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
