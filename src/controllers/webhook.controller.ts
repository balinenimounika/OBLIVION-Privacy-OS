/**
 * OBLIVION - Resend Webhook Controller
 *
 * Receives and processes asynchronous transactional email delivery status events from Resend.
 * Features:
 * - Cryptographic signature verification
 * - Idempotent status transition guards (prevents overwriting DELIVERED with SENT)
 * - Safe error logging with zero credential leakage
 */

import { Request, Response, NextFunction } from 'express';
import { EmailDeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { EmailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export class WebhookController {
  /**
   * Handles incoming Resend delivery events.
   */
  static async handleResendWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idHeader =
        (req.headers['svix-id'] as string) ||
        (req.headers['webhook-id'] as string);
      const timestampHeader =
        (req.headers['svix-timestamp'] as string) ||
        (req.headers['webhook-timestamp'] as string);
      const signatureHeader =
        (req.headers['svix-signature'] as string) ||
        (req.headers['webhook-signature'] as string);

      const rawPayload = (req as any).rawBody || JSON.stringify(req.body);

      // Verify webhook signature if secret is configured
      if (env.RESEND_WEBHOOK_SECRET && env.RESEND_WEBHOOK_SECRET.trim() !== '') {
        const verification = EmailService.verifyWebhookSignature({
          rawPayload,
          headers: {
            id: idHeader,
            timestamp: timestampHeader,
            signature: signatureHeader,
          },
          webhookSecret: env.RESEND_WEBHOOK_SECRET,
        });

        if (!verification.isValid) {
          logger.warn(`[WebhookController] Invalid webhook signature from ${req.ip}: ${verification.error}`);
          res.status(400).json({
            success: false,
            message: `Webhook signature verification failed: ${verification.error}`,
          });
          return;
        }
      } else if (env.NODE_ENV === 'production') {
        logger.error('[WebhookController] Missing RESEND_WEBHOOK_SECRET in production. Rejecting unverified webhook.');
        res.status(403).json({
          success: false,
          message: 'Webhook signature verification required in production',
        });
        return;
      } else {
        logger.info('[WebhookController] Processing webhook (no RESEND_WEBHOOK_SECRET configured, skipping verification in dev)');
      }

      const event = req.body;
      if (!event || !event.type) {
        res.status(400).json({ success: false, message: 'Invalid webhook payload structure' });
        return;
      }

      const eventType: string = event.type;
      const data = event.data || {};
      const resendEmailId: string | undefined = data.email_id || data.id;

      if (!resendEmailId) {
        logger.warn(`[WebhookController] Event ${eventType} received without email_id`);
        res.status(200).json({ success: true, message: 'Ignored: No email_id present' });
        return;
      }

      logger.info(`[WebhookController] Processing event "${eventType}" for Resend ID ${resendEmailId}`);

      const delivery = await prisma.emailDelivery.findFirst({
        where: { resendEmailId },
      });

      if (!delivery) {
        logger.info(`[WebhookController] No local delivery tracking record found for Resend ID ${resendEmailId}`);
        res.status(200).json({ success: true, message: 'Acknowledged: No matching delivery record' });
        return;
      }

      // Safe state transitions: Never degrade DELIVERED to SENT or PENDING
      switch (eventType) {
        case 'email.delivered':
          await prisma.emailDelivery.update({
            where: { id: delivery.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.DELIVERED,
              deliveredAt: event.created_at ? new Date(event.created_at) : new Date(),
            },
          });
          logger.info(`[WebhookController] Updated delivery ${delivery.id} to DELIVERED`);
          break;

        case 'email.sent':
          if (
            delivery.deliveryStatus === EmailDeliveryStatus.PENDING ||
            delivery.deliveryStatus === EmailDeliveryStatus.SENDING
          ) {
            await prisma.emailDelivery.update({
              where: { id: delivery.id },
              data: {
                deliveryStatus: EmailDeliveryStatus.SENT,
                sentAt: event.created_at ? new Date(event.created_at) : new Date(),
              },
            });
            logger.info(`[WebhookController] Updated delivery ${delivery.id} to SENT`);
          }
          break;

        case 'email.bounced':
          await prisma.emailDelivery.update({
            where: { id: delivery.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.BOUNCED,
              failedAt: new Date(),
              errorMessage: data.bounce?.message || 'Recipient email bounced',
            },
          });
          logger.warn(`[WebhookController] Updated delivery ${delivery.id} to BOUNCED`);
          break;

        case 'email.complained':
          await prisma.emailDelivery.update({
            where: { id: delivery.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.FAILED,
              failedAt: new Date(),
              errorMessage: 'Recipient marked email as spam/complaint',
            },
          });
          logger.warn(`[WebhookController] Updated delivery ${delivery.id} to FAILED (complaint)`);
          break;

        case 'email.delivery_delayed':
          logger.info(`[WebhookController] Delivery delayed for ${delivery.id}`);
          break;

        default:
          logger.info(`[WebhookController] Unhandled event type: ${eventType}`);
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (err: any) {
      logger.error('[WebhookController] Unexpected error in webhook handler:', err.message);
      next(err);
    }
  }
}
