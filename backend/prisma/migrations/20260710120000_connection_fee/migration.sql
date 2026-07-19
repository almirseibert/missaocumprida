-- Remap 2.0 — Taxa de Conexão + configurações runtime + avisos do admin
-- Migração 100% aditiva. O escrow legado (payments) permanece intocado.

-- CreateEnum
CREATE TYPE "FeeSide" AS ENUM ('CLIENT', 'PROVIDER');

-- CreateEnum
CREATE TYPE "ConnectionFeeStatus" AS ENUM ('PENDING', 'PAID', 'COVERED', 'CREDITED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('POPUP', 'BANNER');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'CLIENTS', 'PROVIDERS');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FEE_REQUIRED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTACT_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'FEE_CREDITED';
ALTER TYPE "NotificationType" ADD VALUE 'ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "banned_at" TIMESTAMP(3),
ADD COLUMN     "ban_reason" TEXT,
ADD COLUMN     "deletion_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "client_fee_paid_at" TIMESTAMP(3),
ADD COLUMN     "provider_fee_paid_at" TIMESTAMP(3),
ADD COLUMN     "provider_fee_due_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "connection_fees" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "side" "FeeSide" NOT NULL,
    "pct_applied" DOUBLE PRECISION NOT NULL,
    "regular_pct" DOUBLE PRECISION NOT NULL,
    "base_amount" DOUBLE PRECISION NOT NULL,
    "credit_used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "surcharge_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gateway_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT,
    "mp_payment_id" TEXT,
    "status" "ConnectionFeeStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "credited_at" TIMESTAMP(3),
    "credit_reason" TEXT,
    "admin_reviewer_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connection_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'POPUP',
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "push_sent_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connection_fees_mp_payment_id_key" ON "connection_fees"("mp_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "connection_fees_proposal_id_side_key" ON "connection_fees"("proposal_id", "side");

-- CreateIndex
CREATE INDEX "connection_fees_order_id_idx" ON "connection_fees"("order_id");

-- CreateIndex
CREATE INDEX "connection_fees_user_id_status_idx" ON "connection_fees"("user_id", "status");

-- CreateIndex
CREATE INDEX "announcements_is_active_starts_at_idx" ON "announcements"("is_active", "starts_at");

-- AddForeignKey
ALTER TABLE "connection_fees" ADD CONSTRAINT "connection_fees_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_fees" ADD CONSTRAINT "connection_fees_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_fees" ADD CONSTRAINT "connection_fees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
