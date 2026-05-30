-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "client_fee_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
ADD COLUMN     "client_fee_value" DOUBLE PRECISION,
ADD COLUMN     "client_total" DOUBLE PRECISION,
ALTER COLUMN "platform_fee_pct" SET DEFAULT 0.10;
