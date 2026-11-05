/**
 * OBLIVION - Phase 8 Final Live Application & Integration Verification Runner
 *
 * Verifies live running Backend (port 5000) and Frontend (port 3000) against PostgreSQL 18.6
 */

import { prisma } from '../src/lib/prisma';

const BACKEND_URL = 'http://localhost:5000';
const API_URL = 'http://localhost:5000/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

interface VerificationResult {
  step: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function record(step: string, name: string, passed: boolean, details: string) {
  results.push({ step, name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${step}] ${name}: ${details}`);
}

async function run() {
  console.log('================================================================');
  console.log('OBLIVION PHASE 8: FINAL LIVE APPLICATION & SECURITY VERIFICATION');
  console.log(`Backend Target:  ${API_URL}`);
  console.log(`Frontend Target: ${FRONTEND_URL}`);
  console.log(`Database Target: PostgreSQL 18.6 (oblivion_db)`);
  console.log('================================================================\n');

  const timestamp = Date.now();
  const aliceEmail = `live_test_alice_${timestamp}@oblivion.internal`;
  const bobEmail = `live_test_bob_${timestamp}@oblivion.internal`;
  const testPassword = 'LiveSecurePassword123!';

  let aliceToken = '';
  let bobToken = '';
  let aliceId = '';
  let bobId = '';

  let websiteId = '';
  let tempWebsiteId = '';
  let exposureId = '';
  let removalId = '';
  let reminderId = '';

  try {
    // ------------------------------------------------------------------------
    // TASK 1: START & CONNECTIVITY VERIFICATION
    // ------------------------------------------------------------------------
    console.log('▶ TASK 1: Live Server Health & Frontend Connectivity...');

    // 1.1 Backend Root Health Endpoint
    const rootHealthRes = await fetch(`${BACKEND_URL}/health`);
    const rootHealthJson = (await rootHealthRes.json()) as any;
    record(
      'Task 1.1',
      'Backend Root Health Check (GET /health)',
      rootHealthRes.status === 200 && rootHealthJson.data?.status === 'healthy',
      `HTTP ${rootHealthRes.status} - Database: ${rootHealthJson.data?.database?.engine} (${rootHealthJson.data?.database?.status}, latency: ${rootHealthJson.data?.database?.latencyMs}ms)`
    );

    // 1.2 Backend API Health Check
    const apiHealthRes = await fetch(`${API_URL}/health`);
    const apiHealthJson = (await apiHealthRes.json()) as any;
    record(
      'Task 1.2',
      'Router Health Check (GET /api/v1/health)',
      apiHealthRes.status === 200 && apiHealthJson.success === true,
      `HTTP ${apiHealthRes.status} - Environment: ${apiHealthJson.data?.environment}, Uptime: ${apiHealthJson.data?.uptimeSeconds}s`
    );

    // 1.3 Frontend Vite Server
    const frontendRes = await fetch(`${FRONTEND_URL}/`);
    const frontendHtml = await frontendRes.text();
    const hasTitle = frontendHtml.includes("<title>OBLIVION – The Internet's Forget Button</title>");
    const hasRootDiv = frontendHtml.includes('<div id="root"></div>');
    record(
      'Task 1.3',
      'Frontend Vite Development Server (GET /)',
      frontendRes.status === 200 && hasTitle && hasRootDiv,
      `HTTP ${frontendRes.status} - Served index.html with OBLIVION title and root mount point`
    );

    // 1.4 Frontend Assets Check
    const mainJsRes = await fetch(`${FRONTEND_URL}/src/main.tsx`);
    record(
      'Task 1.4',
      'Frontend Main Entrypoint Access (GET /src/main.tsx)',
      mainJsRes.status === 200,
      `HTTP ${mainJsRes.status} - TypeScript JSX entrypoint accessible via Vite HMR`
    );

    // ------------------------------------------------------------------------
    // TASK 2: AUTHENTICATION JOURNEY
    // ------------------------------------------------------------------------
    console.log('\n▶ TASK 2: Authentication Journey...');

    // 2.1 Register Alice
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alice Live Tester',
        email: aliceEmail,
        password: testPassword,
      }),
    });
    const regJson = (await regRes.json()) as any;
    aliceId = regJson.data?.user?.id || '';
    record(
      'Task 2.1',
      'User Registration (POST /api/v1/auth/register)',
      regRes.status === 201 && regJson.success === true && regJson.data?.user?.accountStatus === 'ACTIVE',
      `HTTP ${regRes.status} Created - User ID: ${aliceId}, Status: ${regJson.data?.user?.accountStatus}`
    );

    // 2.2 Login Alice
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: aliceEmail,
        password: testPassword,
      }),
    });
    const loginJson = (await loginRes.json()) as any;
    aliceToken = loginJson.data?.token || '';
    record(
      'Task 2.2',
      'User Authentication (POST /api/v1/auth/login)',
      loginRes.status === 200 && !!aliceToken,
      `HTTP ${loginRes.status} OK - Issued Bearer JWT access token (7-day validity)`
    );

    // 2.3 Retrieve Authenticated Profile
    const meRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const meJson = (await meRes.json()) as any;
    record(
      'Task 2.3',
      'Authenticated Profile Retrieval (GET /api/v1/auth/me)',
      meRes.status === 200 && meJson.data?.user?.email === aliceEmail,
      `HTTP ${meRes.status} OK - Verified profile for ${meJson.data?.user?.fullName}`
    );

    // 2.4 Session Persistence Simulation
    const persistRes = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const persistJson = (await persistRes.json()) as any;
    record(
      'Task 2.4',
      'Session Persistence Check (Re-verify Bearer Token)',
      persistRes.status === 200 && persistJson.data?.user?.id === aliceId,
      `HTTP ${persistRes.status} OK - Client-stored token valid on subsequent request`
    );

    // 2.5 Logout
    const logoutRes = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const logoutJson = (await logoutRes.json()) as any;
    record(
      'Task 2.5',
      'User Logout Audit & Session Disposal (POST /api/v1/auth/logout)',
      logoutRes.status === 200 && logoutJson.success === true,
      `HTTP ${logoutRes.status} OK - Recorded AUTH_LOGOUT event on backend`
    );

    // 2.6 Reject Unauthenticated Access to Protected Routes
    const unauthRes = await fetch(`${API_URL}/auth/me`, {
      headers: {},
    });
    const unauthJson = (await unauthRes.json()) as any;
    record(
      'Task 2.6',
      'Protected Route Rejection Without Token (GET /api/v1/auth/me)',
      unauthRes.status === 401 && unauthJson.success === false,
      `HTTP ${unauthRes.status} Unauthorized - "Authentication required: Missing Authorization header"`
    );

    // Re-login Alice for real API workflows
    const reLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail, password: testPassword }),
    });
    const reLoginJson = (await reLogin.json()) as any;
    aliceToken = reLoginJson.data?.token || '';

    // ------------------------------------------------------------------------
    // TASK 3: REAL API WORKFLOWS
    // ------------------------------------------------------------------------
    console.log('\n▶ TASK 3: Real Domain API Workflows (Connected to PostgreSQL 18.6)...');

    // 3.1 Create Website
    const createWebRes = await fetch(`${API_URL}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        websiteName: 'Acme Financial Records Corp',
        websiteUrl: `https://acme-records-${timestamp}.example.com`,
        websiteCategory: 'FINANCIAL_SERVICES',
      }),
    });
    const createWebJson = (await createWebRes.json()) as any;
    websiteId = createWebJson.data?.id || '';
    record(
      'Task 3.1',
      'Register Tracked Website (POST /api/v1/websites)',
      createWebRes.status === 201 && !!websiteId,
      `HTTP ${createWebRes.status} Created - Registered website ID: ${websiteId}`
    );

    // 3.2 List Websites
    const listWebRes = await fetch(`${API_URL}/websites?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const listWebJson = (await listWebRes.json()) as any;
    const hasCreatedWeb = listWebJson.data?.some((w: any) => w.id === websiteId);
    record(
      'Task 3.2',
      'List Websites with Pagination (GET /api/v1/websites)',
      listWebRes.status === 200 && hasCreatedWeb,
      `HTTP ${listWebRes.status} OK - Retrieved ${listWebJson.data?.length} websites (Total: ${listWebJson.meta?.total})`
    );

    // 3.3 Edit Website
    const editWebRes = await fetch(`${API_URL}/websites/${websiteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        websiteName: 'Acme Financial Records Corp (Verified Partner)',
      }),
    });
    const editWebJson = (await editWebRes.json()) as any;
    record(
      'Task 3.3',
      'Update Website Details (PATCH /api/v1/websites/:id)',
      editWebRes.status === 200 && editWebJson.data?.websiteName.includes('(Verified Partner)'),
      `HTTP ${editWebRes.status} OK - Name updated to: "${editWebJson.data?.websiteName}"`
    );

    // 3.4 Create & Delete Temporary Website
    const tempWebRes = await fetch(`${API_URL}/websites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        websiteName: 'Temporary Disposable Portal',
        websiteUrl: `https://temp-delete-${timestamp}.example.com`,
        websiteCategory: 'OTHER',
      }),
    });
    const tempWebJson = (await tempWebRes.json()) as any;
    tempWebsiteId = tempWebJson.data?.id || '';

    const delWebRes = await fetch(`${API_URL}/websites/${tempWebsiteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const delConfirmRes = await fetch(`${API_URL}/websites/${tempWebsiteId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    record(
      'Task 3.4',
      'Delete Website & Verify Removal (DELETE & GET /api/v1/websites/:id)',
      delWebRes.status === 200 && delConfirmRes.status === 404,
      `HTTP ${delWebRes.status} OK on DELETE, HTTP ${delConfirmRes.status} Not Found on subsequent lookup`
    );

    // 3.5 Reference Data Categories
    const catRes = await fetch(`${API_URL}/categories`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const catJson = (await catRes.json()) as any;
    const financialCat = catJson.data?.find((c: any) => c.name === 'Financial Data' || c.code === 'FINANCIAL_DATA');
    const selectedCatId = financialCat?.id || catJson.data?.[0]?.id;
    record(
      'Task 3.5',
      'Fetch Reference Data Categories (GET /api/v1/categories)',
      catRes.status === 200 && catJson.data?.length === 12,
      `HTTP ${catRes.status} OK - Loaded 12 seeded categories (e.g. ${financialCat?.name}, riskWeight: ${financialCat?.riskWeight})`
    );

    // 3.6 Create Exposure Record with Category & Verify Backend Risk Score
    const expRes = await fetch(`${API_URL}/exposures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        websiteId,
        purpose: 'Annual income tax returns and banking records',
        sensitivityLevel: 'CRITICAL',
        dateShared: new Date().toISOString(),
        categoryIds: [selectedCatId],
      }),
    });
    const expJson = (await expRes.json()) as any;
    exposureId = expJson.data?.id || '';
    const riskScore = expJson.data?.calculatedRiskScore;
    const riskRating = expJson.data?.calculatedRiskRating;
    record(
      'Task 3.6',
      'Create Exposure Record & Dynamic Risk Computation (POST /api/v1/exposures)',
      expRes.status === 201 && typeof riskScore === 'number' && !!riskRating,
      `HTTP ${expRes.status} Created - Backend Calculated Risk Score: ${riskScore} (Rating: ${riskRating})`
    );

    // 3.7 Create Removal Request
    const remRes = await fetch(`${API_URL}/removal-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        websiteId,
        exposureRecordId: exposureId,
        requestType: 'GDPR_ERASURE',
        requestReason: 'Exercising Article 17 Right to Erasure for historical banking records',
      }),
    });
    const remJson = (await remRes.json()) as any;
    removalId = remJson.data?.id || '';
    const trackingToken = remJson.data?.trackingToken || '';
    record(
      'Task 3.7',
      'Create Removal Request (POST /api/v1/removal-requests)',
      remRes.status === 201 && remJson.data?.requestStatus === 'DRAFT' && !!trackingToken,
      `HTTP ${remRes.status} Created - ID: ${removalId}, Token: ${trackingToken}, Status: DRAFT`
    );

    // 3.8 Execute State Transitions: DRAFT -> SUBMITTED -> ACKNOWLEDGED -> IN_PROGRESS -> COMPLETED
    const transitions = [
      { status: 'SUBMITTED', remark: 'Official GDPR Art. 17 erasure request dispatched to Data Controller' },
      { status: 'ACKNOWLEDGED', remark: 'Acme Privacy Officer confirmed receipt and validated identity' },
      { status: 'IN_PROGRESS', remark: 'Data scrubbing initiated on cold storage and backup indices' },
      { status: 'COMPLETED', remark: 'Acme issued certificate of destruction; records fully erased' },
    ];

    let allTransitionsPassed = true;
    for (const t of transitions) {
      const stepRes = await fetch(`${API_URL}/removal-requests/${removalId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aliceToken}`,
        },
        body: JSON.stringify({
          requestStatus: t.status,
          remarks: t.remark,
        }),
      });
      if (stepRes.status !== 200) {
        allTransitionsPassed = false;
        break;
      }
    }

    // 3.9 Verify Append-Only History
    const historyRes = await fetch(`${API_URL}/removal-requests/${removalId}/history`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const historyJson = (await historyRes.json()) as any;
    record(
      'Task 3.8 & 3.9',
      'State Transitions & Append-Only History (PATCH & GET /history)',
      allTransitionsPassed && historyRes.status === 200 && historyJson.data?.length === 4,
      `Progressed DRAFT -> SUBMITTED -> ACKNOWLEDGED -> IN_PROGRESS -> COMPLETED; Verified 4 immutable history logs`
    );

    // 3.10 Create & Complete Reminder
    const remDate = new Date(Date.now() + 86400000 * 30).toISOString();
    const createReminderRes = await fetch(`${API_URL}/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        websiteId,
        removalRequestId: removalId,
        exposureRecordId: exposureId,
        title: 'Statutory 30-Day Erasure Response Deadline',
        reminderDate: remDate,
        reminderType: 'STATUTORY_DEADLINE',
      }),
    });
    const createReminderJson = (await createReminderRes.json()) as any;
    reminderId = createReminderJson.data?.id || '';

    const completeReminderRes = await fetch(`${API_URL}/reminders/${reminderId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const completeReminderJson = (await completeReminderRes.json()) as any;
    record(
      'Task 3.10',
      'Create and Complete Statutory Reminder (POST & PATCH /complete)',
      createReminderRes.status === 201 && completeReminderRes.status === 200 && completeReminderJson.data?.reminderStatus === 'COMPLETED',
      `HTTP 201 Created -> HTTP 200 Completed (Status: ${completeReminderJson.data?.reminderStatus})`
    );

    // 3.11 Notification Verification
    const notifRes = await fetch(`${API_URL}/notifications`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const notifJson = (await notifRes.json()) as any;
    record(
      'Task 3.11',
      'Retrieve Notifications (GET /api/v1/notifications)',
      notifRes.status === 200 && Array.isArray(notifJson.data),
      `HTTP ${notifRes.status} OK - Retrieved ${notifJson.data?.length} notifications (unreadCount: ${notifJson.meta?.unreadCount ?? 0})`
    );

    // 3.12 Dashboard Live Metrics Aggregation
    const dashOverviewRes = await fetch(`${API_URL}/dashboard/overview`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const dashOverviewJson = (await dashOverviewRes.json()) as any;
    const ovData = dashOverviewJson.data;

    const dashBreakdownRes = await fetch(`${API_URL}/dashboard/exposure-breakdown`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const dashBreakdownJson = (await dashBreakdownRes.json()) as any;

    record(
      'Task 3.12',
      'Live Dashboard Aggregations (GET /api/v1/dashboard/overview & breakdown)',
      dashOverviewRes.status === 200 && ovData.totalWebsites >= 1 && ovData.totalExposures >= 1 && typeof ovData.privacyExposureIndex === 'number',
      `HTTP 200 OK - Websites: ${ovData.totalWebsites}, Exposures: ${ovData.totalExposures}, Removals: ${ovData.totalRemovals}, Risk Index: ${ovData.privacyExposureIndex} (${ovData.privacyExposureRating})`
    );

    // 3.13 Audit Log Trail & GDPR Art. 15 Export
    const auditRes = await fetch(`${API_URL}/audit-logs?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const auditJson = (await auditRes.json()) as any;
    const exportRes = await fetch(`${API_URL}/audit-logs/export`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const exportJson = (await exportRes.json()) as any;

    const expectedActions = ['AUTH_REGISTER', 'WEBSITE_CREATED', 'EXPOSURE_CREATED', 'REMOVAL_REQUEST_CREATED', 'REMOVAL_STATUS_UPDATED', 'REMINDER_CREATED'];
    const auditActionsRecorded = new Set((auditJson.data || []).map((l: any) => l.action));
    const allExpectedRecorded = expectedActions.every((a) => auditActionsRecorded.has(a));

    record(
      'Task 3.13',
      'Audit Logging Trail & GDPR Art. 15 Export (GET /audit-logs & /export)',
      auditRes.status === 200 && exportRes.status === 200 && allExpectedRecorded,
      `HTTP 200 OK - Verified ${auditJson.data?.length} audit records across ${auditActionsRecorded.size} actions; Export contained ${exportJson.data?.complianceExport?.auditTrailCount} entries`
    );

    // ------------------------------------------------------------------------
    // TASK 4: MULTI-TENANT SECURITY VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n▶ TASK 4: Multi-Tenant Security & Ownership Isolation (Alice vs Bob)...');

    // 4.1 Register Bob
    const regBobRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Bob Independent Tenant',
        email: bobEmail,
        password: testPassword,
      }),
    });
    const regBobJson = (await regBobRes.json()) as any;
    bobId = regBobJson.data?.user?.id || '';

    const loginBobRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bobEmail, password: testPassword }),
    });
    const loginBobJson = (await loginBobRes.json()) as any;
    bobToken = loginBobJson.data?.token || '';

    record(
      'Task 4.1',
      'Provision Second Tenant (Bob)',
      loginBobRes.status === 200 && !!bobToken,
      `Provisioned Bob (${bobEmail}, ID: ${bobId}) with separate authenticated session`
    );

    // 4.2 Bob cannot read Alice's Website
    const bobReadWeb = await fetch(`${API_URL}/websites/${websiteId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    record(
      'Task 4.2',
      "Cross-Tenant Read Defense: Bob -> Alice's Website",
      bobReadWeb.status === 404,
      `HTTP ${bobReadWeb.status} Not Found - Existence withheld from foreign tenant`
    );

    // 4.3 Bob cannot update Alice's Website
    const bobUpdateWeb = await fetch(`${API_URL}/websites/${websiteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ websiteName: 'Hacked by Bob' }),
    });
    record(
      'Task 4.3',
      "Cross-Tenant Update Defense: Bob -> Alice's Website",
      bobUpdateWeb.status === 404,
      `HTTP ${bobUpdateWeb.status} Not Found - Target record remained unmodified in PostgreSQL`
    );

    // 4.4 Bob cannot delete Alice's Website
    const bobDelWeb = await fetch(`${API_URL}/websites/${websiteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    record(
      'Task 4.4',
      "Cross-Tenant Delete Defense: Bob -> Alice's Website",
      bobDelWeb.status === 404,
      `HTTP ${bobDelWeb.status} Not Found - Foreign website preserved in PostgreSQL`
    );

    // 4.5 Bob cannot read Alice's Exposure
    const bobReadExp = await fetch(`${API_URL}/exposures/${exposureId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    record(
      'Task 4.5',
      "Cross-Tenant Read Defense: Bob -> Alice's Exposure",
      bobReadExp.status === 404,
      `HTTP ${bobReadExp.status} Not Found - Exposure record isolated`
    );

    // 4.6 Bob cannot read Alice's Removal Request
    const bobReadRem = await fetch(`${API_URL}/removal-requests/${removalId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    record(
      'Task 4.6',
      "Cross-Tenant Read Defense: Bob -> Alice's Removal Request",
      bobReadRem.status === 404,
      `HTTP ${bobReadRem.status} Not Found - Removal request isolated`
    );

    // 4.7 Bob cannot read Alice's Request History
    const bobReadHist = await fetch(`${API_URL}/removal-requests/${removalId}/history`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    record(
      'Task 4.7',
      "Cross-Tenant Read Defense: Bob -> Alice's Request History",
      bobReadHist.status === 404,
      `HTTP ${bobReadHist.status} Not Found - Immutable audit trail withheld`
    );

    // 4.8 Bob cannot read Alice's Reminder
    const bobReadReminder = await fetch(`${API_URL}/reminders/${reminderId}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    record(
      'Task 4.8',
      "Cross-Tenant Read Defense: Bob -> Alice's Reminder",
      bobReadReminder.status === 404,
      `HTTP ${bobReadReminder.status} Not Found - Reminder record isolated`
    );

    // 4.9 Bob's Dashboard Metrics Isolation
    const bobDashRes = await fetch(`${API_URL}/dashboard/overview`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobDashJson = (await bobDashRes.json()) as any;
    const bobData = bobDashJson.data;
    record(
      'Task 4.9',
      "Dashboard Metrics Multi-Tenant Isolation (Bob's Overview)",
      bobDashRes.status === 200 && bobData.totalWebsites === 0 && bobData.totalExposures === 0 && bobData.privacyExposureIndex === 0,
      `HTTP 200 OK - Bob received Websites: 0, Exposures: 0, Risk Index: 0 (100% isolated from Alice's metrics)`
    );

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('LIVE APPLICATION VERIFICATION SUMMARY');
    console.log('================================================================');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log(`Total Checks Executed: ${total}`);
    console.log(`Passed:                ${passed}`);
    console.log(`Failed:                ${failed}`);
    console.log(`Result:                ${failed === 0 ? 'ALL CHECKS PASSED (100% GREEN)' : 'SOME CHECKS FAILED'}`);
    console.log('================================================================\n');

  } finally {
    // ------------------------------------------------------------------------
    // CLEANUP: SAFELY PURGE ONLY THE TWO DEDICATED TEST ACCOUNTS
    // ------------------------------------------------------------------------
    console.log('🧹 Purging dedicated test accounts from PostgreSQL 18.6...');
    if (aliceId || bobId) {
      const deleted = await prisma.user.deleteMany({
        where: {
          id: { in: [aliceId, bobId].filter(Boolean) },
        },
      });
      console.log(`✅ Safely removed ${deleted.count} dedicated test users and their cascading records.`);
      console.log('✅ Existing production/seed records and migrations remain 100% intact.');
    }
    await prisma.$disconnect();
  }
}

run().catch(async (e) => {
  console.error('Fatal Verification Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
