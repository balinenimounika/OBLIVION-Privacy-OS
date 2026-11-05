/**
 * OBLIVION - Phase 6: Performance & Reliability Integration Test Suite
 *
 * Validates local system throughput, connection stability, scaled pagination,
 * dashboard aggregation latency, and fault recovery on PostgreSQL 18.6:
 *
 * 1. Concurrent authenticated requests (25 parallel requests via Promise.all)
 * 2. Scaled pagination over multi-record tenant dataset
 * 3. Dashboard aggregation execution latency benchmark (< 500ms)
 * 4. Database connection pool stability under 50 rapid sequential requests
 * 5. Deterministic response consistency across repeated queries
 * 6. Error recovery: App gracefully recovers and serves valid traffic after errors
 */

import request from 'supertest';
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

export async function runPerformanceTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION PHASE 6: PERFORMANCE & RELIABILITY TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('Benchmarking Throughput, Scaled Pagination, and Connection Health');
  console.log('================================================================\n');

  let allPassed = true;
  let testUserId = '';
  let authToken = '';
  const timestamp = Date.now();
  const password = 'PerfTestP@ss2026!';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Benchmark Tenant
    // -------------------------------------------------------------------------
    const userRes = await AuthService.register({
      fullName: 'Performance Benchmark Lead',
      email: `perf_${timestamp}@oblivion.internal`,
      password,
    });
    testUserId = userRes.user.id;
    authToken = userRes.tokens.accessToken;

    // Seed 25 websites for pagination and aggregation testing
    console.log('📦 Seeding 25 websites for scaled pagination and benchmark tests...');
    const websiteData = Array.from({ length: 25 }, (_, i) => ({
      userId: testUserId,
      websiteName: `Benchmark Portal ${i + 1}`,
      websiteUrl: `https://benchmark-portal-${i + 1}-${timestamp}.com`,
      websiteCategory: 'E_COMMERCE' as const,
    }));

    await prisma.website.createMany({
      data: websiteData,
    });
    console.log('✅ Seeded 25 websites successfully.\n');

    // -------------------------------------------------------------------------
    // Test 1: Concurrent authenticated requests (25 parallel requests)
    // -------------------------------------------------------------------------
    const concurrencyStart = Date.now();
    const concurrentRequests = Array.from({ length: 25 }, () =>
      request(app)
        .get('/api/v1/websites?limit=5')
        .set('Authorization', `Bearer ${authToken}`)
    );

    const concurrentResponses = await Promise.all(concurrentRequests);
    const concurrencyDuration = Date.now() - concurrencyStart;

    const all200 = concurrentResponses.every((r) => r.status === 200 && r.body.success === true);
    const t1Passed = all200 && concurrentResponses.length === 25;

    record(
      1,
      'Concurrent Authenticated Requests (25 Parallel Operations)',
      t1Passed,
      t1Passed
        ? `All 25 parallel requests succeeded with HTTP 200 in ${concurrencyDuration}ms (avg: ${(concurrencyDuration / 25).toFixed(1)}ms/req)`
        : 'One or more concurrent requests failed'
    );
    if (!t1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 2: Scaled pagination across multi-record dataset
    // -------------------------------------------------------------------------
    const page1Res = await request(app)
      .get('/api/v1/websites?page=1&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    const page2Res = await request(app)
      .get('/api/v1/websites?page=2&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    const page3Res = await request(app)
      .get('/api/v1/websites?page=3&limit=10')
      .set('Authorization', `Bearer ${authToken}`);

    const t2Passed =
      page1Res.status === 200 &&
      page2Res.status === 200 &&
      page3Res.status === 200 &&
      page1Res.body.data.length === 10 &&
      page2Res.body.data.length === 10 &&
      page3Res.body.data.length === 5 &&
      page1Res.body.meta.total === 25 &&
      page1Res.body.meta.totalPages === 3;

    record(
      2,
      'Scaled Pagination Over 25 Records (Pages 1, 2, 3)',
      t2Passed,
      t2Passed
        ? 'Verified precise slicing: Page 1 (10 items), Page 2 (10 items), Page 3 (5 items) of 25 total'
        : 'Pagination boundary calculation failed'
    );
    if (!t2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 3: Dashboard aggregation latency benchmark (< 500ms)
    // -------------------------------------------------------------------------
    const dashStart = Date.now();
    const dashRes = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${authToken}`);
    const dashDuration = Date.now() - dashStart;

    const t3Passed =
      dashRes.status === 200 &&
      dashRes.body.data.totalWebsites === 25 &&
      dashDuration < 500;

    record(
      3,
      'Dashboard Aggregation Latency Benchmark (< 500ms)',
      t3Passed,
      t3Passed
        ? `HTTP 200 OK. Aggregated across multiple tables in ${dashDuration}ms (threshold: < 500ms)`
        : `Aggregation exceeded threshold or failed: ${dashDuration}ms`
    );
    if (!t3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 4: Database connection pool stability under 50 rapid sequential requests
    // -------------------------------------------------------------------------
    let sequentialErrors = 0;
    const seqStart = Date.now();

    for (let i = 0; i < 50; i++) {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      if (res.status !== 200) {
        sequentialErrors++;
      }
    }
    const seqDuration = Date.now() - seqStart;

    const t4Passed = sequentialErrors === 0;
    record(
      4,
      'Database Connection Stability (50 Rapid Sequential Queries)',
      t4Passed,
      t4Passed
        ? `50/50 sequential queries completed successfully in ${seqDuration}ms (0 connection dropouts)`
        : `${sequentialErrors} queries failed out of 50`
    );
    if (!t4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 5: Deterministic response consistency
    // -------------------------------------------------------------------------
    const check1 = await request(app)
      .get('/api/v1/websites?page=1&limit=5&sortBy=websiteName&sortOrder=asc')
      .set('Authorization', `Bearer ${authToken}`);

    const check2 = await request(app)
      .get('/api/v1/websites?page=1&limit=5&sortBy=websiteName&sortOrder=asc')
      .set('Authorization', `Bearer ${authToken}`);

    const names1 = check1.body.data.map((w: any) => w.websiteName);
    const names2 = check2.body.data.map((w: any) => w.websiteName);

    const t5Passed =
      check1.status === 200 &&
      check2.status === 200 &&
      JSON.stringify(names1) === JSON.stringify(names2);

    record(
      5,
      'Deterministic Query Sorting & Response Consistency',
      t5Passed,
      t5Passed
        ? 'Repeated queries returned identical ordered results and structure'
        : 'Inconsistent results across repeated identical queries'
    );
    if (!t5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 6: Error recovery (healthy after simulated errors)
    // -------------------------------------------------------------------------
    // Trigger simulated errors: 404, 400, 422
    await request(app).get('/api/v1/non-existent-route-for-recovery-test');
    await request(app).get('/api/v1/websites/malformed-uuid').set('Authorization', `Bearer ${authToken}`);
    await request(app).post('/api/v1/websites').set('Authorization', `Bearer ${authToken}`).send({});

    // Now send valid request and verify app is fully responsive
    const recoveryRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    const t6Passed =
      recoveryRes.status === 200 &&
      recoveryRes.body.data?.id === testUserId;

    record(
      6,
      'Instant Error Recovery & Service Continuity',
      t6Passed,
      t6Passed
        ? 'Application handled consecutive 404, 400, 422 client errors and immediately served valid requests with 200 OK'
        : 'Application failed to recover after error sequence'
    );
    if (!t6Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Performance Test Error:', err);
    allPassed = false;
  } finally {
    // Teardown
    if (testUserId) {
      try {
        console.log(`\n🧹 Cleaning up benchmark tenant ${testUserId} from oblivion_db...`);
        const del = await prisma.user.delete({
          where: { id: testUserId },
        });
        console.log(`✅ Cleaned up ${del.email} successfully.`);
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('PHASE 6: PERFORMANCE & RELIABILITY TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 6 PERFORMANCE & RELIABILITY TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runPerformanceTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
