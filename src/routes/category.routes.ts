/**
 * OBLIVION - Data Category Routes
 */

import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import { validateUuidParam } from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import { categoryQuerySchema } from '../validators/category.validator';

const router = Router();

// Categories require authenticated access
router.use(authenticate);

router.get(
  '/',
  validateRequest({ query: categoryQuerySchema }),
  CategoryController.list
);

router.get(
  '/:id',
  validateUuidParam('id'),
  CategoryController.getById
);

export default router;
