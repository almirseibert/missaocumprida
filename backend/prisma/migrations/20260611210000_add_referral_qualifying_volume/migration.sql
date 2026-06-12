-- Indicação por meta de volume: acumula o GMV de serviços do indicado.
-- Os bônus só são liberados quando este valor cruza REFERRAL_THRESHOLD.
ALTER TABLE "referral_events" ADD COLUMN "qualifying_volume" DOUBLE PRECISION NOT NULL DEFAULT 0;
