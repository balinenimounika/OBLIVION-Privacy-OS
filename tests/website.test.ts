/**
 * OBLIVION - Module 1: Websites API Integration Test Suite
 *
 * Verifies all CRUD operations, input validations, duplicate URL prevention,
 * pagination/filtering, IDOR/tenant isolation, and parameter injection defense.
 */

import request from 'supertest';
import { WebsiteCategory } from '@prisma/client';
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

async function runWebsiteTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION MODULE 1: WEBSITES API INTEGRATION TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'WebsitesTest2026!#';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Alice (Tenant A) and Bob (Tenant B)
    // -------------------------------------------------------------------------
    const userARes = await AuthService.register({
      fullName: 'Alice Website Tester',
      email: `alice_web_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Website Tester',
      email: `bob_web_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    let aliceWebsiteId = '';
    let bobWebsiteId = '';
    const testUrl = `https://portal-${timestamp}.example.com`;

    // -------------------------------------------------------------------------
    // TEST 1: Create Website Successfully (POST /api/v1/websites)
    // -------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Alice Primary Portal',
        websiteUrl: testUrl,
        websiteCategory: WebsiteCategory.SOCIAL_MEDIA,
      });

    const test1Passed =
      createRes.status === 201 &&
      createRes.body.success === true &&
      createRes.body.data.websiteName === 'Alice Primary Portal' &&
      createRes.body.data.websiteCategory === 'SOCIAL_MEDIA' &&
      createRes.body.data.userId === aliceId;

    if (createRes.body.data?.id) {
      aliceWebsiteId = createRes.body.data.id;
    }

    record(
      1,
      'Create Website Successfully',
      test1Passed,
      test1Passed
        ? `HTTP 201 Created. Website ID: ${aliceWebsiteId}, Name: ${createRes.body.data.websiteName}`
        : `Failed with status ${createRes.status}: ${JSON.stringify(createRes.body)}`
    );
    if (!test1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Reject Invalid URL Format (422)
    // -------------------------------------------------------------------------
    const invalidUrlRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Invalid URL Site',
        websiteUrl: 'not-a-valid-url-format',
      });

    const test2Passed =
      invalidUrlRes.status === 422 &&
      invalidUrlRes.body.success === false &&
      invalidUrlRes.body.errors?.some((e: any) => e.field === 'websiteUrl');

    record(
      2,
      'Reject Invalid URL Format',
      test2Passed,
      test2Passed
        ? `HTTP 422 Unprocessable Entity. Rejected invalid URL format`
        : `Unexpected status ${invalidUrlRes.status}`
    );
    if (!test2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: Reject Missing Required Fields (422)
    // -------------------------------------------------------------------------
    const missingNameRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteUrl: `https://valid-url-${timestamp}.com`,
      });

    const test3Passed =
      missingNameRes.status === 422 &&
      missingNameRes.body.errors?.some((e: any) => e.field === 'websiteName');

    record(
      3,
      'Reject Missing Required Fields',
      test3Passed,
      test3Passed
        ? 'HTTP 422 Unprocessable Entity on missing websiteName'
        : `Unexpected status ${missingNameRes.status}`
    );
    if (!test3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Prevent Duplicate Website URL for Same User (409 Conflict)
    // -------------------------------------------------------------------------
    const dupUrlRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Duplicate Portal Attempt',
        websiteUrl: testUrl, // Same URL for Alice
      });

    const test4Passed =
      dupUrlRes.status === 409 &&
      dupUrlRes.body.success === false &&
      dupUrlRes.body.message.includes('already been registered');

    record(
      4,
      'Prevent Duplicate Website URL for Same User',
      test4Passed,
      test4Passed
        ? `HTTP 409 Conflict: "${dupUrlRes.body.message}"`
        : `Failed: Duplicate URL was accepted (${dupUrlRes.status})`
    );
    if (!test4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: Allow Different User (Bob) to Register the Same URL
    // -------------------------------------------------------------------------
    const bobSameUrlRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        websiteName: "Bob's View of Portal",
        websiteUrl: testUrl, // Same URL, different tenant
        websiteCategory: WebsiteCategory.FINANCIAL_SERVICES,
      });

    const test5Passed =
      bobSameUrlRes.status === 201 &&
      bobSameUrlRes.body.data.userId === bobId;

    if (bobSameUrlRes.body.data?.id) {
      bobWebsiteId = bobSameUrlRes.body.data.id;
    }

    record(
      5,
      'Allow Different Tenant to Register Identical URL',
      test5Passed,
      test5Passed
        ? `HTTP 201 Created. Multi-tenancy verified: Identical URL isolated under Bob (ID: ${bobWebsiteId})`
        : `Failed: Unexpected status ${bobSameUrlRes.status}`
    );
    if (!test5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: List Websites with Pagination (GET /api/v1/websites)
    // -------------------------------------------------------------------------
    // Create a second website for Alice to test pagination
    await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Alice Second Portal',
        websiteUrl: `https://second-${timestamp}.example.com`,
        websiteCategory: WebsiteCategory.E_COMMERCE,
      });

    const listRes = await request(app)
      .get('/api/v1/websites?page=1&limit=1')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test6Passed =
      listRes.status === 200 &&
      listRes.body.data.length === 1 &&
      listRes.body.meta.total === 2 &&
      listRes.body.meta.totalPages === 2 &&
      listRes.body.meta.page === 1;

    record(
      6,
      'List Websites with Pagination & Metadata',
      test6Passed,
      test6Passed
        ? `HTTP 200 OK. Page 1/2 returned 1 item (Total: ${listRes.body.meta.total} records)`
        : `Unexpected response: ${JSON.stringify(listRes.body)}`
    );
    if (!test6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: Search and Filter by Category
    // -------------------------------------------------------------------------
    const searchRes = await request(app)
      .get('/api/v1/websites?search=Second&category=E_COMMERCE')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test7Passed =
      searchRes.status === 200 &&
      searchRes.body.data.length === 1 &&
      searchRes.body.data[0].websiteName === 'Alice Second Portal' &&
      searchRes.body.data[0].websiteCategory === 'E_COMMERCE';

    record(
      7,
      'Search and Filter by Category',
      test7Passed,
      test7Passed
        ? `HTTP 200 OK. Filtered 1 match for category E_COMMERCE and search term 'Second'`
        : `Unexpected filter result: ${JSON.stringify(searchRes.body)}`
    );
    if (!test7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: Retrieve Single Website by ID (GET /api/v1/websites/:id)
    // -------------------------------------------------------------------------
    const getRes = await request(app)
      .get(`/api/v1/websites/${aliceWebsiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test8Passed =
      getRes.status === 200 &&
      getRes.body.data.id === aliceWebsiteId &&
      getRes.body.data.userId === aliceId;

    record(
      8,
      'Retrieve Single Website by ID',
      test8Passed,
      test8Passed
        ? `HTTP 200 OK. Retrieved '${getRes.body.data.websiteName}'`
        : `Unexpected status ${getRes.status}`
    );
    if (!test8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: IDOR Defense - User A Cannot Retrieve User B's Website (404)
    // -------------------------------------------------------------------------
    const idorGetRes = await request(app)
      .get(`/api/v1/websites/${bobWebsiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const test9Passed =
      idorGetRes.status === 404 &&
      idorGetRes.body.message === 'Website not found';

    record(
      9,
      'IDOR Defense - Cross-Tenant Retrieval Blocked',
      test9Passed,
      test9Passed
        ? 'HTTP 404 Not Found. Existence of foreign website withheld from User A.'
        : `Security Risk: Expected 404, received ${idorGetRes.status}`
    );
    if (!test9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 10: Update Website (PATCH /api/v1/websites/:id)
    // -------------------------------------------------------------------------
    const updateRes = await request(app)
      .patch(`/api/v1/websites/${aliceWebsiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Alice Renamed Portal',
        websiteCategory: WebsiteCategory.HEALTHCARE,
      });

    const test10Passed =
      updateRes.status === 200 &&
      updateRes.body.data.websiteName === 'Alice Renamed Portal' &&
      updateRes.body.data.websiteCategory === 'HEALTHCARE';

    record(
      10,
      'Update Website Details',
      test10Passed,
      test10Passed
        ? `HTTP 200 OK. Updated name to '${updateRes.body.data.websiteName}' and category to HEALTHCARE`
        : `Unexpected status ${updateRes.status}`
    );
    if (!test10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 11: IDOR Defense - User A Cannot Update User B's Website (404)
    // -------------------------------------------------------------------------
    const idorUpdateRes = await request(app)
      .patch(`/api/v1/websites/${bobWebsiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'Malicious Tamper Name',
      });

    const dbBobWebsite = await prisma.website.findUnique({
      where: { id: bobWebsiteId },
    });

    const test11Passed =
      idorUpdateRes.status === 404 &&
      dbBobWebsite?.websiteName === "Bob's View of Portal";

    record(
      11,
      'IDOR Defense - Cross-Tenant Update Blocked',
      test11Passed,
      test11Passed
        ? "HTTP 404 Not Found. Target database record remained unmodified."
        : `Security Risk: Expected 404, received ${idorUpdateRes.status}`
    );
    if (!test11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 12: IDOR Defense - User A Cannot Delete User B's Website (404)
    // -------------------------------------------------------------------------
    const idorDeleteRes = await request(app)
      .delete(`/api/v1/websites/${bobWebsiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const dbBobWebsiteStillExists = await prisma.website.findUnique({
      where: { id: bobWebsiteId },
    });

    const test12Passed =
      idorDeleteRes.status === 404 &&
      dbBobWebsiteStillExists !== null;

    record(
      12,
      'IDOR Defense - Cross-Tenant Delete Blocked',
      test12Passed,
      test12Passed
        ? 'HTTP 404 Not Found. Foreign record preserved in PostgreSQL.'
        : `Security Risk: Expected 404, received ${idorDeleteRes.status}`
    );
    if (!test12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 13: Delete Own Website Successfully (DELETE /api/v1/websites/:id)
    // -------------------------------------------------------------------------
    const deleteRes = await request(app)
      .delete(`/api/v1/websites/${aliceWebsiteId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const dbAliceWebsiteGone = await prisma.website.findUnique({
      where: { id: aliceWebsiteId },
    });

    const test13Passed =
      deleteRes.status === 200 &&
      dbAliceWebsiteGone === null;

    record(
      13,
      'Delete Own Website Successfully',
      test13Passed,
      test13Passed
        ? 'HTTP 200 OK. Website removed from database.'
        : `Unexpected status ${deleteRes.status}`
    );
    if (!test13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 14: Injected userId in Body Rejected (422)
    // -------------------------------------------------------------------------
    const injectRes = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        userId: bobId,
        websiteName: 'Injected Website',
        websiteUrl: `https://injected-${timestamp}.com`,
      });

    const test14Passed =
      injectRes.status === 422 &&
      injectRes.body.message.includes('Security violation');

    record(
      14,
      'Injected userId In Request Body Rejected',
      test14Passed,
      test14Passed
        ? `HTTP 422 Unprocessable Entity: "${injectRes.body.message}"`
        : `Security Risk: Injected body accepted (${injectRes.status})`
    );
    if (!test14Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 15: Unauthenticated Access Blocked (401)
    // -------------------------------------------------------------------------
    const unauthRes = await request(app).get('/api/v1/websites');

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

    // -------------------------------------------------------------------------
    // TEST 16: Malformed UUID Parameter Rejected (400)
    // -------------------------------------------------------------------------
    const malformedIdRes = await request(app)
      .get('/api/v1/websites/not-a-valid-uuid')
      .set('Authorization', `Bearer ${aliceToken}`);

    const test16Passed =
      malformedIdRes.status === 400 &&
      malformedIdRes.body.message.includes('Expected valid UUID');

    record(
      16,
      'Malformed UUID Parameter Rejected',
      test16Passed,
      test16Passed
        ? `HTTP 400 Bad Request: "${malformedIdRes.body.message}"`
        : `Unexpected status ${malformedIdRes.status}`
    );
    if (!test16Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Website Test Error:', err);
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
  console.log('MODULE 1: WEBSITES API TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 16 WEBSITES API TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runWebsiteTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
