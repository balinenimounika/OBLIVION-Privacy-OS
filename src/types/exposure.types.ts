/**
 * OBLIVION - Exposure Record Types
 */

import { ExposureRecord, ExposureRecordCategory, DataCategory, Website, SensitivityLevel, RecordStatus } from '@prisma/client';
import { PaginationParams } from './index';

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
}

export interface ExposureQueryFilters extends Partial<PaginationParams> {
  websiteId?: string;
  sensitivityLevel?: SensitivityLevel;
  recordStatus?: RecordStatus;
  search?: string;
  sortBy?: 'dateShared' | 'createdAt' | 'sensitivityLevel' | 'purpose';
  sortOrder?: 'asc' | 'desc';
}

export interface ExposureWithDetails extends ExposureRecord {
  website?: Website;
  categories?: (ExposureRecordCategory & { dataCategory: DataCategory })[];
  calculatedRiskScore?: number;
  calculatedRiskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
