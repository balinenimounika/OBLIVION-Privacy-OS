/**
 * OBLIVION - Exposure Record Service
 *
 * Implements business logic, multi-tenant relational verification,
 * and dynamic risk-score computation based on PostgreSQL reference risk weights,
 * platform sensitivity, visibility multipliers, and remediation status.
 */

import {
  ExposureRecord,
  SensitivityLevel,
  RecordStatus,
  ExposureVisibility,
  ExposureSource,
  DataSharingStatus,
  RemediationStatus,
  RemovalRequestType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { TenantSecurity } from '../utils/tenant-security';
import {
  CreateExposureDTO,
  UpdateExposureDTO,
  ExposureQueryDTO,
  CreateExposureRemovalDTO,
} from '../validators/exposure.validator';
import {
  ExposureWithDetails,
  ExposureSummaryResponse,
  RiskBreakdown,
} from '../types/exposure.types';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';
import { RemovalRequestService } from './removal-request.service';

export class ExposureService {
  /**
   * Platform Sensitivity Multipliers
   */
  private static getSensitivityMultiplier(level: SensitivityLevel): number {
    switch (level) {
      case SensitivityLevel.LOW:
        return 1.0;
      case SensitivityLevel.MEDIUM:
        return 1.3;
      case SensitivityLevel.HIGH:
        return 1.7;
      case SensitivityLevel.CRITICAL:
        return 2.2;
      default:
        return 1.3;
    }
  }

  /**
   * Visibility Multipliers (as specified by OBLIVION policy)
   * - Private: 1.0
   * - Restricted: 1.2
   * - Public: 1.5
   * - Unknown: 1.1
   */
  private static getVisibilityMultiplier(visibility?: ExposureVisibility | null): number {
    switch (visibility) {
      case ExposureVisibility.PRIVATE:
        return 1.0;
      case ExposureVisibility.RESTRICTED:
        return 1.2;
      case ExposureVisibility.PUBLIC:
        return 1.5;
      case ExposureVisibility.UNKNOWN:
      default:
        return 1.1;
    }
  }

  /**
   * Data Sharing Status Multipliers
   * Active: 1.0, Unknown: 0.95, No Longer Shared: 0.75
   */
  private static getSharingMultiplier(status?: DataSharingStatus | null): number {
    switch (status) {
      case DataSharingStatus.ACTIVE:
        return 1.0;
      case DataSharingStatus.UNKNOWN:
        return 0.95;
      case DataSharingStatus.NO_LONGER_SHARED:
        return 0.75;
      default:
        return 1.0;
    }
  }

  /**
   * Remediation Status Multipliers
   * Not Started: 1.0, In Progress: 0.75, Resolved: 0.20
   */
  private static getRemediationMultiplier(status?: RemediationStatus | null): number {
    switch (status) {
      case RemediationStatus.NOT_STARTED:
        return 1.0;
      case RemediationStatus.IN_PROGRESS:
        return 0.75;
      case RemediationStatus.RESOLVED:
        return 0.20;
      default:
        return 1.0;
    }
  }

  /**
   * Authoritative Dynamic Risk Calculation Engine (0 - 100 Normalized Scale)
   *
   * Formula:
   * 1. Category Base = Sum of unique attached category weights (default 5 if none).
   * 2. Category Compounding = 1 + min(0.30, (categoryCount - 1) * 0.05).
   * 3. Platform Sensitivity Factor = sensitivityMultiplier / 1.5.
   * 4. Visibility Multiplier = Private (1.0), Unknown (1.1), Restricted (1.2), Public (1.5).
   * 5. Raw Score = (Category Base * Compounding) * (Sens / 1.5) * Vis * Sharing * Remediation.
   * 6. Normalized Score = clamp(round((Raw Score / 60) * 100), 0, 100).
   *
   * Risk Levels:
   * - 0–20:   LOW
   * - 21–40:  MEDIUM
   * - 41–70:  HIGH
   * - 71–100: CRITICAL
   */
  public static computeRisk(record: any): {
    calculatedRiskScore: number;
    calculatedRiskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskBreakdown: RiskBreakdown;
  } {
    const categories = record.categories || [];
    const categoryCount = categories.length;

    // Deduplicate category weights to prevent double-counting
    const uniqueCategoryWeights: number[] = [];
    const seenCatIds = new Set<string>();

    categories.forEach((cat: any) => {
      const catId = cat.dataCategoryId || cat.dataCategory?.id || cat.id;
      if (catId && !seenCatIds.has(catId)) {
        seenCatIds.add(catId);
        uniqueCategoryWeights.push(cat.dataCategory?.riskWeight ?? 5);
      } else if (!catId) {
        uniqueCategoryWeights.push(cat.dataCategory?.riskWeight ?? 5);
      }
    });

    const baseWeight =
      uniqueCategoryWeights.length > 0
        ? uniqueCategoryWeights.reduce((sum, w) => sum + w, 0)
        : 5;

    // Compound volume factor (more exposed categories = higher compounding correlation risk)
    const volumeFactor =
      categoryCount > 1
        ? Number((1 + Math.min(0.3, (categoryCount - 1) * 0.05)).toFixed(2))
        : 1.0;

    const sensMultiplier = this.getSensitivityMultiplier(record.sensitivityLevel);
    const visMultiplier = this.getVisibilityMultiplier(record.visibility);
    const sharingMultiplier = this.getSharingMultiplier(record.sharingStatus);
    const remedMultiplier = this.getRemediationMultiplier(record.remediationStatus);

    const baseCompounded = baseWeight * volumeFactor;
    const rawScore =
      baseCompounded *
      (sensMultiplier / 1.5) *
      visMultiplier *
      sharingMultiplier *
      remedMultiplier;

    // Normalization to 0-100 scale (60 raw points maps to 100)
    const normalizedScore = Math.max(0, Math.min(100, Math.round((rawScore / 60) * 100)));

    let rating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (normalizedScore > 70) rating = 'CRITICAL';
    else if (normalizedScore > 40) rating = 'HIGH';
    else if (normalizedScore > 20) rating = 'MEDIUM';

    // Formulate key explanatory factors
    const keyFactors: string[] = [];
    if (categoryCount > 0) {
      keyFactors.push(`${categoryCount} data categories contributing ${baseWeight} base weight`);
    } else {
      keyFactors.push('Unclassified exposure (baseline weight: 5)');
    }
    if (volumeFactor > 1.0) {
      keyFactors.push(`+${Math.round((volumeFactor - 1) * 100)}% multi-category correlation penalty`);
    }
    keyFactors.push(`${record.sensitivityLevel || 'MEDIUM'} platform sensitivity (${sensMultiplier}x)`);
    if (record.visibility) {
      keyFactors.push(`${record.visibility} visibility profile (${visMultiplier}x)`);
    }
    if (record.remediationStatus === RemediationStatus.RESOLVED) {
      keyFactors.push('Remediation verified (80% residual risk discount)');
    } else if (record.remediationStatus === RemediationStatus.IN_PROGRESS) {
      keyFactors.push('Remediation active (25% risk discount)');
    }

    const breakdown: RiskBreakdown = {
      baseCategoryWeight: baseWeight,
      categoryCount,
      categoryVolumeFactor: volumeFactor,
      platformSensitivityMultiplier: sensMultiplier,
      visibilityMultiplier: visMultiplier,
      sharingStatusMultiplier: sharingMultiplier,
      remediationMultiplier: remedMultiplier,
      rawScore: Number(rawScore.toFixed(2)),
      normalizedScore,
      riskLevel: rating,
      keyFactors,
    };

    return {
      calculatedRiskScore: normalizedScore,
      calculatedRiskRating: rating,
      riskBreakdown: breakdown,
    };
  }

  /**
   * Creates an exposure record verifying that the referenced website belongs to the user.
   */
  static async createExposure(userId: string, data: CreateExposureDTO): Promise<ExposureWithDetails> {
    // 1. Enforce parent website ownership
    const parentWebsite = await TenantSecurity.websites.get(userId, data.websiteId);

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

    // Default platform URL to the website URL if not specified
    const platformUrl = data.platformUrl || parentWebsite.websiteUrl;

    // 3. Create exposure record with nested categories
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
        platformUrl,
        dataDescription: data.dataDescription,
        exposureSource: data.exposureSource || ExposureSource.OTHER,
        visibility: data.visibility || ExposureVisibility.UNKNOWN,
        sharingStatus: data.sharingStatus || DataSharingStatus.ACTIVE,
        lastVerifiedDate: data.lastVerifiedDate,
        remediationStatus: data.remediationStatus || RemediationStatus.NOT_STARTED,
        evidenceAttachment: data.evidenceAttachment,
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
   * Retrieves paginated exposure records owned by the authenticated tenant with advanced filters.
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
      ...(query.visibility ? { visibility: query.visibility as ExposureVisibility } : {}),
      ...(query.remediationStatus ? { remediationStatus: query.remediationStatus as RemediationStatus } : {}),
      ...(query.exposureSource ? { exposureSource: query.exposureSource as ExposureSource } : {}),
      ...(query.sharingStatus ? { sharingStatus: query.sharingStatus as DataSharingStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { purpose: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { dataDescription: { contains: query.search, mode: 'insensitive' } },
              { platformUrl: { contains: query.search, mode: 'insensitive' } },
              { website: { websiteName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [total, records] = await Promise.all([
      prisma.exposureRecord.count({ where }),
      prisma.exposureRecord.findMany({
        where,
        skip: sortBy === 'riskScore' ? 0 : skip, // If sorting by computed risk, fetch all then slice
        take: sortBy === 'riskScore' ? undefined : limit,
        orderBy:
          sortBy === 'riskScore'
            ? { createdAt: 'desc' }
            : {
                [sortBy]: sortOrder,
              },
        include: {
          website: true,
          categories: {
            include: { dataCategory: true },
          },
          removalRequests: true,
        },
      }),
    ]);

    let enriched: ExposureWithDetails[] = records.map((r) => ({
      ...r,
      ...this.computeRisk(r),
    }));

    if (sortBy === 'riskScore') {
      enriched.sort((a, b) => {
        const scoreA = a.calculatedRiskScore || 0;
        const scoreB = b.calculatedRiskScore || 0;
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      });
      enriched = enriched.slice(skip, skip + limit);
    }

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
   * Retrieves single exposure record by ID with full ownership verification,
   * associated removal requests, reminders, and activity timeline.
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
          include: {
            history: {
              orderBy: { changedAt: 'desc' },
            },
          },
        },
        reminders: {
          orderBy: { reminderDate: 'asc' },
        },
      },
    });

    if (!record) {
      throw ApiError.notFound('Exposure record not found');
    }

    // Retrieve related audit timeline entries
    const activityTimeline = await prisma.auditLog.findMany({
      where: {
        userId,
        entityType: AuditEntityType.EXPOSURE_RECORD,
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const risk = this.computeRisk(record);
    return { ...record, activityTimeline, ...risk };
  }

  /**
   * Updates an existing exposure record owned by the authenticated tenant.
   */
  static async updateExposure(
    userId: string,
    id: string,
    data: UpdateExposureDTO | any
  ): Promise<ExposureWithDetails> {
    // 1. Verify ownership
    const existing = await this.getExposureById(userId, id);

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
                data: data.categoryIds.map((dataCategoryId: string) => ({
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
        ...(data.platformUrl !== undefined ? { platformUrl: data.platformUrl } : {}),
        ...(data.dataDescription !== undefined ? { dataDescription: data.dataDescription } : {}),
        ...(data.exposureSource !== undefined
          ? { exposureSource: data.exposureSource as ExposureSource }
          : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility as ExposureVisibility } : {}),
        ...(data.sharingStatus !== undefined
          ? { sharingStatus: data.sharingStatus as DataSharingStatus }
          : {}),
        ...(data.lastVerifiedDate !== undefined ? { lastVerifiedDate: data.lastVerifiedDate } : {}),
        ...(data.remediationStatus !== undefined
          ? { remediationStatus: data.remediationStatus as RemediationStatus }
          : {}),
        ...(data.evidenceAttachment !== undefined ? { evidenceAttachment: data.evidenceAttachment } : {}),
      },
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

    const risk = this.computeRisk(updated);

    // Audit status transitions
    let action: string = AuditAction.EXPOSURE_UPDATED;
    if (
      data.remediationStatus === RemediationStatus.RESOLVED &&
      existing.remediationStatus !== RemediationStatus.RESOLVED
    ) {
      action = 'EXPOSURE_RESOLVED';
    } else if (data.recordStatus && data.recordStatus !== existing.recordStatus) {
      action = 'EXPOSURE_STATUS_CHANGED';
    }

    await AuditLogService.record({
      userId,
      action,
      entityType: AuditEntityType.EXPOSURE_RECORD,
      entityId: updated.id,
    });

    return { ...updated, ...risk };
  }

  /**
   * Marks an exposure record as RESOLVED with explicit action and audit trail.
   */
  static async markAsResolved(userId: string, id: string): Promise<ExposureWithDetails> {
    return this.updateExposure(userId, id, {
      remediationStatus: RemediationStatus.RESOLVED,
      recordStatus: RecordStatus.REMOVED,
    });
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

  /**
   * Aggregates live exposure dashboard metrics: summary cards, risk distribution,
   * platform groupings, and critical exposure counts.
   */
  static async getSummary(userId: string): Promise<ExposureSummaryResponse> {
    const exposures = await prisma.exposureRecord.findMany({
      where: { userId },
      include: {
        website: true,
        categories: {
          include: { dataCategory: true },
        },
      },
    });

    const totalExposures = exposures.length;
    let activeExposures = 0;
    let resolvedExposures = 0;
    let criticalExposures = 0;

    const riskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const platformMap = new Map<
      string,
      {
        platformId: string;
        platformName: string;
        platformUrl: string;
        exposureCount: number;
        highestRisk: number;
        hasCritical: boolean;
      }
    >();

    exposures.forEach((exp) => {
      const risk = this.computeRisk(exp);
      const score = risk.calculatedRiskScore;
      const rating = risk.calculatedRiskRating;

      // Status aggregation
      if (
        exp.remediationStatus === RemediationStatus.RESOLVED ||
        exp.recordStatus === RecordStatus.REMOVED
      ) {
        resolvedExposures += 1;
      } else {
        activeExposures += 1;
      }

      // Risk distribution
      if (score > 70) {
        criticalExposures += 1;
        riskDistribution.critical += 1;
      } else if (score > 40) {
        riskDistribution.high += 1;
      } else if (score > 20) {
        riskDistribution.medium += 1;
      } else {
        riskDistribution.low += 1;
      }

      // Platform grouping
      const platformId = exp.websiteId;
      const platformName = exp.website?.websiteName || 'Unknown Platform';
      const platformUrl = exp.platformUrl || exp.website?.websiteUrl || '';

      const current = platformMap.get(platformId) || {
        platformId,
        platformName,
        platformUrl,
        exposureCount: 0,
        highestRisk: 0,
        hasCritical: false,
      };

      current.exposureCount += 1;
      if (score > current.highestRisk) {
        current.highestRisk = score;
      }
      if (score > 70) {
        current.hasCritical = true;
      }
      platformMap.set(platformId, current);
    });

    const byPlatform = Array.from(platformMap.values()).sort(
      (a, b) => b.highestRisk - a.highestRisk || b.exposureCount - a.exposureCount
    );

    return {
      totalExposures,
      activeExposures,
      criticalExposures,
      resolvedExposures,
      riskDistribution,
      byPlatform,
    };
  }

  /**
   * Creates a removal request directly from an exposure record.
   */
  static async createRemovalRequestForExposure(
    userId: string,
    exposureId: string,
    data: CreateExposureRemovalDTO
  ) {
    const exposure = await this.getExposureById(userId, exposureId);

    const removal = await RemovalRequestService.createRemovalRequest(userId, {
      websiteId: exposure.websiteId,
      exposureRecordId: exposure.id,
      requestType: data.requestType as RemovalRequestType,
      requestReason: data.requestReason,
      requestStatus: 'DRAFT' as any,
      externalReference: data.externalReference || undefined,
    });

    await AuditLogService.record({
      userId,
      action: 'EXPOSURE_REMOVAL_LINKED',
      entityType: AuditEntityType.EXPOSURE_RECORD,
      entityId: exposureId,
    });

    return removal;
  }
}
