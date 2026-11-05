/**
 * OBLIVION - Audit Log Routes
 */

import { Router } from 'express';
import { AuditLogController } from '../controllers/audit-log.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  requireTenantContext,
  validateUuidParam,
} from '../middleware/tenant-guard.middleware';
import { validateRequest } from '../validators';
import { auditLogQuerySchema } from '../validators/audit-log.validator';

const router = Router();

// Apply authentication and tenant safety to all audit log endpoints
router.use(authenticate);
router.use(requireTenantContext);

// 1. Paginated Audit Trail
router.get(
  '/',
  validateRequest({ query: auditLogQuerySchema }),
  AuditLogController.list
);

// 2. Compliance Metrics Summary (Placed before /:id)
router.get(
  '/summary',
  AuditLogController.getSummary
);

// 3. GDPR Art. 15 Right of Access Export (Placed before /:id)
router.get(
  '/export',
  AuditLogController.exportLogs
);

// 4. Single Audit Log Entry
router.get(
  '/:id',
  validateUuidParam('id'),
  AuditLogController.getById
);

export default router;
