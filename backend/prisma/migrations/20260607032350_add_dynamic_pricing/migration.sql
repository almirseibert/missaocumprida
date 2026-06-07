-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "archetype" TEXT,
ADD COLUMN     "pricing_formula" JSONB,
ADD COLUMN     "pricing_unit" TEXT,
ADD COLUMN     "region_multiplier" JSONB;

-- AlterTable
ALTER TABLE "questionnaire_fields" ADD COLUMN     "key" TEXT,
ADD COLUMN     "pricing_effect" JSONB;
