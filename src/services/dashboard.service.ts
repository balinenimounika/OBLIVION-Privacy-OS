/**
 * OBLIVION - Dashboard Analytics Service
 *
 * Computes live metrics, privacy risk distribution, erasure progress,
 * and user audit activity exclusively from PostgreSQL records.
 */

import {
  SensitivityLevel,
  RecordStatus,
  RequestStatus,
  RemovalRequestType,
  WebsiteCategory,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  DashboardOverview,
  ExposureBreakdown,
  RemovalProgress,
  RecentActivityItem,
} from '../types/dashboard.types';

export class DashboardService {
  /**
   * Computes the high-level privacy overview and dynamic privacy risk index.
   */
  static async getOverview(userId: string): Promise<DashboardOverview> {
    const [
      totalWebsites,
      totalExposures,
      activeExposures,
      resolvedExposures,
      totalRemovals,
      activeRemovalRequests,
      completedRemovalRequests,
      pendingReminders,
      unreadNotifications,
      exposures,
    ] = await Promise.all([
      prisma.website.count({ where: { userId } }),
      prisma.exposureRecord.count({ where: { userId } }),
      prisma.exposureRecord.count({
        where: {
          userId,
          recordStatus: {
            in: [
              RecordStatus.ACTIVE,
              RecordStatus.PENDING_REVIEW,
              RecordStatus.REMOVAL_REQUESTED,
            ],
          },
        },
      }),
      prisma.exposureRecord.count({
        where: { userId, recordStatus: RecordStatus.REMOVED },
      }),
      prisma.removalRequest.count({ where: { userId } }),
      prisma.removalRequest.count({
        where: {
          userId,
          requestStatus: {
            in: [
              RequestStatus.SUBMITTED,
              RequestStatus.ACKNOWLEDGED,
              RequestStatus.IN_PROGRESS,
              RequestStatus.FOLLOW_UP_REQUIRED,
            ],
          },
        },
      }),
      prisma.removalRequest.count({
        where: { userId, requestStatus: RequestStatus.COMPLETED },
      }),
      prisma.reminder.count({
        where: { userId, reminderStatus: 'PENDING' },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      prisma.exposureRecord.findMany({
        where: { userId, recordStatus: { not: RecordStatus.REMOVED } },
        select: { sensitivityLevel: true },
      }),
    ]);

    // Calculate Privacy Risk Index (0 to 100)
    let riskIndex = 0;
    if (exposures.length > 0) {
      const rawPoints = exposures.reduce((sum, exp) => {
        switch (exp.sensitivityLevel) {
          case SensitivityLevel.CRITICAL:
            return sum + 25;
          case SensitivityLevel.HIGH:
            return sum + 15;
          case SensitivityLevel.MEDIUM:
            return sum + 8;
          case SensitivityLevel.LOW:
            return sum + 3;
          default:
            return sum + 5;
        }
      }, 0);

      // Discount completed erasures
      const mitigation = completedRemovalRequests * 10;
      riskIndex = Math.min(100, Math.max(5, rawPoints - mitigation));
    }

    let privacyRiskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (riskIndex > 75) privacyRiskRating = 'CRITICAL';
    else if (riskIndex > 50) privacyRiskRating = 'HIGH';
    else if (riskIndex > 20) privacyRiskRating = 'MEDIUM';

    return {
      totalWebsites,
      totalExposures,
      activeExposures,
      resolvedExposures,
      totalRemovals,
      activeRemovalRequests,
      completedRemovalRequests,
      pendingReminders,
      unreadNotifications,
      privacyRiskIndex: riskIndex,
      privacyRiskRating,
    };
  }

  /**
   * Computes exposure breakdown by sensitivity, lifecycle status, and website category.
   */
  static async getExposureBreakdown(userId: string): Promise<ExposureBreakdown> {
    const [exposures, websites, recordCategories] = await Promise.all([
      prisma.exposureRecord.findMany({
        where: { userId },
        select: { sensitivityLevel: true, recordStatus: true },
      }),
      prisma.website.findMany({
        where: { userId },
        select: { websiteCategory: true },
      }),
      prisma.exposureRecordCategory.findMany({
        where: { exposureRecord: { userId } },
        include: { dataCategory: true },
      }),
    ]);

    // Initialize counts
    const bySensitivity = Object.values(SensitivityLevel).reduce((acc, level) => {
      acc[level] = 0;
      return acc;
    }, {} as Record<SensitivityLevel, number>);

    const byStatus = Object.values(RecordStatus).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<RecordStatus, number>);

    const byWebsiteCategory = Object.values(WebsiteCategory).reduce((acc, cat) => {
      acc[cat] = 0;
      return acc;
    }, {} as Record<WebsiteCategory, number>);

    exposures.forEach((exp) => {
      bySensitivity[exp.sensitivityLevel] = (bySensitivity[exp.sensitivityLevel] || 0) + 1;
      byStatus[exp.recordStatus] = (byStatus[exp.recordStatus] || 0) + 1;
    });

    websites.forEach((w) => {
      byWebsiteCategory[w.websiteCategory] = (byWebsiteCategory[w.websiteCategory] || 0) + 1;
    });

    // Aggregate top categories & complete distribution
    const categoryDistribution: Record<string, number> = {};
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; count: number; riskWeight: number }>();
    recordCategories.forEach((rc) => {
      const cat = rc.dataCategory;
      if (!cat) return;
      categoryDistribution[cat.categoryName] = (categoryDistribution[cat.categoryName] || 0) + 1;
      const current = categoryMap.get(cat.id) || {
        categoryId: cat.id,
        categoryName: cat.categoryName,
        count: 0,
        riskWeight: cat.riskWeight,
      };
      current.count += 1;
      categoryMap.set(cat.id, current);
    });

    const topCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.count - a.count || b.riskWeight - a.riskWeight)
      .slice(0, 5);

    return {
      bySensitivity,
      byStatus,
      byWebsiteCategory,
      topCategories,
      sensitivityDistribution: bySensitivity,
      categoryDistribution,
    };
  }

  /**
   * Computes removal request progress, status distribution, and resolution success rates.
   */
  static async getRemovalProgress(userId: string): Promise<RemovalProgress> {
    const requests = await prisma.removalRequest.findMany({
      where: { userId },
      select: { requestStatus: true, requestType: true },
    });

    const byStatus = Object.values(RequestStatus).reduce((acc, s) => {
      acc[s] = 0;
      return acc;
    }, {} as Record<RequestStatus, number>);

    const byType = Object.values(RemovalRequestType).reduce((acc, t) => {
      acc[t] = 0;
      return acc;
    }, {} as Record<RemovalRequestType, number>);

    requests.forEach((req) => {
      byStatus[req.requestStatus] = (byStatus[req.requestStatus] || 0) + 1;
      byType[req.requestType] = (byType[req.requestType] || 0) + 1;
    });

    const resolved = byStatus[RequestStatus.COMPLETED] + byStatus[RequestStatus.REJECTED];
    const successRatePercentage =
      resolved > 0
        ? Math.round((byStatus[RequestStatus.COMPLETED] / resolved) * 100)
        : 0;

    return {
      totalRequests: requests.length,
      byStatus,
      byType,
      statusDistribution: byStatus,
      typeDistribution: byType,
      successRatePercentage,
    };
  }

  /**
   * Aggregates recent audit logs, removal request status transitions, and user notifications.
   */
  static async getRecentActivity(userId: string): Promise<RecentActivityItem[]> {
    const [auditLogs, historyEntries, notifications] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.requestHistory.findMany({
        where: { removalRequest: { userId } },
        orderBy: { changedAt: 'desc' },
        take: 5,
        include: { removalRequest: { include: { website: true } } },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const items: RecentActivityItem[] = [
      ...auditLogs.map((log) => ({
        type: 'AUDIT_LOG' as const,
        id: log.id,
        title: `Audit: ${log.action}`,
        description: `Entity: ${log.entityType} (${log.entityId.substring(0, 8)}...)`,
        timestamp: log.createdAt,
      })),
      ...historyEntries.map((hist) => ({
        type: 'STATUS_CHANGE' as const,
        id: hist.id,
        title: `Removal: ${hist.newStatus}`,
        description: hist.remarks || `Request status changed for ${hist.removalRequest.website?.websiteName || 'website'}`,
        timestamp: hist.changedAt,
      })),
      ...notifications.map((notif) => ({
        type: 'NOTIFICATION' as const,
        id: notif.id,
        title: notif.title,
        description: notif.message,
        timestamp: notif.createdAt,
      })),
    ];

    // Sort descending by timestamp and limit to 10
    return items
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }
}
