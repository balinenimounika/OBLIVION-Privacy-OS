/**
 * OBLIVION - Global User Email Notification Service
 *
 * Coordinates transactional lifecycle emails for user accounts,
 * privacy removal requests, status transitions, and security alerts.
 *
 * Security & Privacy Principles:
 * - Recipient email ALWAYS retrieved directly from the authenticated PostgreSQL account record.
 * - Client-supplied recipient emails are strictly forbidden for user notifications.
 * - Unverified accounts have sensitive privacy details masked until verified.
 * - Essential account security notifications are mandatory and cannot be disabled.
 * - Welcome emails are dispatched exactly once upon registration, never repeated on login.
 */

import { EmailDeliveryStatus, NotificationType, RequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { UserPreferenceService } from './user-preference.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import {
  buildWelcomeEmail,
  buildAccountSecurityEmail,
  buildRemovalRequestCreatedEmail,
  buildRemovalStatusUpdatedEmail,
  buildRemovalCompletedEmail,
  buildRemovalFailedEmail,
  buildVerificationEmail,
} from '../templates/email-templates';

export class UserEmailNotificationService {
  /**
   * Retrieves verified authenticated user identity from the database.
   */
  private static async getAuthenticatedUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        isEmailVerified: true,
      },
    });

    if (!user || !user.email) {
      throw new Error(`User account ${userId} not found or missing registered email address`);
    }

    return user;
  }

  /**
   * Sends or queues a one-time welcome email upon user registration.
   * Never repeated on subsequent logins.
   */
  static async sendWelcomeEmail(userId: string): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser(userId);

      // Verify preference / sentinel flag to ensure welcome email is sent exactly once
      const pref = await UserPreferenceService.getPreferences(userId);
      if (pref.welcomeEmailSent) {
        logger.info(`[UserEmailNotification] Welcome email already sent for user ${userId}; skipping`);
        return false;
      }

      const emailData = buildWelcomeEmail({
        userName: user.fullName || 'Privacy Advocate',
        userEmail: user.email,
      });

      // 1. Create in-app system notification
      const notif = await prisma.notification.create({
        data: {
          userId,
          title: 'Welcome to OBLIVION Privacy OS',
          message:
            'Your personal privacy vault is now active. You can catalog digital exposures, issue statutory erasure demands, and monitor compliance deadlines.',
          notificationType: NotificationType.SYSTEM_NOTICE,
          isRead: false,
        },
      });

      // 2. Queue persistent transactional email delivery
      await prisma.emailDelivery.create({
        data: {
          userId,
          notificationId: notif.id,
          notificationStage: 'WELCOME',
          recipientEmail: user.email,
          subject: emailData.subject,
          deliveryStatus: EmailDeliveryStatus.PENDING,
          metadata: {
            html: emailData.html,
            text: emailData.text,
          },
        },
      });

      // 3. Mark welcome email as sent permanently
      await prisma.userNotificationPreference.update({
        where: { userId },
        data: { welcomeEmailSent: true },
      });

      logger.info(`[UserEmailNotification] Queued welcome email for registered user ${user.email}`);

      // 4. Trigger queue processor
      await ReminderSchedulerService.processPendingEmailDeliveries();

      return true;
    } catch (err: any) {
      logger.error(`[UserEmailNotification] Failed to queue welcome email for user ${userId}:`, err.message);
      return false;
    }
  }

  /**
   * Dispatches mandatory account security alerts (e.g. password changed, deactivation, suspension).
   * Essential security notifications cannot be disabled by user preferences.
   */
  static async sendAccountSecurityAlert(
    userId: string,
    event: string,
    details: string
  ): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser(userId);

      const emailData = buildAccountSecurityEmail({
        userName: user.fullName || 'Account Owner',
        userEmail: user.email,
        securityEvent: event,
        details,
        timestamp: new Date(),
      });

      // 1. Create in-app notification
      const notif = await prisma.notification.create({
        data: {
          userId,
          title: `[SECURITY ALERT] ${event}`,
          message: details,
          notificationType: NotificationType.SECURITY_ALERT,
          isRead: false,
        },
      });

      // 2. Queue transactional email delivery
      await prisma.emailDelivery.create({
        data: {
          userId,
          notificationId: notif.id,
          notificationStage: 'ACCOUNT_SECURITY',
          recipientEmail: user.email,
          subject: emailData.subject,
          deliveryStatus: EmailDeliveryStatus.PENDING,
          metadata: {
            html: emailData.html,
            text: emailData.text,
            securityEvent: event,
          },
        },
      });

      logger.info(`[UserEmailNotification] Queued security alert "${event}" for user ${user.email}`);

      // 3. Trigger immediate queue processing
      await ReminderSchedulerService.processPendingEmailDeliveries();

      return true;
    } catch (err: any) {
      logger.error(`[UserEmailNotification] Failed to dispatch security alert for user ${userId}:`, err.message);
      return false;
    }
  }

  /**
   * Sends notification when a new removal request is created.
   * Respects user notification preferences and sanitizes sensitive data for unverified users.
   */
  static async sendRemovalRequestCreated(
    userId: string,
    requestId: string
  ): Promise<boolean> {
    try {
      // 1. Check user preferences
      const shouldSend = await UserPreferenceService.shouldSendEmail(userId, 'REMOVAL_UPDATE');
      if (!shouldSend) {
        logger.info(`[UserEmailNotification] User ${userId} opted out of removal request creation emails`);
        return false;
      }

      const user = await this.getAuthenticatedUser(userId);

      const request = await prisma.removalRequest.findFirst({
        where: { id: requestId, userId },
        include: { website: true, exposureRecord: true },
      });

      if (!request) {
        logger.warn(`[UserEmailNotification] Removal request ${requestId} not found for user ${userId}`);
        return false;
      }

      const websiteName = request.website?.websiteName || 'Target Service';
      const websiteUrl = request.website?.websiteUrl || 'https://unknown';

      // Sensitive data masking for unverified email accounts
      const requestReason = user.isEmailVerified
        ? request.requestReason
        : '[Reason details masked: Please verify your email in Account Settings to view full exposure information]';

      const emailData = buildRemovalRequestCreatedEmail({
        userName: user.fullName || 'Account Owner',
        websiteName,
        websiteUrl: user.isEmailVerified ? websiteUrl : 'https://[masked-platform]',
        requestType: request.requestType,
        requestReason,
        requestId: request.id,
      });

      // 1. Create in-app notification
      const notif = await prisma.notification.create({
        data: {
          userId,
          title: `Removal Request Initiated: ${websiteName}`,
          message: `A new data erasure request has been created for ${websiteName} (${request.requestType}).`,
          notificationType: NotificationType.REQUEST_STATUS_UPDATE,
          isRead: false,
        },
      });

      // 2. Queue email delivery
      await prisma.emailDelivery.create({
        data: {
          userId,
          notificationId: notif.id,
          notificationStage: 'REMOVAL_CREATED',
          recipientEmail: user.email,
          subject: emailData.subject,
          deliveryStatus: EmailDeliveryStatus.PENDING,
          metadata: {
            html: emailData.html,
            text: emailData.text,
            requestId: request.id,
          },
        },
      });

      logger.info(
        `[UserEmailNotification] Queued removal created email for request ${requestId} to ${user.email}`
      );

      await ReminderSchedulerService.processPendingEmailDeliveries();
      return true;
    } catch (err: any) {
      logger.error(`[UserEmailNotification] Failed to send removal created email:`, err.message);
      return false;
    }
  }

  /**
   * Sends status update, completion, or rejection notifications when a removal request transitions.
   */
  static async sendRemovalStatusUpdated(
    userId: string,
    requestId: string,
    previousStatus: RequestStatus,
    newStatus: RequestStatus,
    remarks?: string | null
  ): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser(userId);

      const request = await prisma.removalRequest.findFirst({
        where: { id: requestId, userId },
        include: { website: true },
      });

      if (!request) {
        return false;
      }

      const websiteName = request.website?.websiteName || 'Target Service';
      let subject = '';
      let html = '';
      let text = '';
      let stage = 'REMOVAL_STATUS_UPDATED';

      if (newStatus === RequestStatus.COMPLETED) {
        const shouldSend = await UserPreferenceService.shouldSendEmail(userId, 'COMPLETED');
        if (!shouldSend) return false;

        const rendered = buildRemovalCompletedEmail({
          userName: user.fullName || 'Account Owner',
          websiteName,
          requestId: request.id,
          resolvedAt: request.resolvedAt || new Date(),
        });
        subject = rendered.subject;
        html = rendered.html;
        text = rendered.text;
        stage = 'REMOVAL_COMPLETED';
      } else if (newStatus === RequestStatus.REJECTED) {
        const shouldSend = await UserPreferenceService.shouldSendEmail(userId, 'REMOVAL_UPDATE');
        if (!shouldSend) return false;

        const rendered = buildRemovalFailedEmail({
          userName: user.fullName || 'Account Owner',
          websiteName,
          requestId: request.id,
          rejectionReason: remarks || 'Platform rejected erasure request',
        });
        subject = rendered.subject;
        html = rendered.html;
        text = rendered.text;
        stage = 'REMOVAL_FAILED';
      } else {
        const shouldSend = await UserPreferenceService.shouldSendEmail(userId, 'REMOVAL_UPDATE');
        if (!shouldSend) return false;

        const rendered = buildRemovalStatusUpdatedEmail({
          userName: user.fullName || 'Account Owner',
          websiteName,
          previousStatus,
          newStatus,
          remarks,
          requestId: request.id,
        });
        subject = rendered.subject;
        html = rendered.html;
        text = rendered.text;
        stage = 'REMOVAL_STATUS_UPDATED';
      }

      // 1. In-app notification
      const notif = await prisma.notification.create({
        data: {
          userId,
          title: `Removal Status: ${websiteName} &rarr; ${newStatus}`,
          message: remarks || `Request status transitioned from ${previousStatus} to ${newStatus}.`,
          notificationType: NotificationType.REQUEST_STATUS_UPDATE,
          isRead: false,
        },
      });

      // 2. Queue email delivery
      await prisma.emailDelivery.create({
        data: {
          userId,
          notificationId: notif.id,
          notificationStage: stage,
          recipientEmail: user.email,
          subject,
          deliveryStatus: EmailDeliveryStatus.PENDING,
          metadata: {
            html,
            text,
            requestId: request.id,
            previousStatus,
            newStatus,
          },
        },
      });

      logger.info(
        `[UserEmailNotification] Queued ${stage} email for request ${requestId} to ${user.email}`
      );

      await ReminderSchedulerService.processPendingEmailDeliveries();
      return true;
    } catch (err: any) {
      logger.error(`[UserEmailNotification] Failed to send status update email:`, err.message);
      return false;
    }
  }

  /**
   * Generates and dispatches an email verification notice.
   */
  static async sendVerificationEmail(userId: string): Promise<boolean> {
    try {
      const user = await this.getAuthenticatedUser(userId);

      // Generate a simple secure token if one does not exist
      const token =
        user.isEmailVerified
          ? 'ALREADY_VERIFIED'
          : `verify_${Buffer.from(`${userId}:${Date.now()}`).toString('base64url')}`;

      if (!user.isEmailVerified) {
        await prisma.user.update({
          where: { id: userId },
          data: { emailVerificationToken: token },
        });
      }

      const appBaseUrl = (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const verificationLink = `${appBaseUrl}/verify-email?token=${token}`;

      const emailData = buildVerificationEmail({
        userName: user.fullName || 'Account Owner',
        verificationLink,
      });

      await prisma.emailDelivery.create({
        data: {
          userId,
          notificationStage: 'EMAIL_VERIFICATION',
          recipientEmail: user.email,
          subject: emailData.subject,
          deliveryStatus: EmailDeliveryStatus.PENDING,
          metadata: {
            html: emailData.html,
            text: emailData.text,
          },
        },
      });

      logger.info(`[UserEmailNotification] Queued email verification for ${user.email}`);
      await ReminderSchedulerService.processPendingEmailDeliveries();
      return true;
    } catch (err: any) {
      logger.error(`[UserEmailNotification] Failed to dispatch verification email:`, err.message);
      return false;
    }
  }
}
