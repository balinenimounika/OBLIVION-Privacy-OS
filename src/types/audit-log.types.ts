/**
 * OBLIVION - Audit Log Types & Compliance Enums
 *
 * Defines standardized actions, target entity types, and response interfaces
 * for tamper-evident compliance tracking and GDPR Article 15 access requests.
 */

import { AuditLog } from '@prisma/client';

export const AuditAction = {
  // Authentication & Identity
  AUTH_REGISTER: 'AUTH_REGISTER',
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  SECURITY_ACCOUNT_SUSPENDED: 'SECURITY_ACCOUNT_SUSPENDED',
  SECURITY_ACCOUNT_DEACTIVATED: 'SECURITY_ACCOUNT_DEACTIVATED',

  // Websites
  WEBSITE_CREATED: 'WEBSITE_CREATED',
  WEBSITE_UPDATED: 'WEBSITE_UPDATED',
  WEBSITE_DELETED: 'WEBSITE_DELETED',

  // Exposure Records
  EXPOSURE_CREATED: 'EXPOSURE_CREATED',
  EXPOSURE_UPDATED: 'EXPOSURE_UPDATED',
  EXPOSURE_DELETED: 'EXPOSURE_DELETED',

  // Removal Requests
  REMOVAL_REQUEST_CREATED: 'REMOVAL_REQUEST_CREATED',
  REMOVAL_STATUS_UPDATED: 'REMOVAL_STATUS_UPDATED',
  REMOVAL_REQUEST_DISPATCHED: 'REMOVAL_REQUEST_DISPATCHED',

  // Reminders
  REMINDER_CREATED: 'REMINDER_CREATED',
  REMINDER_UPDATED: 'REMINDER_UPDATED',
  REMINDER_DELETED: 'REMINDER_DELETED',

  // Notifications
  NOTIFICATION_READ: 'NOTIFICATION_READ',
  NOTIFICATIONS_ALL_READ: 'NOTIFICATIONS_ALL_READ',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction] | string;

export const AuditEntityType = {
  USER: 'User',
  WEBSITE: 'Website',
  EXPOSURE_RECORD: 'ExposureRecord',
  REMOVAL_REQUEST: 'RemovalRequest',
  REMINDER: 'Reminder',
  NOTIFICATION: 'Notification',
} as const;

export type AuditEntityTypeValue = typeof AuditEntityType[keyof typeof AuditEntityType] | string;

export interface RecordAuditLogDTO {
  userId: string;
  action: AuditActionType;
  entityType: AuditEntityTypeValue;
  entityId: string;
}

export interface AuditLogListResponse {
  auditLogs: AuditLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogSummaryResponse {
  totalEvents: number;
  actionBreakdown: Record<string, number>;
  entityBreakdown: Record<string, number>;
  firstActivity: Date | null;
  lastActivity: Date | null;
}

export interface AuditLogExportResponse {
  complianceReport: {
    title: string;
    regulation: string;
    generatedAt: Date;
    tenant: {
      userId: string;
      email?: string;
      fullName?: string;
    };
    totalAuditEntries: number;
    auditLogs: AuditLog[];
  };
}
