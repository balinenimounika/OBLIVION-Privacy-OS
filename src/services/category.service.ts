/**
 * OBLIVION - Data Category Service
 *
 * Provides read-only access to global privacy data categories and their risk weights.
 */

import { DataCategory, SensitivityLevel, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { CategoryQueryDTO } from '../validators/category.validator';

export class CategoryService {
  /**
   * Retrieves all reference data categories matching optional filters.
   */
  static async getCategories(query: CategoryQueryDTO): Promise<DataCategory[]> {
    const where: Prisma.DataCategoryWhereInput = {
      ...(query.sensitivity ? { defaultSensitivity: query.sensitivity as SensitivityLevel } : {}),
      ...(query.search
        ? {
            OR: [
              { categoryName: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.minRiskWeight !== undefined || query.maxRiskWeight !== undefined
        ? {
            riskWeight: {
              ...(query.minRiskWeight !== undefined ? { gte: Number(query.minRiskWeight) } : {}),
              ...(query.maxRiskWeight !== undefined ? { lte: Number(query.maxRiskWeight) } : {}),
            },
          }
        : {}),
    };

    return prisma.dataCategory.findMany({
      where,
      orderBy: {
        [query.sortBy || 'riskWeight']: query.sortOrder || 'desc',
      },
    });
  }

  /**
   * Retrieves a single reference data category by UUID.
   */
  static async getCategoryById(id: string): Promise<DataCategory> {
    const category = await prisma.dataCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw ApiError.notFound('Data category not found');
    }

    return category;
  }
}
