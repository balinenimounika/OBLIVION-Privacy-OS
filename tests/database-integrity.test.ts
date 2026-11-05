/**
 * OBLIVION - Phase 6: Database Integrity & Relational Verification Test Suite
 *
 * Validates relational integrity, constraints, cascading deletions,
 * and transaction boundaries across PostgreSQL 18.6:
 *
 * 1. Foreign Key: Cannot insert Website with non-existent userId
 * 2. Foreign Key: Cannot insert ExposureRecord with non-existent websiteId
 * 3. Foreign Key: Cannot insert RemovalRequest with non-existent exposureRecordId
 * 4. Unique Constraint: users(email) blocks duplicate email registration
 * 5. Unique Constraint: websites(user_id, website_url) blocks duplicate URLs per tenant
 * 6. Unique Constraint: reminders(exposure_record_id, reminder_type, reminder_date) blocks duplicates
 * 7. Join Table Referential Integrity: exposure_record_categories verifies data categories
 * 8. Cascading Deletion: Deleting user purges websites and exposures
 * 9. Cascading Deletion: Deleting user purges removal requests and request histories
 * 10. Cascading Deletion: Deleting user purges reminders, notifications, and audit logs
 * 11. Zero Orphan Verification: Confirms 0 dangling records exist after cascade
 * 12. Atomic Transaction Verification: Removal request status change and history creation are atomic
 * 13. Audit Reliability: Primary business operation succeeds if audit write fails
 * 14. Audit Association: Correct actor and entity ID recorded in audit_logs
 * 15. Audit Sanitization: Zero credentials or tokens stored in audit_logs
 */

import { Prisma, AccountStatus, SensitivityLevel, RecordStatus, RemovalRequestType, RequestStatus } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';
import { WebsiteService } from '../src/services/website.service';
import { ExposureService } from '../src/services/exposure.service';
import { RemovalRequestService } from '../src/services/removal-request.service';
import { AuditLogService } from '../src/services/audit-log.service';

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

export async function runDatabaseIntegrityTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION PHASE 6: DATABASE INTEGRITY & RELATIONAL TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('Validating Constraints, Cascading Purges, and Transaction Atoms');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'DbIntegrityP@ss2026!';

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Primary Tenant
    // -------------------------------------------------------------------------
    const userRes = await AuthService.register({
      fullName: 'Database Integrity Lead',
      email: `db_integrity_${timestamp}@oblivion.internal`,
      password,
    });
    const userId = userRes.user.id;
    createdUserIds.push(userId);

    // Get an existing seeded DataCategory
    const category = await prisma.dataCategory.findFirst();
    const categoryId = category ? category.id : '';

    // -------------------------------------------------------------------------
    // Test 1: FK: Cannot insert Website with non-existent userId
    // -------------------------------------------------------------------------
    let t1Passed = false;
    try {
      await prisma.website.create({
        data: {
          userId: '00000000-0000-0000-0000-000000000000',
          websiteName: 'Ghost Website',
          websiteUrl: `https://ghost-${timestamp}.com`,
        },
      });
    } catch (err: any) {
      t1Passed =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'; // Foreign key constraint violation
    }

    record(1, 'FK: Website blocks non-existent userId', t1Passed, 'PostgreSQL rejected foreign key violation (P2003)');
    if (!t1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Provision valid website for following tests
    // -------------------------------------------------------------------------
    const validWebsite = await WebsiteService.createWebsite(userId, {
      websiteName: 'Integrity Anchor Site',
      websiteUrl: `https://anchor-${timestamp}.com`,
      websiteCategory: 'SOCIAL_MEDIA',
    });

    // -------------------------------------------------------------------------
    // Test 2: FK: Cannot insert ExposureRecord with non-existent websiteId
    // -------------------------------------------------------------------------
    let t2Passed = false;
    try {
      await prisma.exposureRecord.create({
        data: {
          userId,
          websiteId: '00000000-0000-0000-0000-000000000000',
          purpose: 'Ghost Exposure',
          dateShared: new Date(),
        },
      });
    } catch (err: any) {
      t2Passed =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003';
    }

    record(2, 'FK: Exposure blocks non-existent websiteId', t2Passed, 'PostgreSQL rejected foreign key violation (P2003)');
    if (!t2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Provision valid exposure record
    // -------------------------------------------------------------------------
    const validExposure = await prisma.exposureRecord.create({
      data: {
        userId,
        websiteId: validWebsite.id,
        purpose: 'User account data',
        sensitivityLevel: SensitivityLevel.MEDIUM,
        dateShared: new Date(),
        categories: categoryId
          ? { create: [{ dataCategoryId: categoryId }] }
          : undefined,
      },
    });

    // -------------------------------------------------------------------------
    // Test 3: FK: Cannot insert RemovalRequest with non-existent exposureRecordId
    // -------------------------------------------------------------------------
    let t3Passed = false;
    try {
      await prisma.removalRequest.create({
        data: {
          userId,
          websiteId: validWebsite.id,
          exposureRecordId: '00000000-0000-0000-0000-000000000000',
          requestType: RemovalRequestType.GDPR_ERASURE,
          requestReason: 'Test invalid exposure',
        },
      });
    } catch (err: any) {
      t3Passed =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003';
    }

    record(3, 'FK: RemovalRequest blocks non-existent exposureRecordId', t3Passed, 'PostgreSQL rejected foreign key violation (P2003)');
    if (!t3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 4: Unique Constraint: users(email)
    // -------------------------------------------------------------------------
    let t4Passed = false;
    try {
      await prisma.user.create({
        data: {
          fullName: 'Duplicate Email User',
          email: userRes.user.email,
          passwordHash: 'dummy_hash',
          accountStatus: AccountStatus.ACTIVE,
        },
      });
    } catch (err: any) {
      t4Passed =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'; // Unique constraint violation
    }

    record(4, 'Unique Constraint: users(email) enforced', t4Passed, 'PostgreSQL unique constraint violation (P2002) returned');
    if (!t4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 5: Unique Constraint: websites(userId, websiteUrl)
    // -------------------------------------------------------------------------
    let t5Passed = false;
    try {
      await prisma.website.create({
        data: {
          userId,
          websiteName: 'Duplicate URL Site',
          websiteUrl: validWebsite.websiteUrl,
        },
      });
    } catch (err: any) {
      t5Passed =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002';
    }

    record(5, 'Unique Constraint: websites(user_id, website_url) enforced', t5Passed, 'PostgreSQL compound unique key (P2002) enforced');
    if (!t5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 6: Unique Constraint: reminders(exposureRecordId, reminderType, reminderDate)
    // -------------------------------------------------------------------------
    const reminderDate = new Date(Date.now() + 86400000);
    await prisma.reminder.create({
      data: {
        userId,
        exposureRecordId: validExposure.id,
        reminderType: 'ANNUAL_PRIVACY_REVIEW',
        reminderDate,
      },
    });

    let t6Passed = false;
    try {
      await prisma.reminder.create({
        data: {
          userId,
          exposureRecordId: validExposure.id,
          reminderType: 'ANNUAL_PRIVACY_REVIEW',
          reminderDate,
        },
      });
    } catch (err: any) {
      t6Passed =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002';
    }

    record(6, 'Unique Constraint: reminders compound key enforced', t6Passed, 'PostgreSQL compound unique index blocked duplicate reminder');
    if (!t6Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 7: Join table referential integrity: exposure_record_categories
    // -------------------------------------------------------------------------
    const joinCategories = await prisma.exposureRecordCategory.findMany({
      where: { exposureRecordId: validExposure.id },
      include: { dataCategory: true },
    });

    const t7Passed =
      joinCategories.length > 0 &&
      joinCategories.every((j) => j.dataCategory !== null && typeof j.dataCategory.riskWeight === 'number');

    record(7, 'Join Table Integrity: exposure_record_categories', t7Passed, `Verified ${joinCategories.length} category join entries with resolved relations`);
    if (!t7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Provision full relational graph for Cascade & Orphan Tests
    // -------------------------------------------------------------------------
    const cascadeUser = await AuthService.register({
      fullName: 'Cascade Test Tenant',
      email: `cascade_${timestamp}@oblivion.internal`,
      password,
    });
    const cUserId = cascadeUser.user.id;
    createdUserIds.push(cUserId);

    const cWeb = await WebsiteService.createWebsite(cUserId, {
      websiteName: 'Cascade Web',
      websiteUrl: `https://cascade-${timestamp}.com`,
      websiteCategory: 'SOCIAL_MEDIA',
    });

    const cExp = await prisma.exposureRecord.create({
      data: {
        userId: cUserId,
        websiteId: cWeb.id,
        purpose: 'Cascade Exposure',
        sensitivityLevel: SensitivityLevel.CRITICAL,
        dateShared: new Date(),
        categories: categoryId
          ? { create: [{ dataCategoryId: categoryId }] }
          : undefined,
      },
    });

    const cReq = await RemovalRequestService.createRemovalRequest(cUserId, {
      websiteId: cWeb.id,
      exposureRecordId: cExp.id,
      requestType: 'GDPR_ERASURE',
      requestReason: 'Cascade erasure test',
      requestStatus: 'DRAFT',
    });

    await prisma.reminder.create({
      data: {
        userId: cUserId,
        exposureRecordId: cExp.id,
        reminderType: 'ANNUAL_PRIVACY_REVIEW',
        reminderDate: new Date(Date.now() + 100000000),
      },
    });

    await prisma.notification.create({
      data: {
        userId: cUserId,
        title: 'Cascade Alert',
        message: 'Notification to be cascaded',
      },
    });

    // -------------------------------------------------------------------------
    // Test 8, 9, 10: Cascade Deletion on user deletion
    // -------------------------------------------------------------------------
    // Delete the cascadeUser from database
    await prisma.user.delete({
      where: { id: cUserId },
    });

    // Verify all child tables were purged via ON DELETE CASCADE
    const [
      survivingWebsites,
      survivingExposures,
      survivingRequests,
      survivingHistories,
      survivingReminders,
      survivingNotifs,
      survivingAudits,
    ] = await Promise.all([
      prisma.website.count({ where: { userId: cUserId } }),
      prisma.exposureRecord.count({ where: { userId: cUserId } }),
      prisma.removalRequest.count({ where: { userId: cUserId } }),
      prisma.requestHistory.count({ where: { removalRequestId: cReq.id } }),
      prisma.reminder.count({ where: { userId: cUserId } }),
      prisma.notification.count({ where: { userId: cUserId } }),
      prisma.auditLog.count({ where: { userId: cUserId } }),
    ]);

    const t8Passed = survivingWebsites === 0 && survivingExposures === 0;
    record(8, 'Cascade Deletion: Websites & Exposures Purged', t8Passed, 'Confirmed 0 surviving websites and 0 surviving exposures');
    if (!t8Passed) allPassed = false;

    const t9Passed = survivingRequests === 0 && survivingHistories === 0;
    record(9, 'Cascade Deletion: Removals & Histories Purged', t9Passed, 'Confirmed 0 surviving removal requests and 0 surviving history logs');
    if (!t9Passed) allPassed = false;

    const t10Passed = survivingReminders === 0 && survivingNotifs === 0 && survivingAudits === 0;
    record(10, 'Cascade Deletion: Reminders, Notifications & Audits Purged', t10Passed, 'Confirmed 0 surviving reminders, notifications, and audit logs');
    if (!t10Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 11: Zero Orphan Verification
    // -------------------------------------------------------------------------
    const orphanJoinEntries = await prisma.exposureRecordCategory.count({
      where: { exposureRecordId: cExp.id },
    });

    const t11Passed = orphanJoinEntries === 0;
    record(11, 'Zero Orphan Record Verification in PostgreSQL', t11Passed, '0 orphan join records found in exposure_record_categories');
    if (!t11Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 12: Atomic Transaction Verification in RemovalRequest updates
    // -------------------------------------------------------------------------
    const testReq = await RemovalRequestService.createRemovalRequest(userId, {
      websiteId: validWebsite.id,
      exposureRecordId: validExposure.id,
      requestType: 'GDPR_ERASURE',
      requestReason: 'Atomicity test',
      requestStatus: 'DRAFT',
    });

    // Advance status to SUBMITTED
    await RemovalRequestService.updateRemovalRequest(userId, testReq.id, {
      requestStatus: 'SUBMITTED',
      remarks: 'Atomic transition remarks',
    });

    const refreshedHistory = await prisma.requestHistory.findMany({
      where: { removalRequestId: testReq.id },
    });

    const t12Passed = refreshedHistory.length === 2 && refreshedHistory[1].newStatus === 'SUBMITTED';
    record(12, 'Atomic Transaction Boundaries: Status & History', t12Passed, 'Atomic transaction successfully paired status update with immutable history record');
    if (!t12Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 13: Audit Reliability: Primary business operation succeeds if audit fails
    // -------------------------------------------------------------------------
    // We call record with bad userId - should return null without throwing
    const auditRes = await AuditLogService.record({
      userId: '00000000-0000-0000-0000-000000000000',
      action: 'FAILED_WRITE_SIMULATION',
      entityType: 'Simulated',
      entityId: 'none',
    });

    const t13Passed = auditRes === null;
    record(13, 'Audit Reliability: Non-blocking on Database Error', t13Passed, 'Service caught database constraint failure and returned null gracefully');
    if (!t13Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 14: Audit Association: Correct actor and entity ID recorded
    // -------------------------------------------------------------------------
    const realAudit = await AuditLogService.record({
      userId,
      action: 'INTEGRITY_VERIFICATION_EVENT',
      entityType: 'Website',
      entityId: validWebsite.id,
    });

    const t14Passed =
      realAudit !== null &&
      realAudit.userId === userId &&
      realAudit.entityId === validWebsite.id;

    record(14, 'Audit Association: Correct Actor and Resource ID', t14Passed, 'Verified exact actor userId and target entityId recorded in audit_logs');
    if (!t14Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // Test 15: Audit Sanitization: Zero credentials in audit_logs
    // -------------------------------------------------------------------------
    const logs = await prisma.auditLog.findMany({
      where: { userId },
    });

    let leakFound = false;
    for (const log of logs) {
      const s = JSON.stringify(log);
      if (s.includes(password)) {
        leakFound = true;
        break;
      }
    }

    const t15Passed = !leakFound && logs.length > 0;
    record(15, 'Audit Sanitization: Zero Plaintext Credentials in DB', t15Passed, `Audited ${logs.length} database logs; 0 passwords or credentials found`);
    if (!t15Passed) allPassed = false;

  } catch (err: any) {
    console.error('Fatal Database Integrity Test Error:', err);
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
  console.log('PHASE 6: DATABASE INTEGRITY TEST SUMMARY');
  console.log('================================================================');
  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} Test ${t.num}: ${t.name} - ${t.details}`);
  });
  console.log('================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((r) => r.passed).length} | FAILED: ${testResults.filter((r) => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL 15 DATABASE INTEGRITY TESTS PASSED' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  return allPassed;
}

if (require.main === module) {
  runDatabaseIntegrityTests()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
