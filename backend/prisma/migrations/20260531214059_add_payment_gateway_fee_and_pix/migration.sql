-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "gateway_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "gateway_fee_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "payment_method" TEXT,
ALTER COLUMN "stripe_payment_intent" DROP NOT NULL;
