import { test, expect } from "@playwright/test";
import { signupSalon, createService, createProfessionalFullWeek, publishSalon } from "./helpers";

test("cliente avalia atendimento concluído, avaliação aparece pro dono e na vitrine pública", async ({ page }) => {
  await signupSalon(page, "reviews");
  await createService(page, { name: "Corte", durationMinutes: 30, priceReais: 40 });
  await createProfessionalFullWeek(page, { name: "Barbeiro", serviceName: "Corte" });
  const slug = await publishSalon(page);

  await page.goto("/profissionais");
  const professionalId = await page
    .locator('a[href^="/profissionais/"]')
    .first()
    .getAttribute("href")
    .then((href) => href!.split("/profissionais/")[1]);
  await page.goto("/servicos");
  const serviceId = await page
    .locator('a[href^="/servicos/"]')
    .first()
    .getAttribute("href")
    .then((href) => href!.split("/servicos/")[1]);

  // Cria o agendamento direto pela API do dono (B3) num horário já passado —
  // o que este spec exercita de ponta a ponta é o fluxo de avaliação, não a
  // UI de agendamento manual (já coberta pelos testes de integração).
  const past = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const createRes = await page.request.post("/api/owner/appointments", {
    data: {
      professionalId,
      serviceId,
      clientName: "Cliente Review",
      clientPhone: `1199977${String(Date.now()).slice(-4)}`,
      startAt: past,
      wantsToPayNow: false,
    },
  });
  expect(createRes.ok()).toBe(true);
  const { accessToken } = await createRes.json();

  // Dono marca "Concluído" na agenda — ?date= é o calendário de Brasília
  // (UTC-3), não UTC (ver src/lib/timezone.ts), então convertemos antes de
  // montar a URL: perto da meia-noite UTC isso é um dia diferente do "hoje" em UTC.
  const brasiliaDate = new Date(new Date(past).getTime() - 3 * 60 * 60_000).toISOString().slice(0, 10);
  await page.goto(`/agenda?date=${brasiliaDate}`);
  await page.getByRole("button", { name: "✓ Concluído" }).click();
  await expect(page.getByText("Concluído").first()).toBeVisible();

  // Cliente avalia pelo link que recebeu (sem sessão).
  await page.goto(`/${slug}/agendamento/${accessToken}`);
  // MUI Rating usa um <input radio> visualmente oculto por trás do ícone —
  // precisa de force (o label visível intercepta o clique "normal").
  await page.getByRole("radio", { name: "5 Stars" }).click({ force: true });
  await page.getByPlaceholder("Comentário (opcional)").fill("Muito bom atendimento!");
  await page.getByRole("button", { name: "Enviar avaliação" }).click();
  await expect(page.getByText(/Você já avaliou .*, obrigado!/)).toBeVisible();

  // Dono vê em /avaliacoes.
  await page.goto("/avaliacoes");
  await expect(page.getByText("Cliente Review")).toBeVisible();
  await expect(page.getByText("Muito bom atendimento!")).toBeVisible();

  // Aparece na vitrine pública.
  await page.goto(`/${slug}`);
  await expect(page.getByText("Muito bom atendimento!")).toBeVisible();
});
