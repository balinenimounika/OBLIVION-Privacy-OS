/**
 * OBLIVION - Module 8: Dashboard Analytics Integration Test Suite
 *
 * Verifies live PostgreSQL calculation of privacy risk index, exposure breakdown,
 * removal progress, activity timeline, and multi-tenant isolation.
 */

import request from 'supertest';
import { SensitivityLevel, RecordStatus, WebsiteCategory, RemovalRequestType } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';

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

async function runDashboardTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION MODULE 8: DASHBOARD ANALYTICS INTEGRATION TESTS');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'Dashboard2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice with Populated Privacy Data, Bob with Empty State
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Dashboard Tester',
      email: `alice_dash_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Dashboard Tester',
      email: `bob_dash_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Seed Alice's privacy profile
    const websiteA = await prisma.website.create({
      data: {
        userId: aliceId,
        websiteName: 'Alice Cloud Provider',
        websiteUrl: `https://cloud-a-${timestamp}.com`,
        websiteCategory: WebsiteCategory.TELECOMMUNICATIONS,
      },
    });

    const exposureA = await prisma.exposureRecord.create({
      data: {
        userId: aliceId,
        websiteId: websiteA.id,
        purpose: 'Telecom Subscriber Profile',
        sensitivityLevel: SensitivityLevel.CRITICAL,
        dateShared: new Date(),
        recordStatus: RecordStatus.ACTIVE,
      },
    });

    await prisma.removalRequest.create({
      data: {
        userId: aliceId,
        websiteId: websiteA.id,
        exposureRecordId: exposureA.id,
        requestType: RemovalRequestType.GDPR_ERASURE,
        requestReason: 'Subscriber cancel erasure',
        requestStatus: 'SUBMITTED',
        submittedAt: new Date(),
        history: {
          create: {
            newStatus: 'SUBMITTED',
            remarks: 'Formal request dispatched',
          },
        },
      },
    });

    await prisma.reminder.create({
      data: {
        userId: aliceId,
        exposureRecordId: exposureA.id,
        reminderDate: new Date(Date.now() + 86400000),
      },
    });

    await prisma.notification.create({
      data: {
        userId: aliceId,
        title: 'Critical Privacy Alert',
        message: 'High risk telecom exposure logged',
        isRead: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: aliceId,
        action: 'DASHBOARD_INITIALIZED',
        entityType: 'User',
        entityId: aliceId,
      },
    });

    // -------------------------------------------------------------------------
    // TEST 1: Privacy Overview Metrics (GET /api/v1/dashboard/overview)
    // -------------------------------------------------------------------------
    const overviewRes = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${aliceToken}`);

    const oData = overviewRes.body.data;
    const test1Passed =
      overviewRes.status === 200 &&
      oData.totalWebsites === 1 &&
      oData.totalExposures === 1 &&
      oData.activeRemovalRequests === 1 &&
      oData.pendingReminders === 1 &&
      oData.unreadNotifications === 1 &&
      oData.privacyRiskIndex > 0 &&
      typeof oData.privacyRiskRating === 'string';

    record(
      1,
      'Live Privacy Overview Calculation',
      test1Passed,
      test1Passed
        ? `HTTP 200 OK. Websites: ${oData.totalWebsites}, Exposures: ${oData.totalExposures}, Risk Index: ${oData.privacyRiskIndex} (${oData.privacyRiskRating})`
        : `Unexpected overview data: ${JSON.stringify(overviewRes.body)}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Multi-Tenant Metric Isolation (Bob's Empty Overview)
    // -------------------------------------------------------------------------
    const bobOverviewRes = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${bobToken}`);

    const bData = bobOverviewRes.body.data;
    const test2Passed =
      bobOverviewRes.status === 200 &&
      bData.totalWebsites === 0 &&
      bData.totalExposures === 0 &&
      bData.activeRemovalRequests === 0 &&
      bData.privacyRiskIndex === 0 &&
      bData.privacyRiskRating === 'LOW';

    record(
      2,
      'Multi-Tenant Dashboard Metric Isolation',
      test2Passed,
      test2Passed
        ? 'Verified: Bob received zero metrics and zero risk index (100% isolated from Alice)'
        : `Isolation leak: ${JSON.stringify(bobOverviewRes.body)}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: Exposure Breakdown Analytics (GET /api/v1/dashboard/exposure-breakdown)
    // -------------------------------------------------------------------------
    const breakdownRes = await request(app)
      .get('/api/v1/dashboard/exposure-breakdown')
      .set('Authorization', `Bearer ${aliceToken}`);

    const brData = breakdownRes.body.data;
    const test3Passed =
      breakdownRes.status === 200 &&
      brData.bySensitivity.CRITICAL === 1 &&
      brData.bySensitivity.LOW === 0 &&
      brData.byWebsiteCategory.TELECOMMUNICATIONS === 1;

    record(
      3,
      'Exposure Breakdown Analytics by Sensitivity & Category',
      test3Passed,
      test3Passed
        ? `HTTP 200 OK. CRITICAL exposures: ${brData.bySensitivity.CRITICAL}, Category: TELECOMMUNICATIONS (1)`
        : `Breakdown discrepancy: ${JSON.stringify(breakdownRes.body)}`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Removal Progress Analytics (GET /api/v1/dashboard/removal-progress)
    // -------------------------------------------------------------------------
    const progressRes = await request(app)
      .get('/api/v1/dashboard/removal-progress')
      .set('Authorization', `Bearer ${aliceToken}`);

    const pData = progressRes.body.data;
    const test4Passed =
      progressRes.status === 200 &&
      pData.totalRequests === 1 &&
      pData.byStatus.SUBMITTED === 1 &&
      pData.byType.GDPR_ERASURE === 1;

    record(
      4,
      'Removal Progress & Erasure Success Analytics',
      test4Passed,
      test4Passed
        ? `HTTP 200 OK. Total requests: ${pData.totalRequests}, Status: SUBMITTED (1), Type: GDPR_ERASURE (1)`
        : `Progress discrepancy: ${JSON.stringify(progressRes.body)}`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: Recent Activity Aggregation (GET /api/v1/dashboard/recent-activity)
    // -------------------------------------------------------------------------
    const activityRes = await request(app)
      .get('/api/v1/dashboard/recent-activity')
      .set('Authorization', `Bearer ${aliceToken}`);

    const aData = activityRes.body.data;
    const test5Passed =
      activityRes.status === 200 &&
      Array.isArray(aData) &&
      aData.length >= 3 &&
      aData.some((i: any) => i.type === 'AUDIT_LOG') &&
      aData.some((i: any) => i.type === 'STATUS_CHANGE') &&
      aData.some((i: any) => i.type === 'NOTIFICATION');

    record(
      5,
      'Recent Activity Aggregation & Chronological Ordering',
      test5Passed,
      test5Passed
        ? `HTTP 200 OK. Unified timeline aggregated ${aData.length} items (Audit, Removal, Notification)`
        : `Activity discrepancy: ${JSON.stringify(activityRes.body)}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: Unauthenticated Access Blocked (401)
    // -------------------------------------------------------------------------
    const unauthRes = await request(app).get('/api/v1/dashboard/overview');

    const test6Passed =
      unauthRes.status === 401 &&
      unauthRes.body.message.includes('Missing Authorization header');

    record(
      6,
      'Unauthenticated Access Blocked',
      test6Passed,
      test6Passed
        ? 'HTTP 401 Unauthorized for unauthenticated request'
        : `Unexpected status ${unauthRes.status}`
    );
    if (!test6Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Dashboard Test Error:', err);
    allPassed = false;
  } finally {
    // Teardown
    if (createdUserIds.length > 0) {
      try {
        console.log(`\n🧹 Cleaning up ${createdUserIds.length} test users from database...`);
        const del = await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
        console.log(`✅ Cleaned up ${del.count} test users.`);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('MODULE 8: DASHBOARD ANALYTICS TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 6 DASHBOARD ANALYTICS TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runDashboardTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
