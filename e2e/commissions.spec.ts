import { test, expect } from "@playwright/test";
import { signupSalon, createService, createProfessionalFullWeek, publishSalon } from "./helpers";

test("dono define comissão, conclui atendimento e vê o valor calculado em /comissoes", async ({ page }) => {
  await signupSalon(page, "comissoes");
  await createService(page, { name: "Corte", durationMinutes: 30, priceReais: 100 });
  await createProfessionalFullWeek(page, { name: "Barbeiro", serviceName: "Corte" });
  await publishSalon(page);

  await page.goto("/profissionais");
  const editHref = await page.locator('a[href^="/profissionais/"]').first().getAttribute("href");
  const professionalId = editHref!.split("/profissionais/")[1];
  await page.goto(editHref!);
  await page.getByLabel("Comissão (%)").fill("40");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForURL("**/profissionais");

  await page.goto("/servicos");
  const serviceId = await page
    .locator('a[href^="/servicos/"]')
    .first()
    .getAttribute("href")
    .then((href) => href!.split("/servicos/")[1]);

  const past = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const createRes = await page.request.post("/api/owner/appointments", {
    data: {
      professionalId,
      serviceId,
      clientName: "Cliente Comissão",
      clientPhone: `1199966${String(Date.now()).slice(-4)}`,
      startAt: past,
      wantsToPayNow: false,
    },
  });
  expect(createRes.ok()).toBe(true);

  // ?date= é o calendário de Brasília, não UTC — ver comentário em reviews.spec.ts.
  const brasiliaDate = new Date(new Date(past).getTime() - 3 * 60 * 60_000).toISOString().slice(0, 10);
  await page.goto(`/agenda?date=${brasiliaDate}`);
  await page.getByRole("button", { name: "✓ Concluído" }).click();
  await expect(page.getByText("Concluído").first()).toBeVisible();

  // Serviço de R$100 com 40% de comissão = R$40,00.
  await page.goto("/comissoes");
  await expect(page.getByText("Barbeiro")).toBeVisible();
  await expect(page.getByText("40%")).toBeVisible();
  // Aparece duas vezes (total do período + linha do profissional) — basta confirmar que existe.
  await expect(page.getByText("R$ 40,00").first()).toBeVisible();
});
