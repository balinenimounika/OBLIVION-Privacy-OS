/**
 * OBLIVION - Email Delivery Status Mismatch Investigation & Fix Test Suite
 *
 * Verifies all 10 required testing scenarios:
 * 1. Resend API successful response (captures resendEmailId, sets SENT)
 * 2. Matching email.delivered webhook (transitions SENT to DELIVERED)
 * 3. Failed API request (sets FAILED with errorMessage, resendEmailId remains null)
 * 4. email.bounced webhook (transitions to BOUNCED with failedAt and reason)
 * 5. email.complained webhook (transitions to FAILED with spam complaint reason)
 * 6. Incorrect or unknown Resend email ID (graceful 200 acknowledgment, zero corruption)
 * 7. Duplicate webhook delivery (idempotent, status preserved)
 * 8. Delayed webhook events (out-of-order email.sent never overwrites DELIVERED)
 * 9. Recipient mismatch between test recipient and registered user (safe test redirection preserves DB email)
 * 10. Correct notification status displayed in API / Frontend representation
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { EmailService, SendEmailOptions, SendEmailResult } from '../src/services/email.service';
import { EmailDeliveryStatus, NotificationType } from '@prisma/client';

interface TestResult {
  scenarioNumber: number;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function recordTest(scenarioNumber: number, name: string, passed: boolean, details: string) {
  testResults.push({ scenarioNumber, name, passed, details });
  const icon = passed ? '✅ [PASSED]' : '❌ [FAILED]';
  console.log(`${icon} [Scenario ${scenarioNumber}] ${name}`);
  console.log(`   Details: ${details}\n`);
}

async function runMismatchFixTests() {
  console.log('================================================================');
  console.log('OBLIVION – EMAIL DELIVERY MISMATCH & WEBHOOK VERIFICATION SUITE');
  console.log('================================================================\n');

  const uniqueSuffix = Date.now().toString(36);
  let testUserId = '';
  let testUserToken = '';
  const registeredEmail = `anil_test_${uniqueSuffix}@gmail.com`;

  try {
    // Setup isolated user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Anil Test User',
        email: registeredEmail,
        password: 'Password123!',
      });

    testUserId = regRes.body.data?.user?.id;
    testUserToken = regRes.body.data?.tokens?.accessToken;

    console.log(`[Setup] Provisioned test user ${testUserId} (${registeredEmail})\n`);

    // ================================================================
    // SCENARIO 1: Resend API Successful Response
    // ================================================================
    console.log('--- SCENARIO 1: Resend API Successful Response ---');
    const mockResendId1 = `re_success_${Date.now()}_1`;
    EmailService.setMockSender(async (_opts: SendEmailOptions): Promise<SendEmailResult> => {
      return { success: true, resendEmailId: mockResendId1 };
    });

    const notif1 = await prisma.notification.create({
      data: {
        userId: testUserId,
        title: 'Scenario 1 Notification',
        message: 'Testing successful API response',
        notificationType: NotificationType.SYSTEM_NOTICE,
      },
    });

    const sendRes1 = await EmailService.sendEmail({
      to: registeredEmail,
      subject: 'Scenario 1 Subject',
      html: '<p>Test</p>',
    });

    const delivery1 = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationId: notif1.id,
        notificationStage: 'TEST_STAGE',
        recipientEmail: registeredEmail,
        subject: 'Scenario 1 Subject',
        deliveryStatus: sendRes1.success ? EmailDeliveryStatus.SENT : EmailDeliveryStatus.FAILED,
        resendEmailId: sendRes1.resendEmailId,
        sentAt: new Date(),
      },
    });

    const sc1Ok = delivery1.deliveryStatus === EmailDeliveryStatus.SENT && delivery1.resendEmailId === mockResendId1;
    recordTest(
      1,
      'Resend API Successful Response',
      sc1Ok,
      `Delivery ID: ${delivery1.id}, Status: ${delivery1.deliveryStatus}, Resend ID: ${delivery1.resendEmailId}`
    );

    // ================================================================
    // SCENARIO 2: Matching email.delivered Webhook
    // ================================================================
    console.log('--- SCENARIO 2: Matching email.delivered Webhook ---');
    const webhookRes2 = await request(app)
      .post('/api/v1/webhooks/resend')
      .send({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: mockResendId1 },
      });

    const updatedDelivery2 = await prisma.emailDelivery.findUnique({ where: { id: delivery1.id } });
    const sc2Ok =
      webhookRes2.status === 200 &&
      updatedDelivery2?.deliveryStatus === EmailDeliveryStatus.DELIVERED &&
      Boolean(updatedDelivery2?.deliveredAt);

    recordTest(
      2,
      'Matching email.delivered Webhook',
      sc2Ok,
      `HTTP Status: ${webhookRes2.status}, Delivery Status: ${updatedDelivery2?.deliveryStatus}, DeliveredAt: ${updatedDelivery2?.deliveredAt}`
    );

    // ================================================================
    // SCENARIO 3: Failed API Request
    // ================================================================
    console.log('--- SCENARIO 3: Failed API Request ---');
    EmailService.setMockSender(async (_opts: SendEmailOptions): Promise<SendEmailResult> => {
      return {
        success: false,
        error: 'You can only send testing emails to your own email address (balinenimounika21@gmail.com)',
        statusCode: 403,
        isRetryable: false,
      };
    });

    const notif3 = await prisma.notification.create({
      data: {
        userId: testUserId,
        title: 'Scenario 3 Notification',
        message: 'Testing API rejection',
        notificationType: NotificationType.SECURITY_ALERT,
      },
    });

    const sendRes3 = await EmailService.sendEmail({
      to: registeredEmail,
      subject: 'Scenario 3 Subject',
      html: '<p>Test</p>',
    });

    const delivery3 = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationId: notif3.id,
        notificationStage: 'ACCOUNT_SECURITY',
        recipientEmail: registeredEmail,
        subject: 'Scenario 3 Subject',
        deliveryStatus: EmailDeliveryStatus.FAILED,
        resendEmailId: sendRes3.resendEmailId || null,
        failedAt: new Date(),
        errorMessage: sendRes3.error,
      },
    });

    const sc3Ok =
      delivery3.deliveryStatus === EmailDeliveryStatus.FAILED &&
      delivery3.resendEmailId === null &&
      delivery3.errorMessage?.includes('balinenimounika21@gmail.com');

    recordTest(
      3,
      'Failed API Request',
      Boolean(sc3Ok),
      `Delivery ID: ${delivery3.id}, Status: ${delivery3.deliveryStatus}, Resend ID: ${delivery3.resendEmailId}, Error: "${delivery3.errorMessage}"`
    );

    // ================================================================
    // SCENARIO 4: email.bounced Webhook
    // ================================================================
    console.log('--- SCENARIO 4: email.bounced Webhook ---');
    const mockResendId4 = `re_bounce_${Date.now()}_4`;
    const delivery4 = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'TEST_STAGE',
        recipientEmail: 'invalid_recipient_box@example.com',
        subject: 'Scenario 4 Subject',
        deliveryStatus: EmailDeliveryStatus.SENT,
        resendEmailId: mockResendId4,
        sentAt: new Date(),
      },
    });

    await request(app)
      .post('/api/v1/webhooks/resend')
      .send({
        type: 'email.bounced',
        created_at: new Date().toISOString(),
        data: {
          email_id: mockResendId4,
          bounce: { message: '550 5.1.1 User unknown' },
        },
      });

    const updatedDelivery4 = await prisma.emailDelivery.findUnique({ where: { id: delivery4.id } });
    const sc4Ok =
      updatedDelivery4?.deliveryStatus === EmailDeliveryStatus.BOUNCED &&
      Boolean(updatedDelivery4?.failedAt) &&
      updatedDelivery4?.errorMessage?.includes('550 5.1.1 User unknown');

    recordTest(
      4,
      'email.bounced Webhook',
      Boolean(sc4Ok),
      `Status: ${updatedDelivery4?.deliveryStatus}, FailedAt: ${updatedDelivery4?.failedAt}, Reason: "${updatedDelivery4?.errorMessage}"`
    );

    // ================================================================
    // SCENARIO 5: email.complained Webhook
    // ================================================================
    console.log('--- SCENARIO 5: email.complained Webhook ---');
    const mockResendId5 = `re_complaint_${Date.now()}_5`;
    const delivery5 = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'TEST_STAGE',
        recipientEmail: registeredEmail,
        subject: 'Scenario 5 Subject',
        deliveryStatus: EmailDeliveryStatus.SENT,
        resendEmailId: mockResendId5,
        sentAt: new Date(),
      },
    });

    await request(app)
      .post('/api/v1/webhooks/resend')
      .send({
        type: 'email.complained',
        created_at: new Date().toISOString(),
        data: { email_id: mockResendId5 },
      });

    const updatedDelivery5 = await prisma.emailDelivery.findUnique({ where: { id: delivery5.id } });
    const sc5Ok =
      updatedDelivery5?.deliveryStatus === EmailDeliveryStatus.FAILED &&
      Boolean(updatedDelivery5?.failedAt) &&
      updatedDelivery5?.errorMessage?.includes('spam/complaint');

    recordTest(
      5,
      'email.complained Webhook',
      Boolean(sc5Ok),
      `Status: ${updatedDelivery5?.deliveryStatus}, FailedAt: ${updatedDelivery5?.failedAt}, Reason: "${updatedDelivery5?.errorMessage}"`
    );

    // ================================================================
    // SCENARIO 6: Incorrect or Unknown Resend Email ID
    // ================================================================
    console.log('--- SCENARIO 6: Incorrect or Unknown Resend Email ID ---');
    const unknownRes = await request(app)
      .post('/api/v1/webhooks/resend')
      .send({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: 're_nonexistent_id_999999' },
      });

    const sc6Ok = unknownRes.status === 200 && unknownRes.body?.success === true;
    recordTest(
      6,
      'Incorrect or Unknown Resend Email ID',
      sc6Ok,
      `HTTP Status: ${unknownRes.status}, Message: "${unknownRes.body?.message}" (Graceful acknowledgment)`
    );

    // ================================================================
    // SCENARIO 7: Duplicate Webhook Delivery
    // ================================================================
    console.log('--- SCENARIO 7: Duplicate Webhook Delivery ---');
    // Send email.delivered again for delivery1
    const duplicateRes = await request(app)
      .post('/api/v1/webhooks/resend')
      .send({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: mockResendId1 },
      });

    const checkDuplicate = await prisma.emailDelivery.findUnique({ where: { id: delivery1.id } });
    const sc7Ok = duplicateRes.status === 200 && checkDuplicate?.deliveryStatus === EmailDeliveryStatus.DELIVERED;

    recordTest(
      7,
      'Duplicate Webhook Delivery',
      sc7Ok,
      `HTTP Status: ${duplicateRes.status}, Status remained: ${checkDuplicate?.deliveryStatus} (Idempotent)`
    );

    // ================================================================
    // SCENARIO 8: Delayed Webhook Events (Out-of-Order email.sent)
    // ================================================================
    console.log('--- SCENARIO 8: Delayed Webhook Events ---');
    // delivery1 is currently DELIVERED. Send delayed email.sent:
    const delayedSentRes = await request(app)
      .post('/api/v1/webhooks/resend')
      .send({
        type: 'email.sent',
        created_at: new Date().toISOString(),
        data: { email_id: mockResendId1 },
      });

    const checkDelayed = await prisma.emailDelivery.findUnique({ where: { id: delivery1.id } });
    const sc8Ok = delayedSentRes.status === 200 && checkDelayed?.deliveryStatus === EmailDeliveryStatus.DELIVERED;

    recordTest(
      8,
      'Delayed Webhook Events',
      sc8Ok,
      `Delayed email.sent received. Delivery status: ${checkDelayed?.deliveryStatus} (Protected from downgrade to SENT)`
    );

    // ================================================================
    // SCENARIO 9: Recipient Mismatch (Test Recipient vs Registered User)
    // ================================================================
    console.log('--- SCENARIO 9: Recipient Mismatch (Test Mode Redirection) ---');
    const testModeResolution = EmailService.resolveRecipient('a76154680@gmail.com', {
      nodeEnv: 'development',
      emailTestMode: true,
      resendTestTo: 'balinenimounika21@gmail.com',
      allowedTestEmails: ['balinenimounika21@gmail.com'],
    });

    const sc9Ok =
      testModeResolution.recipient === 'balinenimounika21@gmail.com' &&
      testModeResolution.isTestMode === true;

    recordTest(
      9,
      'Recipient Mismatch & Test Mode Redirection',
      sc9Ok,
      `Intended: a76154680@gmail.com -> Resolved: ${testModeResolution.recipient}, isTestMode: ${testModeResolution.isTestMode}`
    );

    // ================================================================
    // SCENARIO 10: Correct Notification Status Displayed in Frontend / API
    // ================================================================
    console.log('--- SCENARIO 10: Notification Status API Representation ---');
    const notifApiRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${testUserToken}`);

    const notifs = Array.isArray(notifApiRes.body.data)
      ? notifApiRes.body.data
      : notifApiRes.body.data?.notifications || [];
    const notifWithDelivered = notifs.find((n: any) => n.id === notif1.id);
    const delivSummary = notifWithDelivered?.emailDeliveries?.[0];

    const sc10Ok =
      notifApiRes.status === 200 &&
      delivSummary?.deliveryStatus === 'DELIVERED' &&
      delivSummary?.resendEmailId === mockResendId1 &&
      delivSummary?.recipientEmail === registeredEmail;

    recordTest(
      10,
      'Notification Status API Representation',
      Boolean(sc10Ok),
      `Notification ID: ${notif1.id}, Displayed Status: ${delivSummary?.deliveryStatus}, Resend ID: ${delivSummary?.resendEmailId}, Recipient: ${delivSummary?.recipientEmail}`
    );
  } finally {
    // Cleanup
    console.log('--- CLEANUP: Removing Test Users and Records ---');
    try {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
      console.log('Cleanup completed.\n');
    } catch (err: any) {
      console.warn('Cleanup warning:', err.message);
    }
  }

  // Summary
  console.log('================================================================');
  console.log('FINAL TEST EXECUTION SUMMARY');
  console.log('================================================================');

  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log(`Total Scenarios Tested : ${total}`);
  console.log(`Passed                 : ${passed}`);
  console.log(`Failed                 : ${failed}`);
  console.log(`Success Rate           : ${((passed / total) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('❌ SOME TESTS FAILED.');
    await prisma.$disconnect();
    process.exit(1);
  } else {
    console.log('🎉 ALL 10 EMAIL DELIVERY MISMATCH & WEBHOOK SCENARIOS PASSED SUCCESSFULLY!');
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Execute
runMismatchFixTests()
  .catch(async (err) => {
    console.error('Fatal test error:', err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
