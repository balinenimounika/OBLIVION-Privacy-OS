/**
 * OBLIVION - Module 6: Reminders API Integration Test Suite
 *
 * Verifies privacy review scheduling, duplicate prevention, status updates,
 * IDOR cross-tenant isolation, and automated database cleanup.
 */

import request from 'supertest';
import { ReminderType, ReminderStatus, WebsiteCategory } from '@prisma/client';
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

async function runReminderTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION MODULE 6: REMINDERS API INTEGRATION TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'RemindersTest2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice and Bob with Websites & Exposures
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Reminder Tester',
      email: `alice_rmd_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Reminder Tester',
      email: `bob_rmd_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Alice's Website & Exposure
    const webARes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Alice Reminder Portal',
        websiteUrl: `https://reminder-a-${timestamp}.com`,
        websiteCategory: WebsiteCategory.HEALTHCARE,
      });
    const webAId = webARes.body.data.id;

    const expARes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: webAId,
        purpose: 'Health Records Storage',
        dateShared: new Date().toISOString(),
      });
    const expAId = expARes.body.data.id;

    // Bob's Website & Exposure
    const webBRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteName: 'Bob Reminder Portal',
        websiteUrl: `https://reminder-b-${timestamp}.com`,
        websiteCategory: WebsiteCategory.FINANCIAL_SERVICES,
      });
    const webBId = webBRes.body.data.id;

    const expBRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteId: webBId,
        purpose: 'Tax Records Storage',
        dateShared: new Date().toISOString(),
      });
    const expBId = expBRes.body.data.id;

    let aliceReminderId = '';
    let bobReminderId = '';
    const scheduledDate = new Date(Date.now() + 86400000).toISOString(); // +1 day

    // -------------------------------------------------------------------------
    // TEST 1: Create Reminder Successfully (POST /api/v1/reminders)
    // -------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        exposureRecordId: expAId,
        reminderType: ReminderType.ANNUAL_PRIVACY_REVIEW,
        reminderDate: scheduledDate,
      });

    aliceReminderId = createRes.body.data?.id;
    const test1Passed =
      createRes.status === 201 &&
      createRes.body.success === true &&
      createRes.body.data.reminderStatus === 'PENDING' &&
      createRes.body.data.userId === aliceId;

    record(
      1,
      'Create Reminder Successfully',
      test1Passed,
      test1Passed
        ? `HTTP 201 Created. Reminder ID: ${aliceReminderId}, Status: PENDING`
        : `Failed with status ${createRes.status}: ${JSON.stringify(createRes.body)}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Reject Foreign Exposure Record (IDOR Defense)
    // -------------------------------------------------------------------------
    const idorCreateRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        exposureRecordId: expBId, // Bob's exposure
        reminderType: ReminderType.EXPIRY_CHECK,
        reminderDate: scheduledDate,
      });

    const test2Passed =
      idorCreateRes.status === 404 &&
      idorCreateRes.body.message === 'Exposure record not found';

    record(
      2,
      'Reject Foreign Exposure Record Reference',
      test2Passed,
      test2Passed
        ? 'HTTP 404 Not Found. Prevented cross-tenant reminder scheduling'
        : `Security Risk: Expected 404, received ${idorCreateRes.status}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: Prevent Duplicate Reminder (409 Conflict)
    // -------------------------------------------------------------------------
    const dupRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        exposureRecordId: expAId,
        reminderType: ReminderType.ANNUAL_PRIVACY_REVIEW,
        reminderDate: scheduledDate, // Identical parameters
      });

    const test3Passed =
      dupRes.status === 409 &&
      dupRes.body.message.includes('already scheduled');

    record(
      3,
      'Prevent Duplicate Scheduled Reminder',
      test3Passed,
      test3Passed
        ? `HTTP 409 Conflict: "${dupRes.body.message}"`
        : `Failed: Duplicate reminder accepted (${dupRes.status})`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Create Independent Reminder for Bob
    // -------------------------------------------------------------------------
    const bobReminderRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        exposureRecordId: expBId,
        reminderType: ReminderType.EXPIRY_CHECK,
        reminderDate: new Date(Date.now() + 172800000).toISOString(),
      });

    bobReminderId = bobReminderRes.body.data.id;
    const test4Passed = bobReminderRes.status === 201;

    record(
      4,
      'Create Independent Reminder for Bob',
      test4Passed,
      test4Passed
        ? `HTTP 201 Created. Bob Reminder ID: ${bobReminderId}`
        : `Failed status ${bobReminderRes.status}`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: List Reminders with Filtering & Pagination
    // -------------------------------------------------------------------------
    const listRes = await request(app)
      .get('/api/v1/reminders?page=1&limit=10&upcomingOnly=true')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test5Passed =
      listRes.status === 200 &&
      listRes.body.data.length === 1 &&
      listRes.body.data[0].id === aliceReminderId;

    record(
      5,
      'List Upcoming Reminders with Pagination',
      test5Passed,
      test5Passed
        ? `HTTP 200 OK. Listed 1 upcoming reminder for Alice (Total: ${listRes.body.meta.total})`
        : `Unexpected status ${listRes.status}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: Retrieve Single Reminder with Relations
    // -------------------------------------------------------------------------
    const getRes = await request(app)
      .get(`/api/v1/reminders/${aliceReminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test6Passed =
      getRes.status === 200 &&
      getRes.body.data.id === aliceReminderId &&
      getRes.body.data.exposureRecord?.id === expAId;

    record(
      6,
      'Retrieve Reminder with Exposure Record Relation',
      test6Passed,
      test6Passed
        ? `HTTP 200 OK. Retrieved reminder with parent exposure relation`
        : `Unexpected status ${getRes.status}`
    );
    if (!test6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: IDOR Defense - User A Cannot Retrieve User B's Reminder (404)
    // -------------------------------------------------------------------------
    const idorGetRes = await request(app)
      .get(`/api/v1/reminders/${bobReminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Passed =
      idorGetRes.status === 404 &&
      idorGetRes.body.message === 'Reminder not found';

    record(
      7,
      'IDOR Defense - Cross-Tenant Reminder Retrieval Blocked',
      test7Passed,
      test7Passed
        ? 'HTTP 404 Not Found. Existence of foreign reminder withheld'
        : `Security Risk: Expected 404, received ${idorGetRes.status}`
    );
    if (!test7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: Update Reminder Status to COMPLETED
    // -------------------------------------------------------------------------
    const updateRes = await request(app)
      .patch(`/api/v1/reminders/${aliceReminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        reminderStatus: ReminderStatus.COMPLETED,
      });

    const test8Passed =
      updateRes.status === 200 &&
      updateRes.body.data.reminderStatus === 'COMPLETED' &&
      updateRes.body.data.completedAt !== null;

    record(
      8,
      'Update Reminder to COMPLETED & Timestamp Recorded',
      test8Passed,
      test8Passed
        ? `HTTP 200 OK. completedAt timestamp recorded: ${updateRes.body.data.completedAt}`
        : `Unexpected status ${updateRes.status}`
    );
    if (!test8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: IDOR Defense - User A Cannot Update User B's Reminder (404)
    // -------------------------------------------------------------------------
    const idorUpdateRes = await request(app)
      .patch(`/api/v1/reminders/${bobReminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        reminderStatus: ReminderStatus.COMPLETED,
      });

    const test9Passed =
      idorUpdateRes.status === 404 &&
      idorUpdateRes.body.message === 'Reminder not found';

    record(
      9,
      'IDOR Defense - Cross-Tenant Reminder Update Blocked',
      test9Passed,
      test9Passed
        ? 'HTTP 404 Not Found. Target reminder remained unmodified'
        : `Security Risk: Expected 404, received ${idorUpdateRes.status}`
    );
    if (!test9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 10: IDOR Defense - User A Cannot Delete User B's Reminder (404)
    // -------------------------------------------------------------------------
    const idorDeleteRes = await request(app)
      .delete(`/api/v1/reminders/${bobReminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test10Passed =
      idorDeleteRes.status === 404 &&
      idorDeleteRes.body.message === 'Reminder not found';

    record(
      10,
      'IDOR Defense - Cross-Tenant Reminder Delete Blocked',
      test10Passed,
      test10Passed
        ? 'HTTP 404 Not Found. Foreign reminder preserved in PostgreSQL'
        : `Security Risk: Expected 404, received ${idorDeleteRes.status}`
    );
    if (!test10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 11: Delete Own Reminder Successfully
    // -------------------------------------------------------------------------
    const deleteRes = await request(app)
      .delete(`/api/v1/reminders/${aliceReminderId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const dbReminderGone = await prisma.reminder.findUnique({
      where: { id: aliceReminderId },
    });

    const test11Passed =
      deleteRes.status === 200 &&
      dbReminderGone === null;

    record(
      11,
      'Delete Own Reminder Successfully',
      test11Passed,
      test11Passed
        ? 'HTTP 200 OK. Reminder deleted from database'
        : `Unexpected status ${deleteRes.status}`
    );
    if (!test11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 12: Injected userId Rejected (422)
    // -------------------------------------------------------------------------
    const injectRes = await request(app)
      .post('/api/v1/reminders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: bobId,
        exposureRecordId: expAId,
        reminderDate: new Date().toISOString(),
      });

    const test12Passed =
      injectRes.status === 422 &&
      injectRes.body.message.includes('Security violation');

    record(
      12,
      'Injected userId In Reminder Body Rejected',
      test12Passed,
      test12Passed
        ? `HTTP 422 Unprocessable Entity: "${injectRes.body.message}"`
        : `Security Risk: Injected body accepted (${injectRes.status})`
    );
    if (!test12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 13: Unauthenticated Access Blocked (401)
    // -------------------------------------------------------------------------
    const unauthRes = await request(app).get('/api/v1/reminders');

    const test13Passed =
      unauthRes.status === 401 &&
      unauthRes.body.message.includes('Missing Authorization header');

    record(
      13,
      'Unauthenticated Access Blocked',
      test13Passed,
      test13Passed
        ? 'HTTP 401 Unauthorized for unauthenticated request'
        : `Unexpected status ${unauthRes.status}`
    );
    if (!test13Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Reminder Test Error:', err);
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
  console.log('MODULE 6: REMINDERS API TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 13 REMINDER TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runReminderTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
