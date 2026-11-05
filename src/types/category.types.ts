/**
 * OBLIVION - Data Category Types
 */

import { SensitivityLevel } from '@prisma/client';

export interface CategoryQueryFilters {
  search?: string;
  sensitivity?: SensitivityLevel;
  minRiskWeight?: number;
  maxRiskWeight?: number;
  sortBy?: 'categoryName' | 'riskWeight' | 'defaultSensitivity';
  sortOrder?: 'asc' | 'desc';
}
