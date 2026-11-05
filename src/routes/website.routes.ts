/**
 * OBLIVION - Website Routes
 */

import { Router } from 'express';
import { WebsiteController } from '../controllers/website.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  requireTenantContext,
  rejectInjectedTenantFields,
  validateUuidParam,
} from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import {
  createWebsiteSchema,
  updateWebsiteSchema,
  websiteQuerySchema,
} from '../validators/website.validator';

const router = Router();

// Apply authentication and tenant safety to all website endpoints
router.use(authenticate);
router.use(requireTenantContext);

router.post(
  '/',
  rejectInjectedTenantFields,
  validateRequest({ body: createWebsiteSchema }),
  WebsiteController.create
);

router.get(
  '/',
  validateRequest({ query: websiteQuerySchema }),
  WebsiteController.list
);

router.get(
  '/:id',
  validateUuidParam('id'),
  WebsiteController.getById
);

router.patch(
  '/:id',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: updateWebsiteSchema }),
  WebsiteController.update
);

router.delete(
  '/:id',
  validateUuidParam('id'),
  WebsiteController.delete
);

export default router;
