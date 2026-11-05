/**
 * OBLIVION - Notification Module Types
 */

import { Notification, NotificationType } from '@prisma/client';
import { PaginationParams } from './index';

export interface NotificationQueryFilters extends Partial<PaginationParams> {
  isRead?: boolean;
  notificationType?: NotificationType;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationEmailDeliverySummary {
  id: string;
  deliveryStatus: string;
  recipientEmail?: string;
  resendEmailId?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
}

export type NotificationWithEmailDelivery = Notification & {
  emailDeliveries?: NotificationEmailDeliverySummary[];
};

export interface NotificationListResponse {
  notifications: NotificationWithEmailDelivery[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}
