/**
 * OBLIVION - User Notification Preference Routes
 */

import { Router } from 'express';
import { UserPreferenceController } from '../controllers/user-preference.controller';
import { authenticate } from '../middleware/authenticate.middleware';

const router = Router();

router.use(authenticate);

router.get('/', UserPreferenceController.getPreferences);
router.put('/', UserPreferenceController.updatePreferences);
router.patch('/', UserPreferenceController.updatePreferences);

// Email delivery history & verification management
router.get('/deliveries', UserPreferenceController.getEmailDeliveries);
router.post('/deliveries/:id/sync', UserPreferenceController.syncDelivery);
router.post('/deliveries/:id/retry', UserPreferenceController.retryDelivery);
router.post('/deliveries/retry-failed', UserPreferenceController.retryAllFailedDeliveries);
router.get('/domain-status', UserPreferenceController.getDomainStatus);
router.post('/resend-verification', UserPreferenceController.resendVerification);
router.post('/verify-email', UserPreferenceController.verifyEmail);

export default router;
