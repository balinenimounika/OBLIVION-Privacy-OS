/**
 * OBLIVION - User Notification Preference Controller
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { UserPreferenceService } from '../services/user-preference.service';
import { UserEmailNotificationService } from '../services/user-email-notification.service';
import { ReminderSchedulerService } from '../services/reminder-scheduler.service';
import { EmailService } from '../services/email.service';
import { ApiResponse } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import { updateUserPreferenceSchema } from '../validators/user-preference.validator';

export class UserPreferenceController {
  /**
   * Retrieves notification preferences along with registered email and verification status.
   */
  static async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const [preferences, user] = await Promise.all([
        UserPreferenceService.getPreferences(userId),
        prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true, isEmailVerified: true },
        }),
      ]);

      ApiResponse.success(res, 'Notification preferences retrieved', {
        ...preferences,
        registeredEmail: user?.email,
        isEmailVerified: user?.isEmailVerified ?? false,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Updates notification preferences for the authenticated user.
   */
  static async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const validated = updateUserPreferenceSchema.parse(req.body);
      const updated = await UserPreferenceService.updatePreferences(userId, validated);
      ApiResponse.success(res, 'Notification preferences updated successfully', updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves recent email deliveries for the authenticated user.
   */
  static async getEmailDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const deliveries = await prisma.emailDelivery.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          notificationStage: true,
          recipientEmail: true,
          subject: true,
          deliveryStatus: true,
          attemptCount: true,
          sentAt: true,
          deliveredAt: true,
          failedAt: true,
          errorMessage: true,
          createdAt: true,
        },
      });
      ApiResponse.success(res, 'Email delivery history retrieved', deliveries);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Resends verification email to the user's registered address.
   */
  static async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      await UserEmailNotificationService.sendVerificationEmail(userId);
      ApiResponse.success(res, 'Verification email dispatched');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Confirms email verification with token.
   */
  static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { token } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      if (user.isEmailVerified) {
        ApiResponse.success(res, 'Email is already verified', { isEmailVerified: true });
        return;
      }

      if (!token || user.emailVerificationToken !== token) {
        throw ApiError.badRequest('Invalid or expired verification token');
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
        },
      });

      ApiResponse.success(res, 'Email successfully verified', { isEmailVerified: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Synchronizes a delivery record status directly with Resend API.
   */
  static async syncDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;

      const delivery = await prisma.emailDelivery.findFirst({
        where: { id, userId },
      });

      if (!delivery) {
        throw ApiError.notFound('Email delivery record not found');
      }

      const result = await EmailService.syncDeliveryStatus(id);
      ApiResponse.success(res, 'Delivery status synchronized with Resend gateway', result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Diagnoses and returns current Resend domain verification status.
   */
  static async getDomainStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domainQuery = (req.query.domain as string) || undefined;
      const status = await EmailService.checkDomainStatus(domainQuery);
      const config = EmailService.validateSenderConfig();

      ApiResponse.success(res, 'Resend domain verification status retrieved', {
        ...status,
        senderConfig: config,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Safely retries a specific failed email delivery record.
   */
  static async retryDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;

      const delivery = await prisma.emailDelivery.findFirst({
        where: { id, userId },
      });

      if (!delivery) {
        throw ApiError.notFound('Email delivery record not found');
      }

      if (delivery.deliveryStatus !== 'FAILED') {
        throw ApiError.badRequest(
          `Only failed email deliveries can be retried. Current status is ${delivery.deliveryStatus}`
        );
      }

      const results = await ReminderSchedulerService.retryFailedQuotaDeliveries({
        userId,
        deliveryId: id,
      });

      ApiResponse.success(res, 'Email delivery retry completed', results);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Safely retries all failed email deliveries eligible for retry.
   */
  static async retryAllFailedDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const results = await ReminderSchedulerService.retryFailedQuotaDeliveries({
        userId,
      });

      ApiResponse.success(res, 'Batch retry of failed email deliveries completed', results);
    } catch (err) {
      next(err);
    }
  }
}
