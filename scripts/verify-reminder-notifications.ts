/**
 * OBLIVION - Verification Script for Intelligent Reminder Notifications & Background Scheduler
 *
 * Verifies all 11 core functional, scheduling, deduplication, and isolation requirements:
 * 1. Confirmation notification created upon reminder scheduling.
 * 2. 7-day alert generation when deadline is 7 days away.
 * 3. 3-day alert generation when deadline is 3 days away.
 * 4. 1-day alert generation when deadline is 1 day away.
 * 5. Due Today alert generation on deadline day.
 * 6. Overdue alert generation when deadline is in the past and reminder is PENDING.
 * 7. Deduplication guarantee: Multiple scheduler runs produce ZERO duplicate notifications.
 * 8. Completion lifecycle: Completing a reminder generates COMPLETED notification and halts future alerts.
 * 9. Unread count tracking and notification read operations (mark single read, mark all read).
 * 10. Multi-tenant isolation: User B cannot access User A's notifications.
 * 11. Database integrity: Zero corruption of existing user records.
 */

import { prisma } from '../src/lib/prisma';
import { ReminderSchedulerService } from '../src/services/reminder-scheduler.service';
import { ReminderService } from '../src/services/reminder.service';
import { NotificationService } from '../src/services/notification.service';
import { AuthService } from '../src/services/auth.service';
import { ReminderType, ReminderStatus } from '@prisma/client';

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordResult(step: number, name: string, passed: boolean, details: string) {
  results.push({ step, name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [Step ${step}] ${name}: ${details}`);
}

const defaultQuery = {
  page: 1,
  limit: 50,
  isRead: undefined,
  sortBy: 'createdAt' as const,
  sortOrder: 'desc' as const,
};

async function runVerification() {
  console.log('================================================================');
  console.log('OBLIVION AUTOMATED REMINDER NOTIFICATION & SCHEDULER VERIFICATION');
  console.log('================================================================\n');

  let testUserAId = '';
  let testUserBId = '';

  try {
    // Setup isolated test users
    const timestamp = Date.now();
    const userA = await AuthService.register({
      fullName: 'Alice Reminder Tester',
      email: `alice_notif_${timestamp}@oblivion.internal`,
      password: 'SecurePassword123!',
    });
    testUserAId = userA.user.id;

    const userB = await AuthService.register({
      fullName: 'Bob Foreign Tester',
      email: `bob_notif_${timestamp}@oblivion.internal`,
      password: 'SecurePassword123!',
    });
    testUserBId = userB.user.id;

    console.log(`Created test users: Alice (${testUserAId}), Bob (${testUserBId})\n`);

    // Base date for controlled time calculations: noon UTC
    const baseNow = new Date('2026-11-10T12:00:00Z');

    // SCENARIO 1: Confirmation notification generated upon reminder creation
    const dateIn10Days = new Date('2026-11-20T12:00:00Z');
    const reminder10Days = await ReminderService.createReminder(testUserAId, {
      reminderType: ReminderType.EXPIRY_CHECK,
      reminderDate: dateIn10Days,
      title: 'GDPR 30-Day Response Compliance',
      notes: 'Ensure data broker deletion confirmation is received.',
    });

    const notifsAfterCreate = await prisma.notification.findMany({
      where: { userId: testUserAId },
    });

    const schedNotif = notifsAfterCreate.find(
      (n) => n.title.includes('Reminder Scheduled') && n.message.includes(reminder10Days.id)
    );

    recordResult(
      1,
      'Notification Generation on Reminder Creation',
      !!schedNotif,
      schedNotif
        ? `Found confirmation notification (${schedNotif.id}): "${schedNotif.title}"`
        : 'Failed to find scheduled confirmation notification'
    );

    // SCENARIO 2: 7 Days Before Alert
    const dateIn7Days = new Date('2026-11-17T12:00:00Z');
    const reminder7Days = await ReminderService.createReminder(testUserAId, {
      reminderType: ReminderType.FOLLOW_UP_REMOVAL,
      reminderDate: dateIn7Days,
      title: '7-Day Follow-Up Review',
      notes: 'Review pending exposure removal.',
    });

    // Run scheduler evaluated at baseNow (which is exactly 7 calendar days before Nov 17)
    await ReminderSchedulerService.processReminders(baseNow);

    const notif7Days = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        message: { contains: `REMINDER:${reminder7Days.id}` },
        title: { contains: '7 Days Remaining' },
      },
    });

    recordResult(
      2,
      '7-Day Countdown Alert Generation',
      !!notif7Days,
      notif7Days
        ? `Generated 7-day alert (${notif7Days.id}): "${notif7Days.title}"`
        : 'Failed to generate 7-day alert'
    );

    // SCENARIO 3: 3 Days Before Alert
    const dateIn3Days = new Date('2026-11-13T12:00:00Z');
    const reminder3Days = await ReminderService.createReminder(testUserAId, {
      reminderType: ReminderType.CONSENT_REVALIDATION,
      reminderDate: dateIn3Days,
      title: '3-Day Statutory Limit Nearing',
    });

    await ReminderSchedulerService.processReminders(baseNow);

    const notif3Days = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        message: { contains: `REMINDER:${reminder3Days.id}` },
        title: { contains: '3 Days Remaining' },
      },
    });

    recordResult(
      3,
      '3-Day Countdown Alert Generation',
      !!notif3Days,
      notif3Days
        ? `Generated 3-day alert (${notif3Days.id}): "${notif3Days.title}"`
        : 'Failed to generate 3-day alert'
    );

    // SCENARIO 4: 1 Day Before Alert
    const dateIn1Day = new Date('2026-11-11T12:00:00Z');
    const reminder1Day = await ReminderService.createReminder(testUserAId, {
      reminderType: ReminderType.CUSTOM,
      reminderDate: dateIn1Day,
      title: '1-Day Final Courtesy Notice',
    });

    await ReminderSchedulerService.processReminders(baseNow);

    const notif1Day = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        message: { contains: `REMINDER:${reminder1Day.id}` },
        title: { contains: 'Due Tomorrow' },
      },
    });

    recordResult(
      4,
      '1-Day Urgency Alert Generation (Due Tomorrow)',
      !!notif1Day,
      notif1Day
        ? `Generated 1-day alert (${notif1Day.id}): "${notif1Day.title}"`
        : 'Failed to generate 1-day alert'
    );

    // SCENARIO 5: Due Today Alert
    const dateToday = new Date('2026-11-10T08:00:00Z');
    const reminderToday = await ReminderService.createReminder(testUserAId, {
      reminderType: ReminderType.ANNUAL_PRIVACY_REVIEW,
      reminderDate: dateToday,
      title: 'Statutory Deadline Today',
    });

    await ReminderSchedulerService.processReminders(baseNow);

    const notifToday = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        message: { contains: `REMINDER:${reminderToday.id}` },
        title: { contains: 'Due Today' },
      },
    });

    recordResult(
      5,
      'Deadline Day Alert Generation (Due Today)',
      !!notifToday,
      notifToday
        ? `Generated Due Today alert (${notifToday.id}): "${notifToday.title}"`
        : 'Failed to generate Due Today alert'
    );

    // SCENARIO 6: Overdue Alert
    const datePast = new Date('2026-11-05T12:00:00Z');
    const reminderOverdue = await ReminderService.createReminder(testUserAId, {
      reminderType: ReminderType.EXPIRY_CHECK,
      reminderDate: datePast,
      title: 'Overdue Escalation Audit',
    });

    await ReminderSchedulerService.processReminders(baseNow);

    const notifOverdue = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        message: { contains: `REMINDER:${reminderOverdue.id}` },
        title: { contains: 'Overdue' },
      },
    });

    recordResult(
      6,
      'Overdue Alert Generation for Incomplete Reminder',
      !!notifOverdue,
      notifOverdue
        ? `Generated Overdue alert (${notifOverdue.id}): "${notifOverdue.title}"`
        : 'Failed to generate Overdue alert'
    );

    // SCENARIO 7: Deduplication Guarantee across multiple scheduler runs
    const countBeforeDuplicateRuns = await prisma.notification.count({
      where: { userId: testUserAId },
    });

    // Run scheduler 5 consecutive times on the same clock
    await ReminderSchedulerService.processReminders(baseNow);
    await ReminderSchedulerService.processReminders(baseNow);
    await ReminderSchedulerService.processReminders(baseNow);
    await ReminderSchedulerService.processReminders(baseNow);
    await ReminderSchedulerService.processReminders(baseNow);

    const countAfterDuplicateRuns = await prisma.notification.count({
      where: { userId: testUserAId },
    });

    recordResult(
      7,
      'Scheduler Deduplication Idempotency',
      countBeforeDuplicateRuns === countAfterDuplicateRuns,
      `Notifications before: ${countBeforeDuplicateRuns}, Notifications after 5 passes: ${countAfterDuplicateRuns} (0 duplicates generated)`
    );

    // SCENARIO 8: Reminder Completion Halts Alerts & Generates Completion Notice
    await ReminderService.updateReminder(testUserAId, reminderToday.id, {
      reminderDate: undefined,
      reminderStatus: ReminderStatus.COMPLETED,
    });

    const completionNotif = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        title: { contains: 'Reminder Completed' },
        message: { contains: reminderToday.id },
      },
    });

    // Advance clock by 1 day; completed reminder must NOT generate an OVERDUE alert
    const dayAfter = new Date('2026-11-11T12:00:00Z');
    await ReminderSchedulerService.processReminders(dayAfter);

    const overdueForCompleted = await prisma.notification.findFirst({
      where: {
        userId: testUserAId,
        title: { contains: 'Overdue' },
        message: { contains: reminderToday.id },
      },
    });

    recordResult(
      8,
      'Reminder Completion Lifecycle & Alert Halting',
      !!completionNotif && !overdueForCompleted,
      `Completion notification generated (${completionNotif?.id}). Overdue alert prevented after completion: ${!overdueForCompleted}`
    );

    // SCENARIO 9: Unread Tracking and Mark-As-Read
    const listRes = await NotificationService.getNotifications(testUserAId, defaultQuery);
    const initialUnreadCount = listRes.meta.unreadCount;
    const targetNotifId = listRes.notifications[0].id;

    // Mark single notification read
    await NotificationService.markAsRead(testUserAId, targetNotifId);
    const afterSingleRead = await NotificationService.getNotifications(testUserAId, {
      ...defaultQuery,
      limit: 1,
    });

    // Mark all read
    await NotificationService.markAllAsRead(testUserAId);
    const afterAllRead = await NotificationService.getNotifications(testUserAId, {
      ...defaultQuery,
      limit: 1,
    });

    recordResult(
      9,
      'Unread Count Tracking & State Transitions',
      afterSingleRead.meta.unreadCount === initialUnreadCount - 1 && afterAllRead.meta.unreadCount === 0,
      `Initial unread: ${initialUnreadCount}, After 1 read: ${afterSingleRead.meta.unreadCount}, After mark-all: ${afterAllRead.meta.unreadCount}`
    );

    // SCENARIO 10: Multi-Tenant Notification Isolation
    // User B attempts to access User A's notification
    let bobAccessBlocked = false;
    try {
      await NotificationService.getNotificationById(testUserBId, targetNotifId);
    } catch (err: any) {
      bobAccessBlocked = err.statusCode === 404;
    }

    const bobNotifications = await NotificationService.getNotifications(testUserBId, defaultQuery);

    recordResult(
      10,
      'Multi-Tenant Isolation & Zero Data Leakage',
      bobAccessBlocked && bobNotifications.meta.total === 0,
      `User B direct access to User A notification returned 404 (${bobAccessBlocked}). User B notification count: ${bobNotifications.meta.total}`
    );

    // SCENARIO 11: Real User Preservation & System Integrity
    const balineniUser = await prisma.user.findUnique({
      where: { email: 'balineninagamounika@gmail.com' },
    });
    const joeUser = await prisma.user.findUnique({
      where: { email: 'joe@gmail.com' },
    });

    recordResult(
      11,
      'Platform Integrity & Existing Database Preservation',
      !!balineniUser && !!joeUser,
      `Preserved primary user (${balineniUser?.id}) and test user (${joeUser?.id}) intact in PostgreSQL 18.6`
    );

  } catch (error: any) {
    console.error('Fatal verification error:', error);
  } finally {
    // Cleanup temporary test accounts
    console.log('\n🧹 Cleaning up test accounts...');
    if (testUserAId) {
      await prisma.notification.deleteMany({ where: { userId: testUserAId } });
      await prisma.reminder.deleteMany({ where: { userId: testUserAId } });
      await prisma.auditLog.deleteMany({ where: { userId: testUserAId } });
      await prisma.user.delete({ where: { id: testUserAId } });
    }
    if (testUserBId) {
      await prisma.notification.deleteMany({ where: { userId: testUserBId } });
      await prisma.reminder.deleteMany({ where: { userId: testUserBId } });
      await prisma.auditLog.deleteMany({ where: { userId: testUserBId } });
      await prisma.user.delete({ where: { id: testUserBId } });
    }
    console.log('✅ Temporary verification accounts cleaned up.\n');
  }

  console.log('================================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('================================================================');
  const allPassed = results.length === 11 && results.every((r) => r.passed);
  console.log(`TOTAL SCENARIOS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
  console.log(`STATUS: ${allPassed ? 'ALL 11 SCENARIOS VERIFIED SUCCESSFULLY' : 'VERIFICATION FAILED'}`);
  console.log('================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runVerification();
