/**
 * OBLIVION - Website Module Types
 */

import { Website, WebsiteCategory } from '@prisma/client';
import { PaginationParams } from './index';

export interface CreateWebsiteInput {
  websiteName: string;
  websiteUrl: string;
  websiteCategory?: WebsiteCategory;
}

export interface UpdateWebsiteInput {
  websiteName?: string;
  websiteUrl?: string;
  websiteCategory?: WebsiteCategory;
}

export interface WebsiteQueryFilters extends Partial<PaginationParams> {
  search?: string;
  category?: WebsiteCategory;
  sortBy?: 'websiteName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface WebsiteWithCounts extends Website {
  _count?: {
    exposureRecords: number;
    removalRequests: number;
  };
}
