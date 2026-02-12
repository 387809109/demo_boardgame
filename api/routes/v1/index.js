/**
 * V1 route aggregator
 * @module routes/v1
 */

import { Router } from 'express';
import healthRouter from './health.js';
import gamesRouter from './games.js';
import cardsRouter from './cards.js';
import chatRouter from './chat.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/games', gamesRouter);
router.use('/games', cardsRouter);
router.use('/chat', chatRouter);

export default router;
