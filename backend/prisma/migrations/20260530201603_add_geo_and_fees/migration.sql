-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "platform_fee_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
ADD COLUMN     "platform_fee_value" DOUBLE PRECISION,
ADD COLUMN     "provider_amount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;
