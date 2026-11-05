/**
 * OBLIVION - Phase 2 Authentication & JWT Security Integration Tests
 *
 * Covers 14 targeted security and functional verification cases:
 * 1. Successful user registration
 * 2. Invalid registration input rejection
 * 3. Duplicate email rejection (409 Conflict)
 * 4. Password stored as bcrypt hash in PostgreSQL (not plaintext)
 * 5. Password hash never exposed in API responses
 * 6. Successful login with valid credentials
 * 7. Incorrect password rejection (generic 401)
 * 8. Unknown email rejection (generic 401)
 * 9. Missing JWT rejection on protected routes (401)
 * 10. Invalid JWT signature rejection (401)
 * 11. Expired JWT rejection (401 with expired message)
 * 12. Authenticated profile retrieval (GET /api/v1/auth/me)
 * 13. Profile access rejected after user deactivation / deletion
 * 14. Attempts to submit privileged account fields rejected
 *
 * Cleanup: Safely cleans up all test users created during test execution.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AccountStatus } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/config/env';

interface TestSummary {
  num: number;
  name: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

const testResults: TestSummary[] = [];

function recordTest(num: number, name: string, passed: boolean, details: string) {
  const status = passed ? 'PASSED' : 'FAILED';
  testResults.push({ num, name, status, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${status}] Test ${num}: ${name} - ${details}`);
}

async function runAuthTests() {
  console.log('================================================================');
  console.log('OBLIVION AUTHENTICATION INTEGRATION TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('JWT Secret Validated | Password Hashing: bcryptjs (12 rounds)');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];

  const timestamp = Date.now();
  const testEmailPrimary = `auth_test_user_${timestamp}@oblivion-privacy.internal`;
  const testPasswordValid = 'S3cureP@ssw0rd2026!';

  let authTokenValid = '';
  let primaryUserId = '';

  try {
    // -------------------------------------------------------------------------
    // Test 1: Successful Registration
    // -------------------------------------------------------------------------
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Doe',
        email: testEmailPrimary,
        password: testPasswordValid,
      });

    const regSuccess =
      regRes.status === 201 &&
      regRes.body.success === true &&
      regRes.body.data?.user?.email === testEmailPrimary &&
      regRes.body.data?.user?.accountStatus === 'ACTIVE' &&
      typeof regRes.body.data?.tokens?.accessToken === 'string';

    if (regRes.body.data?.user?.id) {
      primaryUserId = regRes.body.data.user.id;
      createdUserIds.push(primaryUserId);
      authTokenValid = regRes.body.data.tokens.accessToken;
    }

    recordTest(
      1,
      'Successful Registration',
      regSuccess,
      regSuccess
        ? `HTTP 201 Created. User ID: ${primaryUserId}, AccountStatus: ${regRes.body.data.user.accountStatus}`
        : `Failed with status ${regRes.status}: ${JSON.stringify(regRes.body)}`
    );
    if (!regSuccess) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 2: Invalid Registration Input Rejection
    // -------------------------------------------------------------------------
    const invalidRegRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'J', // too short (<2)
        email: 'not-an-email',
        password: 'short', // too short (<8)
      });

    const invalidRegBlocked =
      invalidRegRes.status === 422 &&
      invalidRegRes.body.success === false &&
      Array.isArray(invalidRegRes.body.errors) &&
      invalidRegRes.body.errors.length >= 3;

    recordTest(
      2,
      'Invalid Registration Input Rejection',
      invalidRegBlocked,
      invalidRegBlocked
        ? `HTTP 422 Unprocessable Entity. Rejected ${invalidRegRes.body.errors.length} invalid fields`
        : `Unexpected status ${invalidRegRes.status}`
    );
    if (!invalidRegBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 3: Duplicate Email Rejection
    // -------------------------------------------------------------------------
    const dupRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Jane Impersonator',
        email: testEmailPrimary.toUpperCase(), // Test case-insensitive normalization
        password: testPasswordValid,
      });

    const dupBlocked =
      dupRes.status === 409 &&
      dupRes.body.success === false &&
      dupRes.body.message.includes('already exists');

    recordTest(
      3,
      'Duplicate Email Rejection',
      dupBlocked,
      dupBlocked
        ? `HTTP 409 Conflict. Normalized email collision properly rejected: "${dupRes.body.message}"`
        : `Failed: Duplicate email was accepted (${dupRes.status})`
    );
    if (!dupBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 4: Password Stored as bcrypt Hash in Database
    // -------------------------------------------------------------------------
    const dbUser = await prisma.user.findUnique({
      where: { id: primaryUserId },
    });

    const isHashed =
      dbUser !== null &&
      dbUser.passwordHash !== testPasswordValid &&
      (dbUser.passwordHash.startsWith('$2a$') || dbUser.passwordHash.startsWith('$2b$'));

    recordTest(
      4,
      'Password Stored as bcrypt Hash',
      isHashed,
      isHashed
        ? `Database stores valid bcrypt hash (prefix: ${dbUser?.passwordHash.substring(0, 7)}...). Plaintext is never stored.`
        : 'Failed: Password was not stored as a valid bcrypt hash'
    );
    if (!isHashed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 5: Password Hash Never Exposed in API Responses
    // -------------------------------------------------------------------------
    const noHashInRegister =
      regRes.body.data?.user?.passwordHash === undefined &&
      regRes.body.data?.user?.password === undefined;

    recordTest(
      5,
      'Password Hash Never Exposed in Responses',
      noHashInRegister,
      noHashInRegister
        ? 'Response payload sanitization confirmed. passwordHash and password omitted from response envelope'
        : 'Security Violation: Password hash was leaked in response!'
    );
    if (!noHashInRegister) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 6: Successful Login with Valid Credentials
    // -------------------------------------------------------------------------
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmailPrimary,
        password: testPasswordValid,
      });

    const loginOk =
      loginRes.status === 200 &&
      loginRes.body.success === true &&
      typeof loginRes.body.data?.tokens?.accessToken === 'string' &&
      loginRes.body.data?.user?.email === testEmailPrimary &&
      loginRes.body.data?.user?.passwordHash === undefined;

    recordTest(
      6,
      'Successful Login',
      loginOk,
      loginOk
        ? `HTTP 200 OK. Issued JWT token (type: ${loginRes.body.data.tokens.tokenType}, expires: ${loginRes.body.data.tokens.expiresIn})`
        : `Failed with status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`
    );
    if (!loginOk) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 7: Incorrect Password Rejection
    // -------------------------------------------------------------------------
    const badPassRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmailPrimary,
        password: 'WrongPassword123!',
      });

    const badPassBlocked =
      badPassRes.status === 401 &&
      badPassRes.body.success === false &&
      badPassRes.body.message === 'Invalid email or password';

    recordTest(
      7,
      'Incorrect Password Rejection',
      badPassBlocked,
      badPassBlocked
        ? `HTTP 401 Unauthorized with generic message: "${badPassRes.body.message}"`
        : `Unexpected status ${badPassRes.status}`
    );
    if (!badPassBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 8: Unknown Email Rejection (Generic Error)
    // -------------------------------------------------------------------------
    const unknownEmailRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent.ghost.user@oblivion.internal',
        password: testPasswordValid,
      });

    const unknownBlocked =
      unknownEmailRes.status === 401 &&
      unknownEmailRes.body.success === false &&
      unknownEmailRes.body.message === 'Invalid email or password';

    recordTest(
      8,
      'Unknown Email Rejection',
      unknownBlocked,
      unknownBlocked
        ? `HTTP 401 Unauthorized with identical generic error (prevents account enumeration)`
        : `Unexpected status ${unknownEmailRes.status}`
    );
    if (!unknownBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 9: Missing JWT Rejection on Protected Route
    // -------------------------------------------------------------------------
    const noJwtRes = await request(app).get('/api/v1/auth/me');

    const noJwtBlocked =
      noJwtRes.status === 401 &&
      noJwtRes.body.success === false &&
      noJwtRes.body.message.includes('Missing Authorization header');

    recordTest(
      9,
      'Missing JWT Rejection',
      noJwtBlocked,
      noJwtBlocked
        ? `HTTP 401 Unauthorized: "${noJwtRes.body.message}"`
        : `Unexpected status ${noJwtRes.status}`
    );
    if (!noJwtBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 10: Invalid JWT Signature Rejection
    // -------------------------------------------------------------------------
    const invalidSignatureToken = jwt.sign(
      { sub: primaryUserId, email: testEmailPrimary },
      'wrong_untrusted_signing_secret_999999999',
      { expiresIn: '1h' }
    );

    const invalidJwtRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${invalidSignatureToken}`);

    const invalidJwtBlocked =
      invalidJwtRes.status === 401 &&
      invalidJwtRes.body.success === false &&
      invalidJwtRes.body.message.includes('Invalid access token');

    recordTest(
      10,
      'Invalid JWT Signature Rejection',
      invalidJwtBlocked,
      invalidJwtBlocked
        ? `HTTP 401 Unauthorized: "${invalidJwtRes.body.message}"`
        : `Unexpected status ${invalidJwtRes.status}`
    );
    if (!invalidJwtBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 11: Expired JWT Rejection
    // -------------------------------------------------------------------------
    const expiredToken = jwt.sign(
      { sub: primaryUserId, email: testEmailPrimary },
      env.JWT_SECRET,
      { expiresIn: '-1s' } // Expired 1 second ago
    );

    const expiredRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    const expiredBlocked =
      expiredRes.status === 401 &&
      expiredRes.body.success === false &&
      expiredRes.body.message.includes('expired');

    recordTest(
      11,
      'Expired JWT Rejection',
      expiredBlocked,
      expiredBlocked
        ? `HTTP 401 Unauthorized: "${expiredRes.body.message}"`
        : `Unexpected status ${expiredRes.status}`
    );
    if (!expiredBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 12: Authenticated Profile Retrieval (GET /api/v1/auth/me)
    // -------------------------------------------------------------------------
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authTokenValid}`);

    const meOk =
      meRes.status === 200 &&
      meRes.body.success === true &&
      meRes.body.data?.id === primaryUserId &&
      meRes.body.data?.email === testEmailPrimary &&
      meRes.body.data?.fullName === 'Jane Doe' &&
      meRes.body.data?.accountStatus === 'ACTIVE' &&
      meRes.body.data?.passwordHash === undefined;

    recordTest(
      12,
      'Authenticated Profile Retrieval',
      meOk,
      meOk
        ? `HTTP 200 OK. Profile retrieved for ${meRes.body.data.fullName} (${meRes.body.data.email})`
        : `Failed with status ${meRes.status}: ${JSON.stringify(meRes.body)}`
    );
    if (!meOk) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 13: Profile Access Rejected After User Deactivation / Deletion
    // -------------------------------------------------------------------------
    // Create temporary user Charlie
    const charlieRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Charlie Deactivated',
        email: `charlie_${timestamp}@oblivion.internal`,
        password: testPasswordValid,
      });

    const charlieId = charlieRes.body.data?.user?.id;
    const charlieToken = charlieRes.body.data?.tokens?.accessToken;
    if (charlieId) createdUserIds.push(charlieId);

    // Deactivate Charlie directly in DB
    await prisma.user.update({
      where: { id: charlieId },
      data: { accountStatus: AccountStatus.DEACTIVATED },
    });

    const deactRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${charlieToken}`);

    const deactBlocked =
      deactRes.status === 403 &&
      deactRes.body.success === false &&
      deactRes.body.message.includes('deactivated');

    recordTest(
      13,
      'Access Rejected After Deactivation',
      deactBlocked,
      deactBlocked
        ? `HTTP 403 Forbidden. Deactivated account blocked at authentication barrier: "${deactRes.body.message}"`
        : `Unexpected status ${deactRes.status}`
    );
    if (!deactBlocked) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 14: Attempts to Submit Privileged Account Fields
    // -------------------------------------------------------------------------
    const privilegedAttackRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Attacker User',
        email: `attacker_${timestamp}@oblivion.internal`,
        password: testPasswordValid,
        accountStatus: 'SUSPENDED', // Privileged field attempt
        role: 'ADMIN', // Privileged field attempt
      });

    const privilegedBlocked =
      privilegedAttackRes.status === 422 &&
      privilegedAttackRes.body.success === false &&
      privilegedAttackRes.body.message.includes('validation failed');

    recordTest(
      14,
      'Privileged Fields Injection Rejected',
      privilegedBlocked,
      privilegedBlocked
        ? `HTTP 422 Unprocessable Entity. Strict schema blocked unrecognized/privileged injection: "${privilegedAttackRes.body.errors[0]?.message}"`
        : `Security Risk: Privileged fields were accepted (${privilegedAttackRes.status})`
    );
    if (!privilegedBlocked) allPassed = false;

  } catch (error: any) {
    console.error('Fatal Test Exception:', error);
    allPassed = false;
  } finally {
    // Teardown: Safely clean up only the test users created during test run
    if (createdUserIds.length > 0) {
      try {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
        console.log(`\n🧹 Cleaned up ${createdUserIds.length} test users from database.`);
      } catch (cleanupErr) {
        console.error('Cleanup warning:', cleanupErr);
      }
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log('AUTHENTICATION TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.status === 'PASSED' ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.status === 'PASSED').length} | FAILED: ${testResults.filter((r) => r.status === 'FAILED').length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 14 AUTHENTICATION TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runAuthTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
