/**
 * OBLIVION - Module 2 & 3: Exposure Records & Data Categories Integration Tests
 *
 * Verifies reference category catalog, exposure record CRUD, category linking,
 * dynamic risk-score computation, IDOR cross-tenant isolation, and input validation.
 */

import request from 'supertest';
import { SensitivityLevel, RecordStatus, WebsiteCategory } from '@prisma/client';
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

async function runExposureTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION MODULE 2 & 3: EXPOSURES & CATEGORIES INTEGRATION TESTS');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'ExposuresTest2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice and Bob
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Exposure Tester',
      email: `alice_exp_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Exposure Tester',
      email: `bob_exp_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Create a website for Alice
    const websiteARes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Alice Exposure Site',
        websiteUrl: `https://alice-exposure-${timestamp}.com`,
        websiteCategory: WebsiteCategory.SOCIAL_MEDIA,
      });
    const websiteAId = websiteARes.body.data.id;

    // Create a website for Bob
    const websiteBRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteName: 'Bob Exposure Site',
        websiteUrl: `https://bob-exposure-${timestamp}.com`,
        websiteCategory: WebsiteCategory.FINANCIAL_SERVICES,
      });
    const websiteBId = websiteBRes.body.data.id;

    // -------------------------------------------------------------------------
    // TEST 1: Read Reference Categories (GET /api/v1/categories)
    // -------------------------------------------------------------------------
    const catListRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test1Passed =
      catListRes.status === 200 &&
      catListRes.body.success === true &&
      Array.isArray(catListRes.body.data) &&
      catListRes.body.data.length >= 12;

    const allCategories = catListRes.body.data;
    const cat1 = allCategories[0];
    const cat2 = allCategories[1];

    record(
      1,
      'Read Reference Data Categories',
      test1Passed,
      test1Passed
        ? `HTTP 200 OK. Retrieved ${catListRes.body.data.length} reference data categories from PostgreSQL`
        : `Unexpected status ${catListRes.status}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Filter Categories by Sensitivity
    // -------------------------------------------------------------------------
    const filterCatRes = await request(app)
      .get('/api/v1/categories?sensitivity=CRITICAL')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test2Passed =
      filterCatRes.status === 200 &&
      filterCatRes.body.data.every((c: any) => c.defaultSensitivity === 'CRITICAL');

    record(
      2,
      'Filter Categories by Sensitivity',
      test2Passed,
      test2Passed
        ? `HTTP 200 OK. Retrieved ${filterCatRes.body.data.length} CRITICAL categories`
        : `Unexpected status ${filterCatRes.status}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: Create Exposure Record with Categories & Risk Calculation
    // -------------------------------------------------------------------------
    const createExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: websiteAId,
        purpose: 'Online Shopping Account Profile',
        sensitivityLevel: SensitivityLevel.HIGH,
        dateShared: new Date().toISOString(),
        notes: 'User submitted home address and credit card during checkout',
        categoryIds: [cat1.id, cat2.id],
      });

    const expA = createExpRes.body.data;
    const test3Passed =
      createExpRes.status === 201 &&
      createExpRes.body.success === true &&
      expA.websiteId === websiteAId &&
      expA.categories?.length === 2 &&
      typeof expA.calculatedRiskScore === 'number' &&
      typeof expA.calculatedRiskRating === 'string';

    const exposureAId = expA?.id;

    record(
      3,
      'Create Exposure Record with Risk Score',
      test3Passed,
      test3Passed
        ? `HTTP 201 Created. Risk Score: ${expA.calculatedRiskScore} (${expA.calculatedRiskRating}), Categories: ${expA.categories.length}`
        : `Failed: ${JSON.stringify(createExpRes.body)}`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Reject Creating Exposure on Foreign Website (IDOR Defense)
    // -------------------------------------------------------------------------
    const idorCreateExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: websiteBId, // Bob's website!
        purpose: 'Attempted Cross-Tenant Link',
        dateShared: new Date().toISOString(),
      });

    const test4Passed =
      idorCreateExpRes.status === 404 &&
      idorCreateExpRes.body.message === 'Website not found';

    record(
      4,
      'Reject Creating Exposure on Foreign Website',
      test4Passed,
      test4Passed
        ? 'HTTP 404 Not Found. Prevented User A from linking exposure to User B website'
        : `Security Risk: Expected 404, received ${idorCreateExpRes.status}`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: Reject Non-Existent Category IDs (400)
    // -------------------------------------------------------------------------
    const badCatExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: websiteAId,
        purpose: 'Bad Category Test',
        dateShared: new Date().toISOString(),
        categoryIds: ['00000000-0000-0000-0000-000000000000'],
      });

    const test5Passed =
      badCatExpRes.status === 400 &&
      badCatExpRes.body.message.includes('do not exist');

    record(
      5,
      'Reject Non-Existent Category IDs',
      test5Passed,
      test5Passed
        ? `HTTP 400 Bad Request: "${badCatExpRes.body.message}"`
        : `Unexpected status ${badCatExpRes.status}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: Create Exposure for Bob (for IDOR Isolation Tests)
    // -------------------------------------------------------------------------
    const bobExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteId: websiteBId,
        purpose: 'Bob Banking Registration',
        sensitivityLevel: SensitivityLevel.CRITICAL,
        dateShared: new Date().toISOString(),
      });
    const bobExposureId = bobExpRes.body.data.id;

    const test6Passed = bobExpRes.status === 201;
    record(
      6,
      'Create Independent Exposure Record for Bob',
      test6Passed,
      test6Passed
        ? `HTTP 201 Created. Bob Exposure ID: ${bobExposureId}`
        : `Failed status ${bobExpRes.status}`
    );
    if (!test6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: List Exposure Records with Pagination
    // -------------------------------------------------------------------------
    const listExpRes = await request(app)
      .get('/api/v1/exposures?page=1&limit=10')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Passed =
      listExpRes.status === 200 &&
      listExpRes.body.data.length === 1 &&
      listExpRes.body.data[0].id === exposureAId &&
      listExpRes.body.meta.total === 1;

    record(
      7,
      'List Exposures with Metadata & Risk Calculation',
      test7Passed,
      test7Passed
        ? `HTTP 200 OK. Listed 1 exposure for Alice (Total: ${listExpRes.body.meta.total})`
        : `Unexpected status ${listExpRes.status}`
    );
    if (!test7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: Retrieve Single Exposure by ID
    // -------------------------------------------------------------------------
    const getExpRes = await request(app)
      .get(`/api/v1/exposures/${exposureAId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test8Passed =
      getExpRes.status === 200 &&
      getExpRes.body.data.id === exposureAId &&
      getExpRes.body.data.website?.id === websiteAId;

    record(
      8,
      'Retrieve Single Exposure Record',
      test8Passed,
      test8Passed
        ? `HTTP 200 OK. Retrieved '${getExpRes.body.data.purpose}' with website relation`
        : `Unexpected status ${getExpRes.status}`
    );
    if (!test8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: IDOR Defense - User A Cannot Retrieve User B's Exposure (404)
    // -------------------------------------------------------------------------
    const idorGetExpRes = await request(app)
      .get(`/api/v1/exposures/${bobExposureId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test9Passed =
      idorGetExpRes.status === 404 &&
      idorGetExpRes.body.message === 'Exposure record not found';

    record(
      9,
      'IDOR Defense - Cross-Tenant Exposure Retrieval Blocked',
      test9Passed,
      test9Passed
        ? 'HTTP 404 Not Found. Existence of foreign exposure record withheld'
        : `Security Risk: Expected 404, received ${idorGetExpRes.status}`
    );
    if (!test9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 10: Update Exposure Record & Recompute Risk
    // -------------------------------------------------------------------------
    const updateExpRes = await request(app)
      .patch(`/api/v1/exposures/${exposureAId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        purpose: 'Updated Privacy Profile',
        sensitivityLevel: SensitivityLevel.CRITICAL,
      });

    const test10Passed =
      updateExpRes.status === 200 &&
      updateExpRes.body.data.purpose === 'Updated Privacy Profile' &&
      updateExpRes.body.data.sensitivityLevel === 'CRITICAL' &&
      updateExpRes.body.data.calculatedRiskScore > expA.calculatedRiskScore; // Higher multiplier

    record(
      10,
      'Update Exposure Details & Dynamic Risk Escalation',
      test10Passed,
      test10Passed
        ? `HTTP 200 OK. Risk escalated from ${expA.calculatedRiskScore} to ${updateExpRes.body.data.calculatedRiskScore} (${updateExpRes.body.data.calculatedRiskRating})`
        : `Unexpected result: ${JSON.stringify(updateExpRes.body)}`
    );
    if (!test10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 11: IDOR Defense - User A Cannot Update User B's Exposure (404)
    // -------------------------------------------------------------------------
    const idorUpdateExpRes = await request(app)
      .patch(`/api/v1/exposures/${bobExposureId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        purpose: 'Tampered Purpose',
      });

    const test11Passed =
      idorUpdateExpRes.status === 404 &&
      idorUpdateExpRes.body.message === 'Exposure record not found';

    record(
      11,
      'IDOR Defense - Cross-Tenant Exposure Update Blocked',
      test11Passed,
      test11Passed
        ? 'HTTP 404 Not Found. Target record remained unmodified'
        : `Security Risk: Expected 404, received ${idorUpdateExpRes.status}`
    );
    if (!test11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 12: IDOR Defense - User A Cannot Delete User B's Exposure (404)
    // -------------------------------------------------------------------------
    const idorDeleteExpRes = await request(app)
      .delete(`/api/v1/exposures/${bobExposureId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test12Passed =
      idorDeleteExpRes.status === 404 &&
      idorDeleteExpRes.body.message === 'Exposure record not found';

    record(
      12,
      'IDOR Defense - Cross-Tenant Exposure Delete Blocked',
      test12Passed,
      test12Passed
        ? 'HTTP 404 Not Found. Foreign exposure record preserved in PostgreSQL'
        : `Security Risk: Expected 404, received ${idorDeleteExpRes.status}`
    );
    if (!test12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 13: Delete Own Exposure Record (DELETE /api/v1/exposures/:id)
    // -------------------------------------------------------------------------
    const deleteExpRes = await request(app)
      .delete(`/api/v1/exposures/${exposureAId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const dbExposureGone = await prisma.exposureRecord.findUnique({
      where: { id: exposureAId },
    });

    const test13Passed =
      deleteExpRes.status === 200 &&
      dbExposureGone === null;

    record(
      13,
      'Delete Own Exposure Record Successfully',
      test13Passed,
      test13Passed
        ? 'HTTP 200 OK. Exposure record removed from database'
        : `Unexpected status ${deleteExpRes.status}`
    );
    if (!test13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 14: Injected userId Rejected (422)
    // -------------------------------------------------------------------------
    const injectExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: bobId,
        websiteId: websiteAId,
        purpose: 'Injected Exposure',
        dateShared: new Date().toISOString(),
      });

    const test14Passed =
      injectExpRes.status === 422 &&
      injectExpRes.body.message.includes('Security violation');

    record(
      14,
      'Injected userId In Exposure Body Rejected',
      test14Passed,
      test14Passed
        ? `HTTP 422 Unprocessable Entity: "${injectExpRes.body.message}"`
        : `Security Risk: Injected body accepted (${injectExpRes.status})`
    );
    if (!test14Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 15: Unauthenticated Access Blocked (401)
    // -------------------------------------------------------------------------
    const unauthExpRes = await request(app).get('/api/v1/exposures');

    const test15Passed =
      unauthExpRes.status === 401 &&
      unauthExpRes.body.message.includes('Missing Authorization header');

    record(
      15,
      'Unauthenticated Access Blocked',
      test15Passed,
      test15Passed
        ? 'HTTP 401 Unauthorized for unauthenticated request'
        : `Unexpected status ${unauthExpRes.status}`
    );
    if (!test15Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Exposure Test Error:', err);
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
  console.log('MODULE 2 & 3: EXPOSURES & CATEGORIES TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 15 EXPOSURES & CATEGORIES TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runExposureTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
