/**
 * OBLIVION - Dashboard Analytics Types
 */

import {
  SensitivityLevel,
  RecordStatus,
  RequestStatus,
  RemovalRequestType,
  WebsiteCategory,
  AuditLog,
  Notification,
} from '@prisma/client';

export interface DashboardOverview {
  totalWebsites: number;
  totalExposures: number;
  activeExposures: number;
  resolvedExposures: number;
  totalRemovals: number;
  activeRemovalRequests: number;
  completedRemovalRequests: number;
  pendingReminders: number;
  unreadNotifications: number;
  privacyRiskIndex: number; // 0 (Safe) to 100 (Extremely Exposed)
  privacyRiskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ExposureBreakdown {
  bySensitivity: Record<SensitivityLevel, number>;
  byStatus: Record<RecordStatus, number>;
  byWebsiteCategory: Record<WebsiteCategory, number>;
  sensitivityDistribution?: Record<string, number>;
  categoryDistribution?: Record<string, number>;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    riskWeight: number;
  }>;
}

export interface RemovalProgress {
  totalRequests: number;
  byStatus: Record<RequestStatus, number>;
  byType: Record<RemovalRequestType, number>;
  statusDistribution?: Record<string, number>;
  typeDistribution?: Record<string, number>;
  successRatePercentage: number;
}

export interface RecentActivityItem {
  type: 'AUDIT_LOG' | 'STATUS_CHANGE' | 'NOTIFICATION';
  id: string;
  title: string;
  description: string;
  timestamp: Date;
}
