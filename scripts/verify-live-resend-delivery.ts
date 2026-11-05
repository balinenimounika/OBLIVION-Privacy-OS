/**
 * OBLIVION - Step 5 Live Resend Delivery Verification Script
 *
 * Verifies live Resend API integration in development test mode:
 * 1. Validates test mode environment configuration (EMAIL_TEST_MODE=true, RESEND_TEST_TO=delivered@resend.dev)
 * 2. Renders authentic transactional email using OBLIVION responsive HTML templates
 * 3. Confirms safe recipient redirection (original user email -> delivered@resend.dev)
 * 4. Calls live Resend API without mock interceptor (Direct transactional send)
 * 5. Verifies transactional email queue & database worker processing (End-to-End Workflow)
 * 6. Confirms original user email is preserved in database while delivery went to test sink
 * 7. Verifies Resend API response IDs and delivery status
 * 8. Cleans up ephemeral test data from database and verifies database integrity
 */

import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';
import { EmailService } from '../src/services/email.service';
import { AuthService } from '../src/services/auth.service';
import { ReminderService } from '../src/services/reminder.service';
import { ReminderSchedulerService } from '../src/services/reminder-scheduler.service';
import { buildReminderEmail } from '../src/templates/email-templates';
import { EmailDeliveryStatus, ReminderType } from '@prisma/client';

interface VerificationCheck {
  section: string;
  description: string;
  passed: boolean;
  details: string;
}

const checks: VerificationCheck[] = [];

function recordCheck(section: string, description: string, passed: boolean, details: string) {
  checks.push({ section, description, passed, details });
  const icon = passed ? '✅ [PASSED]' : '❌ [FAILED]';
  console.log(`${icon} [${section}] ${description}`);
  console.log(`   Details: ${details}\n`);
}

async function runStep5LiveVerification() {
  console.log('================================================================');
  console.log('OBLIVION STEP 5 – RESEND LIVE API DELIVERY VERIFICATION');
  console.log('================================================================\n');

  // Ensure mock sender is null so live Resend API is genuinely called
  EmailService.setMockSender(null);

  let initialUserCount = 0;
  let testUserId = '';

  try {
    initialUserCount = await prisma.user.count();
    console.log(`[Baseline] Active users in database prior to test: ${initialUserCount}\n`);

    // 1. Environment & Configuration Check
    console.log('--- 1. Configuration & Security Audit ---');

    const isConfigured = EmailService.isConfigured();
    recordCheck(
      'Config',
      'Email service configured with active credentials',
      isConfigured,
      `EMAIL_NOTIFICATIONS_ENABLED=${env.EMAIL_NOTIFICATIONS_ENABLED}, API Key Present: ${Boolean(env.RESEND_API_KEY)}`
    );

    const testModeActive = env.EMAIL_TEST_MODE === true;
    recordCheck(
      'Config',
      'EMAIL_TEST_MODE is strictly enabled in development',
      testModeActive,
      `EMAIL_TEST_MODE=${env.EMAIL_TEST_MODE}, NODE_ENV=${env.NODE_ENV}`
    );

    const testToMatch = env.RESEND_TEST_TO === 'delivered@resend.dev';
    recordCheck(
      'Config',
      'RESEND_TEST_TO is configured to Resend test sink',
      testToMatch,
      `RESEND_TEST_TO=${env.RESEND_TEST_TO}`
    );

    const fromAddress = EmailService.getFromAddress();
    const validSender = fromAddress.includes('onboarding@resend.dev') && fromAddress.includes('OBLIVION');
    recordCheck(
      'Config',
      'From address properly formatted with sender name and domain',
      validSender,
      `From: ${fromAddress}`
    );

    // 2. Recipient Redirection Logic Confirmation
    console.log('--- 2. Recipient Redirection Verification ---');
    const intendedRecipient = 'ephemeral_audit_privacy_user@oblivion.internal';
    const resolved = EmailService.resolveRecipient(intendedRecipient);

    const redirectionCorrect = resolved.recipient === 'delivered@resend.dev' && resolved.isTestMode === true;
    recordCheck(
      'Redirection',
      'Recipient redirected to delivered@resend.dev without altering intended address',
      redirectionCorrect,
      `Intended: ${intendedRecipient} -> Resolved: ${resolved.recipient} (isTestMode=${resolved.isTestMode})`
    );

    // 3. Email Template & Subject Verification
    console.log('--- 3. Email Template & Content Audit ---');
    const deadlineStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const rendered = buildReminderEmail({
      userName: 'Privacy Auditor',
      reminderTitle: 'Live Resend Verification Notice',
      reminderDescription: 'Automated verification test of live Resend transactional delivery pipeline',
      formattedDeadline: deadlineStr,
      stage: '7_DAYS_BEFORE',
      priority: 'HIGH',
      daysRemaining: 7,
      customNotes: 'Automated Step 5 verification suite running against Resend API test sink',
    });

    const subjectValid =
      rendered.subject.includes('Upcoming Deadline (7 Days Remaining)') &&
      rendered.subject.includes('Live Resend Verification Notice');
    recordCheck(
      'Template',
      'Email subject contains stage prefix and reminder title',
      subjectValid,
      `Subject: "${rendered.subject}"`
    );

    const htmlValid =
      rendered.html.includes('<!DOCTYPE html>') &&
      rendered.html.includes('OBLIVION') &&
      rendered.html.includes('7 DAYS REMAINING') &&
      rendered.html.includes('Live Resend Verification Notice') &&
      rendered.html.includes('Review My Reminder');
    recordCheck(
      'Template',
      'Email HTML contains responsive styling, branding, and status badge',
      htmlValid,
      `HTML Length: ${rendered.html.length} chars, Doctype present: true`
    );

    const textValid =
      rendered.text.includes('OBLIVION') &&
      rendered.text.includes('7 DAYS REMAINING') &&
      rendered.text.includes('Live Resend Verification Notice') &&
      rendered.text.includes('REMINDER DETAILS');
    recordCheck(
      'Template',
      'Plain-text fallback rendered with matching content',
      textValid,
      `Text Length: ${rendered.text.length} chars`
    );

    // 4. Live Resend Direct Dispatch Verification
    console.log('--- 4. Live Resend API Direct Dispatch ---');
    console.log(`[Live Dispatch] Calling Resend API with to="${intendedRecipient}" (redirects to ${resolved.recipient})...`);

    const directResult = await EmailService.sendEmail({
      to: intendedRecipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: 'environment', value: 'development' },
        { name: 'workflow', value: 'step_5_direct_verification' },
      ],
    });

    const directSuccess =
      directResult.success &&
      typeof directResult.resendEmailId === 'string' &&
      directResult.resendEmailId.length > 10;

    recordCheck(
      'Live API',
      'Resend API accepted direct transactional email and returned valid Email ID',
      directSuccess,
      directSuccess
        ? `Success: true, Resend ID: ${directResult.resendEmailId}`
        : `Success: false, Error: ${directResult.error}, Status: ${directResult.statusCode}`
    );

    // 5. Full Database Queue & Transactional Worker Flow Verification
    console.log('--- 5. Database Queue & Transactional Worker Flow ---');

    const timestamp = Date.now();
    const testEmail = `audit_live_worker_${timestamp}@oblivion.internal`;
    const regResult = await AuthService.register({
      fullName: 'Resend Verification Tester',
      email: testEmail,
      password: 'SecurePassword123!',
    });
    testUserId = regResult.user.id;
    console.log(`[DB Setup] Created ephemeral test user: ${testUserId} (${testEmail})`);

    // Create a reminder for this user - ReminderService.createReminder automatically
    // creates an in-app notification AND queues an EmailDelivery record with stage 'SCHEDULED'
    // and invokes processPendingEmailDeliveries()
    const testDueDate = new Date(Date.now() + 14 * 86400000);
    const testReminder = await ReminderService.createReminder(testUserId, {
      title: 'Step 5 Queue Verification Reminder',
      reminderDate: testDueDate,
      reminderType: ReminderType.ANNUAL_PRIVACY_REVIEW,
      notes: 'End-to-end automated queue delivery verification',
    });
    console.log(`[DB Setup] Created ephemeral test reminder: ${testReminder.id}`);

    // Verify the email delivery job was processed to SENT via Resend
    const scheduledDelivery = await prisma.emailDelivery.findFirst({
      where: {
        userId: testUserId,
        reminderId: testReminder.id,
        notificationStage: 'SCHEDULED',
      },
    });

    const scheduledSentOk = Boolean(
      scheduledDelivery &&
      scheduledDelivery.deliveryStatus === EmailDeliveryStatus.SENT &&
      typeof scheduledDelivery.resendEmailId === 'string' &&
      scheduledDelivery.sentAt !== null
    );

    recordCheck(
      'Workflow',
      'Reminder creation triggered transactional pipeline and marked delivery as SENT via Resend',
      scheduledSentOk,
      scheduledSentOk
        ? `Delivery ID: ${scheduledDelivery?.id}, Resend ID: ${scheduledDelivery?.resendEmailId}, Sent At: ${scheduledDelivery?.sentAt?.toISOString()}`
        : `Delivery Status: ${scheduledDelivery?.deliveryStatus}, Error: ${scheduledDelivery?.errorMessage}`
    );

    // Explicitly test queued worker execution by queuing a second milestone alert
    console.log('[Worker Flow] Explicitly queuing a 7_DAYS_BEFORE alert and running worker...');
    const manualDelivery = await ReminderSchedulerService.queueEmailDelivery({
      userId: testUserId,
      reminderId: testReminder.id,
      stage: '7_DAYS_BEFORE',
      reminderTitle: 'Step 5 Queue Verification Reminder',
      dueDate: testReminder.reminderDate,
      notes: 'Explicit worker queue test',
      daysRemaining: 7,
    });

    const queuedPendingOk = manualDelivery?.deliveryStatus === EmailDeliveryStatus.PENDING;
    recordCheck(
      'Worker Flow',
      'New milestone alert queued in database with PENDING status',
      queuedPendingOk,
      `Delivery ID: ${manualDelivery?.id}, Initial Status: ${manualDelivery?.deliveryStatus}`
    );

    // Run the scheduler's email queue processor
    const workerStats = await ReminderSchedulerService.processPendingEmailDeliveries();
    console.log(`[Worker Flow] Processed: ${workerStats.processed}, Sent: ${workerStats.sent}, Failed: ${workerStats.failed}`);

    const updatedManualDelivery = await prisma.emailDelivery.findUnique({
      where: { id: manualDelivery!.id },
    });

    const workerDeliveredOk = Boolean(
      updatedManualDelivery &&
      updatedManualDelivery.deliveryStatus === EmailDeliveryStatus.SENT &&
      typeof updatedManualDelivery.resendEmailId === 'string' &&
      updatedManualDelivery.sentAt !== null
    );

    recordCheck(
      'Worker Flow',
      'Worker claimed job, dispatched via Resend, and updated database status to SENT',
      workerDeliveredOk,
      workerDeliveredOk
        ? `Delivery Status: ${updatedManualDelivery?.deliveryStatus}, Resend ID: ${updatedManualDelivery?.resendEmailId}, Sent At: ${updatedManualDelivery?.sentAt?.toISOString()}`
        : `Delivery Status: ${updatedManualDelivery?.deliveryStatus}, Error: ${updatedManualDelivery?.errorMessage}`
    );

    const dbEmailPreserved =
      scheduledDelivery?.recipientEmail === testEmail &&
      updatedManualDelivery?.recipientEmail === testEmail;

    recordCheck(
      'Data Integrity',
      'User registered email in database preserved unmodified while delivered to test sink',
      dbEmailPreserved,
      `Database recipientEmail: "${updatedManualDelivery?.recipientEmail}" strictly matches user email: "${testEmail}"`
    );

  } catch (err: any) {
    console.error('Error during Step 5 execution:', err.message);
    recordCheck('Execution', 'Step 5 threw an unexpected error', false, err.message);
  } finally {
    // 6. Clean up ephemeral test records & verify zero DB pollution
    console.log('--- 6. Test Data Cleanup & Integrity Check ---');
    try {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
        console.log(`[Cleanup] Removed test user ${testUserId} (cascaded reminders and deliveries)`);
      }
      const finalUserCount = await prisma.user.count();
      const integrityOk = finalUserCount === initialUserCount;
      recordCheck(
        'Integrity',
        'Database returned cleanly to initial baseline state (zero orphaned data)',
        integrityOk,
        `Initial User Count: ${initialUserCount}, Final User Count: ${finalUserCount}`
      );
    } catch (cleanupErr: any) {
      console.warn('[Cleanup Warning] Error cleaning up test data:', cleanupErr.message);
    }
  }

  // Summary
  console.log('================================================================');
  console.log('STEP 5 VERIFICATION SUMMARY');
  console.log('================================================================');
  const total = checks.length;
  const passed = checks.filter(c => c.passed).length;
  const failed = total - passed;

  console.log(`TOTAL CHECKS: ${total}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log(`STATUS:       ${failed === 0 ? '100% GREEN (ALL STEP 5 CHECKS PASSED)' : 'FAILURE DETECTED'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep5LiveVerification().catch(err => {
  console.error('Fatal error during Step 5 verification:', err);
  process.exit(1);
});
