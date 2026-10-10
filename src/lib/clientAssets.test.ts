import {
  appointmentPriceCents,
  assetKindForSalon,
  assetSummary,
  normalizeAssetInput,
  parseSizePrices,
  priceForSize,
} from "./clientAssets";

describe("preço por porte", () => {
  const service = { priceCents: 6000, sizePricesJson: { SMALL: 4000, LARGE: 9000 } };

  it("usa o preço do porte e cai no preço base quando o porte não tem preço próprio", () => {
    expect(priceForSize(service, "SMALL")).toBe(4000);
    expect(priceForSize(service, "LARGE")).toBe(9000);
    expect(priceForSize(service, "MEDIUM")).toBe(6000);
    expect(priceForSize(service, null)).toBe(6000);
    expect(priceForSize({ priceCents: 5000 }, "LARGE")).toBe(5000);
  });

  it("ignora lixo no JSON", () => {
    expect(parseSizePrices({ SMALL: -1, MEDIUM: 10.5, LARGE: "9000", OUTRO: 1 })).toEqual({});
    expect(parseSizePrices(null)).toEqual({});
    expect(parseSizePrices({ MEDIUM: 0 })).toEqual({ MEDIUM: 0 });
  });

  it("o preço do atendimento gravado vale; sem ele, o do serviço", () => {
    expect(appointmentPriceCents({ priceCents: 9000, service: { priceCents: 6000 } })).toBe(9000);
    expect(appointmentPriceCents({ priceCents: null, service: { priceCents: 6000 } })).toBe(6000);
  });
});

describe("ficha", () => {
  it("normaliza o que veio do formulário e recusa o incompleto", () => {
    expect(normalizeAssetInput({ name: "  Thor ", size: "LARGE", detail: " Golden " })).toEqual({
      name: "Thor",
      size: "LARGE",
      detail: "Golden",
    });
    expect(normalizeAssetInput({ name: "Thor", size: "LARGE", detail: "" })?.detail).toBeNull();
    expect(normalizeAssetInput({ name: "", size: "LARGE" })).toBeNull();
    expect(normalizeAssetInput({ name: "Thor", size: "ENORME" })).toBeNull();
    expect(normalizeAssetInput(null)).toBeNull();
  });

  it("o tipo de ficha vem do segmento", () => {
    expect(assetKindForSalon({ segment: "pet-shop" })).toBe("PET");
    expect(assetKindForSalon({ segment: "lava-jato" })).toBe("VEHICLE");
    expect(assetKindForSalon({ segment: "barbearia" })).toBeNull();
    expect(assetKindForSalon({})).toBeNull();
  });

  it("resumo pra agenda", () => {
    expect(assetSummary({ kind: "PET", name: "Thor", size: "LARGE", detail: "Golden" })).toBe("Thor · Golden · Grande");
    expect(assetSummary({ kind: "VEHICLE", name: "Onix", size: "SMALL", detail: "ABC1D23" })).toBe("Onix · ABC1D23 · Compacto");
  });
});
