/**
 * OBLIVION - Multi-Tenant Security Verification Routes
 *
 * Exposes tenant-protected endpoints enforcing verified user ownership.
 * Used for live HTTP verification of tenant boundaries and isolation rules.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.middleware';
import {
  validateUuidParam,
  rejectInjectedTenantFields,
  requireTenantContext,
} from '../middleware/tenant-guard.middleware';
import { TenantSecurity } from '../utils/tenant-security';
import { ApiResponse } from '../utils/api-response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Helper to safely extract string parameter in Express 5
function getId(req: AuthenticatedRequest, key = 'id'): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val as string);
}

// Apply global authentication and tenant context guards to all tenant routes
router.use(authenticate);
router.use(requireTenantContext);
router.use(rejectInjectedTenantFields);

// -----------------------------------------------------------------------------
// 1. WEBSITES
// -----------------------------------------------------------------------------
router.post(
  '/websites',
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const website = await TenantSecurity.websites.create(req.user!.id, req.body);
      ApiResponse.created(res, 'Website created successfully', website);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/websites/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const website = await TenantSecurity.websites.get(req.user!.id, getId(req));
      ApiResponse.success(res, 'Website retrieved successfully', website);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/websites/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updated = await TenantSecurity.websites.update(
        req.user!.id,
        getId(req),
        req.body
      );
      ApiResponse.success(res, 'Website updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/websites/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deleted = await TenantSecurity.websites.delete(req.user!.id, getId(req));
      ApiResponse.success(res, 'Website deleted successfully', deleted);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// 2. EXPOSURE RECORDS
// -----------------------------------------------------------------------------
router.get(
  '/exposure-records/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = await TenantSecurity.exposureRecords.get(req.user!.id, getId(req));
      ApiResponse.success(res, 'Exposure record retrieved successfully', record);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/exposure-records/:id/categories',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await TenantSecurity.exposureRecordCategories.add(
        req.user!.id,
        getId(req),
        req.body.dataCategoryId
      );
      ApiResponse.created(res, 'Category attached to exposure record', result);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// 3. REMOVAL REQUESTS
// -----------------------------------------------------------------------------
router.get(
  '/removal-requests/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = await TenantSecurity.removalRequests.get(req.user!.id, getId(req));
      ApiResponse.success(res, 'Removal request retrieved successfully', request);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// 4. REMINDERS
// -----------------------------------------------------------------------------
router.get(
  '/reminders/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reminder = await TenantSecurity.reminders.get(req.user!.id, getId(req));
      ApiResponse.success(res, 'Reminder retrieved successfully', reminder);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// 5. NOTIFICATIONS
// -----------------------------------------------------------------------------
router.get(
  '/notifications/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notification = await TenantSecurity.notifications.get(
        req.user!.id,
        getId(req)
      );
      ApiResponse.success(res, 'Notification retrieved successfully', notification);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// 6. AUDIT LOGS
// -----------------------------------------------------------------------------
router.get(
  '/audit-logs/:id',
  validateUuidParam('id'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const log = await TenantSecurity.auditLogs.get(req.user!.id, getId(req));
      ApiResponse.success(res, 'Audit log retrieved successfully', log);
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// 7. DATA CATEGORIES (Reference Data - Read-only for authenticated users)
// -----------------------------------------------------------------------------
router.get(
  '/data-categories',
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await TenantSecurity.dataCategories.list();
      ApiResponse.success(res, 'Data categories retrieved successfully', categories);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
