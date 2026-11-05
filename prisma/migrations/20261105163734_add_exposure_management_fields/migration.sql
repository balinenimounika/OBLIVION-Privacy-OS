-- CreateEnum
CREATE TYPE "ExposureSource" AS ENUM ('ACCOUNT_REGISTRATION', 'JOB_APPLICATION', 'SOCIAL_MEDIA', 'PUBLIC_WEBSITE', 'ONLINE_PURCHASE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExposureVisibility" AS ENUM ('PRIVATE', 'RESTRICTED', 'PUBLIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DataSharingStatus" AS ENUM ('ACTIVE', 'NO_LONGER_SHARED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RemediationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'RESOLVED');

-- AlterTable
ALTER TABLE "exposure_records" ADD COLUMN     "data_description" TEXT,
ADD COLUMN     "evidence_attachment" VARCHAR(1024),
ADD COLUMN     "exposure_source" "ExposureSource" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "last_verified_date" TIMESTAMPTZ,
ADD COLUMN     "platform_url" VARCHAR(1024),
ADD COLUMN     "remediation_status" "RemediationStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "sharing_status" "DataSharingStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "visibility" "ExposureVisibility" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "exposure_records_remediation_status_idx" ON "exposure_records"("remediation_status");

-- CreateIndex
CREATE INDEX "exposure_records_visibility_idx" ON "exposure_records"("visibility");

-- CreateIndex
CREATE INDEX "exposure_records_sharing_status_idx" ON "exposure_records"("sharing_status");
