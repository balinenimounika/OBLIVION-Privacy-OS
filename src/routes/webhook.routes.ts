/**
 * OBLIVION - Webhook Routes
 */

import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

// Resend webhook endpoint (public endpoint called by Resend infrastructure)
router.post('/resend', WebhookController.handleResendWebhook);

export default router;
