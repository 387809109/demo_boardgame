/**
 * Card data routes
 * @module routes/v1/cards
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as cardService from '../../services/card-service.js';
import { validatePagination, validateRequired } from '../../utils/validator.js';
import { config } from '../../config.js';

const router = Router();

/**
 * GET /api/v1/games/:gameId/cards
 * List cards with optional category/search filtering and pagination
 */
router.get('/:gameId/cards', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const { limit, offset } = validatePagination(
      req.query,
      config.pagination.defaultLimit,
      config.pagination.maxLimit
    );

    const result = await cardService.listCards(req.params.gameId, {
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
 * GET /api/v1/games/:gameId/cards/:cardId
 * Get a single card by ID
 */
router.get('/:gameId/cards/:cardId', async (req, res, next) => {
  try {
    const data = await cardService.getCard(
      req.params.gameId,
      req.params.cardId
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/games/:gameId/cards (requires auth)
 * Create a card
 */
router.post('/:gameId/cards', requireAuth, async (req, res, next) => {
  try {
    validateRequired(req.body, ['name', 'display_name']);

    const data = await cardService.createCard(req.params.gameId, {
      name: req.body.name,
      display_name: req.body.display_name,
      description: req.body.description || '',
      category_id: req.body.category_id || null,
      effects: req.body.effects || {},
      attributes: req.body.attributes || {},
      image_url: req.body.image_url || null
    });

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/games/:gameId/cards/:cardId (requires auth)
 * Update a card
 */
router.put('/:gameId/cards/:cardId', requireAuth, async (req, res, next) => {
  try {
    const allowed = [
      'name', 'display_name', 'description', 'category_id',
      'effects', 'attributes', 'image_url'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const data = await cardService.updateCard(
      req.params.gameId,
      req.params.cardId,
      updates
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
