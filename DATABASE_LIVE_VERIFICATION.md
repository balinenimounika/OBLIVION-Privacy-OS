# OBLIVION – Live PostgreSQL Database Verification Report

**Project:** OBLIVION – The Internet's Forget Button  
**Engine:** PostgreSQL 18.6 (x86_64-windows)  
**Host & Port:** `localhost:5432` (Windows Service: `postgresql-x64-18`)  
**Target Database:** `oblivion_db`  
**ORM:** Prisma ORM v6.19.3  
**Verification Date:** November 3, 2026  
**Final Result:** **ALL 13 LIVE DATABASE TESTS PASSED (100% SUCCESS)**

---

## 1. Executive Summary & Verification Context

This report documents the genuine, end-to-end integration and verification of the OBLIVION database layer against a real **PostgreSQL 18.6** instance.

### Distinction Between Verification Phases:
- **Phase A (Initial In-Process PGlite Verification):**  
  Used an embedded WASM-compiled PostgreSQL engine (`@electric-sql/pglite`) in-memory to validate baseline DDL and foreign-key referential semantics during sandbox setup without network dependencies.
- **Phase B (Actual Live PostgreSQL 18.6 Verification – THIS REPORT):**  
  Executed directly against the native Windows PostgreSQL 18.6 service (`postgresql-x64-18`) on `localhost:5432` connecting to the authentic database `oblivion_db`. Applied standard Prisma migrations (`npx prisma migrate deploy`), executed real idempotent seeds (`npm run db:seed`), and verified live relational behavior with Prisma Client (`npm run db:verify:live`).

---

## 2. PostgreSQL Server & Environment Details

| Parameter | Confirmed Production Value |
| :--- | :--- |
| **Database Server** | PostgreSQL 18.6 on x86_64-windows |
| **Windows Service** | `postgresql-x64-18` (Running) |
| **Host / Port** | `localhost:5432` |
| **Database Name** | `oblivion_db` |
| **Connection Protocol** | SCRAM-SHA-256 authenticated PostgreSQL TCP socket |
| **Prisma CLI / Client** | Version 6.19.3 |
| **TypeScript / Node** | TypeScript 5.9.3, Node.js v24.16.0 |
| **Git Protection** | `.env` strictly excluded via `.gitignore` |

---

## 3. Migration Execution & Schema Status

The migration was applied to the live database using Prisma migration deployment tooling:

```bash
npx prisma migrate deploy
```

### Migration Execution Output:
```text
Datasource "db": PostgreSQL database "oblivion_db", schema "public" at "localhost:5432"
1 migration found in prisma/migrations
Applying migration `20261103000000_init`

The following migration(s) have been applied:
migrations/
  └─ 20261103000000_init/
    └─ migration.sql

All migrations have been successfully applied.
```

### Applied Schema Entities:
- **10 Relational Tables:** `users`, `websites`, `exposure_records`, `data_categories`, `exposure_record_categories`, `removal_requests`, `request_history`, `reminders`, `notifications`, `audit_logs`.
- **9 Custom PostgreSQL Enums:** `AccountStatus`, `WebsiteCategory`, `SensitivityLevel`, `RecordStatus`, `RemovalRequestType`, `RequestStatus`, `ReminderType`, `ReminderStatus`, `NotificationType`.
- **5 Unique Constraints / Indexes:** `users(email)`, `websites(user_id, website_url)`, `data_categories(category_name)`, `exposure_record_categories(exposure_record_id, data_category_id)`, `reminders(exposure_record_id, reminder_type, reminder_date)`.
- **Check Constraint:** `check_risk_weight_positive` (`risk_weight >= 1 AND risk_weight <= 100`) on `data_categories`.

---

## 4. Reference Data Seeding Results

The seed script ([`prisma/seed.ts`](file:///c:/Users/Lenovo/Documents/OBLIVION%20%E2%80%93%20The%20Internet's%20Forget%20Button/prisma/seed.ts)) was executed directly against `oblivion_db`.

```bash
npm run db:seed
```

### Seeding Execution Log:
```text
----------------------------------------------------
OBLIVION Database Seeder: Initializing Reference Data
----------------------------------------------------
Reference data seed completed successfully:
- Created: 12 data categories
- Verified/Updated: 0 data categories
- Total Reference Categories: 12
----------------------------------------------------
```

### Idempotence Test (Repeated Execution):
```text
Reference data seed completed successfully:
- Created: 0 data categories
- Verified/Updated: 12 data categories
- Total Reference Categories: 12
```

### Seeded Reference Categories:
1. `Email Address` (Sensitivity: LOW, Risk Weight: 3)
2. `Phone Number` (Sensitivity: MEDIUM, Risk Weight: 5)
3. `Home Address` (Sensitivity: HIGH, Risk Weight: 7)
4. `Government Identification Category` (Sensitivity: CRITICAL, Risk Weight: 10)
5. `Financial Information Category` (Sensitivity: CRITICAL, Risk Weight: 9)
6. `Resume & Employment Dossier` (Sensitivity: MEDIUM, Risk Weight: 4)
7. `Personal Photograph & Media` (Sensitivity: HIGH, Risk Weight: 6)
8. `Biometric Profile Category` (Sensitivity: CRITICAL, Risk Weight: 10)
9. `Health & Medical Record Category` (Sensitivity: CRITICAL, Risk Weight: 9)
10. `Location & Tracking History` (Sensitivity: HIGH, Risk Weight: 7)
11. `Credentials & Security Profile` (Sensitivity: CRITICAL, Risk Weight: 10)
12. `Browsing & Behavioral Profiling` (Sensitivity: MEDIUM, Risk Weight: 4)

*Note: Zero fake users, zero fake websites, and zero fabricated exposure entries were created. Reference data is strictly segregated from authentic user data.*

---

## 5. Live PostgreSQL 18.6 Verification Results

Automated test runner: [`scripts/verify-db.ts`](file:///c:/Users/Lenovo/Documents/OBLIVION%20%E2%80%93%20The%20Internet's%20Forget%20Button/scripts/verify-db.ts) via `npm run db:verify:live`.

### Results Matrix:

| # | Verification Test | Result | Execution Details on PostgreSQL 18.6 |
| :-: | :--- | :---: | :--- |
| **1** | **Real Database Connection** | ✅ **PASSED** | Connected to database `oblivion_db` as user `postgres`. Engine: `PostgreSQL 18.6 on x86_64-windows`. |
| **2** | **All 10 Expected Tables** | ✅ **PASSED** | Verified presence of all 10 tables in public schema: `users`, `websites`, `exposure_records`, `data_categories`, `exposure_record_categories`, `removal_requests`, `request_history`, `reminders`, `notifications`, `audit_logs`. |
| **3** | **All 9 PostgreSQL Enum Types** | ✅ **PASSED** | Verified all 9 custom types: `AccountStatus`, `WebsiteCategory`, `SensitivityLevel`, `RecordStatus`, `RemovalRequestType`, `RequestStatus`, `ReminderType`, `ReminderStatus`, `NotificationType`. |
| **4** | **Expected Indexes & Constraints** | ✅ **PASSED** | Check constraint `check_risk_weight_positive` verified. All 5 unique constraint indexes verified in `pg_indexes`. |
| **5** | **Reference Data Count of 12** | ✅ **PASSED** | Exactly 12 reference data categories retrieved. All risk weights within valid 1-100 range. |
| **6** | **User Creation and Retrieval** | ✅ **PASSED** | Created temporary user `Test User Alpha`, retrieved via primary key UUID, confirmed field integrity. |
| **7** | **Unique Email Constraint** | ✅ **PASSED** | Attempted duplicate email insertion; rejected by PostgreSQL engine with unique constraint error `P2002`. |
| **8** | **Website Uniqueness Per User** | ✅ **PASSED** | Attempted duplicate `(user_id, website_url)` insertion; rejected by unique composite constraint `P2002`. |
| **9** | **Foreign-Key Integrity Across Graph**| ✅ **PASSED** | Traversed complete 10-table relational tree (User -> Website -> Exposure -> Categories, Requests, Reminders, Notifications, Logs) with exact cardinality matches. |
| **10**| **Exposure Record & Category Relations**| ✅ **PASSED** | Many-to-many relationship tested via `exposure_record_categories`; duplicate category link on same record successfully rejected. |
| **11**| **Removal Request & History Relations**| ✅ **PASSED** | Created removal request, appended status change in `request_history`; validated bidirectional relation and audit retention. |
| **12**| **Tenant Isolation Between Two Users** | ✅ **PASSED** | User B attempted query on User A exposure records; returned 0 rows, confirming multi-tenant boundary partitioning. |
| **13**| **Cascade & Restrict Deletion Behavior** | ✅ **PASSED** | `RESTRICT`: Deletion of referenced `data_category` blocked (`P2003`). `CASCADE`: Deleting user cascaded across all 6 dependent tables with **0 orphaned records**. |

---

## 6. Cleanup Verification

- All temporary test users (`Test User Alpha`, `Test User Beta`), test websites, exposure records, removal requests, reminders, notifications, and test audit logs were completely purged by the verification runner's `finally` block.
- Target database `oblivion_db` remains in a clean state containing only the 12 verified reference data categories.
