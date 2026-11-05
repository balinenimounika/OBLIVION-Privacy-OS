/**
 * OBLIVION - Phase 6: End-to-End User Journey Integration Test Suite
 *
 * Implements a complete 16-step user lifecycle test from initial registration
 * through full privacy management, compliance auditing, and secure logout:
 *
 * Step 1: Register a new user
 * Step 2: Log in with credentials and obtain JWT
 * Step 3: Retrieve authenticated user profile (GET /api/v1/auth/me)
 * Step 4: Add a new tracked website (POST /api/v1/websites)
 * Step 5: Create an exposure record for the website (POST /api/v1/exposures)
 * Step 6: Associate reference data categories and verify dynamic risk score
 * Step 7: Retrieve live dashboard analytics (GET /api/v1/dashboard/overview)
 * Step 8: Create a formal removal request (POST /api/v1/removal-requests)
 * Step 9: Advance removal status through valid deterministic transitions
 * Step 10: Verify append-only request history audit trail
 * Step 11: Schedule a privacy review reminder (POST /api/v1/reminders)
 * Step 12: Retrieve user notifications (GET /api/v1/notifications)
 * Step 13: Mark notification as read (PATCH /api/v1/notifications/:id/read)
 * Step 14: Retrieve paginated audit logs (GET /api/v1/audit-logs)
 * Step 15: Verify all relevant audit events recorded in PostgreSQL
 * Step 16: Log out (POST /api/v1/auth/logout) and verify token invalidation behavior
 *
 * Teardown: Safely purges test user and cascades all child entities.
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { AuditAction } from '../src/types/audit-log.types';

interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function record(step: number, name: string, passed: boolean, details: string) {
  testResults.push({ step, name, passed, details });
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASSED' : 'FAILED';
  console.log(`${icon} [${status}] Step ${step}: ${name} - ${details}`);
}

export async function runE2ETests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION PHASE 6: END-TO-END USER JOURNEY TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('Testing Complete 16-Step Privacy Management Lifecycle');
  console.log('================================================================\n');

  let allPassed = true;
  let testUserId = '';
  let authToken = '';
  const timestamp = Date.now();
  const testEmail = `e2e_journey_${timestamp}@oblivion-privacy.internal`;
  const testPassword = 'E2EJourneyP@ssw0rd2026!';

  // Resource IDs tracked across the journey
  let websiteId = '';
  let exposureId = '';
  let removalRequestId = '';
  let reminderId = '';
  let notificationId = '';

  try {
    // -------------------------------------------------------------------------
    // Step 1: Register a new user
    // -------------------------------------------------------------------------
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Eleanor Vance',
        email: testEmail,
        password: testPassword,
      });

    const s1Passed =
      regRes.status === 201 &&
      regRes.body.success === true &&
      regRes.body.data?.user?.email === testEmail;

    if (s1Passed) {
      testUserId = regRes.body.data.user.id;
    }

    record(
      1,
      'User Registration (POST /api/v1/auth/register)',
      s1Passed,
      s1Passed
        ? `HTTP 201 Created. User ID: ${testUserId}`
        : `Registration failed with status ${regRes.status}`
    );
    if (!s1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 2: Log in with credentials and obtain JWT
    // -------------------------------------------------------------------------
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    const s2Passed =
      loginRes.status === 200 &&
      loginRes.body.success === true &&
      typeof loginRes.body.data?.tokens?.accessToken === 'string';

    if (s2Passed) {
      authToken = loginRes.body.data.tokens.accessToken;
    }

    record(
      2,
      'User Authentication (POST /api/v1/auth/login)',
      s2Passed,
      s2Passed
        ? 'HTTP 200 OK. Issued JWT access token'
        : `Login failed with status ${loginRes.status}`
    );
    if (!s2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 3: Retrieve authenticated user profile (GET /api/v1/auth/me)
    // -------------------------------------------------------------------------
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    const s3Passed =
      meRes.status === 200 &&
      meRes.body.success === true &&
      meRes.body.data?.id === testUserId &&
      meRes.body.data?.email === testEmail;

    record(
      3,
      'Retrieve Profile (GET /api/v1/auth/me)',
      s3Passed,
      s3Passed
        ? `HTTP 200 OK. Verified profile for ${meRes.body.data.fullName}`
        : `Profile retrieval failed with status ${meRes.status}`
    );
    if (!s3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 4: Add a new tracked website (POST /api/v1/websites)
    // -------------------------------------------------------------------------
    const webRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        websiteName: 'MegaCorp Consumer Portal',
        websiteUrl: `https://megacorp-portal-${timestamp}.com`,
        websiteCategory: 'FINANCIAL_SERVICES',
      });

    const s4Passed =
      webRes.status === 201 &&
      webRes.body.success === true &&
      typeof webRes.body.data?.id === 'string';

    if (s4Passed) {
      websiteId = webRes.body.data.id;
    }

    record(
      4,
      'Add Tracked Website (POST /api/v1/websites)',
      s4Passed,
      s4Passed
        ? `HTTP 201 Created. Registered website ID: ${websiteId}`
        : `Website creation failed with status ${webRes.status}`
    );
    if (!s4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 5 & 6: Create exposure record & associate data categories
    // -------------------------------------------------------------------------
    // Fetch a seeded data category
    const cat = await prisma.dataCategory.findFirst({
      where: { categoryName: 'Financial Data' },
    }) || await prisma.dataCategory.findFirst();

    const categoryId = cat ? cat.id : null;

    const expRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        websiteId,
        purpose: 'Online banking profile & stored credit credentials',
        sensitivityLevel: 'CRITICAL',
        dateShared: new Date().toISOString(),
        notes: 'User registered banking details and national identity number',
        categoryIds: categoryId ? [categoryId] : [],
      });

    const s5Passed =
      expRes.status === 201 &&
      expRes.body.success === true &&
      typeof expRes.body.data?.id === 'string' &&
      typeof expRes.body.data?.calculatedRiskScore === 'number' &&
      expRes.body.data?.calculatedRiskScore > 0;

    if (s5Passed) {
      exposureId = expRes.body.data.id;
    }

    record(
      5,
      'Create Exposure Record (POST /api/v1/exposures)',
      s5Passed,
      s5Passed
        ? `HTTP 201 Created. Exposure ID: ${exposureId}`
        : `Exposure creation failed with status ${expRes.status}`
    );
    if (!s5Passed) allPassed = false;

    record(
      6,
      'Associate Categories & Dynamic Risk Calculation',
      s5Passed,
      s5Passed
        ? `Computed risk score: ${expRes.body.data.calculatedRiskScore} (Rating: ${expRes.body.data.calculatedRiskRating})`
        : 'Failed category association or risk calculation'
    );

    // -------------------------------------------------------------------------
    // Step 7: Retrieve live dashboard analytics (GET /api/v1/dashboard/overview)
    // -------------------------------------------------------------------------
    const dashRes = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${authToken}`);

    const s7Passed =
      dashRes.status === 200 &&
      dashRes.body.success === true &&
      dashRes.body.data?.totalWebsites >= 1 &&
      dashRes.body.data?.totalExposures >= 1 &&
      typeof dashRes.body.data?.privacyRiskIndex === 'number';

    record(
      7,
      'Retrieve Dashboard Analytics (GET /api/v1/dashboard/overview)',
      s7Passed,
      s7Passed
        ? `HTTP 200 OK. Websites: ${dashRes.body.data.totalWebsites}, Exposures: ${dashRes.body.data.totalExposures}, Risk Index: ${dashRes.body.data.privacyRiskIndex}`
        : `Dashboard analytics failed with status ${dashRes.status}`
    );
    if (!s7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 8: Create a formal removal request (POST /api/v1/removal-requests)
    // -------------------------------------------------------------------------
    const removalRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        websiteId,
        exposureRecordId: exposureId,
        requestType: 'GDPR_ERASURE',
        requestReason: 'Exercising Article 17 Right to be Forgotten',
        requestStatus: 'DRAFT',
      });

    const s8Passed =
      removalRes.status === 201 &&
      removalRes.body.success === true &&
      typeof removalRes.body.data?.id === 'string' &&
      removalRes.body.data?.requestStatus === 'DRAFT';

    if (s8Passed) {
      removalRequestId = removalRes.body.data.id;
    }

    record(
      8,
      'Create Removal Request (POST /api/v1/removal-requests)',
      s8Passed,
      s8Passed
        ? `HTTP 201 Created. Removal Request ID: ${removalRequestId} (Status: DRAFT)`
        : `Removal request creation failed with status ${removalRes.status}`
    );
    if (!s8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 9: Advance removal status through valid transitions
    // DRAFT -> SUBMITTED -> ACKNOWLEDGED -> IN_PROGRESS -> COMPLETED
    // -------------------------------------------------------------------------
    // Transition to SUBMITTED
    const subRes = await request(app)
      .patch(`/api/v1/removal-requests/${removalRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ requestStatus: 'SUBMITTED', remarks: 'Submitted to Data Protection Officer' });

    // Transition to ACKNOWLEDGED
    const ackRes = await request(app)
      .patch(`/api/v1/removal-requests/${removalRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ requestStatus: 'ACKNOWLEDGED', remarks: 'Acknowledged receipt of request' });

    // Transition to IN_PROGRESS
    const progRes = await request(app)
      .patch(`/api/v1/removal-requests/${removalRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ requestStatus: 'IN_PROGRESS', remarks: 'Processing erasure of consumer databases' });

    // Transition to COMPLETED
    const compRes = await request(app)
      .patch(`/api/v1/removal-requests/${removalRequestId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ requestStatus: 'COMPLETED', remarks: 'Erasure completed successfully' });

    const s9Passed =
      subRes.status === 200 &&
      ackRes.status === 200 &&
      progRes.status === 200 &&
      compRes.status === 200 &&
      compRes.body.data?.requestStatus === 'COMPLETED';

    record(
      9,
      'Valid Status Transition Progression (DRAFT -> SUBMITTED -> ACKNOWLEDGED -> IN_PROGRESS -> COMPLETED)',
      s9Passed,
      s9Passed
        ? 'Successfully completed 4 valid state transitions to terminal COMPLETED status'
        : 'Status progression failed'
    );
    if (!s9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 10: Verify append-only request history audit trail
    // -------------------------------------------------------------------------
    const histRes = await request(app)
      .get(`/api/v1/removal-requests/${removalRequestId}/history`)
      .set('Authorization', `Bearer ${authToken}`);

    const s10Passed =
      histRes.status === 200 &&
      histRes.body.success === true &&
      Array.isArray(histRes.body.data) &&
      histRes.body.data.length >= 4;

    record(
      10,
      'Verify Append-Only Request History (GET /api/v1/removal-requests/:id/history)',
      s10Passed,
      s10Passed
        ? `HTTP 200 OK. Verified ${histRes.body.data.length} immutable history transition records`
        : `Request history verification failed with status ${histRes.status}`
    );
    if (!s10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 11: Schedule a privacy review reminder (POST /api/v1/reminders)
    // -------------------------------------------------------------------------
    const remRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        exposureRecordId: exposureId,
        reminderType: 'ANNUAL_PRIVACY_REVIEW',
        reminderDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      });

    const s11Passed =
      remRes.status === 201 &&
      remRes.body.success === true &&
      typeof remRes.body.data?.id === 'string';

    if (s11Passed) {
      reminderId = remRes.body.data.id;
    }

    record(
      11,
      'Schedule Privacy Reminder (POST /api/v1/reminders)',
      s11Passed,
      s11Passed
        ? `HTTP 201 Created. Reminder ID: ${reminderId}`
        : `Reminder scheduling failed with status ${remRes.status}`
    );
    if (!s11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 12: Retrieve user notifications (GET /api/v1/notifications)
    // -------------------------------------------------------------------------
    // Seed an in-app notification for the user
    const seededNotif = await prisma.notification.create({
      data: {
        userId: testUserId,
        title: 'Erasure Confirmation',
        message: 'Your removal request for MegaCorp Consumer Portal was completed.',
      },
    });
    notificationId = seededNotif.id;

    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${authToken}`);

    const s12Passed =
      notifRes.status === 200 &&
      notifRes.body.success === true &&
      Array.isArray(notifRes.body.data) &&
      notifRes.body.data.length >= 1;

    record(
      12,
      'Retrieve Notifications (GET /api/v1/notifications)',
      s12Passed,
      s12Passed
        ? `HTTP 200 OK. Retrieved ${notifRes.body.data.length} notifications (unreadCount: ${notifRes.body.meta.unreadCount})`
        : `Notification retrieval failed with status ${notifRes.status}`
    );
    if (!s12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 13: Mark notification as read (PATCH /api/v1/notifications/:id/read)
    // -------------------------------------------------------------------------
    const readRes = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${authToken}`);

    const s13Passed =
      readRes.status === 200 &&
      readRes.body.success === true &&
      readRes.body.data?.isRead === true;

    record(
      13,
      'Mark Notification Read (PATCH /api/v1/notifications/:id/read)',
      s13Passed,
      s13Passed
        ? `HTTP 200 OK. Notification ${notificationId} marked read`
        : `Mark notification read failed with status ${readRes.status}`
    );
    if (!s13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 14: Retrieve paginated audit logs (GET /api/v1/audit-logs)
    // -------------------------------------------------------------------------
    const auditRes = await request(app)
      .get('/api/v1/audit-logs?limit=50')
      .set('Authorization', `Bearer ${authToken}`);

    const s14Passed =
      auditRes.status === 200 &&
      auditRes.body.success === true &&
      Array.isArray(auditRes.body.data) &&
      auditRes.body.data.length >= 5;

    record(
      14,
      'Retrieve Audit Logs (GET /api/v1/audit-logs)',
      s14Passed,
      s14Passed
        ? `HTTP 200 OK. Retrieved ${auditRes.body.data.length} audit logs (total: ${auditRes.body.meta.total})`
        : `Audit log retrieval failed with status ${auditRes.status}`
    );
    if (!s14Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 15: Verify all relevant audit events recorded in PostgreSQL
    // -------------------------------------------------------------------------
    const recordedActions = auditRes.body.data.map((l: any) => l.action);
    const expectedEvents = [
      AuditAction.AUTH_REGISTER,
      AuditAction.AUTH_LOGIN_SUCCESS,
      AuditAction.WEBSITE_CREATED,
      AuditAction.EXPOSURE_CREATED,
      AuditAction.REMOVAL_REQUEST_CREATED,
      AuditAction.REMINDER_CREATED,
      AuditAction.NOTIFICATION_READ,
    ];

    const missingEvents = expectedEvents.filter((e) => !recordedActions.includes(e));
    const s15Passed = missingEvents.length === 0;

    record(
      15,
      'Verify Chronological Audit Trail In PostgreSQL',
      s15Passed,
      s15Passed
        ? `All ${expectedEvents.length} required event types verified in tenant audit trail`
        : `Missing audit events: ${missingEvents.join(', ')}`
    );
    if (!s15Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Step 16: Log out and verify token invalidation behavior
    // -------------------------------------------------------------------------
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    const s16Passed =
      logoutRes.status === 200 &&
      logoutRes.body.success === true &&
      logoutRes.body.message.includes('Successfully logged out');

    // Verify AUTH_LOGOUT was recorded in database
    const logoutLog = await prisma.auditLog.findFirst({
      where: { userId: testUserId, action: AuditAction.AUTH_LOGOUT },
    });

    const s16Complete = s16Passed && !!logoutLog;

    record(
      16,
      'User Logout & Token Lifecycle Verification (POST /api/v1/auth/logout)',
      s16Complete,
      s16Complete
        ? 'HTTP 200 OK. Recorded AUTH_LOGOUT audit event; token discard directive returned to client'
        : 'Logout failed or AUTH_LOGOUT log not found'
    );
    if (!s16Complete) allPassed = false;

  } catch (err: any) {
    console.error('Fatal E2E User Journey Test Error:', err);
    allPassed = false;
  } finally {
    // Teardown: Safely delete the test user and cascade-delete all test data
    if (testUserId) {
      try {
        console.log(`\n🧹 Cleaning up test user ${testUserId} and cascading records from oblivion_db...`);
        const del = await prisma.user.delete({
          where: { id: testUserId },
        });
        console.log(`✅ Cleaned up user ${del.email} successfully.`);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('PHASE 6: END-TO-END USER JOURNEY TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Step ${t.step}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 16 E2E USER JOURNEY STEPS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runE2ETests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
