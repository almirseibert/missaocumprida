-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "owner_id" TEXT;
