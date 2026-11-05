/**
 * OBLIVION - Module 7: Notifications API Integration Test Suite
 *
 * Verifies notification listing, unread counters, mark-as-read,
 * bulk read-all, IDOR cross-tenant isolation, and automated database cleanup.
 */

import request from 'supertest';
import { NotificationType } from '@prisma/client';
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

async function runNotificationTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION MODULE 7: NOTIFICATIONS API INTEGRATION TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'Notifications2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice and Bob with Notifications
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Notification Tester',
      email: `alice_notif_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Notification Tester',
      email: `bob_notif_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Clear any automatic registration welcome notifications so test starts with controlled state
    await prisma.notification.deleteMany({ where: { userId: { in: [aliceId, bobId] } } });

    // Seed notifications for Alice (2 unread)
    const notifA1 = await prisma.notification.create({
      data: {
        userId: aliceId,
        title: 'Alice Security Alert',
        message: 'A new sensitive exposure was detected',
        notificationType: NotificationType.SECURITY_ALERT,
        isRead: false,
      },
    });

    const notifA2 = await prisma.notification.create({
      data: {
        userId: aliceId,
        title: 'Alice Reminder Due',
        message: 'Annual privacy review due tomorrow',
        notificationType: NotificationType.REMINDER_DUE,
        isRead: false,
      },
    });

    // Seed notification for Bob (1 unread)
    const notifB = await prisma.notification.create({
      data: {
        userId: bobId,
        title: 'Bob Status Update',
        message: 'Your CCPA request was acknowledged',
        notificationType: NotificationType.REQUEST_STATUS_UPDATE,
        isRead: false,
      },
    });

    // -------------------------------------------------------------------------
    // TEST 1: List Notifications with Unread Counter (GET /api/v1/notifications)
    // -------------------------------------------------------------------------
    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test1Passed =
      listRes.status === 200 &&
      listRes.body.success === true &&
      listRes.body.data.length === 2 &&
      listRes.body.meta.unreadCount === 2 &&
      listRes.body.meta.total === 2;

    record(
      1,
      'List Notifications with Unread Counter',
      test1Passed,
      test1Passed
        ? `HTTP 200 OK. Listed ${listRes.body.data.length} notifications, Unread: ${listRes.body.meta.unreadCount}`
        : `Unexpected status ${listRes.status}: ${JSON.stringify(listRes.body)}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Retrieve Single Notification by ID
    // -------------------------------------------------------------------------
    const getRes = await request(app)
      .get(`/api/v1/notifications/${notifA1.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test2Passed =
      getRes.status === 200 &&
      getRes.body.data.id === notifA1.id &&
      getRes.body.data.title === 'Alice Security Alert';

    record(
      2,
      'Retrieve Single Notification by ID',
      test2Passed,
      test2Passed
        ? `HTTP 200 OK. Retrieved '${getRes.body.data.title}'`
        : `Unexpected status ${getRes.status}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: IDOR Defense - User A Cannot Retrieve User B's Notification (404)
    // -------------------------------------------------------------------------
    const idorGetRes = await request(app)
      .get(`/api/v1/notifications/${notifB.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test3Passed =
      idorGetRes.status === 404 &&
      idorGetRes.body.message === 'Notification not found';

    record(
      3,
      'IDOR Defense - Cross-Tenant Notification Retrieval Blocked',
      test3Passed,
      test3Passed
        ? 'HTTP 404 Not Found. Existence of foreign notification withheld'
        : `Security Risk: Expected 404, received ${idorGetRes.status}`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Mark Individual Notification as Read (PATCH /:id/read)
    // -------------------------------------------------------------------------
    const markRes = await request(app)
      .patch(`/api/v1/notifications/${notifA1.id}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test4Passed =
      markRes.status === 200 &&
      markRes.body.data.id === notifA1.id &&
      markRes.body.data.isRead === true;

    record(
      4,
      'Mark Single Notification as Read',
      test4Passed,
      test4Passed
        ? `HTTP 200 OK. Notification ${notifA1.id} isRead updated to true`
        : `Unexpected status ${markRes.status}`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: Verify Unread Count Decremented
    // -------------------------------------------------------------------------
    const listAfterOneRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test5Passed =
      listAfterOneRes.status === 200 &&
      listAfterOneRes.body.meta.unreadCount === 1;

    record(
      5,
      'Verify Decremented Unread Counter',
      test5Passed,
      test5Passed
        ? `HTTP 200 OK. Unread count properly updated to ${listAfterOneRes.body.meta.unreadCount}`
        : `Counter discrepancy: ${listAfterOneRes.body.meta?.unreadCount}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: IDOR Defense - User A Cannot Mark User B's Notification as Read (404)
    // -------------------------------------------------------------------------
    const idorMarkRes = await request(app)
      .patch(`/api/v1/notifications/${notifB.id}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test6Passed =
      idorMarkRes.status === 404 &&
      idorMarkRes.body.message === 'Notification not found';

    record(
      6,
      'IDOR Defense - Cross-Tenant Notification Read Update Blocked',
      test6Passed,
      test6Passed
        ? 'HTTP 404 Not Found. Target foreign notification remained unmodified'
        : `Security Risk: Expected 404, received ${idorMarkRes.status}`
    );
    if (!test6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: Mark All Notifications as Read (PATCH /read-all)
    // -------------------------------------------------------------------------
    const markAllRes = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Passed =
      markAllRes.status === 200 &&
      markAllRes.body.data.updatedCount === 1; // Only notifA2 was still unread

    const listAfterAllRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Verified =
      test7Passed &&
      listAfterAllRes.body.meta.unreadCount === 0;

    record(
      7,
      'Bulk Mark All Notifications as Read',
      test7Verified,
      test7Verified
        ? `HTTP 200 OK. Updated ${markAllRes.body.data.updatedCount} notification(s), new unreadCount: 0`
        : `Bulk update issue: ${JSON.stringify(markAllRes.body)}`
    );
    if (!test7Verified) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: Verify Bob's Notification Still Unread (Tenant Isolation)
    // -------------------------------------------------------------------------
    const dbBobNotif = await prisma.notification.findUnique({
      where: { id: notifB.id },
    });

    const test8Passed =
      dbBobNotif?.isRead === false;

    record(
      8,
      "Verify Tenant Isolation During Bulk Update",
      test8Passed,
      test8Passed
        ? "Verified: Bob's notification remained untouched (isRead: false) after Alice's bulk read-all"
        : "Isolation failure: Bob's notification was modified by Alice's request!"
    );
    if (!test8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: Unauthenticated Access Blocked (401)
    // -------------------------------------------------------------------------
    const unauthRes = await request(app).get('/api/v1/notifications');

    const test9Passed =
      unauthRes.status === 401 &&
      unauthRes.body.message.includes('Missing Authorization header');

    record(
      9,
      'Unauthenticated Access Blocked',
      test9Passed,
      test9Passed
        ? 'HTTP 401 Unauthorized for unauthenticated request'
        : `Unexpected status ${unauthRes.status}`
    );
    if (!test9Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Notification Test Error:', err);
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
  console.log('MODULE 7: NOTIFICATIONS API TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 9 NOTIFICATION TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runNotificationTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
