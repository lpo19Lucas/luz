import {
  SEGMENTS,
  SEGMENT_SLUGS,
  availableSegments,
  businessOf,
  cap,
  getSegment,
  isSegmentSlug,
} from "./segments";

describe("segmentos", () => {
  it("tem os 18 segmentos e cada configuração aponta pro próprio slug", () => {
    expect(SEGMENT_SLUGS).toHaveLength(18);
    expect(new Set(SEGMENT_SLUGS).size).toBe(18);
    for (const slug of SEGMENT_SLUGS) expect(SEGMENTS[slug].slug).toBe(slug);
  });

  it.each(SEGMENT_SLUGS)("%s: configuração completa", (slug) => {
    const seg = SEGMENTS[slug];
    expect(seg.label).toBeTruthy();
    expect(seg.schemaType).toBeTruthy();
    expect(seg.sampleServices.length).toBeGreaterThanOrEqual(3);
    for (const sv of seg.sampleServices) {
      expect(sv.durationMinutes).toBeGreaterThan(0);
      expect(Number.isInteger(sv.priceCents)).toBe(true);
    }
    expect(seg.landing.pains.length).toBeGreaterThanOrEqual(3);
    expect(seg.landing.faq.length).toBeGreaterThanOrEqual(1);
    expect(seg.landing.examples.length).toBeGreaterThanOrEqual(3);
    for (const word of Object.values(seg.vocab)) expect(word).toBeTruthy();
  });

  it("saúde (onda 3) está aberta, sempre em modo discreto; podóloga também", () => {
    for (const slug of ["psicologo", "fisioterapeuta", "dentista", "medico"] as const) {
      expect(SEGMENTS[slug].wave).toBe(3);
      expect(SEGMENTS[slug].available).toBe(true);
      expect(SEGMENTS[slug].features.discreet).toBe(true);
    }
    expect(SEGMENTS.podologa.features.discreet).toBe(true);
  });

  it("pet shop e lava-jato usam ficha (pet / veículo) e estão abertos", () => {
    expect(SEGMENTS["pet-shop"].features.clientProfile).toBe("pet");
    expect(SEGMENTS["lava-jato"].features.clientProfile).toBe("vehicle");
    expect(SEGMENTS["pet-shop"].available).toBe(true);
    expect(SEGMENTS["lava-jato"].available).toBe(true);
  });

  it("os 18 segmentos estão disponíveis", () => {
    expect(availableSegments()).toHaveLength(18);
  });

  it("getSegment cai em barbearia para valor desconhecido", () => {
    expect(getSegment("manicure").slug).toBe("manicure");
    expect(getSegment("xyz").slug).toBe("barbearia");
    expect(getSegment(null).slug).toBe("barbearia");
    expect(isSegmentSlug("dentista")).toBe(true);
    expect(isSegmentSlug("xyz")).toBe(false);
  });

  it("vocabulário: alunos têm aula, pacientes têm sessão ou consulta", () => {
    expect(SEGMENTS["personal-trainer"].vocab.client).toBe("aluno");
    expect(SEGMENTS["personal-trainer"].vocab.appointment).toBe("aula");
    expect(SEGMENTS["pet-shop"].vocab.client).toBe("tutor");
    expect(SEGMENTS.psicologo.vocab.client).toBe("paciente");
  });

  it("cap e businessOf", () => {
    expect(cap("cliente")).toBe("Cliente");
    expect(businessOf(SEGMENTS.barbearia.vocab)).toBe("da barbearia");
    expect(businessOf(SEGMENTS.cabeleireira.vocab)).toBe("do salão");
  });
});
