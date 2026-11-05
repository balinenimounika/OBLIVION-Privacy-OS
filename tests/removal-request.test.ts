/**
 * OBLIVION - Module 4 & 5: Removal Requests & Request History Integration Tests
 *
 * Verifies privacy erasure lifecycles, deterministic status transitions,
 * append-only history audit logs, IDOR cross-tenant isolation, and relational integrity.
 */

import request from 'supertest';
import { RemovalRequestType, RequestStatus, RecordStatus, WebsiteCategory } from '@prisma/client';
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

async function runRemovalRequestTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION MODULE 4 & 5: REMOVAL REQUESTS & HISTORY TESTS');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'RemovalsTest2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice and Bob with Websites & Exposures
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Removal Tester',
      email: `alice_rem_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Removal Tester',
      email: `bob_rem_${timestamp}@oblivion.internal`,
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
        websiteName: 'Alice Broker Site',
        websiteUrl: `https://broker-a-${timestamp}.com`,
        websiteCategory: WebsiteCategory.OTHER,
      });
    const webAId = webARes.body.data.id;

    const expARes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: webAId,
        purpose: 'Data Broker Crawl',
        dateShared: new Date().toISOString(),
      });
    const expAId = expARes.body.data.id;

    // Bob's Website & Exposure
    const webBRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteName: 'Bob Broker Site',
        websiteUrl: `https://broker-b-${timestamp}.com`,
        websiteCategory: WebsiteCategory.OTHER,
      });
    const webBId = webBRes.body.data.id;

    const expBRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteId: webBId,
        purpose: 'Bob Private Profile',
        dateShared: new Date().toISOString(),
      });
    const expBId = expBRes.body.data.id;

    let aliceRemovalId = '';
    let bobRemovalId = '';

    // -------------------------------------------------------------------------
    // TEST 1: Create Removal Request (POST /api/v1/removal-requests)
    // -------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: webAId,
        exposureRecordId: expAId,
        requestType: RemovalRequestType.GDPR_ERASURE,
        requestReason: 'Exercising GDPR Article 17 Right to Erasure',
        externalReference: 'GDPR-REF-2026-001',
        requestStatus: 'DRAFT',
      });

    aliceRemovalId = createRes.body.data?.id;
    const test1Passed =
      createRes.status === 201 &&
      createRes.body.success === true &&
      createRes.body.data.requestStatus === 'DRAFT' &&
      createRes.body.data.history?.length === 1 &&
      createRes.body.data.history[0].newStatus === 'DRAFT';

    record(
      1,
      'Create Removal Request with Auto History Audit',
      test1Passed,
      test1Passed
        ? `HTTP 201 Created. Request ID: ${aliceRemovalId}, History initialized: "${createRes.body.data.history[0].remarks}"`
        : `Failed with status ${createRes.status}: ${JSON.stringify(createRes.body)}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Reject Foreign Website (IDOR Defense)
    // -------------------------------------------------------------------------
    const idorWebRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: webBId, // Bob's website
        exposureRecordId: expAId,
        requestReason: 'Illegal foreign website reference',
      });

    const test2Passed =
      idorWebRes.status === 404 &&
      idorWebRes.body.message === 'Website not found';

    record(
      2,
      'Reject Foreign Website Reference',
      test2Passed,
      test2Passed
        ? 'HTTP 404 Not Found. Prevented cross-tenant website association'
        : `Security Risk: Expected 404, received ${idorWebRes.status}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: Reject Foreign Exposure Record (IDOR Defense)
    // -------------------------------------------------------------------------
    const idorExpRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: webAId,
        exposureRecordId: expBId, // Bob's exposure
        requestReason: 'Illegal foreign exposure reference',
      });

    const test3Passed =
      idorExpRes.status === 404 &&
      idorExpRes.body.message === 'Exposure record not found';

    record(
      3,
      'Reject Foreign Exposure Record Reference',
      test3Passed,
      test3Passed
        ? 'HTTP 404 Not Found. Prevented cross-tenant exposure association'
        : `Security Risk: Expected 404, received ${idorExpRes.status}`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Create Request for Bob (for Cross-Tenant Tests)
    // -------------------------------------------------------------------------
    const bobCreateRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteId: webBId,
        exposureRecordId: expBId,
        requestReason: 'Bob CCPA Request',
        requestType: RemovalRequestType.CCPA_DELETION,
      });

    bobRemovalId = bobCreateRes.body.data.id;
    const test4Passed = bobCreateRes.status === 201;

    record(
      4,
      'Create Independent Removal Request for Bob',
      test4Passed,
      test4Passed
        ? `HTTP 201 Created. Bob Removal ID: ${bobRemovalId}`
        : `Failed status ${bobCreateRes.status}`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: List Removal Requests with Metadata
    // -------------------------------------------------------------------------
    const listRes = await request(app)
      .get('/api/v1/removal-requests?page=1&limit=10')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test5Passed =
      listRes.status === 200 &&
      listRes.body.data.length === 1 &&
      listRes.body.data[0].id === aliceRemovalId;

    record(
      5,
      'List Removal Requests with Pagination & Filtering',
      test5Passed,
      test5Passed
        ? `HTTP 200 OK. Listed 1 removal request for Alice (Total: ${listRes.body.meta.total})`
        : `Unexpected status ${listRes.status}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: Retrieve Single Removal Request with Full Relations
    // -------------------------------------------------------------------------
    const getRes = await request(app)
      .get(`/api/v1/removal-requests/${aliceRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test6Passed =
      getRes.status === 200 &&
      getRes.body.data.id === aliceRemovalId &&
      getRes.body.data.website?.id === webAId &&
      getRes.body.data.exposureRecord?.id === expAId;

    record(
      6,
      'Retrieve Removal Request with Nested Website & Exposure',
      test6Passed,
      test6Passed
        ? `HTTP 200 OK. Verified complete relational graph`
        : `Unexpected status ${getRes.status}`
    );
    if (!test6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: IDOR Defense - User A Cannot Retrieve User B's Request (404)
    // -------------------------------------------------------------------------
    const idorGetRes = await request(app)
      .get(`/api/v1/removal-requests/${bobRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Passed =
      idorGetRes.status === 404 &&
      idorGetRes.body.message === 'Removal request not found';

    record(
      7,
      'IDOR Defense - Cross-Tenant Removal Request Retrieval Blocked',
      test7Passed,
      test7Passed
        ? 'HTTP 404 Not Found. Existence of foreign removal request withheld'
        : `Security Risk: Expected 404, received ${idorGetRes.status}`
    );
    if (!test7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: Valid Status Transition (DRAFT -> SUBMITTED)
    // -------------------------------------------------------------------------
    const submitRes = await request(app)
      .patch(`/api/v1/removal-requests/${aliceRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestStatus: RequestStatus.SUBMITTED,
        remarks: 'Dispatched formal notice via email',
      });

    const test8Passed =
      submitRes.status === 200 &&
      submitRes.body.data.requestStatus === 'SUBMITTED' &&
      submitRes.body.data.submittedAt !== null &&
      submitRes.body.data.history?.length === 2;

    record(
      8,
      'Valid Status Transition (DRAFT -> SUBMITTED)',
      test8Passed,
      test8Passed
        ? `HTTP 200 OK. submittedAt timestamp recorded, History length: ${submitRes.body.data.history?.length}`
        : `Unexpected status ${submitRes.status}: ${JSON.stringify(submitRes.body)}`
    );
    if (!test8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: Reject Invalid Status Transition (SUBMITTED -> DRAFT)
    // -------------------------------------------------------------------------
    const badTransitionRes = await request(app)
      .patch(`/api/v1/removal-requests/${aliceRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestStatus: RequestStatus.DRAFT, // Cannot revert submitted request to draft
      });

    const test9Passed =
      badTransitionRes.status === 400 &&
      badTransitionRes.body.message.includes('Invalid status transition');

    record(
      9,
      'Reject Invalid Lifecycle State Reversion',
      test9Passed,
      test9Passed
        ? `HTTP 400 Bad Request: "${badTransitionRes.body.message}"`
        : `State machine violation: Reversion accepted (${badTransitionRes.status})`
    );
    if (!test9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 10: Complete Status Transition (SUBMITTED -> ACKNOWLEDGED -> COMPLETED)
    // -------------------------------------------------------------------------
    // Transition to ACKNOWLEDGED first
    await request(app)
      .patch(`/api/v1/removal-requests/${aliceRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestStatus: RequestStatus.ACKNOWLEDGED,
      });

    // Then transition to COMPLETED
    const completeRes = await request(app)
      .patch(`/api/v1/removal-requests/${aliceRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestStatus: RequestStatus.COMPLETED,
        remarks: 'Platform confirmed permanent erasure',
      });

    // Check exposure status cascaded to REMOVED
    const dbExposure = await prisma.exposureRecord.findUnique({
      where: { id: expAId },
    });

    const test10Passed =
      completeRes.status === 200 &&
      completeRes.body.data.requestStatus === 'COMPLETED' &&
      completeRes.body.data.resolvedAt !== null &&
      dbExposure?.recordStatus === RecordStatus.REMOVED;

    record(
      10,
      'Complete Request & Cascade Exposure Status to REMOVED',
      test10Passed,
      test10Passed
        ? `HTTP 200 OK. resolvedAt recorded, Exposure Record ${expAId} transitioned to REMOVED`
        : `Unexpected status ${completeRes.status}`
    );
    if (!test10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 11: IDOR Defense - User A Cannot Update User B's Request (404)
    // -------------------------------------------------------------------------
    const idorUpdateRes = await request(app)
      .patch(`/api/v1/removal-requests/${bobRemovalId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestStatus: RequestStatus.SUBMITTED,
      });

    const test11Passed =
      idorUpdateRes.status === 404 &&
      idorUpdateRes.body.message === 'Removal request not found';

    record(
      11,
      'IDOR Defense - Cross-Tenant Removal Request Update Blocked',
      test11Passed,
      test11Passed
        ? 'HTTP 404 Not Found. Target record remained unmodified'
        : `Security Risk: Expected 404, received ${idorUpdateRes.status}`
    );
    if (!test11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 12: Retrieve Request History (GET /api/v1/removal-requests/:id/history)
    // -------------------------------------------------------------------------
    const historyRes = await request(app)
      .get(`/api/v1/removal-requests/${aliceRemovalId}/history`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test12Passed =
      historyRes.status === 200 &&
      Array.isArray(historyRes.body.data) &&
      historyRes.body.data.length >= 4; // DRAFT -> SUBMITTED -> ACKNOWLEDGED -> COMPLETED

    record(
      12,
      'Retrieve Append-Only Status Transition History',
      test12Passed,
      test12Passed
        ? `HTTP 200 OK. Verified complete append-only audit trail (${historyRes.body.data.length} transitions)`
        : `Unexpected status ${historyRes.status}`
    );
    if (!test12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 13: IDOR Defense - User A Cannot View User B's History (404)
    // -------------------------------------------------------------------------
    const idorHistoryRes = await request(app)
      .get(`/api/v1/removal-requests/${bobRemovalId}/history`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test13Passed =
      idorHistoryRes.status === 404 &&
      idorHistoryRes.body.message === 'Removal request not found';

    record(
      13,
      'IDOR Defense - Cross-Tenant Request History Access Blocked',
      test13Passed,
      test13Passed
        ? 'HTTP 404 Not Found. Foreign audit trail withheld'
        : `Security Risk: Expected 404, received ${idorHistoryRes.status}`
    );
    if (!test13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 14: Injected userId Rejected (422)
    // -------------------------------------------------------------------------
    const injectRes = await request(app)
      .post('/api/v1/removal-requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: bobId,
        websiteId: webAId,
        exposureRecordId: expAId,
        requestReason: 'Spoofed User ID attempt',
      });

    const test14Passed =
      injectRes.status === 422 &&
      injectRes.body.message.includes('Security violation');

    record(
      14,
      'Injected userId In Removal Request Rejected',
      test14Passed,
      test14Passed
        ? `HTTP 422 Unprocessable Entity: "${injectRes.body.message}"`
        : `Security Risk: Injected body accepted (${injectRes.status})`
    );
    if (!test14Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 15: Unauthenticated Access Blocked (401)
    // -------------------------------------------------------------------------
    const unauthRes = await request(app).get('/api/v1/removal-requests');

    const test15Passed =
      unauthRes.status === 401 &&
      unauthRes.body.message.includes('Missing Authorization header');

    record(
      15,
      'Unauthenticated Access Blocked',
      test15Passed,
      test15Passed
        ? 'HTTP 401 Unauthorized for unauthenticated request'
        : `Unexpected status ${unauthRes.status}`
    );
    if (!test15Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Removal Request Test Error:', err);
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
  console.log('MODULE 4 & 5: REMOVAL REQUESTS & HISTORY TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 15 REMOVAL REQUESTS & HISTORY TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runRemovalRequestTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
