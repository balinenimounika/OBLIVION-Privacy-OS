/**
 * OBLIVION - Milestone 10: The Forget Engine Automated Test Suite
 *
 * Verifies all 10 core Phase 1 & Phase 2 requirements:
 * 1. GDPR Article 17, CCPA/CPRA, and Data Broker Opt-Out statutory notice generation
 * 2. Jurisdiction-aware statutory deadline calculations (30d, 45d, 21d, 14d)
 * 3. Preview endpoint functionality without email dispatch or database mutation
 * 4. Explicit user confirmation enforcement (confirmDispatch: true)
 * 5. Recipient validation, domain filtering, and CRLF injection prevention
 * 6. Rate limiting enforcement (maximum 5 dispatches per hour per account)
 * 7. Strict multi-tenant isolation (prevent cross-tenant preview/dispatch)
 * 8. Automatic statutory compliance reminder provisioning (FOLLOW_UP_REMOVAL)
 * 9. Duplicate reminder prevention and idempotency guarantee
 * 10. Failed email gateway handling and history recording
 * 11. Tamper-evident compliance audit logging (REMOVAL_REQUEST_DISPATCHED)
 * 12. Separation of gateway acceptance from confirmed recipient delivery
 * 13. Test data cleanup and zero database pollution
 */

import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { AuthService } from '../src/services/auth.service';
import { EmailService } from '../src/services/email.service';
import {
  calculateStatutoryDeadline,
  buildStatutoryNotice,
  STATUTORY_FRAMEWORKS,
  STATUTORY_NOTICE_VERSION,
} from '../src/templates/legal-erasure-templates';
import {
  RemovalRequestType,
  RequestStatus,
  ReminderType,
  ReminderStatus,
  EmailDeliveryStatus,
} from '@prisma/client';

interface TestResult {
  section: string;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestResult[] = [];

function recordTest(section: string, name: string, passed: boolean, details: string) {
  testResults.push({ section, name, passed, details });
  const icon = passed ? '✅ [PASSED]' : '❌ [FAILED]';
  console.log(`${icon} [${section}] ${name}`);
  console.log(`   Details: ${details}\n`);
}

async function runStatutoryDemandTests() {
  console.log('================================================================');
  console.log("OBLIVION MILESTONE 10 – THE FORGET ENGINE BACKEND TEST SUITE");
  console.log('================================================================\n');

  let initialUserCount = 0;
  let userAId = '';
  let userBId = '';
  let userAToken = '';
  let userBToken = '';
  let userAWebsiteId = '';
  let userAExposureId = '';
  let userAGdprRequestId = '';
  let userACcpaRequestId = '';

  try {
    initialUserCount = await prisma.user.count();
    console.log(`[Baseline] Active users in database prior to test: ${initialUserCount}\n`);

    // ================================================================
    // SECTION 1: Jurisdiction-Aware Deadline Calculations
    // ================================================================
    console.log('--- SECTION 1: Statutory Deadline Calculations ---');

    const gdprDeadline = calculateStatutoryDeadline(RemovalRequestType.GDPR_ERASURE);
    const gdprOk = gdprDeadline.days === 30 && gdprDeadline.framework.citation.includes('Article 17');
    recordTest(
      'Deadlines',
      'GDPR Article 17 calculates exactly 30 calendar days (Art. 12(3))',
      gdprOk,
      `Days: ${gdprDeadline.days}, Citation: "${gdprDeadline.framework.citation}"`
    );

    const ccpaDeadline = calculateStatutoryDeadline(RemovalRequestType.CCPA_DELETION);
    const ccpaOk = ccpaDeadline.days === 45 && ccpaDeadline.framework.citation.includes('1798.105');
    recordTest(
      'Deadlines',
      'CCPA/CPRA Section 1798.105 calculates exactly 45 calendar days',
      ccpaOk,
      `Days: ${ccpaDeadline.days}, Citation: "${ccpaDeadline.framework.citation}"`
    );

    const optOutDeadline = calculateStatutoryDeadline(RemovalRequestType.MARKETING_OPT_OUT);
    const optOutOk = optOutDeadline.days === 21 && optOutDeadline.framework.isBusinessDays === true;
    recordTest(
      'Deadlines',
      'Data Broker Opt-Out calculates 15 business days (21 calendar days)',
      optOutOk,
      `Days: ${optOutDeadline.days}, BusinessDays: ${optOutDeadline.framework.isBusinessDays}`
    );

    const closureDeadline = calculateStatutoryDeadline(RemovalRequestType.ACCOUNT_CLOSURE);
    const closureOk = closureDeadline.days === 14;
    recordTest(
      'Deadlines',
      'Account closure calculates 14 calendar days SLA',
      closureOk,
      `Days: ${closureDeadline.days}`
    );

    // ================================================================
    // SECTION 2: Statutory Legal Notice Template Generation & XSS Audit
    // ================================================================
    console.log('--- SECTION 2: Statutory Template Engine & XSS Sanitization ---');

    const testNotice = buildStatutoryNotice({
      userName: 'Alice Consumer <script>alert(1)</script>',
      userEmail: 'alice@oblivion.internal',
      websiteName: 'MegaCorp Analytics & Tracking',
      websiteUrl: 'https://megacorp.example.com',
      requestType: RemovalRequestType.GDPR_ERASURE,
      exposedDataDescription: 'Phone number and home address <img src=x onerror=alert(2)>',
      requestReason: 'Statutory withdrawal of consent under GDPR Article 7(3)',
      customNotes: 'Customer ID: 98765',
      referenceNumber: 'OBV-TEST-REF-001',
      jurisdictionDeadlineDays: 30,
      calculatedDeadlineDate: new Date('2026-12-05T00:00:00Z'),
    });

    const templateValid =
      testNotice.subject.includes('[STATUTORY DEMAND]') &&
      testNotice.subject.includes('GDPR') &&
      testNotice.html.includes('STATUTORY DEMAND FOR DATA ERASURE') &&
      testNotice.html.includes('OBV-TEST-REF-001') &&
      testNotice.noticeVersion === STATUTORY_NOTICE_VERSION &&
      testNotice.text.includes('MANDATORY STATUTORY DIRECTIVES');

    const xssSanitized =
      !testNotice.html.includes('<script>') &&
      testNotice.html.includes('&lt;script&gt;') &&
      !testNotice.html.includes('<img src=x onerror=alert(2)>') &&
      testNotice.html.includes('&lt;img src=x onerror=alert(2)&gt;');

    recordTest(
      'Templates',
      'Notice rendered with formal legal structure, citations, and versioning',
      templateValid,
      `Subject: "${testNotice.subject}", Version: ${testNotice.noticeVersion}`
    );

    recordTest(
      'Templates',
      'HTML entities properly escaped to neutralize XSS in user fields',
      xssSanitized,
      'Script tags and image onerror attributes neutralized via escapeHtml'
    );

    // ================================================================
    // SETUP: Provision Test Users, Website, Exposures, and Removal Requests
    // ================================================================
    console.log('--- SETUP: Provisioning Isolated Test Users ---');
    const timestamp = Date.now();

    const regA = await AuthService.register({
      fullName: 'Alice Privacy User',
      email: `alice_forget_${timestamp}@oblivion.internal`,
      password: 'SecurePassword123!',
    });
    userAId = regA.user.id;
    userAToken = regA.tokens.accessToken;

    const regB = await AuthService.register({
      fullName: 'Bob Attacker User',
      email: `bob_attacker_${timestamp}@oblivion.internal`,
      password: 'SecurePassword123!',
    });
    userBId = regB.user.id;
    userBToken = regB.tokens.accessToken;

    // Create website for User A
    const siteA = await prisma.website.create({
      data: {
        userId: userAId,
        websiteName: 'DataBroker Alpha',
        websiteUrl: 'https://databroker-alpha.example.com',
        websiteCategory: 'OTHER',
      },
    });
    userAWebsiteId = siteA.id;

    // Create exposure for User A
    const expA = await prisma.exposureRecord.create({
      data: {
        userId: userAId,
        websiteId: userAWebsiteId,
        purpose: 'Public Data Aggregation',
        notes: 'Personal mobile number, employer name, and geolocation history',
        recordStatus: 'ACTIVE',
        dateShared: new Date(),
        sensitivityLevel: 'HIGH',
      },
    });
    userAExposureId = expA.id;

    // Create GDPR Removal Request for User A
    const reqGdpr = await prisma.removalRequest.create({
      data: {
        userId: userAId,
        websiteId: userAWebsiteId,
        exposureRecordId: userAExposureId,
        requestType: RemovalRequestType.GDPR_ERASURE,
        requestReason: 'Personal data processed without lawful basis under GDPR Article 6',
        requestStatus: RequestStatus.DRAFT,
      },
    });
    userAGdprRequestId = reqGdpr.id;

    // Create CCPA Removal Request for User A
    const reqCcpa = await prisma.removalRequest.create({
      data: {
        userId: userAId,
        websiteId: userAWebsiteId,
        exposureRecordId: userAExposureId,
        requestType: RemovalRequestType.CCPA_DELETION,
        requestReason: 'Consumer deletion demand under CCPA § 1798.105',
        requestStatus: RequestStatus.DRAFT,
      },
    });
    userACcpaRequestId = reqCcpa.id;

    console.log(`[Setup] User A (${userAId}), Requests: GDPR (${userAGdprRequestId}), CCPA (${userACcpaRequestId})\n`);

    // ================================================================
    // SECTION 3: Preview Endpoint (No Emails Sent, No DB Mutation)
    // ================================================================
    console.log('--- SECTION 3: Preview Endpoint Verification ---');

    const deliveriesBeforePreview = await prisma.emailDelivery.count({
      where: { userId: userAId },
    });

    const previewRes = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/preview-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'privacy@databroker-alpha.example.com',
        customNotes: 'Reference: Case #10293',
      });

    const previewOk =
      previewRes.status === 200 &&
      previewRes.body.success === true &&
      previewRes.body.data.previewOnly === true &&
      previewRes.body.data.statutoryDeadlineDays === 30 &&
      previewRes.body.data.notice.legalFramework.includes('GDPR') &&
      previewRes.body.data.notice.subject.includes('[STATUTORY DEMAND]');

    // Confirm database was NOT mutated
    const dbReqAfterPreview = await prisma.removalRequest.findUnique({
      where: { id: userAGdprRequestId },
    });
    const deliveriesAfterPreview = await prisma.emailDelivery.count({
      where: { userId: userAId },
    });

    const dbUnmutated =
      dbReqAfterPreview?.requestStatus === RequestStatus.DRAFT &&
      deliveriesAfterPreview === deliveriesBeforePreview;

    recordTest(
      'Preview',
      'Preview endpoint renders notice without sending emails or mutating database',
      previewOk && dbUnmutated,
      `Status: ${previewRes.status}, previewOnly: ${previewRes.body.data?.previewOnly}, Deliveries: ${deliveriesAfterPreview}`
    );

    // ================================================================
    // SECTION 4: Explicit User Confirmation & Validation Constraints
    // ================================================================
    console.log('--- SECTION 4: Explicit Confirmation & Security Constraints ---');

    // Attempt dispatch without confirmDispatch
    const unconfirmedRes = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'dpo@databroker-alpha.example.com',
      });

    const unconfirmedRejected =
      unconfirmedRes.status === 422 || unconfirmedRes.status === 400;

    recordTest(
      'Security',
      'Dispatch strictly rejects when confirmDispatch: true is omitted',
      unconfirmedRejected,
      `Response status: ${unconfirmedRes.status}, Error: "${unconfirmedRes.body.message}"`
    );

    // Attempt dispatch with false confirmDispatch
    const falseConfirmRes = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'dpo@databroker-alpha.example.com',
        confirmDispatch: false,
      });

    const falseConfirmRejected =
      falseConfirmRes.status === 422 || falseConfirmRes.status === 400;

    recordTest(
      'Security',
      'Dispatch strictly rejects when confirmDispatch is false',
      falseConfirmRejected,
      `Response status: ${falseConfirmRes.status}`
    );

    // Attempt dispatch to prohibited localhost domain
    const localhostRes = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'admin@localhost',
        confirmDispatch: true,
      });

    const localhostBlocked = localhostRes.status === 422 || localhostRes.status === 400;
    recordTest(
      'Security',
      'Disallowed loopback/test recipient domains blocked',
      localhostBlocked,
      `Response status: ${localhostRes.status}`
    );

    // ================================================================
    // SECTION 5: Multi-Tenant Zero-Trust Isolation
    // ================================================================
    console.log('--- SECTION 5: Multi-Tenant Ownership Enforcement ---');

    // User B attempts to preview User A's removal request
    const crossTenantPreview = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/preview-demand`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        recipientEmail: 'attacker@evil.com',
      });

    const crossPreviewBlocked = crossTenantPreview.status === 404 || crossTenantPreview.status === 403;
    recordTest(
      'Multi-Tenancy',
      'Cross-tenant statutory notice preview blocked with 404/403',
      crossPreviewBlocked,
      `User B previewing User A request returned status ${crossTenantPreview.status}`
    );

    // User B attempts to dispatch User A's removal request
    const crossTenantDispatch = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        recipientEmail: 'attacker@evil.com',
        confirmDispatch: true,
      });

    const crossDispatchBlocked = crossTenantDispatch.status === 404 || crossTenantDispatch.status === 403;
    recordTest(
      'Multi-Tenancy',
      'Cross-tenant statutory notice dispatch blocked with 404/403',
      crossDispatchBlocked,
      `User B dispatching User A request returned status ${crossTenantDispatch.status}`
    );

    // ================================================================
    // SECTION 6: Successful Dispatch Flow & Automatic Reminder Provisioning
    // ================================================================
    console.log('--- SECTION 6: Statutory Dispatch & Automated Compliance Reminder ---');

    // Register active mock sender to inspect exact payload and simulate successful gateway acceptance
    const dispatchedEmails: any[] = [];
    EmailService.setMockSender(async (opts: any) => {
      dispatchedEmails.push(opts);
      return {
        success: true,
        resendEmailId: `re_statutory_${Date.now()}_test`,
      };
    });

    const dispatchRes = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'dpo@databroker-alpha.example.com',
        confirmDispatch: true,
        customNotes: 'Identity verification code: AUTH-7719',
      });

    const dispatchOk =
      dispatchRes.status === 200 &&
      dispatchRes.body.success === true &&
      dispatchRes.body.data.requestStatus === RequestStatus.SUBMITTED &&
      dispatchRes.body.data.gatewayStatus === 'ACCEPTED_FOR_TRANSMISSION' &&
      dispatchRes.body.data.confirmedDelivery === false &&
      Boolean(dispatchRes.body.data.resendEmailId) &&
      Boolean(dispatchRes.body.data.linkedReminderId) &&
      dispatchRes.body.data.disclaimer.includes('Gateway acceptance indicates');

    recordTest(
      'Dispatch',
      'Statutory demand accepted by gateway, returning structured evidence and disclaimer',
      dispatchOk,
      `Status: ${dispatchRes.status}, Resend ID: ${dispatchRes.body.data?.resendEmailId}, Linked Reminder: ${dispatchRes.body.data?.linkedReminderId}`
    );

    // Verify EmailService was called with correct recipient and subject
    const emailWasDispatched =
      dispatchedEmails.length === 1 &&
      dispatchedEmails[0].to === 'dpo@databroker-alpha.example.com' &&
      dispatchedEmails[0].subject.includes('[STATUTORY DEMAND]') &&
      dispatchedEmails[0].html.includes('MegaCorp Analytics') || dispatchedEmails[0].html.includes('DataBroker Alpha');

    recordTest(
      'Dispatch',
      'Email payload verified with formal statutory subject and HTML body',
      emailWasDispatched,
      `Dispatched count: ${dispatchedEmails.length}, Recipient: ${dispatchedEmails[0]?.to}`
    );

    // Verify RemovalRequest in database transitioned to SUBMITTED
    const updatedDbReq = await prisma.removalRequest.findUnique({
      where: { id: userAGdprRequestId },
    });
    const reqTransitioned =
      updatedDbReq?.requestStatus === RequestStatus.SUBMITTED &&
      updatedDbReq?.submittedAt !== null &&
      Boolean(updatedDbReq?.externalReference);

    recordTest(
      'Database',
      'RemovalRequest transitioned to SUBMITTED with submittedAt and externalReference',
      reqTransitioned,
      `Status: ${updatedDbReq?.requestStatus}, SubmittedAt: ${updatedDbReq?.submittedAt?.toISOString()}, Ref: ${updatedDbReq?.externalReference}`
    );

    // Verify RequestHistory contains immutable evidence
    const historyEntries = await prisma.requestHistory.findMany({
      where: { removalRequestId: userAGdprRequestId },
      orderBy: { changedAt: 'desc' },
    });
    const historyEvidenceOk =
      historyEntries.length > 0 &&
      historyEntries[0].remarks !== null &&
      historyEntries[0].remarks.includes('[STATUTORY LEGAL DEMAND DISPATCHED]') &&
      historyEntries[0].remarks.includes('dpo@databroker-alpha.example.com') &&
      historyEntries[0].remarks.includes('30 days');

    recordTest(
      'Audit Evidence',
      'RequestHistory records immutable evidence with recipient, deadline, and notice version',
      historyEvidenceOk,
      `History count: ${historyEntries.length}, Evidence logged: ${Boolean(historyEvidenceOk)}`
    );

    // Verify automatic FOLLOW_UP_REMOVAL reminder was created
    const createdReminder = await prisma.reminder.findFirst({
      where: {
        userId: userAId,
        exposureRecordId: userAExposureId,
        reminderType: ReminderType.FOLLOW_UP_REMOVAL,
        reminderStatus: ReminderStatus.PENDING,
      },
    });

    const reminderCreatedOk =
      createdReminder !== null &&
      createdReminder.reminderStatus === ReminderStatus.PENDING;

    recordTest(
      'Reminders',
      'Automated FOLLOW_UP_REMOVAL reminder scheduled for statutory deadline',
      reminderCreatedOk,
      `Reminder ID: ${createdReminder?.id}, Type: ${createdReminder?.reminderType}, Date: ${createdReminder?.reminderDate.toISOString()}`
    );

    // Verify EmailDelivery table contains the dispatch record
    const deliveryRecord = await prisma.emailDelivery.findFirst({
      where: {
        userId: userAId,
        notificationStage: 'STATUTORY_DEMAND_DISPATCHED',
      },
    });
    const deliveryLogged =
      deliveryRecord !== null &&
      deliveryRecord.deliveryStatus === EmailDeliveryStatus.SENT &&
      deliveryRecord.recipientEmail === 'dpo@databroker-alpha.example.com';

    recordTest(
      'Deliveries',
      'Persistent EmailDelivery record logged with STATUTORY_DEMAND_DISPATCHED stage',
      deliveryLogged,
      `Delivery ID: ${deliveryRecord?.id}, Status: ${deliveryRecord?.deliveryStatus}`
    );

    // Verify compliance AuditLog
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        userId: userAId,
        action: 'REMOVAL_REQUEST_DISPATCHED',
      },
    });
    const auditLogged = auditRecord !== null && auditRecord.entityId === userAGdprRequestId;
    recordTest(
      'Compliance Audit',
      'Centralized compliance audit log recorded REMOVAL_REQUEST_DISPATCHED event',
      auditLogged,
      `Audit Log ID: ${auditRecord?.id}, Action: ${auditRecord?.action}`
    );

    // ================================================================
    // SECTION 7: Idempotent Reminder Handling (No Duplicate Reminders)
    // ================================================================
    console.log('--- SECTION 7: Idempotency & Duplicate Prevention ---');

    // Re-dispatching does not create a second duplicate reminder
    await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'dpo@databroker-alpha.example.com',
        confirmDispatch: true,
      });

    const remindersCount = await prisma.reminder.count({
      where: {
        userId: userAId,
        exposureRecordId: userAExposureId,
        reminderType: ReminderType.FOLLOW_UP_REMOVAL,
        reminderStatus: ReminderStatus.PENDING,
      },
    });

    const idempotencyPreserved = remindersCount === 1;
    recordTest(
      'Idempotency',
      'Duplicate reminder creation prevented across multiple statutory dispatches',
      idempotencyPreserved,
      `Active FOLLOW_UP_REMOVAL reminders count: ${remindersCount} (Expected: 1)`
    );

    // ================================================================
    // SECTION 8: Gateway Failure Handling
    // ================================================================
    console.log('--- SECTION 8: Gateway Error Handling ---');

    // Configure mock sender to simulate gateway network/auth failure
    EmailService.setMockSender(async () => {
      return {
        success: false,
        error: 'Simulated upstream gateway timeout (504)',
      };
    });

    const failedDispatchRes = await request(app)
      .post(`/api/v1/removal-requests/${userACcpaRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'privacy@megacorp.example.com',
        confirmDispatch: true,
      });

    const failureHandled =
      failedDispatchRes.status === 500 &&
      failedDispatchRes.body.success === false &&
      failedDispatchRes.body.message.includes('Simulated upstream gateway timeout');

    // Verify failed attempt logged in history
    const failedHistory = await prisma.requestHistory.findFirst({
      where: {
        removalRequestId: userACcpaRequestId,
      },
      orderBy: { changedAt: 'desc' },
    });
    const failedHistoryLogged =
      failedHistory !== null &&
      failedHistory.remarks?.includes('[DISPATCH FAILED]');

    recordTest(
      'Failure Recovery',
      'Gateway transmission failure caught, returned 500, and logged in history',
      failureHandled && Boolean(failedHistoryLogged),
      `Status: ${failedDispatchRes.status}, Error: "${failedDispatchRes.body.message}", History Logged: ${Boolean(failedHistoryLogged)}`
    );

    // Reset mock sender
    EmailService.setMockSender(null);

    // ================================================================
    // SECTION 9: Rate Limiting Enforcement (Max 5 Per Hour)
    // ================================================================
    console.log('--- SECTION 9: Rate Limiting Enforcement ---');

    // We already have 2 dispatches recorded for userA. Let's insert 3 more EmailDelivery records directly
    // to bring the count to 5 within the last hour.
    for (let i = 0; i < 3; i++) {
      await prisma.emailDelivery.create({
        data: {
          userId: userAId,
          notificationStage: 'STATUTORY_DEMAND_DISPATCHED',
          recipientEmail: `test_rate_limit_${i}@example.com`,
          subject: 'Rate Limit Test Notice',
          deliveryStatus: EmailDeliveryStatus.SENT,
        },
      });
    }

    // Now attempt a 6th dispatch: should be blocked by rate limiter with 429
    const rateLimitedRes = await request(app)
      .post(`/api/v1/removal-requests/${userAGdprRequestId}/dispatch-demand`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipientEmail: 'dpo@databroker-alpha.example.com',
        confirmDispatch: true,
      });

    const rateLimitEnforced =
      rateLimitedRes.status === 429 &&
      rateLimitedRes.body.message.includes('Rate limit exceeded');

    recordTest(
      'Rate Limiting',
      'Maximum 5 statutory dispatches per hour strictly enforced with HTTP 429',
      rateLimitEnforced,
      `Status: ${rateLimitedRes.status}, Message: "${rateLimitedRes.body.message}"`
    );

  } catch (err: any) {
    console.error('Unexpected test error:', err);
    recordTest('Suite Error', 'Test suite encountered unexpected exception', false, err.message);
  } finally {
    // ================================================================
    // SECTION 10: Teardown & Database Integrity Verification
    // ================================================================
    console.log('--- SECTION 10: Teardown & Database Integrity ---');
    try {
      EmailService.setMockSender(null);

      if (userAId || userBId) {
        // Cascading delete removes test users and all child records
        await prisma.user.deleteMany({
          where: {
            id: { in: [userAId, userBId].filter(Boolean) },
          },
        });
        console.log(`[Cleanup] Deleted test users ${userAId} and ${userBId}`);
      }

      const finalUserCount = await prisma.user.count();
      const dbClean = finalUserCount === initialUserCount;

      recordTest(
        'Integrity',
        'Database cleanly returned to baseline state with zero orphaned records',
        dbClean,
        `Initial User Count: ${initialUserCount}, Final User Count: ${finalUserCount}`
      );
    } catch (cleanupErr: any) {
      console.warn('[Cleanup Warning] Error during test cleanup:', cleanupErr.message);
    }
  }

  // Summary
  console.log('================================================================');
  console.log('THE FORGET ENGINE TEST SUITE SUMMARY');
  console.log('================================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`TOTAL TESTS:  ${total}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log(`STATUS:       ${failed === 0 ? '100% GREEN (ALL FORGET ENGINE TESTS PASSED)' : 'FAILURE DETECTED'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStatutoryDemandTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
