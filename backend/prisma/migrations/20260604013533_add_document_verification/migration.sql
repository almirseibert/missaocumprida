-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "document_photo_url" TEXT,
ADD COLUMN     "document_rejection_reason" TEXT,
ADD COLUMN     "document_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "document_submitted_at" TIMESTAMP(3),
ADD COLUMN     "document_verification_status" "VerificationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "selfie_photo_url" TEXT;
