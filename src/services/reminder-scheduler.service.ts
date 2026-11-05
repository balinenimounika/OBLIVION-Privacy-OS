/**
 * OBLIVION - Intelligent Reminder Notification & Background Scheduler Service
 *
 * Implements automated deadline tracking, progressive alert generation,
 * duplicate prevention across scheduler runs, lifecycle completion notifications,
 * and transactional email delivery powered by Resend.
 */

import {
  EmailDelivery,
  EmailDeliveryStatus,
  NotificationType,
  OverdueFrequency,
  ReminderStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { EmailService, RESEND_QUOTA_EXCEEDED_MESSAGE } from './email.service';
import { UserPreferenceService } from './user-preference.service';
import { buildReminderEmail } from '../templates/email-templates';

export type ReminderAlertStage =
  | 'SCHEDULED'
  | '7_DAYS_BEFORE'
  | '3_DAYS_BEFORE'
  | '1_DAY_BEFORE'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'COMPLETED';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface StageAlertConfig {
  title: string;
  priority: NotificationPriority;
  notificationType: NotificationType;
  getMessage: (title: string, dateStr: string, notes?: string | null) => string;
}

const STAGE_CONFIGS: Record<ReminderAlertStage, StageAlertConfig> = {
  SCHEDULED: {
    title: 'Reminder Scheduled',
    priority: 'LOW',
    notificationType: NotificationType.SYSTEM_NOTICE,
    getMessage: (title, dateStr, notes) =>
      `Privacy deadline for "${title}" has been scheduled for ${dateStr}.${notes ? ` Notes: "${notes}"` : ''}`,
  },
  '7_DAYS_BEFORE': {
    title: 'Upcoming Deadline: 7 Days Remaining',
    priority: 'MEDIUM',
    notificationType: NotificationType.REMINDER_DUE,
    getMessage: (title, dateStr) =>
      `Privacy deadline for "${title}" is due in 7 days on ${dateStr}. Please prepare required documentation or follow-up responses.`,
  },
  '3_DAYS_BEFORE': {
    title: 'Deadline Approaching: 3 Days Remaining',
    priority: 'HIGH',
    notificationType: NotificationType.REMINDER_DUE,
    getMessage: (title, dateStr) =>
      `Statutory deadline for "${title}" is approaching in 3 days on ${dateStr}. Action may be required soon.`,
  },
  '1_DAY_BEFORE': {
    title: 'Urgent: Deadline Due Tomorrow',
    priority: 'HIGH',
    notificationType: NotificationType.REMINDER_DUE,
    getMessage: (title, dateStr) =>
      `Urgent alert: Privacy deadline for "${title}" is due tomorrow on ${dateStr}. Review pending requirements now.`,
  },
  DUE_TODAY: {
    title: 'Action Required: Deadline Due Today',
    priority: 'URGENT',
    notificationType: NotificationType.REMINDER_DUE,
    getMessage: (title, dateStr) =>
      `Action required: Privacy review deadline for "${title}" is due today (${dateStr}). Mark complete once verified.`,
  },
  OVERDUE: {
    title: 'Overdue Reminder: Action Required',
    priority: 'URGENT',
    notificationType: NotificationType.REMINDER_DUE,
    getMessage: (title, dateStr) =>
      `Attention: Privacy deadline for "${title}" was due on ${dateStr} and remains incomplete. Immediate action recommended.`,
  },
  COMPLETED: {
    title: 'Reminder Completed',
    priority: 'LOW',
    notificationType: NotificationType.SYSTEM_NOTICE,
    getMessage: (title, dateStr) =>
      `Privacy reminder for "${title}" scheduled for ${dateStr} has been marked as completed. All future deadline alerts are dismissed.`,
  },
};

export class ReminderSchedulerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isProcessing = false;
  private static isProcessingEmails = false;

  /**
   * Calculates difference in integer calendar days between a reminder date and now (UTC based).
   * Positive = future, 0 = today, Negative = overdue.
   */
  static getDaysRemaining(reminderDate: Date, now: Date = new Date()): number {
    const remYear = reminderDate.getUTCFullYear();
    const remMonth = reminderDate.getUTCMonth();
    const remDay = reminderDate.getUTCDate();
    const remMidnight = Date.UTC(remYear, remMonth, remDay);

    const nowYear = now.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const nowDay = now.getUTCDate();
    const nowMidnight = Date.UTC(nowYear, nowMonth, nowDay);

    const diffMs = remMidnight - nowMidnight;
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  }

  /**
   * Builds the deduplication signature stored inside the notification message body.
   */
  static buildStageSignature(stage: ReminderAlertStage, reminderId: string): string {
    return `<!-- STAGE:${stage} | REMINDER:${reminderId}`;
  }

  /**
   * Formats the full notification message with user description, reminder title reference,
   * and hidden metadata comment for robust deduplication and UI parsing.
   */
  static buildMessage(
    stage: ReminderAlertStage,
    reminderId: string,
    reminderTitle: string,
    dueDateStr: string,
    priority: NotificationPriority,
    notes?: string | null
  ): string {
    const config = STAGE_CONFIGS[stage];
    const userText = config.getMessage(reminderTitle, dueDateStr, notes);
    const signature = `${this.buildStageSignature(stage, reminderId)} | PRIORITY:${priority} -->`;
    const refText = `\n\n[Related Reminder: ${reminderTitle} | ID: ${reminderId}]`;
    return `${userText}${refText}${signature}`;
  }

  /**
   * Checks whether a notification for this user, reminder, and stage already exists in the database.
   */
  static async hasNotificationForStage(
    userId: string,
    reminderId: string,
    stage: ReminderAlertStage
  ): Promise<boolean> {
    const signature = this.buildStageSignature(stage, reminderId);
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        message: {
          contains: signature,
        },
      },
    });
    return existing !== null;
  }

  /**
   * Queues an email delivery record with atomic database deduplication and user preference evaluation.
   */
  static async queueEmailDelivery(params: {
    userId: string;
    reminderId: string;
    notificationId?: string;
    stage: ReminderAlertStage;
    reminderTitle: string;
    reminderDescription?: string | null;
    dueDate: Date;
    notes?: string | null;
    priority?: NotificationPriority;
    daysRemaining?: number;
  }): Promise<EmailDelivery | null> {
    try {
      // 1. Evaluate user email preferences
      const shouldSend = await UserPreferenceService.shouldSendEmail(params.userId, params.stage);
      if (!shouldSend) {
        logger.info(
          `[ReminderScheduler] User ${params.userId} opted out of email for stage ${params.stage}`
        );
        return null;
      }

      // 2. Fetch user recipient email & name
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true, fullName: true },
      });

      if (!user || !user.email) {
        logger.warn(`[ReminderScheduler] Cannot queue email: User ${params.userId} not found or has no email`);
        return null;
      }

      // 3. Render email subject & content
      const dateStr = params.dueDate.toISOString().split('T')[0];
      const emailData = buildReminderEmail({
        userName: user.fullName || 'User',
        reminderTitle: params.reminderTitle,
        reminderDescription: params.reminderDescription,
        formattedDeadline: dateStr,
        stage: params.stage,
        priority: params.priority,
        daysRemaining: params.daysRemaining,
        customNotes: params.notes,
      });

      // 4. Atomic upsert to prevent duplicate email deliveries
      const delivery = await prisma.emailDelivery.upsert({
        where: {
          reminderId_notificationStage_recipientEmail: {
            reminderId: params.reminderId,
            notificationStage: params.stage,
            recipientEmail: user.email,
          },
        },
        create: {
          userId: params.userId,
          reminderId: params.reminderId,
          notificationId: params.notificationId,
          notificationStage: params.stage,
          recipientEmail: user.email,
          subject: emailData.subject,
          deliveryStatus: EmailDeliveryStatus.PENDING,
          metadata: {
            html: emailData.html,
            text: emailData.text,
          },
        },
        update: {
          // If already exists, do not re-trigger or overwrite sent state
        },
      });

      logger.info(
        `[ReminderScheduler] Queued ${params.stage} email delivery (${delivery.id}) for reminder ${params.reminderId} to ${user.email}`
      );

      return delivery;
    } catch (err: any) {
      logger.error(`[ReminderScheduler] Failed to queue email delivery for reminder ${params.reminderId}:`, err.message);
      return null;
    }
  }

  /**
   * Cancels any unsent pending email delivery jobs for a completed or deleted reminder.
   */
  static async cancelPendingEmailsForReminder(reminderId: string): Promise<number> {
    try {
      const result = await prisma.emailDelivery.updateMany({
        where: {
          reminderId,
          deliveryStatus: {
            in: [EmailDeliveryStatus.PENDING, EmailDeliveryStatus.SENDING],
          },
          // Do not cancel a completion confirmation email itself
          notificationStage: {
            not: 'COMPLETED',
          },
        },
        data: {
          deliveryStatus: EmailDeliveryStatus.CANCELLED,
          errorMessage: 'Reminder completed or deleted prior to email dispatch',
        },
      });

      if (result.count > 0) {
        logger.info(`[ReminderScheduler] Cancelled ${result.count} pending email(s) for reminder ${reminderId}`);
      }

      return result.count;
    } catch (err: any) {
      logger.error(`[ReminderScheduler] Failed to cancel pending emails for reminder ${reminderId}:`, err.message);
      return 0;
    }
  }

  /**
   * Background processor for pending transactional email delivery queue.
   */
  static async processPendingEmailDeliveries(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    if (this.isProcessingEmails) {
      // If another process is currently dispatching, wait briefly (up to 1s) for it to complete
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (!this.isProcessingEmails) break;
      }
      if (this.isProcessingEmails) {
        return { processed: 0, sent: 0, failed: 0, skipped: 0 };
      }
    }

    this.isProcessingEmails = true;
    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // Find up to 10 PENDING email jobs ready for dispatch
      const pendingJobs = await prisma.emailDelivery.findMany({
        where: {
          deliveryStatus: EmailDeliveryStatus.PENDING,
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } },
          ],
        },
        take: 10,
        include: {
          reminder: {
            select: {
              reminderStatus: true,
              reminderDate: true,
            },
          },
        },
      });

      for (const job of pendingJobs) {
        processed++;

        // Guard: If reminder is already COMPLETED and this is an alert stage, cancel it
        if (
          job.reminder &&
          job.reminder.reminderStatus === ReminderStatus.COMPLETED &&
          job.notificationStage !== 'COMPLETED'
        ) {
          await prisma.emailDelivery.update({
            where: { id: job.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.CANCELLED,
              errorMessage: 'Cancelled: Parent reminder was completed',
            },
          });
          skipped++;
          continue;
        }

        // Atomically claim the job to prevent duplicate delivery by concurrent processes
        const claimResult = await prisma.emailDelivery.updateMany({
          where: {
            id: job.id,
            deliveryStatus: EmailDeliveryStatus.PENDING,
          },
          data: {
            deliveryStatus: EmailDeliveryStatus.SENDING,
            lastAttemptAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });

        if (claimResult.count === 0) {
          skipped++;
          continue; // Job was already claimed by another concurrent worker
        }

        // Extract or regenerate HTML content
        const meta = job.metadata as any;
        const html = meta?.html || `<p>${job.subject}</p>`;
        const text = meta?.text || job.subject;

        // Dispatch via EmailService
        const result = await EmailService.sendEmail({
          to: job.recipientEmail,
          subject: job.subject,
          html,
          text,
        });

        if (result.success) {
          await prisma.emailDelivery.update({
            where: { id: job.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.SENT,
              resendEmailId: result.resendEmailId,
              sentAt: new Date(),
              errorMessage: null,
            },
          });
          sent++;
        } else {
          failed++;
          const newAttemptCount = job.attemptCount + 1;
          const maxRetries = 5;

          if (result.isQuotaExceeded) {
            // Resend daily sending limit / quota exceeded:
            // Immediately store as FAILED with friendly message and quota telemetry metadata.
            // Do not waste rapid backoff attempts; record for safe retry when quota restores.
            await prisma.emailDelivery.update({
              where: { id: job.id },
              data: {
                deliveryStatus: EmailDeliveryStatus.FAILED,
                failedAt: new Date(),
                errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
                metadata: {
                  ...(typeof job.metadata === 'object' && job.metadata ? (job.metadata as any) : {}),
                  quotaExceeded: true,
                  retryEligible: true,
                  failedAt: new Date().toISOString(),
                  providerError: EmailService.sanitizeErrorMessage(result.error || 'Resend quota exceeded'),
                },
              },
            });
            logger.warn(
              `[ReminderScheduler] Delivery ${job.id} to ${job.recipientEmail} marked as FAILED due to Resend quota limit: ${RESEND_QUOTA_EXCEEDED_MESSAGE}`
            );
          } else if (result.isRetryable && newAttemptCount < maxRetries) {
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s (capped at 1 hour)
            const backoffMs = Math.min(1000 * Math.pow(2, newAttemptCount), 3600000);
            await prisma.emailDelivery.update({
              where: { id: job.id },
              data: {
                deliveryStatus: EmailDeliveryStatus.PENDING,
                nextRetryAt: new Date(Date.now() + backoffMs),
                errorMessage: result.error || 'Temporary delivery failure; queued for retry',
              },
            });
            logger.warn(
              `[ReminderScheduler] Retryable failure for job ${job.id} (attempt ${newAttemptCount}/${maxRetries}): ${result.error}. Next retry in ${backoffMs / 1000}s`
            );
          } else {
            // Permanent failure or retry limit exhausted
            await prisma.emailDelivery.update({
              where: { id: job.id },
              data: {
                deliveryStatus: EmailDeliveryStatus.FAILED,
                failedAt: new Date(),
                errorMessage: result.error || 'Email dispatch failed permanently',
              },
            });
            logger.error(`[ReminderScheduler] Permanent failure for job ${job.id}: ${result.error}`);
          }
        }
      }
    } catch (err: any) {
      logger.error('[ReminderScheduler] Error processing pending email queue:', err.message);
    } finally {
      this.isProcessingEmails = false;
    }

    return { processed, sent, failed, skipped };
  }

  /**
   * Safely retries email deliveries that previously failed due to Resend quota exhaustion.
   *
   * Safeguards:
   * - Atomic concurrency lock: transitions FAILED -> SENDING atomically via updateMany.
   * - Idempotency guarantee: never retries an email that already has a resendEmailId or is already sent.
   * - Status transition safety: successful dispatch transitions status strictly to SENT, never DELIVERED directly.
   * - Provider error isolation: if quota is still exhausted, preserves status as FAILED with user-friendly message.
   */
  static async retryFailedQuotaDeliveries(options: {
    userId?: string;
    deliveryId?: string;
    limit?: number;
  } = {}): Promise<{
    eligible: number;
    retried: number;
    succeeded: number;
    failed: number;
    stillQuotaExceeded: boolean;
  }> {
    const limit = options.limit || 50;

    // Identify failed delivery records that encountered sending limits
    const where: any = {
      deliveryStatus: EmailDeliveryStatus.FAILED,
      OR: [
        { errorMessage: { contains: 'sending limit' } },
        { errorMessage: { contains: 'temporarily unavailable' } },
        { errorMessage: { contains: 'quota' } },
      ],
    };

    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.deliveryId) {
      where.id = options.deliveryId;
    }

    const eligibleRecords = await prisma.emailDelivery.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const results = {
      eligible: eligibleRecords.length,
      retried: 0,
      succeeded: 0,
      failed: 0,
      stillQuotaExceeded: false,
    };

    for (const record of eligibleRecords) {
      // 1. Idempotency guard: If resendEmailId already exists, do not dispatch again
      if (record.resendEmailId) {
        logger.warn(
          `[ReminderScheduler] Skipping retry for delivery ${record.id}: already has Resend ID ${record.resendEmailId}`
        );
        continue;
      }

      // 2. Concurrency claim: Atomically transition status from FAILED -> SENDING
      const claimResult = await prisma.emailDelivery.updateMany({
        where: {
          id: record.id,
          deliveryStatus: EmailDeliveryStatus.FAILED,
        },
        data: {
          deliveryStatus: EmailDeliveryStatus.SENDING,
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        // Concurrently claimed by another worker or status changed
        continue;
      }

      results.retried++;

      const meta = (record.metadata || {}) as any;
      const html = meta.html || `<p>${record.subject}</p>`;
      const text = meta.text || record.subject;

      // 3. Dispatch to Resend via EmailService
      const sendResult = await EmailService.sendEmail({
        to: record.recipientEmail,
        subject: record.subject,
        html,
        text,
      });

      if (sendResult.success) {
        // Resend accepted email: transition to SENT (never DELIVERED directly)
        await prisma.emailDelivery.update({
          where: { id: record.id },
          data: {
            deliveryStatus: EmailDeliveryStatus.SENT,
            resendEmailId: sendResult.resendEmailId,
            sentAt: new Date(),
            errorMessage: null,
            metadata: {
              ...meta,
              retriedAt: new Date().toISOString(),
              retrySucceeded: true,
              quotaExceeded: false,
            },
          },
        });
        results.succeeded++;
        logger.info(
          `[ReminderScheduler] Successfully retried delivery ${record.id} (Resend ID: ${sendResult.resendEmailId})`
        );
      } else {
        results.failed++;
        if (sendResult.isQuotaExceeded) {
          results.stillQuotaExceeded = true;
          await prisma.emailDelivery.update({
            where: { id: record.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.FAILED,
              failedAt: new Date(),
              errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
              metadata: {
                ...meta,
                quotaExceeded: true,
                retryEligible: true,
                lastRetryFailedAt: new Date().toISOString(),
                providerError: EmailService.sanitizeErrorMessage(sendResult.error || 'Resend quota exceeded'),
              },
            },
          });
          logger.warn(
            `[ReminderScheduler] Retry for delivery ${record.id} failed: daily sending limit is still active. Pausing further batch retries.`
          );
          // Break batch to avoid spamming the provider while quota remains exhausted
          break;
        } else {
          await prisma.emailDelivery.update({
            where: { id: record.id },
            data: {
              deliveryStatus: EmailDeliveryStatus.FAILED,
              failedAt: new Date(),
              errorMessage: EmailService.sanitizeErrorMessage(sendResult.error || 'Email dispatch failed'),
              metadata: {
                ...meta,
                lastRetryFailedAt: new Date().toISOString(),
              },
            },
          });
          logger.error(`[ReminderScheduler] Retry for delivery ${record.id} failed: ${sendResult.error}`);
        }
      }
    }

    return results;
  }

  /**
   * Dispatches a notification confirming successful creation of a reminder.
   */
  static async sendReminderScheduledNotification(
    userId: string,
    reminder: { id: string; reminderDate: Date },
    reminderTitle: string,
    notes?: string | null
  ): Promise<void> {
    try {
      const stage: ReminderAlertStage = 'SCHEDULED';
      const exists = await this.hasNotificationForStage(userId, reminder.id, stage);
      if (exists) return;

      const dateStr = reminder.reminderDate.toISOString().split('T')[0];
      const config = STAGE_CONFIGS[stage];
      const message = this.buildMessage(
        stage,
        reminder.id,
        reminderTitle,
        dateStr,
        config.priority,
        notes
      );

      const notif = await prisma.notification.create({
        data: {
          userId,
          title: `Reminder Scheduled: ${reminderTitle}`,
          message,
          notificationType: config.notificationType,
          isRead: false,
        },
      });

      // Queue and attempt asynchronous transactional email delivery
      await this.queueEmailDelivery({
        userId,
        reminderId: reminder.id,
        notificationId: notif.id,
        stage,
        reminderTitle,
        dueDate: reminder.reminderDate,
        notes,
        priority: config.priority,
      });

      // Also immediately check if the newly created reminder falls into any approaching window
      await this.checkAndGenerateStageNotification(
        {
          id: reminder.id,
          userId,
          reminderDate: reminder.reminderDate,
          title: reminderTitle,
          notes,
        },
        new Date()
      );

      // Dispatch pending transactional emails
      await this.processPendingEmailDeliveries();
    } catch (err: any) {
      logger.error('Failed to create reminder scheduled notification:', err.message);
    }
  }

  /**
   * Dispatches a notification confirming completion of a reminder.
   */
  static async sendReminderCompletedNotification(
    userId: string,
    reminder: { id: string; reminderDate: Date },
    reminderTitle: string
  ): Promise<void> {
    try {
      // 1. Cancel any unsent pending alerts for this reminder
      await this.cancelPendingEmailsForReminder(reminder.id);

      const stage: ReminderAlertStage = 'COMPLETED';
      const exists = await this.hasNotificationForStage(userId, reminder.id, stage);
      if (exists) return;

      const dateStr = reminder.reminderDate.toISOString().split('T')[0];
      const config = STAGE_CONFIGS[stage];
      const message = this.buildMessage(
        stage,
        reminder.id,
        reminderTitle,
        dateStr,
        config.priority
      );

      const notif = await prisma.notification.create({
        data: {
          userId,
          title: `Reminder Completed: ${reminderTitle}`,
          message,
          notificationType: config.notificationType,
          isRead: false,
        },
      });

      // Queue completion confirmation email
      await this.queueEmailDelivery({
        userId,
        reminderId: reminder.id,
        notificationId: notif.id,
        stage,
        reminderTitle,
        dueDate: reminder.reminderDate,
        priority: config.priority,
      });

      // Dispatch completion email
      await this.processPendingEmailDeliveries();
    } catch (err: any) {
      logger.error('Failed to create reminder completed notification:', err.message);
    }
  }

  /**
   * Evaluates a single pending reminder against current/simulated time and generates the appropriate stage alert.
   */
  static async checkAndGenerateStageNotification(
    reminder: {
      id: string;
      userId: string;
      reminderDate: Date;
      title?: string;
      notes?: string | null;
      exposureRecord?: { purpose?: string; notes?: string | null } | null;
    },
    now: Date = new Date()
  ): Promise<boolean> {
    const days = this.getDaysRemaining(reminder.reminderDate, now);
    let targetStage: ReminderAlertStage | null = null;

    if (days < 0) {
      targetStage = 'OVERDUE';
    } else if (days === 0) {
      targetStage = 'DUE_TODAY';
    } else if (days === 1) {
      targetStage = '1_DAY_BEFORE';
    } else if (days > 1 && days <= 3) {
      targetStage = '3_DAYS_BEFORE';
    } else if (days > 3 && days <= 7) {
      targetStage = '7_DAYS_BEFORE';
    }

    if (!targetStage) {
      return false; // Beyond 7 days, no immediate notification required
    }

    const alreadyGenerated = await this.hasNotificationForStage(
      reminder.userId,
      reminder.id,
      targetStage
    );

    if (alreadyGenerated) {
      return false; // Prevent duplicate notifications
    }

    const title =
      reminder.title ||
      reminder.exposureRecord?.purpose ||
      'Privacy Review';
    const notes = reminder.notes || reminder.exposureRecord?.notes;
    const dateStr = reminder.reminderDate.toISOString().split('T')[0];
    const config = STAGE_CONFIGS[targetStage];

    const message = this.buildMessage(
      targetStage,
      reminder.id,
      title,
      dateStr,
      config.priority,
      notes
    );

    const notif = await prisma.notification.create({
      data: {
        userId: reminder.userId,
        title: config.title,
        message,
        notificationType: config.notificationType,
        isRead: false,
      },
    });

    logger.info(
      `[ReminderScheduler] Generated ${targetStage} notification (${notif.id}) for reminder ${reminder.id} (User: ${reminder.userId})`
    );

    // Queue corresponding email delivery job
    await this.queueEmailDelivery({
      userId: reminder.userId,
      reminderId: reminder.id,
      notificationId: notif.id,
      stage: targetStage,
      reminderTitle: title,
      reminderDescription: reminder.exposureRecord?.purpose,
      dueDate: reminder.reminderDate,
      notes,
      priority: config.priority,
      daysRemaining: days,
    });

    return true;
  }

  /**
   * Main scheduler execution loop: queries all PENDING reminders across the platform,
   * calculates days remaining, generates non-duplicate notifications, and processes email jobs.
   * Can accept a custom targetDate for controlled time simulation in tests.
   */
  static async processReminders(
    targetDate: Date = new Date()
  ): Promise<{ checkedCount: number; generatedCount: number; skippedCount: number }> {
    if (this.isProcessing) {
      logger.warn('[ReminderScheduler] Previous scan still in progress, skipping cycle');
      return { checkedCount: 0, generatedCount: 0, skippedCount: 0 };
    }

    this.isProcessing = true;
    let checkedCount = 0;
    let generatedCount = 0;
    let skippedCount = 0;

    try {
      // Find all PENDING reminders across all tenants
      const pendingReminders = await prisma.reminder.findMany({
        where: { reminderStatus: ReminderStatus.PENDING },
        include: {
          exposureRecord: {
            select: { purpose: true, notes: true },
          },
        },
      });

      checkedCount = pendingReminders.length;

      for (const rem of pendingReminders) {
        const title = rem.exposureRecord?.purpose || rem.reminderType.replace(/_/g, ' ');
        const notes = rem.exposureRecord?.notes;

        const generated = await this.checkAndGenerateStageNotification(
          {
            id: rem.id,
            userId: rem.userId,
            reminderDate: rem.reminderDate,
            title,
            notes,
          },
          targetDate
        );

        if (generated) {
          generatedCount++;
        } else {
          skippedCount++;
        }
      }

      logger.info(
        `[ReminderScheduler] Scan complete at ${targetDate.toISOString()}: ${checkedCount} checked, ${generatedCount} generated, ${skippedCount} skipped/active`
      );

      // Process any pending email deliveries queued in this pass
      await this.processPendingEmailDeliveries();

      // Automatically retry eligible quota-failed deliveries if daily limit has refreshed
      await this.retryFailedQuotaDeliveries({ limit: 10 });
    } catch (err: any) {
      logger.error('[ReminderScheduler] Error during reminder scan:', err.message);
    } finally {
      this.isProcessing = false;
    }

    return { checkedCount, generatedCount, skippedCount };
  }

  /**
   * Starts background recurring scheduler timer.
   * Defaults to 15-minute intervals.
   */
  static start(intervalMs: number = 15 * 60 * 1000): void {
    if (this.timer) {
      logger.info('[ReminderScheduler] Scheduler already running');
      return;
    }

    logger.info(`[ReminderScheduler] Starting background scheduler (interval: ${intervalMs / 1000}s)`);

    // Execute first scan immediately (non-blocking)
    this.processReminders().catch((err) =>
      logger.error('[ReminderScheduler] Initial scan error:', err.message)
    );

    // Schedule periodic execution
    this.timer = setInterval(() => {
      this.processReminders().catch((err) =>
        logger.error('[ReminderScheduler] Scheduled scan error:', err.message)
      );
    }, intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stops background scheduler cleanly.
   */
  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[ReminderScheduler] Scheduler stopped');
    }
  }
}
