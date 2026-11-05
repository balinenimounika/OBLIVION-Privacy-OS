# OBLIVION – PostgreSQL Database Architecture & Schema Reference

**Platform:** OBLIVION – The Internet's Forget Button  
**Engine:** PostgreSQL 18.6 (`oblivion_db` on port 5432)  
**ORM:** Prisma 6.19.3  
**Database Models:** 10 Tables  
**PostgreSQL Native Enums:** 9 Enums  
**Reference Data:** 12 Seeded Categories  
**Status:** Live Verified Against Real PostgreSQL (185/185 Tests Passing)

---

## 1. Native PostgreSQL Enums (9 Total)

| Enum Identifier | Allowed Values | Semantic Domain |
| :--- | :--- | :--- |
| `AccountStatus` | `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `PENDING_VERIFICATION` | User lifecycle & access gating |
| `WebsiteCategory` | `SOCIAL_MEDIA`, `E_COMMERCE`, `FINANCIAL_SERVICES`, `HEALTHCARE`, `EMPLOYMENT`, `EDUCATION`, `ENTERTAINMENT`, `GOVERNMENT`, `TELECOMMUNICATIONS`, `UTILITIES`, `OTHER` | Classification of external platforms |
| `SensitivityLevel` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Data sensitivity multiplier for risk calculation |
| `RecordStatus` | `ACTIVE`, `PENDING_REVIEW`, `REMOVAL_REQUESTED`, `REMOVED`, `ARCHIVED` | Status of tracked exposure entry |
| `RemovalRequestType`| `GDPR_ERASURE`, `CCPA_DELETION`, `DATA_ERASURE_GENERAL`, `ACCOUNT_CLOSURE`, `MARKETING_OPT_OUT`, `CUSTOM` | Regulatory framework for erasure |
| `RequestStatus` | `DRAFT`, `SUBMITTED`, `ACKNOWLEDGED`, `IN_PROGRESS`, `FOLLOW_UP_REQUIRED`, `COMPLETED`, `REJECTED`, `APPEALED` | State machine of deletion request |
| `ReminderType` | `EXPIRY_CHECK`, `ANNUAL_PRIVACY_REVIEW`, `FOLLOW_UP_REMOVAL`, `CONSENT_REVALIDATION`, `CUSTOM` | Categorization of statutory deadlines |
| `ReminderStatus` | `PENDING`, `DISMISSED`, `SNOOZED`, `COMPLETED` | Operational state of reminders |
| `NotificationType` | `SECURITY_ALERT`, `REMINDER_DUE`, `REQUEST_STATUS_UPDATE`, `SYSTEM_NOTICE`, `EXPOSURE_EXPIRING` | System notification channel types |

---

## 2. Relational Database Tables (10 Total)

### 2.1. `users` Table
Stores authenticated tenant accounts.
- **Primary Key:** `id` (`UUID`, default: `gen_random_uuid()`)
- **Columns:**
  - `email` (`VARCHAR(255)`, `NOT NULL`, **UNIQUE**, indexed)
  - `password_hash` (`VARCHAR(255)`, `NOT NULL`)
  - `full_name` (`VARCHAR(100)`, `NOT NULL`)
  - `role` (`VARCHAR(20)`, default: `'USER'`)
  - `account_status` (`AccountStatus`, default: `'ACTIVE'`)
  - `created_at` (`TIMESTAMPTZ`, default: `now()`)
  - `updated_at` (`TIMESTAMPTZ`, default: `now()`)

### 2.2. `websites` Table
Catalogs third-party domains holding user personal information.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `user_id` ➔ `users(id)` (`ON DELETE CASCADE`)
- **Unique Constraint:** `(user_id, website_url)` (Prevents duplicate URLs per tenant, while allowing separate tenants to register the same URL).
- **Columns:** `website_name`, `website_url`, `website_category`, `created_at`, `updated_at`.

### 2.3. `data_categories` Table
Global reference data classifying categories of personal information and risk weights.
- **Primary Key:** `id` (`UUID`)
- **Unique Constraint:** `name` (`VARCHAR(100)`, **UNIQUE**)
- **Columns:** `name`, `description`, `sensitivity_level`, `risk_weight` (`INT`, 1–10).
- **Access Rule:** Read-only global catalog for authenticated tenants.

### 2.4. `exposure_records` Table
Tracks specific personal information entrusted to or found on a website.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `user_id` ➔ `users(id)` (`ON DELETE CASCADE`)
  - `website_id` ➔ `websites(id)` (`ON DELETE CASCADE`)
- **Columns:** `purpose`, `sensitivity_level`, `date_shared`, `review_date`, `expiry_date`, `record_status`, `notes`, `created_at`, `updated_at`.

### 2.5. `exposure_record_categories` (Join Table)
Many-to-many association between exposure records and reference data categories.
- **Primary Key:** Composite `(exposure_record_id, data_category_id)`
- **Foreign Keys:**
  - `exposure_record_id` ➔ `exposure_records(id)` (`ON DELETE CASCADE`)
  - `data_category_id` ➔ `data_categories(id)` (`ON DELETE RESTRICT`)

### 2.6. `removal_requests` Table
Tracks formal GDPR/CCPA right-to-be-forgotten requests.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `user_id` ➔ `users(id)` (`ON DELETE CASCADE`)
  - `website_id` ➔ `websites(id)` (`ON DELETE CASCADE`)
  - `exposure_record_id` ➔ `exposure_records(id)` (`ON DELETE CASCADE`)
- **Columns:** `request_type`, `request_status`, `request_reason`, `external_reference`, `tracking_token` (**UNIQUE**), `submitted_at`, `resolved_at`, `created_at`, `updated_at`.

### 2.7. `request_history` Table
Immutable, timestamped audit log of removal request state transitions.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `removal_request_id` ➔ `removal_requests(id)` (`ON DELETE CASCADE`)
- **Columns:** `from_status`, `to_status`, `remarks`, `created_at`.

### 2.8. `reminders` Table
Schedules follow-up notifications and statutory deadlines.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `user_id` ➔ `users(id)` (`ON DELETE CASCADE`)
  - `removal_request_id` ➔ `removal_requests(id)` (`ON DELETE CASCADE`, nullable)
  - `exposure_record_id` ➔ `exposure_records(id)` (`ON DELETE CASCADE`, nullable)
- **Unique Constraint:** `(exposure_record_id, reminder_type, reminder_date)`
- **Columns:** `title`, `notes`, `reminder_type`, `reminder_status`, `reminder_date`, `created_at`, `updated_at`.

### 2.9. `notifications` Table
In-app alerts and notifications delivered to tenants.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `user_id` ➔ `users(id)` (`ON DELETE CASCADE`)
- **Columns:** `title`, `message`, `notification_type`, `is_read` (boolean), `read_at`, `created_at`.

### 2.10. `audit_logs` Table
Centralized compliance audit trail recording security and data modification events.
- **Primary Key:** `id` (`UUID`)
- **Foreign Keys:**
  - `user_id` ➔ `users(id)` (`ON DELETE CASCADE`)
- **Columns:** `action` (`VARCHAR(100)`), `entity_type` (`VARCHAR(100)`), `entity_id` (`VARCHAR(64)`), `ip_address`, `user_agent`, `created_at`.
- **Integrity Rule:** Append-only table at API layer; update/delete operations are rejected.

---

## 3. Seeded Reference Data (12 Categories)

Seeded via `prisma/seed.ts` with verified risk weights:

| Category Name | Sensitivity Level | Risk Weight | Typical Data Points |
| :--- | :--- | :---: | :--- |
| **Email Address** | `LOW` | 3 | Personal and work email accounts |
| **Phone Number** | `MEDIUM` | 5 | Mobile and landline numbers |
| **Home Address** | `HIGH` | 7 | Residential address, postal code |
| **Government ID** | `CRITICAL` | 10 | SSN, Passport, Driver's License, National ID |
| **Financial Details** | `CRITICAL` | 9 | Bank accounts, credit cards, tax identifiers |
| **Health & Medical** | `CRITICAL` | 9 | Diagnoses, prescription histories, insurance |
| **Biometric Data** | `CRITICAL` | 10 | Facial scans, fingerprints, voiceprints |
| **Location Tracking**| `HIGH` | 7 | GPS coordinates, frequent locations |
| **Browsing History** | `MEDIUM` | 5 | Search terms, clickstreams, visit logs |
| **Employment Details**| `MEDIUM` | 4 | Resume, salary history, job applications |
| **Personal Photos** | `MEDIUM` | 4 | Personal photographs, media uploads |
| **Account Credentials**| `CRITICAL` | 10 | Usernames, security questions |

---

## 4. Migration History & Database Management

### Initial Migration
- **Migration Name:** `20261103000000_init`
- **Location:** `prisma/migrations/20261103000000_init/migration.sql`
- **Applied Status:** Successfully applied against `oblivion_db` in PostgreSQL 18.6.

### Safe Production Migration Commands
```bash
# Check current migration status against database without making changes:
npx prisma migrate status

# Apply pending migrations safely in production (non-destructive):
npx prisma migrate deploy

# Generate latest TypeScript Prisma Client types:
npx prisma generate
```

> [!CAUTION]
> **NEVER RUN `prisma migrate reset` OR `prisma db push` IN PRODUCTION.**  
> These commands can drop tables, purge user data, or overwrite existing migrations.

---

## 5. PostgreSQL Backup & Restore Procedures

### 5.1. Taking a Safe Logical Backup (`pg_dump`)
Run from the Windows Command Prompt or PowerShell (with PostgreSQL `bin` directory in PATH):
```powershell
# Create a timestamped, compressed custom-format backup:
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump -U postgres -h localhost -p 5432 -F c -b -v -f "oblivion_db_backup_$timestamp.dump" oblivion_db
```

### 5.2. Restoring from Backup (`pg_restore`)
```powershell
# Restore into an existing database:
pg_restore -U postgres -h localhost -p 5432 -d oblivion_db -v "oblivion_db_backup_20261103_120000.dump"
```
