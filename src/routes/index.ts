/**
 * OBLIVION - Master API Router
 *
 * Mounts all sub-routers under /api/v1
 */

import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import tenantSecurityRoutes from './tenant-security.routes';
import websiteRoutes from './website.routes';
import exposureRoutes from './exposure.routes';
import categoryRoutes from './category.routes';
import removalRequestRoutes from './removal-request.routes';
import reminderRoutes from './reminder.routes';
import notificationRoutes from './notification.routes';
import dashboardRoutes from './dashboard.routes';
import auditLogRoutes from './audit-log.routes';
import userPreferenceRoutes from './user-preference.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

// Health Check
router.use('/health', healthRoutes);

// Authentication & Identity
router.use('/auth', authRoutes);

// Multi-Tenant Security & Ownership
router.use('/tenant', tenantSecurityRoutes);

// Module 1: Websites
router.use('/websites', websiteRoutes);

// Module 2: Exposure Records
router.use('/exposures', exposureRoutes);

// Module 3: Data Categories
router.use('/categories', categoryRoutes);

// Module 4 & 5: Removal Requests & Request History
router.use('/removal-requests', removalRequestRoutes);

// Module 6: Reminders
router.use('/reminders', reminderRoutes);

// Module 7: Notifications
router.use('/notifications', notificationRoutes);

// Module 8: Dashboard Analytics
router.use('/dashboard', dashboardRoutes);

// Module 9 / Phase 5: Audit Logging & Compliance
router.use('/audit-logs', auditLogRoutes);

// User Notification & Email Preferences
router.use('/users/preferences', userPreferenceRoutes);

// Public Webhooks (Resend Delivery Callbacks)
router.use('/webhooks', webhookRoutes);

export default router;
