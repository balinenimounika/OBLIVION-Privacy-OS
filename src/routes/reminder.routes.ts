/**
 * OBLIVION - Reminder Routes
 */

import { Router } from 'express';
import { ReminderController } from '../controllers/reminder.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  requireTenantContext,
  rejectInjectedTenantFields,
  validateUuidParam,
} from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import {
  createReminderSchema,
  updateReminderSchema,
  reminderQuerySchema,
} from '../validators/reminder.validator';

const router = Router();

router.use(authenticate);
router.use(requireTenantContext);

router.post(
  '/',
  rejectInjectedTenantFields,
  validateRequest({ body: createReminderSchema }),
  ReminderController.create
);

router.get(
  '/',
  validateRequest({ query: reminderQuerySchema }),
  ReminderController.list
);

router.get(
  '/:id',
  validateUuidParam('id'),
  ReminderController.getById
);

router.patch(
  '/:id',
  rejectInjectedTenantFields,
  validateUuidParam('id'),
  validateRequest({ body: updateReminderSchema }),
  ReminderController.update
);

router.delete(
  '/:id',
  validateUuidParam('id'),
  ReminderController.delete
);

export default router;
