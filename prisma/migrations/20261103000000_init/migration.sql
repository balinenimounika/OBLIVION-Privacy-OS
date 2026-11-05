-- ==============================================================================
-- OBLIVION - The Internet's Forget Button
-- Initial PostgreSQL Migration: 20261103000000_init
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------------------------

CREATE TYPE "AccountStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED',
    'PENDING_VERIFICATION'
);

CREATE TYPE "WebsiteCategory" AS ENUM (
    'SOCIAL_MEDIA',
    'E_COMMERCE',
    'FINANCIAL_SERVICES',
    'HEALTHCARE',
    'EMPLOYMENT',
    'EDUCATION',
    'ENTERTAINMENT',
    'GOVERNMENT',
    'TELECOMMUNICATIONS',
    'UTILITIES',
    'OTHER'
);

CREATE TYPE "SensitivityLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE "RecordStatus" AS ENUM (
    'ACTIVE',
    'PENDING_REVIEW',
    'REMOVAL_REQUESTED',
    'REMOVED',
    'ARCHIVED'
);

CREATE TYPE "RemovalRequestType" AS ENUM (
    'GDPR_ERASURE',
    'CCPA_DELETION',
    'DATA_ERASURE_GENERAL',
    'ACCOUNT_CLOSURE',
    'MARKETING_OPT_OUT',
    'CUSTOM'
);

CREATE TYPE "RequestStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'ACKNOWLEDGED',
    'IN_PROGRESS',
    'FOLLOW_UP_REQUIRED',
    'COMPLETED',
    'REJECTED',
    'APPEALED'
);

CREATE TYPE "ReminderType" AS ENUM (
    'EXPIRY_CHECK',
    'ANNUAL_PRIVACY_REVIEW',
    'FOLLOW_UP_REMOVAL',
    'CONSENT_REVALIDATION',
    'CUSTOM'
);

CREATE TYPE "ReminderStatus" AS ENUM (
    'PENDING',
    'DISMISSED',
    'SNOOZED',
    'COMPLETED'
);

CREATE TYPE "NotificationType" AS ENUM (
    'SECURITY_ALERT',
    'REMINDER_DUE',
    'REQUEST_STATUS_UPDATE',
    'SYSTEM_NOTICE',
    'EXPOSURE_EXPIRING'
);

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- ------------------------------------------------------------------------------
-- 2. WEBSITES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "websites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "website_name" VARCHAR(255) NOT NULL,
    "website_url" VARCHAR(1024) NOT NULL,
    "website_category" "WebsiteCategory" NOT NULL DEFAULT 'OTHER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "websites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "websites_user_id_website_url_key" ON "websites"("user_id", "website_url");
CREATE INDEX "websites_user_id_idx" ON "websites"("user_id");
CREATE INDEX "websites_website_name_idx" ON "websites"("website_name");
CREATE INDEX "websites_website_category_idx" ON "websites"("website_category");

-- ------------------------------------------------------------------------------
-- 3. EXPOSURE RECORDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "exposure_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "purpose" VARCHAR(255) NOT NULL,
    "sensitivity_level" "SensitivityLevel" NOT NULL DEFAULT 'MEDIUM',
    "date_shared" TIMESTAMPTZ NOT NULL,
    "review_date" TIMESTAMPTZ,
    "expiry_date" TIMESTAMPTZ,
    "record_status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exposure_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exposure_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exposure_records_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "exposure_records_user_id_idx" ON "exposure_records"("user_id");
CREATE INDEX "exposure_records_website_id_idx" ON "exposure_records"("website_id");
CREATE INDEX "exposure_records_record_status_idx" ON "exposure_records"("record_status");
CREATE INDEX "exposure_records_sensitivity_level_idx" ON "exposure_records"("sensitivity_level");
CREATE INDEX "exposure_records_review_date_idx" ON "exposure_records"("review_date");
CREATE INDEX "exposure_records_user_id_record_status_idx" ON "exposure_records"("user_id", "record_status");

-- ------------------------------------------------------------------------------
-- 4. DATA CATEGORIES TABLE (Reference Data)
-- ------------------------------------------------------------------------------
CREATE TABLE "data_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "default_sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'MEDIUM',
    "risk_weight" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_risk_weight_positive" CHECK ("risk_weight" >= 1 AND "risk_weight" <= 100)
);

CREATE UNIQUE INDEX "data_categories_category_name_key" ON "data_categories"("category_name");
CREATE INDEX "data_categories_category_name_idx" ON "data_categories"("category_name");
CREATE INDEX "data_categories_default_sensitivity_idx" ON "data_categories"("default_sensitivity");

-- ------------------------------------------------------------------------------
-- 5. EXPOSURE RECORD CATEGORIES TABLE (Many-to-Many Join)
-- ------------------------------------------------------------------------------
CREATE TABLE "exposure_record_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exposure_record_id" UUID NOT NULL,
    "data_category_id" UUID NOT NULL,

    CONSTRAINT "exposure_record_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exposure_record_categories_exposure_record_id_fkey" FOREIGN KEY ("exposure_record_id") REFERENCES "exposure_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exposure_record_categories_data_category_id_fkey" FOREIGN KEY ("data_category_id") REFERENCES "data_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "exposure_record_categories_exposure_record_id_data_category_id_key" ON "exposure_record_categories"("exposure_record_id", "data_category_id");
CREATE INDEX "exposure_record_categories_exposure_record_id_idx" ON "exposure_record_categories"("exposure_record_id");
CREATE INDEX "exposure_record_categories_data_category_id_idx" ON "exposure_record_categories"("data_category_id");

-- ------------------------------------------------------------------------------
-- 6. REMOVAL REQUESTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "removal_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "exposure_record_id" UUID NOT NULL,
    "request_type" "RemovalRequestType" NOT NULL DEFAULT 'GDPR_ERASURE',
    "request_reason" TEXT NOT NULL,
    "request_status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "external_reference" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "removal_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "removal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "removal_requests_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "removal_requests_exposure_record_id_fkey" FOREIGN KEY ("exposure_record_id") REFERENCES "exposure_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "removal_requests_user_id_idx" ON "removal_requests"("user_id");
CREATE INDEX "removal_requests_website_id_idx" ON "removal_requests"("website_id");
CREATE INDEX "removal_requests_exposure_record_id_idx" ON "removal_requests"("exposure_record_id");
CREATE INDEX "removal_requests_request_status_idx" ON "removal_requests"("request_status");
CREATE INDEX "removal_requests_submitted_at_idx" ON "removal_requests"("submitted_at");
CREATE INDEX "removal_requests_user_id_request_status_idx" ON "removal_requests"("user_id", "request_status");

-- ------------------------------------------------------------------------------
-- 7. REQUEST HISTORY TABLE (Audit Trail of Status Transitions)
-- ------------------------------------------------------------------------------
CREATE TABLE "request_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "removal_request_id" UUID NOT NULL,
    "previous_status" "RequestStatus",
    "new_status" "RequestStatus" NOT NULL,
    "remarks" TEXT,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "request_history_removal_request_id_fkey" FOREIGN KEY ("removal_request_id") REFERENCES "removal_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "request_history_removal_request_id_idx" ON "request_history"("removal_request_id");
CREATE INDEX "request_history_changed_at_idx" ON "request_history"("changed_at");

-- ------------------------------------------------------------------------------
-- 8. REMINDERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "reminders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "exposure_record_id" UUID NOT NULL,
    "reminder_type" "ReminderType" NOT NULL DEFAULT 'ANNUAL_PRIVACY_REVIEW',
    "reminder_date" TIMESTAMPTZ NOT NULL,
    "reminder_status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reminders_exposure_record_id_fkey" FOREIGN KEY ("exposure_record_id") REFERENCES "exposure_records"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reminders_exposure_record_id_reminder_type_reminder_date_key" ON "reminders"("exposure_record_id", "reminder_type", "reminder_date");
CREATE INDEX "reminders_user_id_idx" ON "reminders"("user_id");
CREATE INDEX "reminders_exposure_record_id_idx" ON "reminders"("exposure_record_id");
CREATE INDEX "reminders_reminder_status_idx" ON "reminders"("reminder_status");
CREATE INDEX "reminders_reminder_date_idx" ON "reminders"("reminder_date");
CREATE INDEX "reminders_user_id_reminder_status_idx" ON "reminders"("user_id", "reminder_status");

-- ------------------------------------------------------------------------------
-- 9. NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL DEFAULT 'SYSTEM_NOTICE',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- ------------------------------------------------------------------------------
-- 10. AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
