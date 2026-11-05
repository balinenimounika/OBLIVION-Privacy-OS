/**
 * OBLIVION - User Notification & Email Preference Service
 *
 * Manages user-configurable notification settings, stage-level email toggles,
 * removal request alert preferences, and overdue follow-up rules with strict tenant isolation.
 */

import { OverdueFrequency, UserNotificationPreference } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ReminderAlertStage } from './reminder-scheduler.service';
import { logger } from '../utils/logger';

export interface UpdateUserPreferenceDTO {
  emailNotificationsEnabled?: boolean;
  notifyOnCreated?: boolean;
  notify7DaysBefore?: boolean;
  notify3DaysBefore?: boolean;
  notify1DayBefore?: boolean;
  notifyDueToday?: boolean;
  notifyOverdue?: boolean;
  notifyCompleted?: boolean;
  notifyRemovalUpdates?: boolean;
  notifyAccountSecurity?: boolean;
  overdueFrequency?: OverdueFrequency;
}

export class UserPreferenceService {
  /**
   * Retrieves or initializes default notification preferences for the user.
   */
  static async getPreferences(userId: string): Promise<UserNotificationPreference> {
    let pref = await prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await prisma.userNotificationPreference.create({
        data: {
          userId,
          emailNotificationsEnabled: true,
          notifyOnCreated: true,
          notify7DaysBefore: true,
          notify3DaysBefore: true,
          notify1DayBefore: true,
          notifyDueToday: true,
          notifyOverdue: true,
          notifyCompleted: true,
          notifyRemovalUpdates: true,
          notifyAccountSecurity: true,
          welcomeEmailSent: false,
          overdueFrequency: OverdueFrequency.DAILY,
        },
      });
    }

    return pref;
  }

  /**
   * Updates notification preferences for the authenticated user.
   * Essential account security notifications cannot be disabled.
   */
  static async updatePreferences(
    userId: string,
    data: UpdateUserPreferenceDTO
  ): Promise<UserNotificationPreference> {
    return prisma.userNotificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailNotificationsEnabled: data.emailNotificationsEnabled ?? true,
        notifyOnCreated: data.notifyOnCreated ?? true,
        notify7DaysBefore: data.notify7DaysBefore ?? true,
        notify3DaysBefore: data.notify3DaysBefore ?? true,
        notify1DayBefore: data.notify1DayBefore ?? true,
        notifyDueToday: data.notifyDueToday ?? true,
        notifyOverdue: data.notifyOverdue ?? true,
        notifyCompleted: data.notifyCompleted ?? true,
        notifyRemovalUpdates: data.notifyRemovalUpdates ?? true,
        notifyAccountSecurity: true, // Always true - security invariant
        welcomeEmailSent: false,
        overdueFrequency: data.overdueFrequency ?? OverdueFrequency.DAILY,
      },
      update: {
        ...(data.emailNotificationsEnabled !== undefined
          ? { emailNotificationsEnabled: data.emailNotificationsEnabled }
          : {}),
        ...(data.notifyOnCreated !== undefined ? { notifyOnCreated: data.notifyOnCreated } : {}),
        ...(data.notify7DaysBefore !== undefined ? { notify7DaysBefore: data.notify7DaysBefore } : {}),
        ...(data.notify3DaysBefore !== undefined ? { notify3DaysBefore: data.notify3DaysBefore } : {}),
        ...(data.notify1DayBefore !== undefined ? { notify1DayBefore: data.notify1DayBefore } : {}),
        ...(data.notifyDueToday !== undefined ? { notifyDueToday: data.notifyDueToday } : {}),
        ...(data.notifyOverdue !== undefined ? { notifyOverdue: data.notifyOverdue } : {}),
        ...(data.notifyCompleted !== undefined ? { notifyCompleted: data.notifyCompleted } : {}),
        ...(data.notifyRemovalUpdates !== undefined ? { notifyRemovalUpdates: data.notifyRemovalUpdates } : {}),
        // notifyAccountSecurity is permanently locked to true
        notifyAccountSecurity: true,
        ...(data.overdueFrequency !== undefined ? { overdueFrequency: data.overdueFrequency } : {}),
      },
    });
  }

  /**
   * Evaluates user preferences to determine if an email should be queued for a specific stage.
   */
  static async shouldSendEmail(
    userId: string,
    stage: ReminderAlertStage | 'SECURITY_ALERT' | 'REMOVAL_UPDATE' | 'WELCOME'
  ): Promise<boolean> {
    try {
      // Security notifications are mandatory and cannot be disabled under any configuration
      if (stage === 'SECURITY_ALERT') {
        return true;
      }

      // Welcome emails are one-time onboarding notices
      if (stage === 'WELCOME') {
        return true;
      }

      const pref = await this.getPreferences(userId);
      if (!pref.emailNotificationsEnabled) {
        return false;
      }

      switch (stage) {
        case 'SCHEDULED':
          return pref.notifyOnCreated;
        case '7_DAYS_BEFORE':
          return pref.notify7DaysBefore;
        case '3_DAYS_BEFORE':
          return pref.notify3DaysBefore;
        case '1_DAY_BEFORE':
          return pref.notify1DayBefore;
        case 'DUE_TODAY':
          return pref.notifyDueToday;
        case 'OVERDUE':
          return pref.notifyOverdue && pref.overdueFrequency !== OverdueFrequency.NONE;
        case 'COMPLETED':
          return pref.notifyCompleted;
        case 'REMOVAL_UPDATE':
          return pref.notifyRemovalUpdates;
        default:
          return true;
      }
    } catch (err: any) {
      logger.error(`[UserPreferenceService] Failed to load preferences for user ${userId}:`, err.message);
      return true; // Default to safe delivery on error
    }
  }
}
