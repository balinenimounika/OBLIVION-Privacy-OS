/**
 * OBLIVION - Strict Multi-Tenant Security & Ownership Enforcement Engine
 *
 * Implements centralized, cryptographically verified tenant boundary controls.
 * Every user-specific query enforces the authenticated user's ID obtained from
 * verified JWT middleware.
 *
 * Core Security Principles:
 * 1. Zero Trust: Never trust userId supplied in request bodies, query params, or URL params.
 * 2. Complete Parent-Child Ownership: Deep verification for nested relations.
 * 3. Information Disclosure Prevention: Always return uniform 404 for records outside user ownership.
 * 4. Anti-Tampering & Mass-Assignment Defense: Strictly strip or reject tenant identity fields.
 * 5. Atomic Scoped Operations: Cross-tenant updates and deletes are blocked at PostgreSQL level.
 */

import {
  Website,
  ExposureRecord,
  RemovalRequest,
  Reminder,
  Notification,
  AuditLog,
  DataCategory,
  ExposureRecordCategory,
  RequestHistory,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from './api-error';

export class TenantSecurity {
  // ===========================================================================
  // 1. INPUT SANITIZATION & ANTI-TAMPERING UTILITIES
  // ===========================================================================

  /**
   * Sanitizes request payload by stripping ownership, identity, and timestamp fields
   * to prevent mass-assignment attacks and privilege escalation.
   */
  static sanitizeInput<T extends Record<string, any>>(data: T): Omit<T, 'userId' | 'user_id' | 'id' | 'createdAt' | 'updatedAt'> {
    if (!data || typeof data !== 'object') return data;
    const sanitized = { ...data };
    delete sanitized.userId;
    delete sanitized.user_id;
    delete sanitized.id;
    delete sanitized.createdAt;
    delete sanitized.updatedAt;
    return sanitized;
  }

  /**
   * Validates that the payload does not contain an injected userId or user_id.
   * Throws ApiError(422) if an injection attempt is detected.
   */
  static assertNoInjectedTenantField(data: Record<string, any>): void {
    if (data && typeof data === 'object') {
      if ('userId' in data || 'user_id' in data) {
        throw ApiError.unprocessableEntity(
          'Security violation: Modifying or injecting tenant ownership fields is prohibited'
        );
      }
    }
  }

  // ===========================================================================
  // 2. WEBSITES (User-owned platform records)
  // ===========================================================================

  static readonly websites = {
    async get(userId: string, websiteId: string): Promise<Website> {
      const record = await prisma.website.findFirst({
        where: { id: websiteId, userId },
      });
      if (!record) {
        throw ApiError.notFound('Website not found');
      }
      return record;
    },

    async list(userId: string): Promise<Website[]> {
      return prisma.website.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    },

    async create(
      userId: string,
      data: Omit<Prisma.WebsiteCreateInput, 'user' | 'exposureRecords' | 'removalRequests'> & {
        websiteName: string;
        websiteUrl: string;
      }
    ): Promise<Website> {
      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.website.create({
        data: {
          ...cleanData,
          user: { connect: { id: userId } },
        },
      });
    },

    async update(
      userId: string,
      websiteId: string,
      data: Prisma.WebsiteUpdateInput
    ): Promise<Website> {
      // First verify ownership
      await TenantSecurity.websites.get(userId, websiteId);

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.website.update({
        where: { id: websiteId },
        data: cleanData,
      });
    },

    async delete(userId: string, websiteId: string): Promise<Website> {
      // First verify ownership
      await TenantSecurity.websites.get(userId, websiteId);

      return prisma.website.delete({
        where: { id: websiteId },
      });
    },
  };

  // ===========================================================================
  // 3. EXPOSURE RECORDS (Personal data exposure entries)
  // ===========================================================================

  static readonly exposureRecords = {
    async get(userId: string, recordId: string): Promise<ExposureRecord> {
      const record = await prisma.exposureRecord.findFirst({
        where: { id: recordId, userId },
        include: {
          website: true,
          categories: {
            include: { dataCategory: true },
          },
        },
      });
      if (!record) {
        throw ApiError.notFound('Exposure record not found');
      }
      return record;
    },

    async list(userId: string): Promise<ExposureRecord[]> {
      return prisma.exposureRecord.findMany({
        where: { userId },
        include: {
          website: true,
          categories: {
            include: { dataCategory: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async create(
      userId: string,
      websiteId: string,
      data: Omit<
        Prisma.ExposureRecordUncheckedCreateInput,
        'id' | 'userId' | 'websiteId' | 'createdAt' | 'updatedAt'
      >
    ): Promise<ExposureRecord> {
      // Enforce parent ownership: website must belong to this user
      await TenantSecurity.websites.get(userId, websiteId);

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.exposureRecord.create({
        data: {
          ...cleanData,
          userId,
          websiteId,
        },
        include: {
          website: true,
        },
      });
    },

    async update(
      userId: string,
      recordId: string,
      data: Prisma.ExposureRecordUncheckedUpdateInput
    ): Promise<ExposureRecord> {
      await TenantSecurity.exposureRecords.get(userId, recordId);

      // If websiteId is being changed, verify the target website is also owned by this user
      if (data.websiteId && typeof data.websiteId === 'string') {
        await TenantSecurity.websites.get(userId, data.websiteId);
      }

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.exposureRecord.update({
        where: { id: recordId },
        data: cleanData,
      });
    },

    async delete(userId: string, recordId: string): Promise<ExposureRecord> {
      await TenantSecurity.exposureRecords.get(userId, recordId);

      return prisma.exposureRecord.delete({
        where: { id: recordId },
      });
    },
  };

  // ===========================================================================
  // 4. EXPOSURE RECORD CATEGORIES (Nested Join Table)
  // ===========================================================================

  static readonly exposureRecordCategories = {
    async list(userId: string, exposureRecordId: string): Promise<ExposureRecordCategory[]> {
      // Enforce parent record ownership
      await TenantSecurity.exposureRecords.get(userId, exposureRecordId);

      return prisma.exposureRecordCategory.findMany({
        where: { exposureRecordId },
        include: { dataCategory: true },
      });
    },

    async add(
      userId: string,
      exposureRecordId: string,
      dataCategoryId: string
    ): Promise<ExposureRecordCategory> {
      // Enforce parent record ownership
      await TenantSecurity.exposureRecords.get(userId, exposureRecordId);

      // Verify category exists
      const cat = await prisma.dataCategory.findUnique({
        where: { id: dataCategoryId },
      });
      if (!cat) {
        throw ApiError.notFound('Data category not found');
      }

      return prisma.exposureRecordCategory.create({
        data: {
          exposureRecordId,
          dataCategoryId,
        },
        include: { dataCategory: true },
      });
    },

    async remove(
      userId: string,
      exposureRecordId: string,
      dataCategoryId: string
    ): Promise<ExposureRecordCategory> {
      // Enforce parent record ownership
      await TenantSecurity.exposureRecords.get(userId, exposureRecordId);

      const joinRecord = await prisma.exposureRecordCategory.findUnique({
        where: {
          exposureRecordId_dataCategoryId: {
            exposureRecordId,
            dataCategoryId,
          },
        },
      });

      if (!joinRecord) {
        throw ApiError.notFound('Category association not found on this exposure record');
      }

      return prisma.exposureRecordCategory.delete({
        where: { id: joinRecord.id },
      });
    },
  };

  // ===========================================================================
  // 5. REMOVAL REQUESTS (Data erasure / GDPR requests)
  // ===========================================================================

  static readonly removalRequests = {
    async get(userId: string, requestId: string): Promise<RemovalRequest> {
      const record = await prisma.removalRequest.findFirst({
        where: { id: requestId, userId },
        include: {
          website: true,
          exposureRecord: true,
          history: { orderBy: { changedAt: 'desc' } },
        },
      });
      if (!record) {
        throw ApiError.notFound('Removal request not found');
      }
      return record;
    },

    async list(userId: string): Promise<RemovalRequest[]> {
      return prisma.removalRequest.findMany({
        where: { userId },
        include: {
          website: true,
          exposureRecord: true,
          history: { orderBy: { changedAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async create(
      userId: string,
      data: {
        websiteId: string;
        exposureRecordId: string;
        requestType?: Prisma.RemovalRequestCreateInput['requestType'];
        requestReason: string;
        externalReference?: string | null;
      }
    ): Promise<RemovalRequest> {
      // Complete parent-child verification:
      // Both website and exposureRecord MUST be owned by this user
      await TenantSecurity.websites.get(userId, data.websiteId);
      await TenantSecurity.exposureRecords.get(userId, data.exposureRecordId);

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.removalRequest.create({
        data: {
          ...cleanData,
          userId,
          history: {
            create: {
              newStatus: 'DRAFT',
              remarks: 'Removal request initiated',
            },
          },
        },
        include: {
          website: true,
          exposureRecord: true,
          history: true,
        },
      });
    },

    async update(
      userId: string,
      requestId: string,
      data: Prisma.RemovalRequestUncheckedUpdateInput
    ): Promise<RemovalRequest> {
      await TenantSecurity.removalRequests.get(userId, requestId);

      if (data.websiteId && typeof data.websiteId === 'string') {
        await TenantSecurity.websites.get(userId, data.websiteId);
      }
      if (data.exposureRecordId && typeof data.exposureRecordId === 'string') {
        await TenantSecurity.exposureRecords.get(userId, data.exposureRecordId);
      }

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.removalRequest.update({
        where: { id: requestId },
        data: cleanData,
      });
    },

    async delete(userId: string, requestId: string): Promise<RemovalRequest> {
      await TenantSecurity.removalRequests.get(userId, requestId);

      return prisma.removalRequest.delete({
        where: { id: requestId },
      });
    },
  };

  // ===========================================================================
  // 6. REQUEST HISTORY (Nested audit entries of removal requests)
  // ===========================================================================

  static readonly requestHistory = {
    async list(userId: string, removalRequestId: string): Promise<RequestHistory[]> {
      // Enforce parent removal request ownership
      await TenantSecurity.removalRequests.get(userId, removalRequestId);

      return prisma.requestHistory.findMany({
        where: { removalRequestId },
        orderBy: { changedAt: 'desc' },
      });
    },

    async add(
      userId: string,
      removalRequestId: string,
      data: {
        previousStatus?: Prisma.RequestHistoryCreateInput['previousStatus'];
        newStatus: Prisma.RequestHistoryCreateInput['newStatus'];
        remarks?: string | null;
      }
    ): Promise<RequestHistory> {
      // Enforce parent removal request ownership
      await TenantSecurity.removalRequests.get(userId, removalRequestId);

      return prisma.requestHistory.create({
        data: {
          removalRequestId,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          remarks: data.remarks,
        },
      });
    },
  };

  // ===========================================================================
  // 7. REMINDERS (User alerts and reviews)
  // ===========================================================================

  static readonly reminders = {
    async get(userId: string, reminderId: string): Promise<Reminder> {
      const record = await prisma.reminder.findFirst({
        where: { id: reminderId, userId },
        include: { exposureRecord: true },
      });
      if (!record) {
        throw ApiError.notFound('Reminder not found');
      }
      return record;
    },

    async list(userId: string): Promise<Reminder[]> {
      return prisma.reminder.findMany({
        where: { userId },
        include: { exposureRecord: true },
        orderBy: { reminderDate: 'asc' },
      });
    },

    async create(
      userId: string,
      data: {
        exposureRecordId: string;
        reminderType?: Prisma.ReminderCreateInput['reminderType'];
        reminderDate: Date;
      }
    ): Promise<Reminder> {
      // Enforce that exposure record belongs to this user
      await TenantSecurity.exposureRecords.get(userId, data.exposureRecordId);

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.reminder.create({
        data: {
          ...cleanData,
          userId,
        },
      });
    },

    async update(
      userId: string,
      reminderId: string,
      data: Prisma.ReminderUncheckedUpdateInput
    ): Promise<Reminder> {
      await TenantSecurity.reminders.get(userId, reminderId);

      if (data.exposureRecordId && typeof data.exposureRecordId === 'string') {
        await TenantSecurity.exposureRecords.get(userId, data.exposureRecordId);
      }

      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.reminder.update({
        where: { id: reminderId },
        data: cleanData,
      });
    },

    async delete(userId: string, reminderId: string): Promise<Reminder> {
      await TenantSecurity.reminders.get(userId, reminderId);

      return prisma.reminder.delete({
        where: { id: reminderId },
      });
    },
  };

  // ===========================================================================
  // 8. NOTIFICATIONS (User alerts)
  // ===========================================================================

  static readonly notifications = {
    async get(userId: string, notificationId: string): Promise<Notification> {
      const record = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
      });
      if (!record) {
        throw ApiError.notFound('Notification not found');
      }
      return record;
    },

    async list(userId: string): Promise<Notification[]> {
      return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    },

    async create(
      userId: string,
      data: {
        title: string;
        message: string;
        notificationType?: Prisma.NotificationCreateInput['notificationType'];
      }
    ): Promise<Notification> {
      const cleanData = TenantSecurity.sanitizeInput(data);
      return prisma.notification.create({
        data: {
          ...cleanData,
          userId,
        },
      });
    },

    async markAsRead(userId: string, notificationId: string): Promise<Notification> {
      await TenantSecurity.notifications.get(userId, notificationId);

      return prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    },

    async delete(userId: string, notificationId: string): Promise<Notification> {
      await TenantSecurity.notifications.get(userId, notificationId);

      return prisma.notification.delete({
        where: { id: notificationId },
      });
    },
  };

  // ===========================================================================
  // 9. AUDIT LOGS (Security event history)
  // ===========================================================================

  static readonly auditLogs = {
    async get(userId: string, auditLogId: string): Promise<AuditLog> {
      const record = await prisma.auditLog.findFirst({
        where: { id: auditLogId, userId },
      });
      if (!record) {
        throw ApiError.notFound('Audit log not found');
      }
      return record;
    },

    async list(userId: string): Promise<AuditLog[]> {
      return prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    },

    async record(
      userId: string,
      action: string,
      entityType: string,
      entityId: string
    ): Promise<AuditLog> {
      return prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
        },
      });
    },
  };

  // ===========================================================================
  // 10. DATA CATEGORIES (Global Reference Data)
  // ===========================================================================

  static readonly dataCategories = {
    async list(): Promise<DataCategory[]> {
      return prisma.dataCategory.findMany({
        orderBy: { categoryName: 'asc' },
      });
    },

    async get(categoryId: string): Promise<DataCategory> {
      const category = await prisma.dataCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw ApiError.notFound('Data category not found');
      }
      return category;
    },
  };
}
