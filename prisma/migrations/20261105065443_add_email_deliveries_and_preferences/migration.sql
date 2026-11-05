-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OverdueFrequency" AS ENUM ('DAILY', 'THREE_DAYS', 'WEEKLY', 'NONE');

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "data_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exposure_record_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exposure_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reminders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "removal_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "request_history" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "websites" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reminder_id" UUID,
    "notification_id" UUID,
    "notification_stage" VARCHAR(50) NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "resend_email_id" VARCHAR(100),
    "delivery_status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ,
    "next_retry_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_created" BOOLEAN NOT NULL DEFAULT true,
    "notify_7_days_before" BOOLEAN NOT NULL DEFAULT true,
    "notify_3_days_before" BOOLEAN NOT NULL DEFAULT true,
    "notify_1_day_before" BOOLEAN NOT NULL DEFAULT true,
    "notify_due_today" BOOLEAN NOT NULL DEFAULT true,
    "notify_overdue" BOOLEAN NOT NULL DEFAULT true,
    "notify_completed" BOOLEAN NOT NULL DEFAULT true,
    "overdue_frequency" "OverdueFrequency" NOT NULL DEFAULT 'DAILY',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_deliveries_user_id_idx" ON "email_deliveries"("user_id");

-- CreateIndex
CREATE INDEX "email_deliveries_delivery_status_idx" ON "email_deliveries"("delivery_status");

-- CreateIndex
CREATE INDEX "email_deliveries_resend_email_id_idx" ON "email_deliveries"("resend_email_id");

-- CreateIndex
CREATE INDEX "email_deliveries_next_retry_at_idx" ON "email_deliveries"("next_retry_at");

-- CreateIndex
CREATE INDEX "email_deliveries_created_at_idx" ON "email_deliveries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_reminder_id_notification_stage_recipient_e_key" ON "email_deliveries"("reminder_id", "notification_stage", "recipient_email");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "user_notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_notification_preferences_user_id_idx" ON "user_notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "exposure_record_categories_exposure_record_id_data_category_id_" RENAME TO "exposure_record_categories_exposure_record_id_data_category_key";
