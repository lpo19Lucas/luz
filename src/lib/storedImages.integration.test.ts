/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Cobre as fotos de profissional e serviço: validação do arquivo, troca
 * (a antiga é apagada e a URL muda), remoção, isolamento entre salões, a rota
 * que serve a imagem e a API pública do salão devolvendo as URLs.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import {
  parseImageDataUrl,
  readImageField,
  setEntityImage,
  deleteStoredImage,
  storedImageUrl,
  MAX_IMAGE_BYTES,
} from "@/lib/storedImages";
import { GET as getImage } from "@/app/api/images/[id]/route";
import { GET as getSalon } from "@/app/api/salons/[salonSlug]/route";

// JPEG mínimo (bytes reais do cabeçalho) — o conteúdo não importa pra cá.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const JPEG = `data:image/jpeg;base64,${JPEG_BYTES.toString("base64")}`;
const PNG = `data:image/png;base64,${Buffer.from("png-fake").toString("base64")}`;

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("parseImageDataUrl", () => {
  it("aceita JPEG/PNG/WebP e devolve os bytes", () => {
    const parsed = parseImageDataUrl(JPEG);
    expect(parsed.contentType).toBe("image/jpeg");
    expect(parsed.bytes.equals(JPEG_BYTES)).toBe(true);
    expect(parseImageDataUrl(PNG).contentType).toBe("image/png");
  });

  it("recusa outros tipos (inclusive SVG, que pode carregar script)", () => {
    expect(() => parseImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toThrow(/não suportado/);
    expect(() => parseImageDataUrl("data:text/html;base64,PGgxPm9pPC9oMT4=")).toThrow(/não suportado/);
    expect(() => parseImageDataUrl("https://exemplo.com/foto.jpg")).toThrow(/não suportado/);
  });

  it("recusa imagem grande demais", () => {
    const big = `data:image/jpeg;base64,${Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64")}`;
    expect(() => parseImageDataUrl(big)).toThrow(/grande demais/);
  });
});

describe("readImageField", () => {
  function form(data: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(data)) fd.set(k, v);
    return fd;
  }
  it("vazio = manter, removeImage = remover, data URL = trocar", () => {
    expect(readImageField(form({ imageData: "", removeImage: "off" }))).toBeUndefined();
    expect(readImageField(form({}))).toBeUndefined();
    expect(readImageField(form({ imageData: "", removeImage: "on" }))).toBeNull();
    expect(readImageField(form({ imageData: JPEG, removeImage: "off" }))).toBe(JPEG);
  });
});

describe("setEntityImage", () => {
  it("põe, troca (apagando a antiga) e remove a foto do profissional", async () => {
    const { salon, professional } = await createTestSalon();
    const target = { kind: "professional" as const, id: professional.id };

    const first = await setEntityImage(salon.id, target, JPEG);
    expect((await prisma.professional.findUniqueOrThrow({ where: { id: professional.id } })).photoImageId).toBe(first);

    const second = await setEntityImage(salon.id, target, PNG);
    expect(second).not.toBe(first);
    expect(await prisma.storedImage.findUnique({ where: { id: first! } })).toBeNull();
    expect(await prisma.storedImage.count()).toBe(1);

    expect(await setEntityImage(salon.id, target, null)).toBeNull();
    expect((await prisma.professional.findUniqueOrThrow({ where: { id: professional.id } })).photoImageId).toBeNull();
    expect(await prisma.storedImage.count()).toBe(0);
  });

  it("funciona pra serviço", async () => {
    const { salon, service } = await createTestSalon();
    const id = await setEntityImage(salon.id, { kind: "service", id: service.id }, JPEG);
    expect((await prisma.service.findUniqueOrThrow({ where: { id: service.id } })).imageId).toBe(id);
  });

  it("não mexe em profissional de outro salão", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    await expect(setEntityImage(a.salon.id, { kind: "professional", id: b.professional.id }, JPEG)).rejects.toThrow(
      /não encontrado/
    );
    expect(await prisma.storedImage.count()).toBe(0);
  });

  it("arquivo inválido não cria nada", async () => {
    const { salon, professional } = await createTestSalon();
    await expect(setEntityImage(salon.id, { kind: "professional", id: professional.id }, "data:text/plain;base64,b2k=")).rejects.toThrow();
    expect(await prisma.storedImage.count()).toBe(0);
  });

  it("deleteStoredImage só apaga imagem do próprio salão", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    const id = await setEntityImage(a.salon.id, { kind: "service", id: a.service.id }, JPEG);
    await deleteStoredImage(b.salon.id, id);
    expect(await prisma.storedImage.count()).toBe(1);
    await deleteStoredImage(a.salon.id, id);
    expect(await prisma.storedImage.count()).toBe(0);
  });
});

describe("GET /api/images/:id", () => {
  it("serve os bytes com o content-type e cache imutável", async () => {
    const { salon, professional } = await createTestSalon();
    const id = await setEntityImage(salon.id, { kind: "professional", id: professional.id }, JPEG);
    const res = await getImage(new NextRequest(`http://localhost${storedImageUrl(id)}`), { params: Promise.resolve({ id: id! }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await res.arrayBuffer()).equals(JPEG_BYTES)).toBe(true);
  });

  it("404 pra imagem inexistente", async () => {
    const res = await getImage(new NextRequest("http://localhost/api/images/x"), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/salons/:slug (agendamento público)", () => {
  it("inclui a URL da foto do profissional e do serviço", async () => {
    const { salon, professional, service } = await createTestSalon();
    const photoId = await setEntityImage(salon.id, { kind: "professional", id: professional.id }, JPEG);
    const res = await getSalon(new NextRequest(`http://localhost/api/salons/${salon.slug}`), {
      params: Promise.resolve({ salonSlug: salon.slug }),
    });
    const body = await res.json();
    expect(body.professionals[0].photoUrl).toBe(`/api/images/${photoId}`);
    expect(body.services[0]).toMatchObject({ id: service.id, imageUrl: null });
  });
});
