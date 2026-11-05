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

router.delete(
  '/:id',
  validateUuidParam('id'),
  ExposureController.delete
);

export default router;
