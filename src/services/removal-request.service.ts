/**
 * OBLIVION - Removal Request & History Service
 *
 * Implements privacy erasure workflows (GDPR Art. 17 / CCPA),
 * deterministic status transition validation, append-only history audits,
 * and complete multi-tenant relational verification.
 */

import {
  RemovalRequest,
  RequestHistory,
  RequestStatus,
  RemovalRequestType,
  RecordStatus,
  ReminderType,
  ReminderStatus,
  EmailDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { TenantSecurity } from '../utils/tenant-security';
import {
  CreateRemovalRequestDTO,
  UpdateRemovalRequestDTO,
  RemovalRequestQueryDTO,
} from '../validators/removal-request.validator';
import {
  PreviewStatutoryDemandDTO,
  DispatchStatutoryDemandDTO,
} from '../validators/statutory-demand.validator';
import {
  buildStatutoryNotice,
  calculateStatutoryDeadline,
  RenderedStatutoryNotice,
} from '../templates/legal-erasure-templates';
import { EmailService } from './email.service';
import { ReminderService } from './reminder.service';
import { UserEmailNotificationService } from './user-email-notification.service';
import { RemovalRequestWithDetails } from '../types/removal-request.types';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditEntityType } from '../types/audit-log.types';

export class RemovalRequestService {
  /**
   * Deterministic status transition graph enforcing valid privacy erasure lifecycles.
   */
  private static readonly VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
    [RequestStatus.DRAFT]: [RequestStatus.SUBMITTED, RequestStatus.REJECTED],
    [RequestStatus.SUBMITTED]: [
      RequestStatus.ACKNOWLEDGED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.REJECTED,
    ],
    [RequestStatus.ACKNOWLEDGED]: [
      RequestStatus.IN_PROGRESS,
      RequestStatus.FOLLOW_UP_REQUIRED,
      RequestStatus.COMPLETED,
      RequestStatus.REJECTED,
    ],
    [RequestStatus.IN_PROGRESS]: [
      RequestStatus.FOLLOW_UP_REQUIRED,
      RequestStatus.COMPLETED,
      RequestStatus.REJECTED,
    ],
    [RequestStatus.FOLLOW_UP_REQUIRED]: [
      RequestStatus.IN_PROGRESS,
      RequestStatus.COMPLETED,
      RequestStatus.REJECTED,
    ],
    [RequestStatus.COMPLETED]: [], // Terminal state
    [RequestStatus.REJECTED]: [RequestStatus.APPEALED],
    [RequestStatus.APPEALED]: [
      RequestStatus.IN_PROGRESS,
      RequestStatus.COMPLETED,
      RequestStatus.REJECTED,
    ],
  };

  /**
   * Creates a removal request, verifying ownership of both website and exposure record.
   */
  static async createRemovalRequest(
    userId: string,
    data: CreateRemovalRequestDTO
  ): Promise<RemovalRequestWithDetails> {
    const initialStatus = (data.requestStatus as RequestStatus) || RequestStatus.DRAFT;
    const isSubmitted = initialStatus === RequestStatus.SUBMITTED;

    let targetExposureId = data.exposureRecordId;

    if (!targetExposureId && data.exposedDataDescription) {
      // Enforce ownership of referenced website
      await TenantSecurity.websites.get(userId, data.websiteId);

      const purpose = data.exposedDataDescription.length > 255
        ? data.exposedDataDescription.slice(0, 252) + '...'
        : data.exposedDataDescription;

      const createdExposure = await prisma.exposureRecord.create({
        data: {
          userId,
          websiteId: data.websiteId,
          purpose,
          notes: data.exposedDataDescription,
          recordStatus: isSubmitted ? RecordStatus.REMOVAL_REQUESTED : RecordStatus.ACTIVE,
          dateShared: new Date(),
          sensitivityLevel: 'MEDIUM',
        },
      });

      targetExposureId = createdExposure.id;

      await AuditLogService.record({
        userId,
        action: AuditAction.EXPOSURE_CREATED,
        entityType: AuditEntityType.EXPOSURE_RECORD,
        entityId: createdExposure.id,
      });
    } else if (targetExposureId) {
      // 1. Enforce ownership of referenced website & exposure record
      await TenantSecurity.websites.get(userId, data.websiteId);
      const exposure = await TenantSecurity.exposureRecords.get(userId, targetExposureId);

      // Verify exposure belongs to the specified website
      if (exposure.websiteId !== data.websiteId) {
        throw ApiError.badRequest('Referenced exposure record does not belong to the specified website');
      }
    } else {
      throw ApiError.badRequest('Either exposureRecordId or exposedDataDescription must be provided');
    }

    // 2. Create removal request with initial history entry in transaction
    const request = await prisma.removalRequest.create({
      data: {
        userId,
        websiteId: data.websiteId,
        exposureRecordId: targetExposureId,
        requestType: (data.requestType as RemovalRequestType) || RemovalRequestType.GDPR_ERASURE,
        requestReason: data.requestReason,
        requestStatus: initialStatus,
        externalReference: data.externalReference,
        submittedAt: isSubmitted ? new Date() : null,
        history: {
          create: {
            previousStatus: null,
            newStatus: initialStatus,
            remarks: isSubmitted
              ? 'Removal request created and submitted'
              : 'Removal request drafted',
          },
        },
      },
      include: {
        website: true,
        exposureRecord: true,
        history: {
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    // If submitted, update exposure status
    if (isSubmitted && targetExposureId) {
      await prisma.exposureRecord.update({
        where: { id: targetExposureId },
        data: { recordStatus: RecordStatus.REMOVAL_REQUESTED },
      });
    }

    await AuditLogService.record({
      userId,
      action: AuditAction.REMOVAL_REQUEST_CREATED,
      entityType: AuditEntityType.REMOVAL_REQUEST,
      entityId: request.id,
    });

    // Notify user of removal request creation
    try {
      await UserEmailNotificationService.sendRemovalRequestCreated(userId, request.id);
    } catch {
      // Non-blocking notification dispatch
    }

    return request;
  }

  /**
   * Retrieves paginated removal requests owned by the authenticated tenant.
   */
  static async getRemovalRequests(userId: string, query: RemovalRequestQueryDTO) {
    const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page || 1), 10) || 1;
    const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RemovalRequestWhereInput = {
      userId,
      ...(query.requestStatus ? { requestStatus: query.requestStatus as RequestStatus } : {}),
      ...(query.requestType ? { requestType: query.requestType as RemovalRequestType } : {}),
      ...(query.websiteId ? { websiteId: query.websiteId } : {}),
      ...(query.search
        ? {
            OR: [
              { requestReason: { contains: query.search, mode: 'insensitive' } },
              { externalReference: { contains: query.search, mode: 'insensitive' } },
              { website: { websiteName: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, requests] = await Promise.all([
      prisma.removalRequest.count({ where }),
      prisma.removalRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
        include: {
          website: true,
          exposureRecord: true,
          history: {
            orderBy: { changedAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      requests,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single removal request by ID.
   */
  static async getRemovalRequestById(
    userId: string,
    id: string
  ): Promise<RemovalRequestWithDetails> {
    const request = await prisma.removalRequest.findFirst({
      where: { id, userId },
      include: {
        website: true,
        exposureRecord: {
          include: {
            categories: {
              include: { dataCategory: true },
            },
          },
        },
        history: {
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw ApiError.notFound('Removal request not found');
    }

    return request;
  }

  /**
   * Updates removal request status or details, enforcing valid state transitions.
   */
  static async updateRemovalRequest(
    userId: string,
    id: string,
    data: UpdateRemovalRequestDTO
  ): Promise<RemovalRequestWithDetails> {
    const existing = await this.getRemovalRequestById(userId, id);

    let newStatus = data.requestStatus as RequestStatus | undefined;
    const statusChanging = newStatus && newStatus !== existing.requestStatus;

    if (statusChanging && newStatus) {
      // Validate transition
      const allowedNext = this.VALID_TRANSITIONS[existing.requestStatus] || [];
      if (!allowedNext.includes(newStatus)) {
        throw ApiError.badRequest(
          `Invalid status transition from '${existing.requestStatus}' to '${newStatus}'. Allowed next states: ${
            allowedNext.length > 0 ? allowedNext.join(', ') : 'None (Terminal State)'
          }`
        );
      }
    }

    const isNowSubmitted = newStatus === RequestStatus.SUBMITTED;
    const isNowCompleted = newStatus === RequestStatus.COMPLETED;

    // Execute atomic update & history append
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update request
      const req = await tx.removalRequest.update({
        where: { id },
        data: {
          ...(newStatus ? { requestStatus: newStatus } : {}),
          ...(data.requestReason !== undefined ? { requestReason: data.requestReason } : {}),
          ...(data.externalReference !== undefined ? { externalReference: data.externalReference } : {}),
          ...(isNowSubmitted && !existing.submittedAt ? { submittedAt: new Date() } : {}),
          ...(isNowCompleted ? { resolvedAt: new Date() } : {}),
        },
        include: {
          website: true,
          exposureRecord: true,
          history: {
            orderBy: { changedAt: 'desc' },
          },
        },
      });

      // 2. Append history entry if status changed
      if (statusChanging && newStatus) {
        await tx.requestHistory.create({
          data: {
            removalRequestId: id,
            previousStatus: existing.requestStatus,
            newStatus,
            remarks: data.remarks || `Status transitioned to ${newStatus}`,
          },
        });
      }

      // 3. Cascade exposure record status if completed
      if (isNowCompleted) {
        await tx.exposureRecord.update({
          where: { id: existing.exposureRecordId },
          data: { recordStatus: RecordStatus.REMOVED },
        });
      } else if (isNowSubmitted) {
        await tx.exposureRecord.update({
          where: { id: existing.exposureRecordId },
          data: { recordStatus: RecordStatus.REMOVAL_REQUESTED },
        });
      }

      return req;
    });

    // Re-fetch with fresh history
    const refreshed = await this.getRemovalRequestById(userId, id);

    await AuditLogService.record({
      userId,
      action: AuditAction.REMOVAL_STATUS_UPDATED,
      entityType: AuditEntityType.REMOVAL_REQUEST,
      entityId: id,
    });

    if (statusChanging && newStatus) {
      try {
        await UserEmailNotificationService.sendRemovalStatusUpdated(
          userId,
          id,
          existing.requestStatus,
          newStatus,
          data.remarks
        );
      } catch {
        // Non-blocking notification dispatch
      }
    }

    return refreshed;
  }

  /**
   * Retrieves append-only history for a removal request.
   */
  static async getRequestHistory(userId: string, requestId: string): Promise<RequestHistory[]> {
    // Enforce ownership of parent removal request
    await this.getRemovalRequestById(userId, requestId);

    return prisma.requestHistory.findMany({
      where: { removalRequestId: requestId },
      orderBy: { changedAt: 'desc' },
    });
  }

  /**
   * Generates a preview of the statutory legal erasure demand notice without sending emails.
   */
  static async previewStatutoryDemand(
    userId: string,
    requestId: string,
    opts?: PreviewStatutoryDemandDTO
  ): Promise<{
    removalRequestId: string;
    websiteName: string;
    websiteUrl: string;
    requestType: RemovalRequestType;
    recipientEmail: string | null;
    statutoryDeadlineDays: number;
    calculatedDeadlineDate: string;
    notice: RenderedStatutoryNotice;
    previewOnly: boolean;
  }> {
    const request = await this.getRemovalRequestById(userId, requestId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const { days, dueDate, framework } = calculateStatutoryDeadline(request.requestType);
    const refToken = `OBV-${request.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const websiteName = request.website?.websiteName || 'Target Platform';
    const websiteUrl = request.website?.websiteUrl || 'https://platform.local';

    const dataDescription =
      request.exposureRecord?.notes ||
      request.exposureRecord?.purpose ||
      request.requestReason ||
      'Personal data and associated identifiers';

    const notice = buildStatutoryNotice({
      userName: user.fullName || 'Data Subject',
      userEmail: user.email,
      websiteName,
      websiteUrl,
      requestType: request.requestType,
      exposedDataDescription: dataDescription,
      requestReason: request.requestReason,
      customNotes: opts?.customNotes,
      referenceNumber: refToken,
      jurisdictionDeadlineDays: days,
      calculatedDeadlineDate: dueDate,
    });

    return {
      removalRequestId: request.id,
      websiteName,
      websiteUrl,
      requestType: request.requestType,
      recipientEmail: opts?.recipientEmail || null,
      statutoryDeadlineDays: days,
      calculatedDeadlineDate: dueDate.toISOString().split('T')[0],
      notice,
      previewOnly: true,
    };
  }

  /**
   * Securely dispatches a formal statutory legal erasure demand notice via Resend with explicit user confirmation.
   * Also provisions an idempotent 30/45-day statutory response tracking reminder and saves full audit evidence.
   */
  static async dispatchStatutoryDemand(
    userId: string,
    requestId: string,
    opts: DispatchStatutoryDemandDTO
  ): Promise<{
    removalRequestId: string;
    requestStatus: RequestStatus;
    recipientEmail: string;
    resendEmailId: string | null;
    gatewayStatus: string;
    confirmedDelivery: boolean;
    noticeVersion: string;
    legalFramework: string;
    legalBasisCitation: string;
    statutoryDeadlineDays: number;
    calculatedDeadlineDate: string;
    linkedReminderId: string;
    evidenceRecorded: boolean;
    disclaimer: string;
  }> {
    // 1. Enforce explicit user confirmation
    if (opts.confirmDispatch !== true) {
      throw ApiError.badRequest(
        'Explicit user confirmation (confirmDispatch: true) is required to legally dispatch a statutory demand'
      );
    }

    // 2. Enforce rate limiting: maximum 5 dispatches per hour per account
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentDispatchesCount = await prisma.emailDelivery.count({
      where: {
        userId,
        notificationStage: 'STATUTORY_DEMAND_DISPATCHED',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentDispatchesCount >= 5) {
      throw ApiError.tooManyRequests(
        'Rate limit exceeded: You may dispatch a maximum of 5 statutory legal demands per hour per account. Please wait before dispatching another notice.'
      );
    }

    // 3. Enforce tenant ownership and state verification
    const request = await this.getRemovalRequestById(userId, requestId);

    if (request.requestStatus === RequestStatus.COMPLETED) {
      throw ApiError.badRequest('Cannot dispatch statutory demand for an already completed removal request');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // 4. Calculate statutory compliance deadline
    const { days, dueDate, framework } = calculateStatutoryDeadline(request.requestType);
    const refToken = `OBV-${request.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const websiteName = request.website?.websiteName || 'Target Platform';
    const websiteUrl = request.website?.websiteUrl || 'https://platform.local';

    const dataDescription =
      request.exposureRecord?.notes ||
      request.exposureRecord?.purpose ||
      request.requestReason ||
      'Personal data and associated identifiers';

    // 5. Render versioned statutory notice
    const notice = buildStatutoryNotice({
      userName: user.fullName || 'Data Subject',
      userEmail: user.email,
      websiteName,
      websiteUrl,
      requestType: request.requestType,
      exposedDataDescription: dataDescription,
      requestReason: request.requestReason,
      customNotes: opts.customNotes,
      referenceNumber: refToken,
      jurisdictionDeadlineDays: days,
      calculatedDeadlineDate: dueDate,
    });

    // 6. Dispatch notice via transactional EmailService (Resend / Safe Test Sink in dev)
    const emailResult = await EmailService.sendEmail({
      to: opts.recipientEmail,
      subject: notice.subject,
      html: notice.html,
      text: notice.text,
      tags: [
        { name: 'removal_request_id', value: request.id },
        { name: 'framework', value: request.requestType },
        { name: 'type', value: 'statutory_legal_demand' },
      ],
    });

    if (!emailResult.success) {
      // Record failed dispatch attempt in request history
      await prisma.requestHistory.create({
        data: {
          removalRequestId: request.id,
          previousStatus: request.requestStatus,
          newStatus: request.requestStatus,
          remarks: `[DISPATCH FAILED] Statutory demand transmission to ${opts.recipientEmail} failed: ${emailResult.error || 'Gateway rejected dispatch'}`,
        },
      });

      throw ApiError.internal(
        emailResult.error || 'Failed to dispatch statutory legal demand through email gateway'
      );
    }

    const resendEmailId = emailResult.resendEmailId || null;

    // 7. Transition request state to SUBMITTED and record external reference
    await prisma.removalRequest.update({
      where: { id: request.id },
      data: {
        requestStatus: RequestStatus.SUBMITTED,
        submittedAt: new Date(),
        externalReference: resendEmailId || refToken,
      },
    });

    // Cascade exposure record status
    if (request.exposureRecordId) {
      await prisma.exposureRecord.update({
        where: { id: request.exposureRecordId },
        data: { recordStatus: RecordStatus.REMOVAL_REQUESTED },
      });
    }

    // 8. Record immutable dispatch evidence in RequestHistory
    const evidenceText = [
      `[STATUTORY LEGAL DEMAND DISPATCHED]`,
      `Recipient: ${opts.recipientEmail}`,
      `Resend Gateway ID: ${resendEmailId || 'N/A'}`,
      `Framework: ${framework.frameworkName}`,
      `Citation: ${framework.citation}`,
      `Statutory Deadline: ${notice.calculatedDeadlineDate} (${days} days)`,
      `Notice Version: ${notice.noticeVersion}`,
      `Audit Token: ${refToken}`,
      `Gateway Status: ACCEPTED_FOR_DELIVERY`,
    ].join('\n');

    await prisma.requestHistory.create({
      data: {
        removalRequestId: request.id,
        previousStatus: request.requestStatus,
        newStatus: RequestStatus.SUBMITTED,
        remarks: evidenceText,
      },
    });

    // 9. Record persistent EmailDelivery record for tracking & rate limiting
    await prisma.emailDelivery.create({
      data: {
        userId,
        reminderId: null,
        notificationStage: 'STATUTORY_DEMAND_DISPATCHED',
        recipientEmail: opts.recipientEmail,
        subject: notice.subject,
        deliveryStatus: EmailDeliveryStatus.SENT,
        resendEmailId,
        sentAt: new Date(),
        metadata: {
          removalRequestId: request.id,
          noticeVersion: notice.noticeVersion,
          legalFramework: framework.frameworkName,
          statutoryCitation: framework.citation,
          statutoryDeadlineDays: days,
          calculatedDeadlineDate: notice.calculatedDeadlineDate,
          dueDate: dueDate.toISOString(),
          referenceToken: refToken,
        },
      },
    });

    // 10. Idempotent statutory response tracking reminder creation (prevents duplicate reminders)
    const existingReminder = await prisma.reminder.findFirst({
      where: {
        userId,
        exposureRecordId: request.exposureRecordId,
        reminderType: ReminderType.FOLLOW_UP_REMOVAL,
        reminderStatus: ReminderStatus.PENDING,
      },
    });

    let linkedReminderId: string;

    if (existingReminder) {
      const updatedReminder = await prisma.reminder.update({
        where: { id: existingReminder.id },
        data: {
          reminderDate: dueDate,
        },
      });
      linkedReminderId = updatedReminder.id;
    } else {
      const newReminder = await ReminderService.createReminder(userId, {
        exposureRecordId: request.exposureRecordId,
        reminderType: ReminderType.FOLLOW_UP_REMOVAL,
        reminderDate: dueDate,
        title: `${framework.frameworkName} Response Deadline - ${websiteName}`,
        notes: `Statutory compliance tracking for erasure demand dispatched to ${opts.recipientEmail}. Due on ${notice.calculatedDeadlineDate}.`,
      });
      linkedReminderId = newReminder.id;
    }

    // 11. Record compliance audit log
    await AuditLogService.record({
      userId,
      action: AuditAction.REMOVAL_REQUEST_DISPATCHED,
      entityType: AuditEntityType.REMOVAL_REQUEST,
      entityId: request.id,
    });

    // 12. Return structured response separating API acceptance from confirmed delivery
    return {
      removalRequestId: request.id,
      requestStatus: RequestStatus.SUBMITTED,
      recipientEmail: opts.recipientEmail,
      resendEmailId,
      gatewayStatus: 'ACCEPTED_FOR_TRANSMISSION',
      confirmedDelivery: false,
      noticeVersion: notice.noticeVersion,
      legalFramework: framework.frameworkName,
      legalBasisCitation: framework.citation,
      statutoryDeadlineDays: days,
      calculatedDeadlineDate: notice.calculatedDeadlineDate,
      linkedReminderId,
      evidenceRecorded: true,
      disclaimer:
        'Gateway acceptance indicates the statutory email was accepted by the outbound email service (Resend) for transmission. It does not constitute proof of recipient receipt, legal service acknowledgment, or compliance by the receiving entity.',
    };
  }
}
