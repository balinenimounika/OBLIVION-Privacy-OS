# OBLIVION – The Internet's Forget Button

**Next-Generation Personal Privacy Management & Right-to-be-Forgotten Orchestration Platform**

[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.6-blue.svg)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.19.3-2D3748.svg)](https://www.prisma.io/)
[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.3-black.svg)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-185%2F185%20Passed-brightgreen.svg)](./TESTING.md)

---

## 1. Overview & Problem Statement

### The Problem
Modern internet users leave widespread digital footprints across hundreds of platforms, data brokers, and websites. Personal data—such as phone numbers, home addresses, government IDs, and financial records—is routinely stored, indexed, and aggregated without active consent or ongoing visibility. While legal frameworks like **GDPR Article 17 (Right to be Forgotten)** and the **California Consumer Privacy Act (CCPA)** grant individuals the statutory right to request personal data erasure, exercising and tracking these rights manually across dozens of disparate platforms is fragmented, complex, and opaque.

### The Solution: OBLIVION
**OBLIVION** is a privacy management platform designed to automate, track, and score personal data exposure. It empowers users to:
1. Catalog websites and external data brokers holding their personal information.
2. Quantify personal privacy exposure through automated, category-weighted risk scoring.
3. Initiate and track formal GDPR/CCPA erasure requests through an audited state machine.
4. Schedule statutory follow-up reminders and receive automated alerts.
5. Generate verifiable data audit histories and GDPR Article 15 compliance exports.

---

## 2. Main Platform Features

- **Strict Multi-Tenant Isolation:** Complete data separation enforced via `TenantGuard`. Cross-tenant queries return uniform `404 Not Found` responses to prevent resource existence enumeration.
- **Dynamic Privacy Exposure Scoring:** Real-time risk index calculation based on data category risk weights (1–10) and sensitivity multipliers (`LOW 1.0x` to `CRITICAL 3.0x`).
- **Audited Removal State Machine:** Deterministic lifecycle progression (`DRAFT` ➔ `SUBMITTED` ➔ `ACKNOWLEDGED` ➔ `IN_PROGRESS` ➔ `COMPLETED`) with immutable status change history logs.
- **Centralized Audit Logging:** Asynchronous, non-blocking operational audit trail capturing 16 security and data lifecycle events with automatic credential scrubbing.
- **Compliance Portability:** GDPR Article 15 (Right of Access) and CCPA Section 1798.100 machine-readable JSON data export.
- **Brute-Force Protection:** Sliding-window rate limiting on authentication routes emitting standard `Retry-After` headers.
- **Robust Database Foundations:** 10 normalized PostgreSQL models, 9 native enums, and foreign key cascading purges with **zero orphaned records**.

---

## 3. Verified Technology Stack

| Layer | Component | Verified Version | Purpose |
| :--- | :--- | :---: | :--- |
| **Runtime** | Node.js | `v24.16.0 LTS` | High-performance asynchronous JavaScript engine |
| **Framework**| Express.js | `5.3.0` | Modern routing and HTTP middleware pipeline |
| **Language** | TypeScript | `5.7.3` | Static typing and compile-time type safety |
| **Database** | PostgreSQL | `18.6` | ACID relational database on port 5432 |
| **ORM** | Prisma ORM | `6.19.3` | Type-safe query builder, migrations, and pooling |
| **Validation**| Zod | `4.6.7` | Runtime schema validation and boundary clamping |
| **Security** | bcryptjs / JWT / Helmet | `3.0.3` / `9.0.3` / `8.3.0` | Password hashing (12 rounds), tokens, HTTP security |

---

## 4. Project Directory Structure

```text
OBLIVION – The Internet's Forget Button/
├── prisma/
│   ├── migrations/                 # Versioned SQL migration files
│   │   └── 20261103000000_init/   # Baseline PostgreSQL migration
│   ├── schema.prisma               # Prisma relational schema (10 models, 9 enums)
│   └── seed.ts                     # Reference data seeder (12 categories)
├── src/
│   ├── config/                     # Environment schema and Zod validation
│   ├── controllers/                # HTTP request handlers & serialization
│   ├── lib/                        # Prisma singleton client instance
│   ├── middleware/                 # Auth, CORS, Helmet, Rate Limiter, Tenant Guard
│   ├── routes/                     # Master API routing table (/api/v1)
│   ├── services/                   # Business logic, risk engine, audit logger
│   ├── types/                      # TypeScript domain types & interfaces
│   ├── utils/                      # ApiError, ApiResponse, Logger, TenantGuard
│   ├── validators/                 # Zod validation schemas
│   ├── app.ts                      # Express application assembly
│   └── server.ts                   # Process bootstrap and graceful shutdown
├── tests/                          # 12 Automated integration test suites (185 tests)
├── .env.example                    # Clean environment configuration template
├── package.json                    # Dependencies and npm test scripts
├── tsconfig.json                   # TypeScript compiler options
├── API_DOCUMENTATION.md            # Comprehensive REST API reference
├── ARCHITECTURE.md                 # System architecture and lifecycle diagrams
├── DATABASE.md                     # Database tables, enums, keys, and cascades
├── DEPLOYMENT.md                   # Production deployment checklist & guides
├── KNOWN_ISSUES.md                 # Transparent architectural trade-offs
├── SECURITY.md                     # Security controls and vulnerability audit
└── TESTING.md                      # Test execution instructions and scorecard
```

---

## 5. Getting Started (Windows Setup Guide)

Follow these step-by-step instructions to set up and run OBLIVION on a fresh Windows developer workstation:

### 5.1. Prerequisites
1. **Node.js 24 LTS:** Download and install from [nodejs.org](https://nodejs.org/).
2. **PostgreSQL 18:** Ensure PostgreSQL 18.x is installed on Windows and the Windows service (`postgresql-x64-18`) is running on port 5432.
3. **Database Creation:** Ensure database `oblivion_db` is created in PostgreSQL:
   ```powershell
   psql -U postgres -c "CREATE DATABASE oblivion_db;"
   ```

### 5.2. Installation
Open PowerShell in the project directory:
```powershell
# Navigate to project root:
cd "C:\Users\Lenovo\Documents\OBLIVION – The Internet's Forget Button"

# Install project dependencies:
npm install
```

### 5.3. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
Copy-Item .env.example .env
```
Open `.env` and set your local PostgreSQL password:
```ini
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/oblivion_db?schema=public"
JWT_SECRET="replace_with_a_secure_random_string_of_at_least_32_characters_for_production"
PORT="5000"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"
```

### 5.4. Database Setup (Migrations & Seeding)
```powershell
# Generate Prisma Client:
npm run db:generate

# Apply PostgreSQL database migrations (non-destructive):
npm run db:deploy

# Seed reference data (12 data categories):
npm run db:seed
```

### 5.5. Running the Application
```powershell
# Start local development server (with hot reload):
npm run dev

# Or build and run production bundle:
npm run build
npm start
```
The server will bind to `http://localhost:5000`. Test the health check endpoint:
```powershell
curl http://localhost:5000/health
# Expected: {"status":"healthy","database":"connected",...}
```

---

## 6. Testing & Quality Assurance

All 185 tests execute against live PostgreSQL 18.6:

```powershell
# Run Master Phase 6 Suite (E2E, Security, DB Integrity, Performance):
npm run test:phase6

# Run All Phase 4 Privacy API Modules (74 tests):
npm run test:phase4

# Run Individual Phase Suites:
npm test                  # Phase 1: Foundation & Health (6 tests)
npm run test:auth         # Phase 2: Authentication & JWT (14 tests)
npm run test:tenant       # Phase 3: Multi-Tenant Security (14 tests)
npm run test:audit        # Phase 5: Centralized Audit Logging (20 tests)
npm run test:e2e          # Phase 6: 16-Step End-to-End User Journey (16 tests)
npm run test:security     # Phase 6: 20 Security & Attack Vector Tests (20 tests)
npm run test:integrity    # Phase 6: Database Constraints & Cascades (15 tests)
npm run test:perf         # Phase 6: Concurrency & Scaled Pagination (6 tests)
```

See [**`TESTING.md`**](./TESTING.md) for full testing documentation.

---

## 7. Documentation Directory

- [**`API_DOCUMENTATION.md`**](./API_DOCUMENTATION.md): Complete REST endpoint reference with request/response examples and validation rules.
- [**`ARCHITECTURE.md`**](./ARCHITECTURE.md): System architecture, layered responsibilities, and request lifecycle diagrams.
- [**`SECURITY.md`**](./SECURITY.md): Security defenses, password hashing, IDOR mitigation, and rate limiting details.
- [**`DATABASE.md`**](./DATABASE.md): Detailed schema reference, enums, keys, foreign key cascades, and backup procedures.
- [**`TESTING.md`**](./TESTING.md): QA test harness, test account isolation, and test matrix breakdown.
- [**`DEPLOYMENT.md`**](./DEPLOYMENT.md): Production checklist, HTTPS, containerization, and infrastructure scaling.
- [**`KNOWN_ISSUES.md`**](./KNOWN_ISSUES.md): Transparent record of architectural boundaries and recommended roadmap enhancements.

---

## 8. Known Architectural Boundaries

As documented in [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md):
1. **Stateless JWT Invalidation:** Token revocation upon logout relies on client discard; immediate token invalidation before expiration requires a Redis blocklist or `tokenVersion` counter.
2. **Audit Logging Delivery Guarantees:** Audit logging uses direct-to-database writes; events failed during PostgreSQL outages are logged to system console/files but are not retried via a persistent message broker (Kafka/RabbitMQ).
3. **In-Memory Rate Limiting:** Sliding-window rate limiter tracks requests per Node.js process memory; horizontal scaling across multiple containers requires a shared Redis store.

---

## 9. License

Proprietary – All Rights Reserved. OBLIVION Privacy Systems.
