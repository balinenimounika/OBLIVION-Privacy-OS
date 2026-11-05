/**
 * OBLIVION - Phase 1 Integration Tests
 *
 * Tests:
 * 1. Root /health endpoint (HTTP 200, database connected)
 * 2. API v1 /api/v1/health endpoint (HTTP 200, database connected)
 * 3. Security headers (Helmet)
 * 4. CORS headers
 * 5. 404 route handling
 * 6. Prisma singleton connectivity
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

interface TestSummary {
  name: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

const testResults: TestSummary[] = [];

function recordTest(name: string, passed: boolean, details: string) {
  const status = passed ? 'PASSED' : 'FAILED';
  testResults.push({ name, status, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}: ${details}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('OBLIVION BACKEND PHASE 1 INTEGRATION TESTS');
  console.log('Target: Express.js App + PostgreSQL 18.6 + Prisma 6.19.3');
  console.log('================================================================\n');

  let allPassed = true;

  try {
    // -------------------------------------------------------------------------
    // 1. Prisma Singleton Database Check
    // -------------------------------------------------------------------------
    const dbRes = await prisma.$queryRaw<Array<{ db: string; ver: string }>>`
      SELECT current_database() as db, version() as ver;
    `;
    const dbConnected = dbRes.length > 0 && dbRes[0].db === 'oblivion_db';
    recordTest(
      'Prisma Singleton Connection',
      dbConnected,
      dbConnected ? `Connected to ${dbRes[0].db}. Engine: ${dbRes[0].ver.split(' ')[0]} ${dbRes[0].ver.split(' ')[1]}` : 'Failed database query'
    );
    if (!dbConnected) allPassed = false;

    // -------------------------------------------------------------------------
    // 2. GET /health (Root Health Check)
    // -------------------------------------------------------------------------
    const resRoot = await request(app).get('/health');
    const rootOk =
      resRoot.status === 200 &&
      resRoot.body.success === true &&
      resRoot.body.data?.status === 'healthy' &&
      resRoot.body.data?.database?.status === 'connected';

    recordTest(
      'GET /health (Root Health Check)',
      rootOk,
      rootOk
        ? `Status 200 OK. Database: ${resRoot.body.data.database.status}, Latency: ${resRoot.body.data.database.latencyMs}ms`
        : `Failed with status ${resRoot.status}: ${JSON.stringify(resRoot.body)}`
    );
    if (!rootOk) allPassed = false;

    // -------------------------------------------------------------------------
    // 3. GET /api/v1/health (API v1 Health Check)
    // -------------------------------------------------------------------------
    const resApi = await request(app).get('/api/v1/health');
    const apiOk =
      resApi.status === 200 &&
      resApi.body.success === true &&
      resApi.body.data?.status === 'healthy';

    recordTest(
      'GET /api/v1/health (Router Health Check)',
      apiOk,
      apiOk ? `Status 200 OK. Environment: ${resApi.body.data.environment}, Uptime: ${resApi.body.data.uptimeSeconds}s` : `Failed: status ${resApi.status}`
    );
    if (!apiOk) allPassed = false;

    // -------------------------------------------------------------------------
    // 4. Security Headers (Helmet)
    // -------------------------------------------------------------------------
    const hasHelmet =
      resRoot.headers['x-content-type-options'] === 'nosniff' &&
      resRoot.headers['x-dns-prefetch-control'] !== undefined;

    recordTest(
      'Security Headers (Helmet)',
      hasHelmet,
      hasHelmet ? 'x-content-type-options: nosniff and security headers present' : 'Missing security headers'
    );
    if (!hasHelmet) allPassed = false;

    // -------------------------------------------------------------------------
    // 5. CORS Headers
    // -------------------------------------------------------------------------
    const resCors = await request(app).options('/api/v1/health').set('Origin', 'http://localhost:3000');
    const hasCors = resCors.headers['access-control-allow-origin'] !== undefined;
    recordTest(
      'CORS Configuration',
      hasCors,
      hasCors ? `access-control-allow-origin header returned: ${resCors.headers['access-control-allow-origin']}` : 'Missing CORS header'
    );
    if (!hasCors) allPassed = false;

    // -------------------------------------------------------------------------
    // 6. Centralized 404 Error Handling
    // -------------------------------------------------------------------------
    const res404 = await request(app).get('/api/v1/non-existent-route-for-testing');
    const is404 =
      res404.status === 404 &&
      res404.body.success === false &&
      res404.body.message.includes('Route not found');

    recordTest(
      'Centralized 404 Route Handling',
      is404,
      is404 ? `Returned structured JSON 404: "${res404.body.message}"` : `Unexpected response: ${res404.status}`
    );
    if (!is404) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Test Exception:', err);
    allPassed = false;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('PHASE 1 TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.status === 'PASSED' ? '✅' : '❌'} ${t.name}: ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.status === 'PASSED').length} | FAILED: ${testResults.filter((r) => r.status === 'FAILED').length}`);
  console.log(`RESULT: ${allPassed ? 'ALL PHASE 1 TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
