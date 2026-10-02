import { test, expect, Page } from "@playwright/test";
import { signupSalon, createService, createProfessionalFullWeek, publishSalon } from "./helpers";

// Fases A-D do roadmap de outubro (fluxo de agendamento self-service, link
// único de gerenciar agendamento, agenda do dono) — esses 4 testes ficaram
// `test.skip` desde que o arquivo foi criado (comentário antigo dizia que as
// páginas eram placeholders; isso já não é verdade desde as Fases A-D).
// Cada teste sobe um salão do zero pela própria UI (sem seed de e2e).

async function setupPublishedSalon(page: Page, label: string) {
  await signupSalon(page, label);
  await createService(page, { name: "Corte", durationMinutes: 30, priceReais: 50 });
  await createProfessionalFullWeek(page, { name: "Barbeiro", serviceName: "Corte" });
  const slug = await publishSalon(page);
  return slug;
}

function tomorrowISODate() {
  const d = new Date(Date.now() + 24 * 60 * 60_000);
  return d.toISOString().slice(0, 10);
}

/** Primeiro horário do meio do dia (não o literal primeiro slot, que pode
 * cair bem na virada da meia-noite de Brasília — só o container de dev local
 * roda com TZ=America/Sao_Paulo, então `parseDate` da agenda interpreta
 * "T00:00:00" como meia-noite de Brasília em vez de UTC, diferente da
 * produção na Vercel, que sempre roda em UTC; nada a ver com um bug real do
 * produto, mas evita que o teste dependa desse detalhe do ambiente). */
async function clickAfternoonSlot(page: Page) {
  await page.getByText(/^1[0-6]:/).first().click();
}

test.describe("fluxo de agendamento self-service (spec seção 8.4)", () => {
  test("cliente agenda um horário disponível", async ({ page }) => {
    const slug = await setupPublishedSalon(page, "booking-public");

    await page.goto(`/${slug}`);
    await expect(page.getByText("Barbeiro")).toBeVisible();
    await page.getByText("Corte").click();
    await page.locator('input[type="date"]').first().fill(tomorrowISODate());
    await clickAfternoonSlot(page);
    await page.getByLabel("Nome").fill("Cliente Público");
    await page.getByLabel("Telefone").fill(`1198877${String(Date.now()).slice(-4)}`);
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();

    await expect(page.getByText("Agendamento confirmado!")).toBeVisible();
  });
});

test.describe("gestão de agendamento via link único (spec seção 8.6/8.7)", () => {
  test("cliente cancela o próprio agendamento pelo token", async ({ page }) => {
    const slug = await setupPublishedSalon(page, "booking-cancel");

    await page.goto(`/${slug}`);
    await page.getByText("Corte").click();
    await page.locator('input[type="date"]').first().fill(tomorrowISODate());
    await clickAfternoonSlot(page);
    await page.getByLabel("Nome").fill("Cliente Cancela");
    await page.getByLabel("Telefone").fill(`1198866${String(Date.now()).slice(-4)}`);
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByText("Agendamento confirmado!")).toBeVisible();

    const manageHref = await page.locator('a[href*="/agendamento/"]').getAttribute("href");
    await page.goto(manageHref!);
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Cancelado")).toBeVisible();
  });

  test("cliente confirma presença pelo token", async ({ page }) => {
    const slug = await setupPublishedSalon(page, "booking-confirm");

    await page.goto(`/${slug}`);
    await page.getByText("Corte").click();
    await page.locator('input[type="date"]').first().fill(tomorrowISODate());
    await clickAfternoonSlot(page);
    await page.getByLabel("Nome").fill("Cliente Confirma");
    await page.getByLabel("Telefone").fill(`1198855${String(Date.now()).slice(-4)}`);
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByText("Agendamento confirmado!")).toBeVisible();

    const manageHref = await page.locator('a[href*="/agendamento/"]').getAttribute("href");
    await page.goto(manageHref!);
    await page.getByRole("button", { name: "Confirmar presença" }).click();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  });
});

test.describe("agenda do dono (spec 8.10, P0.13)", () => {
  test("dono vê os agendamentos do dia por profissional", async ({ page }) => {
    const slug = await setupPublishedSalon(page, "booking-agenda");

    await page.goto(`/${slug}`);
    await page.getByText("Corte").click();
    const tomorrow = tomorrowISODate();
    await page.locator('input[type="date"]').first().fill(tomorrow);
    await clickAfternoonSlot(page);
    await page.getByLabel("Nome").fill("Cliente Agenda");
    await page.getByLabel("Telefone").fill(`1198844${String(Date.now()).slice(-4)}`);
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();
    await expect(page.getByText("Agendamento confirmado!")).toBeVisible();

    await page.goto(`/agenda?date=${tomorrow}`);
    await expect(page.getByText("Barbeiro")).toBeVisible();
    await expect(page.getByText("Cliente Agenda")).toBeVisible();
    await expect(page.getByText("Corte")).toBeVisible();
  });
});
