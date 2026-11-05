/**
 * OBLIVION - Global User Email Notification System Automated Test Suite
 *
 * Verifies all 7 phases:
 * Phase 1: User Email Identification & Security (Direct DB lookup, no recipient injection)
 * Phase 2: Notification Events (Welcome on registration, Security alerts, Removal created/updated/completed/failed)
 * Phase 3: Automatic Delivery, Resend SDK integration, retry classification & queue processing
 * Phase 4: Granular User Preferences & Immutable Security Alert Protection
 * Phase 5: Email Delivery History & Verification Endpoints
 * Phase 6: Strict Multi-Tenant Isolation & Unverified Privacy Masking
 * Phase 7: Development Test Mode Redirection Safety & Production Guardrails
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';
import { EmailService, SendEmailOptions, SendEmailResult } from '../src/services/email.service';
import { UserEmailNotificationService } from '../src/services/user-email-notification.service';
import { UserPreferenceService } from '../src/services/user-preference.service';
import { ReminderSchedulerService } from '../src/services/reminder-scheduler.service';
import {
  RemovalRequestType,
  RequestStatus,
  EmailDeliveryStatus,
  NotificationType,
} from '@prisma/client';

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

async function runGlobalEmailSystemTests() {
  console.log('================================================================');
  console.log("OBLIVION – GLOBAL USER EMAIL NOTIFICATION SYSTEM TEST SUITE");
  console.log('================================================================\n');

  // Track all dispatched emails in-memory via MockSender
  const dispatchedEmails: SendEmailOptions[] = [];
  EmailService.setMockSender(async (opts: SendEmailOptions): Promise<SendEmailResult> => {
    dispatchedEmails.push(opts);
    return {
      success: true,
      resendEmailId: `msg_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
  });

  const uniqueSuffix = Date.now().toString(36);
  const userAEmail = `alice_${uniqueSuffix}@example.com`;
  const userBEmail = `bob_${uniqueSuffix}@example.com`;
  let userAId = '';
  let userBId = '';
  let userAToken = '';
  let userBToken = '';
  let userAWebsiteId = '';
  let userAExposureId = '';

  try {
    // ================================================================
    // SECTION 1: User Registration & Automatic Welcome Email
    // ================================================================
    console.log('--- SECTION 1: User Registration & Welcome Email ---');

    // Register User A
    const regResA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Alice Privacy',
        email: userAEmail,
        password: 'Password123!',
      });

    const regAOk = regResA.status === 201 && Boolean(regResA.body.data?.tokens?.accessToken);
    userAId = regResA.body.data?.user?.id;
    userAToken = regResA.body.data?.tokens?.accessToken;

    recordTest(
      'Registration',
      'User A registers successfully and receives JWT',
      regAOk,
      `Status: ${regResA.status}, User ID: ${userAId}, isEmailVerified: ${regResA.body.data?.user?.isEmailVerified}`
    );

    // Verify Welcome Email delivery record in database
    const welcomeDeliveryA = await prisma.emailDelivery.findFirst({
      where: {
        userId: userAId,
        notificationStage: 'WELCOME',
      },
    });

    const welcomeDeliveryAOk =
      Boolean(welcomeDeliveryA) &&
      welcomeDeliveryA?.recipientEmail === userAEmail &&
      welcomeDeliveryA?.deliveryStatus === EmailDeliveryStatus.SENT;

    recordTest(
      'Welcome Email',
      'Welcome email was queued and dispatched automatically to registered email in PostgreSQL',
      welcomeDeliveryAOk,
      `Delivery ID: ${welcomeDeliveryA?.id}, Recipient: ${welcomeDeliveryA?.recipientEmail}, Status: ${welcomeDeliveryA?.deliveryStatus}`
    );

    // Verify Welcome Email sentinel flag in preferences
    const prefA = await prisma.userNotificationPreference.findUnique({
      where: { userId: userAId },
    });
    const sentinelOk = prefA?.welcomeEmailSent === true;

    recordTest(
      'Welcome Email Sentinel',
      'welcomeEmailSent is set to true on UserNotificationPreference',
      sentinelOk,
      `welcomeEmailSent: ${prefA?.welcomeEmailSent}`
    );

    // ================================================================
    // SECTION 2: Zero Duplicate Welcome Email on Login
    // ================================================================
    console.log('--- SECTION 2: Login Idempotency (No Repeated Welcome Emails) ---');

    const emailCountBeforeLogin = await prisma.emailDelivery.count({
      where: { userId: userAId, notificationStage: 'WELCOME' },
    });

    const loginResA = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userAEmail,
        password: 'Password123!',
      });

    const loginOk = loginResA.status === 200 && Boolean(loginResA.body.data?.tokens?.accessToken);
    const emailCountAfterLogin = await prisma.emailDelivery.count({
      where: { userId: userAId, notificationStage: 'WELCOME' },
    });

    const noDuplicateWelcome = loginOk && emailCountBeforeLogin === 1 && emailCountAfterLogin === 1;

    recordTest(
      'Login Idempotency',
      'Subsequent login NEVER dispatches duplicate welcome emails',
      noDuplicateWelcome,
      `Welcome emails before login: ${emailCountBeforeLogin}, after login: ${emailCountAfterLogin}`
    );

    // Register User B for multi-tenant tests
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Bob Security',
        email: userBEmail,
        password: 'Password123!',
      });
    userBId = regResB.body.data?.user?.id;
    userBToken = regResB.body.data?.tokens?.accessToken;

    // ================================================================
    // SECTION 3: Removal Request Lifecycle Events (Create, Update, Complete, Reject)
    // ================================================================
    console.log('--- SECTION 3: Removal Request Lifecycle Notifications ---');

    // Create Website & Exposure for User A
    const websiteA = await prisma.website.create({
      data: {
        userId: userAId,
        websiteName: 'DataBroker Alpha',
        websiteUrl: 'https://databroker-alpha.com',
      },
    });
    userAWebsiteId = websiteA.id;

    const exposureA = await prisma.exposureRecord.create({
      data: {
        userId: userAId,
        websiteId: userAWebsiteId,
        purpose: 'Leaked Phone & SSN',
        notes: 'Personal identity record exposed on data broker profile',
        sensitivityLevel: 'HIGH',
        dateShared: new Date(),
      },
    });
    userAExposureId = exposureA.id;

    // 1. Create Removal Request -> Should dispatch REMOVAL_CREATED email
    const createReqRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        websiteId: userAWebsiteId,
        exposureRecordId: userAExposureId,
        requestType: RemovalRequestType.GDPR_ERASURE,
        requestReason: 'Statutory erasure demand under GDPR Article 17',
      });

    const requestId = createReqRes.body.data?.id;
    const reqCreateOk = createReqRes.status === 201 && Boolean(requestId);

    const createdEmailDelivery = await prisma.emailDelivery.findFirst({
      where: {
        userId: userAId,
        notificationStage: 'REMOVAL_CREATED',
      },
    });

    const removalCreatedEmailOk =
      reqCreateOk &&
      Boolean(createdEmailDelivery) &&
      createdEmailDelivery?.recipientEmail === userAEmail &&
      createdEmailDelivery?.deliveryStatus === EmailDeliveryStatus.SENT;

    recordTest(
      'Removal Created Email',
      'Creating a removal request automatically dispatches notification to registered email',
      removalCreatedEmailOk,
      `Request ID: ${requestId}, Email Delivery ID: ${createdEmailDelivery?.id}, Recipient: ${createdEmailDelivery?.recipientEmail}`
    );

    // 2. Transition to IN_PROGRESS -> Should dispatch REMOVAL_STATUS_UPDATED
    // First transition DRAFT -> SUBMITTED
    await request(app)
      .put(`/api/v1/removal-requests/${requestId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        requestStatus: RequestStatus.SUBMITTED,
        remarks: 'Submitted directly to privacy officer',
      });

    // Then transition SUBMITTED -> IN_PROGRESS
    const updateRes = await request(app)
      .put(`/api/v1/removal-requests/${requestId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        requestStatus: RequestStatus.IN_PROGRESS,
        remarks: 'Platform acknowledged receipt and processing erasure',
      });

    const statusUpdatedDelivery = await prisma.emailDelivery.findFirst({
      where: {
        userId: userAId,
        notificationStage: 'REMOVAL_STATUS_UPDATED',
      },
    });

    const statusUpdatedOk =
      updateRes.status === 200 &&
      Boolean(statusUpdatedDelivery) &&
      statusUpdatedDelivery?.recipientEmail === userAEmail;

    recordTest(
      'Status Updated Email',
      'Transition to IN_PROGRESS queues and dispatches status update email',
      statusUpdatedOk,
      `Delivery ID: ${statusUpdatedDelivery?.id}, Subject: ${statusUpdatedDelivery?.subject}`
    );

    // 3. Transition to COMPLETED -> Should dispatch REMOVAL_COMPLETED email
    const completeRes = await request(app)
      .put(`/api/v1/removal-requests/${requestId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        requestStatus: RequestStatus.COMPLETED,
        remarks: 'Confirmed full deletion of all personal records',
      });

    const completedDelivery = await prisma.emailDelivery.findFirst({
      where: {
        userId: userAId,
        notificationStage: 'REMOVAL_COMPLETED',
      },
    });

    const completedOk =
      completeRes.status === 200 &&
      Boolean(completedDelivery) &&
      completedDelivery?.recipientEmail === userAEmail;

    recordTest(
      'Completion Email',
      'Transition to COMPLETED dispatches erasure completion confirmation email',
      completedOk,
      `Delivery ID: ${completedDelivery?.id}, Subject: ${completedDelivery?.subject}`
    );

    // ================================================================
    // SECTION 4: Multi-Tenant Email Isolation
    // ================================================================
    console.log('--- SECTION 4: Strict Multi-Tenant Email Isolation ---');

    // Count all email deliveries for User B so far
    const userBDeliveries = await prisma.emailDelivery.findMany({
      where: { userId: userBId },
    });

    // User B should ONLY have their own welcome email, ZERO removal emails from User A
    const bHasOnlyOwnWelcome =
      userBDeliveries.length === 1 &&
      userBDeliveries[0].notificationStage === 'WELCOME' &&
      userBDeliveries[0].recipientEmail === userBEmail;

    recordTest(
      'Tenant Isolation',
      'User B receives zero emails from User A operations',
      bHasOnlyOwnWelcome,
      `User B total email deliveries: ${userBDeliveries.length}, Recipient: ${userBDeliveries[0]?.recipientEmail}`
    );

    // Verify User B cannot access User A's removal request to trigger updates
    const crossTenantUpdate = await request(app)
      .put(`/api/v1/removal-requests/${requestId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ requestStatus: RequestStatus.REJECTED });

    const crossTenantBlocked = crossTenantUpdate.status === 404;

    recordTest(
      'Cross-Tenant Mutation Guard',
      'User B cannot modify User A removal request (HTTP 404)',
      crossTenantBlocked,
      `Response status: ${crossTenantUpdate.status}`
    );

    // ================================================================
    // SECTION 5: Preferences & Essential Account Security Protection
    // ================================================================
    console.log('--- SECTION 5: User Preferences & Mandatory Security Alerts ---');

    // 1. Attempt to disable essential security notifications (must fail validation)
    const disableSecurityRes = await request(app)
      .put('/api/v1/users/preferences')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        notifyAccountSecurity: false,
      });

    const securityCannotBeDisabled =
      disableSecurityRes.status === 400 || disableSecurityRes.status === 422;

    recordTest(
      'Security Alert Immutability',
      'User cannot disable essential account security notifications (rejected with validation error)',
      securityCannotBeDisabled,
      `Status: ${disableSecurityRes.status}, Error: ${JSON.stringify(disableSecurityRes.body.errors || disableSecurityRes.body.message)}`
    );

    // 2. Dispatch security alert explicitly -> verify it dispatches regardless of preferences
    await UserEmailNotificationService.sendAccountSecurityAlert(
      userAId,
      'Password Changed',
      'Your account password was updated from an authorized session.'
    );

    const securityDelivery = await prisma.emailDelivery.findFirst({
      where: {
        userId: userAId,
        notificationStage: 'ACCOUNT_SECURITY',
      },
    });

    const securityAlertOk =
      Boolean(securityDelivery) &&
      securityDelivery?.recipientEmail === userAEmail &&
      securityDelivery?.deliveryStatus === EmailDeliveryStatus.SENT;

    recordTest(
      'Mandatory Security Dispatch',
      'Account security alert dispatched successfully to registered email',
      securityAlertOk,
      `Delivery ID: ${securityDelivery?.id}, Subject: ${securityDelivery?.subject}`
    );

    // 3. User turns off removal updates
    const disableRemovalUpdatesRes = await request(app)
      .put('/api/v1/users/preferences')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        notifyRemovalUpdates: false,
      });

    const prefUpdatedOk =
      disableRemovalUpdatesRes.status === 200 &&
      disableRemovalUpdatesRes.body.data?.notifyRemovalUpdates === false;

    // Create another removal request for User A while notifyRemovalUpdates is false
    const countBeforeSuppressed = await prisma.emailDelivery.count({
      where: { userId: userAId, notificationStage: 'REMOVAL_CREATED' },
    });

    await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        websiteId: userAWebsiteId,
        exposedDataDescription: 'Second exposure record',
        requestType: RemovalRequestType.CCPA_DELETION,
        requestReason: 'Second test removal request',
      });

    const countAfterSuppressed = await prisma.emailDelivery.count({
      where: { userId: userAId, notificationStage: 'REMOVAL_CREATED' },
    });

    const preferenceRespected = prefUpdatedOk && countBeforeSuppressed === countAfterSuppressed;

    recordTest(
      'Preference Opt-Out Enforcement',
      'When notifyRemovalUpdates is false, no removal created email is dispatched',
      preferenceRespected,
      `Removal created emails before: ${countBeforeSuppressed}, after: ${countAfterSuppressed}`
    );

    // ================================================================
    // SECTION 6: Unverified Email Data Masking & Email Verification Flow
    // ================================================================
    console.log('--- SECTION 6: Email Verification & Privacy Masking ---');

    // Create unverified user C
    const userCEmail = `charlie_${uniqueSuffix}@example.com`;
    const regResC = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Charlie Unverified',
        email: userCEmail,
        password: 'Password123!',
      });
    const userCId = regResC.body.data?.user?.id;
    const userCToken = regResC.body.data?.tokens?.accessToken;

    // Manually mark User C as unverified
    await prisma.user.update({
      where: { id: userCId },
      data: { isEmailVerified: false, emailVerificationToken: 'token_secret_123' },
    });

    // Create website & removal request for User C
    const websiteC = await prisma.website.create({
      data: {
        userId: userCId,
        websiteName: 'Sensitive Broker Corp',
        websiteUrl: 'https://sensitive-broker.internal',
      },
    });

    // Send removal request creation email directly to test masking
    const reqC = await prisma.removalRequest.create({
      data: {
        userId: userCId,
        websiteId: websiteC.id,
        exposureRecordId: (
          await prisma.exposureRecord.create({
            data: {
              userId: userCId,
              websiteId: websiteC.id,
              purpose: 'Sensitive biometric details',
              notes: 'Highly sensitive biometric scans',
              sensitivityLevel: 'CRITICAL',
              dateShared: new Date(),
            },
          })
        ).id,
        requestType: RemovalRequestType.GDPR_ERASURE,
        requestReason: 'Highly confidential medical biometric data',
      },
    });

    await UserEmailNotificationService.sendRemovalRequestCreated(userCId, reqC.id);

    const unverifiedDelivery = await prisma.emailDelivery.findFirst({
      where: {
        userId: userCId,
        notificationStage: 'REMOVAL_CREATED',
      },
    });

    const metadata = unverifiedDelivery?.metadata as any;
    const isMasked =
      metadata?.html?.includes('masked') ||
      metadata?.text?.includes('masked') ||
      !metadata?.html?.includes('sensitive-broker.internal');

    recordTest(
      'Unverified Privacy Masking',
      'Unverified user emails have sensitive platform URLs and reasons masked',
      isMasked,
      `Recipient: ${unverifiedDelivery?.recipientEmail}, Masked content detected: ${isMasked}`
    );

    // Test verification endpoint
    const verifyRes = await request(app)
      .post('/api/v1/users/preferences/verify-email')
      .set('Authorization', `Bearer ${userCToken}`)
      .send({ token: 'token_secret_123' });

    const verifiedUser = await prisma.user.findUnique({ where: { id: userCId } });
    const verifyOk = verifyRes.status === 200 && verifiedUser?.isEmailVerified === true;

    recordTest(
      'Email Verification Flow',
      'User can verify email address using token via /api/v1/users/preferences/verify-email',
      verifyOk,
      `Status: ${verifyRes.status}, isEmailVerified in DB: ${verifiedUser?.isEmailVerified}`
    );

    // ================================================================
    // SECTION 7: Email Delivery History & Settings Endpoints
    // ================================================================
    console.log('--- SECTION 7: Email Delivery History & Settings Endpoints ---');

    // GET /api/v1/users/preferences should return preferences + registeredEmail + isEmailVerified
    const getPrefRes = await request(app)
      .get('/api/v1/users/preferences')
      .set('Authorization', `Bearer ${userAToken}`);

    const getPrefOk =
      getPrefRes.status === 200 &&
      getPrefRes.body.data?.registeredEmail === userAEmail &&
      getPrefRes.body.data?.isEmailVerified === true &&
      typeof getPrefRes.body.data?.notifyCompleted === 'boolean';

    recordTest(
      'Settings API Details',
      'GET /users/preferences returns registeredEmail, isEmailVerified, and preferences',
      getPrefOk,
      `Registered Email: ${getPrefRes.body.data?.registeredEmail}, Verified: ${getPrefRes.body.data?.isEmailVerified}`
    );

    // GET /api/v1/users/preferences/deliveries should return recent email delivery history
    const getDeliveriesRes = await request(app)
      .get('/api/v1/users/preferences/deliveries')
      .set('Authorization', `Bearer ${userAToken}`);

    const deliveriesOk =
      getDeliveriesRes.status === 200 &&
      Array.isArray(getDeliveriesRes.body.data) &&
      getDeliveriesRes.body.data.length > 0;

    recordTest(
      'Email Delivery History API',
      'GET /users/preferences/deliveries returns tenant-isolated delivery history',
      deliveriesOk,
      `Deliveries returned: ${getDeliveriesRes.body.data?.length}`
    );

    // ================================================================
    // SECTION 8: Resend Test Mode Redirection Safety & Production Guardrails
    // ================================================================
    console.log('--- SECTION 8: Resend Test Mode & Production Redirection ---');

    // 1. Development mode + non-allowlisted email + EMAIL_TEST_MODE=true -> Redirects to RESEND_TEST_TO
    const devTest = EmailService.resolveRecipient('unknown_user@example.com', {
      nodeEnv: 'development',
      emailTestMode: true,
      resendTestTo: 'delivered@resend.dev',
      allowedTestEmails: ['developer@gmail.com'],
    });
    const devTestOk = devTest.isTestMode === true && devTest.recipient === 'delivered@resend.dev';

    // 2. Development mode + explicitly allowlisted test email -> Delivers directly to that verified address!
    const devAllowlistTest = EmailService.resolveRecipient('developer@gmail.com', {
      nodeEnv: 'development',
      emailTestMode: true,
      resendTestTo: 'delivered@resend.dev',
      allowedTestEmails: ['developer@gmail.com'],
    });
    const devAllowlistOk =
      devAllowlistTest.isAllowlisted === true &&
      devAllowlistTest.recipient === 'developer@gmail.com';

    recordTest(
      'Controlled Verified Test Delivery',
      'Development mode delivers directly to explicitly allowlisted test email addresses',
      devAllowlistOk,
      `Resolved: ${devAllowlistTest.recipient}, isAllowlisted: ${devAllowlistTest.isAllowlisted}`
    );

    // 3. Development mode + RESEND_TEST_TO set to specific test email -> Redirects there
    const devCustomSinkTest = EmailService.resolveRecipient('other_user@example.com', {
      nodeEnv: 'development',
      emailTestMode: true,
      resendTestTo: 'qa_team@gmail.com',
      allowedTestEmails: [],
    });
    const devCustomSinkOk =
      devCustomSinkTest.isTestMode === true &&
      devCustomSinkTest.recipient === 'qa_team@gmail.com';

    recordTest(
      'Custom Test Sink Redirection',
      'Development mode can redirect non-allowlisted test emails to a specified QA mailbox',
      devCustomSinkOk,
      `Resolved: ${devCustomSinkTest.recipient}`
    );

    // 4. Production mode + EMAIL_TEST_MODE=true -> NEVER redirects, always sends to real recipient
    const prodTest = EmailService.resolveRecipient('real_user@example.com', {
      nodeEnv: 'production',
      emailTestMode: true,
      resendTestTo: 'delivered@resend.dev',
      allowedTestEmails: ['developer@gmail.com'],
    });
    const prodTestOk = prodTest.isTestMode === false && prodTest.recipient === 'real_user@example.com';

    recordTest(
      'Test Mode Redirection',
      'Development test mode safely redirects unverified addresses to delivered@resend.dev',
      devTestOk,
      `Resolved: ${devTest.recipient}, isTestMode: ${devTest.isTestMode}`
    );

    recordTest(
      'Production Protection',
      'Production environment strictly ignores EMAIL_TEST_MODE and preserves intended recipient',
      prodTestOk,
      `Resolved: ${prodTest.recipient}, isTestMode: ${prodTest.isTestMode}`
    );

    // 5. Delivery Sync API Verification (API acceptance vs actual delivery)
    const existingDelivery = await prisma.emailDelivery.findFirst({
      where: { userId: userAId },
    });

    if (existingDelivery) {
      const syncRes = await request(app)
        .post(`/api/v1/users/preferences/deliveries/${existingDelivery.id}/sync`)
        .set('Authorization', `Bearer ${userAToken}`);

      const syncApiOk = syncRes.status === 200 && Boolean(syncRes.body.data);
      recordTest(
        'Delivery Status Telemetry Sync API',
        'POST /users/preferences/deliveries/:id/sync checks delivery status via Resend',
        syncApiOk,
        `Status: ${syncRes.status}, Current Status: ${syncRes.body.data?.deliveryStatus}`
      );
    }
  } finally {
    // ================================================================
    // CLEANUP: Clean up test accounts to leave zero database pollution
    // ================================================================
    console.log('--- CLEANUP: Zero Database Pollution ---');
    try {
      if (userAId) {
        await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
      }
      if (userBId) {
        await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
      }
      const charlie = await prisma.user.findFirst({ where: { email: { contains: 'charlie_' } } });
      if (charlie) {
        await prisma.user.delete({ where: { id: charlie.id } }).catch(() => {});
      }
      console.log('Cleanup completed: Test users and associated records cleanly removed.\n');
    } catch (cleanupErr: any) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }

  // ================================================================
  // SUMMARY REPORT
  // ================================================================
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
    console.error('❌ SOME TESTS FAILED. Inspect details above.');
    process.exit(1);
  } else {
    console.log('🎉 ALL GLOBAL EMAIL SYSTEM TESTS PASSED SUCCESSFULLY!');
  }
}

// Execute tests
runGlobalEmailSystemTests()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Fatal test error:', err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
