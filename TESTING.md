# OBLIVION – Complete Testing & Quality Assurance Guide

**Platform:** OBLIVION – The Internet's Forget Button  
**Target Database:** PostgreSQL 18.6 (`oblivion_db` on port 5432)  
**ORM:** Prisma 6.19.3  
**Cumulative Verification Scorecard:** ✅ **185 / 185 Tests Passed (100% Green)**

---

## 1. Test Architecture & Harness Philosophy

OBLIVION testing is performed against a **real, live PostgreSQL 18.6 database**.  
- **No In-Memory Mock Databases:** Tests run against actual PostgreSQL tables and real constraints.
- **Zero Real Data Contamination:** Every test suite provisions isolated test users tagged with millisecond runtime timestamps (`test_${Date.now()}@oblivion.internal`).
- **Clean Cascade Teardown:** Tests register created user UUIDs and issue `prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })` during teardown, triggering PostgreSQL foreign key cascading purges across all 7 relational tables with **0 orphans remaining**.

---

## 2. Test Execution Command Reference

All test suites can be executed via standard npm scripts:

### 2.1. Individual Phase Test Suites

```bash
# Phase 1: Health & Database Foundation (6 tests)
npm test

# Phase 2: Authentication, Password Hashing & JWT (14 tests)
npm run test:auth

# Phase 3: Multi-Tenant Security & Ownership (14 tests)
npm run test:tenant

# Phase 4: Core Privacy API Modules (74 tests across 6 suites)
npm run test:phase4

# Phase 5: Centralized Audit Logging & Compliance (20 tests)
npm run test:audit

# Phase 6: Master Integration, Security, DB Integrity & Performance (57 tests)
npm run test:phase6
```

### 2.2. Phase 4 Sub-Module Suites

```bash
npm run test:websites       # Module 1: Websites API (16 tests)
npm run test:exposures      # Module 2 & 3: Exposure Records & Categories (18 tests)
npm run test:removals       # Module 4 & 5: Removal Requests & History (14 tests)
npm run test:reminders      # Module 6: Reminders API (11 tests)
npm run test:notifications  # Module 7: Notifications API (9 tests)
npm run test:dashboard      # Module 8: Dashboard Analytics (6 tests)
```

### 2.3. Phase 6 Sub-Module Suites

```bash
npm run test:e2e            # Suite 1: End-to-End 16-Step User Journey (16 tests)
npm run test:security       # Suite 2: Security & Penetration Controls (20 tests)
npm run test:integrity      # Suite 3: Database Integrity & Cascades (15 tests)
npm run test:perf           # Suite 4: Performance & Scaled Pagination (6 tests)
```

---

## 3. Cumulative Verification Scorecard

| Phase | Test Suite Script | Scope of Verification | Tests | Pass Rate |
| :--- | :--- | :--- | :---: | :---: |
| **Phase 1** | `tests/health.test.ts` | Health endpoints, PostgreSQL connectivity, Helmet headers, CORS | 6 | 100% |
| **Phase 2** | `tests/auth.test.ts` | Registration, login, bcrypt rounds, JWT claims, profile, deactivation | 14 | 100% |
| **Phase 3** | `tests/tenant-security.test.ts`| Cross-tenant isolation, IDOR prevention, parameter injection | 14 | 100% |
| **Phase 4** | `tests/run-all-phase4.ts` | Websites, exposures, risk scores, removals, reminders, notifications | 74 | 100% |
| **Phase 5** | `tests/audit-log.test.ts` | Event capture, non-blocking fault tolerance, data export, redaction | 20 | 100% |
| **Phase 6** | `tests/run-all-phase6.ts` | 16-step E2E, 20 attack vectors, DB constraints, concurrency benchmarks | 57 | 100% |
| **TOTAL** | **12 Platform Test Suites** | **Complete Full-Stack Verification** | **185** | **100%** |

---

## 4. Test Account Isolation & Safety Principles

1. **Unique Email Namespace:** Every test run dynamically constructs emails:
   ```typescript
   const email = `test_${Date.now()}_${Math.random().toString(36).substring(7)}@oblivion.internal`;
   ```
2. **Explicit ID Tracking:** User IDs are recorded into a suite-scoped array:
   ```typescript
   const createdUserIds: string[] = [];
   createdUserIds.push(user.id);
   ```
3. **Guaranteed Teardown:** Teardown is contained inside a `finally` block:
   ```typescript
   finally {
     await prisma.user.deleteMany({
       where: { id: { in: createdUserIds } },
     });
     await prisma.$disconnect();
   }
   ```
4. **Zero Impact on Seed Data:** Global reference categories (`data_categories`) are read-only and never deleted by test suites.

---

## 5. Known Testing Limitations & Guidance

- **Sequential Execution Recommended:** All test suites run against the same local PostgreSQL instance (`oblivion_db`). Running multiple test suites concurrently in parallel processes at the exact same millisecond can trigger row lock contention in PostgreSQL. Run suites sequentially via `npm run test:phase4`, `npm run test:phase6`, or individually.
- **In-Memory Rate Limiter Reset:** In test suites making rapid consecutive authentication requests (e.g. `tests/auth.test.ts`), `authRateLimiter.reset()` or the test header `X-Bypass-Rate-Limit: true` is utilized to isolate functionality from brute-force throttling.
