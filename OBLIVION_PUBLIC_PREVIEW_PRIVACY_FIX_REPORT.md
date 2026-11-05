# OBLIVION – Public Preview Privacy Fix Report

**Date:** November 4, 2026  
**System:** OBLIVION – The Internet's Forget Button  
**Target Route:** `http://localhost:3000/` (Public Landing Page)  
**Status:** ALL PRIVACY CHECKS PASSED, PREVIEW REPLACED & VERIFIED  

---

## 1. Executive Summary

This report documents the resolution of the public landing page preview privacy issue. The Dashboard Preview section at `http://localhost:3000/#preview` has been replaced with a **100% static, purpose-built illustrative dashboard mockup**. Under no circumstances does the public landing page fetch, import, or display authenticated user activity, audit logs, entity UUIDs, real timestamps, or personal data. The authenticated dashboard at `/app` continues to function normally with live activity recording for authenticated sessions.

---

## 2. Investigation & Root Cause Identification

### 2.1 Inspection Findings
1. **Authenticated Module Scoping:**
   - The live `Recent Privacy Operations` component resides exclusively inside [`frontend/src/pages/dashboard/DashboardPage.tsx`](file:///c:/Users/Lenovo/Documents/OBLIVION%20%E2%80%93%20The%20Internet's%20Forget%20Button/frontend/src/pages/dashboard/DashboardPage.tsx) under the protected `/app` route.
   - It fetches real operational activity via `dashboardApi.getRecentActivity()`, rendering live audit logs, entity IDs (`ExposureRecord (fbac2551...)`), and timestamps for logged-in users.
2. **Public Landing Page Isolation:**
   - [`frontend/src/pages/landing/LandingPage.tsx`](file:///c:/Users/Lenovo/Documents/OBLIVION%20%E2%80%93%20The%20Internet's%20Forget%20Button/frontend/src/pages/landing/LandingPage.tsx) has **zero imports** of `dashboardApi`, `auditLogApi`, `useAuth`, `axios`, or any data-fetching hooks.
   - To eliminate any risk of confusing live user records with the public preview or exposing authenticated content when an authenticated user visits `/`, the previous generic metric cards were replaced with a dedicated, four-panel static illustrative mockup.

---

## 3. Implemented Purpose-Built Static Mockup

The Dashboard Preview section now renders four dedicated conceptual panels with clearly fictional illustrative content:

### 3.1 Panel 1: Website Inventory
- **Header:** Website Inventory with a `Cataloged` pill badge.
- **Description:** *"Organize third-party platforms holding personal data by service domain and industry category."*
- **Illustrative Items:**
  - `Social Media Services` — Monitored (emerald indicator)
  - `Online Retailers & Marketplaces` — Monitored (cyan indicator)

### 3.2 Panel 2: Exposure Overview
- **Header:** Exposure Overview with a `Mapped` pill badge.
- **Description:** *"Identify and classify exposed personal attributes across standardized privacy categories."*
- **Illustrative Items:**
  - `Contact & Identity Points` — High Priority (progress indicator)
  - `Location & Browsing Metadata` — Medium Priority (progress indicator)

### 3.3 Panel 3: Privacy Risk Overview
- **Header:** Privacy Risk Overview with a `Dynamic Score` pill badge.
- **Description:** *"Synthesize data category weights and sensitivity levels into an actionable risk assessment."*
- **Illustrative Items:**
  - Conceptual `Illustrative Risk Index` card
  - Severity-weighted badge: `Action Recommended`

### 3.4 Panel 4: Removal Request Progress
- **Header:** Removal Request Progress with a `Pipeline` pill badge.
- **Description:** *"Track statutory erasure requests from draft through acknowledgment, execution, and confirmation."*
- **Illustrative 3-Step Lifecycle:**
  - Step 1: `Submitted` (Request Sent)
  - Step 2: `In Progress` (Processing)
  - Step 3: `Completed` (Data Purged)

---

## 4. Strict Privacy & Security Guarantees

| Requirement | Public Landing Page (`/`) | Authenticated App (`/app`) |
| :--- | :--- | :--- |
| **Authenticated Activity Fetching** | **NEVER** (Zero API calls) | Real-time (`/api/v1/dashboard/recent-activity`) |
| **Audit Logs & History** | **NONE** (No audit logs rendered) | Protected (`/app/audit-logs` & Dashboard) |
| **Entity UUIDs & IDs** | **NONE** (Zero UUIDs rendered) | Rendered in authenticated detail toggles |
| **Real Timestamps** | **NONE** (Zero real timestamps) | Displayed on authenticated activity items |
| **Personal Account Data** | **NONE** (100% fictional conceptual data) | User-specific tenant-isolated records |
| **Behavior for Logged-Out Visitors** | Clean illustrative preview | Redirected to `/login` (Protected Route) |
| **Behavior for Logged-In Visitors** | Clean illustrative preview (Navbar shows "Open Dashboard") | Full interactive dashboard |

---

## 5. Strict Scope & File Safety

Only 1 file was modified:
- `frontend/src/pages/landing/LandingPage.tsx`

**Strict Non-Modification Verification:**
- `DashboardPage.tsx` and all `/app` components: **UNTOUCHED**
- `Recent Privacy Operations` inside `/app`: **UNTOUCHED & FULLY FUNCTIONAL**
- Backend APIs, Prisma schema, PostgreSQL database, and user records: **100% PRESERVED**

---

## 6. Build & Test Verification

### 6.1 Automated Vitest Suites
```
Test Files  6 passed (6)
Tests       31 passed (31)
Duration    12.72s
```
- `App.test.tsx`: 2/2 passed
- `MasterUIImprovements.test.tsx`: 8/8 passed
- `PagesAndResponsiveness.test.tsx`: 7/7 passed
- `SecurityAndIntegration.test.tsx`: 8/8 passed
- `Dashboard.test.tsx`: 4/4 passed
- `Auth.test.tsx`: 2/2 passed

### 6.2 Production Build
```
> tsc -b && vite build

✓ 2097 modules transformed.
dist/index.html                          1.32 kB │ gzip:   0.66 kB
dist/assets/index-Bl4T7npl.css          37.19 kB │ gzip:   7.22 kB
dist/assets/vendor-icons-CCt1U3Gh.js    22.31 kB │ gzip:   4.52 kB
dist/assets/vendor-react-C8QqYfDh.js   165.09 kB │ gzip:  53.98 kB
dist/assets/index-D0jmjWSY.js          204.42 kB │ gzip:  55.85 kB
dist/assets/vendor-charts-C5FJb0is.js  415.97 kB │ gzip: 112.53 kB
✓ built in 14.16s (exit code 0)
```
- Zero compilation errors.
- All chunk sizes are strictly under 500 kB.
