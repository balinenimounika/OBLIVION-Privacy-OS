/**
 * OBLIVION - Exposure Record Routes
 */

import { Router } from 'express';
import { ExposureController } from '../controllers/exposure.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  requireTenantContext,
  rejectInjectedTenantFields,
  validateUuidParam,
} from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import {
  createExposureSchema,
  updateExposureSchema,
  exposureQuerySchema,
  createExposureRemovalSchema,
} from '../validators/exposure.validator';

const router = Router();

router.use(authenticate);
router.use(requireTenantContext);

router.post(
  '/',
  rejectInjectedTenantFields,
  validateRequest({ body: createExposureSchema }),
  ExposureController.create
);

router.get(
  '/',
  validateRequest({ query: exposureQuerySchema }),
  ExposureController.list
);

// Aggregated summary metrics (registered before :id parameter route)
router.get(
  '/summary',
  ExposureController.getSummary
);

router.get(
  '/:id',
  validateUuidParam('id'),
  ExposureController.getById
);

router.patch(
  '/:id',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: updateExposureSchema }),
  ExposureController.update
);

router.patch(
  '/:id/resolve',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  ExposureController.markResolved
);

router.post(
  '/:id/removal-requests',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: createExposureRemovalSchema }),
  ExposureController.createRemovalRequest
);

router.delete(
  '/:id',
  validateUuidParam('id'),
  ExposureController.delete
);

export default router;
