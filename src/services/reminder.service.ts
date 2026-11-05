/**
 * OBLIVION - Reminder Service
 *
 * Implements privacy review scheduling, consent revalidation reminders,
 * duplicate detection, and tenant-scoped lifecycle management.
 */

import { Reminder, ReminderType, ReminderStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { TenantSecurity } from '../utils/tenant-security';
import {
  CreateReminderDTO,
  UpdateReminderDTO,
  ReminderQueryDTO,
} from '../validators/reminder.validator';
import { ReminderWithDetails } from '../types/reminder.types';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';
import { ReminderSchedulerService } from './reminder-scheduler.service';

export class ReminderService {
  /**
   * Schedules a new privacy review or expiry reminder.
   */
  static async createReminder(
    userId: string,
    data: CreateReminderDTO
  ): Promise<ReminderWithDetails> {
    let targetExposureId = data.exposureRecordId;

    if (targetExposureId) {
      // 1. Enforce parent exposure record ownership
      await TenantSecurity.exposureRecords.get(userId, targetExposureId);
    } else {
      // Auto-resolve or provision an exposure record for the user without creating duplicate ExposureRecords
      let exposure = await prisma.exposureRecord.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!exposure) {
        let website = await prisma.website.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (!website) {
          website = await prisma.website.create({
            data: {
              userId,
              websiteName: 'General Privacy Monitoring',
              websiteUrl: 'https://privacy.local',
              websiteCategory: 'OTHER',
            },
          });
        }

        exposure = await prisma.exposureRecord.create({
          data: {
            userId,
            websiteId: website.id,
            purpose: data.title || 'General Privacy Review',
            notes: data.notes || null,
            recordStatus: 'ACTIVE',
            dateShared: new Date(),
            sensitivityLevel: 'MEDIUM',
          },
        });
      }

      targetExposureId = exposure.id;
    }

    const reminderType = (data.reminderType as ReminderType) || ReminderType.ANNUAL_PRIVACY_REVIEW;

    // 2. Check for duplicate reminder
    const existing = await prisma.reminder.findUnique({
      where: {
        exposureRecordId_reminderType_reminderDate: {
          exposureRecordId: targetExposureId,
          reminderType,
          reminderDate: data.reminderDate,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict('A reminder of this type is already scheduled for this date and exposure');
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId,
        exposureRecordId: targetExposureId,
        reminderType,
        reminderDate: data.reminderDate,
        reminderStatus: ReminderStatus.PENDING,
      },
      include: {
        exposureRecord: {
          include: { website: true },
        },
      },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.REMINDER_CREATED,
      entityType: AuditEntityType.REMINDER,
      entityId: reminder.id,
    });

    const resolvedTitle = data.title || reminder.exposureRecord?.purpose || reminder.reminderType.replace(/_/g, ' ');
    await ReminderSchedulerService.sendReminderScheduledNotification(
      userId,
      reminder,
      resolvedTitle,
      data.notes || reminder.exposureRecord?.notes
    );

    return {
      ...reminder,
      title: data.title || reminder.exposureRecord?.purpose || reminder.reminderType.replace(/_/g, ' '),
      notes: data.notes || reminder.exposureRecord?.notes || null,
    } as any;
  }

  /**
   * Retrieves paginated reminders owned by the authenticated tenant.
   */
  static async getReminders(userId: string, query: ReminderQueryDTO) {
    const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page || 1), 10) || 1;
    const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReminderWhereInput = {
      userId,
      ...(query.reminderStatus ? { reminderStatus: query.reminderStatus as ReminderStatus } : {}),
      ...(query.reminderType ? { reminderType: query.reminderType as ReminderType } : {}),
      ...(query.exposureRecordId ? { exposureRecordId: query.exposureRecordId } : {}),
      ...(query.upcomingOnly
        ? {
            reminderDate: { gte: new Date() },
            reminderStatus: ReminderStatus.PENDING,
          }
        : {}),
    };

    const [total, rawReminders] = await Promise.all([
      prisma.reminder.count({ where }),
      prisma.reminder.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'reminderDate']: query.sortOrder || 'asc',
        },
        include: {
          exposureRecord: {
            include: { website: true },
          },
        },
      }),
    ]);

    const reminders = rawReminders.map((r) => ({
      ...r,
      title: r.exposureRecord?.purpose || r.reminderType.replace(/_/g, ' '),
      notes: r.exposureRecord?.notes || null,
    }));

    return {
      reminders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single reminder by ID with ownership verification.
   */
  static async getReminderById(userId: string, id: string): Promise<ReminderWithDetails> {
    const reminder = await prisma.reminder.findFirst({
      where: { id, userId },
      include: {
        exposureRecord: {
          include: { website: true },
        },
      },
    });

    if (!reminder) {
      throw ApiError.notFound('Reminder not found');
    }

    return {
      ...reminder,
      title: reminder.exposureRecord?.purpose || reminder.reminderType.replace(/_/g, ' '),
      notes: reminder.exposureRecord?.notes || null,
    } as any;
  }

  /**
   * Updates an existing reminder.
   */
  static async updateReminder(
    userId: string,
    id: string,
    data: UpdateReminderDTO
  ): Promise<ReminderWithDetails> {
    await this.getReminderById(userId, id);

    const isCompleting = data.reminderStatus === ReminderStatus.COMPLETED;

    const updated = await prisma.reminder.update({
      where: { id },
      data: {
        ...(data.reminderDate !== undefined ? { reminderDate: data.reminderDate } : {}),
        ...(data.reminderType !== undefined ? { reminderType: data.reminderType as ReminderType } : {}),
        ...(data.reminderStatus !== undefined ? { reminderStatus: data.reminderStatus as ReminderStatus } : {}),
        ...(isCompleting ? { completedAt: new Date() } : {}),
      },
      include: {
        exposureRecord: {
          include: { website: true },
        },
      },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.REMINDER_UPDATED,
      entityType: AuditEntityType.REMINDER,
      entityId: updated.id,
    });

    if (isCompleting) {
      const resolvedTitle = data.title || updated.exposureRecord?.purpose || updated.reminderType.replace(/_/g, ' ');
      await ReminderSchedulerService.sendReminderCompletedNotification(
        userId,
        updated,
        resolvedTitle
      );
    }

    return {
      ...updated,
      title: updated.exposureRecord?.purpose || updated.reminderType.replace(/_/g, ' '),
      notes: updated.exposureRecord?.notes || null,
    } as any;
  }

  /**
   * Deletes a reminder.
   */
  static async deleteReminder(userId: string, id: string): Promise<Reminder> {
    await this.getReminderById(userId, id);

    // Cancel any pending unsent emails before deletion
    await ReminderSchedulerService.cancelPendingEmailsForReminder(id);

    const deleted = await prisma.reminder.delete({
      where: { id },
    });

    await AuditLogService.record({
      userId,
      action: AuditAction.REMINDER_DELETED,
      entityType: AuditEntityType.REMINDER,
      entityId: id,
    });

    return deleted;
  }
}
