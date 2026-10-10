import type { Prisma, PrismaClient, AssetKind, AssetSize } from "@prisma/client";
import { getSegment } from "@/lib/segments";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Ficha extra do cliente (pet no pet shop, veículo no lava-jato) e preço por
 * porte. O segmento do salão decide se a ficha existe (features.clientProfile).
 */

export const ASSET_SIZES: AssetSize[] = ["SMALL", "MEDIUM", "LARGE"];

export function isAssetSize(value: unknown): value is AssetSize {
  return value === "SMALL" || value === "MEDIUM" || value === "LARGE";
}

export const ASSET_SIZE_LABEL: Record<AssetKind, Record<AssetSize, string>> = {
  PET: { SMALL: "Pequeno (até 10 kg)", MEDIUM: "Médio (10 a 25 kg)", LARGE: "Grande (acima de 25 kg)" },
  VEHICLE: { SMALL: "Compacto / hatch", MEDIUM: "Sedan / SUV", LARGE: "Grande / pickup / van" },
};

/** Textos da ficha por tipo, pros formulários. */
export const ASSET_FIELDS: Record<AssetKind, { title: string; name: string; detail: string; detailPlaceholder: string }> = {
  PET: { title: "Dados do pet", name: "Nome do pet", detail: "Raça", detailPlaceholder: "Ex.: Golden Retriever" },
  VEHICLE: { title: "Dados do veículo", name: "Modelo do veículo", detail: "Placa", detailPlaceholder: "Ex.: ABC1D23" },
};

/** Tipo de ficha do salão, ou null se o segmento não usa ficha. */
export function assetKindForSalon(salon: { segment?: string | null }): AssetKind | null {
  const profile = getSegment(salon.segment).features.clientProfile;
  return profile === "pet" ? "PET" : profile === "vehicle" ? "VEHICLE" : null;
}

export type SizePrices = Partial<Record<AssetSize, number>>;

/** Lê o JSON do banco ignorando o que não for preço inteiro válido. */
export function parseSizePrices(json: unknown): SizePrices {
  const out: SizePrices = {};
  if (!json || typeof json !== "object") return out;
  for (const size of ASSET_SIZES) {
    const value = (json as Record<string, unknown>)[size];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) out[size] = value;
  }
  return out;
}

/** Preço do serviço pro porte: o do porte, ou o preço base se o porte não tem preço próprio. */
export function priceForSize(service: { priceCents: number; sizePricesJson?: unknown }, size: AssetSize | null): number {
  if (!size) return service.priceCents;
  return parseSizePrices(service.sizePricesJson)[size] ?? service.priceCents;
}

/** Preço cobrado no atendimento: o gravado nele (porte) ou, nos antigos, o do serviço. */
export function appointmentPriceCents(appt: { priceCents: number | null; service: { priceCents: number } }): number {
  return appt.priceCents ?? appt.service.priceCents;
}

export type AssetInput = { name: string; size: AssetSize; detail?: string | null };

/** Valida o que veio do formulário; devolve null se faltar algo essencial. */
export function normalizeAssetInput(raw: { name?: unknown; size?: unknown; detail?: unknown } | null | undefined): AssetInput | null {
  if (!raw) return null;
  const name = String(raw.name ?? "").trim().slice(0, 60);
  const detail = String(raw.detail ?? "").trim().slice(0, 40);
  if (!name || !isAssetSize(raw.size)) return null;
  return { name, size: raw.size, detail: detail || null };
}

/** Reaproveita a ficha do mesmo cliente (mesmo nome e detalhe) e atualiza o porte; senão cria. */
export async function upsertClientAsset(
  db: Db,
  params: { salonId: string; clientId: string; kind: AssetKind; input: AssetInput }
) {
  const existing = await db.clientAsset.findFirst({
    where: {
      clientId: params.clientId,
      kind: params.kind,
      name: { equals: params.input.name, mode: "insensitive" },
      detail: params.input.detail ? { equals: params.input.detail, mode: "insensitive" } : null,
    },
  });
  if (existing) {
    return existing.size === params.input.size
      ? existing
      : db.clientAsset.update({ where: { id: existing.id }, data: { size: params.input.size } });
  }
  return db.clientAsset.create({
    data: {
      salonId: params.salonId,
      clientId: params.clientId,
      kind: params.kind,
      name: params.input.name,
      size: params.input.size,
      detail: params.input.detail,
    },
  });
}

/** "Thor · Golden Retriever · Grande" — pra agenda e ficha do cliente. */
export function assetSummary(asset: { kind: AssetKind; name: string; size: AssetSize; detail: string | null }) {
  return [asset.name, asset.detail, ASSET_SIZE_LABEL[asset.kind][asset.size].split(" (")[0].split(" /")[0]]
    .filter(Boolean)
    .join(" · ");
}
