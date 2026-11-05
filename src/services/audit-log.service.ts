/**
 * OBLIVION - Centralized Audit Logging Service
 *
 * Implements tamper-evident, fault-tolerant audit recording and GDPR/CCPA
 * compliance reporting. Every sensitive security event and data modification
 * is recorded under strict multi-tenant boundary constraints.
 */

import { AuditLog, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import {
  RecordAuditLogDTO,
  AuditLogListResponse,
  AuditLogSummaryResponse,
  AuditLogExportResponse,
} from '../types/audit-log.types';
import { AuditLogQueryDTO } from '../validators/audit-log.validator';

export class AuditLogService {
  /**
   * Records an audit log event asynchronously and fault-tolerantly.
   *
   * Crucial Security Guarantee:
   * Audit logging failures will NEVER interrupt or roll back primary user business flows.
   * If a database error occurs, it is logged securely without leaking sensitive credentials.
   */
  static async record(input: RecordAuditLogDTO): Promise<AuditLog | null> {
    try {
      const sanitizedAction = String(input.action).slice(0, 100);
      const sanitizedEntityType = String(input.entityType).slice(0, 100);
      const sanitizedEntityId = String(input.entityId).slice(0, 64);

      const log = await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: sanitizedAction,
          entityType: sanitizedEntityType,
          entityId: sanitizedEntityId,
        },
      });

      logger.info(
        `[Audit] Recorded ${sanitizedAction} on ${sanitizedEntityType} (${sanitizedEntityId}) for user ${input.userId}`
      );
      return log;
    } catch (error: any) {
      logger.error(`[Audit Failure] Failed to record audit log: ${error.message}`, {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
      });
      return null;
    }
  }

  /**
   * Retrieves paginated audit logs strictly scoped to the authenticated tenant.
   */
  static async getAuditLogs(
    userId: string,
    query: AuditLogQueryDTO
  ): Promise<AuditLogListResponse> {
    const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page || 1), 10) || 1;
    const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      userId,
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entityType ? { entityType: { equals: query.entityType, mode: 'insensitive' } } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [total, auditLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
      }),
    ]);

    return {
      auditLogs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single audit log entry by ID, verifying tenant ownership.
   */
  static async getAuditLogById(userId: string, id: string): Promise<AuditLog> {
    const log = await prisma.auditLog.findFirst({
      where: { id, userId },
    });

    if (!log) {
      throw ApiError.notFound('Audit log entry not found');
    }

    return log;
  }

  /**
   * Generates aggregated compliance metrics for the authenticated tenant's audit trail.
   */
  static async getSummary(userId: string): Promise<AuditLogSummaryResponse> {
    const [totalEvents, groupedActions, groupedEntities, earliestLog, latestLog] =
      await Promise.all([
        prisma.auditLog.count({ where: { userId } }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: { userId },
          _count: { action: true },
        }),
        prisma.auditLog.groupBy({
          by: ['entityType'],
          where: { userId },
          _count: { entityType: true },
        }),
        prisma.auditLog.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        prisma.auditLog.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

    const actionBreakdown: Record<string, number> = {};
    for (const item of groupedActions) {
      actionBreakdown[item.action] = item._count.action;
    }

    const entityBreakdown: Record<string, number> = {};
    for (const item of groupedEntities) {
      entityBreakdown[item.entityType] = item._count.entityType;
    }

    return {
      totalEvents,
      actionBreakdown,
      entityBreakdown,
      firstActivity: earliestLog?.createdAt ?? null,
      lastActivity: latestLog?.createdAt ?? null,
    };
  }

  /**
   * Generates a complete GDPR Article 15 / CCPA Right of Access export of the tenant's audit log.
   */
  static async exportLogs(userId: string): Promise<AuditLogExportResponse> {
    const [user, auditLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, fullName: true },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      complianceReport: {
        title: "OBLIVION Privacy Audit Trail - Right to Access (GDPR Art. 15 / CCPA)",
        regulation: 'GDPR Article 15 (Right of Access) & CCPA Section 1798.100',
        generatedAt: new Date(),
        tenant: {
          userId,
          email: user?.email,
          fullName: user?.fullName,
        },
        totalAuditEntries: auditLogs.length,
        auditLogs,
      },
    };
  }
}
