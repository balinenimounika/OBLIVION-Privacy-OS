/**
 * OBLIVION - Website Service
 *
 * Implements business logic and data access for tenant-owned websites.
 */

import { Website, WebsiteCategory, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { CreateWebsiteDTO, UpdateWebsiteDTO, WebsiteQueryDTO } from '../validators/website.validator';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';

export class WebsiteService {
  /**
   * Registers a new website under the authenticated tenant.
   */
  static async createWebsite(userId: string, data: CreateWebsiteDTO): Promise<Website> {
    // Check if website with identical URL already exists for this tenant
    const existing = await prisma.website.findUnique({
      where: {
        userId_websiteUrl: {
          userId,
          websiteUrl: data.websiteUrl,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('A website with this URL has already been registered in your account');
    }

    const website = await prisma.website.create({
      data: {
        websiteName: data.websiteName,
        websiteUrl: data.websiteUrl,
        websiteCategory: (data.websiteCategory as WebsiteCategory) || WebsiteCategory.OTHER,
        user: { connect: { id: userId } },
      },
      include: {
        _count: {
          select: {
            exposureRecords: true,
            removalRequests: true,
          },
        },
      },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.WEBSITE_CREATED,
      entityType: AuditEntityType.WEBSITE,
      entityId: website.id,
    });

    return website;
  }

  /**
   * Retrieves a paginated list of websites owned by the authenticated tenant.
   */
  static async getWebsites(userId: string, query: WebsiteQueryDTO) {
    const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page || 1), 10) || 1;
    const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.WebsiteWhereInput = {
      userId,
      ...(query.category ? { websiteCategory: query.category as WebsiteCategory } : {}),
      ...(query.search
        ? {
            OR: [
              { websiteName: { contains: query.search, mode: 'insensitive' } },
              { websiteUrl: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, websites] = await Promise.all([
      prisma.website.count({ where }),
      prisma.website.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
        include: {
          _count: {
            select: {
              exposureRecords: true,
              removalRequests: true,
            },
          },
        },
      }),
    ]);

    return {
      websites,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single website by ID, verifying tenant ownership.
   */
  static async getWebsiteById(userId: string, id: string): Promise<Website> {
    const website = await prisma.website.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            exposureRecords: true,
            removalRequests: true,
          },
        },
      },
    });

    if (!website) {
      throw ApiError.notFound('Website not found');
    }

    return website;
  }

  /**
   * Updates an existing website owned by the authenticated tenant.
   */
  static async updateWebsite(
    userId: string,
    id: string,
    data: UpdateWebsiteDTO
  ): Promise<Website> {
    // Verify ownership
    await this.getWebsiteById(userId, id);

    // If URL is being updated, verify it doesn't collide with another website for this user
    if (data.websiteUrl) {
      const duplicate = await prisma.website.findFirst({
        where: {
          userId,
          websiteUrl: data.websiteUrl,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw ApiError.conflict('Another website with this URL already exists in your account');
      }
    }

    const updated = await prisma.website.update({
      where: { id },
      data: {
        ...(data.websiteName !== undefined ? { websiteName: data.websiteName } : {}),
        ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl } : {}),
        ...(data.websiteCategory !== undefined
          ? { websiteCategory: data.websiteCategory as WebsiteCategory }
          : {}),
      },
      include: {
        _count: {
          select: {
            exposureRecords: true,
            removalRequests: true,
          },
        },
      },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.WEBSITE_UPDATED,
      entityType: AuditEntityType.WEBSITE,
      entityId: updated.id,
    });

    return updated;
  }

  /**
   * Deletes a website owned by the authenticated tenant.
   */
  static async deleteWebsite(userId: string, id: string): Promise<Website> {
    // Verify ownership
    await this.getWebsiteById(userId, id);

    const deleted = await prisma.website.delete({
      where: { id },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.WEBSITE_DELETED,
      entityType: AuditEntityType.WEBSITE,
      entityId: id,
    });

    return deleted;
  }
}
