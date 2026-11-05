/**
 * OBLIVION – Resend Email Quota Handling & Safe Retry Test Suite
 *
 * Validates:
 * 1. Quota error detection and classification (HTTP 429/402, rate_limit_exceeded, daily limit patterns)
 * 2. Sensitive credential sanitization in error logs (API keys, Bearer tokens, secrets)
 * 3. In-app notification creation preserved when email delivery fails (Requirements 1 & 9)
 * 4. Delivery status stored as FAILED with exact user-friendly message (Requirements 3 & 4)
 * 5. Guardrail: A failed email is NEVER marked as DELIVERED (Requirement 5)
 * 6. Safe retry support when quota recovers: atomic claiming, SENT state transition, idempotency (Requirements 6 & 7)
 * 7. Provider backoff behavior when quota remains exhausted during retry
 * 8. User preference API retry endpoints
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { EmailDeliveryStatus, NotificationType } from '@prisma/client';
import {
  EmailService,
  SendEmailOptions,
  SendEmailResult,
  RESEND_QUOTA_EXCEEDED_MESSAGE,
} from '../src/services/email.service';
import { UserEmailNotificationService } from '../src/services/user-email-notification.service';
import { ReminderSchedulerService } from '../src/services/reminder-scheduler.service';
import { NotificationService } from '../src/services/notification.service';
import { AuthService } from '../src/services/auth.service';

interface TestResult {
  section: string;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function recordTest(section: string, name: string, passed: boolean, details: string) {
  testResults.push({ section, name, passed, details });
  const icon = passed ? '✅ [PASSED]' : '❌ [FAILED]';
  console.log(`${icon} [${section}] ${name}`);
  console.log(`   Details: ${details}\n`);
}

async function runResendQuotaHandlingTests() {
  console.log('================================================================');
  console.log('OBLIVION – RESEND EMAIL QUOTA HANDLING & RETRY TEST SUITE');
  console.log('================================================================\n');

  let testUserId = '';
  let testUserToken = '';
  const timestamp = Date.now();
  const testEmail = `quota_test_${timestamp}@oblivion.internal`;

  try {
    // -------------------------------------------------------------------------
    // Setup: Create test user for notification and email delivery testing
    // -------------------------------------------------------------------------
    const authResult = await AuthService.register({
      fullName: 'Quota Test User',
      email: testEmail,
      password: 'StrongPassword123!',
    });
    testUserId = authResult.user.id;
    testUserToken = authResult.tokens.accessToken;

    // =========================================================================
    // SECTION 1: Quota Error Detection & Classification
    // =========================================================================
    console.log('--- SECTION 1: Quota Error Detection & Classification ---');

    // Test 1.1: HTTP 429 status code
    const is429 = EmailService.isQuotaExceededError(null, 429);
    recordTest(
      'QUOTA_CLASSIFICATION',
      'Detects HTTP 429 Too Many Requests as quota exceeded',
      is429 === true,
      `Expected true, received ${is429}`
    );

    // Test 1.2: HTTP 402 Payment Required
    const is402 = EmailService.isQuotaExceededError(null, 402);
    recordTest(
      'QUOTA_CLASSIFICATION',
      'Detects HTTP 402 Payment Required as quota exceeded',
      is402 === true,
      `Expected true, received ${is402}`
    );

    // Test 1.3: Resend SDK error names
    const isRateLimitName = EmailService.isQuotaExceededError({ name: 'rate_limit_exceeded' });
    const isDailyQuotaName = EmailService.isQuotaExceededError({ name: 'daily_quota_exceeded' });
    const isSendingLimitName = EmailService.isQuotaExceededError({ name: 'sending_limit_exceeded' });
    recordTest(
      'QUOTA_CLASSIFICATION',
      'Classifies SDK quota error names correctly',
      isRateLimitName && isDailyQuotaName && isSendingLimitName,
      `rate_limit_exceeded: ${isRateLimitName}, daily_quota_exceeded: ${isDailyQuotaName}, sending_limit_exceeded: ${isSendingLimitName}`
    );

    // Test 1.4: Resend daily limit message patterns
    const msgPattern1 = EmailService.isQuotaExceededError({
      message: 'You have reached your daily email sending limit.',
    });
    const msgPattern2 = EmailService.isQuotaExceededError({
      message: 'Daily quota exceeded. 100% of your daily limit used.',
    });
    const msgPattern3 = EmailService.isQuotaExceededError('Resend sending limit reached for today');
    recordTest(
      'QUOTA_CLASSIFICATION',
      'Detects natural-language quota exhausted messages',
      msgPattern1 && msgPattern2 && msgPattern3,
      `Pattern 1: ${msgPattern1}, Pattern 2: ${msgPattern2}, Pattern 3: ${msgPattern3}`
    );

    // Test 1.5: Generic non-quota errors are NOT falsely classified as quota
    const nonQuota1 = EmailService.isQuotaExceededError({ name: 'internal_server_error' }, 500);
    const nonQuota2 = EmailService.isQuotaExceededError({ name: 'validation_error', message: 'Invalid email' });
    recordTest(
      'QUOTA_CLASSIFICATION',
      'Distinguishes generic errors from quota exhaustion',
      nonQuota1 === false && nonQuota2 === false,
      `500 error: ${nonQuota1} (expected false), Validation error: ${nonQuota2} (expected false)`
    );

    // =========================================================================
    // SECTION 2: Credential & Secret Protection in Error Logs
    // =========================================================================
    console.log('--- SECTION 2: Credential & Secret Protection in Error Logs ---');

    const leakAttempt =
      'Resend API error with key re_1234567890abcdef12345678 and Authorization: Bearer secret_jwt_token_123456';
    const sanitized = EmailService.sanitizeErrorMessage(leakAttempt);

    const hasNoKey = !sanitized.includes('re_1234567890abcdef12345678');
    const hasNoBearer = !sanitized.includes('secret_jwt_token_123456');
    const hasRedactedPlaceholder = sanitized.includes('re_[REDACTED]') && sanitized.includes('Bearer [REDACTED]');

    recordTest(
      'SECURITY_LOGGING',
      'Sanitizes Resend API keys and Bearer tokens from error strings',
      hasNoKey && hasNoBearer && hasRedactedPlaceholder,
      `Sanitized output: "${sanitized}"`
    );

    // =========================================================================
    // SECTION 3: Notification Creation Preserved When Email Delivery Fails
    // =========================================================================
    console.log('--- SECTION 3: Notification Creation Independence ---');

    // Simulate Resend 100% quota exceeded error
    EmailService.setMockSender(async (_opts: SendEmailOptions): Promise<SendEmailResult> => {
      return {
        success: false,
        error: 'You have reached your daily email sending limit.',
        statusCode: 429,
        isQuotaExceeded: true,
        quotaMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
        isRetryable: false,
      };
    });

    const eventTitle = `Quota Exhaustion Test Event ${timestamp}`;
    const eventDetails = 'Testing preservation of dashboard notification during quota exhaustion';

    const dispatchResult = await UserEmailNotificationService.sendAccountSecurityAlert(
      testUserId,
      eventTitle,
      eventDetails
    );

    // Verify in-app notification exists in PostgreSQL
    const createdNotif = await prisma.notification.findFirst({
      where: {
        userId: testUserId,
        title: `[SECURITY ALERT] ${eventTitle}`,
      },
      include: {
        emailDeliveries: true,
      },
    });

    const notificationPreserved =
      createdNotif !== null &&
      createdNotif.message === eventDetails &&
      createdNotif.notificationType === NotificationType.SECURITY_ALERT;

    recordTest(
      'NOTIFICATION_PRESERVATION',
      'In-app notification is successfully created even when email delivery fails due to quota',
      notificationPreserved,
      `Notification ID: ${createdNotif?.id}, Title: "${createdNotif?.title}", Found: ${Boolean(createdNotif)}`
    );

    // =========================================================================
    // SECTION 4: Email Delivery Status Stored as FAILED with Friendly Reason
    // =========================================================================
    console.log('--- SECTION 4: FAILED Status & Meaningful Reason ---');

    const deliveryRecord = createdNotif?.emailDeliveries?.[0];
    const isStatusFailed = deliveryRecord?.deliveryStatus === EmailDeliveryStatus.FAILED;
    const isFriendlyMessage = deliveryRecord?.errorMessage === RESEND_QUOTA_EXCEEDED_MESSAGE;
    const metadata = deliveryRecord?.metadata as any;
    const hasQuotaMetadata = metadata?.quotaExceeded === true && metadata?.retryEligible === true;

    recordTest(
      'DELIVERY_STATUS_FAILED',
      'Delivery record is stored as FAILED with exact user-friendly limit message',
      isStatusFailed && isFriendlyMessage && hasQuotaMetadata,
      `Status: ${deliveryRecord?.deliveryStatus}, Message: "${deliveryRecord?.errorMessage}", quotaExceeded: ${metadata?.quotaExceeded}`
    );

    // Verify NotificationService delivers the exact user-friendly message
    const notifsResponse = await NotificationService.getNotifications(testUserId, {
      page: 1,
      limit: 10,
      isRead: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    const matchingNotif = notifsResponse.notifications.find((n) => n.id === createdNotif?.id);
    const apiDeliveryMessage = matchingNotif?.emailDeliveries?.[0]?.errorMessage;

    recordTest(
      'USER_FACING_DETAILS',
      'Notification query returns user-friendly limit message in delivery details',
      apiDeliveryMessage === RESEND_QUOTA_EXCEEDED_MESSAGE,
      `Returned errorMessage: "${apiDeliveryMessage}"`
    );

    // =========================================================================
    // SECTION 5: Never Mark Failed Email as DELIVERED
    // =========================================================================
    console.log('--- SECTION 5: Immutability of FAILED Status against DELIVERED ---');

    if (deliveryRecord) {
      // 5.1 Test Webhook Guard: Resend email.delivered cannot overwrite FAILED
      const webhookRes = await request(app)
        .post('/api/v1/webhooks/resend')
        .set('x-resend-test-override', 'true')
        .send({
          type: 'email.delivered',
          created_at: new Date().toISOString(),
          data: {
            id: 'mock_rogue_resend_id',
            email_id: 'mock_rogue_resend_id',
          },
        });

      // Attempt direct sync against delivery record in FAILED status
      const syncResult = await EmailService.syncDeliveryStatus(deliveryRecord.id);

      const refreshedDelivery = await prisma.emailDelivery.findUnique({
        where: { id: deliveryRecord.id },
      });

      const remainsFailed = refreshedDelivery?.deliveryStatus === EmailDeliveryStatus.FAILED;

      recordTest(
        'STATUS_GUARD_NEVER_DELIVERED',
        'Failed email is never marked as DELIVERED by telemetry or webhooks',
        remainsFailed && refreshedDelivery?.deliveredAt === null,
        `Status remains: ${refreshedDelivery?.deliveryStatus}, DeliveredAt: ${refreshedDelivery?.deliveredAt}`
      );
    }

    // =========================================================================
    // SECTION 6: Safe Retry Support When Quota Becomes Available
    // =========================================================================
    console.log('--- SECTION 6: Safe Retry Support When Quota Recovers ---');

    // Simulate quota recovery: Resend now accepts emails
    const expectedResendId = `re_success_${timestamp}`;
    EmailService.setMockSender(async (_opts: SendEmailOptions): Promise<SendEmailResult> => {
      return {
        success: true,
        resendEmailId: expectedResendId,
      };
    });

    // Execute retry for the user
    const retryResult = await ReminderSchedulerService.retryFailedQuotaDeliveries({
      userId: testUserId,
    });

    const deliveryAfterRetry = await prisma.emailDelivery.findUnique({
      where: { id: deliveryRecord?.id },
    });

    const retrySucceeded =
      retryResult.succeeded === 1 &&
      deliveryAfterRetry?.deliveryStatus === EmailDeliveryStatus.SENT &&
      deliveryAfterRetry?.resendEmailId === expectedResendId &&
      deliveryAfterRetry?.errorMessage === null;

    recordTest(
      'SAFE_RETRY_SUPPORT',
      'Failed email transitions safely to SENT with Resend ID when quota recovers',
      retrySucceeded,
      `Eligible: ${retryResult.eligible}, Succeeded: ${retryResult.succeeded}, New Status: ${deliveryAfterRetry?.deliveryStatus}, Resend ID: ${deliveryAfterRetry?.resendEmailId}`
    );

    // Test 6.2: Idempotency – cannot retry an already-sent email
    const duplicateRetryResult = await ReminderSchedulerService.retryFailedQuotaDeliveries({
      userId: testUserId,
    });

    recordTest(
      'RETRY_IDEMPOTENCY',
      'Subsequent retry ignores already-sent delivery and prevents duplicate dispatches',
      duplicateRetryResult.eligible === 0 && duplicateRetryResult.retried === 0,
      `Eligible: ${duplicateRetryResult.eligible}, Retried: ${duplicateRetryResult.retried}`
    );

    // =========================================================================
    // SECTION 7: Retry When Quota is Still Exhausted
    // =========================================================================
    console.log('--- SECTION 7: Retry While Quota Remains Exhausted ---');

    // Create another failed delivery
    const secondDelivery = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'ACCOUNT_SECURITY',
        recipientEmail: testEmail,
        subject: 'Second Quota Test Email',
        deliveryStatus: EmailDeliveryStatus.FAILED,
        errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
        metadata: {
          quotaExceeded: true,
          retryEligible: true,
        },
      },
    });

    // Mock sender indicates quota is STILL exhausted
    EmailService.setMockSender(async (_opts: SendEmailOptions): Promise<SendEmailResult> => {
      return {
        success: false,
        error: 'daily limit reached',
        statusCode: 429,
        isQuotaExceeded: true,
        quotaMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
        isRetryable: false,
      };
    });

    const stillExhaustedResult = await ReminderSchedulerService.retryFailedQuotaDeliveries({
      userId: testUserId,
      deliveryId: secondDelivery.id,
    });

    const secondDeliveryRefreshed = await prisma.emailDelivery.findUnique({
      where: { id: secondDelivery.id },
    });

    const correctlyReverted =
      stillExhaustedResult.stillQuotaExceeded === true &&
      secondDeliveryRefreshed?.deliveryStatus === EmailDeliveryStatus.FAILED &&
      secondDeliveryRefreshed?.errorMessage === RESEND_QUOTA_EXCEEDED_MESSAGE;

    recordTest(
      'RETRY_STILL_EXHAUSTED',
      'Reverts status to FAILED with user-friendly message when quota is still unavailable',
      correctlyReverted,
      `stillQuotaExceeded: ${stillExhaustedResult.stillQuotaExceeded}, Status: ${secondDeliveryRefreshed?.deliveryStatus}`
    );

    // =========================================================================
    // SECTION 8: API Route Verification (/deliveries/:id/retry)
    // =========================================================================
    console.log('--- SECTION 8: User Preference API Retry Endpoints ---');

    // Test endpoint via HTTP
    EmailService.setMockSender(async () => ({
      success: true,
      resendEmailId: `msg_api_retry_${Date.now()}`,
    }));

    const apiRetryRes = await request(app)
      .post(`/api/v1/users/preferences/deliveries/${secondDelivery.id}/retry`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send();

    recordTest(
      'API_RETRY_ENDPOINT',
      'POST /api/v1/users/preferences/deliveries/:id/retry executes successfully for failed delivery',
      apiRetryRes.status === 200 && apiRetryRes.body.success === true,
      `HTTP Status: ${apiRetryRes.status}, Body: ${JSON.stringify(apiRetryRes.body?.data || apiRetryRes.body)}`
    );

    // Test rejection when trying to retry an already sent email
    const nonFailedRetryRes = await request(app)
      .post(`/api/v1/users/preferences/deliveries/${secondDelivery.id}/retry`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send();

    recordTest(
      'API_RETRY_NON_FAILED_REJECTION',
      'Rejects retry request with 400 Bad Request when delivery is not in FAILED status',
      nonFailedRetryRes.status === 400,
      `HTTP Status: ${nonFailedRetryRes.status}, Message: "${nonFailedRetryRes.body?.message}"`
    );

    // =========================================================================
    // SECTION 9: Production Scheduler Integration
    // =========================================================================
    console.log('--- SECTION 9: Production Scheduler Integration ---');

    // Create a failed delivery to be picked up by the production scheduler scan
    const schedulerTargetDelivery = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'ACCOUNT_SECURITY',
        recipientEmail: testEmail,
        subject: 'Scheduler Batch Test Email',
        deliveryStatus: EmailDeliveryStatus.FAILED,
        errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
        metadata: {
          quotaExceeded: true,
          retryEligible: true,
        },
      },
    });

    // Mock sender accepts email
    const schedulerResendId = `re_sched_${Date.now()}`;
    EmailService.setMockSender(async () => ({
      success: true,
      resendEmailId: schedulerResendId,
    }));

    // Trigger production scheduler scan directly
    await ReminderSchedulerService.processReminders();

    const schedulerDelivRefreshed = await prisma.emailDelivery.findUnique({
      where: { id: schedulerTargetDelivery.id },
    });

    const schedulerProcessed =
      schedulerDelivRefreshed?.deliveryStatus === EmailDeliveryStatus.SENT &&
      schedulerDelivRefreshed?.resendEmailId === schedulerResendId;

    recordTest(
      'SCHEDULER_INTEGRATION',
      'Production scheduler (processReminders) automatically invokes retryFailedQuotaDeliveries and processes backlog',
      schedulerProcessed,
      `Delivery Status: ${schedulerDelivRefreshed?.deliveryStatus}, Resend ID: ${schedulerDelivRefreshed?.resendEmailId}`
    );

    // =========================================================================
    // SECTION 10: Tenant Ownership & Authentication Guards
    // =========================================================================
    console.log('--- SECTION 10: Tenant Ownership & Authentication Guards ---');

    // Create a second user (User B) to test cross-tenant boundary
    const userBResult = await AuthService.register({
      fullName: 'User B Cross Tenant',
      email: `user_b_${timestamp}@oblivion.internal`,
      password: 'StrongPassword123!',
    });
    const userBToken = userBResult.tokens.accessToken;
    const userBId = userBResult.user.id;

    // Create a failed delivery owned by User A
    const userAFailedDelivery = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'ACCOUNT_SECURITY',
        recipientEmail: testEmail,
        subject: 'User A Confidential Alert',
        deliveryStatus: EmailDeliveryStatus.FAILED,
        errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
      },
    });

    // Attempt 1: User B tries to retry User A's delivery record -> Must be rejected with 404
    const crossTenantRes = await request(app)
      .post(`/api/v1/users/preferences/deliveries/${userAFailedDelivery.id}/retry`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send();

    recordTest(
      'TENANT_OWNERSHIP_GUARD',
      'Rejects cross-tenant delivery retry with 404 Not Found (User B cannot access User A delivery)',
      crossTenantRes.status === 404,
      `HTTP Status: ${crossTenantRes.status}, Message: "${crossTenantRes.body?.message}"`
    );

    // Attempt 2: Unauthenticated retry -> Must be rejected with 401 Unauthorized
    const unauthenticatedRes = await request(app)
      .post(`/api/v1/users/preferences/deliveries/${userAFailedDelivery.id}/retry`)
      .send();

    recordTest(
      'AUTHENTICATION_GUARD',
      'Rejects unauthenticated retry request with 401 Unauthorized',
      unauthenticatedRes.status === 401,
      `HTTP Status: ${unauthenticatedRes.status}`
    );

    // =========================================================================
    // SECTION 11: Concurrency-Safe Atomic Claim Lock
    // =========================================================================
    console.log('--- SECTION 11: Concurrency-Safe Atomic Claim Lock ---');

    // Create a failed delivery
    const raceDelivery = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'ACCOUNT_SECURITY',
        recipientEmail: testEmail,
        subject: 'Race Condition Test Email',
        deliveryStatus: EmailDeliveryStatus.FAILED,
        errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
      },
    });

    let mockSendCount = 0;
    EmailService.setMockSender(async () => {
      mockSendCount++;
      // Simulate network latency to widen race condition window
      await new Promise((r) => setTimeout(r, 20));
      return {
        success: true,
        resendEmailId: `re_race_winner_${Date.now()}`,
      };
    });

    // Spawn 5 simultaneous workers competing to retry the exact same failed delivery
    const concurrentAttempts = await Promise.all([
      ReminderSchedulerService.retryFailedQuotaDeliveries({ userId: testUserId, deliveryId: raceDelivery.id }),
      ReminderSchedulerService.retryFailedQuotaDeliveries({ userId: testUserId, deliveryId: raceDelivery.id }),
      ReminderSchedulerService.retryFailedQuotaDeliveries({ userId: testUserId, deliveryId: raceDelivery.id }),
      ReminderSchedulerService.retryFailedQuotaDeliveries({ userId: testUserId, deliveryId: raceDelivery.id }),
      ReminderSchedulerService.retryFailedQuotaDeliveries({ userId: testUserId, deliveryId: raceDelivery.id }),
    ]);

    const totalSucceeded = concurrentAttempts.reduce((acc, curr) => acc + curr.succeeded, 0);
    const totalRetried = concurrentAttempts.reduce((acc, curr) => acc + curr.retried, 0);

    recordTest(
      'ATOMIC_CONCURRENCY_CLAIM',
      'Atomic claim locks prevent duplicate sends under high concurrent contention (5 simultaneous workers)',
      mockSendCount === 1 && totalSucceeded === 1 && totalRetried === 1,
      `Mock sender dispatches: ${mockSendCount} (expected 1), Total succeeded: ${totalSucceeded}, Total retried: ${totalRetried}`
    );

    // =========================================================================
    // SECTION 12: Existing Resend ID Idempotency Protection
    // =========================================================================
    console.log('--- SECTION 12: Resend ID Idempotency Protection ---');

    // Create a delivery that somehow has FAILED status but already has a resendEmailId
    const rogueDelivery = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationStage: 'ACCOUNT_SECURITY',
        recipientEmail: testEmail,
        subject: 'Rogue Record Test',
        deliveryStatus: EmailDeliveryStatus.FAILED,
        resendEmailId: 're_previously_dispatched_999',
        errorMessage: RESEND_QUOTA_EXCEEDED_MESSAGE,
      },
    });

    let rogueSendCalled = false;
    EmailService.setMockSender(async () => {
      rogueSendCalled = true;
      return { success: true, resendEmailId: 're_should_never_happen' };
    });

    const rogueRetryResult = await ReminderSchedulerService.retryFailedQuotaDeliveries({
      userId: testUserId,
      deliveryId: rogueDelivery.id,
    });

    recordTest(
      'IDEMPOTENCY_EXISTING_RESEND_ID',
      'Never dispatches email if a Resend ID is already present on the record',
      rogueSendCalled === false && rogueRetryResult.succeeded === 0,
      `Sender called: ${rogueSendCalled}, Succeeded: ${rogueRetryResult.succeeded}`
    );

    // =========================================================================
    // SECTION 13: Database Operations & Foreign Key Integrity
    // =========================================================================
    console.log('--- SECTION 13: Database Operations & Foreign Key Integrity ---');

    // Verify cascade and CRUD consistency
    const dbNotif = await prisma.notification.create({
      data: {
        userId: testUserId,
        title: 'DB CRUD Integrity Test',
        message: 'Testing PostgreSQL integrity',
        notificationType: NotificationType.SYSTEM_NOTICE,
        isRead: false,
      },
    });

    const dbDeliv = await prisma.emailDelivery.create({
      data: {
        userId: testUserId,
        notificationId: dbNotif.id,
        notificationStage: 'WELCOME',
        recipientEmail: testEmail,
        subject: 'DB Test Subject',
        deliveryStatus: EmailDeliveryStatus.PENDING,
      },
    });

    const readDeliv = await prisma.emailDelivery.findUnique({
      where: { id: dbDeliv.id },
      include: { notification: true, user: true },
    });

    const dbIntegrityOk =
      readDeliv !== null &&
      readDeliv.notificationId === dbNotif.id &&
      readDeliv.userId === testUserId &&
      readDeliv.notification?.title === 'DB CRUD Integrity Test';

    recordTest(
      'DATABASE_OPERATIONS_INTEGRITY',
      'PostgreSQL operations, relationships, and foreign keys operate correctly',
      dbIntegrityOk,
      `Delivery found: ${Boolean(readDeliv)}, Joined Notification Title: "${readDeliv?.notification?.title}"`
    );

    // =========================================================================
    // SECTION 14: Frontend API Contract & Flow Verification
    // =========================================================================
    console.log('--- SECTION 14: Frontend API Contract & Flow Verification ---');

    // 14.1 GET /api/v1/notifications
    const frontendListRes = await request(app)
      .get('/api/v1/notifications?limit=20')
      .set('Authorization', `Bearer ${testUserToken}`);

    // 14.2 PATCH /api/v1/notifications/:id/read
    const frontendMarkReadRes = await request(app)
      .patch(`/api/v1/notifications/${dbNotif.id}/read`)
      .set('Authorization', `Bearer ${testUserToken}`);

    // 14.3 GET /api/v1/users/preferences/deliveries
    const frontendDeliveriesRes = await request(app)
      .get('/api/v1/users/preferences/deliveries')
      .set('Authorization', `Bearer ${testUserToken}`);

    const frontendContractOk =
      frontendListRes.status === 200 &&
      Array.isArray(frontendListRes.body?.data) &&
      frontendMarkReadRes.status === 200 &&
      frontendMarkReadRes.body?.data?.isRead === true &&
      frontendDeliveriesRes.status === 200 &&
      Array.isArray(frontendDeliveriesRes.body?.data);

    recordTest(
      'FRONTEND_API_CONTRACT',
      'Real backend API fulfills all frontend contracts (notifications listing, mark as read, deliveries history)',
      frontendContractOk,
      `List: ${frontendListRes.status}, MarkRead: ${frontendMarkReadRes.status}, Deliveries: ${frontendDeliveriesRes.status}`
    );

    // Cleanup User B
    await prisma.emailDelivery.deleteMany({ where: { userId: userBId } });
    await prisma.notification.deleteMany({ where: { userId: userBId } });
    await prisma.userNotificationPreference.deleteMany({ where: { userId: userBId } });
    await prisma.user.deleteMany({ where: { id: userBId } });
  } catch (err: any) {
    console.error('Fatal error during test execution:', err);
    recordTest('FATAL', 'Resend Quota Handling Test Suite Execution', false, err.message);
  } finally {
    // Reset mock sender
    EmailService.setMockSender(null);

    // Cleanup test records
    if (testUserId) {
      await prisma.emailDelivery.deleteMany({ where: { userId: testUserId } });
      await prisma.notification.deleteMany({ where: { userId: testUserId } });
      await prisma.userNotificationPreference.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }

    await prisma.$disconnect();
  }

  // Summary
  console.log('================================================================');
  console.log('RESEND QUOTA HANDLING TEST SUMMARY');
  console.log('================================================================');
  const passedCount = testResults.filter((t) => t.passed).length;
  const totalCount = testResults.length;
  console.log(`Total Tests: ${totalCount}`);
  console.log(`Passed:      ${passedCount}`);
  console.log(`Failed:      ${totalCount - passedCount}`);
  console.log(`Pass Rate:   ${((passedCount / totalCount) * 100).toFixed(1)}%\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runResendQuotaHandlingTests().catch((err) => {
  console.error('Unhandled failure:', err);
  process.exit(1);
});
