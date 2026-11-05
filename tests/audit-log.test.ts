/**
 * OBLIVION - Phase 5: Centralized Audit Logging & Compliance Integration Test Suite
 *
 * Verifies 20 comprehensive audit logging and compliance specifications:
 * 1. Automatic AUTH_REGISTER logging on user registration
 * 2. Automatic AUTH_LOGIN_SUCCESS logging on valid login
 * 3. Automatic AUTH_LOGIN_FAILED logging on bad password (without leaking password)
 * 4. Graceful handling of login attempt with unknown email (no DB crash/FK violation)
 * 5. Automatic WEBSITE_CREATED, WEBSITE_UPDATED, and WEBSITE_DELETED logging
 * 6. Automatic EXPOSURE_CREATED, EXPOSURE_UPDATED, and EXPOSURE_DELETED logging
 * 7. Automatic REMOVAL_REQUEST_CREATED and REMOVAL_STATUS_UPDATED logging
 * 8. Automatic REMINDER_CREATED, REMINDER_UPDATED, and REMINDER_DELETED logging
 * 9. Automatic NOTIFICATION_READ and NOTIFICATIONS_ALL_READ logging
 * 10. Paginated retrieval (GET /api/v1/audit-logs) with meta
 * 11. Filtering by action query parameter
 * 12. Filtering by entityType query parameter
 * 13. Date range filtering (startDate / endDate)
 * 14. Single audit log retrieval by ID (GET /api/v1/audit-logs/:id)
 * 15. Multi-tenant isolation: User A cannot view User B's audit log by ID (404)
 * 16. Multi-tenant isolation: User A's list never includes User B's logs
 * 17. Compliance Summary endpoint (GET /api/v1/audit-logs/summary)
 * 18. GDPR Article 15 / CCPA Right of Access Export (GET /api/v1/audit-logs/export)
 * 19. Fault-tolerance: Audit service failures do not crash business logic
 * 20. Privacy Verification: Zero passwords, hashes, secrets, or JWTs stored in audit_logs
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';
import { AuditLogService } from '../src/services/audit-log.service';
import { AuditAction, AuditEntityType } from '../src/types/audit-log.types';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function record(num: number, name: string, passed: boolean, details: string) {
  testResults.push({ num, name, passed, details });
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASSED' : 'FAILED';
  console.log(`${icon} [${status}] Test ${num}: ${name} - ${details}`);
}

export async function runAuditLogTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION PHASE 5: AUDIT LOGGING & COMPLIANCE TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const passwordValid = 'SecureAuditP@ss2026!';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice (Primary Tenant) and Bob (Cross Tenant)
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Audit Tenant',
      email: `alice_audit_${timestamp}@oblivion.internal`,
      password: passwordValid,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Audit Cross Tenant',
      email: `bob_audit_${timestamp}@oblivion.internal`,
      password: passwordValid,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Get an existing seeded DataCategory for exposure records
    const category = await prisma.dataCategory.findFirst();
    const categoryId = category ? category.id : null;

    // -------------------------------------------------------------------------
    // Test 1: Automatic AUTH_REGISTER logging
    // -------------------------------------------------------------------------
    const registerLog = await prisma.auditLog.findFirst({
      where: {
        userId: aliceId,
        action: AuditAction.AUTH_REGISTER,
        entityType: AuditEntityType.USER,
        entityId: aliceId,
      },
    });
    const t1Passed = !!registerLog;
    record(
      1,
      'Automatic AUTH_REGISTER logging on registration',
      t1Passed,
      t1Passed
        ? `Found registration audit log with ID: ${registerLog?.id}`
        : 'No AUTH_REGISTER log found in PostgreSQL'
    );
    if (!t1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 2: Automatic AUTH_LOGIN_SUCCESS logging
    // -------------------------------------------------------------------------
    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: `alice_audit_${timestamp}@oblivion.internal`,
        password: passwordValid,
      });

    const loginSuccessLog = await prisma.auditLog.findFirst({
      where: {
        userId: aliceId,
        action: AuditAction.AUTH_LOGIN_SUCCESS,
      },
    });
    const t2Passed = !!loginSuccessLog;
    record(
      2,
      'Automatic AUTH_LOGIN_SUCCESS logging on valid credentials',
      t2Passed,
      t2Passed
        ? `Found login success log: ${loginSuccessLog?.id}`
        : 'No AUTH_LOGIN_SUCCESS log recorded'
    );
    if (!t2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 3: Automatic AUTH_LOGIN_FAILED logging (without leaking password)
    // -------------------------------------------------------------------------
    const wrongPassword = 'CompletelyWrongPassword123!';
    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: `alice_audit_${timestamp}@oblivion.internal`,
        password: wrongPassword,
      });

    const loginFailedLog = await prisma.auditLog.findFirst({
      where: {
        userId: aliceId,
        action: AuditAction.AUTH_LOGIN_FAILED,
      },
      orderBy: { createdAt: 'desc' },
    });

    const t3Passed = !!loginFailedLog;
    record(
      3,
      'Automatic AUTH_LOGIN_FAILED logging on incorrect password',
      t3Passed,
      t3Passed
        ? `Recorded login failure log: ${loginFailedLog?.id}`
        : 'AUTH_LOGIN_FAILED log missing'
    );
    if (!t3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 4: Graceful handling of login attempt with unknown email
    // -------------------------------------------------------------------------
    const unknownRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: `nonexistent_user_${timestamp}@oblivion.internal`,
        password: 'AnyPassword!',
      });

    const t4Passed = unknownRes.status === 401 && unknownRes.body.success === false;
    record(
      4,
      'Graceful login failure for unknown email (no DB crash / FK violation)',
      t4Passed,
      t4Passed
        ? 'Returned 401 Unauthorized without crashing or violating DB constraints'
        : `Unexpected status: ${unknownRes.status}`
    );
    if (!t4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 5: Automatic WEBSITE CRUD audit logging
    // -------------------------------------------------------------------------
    // Create website
    const createWebRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Audit Test Corp',
        websiteUrl: `https://audit-test-${timestamp}.example.com`,
        websiteCategory: 'SOCIAL_MEDIA',
      });
    const websiteId = createWebRes.body.data.id;

    // Update website
    await request(app)
      .patch(`/api/v1/websites/${websiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ websiteName: 'Audit Test Corp Renamed' });

    // Delete website
    await request(app)
      .delete(`/api/v1/websites/${websiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const [webCreateLog, webUpdateLog, webDeleteLog] = await Promise.all([
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.WEBSITE_CREATED, entityId: websiteId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.WEBSITE_UPDATED, entityId: websiteId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.WEBSITE_DELETED, entityId: websiteId } }),
    ]);

    const t5Passed = !!(webCreateLog && webUpdateLog && webDeleteLog);
    record(
      5,
      'Automatic WEBSITE_CREATED, WEBSITE_UPDATED, and WEBSITE_DELETED logging',
      t5Passed,
      t5Passed
        ? 'All 3 website lifecycle events verified in audit_logs'
        : `Missing: ${!webCreateLog ? 'CREATE ' : ''}${!webUpdateLog ? 'UPDATE ' : ''}${!webDeleteLog ? 'DELETE' : ''}`
    );
    if (!t5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Provision fresh website for exposure & removal request tests
    // -------------------------------------------------------------------------
    const activeWebRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Privacy Exposure Host',
        websiteUrl: `https://exposure-host-${timestamp}.example.org`,
        websiteCategory: 'E_COMMERCE',
      });
    const activeWebsiteId = activeWebRes.body.data.id;

    // -------------------------------------------------------------------------
    // Test 6: Automatic EXPOSURE CRUD audit logging
    // -------------------------------------------------------------------------
    // Create exposure
    const createExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: activeWebsiteId,
        purpose: 'Audit test exposure tracking',
        sensitivityLevel: 'HIGH',
        dateShared: new Date().toISOString(),
        categoryIds: categoryId ? [categoryId] : [],
      });
    const exposureId = createExpRes.body.data.id;

    // Update exposure
    await request(app)
      .patch(`/api/v1/exposures/${exposureId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ purpose: 'Audit test exposure tracking updated' });

    // Create a temporary exposure to test delete
    const tempExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: activeWebsiteId,
        purpose: 'Temporary exposure to be deleted',
        sensitivityLevel: 'LOW',
        dateShared: new Date().toISOString(),
      });
    const tempExposureId = tempExpRes.body.data.id;

    // Delete temporary exposure
    await request(app)
      .delete(`/api/v1/exposures/${tempExposureId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const [expCreateLog, expUpdateLog, expDeleteLog] = await Promise.all([
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.EXPOSURE_CREATED, entityId: exposureId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.EXPOSURE_UPDATED, entityId: exposureId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.EXPOSURE_DELETED, entityId: tempExposureId } }),
    ]);

    const t6Passed = !!(expCreateLog && expUpdateLog && expDeleteLog);
    record(
      6,
      'Automatic EXPOSURE_CREATED, EXPOSURE_UPDATED, and EXPOSURE_DELETED logging',
      t6Passed,
      t6Passed
        ? 'All 3 exposure lifecycle events verified in audit_logs'
        : `Missing: ${!expCreateLog ? 'CREATE ' : ''}${!expUpdateLog ? 'UPDATE ' : ''}${!expDeleteLog ? 'DELETE' : ''}`
    );
    if (!t6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 7: Automatic REMOVAL REQUEST audit logging
    // -------------------------------------------------------------------------
    const createReqRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: activeWebsiteId,
        exposureRecordId: exposureId,
        requestType: 'GDPR_ERASURE',
        requestReason: 'Compliance audit test',
        requestStatus: 'DRAFT',
      });
    const removalRequestId = createReqRes.body.data.id;

    // Transition status to SUBMITTED
    await request(app)
      .patch(`/api/v1/removal-requests/${removalRequestId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestStatus: 'SUBMITTED',
        remarks: 'Submitting erasure request for testing',
      });

    const [reqCreateLog, reqStatusLog] = await Promise.all([
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.REMOVAL_REQUEST_CREATED, entityId: removalRequestId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.REMOVAL_STATUS_UPDATED, entityId: removalRequestId } }),
    ]);

    const t7Passed = !!(reqCreateLog && reqStatusLog);
    record(
      7,
      'Automatic REMOVAL_REQUEST_CREATED and REMOVAL_STATUS_UPDATED logging',
      t7Passed,
      t7Passed
        ? 'Both removal request creation and status update verified in audit_logs'
        : `Missing: ${!reqCreateLog ? 'CREATE ' : ''}${!reqStatusLog ? 'STATUS_UPDATE' : ''}`
    );
    if (!t7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 8: Automatic REMINDER audit logging
    // -------------------------------------------------------------------------
    const createRemRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        exposureRecordId: exposureId,
        reminderType: 'ANNUAL_PRIVACY_REVIEW',
        reminderDate: new Date(Date.now() + 86400000).toISOString(),
      });
    const reminderId = createRemRes.body.data.id;

    // Update reminder
    await request(app)
      .patch(`/api/v1/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ reminderStatus: 'SNOOZED' });

    // Delete reminder
    await request(app)
      .delete(`/api/v1/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const [remCreateLog, remUpdateLog, remDeleteLog] = await Promise.all([
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.REMINDER_CREATED, entityId: reminderId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.REMINDER_UPDATED, entityId: reminderId } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.REMINDER_DELETED, entityId: reminderId } }),
    ]);

    const t8Passed = !!(remCreateLog && remUpdateLog && remDeleteLog);
    record(
      8,
      'Automatic REMINDER_CREATED, REMINDER_UPDATED, and REMINDER_DELETED logging',
      t8Passed,
      t8Passed
        ? 'All 3 reminder lifecycle events verified in audit_logs'
        : `Missing: ${!remCreateLog ? 'CREATE ' : ''}${!remUpdateLog ? 'UPDATE ' : ''}${!remDeleteLog ? 'DELETE' : ''}`
    );
    if (!t8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 9: Automatic NOTIFICATION audit logging
    // -------------------------------------------------------------------------
    // Create notifications for Alice directly in DB
    const notif1 = await prisma.notification.create({
      data: {
        userId: aliceId,
        title: 'Audit Alert 1',
        message: 'Security event notice',
      },
    });
    await prisma.notification.create({
      data: {
        userId: aliceId,
        title: 'Audit Alert 2',
        message: 'Reminder notification',
      },
    });

    // Mark single notification read
    await request(app)
      .patch(`/api/v1/notifications/${notif1.id}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Mark all notifications read
    await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${aliceToken}`);

    const [notifReadLog, notifAllReadLog] = await Promise.all([
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.NOTIFICATION_READ, entityId: notif1.id } }),
      prisma.auditLog.findFirst({ where: { userId: aliceId, action: AuditAction.NOTIFICATIONS_ALL_READ, entityId: aliceId } }),
    ]);

    const t9Passed = !!(notifReadLog && notifAllReadLog);
    record(
      9,
      'Automatic NOTIFICATION_READ and NOTIFICATIONS_ALL_READ logging',
      t9Passed,
      t9Passed
        ? 'Both single and bulk notification read events verified in audit_logs'
        : `Missing: ${!notifReadLog ? 'READ ' : ''}${!notifAllReadLog ? 'ALL_READ' : ''}`
    );
    if (!t9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 10: Paginated retrieval (GET /api/v1/audit-logs)
    // -------------------------------------------------------------------------
    const listRes = await request(app)
      .get('/api/v1/audit-logs?page=1&limit=5')
      .set('Authorization', `Bearer ${aliceToken}`);

    const t10Passed =
      listRes.status === 200 &&
      listRes.body.success === true &&
      Array.isArray(listRes.body.data) &&
      listRes.body.data.length <= 5 &&
      listRes.body.meta.page === 1 &&
      listRes.body.meta.limit === 5 &&
      listRes.body.meta.total > 0;

    record(
      10,
      'Paginated retrieval (GET /api/v1/audit-logs) with metadata',
      t10Passed,
      t10Passed
        ? `Retrieved ${listRes.body.data.length} logs (total: ${listRes.body.meta.total})`
        : `Failed status ${listRes.status} or invalid pagination meta`
    );
    if (!t10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 11: Query filtering by action
    // -------------------------------------------------------------------------
    const actionFilterRes = await request(app)
      .get('/api/v1/audit-logs?action=WEBSITE_CREATED')
      .set('Authorization', `Bearer ${aliceToken}`);

    const t11Passed =
      actionFilterRes.status === 200 &&
      actionFilterRes.body.data.length > 0 &&
      actionFilterRes.body.data.every((l: any) => l.action.includes('WEBSITE_CREATED'));

    record(
      11,
      'Audit log filtering by action query parameter',
      t11Passed,
      t11Passed
        ? `Returned ${actionFilterRes.body.data.length} records matching action=WEBSITE_CREATED`
        : 'Filter by action failed or returned non-matching actions'
    );
    if (!t11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 12: Query filtering by entityType
    // -------------------------------------------------------------------------
    const entityFilterRes = await request(app)
      .get('/api/v1/audit-logs?entityType=ExposureRecord')
      .set('Authorization', `Bearer ${aliceToken}`);

    const t12Passed =
      entityFilterRes.status === 200 &&
      entityFilterRes.body.data.length > 0 &&
      entityFilterRes.body.data.every((l: any) => l.entityType === 'ExposureRecord');

    record(
      12,
      'Audit log filtering by entityType query parameter',
      t12Passed,
      t12Passed
        ? `Returned ${entityFilterRes.body.data.length} records matching entityType=ExposureRecord`
        : 'Filter by entityType failed or returned non-matching entity types'
    );
    if (!t12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 13: Date range filtering (startDate / endDate)
    // -------------------------------------------------------------------------
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const futureDate = new Date(Date.now() + 3600000).toISOString();

    const dateFilterRes = await request(app)
      .get(`/api/v1/audit-logs?startDate=${pastDate}&endDate=${futureDate}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const t13Passed =
      dateFilterRes.status === 200 &&
      dateFilterRes.body.data.length > 0;

    record(
      13,
      'Audit log filtering by date range (startDate / endDate)',
      t13Passed,
      t13Passed
        ? `Returned ${dateFilterRes.body.data.length} logs within date window`
        : `Date filter failed with status ${dateFilterRes.status}`
    );
    if (!t13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 14: Single audit log retrieval by ID
    // -------------------------------------------------------------------------
    const targetLogId = registerLog!.id;
    const singleLogRes = await request(app)
      .get(`/api/v1/audit-logs/${targetLogId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const t14Passed =
      singleLogRes.status === 200 &&
      singleLogRes.body.data.id === targetLogId &&
      singleLogRes.body.data.userId === aliceId;

    record(
      14,
      'Single audit log retrieval by ID (GET /api/v1/audit-logs/:id)',
      t14Passed,
      t14Passed
        ? `Successfully retrieved audit log: ${singleLogRes.body.data.id}`
        : `Failed status ${singleLogRes.status}`
    );
    if (!t14Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 15: Multi-Tenant Isolation: User A cannot read User B's audit log by ID (404)
    // -------------------------------------------------------------------------
    // Bob has registration audit log
    const bobRegisterLog = await prisma.auditLog.findFirst({
      where: { userId: bobId, action: AuditAction.AUTH_REGISTER },
    });

    const crossAccessRes = await request(app)
      .get(`/api/v1/audit-logs/${bobRegisterLog!.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const t15Passed = crossAccessRes.status === 404;
    record(
      15,
      "Multi-tenant isolation: User A cannot read User B's audit log by ID (404)",
      t15Passed,
      t15Passed
        ? 'Returned 404 Not Found (information disclosure prevented)'
        : `Security breach! Status was ${crossAccessRes.status}`
    );
    if (!t15Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 16: Multi-Tenant Isolation: User A's list never includes User B's logs
    // -------------------------------------------------------------------------
    const aliceFullListRes = await request(app)
      .get('/api/v1/audit-logs?limit=100')
      .set('Authorization', `Bearer ${aliceToken}`);

    const containsBobLog = aliceFullListRes.body.data.some((l: any) => l.userId === bobId);
    const t16Passed = aliceFullListRes.status === 200 && !containsBobLog;
    record(
      16,
      "Multi-tenant isolation: User A's audit list never contains User B's logs",
      t16Passed,
      t16Passed
        ? `Verified all ${aliceFullListRes.body.data.length} logs strictly belong to Alice (${aliceId})`
        : 'Tenant leakage detected in list response!'
    );
    if (!t16Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 17: Compliance Summary endpoint (GET /api/v1/audit-logs/summary)
    // -------------------------------------------------------------------------
    const summaryRes = await request(app)
      .get('/api/v1/audit-logs/summary')
      .set('Authorization', `Bearer ${aliceToken}`);

    const t17Passed =
      summaryRes.status === 200 &&
      summaryRes.body.success === true &&
      typeof summaryRes.body.data.totalEvents === 'number' &&
      summaryRes.body.data.totalEvents > 0 &&
      typeof summaryRes.body.data.actionBreakdown === 'object' &&
      typeof summaryRes.body.data.entityBreakdown === 'object' &&
      summaryRes.body.data.firstActivity !== null &&
      summaryRes.body.data.lastActivity !== null;

    record(
      17,
      'Compliance Summary endpoint (GET /api/v1/audit-logs/summary)',
      t17Passed,
      t17Passed
        ? `Summary reported ${summaryRes.body.data.totalEvents} total events across ${Object.keys(summaryRes.body.data.actionBreakdown).length} distinct action categories`
        : `Summary endpoint failed with status ${summaryRes.status}`
    );
    if (!t17Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 18: GDPR Article 15 / CCPA Right of Access Export (GET /api/v1/audit-logs/export)
    // -------------------------------------------------------------------------
    const exportRes = await request(app)
      .get('/api/v1/audit-logs/export')
      .set('Authorization', `Bearer ${aliceToken}`);

    const report = exportRes.body.data?.complianceReport;
    const t18Passed =
      exportRes.status === 200 &&
      exportRes.body.success === true &&
      report &&
      report.tenant?.userId === aliceId &&
      report.totalAuditEntries > 0 &&
      Array.isArray(report.auditLogs) &&
      report.auditLogs.length === report.totalAuditEntries;

    record(
      18,
      'GDPR Article 15 / CCPA Right of Access Export (GET /api/v1/audit-logs/export)',
      t18Passed,
      t18Passed
        ? `Exported compliance report with ${report?.totalAuditEntries} entries under ${report?.regulation}`
        : `Export endpoint failed with status ${exportRes.status}`
    );
    if (!t18Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 19: Fault-tolerance: Audit service failures do not crash business logic
    // -------------------------------------------------------------------------
    // Directly call record with an invalid userId that does not exist in PostgreSQL (violates FK)
    const faultResult = await AuditLogService.record({
      userId: '00000000-0000-0000-0000-000000000000', // Non-existent foreign key
      action: 'FAULT_TOLERANCE_TEST',
      entityType: 'TestEntity',
      entityId: 'fault-id',
    });

    const t19Passed = faultResult === null; // Handled gracefully and returned null instead of throwing
    record(
      19,
      'Fault-tolerance: Audit service failures do not disrupt primary flow',
      t19Passed,
      t19Passed
        ? 'Invalid database write was intercepted gracefully; returned null without uncaught exception'
        : 'Audit service did not handle database error gracefully'
    );
    if (!t19Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 20: Privacy & Credential Audit: No sensitive data stored in audit_logs
    // -------------------------------------------------------------------------
    const allAliceLogs = await prisma.auditLog.findMany({
      where: { userId: aliceId },
    });

    let foundLeak = false;
    for (const log of allAliceLogs) {
      const logString = JSON.stringify(log);
      if (
        logString.includes(passwordValid) ||
        logString.includes(wrongPassword) ||
        logString.includes(aliceToken)
      ) {
        foundLeak = true;
        break;
      }
    }

    const t20Passed = !foundLeak && allAliceLogs.length > 0;
    record(
      20,
      'Privacy & Credential Audit: Zero passwords, secrets, or JWTs stored in audit_logs',
      t20Passed,
      t20Passed
        ? `Audited ${allAliceLogs.length} PostgreSQL records; 0 credential leaks detected`
        : 'CRITICAL SECURITY DEFECT: Credential leak detected in audit_logs table!'
    );
    if (!t20Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Audit Log Test Error:', err);
    allPassed = false;
  } finally {
    // Teardown
    if (createdUserIds.length > 0) {
      try {
        console.log(`\n🧹 Cleaning up ${createdUserIds.length} test users from database...`);
        const del = await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
        console.log(`✅ Cleaned up ${del.count} test users (and cascade-deleted their audit logs).`);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('PHASE 5: AUDIT LOGGING & COMPLIANCE TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 20 AUDIT LOGGING TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runAuditLogTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
