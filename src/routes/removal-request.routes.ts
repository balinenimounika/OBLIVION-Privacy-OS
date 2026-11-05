/**
 * OBLIVION - Removal Request & History Routes
 */

import { Router } from 'express';
import { RemovalRequestController } from '../controllers/removal-request.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  requireTenantContext,
  rejectInjectedTenantFields,
  validateUuidParam,
} from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import {
  createRemovalRequestSchema,
  updateRemovalRequestSchema,
  removalRequestQuerySchema,
} from '../validators/removal-request.validator';
import {
  previewStatutoryDemandSchema,
  dispatchStatutoryDemandSchema,
} from '../validators/statutory-demand.validator';

const router = Router();

router.use(authenticate);
router.use(requireTenantContext);

router.post(
  '/',
  rejectInjectedTenantFields,
  validateRequest({ body: createRemovalRequestSchema }),
  RemovalRequestController.create
);

router.get(
  '/',
  validateRequest({ query: removalRequestQuerySchema }),
  RemovalRequestController.list
);

router.get(
  '/:id',
  validateUuidParam('id'),
  RemovalRequestController.getById
);

router.patch(
  '/:id',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: updateRemovalRequestSchema }),
  RemovalRequestController.update
);

router.put(
  '/:id',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: updateRemovalRequestSchema }),
  RemovalRequestController.update
);

// Module 5: Request History
router.get(
  '/:id/history',
  validateUuidParam('id'),
  RemovalRequestController.getHistory
);

// Milestone 10: The Forget Engine - Statutory Legal Notices
router.post(
  '/:id/preview-demand',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: previewStatutoryDemandSchema }),
  RemovalRequestController.previewDemand
);

router.post(
  '/:id/dispatch-demand',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: dispatchStatutoryDemandSchema }),
  RemovalRequestController.dispatchDemand
);

export default router;
