/**
 * OBLIVION - Exposure Record Types
 */

import {
  ExposureRecord,
  ExposureRecordCategory,
  DataCategory,
  Website,
  SensitivityLevel,
  RecordStatus,
  ExposureSource,
  ExposureVisibility,
  DataSharingStatus,
  RemediationStatus,
  RemovalRequest,
  Reminder,
  AuditLog,
} from '@prisma/client';
import { PaginationParams } from './index';

export {
  ExposureSource,
  ExposureVisibility,
  DataSharingStatus,
  RemediationStatus,
};

export interface RiskBreakdown {
  baseCategoryWeight: number;
  categoryCount: number;
  categoryVolumeFactor: number;
  platformSensitivityMultiplier: number;
  visibilityMultiplier: number;
  sharingStatusMultiplier: number;
  remediationMultiplier: number;
  rawScore: number;
  normalizedScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  keyFactors: string[];
}

export interface CreateExposureInput {
  websiteId: string;
  purpose: string;
  sensitivityLevel?: SensitivityLevel;
  dateShared: string | Date;
  reviewDate?: string | Date | null;
  expiryDate?: string | Date | null;
  recordStatus?: RecordStatus;
  notes?: string | null;
  categoryIds?: string[];
  platformUrl?: string | null;
  dataDescription?: string | null;
  exposureSource?: ExposureSource;
  visibility?: ExposureVisibility;
  sharingStatus?: DataSharingStatus;
  lastVerifiedDate?: string | Date | null;
  remediationStatus?: RemediationStatus;
  evidenceAttachment?: string | null;
}

export interface UpdateExposureInput {
  websiteId?: string;
  purpose?: string;
  sensitivityLevel?: SensitivityLevel;
  dateShared?: string | Date;
  reviewDate?: string | Date | null;
  expiryDate?: string | Date | null;
  recordStatus?: RecordStatus;
  notes?: string | null;
  categoryIds?: string[];
  platformUrl?: string | null;
  dataDescription?: string | null;
  exposureSource?: ExposureSource;
  visibility?: ExposureVisibility;
  sharingStatus?: DataSharingStatus;
  lastVerifiedDate?: string | Date | null;
  remediationStatus?: RemediationStatus;
  evidenceAttachment?: string | null;
}

export interface ExposureQueryFilters extends Partial<PaginationParams> {
  websiteId?: string;
  sensitivityLevel?: SensitivityLevel;
  recordStatus?: RecordStatus;
  visibility?: ExposureVisibility;
  remediationStatus?: RemediationStatus;
  exposureSource?: ExposureSource;
  sharingStatus?: DataSharingStatus;
  search?: string;
  sortBy?: 'dateShared' | 'createdAt' | 'sensitivityLevel' | 'purpose' | 'reviewDate' | 'riskScore';
  sortOrder?: 'asc' | 'desc';
}

export interface ExposureWithDetails extends ExposureRecord {
  website?: Website;
  categories?: (ExposureRecordCategory & { dataCategory: DataCategory })[];
  removalRequests?: RemovalRequest[];
  reminders?: Reminder[];
  activityTimeline?: AuditLog[];
  calculatedRiskScore?: number;
  calculatedRiskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskBreakdown?: RiskBreakdown;
}

export interface ExposureSummaryResponse {
  totalExposures: number;
  activeExposures: number;
  criticalExposures: number;
  resolvedExposures: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byPlatform: Array<{
    platformId: string;
    platformName: string;
    platformUrl: string;
    exposureCount: number;
    highestRisk: number;
    hasCritical: boolean;
  }>;
}
