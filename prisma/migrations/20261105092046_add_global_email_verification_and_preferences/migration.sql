-- AlterTable
ALTER TABLE "user_notification_preferences" ADD COLUMN     "notify_account_security" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_removal_updates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "welcome_email_sent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verification_token" VARCHAR(255),
ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT true;
