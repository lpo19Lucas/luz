/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Manifests do PWA: o do estabelecimento vem do banco (nome/cor do salão) e
 * o do dono é fixo.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { GET as salonManifest } from "./route";
import { GET as ownerManifest } from "@/app/app.webmanifest/route";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("manifests do PWA", () => {
  it("app do estabelecimento com nome e cor do salão", async () => {
    const { salon } = await createTestSalon();
    await prisma.salon.update({ where: { id: salon.id }, data: { name: "Studio Ana", primaryColor: "#7A1F5C" } });
    const res = await salonManifest(new NextRequest("http://localhost"), { params: Promise.resolve({ salonSlug: salon.slug }) });
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    const body = await res.json();
    expect(body).toMatchObject({ name: "Studio Ana", scope: `/${salon.slug}`, theme_color: "#7A1F5C" });
  });

  it("404 pra salão inexistente", async () => {
    const res = await salonManifest(new NextRequest("http://localhost"), { params: Promise.resolve({ salonSlug: "nao-existe" }) });
    expect(res.status).toBe(404);
  });

  it("app do dono", async () => {
    const body = await ownerManifest().json();
    expect(body.start_url).toBe("/agenda?source=pwa");
  });
});
