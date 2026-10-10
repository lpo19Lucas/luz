-- Ficha extra do cliente (pet/veículo) e preço por porte. Aditiva.
CREATE TYPE "AssetKind" AS ENUM ('PET', 'VEHICLE');
CREATE TYPE "AssetSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

CREATE TABLE "client_assets" (
  "id" TEXT NOT NULL,
  "salonId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "kind" "AssetKind" NOT NULL,
  "name" TEXT NOT NULL,
  "size" "AssetSize" NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_assets_clientId_idx" ON "client_assets"("clientId");
CREATE INDEX "client_assets_salonId_idx" ON "client_assets"("salonId");

ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_assets" ADD CONSTRAINT "client_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "services" ADD COLUMN "sizePricesJson" JSONB;

ALTER TABLE "appointments" ADD COLUMN "priceCents" INTEGER, ADD COLUMN "assetId" TEXT;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "client_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
