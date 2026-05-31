-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER_NEARBY', 'PROPOSAL_RECEIVED', 'PROPOSAL_ACCEPTED', 'PROPOSAL_REJECTED', 'CHECKIN_DONE', 'SERVICE_COMPLETED', 'SERVICE_CONFIRMED', 'PAYMENT_RECEIVED', 'GENERAL');

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "checkin_address" TEXT,
ADD COLUMN     "checkin_lat" DOUBLE PRECISION,
ADD COLUMN     "checkin_lng" DOUBLE PRECISION,
ADD COLUMN     "checkin_photo_url" TEXT,
ADD COLUMN     "complete_address" TEXT,
ADD COLUMN     "complete_lat" DOUBLE PRECISION,
ADD COLUMN     "complete_lng" DOUBLE PRECISION,
ADD COLUMN     "complete_photo_url" TEXT,
ADD COLUMN     "duration_minutes" INTEGER,
ADD COLUMN     "hourly_amount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hourly_rate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
