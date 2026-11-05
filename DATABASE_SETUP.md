# OBLIVION – Database Setup & Administration Guide

This guide provides end-to-end instructions for provisioning, configuring, migrating, seeding, verifying, and connecting the **OBLIVION** PostgreSQL database.

---

## 1. Prerequisites

- **PostgreSQL Server:** Version 16 or 18+ (Confirmed on PostgreSQL 18.6 x86_64 Windows service `postgresql-x64-18`).
- **Node.js:** v18.0.0 or higher (v24.16.0 verified).
- **Package Manager:** `npm` or `pnpm`.
- **Database Client / CLI (Optional):** `psql` command-line utility or graphical interface (pgAdmin 4, DBeaver).

---

## 2. Environment Configuration

1. Copy the example configuration template:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and set your PostgreSQL connection parameters:
   ```env
   # PostgreSQL Connection String
   # Format: postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE_NAME]?schema=[SCHEMA]&sslmode=[MODE]
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/oblivion_db?schema=public"

   # Connection Pool Settings
   DB_POOL_MIN="2"
   DB_POOL_MAX="10"
   DB_TIMEOUT_MS="30000"

   # Environment
   NODE_ENV="development"
   PORT="5000"
   ```

3. Ensure the database `oblivion_db` is created in PostgreSQL:
   ```sql
   CREATE DATABASE oblivion_db;
   ```
   *(Or via terminal: `createdb -U postgres oblivion_db`)*

---

## 3. Package Installation

Install required dependencies:
```bash
npm install
```

Installed packages:
- `@prisma/client`: Auto-generated, type-safe database client.
- `dotenv`: Environment variable loader.
- `prisma` (dev): Prisma CLI for migrations and code generation.
- `typescript` & `ts-node` (dev): TypeScript execution environment for seed and verification scripts.

---

## 4. Prisma Migrations & Schema Synchronization

### Option A: Standard Migration Workflow (Recommended for Development)
Runs all pending migrations and applies schema updates:
```bash
npm run db:migrate
# or
npx prisma migrate dev --name init
```

### Option B: Production Deployment Migration
Applies existing versioned migrations without interactive prompts:
```bash
npm run db:deploy
# or
npx prisma migrate deploy
```

### Option C: Direct Raw SQL Execution
If running without Node/Prisma or in environments with restrictive execution policies:
```bash
psql -U postgres -d oblivion_db -f prisma/migrations/20261103000000_init/migration.sql
```

### Generate Prisma Client Code
Generates type-safe TypeScript interfaces from `prisma/schema.prisma`:
```bash
npm run db:generate
# or
npx prisma generate
```

---

## 5. Reference Data Seeding

OBLIVION separates system reference data from user-generated records.  
The seed script populates only predefined privacy data categories with risk weights and sensitivity ratings. It **never** creates fake users or simulated accounts.

Run the seeder:
```bash
npm run db:seed
# or
npx ts-node prisma/seed.ts
```

Seeded Data Categories:
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

---

## 6. Database Verification Suite

OBLIVION provides two automated verification suites:

### Option A: Live PostgreSQL Server Verification (Production / Integration)
Verifies the actual running PostgreSQL database instance (configured via `DATABASE_URL` in `.env`):
```bash
npm run db:verify:live
# or
npx ts-node scripts/verify-db.ts
```
*Executes all 13 live tests against the target PostgreSQL server and generates live status logs. See [`DATABASE_LIVE_VERIFICATION.md`](./DATABASE_LIVE_VERIFICATION.md) for full benchmark results.*

### Option B: Zero-Dependency In-Process Engine Verification
Verifies schema, check constraints, enums, seeds, and cascade rules using an in-process PostgreSQL engine:
```bash
npm run db:verify
# or
npx ts-node scripts/verify-pglite.ts
```

### Checks Executed by the Verification Suite:
1. **Database Connectivity:** Validates connection to `oblivion_db` and reports PostgreSQL engine version.
2. **Table Existence (10 Tables):** Validates `users`, `websites`, `exposure_records`, `data_categories`, `exposure_record_categories`, `removal_requests`, `request_history`, `reminders`, `notifications`, and `audit_logs`.
3. **Reference Data Completeness:** Confirms all 12 reference categories are present and risk weights fall between 1 and 100.
4. **Unique Constraints:** Verifies duplicate email rejection (`P2002`), duplicate website URL per user rejection, duplicate category link prevention, and reminder collision prevention.
5. **Foreign Key Integrity:** Tests relational traversal across deep entity trees (User -> Website -> Exposure -> Categories/Requests/Reminders/Notifications/AuditLogs).
6. **Referential Deletion Actions:**
   - Validates `RESTRICT` on referenced `data_categories`.
   - Validates `CASCADE` when a user account is purged, ensuring zero orphaned records remain.
7. **Multi-Tenant User Isolation:** Proves that Tenant B cannot access or view Tenant A's private exposure records.

---

## 7. Connecting the Backend (Step 2 Preview)

To connect the upcoming Express.js / Node.js backend:

1. Import the pre-configured Prisma Client:
   ```typescript
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();
   export default prisma;
   ```
2. Ensure `.env` is loaded before starting the Express server:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();
   ```
3. Test connectivity on startup:
   ```typescript
   async function startServer() {
     await prisma.$connect();
     console.log('Database connected successfully');
     app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
   }
   ```
