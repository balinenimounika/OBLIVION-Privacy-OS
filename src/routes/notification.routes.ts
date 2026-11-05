/**
 * OBLIVION - Notification Routes
 */

import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  requireTenantContext,
  validateUuidParam,
} from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import { notificationQuerySchema } from '../validators/notification.validator';

const router = Router();

router.use(authenticate);
router.use(requireTenantContext);

router.get(
  '/',
  validateRequest({ query: notificationQuerySchema }),
  NotificationController.list
);

router.patch(
  '/read-all',
  NotificationController.markAllRead
);

router.get(
  '/:id',
  validateUuidParam('id'),
  NotificationController.getById
);

router.patch(
  '/:id/read',
  validateUuidParam('id'),
  NotificationController.markRead
);

export default router;
