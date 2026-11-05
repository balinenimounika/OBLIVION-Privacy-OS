/**
 * OBLIVION - Exposure Management Upgrade Test Suite
 *
 * Verifies new enhanced fields, visibility/remediation multipliers,
 * 0-100 normalized risk engine, summary metrics endpoint,
 * direct removal-request linking, and tenant authorization.
 */

import request from 'supertest';
import {
  SensitivityLevel,
  RecordStatus,
  WebsiteCategory,
  ExposureVisibility,
  ExposureSource,
  DataSharingStatus,
  RemediationStatus,
  RemovalRequestType,
} from '@prisma/client';
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

async function runTests(): Promise<boolean> {
  console.log('================================================================');
  console.log('OBLIVION: EXPOSURE MANAGEMENT UPGRADE TEST SUITE');
  console.log('Engine: PostgreSQL 18.6 | Target Database: oblivion_db');
  console.log('================================================================\n');

  let allPassed = true;
  const createdUserIds: string[] = [];
  const timestamp = Date.now();
  const password = 'UpgradeExposure2026!#';

  try {
    // 1. Provision User A and User B
    const userARes = await AuthService.register({
      fullName: 'Alice Manager',
      email: `alice_mgmt_${timestamp}@oblivion.internal`,
      password,
    });
    const aliceId = userARes.user.id;
    const aliceToken = userARes.tokens.accessToken;
    createdUserIds.push(aliceId);

    const userBRes = await AuthService.register({
      fullName: 'Bob Manager',
      email: `bob_mgmt_${timestamp}@oblivion.internal`,
      password,
    });
    const bobId = userBRes.user.id;
    const bobToken = userBRes.tokens.accessToken;
    createdUserIds.push(bobId);

    // Websites for Alice
    const site1Res = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'CloudCorp Storage',
        websiteUrl: `https://cloudcorp-${timestamp}.com`,
        websiteCategory: WebsiteCategory.OTHER,
      });
    const site1Id = site1Res.body.data.id;

    const site2Res = await request(app)
      .post('/api/v1/websites')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteName: 'SocialNet Public',
        websiteUrl: `https://socialnet-${timestamp}.com`,
        websiteCategory: WebsiteCategory.SOCIAL_MEDIA,
      });
    const site2Id = site2Res.body.data.id;

    // Categories
    const categories = await prisma.dataCategory.findMany({ take: 3 });
    const cat1Id = categories[0].id;
    const cat2Id = categories[1]?.id || categories[0].id;

    // -------------------------------------------------------------------------
    // TEST 1: Create Exposure with Enhanced Fields & Risk Breakdown
    // -------------------------------------------------------------------------
    const createRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: site1Id,
        purpose: 'Resume & Employment Dossier for job applicant tracking',
        sensitivityLevel: SensitivityLevel.HIGH,
        dateShared: new Date('2026-01-15').toISOString(),
        notes: 'Candidate profile uploaded via career portal',
        categoryIds: [cat1Id, cat2Id],
        platformUrl: 'https://cloudcorp.com/careers/portal/applicant/101',
        dataDescription: 'Full Name, Work History, Compensation expectations (masked)',
        exposureSource: ExposureSource.JOB_APPLICATION,
        visibility: ExposureVisibility.RESTRICTED,
        sharingStatus: DataSharingStatus.ACTIVE,
        lastVerifiedDate: new Date('2026-02-01').toISOString(),
        remediationStatus: RemediationStatus.NOT_STARTED,
        evidenceAttachment: 'https://vault.oblivion.internal/evidence/proof-101.pdf',
      });

    const exp1 = createRes.body.data;
    const t1Passed =
      createRes.status === 201 &&
      createRes.body.success === true &&
      exp1.platformUrl === 'https://cloudcorp.com/careers/portal/applicant/101' &&
      exp1.exposureSource === 'JOB_APPLICATION' &&
      exp1.visibility === 'RESTRICTED' &&
      exp1.remediationStatus === 'NOT_STARTED' &&
      typeof exp1.calculatedRiskScore === 'number' &&
      exp1.calculatedRiskScore >= 0 &&
      exp1.calculatedRiskScore <= 100 &&
      exp1.riskBreakdown !== undefined &&
      Array.isArray(exp1.riskBreakdown.keyFactors);

    record(1, 'Create Exposure with Enhanced Fields & Risk Breakdown', t1Passed, `Risk score: ${exp1?.calculatedRiskScore}/100, Breakdown factors: ${exp1?.riskBreakdown?.keyFactors?.length}`);
    if (!t1Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 2: Create Public Exposure with Higher Visibility Risk Multiplier
    // -------------------------------------------------------------------------
    const publicExpRes = await request(app)
      .post('/api/v1/exposures')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        websiteId: site2Id,
        purpose: 'Public forum profile listing home address & contact',
        sensitivityLevel: SensitivityLevel.CRITICAL,
        dateShared: new Date().toISOString(),
        categoryIds: [cat1Id, cat2Id],
        exposureSource: ExposureSource.PUBLIC_WEBSITE,
        visibility: ExposureVisibility.PUBLIC, // 1.5x multiplier
        sharingStatus: DataSharingStatus.ACTIVE,
        remediationStatus: RemediationStatus.NOT_STARTED,
      });

    const exp2 = publicExpRes.body.data;
    const t2Passed =
      publicExpRes.status === 201 &&
      exp2.visibility === 'PUBLIC' &&
      exp2.calculatedRiskScore > exp1.calculatedRiskScore; // Higher due to public visibility + critical

    record(2, 'Visibility Multiplier Escalation (PUBLIC 1.5x vs RESTRICTED 1.2x)', t2Passed, `Public score ${exp2?.calculatedRiskScore} > Restricted score ${exp1?.calculatedRiskScore}`);
    if (!t2Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 3: Retrieve Summary Metrics (/api/v1/exposures/summary)
    // -------------------------------------------------------------------------
    const summaryRes = await request(app)
      .get('/api/v1/exposures/summary')
      .set('Authorization', `Bearer ${aliceToken}`);

    const sData = summaryRes.body.data;
    const t3Passed =
      summaryRes.status === 200 &&
      summaryRes.body.success === true &&
      sData.totalExposures === 2 &&
      sData.activeExposures === 2 &&
      sData.resolvedExposures === 0 &&
      typeof sData.riskDistribution.critical === 'number' &&
      Array.isArray(sData.byPlatform) &&
      sData.byPlatform.length === 2;

    record(3, 'Retrieve Dashboard Exposure Summary Metrics', t3Passed, `Total: ${sData?.totalExposures}, Active: ${sData?.activeExposures}, Platforms: ${sData?.byPlatform?.length}`);
    if (!t3Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 4: Filter Exposures by Visibility & Remediation Status
    // -------------------------------------------------------------------------
    const filterRes = await request(app)
      .get('/api/v1/exposures?visibility=PUBLIC')
      .set('Authorization', `Bearer ${aliceToken}`);

    const t4Passed =
      filterRes.status === 200 &&
      filterRes.body.data.length === 1 &&
      filterRes.body.data[0].id === exp2.id;

    record(4, 'Filter Exposures by Visibility Query Parameter', t4Passed, `Filtered 1 of 2 exposures with PUBLIC visibility`);
    if (!t4Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 5: Sort Exposures by Normalized Risk Score
    // -------------------------------------------------------------------------
    const sortRes = await request(app)
      .get('/api/v1/exposures?sortBy=riskScore&sortOrder=desc')
      .set('Authorization', `Bearer ${aliceToken}`);

    const t5Passed =
      sortRes.status === 200 &&
      sortRes.body.data.length === 2 &&
      sortRes.body.data[0].calculatedRiskScore >= sortRes.body.data[1].calculatedRiskScore;

    record(5, 'Sort Exposures by Dynamic Risk Score Descending', t5Passed, `Top score: ${sortRes.body?.data?.[0]?.calculatedRiskScore} >= Second: ${sortRes.body?.data?.[1]?.calculatedRiskScore}`);
    if (!t5Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 6: Mark Exposure as Resolved (/resolve) and Verify Risk Drop
    // -------------------------------------------------------------------------
    const resolveRes = await request(app)
      .patch(`/api/v1/exposures/${exp1.id}/resolve`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const resolvedExp = resolveRes.body.data;
    const t6Passed =
      resolveRes.status === 200 &&
      resolvedExp.remediationStatus === 'RESOLVED' &&
      resolvedExp.recordStatus === 'REMOVED' &&
      resolvedExp.calculatedRiskScore < exp1.calculatedRiskScore; // 80% discount

    record(6, 'Explicit Mark Exposure as Resolved & Risk De-escalation', t6Passed, `Resolved score dropped from ${exp1?.calculatedRiskScore} to ${resolvedExp?.calculatedRiskScore}`);
    if (!t6Passed) allPassed = false;

    // Verify summary updated
    const summary2Res = await request(app)
      .get('/api/v1/exposures/summary')
      .set('Authorization', `Bearer ${aliceToken}`);
    const s2Data = summary2Res.body.data;
    const t6bPassed = s2Data.activeExposures === 1 && s2Data.resolvedExposures === 1;
    record(6.1, 'Summary Metrics Reflect Resolved Exposure', t6bPassed, `Active: ${s2Data?.activeExposures}, Resolved: ${s2Data?.resolvedExposures}`);
    if (!t6bPassed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 7: Direct Removal Request Creation from Exposure Record
    // -------------------------------------------------------------------------
    const removalRes = await request(app)
      .post(`/api/v1/exposures/${exp2.id}/removal-requests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestType: 'GDPR_ERASURE',
        requestReason: 'Personal identifying phone and home address published on social board without consent',
        externalReference: 'FORUM-TICKET-8899',
      });

    const removalData = removalRes.body.data;
    const t7Passed =
      removalRes.status === 201 &&
      removalData.exposureRecordId === exp2.id &&
      removalData.websiteId === site2Id &&
      removalData.requestType === 'GDPR_ERASURE' &&
      removalData.requestStatus === 'DRAFT';

    record(7, 'Direct Removal Request Creation Linked to Exposure', t7Passed, `Created removal ${removalData?.id} linked to exposure ${exp2?.id}`);
    if (!t7Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 8: Exposure Details View Includes Removal Requests & Timeline
    // -------------------------------------------------------------------------
    const detailsRes = await request(app)
      .get(`/api/v1/exposures/${exp2.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const det = detailsRes.body.data;
    const t8Passed =
      detailsRes.status === 200 &&
      Array.isArray(det.removalRequests) &&
      det.removalRequests.length === 1 &&
      det.removalRequests[0].id === removalData.id &&
      Array.isArray(det.activityTimeline) &&
      det.activityTimeline.length >= 1;

    record(8, 'Exposure Details View Includes Linked Removals & Audit Timeline', t8Passed, `Found ${det?.removalRequests?.length} linked removal and ${det?.activityTimeline?.length} audit timeline entries`);
    if (!t8Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 9: IDOR Defense - User B Cannot Access User A Exposure Details or Summary
    // -------------------------------------------------------------------------
    const idorRes = await request(app)
      .get(`/api/v1/exposures/${exp2.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    const idorResolveRes = await request(app)
      .patch(`/api/v1/exposures/${exp2.id}/resolve`)
      .set('Authorization', `Bearer ${bobToken}`);

    const idorRemovalRes = await request(app)
      .post(`/api/v1/exposures/${exp2.id}/removal-requests`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        requestReason: 'Malicious cross-tenant attempt',
      });

    const t9Passed =
      idorRes.status === 404 &&
      idorResolveRes.status === 404 &&
      idorRemovalRes.status === 404;

    record(9, 'Multi-Tenant IDOR Security Isolation', t9Passed, `GetById: ${idorRes.status}, Resolve: ${idorResolveRes.status}, Removal: ${idorRemovalRes.status}`);
    if (!t9Passed) allPassed = false;

    // -------------------------------------------------------------------------
    // TEST 10: Clean Audit Log Sanitization - Zero Exposed Passwords in Logs
    // -------------------------------------------------------------------------
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: aliceId },
    });

    const hasRawSecret = auditLogs.some((l) =>
      JSON.stringify(l).includes('password') || JSON.stringify(l).includes(password)
    );

    const t10Passed = auditLogs.length >= 4 && !hasRawSecret;
    record(10, 'Audit Log Sanitization & Event Retention', t10Passed, `Recorded ${auditLogs.length} events; zero raw secrets found in database`);
    if (!t10Passed) allPassed = false;

  } catch (err: any) {
    console.error('Test execution failed with error:', err);
    allPassed = false;
  } finally {
    // Cleanup
    for (const uid of createdUserIds) {
      try {
        await prisma.user.delete({ where: { id: uid } });
      } catch {}
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${testResults.length} | PASSED: ${testResults.filter((t) => t.passed).length} | FAILED: ${testResults.filter((t) => !t.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL UPGRADE TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');

  return allPassed;
}

runTests().then((ok) => {
  if (!ok) process.exit(1);
});
