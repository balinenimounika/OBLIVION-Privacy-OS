/**
 * OBLIVION - Phase 3 Multi-Tenant Security & Ownership Integration Tests
 *
 * Verifies strict tenant boundaries and ownership enforcement across all models:
 * 1. User A can access their own records
 * 2. User B can access their own records
 * 3. User A cannot retrieve User B's website (404)
 * 4. User A cannot update User B's website (404, DB unchanged)
 * 5. User A cannot delete User B's website (404, DB unchanged)
 * 6. User A cannot retrieve User B's exposure record (404)
 * 7. User A cannot access User B's removal requests (404)
 * 8. User A cannot access User B's reminders (404)
 * 9. User A cannot access User B's notifications (404)
 * 10. User A cannot access User B's audit logs (404)
 * 11. Nested relation ownership is enforced (categories & history)
 * 12. Injected userId fields are rejected or ignored safely
 * 13. Unauthenticated users cannot access protected resources (401)
 * 14. Deactivated accounts cannot access protected resources (403)
 *
 * Cleanup: Safely cleans up all test users and associated cascading records.
 */

import request from 'supertest';
import { AccountStatus, WebsiteCategory, SensitivityLevel, RecordStatus, ReminderType } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';
import { TenantSecurity } from '../src/utils/tenant-security';

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

async function runTenantSecurityTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION PHASE 3 MULTI-TENANT SECURITY INTEGRATION TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('Testing Strict Ownership & Tenant Boundary Isolation');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];

  const timestamp = Date.now();
  const password = 'TenantSecurity2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Create Two Isolated Users (User A = Alice, User B = Bob)
    // -------------------------------------------------------------------------
    console.log('👤 Provisioning Tenant A (Alice) and Tenant B (Bob)...');

    const userARes = await AuthService.register({
      fullName: 'Alice Tenant',
      email: `alice_tenant_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Tenant',
      email: `bob_tenant_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Retrieve a seeded reference data category
    const categories = await prisma.dataCategory.findMany({ take: 2 });
    if (categories.length === 0) {
      throw new Error('No reference data categories found in oblivion_db. Ensure database is seeded.');
    }
    const refCategory1 = categories[0];

    // Provision User A's test dataset
    console.log('📦 Seeding isolated dataset for Tenant A (Alice)...');
    const websiteA = await prisma.website.create({
      data: {
        userId: aliceId,
        websiteName: 'Alice Social Network',
        websiteUrl: `https://alice-social-${timestamp}.example.com`,
        websiteCategory: WebsiteCategory.SOCIAL_MEDIA,
      },
    });

    const exposureA = await prisma.exposureRecord.create({
      data: {
        userId: aliceId,
        websiteId: websiteA.id,
        purpose: 'Profile Registration',
        sensitivityLevel: SensitivityLevel.MEDIUM,
        dateShared: new Date(),
        recordStatus: RecordStatus.ACTIVE,
      },
    });

    const exposureCatA = await prisma.exposureRecordCategory.create({
      data: {
        exposureRecordId: exposureA.id,
        dataCategoryId: refCategory1.id,
      },
    });

    const removalA = await prisma.removalRequest.create({
      data: {
        userId: aliceId,
        websiteId: websiteA.id,
        exposureRecordId: exposureA.id,
        requestReason: 'GDPR Right to be Forgotten request',
        history: {
          create: {
            newStatus: 'DRAFT',
            remarks: 'Initiated by Alice',
          },
        },
      },
    });

    const reminderA = await prisma.reminder.create({
      data: {
        userId: aliceId,
        exposureRecordId: exposureA.id,
        reminderType: ReminderType.ANNUAL_PRIVACY_REVIEW,
        reminderDate: new Date(Date.now() + 86400000), // +1 day
      },
    });

    const notificationA = await prisma.notification.create({
      data: {
        userId: aliceId,
        title: 'Alice Welcome Alert',
        message: 'Your privacy audit is ready',
      },
    });

    const auditA = await prisma.auditLog.create({
      data: {
        userId: aliceId,
        action: 'WEBSITE_CREATED',
        entityType: 'Website',
        entityId: websiteA.id,
      },
    });

    // Provision User B's test dataset
    console.log('📦 Seeding isolated dataset for Tenant B (Bob)...\n');
    const websiteB = await prisma.website.create({
      data: {
        userId: bobId,
        websiteName: 'Bob Financial Portal',
        websiteUrl: `https://bob-financial-${timestamp}.example.com`,
        websiteCategory: WebsiteCategory.FINANCIAL_SERVICES,
      },
    });

    const exposureB = await prisma.exposureRecord.create({
      data: {
        userId: bobId,
        websiteId: websiteB.id,
        purpose: 'Tax & Banking Profile',
        sensitivityLevel: SensitivityLevel.CRITICAL,
        dateShared: new Date(),
        recordStatus: RecordStatus.ACTIVE,
      },
    });

    await prisma.exposureRecordCategory.create({
      data: {
        exposureRecordId: exposureB.id,
        dataCategoryId: refCategory1.id,
      },
    });

    const removalB = await prisma.removalRequest.create({
      data: {
        userId: bobId,
        websiteId: websiteB.id,
        exposureRecordId: exposureB.id,
        requestReason: 'Bob Account Deletion',
        history: {
          create: {
            newStatus: 'SUBMITTED',
            remarks: 'Submitted by Bob',
          },
        },
      },
    });

    const reminderB = await prisma.reminder.create({
      data: {
        userId: bobId,
        exposureRecordId: exposureB.id,
        reminderType: ReminderType.EXPIRY_CHECK,
        reminderDate: new Date(Date.now() + 172800000), // +2 days
      },
    });

    const notificationB = await prisma.notification.create({
      data: {
        userId: bobId,
        title: 'Bob Security Warning',
        message: 'Sensitive financial data detected',
      },
    });

    const auditB = await prisma.auditLog.create({
      data: {
        userId: bobId,
        action: 'FINANCIAL_EXPOSURE_LOGGED',
        entityType: 'ExposureRecord',
        entityId: exposureB.id,
      },
    });

    // -------------------------------------------------------------------------
    // TEST 1: User A can access their own records
    // -------------------------------------------------------------------------
    const resAWeb = await request(app)
      .get(`/api/v1/tenant/websites/${websiteA.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const resAExp = await request(app)
      .get(`/api/v1/tenant/exposure-records/${exposureA.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const resARem = await request(app)
      .get(`/api/v1/tenant/removal-requests/${removalA.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const resARmd = await request(app)
      .get(`/api/v1/tenant/reminders/${reminderA.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const resANot = await request(app)
      .get(`/api/v1/tenant/notifications/${notificationA.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const resAAud = await request(app)
      .get(`/api/v1/tenant/audit-logs/${auditA.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test1Passed =
      resAWeb.status === 200 &&
      resAWeb.body.data.id === websiteA.id &&
      resAExp.status === 200 &&
      resAExp.body.data.id === exposureA.id &&
      resARem.status === 200 &&
      resARmd.status === 200 &&
      resANot.status === 200 &&
      resAAud.status === 200;

    record(
      1,
      "User A Can Access Their Own Records",
      test1Passed,
      test1Passed
        ? "User A accessed own Website, Exposure, Removal Request, Reminder, Notification, and Audit Log with 200 OK"
        : `Access failure: Web=${resAWeb.status}, Exp=${resAExp.status}, Rem=${resARem.status}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: User B can access their own records
    // -------------------------------------------------------------------------
    const resBWeb = await request(app)
      .get(`/api/v1/tenant/websites/${websiteB.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const resBExp = await request(app)
      .get(`/api/v1/tenant/exposure-records/${exposureB.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const resBRem = await request(app)
      .get(`/api/v1/tenant/removal-requests/${removalB.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const resBRmd = await request(app)
      .get(`/api/v1/tenant/reminders/${reminderB.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const resBNot = await request(app)
      .get(`/api/v1/tenant/notifications/${notificationB.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const resBAud = await request(app)
      .get(`/api/v1/tenant/audit-logs/${auditB.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const test2Passed =
      resBWeb.status === 200 &&
      resBWeb.body.data.id === websiteB.id &&
      resBExp.status === 200 &&
      resBExp.body.data.id === exposureB.id &&
      resBRem.status === 200 &&
      resBRmd.status === 200 &&
      resBNot.status === 200 &&
      resBAud.status === 200;

    record(
      2,
      "User B Can Access Their Own Records",
      test2Passed,
      test2Passed
        ? "User B accessed own Website, Exposure, Removal Request, Reminder, Notification, and Audit Log with 200 OK"
        : `Access failure: Web=${resBWeb.status}, Exp=${resBExp.status}, Rem=${resBRem.status}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: User A cannot retrieve User B's website (404)
    // -------------------------------------------------------------------------
    const crossWebRes = await request(app)
      .get(`/api/v1/tenant/websites/${websiteB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test3Passed =
      crossWebRes.status === 404 &&
      crossWebRes.body.success === false &&
      crossWebRes.body.message === 'Website not found';

    record(
      3,
      "User A Cannot Retrieve User B's Website",
      test3Passed,
      test3Passed
        ? "HTTP 404 Not Found returned. Cross-tenant existence is not disclosed."
        : `Security Failure: Received status ${crossWebRes.status}`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: User A cannot update User B's website (404, DB unchanged)
    // -------------------------------------------------------------------------
    const crossUpdateRes = await request(app)
      .put(`/api/v1/tenant/websites/${websiteB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ websiteName: 'Attacker Tampered Name' });

    // Verify DB integrity
    const dbWebsiteBAfter = await prisma.website.findUnique({
      where: { id: websiteB.id },
    });

    const test4Passed =
      crossUpdateRes.status === 404 &&
      dbWebsiteBAfter?.websiteName === 'Bob Financial Portal';

    record(
      4,
      "User A Cannot Update User B's Website",
      test4Passed,
      test4Passed
        ? "HTTP 404 Not Found. Target database record unchanged ('Bob Financial Portal')."
        : `Tampering detected or unexpected status ${crossUpdateRes.status}`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: User A cannot delete User B's website (404, DB unchanged)
    // -------------------------------------------------------------------------
    const crossDeleteRes = await request(app)
      .delete(`/api/v1/tenant/websites/${websiteB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const dbWebsiteBStillExists = await prisma.website.findUnique({
      where: { id: websiteB.id },
    });

    const test5Passed =
      crossDeleteRes.status === 404 &&
      dbWebsiteBStillExists !== null;

    record(
      5,
      "User A Cannot Delete User B's Website",
      test5Passed,
      test5Passed
        ? "HTTP 404 Not Found. Record remains safely in database."
        : `Unauthorized deletion or unexpected status ${crossDeleteRes.status}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: User A cannot retrieve User B's exposure record (404)
    // -------------------------------------------------------------------------
    const crossExpRes = await request(app)
      .get(`/api/v1/tenant/exposure-records/${exposureB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test6Passed =
      crossExpRes.status === 404 &&
      crossExpRes.body.success === false &&
      crossExpRes.body.message === 'Exposure record not found';

    record(
      6,
      "User A Cannot Retrieve User B's Exposure Record",
      test6Passed,
      test6Passed
        ? "HTTP 404 Not Found returned for cross-tenant exposure record."
        : `Security breach: Status ${crossExpRes.status}`
    );
    if (!test6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: User A cannot access User B's removal requests (404)
    // -------------------------------------------------------------------------
    const crossRemRes = await request(app)
      .get(`/api/v1/tenant/removal-requests/${removalB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Passed =
      crossRemRes.status === 404 &&
      crossRemRes.body.message === 'Removal request not found';

    record(
      7,
      "User A Cannot Access User B's Removal Requests",
      test7Passed,
      test7Passed
        ? "HTTP 404 Not Found returned for cross-tenant removal request."
        : `Security breach: Status ${crossRemRes.status}`
    );
    if (!test7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: User A cannot access User B's reminders (404)
    // -------------------------------------------------------------------------
    const crossRmdRes = await request(app)
      .get(`/api/v1/tenant/reminders/${reminderB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test8Passed =
      crossRmdRes.status === 404 &&
      crossRmdRes.body.message === 'Reminder not found';

    record(
      8,
      "User A Cannot Access User B's Reminders",
      test8Passed,
      test8Passed
        ? "HTTP 404 Not Found returned for cross-tenant reminder."
        : `Security breach: Status ${crossRmdRes.status}`
    );
    if (!test8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: User A cannot access User B's notifications (404)
    // -------------------------------------------------------------------------
    const crossNotRes = await request(app)
      .get(`/api/v1/tenant/notifications/${notificationB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test9Passed =
      crossNotRes.status === 404 &&
      crossNotRes.body.message === 'Notification not found';

    record(
      9,
      "User A Cannot Access User B's Notifications",
      test9Passed,
      test9Passed
        ? "HTTP 404 Not Found returned for cross-tenant notification."
        : `Security breach: Status ${crossNotRes.status}`
    );
    if (!test9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 10: User A cannot access User B's audit logs (404)
    // -------------------------------------------------------------------------
    const crossAudRes = await request(app)
      .get(`/api/v1/tenant/audit-logs/${auditB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test10Passed =
      crossAudRes.status === 404 &&
      crossAudRes.body.message === 'Audit log not found';

    record(
      10,
      "User A Cannot Access User B's Audit Logs",
      test10Passed,
      test10Passed
        ? "HTTP 404 Not Found returned for cross-tenant audit log."
        : `Security breach: Status ${crossAudRes.status}`
    );
    if (!test10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 11: Nested relation ownership is enforced (Categories & History)
    // -------------------------------------------------------------------------
    // Scenario 1: Alice attempts to attach a data category to Bob's exposure record via API
    const crossAttachRes = await request(app)
      .post(`/api/v1/tenant/exposure-records/${exposureB.id}/categories`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ dataCategoryId: refCategory1.id });

    // Scenario 2: Alice attempts to append history to Bob's removal request via service
    let crossHistoryBlocked = false;
    try {
      await TenantSecurity.requestHistory.add(aliceId, removalB.id, {
        newStatus: 'COMPLETED',
        remarks: 'Malicious history injection',
      });
    } catch (err: any) {
      crossHistoryBlocked = err.statusCode === 404;
    }

    // Scenario 3: Alice attempts to create removal request targeting Bob's website
    let crossRefBlocked = false;
    try {
      await TenantSecurity.removalRequests.create(aliceId, {
        websiteId: websiteB.id, // Bob's website
        exposureRecordId: exposureA.id, // Alice's record
        requestReason: 'Invalid cross-tenant link attempt',
      });
    } catch (err: any) {
      crossRefBlocked = err.statusCode === 404;
    }

    const test11Passed =
      crossAttachRes.status === 404 &&
      crossHistoryBlocked &&
      crossRefBlocked;

    record(
      11,
      "Nested Relation Ownership Enforced",
      test11Passed,
      test11Passed
        ? "Child attachments blocked (HTTP 404), foreign request history blocked (404), and cross-referenced creation blocked (404)"
        : `Failed: crossAttach=${crossAttachRes.status}, historyBlocked=${crossHistoryBlocked}, refBlocked=${crossRefBlocked}`
    );
    if (!test11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 12: Injected userId fields are rejected or ignored safely
    // -------------------------------------------------------------------------
    // Scenario 1: Explicit userId in request body blocked by middleware
    const injectRes = await request(app)
      .post('/api/v1/tenant/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: bobId, // Maliciously spoofing Bob's ID
        websiteName: 'Injected Spoofed Website',
        websiteUrl: `https://spoofed-${timestamp}.example.com`,
      });

    // Scenario 2: Service-level sanitizeInput ignores any injected userId
    const directCreated = await TenantSecurity.websites.create(aliceId, {
      userId: bobId, // Spoofed field
      websiteName: 'Service Sanitized Website',
      websiteUrl: `https://service-clean-${timestamp}.example.com`,
    } as any);

    const test12Passed =
      injectRes.status === 422 &&
      injectRes.body.message.includes('Security violation') &&
      directCreated.userId === aliceId; // Firmly bound to Alice, NOT Bob

    record(
      12,
      "Injected userId Fields Rejected & Ignored Safely",
      test12Passed,
      test12Passed
        ? `HTTP 422 Unprocessable Entity on body.userId injection. Service layer firmly bound to authenticated user (${aliceId.substring(0, 8)}...)`
        : `Security defect: Status ${injectRes.status}, directCreated.userId: ${directCreated.userId}`
    );
    if (!test12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 13: Unauthenticated users cannot access protected resources (401)
    // -------------------------------------------------------------------------
    const unauthRes = await request(app)
      .get(`/api/v1/tenant/websites/${websiteA.id}`);

    const test13Passed =
      unauthRes.status === 401 &&
      unauthRes.body.success === false &&
      unauthRes.body.message.includes('Missing Authorization header');

    record(
      13,
      "Unauthenticated Access Blocked (401)",
      test13Passed,
      test13Passed
        ? "HTTP 401 Unauthorized returned when Authorization header is absent"
        : `Unexpected status ${unauthRes.status}`
    );
    if (!test13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 14: Deactivated accounts cannot access protected resources (403)
    // -------------------------------------------------------------------------
    const charlieRes = await AuthService.register({
      fullName: 'Charlie Deactivated Tenant',
      email: `charlie_tenant_${timestamp}@oblivion.internal`,
      password,
    });
    const charlieId = charlieRes.user.id;
    const charlieToken = charlieRes.tokens.accessToken;
    createdUserIds.push(charlieId);

    // Deactivate Charlie in PostgreSQL
    await prisma.user.update({
      where: { id: charlieId },
      data: { accountStatus: AccountStatus.DEACTIVATED },
    });

    const deactRes = await request(app)
      .get(`/api/v1/tenant/websites/${websiteA.id}`)
      .set('Authorization', `Bearer ${charlieToken}`);

    const test14Passed =
      deactRes.status === 403 &&
      deactRes.body.success === false &&
      deactRes.body.message.includes('deactivated');

    record(
      14,
      "Deactivated Account Blocked (403)",
      test14Passed,
      test14Passed
        ? `HTTP 403 Forbidden: "${deactRes.body.message}"`
        : `Unexpected status ${deactRes.status}`
    );
    if (!test14Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Tenant Security Test Exception:', err);
    allPassed = false;
  } finally {
    // -------------------------------------------------------------------------
    // Teardown: Safely Clean Up All Test Users & Cascading Records
    // -------------------------------------------------------------------------
    if (createdUserIds.length > 0) {
      try {
        console.log(`\n🧹 Cleaning up ${createdUserIds.length} test users & cascading records from oblivion_db...`);
        const delRes = await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
        console.log(`✅ Cleaned up ${delRes.count} test users successfully.`);
      } catch (cleanupErr) {
        console.error('Warning during teardown cleanup:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('PHASE 3 MULTI-TENANT SECURITY TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 14 MULTI-TENANT SECURITY TESTS PASSED' : 'SECURITY TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runTenantSecurityTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
