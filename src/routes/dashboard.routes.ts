/**
 * OBLIVION - Dashboard Analytics Routes
 */

import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate.middleware';
import { requireTenantContext } from '../middleware/tenant-guard.middleware';

const router = Router();

router.use(authenticate);
router.use(requireTenantContext);

router.get('/overview', DashboardController.getOverview);
router.get('/exposure-breakdown', DashboardController.getExposureBreakdown);
router.get('/removal-progress', DashboardController.getRemovalProgress);
router.get('/recent-activity', DashboardController.getRecentActivity);

export default router;
