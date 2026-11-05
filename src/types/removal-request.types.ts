/**
 * OBLIVION - Removal Request & History Types
 */

import {
  RemovalRequest,
  RequestHistory,
  RemovalRequestType,
  RequestStatus,
  Website,
  ExposureRecord,
} from '@prisma/client';
import { PaginationParams } from './index';

export interface CreateRemovalRequestInput {
  websiteId: string;
  exposureRecordId?: string;
  exposedDataDescription?: string;
  requestType?: RemovalRequestType;
  requestReason: string;
  externalReference?: string | null;
  requestStatus?: RequestStatus;
}

export interface UpdateRemovalRequestInput {
  requestStatus?: RequestStatus;
  requestReason?: string;
  externalReference?: string | null;
  remarks?: string | null;
}

export interface RemovalRequestQueryFilters extends Partial<PaginationParams> {
  requestStatus?: RequestStatus;
  requestType?: RemovalRequestType;
  websiteId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'submittedAt' | 'requestStatus' | 'requestType';
  sortOrder?: 'asc' | 'desc';
}

export interface RemovalRequestWithDetails extends RemovalRequest {
  website?: Website;
  exposureRecord?: ExposureRecord;
  history?: RequestHistory[];
}
