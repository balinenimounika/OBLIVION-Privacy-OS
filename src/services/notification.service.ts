/**
 * OBLIVION - Notification Service
 *
 * Implements user privacy alerts, system notifications, unread tracking,
 * and tenant-isolated notification reads.
 */

import { Notification, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { NotificationQueryDTO } from '../validators/notification.validator';
import { NotificationListResponse, NotificationWithEmailDelivery } from '../types/notification.types';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';
import { EmailService, RESEND_QUOTA_EXCEEDED_MESSAGE } from './email.service';

/**
 * User-facing notifications must never expose internal Resend error messages,
 * SMTP failures, or technical email delivery diagnostics.
 */
function sanitizeUserFacingDelivery(delivery: any) {
  return {
    id: delivery.id,
    deliveryStatus: delivery.deliveryStatus,
    recipientEmail: delivery.recipientEmail,
    resendEmailId: delivery.resendEmailId,
    sentAt: delivery.sentAt,
    deliveredAt: delivery.deliveredAt,
    failedAt: delivery.failedAt,
    errorMessage: null, // Technical errors suppressed from user notifications interface
  };
}

export class NotificationService {
  /**
   * Retrieves paginated notifications for the authenticated user, including unread count
   * and any associated transactional email delivery status.
   */
  static async getNotifications(
    userId: string,
    query: NotificationQueryDTO
  ): Promise<NotificationListResponse> {
    const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page || 1), 10) || 1;
    const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
      ...(query.notificationType ? { notificationType: query.notificationType as NotificationType } : {}),
    };

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: query.sortOrder || 'desc',
        },
        include: {
          emailDeliveries: {
            select: {
              id: true,
              deliveryStatus: true,
              recipientEmail: true,
              resendEmailId: true,
              sentAt: true,
              deliveredAt: true,
              failedAt: true,
              errorMessage: true,
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    ]);

    const formattedNotifications = notifications.map((n) => ({
      ...n,
      emailDeliveries: n.emailDeliveries?.map(sanitizeUserFacingDelivery),
    }));

    return {
      notifications: formattedNotifications,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
      },
    };
  }

  /**
   * Retrieves single notification with ownership check.
   */
  static async getNotificationById(userId: string, id: string): Promise<NotificationWithEmailDelivery> {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
      include: {
        emailDeliveries: {
          select: {
            id: true,
            deliveryStatus: true,
            recipientEmail: true,
            resendEmailId: true,
            sentAt: true,
            deliveredAt: true,
            failedAt: true,
            errorMessage: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    return {
      ...notification,
      emailDeliveries: notification.emailDeliveries?.map(sanitizeUserFacingDelivery),
    };
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(userId: string, id: string): Promise<Notification> {
    await this.getNotificationById(userId, id);

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.NOTIFICATION_READ,
      entityType: AuditEntityType.NOTIFICATION,
      entityId: id,
    });

    return updated;
  }

  /**
   * Marks all unread notifications of the user as read.
   */
  static async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.NOTIFICATIONS_ALL_READ,
      entityType: AuditEntityType.NOTIFICATION,
      entityId: userId,
    });

    return { updatedCount: result.count };
  }
}
