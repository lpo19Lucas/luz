-- Multissegmento (S1): nicho do negócio. Aditiva; salões existentes ficam como barbearia.
ALTER TABLE "salons" ADD COLUMN "segment" TEXT NOT NULL DEFAULT 'barbearia';
