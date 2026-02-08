/**
 * Games metadata routes
 * @module routes/v1/games
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as gameService from '../../services/game-service.js';
import * as cardService from '../../services/card-service.js';
import { validatePagination, validateRequired } from '../../utils/validator.js';
import { config } from '../../config.js';

const router = Router();

/**
 * GET /api/v1/games
 * List games with optional category/search filtering
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const { limit, offset } = validatePagination(
      req.query,
      config.pagination.defaultLimit,
      config.pagination.maxLimit
    );

    const result = await gameService.listGames({
      category, search, limit, offset
    });

    res.json({
      data: result.data,
      meta: { total: result.total, limit, offset }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/games/single-player
 * List games that support single-player mode
 */
router.get('/single-player', async (req, res, next) => {
  try {
    const { limit, offset } = validatePagination(
      req.query,
      config.pagination.defaultLimit,
      config.pagination.maxLimit
    );

    const result = await gameService.listSinglePlayerGames({
      limit, offset
    });

    res.json({
      data: result.data,
      meta: { total: result.total, limit, offset }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/games/:gameId
 * Get a single game by ID
 */
router.get('/:gameId', async (req, res, next) => {
  try {
    const data = await gameService.getGame(req.params.gameId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/games/:gameId/categories
 * List card categories for a game
 */
router.get('/:gameId/categories', async (req, res, next) => {
  try {
    const data = await cardService.listCategories(req.params.gameId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/games (requires auth)
 * Create a new game
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    validateRequired(req.body, ['id', 'name']);

    const data = await gameService.createGame({
      id: req.body.id,
      name: req.body.name,
      description: req.body.description || '',
      min_players: req.body.min_players ?? 2,
      max_players: req.body.max_players ?? 4,
      category: req.body.category || 'card',
      tags: req.body.tags || [],
      metadata: req.body.metadata || {}
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/games/:gameId (requires auth)
 * Update a game
 */
router.put('/:gameId', requireAuth, async (req, res, next) => {
  try {
    const allowed = [
      'name', 'description', 'min_players', 'max_players',
      'category', 'tags', 'metadata'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const data = await gameService.updateGame(req.params.gameId, updates);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/games/:gameId/categories (requires auth)
 * Create a card category
 */
router.post('/:gameId/categories', requireAuth, async (req, res, next) => {
  try {
    validateRequired(req.body, ['name', 'display_name']);

    const data = await cardService.createCategory(req.params.gameId, {
      name: req.body.name,
      display_name: req.body.display_name,
      sort_order: req.body.sort_order ?? 0
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
