export type SalonAddress = {
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
};

/** Endereço em uma linha: "Rua X, 10 · Centro — Cidade/UF" (partes vazias somem). */
export function formatSalonAddress(salon: SalonAddress) {
  const line1 = [salon.addressStreet, salon.addressNumber].filter(Boolean).join(", ");
  const line2 = [
    salon.addressNeighborhood,
    salon.addressCity && salon.addressState ? `${salon.addressCity}/${salon.addressState}` : salon.addressCity,
  ]
    .filter(Boolean)
    .join(" — ");
  return [line1, line2].filter(Boolean).join(" · ");
}
