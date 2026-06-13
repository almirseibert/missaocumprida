-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'HELD';
ALTER TYPE "PaymentStatus" ADD VALUE 'DISPUTED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "hold_until" TIMESTAMP(3),
ADD COLUMN     "admin_approved_at" TIMESTAMP(3),
ADD COLUMN     "admin_reviewer_id" TEXT,
ADD COLUMN     "review_notes" TEXT;
