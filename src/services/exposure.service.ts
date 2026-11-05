/**
 * OBLIVION - Exposure Record Service
 *
 * Implements business logic, multi-tenant relational verification,
 * and dynamic risk-score computation based on PostgreSQL reference risk weights.
 */

import { ExposureRecord, SensitivityLevel, RecordStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { TenantSecurity } from '../utils/tenant-security';
import { CreateExposureDTO, UpdateExposureDTO, ExposureQueryDTO } from '../validators/exposure.validator';
import { ExposureWithDetails } from '../types/exposure.types';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';

export class ExposureService {
  /**
   * Sensitivity level multiplier for risk calculation
   */
  private static getSensitivityMultiplier(level: SensitivityLevel): number {
    switch (level) {
      case SensitivityLevel.LOW:
        return 1.0;
      case SensitivityLevel.MEDIUM:
        return 1.5;
      case SensitivityLevel.HIGH:
        return 2.0;
      case SensitivityLevel.CRITICAL:
        return 3.0;
      default:
        return 1.5;
    }
  }

  /**
   * Computes dynamic privacy risk score based on reference category weights and sensitivity.
   */
  private static computeRisk(record: any): { calculatedRiskScore: number; calculatedRiskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
    const categories = record.categories || [];
    const baseWeight = categories.reduce((sum: number, cat: any) => {
      const weight = cat.dataCategory?.riskWeight ?? 5;
      return sum + weight;
    }, 0) || 5;

    const multiplier = this.getSensitivityMultiplier(record.sensitivityLevel);
    const score = Math.round(baseWeight * multiplier);

    let rating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score > 40) rating = 'CRITICAL';
    else if (score > 25) rating = 'HIGH';
    else if (score > 12) rating = 'MEDIUM';

    return {
      calculatedRiskScore: score,
      calculatedRiskRating: rating,
    };
  }

  /**
   * Creates an exposure record verifying that the referenced website belongs to the user.
   */
  static async createExposure(userId: string, data: CreateExposureDTO): Promise<ExposureWithDetails> {
    // 1. Enforce parent website ownership
    await TenantSecurity.websites.get(userId, data.websiteId);

    // 2. Validate category IDs exist
    if (data.categoryIds && data.categoryIds.length > 0) {
      const validCategories = await prisma.dataCategory.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true },
      });
      if (validCategories.length !== data.categoryIds.length) {
        throw ApiError.badRequest('One or more specified data categories do not exist');
      }
    }

    // 3. Create exposure record with nested categories in a single transaction
    const record = await prisma.exposureRecord.create({
      data: {
        userId,
        websiteId: data.websiteId,
        purpose: data.purpose,
        sensitivityLevel: data.sensitivityLevel || SensitivityLevel.MEDIUM,
        dateShared: data.dateShared,
        reviewDate: data.reviewDate,
        expiryDate: data.expiryDate,
        recordStatus: data.recordStatus || RecordStatus.ACTIVE,
        notes: data.notes,
        ...(data.categoryIds && data.categoryIds.length > 0
          ? {
              categories: {
                create: data.categoryIds.map((dataCategoryId) => ({
                  dataCategoryId,
                })),
              },
            }
          : {}),
      },
      include: {
        website: true,
        categories: {
          include: { dataCategory: true },
        },
      },
    });

    const risk = this.computeRisk(record);

    await AuditLogService.record({
      userId,
      action: AuditAction.EXPOSURE_CREATED,
      entityType: AuditEntityType.EXPOSURE_RECORD,
      entityId: record.id,
    });

    return { ...record, ...risk };
  }

  /**
   * Retrieves paginated exposure records owned by the authenticated tenant.
   */
  static async getExposures(userId: string, query: ExposureQueryDTO) {
    const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page || 1), 10) || 1;
    const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ExposureRecordWhereInput = {
      userId,
      ...(query.websiteId ? { websiteId: query.websiteId } : {}),
      ...(query.sensitivityLevel ? { sensitivityLevel: query.sensitivityLevel as SensitivityLevel } : {}),
      ...(query.recordStatus ? { recordStatus: query.recordStatus as RecordStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { purpose: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { website: { websiteName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      prisma.exposureRecord.count({ where }),
      prisma.exposureRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
        include: {
          website: true,
          categories: {
            include: { dataCategory: true },
          },
        },
      }),
    ]);

    const enriched = records.map((r) => ({
      ...r,
      ...this.computeRisk(r),
    }));

    return {
      records: enriched,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single exposure record by ID with ownership check.
   */
  static async getExposureById(userId: string, id: string): Promise<ExposureWithDetails> {
    const record = await prisma.exposureRecord.findFirst({
      where: { id, userId },
      include: {
        website: true,
        categories: {
          include: { dataCategory: true },
        },
        removalRequests: {
          orderBy: { createdAt: 'desc' },
        },
        reminders: {
          orderBy: { reminderDate: 'asc' },
        },
      },
    });

    if (!record) {
      throw ApiError.notFound('Exposure record not found');
    }

    const risk = this.computeRisk(record);
    return { ...record, ...risk };
  }

  /**
   * Updates an existing exposure record owned by the authenticated tenant.
   */
  static async updateExposure(
    userId: string,
    id: string,
    data: UpdateExposureDTO
  ): Promise<ExposureWithDetails> {
    // 1. Verify ownership
    await this.getExposureById(userId, id);

    // 2. If websiteId changed, verify the target website belongs to user
    if (data.websiteId) {
      await TenantSecurity.websites.get(userId, data.websiteId);
    }

    // 3. If categories supplied, update join table
    if (data.categoryIds !== undefined) {
      if (data.categoryIds.length > 0) {
        const validCategories = await prisma.dataCategory.findMany({
          where: { id: { in: data.categoryIds } },
          select: { id: true },
        });
        if (validCategories.length !== data.categoryIds.length) {
          throw ApiError.badRequest('One or more specified data categories do not exist');
        }
      }

      // Sync categories
      await prisma.$transaction([
        prisma.exposureRecordCategory.deleteMany({
          where: { exposureRecordId: id },
        }),
        ...(data.categoryIds.length > 0
          ? [
              prisma.exposureRecordCategory.createMany({
                data: data.categoryIds.map((dataCategoryId) => ({
                  exposureRecordId: id,
                  dataCategoryId,
                })),
              }),
            ]
          : []),
      ]);
    }

    // 4. Update core record
    const updated = await prisma.exposureRecord.update({
      where: { id },
      data: {
        ...(data.websiteId !== undefined ? { websiteId: data.websiteId } : {}),
        ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
        ...(data.sensitivityLevel !== undefined
          ? { sensitivityLevel: data.sensitivityLevel as SensitivityLevel }
          : {}),
        ...(data.dateShared !== undefined ? { dateShared: data.dateShared } : {}),
        ...(data.reviewDate !== undefined ? { reviewDate: data.reviewDate } : {}),
        ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {}),
        ...(data.recordStatus !== undefined ? { recordStatus: data.recordStatus as RecordStatus } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: {
        website: true,
        categories: {
          include: { dataCategory: true },
        },
      },
    });

    const risk = this.computeRisk(updated);

    await AuditLogService.record({
      userId,
      action: AuditAction.EXPOSURE_UPDATED,
      entityType: AuditEntityType.EXPOSURE_RECORD,
      entityId: updated.id,
    });

    return { ...updated, ...risk };
  }

  /**
   * Deletes an exposure record owned by the authenticated tenant.
   */
  static async deleteExposure(userId: string, id: string): Promise<ExposureRecord> {
    await this.getExposureById(userId, id);

    const deleted = await prisma.exposureRecord.delete({
      where: { id },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.EXPOSURE_DELETED,
      entityType: AuditEntityType.EXPOSURE_RECORD,
      entityId: id,
    });

    return deleted;
  }
}
